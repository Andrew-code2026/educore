import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Check, CloudOff, Copy, FileText, History, Loader2, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Printer, Redo2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { emptyDoc, findBlock, type CreatorAttachment, type CreatorChatMessage, type CreatorEvent, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
import { ATTACH_MAX, describeAttachment, describeTurn, reuseUnchanged } from "@shared/creatorTurn";
import { useOptionalShellContext, type EduRole } from "@/components/shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { trpc } from "@/lib/trpc";
import { CreatorChat, type LiveTurn } from "./CreatorChat";
import { historyKey, historyShortcut, locateChange, useDocHistory } from "./docHistory";
import { IS_MAC, isEditingTarget } from "./keyboard";
import { EditableDocument, type ApplyOptions, type EditableDocumentHandle } from "./EditableDocument";
import { ErrorCard, formatWhen } from "./parts";
import { ResourceSheet } from "./ResourceSheet";
import { SectionJumper, StageTop } from "./SectionJumper";
import { revealChange, revealTarget, type RevealTarget } from "./reveal";
import { acceptMark, isReviewVisible, lastTurnMessage, pendingMarks, readStoredReview, startReview, storeReview, type TurnReview } from "./turnReview";
import { TurnReviewBar } from "./TurnReviewBar";
import { useCreatorAutosave, type SaveState } from "./useCreatorAutosave";
import "./creator.css";

type Preview = Extract<CreatorEvent, { type: "preview" }>;

/** Un solo aviso de guardado a la vez: el siguiente reemplaza al anterior en vez de apilarse. */
const SAVE_TOAST = "crt-save";
const DELETE_TOAST = "crt-deleted";
const TURN_TOAST = "crt-turn";
const ATTACH_TOAST = "crt-attach";

/** La revisión del último turno sobrevive a recargar la página, pero no a cerrar la pestaña. */
const reviewKey = (resourceId: number) => `educore.creator.review.${resourceId}`;

function loadStoredReview(resourceId: number) {
  try {
    return readStoredReview(window.sessionStorage.getItem(reviewKey(resourceId)));
  } catch {
    return null;
  }
}

const SAVE_LABELS: Record<SaveState, string> = {
  saved: "Guardado",
  pending: "Sin guardar",
  saving: "Guardando…",
  offline: "Sin conexión",
  waiting: "Esperando a la IA",
  conflict: "Cambió en otra ventana",
  error: "No se pudo guardar",
};

const UNDO_HINT = IS_MAC ? "⌘Z" : "Ctrl+Z";
const REDO_HINT = IS_MAC ? "⌘⇧Z" : "Ctrl+Y";

interface CreatorWorkspaceProps {
  role: EduRole;
  resourceId: number;
  schoolName: string;
  logoUrl?: string | null;
  aiReady: boolean;
  remaining: number | null;
  onBack: () => void;
  onOpen: (id: number) => void;
  onUsage: () => void;
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** El docente que prefiere trabajar con la hoja a pantalla completa lo conserva entre recursos. */
const FOCUS_STORAGE_KEY = "educore.creator.focus";

const SUGGESTIONS = ["Añade dos ejercicios de contexto real", "Haz una versión más corta", "Agrega un reto opcional al final"];

function useNarrow(query = "(max-width: 960px)") {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}

/** Editor de un recurso: el copiloto a un lado y la hoja al otro. */
export function CreatorWorkspace({ role, resourceId, schoolName, logoUrl, aiReady, remaining, onBack, onOpen, onUsage }: CreatorWorkspaceProps) {
  const utils = trpc.useUtils();
  const input = useMemo(() => ({ role, id: resourceId }), [role, resourceId]);

  const [doc, setDoc] = useState<ResourceDoc>(() => emptyDoc());
  const docRef = useRef(doc);
  docRef.current = doc;
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  /** Los bloques señalados del mensaje en curso: el chat los muestra hasta que el mensaje llega guardado. */
  const [pendingAttachments, setPendingAttachments] = useState<CreatorAttachment[]>([]);
  const [streamFailed, setStreamFailed] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pane, setPane] = useState<"doc" | "chat">("doc");
  const narrow = useNarrow();
  const sheetRef = useRef<EditableDocumentHandle>(null);
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  /** El panel del copiloto en pantalla ancha: se puede plegar del todo. Su ancho lo recuerda el grupo de paneles. */
  const chatPanel = useRef<ImperativePanelHandle>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const chatCollapsedRef = useRef(chatCollapsed);
  chatCollapsedRef.current = chatCollapsed;
  /** Dónde se monta el panel de edición de figuras y tablas, y si está abierto. */
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorOpenRef = useRef(editorOpen);
  editorOpenRef.current = editorOpen;
  /** Ancho del copiloto: el panel de edición ocupa exactamente su sitio, así la hoja no se mueve. */
  const copilotSlot = useRef<HTMLDivElement>(null);
  const [copilotWidth, setCopilotWidth] = useState(0);
  useEffect(() => {
    const slot = copilotSlot.current;
    if (!slot) return;
    const observer = new ResizeObserver(() => setCopilotWidth(slot.getBoundingClientRect().width));
    observer.observe(slot);
    return () => observer.disconnect();
  }, [narrow]);
  const toggleChatPanel = useCallback(() => {
    const panel = chatPanel.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setChatCollapsed(false);
    } else {
      panel.collapse();
      setChatCollapsed(true);
    }
  }, []);
  /** Bloques señalados para el próximo mensaje al copiloto. */
  const [attached, setAttached] = useState<string[]>([]);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  /** Cuenta las veces que el docente señaló un bloque: con cada una, el cursor pasa al cuadro del chat. */
  const [attachCount, setAttachCount] = useState(0);
  /** Lo que el último turno de la IA dejó marcado en la hoja; `null` cuando el docente ya lo dio por visto. */
  const [review, setReview] = useState<TurnReview | null>(null);
  /** El último turno tal como lo vio esta ventana: el documento de antes (si lo tuvo) y el de después. */
  const [lastTurn, setLastTurn] = useState<{ messageId: number; before: ResourceDoc | null; after: ResourceDoc } | null>(null);
  const lastTurnRef = useRef(lastTurn);
  lastTurnRef.current = lastTurn;
  /** El documento sobre el que se envió el mensaje en curso: al terminar el turno entra al historial como un paso. */
  const turnBase = useRef<ResourceDoc | null>(null);
  const sawWorking = useRef(false);
  const [undoingTurn, setUndoingTurn] = useState(false);
  const undoingTurnRef = useRef(false);
  /** Respuesta cuyo «deshacer» espera confirmación porque el recurso cambió después. */
  const [confirmUndo, setConfirmUndo] = useState<number | null>(null);

  // Modo enfoque: el mismo del resto de EduCore (oculta el menú y la barra superior de la app)
  const shell = useOptionalShellContext();
  const setShellFocus = shell?.setIsFocusMode;
  const focusMode = shell?.isFocusMode ?? false;
  useEffect(() => {
    if (!setShellFocus) return;
    try {
      if (window.localStorage.getItem(FOCUS_STORAGE_KEY) === "1") setShellFocus(true);
    } catch {
      // Sin almacenamiento local, el modo enfoque dura lo que la sesión
    }
    return () => setShellFocus(false);
  }, [setShellFocus]);
  const toggleFocus = () => {
    if (!setShellFocus) return;
    const next = !focusMode;
    setShellFocus(next);
    try {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ver arriba
    }
  };

  const detailQuery = trpc.creator.get.useQuery(input, {
    retry: 1,
    refetchOnWindowFocus: false,
    // Al volver la red reintenta el autoguardado: traer el documento a la vez podría reemplazar lo local por algo anterior
    refetchOnReconnect: false,
    // Sin canal en vivo, el avance de la IA se consulta cada pocos segundos
    refetchInterval: running && streamFailed ? 3000 : false,
  });
  const versionsQuery = trpc.creator.versions.useQuery(input, { enabled: versionsOpen, staleTime: 0 });
  // Sin red, React Query pausaría estas acciones sin avisar: mejor que fallen y lo diga cada una
  const { mutateAsync: saveDoc } = trpc.creator.saveDoc.useMutation({ networkMode: "always" });
  const { mutateAsync: sendMessage } = trpc.creator.sendMessage.useMutation({ networkMode: "always" });
  const { mutateAsync: requestTurnUndo } = trpc.creator.undoTurn.useMutation({ networkMode: "always" });
  const restoreMutation = trpc.creator.restoreVersion.useMutation({ networkMode: "always" });
  const duplicateMutation = trpc.creator.duplicate.useMutation({ networkMode: "always" });
  const removeMutation = trpc.creator.remove.useMutation({ networkMode: "always" });

  const autosave = useCreatorAutosave(
    useCallback(
      (next: ResourceDoc, baseVersion: number, { overwrite }: { overwrite: boolean }) => saveDoc({ role, id: resourceId, doc: next, baseVersion, ...(overwrite ? { overwrite } : {}) }),
      [resourceId, role, saveDoc],
    ),
    {
      onExitUnsaved: failure => {
        const reason = failure === "conflict" ? "el recurso había cambiado en otra ventana" : failure === "busy" ? "la IA estaba trabajando en él" : failure === "rejected" ? "el servidor no los aceptó" : "no había conexión";
        toast.error(`No se guardaron tus últimos cambios en «${docRef.current.title || "Recurso sin título"}»: ${reason}.`, { id: SAVE_TOAST, duration: 10_000 });
      },
    },
  );
  const { saveState, reset: resetAutosave, isDirty, update: updateAutosave, flush: flushAutosave, keepMine, retry: retryAutosave, lastFailure, lastRejection } = autosave;
  const history = useDocHistory();
  const { record: recordHistory, undo: popUndo, redo: popRedo, clear: clearHistory, turn: recordTurn, peek: peekHistory, ahead: isAhead } = history;
  const [conflictOpen, setConflictOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  const working = running || live !== null;
  const workingRef = useRef(working);
  workingRef.current = working;

  // Lo que llega del servidor reemplaza al documento local, salvo que el docente tenga cambios sin guardar
  const detail = detailQuery.data;
  useEffect(() => {
    if (!detail) return;
    const working = detail.running || detail.status === "generating";
    setRunning(working);
    if (!working) {
      setLive(null);
      setPreview(null);
      setPendingMessage(null);
    } else {
      setLive(current => current ?? { phase: "thinking", text: "", activities: [] });
    }
    if (working) sawWorking.current = true;
    if (isDirty()) return;
    // Durante un turno, el documento lo llevan los eventos en vivo: lo guardado aún es la versión anterior
    if (working && loadedRef.current) return;

    const first = !loadedRef.current;
    const base = working ? null : turnBase.current;
    // Terminó un turno: el que pidió esta ventana, o uno que encontró en marcha al abrir el recurso
    const turnEnded = !working && (base !== null || sawWorking.current);
    if (!working) {
      sawWorking.current = false;
      turnBase.current = null;
    }

    let next: ResourceDoc;
    if (base) {
      // El turno que pidió esta ventana entra al historial como un solo paso: Ctrl+Z lo deshace entero
      next = recordTurn(base, detail.doc);
    } else {
      next = reuseUnchanged(docRef.current, detail.doc);
      // Un documento que llega de fuera no se deshace paso a paso: para eso están las versiones
      if (next !== docRef.current) clearHistory();
    }
    docRef.current = next;
    setDoc(next);
    resetAutosave(next, detail.version);
    loadedRef.current = true;
    setLoaded(true);

    const answer = detail.messages[detail.messages.length - 1];
    if (turnEnded && answer?.role === "assistant" && answer.turn) {
      // Lo que la IA añadió o cambió queda marcado en la hoja hasta que el docente lo dé por visto
      setReview(startReview(answer.id, answer.turn, next));
      setLastTurn({ messageId: answer.id, before: base && base !== next ? base : null, after: next });
    } else if (first) {
      const stored = loadStoredReview(resourceId);
      const turn = lastTurnMessage(detail.messages);
      if (stored && turn?.turn && turn.id === stored.messageId) setReview(startReview(turn.id, turn.turn, next, stored));
    }
  }, [clearHistory, detail, isDirty, recordTurn, resetAutosave, resourceId]);

  const pendingReview = useMemo(() => pendingMarks(review, doc), [doc, review]);
  const marks = useMemo(() => new Map(pendingReview.map(mark => [mark.id, mark.kind])), [pendingReview]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (review) window.sessionStorage.setItem(reviewKey(resourceId), JSON.stringify(storeReview(review, doc, pendingReview)));
      else window.sessionStorage.removeItem(reviewKey(resourceId));
    } catch {
      // Sin almacenamiento de sesión, las marcas duran hasta recargar
    }
  }, [doc, loaded, pendingReview, resourceId, review]);

  // Un aviso por causa, no uno por intento: los reintentos no cambian el estado
  const previousSave = useRef<SaveState>(saveState);
  useEffect(() => {
    const before = previousSave.current;
    previousSave.current = saveState;
    if (before === saveState) return;
    if (saveState === "offline") toast.error("Sin conexión. Tus cambios siguen en esta ventana y se guardarán cuando vuelva.", { id: SAVE_TOAST });
    else if (saveState === "error") toast.error(lastRejection() ?? "No pudimos guardar tus cambios.", { id: SAVE_TOAST });
    else if (saveState === "conflict") setConflictOpen(true);
    else if (before === "offline" && saveState === "saved") toast.success("Volvió la conexión. Tus cambios quedaron guardados.", { id: SAVE_TOAST });
  }, [lastRejection, saveState]);

  // Lo que esperaba a la IA se guarda en cuanto termina el turno
  useEffect(() => {
    if (!working) retryAutosave();
  }, [retryAutosave, working]);

  /** Por qué no se pudo guardar antes de una acción que lo necesita. Ante un conflicto, se vuelve a mostrar la decisión. */
  const explainUnsaved = useCallback(
    (action: string) => {
      const failure = lastFailure();
      if (failure === "conflict") {
        setConflictOpen(true);
        return;
      }
      const reason = failure === "busy" ? "La IA está trabajando en este recurso; espera a que termine." : failure === "rejected" ? (lastRejection() ?? "No pudimos guardar tus cambios.") : "Revisa la conexión.";
      toast.error(`Guarda tus cambios antes de ${action}. ${reason}`, { id: SAVE_TOAST });
    },
    [lastFailure, lastRejection],
  );

  const finishTurn = useCallback(
    (event: Extract<CreatorEvent, { type: "done" }>) => {
      if (!event.ok && event.error) toast.error(event.error);
      setStreamFailed(false);
      void detailQuery.refetch();
      void utils.creator.list.invalidate();
      onUsage();
    },
    [detailQuery, onUsage, utils],
  );

  trpc.creator.events.useSubscription(input, {
    enabled: running && !streamFailed,
    onData: (event: CreatorEvent) => {
      switch (event.type) {
        case "status":
          setLive(current => ({ text: current?.text ?? "", activities: current?.activities ?? [], phase: event.phase }));
          break;
        case "text":
          setLive(current => ({ phase: current?.phase ?? "thinking", activities: current?.activities ?? [], text: (current?.text ?? "") + event.delta }));
          break;
        case "activity":
          setLive(current => ({ phase: current?.phase ?? "thinking", text: current?.text ?? "", activities: [...(current?.activities ?? []), event.activity] }));
          break;
        case "preview":
          setPreview(event);
          break;
        case "doc":
          setPreview(null);
          // Los bloques que no cambian conservan su objeto: no se vuelven a dibujar con cada paso de la IA
          setDoc(current => reuseUnchanged(current, event.doc));
          // El turno que pidió esta ventana se registra al terminar; uno que llega de fuera invalida el historial
          if (!turnBase.current) clearHistory();
          break;
        case "done":
          finishTurn(event);
          break;
      }
    },
    onError: () => setStreamFailed(true),
  });

  /** Una edición del docente (o deshacerla) se ve de inmediato y se manda a guardar. */
  const showLocal = useCallback(
    (next: ResourceDoc) => {
      docRef.current = next;
      setDoc(next);
      updateAutosave(next);
    },
    [updateAutosave],
  );

  const stepHistory = useCallback(
    (command: "undo" | "redo") => {
      if (workingRef.current || undoingTurnRef.current) return;
      const current = docRef.current;
      const next = command === "undo" ? popUndo(current) : popRedo(current);
      if (!next) return;
      toast.dismiss(DELETE_TOAST);
      showLocal(next);
      revealChange(locateChange(current, next));
    },
    [popRedo, popUndo, showLocal],
  );
  const undo = useCallback(() => stepHistory("undo"), [stepHistory]);
  const redo = useCallback(() => stepHistory("redo"), [stepHistory]);

  const applyOp = useCallback(
    (op: DocOp, options?: ApplyOptions): OpResult => {
      const before = docRef.current;
      const result = applyDocOp(before, op);
      if (!result.ok) {
        toast.error(result.error);
        return result;
      }
      if (result.changed) {
        // Lo que se aplica desde el panel es su propio paso: no se funde con la edición anterior del mismo bloque
        recordHistory(before, options?.ownStep ? undefined : historyKey(op));
        showLocal(result.doc);
        // Lo que se borra (o una celda que se quita con lo que tenía) se anuncia con la forma de deshacerlo
        if (op.op === "delete_blocks" || op.op === "delete_section" || op.op === "remove_cell") {
          const deleted = result.doc;
          const message = op.op === "remove_cell" ? `${result.summary}.` : op.op === "delete_section" ? "Sección eliminada." : op.blockIds.length > 1 ? "Bloques eliminados." : "Bloque eliminado.";
          toast(message, {
            id: DELETE_TOAST,
            // Solo deshace el borrado si no hubo otra edición después
            action: { label: "Deshacer", onClick: () => docRef.current === deleted && undo() },
          });
        } else {
          toast.dismiss(DELETE_TOAST);
        }
      }
      return result;
    },
    [recordHistory, showLocal, undo],
  );

  // Ctrl/Cmd+Z y Ctrl/Cmd+Shift+Z (o Ctrl+Y) fuera de los campos: dentro de un editor manda su propio historial
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = historyShortcut(event);
      if (!command || event.defaultPrevented || event.isComposing || isEditingTarget(event.target)) return;
      // Con el panel abierto, deshacer tocaría la hoja por debajo de su borrador: primero se aplica o se cancela
      if (editorOpenRef.current) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      stepHistory(command);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepHistory]);

  /** Conflicto: se descarta lo local sin guardar y se sigue desde lo último del servidor. */
  const loadLatest = async () => {
    setResolving(true);
    try {
      // Si la consulta falla, `refetch` devolvería lo que había en caché: mejor que lance
      const fresh = await detailQuery.refetch({ throwOnError: true });
      if (!fresh.data) throw new Error("sin datos");
      resetAutosave(fresh.data.doc, fresh.data.version);
      setDoc(fresh.data.doc);
      clearHistory();
      setReview(null);
      setConflictOpen(false);
      toast.success("Cargaste la versión más reciente.", { id: SAVE_TOAST });
    } catch {
      toast.error("No pudimos traer la versión más reciente. Revisa la conexión.", { id: SAVE_TOAST });
    } finally {
      setResolving(false);
    }
  };

  /** Conflicto: la versión de esta ventana se guarda encima; la otra queda en «Versiones». */
  const keepLocal = async () => {
    setResolving(true);
    try {
      const fresh = await detailQuery.refetch({ throwOnError: true });
      if (!fresh.data) throw new Error("sin datos");
      setConflictOpen(false);
      if (await keepMine(fresh.data.version)) toast.success("Guardamos tu versión. La otra quedó en «Versiones».", { id: SAVE_TOAST });
    } catch {
      toast.error("No pudimos consultar la versión más reciente. Revisa la conexión.", { id: SAVE_TOAST });
    } finally {
      setResolving(false);
    }
  };

  const handleSend = useCallback(
    async (message: string) => {
      // Mientras la IA trabaja la hoja no se edita: lo que haya abierto se guarda antes, y si no es válido no se pierde
      if (sheetRef.current && !sheetRef.current.settle()) {
        toast.error("Hay un bloque abierto con un dato por corregir. Corrígelo o descarta el cambio antes de escribirle al copiloto.");
        throw new Error("editing");
      }
      // La IA debe partir de lo último que escribió el docente
      if (!(await flushAutosave())) {
        explainUnsaved("escribirle al copiloto");
        throw new Error("unsaved");
      }
      // Solo viajan los bloques señalados que siguen en la hoja
      const sent = attachedRef.current.flatMap(id => findBlock(docRef.current, id)?.block ?? []).slice(0, ATTACH_MAX).map(describeAttachment);
      setPendingAttachments(sent);
      setPendingMessage(message);
      try {
        await sendMessage({ role, id: resourceId, message, blockIds: sent.map(attachment => attachment.id) });
        // Al terminar el turno, este documento entra al historial como el paso anterior
        turnBase.current = docRef.current;
        setAttached([]);
        // Las marcas del turno anterior ya cumplieron: empieza otro
        setReview(null);
        toast.dismiss(TURN_TOAST);
        setStreamFailed(false);
        setLive({ phase: "thinking", text: "", activities: [] });
        setRunning(true);
      } catch (error) {
        setPendingMessage(null);
        toast.error(errorMessage(error, "No pudimos enviar tu mensaje."));
        throw error;
      }
    },
    [explainUnsaved, flushAutosave, resourceId, role, sendMessage],
  );

  const handleRestore = async (versionId: number) => {
    if (!(await flushAutosave())) return explainUnsaved("restaurar una versión");
    try {
      const restored = await restoreMutation.mutateAsync({ role, id: resourceId, versionId });
      setDoc(restored.doc);
      resetAutosave(restored.doc, restored.version);
      clearHistory();
      setReview(null);
      toast.success("Versión restaurada.");
      void detailQuery.refetch();
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos restaurar esa versión."));
    }
  };

  const handleDuplicate = async () => {
    if (!(await flushAutosave())) return explainUnsaved("duplicar el recurso");
    try {
      const copy = await duplicateMutation.mutateAsync({ role, id: resourceId });
      void utils.creator.list.invalidate();
      toast.success("Copia creada.");
      onOpen(copy.id);
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos duplicar el recurso."));
    }
  };

  const handleDelete = async () => {
    try {
      await removeMutation.mutateAsync({ role, id: resourceId });
      void utils.creator.list.invalidate();
      toast.success("Recurso eliminado.");
      onBack();
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos eliminar el recurso."));
    }
  };

  const leave = () => {
    void utils.creator.list.invalidate();
    onBack();
  };

  const handleBack = async () => {
    if (await flushAutosave()) return leave();
    // Salir con cambios sin guardar es decisión del docente, nunca algo que pase en silencio
    if (lastFailure() === "conflict") return setConflictOpen(true);
    toast.error("Tus últimos cambios aún no se guardan.", { id: SAVE_TOAST, action: { label: "Salir sin guardar", onClick: leave } });
  };

  // Imprimir: se monta una copia limpia de la hoja y se abre el diálogo del navegador
  useEffect(() => {
    if (!printing) return;
    const previousTitle = document.title;
    const done = () => setPrinting(false);
    document.title = doc.title || "Recurso";
    // El resto de EduCore imprime en A4; las guías van en tamaño carta. La regla vive solo mientras se imprime.
    const pageRule = document.createElement("style");
    pageRule.textContent = "@page { size: letter portrait; margin: 15mm 16mm 16mm; }";
    document.head.appendChild(pageRule);
    window.addEventListener("afterprint", done);
    // Un cuadro de espera para que KaTeX y las gráficas de la copia terminen de dibujarse
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
      document.title = previousTitle;
      pageRule.remove();
    };
  }, [doc.title, printing]);

  const messages: CreatorChatMessage[] = useMemo(() => {
    const saved = detail?.messages ?? [];
    // El mensaje recién enviado se muestra de inmediato, hasta que llega guardado desde el servidor
    const last = saved[saved.length - 1];
    if (!pendingMessage || (last?.role === "user" && last.content === pendingMessage)) return saved;
    return [...saved, { id: -1, role: "user", content: pendingMessage, activity: [], attachments: pendingAttachments, createdAt: new Date() }];
  }, [detail?.messages, pendingAttachments, pendingMessage]);

  // Solo cuentan los bloques señalados que siguen en la hoja: uno borrado deja de mostrarse y de viajar
  const attachments = useMemo(
    () =>
      attached.flatMap(id => {
        const found = findBlock(doc, id);
        return found ? [describeAttachment(found.block)] : [];
      }),
    [attached, doc],
  );
  const attachedIds = useMemo(() => new Set(attachments.map(attachment => attachment.id)), [attachments]);

  const toggleAttach = useCallback((blockId: string) => {
    const current = attachedRef.current.filter(id => findBlock(docRef.current, id) !== null);
    if (current.includes(blockId)) {
      setAttached(current.filter(id => id !== blockId));
      return;
    }
    if (current.length >= ATTACH_MAX) {
      toast.error(`Puedes señalar hasta ${ATTACH_MAX} bloques por mensaje.`, { id: ATTACH_TOAST });
      return;
    }
    setAttached([...current, blockId]);
    setAttachCount(count => count + 1);
    // En pantalla angosta el chat no está a la vista: se dice dónde quedó
    if (narrowRef.current) toast("Bloque señalado para el copiloto.", { id: ATTACH_TOAST, action: { label: "Abrir copiloto", onClick: () => setPane("chat") } });
    // Plegado, el copiloto se abre: señalar un bloque es empezar a escribirle
    else if (chatCollapsedRef.current && chatPanel.current) {
      chatPanel.current.expand();
      setChatCollapsed(false);
    }
  }, []);

  /** Desde una ficha del chat o desde el resumen del turno: la hoja va hasta el bloque y lo destaca. */
  const reveal = useCallback((target: RevealTarget) => {
    const run = () => {
      if (!revealTarget(target)) toast("Eso ya no está en el recurso.", { id: "crt-reveal" });
    };
    if (!narrowRef.current) return run();
    // En pantalla angosta la hoja se monta al cambiar de panel
    setPane("doc");
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  }, []);

  /**
   * Deshace un turno de la IA. Si es el último paso del historial de esta ventana, es lo mismo que Ctrl+Z.
   * Si no (se recargó la página o hubo ediciones después), el servidor devuelve la versión anterior al turno.
   */
  const undoTurn = useCallback(
    async (messageId: number, force = false) => {
      if (workingRef.current || undoingTurnRef.current) return;
      if (sheetRef.current && !sheetRef.current.settle()) {
        toast.error("Hay un bloque abierto con un dato por corregir. Corrígelo o descarta el cambio antes de deshacer.");
        return;
      }
      const turn = lastTurnRef.current?.messageId === messageId ? lastTurnRef.current : null;
      if (!force && turn?.before && docRef.current === turn.after && peekHistory() === turn.before) {
        const before = turn.before;
        stepHistory("undo");
        toast("Se deshizo lo que hizo la IA.", { id: TURN_TOAST, action: { label: "Rehacer", onClick: () => docRef.current === before && stepHistory("redo") } });
        return;
      }

      undoingTurnRef.current = true;
      setUndoingTurn(true);
      try {
        // Lo de ahora se guarda antes de volver atrás: lo que se deshace siempre queda en «Versiones»
        if (!(await flushAutosave())) {
          explainUnsaved("deshacer lo que hizo la IA");
          return;
        }
        const result = await requestTurnUndo({ role, id: resourceId, messageId, ...(force ? { force } : {}) });
        if (result.status !== "undone") {
          // El recurso cambió después de esa respuesta: deshacerla se lleva también esos cambios, y eso lo decide el docente
          if (result.status === "confirm") setConfirmUndo(messageId);
          else toast("El recurso ya está como antes de esa respuesta.", { id: TURN_TOAST });
          return;
        }
        const current = docRef.current;
        const next = reuseUnchanged(current, result.doc);
        // Lo que se deja atrás queda a un Ctrl+Z de distancia
        recordHistory(current);
        docRef.current = next;
        setDoc(next);
        resetAutosave(next, result.version);
        setLastTurn({ messageId, before: next, after: turn?.after ?? current });
        toast.dismiss(DELETE_TOAST);
        toast.success("El recurso volvió a como estaba antes de esa respuesta.", { id: TURN_TOAST });
        revealChange(locateChange(current, next));
      } catch (error) {
        toast.error(errorMessage(error, "No pudimos deshacer ese cambio."), { id: TURN_TOAST });
      } finally {
        undoingTurnRef.current = false;
        setUndoingTurn(false);
      }
    },
    [explainUnsaved, flushAutosave, peekHistory, recordHistory, requestTurnUndo, resetAutosave, resourceId, role, stepHistory],
  );

  const turnMessage = useMemo(() => lastTurnMessage(messages), [messages]);

  // Las sugerencias las propone la IA al cerrar su última respuesta; si no trajo ninguna, quedan las de siempre
  const suggestions = useMemo(() => {
    if (doc.sections.length === 0) return [];
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message.role === "assistant") return message.suggestions?.length ? message.suggestions : SUGGESTIONS;
    }
    return SUGGESTIONS;
  }, [doc.sections.length, messages]);

  if (detailQuery.isError && !detail) {
    return (
      <div className="crt">
        <div className="crt__content">
          <button type="button" className="crt-btn crt-btn--ghost crt-back" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Mis recursos
          </button>
          <ErrorCard title="No pudimos abrir el recurso" detail={errorMessage(detailQuery.error, "Revisa tu conexión e inténtalo de nuevo.")} onRetry={() => void detailQuery.refetch()} />
        </div>
      </div>
    );
  }

  const blocked = !aiReady
    ? "La IA no está configurada en este servidor. Puedes editar el recurso a mano."
    : remaining !== null && remaining <= 0 && !running
      ? "Alcanzaste el límite de solicitudes a la IA por hoy. Puedes seguir editando a mano."
      : null;
  const saveLabel = working ? "La IA está trabajando" : SAVE_LABELS[saveState];
  const saveTone = working || saveState === "waiting" ? "working" : saveState === "offline" || saveState === "conflict" || saveState === "error" ? "error" : saveState;
  const saveIcon =
    working || saveState === "saving" || saveState === "waiting" ? (
      <Loader2 className="crt-spin" aria-hidden="true" />
    ) : saveState === "offline" ? (
      <CloudOff aria-hidden="true" />
    ) : saveState === "conflict" || saveState === "error" ? (
      <AlertTriangle aria-hidden="true" />
    ) : (
      <Check aria-hidden="true" />
    );

  // El turno está deshecho si la hoja muestra el documento de antes de él, o uno anterior (rehacer traería de vuelta lo que dejó la IA)
  const turnUndone = turnMessage !== null && lastTurn?.messageId === turnMessage.id && (lastTurn.before === doc || isAhead(lastTurn.after));
  const undoable = turnMessage && !working ? { messageId: turnMessage.id, undone: turnUndone, busy: undoingTurn } : null;
  // El próximo «deshacer» de la barra se lleva el turno entero de la IA: se dice en el botón
  const undoIsTurn = history.canUndo && lastTurn !== null && lastTurn.before !== null && doc === lastTurn.after && peekHistory() === lastTurn.before;
  const reviewVisible = loaded && !working && isReviewVisible(review, doc, pendingReview);
  const showJumper = loaded && doc.sections.length > 1;
  const hasTop = showJumper || (reviewVisible && review !== null);

  const chat = (
    <CreatorChat
      messages={messages}
      doc={doc}
      live={working ? (live ?? { phase: "thinking", text: "", activities: [] }) : null}
      blocked={blocked}
      suggestions={suggestions}
      attachments={attachments}
      focusSignal={attachCount}
      onDetach={toggleAttach}
      onReveal={reveal}
      undoable={undoable}
      onUndoTurn={messageId => void undoTurn(messageId)}
      onSend={handleSend}
    />
  );

  const sheet = (
    <div className={hasTop ? "crt-stage has-top" : "crt-stage"}>
      {hasTop && (
        <StageTop>
          {showJumper && <SectionJumper sections={doc.sections} />}
          {reviewVisible && review && (
            <TurnReviewBar
              key={review.messageId}
              summary={describeTurn(review.changes)}
              pending={pendingReview}
              undoing={undoingTurn}
              onReveal={blockId => reveal({ blockIds: [blockId] })}
              onUndo={() => void undoTurn(review.messageId)}
              onSeen={() => setReview(null)}
            />
          )}
        </StageTop>
      )}
      {detail?.status === "error" && detail.errorMessage && !working && (
        <p className="crt-notice crt-notice--error" role="alert">
          {detail.errorMessage}
        </p>
      )}
      {!loaded ? (
        <div className="crt-paper">
          <div className="crt-doc crt-doc--skeleton" aria-hidden="true">
            {[60, 100, 92, 100, 70].map((width, index) => (
              <span key={index} className="crt-skeleton" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      ) : (
        <EditableDocument
          ref={sheetRef}
          doc={doc}
          // Mientras el servidor deshace un turno la hoja espera: lo que se editara en ese instante se perdería
          readOnly={working || undoingTurn}
          applyOp={applyOp}
          schoolName={schoolName}
          logoUrl={logoUrl}
          preview={preview}
          working={working}
          attachedIds={attachedIds}
          onToggleAttach={blocked ? undefined : toggleAttach}
          marks={marks}
          onAcceptMark={blockId => setReview(current => current && acceptMark(current, blockId))}
          panelHost={panelHost}
          panelSheet={narrow}
          onPanelChange={setEditorOpen}
        />
      )}
    </div>
  );

  return (
    <div className="crt crt--workspace">
      <header className="crt-bar">
        {!narrow && (
          <button
            type="button"
            className="crt-btn crt-btn--ghost crt-panel-toggle"
            aria-expanded={!chatCollapsed}
            aria-controls="crt-copilot"
            aria-label={
              chatCollapsed
                ? `Mostrar copiloto${attachments.length > 0 ? ` (${attachments.length} ${attachments.length === 1 ? "bloque señalado" : "bloques señalados"})` : ""}`
                : "Ocultar copiloto"
            }
            title={chatCollapsed ? "Mostrar copiloto" : "Ocultar copiloto: la hoja ocupa todo el ancho"}
            onClick={toggleChatPanel}
          >
            {chatCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            {chatCollapsed && <span aria-hidden="true">Copiloto</span>}
            {chatCollapsed && attachments.length > 0 && (
              <span className="crt-count" aria-hidden="true">
                {attachments.length}
              </span>
            )}
          </button>
        )}
        <button type="button" className="crt-btn crt-btn--ghost" onClick={() => void handleBack()}>
          <ArrowLeft aria-hidden="true" />
          Mis recursos
        </button>
        <span className="crt-bar__title" title={doc.title}>
          {doc.title || "Recurso sin título"}
        </span>
        <span className={`crt-save crt-save--${saveTone}`} role="status">
          {saveIcon}
          {saveLabel}
        </span>
        {saveState === "conflict" && !conflictOpen && (
          <button type="button" className="crt-btn crt-btn--outline crt-btn--sm" onClick={() => setConflictOpen(true)}>
            Resolver
          </button>
        )}
        <div className="crt-bar__actions" role="group" aria-label="Historial de cambios">
          <button type="button" className="crt-btn crt-btn--ghost" disabled={working || undoingTurn || editorOpen || !history.canUndo} aria-label="Deshacer" title={undoIsTurn ? `Deshacer lo que hizo la IA (${UNDO_HINT})` : `Deshacer (${UNDO_HINT})`} onClick={undo}>
            <Undo2 aria-hidden="true" />
          </button>
          <button type="button" className="crt-btn crt-btn--ghost" disabled={working || undoingTurn || editorOpen || !history.canRedo} aria-label="Rehacer" title={`Rehacer (${REDO_HINT})`} onClick={redo}>
            <Redo2 aria-hidden="true" />
          </button>
        </div>
        <div className="crt-bar__actions">
          {/* Con el panel de edición abierto en pantalla angosta, primero se aplica o se cancela */}
          {narrow && !editorOpen && (
            <button type="button" className="crt-btn crt-btn--outline" aria-pressed={pane === "chat"} onClick={() => setPane(current => (current === "chat" ? "doc" : "chat"))}>
              {pane === "chat" ? <FileText aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {pane === "chat" ? "Ver recurso" : "Copiloto"}
              {pane !== "chat" && attachments.length > 0 && (
                <span className="crt-count" aria-label={`${attachments.length} ${attachments.length === 1 ? "bloque señalado" : "bloques señalados"}`}>
                  {attachments.length}
                </span>
              )}
            </button>
          )}
          {shell && (
            <button
              type="button"
              className="crt-btn crt-btn--ghost"
              aria-pressed={focusMode}
              aria-label={focusMode ? "Salir del modo enfoque" : "Modo enfoque"}
              title={focusMode ? "Salir del modo enfoque" : "Modo enfoque: el recurso ocupa toda la pantalla"}
              onClick={toggleFocus}
            >
              {focusMode ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </button>
          )}
          <DropdownMenu open={versionsOpen} onOpenChange={setVersionsOpen}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="crt-btn crt-btn--outline" disabled={working}>
                <History aria-hidden="true" />
                Versiones
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Restaurar una versión anterior</DropdownMenuLabel>
              {versionsQuery.isLoading && <DropdownMenuItem disabled>Cargando…</DropdownMenuItem>}
              {versionsQuery.data?.length === 0 && <DropdownMenuItem disabled>Aún no hay versiones guardadas.</DropdownMenuItem>}
              {versionsQuery.data?.map((version, index) => (
                <DropdownMenuItem key={version.id} disabled={index === 0} onSelect={() => void handleRestore(version.id)}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{version.label || "Versión guardada"}</span>
                    <span className="text-xs opacity-70">
                      {formatWhen(version.createdAt)}
                      {index === 0 ? " · actual" : ""}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className="crt-btn crt-btn--outline" disabled={duplicateMutation.isPending || working} onClick={() => void handleDuplicate()}>
            <Copy aria-hidden="true" />
            Duplicar
          </button>
          <button type="button" className="crt-btn crt-btn--ghost crt-btn--danger" disabled={working} aria-label="Eliminar recurso" title="Eliminar" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" />
          </button>
          <button type="button" className="crt-btn crt-btn--primary" disabled={doc.sections.length === 0} onClick={() => setPrinting(true)}>
            <Printer aria-hidden="true" />
            Imprimir o PDF
          </button>
        </div>
      </header>

      <div className="crt-work">
        {narrow ? (
          pane === "chat" ? (
            chat
          ) : (
            sheet
          )
        ) : (
          <ResizablePanelGroup direction="horizontal" autoSaveId="educore-creator-split">
            {/* Plegado, el panel sigue montado (conserva lo escrito) pero queda fuera del recorrido con Tab.
                Los ids fijos hacen que el ancho de antes de plegar se recuerde también al volver a abrir el editor. */}
            <ResizablePanel
              ref={chatPanel}
              id="crt-copilot-panel"
              order={1}
              defaultSize={30}
              minSize={22}
              maxSize={46}
              collapsible
              collapsedSize={0}
              // Con el panel de edición encima, la conversación sigue montada (conserva lo escrito) pero fuera del recorrido con Tab
              inert={chatCollapsed || editorOpen}
              onCollapse={() => setChatCollapsed(true)}
              onExpand={() => setChatCollapsed(false)}
            >
              <div ref={copilotSlot} className="crt-copilot-slot">
                {chat}
              </div>
            </ResizablePanel>
            {/* Divisor propio del editor (el de @/components/ui lo usan otros módulos): se marca al acercar el
                puntero; las flechas cambian el ancho y Enter pliega o despliega el copiloto */}
            <PanelResizeHandle
              className={chatCollapsed ? "crt-split is-collapsed" : "crt-split"}
              aria-label="Ancho del copiloto"
              title="Arrastra para cambiar el ancho del copiloto. Con el teclado: flechas, y Enter para plegarlo o desplegarlo."
              // Enter lo resuelve el editor: el de la librería pliega sin avisar a onCollapse/onExpand y el botón de la barra quedaría al revés
              onKeyDownCapture={event => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                toggleChatPanel();
              }}
            >
              <span className="crt-split__grip" aria-hidden="true" />
            </PanelResizeHandle>
            <ResizablePanel id="crt-sheet-panel" order={2} defaultSize={70} minSize={40}>
              {sheet}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
        {/* El panel de edición de figuras y tablas: en el sitio del copiloto, flotando si está plegado, o como lámina
            en pantalla angosta. Va encima, fuera de la hoja: abrirlo no la mueve */}
        <div
          ref={setPanelHost}
          className="crt-side-host"
          data-mode={narrow ? "sheet" : chatCollapsed ? "float" : "dock"}
          style={{ "--crt-side-w": `${copilotWidth}px` } as CSSProperties}
        />
      </div>

      <AlertDialog open={conflictOpen && saveState === "conflict"} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este recurso cambió en otra ventana</AlertDialogTitle>
            <AlertDialogDescription>
              Mientras editabas aquí se guardó otra versión, desde otra pestaña o equipo. Tus últimos cambios en esta ventana aún no se guardan. Elige con cuál seguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <strong>Cargar la más reciente:</strong> descarta los cambios de esta ventana que no se han guardado.
            </li>
            <li>
              <strong>Conservar la mía:</strong> guarda esta ventana encima. La otra versión queda en «Versiones».
            </li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resolving}
              onClick={event => {
                event.preventDefault();
                void loadLatest();
              }}
            >
              Cargar la más reciente
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resolving}
              onClick={event => {
                event.preventDefault();
                void keepLocal();
              }}
            >
              Conservar la mía
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUndo !== null} onOpenChange={open => !open && setConfirmUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>El recurso cambió después de esa respuesta</AlertDialogTitle>
            <AlertDialogDescription>
              Si la deshaces, el recurso vuelve a como estaba justo antes de ella y los cambios posteriores también se van. Lo que tienes ahora queda guardado en «Versiones».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dejarlo como está</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const messageId = confirmUndo;
                setConfirmUndo(null);
                if (messageId !== null) void undoTurn(messageId, true);
              }}
            >
              Deshacer de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este recurso?</AlertDialogTitle>
            <AlertDialogDescription>Se borrarán «{doc.title || "Recurso sin título"}», su conversación y sus versiones. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printing &&
        createPortal(
          <div className="crt-print">
            <ResourceSheet doc={doc} schoolName={schoolName} logoUrl={logoUrl} />
          </div>,
          document.body,
        )}
    </div>
  );
}

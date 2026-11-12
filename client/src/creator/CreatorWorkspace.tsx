import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Check, CloudOff, Copy, History, Loader2, Maximize2, MessageSquare, Minimize2, Printer, Redo2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { emptyDoc, type CreatorChatMessage, type CreatorEvent, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { trpc } from "@/lib/trpc";
import { CreatorChat, type LiveTurn } from "./CreatorChat";
import { historyKey, historyShortcut, locateChange, useDocHistory, type ChangeLocation } from "./docHistory";
import { EditableDocument, type EditableDocumentHandle } from "./EditableDocument";
import { ErrorCard, formatWhen } from "./parts";
import { ResourceSheet } from "./ResourceSheet";
import { useCreatorAutosave, type SaveState } from "./useCreatorAutosave";
import "./creator.css";

type Preview = Extract<CreatorEvent, { type: "preview" }>;

/** Un solo aviso de guardado a la vez: el siguiente reemplaza al anterior en vez de apilarse. */
const SAVE_TOAST = "crt-save";
const DELETE_TOAST = "crt-deleted";

const SAVE_LABELS: Record<SaveState, string> = {
  saved: "Guardado",
  pending: "Sin guardar",
  saving: "Guardando…",
  offline: "Sin conexión",
  waiting: "Esperando a la IA",
  conflict: "Cambió en otra ventana",
  error: "No se pudo guardar",
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const UNDO_HINT = IS_MAC ? "⌘Z" : "Ctrl+Z";
const REDO_HINT = IS_MAC ? "⌘⇧Z" : "Ctrl+Y";

/** Dentro de un campo, del bloque que se edita en su sitio o de un diálogo, Ctrl+Z es suyo: el historial del documento no se toca. */
function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .crt-inplace, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null;
}

/** Tras deshacer o rehacer, lo que cambió se trae a la vista si quedó fuera de pantalla. */
function revealChange(location: ChangeLocation | null) {
  if (!location) return;
  window.requestAnimationFrame(() => {
    const block = location.blockId ? document.querySelector<HTMLElement>(`.crt-stage [data-block-id="${CSS.escape(location.blockId)}"]`) : null;
    const target = block ?? (location.sectionId ? document.getElementById(`crt-${location.sectionId}`) : document.querySelector<HTMLElement>(".crt-stage .crt-paper"));
    if (!target) return;
    const box = (target.closest(".crt-stage") ?? document.documentElement).getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (rect.bottom < box.top + 24 || rect.top > box.bottom - 24) target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

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

/** Editor de un recurso: el asistente a un lado y la hoja al otro. */
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
  const [streamFailed, setStreamFailed] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pane, setPane] = useState<"doc" | "chat">("doc");
  const narrow = useNarrow();
  const sheetRef = useRef<EditableDocumentHandle>(null);

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
  const { record: recordHistory, undo: popUndo, redo: popRedo, clear: clearHistory } = history;
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
    if (isDirty()) return;
    // Durante un turno, el documento lo llevan los eventos en vivo: lo guardado aún es la versión anterior
    if (working && loadedRef.current) return;
    setDoc(detail.doc);
    resetAutosave(detail.doc, detail.version);
    // Un documento que llega de fuera no se deshace paso a paso: para eso están las versiones
    clearHistory();
    loadedRef.current = true;
    setLoaded(true);
  }, [clearHistory, detail, isDirty, resetAutosave]);

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
          setDoc(event.doc);
          clearHistory();
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
      if (workingRef.current) return;
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
    (op: DocOp): OpResult => {
      const before = docRef.current;
      const result = applyDocOp(before, op);
      if (!result.ok) {
        toast.error(result.error);
        return result;
      }
      if (result.changed) {
        recordHistory(before, historyKey(op));
        showLocal(result.doc);
        if (op.op === "delete_blocks" || op.op === "delete_section") {
          const deleted = result.doc;
          toast(op.op === "delete_section" ? "Sección eliminada." : op.blockIds.length > 1 ? "Bloques eliminados." : "Bloque eliminado.", {
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
        toast.error("Hay un bloque abierto con un dato por corregir. Corrígelo o descarta el cambio antes de escribirle al asistente.");
        throw new Error("editing");
      }
      // La IA debe partir de lo último que escribió el docente
      if (!(await flushAutosave())) {
        explainUnsaved("escribirle al asistente");
        throw new Error("unsaved");
      }
      setPendingMessage(message);
      try {
        await sendMessage({ role, id: resourceId, message });
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
    return [...saved, { id: -1, role: "user", content: pendingMessage, activity: [], createdAt: new Date() }];
  }, [detail?.messages, pendingMessage]);

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

  const chat = <CreatorChat messages={messages} live={working ? (live ?? { phase: "thinking", text: "", activities: [] }) : null} blocked={blocked} suggestions={doc.sections.length > 0 ? SUGGESTIONS : []} onSend={handleSend} />;

  const sheet = (
    <div className="crt-stage">
      {doc.sections.length > 1 && (
        <nav className="crt-outline" aria-label="Secciones del recurso">
          {doc.sections.map(section => (
            <button key={section.id} type="button" onClick={() => document.getElementById(`crt-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {section.title}
            </button>
          ))}
        </nav>
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
        <EditableDocument ref={sheetRef} doc={doc} readOnly={working} applyOp={applyOp} schoolName={schoolName} logoUrl={logoUrl} preview={preview} working={working} />
      )}
    </div>
  );

  return (
    <div className="crt crt--workspace">
      <header className="crt-bar">
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
          <button type="button" className="crt-btn crt-btn--ghost" disabled={working || !history.canUndo} aria-label="Deshacer" title={`Deshacer (${UNDO_HINT})`} onClick={undo}>
            <Undo2 aria-hidden="true" />
          </button>
          <button type="button" className="crt-btn crt-btn--ghost" disabled={working || !history.canRedo} aria-label="Rehacer" title={`Rehacer (${REDO_HINT})`} onClick={redo}>
            <Redo2 aria-hidden="true" />
          </button>
        </div>
        <div className="crt-bar__actions">
          {narrow && (
            <button type="button" className="crt-btn crt-btn--outline" aria-pressed={pane === "chat"} onClick={() => setPane(current => (current === "chat" ? "doc" : "chat"))}>
              <MessageSquare aria-hidden="true" />
              {pane === "chat" ? "Ver recurso" : "Asistente"}
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
            <ResizablePanel defaultSize={30} minSize={22} maxSize={46}>
              {chat}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70} minSize={40}>
              {sheet}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
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

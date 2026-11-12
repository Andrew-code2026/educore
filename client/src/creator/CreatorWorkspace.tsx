import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, CloudOff, Copy, History, Loader2, MessageSquare, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { emptyDoc, type CreatorChatMessage, type CreatorEvent, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
import type { EduRole } from "@/components/shell";
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
import { EditableDocument } from "./EditableDocument";
import { ErrorCard, formatWhen } from "./parts";
import { ResourceSheet } from "./ResourceSheet";
import { useCreatorAutosave } from "./useCreatorAutosave";
import "./creator.css";

type Preview = Extract<CreatorEvent, { type: "preview" }>;

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

  const detailQuery = trpc.creator.get.useQuery(input, {
    retry: 1,
    refetchOnWindowFocus: false,
    // Sin canal en vivo, el avance de la IA se consulta cada pocos segundos
    refetchInterval: running && streamFailed ? 3000 : false,
  });
  const versionsQuery = trpc.creator.versions.useQuery(input, { enabled: versionsOpen, staleTime: 0 });
  const { mutateAsync: saveDoc } = trpc.creator.saveDoc.useMutation();
  const { mutateAsync: sendMessage } = trpc.creator.sendMessage.useMutation();
  const restoreMutation = trpc.creator.restoreVersion.useMutation();
  const duplicateMutation = trpc.creator.duplicate.useMutation();
  const removeMutation = trpc.creator.remove.useMutation();

  const autosave = useCreatorAutosave(
    useCallback((next: ResourceDoc, baseVersion: number) => saveDoc({ role, id: resourceId, doc: next, baseVersion }), [resourceId, role, saveDoc]),
  );
  const { reset: resetAutosave, isDirty } = autosave;

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
    loadedRef.current = true;
    setLoaded(true);
  }, [detail, isDirty, resetAutosave]);

  useEffect(() => {
    if (autosave.saveState === "error") toast.error("No pudimos guardar tus cambios. Revisa la conexión; se reintentará al seguir editando.");
  }, [autosave.saveState]);

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
          break;
        case "done":
          finishTurn(event);
          break;
      }
    },
    onError: () => setStreamFailed(true),
  });

  const applyOp = useCallback(
    (op: DocOp): OpResult => {
      const result = applyDocOp(docRef.current, op);
      if (!result.ok) {
        toast.error(result.error);
        return result;
      }
      if (result.changed) {
        docRef.current = result.doc;
        setDoc(result.doc);
        autosave.update(result.doc);
      }
      return result;
    },
    [autosave],
  );

  const handleSend = useCallback(
    async (message: string) => {
      // La IA debe partir de lo último que escribió el docente
      if (!(await autosave.flush())) {
        toast.error("Guarda tus cambios antes de escribirle al asistente. Revisa la conexión.");
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
    [autosave, resourceId, role, sendMessage],
  );

  const handleRestore = async (versionId: number) => {
    if (!(await autosave.flush())) return;
    try {
      const restored = await restoreMutation.mutateAsync({ role, id: resourceId, versionId });
      setDoc(restored.doc);
      resetAutosave(restored.doc, restored.version);
      toast.success("Versión restaurada.");
      void detailQuery.refetch();
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos restaurar esa versión."));
    }
  };

  const handleDuplicate = async () => {
    if (!(await autosave.flush())) return;
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

  const handleBack = async () => {
    await autosave.flush();
    void utils.creator.list.invalidate();
    onBack();
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
  const working = running || live !== null;
  const saveLabel = working ? "La IA está trabajando" : { saved: "Guardado", pending: "Sin guardar", saving: "Guardando…", error: "Sin conexión" }[autosave.saveState];

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
        <EditableDocument doc={doc} readOnly={working} applyOp={applyOp} schoolName={schoolName} logoUrl={logoUrl} preview={preview} working={working} />
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
        <span className={`crt-save crt-save--${working ? "working" : autosave.saveState}`} role="status">
          {working || autosave.saveState === "saving" ? <Loader2 className="crt-spin" aria-hidden="true" /> : autosave.saveState === "error" ? <CloudOff aria-hidden="true" /> : <Check aria-hidden="true" />}
          {saveLabel}
        </span>
        <div className="crt-bar__actions">
          {narrow && (
            <button type="button" className="crt-btn crt-btn--outline" aria-pressed={pane === "chat"} onClick={() => setPane(current => (current === "chat" ? "doc" : "chat"))}>
              <MessageSquare aria-hidden="true" />
              {pane === "chat" ? "Ver recurso" : "Asistente"}
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

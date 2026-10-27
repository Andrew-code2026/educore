import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  type AnnouncementAudience,
} from "@shared/communications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ComposeInput {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  publish: boolean;
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSend: boolean;
  saving: boolean;
  aiPending: boolean;
  /** Rechaza si el servidor no guardó; el diálogo sigue abierto con el texto intacto. */
  onSubmit: (input: ComposeInput) => Promise<void>;
  onDraftWithAi: (draft: { title: string; message: string }) => Promise<{ title: string | null; message: string }>;
}

const TITLE_MIN = 3;
const MESSAGE_MIN = 5;

/**
 * Redactor de comunicados. El borrador vive en este componente, así que cerrar el
 * diálogo sin guardar no pierde lo escrito; se limpia solo tras guardar con éxito,
 * una vez terminada la animación de cierre para no mostrar el formulario vacío.
 */
export function ComposeDialog({ open, onOpenChange, canSend, saving, aiPending, onSubmit, onDraftWithAi }: ComposeDialogProps) {
  const ids = useId();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>(ANNOUNCEMENT_AUDIENCES[0]);
  const [showErrors, setShowErrors] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);

  const titleError = title.trim().length < TITLE_MIN ? `Escribe al menos ${TITLE_MIN} caracteres.` : null;
  const messageError = message.trim().length < MESSAGE_MIN ? `Escribe al menos ${MESSAGE_MIN} caracteres.` : null;
  const busy = saving || aiPending;

  const submit = async (publish: boolean) => {
    if (titleError || messageError) {
      setShowErrors(true);
      (titleError ? titleRef : messageRef).current?.focus();
      return;
    }
    try {
      await onSubmit({ title: title.trim(), message: message.trim(), audience, publish });
      savedRef.current = true;
    } catch {
      // El diálogo sigue abierto con el texto intacto para reintentar
    }
  };

  const resetIfSaved = () => {
    if (!savedRef.current) return;
    savedRef.current = false;
    setTitle("");
    setMessage("");
    setAudience(ANNOUNCEMENT_AUDIENCES[0]);
    setShowErrors(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(canSend);
  };

  const draftWithAi = async () => {
    try {
      const draft = await onDraftWithAi({ title, message });
      if (draft.title && !title.trim()) setTitle(draft.title.slice(0, ANNOUNCEMENT_TITLE_MAX));
      setMessage(draft.message.slice(0, ANNOUNCEMENT_MESSAGE_MAX));
    } catch {
      // El aviso de error lo muestra quien hace la petición
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-2xl sm:max-w-xl"
        onCloseAutoFocus={resetIfSaved}
      >
        <DialogHeader>
          <DialogTitle>Nuevo comunicado</DialogTitle>
          <DialogDescription>
            {canSend
              ? "Escribe, revisa y publica cuando estés listo. También puedes guardarlo como borrador."
              : "Se guardará como borrador; un administrador lo revisará y lo publicará."}
          </DialogDescription>
        </DialogHeader>

        <form id={`${ids}-form`} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Field
            id={`${ids}-title`}
            label="Título"
            counter={`${title.length}/${ANNOUNCEMENT_TITLE_MAX}`}
            error={showErrors ? titleError : null}
          >
            <Input
              ref={titleRef}
              id={`${ids}-title`}
              value={title}
              maxLength={ANNOUNCEMENT_TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Reunión de padres de 11°"
              aria-invalid={showErrors && Boolean(titleError)}
              aria-describedby={showErrors && titleError ? `${ids}-title-error` : undefined}
              autoComplete="off"
            />
          </Field>

          <Field
            id={`${ids}-message`}
            label="Mensaje"
            counter={`${message.length}/${ANNOUNCEMENT_MESSAGE_MAX}`}
            error={showErrors ? messageError : null}
          >
            <Textarea
              ref={messageRef}
              id={`${ids}-message`}
              value={message}
              maxLength={ANNOUNCEMENT_MESSAGE_MAX}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe el mensaje para la comunidad…"
              className="min-h-36 resize-y"
              aria-invalid={showErrors && Boolean(messageError)}
              aria-describedby={showErrors && messageError ? `${ids}-message-error` : undefined}
            />
          </Field>

          <div>
            <Button type="button" variant="ghost" size="sm" className="-ml-2 text-primary" disabled={busy} onClick={draftWithAi}>
              {aiPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {aiPending ? "Redactando…" : "Redactar con EduCore AI"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Usa el título y lo que hayas escrito como guía. Revisa el texto antes de enviarlo.
            </p>
          </div>

          <Field id={`${ids}-audience`} label="Destinatarios">
            <select
              id={`${ids}-audience`}
              value={audience}
              onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {ANNOUNCEMENT_AUDIENCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </form>

        <DialogFooter className="gap-2">
          {canSend && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(false)}>
              Guardar borrador
            </Button>
          )}
          <Button type="submit" form={`${ids}-form`} disabled={busy}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {canSend ? "Publicar" : "Guardar borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  id: string;
  label: string;
  counter?: string;
  error?: string | null;
  children: ReactNode;
}

function Field({ id, label, counter, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {counter && <span className="text-xs tabular-nums text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

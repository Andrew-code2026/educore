import { useId, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emptyDraft, EVENT_TYPES, validateDraft, type DraftErrors, type EventDraft } from "./calendar";

interface NewEventDialogProps {
  /** Día con el que abre el formulario; `null` mantiene el diálogo cerrado. */
  initialDay: string | null;
  /** Nodo dentro de `.edc-shell` para heredar los tokens de tema. */
  container: HTMLElement | null;
  onClose: () => void;
  /** Rechaza con un mensaje legible si el servidor no guarda el evento. */
  onSubmit: (draft: EventDraft) => Promise<void>;
}

export function NewEventDialog({ initialDay, container, onClose, onSubmit }: NewEventDialogProps) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog.Root open={initialDay !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="cal-dialog-overlay" />
        <Dialog.Content className="cal-dialog" aria-describedby="cal-dialog-desc">
          <div className="cal-dialog__head">
            <div>
              <Dialog.Title className="cal-dialog__title">Nuevo evento</Dialog.Title>
              <Dialog.Description id="cal-dialog-desc" className="cal-dialog__desc">
                Se mostrará en el calendario de toda la comunidad educativa.
              </Dialog.Description>
            </div>
            <Dialog.Close className="cal-icon-btn" aria-label="Cerrar" disabled={saving}>
              <X aria-hidden="true" strokeWidth={2} />
            </Dialog.Close>
          </div>
          {/* El contenido se desmonta al cerrar: cada apertura empieza con un formulario limpio */}
          {initialDay !== null && (
            <EventForm initialDay={initialDay} saving={saving} onSavingChange={setSaving} onSubmit={onSubmit} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface EventFormProps {
  initialDay: string;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onSubmit: (draft: EventDraft) => Promise<void>;
}

function EventForm({ initialDay, saving, onSavingChange, onSubmit }: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(initialDay));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = <K extends keyof EventDraft>(field: K, value: EventDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    onSavingChange(true);
    setSubmitError(null);
    try {
      await onSubmit(draft);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos guardar el evento. Inténtalo de nuevo.");
    } finally {
      onSavingChange(false);
    }
  };

  return (
    <form noValidate className="cal-form" onSubmit={handleSubmit}>
      <Field label="Título" error={errors.title}>
        {(props) => (
          <input
            {...props}
            name="title"
            type="text"
            autoComplete="off"
            maxLength={180}
            placeholder="Ej. Evaluación de Matemáticas"
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
          />
        )}
      </Field>

      <fieldset className="cal-form__fieldset">
        <legend className="cal-form__label">Tipo</legend>
        <div className="cal-type-picker">
          {EVENT_TYPES.map(({ value, kind, label }) => (
            <label key={value} className={cn("cal-type", draft.type === value && "is-active")}>
              <input
                type="radio"
                name="type"
                value={value}
                checked={draft.type === value}
                onChange={() => update("type", value)}
              />
              <span aria-hidden="true" className={`cal-dot cal-dot--${kind}`} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="cal-form__row">
        <Field label="Fecha" error={errors.day}>
          {(props) => (
            <input
              {...props}
              name="day"
              type="date"
              value={draft.day}
              onChange={(e) => update("day", e.target.value)}
            />
          )}
        </Field>
        <Field label="Hora" error={errors.time}>
          {(props) => (
            <input
              {...props}
              name="time"
              type="time"
              value={draft.time}
              onChange={(e) => update("time", e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="cal-form__row">
        <Field label="Lugar" hint="Opcional">
          {(props) => (
            <input
              {...props}
              name="location"
              type="text"
              maxLength={180}
              placeholder="Ej. Auditorio principal"
              value={draft.location}
              onChange={(e) => update("location", e.target.value)}
            />
          )}
        </Field>
        <Field label="Dirigido a" error={errors.audience}>
          {(props) => (
            <input
              {...props}
              name="audience"
              type="text"
              maxLength={120}
              value={draft.audience}
              onChange={(e) => update("audience", e.target.value)}
            />
          )}
        </Field>
      </div>

      {submitError && (
        <p role="alert" className="cal-form__alert">
          {submitError}
        </p>
      )}

      <div className="cal-dialog__actions">
        <Dialog.Close className="cal-btn cal-btn--outline" disabled={saving}>
          Cancelar
        </Dialog.Close>
        <button type="submit" className="cal-btn cal-btn--primary" disabled={saving}>
          {saving && <Loader2 aria-hidden="true" className="cal-spin" strokeWidth={2} />}
          {saving ? "Guardando…" : "Crear evento"}
        </button>
      </div>
    </form>
  );
}

interface FieldControlProps {
  id: string;
  className: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: FieldControlProps) => ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className="cal-form__field">
      <label htmlFor={id} className="cal-form__label">
        {label}
        {hint && <span className="cal-form__hint">{hint}</span>}
      </label>
      {children({
        id,
        className: cn("cal-input", error && "is-invalid"),
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? messageId : undefined,
      })}
      {error && (
        <span id={messageId} className="cal-form__error">
          {error}
        </span>
      )}
    </div>
  );
}

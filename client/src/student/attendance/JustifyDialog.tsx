import { useEffect, useId, useState, type FormEvent } from "react";
import { Paperclip, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { capitalize, formatBytes, formatLongDate } from "../format";
import { Sheet } from "../ui";
import type { DayModel } from "./attendance";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;

/** Motivos que acepta el servidor, con etiquetas para el estudiante. */
const REASONS = [
  { value: "medical", label: "Salud" },
  { value: "family_emergency", label: "Calamidad familiar" },
  { value: "external_appointment", label: "Cita o trámite" },
  { value: "force_majeure", label: "Fuerza mayor" },
  { value: "other", label: "Otro motivo" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

/** Los mismos formatos que valida el servidor para soportes de excusa. */
const EVIDENCE_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

interface JustifyDialogProps {
  day: DayModel | null;
  studentName: string;
  onClose: () => void;
  onSent: () => void;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });

export function JustifyDialog({ day, studentName, onClose, onSent }: JustifyDialogProps) {
  const formId = useId();
  const [reason, setReason] = useState<Reason>("medical");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = trpc.justification.uploadDocument.useMutation();
  const submit = trpc.justification.submit.useMutation();
  const busy = upload.isPending || submit.isPending;

  // Formulario limpio cada vez que se abre para otro día
  useEffect(() => {
    setReason("medical");
    setDescription("");
    setFile(null);
    setError(null);
  }, [day?.id]);

  const pick = (candidate: File | null | undefined) => {
    if (!candidate) return;
    const name = candidate.name.toLowerCase();
    if (!EVIDENCE_EXTENSIONS.some(extension => name.endsWith(extension))) {
      setError("El soporte debe ser PDF o una imagen JPG, PNG o WEBP.");
      return;
    }
    if (candidate.size > MAX_EVIDENCE_BYTES) {
      setError("El soporte no puede superar 5 MB.");
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!day || busy) return;
    if (description.trim().length < 10) {
      setError("Cuéntanos el motivo en al menos 10 caracteres.");
      return;
    }
    try {
      const evidence = file ? await upload.mutateAsync({ fileName: file.name, fileBase64: await readAsDataUrl(file), fileType: file.type }) : null;
      await submit.mutateAsync({
        courseId: day.courseId,
        studentId: day.studentId,
        attendanceDate: new Date(Date.UTC(day.date.getFullYear(), day.date.getMonth(), day.date.getDate())),
        reasonCategory: reason,
        description: description.trim(),
        submittedByRole: "student",
        submittedByName: studentName,
        digitalEvidenceUrl: evidence?.url ?? null,
        digitalEvidenceName: evidence?.fileName ?? null,
      });
      toast.success("Enviaste la excusa. Coordinación la revisará.");
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar la excusa. Inténtalo de nuevo.");
    }
  };

  return (
    <Sheet
      variant="dialog"
      open={day !== null}
      onOpenChange={open => !open && !busy && onClose()}
      title="Enviar excusa"
      subtitle={day ? `Ausencia del ${capitalize(formatLongDate(day.date))}` : null}
      footer={
        <>
          <button type="button" className="stp-btn stp-btn--outline" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="stp-btn stp-btn--primary" disabled={busy}>
            <Send {...ICON} />
            {busy ? "Enviando…" : "Enviar excusa"}
          </button>
        </>
      }
    >
      <form id={formId} className="stp-block" onSubmit={onSubmit} noValidate>
        <fieldset className="stp-field stp-fieldset">
          <legend className="stp-label">Motivo</legend>
          <div className="stp-choices" role="radiogroup" aria-label="Motivo de la ausencia">
            {REASONS.map(option => (
              <button key={option.value} type="button" role="radio" aria-checked={reason === option.value} className="stp-choice" onClick={() => setReason(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="stp-field">
          <label className="stp-label" htmlFor={`${formId}-description`}>
            Cuéntanos qué pasó
          </label>
          <textarea
            id={`${formId}-description`}
            className="stp-textarea"
            maxLength={2000}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Por ejemplo: tuve cita médica en la mañana; adjunto la constancia."
          />
        </div>

        <div className="stp-field">
          <span className="stp-label">
            Soporte <span className="stp-help">(opcional)</span>
          </span>
          {file ? (
            <div className="stp-file">
              <span className="stp-bubble">
                <Paperclip {...ICON} />
              </span>
              <span className="stp-file__body">
                <span className="stp-file__name">{file.name}</span>
                <span className="stp-file__meta">{formatBytes(file.size)}</span>
              </span>
              <button type="button" className="stp-icon-btn" aria-label="Quitar soporte" onClick={() => setFile(null)}>
                <X {...ICON} />
              </button>
            </div>
          ) : (
            <label className="stp-dropzone">
              <span className="stp-empty__icon">
                <Upload {...ICON} />
              </span>
              <span className="stp-dropzone__title">Adjunta la constancia</span>
              <span className="stp-help">PDF o imagen JPG, PNG o WEBP · máximo 5 MB</span>
              <input type="file" accept={EVIDENCE_EXTENSIONS.join(",")} className="stp-sr-only" onChange={event => pick(event.target.files?.[0])} />
            </label>
          )}
        </div>

        {error && (
          <p className="stp-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}

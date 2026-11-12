import { useId, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { AlertTriangle, Download, FileText, Paperclip, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ALLOWED_RESOURCE_EXTENSIONS, MAX_RESOURCE_BYTES, checkResourceFile } from "@shared/courseResources";
import { trpc } from "@/lib/trpc";
import { formatAgo, formatBytes, formatGrade, formatLongDate, formatTime, subjectInitials } from "../format";
import { Pill, Sheet } from "../ui";
import { taskStatus, type TaskModel } from "./tasks";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;
const ACCEPT = ALLOWED_RESOURCE_EXTENSIONS.map(extension => `.${extension}`).join(",");
const FORMATS = "PDF, Word, PowerPoint, Excel, imágenes JPG o PNG y ZIP";

interface TaskDetailProps {
  task: TaskModel | null;
  course: string | null;
  now: Date;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

/** Detalle de una actividad: instrucciones, materiales, tu entrega y la retroalimentación. */
export function TaskDetail({ task, course, now, open, onClose, onSubmitted }: TaskDetailProps) {
  const formId = useId();
  const resources = trpc.educore.courseResources.useQuery({ role: "student", course: course ?? "" }, { enabled: open && Boolean(course), staleTime: 60_000 });
  const taskResources = (resources.data ?? []).filter(resource => resource.assignmentId === task?.id);
  const status = task ? taskStatus(task, now) : null;
  const submission = task?.submission ?? null;

  return (
    <Sheet
      open={open}
      onOpenChange={next => !next && onClose()}
      leading={
        task && (
          <span className="stp-bubble" aria-hidden="true">
            {subjectInitials(task.subject)}
          </span>
        )
      }
      title={task?.title ?? "Actividad"}
      subtitle={task ? [task.subject, task.teacherName].filter(Boolean).join(" · ") : null}
      footer={
        task?.canSubmit ? (
          <button type="submit" form={formId} className="stp-btn stp-btn--primary stp-btn--lg">
            <Send {...ICON} />
            {submission ? "Reemplazar entrega" : "Enviar entrega"}
          </button>
        ) : null
      }
    >
      {task && status && (
        <>
          <div className="stp-facts">
            <div className="stp-stat">
              <span className="stp-stat__label">Fecha de entrega</span>
              <span className="stp-stat__value stp-stat__value--text">{formatLongDate(task.dueAt)}</span>
              <span className="stp-stat__label">{formatTime(task.dueAt)}</span>
            </div>
            <div className="stp-stat">
              <span className="stp-stat__label">{task.state === "graded" ? "Tu nota" : "Estado"}</span>
              {task.state === "graded" ? (
                <span className="stp-stat__value">{formatGrade(submission!.grade!)}</span>
              ) : (
                <span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </span>
              )}
            </div>
          </div>

          {task.state === "missed" && (
            <div className="stp-callout stp-callout--alert">
              <span className="stp-callout__icon">
                <AlertTriangle {...ICON} />
              </span>
              <span className="stp-callout__body">
                <span className="stp-callout__title">La actividad cerró sin tu entrega</span>
                <span className="stp-callout__text">Si tuviste un motivo, habla con tu docente sobre una nueva oportunidad.</span>
              </span>
            </div>
          )}

          {task.state === "graded" && submission?.comment && (
            <div className="stp-block">
              <h3 className="stp-block__title">Retroalimentación</h3>
              <p className="stp-quote">
                {submission.comment}
                <span className="stp-quote__by">{task.teacherName}</span>
              </p>
            </div>
          )}

          <div className="stp-block">
            <h3 className="stp-block__title">Instrucciones</h3>
            <p className={task.description ? "stp-prose" : "stp-note"}>{task.description || "Tu docente no agregó instrucciones escritas para esta actividad."}</p>
          </div>

          {taskResources.length > 0 && (
            <div className="stp-block">
              <h3 className="stp-block__title">Materiales</h3>
              {taskResources.map(resource => (
                <a key={resource.id} className="stp-file" href={resource.fileUrl} target="_blank" rel="noreferrer">
                  <span className="stp-bubble">
                    <FileText {...ICON} />
                  </span>
                  <span className="stp-file__body">
                    <span className="stp-file__name">{resource.title}</span>
                    <span className="stp-file__meta">
                      {resource.fileName} · {formatBytes(resource.sizeBytes)}
                    </span>
                  </span>
                  <Download className="stp-row__chevron" {...ICON} />
                </a>
              ))}
            </div>
          )}

          {submission && (
            <div className="stp-block">
              <h3 className="stp-block__title">Tu entrega</h3>
              <SubmittedFile name={submission.fileName} url={submission.fileUrl} meta={`${formatAgo(submission.submittedAt, now)} · ${formatTime(submission.submittedAt)}${submission.late ? " · después de la fecha" : ""}`} />
              {task.state === "submitted" && submission.comment && <p className="stp-quote">{submission.comment}</p>}
            </div>
          )}

          {task.canSubmit && <SubmitForm key={task.id} formId={formId} task={task} replacing={Boolean(submission)} onSubmitted={onSubmitted} />}
        </>
      )}
    </Sheet>
  );
}

function SubmittedFile({ name, url, meta }: { name: string | null; url: string | null; meta: string }) {
  const body = (
    <>
      <span className="stp-bubble">
        <Paperclip {...ICON} />
      </span>
      <span className="stp-file__body">
        <span className="stp-file__name">{name ?? "Entrega sin archivo"}</span>
        <span className="stp-file__meta">{url ? meta : `${meta} · registrada sin archivo adjunto`}</span>
      </span>
    </>
  );
  return url ? (
    <a className="stp-file" href={url} target="_blank" rel="noreferrer">
      {body}
      <Download className="stp-row__chevron" {...ICON} />
    </a>
  ) : (
    <div className="stp-file">{body}</div>
  );
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });

function SubmitForm({ formId, task, replacing, onSubmitted }: { formId: string; task: TaskModel; replacing: boolean; onSubmitted: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const utils = trpc.useUtils();
  const submit = trpc.student.submitTask.useMutation({
    onSuccess: async () => {
      toast.success(replacing ? "Reemplazaste tu entrega." : "Entregaste la actividad.");
      setFile(null);
      setComment("");
      await utils.educore.snapshot.invalidate();
      onSubmitted();
    },
    onError: err => setError(err.message || "No pudimos enviar tu entrega. Inténtalo de nuevo."),
  });

  const pick = (candidate: File | null | undefined) => {
    if (!candidate) return;
    const check = checkResourceFile(candidate.name, candidate.size);
    if (!check.ok) {
      setFile(null);
      setError(check.message);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submit.isPending) return;
    if (!file) {
      setError(replacing ? "Elige el archivo que reemplazará tu entrega." : "Adjunta el archivo de tu entrega.");
      return;
    }
    try {
      const dataBase64 = await readAsDataUrl(file);
      submit.mutate({ role: "student", assignmentId: task.id, comment, file: { name: file.name, dataBase64 } });
    } catch {
      setError("No pudimos leer el archivo. Vuelve a elegirlo.");
    }
  };

  return (
    <form id={formId} className="stp-block" onSubmit={onSubmit} noValidate aria-busy={submit.isPending}>
      <h3 className="stp-block__title">{replacing ? "Reemplazar entrega" : "Entregar"}</h3>

      {file ? (
        <div className="stp-file">
          <span className="stp-bubble">
            <Paperclip {...ICON} />
          </span>
          <span className="stp-file__body">
            <span className="stp-file__name">{file.name}</span>
            <span className="stp-file__meta">{formatBytes(file.size)}</span>
          </span>
          <button type="button" className="stp-icon-btn" aria-label="Quitar archivo" onClick={() => { setFile(null); setError(null); }}>
            <X {...ICON} />
          </button>
        </div>
      ) : (
        <label
          className="stp-dropzone"
          data-dragging={dragging}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="stp-empty__icon">
            <Upload {...ICON} />
          </span>
          <span className="stp-dropzone__title">Arrastra tu archivo o elígelo</span>
          <span className="stp-help">
            {FORMATS} · máximo {Math.round(MAX_RESOURCE_BYTES / (1024 * 1024))} MB
          </span>
          <input ref={inputRef} type="file" accept={ACCEPT} className="stp-sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => pick(event.target.files?.[0])} />
        </label>
      )}

      <div className="stp-field">
        <label className="stp-label" htmlFor={`${formId}-comment`}>
          Comentario para tu docente <span className="stp-help">(opcional)</span>
        </label>
        <textarea
          id={`${formId}-comment`}
          className="stp-textarea"
          maxLength={500}
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder="Por ejemplo: en el punto 3 usé otro método."
        />
      </div>

      {error && (
        <p className="stp-error" role="alert">
          {error}
        </p>
      )}
      {submit.isPending && <p className="stp-help">Enviando tu entrega…</p>}
    </form>
  );
}

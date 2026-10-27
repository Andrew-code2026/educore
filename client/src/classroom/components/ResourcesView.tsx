import { useId, useState, type DragEvent, type FormEvent } from 'react';
import { Download, FileText, FolderOpen, LoaderCircle, Plus, Search, SearchX, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { ALLOWED_RESOURCE_EXTENSIONS, MAX_RESOURCE_BYTES, checkResourceFile } from '@shared/courseResources';
import type { Activity } from '../types';
import { formatDayMonth } from '../course/overview';
import { extensionOf, formatBytes, searchResources, titleFromFileName, type CourseResourceItem } from '../course/resources';

type Role = 'admin' | 'teacher' | 'student' | 'guardian';

interface ResourcesViewProps {
  role: Role;
  /** Grupo del curso tal como lo guardan las actividades ("11-2"). */
  course: string;
  activities: Activity[];
  canManage: boolean;
}

const ACCEPT = ALLOWED_RESOURCE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Recursos del curso: materiales que el docente sube y los estudiantes descargan. */
export function ResourcesView({ role, course, activities, canManage }: ResourcesViewProps) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const resources = trpc.educore.courseResources.useQuery({ role, course });
  const items: CourseResourceItem[] = resources.data ?? [];
  const visible = searchResources(items, search);
  const activityName = new Map(activities.map((a) => [Number(a.id), a.name]));

  // Sin recursos, el estado vacío ya ofrece la acción; la barra aparece cuando hay algo que buscar
  const header = items.length > 0 && (
    <div className="ccw-toolbar">
      <label className="ccw-search">
        <Search aria-hidden="true" strokeWidth={2} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar recurso"
          aria-label="Buscar recurso"
        />
      </label>
      {canManage && !adding && (
        <button type="button" className="ccw-btn ccw-btn--primary ccw-toolbar__end" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" strokeWidth={2.25} />
          Añadir recurso
        </button>
      )}
    </div>
  );

  return (
    <div className="ccw ccw-resources">
      {header}

      {adding && (
        <UploadPanel role={role} course={course} activities={activities} onClose={() => setAdding(false)} />
      )}

      {resources.isLoading ? (
        <p className="ccw-surface ccw-quiet" role="status">
          Cargando recursos…
        </p>
      ) : resources.isError ? (
        <div className="ccw-surface ccw-empty" role="alert">
          <p className="ccw-empty__title">No se pudieron cargar los recursos</p>
          <p className="ccw-empty__note">Revisa tu conexión e intenta de nuevo.</p>
          <button type="button" className="ccw-btn ccw-btn--outline" onClick={() => resources.refetch()}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        adding ? null : (
          <div className="ccw-surface ccw-empty ccw-empty--page">
            <span aria-hidden="true" className="ccw-empty__icon">
              <FolderOpen strokeWidth={1.75} />
            </span>
            <h2 className="ccw-empty__title">Aún no hay recursos en este curso</h2>
            <p className="ccw-empty__note">
              {canManage
                ? 'Sube guías, rúbricas o plantillas para que tus estudiantes las tengan a mano al entregar.'
                : 'Cuando tu docente comparta guías o plantillas, aparecerán aquí.'}
            </p>
            {canManage && (
              <button type="button" className="ccw-btn ccw-btn--primary" onClick={() => setAdding(true)}>
                <Plus aria-hidden="true" strokeWidth={2.25} />
                Añadir el primero
              </button>
            )}
          </div>
        )
      ) : visible.length === 0 ? (
        <div className="ccw-surface ccw-empty">
          <span aria-hidden="true" className="ccw-empty__icon">
            <SearchX strokeWidth={1.75} />
          </span>
          <p className="ccw-empty__title">Ningún recurso coincide</p>
          <button type="button" className="ccw-btn ccw-btn--outline" onClick={() => setSearch('')}>
            Ver todos
          </button>
        </div>
      ) : (
        <ul className="ccw-surface ccw-list" aria-label="Recursos del curso">
          {visible.map((resource) => (
            <ResourceRow
              key={resource.id}
              role={role}
              course={course}
              resource={resource}
              activity={resource.assignmentId ? activityName.get(resource.assignmentId) : undefined}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResourceRow({
  role,
  course,
  resource,
  activity,
  canManage,
}: {
  role: Role;
  course: string;
  resource: CourseResourceItem;
  activity?: string;
  canManage: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();
  const remove = trpc.educore.deleteCourseResource.useMutation({
    onSuccess: () => {
      toast.success(`"${resource.title}" eliminado`);
      return utils.educore.courseResources.invalidate({ role, course });
    },
    onError: (err) => toast.error(err.message || 'No se pudo eliminar el recurso.'),
  });
  const ext = extensionOf(resource.fileName);

  return (
    <li className="ccw-row ccw-resource">
      <span aria-hidden="true" className="ccw-row__icon ccw-resource__icon">
        <FileText strokeWidth={1.75} />
        {ext && <span className="ccw-resource__ext">{ext}</span>}
      </span>
      <span className="ccw-row__body">
        <span className="ccw-row__title">{resource.title}</span>
        <span className="ccw-row__detail">
          {formatBytes(resource.sizeBytes)} · Subido el {formatDayMonth(new Date(resource.createdAt))}
          {activity ? ` · ${activity}` : ' · Todo el curso'}
        </span>
      </span>

      {confirming ? (
        <span className="ccw-resource__actions" role="group" aria-label={`Confirmar eliminación de ${resource.title}`}>
          <span className="ccw-resource__ask">¿Eliminar?</span>
          <button type="button" className="ccw-btn ccw-btn--outline ccw-btn--sm" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="ccw-btn ccw-btn--danger ccw-btn--sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ role, id: resource.id })}
          >
            {remove.isPending ? 'Eliminando…' : 'Eliminar'}
          </button>
        </span>
      ) : (
        <span className="ccw-resource__actions">
          <a
            className="ccw-btn ccw-btn--outline ccw-btn--sm"
            href={resource.fileUrl}
            download={resource.fileName}
            aria-label={`Descargar ${resource.title}`}
          >
            <Download aria-hidden="true" strokeWidth={2} />
            <span className="ccw-resource__label">Descargar</span>
          </a>
          {canManage && (
            <button
              type="button"
              className="ccw-icon-btn ccw-icon-btn--danger"
              onClick={() => setConfirming(true)}
              aria-label={`Eliminar ${resource.title}`}
              title="Eliminar"
            >
              <Trash2 aria-hidden="true" strokeWidth={2} />
            </button>
          )}
        </span>
      )}
    </li>
  );
}

function UploadPanel({
  role,
  course,
  activities,
  onClose,
}: {
  role: Role;
  course: string;
  activities: Activity[];
  onClose: () => void;
}) {
  const ids = useId();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const utils = trpc.useUtils();
  const upload = trpc.educore.uploadCourseResource.useMutation();
  const published = activities.filter((a) => a.status !== 'Borrador' && /^\d+$/.test(a.id));

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const check = checkResourceFile(picked.name, picked.size);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError('');
    setFile(picked);
    if (!title.trim()) setTitle(titleFromFileName(picked.name));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return setError('Elige un archivo para subir.');
    if (title.trim().length < 2) return setError('Escribe un nombre para el recurso.');
    try {
      await upload.mutateAsync({
        role,
        course,
        title: title.trim(),
        assignmentId: assignmentId ? Number(assignmentId) : null,
        fileName: file.name,
        dataBase64: await readAsDataUrl(file),
      });
      await utils.educore.courseResources.invalidate({ role, course });
      toast.success(`"${title.trim()}" ya está disponible para el curso`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo subir el archivo. Intenta de nuevo.');
    }
  };

  return (
    <form className="ccw-surface ccw-upload" onSubmit={submit} noValidate aria-labelledby={`${ids}-title`}>
      <div className="ccw-upload__head">
        <h2 id={`${ids}-title`} className="ccw-section__title">
          Nuevo recurso
        </h2>
        <button type="button" className="ccw-icon-btn" onClick={onClose} aria-label="Cerrar" disabled={upload.isPending}>
          <X aria-hidden="true" strokeWidth={2} />
        </button>
      </div>

      <label
        className={`ccw-drop${dragging ? ' ccw-drop--over' : ''}${file ? ' ccw-drop--filled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={ACCEPT}
          className="ccw-sr"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <span aria-hidden="true" className="ccw-empty__icon">
          {file ? <FileText strokeWidth={1.75} /> : <UploadCloud strokeWidth={1.75} />}
        </span>
        {file ? (
          <>
            <span className="ccw-drop__title">{file.name}</span>
            <span className="ccw-drop__note">{formatBytes(file.size)} · Haz clic para cambiarlo</span>
          </>
        ) : (
          <>
            <span className="ccw-drop__title">Arrastra un archivo o haz clic para elegirlo</span>
            <span className="ccw-drop__note">
              PDF, Word, PowerPoint, Excel, imágenes o ZIP · máximo {formatBytes(MAX_RESOURCE_BYTES)}
            </span>
          </>
        )}
      </label>

      <div className="ccw-upload__fields">
        <div className="ccw-field">
          <label htmlFor={`${ids}-name`} className="ccw-field__label">
            Nombre
          </label>
          <input
            id={`${ids}-name`}
            className="ccw-input"
            value={title}
            maxLength={180}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Guía de laboratorio"
          />
        </div>
        <div className="ccw-field">
          <label htmlFor={`${ids}-activity`} className="ccw-field__label">
            Actividad relacionada <span className="ccw-field__optional">opcional</span>
          </label>
          <select
            id={`${ids}-activity`}
            className="ccw-input ccw-input--select"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
          >
            <option value="">Todo el curso</option>
            {published.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="ccw-help ccw-help--error" role="alert">
          {error}
        </p>
      )}

      <div className="ccw-upload__actions">
        <button type="button" className="ccw-btn ccw-btn--outline" onClick={onClose} disabled={upload.isPending}>
          Cancelar
        </button>
        <button type="submit" className="ccw-btn ccw-btn--primary" disabled={upload.isPending}>
          {upload.isPending && <LoaderCircle aria-hidden="true" strokeWidth={2} className="ccw-spin" />}
          {upload.isPending ? 'Subiendo…' : 'Subir recurso'}
        </button>
      </div>
    </form>
  );
}

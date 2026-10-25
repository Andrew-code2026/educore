import { useMemo, useState } from 'react';
import { ChevronDown, Download, Eye, PenLine, Search, SearchX, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Activity, Student } from '../types';
import { plural } from '../landing/courses';
import { describeDue, formatDayMonth, formatTime } from '../course/overview';
import {
  SUBMISSION_FILTERS,
  countBySubmissionFilter,
  firstToGrade,
  phaseOfSubmission,
  selectSubmissions,
  submissionsCsv,
  summarizeSubmissions,
  type SubmissionFilter,
  type SubmissionPhase,
} from '../course/submissions';

interface SubmissionsViewProps {
  activity: Activity;
  /** Actividades del curso para cambiar de una a otra sin salir de la pestaña. */
  activities: Activity[];
  onSelectActivity: (activity: Activity) => void;
  students: Student[];
  filter: SubmissionFilter;
  setFilter: (filter: SubmissionFilter) => void;
  onOpenGrader: (studentIndex: number) => void;
  onPreview: () => void;
}

const PHASE_LABEL: Record<SubmissionPhase, string> = {
  review: 'Por revisar',
  graded: 'Calificada',
  missing: 'Sin entrega',
};

// Mismos tonos que los estados de actividad: por revisar azul, calificada verde, sin entrega neutro
const PHASE_PILL: Record<SubmissionPhase, string> = {
  review: 'review',
  graded: 'open',
  missing: 'closed',
};

/** Entregas de una actividad: quién entregó, qué falta por calificar y acceso al calificador. */
export function SubmissionsView({
  activity,
  activities,
  onSelectActivity,
  students,
  filter,
  setFilter,
  onOpenGrader,
  onPreview,
}: SubmissionsViewProps) {
  const [query, setQuery] = useState('');

  const { summary, counts, visible, indexById } = useMemo(
    () => ({
      summary: summarizeSubmissions(students),
      counts: countBySubmissionFilter(students),
      visible: selectSubmissions(students, filter, query),
      indexById: new Map(students.map((s, i) => [s.id, i])),
    }),
    [students, filter, query]
  );

  const published = activities.filter((a) => a.status !== 'Borrador');

  if (!activity.id) {
    return (
      <div className="ccw ccw-submissions">
        <div className="ccw-surface ccw-empty ccw-empty--page">
          <span aria-hidden="true" className="ccw-empty__icon">
            <Users strokeWidth={1.75} />
          </span>
          <h2 className="ccw-empty__title">Aún no hay entregas</h2>
          <p className="ccw-empty__note">
            Cuando publiques una actividad, aquí verás quién entregó y qué falta por calificar.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
  const dueLabel = dueAt ? `${describeDue(dueAt, now)} · ${formatTime(dueAt)}` : 'Sin fecha límite';
  const progress = summary.total > 0 ? Math.round((summary.delivered / summary.total) * 100) : 0;
  const gradeStart = firstToGrade(students);

  const exportList = () => {
    const blob = new Blob([submissionsCsv(students)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `entregas-${activity.name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Lista de entregas exportada');
  };

  return (
    <div className="ccw ccw-submissions">
      <section aria-label="Actividad" className="ccw-surface ccw-brief">
        <div className="ccw-brief__main">
          <div className="ccw-brief__copy">
            <label className="ccw-picker">
              <span className="ccw-sr">Actividad</span>
              <select
                value={activity.id}
                onChange={(e) => {
                  const next = activities.find((a) => a.id === e.target.value);
                  if (next) onSelectActivity(next);
                }}
              >
                {(published.some((a) => a.id === activity.id) ? published : [activity, ...published]).map(
                  (a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  )
                )}
              </select>
              <ChevronDown aria-hidden="true" strokeWidth={2} />
            </label>
            <p className="ccw-brief__meta">{dueLabel}</p>
          </div>

          <div className="ccw-brief__actions">
            <button
              type="button"
              className="ccw-btn ccw-btn--outline ccw-btn--sm"
              onClick={onPreview}
              title="Ver la entrega como la ve el estudiante"
            >
              <Eye aria-hidden="true" strokeWidth={2} />
              Vista estudiante
            </button>
            <button
              type="button"
              className="ccw-btn ccw-btn--outline ccw-btn--sm"
              onClick={exportList}
              disabled={!students.length}
            >
              <Download aria-hidden="true" strokeWidth={2} />
              Exportar
            </button>
            <button
              type="button"
              className="ccw-btn ccw-btn--primary ccw-btn--sm"
              onClick={() => onOpenGrader(gradeStart)}
              disabled={gradeStart < 0}
            >
              <PenLine aria-hidden="true" strokeWidth={2} />
              {summary.review > 0 ? 'Calificar pendientes' : 'Abrir calificador'}
            </button>
          </div>
        </div>

        <div className="ccw-brief__progress">
          <div className="ccw-brief__progress-head">
            <span>
              <strong className="ccw-num">{summary.delivered}</strong> de{' '}
              {plural(summary.total, 'estudiante entregó', 'estudiantes entregaron')}
            </span>
            <span className="ccw-num">{progress}%</span>
          </div>
          <span className="ccw-meter__track ccw-brief__track" aria-hidden="true">
            <span className="ccw-meter__bar" style={{ width: `${progress}%` }} />
          </span>
        </div>
      </section>

      <div className="ccw-toolbar">
        <label className="ccw-search">
          <Search aria-hidden="true" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar estudiante o archivo"
            aria-label="Buscar estudiante o archivo"
          />
        </label>

        <div role="group" aria-label="Filtrar entregas" className="ccw-filters">
          {SUBMISSION_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className="ccw-chip"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
              <span className="ccw-chip__count ccw-num">{counts[item]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <ul className="ccw-surface ccw-list" aria-label={plural(visible.length, 'estudiante', 'estudiantes')}>
          {visible.map((student) => (
            <SubmissionRow
              key={student.id}
              student={student}
              dueAt={dueAt}
              now={now}
              onOpen={() => onOpenGrader(indexById.get(student.id) ?? 0)}
            />
          ))}
        </ul>
      ) : (
        <div className="ccw-surface ccw-empty">
          <span aria-hidden="true" className="ccw-empty__icon">
            {students.length ? <SearchX strokeWidth={1.75} /> : <Users strokeWidth={1.75} />}
          </span>
          {students.length ? (
            <>
              <p className="ccw-empty__title">Ninguna entrega coincide</p>
              <p className="ccw-empty__note">Prueba con otro nombre o cambia el filtro.</p>
              <button
                type="button"
                className="ccw-btn ccw-btn--outline"
                onClick={() => {
                  setFilter('Todos');
                  setQuery('');
                }}
              >
                Ver todas
              </button>
            </>
          ) : (
            <>
              <p className="ccw-empty__title">Sin estudiantes matriculados</p>
              <p className="ccw-empty__note">Cuando el curso tenga estudiantes, sus entregas aparecerán aquí.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({
  student,
  dueAt,
  now,
  onOpen,
}: {
  student: Student;
  dueAt: Date | null;
  now: Date;
  onOpen: () => void;
}) {
  const phase = phaseOfSubmission(student);
  const submittedAt = student.submittedAt ? new Date(student.submittedAt) : null;
  const late = Boolean(submittedAt && dueAt && submittedAt > dueAt);

  let detail: string;
  if (phase === 'missing') {
    detail = dueAt && dueAt < now ? 'No entregó antes del cierre' : 'Aún no ha entregado';
  } else {
    detail = submittedAt ? `Entregó el ${formatDayMonth(submittedAt)}` : 'Entrega registrada';
    if (student.file) detail += ` · ${student.file}`;
  }

  return (
    <li className={`ccw-row ccw-sub${phase === 'missing' ? ' ccw-sub--missing' : ''}`}>
      <span aria-hidden="true" className="ccw-avatar">
        {student.initials}
      </span>
      <span className="ccw-row__body">
        <span className="ccw-row__title">{student.name}</span>
        <span className="ccw-row__detail">
          {detail}
          {late && <span className="ccw-row__late"> · Tarde</span>}
        </span>
      </span>
      <span className={`ccw-pill ccw-pill--${PHASE_PILL[phase]}`}>
        <span aria-hidden="true" className="ccw-pill__dot" />
        {PHASE_LABEL[phase]}
      </span>
      <span className="ccw-grade ccw-num">
        {student.score !== undefined ? (
          <>
            <b>{student.score.toFixed(1)}</b>
            <span className="ccw-grade__scale">/5</span>
          </>
        ) : (
          <span aria-label="Sin calificación">—</span>
        )}
      </span>
      {/* Sin entrega no hay nada que abrir; la celda vacía mantiene las columnas alineadas */}
      <span className="ccw-sub__action">
        {phase === 'review' && (
          <button
            type="button"
            className="ccw-btn ccw-btn--primary ccw-btn--sm"
            onClick={onOpen}
            aria-label={`Calificar la entrega de ${student.name}`}
          >
            Calificar
          </button>
        )}
        {phase === 'graded' && (
          <button
            type="button"
            className="ccw-btn ccw-btn--outline ccw-btn--sm"
            onClick={onOpen}
            aria-label={`Ver la entrega calificada de ${student.name}`}
          >
            Ver
          </button>
        )}
      </span>
    </li>
  );
}

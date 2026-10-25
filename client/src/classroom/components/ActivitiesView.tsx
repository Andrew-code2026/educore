import { useMemo } from 'react';
import { ChevronRight, ClipboardList, FileText, Plus, Search, SearchX } from 'lucide-react';
import type { Activity } from '../types';
import { plural } from '../landing/courses';
import { describeDue } from '../course/overview';
import {
  ACTIVITY_FILTERS,
  ACTIVITY_SORTS,
  PHASE_LABEL,
  countByFilter,
  pendingOf,
  phaseOf,
  selectActivities,
  type ActivityFilter,
  type ActivitySort,
} from '../course/activities';

interface ActivitiesViewProps {
  activities: Activity[];
  filter: ActivityFilter;
  setFilter: (filter: ActivityFilter) => void;
  query: string;
  setQuery: (query: string) => void;
  sortBy: ActivitySort;
  setSortBy: (sort: ActivitySort) => void;
  selectActivity: (activity: Activity) => void;
  totalStudents: number;
  /** Solo para quien puede gestionar el curso. */
  onNewActivity?: () => void;
}

/** Actividades del curso: buscar, filtrar por estado y abrir sus entregas. */
export function ActivitiesView({
  activities,
  filter,
  setFilter,
  query,
  setQuery,
  sortBy,
  setSortBy,
  selectActivity,
  totalStudents,
  onNewActivity,
}: ActivitiesViewProps) {
  // `now` se fija junto con la lista para que orden y fechas relativas coincidan
  const { visible, counts, now } = useMemo(() => {
    const at = new Date();
    return {
      visible: selectActivities(activities, { filter, query, sort: sortBy }, at),
      counts: countByFilter(activities),
      now: at,
    };
  }, [activities, filter, query, sortBy]);

  if (activities.length === 0) {
    return (
      <div className="ccw ccw-activities">
        <div className="ccw-surface ccw-empty ccw-empty--page">
          <span aria-hidden="true" className="ccw-empty__icon">
            <ClipboardList strokeWidth={1.75} />
          </span>
          <h2 className="ccw-empty__title">Este curso aún no tiene actividades</h2>
          <p className="ccw-empty__note">
            Crea una actividad con entrega digital para que tus estudiantes suban sus trabajos.
          </p>
          {onNewActivity && (
            <button type="button" className="ccw-btn ccw-btn--primary" onClick={onNewActivity}>
              <Plus aria-hidden="true" strokeWidth={2.25} />
              Crear actividad
            </button>
          )}
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    setFilter('Todas');
    setQuery('');
  };

  return (
    <div className="ccw ccw-activities">
      <div className="ccw-toolbar">
        <label className="ccw-search">
          <Search aria-hidden="true" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar actividad"
            aria-label="Buscar actividad"
          />
        </label>

        <div role="group" aria-label="Filtrar por estado" className="ccw-filters">
          {ACTIVITY_FILTERS.map((item) => (
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

        <label className="ccw-sort">
          <span>Ordenar</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as ActivitySort)}>
            {ACTIVITY_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length > 0 ? (
        <ul className="ccw-surface ccw-list" aria-label={plural(visible.length, 'actividad', 'actividades')}>
          {visible.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              totalStudents={totalStudents}
              now={now}
              onOpen={selectActivity}
            />
          ))}
        </ul>
      ) : (
        <div className="ccw-surface ccw-empty">
          <span aria-hidden="true" className="ccw-empty__icon">
            <SearchX strokeWidth={1.75} />
          </span>
          <p className="ccw-empty__title">Ninguna actividad coincide</p>
          <p className="ccw-empty__note">Prueba con otro nombre o cambia el filtro de estado.</p>
          <button type="button" className="ccw-btn ccw-btn--outline" onClick={clearFilters}>
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  totalStudents,
  now,
  onOpen,
}: {
  activity: Activity;
  totalStudents: number;
  now: Date;
  onOpen: (activity: Activity) => void;
}) {
  const phase = phaseOf(activity);
  const pending = pendingOf(activity);
  const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
  const due = phase === 'draft' ? 'Sin publicar' : describeDue(dueAt, now) ?? 'Sin fecha límite';
  const progress =
    totalStudents > 0 ? Math.min(100, Math.round((activity.submissions / totalStudents) * 100)) : 0;

  return (
    <li>
      <button type="button" className="ccw-row ccw-row--link ccw-activity" onClick={() => onOpen(activity)}>
        <span aria-hidden="true" className="ccw-row__icon">
          <FileText strokeWidth={1.75} />
        </span>
        <span className="ccw-row__body">
          <span className="ccw-row__title">{activity.name}</span>
          <span className="ccw-row__detail">
            {due}
            {pending > 0 && (
              <span className="ccw-row__flag"> · {pending} sin calificar</span>
            )}
          </span>
        </span>
        {/* La columna se conserva vacía en borradores para que las filas sigan alineadas */}
        <span className="ccw-meter ccw-activity__meter">
          {phase !== 'draft' && totalStudents > 0 && (
            <>
              <span className="ccw-meter__track" aria-hidden="true">
                <span className="ccw-meter__bar" style={{ width: `${progress}%` }} />
              </span>
              <span className="ccw-meter__label ccw-num">
                {activity.submissions}/{totalStudents}
                <span className="ccw-sr"> estudiantes entregaron</span>
              </span>
            </>
          )}
        </span>
        <span className={`ccw-pill ccw-pill--${phase}`}>
          <span aria-hidden="true" className="ccw-pill__dot" />
          {PHASE_LABEL[phase]}
        </span>
        <ChevronRight aria-hidden="true" strokeWidth={2} className="ccw-row__chevron" />
      </button>
    </li>
  );
}

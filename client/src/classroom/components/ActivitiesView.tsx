import { useState } from 'react';
import type { Activity } from '../types';
import { Icon, StatusPill } from './SharedUI';

const FILTERS = ['Todas', 'Activas', 'Por revisar', 'Próximas', 'Cerradas', 'Borradores'];

interface ActivitiesViewProps {
  activities: Activity[];
  total: number;
  filter: string;
  setFilter: (f: string) => void;
  query: string;
  setQuery: (q: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  selectActivity: (activity: Activity) => void;
  totalStudents?: number;
}

export function ActivitiesView({
  activities,
  total,
  filter,
  setFilter,
  query,
  setQuery,
  sortBy,
  setSortBy,
  selectActivity,
  totalStudents = 32,
}: ActivitiesViewProps) {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  return (
    <section className="view-section activities-view activity-workspace">
      <div className="activity-workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE DE ENTREGAS · {total}</span>
          <h2>Actividades con entrega</h2>
          <p>Un espacio para crear, publicar, recibir y revisar trabajos digitales.</p>
        </div>
        <div className="activity-flow">
          <span className="flow-step done">
            <i>1</i>Crear
          </span>
          <b>→</b>
          <span className="flow-step done">
            <i>2</i>Publicar
          </span>
          <b>→</b>
          <span className="flow-step">
            <i>3</i>Recibir
          </span>
          <b>→</b>
          <span className="flow-step">
            <i>4</i>Revisar
          </span>
        </div>
      </div>

      <div className="activity-controls">
        <div className="activity-search search-box">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar actividad…"
          />
        </div>

        <div className="activity-filter-pills">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? 'selected' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="activity-density" aria-label="Densidad de vista">
          <button
            type="button"
            className={density === 'comfortable' ? 'selected' : ''}
            onClick={() => setDensity('comfortable')}
          >
            <Icon name="layers" size={13} /> Cómoda
          </button>
          <button
            type="button"
            className={density === 'compact' ? 'selected' : ''}
            onClick={() => setDensity('compact')}
          >
            <Icon name="grid" size={13} /> Compacta
          </button>
        </div>

        <label className="activity-sort">
          <span>Ordenar</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="fecha">Fecha límite</option>
            <option value="pendientes">Pendientes</option>
            <option value="estado">Estado</option>
            <option value="nombre">Nombre</option>
          </select>
        </label>
      </div>

      <div
        className={`activity-object-grid ${
          density === 'compact' ? 'compact-density' : 'comfortable-density'
        }`}
      >
        {activities.map((activity) => {
          const pending = Math.max(0, activity.submissions - activity.graded);
          const progress = totalStudents ? Math.round((activity.submissions / totalStudents) * 100) : 0;
          const dueTime = activity.dueDate.includes('·')
            ? activity.dueDate.split('·')[1].trim()
            : '23:59';

          return (
            <button
              type="button"
              className={`activity-object glass-card ${activity.accent}`}
              key={activity.id}
              onClick={() => selectActivity(activity)}
            >
              <div className="activity-object-accent" />
              <div className="activity-object-top">
                <span className={`activity-object-icon ${activity.accent}`}>
                  <Icon name={activity.icon || 'clipboard'} size={21} />
                </span>
                <StatusPill status={activity.status} />
                <span className="object-open">
                  <Icon name="arrow" size={15} />
                </span>
              </div>

              <div className="activity-object-title">
                <span className="activity-object-type">
                  {activity.type} · Entrega digital
                </span>
                <h3>{activity.name}</h3>
                <p>{activity.description}</p>
              </div>

              <div className="activity-object-meta">
                <span>
                  <small>Fecha límite</small>
                  <strong>{activity.date}</strong>
                  <em>{dueTime}</em>
                </span>
                <span>
                  <small>Entregas</small>
                  <strong>
                    {activity.submissions}
                    <em> / {totalStudents}</em>
                  </strong>
                  <div className="object-progress">
                    <i style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                </span>
                <span className={pending > 0 ? 'needs-review' : ''}>
                  <small>Por revisar</small>
                  <strong>{pending}</strong>
                  <em>{pending > 0 ? 'requieren atención' : 'al día'}</em>
                </span>
              </div>

              <div className="activity-object-footer">
                <span className={activity.affectsGradeCenter ? 'grade-link' : 'no-grade'}>
                  <Icon name="chart" size={13} />{' '}
                  {activity.affectsGradeCenter
                    ? `Grade Center · ${activity.weight ?? 'sin peso'}`
                    : 'Solo ClassCORE'}
                </span>
                <span className="object-formats">
                  {activity.formats.slice(0, 3).join(' · ')}
                </span>
              </div>
            </button>
          );
        })}

        {!activities.length && (
          <div className="empty-state">
            <Icon name="search" size={24} />
            <strong>No encontramos actividades</strong>
            <p>Prueba con otro filtro o término de búsqueda.</p>
          </div>
        )}
      </div>

      <div className="activity-workspace-footer">
        Mostrando <b>{activities.length}</b> de {total} actividades con entrega{' '}
        <span>Selecciona una actividad para abrir sus entregas y revisión</span>
      </div>
    </section>
  );
}

import type { Activity } from '../types';
import { Icon, SectionLabel } from './SharedUI';

interface OverviewViewProps {
  activities: Activity[];
  stats: {
    active: number;
    review: number;
    upcoming: number;
  };
  selectActivity: (activity: Activity) => void;
  dateRange?: string;
  totalStudents?: number;
}

export function OverviewView({
  activities,
  stats,
  selectActivity,
  dateRange = 'Ciclo 2026',
  totalStudents = 32,
}: OverviewViewProps) {
  const recent = activities.slice(0, 5);
  const upcoming = activities.filter((a) => ['Próxima', 'En curso', 'Publicada'].includes(a.status)).slice(0, 4);
  const totalSubmissionsThisWeek = activities.reduce((acc, curr) => acc + curr.submissions, 0);

  return (
    <section className="view-section overview-view">
      <div className="overview-title">
        <div>
          <span className="eyebrow">PANORAMA DEL CURSO</span>
          <h2>Panorama del curso</h2>
          <p>Lo que requiere atención y lo que viene después.</p>
        </div>
        <span className="date-chip">{dateRange}</span>
      </div>

      <div className="operational-metrics overview-kpis">
        <div className="summary-card">
          <span className="summary-icon amber">
            <Icon name="clipboard" size={17} />
          </span>
          <div>
            <span className="summary-label">Por revisar</span>
            <strong>{stats.review}</strong>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon cyan">
            <Icon name="layers" size={17} />
          </span>
          <div>
            <span className="summary-label">Actividades activas</span>
            <strong>{stats.active}</strong>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon violet">
            <Icon name="chart" size={17} />
          </span>
          <div>
            <span className="summary-label">Próximas</span>
            <strong>{stats.upcoming}</strong>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon mint">
            <Icon name="download" size={17} />
          </span>
          <div>
            <span className="summary-label">Entregas recibidas</span>
            <strong>{totalSubmissionsThisWeek}</strong>
          </div>
        </div>
      </div>

      <div className="overview-columns">
        <section className="glass-card compact-section">
          <SectionLabel>Actividades recientes</SectionLabel>
          <div className="recent-list">
            {recent.map((activity) => {
              const pending = Math.max(0, activity.submissions - activity.graded);
              const progress = totalStudents ? Math.round((activity.submissions / totalStudents) * 100) : 0;
              return (
                <button
                  type="button"
                  className="recent-row"
                  key={activity.id}
                  onClick={() => selectActivity(activity)}
                >
                  <span className={`activity-icon ${activity.accent}`}>
                    <Icon name={activity.icon || 'clipboard'} size={16} />
                  </span>
                  <span className="recent-main">
                    <strong>{activity.name}</strong>
                    <small>
                      {activity.type} · {activity.submissions}/{totalStudents} entregaron
                    </small>
                    <span className="recent-progress">
                      <i style={{ width: `${Math.min(100, progress)}%` }} />
                    </span>
                  </span>
                  <span
                    className={
                      pending
                        ? 'recent-review'
                        : activity.submissions === totalStudents && totalStudents > 0
                        ? 'recent-complete'
                        : 'recent-empty'
                    }
                  >
                    {pending > 0 ? (
                      <>
                        <b>{pending}</b>
                        <small>pendientes</small>
                      </>
                    ) : activity.submissions === totalStudents && totalStudents > 0 ? (
                      <>
                        <Icon name="check" size={13} /> Completada
                      </>
                    ) : (
                      <>
                        <b>{activity.submissions}</b>
                        <small>entregas</small>
                      </>
                    )}
                  </span>
                  <span className="recent-date">{activity.date}</span>
                  <Icon name="chevron" size={15} />
                </button>
              );
            })}
            {!recent.length && (
              <div className="empty-state py-8">
                <Icon name="layers" size={20} />
                <strong>No hay actividades recientes</strong>
                <p>Crea tu primera actividad digital para comenzar.</p>
              </div>
            )}
          </div>
        </section>

        <section className="glass-card compact-section upcoming-section">
          <SectionLabel>Próximas entregas</SectionLabel>
          <div className="recent-list">
            {upcoming.map((activity) => {
              const parts = activity.date.split(' ');
              const day = parts[0] || '28';
              const month = parts[1] || 'Oct';
              const dueHour = activity.dueDate.includes('·')
                ? activity.dueDate.split('·')[1].trim()
                : '23:59';
              return (
                <button
                  type="button"
                  className="upcoming-row"
                  key={activity.id}
                  onClick={() => selectActivity(activity)}
                >
                  <span className="upcoming-date">
                    <b>{day}</b>
                    <small>{month}</small>
                  </span>
                  <span className="upcoming-main">
                    <strong>{activity.name}</strong>
                    <small>
                      <b>{dueHour}</b> · {activity.type}
                    </small>
                  </span>
                  <Icon name="chevron" size={14} />
                </button>
              );
            })}
            {!upcoming.length && (
              <div className="empty-state py-8">
                <Icon name="clock" size={20} />
                <strong>Al día</strong>
                <p>No hay entregas pendientes de fecha límite inmediata.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

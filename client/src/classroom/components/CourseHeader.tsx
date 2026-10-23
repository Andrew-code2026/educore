import type { CourseSummary, ViewKey } from '../types';
import { Icon } from './SharedUI';

interface CourseHeaderProps {
  course: CourseSummary;
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onBackToCourses: () => void;
  onNewActivity: () => void;
  stats: {
    active: number;
    review: number;
    upcoming: number;
    drafts: number;
  };
  canManage?: boolean;
}

export function CourseHeader({
  course,
  view,
  onNavigate,
  onBackToCourses,
  onNewActivity,
  stats,
  canManage = true,
}: CourseHeaderProps) {
  return (
    <>
      <section className="course-header compact-course-header">
        <div className="course-identity">
          <button
            type="button"
            className="course-back-btn mr-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition cursor-pointer border border-cyan-500/20"
            onClick={onBackToCourses}
            title="Volver al catálogo de cursos"
          >
            <Icon name="back" size={13} />
            <span>Cursos</span>
          </button>
          <span className="course-identity-mark">
            <Icon name={course.icon || 'book'} size={18} />
          </span>
          <div className="course-identity-copy">
            <h1>
              <span className="course-code">{course.code}</span>
              <span className="course-name">{course.name}</span>
            </h1>
            <p>
              {stats.active} actividades activas · {stats.review} por revisar
              {course.subject ? ` · ${course.subject}` : ''}
            </p>
          </div>
        </div>

        <div className="course-header-actions">
          {canManage && (
            <button className="primary-button" onClick={onNewActivity}>
              <Icon name="plus" size={15} /> Nueva actividad
            </button>
          )}
        </div>
      </section>

      <nav
        className="course-tabs course-tabs-v3 module-navigation compact-module-navigation"
        aria-label="Navegación del curso"
      >
        <div className="course-nav-bubbles">
          <button
            title="Resumen del curso"
            className={`nav-bubble ${view === 'overview' ? 'active' : ''}`}
            onClick={() => onNavigate('overview')}
          >
            <Icon name="chart" size={16} />
            <span>Resumen</span>
          </button>

          <button
            title="Actividades con entrega"
            className={`nav-bubble ${view === 'activities' ? 'active' : ''}`}
            onClick={() => onNavigate('activities')}
          >
            <Icon name="layers" size={16} />
            <span>Actividades</span>
          </button>

          <button
            title={`${stats.review} entregas por revisar`}
            className={`nav-bubble ${view === 'submissions' ? 'active' : ''}`}
            onClick={() => onNavigate('submissions')}
          >
            <Icon name="clipboard" size={16} />
            <span>Entregas</span>
            {stats.review > 0 && <em>{stats.review}</em>}
          </button>

          <button
            title="Recursos del curso"
            className={`nav-bubble ${view === 'resources' ? 'active' : ''}`}
            onClick={() => onNavigate('resources')}
          >
            <Icon name="book" size={16} />
            <span>Recursos</span>
          </button>
        </div>
      </nav>
    </>
  );
}

import { ChevronLeft, Plus } from 'lucide-react';
import type { CourseSummary, ViewKey } from '../types';
import { DEFAULT_SUBJECT, plural } from '../landing/courses';
import '../course/course.css';

interface CourseHeaderProps {
  course: CourseSummary;
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onBackToCourses: () => void;
  onNewActivity: () => void;
  /** Entregas sin calificar; se muestra como contador en la pestaña Entregas. */
  reviewCount: number;
  canManage?: boolean;
}

const TABS: { key: Exclude<ViewKey, 'home'>; label: string }[] = [
  { key: 'overview', label: 'Resumen' },
  { key: 'activities', label: 'Actividades' },
  { key: 'submissions', label: 'Entregas' },
  { key: 'resources', label: 'Recursos' },
];

/** Cabecera del curso: misma identidad que su tarjeta en "Mis cursos" y navegación entre secciones. */
export function CourseHeader({
  course,
  view,
  onNavigate,
  onBackToCourses,
  onNewActivity,
  reviewCount,
  canManage = true,
}: CourseHeaderProps) {
  const group = course.name.replace(/^Curso\s*/i, '');
  const hasSubject = Boolean(course.subject && course.subject !== DEFAULT_SUBJECT);

  return (
    <header className="ccw ccw-head">
      <div className="ccw-head__main">
        <button
          type="button"
          className="ccw-icon-btn"
          onClick={onBackToCourses}
          aria-label="Volver a Mis cursos"
          title="Volver a Mis cursos"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={2} />
        </button>

        <span aria-hidden="true" className="ccw-group">
          {group}
        </span>

        <div className="ccw-identity">
          <h1 className="ccw-title">{hasSubject ? course.subject : course.name}</h1>
          <p className="ccw-sub">
            {hasSubject && `${course.name} · `}
            {plural(course.students, 'estudiante', 'estudiantes')}
          </p>
        </div>

        {canManage && (
          <button type="button" className="ccw-btn ccw-btn--primary ccw-head__action" onClick={onNewActivity}>
            <Plus aria-hidden="true" strokeWidth={2.25} />
            <span>Nueva actividad</span>
          </button>
        )}
      </div>

      <nav aria-label="Secciones del curso" className="ccw-tabs">
        {TABS.map((tab) => {
          const active = view === tab.key;
          const badge = tab.key === 'submissions' && reviewCount > 0 ? reviewCount : null;
          return (
            <button
              key={tab.key}
              type="button"
              className="ccw-tab"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(tab.key)}
            >
              {tab.label}
              {badge !== null && (
                <>
                  <span aria-hidden="true" className="ccw-count ccw-num">
                    {badge}
                  </span>
                  <span className="ccw-sr">, {plural(badge, 'entrega por revisar', 'entregas por revisar')}</span>
                </>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

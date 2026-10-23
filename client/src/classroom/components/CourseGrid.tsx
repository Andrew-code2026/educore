import type { CourseSummary } from '../types';
import { Icon } from './SharedUI';

interface CourseGridProps {
  courses: CourseSummary[];
  onSelectCourse: (course: CourseSummary) => void;
}

export function CourseGrid({ courses, onSelectCourse }: CourseGridProps) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Mis cursos asignados ({courses.length})</h2>
          <p>Espacios donde gestionas tus actividades y entregas digitales.</p>
        </div>
      </div>

      <div className="course-grid">
        {courses.map((course, index) => {
          const isFeatured = index === 0;
          return (
            <article
              className={`course-card course-${course.tone} ${isFeatured ? 'featured' : ''}`}
              key={course.id || course.name}
            >
              <div className="course-card-top">
                <span className={`course-symbol ${course.tone}`}>
                  <Icon name={course.icon || 'book'} size={22} />
                </span>
                <div className="course-card-top-meta">
                  <span className="course-badge">{course.code}</span>
                  {isFeatured && <span className="current-tag">ACTIVO</span>}
                </div>
              </div>

              <h3>{course.name}</h3>
              <p className="course-meta">
                {course.students} estudiantes {course.subject ? `· ${course.subject}` : ''}
              </p>

              <div className="course-facts">
                <span>
                  <b>{course.active}</b>
                  <small>actividades activas</small>
                </span>
                <span>
                  <b>{course.review}</b>
                  <small>por revisar</small>
                </span>
                <span>
                  <small>Próxima entrega</small>
                  <b>{course.next}</b>
                </span>
              </div>

              <button
                className={`course-cta ${isFeatured ? 'primary-button' : 'outline-button'}`}
                onClick={() => onSelectCourse(course)}
              >
                {isFeatured ? 'Entrar al curso' : 'Ver curso'} <Icon name="arrow" size={15} />
              </button>
            </article>
          );
        })}
      </div>

      {!courses.length && (
        <div className="empty-state home-empty-state">
          <Icon name="book" size={24} />
          <strong>Conecta tus asignaturas desde EduCore</strong>
          <p>La interfaz está lista para recibir los cursos del sistema principal.</p>
        </div>
      )}

      <div className="home-note">
        <Icon name="lightning" size={18} />
        <div>
          <strong>Módulo EduCore · entregas digitales</strong>
          <p>ClassCORE concentra las actividades que necesitan archivo, evidencia y revisión docente.</p>
        </div>
      </div>
    </>
  );
}

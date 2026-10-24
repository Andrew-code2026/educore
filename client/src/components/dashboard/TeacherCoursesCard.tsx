import React from "react";
import type { TeacherCourseCardItem } from "./types";

interface TeacherCoursesCardProps {
  courses: TeacherCourseCardItem[];
  onViewAll?: () => void;
  /** Fecha de cierre de notas ya formateada, p. ej. "jue 29 oct". */
  closingLabel?: string;
}

// Por debajo de este avance el nombre del curso queda sobre la pista clara y debe ir en azul.
const NAME_ON_FILL_MIN = 35;
// El porcentaje está a la derecha: solo queda sobre el relleno cuando la barra casi se completa.
const VALUE_ON_FILL_MIN = 88;

export function TeacherCoursesCard({
  courses,
  onViewAll,
  closingLabel,
}: TeacherCoursesCardProps) {
  const totalStudents = courses.reduce((sum, course) => sum + (course.studentCount || 0), 0);

  return (
    <section aria-labelledby="h-cursos" className="edc-card edc-courses">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </span>
        <div className="edc-card__heading">
          <h2 id="h-cursos" className="edc-card__title">Mis cursos</h2>
          <div className="edc-card__sub">
            {courses.length} {courses.length === 1 ? "grupo" : "grupos"} · {totalStudents} estudiantes
          </div>
        </div>
        {onViewAll && (
          <button type="button" className="edc-chip-btn" onClick={onViewAll}>
            Ver todos
          </button>
        )}
      </div>

      <div className="edc-courses__body">
        <div className="edc-courses__caption">
          <span className="edc-courses__eyebrow">Avance de calificación</span>
          {closingLabel && (
            <span className="edc-courses__deadline">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
              Cierre {closingLabel}
            </span>
          )}
        </div>

        {courses.map(course => {
          const progress = Math.min(100, Math.max(0, course.progress));
          const isLow = course.averageGrade < 3;
          return (
            <button
              key={course.id ?? course.name}
              type="button"
              className="edc-course"
              onClick={course.onClick}
            >
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avance de calificación ${course.name}`}
                className="edc-progress"
              >
                <div className="edc-progress__fill" style={{ width: `${progress}%` }} />
                <div className="edc-progress__labels">
                  <span className={`edc-progress__name ${progress >= NAME_ON_FILL_MIN ? "edc-on-fill" : "edc-on-track"}`}>
                    {course.name}
                  </span>
                  <span className={`edc-progress__value ${progress >= VALUE_ON_FILL_MIN ? "edc-on-fill" : "edc-on-track"}`}>
                    {progress}%
                  </span>
                </div>
              </div>
              <div className="edc-course__meta">
                {course.studentCount} estudiantes · Prom.{" "}
                {isLow ? (
                  <span className="edc-course__avg--low">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    {course.averageGrade.toFixed(1)}
                  </span>
                ) : (
                  <span className="edc-course__avg">{course.averageGrade.toFixed(1)}</span>
                )}
              </div>
            </button>
          );
        })}

        {courses.length === 0 && (
          <div className="edc-empty-note">No hay cursos asignados en el periodo actual.</div>
        )}
      </div>
    </section>
  );
}

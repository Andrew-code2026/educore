import { memo } from "react";
import { ArrowRight, Users } from "lucide-react";
import { formatGrade, GRADE_SCALE_MAX, PASSING_GRADE, plural } from "@/analytics/landing";
import type { CourseModel } from "./landing";

const PASSING_PCT = (PASSING_GRADE / GRADE_SCALE_MAX) * 100;

interface CourseAverageListProps {
  courses: CourseModel[];
  onOpen: (course: CourseModel) => void;
}

export const CourseAverageList = memo(function CourseAverageList({ courses, onOpen }: CourseAverageListProps) {
  return (
    <ul aria-label="Promedio por curso" className="rpt-surface rpt-list">
      {courses.map((course) => (
        <CourseRow key={course.key} course={course} onOpen={onOpen} />
      ))}
    </ul>
  );
});

function CourseRow({ course, onOpen }: { course: CourseModel; onOpen: (course: CourseModel) => void }) {
  const average = course.average;

  return (
    <li className="rpt-course">
      <div className="rpt-course__body">
        <div className="rpt-course__title">
          <span className="rpt-group rpt-num">{course.group}</span>
          <span className="rpt-course__name">{plural(course.subjects, "materia", "materias")}</span>
        </div>
        <div className="rpt-course__meta">
          <span className="rpt-meta">
            <Users aria-hidden="true" strokeWidth={1.9} />
            {plural(course.students, "estudiante", "estudiantes")}
          </span>
          {course.lowestSubject && (
            <span>
              Más baja: {course.lowestSubject.name}{" "}
              <span className="rpt-num">{formatGrade(course.lowestSubject.average)}</span>
            </span>
          )}
          {course.belowPassing > 0 && (
            <span className="rpt-flag">
              {course.belowPassing} bajo {formatGrade(PASSING_GRADE)}
            </span>
          )}
        </div>
      </div>

      <div className="rpt-course__stat">
        <span className="rpt-eyebrow rpt-eyebrow--sm">Promedio</span>
        <span className={`rpt-course__avg rpt-num rpt-course__avg--${course.tone}`}>
          {average != null ? formatGrade(average) : "—"}
        </span>
        <div
          className="rpt-scale"
          role="img"
          aria-label={
            average != null
              ? `Promedio ${formatGrade(average)} de ${GRADE_SCALE_MAX}; aprobatoria ${formatGrade(PASSING_GRADE)}`
              : "Sin notas registradas"
          }
        >
          {average != null && (
            <div
              className={`rpt-scale__bar rpt-scale__bar--${course.tone}`}
              style={{ width: `${(average / GRADE_SCALE_MAX) * 100}%` }}
            />
          )}
          <span aria-hidden="true" className="rpt-scale__tick" style={{ left: `${PASSING_PCT}%` }} />
        </div>
      </div>

      <div className="rpt-row-action">
        <button
          type="button"
          className="rpt-btn rpt-btn--outline"
          aria-label={`Abrir las planillas de ${course.group} en Grade Center`}
          onClick={() => onOpen(course)}
        >
          Abrir
          <ArrowRight aria-hidden="true" strokeWidth={1.9} />
        </button>
      </div>
    </li>
  );
}

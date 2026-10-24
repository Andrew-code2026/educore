import { useMemo } from 'react';
import { buildClassroomLanding, type PendingReview } from './courses';
import { LandingHeader } from './LandingHeader';
import { CourseCard } from './CourseCard';
import { PendingReviews } from './PendingReviews';
import { NoCoursesState } from './NoCoursesState';
import './landing.css';

interface ClassroomLandingProps {
  data: any;
  onEnterCourse: (courseId: string) => void;
  onCreateActivity: (courseId: string) => void;
  onReview: (item: PendingReview) => void;
}

/** Portada docente de Classroom: cursos asignados, entregas por revisar y resumen del periodo. */
export function ClassroomLanding({ data, onEnterCourse, onCreateActivity, onReview }: ClassroomLandingProps) {
  // `now` se fija junto con el modelo para que fechas relativas y conteos sean coherentes
  const { model, now } = useMemo(() => {
    const at = new Date();
    return { model: buildClassroomLanding(data, at), now: at };
  }, [data]);
  const hasCourses = model.courses.length > 0;

  return (
    <div className="ccl">
      <div aria-hidden="true" className="ccl__glow ccl__glow--a" />
      <div aria-hidden="true" className="ccl__glow ccl__glow--b" />

      <div className="ccl__content">
        <LandingHeader
          academicYear={model.academicYear}
          period={model.period}
          summary={hasCourses ? model.summary : null}
        />

        {hasCourses ? (
          <>
            <section aria-labelledby="ccl-courses-heading" className="ccl-section">
              <div className="ccl-section__head">
                <h2 id="ccl-courses-heading" className="ccl-section__title">
                  Cursos asignados
                </h2>
              </div>
              <div className="ccl-grid">
                {model.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    now={now}
                    onEnter={onEnterCourse}
                    onCreateActivity={onCreateActivity}
                  />
                ))}
              </div>
            </section>

            <PendingReviews items={model.pending} now={now} onReview={onReview} />
          </>
        ) : (
          <NoCoursesState period={model.period} />
        )}
      </div>
    </div>
  );
}

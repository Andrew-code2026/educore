import { memo } from 'react';
import { ArrowRight, Calendar, ClipboardPlus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDaysIn,
  formatLastSubmission,
  formatShortDay,
  plural,
  type CourseCardModel,
  type CourseCardState,
} from './courses';

const STATUS: Record<CourseCardState, { label: string; tone: 'active' | 'neutral' }> = {
  active: { label: 'Activo', tone: 'active' },
  idle: { label: 'Sin entregas abiertas', tone: 'neutral' },
  empty: { label: 'Sin actividades', tone: 'neutral' },
};

interface CourseCardProps {
  course: CourseCardModel;
  now: Date;
  onEnter: (courseId: string) => void;
  onCreateActivity: (courseId: string) => void;
}

export const CourseCard = memo(function CourseCard({
  course,
  now,
  onEnter,
  onCreateActivity,
}: CourseCardProps) {
  const headingId = `ccl-course-${course.id}`;
  const name = `${course.subject} ${course.group}`;
  const status = STATUS[course.state];
  const isEmpty = course.state === 'empty';

  return (
    <article aria-labelledby={headingId} className="ccl-surface ccl-card">
      <div className="ccl-card__head">
        <span aria-hidden="true" className="ccl-card__group ccl-num">
          {course.group}
        </span>
        <h3 id={headingId} className="ccl-card__title">
          {course.subject}
        </h3>
        <span className={cn('ccl-pill', `ccl-pill--${status.tone}`)}>
          <span aria-hidden="true" className="ccl-pill__dot" />
          {status.label}
        </span>
        <div className="ccl-card__sub">{plural(course.students, 'estudiante', 'estudiantes')}</div>
      </div>

      {isEmpty ? (
        <div className="ccl-card__empty">
          <span aria-hidden="true" className="ccl-card__empty-icon">
            <ClipboardPlus strokeWidth={1.9} />
          </span>
          <span className="ccl-card__empty-title">Aún no hay actividades publicadas</span>
          <span className="ccl-card__empty-note">
            Crea la primera para que tus {plural(course.students, 'estudiante', 'estudiantes')}{' '}
            empiecen a entregar.
          </span>
          <button
            type="button"
            className="ccl-btn ccl-btn--primary ccl-btn--create"
            aria-label={`Crear actividad en ${name}`}
            onClick={() => onCreateActivity(course.id)}
          >
            <Plus aria-hidden="true" strokeWidth={2.2} />
            Crear actividad
          </button>
        </div>
      ) : (
        <ActivityStats course={course} />
      )}

      <div className="ccl-card__foot">
        <span className="ccl-card__meta">
          {isEmpty ? 'Configura el curso y sus recursos' : formatLastSubmission(course.lastSubmissionAt, now)}
        </span>
        <button
          type="button"
          className={cn('ccl-btn', isEmpty ? 'ccl-btn--outline' : 'ccl-btn--dark')}
          aria-label={`Entrar al curso ${name}`}
          onClick={() => onEnter(course.id)}
        >
          Entrar al curso
          <ArrowRight aria-hidden="true" strokeWidth={2} />
        </button>
      </div>
    </article>
  );
});

function ActivityStats({ course }: { course: CourseCardModel }) {
  const { next, toReview } = course;
  const submittedPct = next && course.students > 0
    ? Math.min(100, Math.round((next.submitted / course.students) * 100))
    : 0;

  return (
    <>
      <div className="ccl-card__tiles">
        <div className="ccl-tile">
          <span className="ccl-tile__label">Actividades activas</span>
          <span className="ccl-tile__value ccl-num">{course.open}</span>
          <span className="ccl-tile__note">Abiertas a entregas</span>
        </div>
        <div className={cn('ccl-tile', toReview > 0 && 'ccl-tile--highlight')}>
          <span className="ccl-tile__label">Por revisar</span>
          <span className="ccl-tile__value ccl-num">{toReview}</span>
          <span className="ccl-tile__note">
            {toReview === 0 ? 'Todo revisado' : plural(toReview, 'entrega nueva', 'entregas nuevas')}
          </span>
        </div>
      </div>

      <div className="ccl-next">
        <div className="ccl-next__row">
          <span aria-hidden="true" className="ccl-next__icon">
            <Calendar strokeWidth={1.75} />
          </span>
          <div className="ccl-next__body">
            <span className="ccl-next__label">Próxima entrega</span>
            <span className="ccl-next__title">{next ? next.title : 'Sin entregas programadas'}</span>
          </div>
          {next && (
            <div className="ccl-next__when">
              <span className="ccl-next__date">{formatShortDay(next.dueAt)}</span>
              <span className="ccl-next__in">{formatDaysIn(next.daysLeft)}</span>
            </div>
          )}
        </div>
        {next && (
          <div className="ccl-progress">
            <div className="ccl-progress__head">
              <span>Entregaron</span>
              <span className="ccl-progress__count ccl-num">
                {next.submitted} de {course.students}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={next.submitted}
              aria-valuemin={0}
              aria-valuemax={course.students}
              aria-label={`Entregaron ${next.submitted} de ${course.students} estudiantes`}
              className="ccl-progress__track"
            >
              <div className="ccl-progress__bar" style={{ width: `${submittedPct}%` }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

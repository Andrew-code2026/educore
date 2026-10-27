import { useMemo } from 'react';
import { ArrowRight, CalendarClock, ClipboardCheck, ClipboardList, Plus } from 'lucide-react';
import type { Activity } from '../types';
import { formatDaysIn, plural } from '../landing/courses';
import {
  buildCourseOverview,
  describeDue,
  formatMonthShort,
  formatWeekdayTime,
  type ReviewItem,
  type UpcomingItem,
} from '../course/overview';

interface OverviewViewProps {
  activities: Activity[];
  totalStudents: number;
  onOpenActivity: (activity: Activity) => void;
  onReview: (activity: Activity) => void;
  /** Solo para quien puede gestionar el curso. */
  onNewActivity?: () => void;
}

const UPCOMING_LIMIT = 4;

/** Resumen del curso: lo que espera calificación y las próximas entregas, nada más. */
export function OverviewView({
  activities,
  totalStudents,
  onOpenActivity,
  onReview,
  onNewActivity,
}: OverviewViewProps) {
  // `now` se fija junto con el modelo para que estados y fechas relativas sean coherentes
  const { model, now } = useMemo(() => {
    const at = new Date();
    return { model: buildCourseOverview(activities, at), now: at };
  }, [activities]);

  if (!activities.some((a) => a.status !== 'Borrador')) {
    return (
      <div className="ccw ccw-overview">
        <div className="ccw-surface ccw-empty ccw-empty--page">
          <span aria-hidden="true" className="ccw-empty__icon">
            <ClipboardList strokeWidth={1.75} />
          </span>
          <h2 className="ccw-empty__title">Aún no hay actividades publicadas</h2>
          <p className="ccw-empty__note">
            Publica una actividad con entrega digital y aquí verás lo que tienes por revisar y lo que vence pronto.
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

  const upcoming = model.upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <div className="ccw ccw-overview">
      <section aria-labelledby="ccw-review-heading" className="ccw-section">
        <div className="ccw-section__head">
          <h2 id="ccw-review-heading" className="ccw-section__title">
            Por revisar
          </h2>
          {model.pendingTotal > 0 && <span className="ccw-count ccw-num">{model.pendingTotal}</span>}
        </div>

        {model.toReview.length > 0 ? (
          <ul className="ccw-surface ccw-list">
            {model.toReview.map((item) => (
              <ReviewRow key={item.activity.id} item={item} now={now} onReview={onReview} />
            ))}
          </ul>
        ) : (
          <p className="ccw-surface ccw-quiet">Estás al día. Las nuevas entregas aparecerán aquí.</p>
        )}
      </section>

      <section aria-labelledby="ccw-upcoming-heading" className="ccw-section">
        <div className="ccw-section__head">
          <h2 id="ccw-upcoming-heading" className="ccw-section__title">
            Próximas entregas
          </h2>
          {model.upcoming.length > 0 && <span className="ccw-count ccw-num">{model.upcoming.length}</span>}
        </div>

        {upcoming.length > 0 ? (
          <ul className="ccw-surface ccw-list">
            {upcoming.map((item) => (
              <UpcomingRow
                key={item.activity.id}
                item={item}
                totalStudents={totalStudents}
                onOpen={onOpenActivity}
              />
            ))}
          </ul>
        ) : (
          <div className="ccw-surface ccw-empty">
            <span aria-hidden="true" className="ccw-empty__icon">
              <CalendarClock strokeWidth={1.75} />
            </span>
            <p className="ccw-empty__title">Sin entregas abiertas</p>
            <p className="ccw-empty__note">Ninguna actividad del curso tiene una fecha límite por delante.</p>
            {onNewActivity && (
              <button type="button" className="ccw-btn ccw-btn--outline" onClick={onNewActivity}>
                <Plus aria-hidden="true" strokeWidth={2.25} />
                Nueva actividad
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewRow({
  item,
  now,
  onReview,
}: {
  item: ReviewItem;
  now: Date;
  onReview: (activity: Activity) => void;
}) {
  const due = describeDue(item.dueAt, now);
  return (
    <li className="ccw-row">
      <span aria-hidden="true" className="ccw-row__icon">
        <ClipboardCheck strokeWidth={1.75} />
      </span>
      <div className="ccw-row__body">
        <span className="ccw-row__title">{item.activity.name}</span>
        <span className="ccw-row__detail">
          {plural(item.pending, 'entrega sin calificar', 'entregas sin calificar')}
          {due && ` · ${due}`}
        </span>
      </div>
      <button
        type="button"
        className="ccw-btn ccw-btn--primary ccw-btn--sm"
        aria-label={`Revisar entregas de ${item.activity.name}`}
        onClick={() => onReview(item.activity)}
      >
        Revisar
        <ArrowRight aria-hidden="true" strokeWidth={2} />
      </button>
    </li>
  );
}

function UpcomingRow({
  item,
  totalStudents,
  onOpen,
}: {
  item: UpcomingItem;
  totalStudents: number;
  onOpen: (activity: Activity) => void;
}) {
  const { activity, dueAt, daysLeft } = item;
  const progress = totalStudents > 0 ? Math.min(100, Math.round((activity.submissions / totalStudents) * 100)) : 0;
  const soon = daysLeft <= 1;

  return (
    <li>
      <button type="button" className="ccw-row ccw-row--link" onClick={() => onOpen(activity)}>
        <span className="ccw-date">
          <span className="ccw-date__day ccw-num">{dueAt.getDate()}</span>
          <span className="ccw-date__month">{formatMonthShort(dueAt)}</span>
        </span>
        <span className="ccw-row__body">
          <span className="ccw-row__title">{activity.name}</span>
          <span className="ccw-row__detail">
            {formatWeekdayTime(dueAt)}
          </span>
        </span>
        <span className="ccw-row__aside">
          <span className={soon ? 'ccw-when ccw-when--soon' : 'ccw-when'}>{formatDaysIn(daysLeft)}</span>
          {totalStudents > 0 && (
            <span className="ccw-meter">
              <span className="ccw-meter__track" aria-hidden="true">
                <span className="ccw-meter__bar" style={{ width: `${progress}%` }} />
              </span>
              <span className="ccw-meter__label ccw-num">
                {activity.submissions}/{totalStudents}
                <span className="ccw-sr"> estudiantes entregaron</span>
              </span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

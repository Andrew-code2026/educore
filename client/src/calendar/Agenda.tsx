import { memo } from "react";
import { CalendarCheck2, CalendarPlus, Clock, MapPin, Users } from "lucide-react";
import {
  daysBetween,
  formatLongDay,
  formatRelativeDays,
  formatShortMonth,
  KIND_LABEL,
  parseDayKey,
  UPCOMING_WINDOW_DAYS,
  type CalendarEvent,
} from "./calendar";

interface DayAgendaProps {
  dayKey: string;
  events: CalendarEvent[];
  now: Date;
  /** Solo para roles que pueden crear eventos. */
  onCreate?: (dayKey: string) => void;
}

/** Detalle del día seleccionado en la cuadrícula. */
export function DayAgenda({ dayKey, events, now, onCreate }: DayAgendaProps) {
  const date = parseDayKey(dayKey);

  return (
    <section aria-labelledby="cal-day-heading" className="cal-surface cal-panel">
      <div className="cal-panel__head">
        <span className="cal-eyebrow cal-eyebrow--sm">{formatRelativeDays(daysBetween(now, date))}</span>
        <h2 id="cal-day-heading" className="cal-panel__title" aria-live="polite">
          {formatLongDay(date)}
        </h2>
      </div>

      {events.length > 0 ? (
        <ul aria-label="Eventos del día" className="cal-agenda">
          {events.map((event) => (
            <AgendaItem key={event.id} event={event} />
          ))}
        </ul>
      ) : (
        <div className="cal-panel__empty">
          <p>No hay eventos programados para este día.</p>
          {onCreate && (
            <button type="button" className="cal-btn cal-btn--outline" onClick={() => onCreate(dayKey)}>
              <CalendarPlus aria-hidden="true" strokeWidth={1.9} />
              Programar evento
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AgendaItem({ event }: { event: CalendarEvent }) {
  return (
    <li className={`cal-agenda__item cal-agenda__item--${event.kind}`}>
      <div className="cal-agenda__top">
        <span className="cal-meta cal-num">
          <Clock aria-hidden="true" strokeWidth={1.9} />
          {event.time}
        </span>
        <span className={`cal-pill cal-pill--${event.kind}`}>{KIND_LABEL[event.kind]}</span>
      </div>
      <span className="cal-agenda__title">{event.title}</span>
      {(event.location || event.audience) && (
        <div className="cal-agenda__meta">
          {event.location && (
            <span className="cal-meta">
              <MapPin aria-hidden="true" strokeWidth={1.9} />
              {event.location}
            </span>
          )}
          {event.audience && (
            <span className="cal-meta">
              <Users aria-hidden="true" strokeWidth={1.9} />
              {event.audience}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

interface UpcomingListProps {
  events: CalendarEvent[];
  now: Date;
  selectedKey: string;
  onSelect: (event: CalendarEvent) => void;
}

/** Próximos eventos; al elegir uno, la cuadrícula salta a su día. */
export const UpcomingList = memo(function UpcomingList({ events, now, selectedKey, onSelect }: UpcomingListProps) {
  return (
    <section aria-labelledby="cal-upcoming-heading" className="cal-surface cal-panel">
      <div className="cal-panel__head cal-panel__head--row">
        <h2 id="cal-upcoming-heading" className="cal-panel__title">
          Próximos eventos
        </h2>
        <span className="cal-panel__hint">{UPCOMING_WINDOW_DAYS} días</span>
      </div>

      {events.length > 0 ? (
        <ul className="cal-upcoming">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="cal-upcoming__item"
                aria-current={event.dayKey === selectedKey ? "date" : undefined}
                aria-label={`${event.title}, ${formatLongDay(event.date)} a las ${event.time}. Ver en el calendario`}
                onClick={() => onSelect(event)}
              >
                <span aria-hidden="true" className={`cal-badge cal-badge--${event.kind}`}>
                  <span className="cal-badge__month">{formatShortMonth(event.date)}</span>
                  <span className="cal-badge__day cal-num">{event.date.getDate()}</span>
                </span>
                <span aria-hidden="true" className="cal-upcoming__body">
                  <span className="cal-upcoming__title">{event.title}</span>
                  <span className="cal-upcoming__meta">
                    {KIND_LABEL[event.kind]}
                    <span className="cal-sep">·</span>
                    {formatRelativeDays(daysBetween(now, event.date))}
                    {event.location && (
                      <>
                        <span className="cal-sep">·</span>
                        {event.location}
                      </>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="cal-panel__empty cal-panel__empty--row">
          <span aria-hidden="true" className="cal-empty-icon">
            <CalendarCheck2 strokeWidth={1.9} />
          </span>
          <p>No hay eventos en los próximos {UPCOMING_WINDOW_DAYS} días.</p>
        </div>
      )}
    </section>
  );
});

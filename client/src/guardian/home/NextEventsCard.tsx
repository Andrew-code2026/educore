import { CalendarDays } from "lucide-react";
import { dateBadge } from "@/student/format";
import type { EventItem } from "./home";

interface NextEventsCardProps {
  items: EventItem[];
  /** Los eventos del hijo recién elegido aún no llegan. */
  loading: boolean;
  onOpenCalendar: () => void;
}

/** Próximos eventos del curso: los tres siguientes; el detalle está en Calendario. */
export function NextEventsCard({ items, loading, onOpenCalendar }: NextEventsCardProps) {
  return (
    <section aria-labelledby="h-eventos" className="edc-card gdn-events">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <CalendarDays aria-hidden="true" strokeWidth={1.9} />
        </span>
        <h2 id="h-eventos" className="edc-card__title">
          Próximos eventos
        </h2>
        <button type="button" className="edc-chip-btn" onClick={onOpenCalendar}>
          Ver calendario
        </button>
      </div>

      {loading ? (
        <div className="edc-empty-note gdn-events__empty" aria-busy="true">
          Cargando eventos…
        </div>
      ) : items.length ? (
        <ul className="gdn-events__list">
          {items.map(event => {
            const badge = dateBadge(event.date);
            return (
              <li key={event.id} className="gdn-events__item">
                <span className="gdn-events__date" aria-hidden="true">
                  <span className="gdn-events__month">{badge.month}</span>
                  <span className="gdn-events__day">{badge.day}</span>
                </span>
                <span className="gdn-events__body">
                  <span className="gdn-events__title">{event.title}</span>
                  <span className="gdn-events__when">{event.when}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="edc-empty-note gdn-events__empty">No hay eventos próximos.</div>
      )}
    </section>
  );
}

import { CalendarDays } from "lucide-react";
import { dateBadge } from "@/student/format";
import type { HomeEventItem } from "./types";

interface HomeEventsCardProps {
  items: HomeEventItem[];
  /** Los eventos aún no llegan (p. ej. el acudiente acaba de cambiar de hijo). */
  loading?: boolean;
  onOpenCalendar: () => void;
}

/** Próximos eventos del curso: los siguientes tres; el detalle está en Calendario. */
export function HomeEventsCard({ items, loading = false, onOpenCalendar }: HomeEventsCardProps) {
  return (
    <section aria-labelledby="h-eventos" className="edc-card edc-events">
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
        <div className="edc-empty-note edc-events__empty" aria-busy="true">
          Cargando eventos…
        </div>
      ) : items.length ? (
        <ul className="edc-events__list">
          {items.map(event => {
            const badge = dateBadge(event.date);
            return (
              <li key={event.id} className="edc-events__item">
                <span className="edc-events__date" aria-hidden="true">
                  <span className="edc-events__month">{badge.month}</span>
                  <span className="edc-events__day">{badge.day}</span>
                </span>
                <span className="edc-events__body">
                  <span className="edc-events__title">{event.title}</span>
                  <span className="edc-events__when">{event.when}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="edc-empty-note edc-events__empty">No hay eventos próximos.</div>
      )}
    </section>
  );
}

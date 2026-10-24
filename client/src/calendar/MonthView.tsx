import { memo, useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDays,
  CELL_EVENT_LIMIT,
  EVENT_TYPES,
  formatLongDay,
  formatMonthTitle,
  parseDayKey,
  plural,
  toDayKey,
  WEEKDAYS,
  type CalendarEvent,
  type DayCell,
  type YearMonth,
} from "./calendar";

interface MonthViewProps {
  visibleMonth: YearMonth;
  weeks: DayCell[][];
  eventsByDay: Map<string, CalendarEvent[]>;
  selectedKey: string;
  isShowingToday: boolean;
  onSelect: (key: string) => void;
  onChangeMonth: (delta: number) => void;
  onToday: () => void;
}

/** Desplazamiento en días de cada tecla de la cuadrícula (patrón APG de selector de fechas). */
const KEY_OFFSETS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function MonthView({
  visibleMonth,
  weeks,
  eventsByDay,
  selectedKey,
  isShowingToday,
  onSelect,
  onChangeMonth,
  onToday,
}: MonthViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const focusAfterRender = useRef(false);

  // Tras moverse con el teclado (incluso a otro mes) el foco sigue al día seleccionado.
  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${selectedKey}"]`)?.focus();
  }, [selectedKey, weeks]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = parseDayKey(selectedKey);
    const weekday = (current.getDay() + 6) % 7;
    let next: Date | null = null;

    if (event.key in KEY_OFFSETS) next = addDays(current, KEY_OFFSETS[event.key]!);
    else if (event.key === "Home") next = addDays(current, -weekday);
    else if (event.key === "End") next = addDays(current, 6 - weekday);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const delta = event.key === "PageUp" ? -1 : 1;
      next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      // Conserva el día si existe en el mes destino (31 → 30)
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(current.getDate(), lastDay));
    }

    if (!next) return;
    event.preventDefault();
    focusAfterRender.current = true;
    onSelect(toDayKey(next));
  };

  return (
    <section aria-labelledby="cal-month-heading" className="cal-surface cal-month">
      <div className="cal-month__head">
        <h2 id="cal-month-heading" className="cal-month__title" aria-live="polite">
          {formatMonthTitle(visibleMonth)}
        </h2>
        <div className="cal-month__nav">
          <button
            type="button"
            className="cal-btn cal-btn--outline cal-btn--today"
            disabled={isShowingToday}
            onClick={onToday}
          >
            Hoy
          </button>
          <div role="group" aria-label="Cambiar de mes" className="cal-stepper">
            <button type="button" className="cal-icon-btn" aria-label="Mes anterior" onClick={() => onChangeMonth(-1)}>
              <ChevronLeft aria-hidden="true" strokeWidth={2} />
            </button>
            <button type="button" className="cal-icon-btn" aria-label="Mes siguiente" onClick={() => onChangeMonth(1)}>
              <ChevronRight aria-hidden="true" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby="cal-month-heading"
        aria-describedby="cal-grid-help"
        className="cal-grid"
        onKeyDown={handleKeyDown}
      >
        <div role="row" className="cal-grid__row cal-grid__row--head">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday.long} role="columnheader" aria-label={weekday.long} className="cal-grid__weekday">
              <span aria-hidden="true">{weekday.short}</span>
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.key} role="row" className="cal-grid__row">
            {week.map((cell) => (
              <DayCellView
                key={cell.key}
                cell={cell}
                events={eventsByDay.get(cell.key)}
                selected={cell.key === selectedKey}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
      <p id="cal-grid-help" className="cal-sr-only">
        Usa las flechas para moverte entre días y Re Pág o Av Pág para cambiar de mes.
      </p>

      <ul aria-label="Tipos de evento" className="cal-legend">
        {EVENT_TYPES.map(({ kind, label }) => (
          <li key={kind} className="cal-legend__item">
            <span aria-hidden="true" className={`cal-dot cal-dot--${kind}`} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DayCellViewProps {
  cell: DayCell;
  events: CalendarEvent[] | undefined;
  selected: boolean;
  onSelect: (key: string) => void;
}

const DayCellView = memo(function DayCellView({ cell, events = [], selected, onSelect }: DayCellViewProps) {
  const visible = events.slice(0, CELL_EVENT_LIMIT);
  const hidden = events.length - visible.length;
  const label = [
    formatLongDay(parseDayKey(cell.key)),
    cell.isToday && "hoy",
    events.length > 0
      ? `${plural(events.length, "evento", "eventos")}: ${events.map((e) => e.title).join(", ")}`
      : "sin eventos",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="gridcell"
      data-day={cell.key}
      tabIndex={selected ? 0 : -1}
      aria-selected={selected}
      aria-current={cell.isToday ? "date" : undefined}
      aria-label={label}
      className={cn(
        "cal-day",
        !cell.inMonth && "cal-day--outside",
        cell.isWeekend && "cal-day--weekend",
        cell.isToday && "cal-day--today",
        selected && "is-selected",
      )}
      onClick={() => onSelect(cell.key)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(cell.key);
        }
      }}
    >
      <span aria-hidden="true" className="cal-day__num cal-num">
        {cell.day}
      </span>
      {events.length > 0 && (
        <span aria-hidden="true" className="cal-day__events">
          {visible.map((event) => (
            <span key={event.id} className={`cal-chip cal-chip--${event.kind}`}>
              {event.title}
            </span>
          ))}
          {hidden > 0 && <span className="cal-day__more">+{hidden} más</span>}
        </span>
      )}
      {events.length > 0 && (
        <span aria-hidden="true" className="cal-day__dots">
          {events.slice(0, 3).map((event) => (
            <span key={event.id} className={`cal-dot cal-dot--${event.kind}`} />
          ))}
        </span>
      )}
    </div>
  );
});

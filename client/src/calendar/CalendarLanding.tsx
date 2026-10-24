import { useCallback, useMemo, useRef, useState } from "react";
import {
  addMonths,
  buildMonthGrid,
  groupByDay,
  parseDayKey,
  summarizeUpcoming,
  toDayKey,
  upcomingEvents,
  UPCOMING_LIMIT,
  yearMonthOf,
  type CalendarEvent,
  type EventDraft,
  type YearMonth,
} from "./calendar";
import { LandingHeader } from "./LandingHeader";
import { MonthView } from "./MonthView";
import { DayAgenda, UpcomingList } from "./Agenda";
import { NewEventDialog } from "./NewEventDialog";
import "./calendar.css";

interface CalendarLandingProps {
  events: CalendarEvent[];
  now: Date;
  academicYear: string;
  period: string | null;
  lede: string;
  /** Presente solo para roles que pueden crear eventos. Devuelve cuando el evento quedó guardado. */
  onCreateEvent?: (draft: EventDraft) => Promise<void>;
}

const sameMonth = (a: YearMonth, b: YearMonth) => a.year === b.year && a.month === b.month;

/** Calendario institucional: mes navegable, agenda del día y próximos eventos. */
export function CalendarLanding({ events, now, academicYear, period, lede, onCreateEvent }: CalendarLandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const todayKey = toDayKey(now);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState<YearMonth>(() => yearMonthOf(now));
  const [dialogDay, setDialogDay] = useState<string | null>(null);

  const eventsByDay = useMemo(() => groupByDay(events), [events]);
  const weeks = useMemo(() => buildMonthGrid(visibleMonth, now), [visibleMonth, now]);
  const summary = useMemo(() => summarizeUpcoming(events, now), [events, now]);
  const upcoming = useMemo(() => upcomingEvents(events, now).slice(0, UPCOMING_LIMIT), [events, now]);

  /** Selecciona un día y, si cae fuera del mes visible, lleva la cuadrícula hasta él. */
  const selectDay = useCallback((key: string) => {
    setSelectedKey(key);
    const target = yearMonthOf(parseDayKey(key));
    setVisibleMonth((current) => (sameMonth(current, target) ? current : target));
  }, []);

  const changeMonth = useCallback(
    (delta: number) => {
      const target = addMonths(visibleMonth, delta);
      setVisibleMonth(target);
      // La agenda acompaña al mes: hoy si cae en él, si no el día 1
      const today = parseDayKey(todayKey);
      setSelectedKey(toDayKey(sameMonth(target, yearMonthOf(today)) ? today : new Date(target.year, target.month, 1)));
    },
    [visibleMonth, todayKey],
  );

  const goToToday = useCallback(() => selectDay(todayKey), [selectDay, todayKey]);
  const selectEvent = useCallback((event: CalendarEvent) => selectDay(event.dayKey), [selectDay]);
  const openDialog = useCallback((day: string) => setDialogDay(day), []);

  const handleSubmit = useCallback(
    async (draft: EventDraft) => {
      await onCreateEvent?.(draft);
      setDialogDay(null);
      selectDay(draft.day);
    },
    [onCreateEvent, selectDay],
  );

  const canCreate = Boolean(onCreateEvent);

  return (
    <div ref={rootRef} className="cal">
      <div aria-hidden="true" className="cal__glow cal__glow--a" />
      <div aria-hidden="true" className="cal__glow cal__glow--b" />

      <div className="cal__content">
        <LandingHeader
          academicYear={academicYear}
          period={period}
          lede={lede}
          summary={summary}
          onCreate={canCreate ? () => openDialog(selectedKey) : undefined}
        />

        <div className="cal-layout">
          <MonthView
            visibleMonth={visibleMonth}
            weeks={weeks}
            eventsByDay={eventsByDay}
            selectedKey={selectedKey}
            isShowingToday={selectedKey === todayKey}
            onSelect={selectDay}
            onChangeMonth={changeMonth}
            onToday={goToToday}
          />

          <div className="cal-side">
            <DayAgenda
              dayKey={selectedKey}
              events={eventsByDay.get(selectedKey) ?? []}
              now={now}
              onCreate={canCreate ? openDialog : undefined}
            />
            <UpcomingList events={upcoming} now={now} selectedKey={selectedKey} onSelect={selectEvent} />
          </div>
        </div>
      </div>

      {canCreate && (
        <NewEventDialog
          initialDay={dialogDay}
          container={rootRef.current?.closest<HTMLElement>(".edc-shell") ?? null}
          onClose={() => setDialogDay(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

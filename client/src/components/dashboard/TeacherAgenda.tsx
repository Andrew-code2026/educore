import React, { useMemo, useState } from "react";
import type { TeacherAgendaItem } from "./types";

interface TeacherAgendaProps {
  todayItems: TeacherAgendaItem[];
  upcomingItems: TeacherAgendaItem[];
  onOpenCalendar: () => void;
  onNewActivity?: () => void;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAY_BY_JS_DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Lunes a domingo de la semana actual desplazada `weekOffset` semanas. */
function buildWeek(weekOffset: number) {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

const ArrowRight = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export function TeacherAgenda({
  todayItems,
  upcomingItems,
  onOpenCalendar,
  onNewActivity,
}: TeacherAgendaProps) {
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");
  const [weekOffset, setWeekOffset] = useState(0);

  const week = useMemo(() => buildWeek(weekOffset), [weekOffset]);
  const today = new Date();
  const monthAnchor = weekOffset === 0 ? today : week[3];
  const monthLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" })
    .format(monthAnchor)
    .replace(" de ", " ");
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <section aria-label="Mi jornada" className="edc-card edc-day">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
        </span>
        <div className="edc-card__heading">
          <h2 className="edc-card__title">Mi jornada</h2>
          <div className="edc-card__sub">{monthTitle}</div>
        </div>
        <div className="edc-day__nav">
          <button type="button" className="edc-circle-btn" aria-label="Semana anterior" onClick={() => setWeekOffset(w => w - 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="edc-circle-btn" aria-label="Semana siguiente" onClick={() => setWeekOffset(w => w + 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="edc-week">
        {week.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isSunday = i === 6;
          return (
            <div
              key={day.toISOString()}
              className={`edc-week__day${isToday ? " edc-week__day--today" : ""}${isSunday && !isToday ? " edc-week__day--weekend" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              <span className="edc-week__name">{WEEKDAYS[i]}</span>
              <span className="edc-week__num">{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div role="tablist" aria-label="Agenda" className="edc-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "today"}
          className="edc-tab"
          onClick={() => setActiveTab("today")}
        >
          Hoy<span className="edc-tab__count">{todayItems.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          className="edc-tab"
          onClick={() => setActiveTab("upcoming")}
        >
          Próximos<span className="edc-tab__count">{upcomingItems.length}</span>
        </button>
      </div>

      {activeTab === "today" ? (
        <div className="edc-day__list">
          {todayItems.map(item => (
            <button key={item.id} type="button" className="edc-event" onClick={item.onClick}>
              <div className="edc-event__title">{item.title}</div>
              {item.subtitle && <div className="edc-event__sub">{item.subtitle}</div>}
              <div className="edc-event__foot">
                {item.tag ? <span className="edc-event__tag">{item.tag}</span> : <span />}
                <span className="edc-event__time">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {item.timeOrDate}
                </span>
              </div>
            </button>
          ))}
          {todayItems.length === 0 && <div className="edc-empty-note">No tienes clases programadas hoy.</div>}
        </div>
      ) : (
        <div className="edc-day__list edc-day__list--compact">
          {upcomingItems.map(item => {
            const date = item.date ? new Date(item.date) : null;
            return (
              <button
                key={item.id}
                type="button"
                className={`edc-upcoming${item.highlight ? " edc-upcoming--highlight" : ""}`}
                onClick={item.onClick}
              >
                <div className="edc-upcoming__date">
                  <span className="edc-upcoming__wd">{date ? WEEKDAY_BY_JS_DAY[date.getDay()] : "Próx."}</span>
                  <span className="edc-upcoming__num">{date ? date.getDate() : "—"}</span>
                </div>
                <div className="edc-upcoming__text">
                  <div className="edc-upcoming__title">{item.title}</div>
                  <div className="edc-upcoming__meta">
                    {[item.timeOrDate, item.subtitle].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            );
          })}
          {upcomingItems.length === 0 && <div className="edc-empty-note">No hay eventos próximos en tu agenda.</div>}
        </div>
      )}

      <button type="button" className="edc-link-btn" onClick={onOpenCalendar}>
        Ver calendario completo
        <ArrowRight />
      </button>

      {onNewActivity && (
        <button type="button" className="edc-primary-btn" onClick={onNewActivity}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Nueva actividad
        </button>
      )}
    </section>
  );
}

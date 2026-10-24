import React from "react";
import type { TeacherPriorityItem } from "./types";

interface TeacherPrioritySectionProps {
  items: TeacherPriorityItem[];
}

function PriorityIcon({ id }: { id: string }) {
  if (id.includes("attendance")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <rect width="8" height="4" x="8" y="2" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    );
  }
  if (id.includes("pending")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

/** "Por hacer": pendientes accionables del día. */
export function TeacherPrioritySection({ items }: TeacherPrioritySectionProps) {
  const hasItems = items.length > 0;

  return (
    <section aria-labelledby="h-todo" className="edc-card edc-todo">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <h2 id="h-todo" className="edc-card__title">Por hacer</h2>
        {hasItems && (
          <>
            <span className="edc-count">{items.length}</span>
            <span className="edc-todo__hint">pendientes para hoy</span>
          </>
        )}
      </div>

      {hasItems ? (
        <ul className="edc-todo__list">
          {items.map(item => (
            <li key={item.id} className="edc-todo__item">
              <div className="edc-todo__row">
                <span className="edc-todo__icon">
                  <PriorityIcon id={item.id} />
                </span>
                <div className="edc-todo__text">
                  <div className="edc-todo__title">{item.title}</div>
                  <div className="edc-todo__context">{item.context}</div>
                </div>
              </div>
              <button type="button" className="edc-dark-btn" onClick={item.onAction}>
                {item.actionLabel}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="edc-todo__done">
          <span className="edc-todo__done-icon">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div>
            <div className="edc-todo__done-title">Estás al día</div>
            <div className="edc-todo__done-text">No tienes asistencia, entregas ni seguimientos pendientes.</div>
          </div>
        </div>
      )}
    </section>
  );
}

import React from "react";
import type { TeacherNextClassItem } from "./types";

interface TeacherNextClassProps {
  item: TeacherNextClassItem;
  onOpen: () => void;
}

export function TeacherNextClass({ item, onOpen }: TeacherNextClassProps) {
  return (
    <section aria-label="Próxima clase" className="edc-next">
      <div aria-hidden="true" className="edc-next__art edc-next__art--1" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--2" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--3" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--4" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--5" />

      <div className="edc-next__glass">
        <div className="edc-next__eyebrow">
          <span className="edc-next__pulse" />
          Próxima clase
          <span className="edc-next__time">{item.timeRange}</span>
        </div>
        <div className="edc-next__title">{item.title}</div>
        <div className="edc-next__meta">
          {item.course}
          {item.room ? ` · ${item.room}` : ""}
        </div>
        <button type="button" className="edc-next__cta" onClick={onOpen}>
          Abrir clase
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

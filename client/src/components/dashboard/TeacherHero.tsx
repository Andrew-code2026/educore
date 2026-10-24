import React from "react";

interface TeacherHeroProps {
  teacherName: string;
  activePeriodName?: string;
}

export function TeacherHero({
  teacherName,
  activePeriodName = "Periodo 2",
}: TeacherHeroProps) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Buenos días"
      : currentHour < 19
        ? "Buenas tardes"
        : "Buenas noches";

  const todayFormatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const capitalizedDate =
    todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <header data-testid="teacher-hero" className="edc-greeting">
      <div className="edc-date-chip">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
        {capitalizedDate}
        <span className="edc-date-chip__dot">·</span>
        <span className="edc-date-chip__period">{activePeriodName}</span>
      </div>
      <h1 className="edc-greeting__title">
        <span className="edc-greeting__muted">{greeting},</span> {teacherName}
      </h1>
    </header>
  );
}

import React from "react";
import { Calendar } from "lucide-react";

interface TeacherHeroProps {
  teacherName: string;
  schoolName?: string;
  activePeriodName?: string;
  summaryText?: string;
  pendingGradesCount?: number;
  onOpenGradeCenter?: () => void;
  onOpenCalendar?: () => void;
  onOpenClassroom?: () => void;
}

export function TeacherHero({
  teacherName,
  schoolName,
  activePeriodName = "Periodo 2",
  summaryText,
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
    <section
      data-testid="teacher-hero"
      className="teacher-hero relative overflow-hidden rounded-[24px] border border-blue-100/80 dark:border-blue-900/30 bg-gradient-to-br from-[#eef5ff] via-[#e5efff] to-[#dbe8ff] dark:from-[#111c2e] dark:via-[#0e1726] dark:to-[#0a111d] p-5 sm:p-6 shadow-[0_12px_32px_rgba(69,105,180,0.08)] dark:shadow-none"
    >
      <div className="teacher-glow pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="relative z-10">
        {/* Fecha y Periodo */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-xs">
          <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{capitalizedDate}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="font-semibold text-blue-700 dark:text-blue-400">{activePeriodName}</span>
        </div>

        {/* Saludo dinámico según la hora del día */}
        <h1 className="mt-3.5 text-2xl font-extrabold tracking-[-0.03em] text-[#172554] dark:text-white sm:text-3xl">
          {greeting}, {teacherName}
        </h1>

        {/* Pulso resumido de la jornada */}
        {summaryText ? (
          <p
            className="mt-1.5 text-xs sm:text-sm text-[#52668f] dark:text-slate-400 leading-relaxed max-w-3xl"
            dangerouslySetInnerHTML={{ __html: summaryText }}
          />
        ) : null}
      </div>
    </section>
  );
}

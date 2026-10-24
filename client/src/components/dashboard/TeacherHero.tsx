import React from "react";
import { Calendar, Plus } from "lucide-react";

export interface TeacherHeroAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TeacherHeroProps {
  teacherName: string;
  activePeriodName?: string;
  summaryText?: string;
  action?: TeacherHeroAction;
}

export function TeacherHero({
  teacherName,
  activePeriodName = "Periodo 2",
  summaryText,
  action,
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

  const ActionIcon = action?.icon ?? Plus;

  return (
    <section
      data-testid="teacher-hero"
      className="relative overflow-hidden rounded-2xl border border-blue-100/90 dark:border-blue-900/40 bg-gradient-to-br from-[#eef5ff] via-[#e6f0ff] to-[#dce9ff] dark:from-[#121e31] dark:via-[#0f192a] dark:to-[#0c1422] px-5 py-3.5 sm:px-6 sm:py-4 shadow-[0_6px_20px_rgba(37,99,235,0.06)] dark:shadow-none"
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-blue-400/15 dark:bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Lado izquierdo: Contexto temporal, saludo y pulso del día */}
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{capitalizedDate}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {activePeriodName}
            </span>
          </div>

          <h1 className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-[#172554] dark:text-white sm:text-2xl">
            {greeting}, {teacherName}
          </h1>

          {summaryText && (
            <p className="mt-0.5 text-xs text-[#475b82] dark:text-slate-300 leading-relaxed max-w-2xl">
              {summaryText}
            </p>
          )}
        </div>

        {/* Lado derecho: Acción rápida de creación (sin duplicar las alertas de calificación) */}
        {action && (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 shadow-2xs transition hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-slate-700 active:scale-[0.99]"
            >
              <ActionIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{action.label}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

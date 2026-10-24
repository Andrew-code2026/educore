import React, { useState, useMemo } from "react";
import { Calendar, ArrowRight } from "lucide-react";
import type { TeacherAgendaItem } from "./types";

interface TeacherAgendaProps {
  todayItems: TeacherAgendaItem[];
  upcomingItems: TeacherAgendaItem[];
  onOpenCalendar: () => void;
}

const TAG_TONE_STYLES = {
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export function TeacherAgenda({
  todayItems,
  upcomingItems,
  onOpenCalendar,
}: TeacherAgendaProps) {
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");

  const todayNum = useMemo(
    () => String(new Date().getDate()).padStart(2, "0"),
    []
  );

  const displayedItems = activeTab === "today" ? todayItems : upcomingItems;

  return (
    <section
      aria-label="Mi jornada"
      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131f30] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] dark:shadow-none sm:p-4"
    >
      <div>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400 shrink-0">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Mi jornada
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-400">
                Clases programadas y agenda institucional
              </p>
            </div>
          </div>

          {/* Selector claro y funcional: Hoy vs Próximos */}
          <div
            role="tablist"
            aria-label="Filtro de jornada"
            className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "today"}
              onClick={() => setActiveTab("today")}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                activeTab === "today"
                  ? "bg-white dark:bg-[#1b2b42] text-blue-700 dark:text-blue-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Hoy <span className="ml-0.5 opacity-75">{todayNum}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "upcoming"}
              onClick={() => setActiveTab("upcoming")}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                activeTab === "upcoming"
                  ? "bg-white dark:bg-[#1b2b42] text-blue-700 dark:text-blue-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Próximos
              {upcomingItems.length > 0 && (
                <span className="ml-1 rounded-full bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.2 text-[10px]">
                  {upcomingItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Agenda Items List */}
        <div className="space-y-2">
          {displayedItems.map((item) => {
            const tagToneClass =
              TAG_TONE_STYLES[
                (item.tagTone as keyof typeof TAG_TONE_STYLES) || "info"
              ] || TAG_TONE_STYLES.info;

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 text-left transition-all hover:border-blue-200 dark:hover:border-blue-900/70 hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-2xs"
              >
                <span className="whitespace-nowrap rounded-md border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  {item.timeOrDate}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </span>
                  )}
                </span>
                {item.tag && (
                  <span
                    className={`hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold shrink-0 ${tagToneClass}`}
                  >
                    {item.tag}
                  </span>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
              </button>
            );
          })}

          {displayedItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 py-5 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No hay actividades programadas en esta vista.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer calendar button pinned to bottom */}
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <button
          type="button"
          onClick={onOpenCalendar}
          className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          <span>Ver calendario completo</span>
          <ArrowRight className="inline h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

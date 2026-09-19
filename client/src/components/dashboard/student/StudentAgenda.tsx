import React, { useState } from "react";
import {
  CalendarDays,
  Clock3,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StudentAgendaItem } from "./types";

interface StudentAgendaProps {
  todayItems: StudentAgendaItem[];
  upcomingItems: StudentAgendaItem[];
  onOpenCalendar: () => void;
}

export function StudentAgenda({
  todayItems,
  upcomingItems,
  onOpenCalendar,
}: StudentAgendaProps) {
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");

  const displayedItems = activeTab === "today" ? todayItems : upcomingItems;

  return (
    <section
      aria-label="Mi jornada"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Mi jornada
              </h2>
              {todayItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-semibold py-0 px-2"
                >
                  {todayItems.length} {todayItems.length === 1 ? "actividad" : "actividades"}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Eventos institucionales y fechas clave para ti.
            </p>
          </div>
        </div>

        {/* Tab switcher + Calendar link */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                activeTab === "today"
                  ? "bg-white font-semibold text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hoy ({todayItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                activeTab === "upcoming"
                  ? "bg-white font-semibold text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Próximamente ({upcomingItems.length})
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCalendar}
            className="hidden md:inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition ml-1"
          >
            <span>Ver calendario</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content list */}
      {displayedItems.length > 0 ? (
        <div className="space-y-2">
          {displayedItems.map((item) => (
            <div
              key={item.id}
              onClick={item.onClick}
              className={[
                "group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                "rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-all",
                item.onClick
                  ? "cursor-pointer hover:border-blue-200 hover:bg-blue-50/30"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {/* Time or date badge */}
                <div className="w-20 shrink-0">
                  <span className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs">
                    <Clock3 className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{item.timeOrDate}</span>
                  </span>
                </div>

                {/* Title & context */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-900">
                      {item.title}
                    </p>
                    {item.tag && (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                          item.tagTone === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : item.tagTone === "danger"
                              ? "bg-rose-100 text-rose-800"
                              : item.tagTone === "success"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </div>

                  {item.subtitle && (
                    <p className="truncate text-[11px] text-slate-500 mt-0.5">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Action indicator */}
              {item.onClick && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-blue-700 self-end sm:self-center shrink-0">
                  <span className="hidden lg:inline">Ver detalle</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Compact Adaptive Empty State */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">
                {activeTab === "today" ? "Todo al día por ahora" : "Sin eventos próximos"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {activeTab === "today"
                  ? "No tienes eventos institucionales ni actividades fijadas para hoy."
                  : "No hay eventos registrados en el calendario para los próximos días."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCalendar}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700 transition"
          >
            <span>Consultar calendario</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </section>
  );
}

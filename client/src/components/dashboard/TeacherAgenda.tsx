import React, { useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileText,
  Building2,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TeacherAgendaItem } from "./types";

interface TeacherAgendaProps {
  todayItems: TeacherAgendaItem[];
  upcomingItems: TeacherAgendaItem[];
  onOpenCalendar: () => void;
}

export function TeacherAgenda({
  todayItems,
  upcomingItems,
  onOpenCalendar,
}: TeacherAgendaProps) {
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");

  const displayedItems = activeTab === "today" ? todayItems : upcomingItems;

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Mi jornada
              </h2>
              {todayItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-semibold"
                >
                  {todayItems.length} {todayItems.length === 1 ? "actividad hoy" : "actividades hoy"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Eventos institucionales y entregas programadas.
            </p>
          </div>
        </div>

        {/* Tab switcher + Link */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100/90 p-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "today"
                  ? "bg-white font-semibold text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hoy ({todayItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "upcoming"
                  ? "bg-white font-semibold text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Próximamente ({upcomingItems.length})
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCalendar}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 ml-2"
          >
            <span>Ver calendario</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content list */}
      {displayedItems.length > 0 ? (
        <div className="space-y-2.5">
          {displayedItems.map((item) => {
            const isEvent = item.type === "event";

            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className={[
                  "group flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                  "rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 sm:p-4 transition-all",
                  item.onClick
                    ? "cursor-pointer hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-xs"
                    : "",
                ].join(" ")}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {/* Time badge */}
                  <div className="w-[84px] shrink-0">
                    <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs">
                      <Clock3 className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.timeOrDate}</span>
                    </span>
                  </div>

                  {/* Title & context */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-900">
                        {item.title}
                      </p>
                      {item.tag && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right action indicator */}
                {item.onClick && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-blue-700 sm:self-center shrink-0">
                    <span className="hidden lg:inline text-[11px]">Ver detalle</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700">
            {activeTab === "today"
              ? "No tienes actividades para hoy"
              : "Sin eventos próximos"}
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === "today"
              ? "No hay eventos institucionales ni entregas programadas para el día de hoy."
              : "No hay actividades registradas en los próximos días."}
          </p>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700 transition"
          >
            <span>Consultar calendario completo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

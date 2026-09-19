import React, { useState, useMemo } from "react";
import { Calendar, ArrowRight } from "lucide-react";
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
  const [selectedDay, setSelectedDay] = useState("Hoy");

  // Dynamic day tabs based on real current date
  const dayTabs = useMemo(() => {
    const now = new Date();
    const result = [];

    for (let i = 0; i < 4; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const dayNum = String(d.getDate()).padStart(2, "0");
      let label = "";
      if (i === 0) label = "Hoy";
      else if (i === 1) label = "Mañana";
      else {
        label = d.toLocaleDateString("es-CO", { weekday: "short" });
        label = label.charAt(0).toUpperCase() + label.slice(1, 3);
      }

      result.push({ label, date: dayNum, offset: i });
    }
    return result;
  }, []);

  const displayedItems = useMemo(() => {
    if (selectedDay === "Hoy") {
      return todayItems;
    }
    return upcomingItems;
  }, [selectedDay, todayItems, upcomingItems]);

  return (
    <section
      aria-label="Mi jornada"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 shrink-0">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Mi jornada</h2>
            <p className="text-[10px] text-slate-400">
              Eventos institucionales y clases programadas
            </p>
          </div>
        </div>

        {/* Day selector tabs */}
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {dayTabs.map((day) => (
            <button
              key={day.label}
              type="button"
              onClick={() => setSelectedDay(day.label)}
              className={`whitespace-nowrap rounded-lg px-2 py-1 text-[9px] font-bold transition-all ${
                selectedDay === day.label
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {day.label}{" "}
              <span className="ml-0.5 text-[8px] opacity-70">{day.date}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Agenda Items List */}
      <div className="space-y-2">
        {displayedItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-left transition-all hover:border-blue-200 hover:bg-white hover:shadow-2xs"
          >
            <span className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[9px] font-bold text-slate-600 shrink-0">
              {item.timeOrDate}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold text-slate-700">
                {item.title}
              </span>
              <span className="mt-0.5 block truncate text-[9px] text-slate-400">
                {item.subtitle}
              </span>
            </span>
            <span className="hidden text-[9px] font-bold text-blue-700 group-hover:inline shrink-0">
              Ver detalle <ArrowRight className="ml-1 inline h-3 w-3" />
            </span>
          </button>
        ))}

        {displayedItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
            <p className="text-xs text-slate-400">
              No hay actividades programadas para este día.
            </p>
          </div>
        )}
      </div>

      {/* Footer calendar button */}
      <button
        type="button"
        onClick={onOpenCalendar}
        className="mt-3 text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors"
      >
        <span>Ver calendario completo</span>
        <ArrowRight className="inline h-3 w-3" />
      </button>
    </section>
  );
}

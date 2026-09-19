import React from "react";
import { BarChart3, ArrowRight } from "lucide-react";
import type { QuickAnalyticsItem } from "./types";

interface TeacherQuickAnalyticsProps {
  items: QuickAnalyticsItem[];
  onViewAnalytics?: () => void;
}

export function TeacherQuickAnalytics({
  items,
  onViewAnalytics,
}: TeacherQuickAnalyticsProps) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 shadow-[0_8px_24px_rgba(79,70,229,0.07)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-indigo-950">Analítica rápida</h2>
            <p className="text-[10px] text-indigo-700/60">Aprobación por evaluación</p>
          </div>
        </div>
        {onViewAnalytics && (
          <button
            type="button"
            onClick={onViewAnalytics}
            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 transition-colors"
          >
            <span>Ver más</span>
            <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {items.map((bar) => (
          <button
            key={bar.label}
            type="button"
            onClick={bar.onClick || onViewAnalytics}
            className="group w-full text-left transition"
          >
            <div className="mb-1 flex justify-between text-[9px] font-semibold text-slate-500">
              <span className="truncate">{bar.label}</span>
              <span className="text-slate-700 font-bold">{bar.value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
              <div
                className={`h-full rounded-full ${bar.color || "bg-blue-500"} transition-all duration-500 group-hover:brightness-110`}
                style={{ width: `${Math.min(100, Math.max(0, bar.value))}%` }}
              />
            </div>
          </button>
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-indigo-200/60 py-6 text-center">
            <p className="text-xs text-indigo-400">
              No hay evaluaciones con calificaciones registradas aún.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

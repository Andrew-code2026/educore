import React from "react";
import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  Users,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TeacherPriorityItem } from "./types";

interface TeacherPrioritySectionProps {
  items: TeacherPriorityItem[];
  onViewAll?: () => void;
}

const SEVERITY_CONFIG = {
  high: {
    indicator: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
    label: "Alta",
    iconBg: "bg-rose-50 text-rose-600",
  },
  medium: {
    indicator: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200/80",
    label: "Media",
    iconBg: "bg-amber-50 text-amber-600",
  },
  low: {
    indicator: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
    label: "Informativa",
    iconBg: "bg-blue-50 text-blue-600",
  },
};

export function TeacherPrioritySection({
  items,
  onViewAll,
}: TeacherPrioritySectionProps) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Atención prioritaria
              </h2>
              {items.length > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700">
                  {items.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Lo que requiere tu intervención inmediata.
            </p>
          </div>
        </div>

        {onViewAll && items.length > 3 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition flex items-center gap-1"
          >
            <span>Ver todo</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* List */}
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 5).map((item) => {
            const config = SEVERITY_CONFIG[item.severity];

            return (
              <div
                key={item.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1 transition"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${config.indicator}`}
                    title={`Prioridad: ${config.label}`}
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-normal">
                      {item.context}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 mb-2" />
          <p className="text-sm font-bold text-emerald-900">
            Todo está bajo control
          </p>
          <p className="mt-1 text-xs text-emerald-700/90 max-w-xs mx-auto">
            No tienes entregas atrasadas, asistencias pendientes ni alertas críticas hoy.
          </p>
        </div>
      )}
    </div>
  );
}

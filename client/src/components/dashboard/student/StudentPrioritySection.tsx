import React from "react";
import {
  AlertCircle,
  Clock3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentAlertItem } from "./types";

interface StudentPrioritySectionProps {
  alerts: StudentAlertItem[];
  onOpenClassroom: () => void;
  onOpenGrades: () => void;
}

const SEVERITY_CONFIG = {
  high: {
    bg: "bg-rose-50/50 hover:bg-rose-50/80",
    border: "border-rose-200/80",
    iconBg: "bg-rose-100 text-rose-600",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    badgeLabel: "Atención",
    icon: AlertCircle,
  },
  medium: {
    bg: "bg-amber-50/50 hover:bg-amber-50/80",
    border: "border-amber-200/80",
    iconBg: "bg-amber-100 text-amber-600",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    badgeLabel: "Por entregar",
    icon: Clock3,
  },
  low: {
    bg: "bg-blue-50/40 hover:bg-blue-50/70",
    border: "border-blue-200/80",
    iconBg: "bg-blue-100 text-blue-600",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    badgeLabel: "Sugerencia",
    icon: Sparkles,
  },
};

export function StudentPrioritySection({
  alerts,
  onOpenClassroom,
  onOpenGrades,
}: StudentPrioritySectionProps) {
  return (
    <section
      aria-label="Atención prioritaria"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                ¿Qué deberías atender hoy?
              </h2>
              {alerts.length > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold py-0 px-2"
                >
                  {alerts.length} {alerts.length === 1 ? "prioridad" : "prioridades"}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Señales clave para mantener tu progreso académico al día.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts list */}
      {alerts.length > 0 ? (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 transition-all ${config.border} ${config.bg}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-xs sm:text-sm font-bold text-slate-900">
                        {alert.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${config.badge}`}
                      >
                        {config.badgeLabel}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                      {alert.context}
                    </p>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={alert.onAction}
                    className="h-7 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-900 hover:text-white transition"
                  >
                    <span>{alert.actionLabel}</span>
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state: all clear! */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-3.5 text-center sm:text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900">
                Todo bajo control académico
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                No tienes entregas vencidas ni alertas académicas que requieran atención inmediata.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenGrades}
            className="rounded-lg bg-white border-slate-200 text-xs font-semibold text-slate-700 hover:text-blue-700 shadow-2xs"
          >
            <span>Ver calificaciones</span>
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

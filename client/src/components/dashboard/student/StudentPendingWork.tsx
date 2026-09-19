import React from "react";
import {
  ClipboardList,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentPendingAssignment } from "./types";

interface StudentPendingWorkProps {
  assignments: StudentPendingAssignment[];
  onOpenClassroom: () => void;
}

const URGENCY_CONFIG = {
  overdue: {
    border: "border-rose-200/80 hover:border-rose-300",
    bg: "bg-rose-50/40 hover:bg-rose-50/70",
    badgeBg: "bg-rose-100 text-rose-800 border-rose-200",
    icon: AlertCircle,
    iconColor: "text-rose-600",
  },
  today: {
    border: "border-amber-200/80 hover:border-amber-300",
    bg: "bg-amber-50/40 hover:bg-amber-50/70",
    badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
    iconColor: "text-amber-600",
  },
  soon: {
    border: "border-blue-100 hover:border-blue-200",
    bg: "bg-blue-50/30 hover:bg-blue-50/60",
    badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Calendar,
    iconColor: "text-blue-600",
  },
  later: {
    border: "border-slate-100 hover:border-slate-200",
    bg: "bg-slate-50/50 hover:bg-slate-50/80",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Calendar,
    iconColor: "text-slate-500",
  },
};

export function StudentPendingWork({
  assignments,
  onOpenClassroom,
}: StudentPendingWorkProps) {
  return (
    <section
      aria-label="Lo que tienes pendiente"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Lo que tienes pendiente
              </h2>
              {assignments.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold py-0 px-2"
                >
                  {assignments.length} {assignments.length === 1 ? "entrega" : "entregas"}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0 px-2"
                >
                  Al día
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Actividades y talleres por entregar en tus asignaturas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenClassroom}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition self-start sm:self-center"
        >
          <span>Ir a Classroom</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Assignment List */}
      {assignments.length > 0 ? (
        <div className="space-y-2.5">
          {assignments.map((item) => {
            const config = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.later;
            const UrgencyIcon = config.icon;

            return (
              <div
                key={item.id}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 transition-all ${config.border} ${config.bg}`}
              >
                <div className="min-w-0 flex-1">
                  {/* Top info tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs">
                      {item.subject}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badgeBg}`}
                    >
                      <UrgencyIcon className={`h-2.5 w-2.5 ${config.iconColor}`} />
                      <span>{item.urgencyLabel}</span>
                    </span>

                    {item.points && (
                      <span className="text-[10px] font-medium text-slate-500">
                        · Máx {item.points} pts
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition">
                    {item.title}
                  </h3>

                  {/* Context footer */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-600">
                      Límite: {item.formattedDue}
                    </span>
                    {item.teacherName && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>Prof. {item.teacherName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="flex items-center sm:shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={item.onAction}
                    className="h-8 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs hover:bg-blue-600 hover:text-white hover:border-blue-600 transition"
                  >
                    <span>Entregar tarea</span>
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-3.5 text-center sm:text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900">
                ¡Todas tus actividades están al día!
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                No tienes tareas pendientes por entregar en ninguna de tus materias.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenClassroom}
            className="rounded-lg bg-white border-slate-200 text-xs font-semibold text-slate-700 hover:text-blue-700 shadow-2xs"
          >
            <span>Ver historial</span>
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

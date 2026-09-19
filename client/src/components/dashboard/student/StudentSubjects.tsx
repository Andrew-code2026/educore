import React from "react";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StudentSubjectSummary, MenPerformanceLevel } from "./types";

interface StudentSubjectsProps {
  subjects: StudentSubjectSummary[];
  onOpenAcademic: () => void;
}

const LEVEL_CONFIG: Record<
  MenPerformanceLevel,
  { label: string; badge: string; text: string; bg: string; border: string }
> = {
  Superior: {
    label: "Superior",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    text: "text-emerald-700",
    bg: "bg-emerald-50/30",
    border: "border-emerald-100",
  },
  Alto: {
    label: "Alto",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    text: "text-blue-700",
    bg: "bg-blue-50/30",
    border: "border-blue-100",
  },
  Básico: {
    label: "Básico",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    text: "text-amber-700",
    bg: "bg-amber-50/30",
    border: "border-amber-100",
  },
  Bajo: {
    label: "Bajo",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    text: "text-rose-700",
    bg: "bg-rose-50/30",
    border: "border-rose-100",
  },
};

export function StudentSubjects({
  subjects,
  onOpenAcademic,
}: StudentSubjectsProps) {
  return (
    <section
      aria-label="Mis materias"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Mis materias
              </h2>
              {subjects.length > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold py-0 px-2"
                >
                  {subjects.length} asignaturas
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Desempeño acumulado y docentes a cargo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAcademic}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition self-start sm:self-center"
        >
          <span>Ver plan de estudios</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid of Subjects */}
      {subjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {subjects.map((subj) => {
            const levelConfig = LEVEL_CONFIG[subj.performanceLevel];

            return (
              <button
                key={subj.name}
                type="button"
                onClick={subj.onOpenDetails}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-2xs"
              >
                <div>
                  {/* Top line: Subject name & grade */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-900 line-clamp-1">
                      {subj.name}
                    </h3>
                    <span className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                      {subj.average > 0 ? subj.average.toFixed(1) : "—"}
                    </span>
                  </div>

                  {/* Teacher name */}
                  {subj.teacherName && (
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                      Prof. {subj.teacherName}
                    </p>
                  )}
                </div>

                {/* Bottom line: Badges & status */}
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100/90 text-[10px]">
                  {/* MEN Level badge */}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider ${levelConfig.badge}`}
                  >
                    {levelConfig.label}
                  </span>

                  {/* Pending activities count */}
                  {subj.pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <Clock className="h-3 w-3" />
                      <span>{subj.pendingCount} pendiente{subj.pendingCount > 1 ? "s" : ""}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Al día</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500">
            No se encontraron materias asignadas para este periodo.
          </p>
        </div>
      )}
    </section>
  );
}

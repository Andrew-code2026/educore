import React from "react";
import {
  ClipboardList,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { TeacherGradingItem, TeacherStudentAlert } from "./types";

interface TeacherOperationalDetailsProps {
  gradingItems: TeacherGradingItem[];
  studentsAtRisk: TeacherStudentAlert[];
  onViewAllClassroom: () => void;
  onViewAllGrades: () => void;
}

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function TeacherOperationalDetails({
  gradingItems,
  studentsAtRisk,
  onViewAllClassroom,
  onViewAllGrades,
}: TeacherOperationalDetailsProps) {
  const totalPendingGrades = gradingItems.reduce(
    (sum, item) => sum + item.pendingCount,
    0
  );

  return (
    <section
      aria-label="Detalles operativos"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Unified Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
            Detalles operativos
          </h2>
          <p className="text-[11px] text-slate-500">
            Seguimiento de entregas por revisar y alertas académicas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalPendingGrades > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              <ClipboardList className="h-3 w-3" />
              {totalPendingGrades} {totalPendingGrades === 1 ? "por calificar" : "por calificar"}
            </span>
          )}

          {studentsAtRisk.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              <AlertCircle className="h-3 w-3" />
              {studentsAtRisk.length} {studentsAtRisk.length === 1 ? "en riesgo" : "en riesgo"}
            </span>
          )}
        </div>
      </div>

      {/* Two-Column Internal Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Column 1: Por calificar */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Por calificar
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {gradingItems.length} {gradingItems.length === 1 ? "tarea activa" : "tareas activas"}
              </span>
            </div>

            {gradingItems.length > 0 ? (
              <div className="space-y-1.5">
                {gradingItems.slice(0, 3).map((item) => (
                  <button
                    key={item.assignmentId}
                    type="button"
                    onClick={item.onGrade}
                    className="group flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2 text-left transition hover:border-amber-200 hover:bg-amber-50/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-amber-900">
                        {item.title}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {item.course} · {item.subject}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-white border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 shadow-2xs">
                        {item.pendingCount}
                        {item.totalSubmissions > 0 && (
                          <span className="text-slate-400 font-normal"> / {item.totalSubmissions}</span>
                        )}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-amber-600" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-slate-600 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Entregas al día:</span> no hay tareas pendientes por calificar.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 text-left">
            <button
              type="button"
              onClick={onViewAllClassroom}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition"
            >
              <span>Ver todas las actividades</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Column 2: Atención académica */}
        <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Atención académica
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                Promedios &lt; 3.0
              </span>
            </div>

            {studentsAtRisk.length > 0 ? (
              <div className="space-y-1.5">
                {studentsAtRisk.slice(0, 3).map((student) => (
                  <button
                    key={`${student.name}-${student.course}`}
                    type="button"
                    onClick={student.onOpenGradeCenter}
                    className="group flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2 text-left transition hover:border-rose-200 hover:bg-rose-50/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-slate-700 shadow-2xs"
                        style={{ backgroundColor: student.avatarColor ?? "#fee2e2" }}
                      >
                        {initials(student.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-rose-900">
                          {student.name}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {student.course} {student.subject ? `· ${student.subject}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                        {student.currentGrade.toFixed(1)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-rose-600" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50/50 px-3 py-2.5 text-emerald-800 border border-emerald-100">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800">
                  <span className="font-semibold text-emerald-900">Rendimiento óptimo:</span> todos los estudiantes promedian &ge; 3.0.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 text-left">
            <button
              type="button"
              onClick={onViewAllGrades}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition"
            >
              <span>Abrir Grade Center</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

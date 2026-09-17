import React from "react";
import { AlertCircle, ChevronRight, ShieldCheck } from "lucide-react";
import type { TeacherStudentAlert } from "./types";

interface TeacherStudentsAtRiskProps {
  students: TeacherStudentAlert[];
  onViewAll: () => void;
}

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function TeacherStudentsAtRisk({
  students,
  onViewAll,
}: TeacherStudentsAtRiskProps) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Atención académica
              </h3>
              <p className="text-[11px] text-slate-400">
                Estudiantes con promedio &lt; 3.0
              </p>
            </div>
          </div>

          {students.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
              {students.length}
            </span>
          )}
        </div>

        {/* List */}
        {students.length > 0 ? (
          <div className="space-y-2">
            {students.slice(0, 4).map((student) => (
              <button
                key={`${student.name}-${student.course}`}
                type="button"
                onClick={student.onOpenGradeCenter}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-left transition hover:border-rose-200 hover:bg-rose-50/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-700 shadow-2xs"
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
                  <span className="rounded-md bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">
                    {student.currentGrade.toFixed(1)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-rose-600" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50/60 p-4 text-center border border-emerald-100/80">
            <ShieldCheck className="mx-auto h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-xs font-semibold text-emerald-900">
              Sin alertas de rendimiento
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">
              Todos los estudiantes promedian &ge; 3.0 en tus materias.
            </p>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition inline-flex items-center gap-1"
        >
          <span>Abrir Grade Center</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

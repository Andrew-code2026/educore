import React from "react";
import { BookOpen, ArrowRight } from "lucide-react";
import type { TeacherCourseCardItem } from "./types";

interface TeacherCoursesCardProps {
  courses: TeacherCourseCardItem[];
  onViewAll?: () => void;
}

export function TeacherCoursesCard({ courses, onViewAll }: TeacherCoursesCardProps) {
  return (
    <section
      aria-label="Mis cursos"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Mis cursos</h2>
          <p className="text-[10px] text-slate-400">Progreso y estado de tus grupos</p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>Ver todos</span>
            <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {courses.map((course) => (
          <button
            key={course.name}
            type="button"
            onClick={course.onClick}
            className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-left transition-all hover:border-blue-200 hover:bg-white hover:shadow-2xs"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shrink-0">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-slate-700">
                {course.name}
              </span>
              <span className="mt-0.5 block truncate text-[9px] text-slate-400">
                {course.studentCount} estudiantes · Prom. {course.averageGrade.toFixed(1)} · {course.pendingCount} pendientes
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                <span
                  className={`block h-full rounded-full ${course.tone || "bg-blue-600"} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, course.progress))}%` }}
                />
              </span>
            </span>
            <span className="text-[10px] font-extrabold text-slate-600 shrink-0">
              {course.progress}%
            </span>
            <ArrowRight className="h-3 w-3 text-slate-300 transition-transform group-hover:translate-x-0.5 shrink-0" />
          </button>
        ))}

        {courses.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
            <p className="text-xs text-slate-400">No hay cursos asignados en el periodo actual.</p>
          </div>
        )}
      </div>
    </section>
  );
}

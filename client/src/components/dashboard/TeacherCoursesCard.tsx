import React from "react";
import { BookOpen, ArrowRight } from "lucide-react";
import type { TeacherCourseCardItem } from "./types";

interface TeacherCoursesCardProps {
  courses: TeacherCourseCardItem[];
  onViewAll?: () => void;
}

export function TeacherCoursesCard({
  courses,
  onViewAll,
}: TeacherCoursesCardProps) {
  return (
    <section
      aria-label="Mis cursos"
      className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131f30] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] dark:shadow-none sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400 shrink-0">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Mis cursos
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400">
              Estado académico y avance de calificación por grupo
            </p>
          </div>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver todos</span>
            <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>

      <div
        className={`grid gap-3 ${
          courses.length > 1 ? "md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {courses.map((course) => {
          const pendingText =
            course.pendingCount === 0
              ? "Al día"
              : `${course.pendingCount} ${
                  course.pendingCount === 1 ? "pendiente" : "pendientes"
                }`;

          return (
            <button
              key={course.id ?? course.name}
              type="button"
              onClick={course.onClick}
              className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3 text-left transition-all hover:border-blue-200 dark:hover:border-blue-900/70 hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-2xs"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 shrink-0">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 sm:text-sm">
                    {course.name}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    Calificado:{" "}
                    <strong className="font-extrabold text-slate-700 dark:text-slate-200">
                      {course.progress}%
                    </strong>
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                  {course.studentCount} estudiantes · Prom.{" "}
                  {course.averageGrade.toFixed(1)} ·{" "}
                  <span
                    className={
                      course.pendingCount > 0
                        ? "font-semibold text-amber-600 dark:text-amber-400"
                        : "font-medium text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {pendingText}
                  </span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <span
                    className={`block h-full rounded-full ${
                      course.tone || "bg-blue-600"
                    } transition-all duration-500`}
                    style={{
                      width: `${Math.min(100, Math.max(0, course.progress))}%`,
                    }}
                  />
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
            </button>
          );
        })}

        {courses.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-200 dark:border-slate-800 py-5 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No hay cursos asignados en el periodo actual.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

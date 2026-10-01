import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  MapPin,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { AttendanceCourse } from "./types";

interface AttendanceCourseSelectProps {
  courses: AttendanceCourse[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  periodName?: string;
  onQuickRegister?: (courseId: string) => void;
  onOpenJustifications?: () => void;
  pendingJustificationsCount?: number;
}

export const AttendanceCourseSelect: React.FC<AttendanceCourseSelectProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  periodName = "Periodo 2 · 2026",
  onQuickRegister,
  onOpenJustifications,
  pendingJustificationsCount = 0,
}) => {
  const totalStudents = courses.reduce((acc, c) => acc + c.students.length, 0);
  const totalAlerts = courses.reduce(
    (acc, c) => acc + c.students.filter((s) => s.absencesCount >= 4).length,
    0
  );

  return (
    <div className="attendance-course-select space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1">
                <UserCheck className="h-3.5 w-3.5" />
                Asistencia docente
              </span>
              <span className="text-slate-400">{periodName}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Mis cursos asignados
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Selecciona el curso para abrir la planilla inteligente o inicia directamente la revisión de excusas.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenJustifications && (
              <button
                type="button"
                onClick={onOpenJustifications}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                  pendingJustificationsCount > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
                title="Abrir la bandeja de excusas y justificaciones"
              >
                <FileCheck2 className="h-4 w-4" />
                <span>Bandeja de Excusas</span>
                {pendingJustificationsCount > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                    {pendingJustificationsCount}
                  </span>
                )}
              </button>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">
                {new Intl.DateTimeFormat("es-CO", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(new Date())}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Prominent Top Alert Banner for Justifications & Excuses */}
      {pendingJustificationsCount > 0 && onOpenJustifications && (
        <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/95 via-sky-50/90 to-indigo-50/90 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-blue-950">
                  Bandeja de Justificaciones y Excusas
                </span>
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                  {pendingJustificationsCount} {pendingJustificationsCount === 1 ? "trámite pendiente" : "trámites pendientes"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-blue-800">
                Hay solicitudes de justificación radicadas con constancia médica o soporte físico pendientes de revisión institucional.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenJustifications}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Revisar Excusas Pendientes</span>
          </button>
        </div>
      )}

      {/* Metric Highlights */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            Cursos a cargo
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{courses.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">Grupos de la jornada activa</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            Total estudiantes
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalStudents}</p>
          <p className="mt-1 text-[10px] text-slate-500">En listas autorizadas</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            Asistencia promedio
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">94.2%</p>
          <p className="mt-1 text-[10px] text-slate-500">Promedio acumulado del periodo</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            Requieren atención
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{totalAlerts}</p>
          <p className="mt-1 text-[10px] text-slate-500">Con 4 o más ausencias</p>
        </div>
      </section>

      {/* Courses Grid */}
      <section aria-label="Cursos asignados del docente" className="grid gap-4 lg:grid-cols-3">
        {courses.map((course) => {
          const isRecommended = course.id === "11-2";
          const courseAlerts = course.students.filter((s) => s.absencesCount >= 4).length;

          return (
            <div
              key={course.id}
              className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                isRecommended
                  ? "border-blue-300 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/50 shadow-[0_12px_28px_rgba(37,99,235,0.09)]"
                  : "border-slate-200/80 bg-white hover:border-blue-200"
              }`}
            >
              {/* Top Accent Gradient Bar */}
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${course.color}`} />

              {/* Recommended Badge */}
              {isRecommended && (
                <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-bold text-white shadow-xs">
                  Siguiente en tu jornada
                </span>
              )}

              {/* Course Title & Icon */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Curso asignado
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                    {course.label} <span className="font-medium text-slate-500">· {course.subject}</span>
                  </h2>
                </div>
                {!isRecommended && (
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${course.color} text-white shadow-xs`}
                  >
                    <Users className="h-4 w-4" />
                  </span>
                )}
              </div>

              {/* Key Details Grid */}
              <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <span className="rounded-xl bg-slate-50/80 p-2.5">
                  <strong className="block text-sm font-extrabold text-slate-900">
                    {course.students.length}
                  </strong>
                  estudiantes
                </span>
                <span className="rounded-xl bg-slate-50/80 p-2.5">
                  <strong className="block text-sm font-extrabold text-slate-900">
                    {course.time}
                  </strong>
                  horario
                </span>
              </div>

              {/* Room & Alerts */}
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {course.room}
                </span>
                <span
                  className={
                    courseAlerts > 0
                      ? "flex items-center gap-1 font-bold text-amber-600"
                      : "text-emerald-600 font-semibold"
                  }
                >
                  {courseAlerts > 0 ? (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      {courseAlerts} alertas
                    </>
                  ) : (
                    "Al día"
                  )}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => onSelectCourse(course.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 hover:-translate-y-0.5 shadow-2xs"
                >
                  <span>Planilla de asistencia</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default AttendanceCourseSelect;

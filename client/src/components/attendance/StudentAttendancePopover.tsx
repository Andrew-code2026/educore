import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Maximize2,
  MessageCircle,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ACTIONABLE_STATUSES,
  AttendanceCourse,
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  STATUS_META,
  StudentRecordTab,
  normalizeDateIso,
} from "./types";
import { analyzeStudentPattern, calculateHistoryStats } from "./intelligence";

interface StudentAttendancePopoverProps {
  student: AttendanceStudent;
  course: AttendanceCourse;
  days: AttendanceDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  onSetStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  onClose: () => void;
  onOpenFullRecord?: (initialTab?: StudentRecordTab) => void;
  onNextStudent?: () => void;
  onPrevStudent?: () => void;
  currentIndex?: number;
  totalStudents?: number;
  onNavigateToGradeCenter?: (courseId: string, studentId: string) => void;
  activeCase?: AttendanceFollowUpCaseItem;
  onOpenCase?: (student: AttendanceStudent, reason: string, priority: "low" | "medium" | "high") => void;
  onUpdateCaseStatus?: (caseId: number, status: "open" | "in_review" | "resolved") => void;
  onAddCaseNote?: (caseId: number, note: string) => void;
  caseHistoryNotes?: AttendanceFollowUpNoteItem[];
  isOpeningCase?: boolean;
  isUpdatingCase?: boolean;
  isAddingNote?: boolean;
  justifications?: AttendanceJustificationItem[];
  onOpenJustification?: (justificationId: number) => void;
}

export const StudentAttendancePopover: React.FC<StudentAttendancePopoverProps> = ({
  student,
  course,
  days,
  selectedDate,
  onSelectDate,
  getStatus,
  onSetStatus,
  onClose,
  onOpenFullRecord,
  onNextStudent,
  onPrevStudent,
  currentIndex = 0,
  totalStudents = 1,
  onNavigateToGradeCenter,
  activeCase,
  onOpenCase,
  onUpdateCaseStatus,
  onAddCaseNote,
  caseHistoryNotes = [],
  isOpeningCase = false,
  isUpdatingCase = false,
  isAddingNote = false,
  justifications = [],
  onOpenJustification,
}) => {
  // Cierre con Escape y navegación con flechas de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && (e.altKey || e.ctrlKey)) {
        e.preventDefault();
        onPrevStudent?.();
      } else if (e.key === "ArrowRight" && (e.altKey || e.ctrlKey)) {
        e.preventDefault();
        onNextStudent?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrevStudent, onNextStudent]);

  // Lock de scroll del body mientras el Drawer está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Garantizar que activeCase pertenezca estrictamente al estudiante actual
  const studentActiveCase = useMemo(() => {
    if (!activeCase || String(activeCase.studentId) !== String(student.id)) return undefined;
    return activeCase;
  }, [activeCase, student.id]);

  // Diagnóstico de patrones y métricas factuales
  const patternAnalysis = useMemo(() => {
    return analyzeStudentPattern(student, days, getStatus, studentActiveCase ? [studentActiveCase] : []);
  }, [student, days, getStatus, studentActiveCase]);

  const periodStats = useMemo(() => {
    return calculateHistoryStats(student.id, days, getStatus);
  }, [student.id, days, getStatus]);

  const initials = student.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const currentCellStatus = getStatus(student.id, selectedDate);
  const currentStatusMeta = STATUS_META[currentCellStatus];
  const selectedDayInfo = days.find((d) => d.iso === selectedDate) ?? days[days.length - 1];

  const currentDateJustification = justifications.find(
    (j) => j.studentId === student.id && normalizeDateIso(j.attendanceDate) === normalizeDateIso(selectedDate)
  );

  const studentJustifications = useMemo(() => {
    return justifications.filter((j) => j.studentId === student.id);
  }, [justifications, student.id]);

  const handleOpenFollowUp = () => {
    if (!onOpenCase) return;
    const defaultReason =
      patternAnalysis.hasNegativePattern
        ? `Seguimiento por ${patternAnalysis.headline}`
        : "Revisión preventiva de asistencia";
    onOpenCase(student, defaultReason, patternAnalysis.severity === "critical" ? "high" : "medium");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 print:hidden"
      />

      {/* Drawer lateral derecho (Ficha Rápida) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha rápida de ${student.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md sm:max-w-lg flex-col bg-white border-l border-slate-200 shadow-2xl animate-in slide-in-from-right duration-250 print:hidden"
      >
        {/* ========================================================================= */}
        {/* 1. CABECERA: Identidad, Navegación secuencial, Asistencia % y Expandir    */}
        {/* ========================================================================= */}
        <div className="border-b border-slate-200/80 bg-slate-50/90 px-5 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            {/* Navegación secuencial entre estudiantes */}
            <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onPrevStudent}
                title="Estudiante anterior (Ctrl + ←)"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ant.</span>
              </button>
              <span className="px-1.5 text-[11px] font-mono font-bold text-slate-400">
                {currentIndex + 1}/{totalStudents}
              </span>
              <button
                type="button"
                onClick={onNextStudent}
                title="Siguiente estudiante (Ctrl + →)"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <span className="hidden sm:inline">Sig.</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Acciones principales de cabecera: Expandir expediente + Cerrar */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenFullRecord?.("summary")}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-indigo-700 transition"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Expandir expediente</span>
              </button>

              <button
                type="button"
                aria-label="Cerrar ficha"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shadow-2xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Información del Estudiante */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              {student.avatar ? (
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-indigo-100 shadow-xs"
                />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black text-slate-800 shadow-xs ring-1 ring-slate-200"
                  style={{ backgroundColor: student.avatarColor || "#e2e8f0" }}
                >
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold text-slate-900 leading-tight">
                  {student.name}
                </h2>
                <p className="truncate text-xs font-medium text-slate-500 mt-0.5">
                  {student.code} · {course.label} ({course.subject})
                </p>
              </div>
            </div>

            {/* Asistencia del periodo pill */}
            <span
              title={`Asistencia en el periodo: ${periodStats.attendanceRate}%`}
              className={`shrink-0 inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-black shadow-2xs ${
                periodStats.attendanceRate >= 90
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : periodStats.attendanceRate >= 80
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {periodStats.attendanceRate}%
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CUERPO DE LA FICHA RÁPIDA (Scrollable, Operación en Vivo)               */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* A. ACCIÓN RÁPIDA EN LA FECHA SELECCIONADA */}
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                Asistencia de hoy: {selectedDayInfo?.label}
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                {selectedDate}
              </span>
            </div>

            {/* Selector de 4 Estados de 1 Clic */}
            <div className="grid grid-cols-4 gap-1.5">
              {ACTIONABLE_STATUSES.map((st) => {
                const meta = STATUS_META[st];
                const isCurrent = currentCellStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onSetStatus(student.id, selectedDate, st)}
                    className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                      isCurrent
                        ? `${meta.badge} shadow-xs font-black ring-1 ring-black/10 scale-102`
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Excusa radicada en esta fecha */}
            {currentDateJustification && (
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-blue-900 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate text-[11px]">
                    Excusa: <strong>{JUSTIFICATION_STATUS_META[currentDateJustification.status].label}</strong> (
                    {JUSTIFICATION_REASON_LABELS[currentDateJustification.reasonCategory]})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFullRecord?.("justifications")}
                  className="shrink-0 text-xs font-extrabold text-blue-700 hover:text-blue-900 underline ml-2"
                >
                  Ver expediente →
                </button>
              </div>
            )}
          </section>

          {/* B. DIAGNÓSTICO FACTUAL INTELIGENTE (Solo prominente si hay alerta) */}
          <section>
            {patternAnalysis.hasNegativePattern ? (
              <div
                className={`rounded-2xl border p-4 space-y-1.5 ${
                  patternAnalysis.severity === "critical"
                    ? "border-rose-200 bg-rose-50/70"
                    : "border-amber-200 bg-amber-50/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 ${
                        patternAnalysis.severity === "critical" ? "text-rose-600" : "text-amber-600"
                      }`}
                    />
                    <p
                      className={`text-xs font-black capitalize ${
                        patternAnalysis.severity === "critical" ? "text-rose-900" : "text-amber-900"
                      }`}
                    >
                      {patternAnalysis.headline}
                    </p>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                      patternAnalysis.severity === "critical"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {patternAnalysis.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {patternAnalysis.explanation}
                </p>
              </div>
            ) : (
              /* Estudiante regular: Diseño limpio y discreto sin caja gigante */
              <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Asistencia regular y al día</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700">
                  Sin alertas activas
                </span>
              </div>
            )}
          </section>

          {/* C. MINI-RESUMEN DE MÉTRICAS DEL PERIODO */}
          <section className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asistencia</p>
              <p
                className={`text-base font-black mt-0.5 ${
                  periodStats.attendanceRate >= 90
                    ? "text-emerald-700"
                    : periodStats.attendanceRate >= 80
                    ? "text-amber-700"
                    : "text-rose-700"
                }`}
              >
                {periodStats.attendanceRate}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ausencias</p>
              <p
                className={`text-base font-black mt-0.5 ${
                  periodStats.absentCount > 0 ? "text-rose-700" : "text-slate-700"
                }`}
              >
                {periodStats.absentCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tardanzas</p>
              <p
                className={`text-base font-black mt-0.5 ${
                  periodStats.lateCount > 0 ? "text-amber-700" : "text-slate-700"
                }`}
              >
                {periodStats.lateCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Excusas</p>
              <p
                className={`text-base font-black mt-0.5 ${
                  periodStats.excusedCount > 0 ? "text-blue-700" : "text-slate-700"
                }`}
              >
                {periodStats.excusedCount}
              </p>
            </div>
          </section>

          {/* D. ÚLTIMAS 5 SESIONES REGISTRADAS (Navegables) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                Últimas 5 sesiones
              </span>
              <button
                type="button"
                onClick={() => onOpenFullRecord?.("history")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Ver historial completo ({days.length}) →
              </button>
            </div>

            <div className="space-y-1.5">
              {days.slice(-5).reverse().map((day) => {
                const st = getStatus(student.id, day.iso);
                const isSelected = selectedDate === day.iso;
                const meta = STATUS_META[st];
                const just = studentJustifications.find((j) => j.attendanceDate === day.iso);

                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => onSelectDate(day.iso)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-50/80 shadow-2xs font-semibold ring-1 ring-indigo-200"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-800">{day.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{day.iso}</span>
                      {isSelected && (
                        <span className="rounded-md bg-indigo-100 px-1.5 py-0.2 text-[9px] font-extrabold text-indigo-700">
                          Activa
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {just && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
                            JUSTIFICATION_STATUS_META[just.status].badge
                          }`}
                        >
                          <FileText className="h-2.5 w-2.5" />
                          <span>{JUSTIFICATION_STATUS_META[just.status].label}</span>
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.soft}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                        {meta.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* E. RESUMEN DE SEGUIMIENTO PEDAGÓGICO */}
          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-900">
                  Seguimiento pedagógico
                </h3>
              </div>
              {activeCase ? (
                <span className="rounded-full bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 text-[10px]">
                  Caso #{activeCase.id}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Sin caso activo</span>
              )}
            </div>

            {activeCase ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
                <p className="font-bold text-slate-900 truncate">{activeCase.reason}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Asignado: {activeCase.responsibleName}</span>
                  <span className="font-extrabold text-indigo-700 uppercase">{activeCase.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFullRecord?.("follow_up")}
                  className="w-full text-center rounded-lg bg-indigo-50 border border-indigo-200 py-1 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100 transition mt-1"
                >
                  Gestionar caso en expediente →
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 border border-slate-100 text-xs">
                <span className="text-slate-500 text-[11px]">
                  {patternAnalysis.hasNegativePattern
                    ? "Califica para seguimiento preventivo institucional."
                    : "Asistencia al día sin compromisos abiertos."}
                </span>
                <button
                  type="button"
                  disabled={isOpeningCase}
                  onClick={handleOpenFollowUp}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isOpeningCase ? "..." : "Iniciar caso"}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 3. PIE DE PÁGINA: Acceso al Expediente Expandido y Grade Center           */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenFullRecord?.("summary")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition shadow-2xs"
          >
            <Maximize2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Expediente 360°</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToGradeCenter?.(course.id, student.id)}
              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <ExternalLink className="h-3 w-3 text-slate-400" />
              <span>Grade Center</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
};

export default StudentAttendancePopover;

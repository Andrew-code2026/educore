import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Clock,
  Award,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Users,
} from "lucide-react";
import {
  type GradeScaleConfig,
  numberValue,
  getPerformanceTone,
  studentName,
} from "./gradeCenterUtils";
import {
  calculateAdvancedGroupStats,
  type AdvancedGroupStatistics,
} from "./gradeStatisticsUtils";
import {
  calculateCourseHealth,
  detectCourseProblems,
  getAssessmentsHighlights,
  getStudentsNeedingAttention,
  generateCourseDeterministicInsights,
  type CourseHealthResult,
  type DetectedProblemItem,
  type AttentionStudentItem,
  type EduCoreInsightItem,
} from "./gradeAnalyticsIntelligence";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface GradeAnalyticsMiniPanelProps {
  isOpen: boolean;
  onClose: () => void;
  rows: GradeCenterTableRow[];
  assessments: Assessment[];
  pendingGrades: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  courseName?: string;
  subjectName?: string;
  periodName?: string;
  weightTotal?: number;
  onNavigateToCell?: (studentUserId: number, assessmentId: number) => void;
  onSelectAssessment?: (assessmentId: number) => void;
  onFilterPending?: () => void;
  onFilterRisk?: () => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
  onOpenFullAnalytics?: () => void;
}

export function GradeAnalyticsMiniPanel({
  isOpen,
  onClose,
  rows,
  assessments,
  pendingGrades,
  scale,
  courseName = "Curso",
  subjectName = "Materia",
  periodName = "Periodo activo",
  weightTotal = 100,
  onNavigateToCell,
  onSelectAssessment,
  onFilterPending,
  onFilterRisk,
  onOpenStudentStats,
  onOpenFullAnalytics,
}: GradeAnalyticsMiniPanelProps) {
  // Estadísticas grupales reactivas en memoria
  const stats: AdvancedGroupStatistics = React.useMemo(() => {
    return calculateAdvancedGroupStats(rows, assessments, pendingGrades, scale);
  }, [rows, assessments, pendingGrades, scale]);

  // Salud del curso
  const health: CourseHealthResult = React.useMemo(() => {
    return calculateCourseHealth(stats, assessments, weightTotal);
  }, [stats, assessments, weightTotal]);

  // Problemas detectados
  const problems: DetectedProblemItem[] = React.useMemo(() => {
    return detectCourseProblems(stats, rows, assessments, pendingGrades, scale, weightTotal);
  }, [stats, rows, assessments, pendingGrades, scale, weightTotal]);

  // Mejor y peor evaluación
  const highlights = React.useMemo(() => {
    return getAssessmentsHighlights(stats.assessmentComparison);
  }, [stats.assessmentComparison]);

  // Estudiantes que requieren atención
  const attentionStudents: AttentionStudentItem[] = React.useMemo(() => {
    return getStudentsNeedingAttention(rows, assessments, pendingGrades, scale, 4);
  }, [rows, assessments, pendingGrades, scale]);

  // Insights de EduCore
  const insights: EduCoreInsightItem[] = React.useMemo(() => {
    return generateCourseDeterministicInsights(stats, health, problems, scale);
  }, [stats, health, problems, scale]);

  // Estudiantes con al menos una pendiente para contextualización
  const studentsWithPendingCount = React.useMemo(() => {
    return rows.filter(row => {
      const sId = row.enrollment.studentUserId;
      return assessments.some(ass => {
        const key = `${ass.id}:${sId}`;
        const orig = row.values.find(v => v.assessment.id === ass.id);
        const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : orig?.grade?.value ?? null;
        return val === null || val === undefined || isNaN(Number(val));
      });
    }).length;
  }, [rows, assessments, pendingGrades]);

  // Evolución rápida
  const evaluatedTimeline = React.useMemo(() => {
    return (stats.evolution || []).filter(p => p.groupAverage !== null);
  }, [stats.evolution]);

  const evolutionDelta = React.useMemo(() => {
    if (evaluatedTimeline.length < 2) return null;
    const first = evaluatedTimeline[0].groupAverage;
    const last = evaluatedTimeline[evaluatedTimeline.length - 1].groupAverage;
    if (first === null || last === null) return null;
    return Number((last - first).toFixed(2));
  }, [evaluatedTimeline]);

  // Manejo de acción de problema
  const handleProblemAction = (problem: DetectedProblemItem) => {
    onClose();
    if (problem.actionType === "ASSESSMENT" && problem.targetId) {
      if (onSelectAssessment) onSelectAssessment(problem.targetId);
      else if (onNavigateToCell && rows[0]) onNavigateToCell(rows[0].enrollment.studentUserId, problem.targetId);
    } else if (problem.actionType === "PENDING" && onFilterPending) {
      onFilterPending();
    } else if (problem.actionType === "RISK" && onFilterRisk) {
      onFilterRisk();
    }
  };

  const avgTone = getPerformanceTone(stats.groupAverage);

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 text-slate-800 dark:text-slate-100"
      >
        {/* Encabezado del Panel */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {courseName} · {subjectName}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {periodName}
                </span>
              </div>
              <SheetTitle className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--edc-primary)]" />
                Análisis Rápido del Curso
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Diagnóstico en tiempo real sobre {stats.totalStudents} estudiantes y {assessments.length} evaluaciones.
              </SheetDescription>
            </div>
          </div>

          {/* Tarjeta de Salud del Curso */}
          <div className={`mt-3 rounded-xl p-2.5 border ${health.borderClass} ${health.bgClass} flex items-center justify-between gap-2.5 transition-all`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${health.dotColorClass}`} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  Salud: {health.label}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-snug">
                  {health.primaryReason}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${health.badgeClass}`}>
              {health.label}
            </Badge>
          </div>
        </div>

        {/* Cuerpo con Scroll Fluido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ESTADO DEL CURSO (4 Mini KPIs) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Promedio */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Promedio
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-black ${avgTone.textColor}`}>
                  {numberValue(stats.groupAverage)}
                </span>
                <span className="text-[10px] text-slate-400">/ 5.0</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Mínimo aprobatorio: {stats.passingGrade.toFixed(1)}
              </p>
            </div>

            {/* Aprobación */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Aprobación
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats.passingPercentage}%
                </span>
                <span className="text-[10px] text-slate-400">
                  ({stats.passingCount}/{stats.evaluatedStudentsCount || stats.totalStudents})
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.passingPercentage}%` }}
                />
              </div>
            </div>

            {/* En Riesgo */}
            <div
              onClick={() => {
                if (stats.totalAtRisk > 0 && onFilterRisk) {
                  onClose();
                  onFilterRisk();
                }
              }}
              className={`rounded-xl border p-2.5 transition cursor-pointer ${
                stats.totalAtRisk > 0
                  ? "border-rose-200 bg-rose-50/40 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20"
                  : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>En riesgo</span>
                {stats.totalAtRisk > 0 && <AlertTriangle className="h-3 w-3 text-rose-500" />}
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-black ${stats.totalAtRisk > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>
                  {stats.totalAtRisk}
                </span>
                <span className="text-[10px] text-slate-400">alumnos</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {stats.totalAtRisk > 0 ? "Clic para filtrar en riesgo" : "Ningún alumno en riesgo"}
              </p>
            </div>

            {/* Pendientes */}
            <div
              onClick={() => {
                if (stats.totalPendingCount > 0 && onFilterPending) {
                  onClose();
                  onFilterPending();
                }
              }}
              className={`rounded-xl border p-2.5 transition cursor-pointer ${
                stats.totalPendingCount > 0
                  ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
                  : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Pendientes</span>
                {stats.totalPendingCount > 0 && <Clock className="h-3 w-3 text-amber-500" />}
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-black ${stats.totalPendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}>
                  {stats.totalPendingCount}
                </span>
                <span className="text-[10px] text-slate-400">celdas</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                {studentsWithPendingCount > 0 ? `${studentsWithPendingCount} estudiantes con pendientes` : "Al día"}
              </p>
            </div>
          </div>

          {/* EVOLUCIÓN RÁPIDA (Section 7) */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850/60 p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-[var(--edc-primary)]" />
                Evolución del curso
              </span>
              {evolutionDelta !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    evolutionDelta > 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : evolutionDelta < 0
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {evolutionDelta > 0 ? `↑ +${evolutionDelta.toFixed(1)}` : evolutionDelta < 0 ? `↓ ${evolutionDelta.toFixed(1)}` : "→ Estable"}
                </span>
              )}
            </div>

            {evaluatedTimeline.length >= 2 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                  {evaluatedTimeline.map((item, idx) => (
                    <React.Fragment key={item.assessmentId}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectAssessment) onSelectAssessment(item.assessmentId);
                          else if (onNavigateToCell && rows[0]) onNavigateToCell(rows[0].enrollment.studentUserId, item.assessmentId);
                        }}
                        className="group flex flex-col items-center rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition shrink-0"
                        title={`Ver ${item.assessmentTitle}`}
                      >
                        <span className="text-[10px] text-slate-400 truncate max-w-[70px] group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                          {item.assessmentTitle}
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
                          {item.groupAverage !== null ? item.groupAverage.toFixed(1) : "—"}
                        </span>
                      </button>
                      {idx < evaluatedTimeline.length - 1 && (
                        <span className="text-slate-300 dark:text-slate-600 font-bold shrink-0">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Se requieren al menos 2 evaluaciones calificadas para proyectar evolución temporal.
              </p>
            )}
          </div>

          {/* PROBLEMAS DETECTADOS (Section 8) */}
          {problems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Problemas y Alertas ({problems.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {problems.map(p => (
                  <div
                    key={p.id}
                    className={`rounded-xl p-2.5 border transition ${
                      p.severity === "CRITICAL"
                        ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20"
                        : p.severity === "WARNING"
                        ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                        : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-850/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {p.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {p.description}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleProblemAction(p)}
                        className="h-6 px-2 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                      >
                        {p.actionLabel}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEJOR Y PEOR EVALUACIÓN (Section 9 & 10) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Mejor evaluación */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 dark:border-emerald-950/60 dark:bg-emerald-950/20 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                <Award className="h-3.5 w-3.5 text-emerald-600" />
                <span>Mejor evaluación</span>
              </div>
              {highlights.best ? (
                <div>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={highlights.best.title}>
                    {highlights.best.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {highlights.best.average?.toFixed(1) ?? "—"}
                    </span>{" "}
                    promedio · {highlights.best.passingPercentage}% apr.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (highlights.best) {
                        if (onSelectAssessment) onSelectAssessment(highlights.best.assessmentId);
                        else if (onNavigateToCell && rows[0]) onNavigateToCell(rows[0].enrollment.studentUserId, highlights.best.assessmentId);
                      }
                    }}
                    className="mt-2 text-[10px] font-bold text-[var(--edc-primary)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Ver evaluación <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Sin datos</p>
              )}
            </div>

            {/* Necesita atención */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/30 dark:border-rose-950/60 dark:bg-rose-950/20 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span>Necesita atención</span>
              </div>
              {highlights.attention ? (
                <div>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={highlights.attention.title}>
                    {highlights.attention.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-extrabold text-rose-600 dark:text-rose-400">
                      {highlights.attention.average?.toFixed(1) ?? "—"}
                    </span>{" "}
                    promedio · {highlights.attention.passingPercentage}% apr.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (highlights.attention) {
                        if (onSelectAssessment) onSelectAssessment(highlights.attention.assessmentId);
                        else if (onNavigateToCell && rows[0]) onNavigateToCell(rows[0].enrollment.studentUserId, highlights.attention.assessmentId);
                      }
                    }}
                    className="mt-2 text-[10px] font-bold text-[var(--edc-primary)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Ver evaluación <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Sin datos</p>
              )}
            </div>
          </div>

          {/* ESTUDIANTES QUE REQUIEREN ATENCIÓN (Section 11) */}
          {attentionStudents.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Users className="h-3 w-3 text-slate-400" />
                  Requieren atención ({attentionStudents.length})
                </span>
                {onFilterRisk && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onFilterRisk();
                    }}
                    className="text-[10px] font-bold text-[var(--edc-primary)] hover:underline cursor-pointer"
                  >
                    Filtrar riesgo
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {attentionStudents.map(st => {
                  const studentRow = rows.find(r => r.enrollment.studentUserId === st.studentId);
                  return (
                    <div
                      key={st.studentId}
                      onClick={() => {
                        onClose();
                        if (studentRow && onOpenStudentStats) {
                          onOpenStudentStats(studentRow);
                        } else if (onNavigateToCell && assessments[0]) {
                          onNavigateToCell(st.studentId, assessments[0].id);
                        }
                      }}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {st.studentName}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {st.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                          {st.currentDefinitiva !== null ? st.currentDefinitiva.toFixed(1) : "—"}
                        </span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${st.risk.badgeClass}`}>
                          {st.risk.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PENDIENTES CONTEXTUALIZADO (Section 12) */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {stats.totalPendingCount} calificaciones pendientes
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {studentsWithPendingCount > 0
                      ? `${studentsWithPendingCount} estudiantes tienen al menos una evaluación sin calificar.`
                      : "Todas las notas se encuentran al día."}
                  </p>
                </div>
              </div>
              {stats.totalPendingCount > 0 && onFilterPending && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onFilterPending();
                  }}
                  className="h-6 px-2 text-[10px] font-bold rounded-lg border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-200 bg-white dark:bg-slate-800 shrink-0 hover:bg-amber-100"
                >
                  Ver pendientes
                </Button>
              )}
            </div>
          </div>

          {/* INSIGHT DE EDUCORE DETERMINISTA (Section 13) */}
          {insights.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-blue-950/20 p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Insight de EduCore</span>
              </div>
              <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                {insights[0].title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {insights[0].observation}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
                {insights[0].significance}
              </p>
            </div>
          )}
        </div>

        {/* PIE DEL PANEL: ACCIONES CONTEXTUALES Y VER ANÁLISIS COMPLETO (Section 14) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {onFilterRisk && stats.totalAtRisk > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onFilterRisk();
                }}
                className="flex-1 h-8 rounded-xl text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
              >
                Ver riesgo ({stats.totalAtRisk})
              </Button>
            )}

            {onFilterPending && stats.totalPendingCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onFilterPending();
                }}
                className="flex-1 h-8 rounded-xl text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300"
              >
                Ver pendientes ({stats.totalPendingCount})
              </Button>
            )}
          </div>

          {/* Botón principal: Ver análisis completo */}
          {onOpenFullAnalytics && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullAnalytics();
              }}
              className="w-full h-9 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm flex items-center justify-center gap-2"
            >
              <span>Ver análisis completo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
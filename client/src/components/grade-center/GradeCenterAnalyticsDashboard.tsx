import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeft,
  Info,
  CheckCircle2,
  Users,
  Calendar,
  Layers,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Filter,
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
  type AssessmentStatItem,
} from "./gradeStatisticsUtils";
import {
  calculateCourseHealth,
  detectCourseProblems,
  getAssessmentsHighlights,
  getStudentsNeedingAttention,
  generateCourseDeterministicInsights,
  calculateCourseDistributionBrackets,
  type CourseHealthResult,
  type DetectedProblemItem,
  type AttentionStudentItem,
  type EduCoreInsightItem,
  type CourseDistributionBracket,
} from "./gradeAnalyticsIntelligence";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface GradeCenterAnalyticsDashboardProps {
  rows: GradeCenterTableRow[];
  assessments: Assessment[];
  pendingGrades: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  courseName?: string;
  subjectName?: string;
  periodName?: string;
  weightTotal?: number;
  onBackToGradeCenter: () => void;
  onNavigateToAssessment?: (assessmentId: number) => void;
  onNavigateToPending?: () => void;
  onNavigateToRisk?: () => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
}

export function GradeCenterAnalyticsDashboard({
  rows,
  assessments,
  pendingGrades,
  scale,
  courseName = "11-2",
  subjectName = "MatemÃ¡ticas",
  periodName = "Periodo 2",
  weightTotal = 100,
  onBackToGradeCenter,
  onNavigateToAssessment,
  onNavigateToPending,
  onNavigateToRisk,
  onOpenStudentStats,
}: GradeCenterAnalyticsDashboardProps) {
  // EstadÃ­sticas grupales reactivas
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

  // Resaltados de evaluaciones
  const highlights = React.useMemo(() => {
    return getAssessmentsHighlights(stats.assessmentComparison);
  }, [stats.assessmentComparison]);

  // Estudiantes que requieren atenciÃ³n
  const attentionStudents: AttentionStudentItem[] = React.useMemo(() => {
    return getStudentsNeedingAttention(rows, assessments, pendingGrades, scale, 6);
  }, [rows, assessments, pendingGrades, scale]);

  // Insights de EduCore
  const insights: EduCoreInsightItem[] = React.useMemo(() => {
    return generateCourseDeterministicInsights(stats, health, problems, scale);
  }, [stats, health, problems, scale]);

  // DistribuciÃ³n en 4 rangos institucionales
  const definitivas = React.useMemo(() => {
    return rows.map(r => r.average);
  }, [rows]);

  const distributionBrackets: CourseDistributionBracket[] = React.useMemo(() => {
    return calculateCourseDistributionBrackets(definitivas, scale);
  }, [definitivas, scale]);

  // Conteo de estudiantes con al menos una pendiente
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

  // EvoluciÃ³n temporal ordenada
  const evolutionPoints = React.useMemo(() => {
    return (stats.evolution || []).filter(p => p.groupAverage !== null);
  }, [stats.evolution]);

  const overallDelta = React.useMemo(() => {
    if (evolutionPoints.length < 2) return null;
    const first = evolutionPoints[0].groupAverage;
    const last = evolutionPoints[evolutionPoints.length - 1].groupAverage;
    if (first === null || last === null) return null;
    return Number((last - first).toFixed(2));
  }, [evolutionPoints]);

  const avgTone = getPerformanceTone(stats.groupAverage);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      {/* HEADER PREMIUM (Section 16) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-[var(--edc-primary)] tracking-wide uppercase">
                {courseName} Â· {subjectName}
              </span>
              <span className="text-slate-300 dark:text-slate-700">Â·</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {periodName}
              </span>
              <span className="text-slate-300 dark:text-slate-700">Â·</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {stats.totalStudents} estudiantes
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                AnÃ¡lisis AcadÃ©mico Integral
              </h1>

              {/* Badge de Salud del Curso */}
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${health.borderClass} ${health.badgeClass}`}>
                <span className={`h-2 w-2 rounded-full ${health.dotColorClass}`} />
                <span>{health.statusText}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {health.primaryReason} Datos consolidados en tiempo real a partir del Grade Center.
            </p>
          </div>

          {/* BotÃ³n de Retorno al Grade Center */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Button
              type="button"
              onClick={onBackToGradeCenter}
              className="h-10 rounded-2xl bg-slate-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white flex items-center gap-2 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Grade Center</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI PRINCIPALES (Section 17) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Promedio General */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Promedio del Curso
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-black tracking-tight ${avgTone.textColor}`}>
                {numberValue(stats.groupAverage)}
              </span>
              <span className="text-xs text-slate-400">/ 5.0</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-slate-400">MÃ­nimo aprobatorio:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {stats.passingGrade.toFixed(1)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tasa de AprobaciÃ³n */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tasa de AprobaciÃ³n
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.passingPercentage}%
              </span>
              <span className="text-xs text-slate-400">
                ({stats.passingCount}/{stats.evaluatedStudentsCount || stats.totalStudents})
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${stats.passingPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Estudiantes en Riesgo */}
        <Card
          onClick={() => {
            if (stats.totalAtRisk > 0 && onNavigateToRisk) {
              onNavigateToRisk();
            }
          }}
          className={`rounded-3xl border transition shadow-xs hover:shadow-md ${
            stats.totalAtRisk > 0
              ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/60 dark:bg-rose-950/20 cursor-pointer"
              : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                En Riesgo AcadÃ©mico
              </span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                stats.totalAtRisk > 0
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-black tracking-tight ${
                stats.totalAtRisk > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
              }`}>
                {stats.totalAtRisk}
              </span>
              <span className="text-xs text-slate-400">
                de {stats.totalStudents} estudiantes
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {stats.totalAtRisk > 0 ? "Definitiva < 3.0" : "Sin casos crÃ­ticos"}
              </span>
              {stats.totalAtRisk > 0 && (
                <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
                  Filtrar en tabla <ArrowUpRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Calificaciones Pendientes */}
        <Card
          onClick={() => {
            if (stats.totalPendingCount > 0 && onNavigateToPending) {
              onNavigateToPending();
            }
          }}
          className={`rounded-3xl border transition shadow-xs hover:shadow-md ${
            stats.totalPendingCount > 0
              ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20 cursor-pointer"
              : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pendientes
              </span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                stats.totalPendingCount > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}>
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-black tracking-tight ${
                stats.totalPendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"
              }`}>
                {stats.totalPendingCount}
              </span>
              <span className="text-xs text-slate-400">celdas faltantes</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                {studentsWithPendingCount > 0
                  ? `${studentsWithPendingCount} estudiantes afectados`
                  : "Al 100% al dÃ­a"}
              </span>
              {stats.totalPendingCount > 0 && (
                <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-0.5 shrink-0">
                  Ver celdas <ArrowUpRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÃ“N DOBLE: RENDIMIENTO POR EVALUACIÃ“N & DISTRIBUCIÃ“N */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* RENDIMIENTO POR EVALUACIÃ“N (Section 18) - 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--edc-primary)]" />
                Rendimiento por EvaluaciÃ³n
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparativa detallada de notas, aprobaciÃ³n y estado de calificaciÃ³n.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {assessments.length} evaluaciones Â· {weightTotal}% asignado
            </span>
          </div>

          <div className="space-y-3">
            {(stats.assessmentComparison?.items || []).map(item => {
              const tone = getPerformanceTone(item.average);
              const isBest = highlights.best?.assessmentId === item.assessmentId;
              const isAttention = highlights.attention?.assessmentId === item.assessmentId;

              return (
                <div
                  key={item.assessmentId}
                  className={`rounded-2xl border p-4 transition bg-white dark:bg-slate-900 shadow-xs hover:shadow-md ${
                    isBest
                      ? "border-emerald-200 dark:border-emerald-900/60"
                      : isAttention
                      ? "border-rose-200 dark:border-rose-900/60"
                      : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold py-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.assessmentType}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-semibold py-0 border-indigo-200 text-indigo-700 bg-indigo-50/50 dark:border-indigo-800 dark:text-indigo-300">
                          Peso: {item.weight}%
                        </Badge>
                        {isBest && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold py-0 dark:bg-emerald-950 dark:text-emerald-300">
                            ðŸ† Mejor evaluaciÃ³n
                          </Badge>
                        )}
                        {isAttention && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold py-0 dark:bg-rose-950 dark:text-rose-300">
                            âš  Requiere atenciÃ³n
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.interpretation}
                      </p>
                    </div>

                    {/* MÃ©tricas y AcciÃ³n */}
                    <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-4">
                      {/* Promedio y AprobaciÃ³n */}
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className={`text-xl font-black ${tone.textColor}`}>
                            {item.average !== null ? item.average.toFixed(1) : "â€”"}
                          </span>
                          <span className="text-[10px] text-slate-400">/ {item.maxValue}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {item.passingPercentage}% aprobados Â· {item.evaluatedCount}/{item.evaluatedCount + item.pendingCount}
                        </p>
                      </div>

                      {/* BotÃ³n Ver en Grade Center */}
                      {onNavigateToAssessment && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigateToAssessment(item.assessmentId)}
                          className="h-8 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <span>Ver en tabla</span>
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso de aprobaciÃ³n */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-[11px] text-slate-400">
                    <span>AprobaciÃ³n:</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.passingPercentage >= 80
                            ? "bg-emerald-500"
                            : item.passingPercentage >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${item.passingPercentage}%` }}
                      />
                    </div>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {item.passingPercentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DISTRIBUCIÃ“N DEL RENDIMIENTO (Section 20) - 1 col */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--edc-primary)]" />
              DistribuciÃ³n de Calificaciones
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Desglose segÃºn la escala pedagÃ³gica institucional.
            </p>
          </div>

          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs p-5 space-y-4">
            {/* Barra apilada visual de distribuciÃ³n */}
            <div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                {distributionBrackets.map(b => (
                  <div
                    key={b.id}
                    title={`${b.label}: ${b.count} estudiantes (${b.percentage}%)`}
                    style={{ width: `${b.percentage}%` }}
                    className={`${b.barColor} transition-all duration-500`}
                  />
                ))}
              </div>
            </div>

            {/* Tarjetas individuales de cada rango */}
            <div className="space-y-2">
              {distributionBrackets.map(bracket => (
                <div
                  key={bracket.id}
                  className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/40 dark:bg-slate-850/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`h-3 w-3 rounded-md shrink-0 ${bracket.barColor}`} />
                    <div>
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {bracket.label}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Rango: {bracket.rangeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                      {bracket.count}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">
                      ({bracket.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug border-t border-slate-100 dark:border-slate-800 pt-3">
              Calculado sobre los {stats.evaluatedStudentsCount || stats.totalStudents} estudiantes con calificaciones definitivas registradas.
            </p>
          </Card>
        </div>
      </div>

      {/* EVOLUCIÃ“N DEL CURSO (Section 19) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--edc-primary)]" />
              EvoluciÃ³n Temporal del DesempeÃ±o
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trayectoria secuencial del promedio del curso a lo largo de las evaluaciones.
            </p>
          </div>

          {overallDelta !== null && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-semibold text-slate-500">Tendencia acumulada:</span>
              <Badge
                variant="outline"
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  overallDelta > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : overallDelta < 0
                    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {overallDelta > 0 ? `â†‘ +${overallDelta.toFixed(2)} pts` : overallDelta < 0 ? `â†“ ${overallDelta.toFixed(2)} pts` : "â†’ Estable"}
              </Badge>
            </div>
          )}
        </div>

        {evolutionPoints.length >= 2 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {evolutionPoints.map((point, index) => {
              const tone = getPerformanceTone(point.groupAverage);
              return (
                <div
                  key={point.assessmentId}
                  className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 p-4 space-y-2 relative"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold">Paso {index + 1}</span>
                    <span>Peso: {point.weight}%</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={point.assessmentTitle}>
                    {point.assessmentTitle}
                  </h4>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black ${tone.textColor}`}>
                      {point.groupAverage !== null ? point.groupAverage.toFixed(2) : "â€”"}
                    </span>
                    <span className="text-xs text-slate-400">promedio</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {point.passingPercentage}% superaron la nota mÃ­nima
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400">
            Se requiere registrar calificaciones en al menos 2 evaluaciones para proyectar la curva evolutiva del periodo.
          </div>
        )}
      </div>

      {/* SECCIÃ“N: PROBLEMAS Y ALERTAS & ESTUDIANTES QUE REQUIEREN ATENCIÃ“N */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LO QUE NECESITA ATENCIÃ“N (Section 21) */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Lo que Necesita AtenciÃ³n
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hallazgos que requieren acciÃ³n pedagÃ³gica o de registro.
            </p>
          </div>

          <div className="space-y-3">
            {problems.length > 0 ? (
              problems.map(problem => (
                <div
                  key={problem.id}
                  className={`rounded-2xl border p-4 transition shadow-xs ${
                    problem.severity === "CRITICAL"
                      ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20"
                      : problem.severity === "WARNING"
                      ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                      : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-850/40"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {problem.severity === "CRITICAL" ? (
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {problem.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 pl-6 leading-relaxed">
                        {problem.description}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (problem.actionType === "ASSESSMENT" && problem.targetId && onNavigateToAssessment) {
                          onNavigateToAssessment(problem.targetId);
                        } else if (problem.actionType === "PENDING" && onNavigateToPending) {
                          onNavigateToPending();
                        } else if (problem.actionType === "RISK" && onNavigateToRisk) {
                          onNavigateToRisk();
                        }
                      }}
                      className="self-start sm:self-center h-7 rounded-xl px-3 text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 shrink-0 cursor-pointer"
                    >
                      {problem.actionLabel}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-6 text-center text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                âœ“ No se detectaron problemas crÃ­ticos en el curso. Todas las mÃ©tricas estÃ¡n en rangos Ã³ptimos.
              </div>
            )}
          </div>
        </div>

        {/* ESTUDIANTES QUE REQUIEREN ATENCIÃ“N (Section 22) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--edc-primary)]" />
                Estudiantes Prioritarios
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alumnos con riesgo acadÃ©mico o pendientes crÃ­ticas.
              </p>
            </div>
            {onNavigateToRisk && stats.totalAtRisk > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNavigateToRisk}
                className="text-xs text-[var(--edc-primary)] font-bold hover:underline cursor-pointer"
              >
                Ver todos en riesgo â†’
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {attentionStudents.length > 0 ? (
              attentionStudents.map(st => {
                const studentRow = rows.find(r => r.enrollment.studentUserId === st.studentId);
                return (
                  <div
                    key={st.studentId}
                    onClick={() => {
                      if (studentRow && onOpenStudentStats) {
                        onOpenStudentStats(studentRow);
                      }
                    }}
                    className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 p-3.5 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {st.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {st.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {st.currentDefinitiva !== null ? st.currentDefinitiva.toFixed(1) : "â€”"}
                        </span>
                        <p className="text-[10px] text-slate-400">Definitiva</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-bold py-0.5 ${st.risk.badgeClass}`}>
                        {st.risk.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400">
                NingÃºn estudiante en estado de riesgo o rezago crÃ­tico.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* INSIGHTS DE EDUCORE (Section 23) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            Insights PedagÃ³gicos de EduCore
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conclusiones deterministas basadas exclusivamente en el cruce de datos y ponderaciones.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {insights.map(insight => (
            <div
              key={insight.id}
              className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30 dark:border-indigo-900/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-blue-950/10 p-4 space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  {insight.title}
                </span>
                {insight.type === "SUCCESS" ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0">Positivo</Badge>
                ) : insight.type === "WARNING" ? (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px] py-0">AtenciÃ³n</Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800 text-[10px] py-0">ObservaciÃ³n</Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                {insight.observation}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                {insight.significance}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER: RETORNO AL GRADE CENTER (Section 25) */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-5">
        <p className="text-xs text-slate-400">
          EduCore Analytics Â· Modo de lectura segura Â· Sin efectos secundarios en base de datos.
        </p>
        <Button
          type="button"
          onClick={onBackToGradeCenter}
          className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Volver a Calificaciones
        </Button>
      </div>
    </div>
  );
}
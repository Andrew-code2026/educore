import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type GradeScaleConfig,
  numberValue,
  getPerformanceTone,
} from "./gradeCenterUtils";
import {
  calculateAdvancedGroupStats,
  type AdvancedGroupStatistics,
  type AssessmentStatItem,
  type GradeDistributionBin,
  type EvolutionPoint,
  type TeacherInsight,
} from "./gradeStatisticsUtils";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface GradeStatisticsPanelProps {
  rows: GradeCenterTableRow[];
  assessments: Assessment[];
  pendingGrades: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateToCell?: (studentUserId: number, assessmentId: number) => void;
  onSelectAssessment?: (assessmentId: number) => void;
  onOpenRiskModal?: () => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
}

export function GradeStatisticsPanel({
  rows,
  assessments,
  pendingGrades,
  scale,
  isOpen = true,
  onClose,
  onNavigateToCell,
  onSelectAssessment,
  onOpenRiskModal,
  onOpenStudentStats,
}: GradeStatisticsPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"DISTRIBUTION" | "COMPARISON" | "EVOLUTION" | "INSIGHTS">("DISTRIBUTION");

  // Ordenamiento interactivo en la pestaña de comparación
  const [comparisonSort, setComparisonSort] = React.useState<{
    field: "title" | "weight" | "average" | "median" | "passingPercentage" | "pendingCount";
    direction: "asc" | "desc";
  }>({ field: "average", direction: "desc" });

  // Cálculo reactivo determinista de estadísticas avanzadas
  const stats: AdvancedGroupStatistics = React.useMemo(() => {
    return calculateAdvancedGroupStats(rows, assessments, pendingGrades, scale);
  }, [rows, assessments, pendingGrades, scale]);

  const sortedComparisonItems = React.useMemo(() => {
    const items = [...stats.assessmentComparison.items];
    items.sort((a, b) => {
      let valA: any = a[comparisonSort.field];
      let valB: any = b[comparisonSort.field];
      if (valA === null || valA === undefined) valA = -9999;
      if (valB === null || valB === undefined) valB = -9999;
      if (typeof valA === "string") {
        return comparisonSort.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return comparisonSort.direction === "asc" ? valA - valB : valB - valA;
    });
    return items;
  }, [stats.assessmentComparison.items, comparisonSort]);

  const toggleSort = (field: "title" | "weight" | "average" | "median" | "passingPercentage" | "pendingCount") => {
    setComparisonSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "desc" };
    });
  };

  if (!isOpen) return null;

  const avgTone = getPerformanceTone(stats.groupAverage);
  const passingTone = getPerformanceTone(stats.passingGrade);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur-xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/95">
      {/* Encabezado del Panel */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Estadísticas Avanzadas del Grupo
              <Badge variant="outline" className="text-[10px] font-bold py-0 border-indigo-200 text-indigo-700 bg-indigo-50/50 dark:border-indigo-800 dark:text-indigo-300">
                En tiempo real
              </Badge>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Análisis cuantitativo de desempeño sobre {stats.totalStudents} estudiantes y {assessments.length} evaluaciones.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cerrar panel de estadísticas"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid de Métricas Ejecutivas */}
      <div className="my-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {/* Promedio General */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800/80 dark:bg-slate-850/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Promedio Grupo
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl font-black tracking-tight ${avgTone.textColor}`}>
              {numberValue(stats.groupAverage)}
            </span>
            <span className="text-[10px] text-slate-400">/ {scale?.maxValue ?? 5}</span>
          </div>
        </div>

        {/* Mediana */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800/80 dark:bg-slate-850/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mediana
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-slate-700 dark:text-slate-200">
              {numberValue(stats.median)}
            </span>
            <span className="text-[10px] text-slate-400">puntos</span>
          </div>
        </div>

        {/* Desviación Estándar */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800/80 dark:bg-slate-850/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title="Desviación Estándar (dispersión)">
            Desv. Est.
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
              {stats.standardDeviation !== null ? `±${stats.standardDeviation.toFixed(2)}` : "—"}
            </span>
            <span className="text-[10px] text-slate-400">dispersión</span>
          </div>
        </div>

        {/* Rango Min - Max */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800/80 dark:bg-slate-850/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mínima – Máxima
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {numberValue(stats.minGrade)}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {numberValue(stats.maxGrade)}
            </span>
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800/80 dark:bg-slate-850/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Aprobación
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.passingPercentage}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({stats.passingCount}/{stats.totalStudents})
            </span>
          </div>
        </div>

        {/* En Riesgo (Clickable) */}
        <button
          type="button"
          onClick={onOpenRiskModal}
          className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-2.5 text-left transition hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center justify-between">
            En Riesgo
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-amber-700 dark:text-amber-300">
              {stats.totalAtRisk}
            </span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">casos</span>
          </div>
        </button>

        {/* Calificaciones Pendientes */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
            Pendientes
            <Clock className="h-3 w-3 text-indigo-500" />
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-indigo-700 dark:text-indigo-300">
              {stats.totalPendingCount}
            </span>
            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">celdas</span>
          </div>
        </div>
      </div>

      {/* Vistas Detalladas mediante Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <TabsTrigger value="DISTRIBUTION" className="rounded-lg text-xs font-semibold">
            Distribución
          </TabsTrigger>
          <TabsTrigger value="COMPARISON" className="rounded-lg text-xs font-semibold">
            Evaluaciones ({assessments.length})
          </TabsTrigger>
          <TabsTrigger value="EVOLUTION" className="rounded-lg text-xs font-semibold">
            Evolución
          </TabsTrigger>
          <TabsTrigger value="INSIGHTS" className="rounded-lg text-xs font-semibold flex items-center gap-1">
            Indicadores ({stats.insights.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. TAB: DISTRIBUCIÓN DE NOTAS */}
        <TabsContent value="DISTRIBUTION" className="pt-3 space-y-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-850/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Distribución de Calificaciones Definitivas
              </span>
              <span className="text-[11px] text-slate-500">
                Aprobación mínima institucional: <strong>{stats.passingGrade.toFixed(1)}</strong>
              </span>
            </div>

            <div className="space-y-2.5">
              {stats.distribution.map(bin => {
                return (
                  <div key={bin.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 w-24">
                          {bin.label}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] py-0 px-1.5 font-bold ${
                            bin.isPassing
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {bin.isPassing ? "Aprobatorio" : "Reprobatorio"}
                        </Badge>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {bin.count} {bin.count === 1 ? "estudiante" : "estudiantes"} ({bin.percentage}%)
                      </span>
                    </div>

                    {/* Barra visual de porcentaje */}
                    <div className="h-2.5 w-full rounded-full bg-slate-200/70 overflow-hidden dark:bg-slate-700/60">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          bin.isPassing
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-rose-500 to-amber-500"
                        }`}
                        style={{ width: `${Math.max(bin.percentage > 0 ? 3 : 0, bin.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 2. TAB: COMPARACIÓN ENTRE EVALUACIONES */}
        <TabsContent value="COMPARISON" className="pt-3 space-y-3">
          <div className="rounded-xl border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    <th className="pb-2 pl-2">
                      <button
                        type="button"
                        onClick={() => toggleSort("title")}
                        className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Evaluación
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "title" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("weight")}
                        className="mx-auto flex items-center justify-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Peso
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "weight" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("average")}
                        className="mx-auto flex items-center justify-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Promedio
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "average" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("median")}
                        className="mx-auto flex items-center justify-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Mediana
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "median" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-center">Mín – Máx</th>
                    <th className="pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("passingPercentage")}
                        className="mx-auto flex items-center justify-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Aprobación
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "passingPercentage" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("pendingCount")}
                        className="mx-auto flex items-center justify-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        Pendientes
                        <ArrowUpDown className={`h-2.5 w-2.5 ${comparisonSort.field === "pendingCount" ? "text-indigo-600" : "opacity-40"}`} />
                      </button>
                    </th>
                    <th className="pb-2 text-right pr-2">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedComparisonItems.map(item => {
                    const itemTone = getPerformanceTone(item.average);
                    return (
                      <tr
                        key={item.assessmentId}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-2.5 pl-2 min-w-[140px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </span>
                            {item.isHighestAverage && (
                              <Badge className="h-4 px-1 text-[8px] font-bold bg-emerald-500 text-white">
                                Mejor
                              </Badge>
                            )}
                            {item.isLowestAverage && (
                              <Badge variant="destructive" className="h-4 px-1 text-[8px] font-bold">
                                Menor
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {item.assessmentType.toLowerCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-500">
                          {item.weight}%
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`font-bold ${itemTone.textColor}`}>
                            {numberValue(item.average)}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-medium text-slate-600 dark:text-slate-300">
                          {numberValue(item.median)}
                        </td>
                        <td className="py-2.5 text-center text-[11px] text-slate-600 dark:text-slate-300">
                          {numberValue(item.minGrade)} – {numberValue(item.maxGrade)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.passingPercentage}%
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          {item.pendingCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] py-0 border-indigo-200 text-indigo-700 bg-indigo-50/50 dark:border-indigo-800 dark:text-indigo-300">
                              {item.pendingCount} pend.
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold">Al día</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right pr-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectAssessment?.(item.assessmentId)}
                            className="h-6 px-2 text-[10px] text-indigo-600 font-bold hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800"
                          >
                            Ver en tabla
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. TAB: EVOLUCIÓN TEMPORAL */}
        <TabsContent value="EVOLUTION" className="pt-3 space-y-3">
          {/* Banner de Tendencia General del Grupo */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-850/40">
            <div className="flex items-center gap-2.5">
              {stats.performanceEvolution.trend === "ASCENDENTE" && <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />}
              {stats.performanceEvolution.trend === "DESCENDENTE" && <TrendingDown className="h-5 w-5 text-rose-500 shrink-0" />}
              {stats.performanceEvolution.trend === "ESTABLE" && <ArrowRight className="h-5 w-5 text-indigo-500 shrink-0" />}
              {stats.performanceEvolution.trend === "INSUFICIENTE" && <Info className="h-5 w-5 text-slate-400 shrink-0" />}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Trayectoria General: {stats.performanceEvolution.trendLabel}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {stats.performanceEvolution.firstAssessment && stats.performanceEvolution.latestAssessment ? (
                    <>
                      Inicio: <strong>{stats.performanceEvolution.firstAssessment.title}</strong> ({numberValue(stats.performanceEvolution.firstAssessment.average)}) → Actual: <strong>{stats.performanceEvolution.latestAssessment.title}</strong> ({numberValue(stats.performanceEvolution.latestAssessment.average)})
                      {stats.performanceEvolution.overallDelta !== null && (
                        <span className={`font-bold ml-1.5 ${
                          stats.performanceEvolution.overallDelta > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : stats.performanceEvolution.overallDelta < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-600"
                        }`}>
                          ({stats.performanceEvolution.overallDelta > 0 ? `+${stats.performanceEvolution.overallDelta}` : stats.performanceEvolution.overallDelta} pts)
                        </span>
                      )}
                    </>
                  ) : (
                    "Registra calificaciones en al menos 2 evaluaciones para analizar la trayectoria temporal del grupo."
                  )}
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-[10px] font-bold py-0.5 px-2 shrink-0 ${
                stats.performanceEvolution.trend === "ASCENDENTE"
                  ? "border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : stats.performanceEvolution.trend === "DESCENDENTE"
                  ? "border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-slate-200 text-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {stats.performanceEvolution.trend}
            </Badge>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-850/40">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-3">
              Secuencia Cronológica del Rendimiento Grupal
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.evolution.map((point, idx) => {
                const prevPoint = idx > 0 ? stats.evolution[idx - 1] : null;
                const diff = (point.groupAverage !== null && prevPoint && prevPoint.groupAverage !== null)
                  ? Number((point.groupAverage - prevPoint.groupAverage).toFixed(2))
                  : null;

                const tone = getPerformanceTone(point.groupAverage);

                return (
                  <div
                    key={point.assessmentId}
                    className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase mb-1">
                      <span>Paso {point.index}</span>
                      <span>Peso {point.weight}%</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={point.assessmentTitle}>
                      {point.assessmentTitle}
                    </h4>

                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black ${tone.textColor}`}>
                          {numberValue(point.groupAverage)}
                        </span>
                        <span className="text-[10px] text-slate-400">promedio</span>
                      </div>

                      {diff !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          diff > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : diff < 0
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Aprobación:</span>
                      <strong className="text-emerald-600">{point.passingPercentage}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 4. TAB: INDICADORES PEDAGÓGICOS (INSIGHTS) */}
        <TabsContent value="INSIGHTS" className="pt-3 space-y-2">
          {stats.insights.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              Sin indicadores especiales detectados en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stats.insights.map(ins => {
                const isWarning = ins.type === "WARNING";
                const isSuccess = ins.type === "SUCCESS";
                const isAction = ins.type === "ACTION";

                return (
                  <div
                    key={ins.id}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                      isWarning
                        ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                        : isSuccess
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                        : isAction
                        ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200"
                        : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 text-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isWarning && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                        {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                        {isAction && <Clock className="h-4 w-4 text-indigo-600 shrink-0" />}
                        <h5 className="text-xs font-bold truncate">{ins.title}</h5>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {ins.description}
                      </p>
                    </div>

                    {ins.actionTarget && (
                      <div className="shrink-0 self-center">
                        {ins.actionTarget.type === "RISK" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={onOpenRiskModal}
                            className="h-6 text-[10px] px-2 font-bold border-amber-300 bg-white/80 text-amber-900 hover:bg-amber-100"
                          >
                            Ver casos
                          </Button>
                        )}
                        {ins.actionTarget.type === "ASSESSMENT" && ins.actionTarget.assessmentId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectAssessment?.(ins.actionTarget!.assessmentId!)}
                            className="h-6 text-[10px] px-2 font-bold border-indigo-300 bg-white/80 text-indigo-900 hover:bg-indigo-100"
                          >
                            Ir a evaluación
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

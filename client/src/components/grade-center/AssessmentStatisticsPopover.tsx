import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  X,
  Activity,
  Sparkles,
} from "lucide-react";
import {
  type GradeScaleConfig,
  numberValue,
  getPerformanceTone,
  assessmentLabels,
  POPOVER_GLASS_PANEL_CLASS,
} from "./gradeCenterUtils";
import {
  calculateAssessmentStatistics,
  type AssessmentStatItem,
} from "./gradeStatisticsUtils";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface AssessmentStatisticsPopoverProps {
  assessment: Assessment;
  rows: GradeCenterTableRow[];
  pendingGrades?: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  groupAverage?: number | null;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssessmentStatisticsPopover({
  assessment,
  rows,
  pendingGrades = {},
  scale,
  groupAverage,
  children,
  open,
  onOpenChange,
}: AssessmentStatisticsPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  // Cálculo determinista y en tiempo real de las estadísticas de la actividad
  const stats: AssessmentStatItem = React.useMemo(() => {
    return calculateAssessmentStatistics(assessment, rows, pendingGrades, scale, groupAverage);
  }, [assessment, rows, pendingGrades, scale, groupAverage]);

  const typeLabel = assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType;
  const avgTone = getPerformanceTone(stats.average);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        avoidCollisions={true}
        className={`${POPOVER_GLASS_PANEL_CLASS} w-80 text-left`}
      >
        {/* Highlight de vidrio sutil superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />

        {/* Encabezado con título, tipo y peso */}
        <div className="relative mb-2.5 flex items-start justify-between border-b border-slate-100/90 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4
                  className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white max-w-[150px]"
                  title={assessment.title}
                >
                  {assessment.title}
                </h4>
                <Badge
                  variant="outline"
                  className="text-[9px] font-bold py-0 px-1 border-indigo-200 text-indigo-700 bg-indigo-50/50 dark:border-indigo-800 dark:text-indigo-300"
                >
                  {typeLabel}
                </Badge>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Peso: <span className="font-bold text-[var(--edc-primary)]">{assessment.weight}%</span> · Escala máx: {stats.maxValue}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cerrar estadísticas de la evaluación"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Cuadrícula de Métricas Clave (2x3) */}
        <div className="relative mb-2.5 grid grid-cols-3 gap-1.5 text-center">
          {/* Promedio */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Promedio
            </p>
            <div className="mt-0.5">
              <span className={`text-base font-black tracking-tight ${avgTone.textColor}`}>
                {numberValue(stats.average)}
              </span>
            </div>
          </div>

          {/* Mediana */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Mediana
            </p>
            <div className="mt-0.5">
              <span className="text-base font-black tracking-tight text-slate-700 dark:text-slate-200">
                {numberValue(stats.median)}
              </span>
            </div>
          </div>

          {/* Desviación Estándar */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400" title="Desviación Estándar">
              Desv. Est.
            </p>
            <div className="mt-0.5">
              <span className="text-base font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                {stats.standardDeviation !== null ? `±${stats.standardDeviation.toFixed(2)}` : "—"}
              </span>
            </div>
          </div>

          {/* Rango Mín - Máx */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Mín – Máx
            </p>
            <div className="mt-0.5 flex items-center justify-center gap-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="text-rose-600 dark:text-rose-400">{numberValue(stats.minGrade)}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-emerald-600 dark:text-emerald-400">{numberValue(stats.maxGrade)}</span>
            </div>
          </div>

          {/* Tasa Aprobación */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Aprobación
            </p>
            <div className="mt-0.5">
              <span className="text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.passingPercentage}%
              </span>
            </div>
          </div>

          {/* Calificados vs Pendientes */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Estado
            </p>
            <div className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <span>{stats.evaluatedCount}</span>
              <span className="text-slate-400 font-normal">/{stats.evaluatedCount + stats.pendingCount}</span>
            </div>
          </div>
        </div>

        {/* Mini Distribución Rápida */}
        <div className="relative mb-2.5 rounded-xl border border-slate-100/80 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-850/40">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-indigo-500" /> Distribución
            </span>
            <span className="text-slate-400 font-normal">
              {stats.passingCount} aprobados · {stats.evaluatedCount - stats.passingCount} reprobados
            </span>
          </div>

          {/* Barra segmentada de distribución */}
          <div className="flex h-2.5 w-full gap-0.5 rounded-md overflow-hidden bg-slate-200/50 dark:bg-slate-700/50">
            {stats.distribution.map(bin => {
              if (bin.percentage === 0) return null;
              return (
                <div
                  key={bin.id}
                  style={{ width: `${bin.percentage}%` }}
                  title={`${bin.label}: ${bin.count} estudiantes (${bin.percentage}%)`}
                  className={`h-full transition-all ${
                    bin.isPassing
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : "bg-rose-500 hover:bg-rose-600"
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
            <span>{scale?.minValue ?? 0}</span>
            <span>Escala</span>
            <span>{stats.maxValue}</span>
          </div>
        </div>

        {/* Interpretación Pedagógica Rápida */}
        <div className="relative rounded-xl border border-indigo-100 bg-indigo-50/50 p-2 text-[11px] dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-start gap-1.5 text-indigo-950 dark:text-indigo-200">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
            <p className="leading-snug">
              {stats.interpretation}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

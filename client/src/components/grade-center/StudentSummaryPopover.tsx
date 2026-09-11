import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  ExternalLink,
  Award,
  TrendingDown,
  Clock,
  User,
  Calculator,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import {
  type GradeScaleConfig,
  studentName,
  numberValue,
  getPerformanceTone,
  POPOVER_GLASS_PANEL_CLASS,
} from "./gradeCenterUtils";
import {
  calculateStudentProjection,
  calculateWhatIsNeededToPass,
  determineRiskLevel,
} from "./gradeIntelligenceUtils";
import {
  calculateMedian,
  calculateApprovalRate,
} from "./gradeStatisticsUtils";
import { type GradeCenterTableRow } from "./GradeCenterTable";

interface StudentSummaryPopoverProps {
  studentRow: GradeCenterTableRow;
  courseName?: string;
  subjectName?: string;
  scale?: GradeScaleConfig | null;
  groupAverage?: number | null;
  rows?: GradeCenterTableRow[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onViewDetail?: () => void;
  onOpenSimulator?: (studentRow: GradeCenterTableRow) => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
  children: React.ReactNode;
}

export function StudentSummaryPopover({
  studentRow,
  courseName,
  subjectName,
  scale,
  groupAverage,
  rows,
  open,
  onOpenChange,
  onViewDetail,
  onOpenSimulator,
  onOpenStudentStats,
  children,
}: StudentSummaryPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const sName = studentName(studentRow.student);
  const studentId = studentRow.enrollment.studentUserId;
  const average = studentRow.average;
  const tone = getPerformanceTone(average);

  // Normalizar valores para el motor de inteligencia
  const rawValues = studentRow.values ?? [];
  const normalizedValues = React.useMemo(() => {
    return rawValues.map(v => ({
      value: v.grade?.value !== null && v.grade?.value !== undefined && !isNaN(Number(v.grade?.value))
        ? Number(v.grade?.value)
        : null,
      maxValue: Number(v.assessment.maxValue) || (scale?.maxValue ?? 5),
      weight: Number(v.assessment.weight) || 0,
    }));
  }, [rawValues, scale?.maxValue]);

  const validGrades = rawValues
    .map(v => v.grade?.value)
    .filter((val): val is number => val !== null && val !== undefined && !isNaN(Number(val)));

  const bestGrade = validGrades.length ? Math.max(...validGrades) : null;
  const lowestGrade = validGrades.length ? Math.min(...validGrades) : null;
  const pendingCount = rawValues.length - validGrades.length;

  // Métricas inteligentes deterministas
  const projection = React.useMemo(() => {
    return calculateStudentProjection(normalizedValues, scale);
  }, [normalizedValues, scale]);

  const neededToPass = React.useMemo(() => {
    return calculateWhatIsNeededToPass(normalizedValues, scale);
  }, [normalizedValues, scale]);

  const risk = React.useMemo(() => {
    return determineRiskLevel(normalizedValues, scale, sName, studentId);
  }, [normalizedValues, scale, sName, studentId]);

  const median = React.useMemo(() => calculateMedian(validGrades), [validGrades]);
  const approvalRate = React.useMemo(() => calculateApprovalRate(validGrades, scale), [validGrades, scale]);

  const relativeRank = React.useMemo(() => {
    if (!rows || rows.length <= 1 || average === null) return null;
    const validAvgs = rows
      .map(r => r.average)
      .filter((a): a is number => a !== null && a !== undefined && !isNaN(Number(a)))
      .sort((a, b) => b - a);
    const pos = validAvgs.findIndex(a => a <= average) + 1;
    const position = pos > 0 ? pos : validAvgs.length;
    return {
      position,
      total: validAvgs.length,
      label: `Puesto ${position} de ${validAvgs.length}`,
    };
  }, [rows, average]);

  const deltaVsGroup = average !== null && groupAverage !== null && groupAverage !== undefined
    ? Number((average - groupAverage).toFixed(1))
    : null;

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        avoidCollisions={true}
        className={`${POPOVER_GLASS_PANEL_CLASS} w-80`}
      >
        {/* Highlight de vidrio sutil superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />

        {/* Encabezado compacto con badge de riesgo */}
        <div className="relative mb-2.5 flex items-start justify-between border-b border-slate-100/90 pb-2 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--edc-secondary)] text-xs font-bold text-[var(--edc-primary)]">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4
                  className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white"
                  title={sName}
                >
                  {sName}
                </h4>
                {risk.riskLevel === "ALTO" && (
                  <Badge variant="destructive" className="h-3.5 px-1 text-[8px] font-bold">
                    Riesgo Alto
                  </Badge>
                )}
                {risk.riskLevel === "MEDIO" && (
                  <Badge className="h-3.5 px-1 text-[8px] font-bold bg-amber-500 hover:bg-amber-600 text-white">
                    Riesgo Medio
                  </Badge>
                )}
              </div>
              <p className="truncate text-[10px] text-slate-400 font-medium">
                ID · {studentId} {courseName ? `· ${courseName}` : ""}
                {relativeRank && (
                  <span className="ml-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                    · {relativeRank.label}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cerrar resumen del estudiante"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Métricas clave: Definitiva actual y Proyección */}
        <div className="relative mb-2.5 grid grid-cols-2 gap-2">
          {/* Definitiva actual */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Definitiva
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-xl font-extrabold tracking-tight ${tone.textColor}`}>
                {numberValue(average)}
              </span>
              {average !== null && (
                <span
                  className={`rounded px-1 py-0.2 text-[9px] font-bold leading-none ${tone.badgeColor}`}
                >
                  {tone.label}
                </span>
              )}
              {deltaVsGroup !== null && (
                <span
                  className={`rounded px-1 py-0.2 text-[9px] font-bold leading-none ${
                    deltaVsGroup > 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : deltaVsGroup < 0
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                  title={`Diferencia respecto al promedio del grupo (${numberValue(groupAverage)})`}
                >
                  {deltaVsGroup > 0 ? `+${deltaVsGroup}` : deltaVsGroup} vs grupo
                </span>
              )}
            </div>
          </div>

          {/* Proyección estimada si hay pendientes, o estado si está completo */}
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-850/50">
            {projection.hasPending && projection.projectedDefinitiva !== null ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Proyección
                </p>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
                    {numberValue(projection.projectedDefinitiva)}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">estimada</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Evaluaciones
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  {validGrades.length} / {rawValues.length}{" "}
                  <span className="text-[10px] font-normal text-slate-400">
                    {pendingCount === 0 ? "Completas" : "calificadas"}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Sección Inteligente: "¿Qué necesito para aprobar?" */}
        {neededToPass.hasPending && (
          <div className={`relative mb-2.5 p-2 rounded-xl border text-[11px] flex items-center justify-between gap-1.5 ${
            neededToPass.isGuaranteed
              ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
              : neededToPass.isImpossible
              ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              {neededToPass.isGuaranteed ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span className="truncate font-semibold">
                {neededToPass.message}
              </span>
            </div>
            {neededToPass.requiredGrade !== null && !neededToPass.isImpossible && !neededToPass.isGuaranteed && (
              <span className="font-extrabold shrink-0 px-1 py-0.5 rounded bg-white/70 dark:bg-black/20 text-xs">
                {neededToPass.requiredGrade}
              </span>
            )}
          </div>
        )}

        {/* Lista condensada de calificaciones */}
        <div className="relative mb-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Notas del periodo</span>
            <span>{subjectName ?? "Materia"}</span>
          </div>

          <div className="max-h-32 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {rawValues.map(v => {
              const val = v.grade?.value;
              const isPending = val === null || val === undefined || isNaN(Number(val));
              const valTone = getPerformanceTone(val);
              return (
                <div
                  key={v.assessment.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100/80 bg-white/70 px-2 py-1 text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850/40"
                >
                  <div className="min-w-0 pr-2">
                    <p
                      className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-300"
                      title={v.assessment.title}
                    >
                      {v.assessment.title}
                    </p>
                    <p className="text-[9px] text-slate-400">Peso {v.assessment.weight}%</p>
                  </div>
                  {isPending ? (
                    <span className="text-[10px] italic font-semibold text-slate-400">
                      Pendiente
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${valTone.textColor}`}>
                      {numberValue(val)}
                    </span>
                  )}
                </div>
              );
            })}
            {!rawValues.length && (
              <p className="py-2 text-center text-[11px] text-slate-400 italic">
                Sin evaluaciones aún
              </p>
            )}
          </div>
        </div>

        {/* Píldoras de destacados: Mejor, Peor, Mediana, Aprobadas, Pendientes */}
        {rawValues.length > 0 && (
          <div className="relative mb-2.5 rounded-xl bg-slate-50/80 p-2 text-[10px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="flex items-center gap-1" title="Mejor nota obtenida">
                <Award className="h-3 w-3 text-emerald-500" />
                Máx: <strong>{numberValue(bestGrade)}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1" title="Nota más baja obtenida">
                <TrendingDown className="h-3 w-3 text-rose-500" />
                Mín: <strong>{numberValue(lowestGrade)}</strong>
              </span>
              <span>·</span>
              <span title="Mediana de notas obtenidas">
                Mediana: <strong>{numberValue(median)}</strong>
              </span>
            </div>
            <div className="flex items-center justify-between gap-1.5 pt-1.5">
              <span title="Tasa de evaluaciones aprobadas">
                Aprobadas: <strong className="text-emerald-600 dark:text-emerald-400">{approvalRate.rate}%</strong> ({approvalRate.passingCount}/{approvalRate.totalCount})
              </span>
              <span className="flex items-center gap-1 text-slate-400 font-medium" title="Evaluaciones pendientes de calificar">
                <Clock className="h-3 w-3 text-amber-500" />
                <strong>{pendingCount} pend.</strong>
              </span>
            </div>
          </div>
        )}

        {/* Acciones: Simular definitiva, Estadísticas & Ver detalle */}
        <div className="relative flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          {onOpenSimulator && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenSimulator(studentRow);
              }}
              className="h-7 flex-1 justify-center rounded-xl text-[10px] font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50/60 dark:border-indigo-800 dark:text-indigo-300 px-1"
            >
              <Calculator className="mr-1 h-3 w-3" />
              Simular
            </Button>
          )}

          {onOpenStudentStats && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenStudentStats(studentRow);
              }}
              className="h-7 flex-1 justify-center rounded-xl text-[10px] font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 px-1"
              title="Ver estadísticas y evolución del estudiante"
            >
              <BarChart3 className="mr-1 h-3 w-3 text-slate-500" />
              Stats
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onViewDetail?.();
            }}
            className="h-7 flex-1 justify-center rounded-xl text-[10px] font-semibold text-[var(--edc-primary)] hover:bg-[var(--edc-secondary)]/30 hover:text-[var(--edc-primary)] px-1"
          >
            Detalle
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

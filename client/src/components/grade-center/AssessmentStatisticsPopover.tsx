import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  X,
  Activity,
  Sparkles,
  Edit2,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
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
  onEditAssessment?: (
    assessmentId: number,
    data: { title?: string; weight?: number; date?: Date; description?: string }
  ) => Promise<void> | void;
  onFilterPending?: (assessmentId: number) => void;
  canEdit?: boolean;
  otherTotalWeight?: number;
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
  onEditAssessment,
  onFilterPending,
  canEdit = true,
  otherTotalWeight,
}: AssessmentStatisticsPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  return (
    <Popover
      open={isOpen}
      onOpenChange={openState => {
        setOpen(openState);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {isOpen && (
        <AssessmentStatisticsPopoverContent
          assessment={assessment}
          rows={rows}
          pendingGrades={pendingGrades}
          scale={scale}
          groupAverage={groupAverage}
          onEditAssessment={onEditAssessment}
          onFilterPending={onFilterPending}
          canEdit={canEdit}
          otherTotalWeight={otherTotalWeight}
          onClose={() => setOpen(false)}
        />
      )}
    </Popover>
  );
}

interface AssessmentStatisticsPopoverContentProps {
  assessment: Assessment;
  rows: GradeCenterTableRow[];
  pendingGrades?: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  groupAverage?: number | null;
  onEditAssessment?: (
    assessmentId: number,
    data: { title?: string; weight?: number; date?: Date; description?: string }
  ) => Promise<void> | void;
  onFilterPending?: (assessmentId: number) => void;
  canEdit?: boolean;
  otherTotalWeight?: number;
  onClose: () => void;
}

function AssessmentStatisticsPopoverContent({
  assessment,
  rows,
  pendingGrades = {},
  scale,
  groupAverage,
  onEditAssessment,
  onFilterPending,
  canEdit = true,
  otherTotalWeight,
  onClose,
}: AssessmentStatisticsPopoverContentProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [showFullStats, setShowFullStats] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const initialDateStr = React.useMemo(() => {
    if (!assessment.date) return "";
    try {
      return new Date(assessment.date).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }, [assessment.date]);

  const [formTitle, setFormTitle] = React.useState(assessment.title);
  const [formWeight, setFormWeight] = React.useState(String(assessment.weight));
  const [formDate, setFormDate] = React.useState(initialDateStr);
  const [formDescription, setFormDescription] = React.useState(assessment.description || "");

  // Sincronizar formulario si cambia la evaluación
  React.useEffect(() => {
    setFormTitle(assessment.title);
    setFormWeight(String(assessment.weight));
    setFormDate(initialDateStr);
    setFormDescription(assessment.description || "");
    setIsEditing(false);
  }, [assessment, initialDateStr]);

  // Cálculo determinista y en tiempo real de las estadísticas de la actividad (solo al estar abierto)
  const stats: AssessmentStatItem = React.useMemo(() => {
    return calculateAssessmentStatistics(assessment, rows, pendingGrades, scale, groupAverage);
  }, [assessment, rows, pendingGrades, scale, groupAverage]);

  const typeLabel = assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType;
  const avgTone = getPerformanceTone(stats.average);

  const maxAllowedWeight = otherTotalWeight !== undefined ? Math.max(0, 100 - otherTotalWeight) : 100;

  const handleSaveEdit = async () => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      toast.error("El nombre de la evaluación debe tener al menos 3 caracteres.");
      return;
    }

    const numWeight = Number(formWeight);
    if (isNaN(numWeight) || numWeight < 0 || numWeight > 100) {
      toast.error("El peso de la evaluación debe ser un número entre 0 y 100%.");
      return;
    }

    if (numWeight > maxAllowedWeight) {
      toast.error(`El peso no puede superar el ${maxAllowedWeight}% (la ponderación total no puede superar el 100%).`);
      return;
    }

    if (!onEditAssessment) return;

    try {
      setIsSaving(true);
      await onEditAssessment(assessment.id, {
        title: trimmedTitle,
        weight: numWeight,
        date: formDate ? new Date(formDate) : undefined,
        description: formDescription.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar la evaluación");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PopoverContent
      side="bottom"
      align="center"
      sideOffset={8}
      avoidCollisions={true}
      className={`${POPOVER_GLASS_PANEL_CLASS} w-84 text-left p-3.5 shadow-xl border border-slate-200/90 dark:border-slate-800`}
      onKeyDownCapture={e => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (isEditing) {
            setIsEditing(false);
          } else {
            onClose();
          }
        }
      }}
    >
      {/* Highlight de vidrio sutil superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-white/70 to-transparent dark:from-white/5" />

      {/* Encabezado con título, tipo y peso */}
      <div className="relative mb-3 flex items-start justify-between border-b border-slate-100/90 pb-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white"
              title={assessment.title}
            >
              {assessment.title}
            </h4>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-semibold text-[var(--edc-primary)]">
                {assessment.weight}%
              </span>
              <span>·</span>
              <span className="truncate">{typeLabel}</span>
              {assessment.maxValue && assessment.maxValue !== 5 && (
                <>
                  <span>·</span>
                  <span>Escala {assessment.maxValue}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && onEditAssessment && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              title="Editar evaluación"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar estadísticas de la evaluación"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* MODO EDICIÓN EN LÍNEA RÁPIDA (Fase 5.3-E) */}
      {isEditing ? (
        <div className="relative space-y-2.5 animate-in fade-in duration-150">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Nombre de la Evaluación
            </label>
            <Input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Ej. Parcial de cálculo"
              className="h-8 text-xs font-medium mt-1 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Peso (%)
                </label>
                <span className="text-[9px] text-slate-400">Máx: {maxAllowedWeight}%</span>
              </div>
              <Input
                type="number"
                min={0}
                max={maxAllowedWeight}
                value={formWeight}
                onChange={e => setFormWeight(e.target.value)}
                className="h-8 text-xs font-semibold mt-1 rounded-xl"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Fecha
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="h-8 text-xs mt-1 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Descripción / Criterio (Opcional)
            </label>
            <Input
              type="text"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Detalle o instrucciones breves"
              className="h-8 text-xs mt-1 rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="h-7.5 rounded-xl px-2.5 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="h-7.5 rounded-xl bg-[var(--edc-primary)] px-3 text-xs font-semibold text-white shadow-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        /* MODO VISUALIZACIÓN DE ESTADÍSTICAS */
        <div className="relative space-y-2.5">
          {/* Métricas Principales: Promedio, Mediana, Desviación Estándar */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* Promedio */}
            <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 text-center dark:border-slate-800 dark:bg-slate-850/50">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Promedio
              </span>
              <p className={`mt-0.5 text-base font-extrabold tracking-tight ${avgTone.textColor}`}>
                {numberValue(stats.average)}
              </p>
            </div>

            {/* Mediana */}
            <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 text-center dark:border-slate-800 dark:bg-slate-850/50">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Mediana
              </span>
              <p className="mt-0.5 text-base font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                {numberValue(stats.median)}
              </p>
            </div>

            {/* Desv. Estándar */}
            <div className="rounded-xl border border-slate-100/90 bg-slate-50/60 p-2 text-center dark:border-slate-800 dark:bg-slate-850/50">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400" title="Desviación Estándar (dispersión)">
                Desv. Est.
              </span>
              <p className="mt-0.5 text-base font-extrabold tracking-tight text-slate-700 dark:text-slate-300">
                {stats.standardDeviation !== null ? `±${stats.standardDeviation.toFixed(1)}` : "—"}
              </p>
            </div>
          </div>

          {/* Barra de progreso de avance y aprobación */}
          <div className="rounded-xl border border-slate-100/80 bg-slate-50/50 p-2 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-850/40">
            {/* Calificados vs Pendientes */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Progreso de calificación:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {stats.evaluatedCount} de {rows.length} ({rows.length > 0 ? Math.round((stats.evaluatedCount / rows.length) * 100) : 0}%)
              </span>
            </div>

            {/* Tasa de Aprobación */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Tasa de aprobación:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {stats.passingPercentage}% ({stats.passingCount}/{stats.evaluatedCount})
              </span>
            </div>
          </div>

          {/* Acciones Rápidas: Filtrar pendientes / Expandir estadísticas completas */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            {stats.pendingCount > 0 && onFilterPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onFilterPending(assessment.id);
                  onClose();
                }}
                className="h-7.5 flex-1 justify-center rounded-xl text-xs font-semibold text-amber-700 border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                title="Filtrar en la tabla los estudiantes que tienen esta evaluación sin calificar"
              >
                <Clock className="mr-1.5 h-3 w-3" />
                Pendientes ({stats.pendingCount})
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFullStats(prev => !prev)}
              className="h-7.5 rounded-xl px-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              title={showFullStats ? "Ocultar detalles" : "Ver estadísticas completas"}
            >
              {showFullStats ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* SECCIÓN EXPANDIBLE DE ESTADÍSTICAS DETALLADAS */}
          {showFullStats && (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
              {/* Rango Real Mínimo - Máximo */}
              {stats.evaluatedCount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                  <span className="font-semibold text-slate-500">Rango registrado:</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-rose-600 dark:text-rose-400">Mín: {numberValue(stats.minGrade)}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Máx: {numberValue(stats.maxGrade)}</span>
                  </div>
                </div>
              )}

              {/* Mini Distribución */}
              <div className="rounded-xl border border-slate-100/80 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-850/40">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-indigo-500" /> Distribución
                  </span>
                  <span className="text-slate-400 font-normal">
                    {stats.passingCount} aprob. · {stats.evaluatedCount - stats.passingCount} reprob.
                  </span>
                </div>

                <div className="flex h-2 w-full gap-0.5 rounded-md overflow-hidden bg-slate-200/50 dark:bg-slate-700/50">
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
              </div>

              {/* Interpretación Pedagógica */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2 text-[11px] dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-start gap-1.5 text-indigo-950 dark:text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                  <p className="leading-snug text-[10px]">
                    {stats.interpretation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PopoverContent>
  );
}

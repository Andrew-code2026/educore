import { memo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Pencil, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TYPE_META } from "../../data/curriculum";
import { LEVELS } from "../../domain/scale";
import type { EvaluationMetric } from "../../domain/metrics";
import { formatGrade, formatLongDate } from "../../lib/format";
import { useGradeCenterActions } from "../../state/GradeCenterContext";
import type { Density, Evaluation } from "../../types";
import { createResizeHandler } from "./resize";
import { useGradeCenterDialogs } from "../dialogs/DialogsProvider";

interface EvaluationHeaderProps {
  evaluation: Evaluation;
  metric: EvaluationMetric;
  /** Ancho realmente visible (incluye el espacio libre repartido). */
  width: number;
  /** Ancho persistido por el docente; base del redimensionado. */
  baseWidth: number;
  density: Density;
  isSelected: boolean;
  headerHeight: number;
  readOnly: boolean;
}

/**
 * Encabezado de evaluación: nombre, ponderación, promedio y avance. El resto
 * del detalle y las acciones viven en el menú que abre al hacer clic.
 */
export const EvaluationHeader = memo(function EvaluationHeader({
  evaluation,
  metric,
  width,
  baseWidth,
  density,
  isSelected,
  headerHeight,
  readOnly,
}: EvaluationHeaderProps) {
  const { resizeColumn, selectEvaluation, patchFilters } = useGradeCenterActions();
  const dialogs = useGradeCenterDialogs();
  const [open, setOpen] = useState(false);
  const type = TYPE_META[evaluation.type];
  const compact = density === "compact" || width < 96;
  const isPreparing = evaluation.status === "preparing";
  const progressColor = metric.level ? LEVELS[metric.level].color : "var(--gc-cobalt)";

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <th
      scope="col"
      className={cn("gc-solid-deep gc-hair-v sticky top-0 z-40 p-0 text-left align-top font-normal", isSelected && "gc-head-selected")}
      style={{ height: headerHeight }}
      aria-label={`${evaluation.code} ${evaluation.name}, ${evaluation.weight}%`}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => selectEvaluation(evaluation.id)}
            title={`${evaluation.code} · ${evaluation.name}`}
            className="flex h-full w-full flex-col justify-center gap-1 px-2.5 text-left transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="flex w-full items-center gap-1.5">
              <span className={cn("min-w-0 flex-1 truncate text-xs font-semibold text-foreground", isPreparing && "text-muted-foreground")}>
                {compact ? evaluation.code : evaluation.name}
              </span>
              <span className="gc-num shrink-0 text-xs font-semibold text-muted-foreground" title="Ponderación">{evaluation.weight}%</span>
            </span>
            {!compact && (
              <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">
                  {evaluation.code} · {isPreparing ? "En preparación" : type.short}
                </span>
                <span className="gc-num shrink-0" title="Promedio del grupo">
                  Prom. <span className="font-semibold text-foreground/85">{formatGrade(metric.avg)}</span>
                </span>
              </span>
            )}
            <span
              className="relative h-[3px] w-full overflow-hidden rounded-full bg-foreground/10"
              title={`${metric.evaluatedPct}% calificado`}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${metric.evaluatedPct}%`, backgroundColor: progressColor, opacity: 0.8 }}
              />
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="gc-popover w-[min(300px,calc(100vw-24px))] rounded-2xl p-0"
        >
          <div className="px-3.5 pt-3 pb-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {evaluation.code} · {type.label}
                  {isPreparing && " · En preparación"}
                </div>
                <div className="mt-0.5 text-sm leading-snug font-semibold">{evaluation.name}</div>
              </div>
              <span className="gc-num shrink-0 rounded-lg bg-foreground/6 px-1.5 py-0.5 text-xs font-semibold text-foreground/80">
                {evaluation.weight}%
              </span>
            </div>
            {evaluation.date && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden />
                {formatLongDate(evaluation.date)}
              </div>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              <HeaderStat label="Promedio" value={formatGrade(metric.avg)} color={metric.level ? LEVELS[metric.level].color : undefined} />
              <HeaderStat label="Calificados" value={`${metric.gradedCount}`} />
              <HeaderStat label="Pendientes" value={`${metric.pending}`} />
            </dl>
          </div>

          <div className="border-t border-white/8 p-1.5" role="menu" aria-label={`Acciones de ${evaluation.code}`}>
            <MenuItem
              icon={<Clock className="size-3.5" />}
              label={`Ver pendientes (${metric.pending})`}
              disabled={metric.pending === 0}
              onClick={() => run(() => patchFilters({ evaluationId: evaluation.id, evaluationState: "pending" }))}
            />
            <MenuItem
              icon={<CheckCircle2 className="size-3.5" />}
              label={`Ver calificados (${metric.gradedCount})`}
              disabled={metric.gradedCount === 0}
              onClick={() => run(() => patchFilters({ evaluationId: evaluation.id, evaluationState: "graded" }))}
            />
            {!readOnly && (
              <>
                <MenuItem
                  icon={<PenLine className="size-3.5" />}
                  label="Calificar en bloque"
                  onClick={() => run(() => dialogs.openBulkGrade(evaluation.id))}
                />
                <MenuItem
                  icon={<Pencil className="size-3.5" />}
                  label="Editar evaluación"
                  onClick={() => run(() => dialogs.openEditEvaluation(evaluation.id))}
                />
                <div className="my-1 h-px bg-white/8" role="separator" />
                <MenuItem
                  icon={<Trash2 className="size-3.5" />}
                  label="Eliminar evaluación"
                  danger
                  onClick={() => run(() => dialogs.openDeleteEvaluation(evaluation.id))}
                />
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <span
        className="gc-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ajustar ancho de ${evaluation.name}`}
        onPointerDown={createResizeHandler(baseWidth, (next) => resizeColumn(evaluation.id, next))}
      />
    </th>
  );
});

function HeaderStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white/4 px-1.5 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="gc-num text-sm font-semibold" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-white/8 disabled:pointer-events-none disabled:opacity-45",
        danger ? "text-[var(--destructive)]" : "text-foreground/90",
      )}
    >
      <span className={danger ? undefined : "text-muted-foreground"}>{icon}</span>
      {label}
    </button>
  );
}

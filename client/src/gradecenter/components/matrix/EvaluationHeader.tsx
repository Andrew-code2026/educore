import { CalendarDays, Layers, Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TYPE_META } from "../../data/curriculum";
import { levelTint } from "../../domain/scale";
import type { EvaluationMetric } from "../../domain/metrics";
import { abbreviateToWidth, formatGrade, formatLongDate, formatShortDate } from "../../lib/format";
import { useGradeCenter } from "../../state/GradeCenterContext";
import type { Evaluation } from "../../types";
import { createResizeHandler } from "./resize";
import { LevelBadge } from "../insights/primitives";
import { announcePopover, useExclusivePopover } from "../popovers/exclusivePopover";
import { BulkGradeDialog } from "../BulkGradeDialog";
import { EditEvaluationDialog } from "../EditEvaluationDialog";

interface EvaluationHeaderProps {
  evaluation: Evaluation;
  metric: EvaluationMetric;
  /** Ancho realmente visible (incluye el espacio libre repartido). */
  width: number;
  /** Ancho persistido por el docente; base del redimensionado. */
  baseWidth: number;
  density: "compact" | "standard" | "cozy";
  isSelected: boolean;
  headerHeight: number;
}

/**
 * Encabezado adaptativo: comunica nombre, código, porcentaje, tipo, fecha,
 * promedio, porcentaje evaluado y pendientes — comprimiéndose por densidad y
 * por ancho real sin perder ninguna de esas piezas (hover y clic las revelan).
 */
export function EvaluationHeader({
  evaluation,
  metric,
  width,
  baseWidth,
  density,
  isSelected,
  headerHeight,
}: EvaluationHeaderProps) {
  const { resizeColumn, selectEvaluation, setFilters, preferences, students, removeEvaluation } = useGradeCenter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  useExclusivePopover(() => setPopoverOpen(false));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const type = TYPE_META[evaluation.type];
  const compact = density === "compact";
  const cozy = density === "cozy";
  const metricLevel = metric.level ?? "basico";
  const isPreparing = evaluation.status === "preparing";

  // Comportamiento adaptativo según el ancho disponible.
  const tight = width < 76;
  const narrow = width < 108;

  const name =
    tight || compact
      ? abbreviateToWidth(type.short, Math.max(4, Math.floor(width / 6.4)))
      : narrow
        ? evaluation.shortName
        : abbreviateToWidth(evaluation.name, Math.max(8, Math.floor(width / 6.6)));

  const pendingStudents = students.filter((metrics) => metrics.pendingCount > 0).length;

  return (
    <th
      className={cn(
        "gc-solid-deep gc-hair-v sticky top-0 z-40 p-0 align-top",
        isSelected && "ring-1 ring-[var(--gc-cobalt)] ring-inset",
      )}
      style={{ height: headerHeight }}
    >
      <Popover open={popoverOpen} onOpenChange={(next) => { if (next) announcePopover(); setPopoverOpen(next); }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => selectEvaluation(evaluation.id)}
                  style={{ background: levelTint(metricLevel, isSelected ? 0.19 : 0.08) }}
                  className={cn(
                  "group/head relative flex h-full w-full flex-col justify-between gap-1.5 overflow-hidden border-t-2 border-t-transparent px-2.5 pt-2 pb-1.5 text-left transition-[background,border-color,transform] duration-200",
                  isSelected ? "border-t-[var(--gc-cobalt)] shadow-[inset_0_-1px_0_var(--gc-cobalt)]" : "hover:-translate-y-px hover:border-t-[var(--gc-cobalt)]/60",
                )}
                >
                <span className="pointer-events-none absolute -right-5 -top-7 size-16 rounded-full bg-[var(--gc-cobalt)]/10 blur-xl transition-transform duration-300 group-hover/head:scale-150" />
                <div className="relative flex w-full items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="gc-num flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--gc-cobalt)]/25 bg-[var(--gc-cobalt)]/12 text-[9px] font-bold text-[var(--gc-cobalt)]">{evaluation.code}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[10.5px] font-semibold leading-tight text-foreground">{name}</div>
                      <div className="mt-0.5 truncate text-[8.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{type.short}{isPreparing ? " · Prep." : ""}</div>
                    </div>
                  </div>
                  <span className="gc-num shrink-0 rounded-lg border border-[var(--gc-cobalt)]/25 bg-[var(--gc-cobalt)]/12 px-1.5 py-1 text-[10px] font-bold text-[var(--gc-cobalt)]">{evaluation.weight}%</span>
                </div>
                {!tight && (
                  <div className="flex w-full items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span className="gc-num font-medium">Prom. <span className="font-bold text-foreground">{formatGrade(metric.avg)}</span></span>
                    {!narrow && <><span className="opacity-40">·</span><span className="gc-num">{metric.evaluatedPct}% avance</span></>}
                    {!narrow && <span className="ml-auto gc-num">{metric.pending} pend.</span>}
                  </div>
                )}
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{
                      width: `${metric.evaluatedPct}%`,
                      background: levelTint(metricLevel, 0.9),
                    }}
                  />
                </div>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center" className="max-w-72">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold">
                  {evaluation.code} · {evaluation.name}
                </span>
                <span className="gc-num text-[11px] font-semibold text-[var(--gc-cobalt)]">
                  {evaluation.weight}%
                </span>
              </div>
              <div className="text-[10px] opacity-80">
                {type.label} · {formatLongDate(evaluation.date)} · {evaluation.period}
              </div>
              <div className="flex items-center gap-3 text-[10px] opacity-90">
                <span className="gc-num">Promedio {formatGrade(metric.avg)}</span>
                <span className="gc-num">{metric.evaluatedPct}% evaluado</span>
                <span className="gc-num">
                  {metric.pending} {metric.pending === 1 ? "pendiente" : "pendientes"}
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        <PopoverContent side="bottom" align="start" sideOffset={8} collisionPadding={12} avoidCollisions className="glass-strong max-h-[min(720px,calc(100dvh-24px))] w-[min(22rem,calc(100vw-24px))] overflow-y-auto rounded-3xl border-white/10 p-4 shadow-[0_24px_70px_-28px_color-mix(in_oklab,var(--gc-cobalt)_50%,transparent)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="gc-num text-[11px] font-semibold text-[var(--gc-cobalt)]">
                  {evaluation.code}
                </span>
                <span className="gc-num rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px]">
                  {evaluation.weight}%
                </span>
                {isPreparing && <span className="rounded-full border border-[var(--gc-basico)]/30 bg-[var(--gc-basico)]/10 px-1.5 py-px text-[9px] text-[var(--gc-basico)]">En preparación</span>}
              </div>
              <div className="mt-1 text-sm font-semibold">{evaluation.name}</div>
            </div>
            <LevelBadge level={metric.level} score={metric.avg} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <InfoRow icon={<Layers className="size-3" />} label="Tipo" value={type.label} />
            <InfoRow
              icon={<CalendarDays className="size-3" />}
              label="Fecha"
              value={formatShortDate(evaluation.date)}
            />
            <InfoRow
              icon={<Users className="size-3" />}
              label="Evaluados"
              value={`${metric.gradedCount} de ${metric.gradedCount + metric.pending}`}
            />
            <InfoRow
              icon={<Users className="size-3" />}
              label="Avance"
              value={`${metric.evaluatedPct}%`}
            />
          </div>

          {evaluation.dbaIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {evaluation.dbaIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {id.replace("dba-", "DBA ")}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() =>
                setFilters({
                  ...preferences.filters,
                  evaluationId: evaluation.id,
                  evaluationState: "pending",
                })
              }
              className="flex-1 rounded-xl border border-white/10 bg-white/4 px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            >
              Ver pendientes ({metric.pending})
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  ...preferences.filters,
                  evaluationId: evaluation.id,
                  evaluationState: "graded",
                })
              }
              className="flex-1 rounded-xl border border-white/10 bg-white/4 px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            >
              Ver calificados
            </button>
          </div>
          {pendingStudents > 0 && (
            <div className="mt-2 text-center text-[10px] text-muted-foreground">
              {pendingStudents} estudiantes del grupo tienen evaluaciones pendientes
            </div>
          )}

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={() => { setPopoverOpen(false); setEditOpen(true); }} className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/12 px-2 py-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-[var(--gc-cobalt)]/20"><Pencil className="size-3" />Editar evaluación</button>
            <button
              type="button"
              aria-label={`Eliminar ${evaluation.code}`}
              onClick={async () => {
                const hasGrades = metric.gradedCount > 0;
                const message = hasGrades
                  ? `¿Eliminar "${evaluation.code} · ${evaluation.name}"?\n\n` +
                    `ATENCIÓN: Esta evaluación contiene ${metric.gradedCount} calificación(es) registrada(s). ` +
                    `La eliminación liberará el ${evaluation.weight}% de ponderación y marcará la evaluación como inactiva en el servidor, ` +
                    `preservando los registros para auditoría escolar.\n\n¿Deseas continuar?`
                  : `¿Eliminar la evaluación "${evaluation.code} · ${evaluation.name}" (${evaluation.weight}%)? Esta acción liberará la ponderación asignada.`;

                if (window.confirm(message)) {
                  setPopoverOpen(false);
                  await removeEvaluation(evaluation.id);
                }
              }}
              className="rounded-xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/8 px-3 py-2 text-[var(--gc-bajo)] transition-colors hover:bg-[var(--gc-bajo)]/15"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setPopoverOpen(false); setBulkOpen(true); }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/10 px-2 py-1.5 text-[10px] font-semibold text-foreground hover:bg-[var(--gc-cobalt)]/18"
          >
            <Pencil className="size-3" /> Calificar esta evaluación a muchos estudiantes
          </button>
        </PopoverContent>
      </Popover>

      <EditEvaluationDialog evaluation={evaluation} open={editOpen} onOpenChange={setEditOpen} />
      <BulkGradeDialog open={bulkOpen} onOpenChange={setBulkOpen} initialEvaluationId={evaluation.id} />

      {/* Redimensionado de columna */}
      <span
        className="gc-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ajustar ancho de ${evaluation.name}`}
        onPointerDown={createResizeHandler(baseWidth, (next) => resizeColumn(evaluation.id, next))}
      />
    </th>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-[11px] font-medium">{value}</div>
    </div>
  );
}

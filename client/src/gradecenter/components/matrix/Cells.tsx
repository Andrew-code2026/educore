import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StudentMetrics } from "../../domain/metrics";
import { LEVELS, levelTint } from "../../domain/scale";
import { formatGrade, initials, pluralize, studentDisplayName } from "../../lib/format";
import { createResizeHandler } from "./resize";
import { LevelDot } from "../insights/primitives";
import { StudentPopover } from "../popovers/StudentPopover";
import { useGradeCenter } from "../../state/GradeCenterContext";

/* -------------------------------------------------------------------------- */
/* Columna del estudiante (sticky izquierda)                                  */
/* -------------------------------------------------------------------------- */

export function StudentHeaderCell({ width, headerHeight }: { width: number; headerHeight: number }) {
  const { resizeStudentColumn, selectedRows, selectAllVisible, students } = useGradeCenter();
  const allSelected = students.length > 0 && selectedRows.length === students.length;
  return (
    <th
      className="gc-solid-deep gc-hair-v sticky top-0 left-0 z-50 p-0 align-middle"
      style={{ width, minWidth: width, maxWidth: width, height: headerHeight }}
    >
      <div className="flex h-full items-center justify-between gap-2 px-3">
        <label className="flex items-center gap-1.5" title="Seleccionar todos los estudiantes visibles">
          <input
            type="checkbox"
            aria-label="Seleccionar todos los estudiantes visibles"
            checked={allSelected}
            onChange={selectAllVisible}
            className="size-3 accent-[var(--gc-cobalt)]"
          />
          <span className="gc-label text-[9px]">Estudiante</span>
        </label>
        <span className="gc-num text-[9px] text-muted-foreground/70">Definitiva →</span>
      </div>
      <span
        className="gc-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho de la columna de estudiante"
        onPointerDown={createResizeHandler(width, resizeStudentColumn)}
      />
    </th>
  );
}

export function StudentCell({
  metrics,
  width,
  height,
  density,
  isSelected,
}: {
  metrics: StudentMetrics;
  width: number;
  height: number;
  density: "compact" | "standard" | "cozy";
  isSelected: boolean;
}) {
  const { selectStudent, selectedRows, toggleRowSelection } = useGradeCenter();
  const compact = density === "compact";
  const rowSelected = selectedRows.includes(metrics.student.id);
  const levelId = metrics.level ?? "basico";
  const nameWidth = Math.max(10, Math.floor((width - (compact ? 62 : 74)) / 6.6));

  return (
    <td
      className={cn(
        "gc-solid gc-hair-v sticky left-0 z-30 p-0 align-middle",
        isSelected && "bg-[var(--gc-cobalt)]/10",
      )}
      style={{ width, minWidth: width, maxWidth: width, height }}
    >
      <StudentPopover metrics={metrics}>
        <div className={cn("group/student flex h-full w-full items-center gap-2.5 px-3 text-left transition-colors", rowSelected ? "bg-[var(--gc-cobalt)]/14" : "hover:bg-white/6")}>
          <input
            type="checkbox"
            aria-label={`Seleccionar fila de ${metrics.student.fullName}`}
            checked={rowSelected}
            onChange={() => toggleRowSelection(metrics.student.id)}
            onClick={(event) => event.stopPropagation()}
            className="size-3 shrink-0 accent-[var(--gc-cobalt)]"
          />
          <button type="button" onClick={() => selectStudent(metrics.student.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className={cn("relative flex shrink-0 items-center justify-center rounded-lg border font-semibold", compact ? "size-6 text-[10px]" : "size-7 text-[11px]")} style={{ borderColor: levelTint(levelId, 0.4), backgroundColor: levelTint(levelId, 0.16), color: metrics.level ? LEVELS[metrics.level].color : "var(--muted-foreground)" }}>
              {initials(metrics.student)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-medium text-foreground/90", compact ? "text-[11.5px]" : "text-[12.5px]")}>{studentDisplayName(metrics.student, nameWidth)}</span>
              {!compact && <span className="mt-0.5 flex items-center gap-1.5">
                <span className="gc-num text-[9.5px] text-muted-foreground/80">{metrics.student.code}</span>
                {metrics.pendingCount > 0 && <span className="gc-num flex items-center gap-0.5 text-[9.5px] text-[var(--gc-bajo)]"><Clock className="size-2.5" />{metrics.pendingCount}</span>}
                {metrics.attention && <span className="flex items-center gap-0.5 text-[9.5px] text-[var(--gc-bajo)]"><AlertTriangle className="size-2.5" /></span>}
                {metrics.complete && !metrics.attention && <CheckCircle2 className="size-2.5 text-[var(--gc-alto)]/70" />}
              </span>}
            </span>
          </button>
        </div>
      </StudentPopover>
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Columna de definitiva (sticky derecha)                                     */
/* -------------------------------------------------------------------------- */

export function DefinitivaHeaderCell({ width, headerHeight }: { width: number; headerHeight: number }) {
  const { resizeDefinitivaColumn } = useGradeCenter();
  return (
    <th
      className="gc-solid-deep gc-hair-l sticky top-0 right-0 z-50 p-0 align-middle"
      style={{ width, minWidth: width, maxWidth: width, height: headerHeight }}
    >
      <div className="flex h-full flex-col justify-center px-3">
        <span className="gc-label text-[9px] text-foreground/80">Definitiva</span>
        <span className="text-[9px] text-muted-foreground/70">Ponderada del periodo</span>
      </div>
      <span
        className="gc-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho de la definitiva"
        onPointerDown={createResizeHandler(width, resizeDefinitivaColumn)}
      />
    </th>
  );
}

/**
 * La definitiva nunca desaparece: es sticky, compacta y visualmente la pieza
 * más importante de cada fila.
 */
export function DefinitivaCell({
  metrics,
  width,
  height,
  density,
}: {
  metrics: StudentMetrics;
  width: number;
  height: number;
  density: "compact" | "standard" | "cozy";
}) {
  const { selectStudent } = useGradeCenter();
  const compact = density === "compact";
  const level = metrics.level;

  const tooltip = (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="gc-num text-base font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>
          {formatGrade(metrics.definitiva)}
        </span>
        <span className="text-[11px] font-medium">{level ? LEVELS[level].label : "Sin evaluar"}</span>
      </div>
      <div className="text-[10px] opacity-85">
        {metrics.evaluatedPct}% evaluado · {metrics.gradedCount} de {metrics.outcomes.length}{" "}
        {pluralize(metrics.outcomes.length, "evaluación", "evaluaciones")}
      </div>
      {metrics.pendingCount > 0 && (
        <div className="text-[10px] text-[var(--gc-bajo)]">
          {metrics.pendingCount} {pluralize(metrics.pendingCount, "pendiente", "pendientes")}
        </div>
      )}
      {metrics.provisional && (
        <div className="text-[10px] opacity-80">Definitiva provisional: falta calificar más evaluaciones</div>
      )}
      <div className="text-[10px] opacity-70">{LEVELS[level ?? "basico"].range} · escala institucional</div>
    </div>
  );

  return (
    <td
      className="gc-solid gc-hair-l sticky right-0 z-30 p-0 align-middle"
      style={{ width, minWidth: width, maxWidth: width, height }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <StudentPopover metrics={metrics}>
            <button
              type="button"
              onClick={() => selectStudent(metrics.student.id)}
            className="group/def flex h-full w-full flex-col justify-center px-3 text-left transition-colors hover:bg-white/6"
            style={{
              backgroundColor: level ? levelTint(level, 0.1) : undefined,
              boxShadow: level ? `inset 3px 0 0 0 ${levelTint(level, 0.85)}` : undefined,
            }}
          >
            <span className="flex items-baseline gap-1.5">
              <span
                className={cn("gc-num font-semibold tabular-nums", compact ? "text-[14px]" : "text-[16px]")}
                style={{
                  color: level ? LEVELS[level].color : "var(--muted-foreground)",
                  textShadow: level ? `0 0 20px ${levelTint(level, 0.5)}` : undefined,
                }}
              >
                {formatGrade(metrics.definitiva)}
              </span>
              {!compact && (
                <span className="truncate text-[10px] font-medium text-foreground/70">
                  {level ? LEVELS[level].short : "—"}
                </span>
              )}
            </span>

            {!compact ? (
              <span className="mt-1 flex items-center gap-1.5">
                <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                    style={{
                      width: `${metrics.evaluatedPct}%`,
                      backgroundColor: level ? LEVELS[level].color : "var(--muted-foreground)",
                      opacity: 0.85,
                    }}
                  />
                </span>
                <span className="gc-num text-[9px] text-muted-foreground">{metrics.evaluatedPct}%</span>
              </span>
            ) : (
              <span className="mt-0.5 flex items-center gap-1">
                <LevelDot level={level} className="size-1.5" />
                <span className="gc-num text-[9px] text-muted-foreground">{metrics.evaluatedPct}%</span>
              </span>
            )}
            </button>
          </StudentPopover>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-64">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </td>
  );
}

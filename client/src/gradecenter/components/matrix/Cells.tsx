import { memo, useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentMetrics } from "../../domain/metrics";
import { LEVELS, levelTint } from "../../domain/scale";
import { formatGrade, initials, studentDisplayName } from "../../lib/format";
import { createResizeHandler } from "./resize";
import { StudentPopover } from "../popovers/StudentPopover";
import { useGradeCenterActions } from "../../state/GradeCenterContext";
import type { Density } from "../../types";

/* -------------------------------------------------------------------------- */
/* Columna del estudiante (sticky izquierda)                                  */
/* -------------------------------------------------------------------------- */

export const StudentHeaderCell = memo(function StudentHeaderCell({
  width,
  headerHeight,
  visibleCount,
  selectedCount,
}: {
  width: number;
  headerHeight: number;
  visibleCount: number;
  selectedCount: number;
}) {
  const { resizeStudentColumn, selectAllVisible } = useGradeCenterActions();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const allSelected = visibleCount > 0 && selectedCount === visibleCount;

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  return (
    <th
      scope="col"
      className="gc-solid-deep gc-hair-v sticky top-0 left-0 z-50 p-0 text-left align-middle"
      style={{ width, minWidth: width, maxWidth: width, height: headerHeight }}
    >
      <div className="flex h-full items-center gap-2.5 px-3">
        <input
          ref={checkboxRef}
          type="checkbox"
          aria-label="Seleccionar todos los estudiantes visibles"
          checked={allSelected}
          onChange={selectAllVisible}
          className="gc-row-check size-3.5 shrink-0 accent-[var(--gc-cobalt)]"
        />
        <span className="text-xs font-semibold text-foreground/85">Estudiante</span>
        <span className="gc-num text-xs text-muted-foreground">
          {selectedCount > 0 ? `${selectedCount} sel.` : visibleCount}
        </span>
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
});

export const StudentCell = memo(function StudentCell({
  metrics,
  width,
  height,
  density,
  rowSelected,
  isSelected,
}: {
  metrics: StudentMetrics;
  width: number;
  height: number;
  density: Density;
  rowSelected: boolean;
  isSelected: boolean;
}) {
  const { selectStudent, toggleRowSelection } = useGradeCenterActions();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const compact = density === "compact";
  const level = metrics.level;
  const nameWidth = Math.max(10, Math.floor((width - (compact ? 64 : 76)) / 6));

  return (
    <th
      scope="row"
      className={cn(
        "gc-solid gc-hair-v sticky left-0 z-30 p-0 text-left align-middle font-normal",
        (rowSelected || isSelected) && "gc-solid-selected",
      )}
      style={{ width, minWidth: width, maxWidth: width, height }}
    >
      <div className="flex h-full w-full items-center gap-2.5 px-3">
        <input
          type="checkbox"
          aria-label={`Seleccionar a ${metrics.student.fullName}`}
          checked={rowSelected}
          onChange={() => toggleRowSelection(metrics.student.id)}
          className="gc-row-check size-3.5 shrink-0 accent-[var(--gc-cobalt)]"
        />
        <button
          type="button"
          onClick={() => {
            selectStudent(metrics.student.id);
            setSummaryOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={summaryOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full font-semibold",
              compact ? "size-6 text-[10px]" : "size-7 text-xs",
            )}
            style={{
              backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
              color: level ? LEVELS[level].color : "var(--muted-foreground)",
            }}
          >
            {initials(metrics.student)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-medium text-foreground/90", compact ? "text-xs" : "text-[13px]")}>
              {studentDisplayName(metrics.student, nameWidth)}
            </span>
            {!compact && (
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="gc-num">{metrics.student.code}</span>
                {metrics.pendingCount > 0 && (
                  <span className="gc-num inline-flex items-center gap-0.5" title={`${metrics.pendingCount} evaluaciones pendientes`}>
                    <Clock className="size-3" aria-hidden />
                    {metrics.pendingCount}
                    <span className="sr-only"> pendientes</span>
                  </span>
                )}
                {metrics.attention && (
                  <span className="inline-flex items-center text-[var(--gc-bajo)]" title="Requiere atención">
                    <AlertTriangle className="size-3" aria-hidden />
                    <span className="sr-only">Requiere atención</span>
                  </span>
                )}
              </span>
            )}
          </span>
        </button>
      </div>
      {summaryOpen && (
        <StudentPopover
          metrics={metrics}
          anchor={<span aria-hidden className="pointer-events-none absolute inset-0" />}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </th>
  );
});

/* -------------------------------------------------------------------------- */
/* Columna de definitiva (sticky derecha)                                     */
/* -------------------------------------------------------------------------- */

export const DefinitivaHeaderCell = memo(function DefinitivaHeaderCell({
  width,
  headerHeight,
}: {
  width: number;
  headerHeight: number;
}) {
  const { resizeDefinitivaColumn } = useGradeCenterActions();
  return (
    <th
      scope="col"
      className="gc-solid-deep gc-hair-l sticky top-0 right-0 z-50 p-0 text-left align-middle"
      style={{ width, minWidth: width, maxWidth: width, height: headerHeight }}
      title="Promedio ponderado por la ponderación de cada evaluación calificada"
    >
      <div className="flex h-full flex-col justify-center px-3">
        <span className="text-xs font-semibold text-foreground/85">Definitiva</span>
        <span className="text-xs text-muted-foreground">Ponderada</span>
      </div>
      <span
        className="gc-resizer gc-resizer-left"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho de la definitiva"
        onPointerDown={createResizeHandler(width, resizeDefinitivaColumn, -1)}
      />
    </th>
  );
});

/** La definitiva nunca desaparece: es sticky y la pieza más visible de cada fila. */
export const DefinitivaCell = memo(function DefinitivaCell({
  metrics,
  width,
  height,
  density,
}: {
  metrics: StudentMetrics;
  width: number;
  height: number;
  density: Density;
}) {
  const { selectStudent } = useGradeCenterActions();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const compact = density === "compact";
  const level = metrics.level;
  const color = level ? LEVELS[level].color : "var(--muted-foreground)";

  return (
    <td
      className="gc-solid gc-hair-l sticky right-0 z-30 p-0 align-middle"
      style={{ width, minWidth: width, maxWidth: width, height }}
    >
      <button
        type="button"
        onClick={() => {
          selectStudent(metrics.student.id);
          setSummaryOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Definitiva de ${metrics.student.fullName}: ${
          metrics.definitiva == null ? "sin notas" : `${formatGrade(metrics.definitiva)}, ${level ? LEVELS[level].label : ""}`
        }, ${metrics.evaluatedPct}% evaluado`}
        className="flex h-full w-full flex-col justify-center gap-1 px-3 text-left transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none focus-visible:ring-inset"
        style={level ? { boxShadow: `inset 3px 0 0 0 ${levelTint(level, 0.8)}` } : undefined}
      >
        {metrics.definitiva == null ? (
          <span className="text-xs text-muted-foreground">Sin notas</span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <span className={cn("gc-num font-semibold", compact ? "text-sm" : "text-base")} style={{ color }}>
              {formatGrade(metrics.definitiva)}
            </span>
            {!compact && level && <span className="truncate text-xs text-muted-foreground">{LEVELS[level].short}</span>}
          </span>
        )}
        {!compact && metrics.definitiva != null && (
          <span
            className="relative h-[3px] w-full overflow-hidden rounded-full bg-foreground/10"
            title={`${metrics.evaluatedPct}% de la ponderación evaluada${metrics.provisional ? " · provisional" : ""}`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${metrics.evaluatedPct}%`, backgroundColor: color, opacity: 0.75 }}
            />
          </span>
        )}
      </button>
      {summaryOpen && (
        <StudentPopover
          metrics={metrics}
          side="left"
          anchor={<span aria-hidden className="pointer-events-none absolute inset-0" />}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </td>
  );
});

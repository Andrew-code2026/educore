import { cn } from "@/lib/utils";
import { LEVELS } from "../../domain/scale";
import type { LevelId } from "../../types";

/** Orden de los tramos: de menor a mayor desempeño. */
export const LEVEL_SEGMENTS: LevelId[] = ["bajo", "basico", "alto", "superior"];

/**
 * Barra apilada por nivel. Lo que no suma a ningún nivel (pendientes, sin
 * definitiva) queda como el fondo gris de la barra: el total siempre es el grupo.
 */
export function LevelStack({
  counts,
  total,
  label,
  size = "sm",
  className,
}: {
  counts: Record<LevelId, number>;
  total: number;
  /** Descripción accesible de la barra. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={className}>
      <div className={cn("flex w-full overflow-hidden rounded-full bg-foreground/8", size === "md" ? "h-3" : "h-2")}>
        {total > 0 &&
          LEVEL_SEGMENTS.map((level) =>
            counts[level] > 0 ? (
              <span
                key={level}
                title={`${LEVELS[level].short}: ${counts[level]}`}
                style={{ width: `${(counts[level] / total) * 100}%`, backgroundColor: LEVELS[level].color }}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}

/** Leyenda compartida de los niveles. `restLabel` nombra la parte gris de la barra. */
export function LevelLegend({
  counts,
  restLabel,
  rest,
}: {
  counts?: Record<LevelId, number>;
  restLabel: string;
  rest?: number;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Niveles">
      {LEVEL_SEGMENTS.map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: LEVELS[level].color }} aria-hidden />
          {LEVELS[level].short}
          {counts ? (
            <span className="gc-num font-semibold text-foreground/85">{counts[level]}</span>
          ) : (
            <span className="gc-num opacity-80">{LEVELS[level].range}</span>
          )}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-foreground/15" aria-hidden />
        {restLabel}
        {rest != null && <span className="gc-num font-semibold text-foreground/85">{rest}</span>}
      </li>
    </ul>
  );
}

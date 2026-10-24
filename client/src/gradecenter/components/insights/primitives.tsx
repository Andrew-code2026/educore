import { cn } from "@/lib/utils";
import type { LevelId } from "../../types";
import {
  APPROVAL_GRADE,
  LEVEL_ORDER,
  LEVELS,
  MAX_GRADE,
  MIN_GRADE,
  levelFromScore,
  levelTint,
} from "../../domain/scale";
import { formatGrade } from "../../lib/format";
import type { TrendInfo } from "../../domain/metrics";

/* -------------------------------------------------------------------------- */
/* Nivel                                                                      */
/* -------------------------------------------------------------------------- */

export function LevelDot({ level, className }: { level: LevelId | null; className?: string }) {
  if (!level) return <span className={cn("size-2 rounded-full bg-white/20", className)} />;
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: LEVELS[level].color, boxShadow: `0 0 10px ${levelTint(level, 0.7)}` }}
    />
  );
}

export function LevelBadge({
  level,
  score,
  className,
  size = "sm",
}: {
  level: LevelId | null;
  score?: number | null;
  className?: string;
  size?: "xs" | "sm";
}) {
  const meta = level ? LEVELS[level] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "xs" ? "px-1.5 py-px text-xs" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={
        meta
          ? {
              color: meta.color,
              borderColor: levelTint(level as LevelId, 0.35),
              backgroundColor: levelTint(level as LevelId, 0.12),
            }
          : { color: "var(--muted-foreground)", borderColor: "oklch(1 0 0 / 10%)" }
      }
    >
      {meta ? meta.label : "Sin evaluar"}
      {score != null && <span className="gc-num opacity-80">{formatGrade(score)}</span>}
    </span>
  );
}

/** Barra de posición dentro de la escala institucional completa. */
export function LevelBar({
  score,
  className,
  showTicks = true,
}: {
  score: number | null;
  className?: string;
  showTicks?: boolean;
}) {
  const level = levelFromScore(score);
  const pct = score == null ? 0 : ((score - MIN_GRADE) / (MAX_GRADE - MIN_GRADE)) * 100;
  const approvalPct = ((APPROVAL_GRADE - MIN_GRADE) / (MAX_GRADE - MIN_GRADE)) * 100;

  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: level
            ? `linear-gradient(90deg, ${levelTint(level, 0.55)}, ${LEVELS[level].color})`
            : "transparent",
        }}
      />
      {showTicks && (
        <div
          className="absolute inset-y-0 w-px bg-white/35"
          style={{ left: `${approvalPct}%` }}
          title={`Umbral de aprobación ${formatGrade(APPROVAL_GRADE)}`}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline de evolución                                                     */
/* -------------------------------------------------------------------------- */

export function Sparkline({
  points,
  groupPoints,
  width = 132,
  height = 34,
  color,
  className,
}: {
  points: (number | null)[];
  groupPoints?: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const valid = points.map((value, index) => ({ index, value })).filter((p) => p.value != null);
  if (valid.length === 0) {
    return <div className={cn("text-xs text-muted-foreground", className)}>Sin datos suficientes</div>;
  }

  const stroke = color ?? LEVELS[levelFromScore(valid[valid.length - 1].value) ?? "basico"].color;
  const stepX = valid.length > 1 ? width / (valid.length - 1) : 0;
  const toY = (value: number) => height - ((value - MIN_GRADE) / (MAX_GRADE - MIN_GRADE)) * height;

  const path = valid
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${toY(p.value as number).toFixed(2)}`)
    .join(" ");

  const groupPath = groupPoints
    ? groupPoints
        .map((value, index) => ({ index, value }))
        .filter((p) => p.value != null)
        .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${toY(p.value as number).toFixed(2)}`)
        .join(" ")
    : null;

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const gradientId = `spark-${stroke.replace(/[^a-z0-9]/gi, "")}-${valid.length}`;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.34" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={toY(APPROVAL_GRADE)}
        x2={width}
        y2={toY(APPROVAL_GRADE)}
        stroke="oklch(1 0 0 / 16%)"
        strokeDasharray="3 3"
      />
      {groupPath && <path d={groupPath} fill="none" stroke="oklch(1 0 0 / 26%)" strokeWidth="1" strokeDasharray="2 3" />}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {valid.map((p, i) => (
        <circle key={p.index} cx={i * stepX} cy={toY(p.value as number)} r={2.1} fill={stroke} />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Distribución                                                               */
/* -------------------------------------------------------------------------- */

export function DistributionBars({
  distribution,
  total,
  className,
  dense = false,
}: {
  distribution: Record<LevelId, number>;
  total: number;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {LEVEL_ORDER.map((level) => {
        const count = distribution[level] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={level} className="flex items-center gap-2">
            <span className={cn("shrink-0 text-muted-foreground", dense ? "w-3 text-xs" : "w-16 text-xs")}>
              {dense ? LEVELS[level].short.charAt(0) : LEVELS[level].label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: levelTint(level, 0.85),
                  boxShadow: `0 0 12px ${levelTint(level, 0.5)}`,
                }}
              />
            </div>
            <span className="gc-num w-9 shrink-0 text-right text-xs text-muted-foreground">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barras verticales compactas para comparar evaluaciones. */
export function MicroBars({
  values,
  className,
  highlightIndex,
}: {
  values: (number | null)[];
  className?: string;
  highlightIndex?: number;
}) {
  return (
    <div className={cn("flex h-8 items-end gap-[3px]", className)}>
      {values.map((value, index) => {
        const level = levelFromScore(value);
        const height = value == null ? 6 : Math.max(8, ((value - MIN_GRADE) / (MAX_GRADE - MIN_GRADE)) * 100);
        return (
          <div
            key={index}
            className={cn(
              "flex-1 rounded-t-[3px] transition-all duration-300",
              index === highlightIndex && "ring-1 ring-white/40",
            )}
            style={{
              height: `${height}%`,
              background: level ? levelTint(level, index === highlightIndex ? 1 : 0.62) : "oklch(1 0 0 / 12%)",
            }}
            title={value == null ? "Pendiente" : formatGrade(value)}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tendencia                                                                  */
/* -------------------------------------------------------------------------- */

export function TrendStrip({ trend, className }: { trend: TrendInfo; className?: string }) {
  const tone =
    trend.direction === "up" ? LEVELS.alto.color : trend.direction === "down" ? LEVELS.bajo.color : "var(--muted-foreground)";
  const arrow = trend.direction === "up" ? "↗" : trend.direction === "down" ? "↘" : "→";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)} style={{ color: tone }}>
      <span className="text-[13px] leading-none">{arrow}</span>
      {trend.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Métricas                                                                   */
/* -------------------------------------------------------------------------- */

export function MetricTile({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass-soft rounded-xl px-3 py-2.5", className)}>
      <div className="gc-label text-xs">{label}</div>
      <div
        className="gc-num mt-1 text-lg leading-none font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ScoreChip({
  score,
  size = "md",
  emphasize = false,
}: {
  score: number | null;
  size?: "xs" | "sm" | "md" | "lg";
  emphasize?: boolean;
}) {
  const level = levelFromScore(score);
  const sizes: Record<string, string> = {
    xs: "text-xs",
    sm: "text-[13px]",
    md: "text-[15px]",
    lg: "text-2xl",
  };
  return (
    <span
      className={cn("gc-num font-semibold tabular-nums", sizes[size])}
      style={{
        color: level ? LEVELS[level].color : "var(--muted-foreground)",
        textShadow: emphasize && level ? `0 0 18px ${levelTint(level, 0.55)}` : undefined,
      }}
    >
      {formatGrade(score)}
    </span>
  );
}
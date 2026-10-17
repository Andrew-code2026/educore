/** Pulse Rail: avance de la jornada + estado semántico, siempre visible y filtrable. */
import { motion } from "framer-motion";
import { BadgeCheck, Check, CircleDot, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_DOT } from "../statusMeta";
import type { AttendanceFilter, AttendanceStatus, DayMetrics } from "../types";

interface DaySummaryRailProps {
  metrics: DayMetrics;
  activeFilter: AttendanceFilter;
  onFilter: (filter: AttendanceFilter) => void;
}

interface Segment {
  key: AttendanceFilter | "present" | "rate";
  label: string;
  value: number | null;
  status?: AttendanceStatus;
}

const SEGMENTS: Array<Omit<Segment, "value">> = [
  { key: "present", label: "Presentes", status: "present" },
  { key: "absent", label: "Ausentes", status: "absent" },
  { key: "late", label: "Tardanzas", status: "late" },
  { key: "excuse", label: "Excusas", status: "excuse" },
  { key: "pending", label: "Pendientes", status: "pending" },
  { key: "rate", label: "Asistencia" },
];

export function DaySummaryRail({ metrics, activeFilter, onFilter }: DaySummaryRailProps) {
  const hasRoster = metrics.total > 0;
  const recorded = hasRoster ? metrics.total - metrics.pending : 0;
  const hasRecorded = recorded > 0;
  const complete = hasRoster && metrics.pending === 0;
  const denominator = Math.max(1, metrics.total);

  const segments: Segment[] = SEGMENTS.map(segment => {
    if (!hasRoster) return { ...segment, value: null };
    if (segment.key === "rate") {
      return { ...segment, value: hasRecorded ? Math.round(metrics.attendanceRate) : null };
    }
    const value = segment.key === "present" ? metrics.present
      : segment.key === "absent" ? metrics.absent
        : segment.key === "late" ? metrics.late
          : segment.key === "excuse" ? metrics.excuse
            : metrics.pending;
    return { ...segment, value };
  });

  const progressSegments: Array<{ status: AttendanceStatus; value: number }> = [
    { status: "present", value: metrics.present },
    { status: "absent", value: metrics.absent },
    { status: "late", value: metrics.late },
    { status: "excuse", value: metrics.excuse },
  ];

  return (
    <section
      className="chrona-pulse chrona-pulse-premium glass relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] px-3.5 py-2.5 sm:px-4"
      aria-label="Progreso y resumen de la jornada"
    >
      <div className="chrona-pulse-summary flex min-w-[174px] items-center gap-2.5">
        <div className={cn("chrona-pulse-orb grid h-9 w-9 shrink-0 place-items-center rounded-full", complete && "chrona-pulse-complete")}>
          {complete ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : hasRoster ? (
            <CircleDot className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Users className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="tabular text-[15px] font-bold leading-none tracking-[-0.04em]">
              {hasRoster ? `${recorded}/${metrics.total}` : "—"}
            </span>
            <span className="chrona-overline">{hasRoster ? "registrados" : "sin lista"}</span>
          </div>
          <p className={cn("mt-1 truncate text-[10.5px] font-medium", complete ? "text-st-present" : "text-muted-foreground")}>
            {!hasRoster ? "Sin estudiantes asignados" : complete ? "Pase de lista completo" : `Quedan ${metrics.pending} por registrar`}
          </p>
        </div>
      </div>

      {hasRoster ? (
        <div
          className="chrona-progress-track relative h-[7px] min-w-[100px] flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={metrics.total}
          aria-valuenow={recorded}
          aria-label={`${recorded} de ${metrics.total} estudiantes registrados`}
        >
          <div className="absolute inset-0 flex">
            {progressSegments.map(segment => (
              <motion.span
                key={segment.status}
                className="chrona-progress-segment h-full"
                data-status={segment.status}
                initial={false}
                animate={{ width: `${(segment.value / denominator) * 100}%` }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="chrona-progress-track chrona-progress-empty relative h-[7px] min-w-[100px] flex-1 overflow-hidden rounded-full" aria-hidden="true" />
      )}

      <div className="chrona-pulse-metrics flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5">
        {segments.map(segment => {
          const clickable = hasRoster
            && segment.key !== "rate"
            && segment.key !== "present"
            && (segment.key !== "excuse" || (segment.value ?? 0) > 0);
          const isActive = clickable && activeFilter === segment.key;
          const valueLabel = segment.value === null
            ? hasRoster ? "sin registros" : "sin estudiantes"
            : `${segment.value}${segment.key === "rate" ? "%" : ""}`;
          return (
            <button
              key={segment.key}
              type="button"
              data-metric={segment.key}
              disabled={!clickable}
              onClick={() => clickable && onFilter(isActive ? "all" : (segment.key as AttendanceFilter))}
              aria-pressed={clickable ? isActive : undefined}
              aria-label={`${segment.label}: ${valueLabel}`}
              className={cn(
                "chrona-metric-chip flex h-8 items-center gap-1.5 rounded-[10px] px-2 transition-all",
                `chrona-metric-chip--${segment.key}`,
                clickable && "cursor-pointer hover:bg-foreground/[0.055]",
                !clickable && "cursor-default",
                isActive && "chrona-metric-active",
                segment.key === "pending" && segment.value !== null && segment.value > 0 && !isActive && "chrona-pending-pulse",
              )}
            >
              {segment.key === "excuse" ? (
                <BadgeCheck className="chrona-excuse-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : segment.status && segment.value !== null ? (
                <span className={cn("chrona-metric-dot h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[segment.status])} aria-hidden="true" />
              ) : segment.key === "rate" ? (
                <Sparkles className="h-3 w-3 shrink-0 text-[var(--chrona-cyan-strong)]" aria-hidden="true" />
              ) : null}
              <span className="chrona-metric-label text-[9.5px] font-medium text-muted-foreground">{segment.label}</span>
              <span className={cn("chrona-metric-value tabular text-[11px] font-bold", segment.key === "pending" && segment.value !== null && segment.value > 0 && "text-foreground")}>
                {segment.value ?? "—"}{segment.key === "rate" && segment.value !== null ? "%" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

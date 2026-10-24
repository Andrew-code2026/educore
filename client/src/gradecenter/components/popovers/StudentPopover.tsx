import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelTint } from "../../domain/scale";
import { approvalOutlook } from "../../domain/outlook";
import { formatDelta, formatGrade, initials } from "../../lib/format";
import type { StudentMetrics } from "../../domain/metrics";

/**
 * Resumen del estudiante. Solo se monta mientras está abierto: la matriz no
 * paga el costo de un popover por fila.
 */
export function StudentPopover({
  metrics,
  anchor,
  side = "right",
  onClose,
}: {
  metrics: StudentMetrics;
  anchor: ReactNode;
  side?: "left" | "right";
  onClose: () => void;
}) {
  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="glass-strong w-[min(320px,calc(100vw-24px))] rounded-2xl border-white/12 p-3 shadow-2xl"
      >
        <StudentSummary metrics={metrics} onClose={onClose} />
      </PopoverContent>
    </Popover>
  );
}

function StudentSummary({ metrics, onClose }: { metrics: StudentMetrics; onClose: () => void }) {
  const { analytics, jumpToStudent, setView } = useGradeCenter();
  const level = metrics.level;
  const groupAverage = analytics.group.average;
  const status = approvalOutlook(metrics);

  return (
    <>
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : undefined,
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{metrics.student.fullName}</div>
          <div className="gc-num text-xs text-muted-foreground">Código {metrics.student.code}</div>
        </div>
        <div className="text-right">
          <div className="gc-num text-lg leading-none font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>
            {formatGrade(metrics.definitiva)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{level ? LEVELS[level].label : "Sin notas"}</div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Stat label="Evaluado" value={`${metrics.evaluatedPct}%`} />
        <Stat label="Pendientes" value={String(metrics.pendingCount)} warn={metrics.pendingCount > 0} />
        <Stat
          label="vs. grupo"
          value={groupAverage != null && metrics.definitiva != null ? formatDelta(metrics.definitiva - groupAverage) : "—"}
        />
      </dl>

      <p
        className={cn(
          "mt-2 rounded-xl px-2.5 py-2 text-xs",
          status.tone === "good" && "bg-[var(--gc-alto)]/10 text-[var(--gc-alto)]",
          status.tone === "bad" && "bg-[var(--gc-bajo)]/10 text-[var(--gc-bajo)]",
          (status.tone === "neutral" || status.tone === "empty") && "bg-white/5 text-muted-foreground",
        )}
      >
        {status.text}
      </p>

      <button
        type="button"
        onClick={() => {
          onClose();
          setView("student");
          jumpToStudent(metrics.student.id);
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/8"
      >
        Ver ficha del estudiante
        <ArrowUpRight className="size-3.5" />
      </button>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-white/4 px-2 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("gc-num text-sm font-semibold", warn && "text-[var(--gc-bajo)]")}>{value}</dd>
    </div>
  );
}

import type { ReactNode } from "react";
import { ChevronRight, CircleAlert, CircleCheck, Target } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelTint } from "../../domain/scale";
import { approvalOutlook } from "../../domain/outlook";
import { formatGrade, initials } from "../../lib/format";
import type { StudentMetrics } from "../../domain/metrics";

/**
 * Resumen del estudiante estilo Micro-Dossier Liquid Glass.
 * Solo se monta mientras está abierto: la matriz no paga el costo de un popover por fila.
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
        className="gc-popover w-[min(320px,calc(100vw-24px))] rounded-2xl p-0 border-white/10 bg-[var(--card)]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      >
        <StudentSummary metrics={metrics} onClose={onClose} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Tarjeta de decisión pedagógica rápida:
 * Identidad con nivel → Definitiva y avance → Pronóstico de aprobación → Ficha completa.
 */
function StudentSummary({ metrics, onClose }: { metrics: StudentMetrics; onClose: () => void }) {
  const { selectStudent, setView } = useGradeCenter();
  const level = metrics.level;
  const outlook = approvalOutlook(metrics);
  const OutlookIcon = outlook.tone === "good" ? CircleCheck : outlook.tone === "bad" ? CircleAlert : Target;
  const isRisk = level === "bajo";

  return (
    <div>
      {/* Cabecera de identidad */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-2 ring-white/10"
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : "var(--muted-foreground)",
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{metrics.student.fullName}</div>
          <div className="text-xs text-muted-foreground">Código <span className="gc-num font-mono">{metrics.student.code}</span></div>
        </div>
        {isRisk && (
          <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500 dark:text-rose-400">
            En riesgo
          </span>
        )}
      </div>

      {/* Métricas clave */}
      <dl className="grid grid-cols-2 border-y border-[var(--gc-hair)] bg-foreground/[0.015]">
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Definitiva</dt>
          <dd className="mt-1 flex items-baseline gap-1.5">
            <span
              className="gc-num text-2xl leading-none font-bold"
              style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
            >
              {formatGrade(metrics.definitiva)}
            </span>
            <span className="text-xs font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>
              {level ? LEVELS[level].short : ""}
            </span>
          </dd>
          {metrics.provisional && metrics.definitiva != null && (
            <dd className="mt-1 text-[11px] text-muted-foreground/80">Provisional</dd>
          )}
        </div>
        <div className="border-l border-[var(--gc-hair)] px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Avance</dt>
          <dd className="gc-num mt-1 text-2xl leading-none font-bold text-foreground">{metrics.evaluatedPct}%</dd>
          <dd className="mt-1 text-[11px] text-muted-foreground">
            {metrics.pendingCount > 0
              ? `${metrics.pendingCount} ${metrics.pendingCount === 1 ? "nota pendiente" : "pendientes"}`
              : "Todo calificado"}
          </dd>
        </div>
      </dl>

      {/* Pronóstico pedagógico */}
      <div className="flex gap-2.5 px-4 py-3 bg-foreground/[0.01]">
        <OutlookIcon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0",
            outlook.tone === "good" && "text-[var(--gc-alto)]",
            outlook.tone === "bad" && "text-[var(--gc-bajo)]",
            (outlook.tone === "neutral" || outlook.tone === "empty") && "text-muted-foreground",
          )}
        />
        <p className="text-xs leading-relaxed text-foreground/85">
          {outlook.tone === "neutral" && outlook.needed != null ? (
            <>
              Requiere <span className="gc-num font-semibold text-foreground">{formatGrade(outlook.needed)}</span> en
              promedio en lo pendiente para aprobar.
            </>
          ) : (
            outlook.text
          )}
        </p>
      </div>

      {/* Acción de navegación */}
      <button
        type="button"
        onClick={() => {
          onClose();
          selectStudent(metrics.student.id);
          setView("student");
        }}
        className="group flex w-full items-center justify-between border-t border-[var(--gc-hair)] px-4 py-2.5 text-left text-xs font-semibold text-[var(--gc-cobalt)] transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04] focus-visible:outline-none"
      >
        <span>Ver ficha completa</span>
        <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </div>
  );
}

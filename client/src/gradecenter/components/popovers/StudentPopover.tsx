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
        className="gc-popover w-[min(300px,calc(100vw-24px))] rounded-2xl p-0"
      >
        <StudentSummary metrics={metrics} onClose={onClose} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Lo mínimo para decidir sin salir de la planilla, en tres niveles:
 * quién es → cómo va (definitiva y avance, cada cifra con su etiqueta) →
 * qué necesita para aprobar. El código ya se ve en la fila; la ficha completa lo muestra.
 */
function StudentSummary({ metrics, onClose }: { metrics: StudentMetrics; onClose: () => void }) {
  const { selectStudent, setView } = useGradeCenter();
  const level = metrics.level;
  const outlook = approvalOutlook(metrics);
  const OutlookIcon = outlook.tone === "good" ? CircleCheck : outlook.tone === "bad" ? CircleAlert : Target;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : "var(--muted-foreground)",
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-snug font-semibold">{metrics.student.fullName}</div>
      </div>

      <dl className="grid grid-cols-2 border-y border-[var(--gc-hair)]">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Definitiva</dt>
          <dd className="mt-1 flex items-baseline gap-1.5">
            <span
              className="gc-num text-2xl leading-none font-semibold"
              style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
            >
              {formatGrade(metrics.definitiva)}
            </span>
            <span className="text-xs font-medium" style={{ color: level ? LEVELS[level].color : undefined }}>
              {level ? LEVELS[level].short : ""}
            </span>
          </dd>
          {metrics.provisional && metrics.definitiva != null && (
            <dd className="mt-1 text-xs text-muted-foreground">Provisional</dd>
          )}
        </div>
        <div className="border-l border-[var(--gc-hair)] px-4 py-3">
          <dt className="text-xs text-muted-foreground">Avance</dt>
          <dd className="gc-num mt-1 text-2xl leading-none font-semibold">{metrics.evaluatedPct}%</dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            {metrics.pendingCount > 0
              ? `${metrics.pendingCount} ${metrics.pendingCount === 1 ? "nota pendiente" : "notas pendientes"}`
              : "Todo calificado"}
          </dd>
        </div>
      </dl>

      <div className="flex gap-2.5 px-4 py-3">
        <OutlookIcon
          aria-hidden
          className={cn(
            "mt-px size-4 shrink-0",
            outlook.tone === "good" && "text-[var(--gc-alto)]",
            outlook.tone === "bad" && "text-[var(--gc-bajo)]",
            (outlook.tone === "neutral" || outlook.tone === "empty") && "text-muted-foreground",
          )}
        />
        <p className="text-sm leading-snug text-foreground/85">
          {outlook.tone === "neutral" && outlook.needed != null ? (
            <>
              Necesita <span className="gc-num font-semibold text-foreground">{formatGrade(outlook.needed)}</span> en
              promedio en lo pendiente para aprobar.
            </>
          ) : (
            outlook.text
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          onClose();
          selectStudent(metrics.student.id);
          setView("student");
        }}
        className="flex w-full items-center justify-between rounded-b-2xl border-t border-[var(--gc-hair)] px-4 py-2.5 text-left text-sm font-medium text-[var(--gc-cobalt)] transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.03] focus-visible:outline-none"
      >
        Ver ficha completa
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
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
 * Lo mínimo para decidir sin salir de la planilla: definitiva, cuánto falta
 * por calificar y qué necesita para aprobar. El código del estudiante ya se ve
 * en la fila, por eso no se repite aquí; la ficha completa lo muestra.
 */
function StudentSummary({ metrics, onClose }: { metrics: StudentMetrics; onClose: () => void }) {
  const { selectStudent, setView } = useGradeCenter();
  const level = metrics.level;
  const status = approvalOutlook(metrics);
  const facts = [
    `${metrics.evaluatedPct}% evaluado`,
    metrics.pendingCount > 0
      ? `${metrics.pendingCount} ${metrics.pendingCount === 1 ? "pendiente" : "pendientes"}`
      : "sin pendientes",
  ];

  return (
    <div>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : "var(--muted-foreground)",
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug font-semibold">{metrics.student.fullName}</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className="gc-num text-2xl leading-none font-semibold"
              style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
            >
              {formatGrade(metrics.definitiva)}
            </span>
            <span className="text-xs text-muted-foreground">{level ? LEVELS[level].short : "Sin notas"}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{facts.join(" · ")}</div>
        </div>
      </div>

      <p
        className={cn(
          "mx-4 mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed",
          status.tone === "good" && "bg-[var(--gc-alto)]/10 text-[var(--gc-alto)]",
          status.tone === "bad" && "bg-[var(--gc-bajo)]/10 text-[var(--gc-bajo)]",
          (status.tone === "neutral" || status.tone === "empty") && "bg-foreground/[0.05] text-foreground/80",
        )}
      >
        {status.text}
      </p>

      <button
        type="button"
        onClick={() => {
          onClose();
          selectStudent(metrics.student.id);
          setView("student");
        }}
        className="mt-3 flex w-full items-center justify-between border-t border-[var(--gc-hair)] px-4 py-2.5 text-left text-xs font-medium text-[var(--gc-cobalt)] transition-colors hover:bg-foreground/[0.03]"
      >
        Ver ficha completa
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

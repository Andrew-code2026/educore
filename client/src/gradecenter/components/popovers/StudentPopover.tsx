import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { APPROVAL_GRADE, LEVELS, levelTint } from "../../domain/scale";
import { formatDelta, formatGrade, initials } from "../../lib/format";
import type { StudentMetrics } from "../../domain/metrics";
import { announcePopover, useExclusivePopover } from "./exclusivePopover";

export function StudentPopover({ metrics, children }: { metrics: StudentMetrics; children: React.ReactNode }) {
  const { analytics, dataset, setView, jumpToStudent } = useGradeCenter();
  const [open, setOpen] = useState(false);
  useExclusivePopover(() => setOpen(false));
  const level = metrics.level;
  const groupAverage = analytics.group.average;
  const pendingWeight = metrics.outcomes.filter((outcome) => outcome.grade == null).reduce((sum, outcome) => sum + outcome.evaluation.weight, 0);
  const currentContribution = metrics.outcomes.reduce((sum, outcome) => sum + (outcome.grade ?? 0) * outcome.evaluation.weight / 100, 0);
  const needed = pendingWeight > 0 ? (APPROVAL_GRADE - currentContribution) / (pendingWeight / 100) : null;
  const approvalState = metrics.definitiva != null && metrics.definitiva >= APPROVAL_GRADE && pendingWeight === 0
    ? "guaranteed"
    : needed != null && needed > 5
      ? "impossible"
      : "needed";
  const highlights = [...metrics.outcomes].filter((item) => item.grade != null).sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0)).slice(0, 3);

  return (
    <Popover open={open} onOpenChange={(next) => { if (next) announcePopover(); setOpen(next); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="glass-strong w-[min(330px,calc(100vw-24px))] rounded-2xl border-white/12 p-3 shadow-2xl">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold" style={{ borderColor: levelTint(level ?? "basico", 0.45), backgroundColor: levelTint(level ?? "basico", 0.16), color: level ? LEVELS[level].color : undefined }}>{initials(metrics.student)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{metrics.student.fullName}</div>
            <div className="gc-num text-xs text-muted-foreground">{metrics.student.code} · {dataset.group} · {dataset.subject}</div>
          </div>
          <span className="gc-num text-lg font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>{formatGrade(metrics.definitiva)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{level ? LEVELS[level].label : "Sin evaluar"}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{metrics.evaluatedPct}% evaluado</span>
          <span className={cn("rounded-full border px-2 py-1", metrics.pendingCount ? "border-[var(--gc-bajo)]/40 text-[var(--gc-bajo)]" : "border-[var(--gc-alto)]/40 text-[var(--gc-alto)]")}>{metrics.pendingCount ? `${metrics.pendingCount} pendientes` : "Sin pendientes"}</span>
        </div>
        <div className="mt-2 rounded-xl border border-white/8 bg-white/4 px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Comparación con el grupo</span><span className="gc-num font-medium">{groupAverage != null && metrics.definitiva != null ? formatDelta(metrics.definitiva - groupAverage) : "—"}</span></div>
          <div className="mt-1 text-muted-foreground">Promedio grupo <span className="gc-num text-foreground">{formatGrade(groupAverage)}</span></div>
        </div>
        <div className={cn("mt-2 rounded-xl border px-2.5 py-2", approvalState === "guaranteed" ? "border-[var(--gc-alto)]/35 bg-[var(--gc-alto)]/8" : approvalState === "impossible" ? "border-[var(--gc-bajo)]/35 bg-[var(--gc-bajo)]/8" : "border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/8")}>
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="size-3" /> ¿Qué necesita para aprobar?</div>
          <div className="mt-1 text-xs text-muted-foreground">{approvalState === "guaranteed" ? "Aprueba con las evaluaciones actuales." : approvalState === "impossible" ? "Con las ponderaciones actuales, no alcanza el mínimo." : `Necesita un promedio de ${formatGrade(needed)} en las evaluaciones pendientes.`}</div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {highlights.map((item) => <div key={item.evaluation.id} className="rounded-lg border border-white/8 bg-white/3 px-2 py-1.5"><div className="gc-num text-xs text-muted-foreground">{item.evaluation.code}</div><div className="gc-num text-[12px] font-semibold" style={{ color: item.level ? LEVELS[item.level].color : undefined }}>{formatGrade(item.grade)}</div></div>)}
        </div>
        <div className="mt-3 flex gap-1.5 border-t border-white/8 pt-2">
          <button type="button" onClick={() => { setView("student"); jumpToStudent(metrics.student.id); }} className="flex-1 rounded-xl border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/10 px-2 py-1.5 text-xs font-medium hover:bg-[var(--gc-cobalt)]/20"><ArrowUpRight className="mr-1 inline size-3" />Ver estudiante</button>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3" /> Resumen contextual; el detalle completo vive en la vista Estudiante.</div>
      </PopoverContent>
    </Popover>
  );
}

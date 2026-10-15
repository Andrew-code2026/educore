import { ArrowUpRight, BookOpenCheck, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS } from "../../domain/scale";
import { TYPE_META } from "../../data/curriculum";
import { formatDelta, formatGrade, formatLongDate } from "../../lib/format";
import { DistributionBars, LevelBadge, MetricTile } from "./primitives";
import { InfoRow, Section } from "./layout";

/** Detalle de una evaluación: promedio, avance, evidencias DBA y notas del grupo. */
export function EvaluationDetail({
  evaluationId,
  layout = "panel",
}: {
  evaluationId: string;
  layout?: "panel" | "wide";
}) {
  const { analytics, dataset, jumpToCell, setFilters, preferences, selectStudent } = useGradeCenter();
  const metric = analytics.byEvaluation.get(evaluationId);
  if (!metric) return null;

  const wide = layout === "wide";
  const evaluation = metric.evaluation;
  const groupAverage = analytics.group.average;
  const delta = metric.avg != null && groupAverage != null ? metric.avg - groupAverage : null;

  const rows = dataset.students
    .map((student) => {
      const metrics = analytics.byStudent.get(student.id)!;
      return {
        student,
        metrics,
        outcome: metrics.outcomes.find((o) => o.evaluation.id === evaluationId)!,
      };
    })
    .sort((a, b) => {
      if (a.outcome.grade == null && b.outcome.grade == null) return 0;
      if (a.outcome.grade == null) return 1;
      if (b.outcome.grade == null) return -1;
      return (b.outcome.grade as number) - (a.outcome.grade as number);
    });

  return (
    <div className={cn("space-y-4", wide && "space-y-5")}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="gc-num text-[11px] font-semibold text-[var(--gc-cobalt)]">{evaluation.code}</span>
          <span className="gc-num rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px]">
            {evaluation.weight}%
          </span>
          <LevelBadge level={metric.level} score={metric.avg} />
        </div>
        <div className="mt-1 text-[14px] font-semibold">{evaluation.name}</div>
        <div className="text-[10.5px] text-muted-foreground">
          {TYPE_META[evaluation.type].label} · {formatLongDate(evaluation.date)} · {evaluation.period}
        </div>
      </div>

      <div className={cn("grid gap-2", wide ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
        <MetricTile
          label="Promedio"
          value={formatGrade(metric.avg)}
          hint={delta != null ? `${formatDelta(delta)} vs. grupo` : undefined}
          accent={metric.level ? LEVELS[metric.level].color : undefined}
        />
        <MetricTile
          label="Evaluados"
          value={`${metric.evaluatedPct}%`}
          hint={`${metric.gradedCount} de ${metric.gradedCount + metric.pending}`}
        />
        <MetricTile
          label="Pendientes"
          value={metric.pending}
          accent={metric.pending > 0 ? LEVELS.bajo.color : undefined}
        />
        <MetricTile
          label="Rango"
          value={`${formatGrade(metric.min)}–${formatGrade(metric.max)}`}
          hint="mínimo y máximo"
        />
      </div>

      <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <Section title="Distribución de la evaluación" hint={`${metric.gradedCount} notas`}>
          <DistributionBars distribution={metric.distribution} total={metric.gradedCount} />
        </Section>

        <Section title="Datos de la evaluación">
          <div className="grid grid-cols-2 gap-2">
            <InfoRow icon={<Layers className="size-3" />} label="Tipo" value={TYPE_META[evaluation.type].label} />
            <InfoRow label="Fecha" value={formatLongDate(evaluation.date)} />
            <InfoRow label="Peso" value={`${evaluation.weight}% de la definitiva`} />
            <InfoRow label="Periodo" value={evaluation.period} />
          </div>
        </Section>
      </div>

      {evaluation.dbaIds.length > 0 && (
        <Section title="Aporta evidencia a" hint="Derechos Básicos de Aprendizaje">
          <div className="space-y-1.5">
            {evaluation.dbaIds.map((id) => {
              const dba = dataset.dba.find((item) => item.id === id);
              if (!dba) return null;
              return (
                <div
                  key={id}
                  className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/3 px-2.5 py-2"
                >
                  <BookOpenCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--gc-cobalt)]" />
                  <div className="min-w-0">
                    <div className="gc-num text-[10px] font-semibold text-[var(--gc-cobalt)]">{dba.code}</div>
                    <div className="text-[11px] font-medium">{dba.title}</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {dba.statement}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {metric.pending > 0 && (
        <button
          type="button"
          onClick={() =>
            setFilters({
              ...preferences.filters,
              evaluationId: evaluation.id,
              evaluationState: "pending",
            })
          }
          className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--gc-bajo)_45%,transparent)] bg-[color-mix(in_oklab,var(--gc-bajo)_12%,transparent)] px-3 py-2 text-left text-[11px]"
        >
          <Clock className="size-3.5 shrink-0 text-[var(--gc-bajo)]" />
          <span className="flex-1">
            <span className="block font-medium">Ver los {metric.pending} pendientes</span>
            <span className="block text-[10px] text-muted-foreground">
              Filtra la matriz para calificar solo lo que falta
            </span>
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}

      <Section title="Notas del grupo" hint="de mayor a menor">
        <div className={cn("space-y-0.5", wide && "grid gap-0.5 md:grid-cols-2")}>
          {rows.map(({ student, metrics, outcome }) => (
            <button
              key={student.id}
              type="button"
              onClick={() => {
                selectStudent(student.id);
                jumpToCell(student.id, evaluation.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/6"
            >
              <span className="min-w-0 flex-1 truncate text-[11px]">{student.fullName}</span>
              <span className="gc-num shrink-0 text-[9.5px] text-muted-foreground">
                {formatGrade(metrics.definitiva)}
              </span>
              {outcome.grade == null ? (
                <span className="gc-num w-10 shrink-0 text-right text-[10px] text-[var(--gc-bajo)]">
                  pend.
                </span>
              ) : (
                <span
                  className="gc-num w-10 shrink-0 text-right text-[12px] font-semibold"
                  style={{ color: outcome.level ? LEVELS[outcome.level].color : undefined }}
                >
                  {formatGrade(outcome.grade)}
                </span>
              )}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
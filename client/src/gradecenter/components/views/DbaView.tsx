import { useMemo, useState } from "react";
import { BookOpenCheck, GraduationCap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelFromScore, levelTint } from "../../domain/scale";
import type { LevelId } from "../../types";
import { formatGrade, initials } from "../../lib/format";
import { DistributionBars, LevelBadge, LevelBar, MetricTile, ScoreChip } from "../insights/primitives";
import { Section } from "../insights/layout";

/**
 * Vista DBA.
 *
 * Los Derechos Básicos de Aprendizaje no son una tabla curricular aparte: son
 * otra forma de mirar los mismos datos. Cada evaluación aporta evidencia a uno
 * o más DBA y varias evaluaciones pueden sostener el mismo nivel.
 */
export function DbaView() {
  const { dataset, analytics, students } = useGradeCenter();
  const [selectedDba, setSelectedDba] = useState(dataset.dba[0]?.id ?? "");

  const stats = useMemo(
    () =>
      dataset.dba.map((dba) => {
        const evaluations = dataset.evaluations.filter((item) => item.dbaIds.includes(dba.id));
        const outcomes = students
          .map((metrics) => metrics.dba.find((item) => item.id === dba.id))
          .filter((item): item is NonNullable<typeof item> => item != null && item.evidenceCount > 0);

        const averages = outcomes.map((item) => item.avg).filter((value): value is number => value != null);
        const avg = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

        const distribution: Record<LevelId, number> = { bajo: 0, basico: 0, alto: 0, superior: 0 };
        outcomes.forEach((item) => {
          if (item.level) distribution[item.level] += 1;
        });

        return {
          dba,
          evaluations,
          outcomes,
          avg: avg == null ? null : Math.round(avg * 10) / 10,
          level: levelFromScore(avg),
          distribution,
          evidenceCount: evaluations.length,
        };
      }),
    [dataset, students],
  );

  const current = stats.find((item) => item.dba.id === selectedDba) ?? stats[0];

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="glass flex size-11 items-center justify-center rounded-2xl text-[var(--gc-cobalt)]">
            <GraduationCap className="size-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Evidencias y logro de DBA
            </div>
            <div className="text-xs text-muted-foreground">
              {dataset.dba.length} derechos básicos · {dataset.evaluations.length} evaluaciones aportan
              evidencia
            </div>
          </div>
        </div>

        {/* Selector de DBA */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item) => {
            const active = item.dba.id === current?.dba.id;
            return (
              <button
                key={item.dba.id}
                type="button"
                onClick={() => setSelectedDba(item.dba.id)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all",
                  active
                    ? "border-[var(--gc-cobalt)]/60 bg-[var(--gc-cobalt)]/12"
                    : "border-white/8 bg-white/3 hover:bg-white/6",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="gc-num text-xs font-semibold text-[var(--gc-cobalt)]">
                    {item.dba.code}
                  </span>
                  <LevelBadge level={item.level} score={item.avg} size="xs" />
                </div>
                <div className="mt-1 truncate text-[12px] font-medium">{item.dba.title}</div>
                <div className="mt-2">
                  <LevelBar score={item.avg} showTicks={false} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="gc-num">{item.evidenceCount} evaluaciones</span>
                  <span className="gc-num">{item.outcomes.length} estudiantes con evidencia</span>
                </div>
              </button>
            );
          })}
        </div>

        {current && (
          <div className="glass gc-rise space-y-4 rounded-3xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="gc-num text-xs font-semibold text-[var(--gc-cobalt)]">
                    {current.dba.code}
                  </span>
                  <LevelBadge level={current.level} />
                </div>
                <div className="mt-1 text-[15px] font-semibold">{current.dba.title}</div>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {current.dba.statement}
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-3 gap-2">
                <MetricTile
                  label="Nivel del grupo"
                  value={current.level ? LEVELS[current.level].short : "—"}
                  hint={formatGrade(current.avg)}
                  accent={current.level ? LEVELS[current.level].color : undefined}
                />
                <MetricTile label="Evidencias" value={current.evidenceCount} hint="evaluaciones" />
                <MetricTile
                  label="En riesgo"
                  value={current.distribution.bajo}
                  hint="nivel bajo"
                  accent={current.distribution.bajo > 0 ? LEVELS.bajo.color : undefined}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Distribución del nivel" hint={`${current.outcomes.length} estudiantes`}>
                <DistributionBars distribution={current.distribution} total={current.outcomes.length} />
              </Section>

              <Section title="Evaluaciones que aportan evidencia" hint="varias pueden sostener el mismo nivel">
                <div className="space-y-1">
                  {current.evaluations.map((evaluation) => {
                    const metric = analytics.byEvaluation.get(evaluation.id);
                    if (!metric) return null;
                    return (
                      <div
                        key={evaluation.id}
                        className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-2.5 py-1.5"
                      >
                        <BookOpenCheck className="size-3 shrink-0 text-[var(--gc-cobalt)]" />
                        <span className="gc-num w-7 shrink-0 text-xs text-muted-foreground">
                          {evaluation.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">{evaluation.name}</span>
                        <span className="gc-num shrink-0 text-xs text-muted-foreground">
                          {evaluation.weight}%
                        </span>
                        <ScoreChip score={metric.avg} size="xs" />
                      </div>
                    );
                  })}
                  {current.evaluations.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      Ninguna evaluación del periodo aporta evidencia a este DBA.
                    </div>
                  )}
                </div>
              </Section>
            </div>

            <Section title="Nivel por estudiante" hint="con las evidencias que lo sustentan">
              <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
                {current.outcomes
                  .slice()
                  .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
                  .map((outcome) => {
                    const metrics = students.find((item) =>
                      item.dba.some((dba) => dba.id === current.dba.id && dba === outcome),
                    );
                    const student = metrics?.student;
                    if (!student) return null;
                    return (
                      <Tooltip key={student.id}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-2 py-1.5">
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold"
                              style={{
                                borderColor: outcome.level
                                  ? levelTint(outcome.level, 0.45)
                                  : "oklch(1 0 0 / 12%)",
                                backgroundColor: outcome.level ? levelTint(outcome.level, 0.16) : undefined,
                                color: outcome.level ? LEVELS[outcome.level].color : undefined,
                              }}
                            >
                              {initials(student)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs">{student.fullName}</span>
                              <span className="gc-num block text-xs text-muted-foreground">
                                {outcome.evaluations
                                  .filter((e) => e.grade != null)
                                  .map((e) => e.evaluation.code)
                                  .join(", ")}
                              </span>
                            </span>
                            <span
                              className="gc-num shrink-0 text-xs font-semibold"
                              style={{ color: outcome.level ? LEVELS[outcome.level].color : undefined }}
                            >
                              {formatGrade(outcome.avg)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64">
                          <div className="text-xs font-semibold">
                            {outcome.code} · {outcome.title}
                          </div>
                          <p className="mt-1 text-xs opacity-85">{outcome.statement}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
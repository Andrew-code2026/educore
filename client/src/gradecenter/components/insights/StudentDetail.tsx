import { AlertTriangle, BookOpenCheck, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { APPROVAL_GRADE, LEVELS, MIN_GRADE, levelTint } from "../../domain/scale";
import type { DbaOutcome, EvaluationOutcome, StudentMetrics } from "../../domain/metrics";
import { TYPE_META } from "../../data/curriculum";
import { formatDelta, formatGrade, initials } from "../../lib/format";
import { LevelBadge, LevelBar, MetricTile, ScoreChip, Sparkline, TrendStrip } from "./primitives";
import { DistributionBars } from "./primitives";
import { Section } from "./layout";

/** Ficha académica individual: evolución, desglose y evidencias. */
export function StudentDetail({ metrics, layout = "panel" }: { metrics: StudentMetrics; layout?: "panel" | "wide" }) {
  const { analytics, dataset, jumpToCell, setFilters, preferences } = useGradeCenter();
  const level = metrics.level;
  const groupAverage = analytics.group.average;
  const wide = layout === "wide";

  return (
    <div className={cn("space-y-4", wide && "space-y-5")}>
      <div className="flex items-start gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border text-[15px] font-semibold"
          style={{
            borderColor: levelTint(level ?? "basico", 0.45),
            backgroundColor: levelTint(level ?? "basico", 0.16),
            color: level ? LEVELS[level].color : undefined,
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{metrics.student.fullName}</div>
          <div className="gc-num text-[10.5px] text-muted-foreground">
            {metrics.student.code} · {dataset.group}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LevelBadge level={level} />
            <TrendStrip trend={metrics.trend} />
            {metrics.complete ? (
              <span className="rounded-full border border-[color-mix(in_oklab,var(--gc-alto)_40%,transparent)] bg-[color-mix(in_oklab,var(--gc-alto)_12%,transparent)] px-2 py-0.5 text-[10px] text-[var(--gc-alto)]">
                Sin pendientes
              </span>
            ) : (
              <span className="rounded-full border border-[color-mix(in_oklab,var(--gc-bajo)_40%,transparent)] bg-[color-mix(in_oklab,var(--gc-bajo)_12%,transparent)] px-2 py-0.5 text-[10px] text-[var(--gc-bajo)]">
                {metrics.pendingCount} pendientes
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="gc-label text-[9px]">Definitiva del periodo</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="gc-num text-3xl font-semibold"
                style={{
                  color: level ? LEVELS[level].color : undefined,
                  textShadow: level ? `0 0 26px ${levelTint(level, 0.45)}` : undefined,
                }}
              >
                {formatGrade(metrics.definitiva)}
              </span>
              {groupAverage != null && (
                <span className="text-[11px] text-muted-foreground">
                  grupo <span className="gc-num">{formatGrade(groupAverage)}</span>
                  {metrics.definitiva != null && (
                    <span className="gc-num ml-1">({formatDelta(metrics.definitiva - groupAverage)})</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="gc-num text-[11px] text-muted-foreground">{metrics.evaluatedPct}% evaluado</div>
            <div className="gc-num text-[10.5px] text-muted-foreground">
              {metrics.gradedCount} de {metrics.outcomes.length} evaluaciones
            </div>
            {metrics.provisional && (
              <div className="mt-0.5 text-[10px] text-[var(--gc-bajo)]">Definitiva provisional</div>
            )}
          </div>
        </div>
        <LevelBar score={metrics.definitiva} className="mt-3" />
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          <span className="gc-num">{MIN_GRADE.toFixed(1)}</span>
          <span className="gc-num">{formatGrade(APPROVAL_GRADE)} aprueba</span>
          <span className="gc-num">5.0</span>
        </div>
      </div>

      <div className={cn("grid gap-2", wide ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
        <MetricTile label="Pendientes" value={metrics.pendingCount} />
        <MetricTile
          label="Mejor evaluación"
          value={formatGrade(metrics.best?.grade ?? null)}
          hint={metrics.best?.evaluation.code}
          accent={LEVELS.alto.color}
        />
        <MetricTile
          label="Más débil"
          value={formatGrade(metrics.worst?.grade ?? null)}
          hint={metrics.worst?.evaluation.code}
          accent={
            metrics.worst && metrics.worst.grade != null && metrics.worst.grade < APPROVAL_GRADE
              ? LEVELS.bajo.color
              : undefined
          }
        />
        {wide && (
          <MetricTile
            label="Tendencia"
            value={metrics.trend.label}
            hint={`pendiente ${metrics.trend.slope >= 0 ? "+" : "−"}${Math.abs(metrics.trend.slope).toFixed(2)}/eval.`}
            accent={
              metrics.trend.direction === "up"
                ? LEVELS.alto.color
                : metrics.trend.direction === "down"
                  ? LEVELS.bajo.color
                  : undefined
            }
          />
        )}
      </div>

      <Section title="Evolución en el periodo" hint="cada punto es una evaluación">
        <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
          <Sparkline
            points={metrics.series.map((s) => s.grade)}
            groupPoints={metrics.series.map((s) => s.groupAvg)}
            color={level ? LEVELS[level].color : undefined}
            width={wide ? 620 : 340}
            height={wide ? 88 : 64}
            className="w-full"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[9.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span
                className="h-[2px] w-4 rounded-full"
                style={{ backgroundColor: level ? LEVELS[level].color : "var(--muted-foreground)" }}
              />
              Estudiante
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-4 border-t border-dashed border-white/40" />
              Promedio del grupo
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-4 border-t border-dashed border-white/25" />
              Umbral {formatGrade(APPROVAL_GRADE)}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Desglose por evaluación" hint={`${metrics.outcomes.length} evaluaciones`}>
        <div className={cn("space-y-0.5", wide && "grid gap-0.5 md:grid-cols-2")}>
          {metrics.outcomes.map((outcome) => (
            <OutcomeRow
              key={outcome.evaluation.id}
              outcome={outcome}
              studentId={metrics.student.id}
              onJump={jumpToCell}
            />
          ))}
        </div>
      </Section>

      {metrics.byType.length > 0 && (
        <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          <Section title="Fortalezas y debilidades" hint="por tipo de evaluación">
            <div className="space-y-1">
              {metrics.byType.map((type, index) => (
                <div
                  key={type.type}
                  className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-2.5 py-1.5"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "var(--gc-alto)"
                          : index === metrics.byType.length - 1
                            ? "var(--gc-bajo)"
                            : "var(--muted-foreground)",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px]">{type.label}</span>
                  <span className="gc-num shrink-0 text-[10px] text-muted-foreground">
                    {type.count} eval.
                  </span>
                  <ScoreChip score={type.avg} size="sm" />
                </div>
              ))}
            </div>
          </Section>

          {metrics.dba.length > 0 && (
            <Section title="Evidencias DBA" hint="qué evaluaciones sustentan cada nivel">
              <div className="space-y-1.5">
                {metrics.dba.map((outcome) => (
                  <DbaRow key={outcome.id} outcome={outcome} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      <Section title="Distribución del grupo">
        <DistributionBars
          distribution={analytics.group.distribution}
          total={dataset.students.length}
        />
      </Section>

      <button
        type="button"
        onClick={() => setFilters({ ...preferences.filters, onlyAttention: true })}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-left text-[11px] transition-colors",
          metrics.attention
            ? "border-[color-mix(in_oklab,var(--gc-bajo)_45%,transparent)] bg-[color-mix(in_oklab,var(--gc-bajo)_12%,transparent)]"
            : "border-white/8 bg-white/3 hover:bg-white/6",
        )}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="size-3" />
          {metrics.attention
            ? `Requiere atención: por debajo de ${formatGrade(APPROVAL_GRADE)}`
            : "Sobre el umbral institucional de aprobación"}
        </span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {metrics.attention
            ? "Ver todos los estudiantes que requieren acompañamiento"
            : "Comparar con quienes sí requieren atención"}
        </span>
      </button>
    </div>
  );
}

function OutcomeRow({
  outcome,
  studentId,
  onJump,
}: {
  outcome: EvaluationOutcome;
  studentId: string;
  onJump: (studentId: string, evaluationId: string) => void;
}) {
  const level = outcome.level;
  return (
    <button
      type="button"
      onClick={() => onJump(studentId, outcome.evaluation.id)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/6"
    >
      <span className="gc-num w-7 shrink-0 text-[10px] text-muted-foreground">
        {outcome.evaluation.code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px]">{outcome.evaluation.name}</span>
        <span className="gc-num block text-[9px] text-muted-foreground">
          {outcome.evaluation.weight}% · {TYPE_META[outcome.evaluation.type].label}
        </span>
      </span>
      {outcome.delta != null && (
        <span
          className="gc-num shrink-0 text-[9.5px]"
          style={{
            color:
              outcome.delta > 0.05
                ? "var(--gc-alto)"
                : outcome.delta < -0.05
                  ? "var(--gc-bajo)"
                  : "var(--muted-foreground)",
          }}
        >
          {formatDelta(outcome.delta)}
        </span>
      )}
      {outcome.grade == null ? (
        <span className="gc-num flex shrink-0 items-center gap-1 text-[10px] text-[var(--gc-bajo)]">
          <Clock className="size-3" /> pend.
        </span>
      ) : (
        <span
          className="gc-num w-8 shrink-0 text-right text-[12px] font-semibold"
          style={{ color: level ? LEVELS[level].color : undefined }}
        >
          {formatGrade(outcome.grade)}
        </span>
      )}
    </button>
  );
}

function DbaRow({ outcome }: { outcome: DbaOutcome }) {
  const level = outcome.level;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="rounded-xl border border-white/8 bg-white/3 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="gc-num shrink-0 text-[10px] font-semibold text-[var(--gc-cobalt)]">
              {outcome.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{outcome.title}</span>
            <ScoreChip score={outcome.avg} size="sm" />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <LevelBar score={outcome.avg} showTicks={false} className="flex-1" />
            <span
              className="shrink-0 text-[9.5px]"
              style={{ color: level ? LEVELS[level].color : undefined }}
            >
              {level ? LEVELS[level].short : "Sin evidencia"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 truncate text-[9.5px] text-muted-foreground">
            <BookOpenCheck className="size-2.5 shrink-0" />
            Evidencias:{" "}
            {outcome.evaluations
              .filter((e) => e.grade != null)
              .map((e) => e.evaluation.code)
              .join(", ") || "ninguna calificada"}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-64">
        <div className="text-[11px] font-semibold">
          {outcome.code} · {outcome.title}
        </div>
        <p className="mt-1 text-[10px] opacity-85">{outcome.statement}</p>
      </TooltipContent>
    </Tooltip>
  );
}

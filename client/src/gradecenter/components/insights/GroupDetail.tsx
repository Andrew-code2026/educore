import { AlertTriangle, Clock, Crosshair, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { APPROVAL_GRADE, LEVELS, levelFromScore, levelTint } from "../../domain/scale";
import type { StudentMetrics } from "../../domain/metrics";
import { TYPE_META } from "../../data/curriculum";
import { formatDelta, formatGrade, pluralize } from "../../lib/format";
import { DistributionBars, LevelBadge, MicroBars, MetricTile, ScoreChip, TrendStrip } from "./primitives";
import { Section, SectionTitle } from "./layout";

/**
 * Análisis del grupo.
 *
 * Es la misma inteligencia que aparece en el panel contextual, sólo que a
 * pantalla completa: nunca un dashboard con gráficas decorativas, sino las
 * cifras que cambian una decisión docente.
 */
export function GroupDetail({ layout = "panel" }: { layout?: "panel" | "wide" }) {
  const { analytics, dataset, selectStudent, selectEvaluation, jumpToStudent, setFilters, preferences } =
    useGradeCenter();
  const group = analytics.group;
  const wide = layout === "wide";

  return (
    <div className={cn("space-y-4", wide && "space-y-5")}>
      <SectionTitle
        title="Panorama del grupo"
        hint={`${dataset.course} · ${dataset.subject} · ${dataset.evaluations.length} evaluaciones`}
      />

      <div className={cn("grid gap-2", wide ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
        <MetricTile
          label="Promedio"
          value={formatGrade(group.average)}
          hint={`${dataset.students.length} estudiantes`}
          accent={LEVELS[levelFromScore(group.average) ?? "basico"].color}
        />
        <MetricTile
          label="Aprobación"
          value={`${group.approvalPct}%`}
          hint={`desde ${formatGrade(APPROVAL_GRADE)}`}
          accent={group.approvalPct >= 75 ? LEVELS.alto.color : LEVELS.bajo.color}
        />
        <MetricTile label="Al día" value={`${group.completePct}%`} hint="sin pendientes" />
        <MetricTile
          label="Pendientes"
          value={group.totalPending}
          hint={`${group.pending.length} ${pluralize(group.pending.length, "estudiante", "estudiantes")}`}
          accent={group.totalPending > 0 ? LEVELS.bajo.color : undefined}
        />
      </div>

      <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <Section title="Distribución por nivel" hint={`${dataset.students.length} estudiantes`}>
          <DistributionBars distribution={group.distribution} total={dataset.students.length} />
          <div className="mt-3 space-y-1">
            {(["superior", "alto", "basico", "bajo"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() =>
                  setFilters({
                    ...preferences.filters,
                    levels: preferences.filters.levels.includes(level) ? [] : [level],
                  })
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/6",
                  preferences.filters.levels.includes(level) && "bg-white/8",
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: LEVELS[level].color }} />
                <span className="flex-1 text-[11px]">{LEVELS[level].label}</span>
                <span className="gc-num text-[10px] text-muted-foreground">{LEVELS[level].range}</span>
                <span className="gc-num w-8 text-right text-[10px] font-medium">
                  {group.distribution[level]}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Tendencias del periodo">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--gc-alto)]">
                <TrendingUp className="size-3" /> En ascenso
              </div>
              <div className="gc-num mt-1 text-lg font-semibold">{group.improving.length}</div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">
                {group.improving
                  .slice(0, 2)
                  .map((s) => s.student.firstName)
                  .join(", ") || "—"}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--gc-bajo)]">
                <TrendingDown className="size-3" /> En descenso
              </div>
              <div className="gc-num mt-1 text-lg font-semibold">{group.declining.length}</div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">
                {group.declining
                  .slice(0, 2)
                  .map((s) => s.student.firstName)
                  .join(", ") || "—"}
              </div>
            </div>
          </div>

          {(group.strongestType || group.weakestType) && (
            <div className="mt-2 space-y-1.5">
              {group.strongestType && (
                <TypeRow label="Fortaleza del grupo" type={group.strongestType} tone="var(--gc-alto)" />
              )}
              {group.weakestType && group.weakestType.type !== group.strongestType?.type && (
                <TypeRow label="Debilidad del grupo" type={group.weakestType} tone="var(--gc-bajo)" />
              )}
            </div>
          )}
        </Section>
      </div>

      <Section title="Comparación de evaluaciones" hint={`${group.evaluations.length} en el periodo`}>
        <div className="space-y-1.5">
          {group.evaluations.map((metric) => {
            const level = metric.level;
            return (
              <button
                key={metric.evaluation.id}
                type="button"
                onClick={() => selectEvaluation(metric.evaluation.id)}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/6"
              >
                <span className="gc-num w-7 shrink-0 text-[10px] text-muted-foreground">
                  {metric.evaluation.code}
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{
                      width: `${metric.avg != null ? ((metric.avg - 1) / 4) * 100 : 0}%`,
                      background: level ? levelTint(level, 0.85) : "transparent",
                    }}
                  />
                </span>
                <span className="gc-num w-7 shrink-0 text-right text-[11px] font-medium">
                  {formatGrade(metric.avg)}
                </span>
                <span className="gc-num w-12 shrink-0 text-right text-[9.5px] text-muted-foreground">
                  {metric.evaluatedPct}% eval.
                </span>
                <span
                  className="gc-num w-14 shrink-0 text-right text-[9.5px] whitespace-nowrap"
                  style={{ color: metric.pending > 0 ? "var(--gc-bajo)" : "var(--muted-foreground)" }}
                >
                  {metric.pending > 0 ? `${metric.pending} pend.` : "al día"}
                </span>
              </button>
            );
          })}
        </div>
        {group.hardest && group.easiest && group.hardest.evaluation.id !== group.easiest.evaluation.id && (
          <div className="mt-3 grid gap-1.5 rounded-xl border border-white/8 bg-white/3 p-2.5 text-[11px] leading-relaxed md:grid-cols-2">
            <div className="flex items-center gap-1.5 text-[var(--gc-bajo)]">
              <TrendingDown className="size-3 shrink-0" />
              Más exigente: <span className="font-medium">{group.hardest.evaluation.name}</span>{" "}
              <span className="gc-num">({formatGrade(group.hardest.avg)})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--gc-alto)]">
              <TrendingUp className="size-3 shrink-0" />
              Más favorable: <span className="font-medium">{group.easiest.evaluation.name}</span>{" "}
              <span className="gc-num">({formatGrade(group.easiest.avg)})</span>
            </div>
          </div>
        )}
      </Section>

      <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        {group.top.length > 0 && (
          <Section title="Mejores desempeños" hint="los cinco primeros">
            <div className="space-y-1">
              {group.top.map((metrics, index) => (
                <div
                  key={metrics.student.id}
                  className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-2 py-1.5"
                >
                  <span
                    className={cn(
                      "gc-num flex size-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold",
                      index === 0
                        ? "bg-[var(--gc-superior)]/20 text-[var(--gc-superior)]"
                        : "bg-white/6 text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectStudent(metrics.student.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[11.5px] font-medium">
                      {metrics.student.fullName}
                    </span>
                    <span className="gc-num block text-[9.5px] text-muted-foreground">
                      {metrics.evaluatedPct}% evaluado · {metrics.student.code}
                    </span>
                  </button>
                  <TrendStrip trend={metrics.trend} className="hidden shrink-0 md:flex" />
                  <ScoreChip score={metrics.definitiva} size="sm" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {group.attention.length > 0 && (
          <Section
            title="Requieren atención"
            hint={`${group.attention.length} por debajo de ${formatGrade(APPROVAL_GRADE)}`}
          >
            <StudentList items={group.attention.slice(0, wide ? 8 : 6)} />
          </Section>
        )}
      </div>

      {group.pending.length > 0 && (
        <Section title="Con evaluaciones pendientes" hint={`${group.totalPending} notas por calificar`}>
          <StudentList items={group.pending.slice(0, wide ? 8 : 6)} showPending />
        </Section>
      )}

      {wide && (
        <Section title="Mapa de evaluaciones" hint="promedio y avance por evaluación">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {group.evaluations.map((metric) => (
              <button
                key={metric.evaluation.id}
                type="button"
                onClick={() => selectEvaluation(metric.evaluation.id)}
                className="rounded-2xl border border-white/8 bg-white/3 p-3 text-left transition-colors hover:bg-white/6"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="gc-num text-[10px] font-semibold text-[var(--gc-cobalt)]">
                    {metric.evaluation.code}
                  </span>
                  <span className="gc-num text-[10px] text-muted-foreground">
                    {metric.evaluation.weight}%
                  </span>
                </div>
                <div className="mt-1 truncate text-[11.5px] font-medium">{metric.evaluation.name}</div>
                <MicroBars
                  className="mt-2"
                  values={dataset.students.map(
                    (student) => analytics.byStudent.get(student.id)?.grades[metric.evaluation.order] ?? null,
                  )}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9.5px] text-muted-foreground">
                    {metric.evaluatedPct}% evaluado
                  </span>
                  <LevelBadge level={metric.level} score={metric.avg} size="xs" />
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function TypeRow({
  label,
  type,
  tone,
}: {
  label: string;
  type: { type: keyof typeof TYPE_META; avg: number | null; count: number };
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-2.5 py-2">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="block truncate text-[12px] font-medium">{TYPE_META[type.type].label}</span>
      </span>
      <span className="gc-num shrink-0 text-[10px] text-muted-foreground">{type.count} est.</span>
      <ScoreChip score={type.avg} size="sm" />
    </div>
  );
}

export function StudentList({
  items,
  showPending,
}: {
  items: StudentMetrics[];
  showPending?: boolean;
}) {
  const { selectStudent, jumpToStudent, analytics } = useGradeCenter();

  if (items.length === 0) {
    return <div className="text-[11px] text-muted-foreground">Sin estudiantes en esta situación.</div>;
  }

  return (
    <div className="space-y-1">
      {items.map((metrics) => {
        const level = metrics.level;
        const attention = metrics.attention;
        return (
          <div
            key={metrics.student.id}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors",
              attention
                ? "border-[color-mix(in_oklab,var(--gc-bajo)_30%,transparent)] bg-[color-mix(in_oklab,var(--gc-bajo)_8%,transparent)]"
                : "border-white/8 bg-white/3 hover:bg-white/6",
            )}
          >
            <span
              className="h-7 w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: level ? LEVELS[level].color : "var(--muted-foreground)" }}
            />
            <button
              type="button"
              onClick={() => selectStudent(metrics.student.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[11.5px] font-medium">{metrics.student.fullName}</span>
              <span className="gc-num block text-[9.5px] text-muted-foreground">
                {metrics.student.code} ·{" "}
                {showPending ? `${metrics.pendingCount} pendientes` : `${metrics.evaluatedPct}% evaluado`}
              </span>
            </button>
            <span className="hidden shrink-0 md:block">
              <TrendStrip trend={metrics.trend} />
            </span>
            <span
              className="gc-num shrink-0 text-[12px] font-semibold"
              style={{ color: level ? LEVELS[level].color : undefined }}
            >
              {formatGrade(metrics.definitiva)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => jumpToStudent(metrics.student.id)}
                  aria-label={`Ver a ${metrics.student.fullName} en la matriz`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/8 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <Crosshair className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Ver en la matriz</TooltipContent>
            </Tooltip>
            {attention && <AlertTriangle className="size-3 shrink-0 text-[var(--gc-bajo)]" />}
            {metrics.complete && !attention && (
              <span className="sr-only">Sin pendientes</span>
            )}
            {analytics.byStudent.get(metrics.student.id)?.pendingCount === 0 && !attention && (
              <Clock className="size-3 shrink-0 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { Trophy };

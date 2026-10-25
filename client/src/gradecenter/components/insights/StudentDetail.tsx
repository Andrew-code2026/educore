import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelTint } from "../../domain/scale";
import { approvalOutlook } from "../../domain/outlook";
import type { EvaluationOutcome, StudentMetrics } from "../../domain/metrics";
import { TYPE_META } from "../../data/curriculum";
import { formatGrade, initials } from "../../lib/format";
import { LevelBar, Sparkline } from "./primitives";

/** Mínimo de notas para que la evolución diga algo (con una o dos es solo ruido). */
const MIN_POINTS_FOR_TREND = 3;

/**
 * Ficha del estudiante, reducida a lo que el docente necesita decidir:
 * cuánto lleva, si va a aprobar y qué le falta. Cada evaluación lleva directo
 * a su celda en la planilla para calificarla.
 */
export function StudentDetail({ metrics, layout = "panel" }: { metrics: StudentMetrics; layout?: "panel" | "wide" }) {
  const { analytics, jumpToCell } = useGradeCenter();
  const level = metrics.level;
  const wide = layout === "wide";
  const outlook = approvalOutlook(metrics);
  const groupAverage = analytics.group.average;
  const gradedPoints = metrics.series.filter((point) => point.grade != null).length;

  return (
    <div className="space-y-5">
      {/* Identidad y definitiva */}
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", wide ? "size-12 text-base" : "size-10 text-sm")}
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : "var(--muted-foreground)",
          }}
        >
          {initials(metrics.student)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn("truncate font-semibold", wide ? "text-lg" : "text-base")}>{metrics.student.fullName}</h2>
          <p className="text-xs text-muted-foreground">Código <span className="gc-num">{metrics.student.code}</span></p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={cn("gc-num leading-none font-semibold", wide ? "text-3xl" : "text-2xl")}
            style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
          >
            {formatGrade(metrics.definitiva)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{level ? LEVELS[level].short : "Sin notas"}</div>
        </div>
      </header>

      {/* Situación: una frase y una barra */}
      <section aria-label="Situación del estudiante" className="space-y-2">
        <LevelBar score={metrics.definitiva} />
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {metrics.evaluatedPct}% evaluado
            {metrics.provisional && metrics.gradedCount > 0 ? " · definitiva provisional" : ""}
          </span>
          {groupAverage != null && (
            <span>
              Promedio del grupo <span className="gc-num">{formatGrade(groupAverage)}</span>
            </span>
          )}
        </div>
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            outlook.tone === "good" && "bg-[var(--gc-alto)]/10 text-[var(--gc-alto)]",
            outlook.tone === "bad" && "bg-[var(--gc-bajo)]/10 text-[var(--gc-bajo)]",
            (outlook.tone === "neutral" || outlook.tone === "empty") && "bg-foreground/5 text-foreground/80",
          )}
        >
          {outlook.text}
        </p>
      </section>

      {/* Notas por evaluación */}
      <section aria-labelledby={`notas-${metrics.student.id}`}>
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 id={`notas-${metrics.student.id}`} className="text-sm font-semibold">
            Notas
          </h3>
          <span className="text-xs text-muted-foreground">
            {metrics.gradedCount} de {metrics.outcomes.length} calificadas
          </span>
        </div>
        {metrics.outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay evaluaciones en este periodo.</p>
        ) : (
          <ul className="divide-y divide-[var(--gc-hair)] overflow-hidden rounded-xl border border-[var(--gc-hair)]">
            {metrics.outcomes.map((outcome) => (
              <OutcomeRow
                key={outcome.evaluation.id}
                outcome={outcome}
                onOpen={() => jumpToCell(metrics.student.id, outcome.evaluation.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Evolución: solo cuando hay suficientes notas para leer una tendencia */}
      {gradedPoints >= MIN_POINTS_FOR_TREND && (
        <section aria-label="Evolución en el periodo">
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Evolución</h3>
            <span className="text-xs text-muted-foreground">{metrics.trend.label}</span>
          </div>
          <Sparkline
            points={metrics.series.map((point) => point.grade)}
            groupPoints={metrics.series.map((point) => point.groupAvg)}
            color={level ? LEVELS[level].color : undefined}
            width={wide ? 620 : 340}
            height={wide ? 72 : 56}
            className="w-full"
          />
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: level ? LEVELS[level].color : "currentColor" }} />
              Estudiante
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-current opacity-60" />
              Promedio del grupo
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

function OutcomeRow({ outcome, onOpen }: { outcome: EvaluationOutcome; onOpen: () => void }) {
  const { evaluation, grade, level } = outcome;
  const preparing = evaluation.status === "preparing";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title={grade == null ? "Calificar en la planilla" : "Ver en la planilla"}
        className="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/4 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{evaluation.name}</span>
          <span className="block text-xs text-muted-foreground">
            {evaluation.code} · {TYPE_META[evaluation.type].short} · {preparing ? "no cuenta" : `${evaluation.weight}%`}
          </span>
        </span>
        {grade == null ? (
          <span className="shrink-0 text-xs text-muted-foreground group-hover:text-[var(--gc-cobalt)]">
            {preparing ? "En preparación" : "Pendiente"}
          </span>
        ) : (
          <span className="gc-num shrink-0 text-sm font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>
            {formatGrade(grade)}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" aria-hidden />
      </button>
    </li>
  );
}

import { ChevronRight, ClipboardPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { TYPE_META } from "../../data/curriculum";
import { LEVELS } from "../../domain/scale";
import type { EvaluationMetric } from "../../domain/metrics";
import { gradeKey } from "../../types";
import { formatGrade, formatShortDate } from "../../lib/format";
import { useGradeCenterDialogs } from "../dialogs/DialogsProvider";
import { LEVEL_SEGMENTS, LevelLegend, LevelStack } from "../insights/LevelStack";

/**
 * Vista Evaluaciones: una fila por evaluación con lo que se compara entre
 * ellas (ponderación, promedio y cómo le fue al grupo). Cada fila lleva a la
 * planilla en esa columna, empezando por el primer estudiante pendiente.
 */
export function EvaluationsView() {
  const { analytics, dataset, students, readOnly, jumpToCell } = useGradeCenter();
  const dialogs = useGradeCenterDialogs();
  const metrics = dataset.evaluations
    .map((evaluation) => analytics.byEvaluation.get(evaluation.id))
    .filter((metric): metric is EvaluationMetric => Boolean(metric));

  const open = (metric: EvaluationMetric) => {
    // Se respeta el orden visible de la planilla (búsqueda, filtros y orden actuales).
    const visible = students.map((item) => item.student);
    const ordered = visible.length > 0 ? visible : dataset.students;
    const firstPending = ordered.find((student) => dataset.grades[gradeKey(student.id, metric.evaluation.id)] == null);
    const target = firstPending ?? ordered[0];
    if (target) jumpToCell(target.id, metric.evaluation.id);
  };

  if (metrics.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-base font-semibold">Aún no hay evaluaciones</div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Cuando crees evaluaciones podrás compararlas aquí.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={dialogs.openNewEvaluation}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--gc-cobalt)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--gc-cobalt)]/90"
            >
              <ClipboardPlus className="size-4" aria-hidden />
              Nueva evaluación
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-base font-semibold">
            {metrics.length} {metrics.length === 1 ? "evaluación" : "evaluaciones"}
          </h2>
          <LevelLegend restLabel="Pendiente" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--gc-hair)] bg-[var(--gc-ink)]">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[var(--gc-abyss)] text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Evaluación</th>
                <th scope="col" className="w-28 px-4 py-2.5 text-right font-medium">Ponderación</th>
                <th scope="col" className="w-28 px-4 py-2.5 text-right font-medium">Promedio</th>
                <th scope="col" className="w-[34%] px-4 py-2.5 font-medium">Resultados del grupo</th>
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">Abrir en la planilla</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <EvaluationRow key={metric.evaluation.id} metric={metric} total={dataset.students.length} onOpen={() => open(metric)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EvaluationRow({ metric, total, onOpen }: { metric: EvaluationMetric; total: number; onOpen: () => void }) {
  const { evaluation, level } = metric;
  const preparing = evaluation.status === "preparing";
  const actionLabel = metric.pending > 0 ? `Calificar ${evaluation.name}` : `Ver ${evaluation.name} en la planilla`;

  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer border-t border-[var(--gc-hair)] transition-colors hover:bg-foreground/[0.03]"
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{evaluation.name}</div>
        <div className="text-xs text-muted-foreground">
          {evaluation.code} · {TYPE_META[evaluation.type].short}
          {evaluation.date ? ` · ${formatShortDate(evaluation.date)}` : ""}
          {preparing && " · En preparación"}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={cn("gc-num text-sm", preparing && "text-muted-foreground")}>
          {preparing ? "No cuenta" : `${evaluation.weight}%`}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {metric.avg == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <>
            <div className="gc-num text-sm font-semibold" style={{ color: level ? LEVELS[level].color : undefined }}>
              {formatGrade(metric.avg)}
            </div>
            <div className="text-xs text-muted-foreground">{level ? LEVELS[level].short : ""}</div>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <ResultsBar metric={metric} total={total} />
      </td>
      <td className="px-2 py-3 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          aria-label={actionLabel}
          title={metric.pending > 0 ? "Calificar en la planilla" : "Ver en la planilla"}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:text-foreground hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

/** Una sola barra: cuántos estudiantes cayeron en cada nivel y cuántos faltan por calificar. */
function ResultsBar({ metric, total }: { metric: EvaluationMetric; total: number }) {
  const summary = LEVEL_SEGMENTS.filter((level) => metric.distribution[level] > 0)
    .map((level) => `${metric.distribution[level]} ${LEVELS[level].short}`)
    .join(", ");

  return (
    <div>
      <LevelStack
        counts={metric.distribution}
        total={total}
        label={`${metric.gradedCount} de ${total} calificados${summary ? `: ${summary}` : ""}`}
      />
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>
          <span className="gc-num">{metric.gradedCount}</span> de <span className="gc-num">{total}</span> calificados
        </span>
        {metric.pending > 0 && (
          <span>
            <span className="gc-num">{metric.pending}</span> {metric.pending === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </div>
    </div>
  );
}

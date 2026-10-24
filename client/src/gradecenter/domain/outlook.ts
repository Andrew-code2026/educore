import { APPROVAL_GRADE, MAX_GRADE } from "./scale";
import type { StudentMetrics } from "./metrics";

export type OutlookTone = "good" | "neutral" | "bad" | "empty";

export interface ApprovalOutlook {
  tone: OutlookTone;
  /** Frase corta y accionable para el docente. */
  text: string;
  /** Promedio que necesita en lo pendiente para aprobar (si aplica). */
  needed: number | null;
}

/**
 * ¿Qué necesita el estudiante para aprobar? Usa el mismo contrato que la
 * definitiva: las evaluaciones en preparación no cuentan y la nota final se
 * pondera sobre el total de ponderación calificable.
 */
export function approvalOutlook(metrics: StudentMetrics): ApprovalOutlook {
  const calculable = metrics.outcomes.filter((outcome) => outcome.evaluation.status !== "preparing");
  const totalWeight = calculable.reduce((sum, outcome) => sum + outcome.evaluation.weight, 0);
  const pendingWeight = calculable
    .filter((outcome) => outcome.grade == null)
    .reduce((sum, outcome) => sum + outcome.evaluation.weight, 0);
  const weightedSum = calculable.reduce((sum, outcome) => sum + (outcome.grade ?? 0) * outcome.evaluation.weight, 0);

  if (totalWeight === 0) return { tone: "empty", text: "Aún no hay evaluaciones que cuenten en la definitiva.", needed: null };
  if (metrics.gradedCount === 0) return { tone: "empty", text: "Todavía no tiene notas registradas.", needed: null };

  if (pendingWeight === 0) {
    return metrics.definitiva != null && metrics.definitiva >= APPROVAL_GRADE
      ? { tone: "good", text: "Aprueba el periodo.", needed: null }
      : { tone: "bad", text: "No alcanza el mínimo para aprobar.", needed: null };
  }

  const needed = (APPROVAL_GRADE * totalWeight - weightedSum) / pendingWeight;
  if (needed <= 0) return { tone: "good", text: "Ya tiene asegurada la aprobación.", needed: null };
  if (needed > MAX_GRADE) return { tone: "bad", text: "Ya no alcanza el mínimo, aun con 5.0 en lo pendiente.", needed };
  return { tone: "neutral", text: `Necesita ${needed.toFixed(1)} en promedio en lo pendiente para aprobar.`, needed };
}

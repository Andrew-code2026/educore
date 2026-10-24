import { clamp, roundGrade } from "../data/seed";
import type { Evaluation, GradeMap, GradeValue } from "../types";
import { MAX_GRADE, MIN_GRADE, PROVISIONAL_THRESHOLD } from "./scale";

/**
 * Contrato académico del Grade Center:
 * - La escala válida es inclusiva de 0.0 a 5.0.
 * - La definitiva usa solo el peso de evaluaciones calificadas.
 * - Si falta más del umbral institucional de evidencia, el resultado es provisional.
 */
export interface DefinitiveResult {
  score: number | null;
  evaluatedWeight: number;
  totalWeight: number;
  evaluatedPct: number;
  provisional: boolean;
}

export function normalizeGrade(value: GradeValue): GradeValue {
  if (value == null || !Number.isFinite(value)) return null;
  return roundGrade(clamp(value, MIN_GRADE, MAX_GRADE));
}

export function calculateDefinitive(
  evaluations: Evaluation[],
  grades: GradeMap,
  studentId: string,
): DefinitiveResult {
  const calculable = evaluations.filter((evaluation) => evaluation.status !== "preparing");
  const totalWeight = calculable.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const evaluated = calculable.filter((evaluation) => grades[`${studentId}::${evaluation.id}`] != null);
  const evaluatedWeight = evaluated.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const weightedSum = evaluated.reduce((sum, evaluation) => {
    const grade = grades[`${studentId}::${evaluation.id}`] as number;
    return sum + grade * evaluation.weight;
  }, 0);
  const score = evaluatedWeight > 0 ? roundGrade(weightedSum / evaluatedWeight) : null;
  const evaluatedPct = totalWeight > 0 ? Math.round((evaluatedWeight / totalWeight) * 100) : 0;

  return {
    score,
    evaluatedWeight,
    totalWeight,
    evaluatedPct,
    provisional: evaluatedPct < PROVISIONAL_THRESHOLD,
  };
}

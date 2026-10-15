import {
  gradeKey,
  type Dataset,
  type Evaluation,
  type GradeValue,
  type LevelId,
  type Student,
} from "../types";
import { TYPE_META } from "../data/curriculum";
import { clamp, roundGrade } from "../data/seed";
import { APPROVAL_GRADE, levelFromScore, type LevelMeta } from "./scale";
import { calculateDefinitive } from "./grading";

/* -------------------------------------------------------------------------- */
/* Tendencias                                                                 */
/* -------------------------------------------------------------------------- */

export type TrendDirection = "up" | "down" | "flat";

export interface TrendInfo {
  direction: TrendDirection;
  /** Pendiente por evaluación (en puntos de la escala 0–5). */
  slope: number;
  label: string;
}

const TREND_THRESHOLD = 0.035;

function linearSlope(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  const n = points.length;
  const meanX = points.reduce((acc, p) => acc + p.x, 0) / n;
  const meanY = points.reduce((acc, p) => acc + p.y, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p) => {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

function describeTrend(slope: number): TrendInfo {
  if (slope > TREND_THRESHOLD) {
    return { direction: "up", slope, label: "En ascenso" };
  }
  if (slope < -TREND_THRESHOLD) {
    return { direction: "down", slope, label: "En descenso" };
  }
  return { direction: "flat", slope, label: "Estable" };
}

/* -------------------------------------------------------------------------- */
/* Métricas por estudiante                                                    */
/* -------------------------------------------------------------------------- */

export interface EvaluationOutcome {
  evaluation: Evaluation;
  grade: GradeValue;
  level: LevelId | null;
  /** Diferencia frente al promedio del grupo en esa evaluación. */
  delta: number | null;
}

export interface TypeOutcome {
  type: Evaluation["type"];
  label: string;
  avg: number | null;
  count: number;
}

export interface DbaOutcome {
  id: string;
  code: string;
  title: string;
  statement: string;
  avg: number | null;
  level: LevelId | null;
  evidenceCount: number;
  evaluations: { evaluation: Evaluation; grade: GradeValue }[];
}

export interface StudentMetrics {
  student: Student;
  outcomes: EvaluationOutcome[];
  grades: GradeValue[];
  definitiva: number | null;
  level: LevelId | null;
  evaluatedWeight: number;
  evaluatedPct: number;
  gradedCount: number;
  pendingCount: number;
  complete: boolean;
  provisional: boolean;
  attention: boolean;
  trend: TrendInfo;
  best: EvaluationOutcome | null;
  worst: EvaluationOutcome | null;
  byType: TypeOutcome[];
  dba: DbaOutcome[];
  /** Índice simple de desempeño usado por el ordenamiento "por desempeño". */
  performanceIndex: number;
  /** Serie de notas evaluadas, para sparklines. */
  series: { evaluation: Evaluation; grade: GradeValue; groupAvg: number | null }[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function computeStudentMetrics(
  dataset: Dataset,
  student: Student,
  evaluationMetrics: Map<string, EvaluationMetric>,
): StudentMetrics {
  const outcomes: EvaluationOutcome[] = dataset.evaluations.map((evaluation) => {
    const grade = dataset.grades[gradeKey(student.id, evaluation.id)] ?? null;
    const groupAvg = evaluationMetrics.get(evaluation.id)?.avg ?? null;
    return {
      evaluation,
      grade,
      level: levelFromScore(grade),
      delta: grade != null && groupAvg != null ? roundGrade(grade - groupAvg) : null,
    };
  });

  const evaluated = outcomes.filter((o) => o.grade != null);
  const definitive = calculateDefinitive(dataset.evaluations, dataset.grades, student.id);
  const { definitiva, evaluatedWeight, evaluatedPct } = {
    definitiva: definitive.score,
    evaluatedWeight: definitive.evaluatedWeight,
    evaluatedPct: definitive.evaluatedPct,
  };

  const slope = linearSlope(
    evaluated.map((o) => ({ x: o.evaluation.order, y: o.grade as number })),
  );

  const sorted = [...evaluated].sort((a, b) => (b.grade as number) - (a.grade as number));

  const typeGroups = new Map<string, number[]>();
  evaluated.forEach((o) => {
    const list = typeGroups.get(o.evaluation.type) ?? [];
    list.push(o.grade as number);
    typeGroups.set(o.evaluation.type, list);
  });
  const byType: TypeOutcome[] = [...typeGroups.entries()]
    .map(([type, values]) => ({
      type: type as Evaluation["type"],
      label: TYPE_META[type as Evaluation["type"]].label,
      avg: average(values) == null ? null : roundGrade(average(values) as number),
      count: values.length,
    }))
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  const dba: DbaOutcome[] = dataset.dba
    .map((item) => {
      const evidence = outcomes.filter((o) => o.evaluation.dbaIds.includes(item.id));
      const gradedEvidence = evidence.filter((o) => o.grade != null);
      const avg = average(gradedEvidence.map((o) => o.grade as number));
      return {
        id: item.id,
        code: item.code,
        title: item.title,
        statement: item.statement,
        avg: avg == null ? null : roundGrade(avg),
        level: levelFromScore(avg),
        evidenceCount: gradedEvidence.length,
        evaluations: evidence.map((o) => ({ evaluation: o.evaluation, grade: o.grade })),
      } satisfies DbaOutcome;
    })
    .filter((item) => item.evaluations.length > 0);

  const provisional = definitive.provisional;

  return {
    student,
    outcomes,
    grades: outcomes.map((o) => o.grade),
    definitiva,
    level: levelFromScore(definitiva),
    evaluatedWeight,
    evaluatedPct,
    gradedCount: evaluated.length,
    pendingCount: outcomes.length - evaluated.length,
    complete: evaluated.length === outcomes.length,
    provisional,
    attention: definitiva != null && definitiva < APPROVAL_GRADE,
    trend: describeTrend(slope),
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
    byType,
    dba,
    performanceIndex: clamp((definitiva ?? 0) + slope * 1.2, 0, 5.4),
    series: outcomes.map((o) => ({
      evaluation: o.evaluation,
      grade: o.grade,
      groupAvg: evaluationMetrics.get(o.evaluation.id)?.avg ?? null,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Métricas por evaluación                                                    */
/* -------------------------------------------------------------------------- */

export interface EvaluationMetric {
  evaluation: Evaluation;
  avg: number | null;
  min: number | null;
  max: number | null;
  level: LevelId | null;
  gradedCount: number;
  pending: number;
  evaluatedPct: number;
  distribution: Record<LevelId, number>;
  /** Diferencia del promedio con la media del grupo en el periodo. */
  delta: number | null;
}

export function computeEvaluationMetrics(dataset: Dataset, evaluation: Evaluation): EvaluationMetric {
  const values: number[] = [];
  const distribution: Record<LevelId, number> = { bajo: 0, basico: 0, alto: 0, superior: 0 };
  let pending = 0;

  dataset.students.forEach((student) => {
    const grade = dataset.grades[gradeKey(student.id, evaluation.id)] ?? null;
    if (grade == null) {
      pending += 1;
      return;
    }
    values.push(grade);
    const level = levelFromScore(grade);
    if (level) distribution[level] += 1;
  });

  const avg = average(values);
  const total = dataset.students.length;

  return {
    evaluation,
    avg: avg == null ? null : roundGrade(avg),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    level: levelFromScore(avg),
    gradedCount: values.length,
    pending,
    evaluatedPct: total === 0 ? 0 : Math.round((values.length / total) * 100),
    distribution,
    delta: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Métricas del grupo                                                         */
/* -------------------------------------------------------------------------- */

export interface GroupMetrics {
  average: number | null;
  approvalPct: number;
  completePct: number;
  distribution: Record<LevelId, number>;
  totalPending: number;
  attention: StudentMetrics[];
  pending: StudentMetrics[];
  top: StudentMetrics[];
  evaluations: EvaluationMetric[];
  ranking: EvaluationMetric[];
  hardest: EvaluationMetric | null;
  easiest: EvaluationMetric | null;
  strongestType: TypeOutcome | null;
  weakestType: TypeOutcome | null;
  levelSummary: { level: LevelId; meta: LevelMeta; count: number; pct: number }[];
  riskStudents: StudentMetrics[];
  improving: StudentMetrics[];
  declining: StudentMetrics[];
}

export interface Analytics {
  students: StudentMetrics[];
  byStudent: Map<string, StudentMetrics>;
  byEvaluation: Map<string, EvaluationMetric>;
  group: GroupMetrics;
}

export function buildAnalytics(dataset: Dataset): Analytics {
  const byEvaluation = new Map<string, EvaluationMetric>();
  dataset.evaluations.forEach((evaluation) => {
    byEvaluation.set(evaluation.id, computeEvaluationMetrics(dataset, evaluation));
  });

  const students = dataset.students.map((student) =>
    computeStudentMetrics(dataset, student, byEvaluation),
  );

  const evaluations = dataset.evaluations.map((evaluation) => {
    const metric = byEvaluation.get(evaluation.id) as EvaluationMetric;
    return metric;
  });

  const gradedAverages = students
    .filter((student) => !student.provisional)
    .map((s) => s.definitiva)
    .filter((v): v is number => v != null);
  const groupAverage = gradedAverages.length ? roundGrade(average(gradedAverages) as number) : null;

  const distribution: Record<LevelId, number> = { bajo: 0, basico: 0, alto: 0, superior: 0 };
  students.forEach((s) => {
    if (!s.provisional && s.level) distribution[s.level] += 1;
  });

  const evaluatedStudents = students.filter((s) => s.definitiva != null && !s.provisional);
  const approved = evaluatedStudents.filter((s) => (s.definitiva as number) >= APPROVAL_GRADE).length;
  const approvalPct = evaluatedStudents.length
    ? Math.round((approved / evaluatedStudents.length) * 100)
    : 0;
  const completePct = students.length
    ? Math.round((students.filter((s) => s.complete).length / students.length) * 100)
    : 0;

  const typeMap = new Map<string, number[]>();
  students.filter((student) => !student.provisional).forEach((s) => {
    s.byType.forEach((t) => {
      const list = typeMap.get(t.type) ?? [];
      if (t.avg != null) list.push(t.avg);
      typeMap.set(t.type, list);
    });
  });
  const groupByType: TypeOutcome[] = [...typeMap.entries()]
    .map(([type, values]) => ({
      type: type as Evaluation["type"],
      label: TYPE_META[type as Evaluation["type"]].label,
      avg: values.length ? roundGrade(average(values) as number) : null,
      count: values.length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  const ranking = [...evaluations]
    .filter((e) => e.avg != null)
    .sort((a, b) => (a.avg as number) - (b.avg as number));

  const levelSummary = (["bajo", "basico", "alto", "superior"] as LevelId[]).map((level) => {
    const count = distribution[level];
    return {
      level,
      meta: { id: level } as LevelMeta,
      count,
      pct: evaluatedStudents.length ? Math.round((count / evaluatedStudents.length) * 100) : 0,
    };
  });

  const totalPending = evaluations.reduce((acc, e) => acc + e.pending, 0);

  return {
    students,
    byStudent: new Map(students.map((s) => [s.student.id, s])),
    byEvaluation,
    group: {
      average: groupAverage,
      approvalPct,
      completePct,
      distribution,
      totalPending,
      attention: [...students].filter((s) => s.attention).sort((a, b) => (a.definitiva ?? 0) - (b.definitiva ?? 0)),
      pending: [...students].filter((s) => s.pendingCount > 0).sort((a, b) => b.pendingCount - a.pendingCount),
      top: [...students]
        .filter((s) => s.definitiva != null && !s.provisional)
        .sort((a, b) => (b.definitiva as number) - (a.definitiva as number))
        .slice(0, 5),
      evaluations,
      ranking,
      hardest: ranking[0] ?? null,
      easiest: ranking[ranking.length - 1] ?? null,
      strongestType: groupByType[0] ?? null,
      weakestType: groupByType[groupByType.length - 1] ?? null,
      levelSummary,
      riskStudents: [...students]
        .filter((s) => s.attention || s.trend.direction === "down" || s.pendingCount > 1)
        .sort((a, b) => (a.definitiva ?? 0) - (b.definitiva ?? 0))
        .slice(0, 8),
      improving: [...students].filter((s) => s.trend.direction === "up").length
        ? [...students].filter((s) => s.trend.direction === "up").sort((a, b) => b.trend.slope - a.trend.slope)
        : [],
      declining: [...students].filter((s) => s.trend.direction === "down").sort((a, b) => a.trend.slope - b.trend.slope),
    },
  };
}

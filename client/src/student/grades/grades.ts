/**
 * Modelo de "Mis calificaciones" a partir de `student.grades`. Usa la escala institucional del
 * Grade Center para que el estudiante vea el mismo nivel y la misma proyección que su docente.
 */
import { APPROVAL_GRADE, MAX_GRADE, PROVISIONAL_THRESHOLD, levelFromScore, needsAttention } from "@/gradecenter/domain/scale";
import type { LevelId } from "@/gradecenter/types";
import { formatGrade, plural, toDate } from "../format";

export interface RawEvaluation {
  id: number;
  title: string;
  type: string;
  weight: number;
  date: Date | string;
  value: number | null;
  comment: string | null;
}

export interface RawSubject {
  subjectId: number;
  name: string;
  teacherName: string | null;
  average: number | null;
  gradedWeight: number;
  totalWeight: number;
  evaluations: RawEvaluation[];
}

export interface RawPeriod {
  id: number;
  name: string;
  state: "closed" | "active" | "scheduled";
}

export interface RawGrades {
  period: RawPeriod | null;
  periods: RawPeriod[];
  subjects: RawSubject[];
  average: number | null;
  previous: { periodName: string; average: number | null } | null;
  reportCardGeneratedAt: Date | string | null;
}

export type EvaluationState = "graded" | "pending" | "upcoming";

export interface EvaluationModel {
  id: number;
  title: string;
  typeLabel: string;
  weight: number;
  date: Date;
  value: number | null;
  comment: string | null;
  state: EvaluationState;
}

export type OutlookTone = "good" | "neutral" | "warn" | "bad" | "empty";

export interface Outlook {
  tone: OutlookTone;
  text: string;
  needed: number | null;
}

export interface SubjectModel {
  id: number;
  name: string;
  teacherName: string | null;
  average: number | null;
  level: LevelId | null;
  needsAttention: boolean;
  /** Porcentaje del peso del periodo que ya tiene nota (0–100). */
  evaluatedPct: number;
  /** Menos del 60 % evaluado: la definitiva aún puede moverse mucho. */
  provisional: boolean;
  graded: number;
  total: number;
  evaluations: EvaluationModel[];
  outlook: Outlook;
}

export interface GradesModel {
  periodName: string | null;
  periodClosed: boolean;
  average: number | null;
  level: LevelId | null;
  /** "+0.1 vs Periodo 3" o null sin periodo anterior comparable. */
  deltaLabel: string | null;
  subjects: SubjectModel[];
  attention: number;
  graded: number;
  total: number;
  /** Materia seleccionada por defecto: la que requiere atención o la primera. */
  defaultSubjectId: number | null;
  reportCardOfficial: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  QUIZ: "Quiz",
  TALLER: "Taller",
  EXAMEN: "Examen",
  PROYECTO: "Proyecto",
  ACTIVIDAD: "Actividad",
  PARTICIPACION: "Participación",
  RECUPERACION: "Recuperación",
  OTRO: "Otro",
};

export const typeLabel = (type: string) => TYPE_LABELS[type?.toUpperCase()] ?? "Evaluación";

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * ¿Qué necesitas para aprobar? Mismo contrato que `approvalOutlook` del Grade Center
 * (pondera sobre el peso calificable y el umbral institucional), en segunda persona.
 */
export function subjectOutlook(evaluations: Pick<EvaluationModel, "weight" | "value">[], closed: boolean): Outlook {
  const counted = evaluations.filter(evaluation => evaluation.weight > 0);
  const totalWeight = counted.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const graded = counted.filter((evaluation): evaluation is { weight: number; value: number } => evaluation.value !== null);
  const pendingWeight = totalWeight - graded.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const weightedSum = graded.reduce((sum, evaluation) => sum + evaluation.value * evaluation.weight, 0);

  if (totalWeight === 0) return { tone: "empty", text: "Aún no hay evaluaciones en esta materia.", needed: null };
  if (graded.length === 0) return { tone: "empty", text: "Todavía no tienes notas en esta materia.", needed: null };
  const average = weightedSum / (totalWeight - pendingWeight);

  if (pendingWeight === 0 || closed) {
    return average >= APPROVAL_GRADE
      ? { tone: "good", text: closed ? "Aprobaste la materia en este periodo." : "Con todas tus notas, apruebas el periodo.", needed: null }
      : { tone: "bad", text: `Quedaste por debajo de ${formatGrade(APPROVAL_GRADE)}. Pregunta a tu docente por el plan de mejoramiento.`, needed: null };
  }
  const needed = (APPROVAL_GRADE * totalWeight - weightedSum) / pendingWeight;
  if (needed <= 0) return { tone: "good", text: "Ya tienes asegurada la aprobación.", needed: null };
  if (needed > MAX_GRADE) return { tone: "bad", text: `Aun con ${formatGrade(MAX_GRADE)} en lo pendiente no alcanzas ${formatGrade(APPROVAL_GRADE)}. Habla con tu docente.`, needed };
  return {
    tone: average < APPROVAL_GRADE ? "warn" : "neutral",
    text: `Necesitas ${formatGrade(round1(needed))} en promedio en lo pendiente para aprobar.`,
    needed: round1(needed),
  };
}

export function buildGradesModel(data: RawGrades, now: Date = new Date()): GradesModel {
  const periodClosed = data.period?.state === "closed";
  const subjects = data.subjects.map((subject): SubjectModel => {
    const evaluations = subject.evaluations
      .map((evaluation): EvaluationModel => {
        const date = toDate(evaluation.date);
        return {
          id: evaluation.id,
          title: evaluation.title,
          typeLabel: typeLabel(evaluation.type),
          weight: evaluation.weight,
          date,
          value: evaluation.value,
          comment: evaluation.comment,
          state: evaluation.value !== null ? "graded" : date.getTime() > now.getTime() ? "upcoming" : "pending",
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const evaluatedPct = subject.totalWeight ? Math.round((subject.gradedWeight / subject.totalWeight) * 100) : 0;
    return {
      id: subject.subjectId,
      name: subject.name,
      teacherName: subject.teacherName,
      average: subject.average,
      level: levelFromScore(subject.average),
      needsAttention: needsAttention(subject.average),
      evaluatedPct,
      provisional: subject.average !== null && evaluatedPct < PROVISIONAL_THRESHOLD,
      graded: evaluations.filter(evaluation => evaluation.state === "graded").length,
      total: evaluations.length,
      evaluations,
      outlook: subjectOutlook(evaluations, periodClosed),
    };
  });

  const previous = data.previous?.average ?? null;
  const delta = data.average !== null && previous !== null ? round1(data.average - previous) : null;
  const deltaLabel =
    delta === null || !data.previous
      ? null
      : delta === 0
        ? `Igual que ${data.previous.periodName}`
        : `${delta > 0 ? "+" : "−"}${formatGrade(Math.abs(delta))} vs ${data.previous.periodName}`;

  const attention = subjects.filter(subject => subject.needsAttention);
  return {
    periodName: data.period?.name ?? null,
    periodClosed,
    average: data.average,
    level: levelFromScore(data.average),
    deltaLabel,
    subjects,
    attention: attention.length,
    graded: subjects.reduce((sum, subject) => sum + subject.graded, 0),
    total: subjects.reduce((sum, subject) => sum + subject.total, 0),
    defaultSubjectId: attention[0]?.id ?? subjects[0]?.id ?? null,
    reportCardOfficial: Boolean(data.reportCardGeneratedAt),
  };
}

/** Nota de la franja: "1 requiere atención" o "Todas al día". */
export function attentionNote(model: GradesModel): string {
  if (!model.subjects.length) return "Sin materias en el periodo";
  return model.attention ? `${plural(model.attention, "requiere", "requieren")} atención` : "Todas por encima de 3.5";
}

/** Periodos que el estudiante puede consultar: los cerrados y el activo. */
export function visiblePeriods(periods: RawPeriod[]): RawPeriod[] {
  return periods.filter(period => period.state !== "scheduled");
}

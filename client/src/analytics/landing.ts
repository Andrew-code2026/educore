/**
 * Modelo de presentación de "Análisis & Alertas": cruza las planillas reales de
 * Grade Center con las alertas de inasistencia del módulo de Asistencia.
 * Sin dependencias de React para poder probarse de forma aislada.
 */

/** Nota aprobatoria de la escala institucional (0–5). */
export const PASSING_GRADE = 3;
export const GRADE_SCALE_MAX = 5;
/** Alertas visibles antes de "Ver todas". */
export const ALERTS_PREVIEW_LIMIT = 6;

/** Resumen de una planilla (curso × materia) tal como lo entrega `gradeCenter.assignments`. */
export interface PlanillaInput {
  courseId: number;
  courseName: string;
  subjectId: number;
  subjectName: string;
  academicYear: string;
  students: number;
  evaluations: number;
  graded: number;
  total: number;
  average?: number | null;
  belowPassing?: Array<{ studentId: number; name: string; average: number }>;
}

/** Alerta de inasistencia ya calculada con las reglas de Asistencia. */
export interface AttendanceAlertInput {
  studentName: string;
  initials: string;
  group: string;
  subject: string;
  /** "3 ausencias consecutivas" */
  label: string;
  /** "86% asistencia" */
  detail: string;
  severity: "high" | "medium" | "low";
}

export type AlertKind = "academic" | "attendance";
export type AlertFilter = "all" | AlertKind;

export interface AlertModel {
  key: string;
  kind: AlertKind;
  studentName: string;
  initials: string;
  group: string;
  subject: string;
  reason: string;
  detail: string;
  severity: "high" | "medium";
  /** Definitiva parcial (solo alertas académicas). */
  grade: number | null;
}

export type PlanillaTone = "low" | "ok" | "empty";

export interface PlanillaModel {
  key: string;
  group: string;
  subject: string;
  students: number;
  evaluations: number;
  graded: number;
  total: number;
  progressPct: number;
  average: number | null;
  tone: PlanillaTone;
  belowPassing: number;
}

export interface AnalyticsSummary {
  /** Promedio ponderado por notas registradas en todas las planillas. */
  average: number | null;
  planillasWithGrades: number;
  /** Estudiantes únicos con al menos una alerta. */
  flaggedStudents: number;
  academic: number;
  attendance: number;
  graded: number;
  total: number;
  progressPct: number | null;
}

export interface AnalyticsLandingModel {
  academicYear: string;
  summary: AnalyticsSummary;
  alerts: AlertModel[];
  /** Planillas con al menos una evaluación, las que requieren atención primero. */
  planillas: PlanillaModel[];
  /** Planillas sin evaluaciones: no aportan métricas, se listan aparte. */
  unstarted: PlanillaModel[];
}

export interface AnalyticsLandingInput {
  planillas: PlanillaInput[];
  attendanceAlerts: AttendanceAlertInput[];
  now?: Date;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Nota con un decimal, igual que Grade Center: 2.94 → "2.9". */
export function formatGrade(value: number): string {
  return value.toFixed(1);
}

/** "Daniel Torres Rivas" → "DT" */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const SEVERITY_RANK: Record<AlertModel["severity"], number> = { high: 0, medium: 1 };

function academicAlerts(planillas: PlanillaInput[]): AlertModel[] {
  return planillas.flatMap((planilla) =>
    (planilla.belowPassing ?? []).map((student) => ({
      key: `academic:${planilla.courseId}:${planilla.subjectId}:${student.studentId}`,
      kind: "academic" as const,
      studentName: student.name,
      initials: initialsOf(student.name),
      group: planilla.courseName,
      subject: planilla.subjectName,
      reason: `Definitiva parcial ${formatGrade(student.average)}`,
      detail: `Por debajo de ${formatGrade(PASSING_GRADE)}`,
      severity: "high" as const,
      grade: student.average,
    })),
  );
}

function attendanceAlerts(inputs: AttendanceAlertInput[]): AlertModel[] {
  return inputs
    .filter((input) => input.severity !== "low")
    .map((input) => ({
      key: `attendance:${input.group}:${input.subject}:${normalizeName(input.studentName)}`,
      kind: "attendance" as const,
      studentName: input.studentName,
      initials: input.initials || initialsOf(input.studentName),
      group: input.group,
      subject: input.subject,
      reason: input.label,
      detail: input.detail,
      severity: input.severity as AlertModel["severity"],
      grade: null,
    }));
}

/** Gravedad primero; a igual gravedad, la nota más baja y luego el nombre. */
function byUrgency(a: AlertModel, b: AlertModel): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (a.grade ?? GRADE_SCALE_MAX + 1) - (b.grade ?? GRADE_SCALE_MAX + 1) ||
    a.studentName.localeCompare(b.studentName, "es")
  );
}

function toPlanilla(input: PlanillaInput): PlanillaModel {
  const total = Math.max(0, input.total);
  const graded = Math.min(total, Math.max(0, input.graded));
  const average = input.average ?? null;
  return {
    key: `${input.courseId}:${input.subjectId}`,
    group: input.courseName,
    subject: input.subjectName,
    students: input.students,
    evaluations: input.evaluations,
    graded,
    total,
    progressPct: total > 0 ? Math.round((graded / total) * 100) : 0,
    average,
    tone: average == null ? "empty" : average < PASSING_GRADE ? "low" : "ok",
    belowPassing: input.belowPassing?.length ?? 0,
  };
}

function byName(a: PlanillaModel, b: PlanillaModel): number {
  return a.group.localeCompare(b.group, "es", { numeric: true }) || a.subject.localeCompare(b.subject, "es");
}

/** Las planillas que requieren atención primero: promedio ascendente; sin notas al final. */
function byAttention(a: PlanillaModel, b: PlanillaModel): number {
  if (a.average != null && b.average != null && a.average !== b.average) return a.average - b.average;
  if ((a.average == null) !== (b.average == null)) return a.average == null ? 1 : -1;
  return byName(a, b);
}

export function buildAnalyticsLanding({
  planillas,
  attendanceAlerts: attendanceInputs,
  now = new Date(),
}: AnalyticsLandingInput): AnalyticsLandingModel {
  const academic = academicAlerts(planillas);
  const attendance = attendanceAlerts(attendanceInputs);
  const alerts = [...academic, ...attendance].sort(byUrgency);

  const graded = planillas.reduce((sum, p) => sum + Math.max(0, p.graded), 0);
  const total = planillas.reduce((sum, p) => sum + Math.max(0, p.total), 0);
  const withGrades = planillas.filter((p) => p.average != null && p.graded > 0);
  const weight = withGrades.reduce((sum, p) => sum + p.graded, 0);
  const models = planillas.map(toPlanilla);
  const average =
    weight > 0
      ? Math.round((withGrades.reduce((sum, p) => sum + (p.average as number) * p.graded, 0) / weight) * 10) / 10
      : null;

  return {
    academicYear: planillas[0]?.academicYear ?? String(now.getFullYear()),
    summary: {
      average,
      planillasWithGrades: withGrades.length,
      flaggedStudents: new Set(alerts.map((alert) => normalizeName(alert.studentName))).size,
      academic: academic.length,
      attendance: attendance.length,
      graded,
      total,
      progressPct: total > 0 ? Math.round((graded / total) * 100) : null,
    },
    alerts,
    planillas: models.filter((p) => p.evaluations > 0).sort(byAttention),
    unstarted: models.filter((p) => p.evaluations === 0).sort(byName),
  };
}

export function filterAlerts(alerts: AlertModel[], filter: AlertFilter): AlertModel[] {
  return filter === "all" ? alerts : alerts.filter((alert) => alert.kind === filter);
}

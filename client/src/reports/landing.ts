/**
 * Modelo de presentación de "Reportes y analítica": agrega las planillas reales
 * de Grade Center por curso y cruza el estado de los boletines del periodo.
 * Sin dependencias de React para poder probarse de forma aislada.
 */
import { formatGrade, PASSING_GRADE, plural, type PlanillaInput } from "@/analytics/landing";

/** Diferencia mínima entre cursos para considerarla una brecha y no ruido. */
export const READING_GAP_THRESHOLD = 0.1;

/** Estado de boletines de un curso tal como lo entrega `gradeCenter.reportCards`. */
export interface ReportCardInput {
  courseId: number;
  courseName: string;
  academicYearId: number;
  periodId: number;
  periodName: string;
  students: number;
  generated: number;
  lastGeneratedAt: Date | string | null;
}

export type CourseTone = "low" | "ok" | "empty";

export interface CourseModel {
  key: string;
  courseId: number;
  group: string;
  subjects: number;
  students: number;
  average: number | null;
  tone: CourseTone;
  /** Estudiantes únicos del curso con alguna definitiva parcial bajo la aprobatoria. */
  belowPassing: number;
  lowestSubject: { name: string; average: number } | null;
}

export type ReportCardStatus = "pending" | "partial" | "complete";

export interface ReportCardModel {
  key: string;
  courseId: number;
  academicYearId: number;
  periodId: number;
  group: string;
  period: string;
  students: number;
  generated: number;
  status: ReportCardStatus;
  /** "hoy", "hace 3 días", "12 oct." — `null` si nunca se generó. */
  lastGenerated: string | null;
}

export interface PeriodReading {
  kind: "gap" | "even" | "single" | "none";
  title: string;
  detail: string;
}

export interface ReportsSummary {
  /** Promedio ponderado por notas registradas en todas las planillas. */
  average: number | null;
  coursesWithGrades: number;
  /** Estudiantes únicos con alguna definitiva parcial bajo la aprobatoria. */
  belowPassing: number;
  reportCardsGenerated: number;
  reportCardsTotal: number;
}

export interface ReportsLandingModel {
  academicYear: string;
  period: string | null;
  summary: ReportsSummary;
  reading: PeriodReading;
  /** Cursos con notas, del promedio más bajo al más alto. */
  courses: CourseModel[];
  /** Cursos sin notas registradas: sin métricas que comparar, se listan aparte. */
  ungraded: CourseModel[];
  /** Cursos con estudiantes matriculados, los pendientes primero. */
  reportCards: ReportCardModel[];
  /** Grupos sin estudiantes matriculados: no hay boletines que generar. */
  withoutStudents: string[];
  canGenerate: boolean;
}

export interface ReportsLandingInput {
  planillas: PlanillaInput[];
  reportCards: ReportCardInput[];
  canGenerate: boolean;
  now?: Date;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Promedio ponderado por notas registradas; ignora planillas sin notas. */
function weightedAverage(planillas: PlanillaInput[]): { average: number | null; weight: number } {
  const withGrades = planillas.filter((p) => p.average != null && p.graded > 0);
  const weight = withGrades.reduce((sum, p) => sum + p.graded, 0);
  if (weight === 0) return { average: null, weight: 0 };
  return { average: round1(withGrades.reduce((sum, p) => sum + (p.average as number) * p.graded, 0) / weight), weight };
}

function uniqueBelowPassing(planillas: PlanillaInput[]): number {
  return new Set(planillas.flatMap((p) => (p.belowPassing ?? []).map((row) => row.studentId))).size;
}

function byGroupName(a: { group: string }, b: { group: string }): number {
  return a.group.localeCompare(b.group, "es", { numeric: true });
}

/** Menor promedio primero; cursos sin notas al final. */
function byAttention(a: CourseModel, b: CourseModel): number {
  if (a.average != null && b.average != null && a.average !== b.average) return a.average - b.average;
  if ((a.average == null) !== (b.average == null)) return a.average == null ? 1 : -1;
  return byGroupName(a, b);
}

function toCourses(planillas: PlanillaInput[]): Array<CourseModel & { weight: number }> {
  const byCourse = new Map<number, PlanillaInput[]>();
  for (const planilla of planillas) {
    const bucket = byCourse.get(planilla.courseId);
    if (bucket) bucket.push(planilla);
    else byCourse.set(planilla.courseId, [planilla]);
  }

  return Array.from(byCourse, ([courseId, items]) => {
    const { average, weight } = weightedAverage(items);
    const lowest = items
      .filter((p) => p.average != null && p.graded > 0)
      .sort((a, b) => (a.average as number) - (b.average as number))[0];
    return {
      key: String(courseId),
      courseId,
      group: items[0]!.courseName,
      subjects: items.length,
      students: Math.max(...items.map((p) => p.students)),
      average,
      tone: average == null ? "empty" : average < PASSING_GRADE ? "low" : "ok",
      belowPassing: uniqueBelowPassing(items),
      // Con una sola materia calificada la "más baja" no aporta nada nuevo
      lowestSubject:
        lowest && items.filter((p) => p.average != null && p.graded > 0).length > 1
          ? { name: lowest.subjectName, average: lowest.average as number }
          : null,
      weight,
    };
  });
}

/** Lectura calculada del periodo: compara el curso más bajo con el resto. */
function buildReading(courses: Array<CourseModel & { weight: number }>): PeriodReading {
  const graded = courses.filter((c) => c.average != null).sort(byAttention);
  if (graded.length === 0) {
    return {
      kind: "none",
      title: "Aún no hay notas para comparar",
      detail: "La lectura aparecerá cuando se registren notas en Grade Center.",
    };
  }

  const [lowest, ...rest] = graded as [CourseModel & { weight: number }, ...Array<CourseModel & { weight: number }>];
  const lowestAvg = lowest.average as number;
  if (rest.length === 0) {
    return {
      kind: "single",
      title: `${lowest.group} tiene un promedio de ${formatGrade(lowestAvg)}`,
      detail: "Con un solo curso calificado todavía no hay con qué comparar.",
    };
  }

  const restWeight = rest.reduce((sum, c) => sum + c.weight, 0);
  const restAvg = round1(rest.reduce((sum, c) => sum + (c.average as number) * c.weight, 0) / restWeight);
  const gap = round1(restAvg - lowestAvg);
  if (gap < READING_GAP_THRESHOLD) {
    const highest = graded[graded.length - 1]!.average as number;
    return {
      kind: "even",
      title: "El rendimiento es parejo entre cursos",
      detail:
        lowestAvg === highest
          ? `Todos los cursos promedian ${formatGrade(lowestAvg)}.`
          : `Los promedios van de ${formatGrade(lowestAvg)} a ${formatGrade(highest)}.`,
    };
  }

  const subject = lowest.lowestSubject
    ? ` La materia más baja es ${lowest.lowestSubject.name} (${formatGrade(lowest.lowestSubject.average)}).`
    : "";
  return {
    kind: "gap",
    title: `${lowest.group} está ${formatGrade(gap)} puntos por debajo del resto`,
    detail: `Promedia ${formatGrade(lowestAvg)} frente a ${formatGrade(restAvg)} de los demás cursos.${subject}`,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "hoy", "ayer", "hace 3 días" o la fecha corta para generaciones antiguas. */
export function formatGeneratedAt(value: Date | string, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function toReportCard(input: ReportCardInput, now: Date): ReportCardModel {
  const students = input.students;
  const generated = Math.min(students, Math.max(0, input.generated));
  return {
    key: `${input.courseId}:${input.periodId}`,
    courseId: input.courseId,
    academicYearId: input.academicYearId,
    periodId: input.periodId,
    group: input.courseName,
    period: input.periodName,
    students,
    generated,
    status: generated === 0 ? "pending" : generated < students ? "partial" : "complete",
    lastGenerated: input.lastGeneratedAt ? formatGeneratedAt(input.lastGeneratedAt, now) : null,
  };
}

const STATUS_RANK: Record<ReportCardStatus, number> = { pending: 0, partial: 1, complete: 2 };

export function buildReportsLanding({
  planillas,
  reportCards,
  canGenerate,
  now = new Date(),
}: ReportsLandingInput): ReportsLandingModel {
  const courses = toCourses(planillas);
  const models = courses.map(({ weight: _weight, ...course }) => course);
  const cards = reportCards
    .filter((input) => input.students > 0)
    .map((input) => toReportCard(input, now))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || byGroupName(a, b));

  return {
    academicYear: planillas[0]?.academicYear ?? String(now.getFullYear()),
    period: reportCards[0]?.periodName ?? null,
    summary: {
      average: weightedAverage(planillas).average,
      coursesWithGrades: courses.filter((c) => c.average != null).length,
      belowPassing: uniqueBelowPassing(planillas),
      reportCardsGenerated: cards.reduce((sum, c) => sum + c.generated, 0),
      reportCardsTotal: cards.reduce((sum, c) => sum + c.students, 0),
    },
    reading: buildReading(courses),
    courses: models.filter((c) => c.average != null).sort(byAttention),
    ungraded: models.filter((c) => c.average == null).sort(byGroupName),
    reportCards: cards,
    withoutStudents: reportCards
      .filter((input) => input.students <= 0)
      .map((input) => input.courseName)
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    canGenerate,
  };
}

export const REPORT_CARD_STATUS_LABEL: Record<ReportCardStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  complete: "Al día",
};

/** "28 de 30 estudiantes" */
export function reportCardProgress(card: Pick<ReportCardModel, "generated" | "students">): string {
  return `${card.generated} de ${plural(card.students, "estudiante", "estudiantes")}`;
}

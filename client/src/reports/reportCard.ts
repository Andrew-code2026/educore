/**
 * Modelo de presentación de los boletines de un curso: estado oficial frente a
 * vista preliminar, desempeño según la escala institucional y búsqueda por nombre.
 * Sin dependencias de React para poder probarse de forma aislada.
 */
import { formatGrade, plural } from "@/analytics/landing";
import { LEVELS, levelFromScore, needsAttention } from "@/gradecenter/domain/scale";
import type { LevelId } from "@/gradecenter/types";
import { formatGeneratedAt } from "./landing";

/** Boletines de un curso tal como los entrega `gradeCenter.courseReportCards`. */
export interface CourseReportCardsInput {
  course: { id: number; name: string; year: string; directorName: string | null };
  period: { id: number; name: string; closed: boolean };
  academicYearId: number;
  students: StudentReportCardInput[];
}

export interface StudentReportCardInput {
  studentId: number;
  name: string;
  subjects: Array<{ subjectId: number; subjectName: string; average: number | null; graded: number; evaluations: number }>;
  average: number | null;
  observations: Array<{ id: number; text: string; createdAt: Date | string }>;
  generatedAt: Date | string | null;
}

export type ReportCardState = "generated" | "preview";

export interface SubjectGradeModel {
  key: string;
  name: string;
  average: number | null;
  /** "4.2" o "—" sin notas. */
  grade: string;
  level: LevelId | null;
  levelLabel: string;
  needsAttention: boolean;
  /** "3 de 4 notas" o "Sin evaluaciones" */
  progress: string;
}

export interface StudentReportCardModel {
  key: string;
  studentId: number;
  name: string;
  average: number | null;
  grade: string;
  level: LevelId | null;
  levelLabel: string;
  state: ReportCardState;
  /** "Generado hoy", "Generado el 12 oct." o "Vista preliminar". */
  stateLabel: string;
  subjects: SubjectGradeModel[];
  /** Materias con desempeño bajo. */
  attention: number;
  observations: Array<{ key: string; text: string; date: string }>;
}

/** Datos de la institución para el encabezado del boletín. */
export interface ReportCardSchool {
  name: string;
  /** "Cali, Valle del Cauca, Colombia" */
  location: string | null;
  logoUrl: string | null;
  /** Color institucional en hex para el monograma cuando no hay escudo. */
  brandColor: string | null;
}

/** Campos de `schools` que usa el encabezado del boletín. */
export interface SchoolInput {
  name?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export interface CourseReportCardsModel {
  courseId: number;
  group: string;
  academicYear: string;
  directorName: string | null;
  period: string;
  periodClosed: boolean;
  /** Fecha de emisión: "24 de octubre de 2026". */
  issuedOn: string;
  students: StudentReportCardModel[];
  summary: { students: number; generated: number; average: number | null };
}

const NO_GRADE = "—";
const NO_LEVEL = "Sin evaluar";

const round1 = (value: number) => Math.round(value * 10) / 10;

function levelOf(average: number | null): Pick<SubjectGradeModel, "grade" | "level" | "levelLabel"> {
  const level = levelFromScore(average);
  return {
    grade: average != null ? formatGrade(average) : NO_GRADE,
    level,
    levelLabel: level ? LEVELS[level].short : NO_LEVEL,
  };
}

function generatedLabel(value: Date | string, now: Date): string {
  const when = formatGeneratedAt(value, now);
  return /^(hoy|ayer|hace)/.test(when) ? `Generado ${when}` : `Generado el ${when}`;
}

function toStudent(input: StudentReportCardInput, now: Date): StudentReportCardModel {
  const subjects = input.subjects.map(
    (subject): SubjectGradeModel => ({
      key: String(subject.subjectId),
      name: subject.subjectName,
      average: subject.average,
      ...levelOf(subject.average),
      needsAttention: needsAttention(subject.average),
      progress:
        subject.evaluations > 0 ? `${subject.graded} de ${plural(subject.evaluations, "nota", "notas")}` : "Sin evaluaciones",
    }),
  );
  return {
    key: String(input.studentId),
    studentId: input.studentId,
    name: input.name,
    average: input.average,
    ...levelOf(input.average),
    state: input.generatedAt ? "generated" : "preview",
    stateLabel: input.generatedAt ? generatedLabel(input.generatedAt, now) : "Vista preliminar",
    subjects,
    attention: subjects.filter((subject) => subject.needsAttention).length,
    observations: input.observations.map((observation) => ({
      key: String(observation.id),
      text: observation.text,
      date: new Date(observation.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "long" }),
    })),
  };
}

export function buildCourseReportCards(input: CourseReportCardsInput, now: Date = new Date()): CourseReportCardsModel {
  const students = input.students.map((student) => toStudent(student, now));
  const averages = students.map((student) => student.average).filter((value): value is number => value != null);
  return {
    courseId: input.course.id,
    group: input.course.name,
    academicYear: input.course.year,
    directorName: input.course.directorName,
    period: input.period.name,
    periodClosed: input.period.closed,
    issuedOn: now.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }),
    students,
    summary: {
      students: students.length,
      generated: students.filter((student) => student.state === "generated").length,
      average: averages.length ? round1(averages.reduce((sum, value) => sum + value, 0) / averages.length) : null,
    },
  };
}

/** Minúsculas y sin tildes: "Ángela" coincide con "angela". */
const stripDiacritics = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "");

function normalize(text: string): string {
  return stripDiacritics(text).toLowerCase().trim();
}

export function filterStudents(students: StudentReportCardModel[], query: string): StudentReportCardModel[] {
  const needle = normalize(query);
  if (!needle) return students;
  return students.filter((student) => normalize(student.name).includes(needle));
}

/**
 * Ubicación legible sin repetir datos. Si la ciudad ya trae su región
 * ("Bogotá, Colombia") se respeta tal cual; si no, se completa con
 * departamento y país.
 */
export function formatSchoolLocation({ city, department, country }: Pick<SchoolInput, "city" | "department" | "country">): string | null {
  const parts = city?.includes(",") ? [city] : [city, department, country];
  const seen = new Set<string>();
  const unique = parts
    .flatMap((part) => (part ?? "").split(","))
    .map((part) => part.trim())
    .filter((part) => {
      const key = normalize(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return unique.length ? unique.join(", ") : null;
}

export function buildReportCardSchool(input: SchoolInput | null | undefined): ReportCardSchool {
  const color = input?.primaryColor?.trim() ?? "";
  return {
    name: input?.name?.trim() || "EduCore",
    location: input ? formatSchoolLocation(input) : null,
    logoUrl: input?.logoUrl?.trim() || null,
    brandColor: HEX_COLOR.test(color) ? color : null,
  };
}

/**
 * Nombre de archivo del boletín sin tildes ni símbolos, para que el PDF guardado
 * desde el navegador se llame "Boletin-11-2-Carlos-Rojas-Periodo-2".
 */
export function reportCardFileName(
  course: Pick<CourseReportCardsModel, "group" | "period">,
  student: Pick<StudentReportCardModel, "name">,
): string {
  const slug = (text: string) =>
    stripDiacritics(text)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return ["Boletin", course.group, student.name, course.period].map(slug).filter(Boolean).join("-");
}

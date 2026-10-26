/**
 * Modelo de presentación del módulo PIAR: cursos del docente, estudiantes con
 * PIAR en cada curso y estado de sus tres anexos.
 * Sin dependencias de React para poder probarse de forma aislada.
 */
import { formatGeneratedAt } from "@/reports/landing";
import type { PiarProgress, PiarStatus } from "@shared/piar";

/** Curso tal como lo entrega `piar.courses`. */
export interface PiarCourseInput {
  courseId: number;
  courseName: string;
  grade: string;
  year: string;
  students: number;
  withPiar: number;
  finalized: number;
  averagePct: number | null;
  lastUpdatedAt: Date | string | null;
}

export interface PiarCourseModel {
  courseId: number;
  group: string;
  students: number;
  withPiar: number;
  finalized: number;
  /** PIAR abiertos que aún no se finalizan. */
  inProgress: number;
  averagePct: number | null;
  /** "hoy", "hace 3 días", "12 oct." — `null` sin PIAR. */
  lastUpdated: string | null;
}

export interface PiarLandingSummary {
  courses: number;
  withPiar: number;
  finalized: number;
  averagePct: number | null;
}

export interface PiarLandingModel {
  /** Cursos con PIAR primero; luego el resto por nombre. */
  courses: PiarCourseModel[];
  summary: PiarLandingSummary;
}

export function buildPiarLanding(input: PiarCourseInput[], now: Date = new Date()): PiarLandingModel {
  const courses = input
    .map((course): PiarCourseModel => ({
      courseId: course.courseId,
      group: course.courseName,
      students: course.students,
      withPiar: course.withPiar,
      finalized: course.finalized,
      inProgress: Math.max(0, course.withPiar - course.finalized),
      averagePct: course.averagePct,
      lastUpdated: course.lastUpdatedAt ? formatGeneratedAt(course.lastUpdatedAt, now) : null,
    }))
    .sort((a, b) => Number(b.withPiar > 0) - Number(a.withPiar > 0) || a.group.localeCompare(b.group, "es", { numeric: true }));

  const withPiar = courses.reduce((sum, course) => sum + course.withPiar, 0);
  // Promedio ponderado por estudiante, no por curso
  const weighted = courses.reduce((sum, course) => sum + (course.averagePct ?? 0) * course.withPiar, 0);
  return {
    courses,
    summary: {
      courses: courses.length,
      withPiar,
      finalized: courses.reduce((sum, course) => sum + course.finalized, 0),
      averagePct: withPiar ? Math.round(weighted / withPiar) : null,
    },
  };
}

/** PIAR resumido tal como lo entrega `piar.course`. */
export interface PiarRecordInput {
  id: number;
  studentId: number;
  status: PiarStatus;
  progress: PiarProgress;
  updatedAt: Date | string;
  updatedByName: string | null;
}

export interface PiarStudentInput {
  studentId: number;
  name: string;
  code: string | null;
}

export type PiarRowState = "finalized" | "complete" | "progress" | "new";

export const PIAR_STATE_LABEL: Record<PiarRowState, string> = {
  finalized: "Finalizado",
  complete: "Listo para finalizar",
  progress: "En diligenciamiento",
  new: "Sin iniciar",
};

export interface PiarStudentRowModel {
  recordId: number;
  studentId: number;
  name: string;
  code: string | null;
  state: PiarRowState;
  pct: number;
  /** Avance de cada anexo (0–100), en orden. */
  annexes: number[];
  updated: string;
  updatedBy: string | null;
}

export interface PiarCourseDetailModel {
  rows: PiarStudentRowModel[];
  /** Matriculados sin PIAR, para abrir uno nuevo. */
  candidates: PiarStudentInput[];
}

export function piarRowState(status: PiarStatus, progress: Pick<PiarProgress, "done" | "total">): PiarRowState {
  if (status === "FINALIZED") return "finalized";
  if (progress.total > 0 && progress.done >= progress.total) return "complete";
  return progress.done > 0 ? "progress" : "new";
}

export function buildPiarCourseDetail(
  input: { students: PiarStudentInput[]; records: PiarRecordInput[] },
  now: Date = new Date(),
): PiarCourseDetailModel {
  const recordByStudent = new Map(input.records.map(record => [record.studentId, record]));
  const rows: PiarStudentRowModel[] = [];
  const candidates: PiarStudentInput[] = [];
  for (const student of input.students) {
    const record = recordByStudent.get(student.studentId);
    if (!record) {
      candidates.push(student);
      continue;
    }
    rows.push({
      recordId: record.id,
      studentId: student.studentId,
      name: student.name,
      code: student.code,
      state: piarRowState(record.status, record.progress),
      pct: record.progress.pct,
      annexes: record.progress.annexes.map(annex => annex.pct),
      updated: formatGeneratedAt(record.updatedAt, now),
      updatedBy: record.updatedByName,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { rows, candidates };
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por nombre o código, sin tildes ni mayúsculas. */
export function filterByName<T extends { name: string; code?: string | null }>(items: T[], query: string): T[] {
  const needle = normalize(query);
  if (!needle) return items;
  return items.filter(item => normalize(item.name).includes(needle) || normalize(item.code ?? "").includes(needle));
}

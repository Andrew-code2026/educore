import { and, eq, inArray } from "drizzle-orm";
import { academicYears, courses, schoolMemberships, students, teacherProfiles, teachers, users } from "../drizzle/schema";
import {
  type AcademicActor,
  createGuardianRelationship,
  createSchoolUser,
  enrollAndSyncStudent,
  getDb,
  writeIdentityAudit,
} from "./db";

/**
 * Carga masiva de usuarios para Rectoría / Coordinación.
 *
 * - `dryRun` valida todo contra la base sin escribir: alimenta la vista previa.
 * - Cada fila es independiente: un error no aborta el lote, se reporta por fila.
 * - Los estudiantes con curso quedan matriculados en el año activo y visibles en
 *   asistencia y Grade Center; los acudientes quedan vinculados a su estudiante.
 */

export const IMPORT_KINDS = ["STUDENT", "TEACHER", "GUARDIAN"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export const IMPORT_MAX_ROWS = 500;
export const IMPORT_RELATIONSHIPS = ["PARENT", "LEGAL_GUARDIAN", "OTHER"] as const;
export type ImportRelationship = (typeof IMPORT_RELATIONSHIPS)[number];

export interface ImportRowInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentId?: string;
  course?: string;
  specialty?: string;
  studentEmail?: string;
  relationship?: ImportRelationship;
}

export type ImportRowStatus = "ready" | "created" | "exists" | "error";

export interface ImportRowResult {
  index: number;
  name: string;
  email: string;
  status: ImportRowStatus;
  message?: string;
  courseName?: string;
  userId?: number;
}

export interface ImportResult {
  kind: ImportKind;
  dryRun: boolean;
  summary: { total: number; ready: number; created: number; exists: number; errors: number };
  rows: ImportRowResult[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "11 - 1", "11-1 " y "11–1" son el mismo grupo. */
export const normalizeCourseKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const clean = (value: string | undefined) => (value ?? "").trim();

export async function importSchoolUsers(
  actor: AcademicActor,
  input: { kind: ImportKind; dryRun: boolean; rows: ImportRowInput[] },
): Promise<ImportResult> {
  const db = await getDb();
  if (!db) throw new Error("No hay conexión con la base de datos para importar usuarios.");

  const rows = input.rows.map(row => ({
    ...row,
    firstName: clean(row.firstName),
    lastName: clean(row.lastName),
    email: clean(row.email).toLowerCase(),
    phone: clean(row.phone) || undefined,
    documentId: clean(row.documentId) || undefined,
    course: clean(row.course) || undefined,
    specialty: clean(row.specialty) || undefined,
    studentEmail: clean(row.studentEmail).toLowerCase() || undefined,
  }));

  // Contexto que se consulta una sola vez para todo el lote
  const emails = Array.from(new Set(rows.map(row => row.email).filter(email => EMAIL_PATTERN.test(email))));
  const existingEmails = new Set(
    (emails.length ? await db.select({ email: users.email }).from(users).where(inArray(users.email, emails)) : [])
      .map(row => (row.email ?? "").toLowerCase()),
  );

  const activeYear = (
    await db
      .select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, actor.schoolId), eq(academicYears.status, "ACTIVE")))
      .limit(1)
  )[0];
  const yearCourses = activeYear
    ? await db
        .select({ id: courses.id, name: courses.name, code: courses.code, grade: courses.grade })
        .from(courses)
        .where(and(eq(courses.schoolId, actor.schoolId), eq(courses.academicYearId, activeYear.id)))
    : [];
  const courseByKey = new Map<string, (typeof yearCourses)[number]>();
  for (const course of yearCourses) {
    courseByKey.set(normalizeCourseKey(course.name), course);
    if (course.code) courseByKey.set(normalizeCourseKey(course.code), course);
  }

  const studentEmails = Array.from(new Set(rows.map(row => row.studentEmail).filter((email): email is string => Boolean(email))));
  const studentByEmail = new Map<string, { id: number; name: string | null }>();
  if (input.kind === "GUARDIAN" && studentEmails.length) {
    const candidates = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.email, studentEmails));
    const memberships = candidates.length
      ? await db
          .select({ userId: schoolMemberships.userId, roleKey: schoolMemberships.roleKey })
          .from(schoolMemberships)
          .where(and(eq(schoolMemberships.schoolId, actor.schoolId), inArray(schoolMemberships.userId, candidates.map(item => item.id))))
      : [];
    for (const candidate of candidates) {
      if (memberships.some(item => item.userId === candidate.id && item.roleKey === "STUDENT")) {
        studentByEmail.set((candidate.email ?? "").toLowerCase(), { id: candidate.id, name: candidate.name });
      }
    }
  }

  const seen = new Map<string, number>();
  const results: ImportRowResult[] = [];

  for (const [index, row] of rows.entries()) {
    const name = `${row.firstName} ${row.lastName}`.trim();
    const base = { index, name, email: row.email };
    const fail = (message: string): ImportRowResult => ({ ...base, status: "error", message });

    if (row.firstName.length < 2) { results.push(fail("Falta el nombre.")); continue; }
    if (row.lastName.length < 2) { results.push(fail("Falta el apellido.")); continue; }
    if (!EMAIL_PATTERN.test(row.email)) { results.push(fail("El correo no es válido.")); continue; }
    const firstSeen = seen.get(row.email);
    if (firstSeen !== undefined) { results.push(fail(`Correo repetido en el archivo (fila ${firstSeen + 1}).`)); continue; }
    seen.set(row.email, index);
    if (existingEmails.has(row.email)) {
      results.push({ ...base, status: "exists", message: "Ya existe un usuario con este correo; no se modifica." });
      continue;
    }

    const course = input.kind === "STUDENT" && row.course ? courseByKey.get(normalizeCourseKey(row.course)) : undefined;
    if (input.kind === "STUDENT" && row.course && !course) {
      results.push(fail(activeYear ? `El curso "${row.course}" no existe en ${activeYear.name}.` : "No hay un año académico activo para matricular."));
      continue;
    }
    const linkedStudent = input.kind === "GUARDIAN" && row.studentEmail ? studentByEmail.get(row.studentEmail) : undefined;
    if (input.kind === "GUARDIAN" && row.studentEmail && !linkedStudent) {
      results.push(fail(`No encontramos un estudiante con el correo ${row.studentEmail}.`));
      continue;
    }

    if (input.dryRun) {
      results.push({ ...base, status: "ready", courseName: course?.name });
      continue;
    }

    let userId: number | undefined;
    try {
      const profile = await createSchoolUser({
        schoolId: actor.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        roleKey: input.kind,
        status: "ACTIVE",
        phone: row.phone,
        studentCode: row.documentId,
        gradeLevel: course?.grade ?? undefined,
        course: course?.name,
        actorUserId: actor.userId || undefined,
      });
      userId = profile?.id;
      if (!userId) throw new Error("No se pudo crear el usuario.");
    } catch (error) {
      results.push(fail(error instanceof Error ? error.message : "No se pudo crear el usuario."));
      continue;
    }

    // El usuario ya existe: lo que falle después se informa sin perder la fila
    try {
      if (input.kind === "STUDENT" && course && activeYear) {
        await enrollAndSyncStudent(actor, { studentUserId: userId, academicYearId: activeYear.id, courseId: course.id });
      }
      if (input.kind === "TEACHER") {
        await db.insert(teachers).values({ schoolId: actor.schoolId, name, email: row.email, subjectFocus: row.specialty ?? "Por asignar" });
        if (row.specialty || row.documentId) {
          await db
            .update(teacherProfiles)
            .set({ specialties: row.specialty ?? null, employeeCode: row.documentId ?? null })
            .where(and(eq(teacherProfiles.schoolId, actor.schoolId), eq(teacherProfiles.userId, userId)));
        }
      }
      if (input.kind === "GUARDIAN" && linkedStudent && row.studentEmail) {
        await createGuardianRelationship({
          schoolId: actor.schoolId,
          guardianUserId: userId,
          studentUserId: linkedStudent.id,
          relationshipType: row.relationship ?? "PARENT",
          isPrimary: true,
          actorUserId: actor.userId || undefined,
        });
        await db.update(students).set({ guardianName: name }).where(and(eq(students.schoolId, actor.schoolId), eq(students.email, row.studentEmail)));
      }
      results.push({ ...base, status: "created", userId, courseName: course?.name });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "error desconocido";
      results.push({ ...base, status: "created", userId, message: `Usuario creado, pero quedó pendiente: ${reason}` });
    }
  }

  const summary = {
    total: results.length,
    ready: results.filter(row => row.status === "ready").length,
    created: results.filter(row => row.status === "created").length,
    exists: results.filter(row => row.status === "exists").length,
    errors: results.filter(row => row.status === "error").length,
  };

  if (!input.dryRun && summary.created > 0) {
    await writeIdentityAudit({
      schoolId: actor.schoolId,
      actorUserId: actor.userId || undefined,
      action: "users.imported",
      detail: `${input.kind}: ${summary.created} creados, ${summary.exists} existentes, ${summary.errors} con error`,
    });
  }

  return { kind: input.kind, dryRun: input.dryRun, summary, rows: results };
}

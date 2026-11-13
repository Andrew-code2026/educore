/**
 * Lecturas y escrituras de los portales estudiante y acudiente. Todo se resuelve a partir del actor
 * autenticado: el estudiante solo se ve a sí mismo; el acudiente puede indicar cuál de sus hijos
 * vinculados consulta, y el servidor lo verifica. El curso nunca lo indica el cliente.
 */
import path from "node:path";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  academicObservations,
  academicPeriods,
  assessmentGrades,
  assessments,
  assignments,
  courseSubjects,
  courses,
  reportCardRuns,
  studentEnrollments,
  studentProfiles,
  subjects,
  submissions,
  teacherAssignments,
  users,
} from "../drizzle/schema";
import { checkResourceFile } from "@shared/courseResources";
import { getDb, listGuardianStudents } from "./db";
import { computeCourseReportCards, type CourseReportCards } from "./gradeCenterDb";
import type { IdentityRole } from "./identityModel";
import { storagePut } from "./storage";

export type StudentActor = { schoolId: number; userId: number; roleKey: IdentityRole };

/** Error de dominio con un mensaje apto para mostrar al estudiante. */
export class StudentPortalError extends Error {}

const round1 = (value: number) => Math.round(value * 10) / 10;
const isClosedStatus = (status: string) => status === "Cerrado" || status === "CLOSED";
const isActiveStatus = (status: string) => status === "Activo" || status === "ACTIVE";

export type GuardianChild = {
  id: number;
  name: string;
  courseName: string | null;
  /** PARENT, LEGAL_GUARDIAN u OTHER; `null` si el vínculo viene solo del nombre del acudiente. */
  relationshipType: string | null;
  isPrimary: boolean;
};

/** Hijos vinculados al acudiente, con su curso actual; el vínculo primario va primero (orden de `listGuardianStudents`). */
export async function listGuardianChildren(actor: StudentActor): Promise<GuardianChild[]> {
  if (actor.roleKey !== "GUARDIAN") throw new StudentPortalError("Esta sección es solo para acudientes.");
  const db = await getDb();
  if (!db) return [];
  const linked = await listGuardianStudents(actor.schoolId, actor.userId);
  if (!linked.length) return [];
  const enrollmentRows = await db
    .select({ studentUserId: studentEnrollments.studentUserId, academicYearId: studentEnrollments.academicYearId, courseName: courses.name })
    .from(studentEnrollments)
    .innerJoin(courses, eq(courses.id, studentEnrollments.courseId))
    .where(and(eq(studentEnrollments.schoolId, actor.schoolId), inArray(studentEnrollments.studentUserId, linked.map(child => child.id)), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  // Matrícula del año más reciente por estudiante
  const courseByStudent = new Map<number, { year: number; name: string }>();
  for (const row of enrollmentRows) {
    const current = courseByStudent.get(row.studentUserId);
    if (!current || row.academicYearId > current.year) courseByStudent.set(row.studentUserId, { year: row.academicYearId, name: row.courseName });
  }
  return linked
    .filter(child => Boolean(child.name))
    .map(
      (child): GuardianChild => ({
        id: child.id,
        name: child.name!,
        courseName: courseByStudent.get(child.id)?.name ?? null,
        relationshipType: child.relationship?.relationshipType ?? null,
        isPrimary: Boolean(child.relationship?.isPrimary),
      }),
    );
}

/**
 * Estudiante que se consulta: el propio estudiante, o el hijo que pide el acudiente
 * (debe estar vinculado; sin indicarlo, el vínculo primario).
 */
async function resolveStudentUserId(actor: StudentActor, studentUserId?: number): Promise<number> {
  if (actor.roleKey === "STUDENT") return actor.userId;
  if (actor.roleKey !== "GUARDIAN") throw new StudentPortalError("Esta sección es solo para estudiantes y acudientes.");
  // Solo los vínculos: el curso de cada hijo no hace falta para autorizar
  const children = await listGuardianStudents(actor.schoolId, actor.userId);
  if (studentUserId === undefined) {
    if (!children.length) throw new StudentPortalError("Aún no tienes estudiantes vinculados a tu cuenta.");
    return children[0].id;
  }
  if (!children.some(child => child.id === studentUserId)) throw new StudentPortalError("Ese estudiante no está vinculado a tu cuenta.");
  return studentUserId;
}

/** Matrícula activa del estudiante consultado: usuario, curso y año académico. */
async function studentContext(actor: StudentActor, requestedStudentId?: number) {
  const db = await getDb();
  if (!db) return null;
  const studentUserId = await resolveStudentUserId(actor, requestedStudentId);
  const [user, profile, enrollment] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, studentUserId), eq(users.schoolId, actor.schoolId))).limit(1).then(rows => rows[0]),
    db.select({ studentCode: studentProfiles.studentCode }).from(studentProfiles).where(and(eq(studentProfiles.schoolId, actor.schoolId), eq(studentProfiles.userId, studentUserId))).limit(1).then(rows => rows[0]),
    db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, studentUserId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).orderBy(desc(studentEnrollments.academicYearId)).limit(1).then(rows => rows[0]),
  ]);
  if (!user?.name) throw new StudentPortalError("No pudimos identificar al estudiante.");
  if (!enrollment) return { db, user: { id: user.id, name: user.name, code: profile?.studentCode ?? null }, course: null, academicYearId: null };
  const course = (await db.select().from(courses).where(and(eq(courses.id, enrollment.courseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0] ?? null;
  return { db, user: { id: user.id, name: user.name, code: profile?.studentCode ?? null }, course, academicYearId: enrollment.academicYearId };
}

/** Nombre del curso del estudiante ("11-2"), o `null` si no tiene matrícula activa. */
export async function getStudentCourseName(actor: StudentActor): Promise<string | null> {
  const context = await studentContext(actor);
  return context?.course?.name ?? null;
}

export type StudentEvaluation = {
  id: number;
  title: string;
  type: string;
  weight: number;
  date: Date;
  /** Nota en escala 0–5; `null` = aún sin nota. */
  value: number | null;
  /** Retroalimentación del docente en esta evaluación. */
  comment: string | null;
};

export type StudentSubjectGrades = {
  subjectId: number;
  name: string;
  teacherName: string | null;
  /** Definitiva parcial ponderada (1 decimal) con las notas registradas; `null` sin notas. */
  average: number | null;
  gradedWeight: number;
  totalWeight: number;
  evaluations: StudentEvaluation[];
};

export type StudentPeriod = { id: number; name: string; orderIndex: number; startDate: Date; endDate: Date; state: "closed" | "active" | "scheduled" };

export type StudentGrades = {
  student: { id: number; name: string; code: string | null };
  course: { id: number; name: string; directorName: string | null } | null;
  periods: StudentPeriod[];
  period: StudentPeriod | null;
  subjects: StudentSubjectGrades[];
  /** Promedio de las materias con definitiva (misma regla del boletín). */
  average: number | null;
  previous: { periodName: string; average: number | null } | null;
  observations: Array<{ id: number; text: string; createdAt: Date }>;
  /** Fecha del boletín oficial del periodo; `null` = solo vista preliminar. */
  reportCardGeneratedAt: Date | null;
};

const periodState = (status: string): StudentPeriod["state"] => (isClosedStatus(status) ? "closed" : isActiveStatus(status) ? "active" : "scheduled");

/** Definitivas por materia del estudiante en un periodo. */
async function subjectGrades(actor: StudentActor, studentUserId: number, courseId: number, periodId: number): Promise<StudentSubjectGrades[]> {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select({ subjectId: courseSubjects.subjectId }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, courseId), eq(courseSubjects.status, "ACTIVE")));
  const subjectIds = Array.from(new Set(links.map(link => link.subjectId)));
  if (!subjectIds.length) return [];
  const [subjectRows, teacherRows, evaluationRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), inArray(subjects.id, subjectIds))),
    db.select({ subjectId: teacherAssignments.subjectId, name: users.name, isPrimary: teacherAssignments.isPrimary }).from(teacherAssignments).innerJoin(users, eq(users.id, teacherAssignments.teacherUserId)).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.courseId, courseId), eq(teacherAssignments.status, "ACTIVE"))),
    // Evaluaciones visibles: ni borradores ni eliminadas
    db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.courseId, courseId), eq(assessments.academicPeriodId, periodId), ne(assessments.status, "DELETED"), ne(assessments.status, "DRAFT"))).orderBy(assessments.date),
  ]);
  const gradeRows = evaluationRows.length
    ? await db.select({ assessmentId: assessmentGrades.assessmentId, value: assessmentGrades.value, comment: assessmentGrades.comment }).from(assessmentGrades).where(and(eq(assessmentGrades.schoolId, actor.schoolId), eq(assessmentGrades.studentId, studentUserId), inArray(assessmentGrades.assessmentId, evaluationRows.map(row => row.id))))
    : [];
  const gradeByAssessment = new Map(gradeRows.map(row => [row.assessmentId, row]));
  const teacherBySubject = new Map<number, string>();
  for (const row of [...teacherRows].sort((a, b) => b.isPrimary - a.isPrimary)) {
    if (row.name && !teacherBySubject.has(row.subjectId)) teacherBySubject.set(row.subjectId, row.name);
  }

  return subjectRows
    .map((subject): StudentSubjectGrades => {
      const evaluations = evaluationRows
        .filter(row => row.subjectId === subject.id)
        .map((row): StudentEvaluation => {
          const grade = gradeByAssessment.get(row.id);
          const value = grade?.value ?? null;
          return {
            id: row.id,
            title: row.title,
            type: row.assessmentType,
            weight: row.weight,
            date: row.date,
            value: value === null ? null : round1((value / (row.maxValue || 5)) * 5),
            comment: grade?.comment?.trim() || null,
          };
        });
      // Regla del Grade Center: solo cuentan evaluaciones con peso
      const counted = evaluations.filter(evaluation => evaluation.weight > 0);
      const graded = counted.filter((evaluation): evaluation is StudentEvaluation & { value: number } => evaluation.value !== null);
      const gradedWeight = graded.reduce((sum, evaluation) => sum + evaluation.weight, 0);
      return {
        subjectId: subject.id,
        name: subject.name,
        teacherName: teacherBySubject.get(subject.id) ?? null,
        average: gradedWeight ? round1(graded.reduce((sum, evaluation) => sum + evaluation.value * evaluation.weight, 0) / gradedWeight) : null,
        gradedWeight,
        totalWeight: counted.reduce((sum, evaluation) => sum + evaluation.weight, 0),
        evaluations,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const averageOf = (rows: StudentSubjectGrades[]) => {
  const values = rows.map(row => row.average).filter((value): value is number => value !== null);
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
};

export async function getStudentGrades(actor: StudentActor, input: { academicPeriodId?: number; studentUserId?: number }): Promise<StudentGrades | null> {
  const context = await studentContext(actor, input.studentUserId);
  if (!context) return null;
  const { db, user, course, academicYearId } = context;
  const empty: StudentGrades = { student: user, course: null, periods: [], period: null, subjects: [], average: null, previous: null, observations: [], reportCardGeneratedAt: null };
  if (!course || !academicYearId) return empty;

  const periodRows = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, actor.schoolId), eq(academicPeriods.academicYearId, academicYearId))).orderBy(academicPeriods.orderIndex);
  const periods = periodRows.map((row): StudentPeriod => ({ id: row.id, name: row.name, orderIndex: row.orderIndex, startDate: row.startDate, endDate: row.endDate, state: periodState(row.status) }));
  if (input.academicPeriodId !== undefined && !periods.some(period => period.id === input.academicPeriodId)) {
    throw new StudentPortalError("Ese periodo no pertenece al año académico del estudiante.");
  }
  const period = periods.find(row => row.id === input.academicPeriodId) ?? periods.find(row => row.state === "active") ?? periods[periods.length - 1] ?? null;
  const base = { ...empty, course: { id: course.id, name: course.name, directorName: course.teacherName?.trim() || null }, periods, period };
  if (!period) return base;

  const previousPeriod = [...periods].reverse().find(row => row.orderIndex < period.orderIndex && row.state !== "scheduled");
  const [rows, previousRows, observationRows, runRows] = await Promise.all([
    subjectGrades(actor, user.id, course.id, period.id),
    previousPeriod ? subjectGrades(actor, user.id, course.id, previousPeriod.id) : Promise.resolve([]),
    db.select({ id: academicObservations.id, text: academicObservations.text, createdAt: academicObservations.createdAt }).from(academicObservations).where(and(eq(academicObservations.schoolId, actor.schoolId), eq(academicObservations.studentId, user.id), eq(academicObservations.academicPeriodId, period.id), eq(academicObservations.status, "PUBLISHED"))).orderBy(academicObservations.createdAt),
    db.select({ generatedAt: reportCardRuns.generatedAt }).from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, actor.schoolId), eq(reportCardRuns.studentId, user.id), eq(reportCardRuns.courseId, course.id), eq(reportCardRuns.academicPeriodId, period.id))).orderBy(desc(reportCardRuns.generatedAt)).limit(1),
  ]);

  return {
    ...base,
    subjects: rows,
    average: averageOf(rows),
    previous: previousPeriod ? { periodName: previousPeriod.name, average: averageOf(previousRows) } : null,
    observations: observationRows,
    reportCardGeneratedAt: runRows[0]?.generatedAt ?? null,
  };
}

/** Boletín del estudiante en un periodo (en vivo, con la misma regla que el boletín oficial). */
export async function getStudentReportCard(actor: StudentActor, input: { academicPeriodId?: number; studentUserId?: number }): Promise<CourseReportCards | null> {
  const context = await studentContext(actor, input.studentUserId);
  if (!context?.course || !context.academicYearId) return null;
  const { db, user, course, academicYearId } = context;
  const periodRows = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, actor.schoolId), eq(academicPeriods.academicYearId, academicYearId))).orderBy(academicPeriods.orderIndex);
  if (input.academicPeriodId !== undefined && !periodRows.some(row => row.id === input.academicPeriodId)) {
    throw new StudentPortalError("Ese periodo no pertenece al año académico del estudiante.");
  }
  const period = periodRows.find(row => row.id === input.academicPeriodId) ?? periodRows.find(row => isActiveStatus(row.status)) ?? periodRows[0];
  if (!period) return null;
  const cards = await computeCourseReportCards(actor.schoolId, { courseId: course.id, academicYearId, academicPeriodId: period.id });
  return {
    course: { id: course.id, name: course.name, year: course.year, directorName: course.teacherName?.trim() || null },
    period: { id: period.id, name: period.name, closed: isClosedStatus(period.status) },
    academicYearId,
    students: cards.filter(card => card.studentId === user.id),
  };
}

export type SubmitTaskInput = {
  assignmentId: number;
  comment: string;
  /** Archivo en base64 (con o sin prefijo data:). */
  file: { name: string; dataBase64: string } | null;
  /** Solo para el flujo heredado que registraba el nombre del archivo sin subirlo. */
  fileName?: string;
};

/**
 * Entrega (o reemplaza) la actividad del estudiante autenticado. Valida curso, estado y que aún
 * no esté calificada; el archivo se guarda con las mismas reglas de formato que los recursos del curso.
 */
export async function submitStudentTask(actor: StudentActor, input: SubmitTaskInput) {
  // Solo el propio estudiante entrega; el acudiente consulta pero no entrega por él
  if (actor.roleKey !== "STUDENT") throw new StudentPortalError("Solo el estudiante puede entregar sus actividades.");
  const context = await studentContext(actor);
  if (!context) throw new StudentPortalError("Base de datos no disponible.");
  const { db, user, course } = context;
  if (!course) throw new StudentPortalError("No tienes una matrícula activa.");
  const task = (await db.select().from(assignments).where(and(eq(assignments.id, input.assignmentId), eq(assignments.schoolId, actor.schoolId))).limit(1))[0];
  if (!task || task.course !== course.name || task.status === "Borrador") throw new StudentPortalError("Esta actividad no está disponible para tu curso.");
  if (task.status === "Cerrada") throw new StudentPortalError("La actividad ya cerró y no recibe entregas.");

  const existing = (await db.select().from(submissions).where(and(eq(submissions.schoolId, actor.schoolId), eq(submissions.assignmentId, task.id), eq(submissions.studentName, user.name))).orderBy(desc(submissions.id)).limit(1))[0];
  if (existing && existing.grade !== null) throw new StudentPortalError("Tu entrega ya fue calificada; no se puede reemplazar.");

  let fileName = existing?.fileName ?? null;
  let fileUrl = existing?.fileUrl ?? null;
  if (input.file) {
    const buffer = Buffer.from(input.file.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
    const check = checkResourceFile(input.file.name, buffer.length);
    if (!check.ok) throw new StudentPortalError(check.message);
    const safeCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const stored = await storagePut(`schools/${actor.schoolId}/courses/${safeCourse}/submissions/${task.id}/${actor.userId}-${check.storageName}`, buffer, check.contentType);
    fileName = path.basename(input.file.name).slice(0, 180);
    fileUrl = stored.url;
  } else if (input.fileName) {
    fileName = path.basename(input.fileName).slice(0, 180);
  }
  if (!fileName) throw new StudentPortalError("Adjunta el archivo de tu entrega.");

  const values = { fileName, fileUrl, comment: input.comment.trim() || null, submittedAt: new Date(), status: "Entregada" };
  if (existing) {
    await db.update(submissions).set(values).where(eq(submissions.id, existing.id));
    return (await db.select().from(submissions).where(eq(submissions.id, existing.id)).limit(1))[0];
  }
  await db.insert(submissions).values({ schoolId: actor.schoolId, assignmentId: task.id, studentName: user.name, grade: null, ...values });
  return (await db.select().from(submissions).where(and(eq(submissions.schoolId, actor.schoolId), eq(submissions.assignmentId, task.id), eq(submissions.studentName, user.name))).orderBy(desc(submissions.id)).limit(1))[0];
}

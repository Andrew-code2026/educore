import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import {
  academicPeriods,
  academicYears,
  academicObservations,
  assessmentGrades,
  assessments,
  courseSubjects,
  courses,
  gradingScales,
  guardianStudentRelationships,
  studentEnrollments,
  subjects,
  reportCardRuns,
  teacherAssignments,
  users,
} from "../drizzle/schema";
import { getDb, type AcademicActor, writeAcademicAudit } from "./db";
import { DEMO_ACTIVITIES, DEMO_STUDENTS, DEMO_SUBJECT } from "./demoSeed";

export type GradeCenterActor = AcademicActor;

type GradeCenterInput = { courseId?: number; subjectId?: number; academicPeriodId?: number };

const MANAGEMENT_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR"];
const WRITE_ROLES = [...MANAGEMENT_ROLES, "TEACHER"];

export async function visibleCourseIds(actor: GradeCenterActor) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({ id: courses.id }).from(courses).where(eq(courses.schoolId, actor.schoolId));
  if (MANAGEMENT_ROLES.includes(actor.roleKey)) return all.map(row => row.id);
  if (actor.roleKey === "TEACHER") {
    const rows = await db.select({ id: teacherAssignments.courseId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.status, "ACTIVE")));
    return rows.map(row => row.id);
  }
  const enrollments = await db.select({ courseId: studentEnrollments.courseId, studentUserId: studentEnrollments.studentUserId }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  if (actor.roleKey === "STUDENT") return enrollments.filter(row => row.studentUserId === actor.userId).map(row => row.courseId);
  const linked = await db.select({ studentUserId: guardianStudentRelationships.studentUserId }).from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, actor.schoolId), eq(guardianStudentRelationships.guardianUserId, actor.userId)));
  const linkedIds = new Set(linked.map(row => row.studentUserId));
  return enrollments.filter(row => linkedIds.has(row.studentUserId)).map(row => row.courseId);
}

async function assertContext(actor: GradeCenterActor, input: { courseId: number; subjectId: number; academicPeriodId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  const [course, subject, period, link] = await Promise.all([
    db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.schoolId, actor.schoolId))).limit(1),
    db.select().from(subjects).where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, actor.schoolId))).limit(1),
    db.select().from(academicPeriods).where(and(eq(academicPeriods.id, input.academicPeriodId), eq(academicPeriods.schoolId, actor.schoolId))).limit(1),
    db.select().from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, input.courseId), eq(courseSubjects.subjectId, input.subjectId), eq(courseSubjects.status, "ACTIVE"))).limit(1),
  ]);
  if (!course[0] || !subject[0] || !period[0] || !link[0] || course[0].academicYearId !== period[0].academicYearId) throw new Error("La combinación de curso, materia, año y periodo no es válida.");
  if (actor.roleKey === "TEACHER") {
    const assignment = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.courseId, input.courseId), eq(teacherAssignments.subjectId, input.subjectId), eq(teacherAssignments.academicYearId, course[0].academicYearId ?? 0), eq(teacherAssignments.status, "ACTIVE"))).limit(1);
    if (!assignment[0]) throw new Error("No tienes una asignación docente válida para este curso y materia.");
  }
  return { course: course[0], subject: subject[0], period: period[0], academicYearId: course[0].academicYearId ?? period[0].academicYearId ?? 0 };
}

function weightedAverage(values: Array<{ value: number | null; maxValue: number; weight: number }>) {
  const recorded = values.filter(item => item.value !== null);
  if (!recorded.length) return null;
  const weightTotal = recorded.reduce((sum, item) => sum + item.weight, 0);
  if (weightTotal > 0) return Number((recorded.reduce((sum, item) => sum + ((item.value! / item.maxValue) * 5 * item.weight), 0) / weightTotal).toFixed(2));
  return Number((recorded.reduce((sum, item) => sum + ((item.value! / item.maxValue) * 5), 0) / recorded.length).toFixed(2));
}

/** Las evaluaciones de cada curso demo (las mismas actividades del aula) con las notas del dataset del MVP. */
export async function ensureGradeCenterSeeded(schoolId: number) {
  const db = await getDb();
  if (!db) return;
  const subject = (await db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, DEMO_SUBJECT.name))).limit(1))[0];
  const period = (await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, schoolId), eq(academicPeriods.status, "Activo"))).orderBy(academicPeriods.orderIndex).limit(1))[0];
  if (!subject || !period) return;
  let scaleEnsured = false;
  for (const activity of DEMO_ACTIVITIES) {
    const course = (await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, activity.course))).limit(1))[0];
    const year = course?.academicYearId ? (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, course.academicYearId))).limit(1))[0] : null;
    if (!course || !year) continue;
    const link = (await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, course.id), eq(courseSubjects.subjectId, subject.id), eq(courseSubjects.status, "ACTIVE"))).limit(1))[0];
    const assignment = (await db.select({ teacherUserId: teacherAssignments.teacherUserId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.subjectId, subject.id), eq(teacherAssignments.status, "ACTIVE"))).limit(1))[0];
    if (!link || !assignment) continue;
    const existing = await db.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.schoolId, schoolId), eq(assessments.courseId, course.id), eq(assessments.subjectId, subject.id), eq(assessments.academicPeriodId, period.id), eq(assessments.title, activity.title))).limit(1);
    if (existing.length) continue;
    if (!scaleEnsured) {
      await ensureGradeScale(schoolId);
      scaleEnsured = true;
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + activity.dueInDays);
    const inserted = await db.insert(assessments).values({ schoolId, academicYearId: year.id, academicPeriodId: period.id, courseId: course.id, subjectId: subject.id, teacherId: assignment.teacherUserId, title: activity.title, description: activity.description, assessmentType: activity.assessmentType, date: dueDate, maxValue: 5, weight: activity.weight, status: "PUBLISHED" }).$returningId();
    const assessmentId = inserted[0]?.id;
    if (!assessmentId) continue;
    const enrollments = await db.select({ id: studentEnrollments.id, studentUserId: studentEnrollments.studentUserId, openId: users.openId }).from(studentEnrollments).innerJoin(users, eq(users.id, studentEnrollments.studentUserId)).where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.courseId, course.id), eq(studentEnrollments.academicYearId, year.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).orderBy(studentEnrollments.id);
    if (!enrollments.length) continue;
    await db.insert(assessmentGrades).values(enrollments.map(enrollment => {
      const result = DEMO_STUDENTS.find(student => student.openId === enrollment.openId)?.results[activity.index];
      const value = typeof result === "number" ? result : null;
      return { schoolId, assessmentId, studentId: enrollment.studentUserId, studentEnrollmentId: enrollment.id, courseId: course.id, subjectId: subject.id, academicYearId: year.id, academicPeriodId: period.id, value, comment: null, status: value === null ? "PENDING" : "RECORDED" };
    }));
  }
}

export async function getGradeCenterContext(actor: GradeCenterActor, input: GradeCenterInput = {}) {
  const db = await getDb();
  if (!db) return null;
  await ensureGradeCenterSeeded(actor.schoolId);
  const courseIds = await visibleCourseIds(actor);
  if (input.courseId !== undefined && !courseIds.includes(input.courseId)) throw new Error("No tienes permiso para acceder a este curso.");
  const courseRows = courseIds.length ? await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), inArray(courses.id, courseIds))).orderBy(courses.name) : [];
  const course = courseRows.find(row => row.id === input.courseId) ?? courseRows.find(row => row.name === "11-2") ?? courseRows[0];
  if (!course) return { courses: [], subjects: [], periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0, weightTotal: 0, remainingWeight: 100, weightStatus: "INCOMPLETE" as const }, distribution: [], insights: [], observations: [], scale: null, selected: null, reportCards: [] };
  const links = await db.select().from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, course.id), eq(courseSubjects.status, "ACTIVE")));
  const linkedSubjectIds = links.map(link => link.subjectId);
  let subjectRows = linkedSubjectIds.length ? await db.select().from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), inArray(subjects.id, linkedSubjectIds))).orderBy(subjects.name) : [];
  if (actor.roleKey === "TEACHER") {
    const assignments = await db.select({ subjectId: teacherAssignments.subjectId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.status, "ACTIVE")));
    const assignedIds = new Set(assignments.map(row => row.subjectId));
    subjectRows = subjectRows.filter(row => assignedIds.has(row.id));
  }
  if (input.subjectId !== undefined && !subjectRows.some(row => row.id === input.subjectId)) throw new Error("No tienes permiso para acceder a esta materia.");
  const subject = subjectRows.find(row => row.id === input.subjectId) ?? subjectRows[0];
  if (!subject) return { courses: courseRows, subjects: [], periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0, weightTotal: 0, remainingWeight: 100, weightStatus: "INCOMPLETE" as const }, distribution: [], insights: [], observations: [], scale: null, selected: { course }, reportCards: [] };
  const periods = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, actor.schoolId), eq(academicPeriods.academicYearId, course.academicYearId ?? 0))).orderBy(academicPeriods.orderIndex);
  if (input.academicPeriodId !== undefined && !periods.some(row => row.id === input.academicPeriodId)) throw new Error("No tienes permiso para acceder a este periodo.");
  const period = periods.find(row => row.id === input.academicPeriodId) ?? periods.find(row => row.status === "Activo" || row.status === "ACTIVE") ?? periods[0];
  if (!period) return { courses: courseRows, subjects: subjectRows, periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0, weightTotal: 0, remainingWeight: 100, weightStatus: "INCOMPLETE" as const }, distribution: [], insights: [], observations: [], scale: null, selected: { course, subject }, reportCards: [] };
  const valid = await assertContext(actor, { courseId: course.id, subjectId: subject.id, academicPeriodId: period.id });
  const assessmentsRows = await db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.academicYearId, valid.academicYearId), eq(assessments.academicPeriodId, period.id), eq(assessments.courseId, course.id), eq(assessments.subjectId, subject.id), ne(assessments.status, "DELETED"))).orderBy(desc(assessments.date), desc(assessments.id));
  const enrollmentRows = await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.academicYearId, valid.academicYearId), eq(studentEnrollments.courseId, course.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  let visibleEnrollments = enrollmentRows;
  if (actor.roleKey === "STUDENT") visibleEnrollments = enrollmentRows.filter(row => row.studentUserId === actor.userId);
  if (actor.roleKey === "GUARDIAN") {
    const linked = await db.select({ studentUserId: guardianStudentRelationships.studentUserId }).from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, actor.schoolId), eq(guardianStudentRelationships.guardianUserId, actor.userId)));
    const ids = new Set(linked.map(row => row.studentUserId));
    visibleEnrollments = enrollmentRows.filter(row => ids.has(row.studentUserId));
  }
  const studentIds = visibleEnrollments.map(row => row.studentUserId);
  const people = studentIds.length ? await db.select({ id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(and(eq(users.schoolId, actor.schoolId), inArray(users.id, studentIds))) : [];
  const peopleById = new Map(people.map(person => [person.id, person]));
  const gradeRows = assessmentsRows.length && studentIds.length ? await db.select().from(assessmentGrades).where(and(eq(assessmentGrades.schoolId, actor.schoolId), inArray(assessmentGrades.assessmentId, assessmentsRows.map(row => row.id)), inArray(assessmentGrades.studentId, studentIds))) : [];
  const gradeByKey = new Map(gradeRows.map(row => [`${row.assessmentId}:${row.studentId}`, row]));
  const rows = visibleEnrollments.map(enrollment => {
    const values = assessmentsRows.map(assessment => ({ assessment, grade: gradeByKey.get(`${assessment.id}:${enrollment.studentUserId}`) ?? null }));
    return { enrollment, student: peopleById.get(enrollment.studentUserId) ?? null, values, average: weightedAverage(values.map(item => ({ value: item.grade?.value ?? null, maxValue: item.assessment.maxValue, weight: item.assessment.weight }))) };
  });
  const recorded = rows.flatMap(row => row.values.filter(item => item.grade && item.grade.value !== null && item.grade.value !== undefined).map(item => ({ value: (item.grade!.value! / item.assessment.maxValue) * 5, comment: item.grade?.comment })));
  const average = recorded.length ? Number((recorded.reduce((sum, item) => sum + item.value, 0) / recorded.length).toFixed(2)) : null;
  const distribution = [
    { label: "4.7–5.0", count: recorded.filter(item => item.value >= 4.7).length },
    { label: "4.0–4.6", count: recorded.filter(item => item.value >= 4.0 && item.value < 4.7).length },
    { label: "3.5–3.9", count: recorded.filter(item => item.value >= 3.5 && item.value < 4.0).length },
    { label: "0.0–3.4", count: recorded.filter(item => item.value < 3.5).length },
  ];
  const insights: string[] = [];
  if (recorded.length) insights.push(`El promedio visible del curso es ${average?.toFixed(2)} sobre 5.0.`);
  if (assessmentsRows.length) {
    const lowest = assessmentsRows.map(assessment => ({ assessment, average: weightedAverage(rows.map(row => ({ value: row.values.find(item => item.assessment.id === assessment.id)?.grade?.value ?? null, maxValue: assessment.maxValue, weight: 1 }))) })).filter(item => item.average !== null).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0];
    if (lowest) insights.push(`La evaluación con menor promedio visible es ${lowest.assessment.title} (${lowest.average?.toFixed(2)}).`);
  }
  const observations = studentIds.length ? await db.select().from(academicObservations).where(and(eq(academicObservations.schoolId, actor.schoolId), eq(academicObservations.academicYearId, valid.academicYearId), eq(academicObservations.academicPeriodId, period.id), inArray(academicObservations.studentId, studentIds))) : [];
  const scale = (await db.select().from(gradingScales).where(and(eq(gradingScales.schoolId, actor.schoolId), eq(gradingScales.status, "ACTIVE"))).limit(1))[0] ?? null;
  const reportCards = studentIds.length ? await db.select().from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, actor.schoolId), eq(reportCardRuns.academicYearId, valid.academicYearId), eq(reportCardRuns.academicPeriodId, period.id), eq(reportCardRuns.courseId, course.id), inArray(reportCardRuns.studentId, studentIds))).orderBy(desc(reportCardRuns.generatedAt)) : [];
  const weightTotal = assessmentsRows.reduce((sum, item) => sum + Number(item.weight), 0);
  const remainingWeight = Math.max(0, 100 - weightTotal);
  const weightStatus: "COMPLETE" | "INCOMPLETE" | "EXCEEDED" =
    weightTotal === 100 ? "COMPLETE" : weightTotal < 100 ? "INCOMPLETE" : "EXCEEDED";
  return { courses: courseRows, subjects: subjectRows, periods, assessments: assessmentsRows, students: people, rows, stats: { average, max: recorded.length ? Math.max(...recorded.map(item => item.value)) : null, min: recorded.length ? Math.min(...recorded.map(item => item.value)) : null, assessments: assessmentsRows.length, students: rows.length, graded: recorded.length, total: assessmentsRows.length * rows.length, completion: assessmentsRows.length && rows.length ? Math.round((recorded.length / (assessmentsRows.length * rows.length)) * 100) : 0, weightTotal, remainingWeight, weightStatus }, distribution, insights, observations, scale, selected: { course, subject, period, academicYearId: valid.academicYearId }, reportCards };
}

export type GradeCenterAssignmentSummary = {
  courseId: number;
  courseName: string;
  subjectId: number;
  subjectName: string;
  academicYear: string;
  periodId: number | null;
  periodName: string | null;
  periodClosed: boolean;
  students: number;
  evaluations: number;
  graded: number;
  total: number;
  /** Promedio de las notas registradas, normalizado a la escala 0–5. */
  average: number | null;
  /** Última modificación de evaluaciones o notas de la planilla. */
  lastActivityAt: Date | null;
  periodEndsAt: Date | null;
  /** Estudiantes con definitiva parcial por debajo de la nota aprobatoria, de menor a mayor. */
  belowPassing: Array<{ studentId: number; name: string; average: number }>;
};

const GRADE_SCALE_MAX = 5;
const PASSING_GRADE = 3;

/** Nota llevada a la escala 0–5 según el máximo de su evaluación. */
const normalizeGrade = (value: number, maxValue: number) => (value / (maxValue || GRADE_SCALE_MAX)) * GRADE_SCALE_MAX;
/** Regla de Grade Center para la definitiva: sin borradores ni evaluaciones sin peso. */
const countsForDefinitive = (evaluation: { status: string; weight: number }) => evaluation.status !== "DRAFT" && evaluation.weight > 0;
const roundGrade = (value: number) => Math.round(value * 10) / 10;

const isActivePeriod = (status: string) => status === "Activo" || status === "ACTIVE";
const isClosedPeriod = (status: string) => status === "Cerrado" || status === "CLOSED";

type PeriodRow = typeof academicPeriods.$inferSelect;

/** Periodo de trabajo por año académico: el activo o, en su defecto, el primero. */
async function workingPeriodByYear(schoolId: number, courseRows: Array<{ academicYearId: number | null }>): Promise<Map<number, PeriodRow>> {
  const periodByYear = new Map<number, PeriodRow>();
  const db = await getDb();
  const yearIds = Array.from(new Set(courseRows.map(row => row.academicYearId).filter((id): id is number => id !== null)));
  if (!db || !yearIds.length) return periodByYear;
  const periodRows = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, schoolId), inArray(academicPeriods.academicYearId, yearIds))).orderBy(academicPeriods.orderIndex);
  for (const yearId of yearIds) {
    const ofYear = periodRows.filter(row => row.academicYearId === yearId);
    const chosen = ofYear.find(row => isActivePeriod(row.status)) ?? ofYear[0];
    if (chosen) periodByYear.set(yearId, chosen);
  }
  return periodByYear;
}

/**
 * Lista las planillas (curso × materia) a las que el actor tiene acceso, con el
 * progreso de calificación real de cada una en su periodo activo.
 *
 * Usa las mismas reglas de autorización y de selección de periodo que
 * `getGradeCenterContext`, pero en consultas agregadas para no cargar la matriz
 * completa de cada planilla.
 */
export async function listGradeCenterAssignments(actor: GradeCenterActor): Promise<GradeCenterAssignmentSummary[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureGradeCenterSeeded(actor.schoolId);
  const courseIds = await visibleCourseIds(actor);
  if (!courseIds.length) return [];

  const courseRows = await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), inArray(courses.id, courseIds))).orderBy(courses.name);
  let pairs = await db.select({ courseId: courseSubjects.courseId, subjectId: courseSubjects.subjectId }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), inArray(courseSubjects.courseId, courseIds), eq(courseSubjects.status, "ACTIVE")));
  if (actor.roleKey === "TEACHER") {
    const own = await db.select({ courseId: teacherAssignments.courseId, subjectId: teacherAssignments.subjectId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.status, "ACTIVE")));
    const allowed = new Set(own.map(row => `${row.courseId}:${row.subjectId}`));
    pairs = pairs.filter(pair => allowed.has(`${pair.courseId}:${pair.subjectId}`));
  }
  if (!pairs.length) return [];

  const subjectIds = Array.from(new Set(pairs.map(pair => pair.subjectId)));
  const subjectRows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), inArray(subjects.id, subjectIds)));
  const subjectById = new Map(subjectRows.map(row => [row.id, row]));

  const periodByYear = await workingPeriodByYear(actor.schoolId, courseRows);
  const periodIds = Array.from(periodByYear.values()).map(row => row.id);

  const enrollmentRows = await db.select({ courseId: studentEnrollments.courseId, academicYearId: studentEnrollments.academicYearId, studentUserId: studentEnrollments.studentUserId }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), inArray(studentEnrollments.courseId, courseIds), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  let visibleStudentIds: Set<number> | null = null;
  if (actor.roleKey === "STUDENT") visibleStudentIds = new Set([actor.userId]);
  if (actor.roleKey === "GUARDIAN") {
    const linked = await db.select({ studentUserId: guardianStudentRelationships.studentUserId }).from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, actor.schoolId), eq(guardianStudentRelationships.guardianUserId, actor.userId)));
    visibleStudentIds = new Set(linked.map(row => row.studentUserId));
  }

  const assessmentRows = periodIds.length ? await db.select({ id: assessments.id, courseId: assessments.courseId, subjectId: assessments.subjectId, academicPeriodId: assessments.academicPeriodId, maxValue: assessments.maxValue, weight: assessments.weight, status: assessments.status, updatedAt: assessments.updatedAt }).from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), inArray(assessments.courseId, courseIds), inArray(assessments.academicPeriodId, periodIds), ne(assessments.status, "DELETED"))) : [];
  const gradeRows = assessmentRows.length ? await db.select({ assessmentId: assessmentGrades.assessmentId, studentId: assessmentGrades.studentId, value: assessmentGrades.value, updatedAt: assessmentGrades.updatedAt }).from(assessmentGrades).where(and(eq(assessmentGrades.schoolId, actor.schoolId), inArray(assessmentGrades.assessmentId, assessmentRows.map(row => row.id)))) : [];

  const gradesByAssessment = new Map<number, typeof gradeRows>();
  for (const row of gradeRows) {
    const bucket = gradesByAssessment.get(row.assessmentId);
    if (bucket) bucket.push(row);
    else gradesByAssessment.set(row.assessmentId, [row]);
  }

  const courseById = new Map(courseRows.map(row => [row.id, row]));
  const summaries: GradeCenterAssignmentSummary[] = [];
  for (const pair of pairs) {
    const course = courseById.get(pair.courseId);
    const subject = subjectById.get(pair.subjectId);
    if (!course || !subject) continue;
    const period = course.academicYearId !== null ? periodByYear.get(course.academicYearId) : undefined;
    const studentIds = new Set(
      enrollmentRows
        .filter(row => row.courseId === course.id && row.academicYearId === course.academicYearId && (!visibleStudentIds || visibleStudentIds.has(row.studentUserId)))
        .map(row => row.studentUserId),
    );
    const evaluations = period ? assessmentRows.filter(row => row.courseId === course.id && row.subjectId === subject.id && row.academicPeriodId === period.id) : [];
    let graded = 0;
    let normalizedSum = 0;
    let lastActivity = 0;
    // Definitiva parcial por estudiante: misma regla que Grade Center (ponderada, sin borradores)
    const weighted = new Map<number, { sum: number; weight: number }>();
    for (const evaluation of evaluations) {
      lastActivity = Math.max(lastActivity, evaluation.updatedAt.getTime());
      const counts = countsForDefinitive(evaluation);
      for (const grade of gradesByAssessment.get(evaluation.id) ?? []) {
        if (grade.value === null || !studentIds.has(grade.studentId)) continue;
        const normalized = normalizeGrade(grade.value, evaluation.maxValue);
        graded += 1;
        normalizedSum += normalized;
        lastActivity = Math.max(lastActivity, grade.updatedAt.getTime());
        if (!counts) continue;
        const acc = weighted.get(grade.studentId) ?? { sum: 0, weight: 0 };
        acc.sum += normalized * evaluation.weight;
        acc.weight += evaluation.weight;
        weighted.set(grade.studentId, acc);
      }
    }
    const belowPassing = Array.from(weighted, ([studentId, acc]) => ({ studentId, name: "", average: roundGrade(acc.sum / acc.weight) }))
      .filter(row => row.average < PASSING_GRADE)
      .sort((a, b) => a.average - b.average);
    summaries.push({
      courseId: course.id,
      courseName: course.name,
      subjectId: subject.id,
      subjectName: subject.name,
      academicYear: String(course.year),
      periodId: period?.id ?? null,
      periodName: period?.name ?? null,
      periodClosed: period ? isClosedPeriod(period.status) : false,
      students: studentIds.size,
      evaluations: evaluations.length,
      graded,
      total: studentIds.size * evaluations.length,
      average: graded ? roundGrade(normalizedSum / graded) : null,
      lastActivityAt: lastActivity ? new Date(lastActivity) : null,
      periodEndsAt: period?.endDate ?? null,
      belowPassing,
    });
  }

  const flaggedIds = Array.from(new Set(summaries.flatMap(summary => summary.belowPassing.map(row => row.studentId))));
  if (flaggedIds.length) {
    const nameRows = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.schoolId, actor.schoolId), inArray(users.id, flaggedIds)));
    const nameById = new Map(nameRows.map(row => [row.id, row.name ?? ""]));
    for (const summary of summaries) {
      for (const row of summary.belowPassing) row.name = nameById.get(row.studentId) || `Estudiante #${row.studentId}`;
    }
  }

  return summaries.sort((a, b) => a.courseName.localeCompare(b.courseName, "es", { numeric: true }) || a.subjectName.localeCompare(b.subjectName, "es"));
}

export type GradeCenterReportCardSummary = {
  courseId: number;
  courseName: string;
  academicYearId: number;
  periodId: number;
  periodName: string;
  students: number;
  /** Estudiantes matriculados con al menos un boletín generado en el periodo. */
  generated: number;
  lastGeneratedAt: Date | null;
};

/** Estado de los boletines de cada curso visible en su periodo de trabajo. */
export async function listGradeCenterReportCards(actor: GradeCenterActor): Promise<{ courses: GradeCenterReportCardSummary[]; canGenerate: boolean }> {
  const canGenerate = MANAGEMENT_ROLES.includes(actor.roleKey);
  const db = await getDb();
  // Los conteos son de todo el curso: solo para docentes y directivos
  if (!db || !WRITE_ROLES.includes(actor.roleKey)) return { courses: [], canGenerate };
  const courseIds = await visibleCourseIds(actor);
  if (!courseIds.length) return { courses: [], canGenerate };

  const courseRows = await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), inArray(courses.id, courseIds))).orderBy(courses.name);
  const periodByYear = await workingPeriodByYear(actor.schoolId, courseRows);
  const periodIds = Array.from(periodByYear.values()).map(row => row.id);
  const enrollmentRows = await db.select({ courseId: studentEnrollments.courseId, academicYearId: studentEnrollments.academicYearId, studentUserId: studentEnrollments.studentUserId }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), inArray(studentEnrollments.courseId, courseIds), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  const runRows = periodIds.length ? await db.select({ courseId: reportCardRuns.courseId, academicPeriodId: reportCardRuns.academicPeriodId, studentId: reportCardRuns.studentId, generatedAt: reportCardRuns.generatedAt }).from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, actor.schoolId), inArray(reportCardRuns.courseId, courseIds), inArray(reportCardRuns.academicPeriodId, periodIds))) : [];

  const summaries: GradeCenterReportCardSummary[] = [];
  for (const course of courseRows) {
    const period = course.academicYearId !== null ? periodByYear.get(course.academicYearId) : undefined;
    if (!period || course.academicYearId === null) continue;
    const studentIds = new Set(enrollmentRows.filter(row => row.courseId === course.id && row.academicYearId === course.academicYearId).map(row => row.studentUserId));
    const runs = runRows.filter(row => row.courseId === course.id && row.academicPeriodId === period.id && studentIds.has(row.studentId));
    const lastGenerated = runs.reduce((max, row) => Math.max(max, row.generatedAt.getTime()), 0);
    summaries.push({
      courseId: course.id,
      courseName: course.name,
      academicYearId: course.academicYearId,
      periodId: period.id,
      periodName: period.name,
      students: studentIds.size,
      generated: new Set(runs.map(row => row.studentId)).size,
      lastGeneratedAt: lastGenerated ? new Date(lastGenerated) : null,
    });
  }
  return { courses: summaries, canGenerate };
}

export type ReportCardSubject = {
  subjectId: number;
  subjectName: string;
  /** Definitiva parcial en escala 0–5; `null` sin notas que cuenten. */
  average: number | null;
  /** Notas registradas en evaluaciones que cuentan para la definitiva. */
  graded: number;
  evaluations: number;
};

export type StudentReportCard = {
  studentId: number;
  name: string;
  subjects: ReportCardSubject[];
  /** Promedio de las materias con definitiva. */
  average: number | null;
  observations: Array<{ id: number; text: string; createdAt: Date }>;
  /** Última generación oficial del boletín en el periodo; `null` = vista preliminar. */
  generatedAt: Date | null;
};

export type CourseReportCards = {
  /** `directorName`: director(a) de grupo registrado en el curso. */
  course: { id: number; name: string; year: string; directorName: string | null };
  period: { id: number; name: string; closed: boolean };
  academicYearId: number;
  students: StudentReportCard[];
};

type ReportCardScope = { courseId: number; academicYearId: number; academicPeriodId: number };

/**
 * Boletín de cada estudiante matriculado en el curso para el periodo dado.
 * Única fuente del cálculo: lo usan la consulta en vivo y la generación oficial,
 * así el boletín que ve el docente y el que se congela nunca difieren.
 */
async function computeCourseReportCards(schoolId: number, scope: ReportCardScope): Promise<StudentReportCard[]> {
  const db = await getDb();
  if (!db) return [];
  const [links, enrollments, evaluations] = await Promise.all([
    db.select({ subjectId: courseSubjects.subjectId }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, scope.courseId), eq(courseSubjects.status, "ACTIVE"))),
    db.select({ studentUserId: studentEnrollments.studentUserId }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.courseId, scope.courseId), eq(studentEnrollments.academicYearId, scope.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))),
    db.select({ id: assessments.id, subjectId: assessments.subjectId, maxValue: assessments.maxValue, weight: assessments.weight, status: assessments.status }).from(assessments).where(and(eq(assessments.schoolId, schoolId), eq(assessments.courseId, scope.courseId), eq(assessments.academicPeriodId, scope.academicPeriodId), ne(assessments.status, "DELETED"))),
  ]);
  const studentIds = Array.from(new Set(enrollments.map(row => row.studentUserId)));
  if (!studentIds.length) return [];
  const subjectIds = Array.from(new Set(links.map(row => row.subjectId)));
  const counted = evaluations.filter(countsForDefinitive);

  const [subjectRows, nameRows, gradeRows, observationRows, runRows] = await Promise.all([
    subjectIds.length ? db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.schoolId, schoolId), inArray(subjects.id, subjectIds))) : [],
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.schoolId, schoolId), inArray(users.id, studentIds))),
    counted.length ? db.select({ assessmentId: assessmentGrades.assessmentId, studentId: assessmentGrades.studentId, value: assessmentGrades.value }).from(assessmentGrades).where(and(eq(assessmentGrades.schoolId, schoolId), inArray(assessmentGrades.assessmentId, counted.map(row => row.id)), inArray(assessmentGrades.studentId, studentIds))) : [],
    db.select({ id: academicObservations.id, studentId: academicObservations.studentId, text: academicObservations.text, createdAt: academicObservations.createdAt }).from(academicObservations).where(and(eq(academicObservations.schoolId, schoolId), eq(academicObservations.academicPeriodId, scope.academicPeriodId), eq(academicObservations.status, "PUBLISHED"), inArray(academicObservations.studentId, studentIds))).orderBy(academicObservations.createdAt),
    db.select({ studentId: reportCardRuns.studentId, generatedAt: reportCardRuns.generatedAt }).from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, schoolId), eq(reportCardRuns.courseId, scope.courseId), eq(reportCardRuns.academicPeriodId, scope.academicPeriodId), inArray(reportCardRuns.studentId, studentIds))),
  ]);

  const subjectList = subjectRows.slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  const nameById = new Map(nameRows.map(row => [row.id, row.name ?? ""]));
  const valueByKey = new Map(gradeRows.filter(row => row.value !== null).map(row => [`${row.assessmentId}:${row.studentId}`, row.value as number]));
  const evaluationsBySubject = new Map<number, typeof counted>();
  for (const evaluation of counted) {
    const bucket = evaluationsBySubject.get(evaluation.subjectId);
    if (bucket) bucket.push(evaluation);
    else evaluationsBySubject.set(evaluation.subjectId, [evaluation]);
  }
  const lastRunByStudent = new Map<number, number>();
  for (const run of runRows) lastRunByStudent.set(run.studentId, Math.max(lastRunByStudent.get(run.studentId) ?? 0, run.generatedAt.getTime()));

  const cards = studentIds.map((studentId): StudentReportCard => {
    const subjectCards = subjectList.map((subject): ReportCardSubject => {
      const ofSubject = evaluationsBySubject.get(subject.id) ?? [];
      let graded = 0;
      let sum = 0;
      let weight = 0;
      for (const evaluation of ofSubject) {
        const value = valueByKey.get(`${evaluation.id}:${studentId}`);
        if (value === undefined) continue;
        graded += 1;
        sum += normalizeGrade(value, evaluation.maxValue) * evaluation.weight;
        weight += evaluation.weight;
      }
      return { subjectId: subject.id, subjectName: subject.name, average: weight ? roundGrade(sum / weight) : null, graded, evaluations: ofSubject.length };
    });
    const withAverage = subjectCards.filter(subject => subject.average !== null);
    const lastRun = lastRunByStudent.get(studentId);
    return {
      studentId,
      name: nameById.get(studentId) || `Estudiante #${studentId}`,
      subjects: subjectCards,
      average: withAverage.length ? roundGrade(withAverage.reduce((total, subject) => total + (subject.average as number), 0) / withAverage.length) : null,
      observations: observationRows.filter(row => row.studentId === studentId).map(({ id, text, createdAt }) => ({ id, text, createdAt })),
      generatedAt: lastRun ? new Date(lastRun) : null,
    };
  });
  return cards.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Boletines del curso en su periodo de trabajo, calculados en vivo desde Grade Center.
 * Docentes ven el boletín completo (todas las materias) de los cursos donde tienen asignación.
 */
export async function getGradeCenterCourseReportCards(actor: GradeCenterActor, input: { courseId: number }): Promise<CourseReportCards | null> {
  const db = await getDb();
  if (!db) return null;
  if (!WRITE_ROLES.includes(actor.roleKey)) throw new Error("No tienes permisos para ver los boletines del curso.");
  if (!(await visibleCourseIds(actor)).includes(input.courseId)) throw new Error("No tienes acceso a los boletines de este curso.");
  const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0];
  if (!course || course.academicYearId === null) throw new Error("El curso no tiene un año académico configurado.");
  const period = (await workingPeriodByYear(actor.schoolId, [course])).get(course.academicYearId);
  if (!period) throw new Error("El curso no tiene un periodo académico configurado.");
  const students = await computeCourseReportCards(actor.schoolId, { courseId: course.id, academicYearId: course.academicYearId, academicPeriodId: period.id });
  return {
    course: { id: course.id, name: course.name, year: course.year, directorName: course.teacherName.trim() || null },
    period: { id: period.id, name: period.name, closed: isClosedPeriod(period.status) },
    academicYearId: course.academicYearId,
    students,
  };
}

export async function ensureGradeScale(schoolId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = (await db.select().from(gradingScales).where(and(eq(gradingScales.schoolId, schoolId), eq(gradingScales.name, "Escala institucional"))).limit(1))[0];
  if (existing) return existing;
  await db.insert(gradingScales).values({ schoolId, name: "Escala institucional", minValue: 0, maxValue: 5, decimalPlaces: 1, status: "ACTIVE" });
  return (await db.select().from(gradingScales).where(and(eq(gradingScales.schoolId, schoolId), eq(gradingScales.name, "Escala institucional"))).limit(1))[0] ?? null;
}

export async function createGradeCenterAssessment(actor: GradeCenterActor, input: { academicYearId: number; academicPeriodId: number; courseId: number; subjectId: number; title: string; description?: string; assessmentType: string; date: Date; maxValue: number; weight: number; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  if (!WRITE_ROLES.includes(actor.roleKey)) throw new Error("No tienes permisos para crear evaluaciones.");
  const valid = await assertContext(actor, input);
  const scale = await ensureGradeScale(actor.schoolId);
  if (!scale || input.maxValue < scale.minValue || input.maxValue > scale.maxValue || input.weight < 0 || input.weight > 100) throw new Error("La escala o el peso de la evaluación no son válidos.");
  
  // Validar que la ponderación total de las evaluaciones no supere el 100%
  const currentAssessments = await db.select({ id: assessments.id, weight: assessments.weight }).from(assessments).where(and(
    eq(assessments.schoolId, actor.schoolId),
    eq(assessments.courseId, input.courseId),
    eq(assessments.subjectId, input.subjectId),
    eq(assessments.academicPeriodId, input.academicPeriodId),
    ne(assessments.status, "DELETED")
  ));
  const currentTotal = currentAssessments.reduce((sum, a) => sum + Number(a.weight), 0);
  if (currentTotal + input.weight > 100) {
    throw new Error(`La ponderación total de las evaluaciones no puede superar el 100%. (Actualmente asignado: ${currentTotal}%, nuevo peso: ${input.weight}%, total resultante: ${currentTotal + input.weight}%).`);
  }

  await db.insert(assessments).values({ schoolId: actor.schoolId, ...input, description: input.description ?? null, status: input.status ?? "DRAFT", teacherId: actor.userId });
  const assessment = (await db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.courseId, input.courseId), eq(assessments.subjectId, input.subjectId), eq(assessments.academicPeriodId, input.academicPeriodId), eq(assessments.title, input.title), ne(assessments.status, "DELETED"))).orderBy(desc(assessments.id)).limit(1))[0];
  if (!assessment) return null;
  const enrollments = await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.academicYearId, valid.academicYearId), eq(studentEnrollments.courseId, input.courseId), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  if (enrollments.length) await db.insert(assessmentGrades).values(enrollments.map(enrollment => ({ schoolId: actor.schoolId, assessmentId: assessment.id, studentId: enrollment.studentUserId, studentEnrollmentId: enrollment.id, courseId: input.courseId, subjectId: input.subjectId, academicYearId: valid.academicYearId, academicPeriodId: input.academicPeriodId, value: null, comment: null, status: "PENDING" })));
  await writeAcademicAudit(actor, "assessment_created", "assessment", String(assessment.id));
  return assessment;
}

export async function updateGradeCenterAssessment(actor: GradeCenterActor, input: { id: number; title?: string; description?: string; weight?: number; date?: Date; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  const assessment = (await db.select().from(assessments).where(and(eq(assessments.id, input.id), eq(assessments.schoolId, actor.schoolId))).limit(1))[0];
  if (!assessment) throw new Error("Evaluación no encontrada.");
  if (assessment.status === "DELETED") throw new Error("La evaluación está eliminada.");
  if (assessment.status === "CLOSED" && !MANAGEMENT_ROLES.includes(actor.roleKey)) throw new Error("La evaluación está cerrada.");
  if (actor.roleKey === "TEACHER") await assertContext(actor, { courseId: assessment.courseId, subjectId: assessment.subjectId, academicPeriodId: assessment.academicPeriodId });
  if (input.weight !== undefined && (input.weight < 0 || input.weight > 100 || isNaN(input.weight))) {
    throw new Error("El peso de la evaluación debe estar entre 0 y 100.");
  }
  if (input.title !== undefined && (!input.title.trim() || input.title.trim().length < 3)) {
    throw new Error("El título de la evaluación debe tener al menos 3 caracteres.");
  }
  if (input.weight !== undefined) {
    const otherAssessments = await db.select({ id: assessments.id, weight: assessments.weight }).from(assessments).where(and(
      eq(assessments.schoolId, actor.schoolId),
      eq(assessments.courseId, assessment.courseId),
      eq(assessments.subjectId, assessment.subjectId),
      eq(assessments.academicPeriodId, assessment.academicPeriodId),
      ne(assessments.id, assessment.id),
      ne(assessments.status, "DELETED")
    ));
    const otherTotal = otherAssessments.reduce((sum, a) => sum + Number(a.weight), 0);
    if (otherTotal + input.weight > 100) {
      throw new Error(`La ponderación total de las evaluaciones no puede superar el 100%. (Asignado en otras evaluaciones: ${otherTotal}%, nuevo peso: ${input.weight}%, total resultante: ${otherTotal + input.weight}%).`);
    }
  }
  await db.update(assessments).set({ title: input.title ? input.title.trim() : assessment.title, description: input.description !== undefined ? input.description : assessment.description, weight: input.weight !== undefined ? input.weight : assessment.weight, date: input.date !== undefined ? input.date : assessment.date, status: input.status !== undefined ? input.status : assessment.status }).where(eq(assessments.id, input.id));
  await writeAcademicAudit(actor, input.status === "PUBLISHED" ? "assessment_published" : input.status === "CLOSED" ? "assessment_closed" : "assessment_updated", "assessment", String(input.id));
  return (await db.select().from(assessments).where(eq(assessments.id, input.id)).limit(1))[0];
}

export async function deleteGradeCenterAssessment(actor: GradeCenterActor, assessmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  if (!WRITE_ROLES.includes(actor.roleKey)) throw new Error("No tienes permisos para eliminar evaluaciones.");

  const assessment = (await db.select().from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, actor.schoolId))).limit(1))[0];
  if (!assessment) throw new Error("Evaluación no encontrada.");
  if (assessment.status === "DELETED") throw new Error("La evaluación ya fue eliminada.");

  if (assessment.status === "CLOSED" && !MANAGEMENT_ROLES.includes(actor.roleKey)) {
    throw new Error("La evaluación está cerrada y requiere autorización especial para eliminarse.");
  }

  if (actor.roleKey === "TEACHER") {
    await assertContext(actor, { courseId: assessment.courseId, subjectId: assessment.subjectId, academicPeriodId: assessment.academicPeriodId });
  }

  const period = (await db.select().from(academicPeriods).where(and(eq(academicPeriods.id, assessment.academicPeriodId), eq(academicPeriods.schoolId, actor.schoolId))).limit(1))[0];
  if (period?.status === "Cerrado" || period?.status === "CLOSED") {
    throw new Error("El periodo académico está cerrado y no admite cambios.");
  }

  await db.update(assessments).set({ status: "DELETED" }).where(eq(assessments.id, assessmentId));
  await writeAcademicAudit(actor, "assessment_deleted", "assessment", String(assessmentId));

  return { success: true, id: assessmentId, releasedWeight: Number(assessment.weight) };
}

export async function saveGradeCenterGrades(actor: GradeCenterActor, input: { assessmentId: number; grades: Array<{ studentId: number; value: number | null; comment?: string }> }) {
  const db = await getDb();
  if (!db) return null;
  const assessment = (await db.select().from(assessments).where(and(eq(assessments.id, input.assessmentId), eq(assessments.schoolId, actor.schoolId))).limit(1))[0];
  if (!assessment) throw new Error("Evaluación no encontrada.");
  if (assessment.status === "DELETED") throw new Error("La evaluación está eliminada.");
  if (!WRITE_ROLES.includes(actor.roleKey)) throw new Error("No tienes permisos para modificar calificaciones.");
  if (assessment.status === "CLOSED" && !MANAGEMENT_ROLES.includes(actor.roleKey)) throw new Error("La evaluación está cerrada y requiere autorización especial.");
  await assertContext(actor, { courseId: assessment.courseId, subjectId: assessment.subjectId, academicPeriodId: assessment.academicPeriodId });
  const period = (await db.select().from(academicPeriods).where(eq(academicPeriods.id, assessment.academicPeriodId)).limit(1))[0];
  if (period?.status === "Cerrado" || period?.status === "CLOSED") throw new Error("El periodo está cerrado y no admite cambios.");
  const validEnrollments = await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.courseId, assessment.courseId), eq(studentEnrollments.academicYearId, assessment.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"), inArray(studentEnrollments.studentUserId, input.grades.map(item => item.studentId))));
  if (validEnrollments.length !== input.grades.length) throw new Error("Solo puedes calificar estudiantes matriculados en el curso.");
  const scale = await ensureGradeScale(actor.schoolId);
  if (!scale) throw new Error("No existe una escala de calificación activa.");
  for (const item of input.grades) {
    if (item.value !== null && (item.value < scale.minValue || item.value > assessment.maxValue)) throw new Error(`La nota debe estar entre ${scale.minValue} y ${assessment.maxValue}.`);
    const enrollment = validEnrollments.find(row => row.studentUserId === item.studentId)!;
    await db.update(assessmentGrades).set({ value: item.value, comment: item.comment ?? null, status: item.value === null ? "PENDING" : "RECORDED" }).where(and(eq(assessmentGrades.assessmentId, assessment.id), eq(assessmentGrades.studentId, item.studentId), eq(assessmentGrades.schoolId, actor.schoolId)));
    if (!enrollment) throw new Error("Matrícula inválida.");
  }
  await writeAcademicAudit(actor, "grade_updated", "assessment", `${assessment.id}:${input.grades.length}`);
  return { saved: input.grades.length };
}

export async function saveAcademicObservation(actor: GradeCenterActor, input: { studentId: number; academicYearId: number; academicPeriodId: number; assessmentId?: number; text: string; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  if (!WRITE_ROLES.includes(actor.roleKey)) throw new Error("No tienes permisos para guardar observaciones.");
  const enrollment = (await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, input.studentId), eq(studentEnrollments.academicYearId, input.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).limit(1))[0];
  if (!enrollment) throw new Error("El estudiante no pertenece a la institución o al año académico.");
  await db.insert(academicObservations).values({ schoolId: actor.schoolId, ...input, assessmentId: input.assessmentId ?? null, status: input.status ?? "DRAFT", createdByUserId: actor.userId });
  await writeAcademicAudit(actor, "academic_observation_created", "academic_observation", String(input.studentId));
  return (await db.select().from(academicObservations).where(and(eq(academicObservations.schoolId, actor.schoolId), eq(academicObservations.studentId, input.studentId))).orderBy(desc(academicObservations.id)).limit(1))[0];
}

export async function generateGradeCenterReportCards(actor: GradeCenterActor, input: { academicYearId: number; academicPeriodId: number; courseId: number }) {
  const db = await getDb();
  if (!db) return null;
  if (!MANAGEMENT_ROLES.includes(actor.roleKey)) throw new Error("Solo roles institucionales pueden generar boletines.");
  const [course, period] = await Promise.all([
    db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.schoolId, actor.schoolId))).limit(1).then(rows => rows[0]),
    db.select().from(academicPeriods).where(and(eq(academicPeriods.id, input.academicPeriodId), eq(academicPeriods.schoolId, actor.schoolId))).limit(1).then(rows => rows[0]),
  ]);
  if (!course || course.academicYearId !== input.academicYearId) throw new Error("Curso inválido para generar boletines.");
  if (!period || (period.academicYearId !== null && period.academicYearId !== input.academicYearId)) throw new Error("Periodo inválido para generar boletines.");
  // Congela exactamente el boletín que se ve en vivo
  const cards = await computeCourseReportCards(actor.schoolId, input);
  if (cards.length) {
    await db.insert(reportCardRuns).values(cards.map(card => ({
      schoolId: actor.schoolId,
      academicYearId: input.academicYearId,
      academicPeriodId: input.academicPeriodId,
      courseId: input.courseId,
      studentId: card.studentId,
      status: "COMPLETED",
      createdByUserId: actor.userId,
      dataJson: JSON.stringify({
        schoolId: actor.schoolId,
        studentId: card.studentId,
        courseId: input.courseId,
        academicYearId: input.academicYearId,
        academicPeriodId: input.academicPeriodId,
        average: card.average,
        subjects: card.subjects.map(({ subjectId, subjectName, average }) => ({ subjectId, subjectName, average })),
      }),
    })));
  }
  await writeAcademicAudit(actor, "report_cards_generated", "report_card_run", `${input.courseId}:${cards.length}`);
  return { status: "COMPLETED", generated: cards.length, total: cards.length };
}

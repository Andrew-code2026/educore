import { and, desc, eq, inArray, or } from "drizzle-orm";
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

export type GradeCenterActor = AcademicActor;

type GradeCenterInput = { courseId?: number; subjectId?: number; academicPeriodId?: number };

const MANAGEMENT_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR"];
const WRITE_ROLES = [...MANAGEMENT_ROLES, "TEACHER"];

async function visibleCourseIds(actor: GradeCenterActor) {
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

export async function ensureGradeCenterSeeded(schoolId: number) {
  const db = await getDb();
  if (!db) return;
  const course = (await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, "11-2"))).limit(1))[0];
  const subject = (await db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, "Matemáticas"))).limit(1))[0];
  const period = (await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, schoolId), eq(academicPeriods.status, "Activo"))).orderBy(academicPeriods.orderIndex).limit(1))[0];
  const year = course?.academicYearId ? (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, course.academicYearId))).limit(1))[0] : null;
  if (!course || !subject || !period || !year) return;
  const link = (await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, course.id), eq(courseSubjects.subjectId, subject.id), eq(courseSubjects.status, "ACTIVE"))).limit(1))[0];
  const assignment = (await db.select({ teacherUserId: teacherAssignments.teacherUserId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.subjectId, subject.id), eq(teacherAssignments.status, "ACTIVE"))).limit(1))[0];
  if (!link || !assignment) return;
  const existing = await db.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.schoolId, schoolId), eq(assessments.courseId, course.id), eq(assessments.subjectId, subject.id), eq(assessments.academicPeriodId, period.id))).limit(1);
  if (existing.length) return;
  await ensureGradeScale(schoolId);
  const seed = [
    { title: "Taller de funciones", assessmentType: "TALLER", weight: 20, values: [4.2, 3.8] },
    { title: "Quiz de derivadas", assessmentType: "QUIZ", weight: 20, values: [4.6, 3.1] },
    { title: "Proyecto aplicado", assessmentType: "PROYECTO", weight: 30, values: [4.4, 3.7] },
    { title: "Parcial de cálculo", assessmentType: "EXAMEN", weight: 30, values: [4.1, 2.9] },
  ] as const;
  const enrollments = await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.courseId, course.id), eq(studentEnrollments.academicYearId, year.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).orderBy(studentEnrollments.id);
  for (const item of seed) {
    await db.insert(assessments).values({ schoolId, academicYearId: year.id, academicPeriodId: period.id, courseId: course.id, subjectId: subject.id, teacherId: assignment.teacherUserId, title: item.title, description: "Evaluación demo del Grade Center.", assessmentType: item.assessmentType, date: new Date(), maxValue: 5, weight: item.weight, status: "PUBLISHED" });
    const assessment = (await db.select().from(assessments).where(and(eq(assessments.schoolId, schoolId), eq(assessments.courseId, course.id), eq(assessments.subjectId, subject.id), eq(assessments.academicPeriodId, period.id), eq(assessments.title, item.title))).orderBy(desc(assessments.id)).limit(1))[0];
    if (assessment && enrollments.length) await db.insert(assessmentGrades).values(enrollments.map((enrollment, index) => ({ schoolId, assessmentId: assessment.id, studentId: enrollment.studentUserId, studentEnrollmentId: enrollment.id, courseId: course.id, subjectId: subject.id, academicYearId: year.id, academicPeriodId: period.id, value: item.values[index] ?? null, comment: index === 1 && item.title === "Parcial de cálculo" ? "Revisar procedimiento y justificar cada paso." : null, status: "RECORDED" })));
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
  if (!course) return { courses: [], subjects: [], periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0 }, distribution: [], insights: [], observations: [], scale: null, selected: null, reportCards: [] };
  const links = await db.select().from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, course.id), eq(courseSubjects.status, "ACTIVE")));
  const linkedSubjectIds = links.map(link => link.subjectId);
  let subjectRows = linkedSubjectIds.length ? await db.select().from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), inArray(subjects.id, linkedSubjectIds))).orderBy(subjects.name) : [];
  if (actor.roleKey === "TEACHER") {
    const assignments = await db.select({ subjectId: teacherAssignments.subjectId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.status, "ACTIVE")));
    const assignedIds = new Set(assignments.map(row => row.subjectId));
    subjectRows = subjectRows.filter(row => assignedIds.has(row.id));
  }
  if (input.subjectId !== undefined && !subjectRows.some(row => row.id === input.subjectId)) throw new Error("No tienes permiso para acceder a esta materia.");
  const subject = subjectRows.find(row => row.id === input.subjectId) ?? subjectRows.find(row => row.name === "Matemáticas") ?? subjectRows[0];
  if (!subject) return { courses: courseRows, subjects: [], periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0 }, distribution: [], insights: [], observations: [], scale: null, selected: { course }, reportCards: [] };
  const periods = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, actor.schoolId), eq(academicPeriods.academicYearId, course.academicYearId ?? 0))).orderBy(academicPeriods.orderIndex);
  if (input.academicPeriodId !== undefined && !periods.some(row => row.id === input.academicPeriodId)) throw new Error("No tienes permiso para acceder a este periodo.");
  const period = periods.find(row => row.id === input.academicPeriodId) ?? periods.find(row => row.status === "Activo" || row.status === "ACTIVE") ?? periods[0];
  if (!period) return { courses: courseRows, subjects: subjectRows, periods: [], assessments: [], students: [], rows: [], stats: { average: null, max: null, min: null, assessments: 0, students: 0, graded: 0, total: 0, completion: 0 }, distribution: [], insights: [], observations: [], scale: null, selected: { course, subject }, reportCards: [] };
  const valid = await assertContext(actor, { courseId: course.id, subjectId: subject.id, academicPeriodId: period.id });
  const assessmentsRows = await db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.academicYearId, valid.academicYearId), eq(assessments.academicPeriodId, period.id), eq(assessments.courseId, course.id), eq(assessments.subjectId, subject.id))).orderBy(desc(assessments.date), desc(assessments.id));
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
    { label: "5.0–4.5", count: recorded.filter(item => item.value >= 4.5).length },
    { label: "4.4–4.0", count: recorded.filter(item => item.value >= 4 && item.value < 4.5).length },
    { label: "3.9–3.0", count: recorded.filter(item => item.value >= 3 && item.value < 4).length },
    { label: "2.9–2.0", count: recorded.filter(item => item.value >= 2 && item.value < 3).length },
    { label: "1.9–0.0", count: recorded.filter(item => item.value < 2).length },
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
  return { courses: courseRows, subjects: subjectRows, periods, assessments: assessmentsRows, students: people, rows, stats: { average, max: recorded.length ? Math.max(...recorded.map(item => item.value)) : null, min: recorded.length ? Math.min(...recorded.map(item => item.value)) : null, assessments: assessmentsRows.length, students: rows.length, graded: recorded.length, total: assessmentsRows.length * rows.length, completion: assessmentsRows.length && rows.length ? Math.round((recorded.length / (assessmentsRows.length * rows.length)) * 100) : 0 }, distribution, insights, observations, scale, selected: { course, subject, period, academicYearId: valid.academicYearId }, reportCards };
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
  await db.insert(assessments).values({ schoolId: actor.schoolId, ...input, description: input.description ?? null, status: input.status ?? "DRAFT", teacherId: actor.userId });
  const assessment = (await db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.courseId, input.courseId), eq(assessments.subjectId, input.subjectId), eq(assessments.academicPeriodId, input.academicPeriodId), eq(assessments.title, input.title))).orderBy(desc(assessments.id)).limit(1))[0];
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
  if (assessment.status === "CLOSED" && !MANAGEMENT_ROLES.includes(actor.roleKey)) throw new Error("La evaluación está cerrada.");
  if (actor.roleKey === "TEACHER") await assertContext(actor, { courseId: assessment.courseId, subjectId: assessment.subjectId, academicPeriodId: assessment.academicPeriodId });
  if (input.weight !== undefined && (input.weight < 0 || input.weight > 100 || isNaN(input.weight))) {
    throw new Error("El peso de la evaluación debe estar entre 0 y 100.");
  }
  if (input.title !== undefined && (!input.title.trim() || input.title.trim().length < 3)) {
    throw new Error("El título de la evaluación debe tener al menos 3 caracteres.");
  }
  await db.update(assessments).set({ title: input.title ? input.title.trim() : assessment.title, description: input.description !== undefined ? input.description : assessment.description, weight: input.weight !== undefined ? input.weight : assessment.weight, date: input.date !== undefined ? input.date : assessment.date, status: input.status !== undefined ? input.status : assessment.status }).where(eq(assessments.id, input.id));
  await writeAcademicAudit(actor, input.status === "PUBLISHED" ? "assessment_published" : input.status === "CLOSED" ? "assessment_closed" : "assessment_updated", "assessment", String(input.id));
  return (await db.select().from(assessments).where(eq(assessments.id, input.id)).limit(1))[0];
}

export async function saveGradeCenterGrades(actor: GradeCenterActor, input: { assessmentId: number; grades: Array<{ studentId: number; value: number | null; comment?: string }> }) {
  const db = await getDb();
  if (!db) return null;
  const assessment = (await db.select().from(assessments).where(and(eq(assessments.id, input.assessmentId), eq(assessments.schoolId, actor.schoolId))).limit(1))[0];
  if (!assessment) throw new Error("Evaluación no encontrada.");
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
  const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0];
  const enrollments = await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.courseId, input.courseId), eq(studentEnrollments.academicYearId, input.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  if (!course || course.academicYearId !== input.academicYearId) throw new Error("Curso inválido para generar boletines.");
  const subjectLinks = await db.select().from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, input.courseId), eq(courseSubjects.status, "ACTIVE")));
  const generated = [];
  for (const enrollment of enrollments) {
    const subjectsData = [];
    for (const link of subjectLinks) {
      const subjectAssessments = await db.select().from(assessments).where(and(eq(assessments.schoolId, actor.schoolId), eq(assessments.academicYearId, input.academicYearId), eq(assessments.academicPeriodId, input.academicPeriodId), eq(assessments.courseId, input.courseId), eq(assessments.subjectId, link.subjectId)));
      const subjectGrades = subjectAssessments.length ? await db.select().from(assessmentGrades).where(and(eq(assessmentGrades.schoolId, actor.schoolId), eq(assessmentGrades.studentId, enrollment.studentUserId), inArray(assessmentGrades.assessmentId, subjectAssessments.map(item => item.id)))) : [];
      subjectsData.push({ subjectId: link.subjectId, average: weightedAverage(subjectAssessments.map(assessment => ({ value: subjectGrades.find(grade => grade.assessmentId === assessment.id)?.value ?? null, maxValue: assessment.maxValue, weight: assessment.weight }))) });
    }
    const payload = JSON.stringify({ schoolId: actor.schoolId, studentId: enrollment.studentUserId, courseId: input.courseId, academicYearId: input.academicYearId, academicPeriodId: input.academicPeriodId, subjects: subjectsData });
    await db.insert(reportCardRuns).values({ schoolId: actor.schoolId, academicYearId: input.academicYearId, academicPeriodId: input.academicPeriodId, courseId: input.courseId, studentId: enrollment.studentUserId, status: "COMPLETED", createdByUserId: actor.userId, dataJson: payload });
    generated.push(enrollment.studentUserId);
  }
  await writeAcademicAudit(actor, "report_cards_generated", "report_card_run", `${input.courseId}:${generated.length}`);
  return { status: "COMPLETED", generated: generated.length, total: enrollments.length };
}

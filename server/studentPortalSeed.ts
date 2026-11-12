import { and, eq, inArray } from "drizzle-orm";
import {
  academicPeriods,
  academicYears,
  announcements,
  assessmentGrades,
  assessments,
  assignments,
  courseSubjects,
  courses,
  events,
  grades,
  reportCardRuns,
  schoolMemberships,
  studentEnrollments,
  subjects,
  submissions,
  teacherAssignments,
  teacherProfiles,
  teachers,
  users,
} from "../drizzle/schema";
import { ensureEduCoreSeeded, getDb } from "./db";
import { DEMO_COURSES, DEMO_STUDENTS, DEMO_SUBJECT, type DemoStudent, demoStudentName } from "./demoSeed";
import { ensureGradeCenterSeeded, ensureGradeScale, freezeReportCards } from "./gradeCenterDb";
import {
  BIOLOGY_HISTORY,
  HISTORY_WEIGHTS,
  PORTAL_ANNOUNCEMENT,
  PORTAL_EVENTS,
  PORTAL_SUBJECTS,
  type PortalAssessmentType,
  type PortalResult,
  currentResult,
  currentSubmissionDaysAgo,
  historyGrades,
} from "./studentDemoSeed";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type PeriodRow = typeof academicPeriods.$inferSelect;

const DAY_MS = 86_400_000;
/** Marcadores del seed: si existen, el dataset del estudiante ya está completo. */
const MARKER_SUBJECT = "Ciencias Sociales";
const MARKER_EVENT = PORTAL_EVENTS[0].title;

const daysFromNow = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const isClosed = (status: string) => status === "Cerrado" || status === "CLOSED";
const isActive = (status: string) => status === "Activo" || status === "ACTIVE";
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Definitiva ponderada solo con las notas registradas (regla del Grade Center); `null` sin notas. */
function weightedDefinitive(values: Array<{ value: number | null; weight: number }>) {
  const recorded = values.filter((item): item is { value: number; weight: number } => item.value !== null);
  const weight = recorded.reduce((sum, item) => sum + item.weight, 0);
  return weight ? round1(recorded.reduce((sum, item) => sum + item.value * item.weight, 0) / weight) : null;
}

const fileSlug = (title: string) =>
  title.split(":")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** ¿Ya está sembrado el dataset del portal estudiante? Tres consultas baratas. */
async function isSeeded(db: Db, schoolId: number) {
  const marker = (await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, MARKER_SUBJECT))).limit(1))[0];
  if (!marker) return false;
  const [assessment, event] = await Promise.all([
    db.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.schoolId, schoolId), eq(assessments.subjectId, marker.id))).limit(1),
    db.select({ id: events.id }).from(events).where(and(eq(events.schoolId, schoolId), eq(events.title, MARKER_EVENT))).limit(1),
  ]);
  return assessment.length > 0 && event.length > 0;
}

/**
 * Completa el colegio demo con el plan de estudios de 11° (6 materias), el historial de los
 * periodos cerrados con sus boletines y las actividades del periodo activo. Idempotente por bloque.
 */
export async function ensureStudentPortalSeeded(schoolId: number) {
  const db = await getDb();
  if (!db) return;
  if (await isSeeded(db, schoolId)) return;
  await ensureEduCoreSeeded();
  await ensureGradeCenterSeeded(schoolId);
  await ensureGradeScale(schoolId);

  const year = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.year, 2026))).limit(1))[0];
  if (!year) return;
  const periodRows = await db.select().from(academicPeriods).where(and(eq(academicPeriods.schoolId, schoolId), eq(academicPeriods.academicYearId, year.id))).orderBy(academicPeriods.orderIndex);
  const closedPeriods = periodRows.filter(row => isClosed(row.status)).slice(0, BIOLOGY_HISTORY.length);
  const activePeriod = periodRows.find(row => isActive(row.status));
  const courseRows = await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), inArray(courses.name, DEMO_COURSES.map(course => course.name))));

  const teacherIds = await ensureTeachers(db, schoolId);
  const subjectIds = await ensureSubjects(db, schoolId, year.id, courseRows, teacherIds);
  const biology = (await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, DEMO_SUBJECT.name))).limit(1))[0];

  for (const course of courseRows) {
    const enrollments = await db
      .select({ id: studentEnrollments.id, studentUserId: studentEnrollments.studentUserId, openId: users.openId })
      .from(studentEnrollments)
      .innerJoin(users, eq(users.id, studentEnrollments.studentUserId))
      .where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.courseId, course.id), eq(studentEnrollments.academicYearId, year.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
    const roster = enrollments
      .map(enrollment => ({ enrollment, student: DEMO_STUDENTS.find(student => student.openId === enrollment.openId) }))
      .filter((row): row is { enrollment: (typeof enrollments)[number]; student: DemoStudent } => Boolean(row.student));
    if (!roster.length) continue;
    const scope = { schoolId, yearId: year.id, courseId: course.id, roster };

    // Historial: las 5 materias nuevas y Biología en cada periodo cerrado
    for (const [periodIndex, period] of closedPeriods.entries()) {
      for (const subject of PORTAL_SUBJECTS) {
        const subjectId = subjectIds.get(subject.key);
        const teacherId = teacherIds.get(subject.teacher.openId);
        if (subjectId && teacherId) await seedHistoryBlock(db, scope, period, periodIndex, subjectId, teacherId, subject.key, subject.history[periodIndex]);
      }
      if (biology) {
        const biologyTeacher = (await db.select({ id: teacherAssignments.teacherUserId }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.subjectId, biology.id), eq(teacherAssignments.status, "ACTIVE"))).limit(1))[0];
        if (biologyTeacher) await seedHistoryBlock(db, scope, period, periodIndex, biology.id, biologyTeacher.id, "BIO", BIOLOGY_HISTORY[periodIndex]);
      }
    }

    // Periodo activo: evaluaciones que también son actividades del aula
    if (activePeriod) {
      for (const subject of PORTAL_SUBJECTS) {
        const subjectId = subjectIds.get(subject.key);
        const teacherId = teacherIds.get(subject.teacher.openId);
        if (subjectId && teacherId) await seedCurrentBlock(db, scope, course.name, activePeriod, subjectId, teacherId, subject);
      }
    }

    // Boletines oficiales de los periodos cerrados, generados tres días después del cierre
    const admin = (await db.select({ id: users.id }).from(users).where(eq(users.openId, "educore-demo-admin")).limit(1))[0];
    for (const period of closedPeriods) {
      const existing = await db.select({ id: reportCardRuns.id }).from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, schoolId), eq(reportCardRuns.courseId, course.id), eq(reportCardRuns.academicPeriodId, period.id))).limit(1);
      if (existing.length) continue;
      const generatedAt = new Date(new Date(period.endDate).getTime() + 3 * DAY_MS);
      await freezeReportCards(schoolId, { courseId: course.id, academicYearId: year.id, academicPeriodId: period.id }, admin?.id ?? 0, generatedAt);
    }
  }

  await seedLegacyGrades(db, schoolId, closedPeriods, activePeriod);
  await seedEventsAndAnnouncement(db, schoolId);
}

/** Docentes de las materias nuevas: usuario, membresía, perfil y registro legacy. */
async function ensureTeachers(db: Db, schoolId: number) {
  const ids = new Map<string, number>();
  const uniqueTeachers = Array.from(new Map(PORTAL_SUBJECTS.map(subject => [subject.teacher.openId, subject.teacher])).values());
  for (const teacher of uniqueTeachers) {
    const name = `${teacher.firstName} ${teacher.lastName}`;
    let user = (await db.select().from(users).where(eq(users.openId, teacher.openId)).limit(1))[0];
    if (!user) {
      await db.insert(users).values({ openId: teacher.openId, schoolId, name, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, loginMethod: "demo", role: "user", status: "ACTIVE" });
      user = (await db.select().from(users).where(eq(users.openId, teacher.openId)).limit(1))[0];
    }
    if (!user) continue;
    ids.set(teacher.openId, user.id);
    const membership = (await db.select({ id: schoolMemberships.id }).from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, user.id))).limit(1))[0];
    if (!membership) await db.insert(schoolMemberships).values({ schoolId, userId: user.id, roleKey: "TEACHER", status: "ACTIVE" });
    const profile = (await db.select({ id: teacherProfiles.id }).from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, user.id))).limit(1))[0];
    if (!profile) await db.insert(teacherProfiles).values({ schoolId, userId: user.id, employeeCode: `DOC-${user.id}`, specialties: teacher.specialty, subjects: teacher.specialty });
    const legacy = (await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.schoolId, schoolId), eq(teachers.name, name))).limit(1))[0];
    if (!legacy) await db.insert(teachers).values({ schoolId, name, email: teacher.email, subjectFocus: teacher.specialty });
  }
  return ids;
}

/** Materias nuevas, su vínculo con 11-1 y 11-2 y la asignación de su docente. */
async function ensureSubjects(db: Db, schoolId: number, yearId: number, courseRows: Array<typeof courses.$inferSelect>, teacherIds: Map<string, number>) {
  const ids = new Map<string, number>();
  for (const subject of PORTAL_SUBJECTS) {
    const teacherName = `${subject.teacher.firstName} ${subject.teacher.lastName}`;
    let row = (await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, subject.name))).limit(1))[0];
    if (!row) {
      await db.insert(subjects).values({ schoolId, name: subject.name, shortName: subject.code, code: subject.code, description: subject.description, status: "ACTIVE", course: DEMO_COURSES.map(course => course.name).join(", "), teacherName });
      row = (await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, subject.name))).limit(1))[0];
    }
    if (!row) continue;
    ids.set(subject.key, row.id);
    const teacherId = teacherIds.get(subject.teacher.openId);
    for (const course of courseRows) {
      const link = await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, course.id), eq(courseSubjects.subjectId, row.id))).limit(1);
      if (!link.length) await db.insert(courseSubjects).values({ schoolId, courseId: course.id, subjectId: row.id, status: "ACTIVE" });
      if (!teacherId) continue;
      const assigned = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, teacherId), eq(teacherAssignments.courseId, course.id), eq(teacherAssignments.subjectId, row.id), eq(teacherAssignments.academicYearId, yearId))).limit(1);
      if (!assigned.length) await db.insert(teacherAssignments).values({ schoolId, teacherUserId: teacherId, courseId: course.id, subjectId: row.id, academicYearId: yearId, isPrimary: 1, status: "ACTIVE" });
    }
  }
  return ids;
}

type BlockScope = {
  schoolId: number;
  yearId: number;
  courseId: number;
  roster: Array<{ enrollment: { id: number; studentUserId: number }; student: DemoStudent }>;
};

async function hasAssessments(db: Db, scope: BlockScope, periodId: number, subjectId: number) {
  const rows = await db.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.schoolId, scope.schoolId), eq(assessments.courseId, scope.courseId), eq(assessments.subjectId, subjectId), eq(assessments.academicPeriodId, periodId))).limit(1);
  return rows.length > 0;
}

/** Tres evaluaciones cerradas con nota para todo el curso, repartidas dentro del periodo. */
async function seedHistoryBlock(
  db: Db,
  scope: BlockScope,
  period: PeriodRow,
  periodIndex: number,
  subjectId: number,
  teacherId: number,
  subjectKey: Parameters<typeof historyGrades>[1],
  titles: [string, PortalAssessmentType][],
) {
  if (await hasAssessments(db, scope, period.id, subjectId)) return;
  const start = new Date(period.startDate).getTime();
  const length = new Date(period.endDate).getTime() - start;
  for (const [index, [title, type]] of titles.entries()) {
    const date = new Date(start + length * [0.25, 0.55, 0.85][index]);
    date.setHours(9, 0, 0, 0);
    const inserted = await db.insert(assessments).values({ schoolId: scope.schoolId, academicYearId: scope.yearId, academicPeriodId: period.id, courseId: scope.courseId, subjectId, teacherId, title, description: null, assessmentType: type, date, maxValue: 5, weight: HISTORY_WEIGHTS[index], status: "CLOSED" }).$returningId();
    const assessmentId = inserted[0]?.id;
    if (!assessmentId) continue;
    await db.insert(assessmentGrades).values(scope.roster.map(({ enrollment, student }) => ({
      schoolId: scope.schoolId,
      assessmentId,
      studentId: enrollment.studentUserId,
      studentEnrollmentId: enrollment.id,
      courseId: scope.courseId,
      subjectId,
      academicYearId: scope.yearId,
      academicPeriodId: period.id,
      value: historyGrades(student, subjectKey, periodIndex)[index],
      comment: null,
      status: "RECORDED",
    })));
  }
}

/** Evaluaciones del periodo activo + sus actividades y entregas en el aula. */
async function seedCurrentBlock(db: Db, scope: BlockScope, courseName: string, period: PeriodRow, subjectId: number, teacherId: number, subject: (typeof PORTAL_SUBJECTS)[number]) {
  if (await hasAssessments(db, scope, period.id, subjectId)) return;
  const teacherName = `${subject.teacher.firstName} ${subject.teacher.lastName}`;
  for (const [index, activity] of subject.current.entries()) {
    const dueAt = daysFromNow(activity.dueInDays, 23);
    const results = scope.roster.map(row => ({ ...row, ...currentResult(row.student, subject, index) }));
    const inserted = await db.insert(assessments).values({ schoolId: scope.schoolId, academicYearId: scope.yearId, academicPeriodId: period.id, courseId: scope.courseId, subjectId, teacherId, title: activity.title, description: activity.description, assessmentType: activity.type, date: dueAt, maxValue: 5, weight: activity.weight, status: "PUBLISHED" }).$returningId();
    const assessmentId = inserted[0]?.id;
    if (assessmentId) {
      await db.insert(assessmentGrades).values(results.map(({ enrollment, result, feedback }) => {
        const value = typeof result === "number" ? result : null;
        return { schoolId: scope.schoolId, assessmentId, studentId: enrollment.studentUserId, studentEnrollmentId: enrollment.id, courseId: scope.courseId, subjectId, academicYearId: scope.yearId, academicPeriodId: period.id, value, comment: value === null ? null : feedback, status: value === null ? "PENDING" : "RECORDED" };
      }));
    }

    // La misma actividad en el aula: abierta hasta un día después de vencer
    const status = activity.dueInDays <= -2 ? "Cerrada" : "Publicado";
    const existingTask = (await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.schoolId, scope.schoolId), eq(assignments.course, courseName), eq(assignments.title, activity.title))).limit(1))[0];
    let taskId = existingTask?.id;
    if (!taskId) {
      const task = await db.insert(assignments).values({ schoolId: scope.schoolId, title: activity.title, subject: subject.name, course: courseName, teacherName, description: activity.description, dueAt, points: 100, status }).$returningId();
      taskId = task[0]?.id;
    }
    if (!taskId) continue;
    const submitted = results.filter((row): row is typeof row & { result: Exclude<PortalResult, null> } => row.result !== null);
    if (!submitted.length) continue;
    await db.insert(submissions).values(submitted.map(({ student, result, feedback }) => {
      const daysAgo = currentSubmissionDaysAgo(student, activity);
      const graded = typeof result === "number";
      return {
        schoolId: scope.schoolId,
        assignmentId: taskId!,
        studentName: demoStudentName(student),
        submittedAt: daysFromNow(-daysAgo, daysAgo === 0 ? 7 : 18),
        status: graded ? "Calificada" : "Entregada",
        fileName: `${fileSlug(activity.title)}-${student.code.toLowerCase()}.pdf`,
        fileUrl: null,
        comment: graded ? feedback : null,
        grade: graded ? result : null,
      };
    }));
  }
}

/** Definitivas en la tabla legacy `grades`, que leen el snapshot y las vistas del acudiente. */
async function seedLegacyGrades(db: Db, schoolId: number, closedPeriods: PeriodRow[], activePeriod: PeriodRow | undefined) {
  const existing = await db.select({ studentName: grades.studentName, subject: grades.subject, period: grades.period }).from(grades).where(eq(grades.schoolId, schoolId));
  const seen = new Set(existing.map(row => `${row.studentName}|${row.subject}|${row.period}`));
  const rows: Array<typeof grades.$inferInsert> = [];
  const push = (student: DemoStudent, subject: string, period: string, value: number | null) => {
    const key = `${demoStudentName(student)}|${subject}|${period}`;
    if (value === null || seen.has(key)) return;
    seen.add(key);
    rows.push({ schoolId, studentName: demoStudentName(student), course: student.course, subject, period, value });
  };
  for (const student of DEMO_STUDENTS) {
    for (const [periodIndex, period] of closedPeriods.entries()) {
      for (const subject of PORTAL_SUBJECTS) {
        push(student, subject.name, period.name, weightedDefinitive(historyGrades(student, subject.key, periodIndex).map((value, index) => ({ value, weight: HISTORY_WEIGHTS[index] }))));
      }
      push(student, DEMO_SUBJECT.name, period.name, weightedDefinitive(historyGrades(student, "BIO", periodIndex).map((value, index) => ({ value, weight: HISTORY_WEIGHTS[index] }))));
    }
    if (!activePeriod) continue;
    for (const subject of PORTAL_SUBJECTS) {
      const values = subject.current.map((activity, index) => {
        const { result } = currentResult(student, subject, index);
        return { value: typeof result === "number" ? result : null, weight: activity.weight };
      });
      push(student, subject.name, activePeriod.name, weightedDefinitive(values));
    }
  }
  if (rows.length) await db.insert(grades).values(rows);
}

async function seedEventsAndAnnouncement(db: Db, schoolId: number) {
  for (const event of PORTAL_EVENTS) {
    const exists = await db.select({ id: events.id }).from(events).where(and(eq(events.schoolId, schoolId), eq(events.title, event.title))).limit(1);
    if (!exists.length) await db.insert(events).values({ schoolId, title: event.title, type: event.type, eventDate: daysFromNow(event.inDays, event.hour), location: event.location, audience: event.audience });
  }
  const announced = await db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.schoolId, schoolId), eq(announcements.title, PORTAL_ANNOUNCEMENT.title))).limit(1);
  if (!announced.length) {
    await db.insert(announcements).values({ schoolId, title: PORTAL_ANNOUNCEMENT.title, message: PORTAL_ANNOUNCEMENT.message, audience: PORTAL_ANNOUNCEMENT.audience, status: PORTAL_ANNOUNCEMENT.status, publishedAt: daysFromNow(-PORTAL_ANNOUNCEMENT.daysAgo, 7) });
  }
}

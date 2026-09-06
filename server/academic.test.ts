import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  academicYears,
  courseSubjects,
  courses,
  enrollmentHistory,
  gradeLevels,
  studentEnrollments,
  subjects,
  teacherAssignments,
} from "../drizzle/schema";
import {
  assignAcademicTeacher,
  attachSubjectToCourse,
  createAcademicCourse,
  createAcademicGrade,
  createAcademicSubject,
  createAcademicYear,
  enrollAcademicStudent,
  ensureEduCoreSeeded,
  getAcademicSnapshot,
  getDb,
  getDemoIdentityContext,
  transferAcademicStudent,
} from "./db";
import { hasPermission } from "./identityModel";

const schoolId = 1;
let admin: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let teacher: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let student: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let guardian: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let yearId = 0;
let gradeId = 0;
let courseId = 0;
let secondCourseId = 0;
let subjectId = 0;
let enrollmentId = 0;
const suffix = Date.now();
const courseCode = `QA-${suffix}`;
const secondCourseCode = `QB-${suffix}`;
const subjectCode = `QS-${suffix}`;
const yearValue = 2027;

beforeAll(async () => {
  await ensureEduCoreSeeded();
  admin = await getDemoIdentityContext("admin", schoolId);
  teacher = await getDemoIdentityContext("teacher", schoolId);
  student = await getDemoIdentityContext("student", schoolId);
  guardian = await getDemoIdentityContext("guardian", schoolId);
  if (!admin || !teacher || !student || !guardian) throw new Error("Las identidades demo académicas no están disponibles.");
  const year = await createAcademicYear({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" }, { name: `QA ${yearValue}`, year: yearValue, startDate: new Date(`${yearValue}-01-12T00:00:00Z`), endDate: new Date(`${yearValue}-11-27T23:59:59Z`), status: "DRAFT" });
  yearId = year?.id ?? 0;
  const grade = await createAcademicGrade({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" }, { name: `Grado QA ${suffix}`, shortName: `Q${suffix}`.slice(-19), levelOrder: 20 });
  gradeId = grade?.id ?? 0;
  const course = await createAcademicCourse({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" }, { academicYearId: yearId, gradeLevelId: gradeId, name: `QA-${suffix}`, code: courseCode, capacity: 35 });
  courseId = course?.id ?? 0;
  const secondCourse = await createAcademicCourse({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" }, { academicYearId: yearId, gradeLevelId: gradeId, name: `QB-${suffix}`, code: secondCourseCode, capacity: 35 });
  secondCourseId = secondCourse?.id ?? 0;
  const subject = await createAcademicSubject({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" }, { name: `Materia QA ${suffix}`, shortName: "QA", code: subjectCode, description: "Materia creada para validar Fase 4." });
  subjectId = subject?.id ?? 0;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (enrollmentId) await db.delete(enrollmentHistory).where(eq(enrollmentHistory.enrollmentId, enrollmentId));
  if (courseId || secondCourseId) {
    const courseIds = [courseId, secondCourseId].filter(Boolean);
    for (const id of courseIds) {
      await db.delete(studentEnrollments).where(eq(studentEnrollments.courseId, id));
      await db.delete(teacherAssignments).where(eq(teacherAssignments.courseId, id));
      await db.delete(courseSubjects).where(eq(courseSubjects.courseId, id));
      await db.delete(courses).where(eq(courses.id, id));
    }
  }
  if (subjectId) {
    await db.delete(courseSubjects).where(eq(courseSubjects.subjectId, subjectId));
    await db.delete(subjects).where(eq(subjects.id, subjectId));
  }
  if (gradeId) await db.delete(gradeLevels).where(eq(gradeLevels.id, gradeId));
  if (yearId) {
    await db.delete(academicYears).where(eq(academicYears.id, yearId));
  }
});

describe("EduCore academic architecture", () => {
  it("creates an academic year with school isolation", () => expect(yearId).toBeGreaterThan(0));
  it("creates a grade level in the same institution", () => expect(gradeId).toBeGreaterThan(0));
  it("creates a course linked to year and grade", async () => {
    const snapshot = await getAcademicSnapshot({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" });
    const course = snapshot?.courses.find(item => item.id === courseId);
    expect(course?.academicYearId).toBe(yearId);
    expect(course?.gradeLevelId).toBe(gradeId);
  });
  it("creates a subject with a unique institutional code", () => expect(subjectId).toBeGreaterThan(0));
  it("associates a subject to a course", async () => {
    const result = await attachSubjectToCourse({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { courseId, subjectId });
    expect(result.alreadyExists).toBe(false);
  });
  it("prevents duplicate subject association", async () => {
    const result = await attachSubjectToCourse({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { courseId, subjectId });
    expect(result.alreadyExists).toBe(true);
  });
  it("assigns a real teacher only to an existing course subject", async () => {
    const result = await assignAcademicTeacher({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { teacherUserId: teacher!.user.id, courseId, subjectId, academicYearId: yearId, isPrimary: true });
    expect(result?.teacherUserId).toBe(teacher!.user.id);
  });
  it("rejects teacher assignment across school contexts", async () => {
    await expect(assignAcademicTeacher({ schoolId: 999999, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { teacherUserId: teacher!.user.id, courseId, subjectId, academicYearId: yearId, isPrimary: false })).rejects.toThrow();
  });
  it("enrolls a student into a valid course and year", async () => {
    const result = await enrollAcademicStudent({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { studentUserId: student!.user.id, academicYearId: yearId, courseId });
    enrollmentId = result?.id ?? 0;
    expect(result?.enrollmentStatus).toBe("ACTIVE");
  });
  it("rejects a duplicate active enrollment in the same year", async () => {
    await expect(enrollAcademicStudent({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { studentUserId: student!.user.id, academicYearId: yearId, courseId })).rejects.toThrow("matrícula activa");
  });
  it("changes course without deleting enrollment history", async () => {
    const result = await transferAcademicStudent({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { enrollmentId, newCourseId: secondCourseId, reason: "Prueba de cambio académico" });
    expect(result?.newCourseId).toBe(secondCourseId);
    const db = await getDb();
    const history = db ? await db.select().from(enrollmentHistory).where(and(eq(enrollmentHistory.enrollmentId, enrollmentId), eq(enrollmentHistory.schoolId, schoolId))) : [];
    expect(history.length).toBe(1);
  });
  it("returns admin courses, subjects, teachers and enrollments", async () => {
    const snapshot = await getAcademicSnapshot({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" });
    expect(snapshot?.courses.length).toBeGreaterThanOrEqual(10);
    expect(snapshot?.subjects.length).toBeGreaterThan(0);
    expect(snapshot?.teacherAssignments.length).toBeGreaterThan(0);
    expect(snapshot?.studentEnrollments.length).toBeGreaterThan(0);
  });
  it("scopes teacher view to assigned courses", async () => {
    const snapshot = await getAcademicSnapshot({ schoolId, userId: teacher!.user.id, roleKey: "TEACHER" });
    expect(snapshot?.courses.some(course => course.id === courseId)).toBe(true);
    expect(snapshot?.courses.every(course => snapshot.teacherAssignments.some(assignment => assignment.courseId === course.id))).toBe(true);
  });
  it("scopes student view to the student's own enrollment", async () => {
    const snapshot = await getAcademicSnapshot({ schoolId, userId: student!.user.id, roleKey: "STUDENT" });
    expect(snapshot?.studentEnrollments.every(item => item.studentUserId === student!.user.id)).toBe(true);
    expect(snapshot?.courses.some(course => course.id === secondCourseId)).toBe(true);
  });
  it("scopes guardian view to linked students only", async () => {
    const snapshot = await getAcademicSnapshot({ schoolId, userId: guardian!.user.id, roleKey: "GUARDIAN" });
    expect(snapshot?.students.length).toBeGreaterThan(0);
    expect(snapshot?.studentEnrollments.every(item => snapshot.students.some(studentRow => studentRow.userId === item.studentUserId))).toBe(true);
  });
  it("blocks course creation with a foreign academic year", async () => {
    await expect(createAcademicCourse({ schoolId, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" }, { academicYearId: 999999, gradeLevelId: gradeId, name: "Foreign", code: `FOREIGN-${suffix}`, capacity: 20 })).rejects.toThrow("no pertenece");
  });
  it("keeps academic management permissions limited to administrators", () => {
    expect(hasPermission("SCHOOL_ADMIN", "courses.create")).toBe(true);
    expect(hasPermission("TEACHER", "courses.create")).toBe(false);
    expect(hasPermission("STUDENT", "courses.update")).toBe(false);
  });
  it("keeps guardian and student reads separated from management", () => {
    expect(hasPermission("GUARDIAN", "courses.view")).toBe(false);
    expect(hasPermission("GUARDIAN", "students.view")).toBe(true);
    expect(hasPermission("STUDENT", "courses.view")).toBe(true);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { assessmentGrades, assessments } from "../drizzle/schema";
import { appRouter } from "./routers";
import { createGradeCenterAssessment, ensureGradeCenterSeeded, getGradeCenterContext, saveGradeCenterGrades, type GradeCenterActor } from "./gradeCenterDb";
import { getDb, getDemoIdentityContext } from "./db";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let admin: Demo;
let teacher: Demo;
let student: Demo;
let guardian: Demo;
let seededContext: Awaited<ReturnType<typeof getGradeCenterContext>>;
let createdAssessmentId: number | null = null;

const caller = (user: any) => appRouter.createCaller({ req: {} as any, res: {} as any, user });
const actor = (demo: Demo, roleKey: GradeCenterActor["roleKey"]): GradeCenterActor => ({ schoolId, userId: demo!.user.id, roleKey });

beforeAll(async () => {
  await ensureGradeCenterSeeded(schoolId);
  admin = await getDemoIdentityContext("admin", schoolId);
  teacher = await getDemoIdentityContext("teacher", schoolId);
  student = await getDemoIdentityContext("student", schoolId);
  guardian = await getDemoIdentityContext("guardian", schoolId);
  if (!admin || !teacher || !student || !guardian) throw new Error("Demo actors missing");
  seededContext = await getGradeCenterContext({ schoolId, userId: admin.user.id, roleKey: "SCHOOL_ADMIN" });
});

afterAll(async () => {
  const db = await getDb();
  if (!db || !createdAssessmentId) return;
  await db.delete(assessmentGrades).where(eq(assessmentGrades.assessmentId, createdAssessmentId));
  await db.delete(assessments).where(eq(assessments.id, createdAssessmentId));
});

describe("EduCore Grade Center", () => {
  it("loads the real demo context for 11-2 Mathematics", () => {
    expect(seededContext?.selected?.course?.name).toBe("11-2");
    expect(seededContext?.selected?.subject?.name).toBe("Matemáticas");
    expect(seededContext?.assessments.length).toBeGreaterThanOrEqual(4);
  });

  it("creates an assessment with valid academic context", async () => {
    const selected = seededContext!.selected!;
    const result = await createGradeCenterAssessment(actor(teacher, "TEACHER"), { academicYearId: selected.academicYearId, academicPeriodId: selected.period.id, courseId: selected.course.id, subjectId: selected.subject.id, title: `Prueba Grade Center ${Date.now()}`, description: "Prueba automatizada", assessmentType: "QUIZ", date: new Date(), maxValue: 5, weight: 10, status: "DRAFT" });
    createdAssessmentId = result!.id;
    expect(result?.status).toBe("DRAFT");
  });

  it("updates and publishes an assessment", async () => {
    expect(createdAssessmentId).toBeTruthy();
    const result = await caller(teacher!.user).gradeCenter.updateAssessment({ role: "teacher", id: createdAssessmentId!, status: "PUBLISHED", weight: 15 });
    expect(result?.status).toBe("PUBLISHED");
    expect(result?.weight).toBe(15);
  });

  it("creates pending grade rows only for enrolled students", async () => {
    const rows = seededContext!.rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.values.length >= 4)).toBe(true);
    expect(rows.every(row => row.enrollment.courseId === seededContext!.selected!.course.id)).toBe(true);
  });

  it("rejects a grade outside the institutional scale", async () => {
    const assessment = seededContext!.assessments[0];
    await expect(saveGradeCenterGrades(actor(admin, "SCHOOL_ADMIN"), { assessmentId: assessment.id, grades: [{ studentId: student!.user.id, value: 5.1 }] })).rejects.toThrow(/entre 0 y 5/);
  });

  it("calculates weighted averages from the real demo grades", () => {
    const first = seededContext!.rows[0];
    expect(first.average).toBeGreaterThan(0);
    expect(first.average).toBeLessThanOrEqual(5);
    expect(seededContext!.stats.average).toBeCloseTo(3.85, 1);
  });

  it("allows an assigned teacher to read the authorized context", async () => {
    const result = await getGradeCenterContext(actor(teacher, "TEACHER"));
    expect(result?.selected?.course?.name).toBe("11-2");
    expect(result?.selected?.subject?.name).toBe("Matemáticas");
    expect(result?.assessments.length).toBeGreaterThanOrEqual(4);
  });

  it("blocks a teacher from creating grades for an unassigned subject", async () => {
    const assessment = seededContext!.assessments[0];
    await expect(saveGradeCenterGrades(actor(teacher, "TEACHER"), { assessmentId: assessment.id, grades: [{ studentId: student!.user.id, value: 4 }] })).resolves.toMatchObject({ saved: 1 });
    const physics = seededContext!.subjects.find(subject => subject.name === "Física");
    if (!physics) return;
    const selected = seededContext!.selected!;
    await expect(createGradeCenterAssessment(actor(teacher, "TEACHER"), { academicYearId: selected.academicYearId, academicPeriodId: selected.period.id, courseId: selected.course.id, subjectId: physics.id, title: `No autorizada ${Date.now()}`, assessmentType: "QUIZ", date: new Date(), maxValue: 5, weight: 5 })).rejects.toThrow(/asignación docente/);
  });

  it("blocks students from modifying grades", async () => {
    const assessment = seededContext!.assessments[0];
    await expect(caller(student!.user).gradeCenter.saveGrades({ role: "student", assessmentId: assessment.id, grades: [{ studentId: student!.user.id, value: 4 }] })).rejects.toThrow(/permisos/);
  });

  it("blocks guardians from modifying grades", async () => {
    const assessment = seededContext!.assessments[0];
    await expect(caller(guardian!.user).gradeCenter.saveGrades({ role: "guardian", assessmentId: assessment.id, grades: [{ studentId: student!.user.id, value: 4 }] })).rejects.toThrow(/permisos/);
  });

  it("blocks a non-enrolled student even for an authorized admin request", async () => {
    const assessment = seededContext!.assessments[0];
    await expect(saveGradeCenterGrades(actor(admin, "SCHOOL_ADMIN"), { assessmentId: assessment.id, grades: [{ studentId: 999999, value: 4 }] })).rejects.toThrow(/matriculados/);
  });

  it("keeps student visibility limited to the student's own row", async () => {
    const result = await getGradeCenterContext(actor(student, "STUDENT"));
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0].enrollment.studentUserId).toBe(student!.user.id);
  });

  it("rejects student course ID tampering instead of falling back to a visible course", async () => {
    const otherCourse = seededContext!.courses.find(course => course.id !== seededContext!.selected!.course.id);
    if (!otherCourse) return;
    await expect(getGradeCenterContext(actor(student, "STUDENT"), { courseId: otherCourse.id })).rejects.toThrow(/permiso/);
  });

  it("keeps guardian visibility limited to linked students", async () => {
    const result = await getGradeCenterContext(actor(guardian, "GUARDIAN"));
    const linked = await caller(guardian!.user).identity.relationships({ role: "guardian" });
    const linkedIds = new Set(linked.map((item: any) => item.id));
    expect(result?.rows.every(row => linkedIds.has(row.enrollment.studentUserId))).toBe(true);
  });

  it("isolates another school from the Grade Center", async () => {
    const result = await getGradeCenterContext({ schoolId: 999999, userId: admin!.user.id, roleKey: "SCHOOL_ADMIN" });
    expect(result?.courses).toHaveLength(0);
    expect(result?.rows).toHaveLength(0);
  });

  it("exposes real distribution and neutral insights", () => {
    expect(seededContext!.distribution.reduce((sum, item) => sum + item.count, 0)).toBe(seededContext!.stats.graded);
    expect(seededContext!.insights.every(item => !item.toLowerCase().includes("problemático"))).toBe(true);
  });

  it("rejects editing grades from a closed academic period", async () => {
    const selected = seededContext!.selected!;
    const period1 = seededContext!.periods.find(period => period.orderIndex === 1);
    if (!period1) return;
    const assessment = await createGradeCenterAssessment(actor(admin, "SCHOOL_ADMIN"), { academicYearId: selected.academicYearId, academicPeriodId: period1.id, courseId: selected.course.id, subjectId: selected.subject.id, title: `Periodo cerrado ${Date.now()}`, assessmentType: "QUIZ", date: new Date(), maxValue: 5, weight: 5 });
    try {
      await expect(saveGradeCenterGrades(actor(admin, "SCHOOL_ADMIN"), { assessmentId: assessment!.id, grades: [{ studentId: student!.user.id, value: 4 }] })).rejects.toThrow(/cerrado/);
    } finally {
      const db = await getDb();
      if (db && assessment) { await db.delete(assessmentGrades).where(eq(assessmentGrades.assessmentId, assessment.id)); await db.delete(assessments).where(eq(assessments.id, assessment.id)); }
    }
  });
});

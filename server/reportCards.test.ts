import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, gt } from "drizzle-orm";
import { courseSubjects, reportCardRuns } from "../drizzle/schema";
import {
  ensureGradeCenterSeeded,
  generateGradeCenterReportCards,
  getGradeCenterCourseReportCards,
  listGradeCenterAssignments,
  listGradeCenterReportCards,
  type GradeCenterActor,
  type GradeCenterReportCardSummary,
} from "./gradeCenterDb";
import { getDb, getDemoIdentityContext } from "./db";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let admin: Demo;
let teacher: Demo;
let student: Demo;
let course: GradeCenterReportCardSummary;
let lastRunIdBefore = 0;

const actor = (demo: Demo, roleKey: string): GradeCenterActor => ({
  userId: demo!.user.id,
  schoolId,
  roleKey,
  permissions: ["grades.view", "reports.export"],
});

beforeAll(async () => {
  admin = await getDemoIdentityContext("admin");
  teacher = await getDemoIdentityContext("teacher");
  student = await getDemoIdentityContext("student");
  await ensureGradeCenterSeeded(schoolId);
  const { courses } = await listGradeCenterReportCards(actor(teacher, "TEACHER"));
  const withStudents = courses.find(row => row.students > 0);
  if (!withStudents) throw new Error("El seed demo debe tener un curso del docente con estudiantes.");
  course = withStudents;
  const db = await getDb();
  lastRunIdBefore = (await db!.select({ id: reportCardRuns.id }).from(reportCardRuns).orderBy(desc(reportCardRuns.id)).limit(1))[0]?.id ?? 0;
});

afterAll(async () => {
  // Solo las generaciones creadas por estas pruebas
  const db = await getDb();
  await db?.delete(reportCardRuns).where(and(eq(reportCardRuns.schoolId, schoolId), gt(reportCardRuns.id, lastRunIdBefore)));
});

describe("Boletines por estudiante (vista docente)", () => {
  it("entrega el boletín completo con todas las materias activas del curso", async () => {
    const result = await getGradeCenterCourseReportCards(actor(teacher, "TEACHER"), { courseId: course.courseId });
    expect(result).not.toBeNull();
    expect(result!.course.id).toBe(course.courseId);
    expect(result!.period.id).toBe(course.periodId);
    expect(result!.students).toHaveLength(course.students);

    const db = await getDb();
    const links = await db!.select({ subjectId: courseSubjects.subjectId }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, course.courseId), eq(courseSubjects.status, "ACTIVE")));
    const expectedSubjects = new Set(links.map(row => row.subjectId)).size;
    for (const card of result!.students) {
      expect(card.subjects).toHaveLength(expectedSubjects);
      expect(card.name).not.toBe("");
    }
  });

  it("calcula la definitiva con la misma regla que las planillas de Grade Center", async () => {
    const result = await getGradeCenterCourseReportCards(actor(teacher, "TEACHER"), { courseId: course.courseId });
    const planillas = (await listGradeCenterAssignments(actor(teacher, "TEACHER"))).filter(row => row.courseId === course.courseId);
    for (const planilla of planillas) {
      for (const flagged of planilla.belowPassing) {
        const card = result!.students.find(row => row.studentId === flagged.studentId);
        const subject = card?.subjects.find(row => row.subjectId === planilla.subjectId);
        expect(subject?.average).toBe(flagged.average);
      }
    }
    for (const card of result!.students) {
      const averages = card.subjects.map(row => row.average).filter((value): value is number => value !== null);
      if (averages.length === 0) expect(card.average).toBeNull();
      else expect(card.average).toBe(Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) / 10);
    }
  });

  it("rechaza cursos fuera del alcance del docente y a estudiantes", async () => {
    await expect(getGradeCenterCourseReportCards(actor(teacher, "TEACHER"), { courseId: 999_999 })).rejects.toThrow(/No tienes acceso/);
    await expect(getGradeCenterCourseReportCards(actor(student, "STUDENT"), { courseId: course.courseId })).rejects.toThrow(/No tienes permisos/);
  });

  it("congela en la generación el mismo boletín que se ve en vivo", async () => {
    const before = await getGradeCenterCourseReportCards(actor(teacher, "TEACHER"), { courseId: course.courseId });
    const result = await generateGradeCenterReportCards(actor(admin, "SCHOOL_ADMIN"), {
      academicYearId: course.academicYearId,
      academicPeriodId: course.periodId,
      courseId: course.courseId,
    });
    expect(result).toMatchObject({ status: "COMPLETED", generated: course.students, total: course.students });

    const after = await getGradeCenterCourseReportCards(actor(teacher, "TEACHER"), { courseId: course.courseId });
    expect(after!.students.every(card => card.generatedAt !== null)).toBe(true);

    const db = await getDb();
    const sample = before!.students[0]!;
    const run = (await db!.select().from(reportCardRuns).where(and(eq(reportCardRuns.schoolId, schoolId), eq(reportCardRuns.courseId, course.courseId), eq(reportCardRuns.studentId, sample.studentId), gt(reportCardRuns.id, lastRunIdBefore))).orderBy(desc(reportCardRuns.id)).limit(1))[0];
    const payload = JSON.parse(run!.dataJson);
    expect(payload.average).toBe(sample.average);
    expect(payload.subjects).toEqual(sample.subjects.map(({ subjectId, subjectName, average }) => ({ subjectId, subjectName, average })));
  });

  it("solo los roles directivos generan boletines", async () => {
    await expect(
      generateGradeCenterReportCards(actor(teacher, "TEACHER"), { academicYearId: course.academicYearId, academicPeriodId: course.periodId, courseId: course.courseId }),
    ).rejects.toThrow(/Solo roles institucionales/);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assignments, students, submissions, users } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { DEMO_SCHOOL_ID, ensureEduCoreSeeded, getDb } from "./db";
import { appRouter } from "./routers";
import { ensureStudentPortalSeeded } from "./studentPortalSeed";

const callerFor = (user: TrpcContext["user"]) =>
  appRouter.createCaller({
    req: {} as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    user,
  });

const PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n%%EOF").toString("base64")}`;

async function userByOpenId(openId: string) {
  const db = await getDb();
  return (await db!.select().from(users).where(eq(users.openId, openId)).limit(1))[0]!;
}

describe("Portal estudiante: datos propios y entregas", () => {
  let sofia: any;
  let teacher: any;
  const createdTaskIds: number[] = [];

  async function createTask(fields: Partial<typeof assignments.$inferInsert>) {
    const db = await getDb();
    const inserted = await db!.insert(assignments).values({
      schoolId: DEMO_SCHOOL_ID,
      title: `QA tarea ${Date.now()}-${createdTaskIds.length}`,
      subject: "Matemáticas",
      course: "11-2",
      teacherName: "Ricardo Salamanca",
      description: "Actividad de prueba",
      dueAt: new Date(Date.now() + 2 * 86_400_000),
      points: 100,
      status: "Publicado",
      ...fields,
    }).$returningId();
    createdTaskIds.push(inserted[0]!.id);
    return inserted[0]!.id;
  }

  beforeAll(async () => {
    await ensureEduCoreSeeded();
    await ensureStudentPortalSeeded(DEMO_SCHOOL_ID);
    sofia = await userByOpenId("educore-demo-student-1");
    teacher = await userByOpenId("educore-demo-teacher-1");
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db || !createdTaskIds.length) return;
    await db.delete(submissions).where(inArray(submissions.assignmentId, createdTaskIds));
    await db.delete(assignments).where(inArray(assignments.id, createdTaskIds));
  });

  it("returns only the student's own grades for the six subjects of her course", async () => {
    const grades = await callerFor(sofia).student.grades({ role: "student" });
    expect(grades?.student.name).toBe("Sofía Martínez");
    expect(grades?.course?.name).toBe("11-2");
    expect(grades?.subjects.map(subject => subject.name)).toEqual(["Biología", "Ciencias Sociales", "Inglés", "Lengua Castellana", "Matemáticas", "Química"]);
    const chemistry = grades!.subjects.find(subject => subject.name === "Química")!;
    expect(chemistry.average).toBe(3.3);
    expect(chemistry.gradedWeight).toBe(60);
    expect(grades?.average).toBe(4.2);
    expect(grades?.previous).toEqual({ periodName: "Periodo 3", average: 4.1 });
  });

  it("rejects the student endpoints for other roles and periods outside the year", async () => {
    await expect(callerFor(teacher).student.grades({ role: "teacher" })).rejects.toBeInstanceOf(TRPCError);
    await expect(callerFor(sofia).student.grades({ role: "student", academicPeriodId: 999_999 })).rejects.toThrow(/periodo/i);
  });

  it("builds the report card with only the student's card", async () => {
    const card = await callerFor(sofia).student.reportCard({ role: "student" });
    expect(card?.students).toHaveLength(1);
    expect(card?.students[0]!.studentId).toBe(sofia.id);
    expect(card?.students[0]!.average).toBe(4.2);
  });

  it("submits a real file bound to the authenticated student and allows replacing it until graded", async () => {
    const taskId = await createTask({});
    const first = await callerFor(sofia).student.submitTask({ role: "student", assignmentId: taskId, comment: "Primera versión", file: { name: "taller.pdf", dataBase64: PDF } });
    expect(first?.studentName).toBe("Sofía Martínez");
    expect(first?.fileName).toBe("taller.pdf");
    expect(first?.fileUrl).toMatch(/submissions/);

    const replaced = await callerFor(sofia).student.submitTask({ role: "student", assignmentId: taskId, comment: "", file: { name: "taller-v2.pdf", dataBase64: PDF } });
    expect(replaced?.id).toBe(first?.id);
    expect(replaced?.fileName).toBe("taller-v2.pdf");

    const db = await getDb();
    await db!.update(submissions).set({ grade: 4.5, status: "Calificada" }).where(eq(submissions.id, first!.id));
    await expect(callerFor(sofia).student.submitTask({ role: "student", assignmentId: taskId, comment: "", file: { name: "taller-v3.pdf", dataBase64: PDF } })).rejects.toThrow(/calificada/i);
  });

  it("rejects submissions for other courses, closed or draft activities, unsafe files and anonymous callers", async () => {
    const otherCourse = await createTask({ course: "11-1" });
    const closed = await createTask({ status: "Cerrada" });
    const draft = await createTask({ status: "Borrador" });
    const open = await createTask({});
    const submit = (assignmentId: number, name = "tarea.pdf") => callerFor(sofia).student.submitTask({ role: "student", assignmentId, comment: "", file: { name, dataBase64: PDF } });
    await expect(submit(otherCourse)).rejects.toThrow(/no está disponible/i);
    await expect(submit(closed)).rejects.toThrow(/cerró/i);
    await expect(submit(draft)).rejects.toThrow(/no está disponible/i);
    await expect(submit(open, "pagina.html")).rejects.toThrow(/formato/i);
    await expect(callerFor(null).student.submitTask({ role: "student", assignmentId: open, comment: "", file: { name: "a.pdf", dataBase64: PDF } })).rejects.toBeInstanceOf(TRPCError);
  });

  it("does not let a student create activities anymore", async () => {
    await expect(
      callerFor(sofia).educore.createAssignment({ role: "student", title: "Intento", subject: "Matemáticas", course: "11-2", description: "", dueAt: new Date(), points: 100, status: "Publicado" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("scopes the snapshot for the student: no staff data, no drafts, only her events", async () => {
    await createTask({ status: "Borrador", title: `QA borrador ${Date.now()}` });
    const snapshot = await callerFor(sofia).educore.snapshot({ role: "student" });
    expect(snapshot?.notifications).toEqual([]);
    expect(snapshot?.planning).toEqual([]);
    expect(snapshot?.assignments.every(task => task.course === "11-2" && task.status !== "Borrador")).toBe(true);
    expect(snapshot?.events.some(event => event.audience === "11-1" || event.audience.startsWith("Acudientes"))).toBe(false);
    expect(snapshot?.events.map(event => event.title)).toContain("Simulacro Saber 11");
    expect(snapshot?.subjects).toHaveLength(6);
  });

  it("keeps the teacher snapshot on the teacher's own subject", async () => {
    const snapshot = await callerFor(teacher).educore.snapshot({ role: "teacher" });
    expect(new Set(snapshot?.grades.map(grade => grade.subject))).toEqual(new Set(["Biología"]));
    expect(new Set(snapshot?.assignments.map(task => task.subject))).toEqual(new Set(["Biología"]));
  });

  it("lists only the student's own attendance even when her user id matches another roster id", async () => {
    const db = await getDb();
    const roster = (await db!.select().from(students).where(and(eq(students.schoolId, DEMO_SCHOOL_ID), eq(students.name, "Sofía Martínez"))).limit(1))[0]!;
    const records = await callerFor(sofia).attendance.list({ role: "student" });
    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map(record => record.studentId))).toEqual(new Set([String(roster.id)]));
  });
});

describe("Portal acudiente: solo los hijos vinculados", () => {
  let mariana: any;
  let andres: any;
  let sofia: any;
  let carlos: any;

  beforeAll(async () => {
    await ensureEduCoreSeeded();
    await ensureStudentPortalSeeded(DEMO_SCHOOL_ID);
    mariana = await userByOpenId("educore-demo-guardian-1");
    andres = await userByOpenId("educore-demo-guardian-2");
    sofia = await userByOpenId("educore-demo-student-1");
    carlos = await userByOpenId("educore-demo-student-2");
  });

  it("lists the guardian's children with the primary link first and their course", async () => {
    const children = await callerFor(mariana).guardian.children({ role: "guardian" });
    expect(children[0]).toMatchObject({ id: sofia.id, name: "Sofía Martínez", courseName: "11-2", isPrimary: true });
    expect(children.map(child => child.id)).toContain(carlos.id);
    // Solo datos de presentación, nada de la fila completa del usuario
    expect(Object.keys(children[0]!).sort()).toEqual(["courseName", "id", "isPrimary", "name", "relationshipType"]);
  });

  it("reads grades and the report card of a linked child, defaulting to the primary one", async () => {
    const byDefault = await callerFor(mariana).student.grades({ role: "guardian" });
    expect(byDefault?.student.id).toBe(sofia.id);
    const explicit = await callerFor(mariana).student.grades({ role: "guardian", studentUserId: sofia.id });
    expect(explicit?.average).toBe(4.2);
    const card = await callerFor(mariana).student.reportCard({ role: "guardian", studentUserId: sofia.id });
    expect(card?.students.map(student => student.studentId)).toEqual([sofia.id]);
  });

  it("rejects children that are not linked to the guardian", async () => {
    await expect(callerFor(andres).student.grades({ role: "guardian", studentUserId: sofia.id })).rejects.toThrow(/no está vinculado/i);
    await expect(callerFor(andres).student.reportCard({ role: "guardian", studentUserId: sofia.id })).rejects.toThrow(/no está vinculado/i);
  });

  it("ignores studentUserId for a student and keeps tasks submission student-only", async () => {
    const grades = await callerFor(sofia).student.grades({ role: "student", studentUserId: carlos.id });
    expect(grades?.student.id).toBe(sofia.id);
    await expect(callerFor(mariana).student.submitTask({ role: "guardian", assignmentId: 1, comment: "", file: null })).rejects.toBeInstanceOf(TRPCError);
    await expect(callerFor(sofia).guardian.children({ role: "student" })).rejects.toBeInstanceOf(TRPCError);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  assessmentGrades,
  assessments,
  courses,
  guardianProfiles,
  guardianStudentRelationships,
  schoolMemberships,
  studentEnrollments,
  studentProfiles,
  students,
  teacherProfiles,
  teachers,
  users,
} from "../drizzle/schema";
import { ensureEduCoreSeeded, getDb, getDemoIdentityContext, listGuardianStudents } from "./db";
import { normalizeCourseKey } from "./userImport";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const schoolId = 1;
const suffix = Date.now();
const email = (name: string) => `${name}.${suffix}@import.educore.test`;

let admin: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let teacher: Awaited<ReturnType<typeof getDemoIdentityContext>>;
let demoStudentEmail = "";
let courseId = 0;

const callerFor = (user: NonNullable<typeof admin>["user"]) =>
  appRouter.createCaller({ user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext);

beforeAll(async () => {
  await ensureEduCoreSeeded();
  admin = await getDemoIdentityContext("admin", schoolId);
  teacher = await getDemoIdentityContext("teacher", schoolId);
  const student = await getDemoIdentityContext("student", schoolId);
  if (!admin || !teacher || !student) throw new Error("Las identidades demo no están disponibles para probar la carga masiva.");
  demoStudentEmail = student.user.email ?? "";
  const db = await getDb();
  const course = (await db!.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, "11-1"))).limit(1))[0];
  if (!course) throw new Error("El curso demo 11-1 no existe.");
  courseId = course.id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const created = await db.select({ id: users.id, email: users.email }).from(users).where(and(eq(users.schoolId, schoolId), inArray(users.email, [
    email("ana.import"), email("bruno.import"), email("carla.import"), email("diego.import"), email("acudiente.import"), email("docente.import"),
  ])));
  const ids = created.map(user => user.id);
  const emails = created.map(user => user.email ?? "");
  if (ids.length) {
    await db.delete(assessmentGrades).where(inArray(assessmentGrades.studentId, ids));
    await db.delete(studentEnrollments).where(inArray(studentEnrollments.studentUserId, ids));
    await db.delete(guardianStudentRelationships).where(inArray(guardianStudentRelationships.guardianUserId, ids));
    await db.delete(teacherProfiles).where(inArray(teacherProfiles.userId, ids));
    await db.delete(studentProfiles).where(inArray(studentProfiles.userId, ids));
    await db.delete(guardianProfiles).where(inArray(guardianProfiles.userId, ids));
    await db.delete(schoolMemberships).where(inArray(schoolMemberships.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  if (emails.length) {
    await db.delete(students).where(inArray(students.email, emails));
    await db.delete(teachers).where(inArray(teachers.email, emails));
  }
  if (courseId) {
    const active = await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.courseId, courseId), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
    await db.update(courses).set({ studentsCount: active.length }).where(eq(courses.id, courseId));
  }
});

describe("Carga masiva de usuarios", () => {
  it("normaliza nombres de curso escritos de distintas formas", () => {
    expect(normalizeCourseKey("11 - 1")).toBe(normalizeCourseKey("11-1"));
    expect(normalizeCourseKey("11–1")).toBe("11-1");
    expect(normalizeCourseKey("11°1")).toBe("111");
  });

  it("valida en modo vista previa sin escribir en la base", async () => {
    const result = await callerFor(admin!.user).identity.importUsers({
      role: "admin",
      kind: "STUDENT",
      dryRun: true,
      rows: [
        { firstName: "Ana", lastName: "Import", email: email("ana.import"), course: "11 - 1" },
        { firstName: "Repetida", lastName: "Demo", email: demoStudentEmail, course: "11-1" },
        { firstName: "Sin", lastName: "Curso", email: email("nocurso.import"), course: "99-9" },
        { firstName: "Correo", lastName: "Malo", email: "no-es-un-correo" },
        { firstName: "Ana", lastName: "Doble", email: email("ana.import") },
      ],
    });
    expect(result.rows.map(row => row.status)).toEqual(["ready", "exists", "error", "error", "error"]);
    expect(result.rows[0].courseName).toBe("11-1");
    expect(result.rows[2].message).toContain("99-9");
    expect(result.rows[4].message).toContain("fila 1");
    expect(result.summary).toMatchObject({ total: 5, ready: 1, exists: 1, errors: 3, created: 0 });

    const db = await getDb();
    const written = await db!.select({ id: users.id }).from(users).where(eq(users.email, email("ana.import")));
    expect(written).toHaveLength(0);
  });

  it("crea estudiantes matriculados y listos para Grade Center y Asistencia", async () => {
    const result = await callerFor(admin!.user).identity.importUsers({
      role: "admin",
      kind: "STUDENT",
      dryRun: false,
      rows: [
        { firstName: "Ana", lastName: "Import", email: email("ana.import"), course: "11-1", documentId: `DOC-${suffix}` },
        { firstName: "Bruno", lastName: "Import", email: email("bruno.import"), course: "11-1" },
        { firstName: "Carla", lastName: "Import", email: email("carla.import") },
      ],
    });
    expect(result.summary.created).toBe(3);
    const [ana, , carla] = result.rows;

    const db = await getDb();
    const enrollment = await db!.select().from(studentEnrollments).where(and(eq(studentEnrollments.studentUserId, ana.userId!), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
    expect(enrollment).toHaveLength(1);
    expect(enrollment[0].courseId).toBe(courseId);

    const courseAssessments = await db!.select({ id: assessments.id }).from(assessments).where(eq(assessments.courseId, courseId));
    const grades = await db!.select({ id: assessmentGrades.id }).from(assessmentGrades).where(and(eq(assessmentGrades.studentId, ana.userId!), eq(assessmentGrades.courseId, courseId)));
    expect(grades).toHaveLength(courseAssessments.length);

    const legacy = await db!.select().from(students).where(eq(students.email, email("ana.import")));
    expect(legacy[0]?.course).toBe("11-1");

    const carlaEnrollment = await db!.select().from(studentEnrollments).where(eq(studentEnrollments.studentUserId, carla.userId!));
    expect(carlaEnrollment).toHaveLength(0);
  });

  it("vincula acudientes al estudiante indicado por correo", async () => {
    const result = await callerFor(admin!.user).identity.importUsers({
      role: "admin",
      kind: "GUARDIAN",
      dryRun: false,
      rows: [
        { firstName: "Acudiente", lastName: "Import", email: email("acudiente.import"), studentEmail: email("ana.import"), relationship: "LEGAL_GUARDIAN" },
        { firstName: "Otro", lastName: "Acudiente", email: email("huerfano.import"), studentEmail: email("no-existe") },
      ],
    });
    expect(result.rows.map(row => row.status)).toEqual(["created", "error"]);
    const linked = await listGuardianStudents(schoolId, result.rows[0].userId!);
    expect(linked.some(student => student.email === email("ana.import"))).toBe(true);
  });

  it("crea docentes con perfil y presencia en el directorio heredado", async () => {
    const result = await callerFor(admin!.user).identity.importUsers({
      role: "admin",
      kind: "TEACHER",
      dryRun: false,
      rows: [{ firstName: "Docente", lastName: "Import", email: email("docente.import"), specialty: "Química" }],
    });
    expect(result.summary.created).toBe(1);
    const db = await getDb();
    const profile = await db!.select().from(teacherProfiles).where(eq(teacherProfiles.userId, result.rows[0].userId!));
    expect(profile[0]?.specialties).toBe("Química");
    const legacy = await db!.select().from(teachers).where(eq(teachers.email, email("docente.import")));
    expect(legacy[0]?.subjectFocus).toBe("Química");
  });

  it("no permite que un docente cargue usuarios", async () => {
    await expect(
      callerFor(teacher!.user).identity.importUsers({
        role: "admin",
        kind: "STUDENT",
        dryRun: true,
        rows: [{ firstName: "Diego", lastName: "Import", email: email("diego.import") }],
      }),
    ).rejects.toThrow("No tienes permisos");
  });

  it("resume el directorio por rol sin depender de la paginación", async () => {
    const summary = await callerFor(admin!.user).identity.summary({ role: "admin" });
    expect(summary.byRole.STUDENT).toBeGreaterThanOrEqual(43);
    expect(summary.byRole.TEACHER).toBeGreaterThanOrEqual(3);
    expect(summary.byRole.GUARDIAN).toBeGreaterThanOrEqual(3);
    expect(summary.total).toBe(Object.values(summary.byRole).reduce((sum, count) => sum + count, 0));
    expect(summary.pendingInvitations).toBeGreaterThanOrEqual(0);
  });
});

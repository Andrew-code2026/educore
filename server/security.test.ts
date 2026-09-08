import { beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  createAcademicCourse,
  createAcademicGrade,
  createAcademicYear,
  createGuardianRelationship,
  createSchoolUser,
  ensureEduCoreSeeded,
  ensureIdentitySeeded,
  getDb,
  getDemoIdentityContext,
  getMembershipContext,
  listGuardianStudents,
  DEMO_SCHOOL_ID,
} from "./db";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { courses, schools, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const callerFor = (user: TrpcContext["user"]) =>
  appRouter.createCaller({
    req: {} as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    user,
  });

const anonymousCaller = callerFor(null);

describe("FASE 5.2-A: Suite de Seguridad y Autorización Server-Side", () => {
  let adminUser: any;
  let teacherUser: any;
  let studentUser: any;
  let guardianUser: any;
  let secondStudentUser: any;
  let foreignAdminUser: any;
  const school1 = DEMO_SCHOOL_ID;
  const school2 = 999002;

  beforeAll(async () => {
    await ensureEduCoreSeeded();
    await ensureIdentitySeeded(school1);

    const adminContext = await getDemoIdentityContext("admin", school1);
    const teacherContext = await getDemoIdentityContext("teacher", school1);
    const studentContext = await getDemoIdentityContext("student", school1);
    const guardianContext = await getDemoIdentityContext("guardian", school1);

    adminUser = adminContext!.user;
    teacherUser = teacherContext!.user;
    studentUser = studentContext!.user;
    guardianUser = guardianContext!.user;

    // Create a second student in school 1
    const s2 = await createSchoolUser({
      schoolId: school1,
      firstName: "Segundo",
      lastName: "Estudiante",
      email: `estudiante2.${Date.now()}@demo.educore.co`,
      roleKey: "STUDENT",
      status: "ACTIVE",
    });
    secondStudentUser = s2;

    // Create school 2 and a user belonging strictly to school 2
    const db = await getDb();
    if (db) {
      const existingS2 = (await db.select().from(schools).where(eq(schools.id, school2)).limit(1))[0];
      if (!existingS2) {
        await db.insert(schools).values({
          id: school2,
          name: "Colegio Foráneo San José",
          city: "Medellín",
          academicYear: "2026",
          tagline: "Educación de prueba",
          primaryColor: "#000000",
          secondaryColor: "#ffffff",
          logoUrl: null,
        });
      }
      await ensureIdentitySeeded(school2);
      const foreignAdmin = await createSchoolUser({
        schoolId: school2,
        firstName: "Rector",
        lastName: "Foráneo",
        email: `rector.foraneo.${Date.now()}@sanjose.edu.co`,
        roleKey: "SCHOOL_ADMIN",
        status: "ACTIVE",
      });
      foreignAdminUser = foreignAdmin;
    }
  });

  // ==========================================
  // ESCENARIO 1: Rechazo de mutación no autenticada
  // ==========================================
  describe("Escenario 1: Rechazo de mutación no autenticada", () => {
    it("rejects unauthenticated user creating assessments in gradeCenter", async () => {
      await expect(
        anonymousCaller.gradeCenter.createAssessment({
          role: "admin",
          academicYearId: 1,
          academicPeriodId: 1,
          courseId: 1,
          subjectId: 1,
          title: "Intrusión No Autenticada",
          assessmentType: "QUIZ",
          date: new Date(),
          maxValue: 5,
          weight: 20,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects unauthenticated user saving grades in gradeCenter", async () => {
      await expect(
        anonymousCaller.gradeCenter.saveGrades({
          role: "teacher",
          assessmentId: 1,
          grades: [{ studentId: 1, value: 5.0 }],
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects unauthenticated user creating users in identity", async () => {
      await expect(
        anonymousCaller.identity.createUser({
          role: "admin",
          firstName: "Hacker",
          lastName: "Anon",
          email: "hacker@anon.com",
          roleKey: "SCHOOL_ADMIN",
          status: "ACTIVE",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects unauthenticated user changing roles in identity", async () => {
      await expect(
        anonymousCaller.identity.changeRole({
          role: "admin",
          userId: 1,
          roleKey: "SUPER_ADMIN",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects unauthenticated user creating course in academic", async () => {
      await expect(
        anonymousCaller.academic.createCourse({
          role: "admin",
          academicYearId: 1,
          gradeLevelId: 1,
          name: "Curso Ilegal",
          code: "CUR-ILEGAL",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ==========================================
  // ESCENARIO 2: Aislamiento institucional multi-tenant
  // ==========================================
  describe("Escenario 2: Aislamiento institucional multi-tenant", () => {
    it("prevents school 2 administrator from mutating or querying school 1 courses", async () => {
      if (!foreignAdminUser) return;
      const foreignCaller = callerFor({ ...foreignAdminUser, schoolId: school2 });

      // Attempting to query courses in Grade Center for course belonging to School 1
      await expect(
        foreignCaller.gradeCenter.context({
          role: "admin",
          courseId: 1, // Course 1 belongs to School 1
        })
      ).rejects.toThrow("No tienes permiso para acceder a este curso.");
    });

    it("prevents school 2 user from accessing school 1 user profiles", async () => {
      if (!foreignAdminUser || !secondStudentUser) return;
      const foreignCaller = callerFor({ ...foreignAdminUser, schoolId: school2 });

      const profileInSchool1 = await foreignCaller.identity.profile({
        role: "admin",
        userId: secondStudentUser.id, // User strictly in school 1
      });

      // Cannot retrieve profile of user from another school
      expect(profileInSchool1).toBeNull();
    });
  });

  // ==========================================
  // ESCENARIO 3: Restricción docente a cursos asignados
  // ==========================================
  describe("Escenario 3: Restricción docente a cursos asignados", () => {
    it("prevents teacher from creating assessment in an unassigned course", async () => {
      const teacherCaller = callerFor(teacherUser);
      // Teacher is assigned to 11-2 Mathematics (course 6). Course 1 (9-1) is unassigned.
      await expect(
        teacherCaller.gradeCenter.createAssessment({
          role: "teacher",
          academicYearId: 1,
          academicPeriodId: 2,
          courseId: 1, // Course 9-1 not assigned to this teacher
          subjectId: 1,
          title: "Evaluación No Asignada",
          assessmentType: "QUIZ",
          date: new Date(),
          maxValue: 5,
          weight: 20,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // ESCENARIO 4: Restricción de estudiante a sus propios datos
  // ==========================================
  describe("Escenario 4: Restricción de estudiante a sus propios datos", () => {
    it("blocks student from executing any grade mutation", async () => {
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.gradeCenter.saveGrades({
          role: "student",
          assessmentId: 1,
          grades: [{ studentId: studentUser.id, value: 5.0 }],
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("blocks student from viewing profile of another student", async () => {
      if (!secondStudentUser) return;
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.identity.profile({
          role: "student",
          userId: secondStudentUser.id,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("scopes Grade Center matrix view exclusively to own row for student", async () => {
      const studentCaller = callerFor(studentUser);
      const matrix = await studentCaller.gradeCenter.context({
        role: "student",
      });
      // Student should only see 1 student row (themselves)
      expect(matrix?.rows.length).toBeLessThanOrEqual(1);
      if (matrix?.rows.length === 1) {
        expect(matrix.rows[0].enrollment.studentUserId).toBe(studentUser.id);
      }
    });
  });

  // ==========================================
  // ESCENARIO 5: Restricción de apoderado a sus representados
  // ==========================================
  describe("Escenario 5: Restricción de apoderado a sus representados", () => {
    it("blocks guardian from viewing profile of unlinked students", async () => {
      if (!secondStudentUser) return;
      const guardianCaller = callerFor(guardianUser);
      await expect(
        guardianCaller.identity.profile({
          role: "guardian",
          userId: secondStudentUser.id, // Not linked to this guardian
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("scopes Grade Center matrix view exclusively to linked students for guardian", async () => {
      const guardianCaller = callerFor(guardianUser);
      const matrix = await guardianCaller.gradeCenter.context({
        role: "guardian",
      });
      const linked = await listGuardianStudents(school1, guardianUser.id);
      const linkedIds = new Set(linked.map(s => s.id));
      for (const row of matrix?.rows ?? []) {
        expect(linkedIds.has(row.enrollment.studentUserId)).toBe(true);
      }
    });
  });

  // ==========================================
  // ESCENARIO 6: Suplantación de rol mediante parámetros de cliente
  // ==========================================
  describe("Escenario 6: Suplantación de rol mediante parámetros de cliente", () => {
    it("ignores input.role = 'admin' when authenticated user is student", async () => {
      const studentCaller = callerFor(studentUser);
      // Student sends role: 'admin' attempting to view arbitrary profile
      if (secondStudentUser) {
        await expect(
          studentCaller.identity.profile({
            role: "admin", // Spoofing attempt
            userId: secondStudentUser.id,
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
      }
    });

    it("ignores input.role = 'teacher' when authenticated student attempts to save grades", async () => {
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.gradeCenter.saveGrades({
          role: "teacher", // Spoofing attempt
          assessmentId: 1,
          grades: [{ studentId: studentUser.id, value: 5.0 }],
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });

  // ==========================================
  // ESCENARIO 7: Alteración de identificadores (ID Tampering)
  // ==========================================
  describe("Escenario 7: Alteración de identificadores (ID Tampering)", () => {
    it("forces own ID when guardian specifies a different guardianUserId", async () => {
      const guardianCaller = callerFor(guardianUser);
      const results = await guardianCaller.identity.relationships({
        role: "guardian",
        guardianUserId: 999999, // Tampering attempt
      });
      // The server overrides guardianUserId with guardianUser.id
      const actualLinked = await listGuardianStudents(school1, guardianUser.id);
      expect(results.length).toBe(actualLinked.length);
    });

    it("blocks student from querying family relationships", async () => {
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.identity.relationships({
          role: "student",
          guardianUserId: guardianUser.id,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });

  // ==========================================
  // ESCENARIO 8: Procedimientos administrativos protegidos
  // ==========================================
  describe("Escenario 8: Procedimientos administrativos protegidos", () => {
    it("rejects teacher attempting to create a school user", async () => {
      const teacherCaller = callerFor(teacherUser);
      await expect(
        teacherCaller.identity.createUser({
          role: "teacher",
          firstName: "Intento",
          lastName: "Docente",
          email: "docente.crea@demo.educore.co",
          roleKey: "TEACHER",
          status: "ACTIVE",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("rejects student attempting to change user role", async () => {
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.identity.changeRole({
          role: "student",
          userId: studentUser.id,
          roleKey: "SCHOOL_ADMIN",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("rejects teacher attempting to create an academic course", async () => {
      const teacherCaller = callerFor(teacherUser);
      await expect(
        teacherCaller.academic.createCourse({
          role: "teacher",
          academicYearId: 1,
          gradeLevelId: 1,
          name: "Curso Ilegal Docente",
          code: "CUR-DOC",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });

  // ==========================================
  // ESCENARIO 9: Protección en procedimientos legacy (educore)
  // ==========================================
  describe("Escenario 9: Protección en procedimientos legacy (educore)", () => {
    it("rejects unauthenticated user updating school branding", async () => {
      await expect(
        anonymousCaller.educore.updateSchool({
          role: "admin",
          name: "Colegio Hackeado",
          shortName: "Hack",
          city: "Cali",
          department: "Valle",
          country: "Colombia",
          description: "Ataque no autorizado",
          website: "https://educore.co",
          email: "hack@educore.co",
          phone: "123456",
          address: "Calle 1",
          academicYear: "2026",
          primaryColor: "#000000",
          secondaryColor: "#ffffff",
          accentColor: "#ff0000",
          backgroundColor: "#ffffff",
          surfaceColor: "#ffffff",
          textColor: "#000000",
          mutedTextColor: "#888888",
          themeMode: "light",
          borderRadius: "8px",
          logoUrl: null,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects student attempting to update attendance", async () => {
      const studentCaller = callerFor(studentUser);
      await expect(
        studentCaller.educore.recordAttendance({
          role: "student",
          course: "11-2",
          date: new Date(),
          records: [{ studentName: studentUser.name, status: "Presente" }],
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });

  // ==========================================
  // ESCENARIO 10: Privacidad de snapshots
  // ==========================================
  describe("Escenario 10: Privacidad de snapshots", () => {
    it("scopes snapshot to only student's own grades and assignments", async () => {
      const studentCaller = callerFor(studentUser);
      const snapshot = await studentCaller.educore.snapshot({
        role: "student",
      });

      expect(snapshot?.role).toBe("student");
      // All grades returned must belong to this student
      if (snapshot?.grades && snapshot.grades.length > 0) {
        for (const grade of snapshot.grades) {
          expect(grade.studentName).toBe(studentUser.name);
        }
      }
    });

    it("scopes snapshot to only linked student grades for guardian", async () => {
      const guardianCaller = callerFor(guardianUser);
      const linked = await listGuardianStudents(school1, guardianUser.id);
      const linkedNames = new Set(linked.map(s => s.name));

      const snapshot = await guardianCaller.educore.snapshot({
        role: "guardian",
      });

      expect(snapshot?.role).toBe("guardian");
      if (snapshot?.grades && snapshot.grades.length > 0) {
        for (const grade of snapshot.grades) {
          expect(linkedNames.has(grade.studentName)).toBe(true);
        }
      }
    });
  });
});

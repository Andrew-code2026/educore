import { beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ROLE_NAMES, ensureEduCoreSeeded, ensureIdentitySeeded, getDemoIdentityContext, DEMO_SCHOOL_ID } from "./db";
import type { TrpcContext } from "./_core/context";

function caller(user: TrpcContext["user"] = null) {
  const ctx: TrpcContext = {
    user,
    req: {} as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("EduCore role model", () => {
  let adminUser: any = null;
  let teacherUser: any = null;

  beforeAll(async () => {
    await ensureEduCoreSeeded();
    await ensureIdentitySeeded(DEMO_SCHOOL_ID);
    const adminCtx = await getDemoIdentityContext("admin", DEMO_SCHOOL_ID);
    const teacherCtx = await getDemoIdentityContext("teacher", DEMO_SCHOOL_ID);
    adminUser = adminCtx?.user;
    teacherUser = teacherCtx?.user;
  });

  it("exposes the four product roles in Spanish", () => {
    expect(ROLE_NAMES).toEqual({
      admin: "Administrador",
      teacher: "Docente",
      student: "Estudiante",
      guardian: "Acudiente",
    });
  });

  it("blocks student grade mutations before touching data", async () => {
    await expect(caller().educore.updateGrade({
      role: "student",
      studentName: "Sofía Martínez",
      course: "11-2",
      subject: "Matemáticas",
      period: "Periodo 2",
      value: 4.8,
    })).rejects.toThrow("No tienes permisos");
  });

  it("blocks teacher-only assignment creation for guardians", async () => {
    await expect(caller().educore.createAssignment({
      role: "guardian",
      title: "No autorizado",
      subject: "Matemáticas",
      course: "11-2",
      description: "Esta operación no debe ejecutarse.",
      dueAt: new Date(),
      points: 100,
      teacherName: "Demo",
    })).rejects.toThrow("No tienes permisos");
  });

  it("blocks non-admin branding changes", async () => {
    await expect(caller().educore.updateSchool({
      role: "teacher",
      name: "Colegio no autorizado",
      shortName: "Demo",
      city: "Cali",
      department: "Valle del Cauca",
      country: "Colombia",
      description: "Cambio no autorizado para la prueba.",
      website: "https://educore.co",
      email: "contacto@educore.co",
      phone: "+57 602 555 0101",
      address: "Cali",
      academicYear: "2026",
      primaryColor: "#2475cf",
      secondaryColor: "#eaf4ff",
      accentColor: "#8ec6fa",
      backgroundColor: "#f7f9fc",
      surfaceColor: "#ffffff",
      textColor: "#182131",
      mutedTextColor: "#7a8798",
      themeMode: "light",
      borderRadius: "12px",
      logoUrl: null,
    })).rejects.toThrow("No tienes permisos");
  });

  it("rejects inconsistent academic period dates before persistence", async () => {
    await expect(caller().educore.createAcademicPeriod({
      role: "admin",
      name: "Periodo inválido",
      startDate: new Date("2026-06-20T00:00:00Z"),
      endDate: new Date("2026-06-19T00:00:00Z"),
      status: "Programado",
    })).rejects.toThrow("fecha final");
  });

  it("blocks non-admin logo uploads", async () => {
    await expect(caller(teacherUser).educore.uploadSchoolLogo({
      role: "teacher",
      fileName: "escudo.png",
      contentType: "image/png",
      dataBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    })).rejects.toThrow("No tienes permisos");
  });

  it("rejects unsupported file formats for logo upload", async () => {
    await expect(caller(adminUser).educore.uploadSchoolLogo({
      role: "admin",
      fileName: "malicious.exe",
      contentType: "application/octet-stream",
      dataBase64: "data:application/octet-stream;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEA",
    })).rejects.toThrow("Formato de imagen no permitido");
  });

  it("allows admin to upload school logo and saves it", async () => {
    const result = await caller(adminUser).educore.uploadSchoolLogo({
      role: "admin",
      fileName: "escudo_nuevo.png",
      contentType: "image/png",
      dataBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });
    expect(result).toBeDefined();
    expect(result.logoUrl).toBeDefined();
    expect(typeof result.logoUrl).toBe("string");
    expect(result.logoUrl?.length).toBeGreaterThan(0);
  });
});

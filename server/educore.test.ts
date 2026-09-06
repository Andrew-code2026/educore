import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ROLE_NAMES } from "./db";
import type { TrpcContext } from "./_core/context";

function caller() {
  const ctx: TrpcContext = {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("EduCore role model", () => {
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
});

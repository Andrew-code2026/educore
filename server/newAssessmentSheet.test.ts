import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createGradeCenterAssessment,
  ensureGradeCenterSeeded,
  getGradeCenterContext,
  type GradeCenterActor,
} from "./gradeCenterDb";
import { getDb, getDemoIdentityContext } from "./db";
import { assessments, assessmentGrades } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let teacher: Demo;
let admin: Demo;
let student: Demo;
let guardian: Demo;
let seededContext: any;
const createdAssessmentIds: number[] = [];

const actor = (demo: Demo, roleKey: GradeCenterActor["roleKey"]): GradeCenterActor => ({
  schoolId,
  userId: demo!.user.id,
  roleKey,
});

describe("Laboratorio UX: Nueva Evaluación 2.0 — Backend & Integración", () => {
  beforeAll(async () => {
    await ensureGradeCenterSeeded(schoolId);
    admin = await getDemoIdentityContext("admin", schoolId);
    teacher = await getDemoIdentityContext("teacher", schoolId);
    student = await getDemoIdentityContext("student", schoolId);
    guardian = await getDemoIdentityContext("guardian", schoolId);
    if (!admin || !teacher || !student || !guardian) throw new Error("Demo actors missing");

    seededContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
    expect(seededContext?.selected).toBeTruthy();
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db || !createdAssessmentIds.length) return;
    await db.delete(assessmentGrades).where(inArray(assessmentGrades.assessmentId, createdAssessmentIds));
    await db.delete(assessments).where(inArray(assessments.id, createdAssessmentIds));
  });

  it("1. Permite crear evaluaciones con los 6 tipos definidos en la UX", async () => {
    const selected = seededContext.selected;
    const types = ["QUIZ", "ACTIVIDAD", "EXAMEN", "PROYECTO", "PARTICIPACION", "OTRO"] as const;

    for (const t of types) {
      // Usar peso 0 para no agotar el límite de ponderación durante la prueba de tipos
      const result = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Prueba Tipo ${t} ${Date.now()}`,
        description: `Descripción para tipo ${t}`,
        assessmentType: t,
        date: new Date(),
        maxValue: 5,
        weight: 0,
        status: "DRAFT",
      });

      expect(result).toBeTruthy();
      expect(result?.assessmentType).toBe(t);
      expect(result?.status).toBe("DRAFT");
      if (result?.id) createdAssessmentIds.push(result.id);
    }
  });

  it("2. Valida el límite dinámico de peso (rechaza superar el 100% acumulado)", async () => {
    const selected = seededContext.selected;
    const freshContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
    const remainingWeight = freshContext.stats.remainingWeight;

    // Intentar asignar un peso mayor al disponible
    const invalidWeight = remainingWeight + 5;
    await expect(
      createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Exceso de peso ${Date.now()}`,
        assessmentType: "EXAMEN",
        date: new Date(),
        maxValue: 5,
        weight: invalidWeight,
      })
    ).rejects.toThrow(/superar el 100%/);
  });

  it("3. Acepta un peso válido dentro del disponible y persiste correctamente", async () => {
    const selected = seededContext.selected;
    const freshContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
    const remainingWeight = freshContext.stats.remainingWeight;

    if (remainingWeight > 0) {
      const validWeight = Math.min(1, remainingWeight);
      const uniqueTitle = `Parcial de derivadas ${Date.now()}`;

      const created = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: uniqueTitle,
        description: "Evaluación parcial de derivadas y cálculo diferencial",
        assessmentType: "EXAMEN",
        date: new Date("2026-09-18T12:00:00Z"),
        maxValue: 5,
        weight: validWeight,
        status: "DRAFT",
      });

      expect(created).toBeTruthy();
      expect(created?.title).toBe(uniqueTitle);
      expect(created?.weight).toBe(validWeight);
      expect(created?.assessmentType).toBe("EXAMEN");
      if (created?.id) createdAssessmentIds.push(created.id);

      // Verificar que se refleja inmediatamente en el contexto del Grade Center
      const updatedContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const found = updatedContext.assessments.find((a: any) => a.id === created?.id);
      expect(found).toBeTruthy();
      expect(found?.title).toBe(uniqueTitle);
    }
  });

  it("4. Inserta automáticamente filas PENDING en assessment_grades para todos los alumnos matriculados", async () => {
    const selected = seededContext.selected;
    const created = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
      academicYearId: selected.academicYearId,
      academicPeriodId: selected.period.id,
      courseId: selected.course.id,
      subjectId: selected.subject.id,
      title: `Verificación Pendientes ${Date.now()}`,
      assessmentType: "QUIZ",
      date: new Date(),
      maxValue: 5,
      weight: 0,
      status: "DRAFT",
    });

    expect(created).toBeTruthy();
    if (created?.id) createdAssessmentIds.push(created.id);

    const freshContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
    // Cada fila de estudiante debe tener una celda para esta nueva evaluación con valor null (pendiente)
    for (const row of freshContext.rows) {
      const cell = row.values.find((v: any) => v.assessment.id === created!.id);
      expect(cell).toBeTruthy();
      expect(cell?.grade?.value).toBeNull();
    }
  });

  it("5. RBAC: Bloquea a estudiantes y acudientes de crear evaluaciones", async () => {
    const selected = seededContext.selected;

    await expect(
      createGradeCenterAssessment(actor(student, "STUDENT"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Hacker assessment ${Date.now()}`,
        assessmentType: "EXAMEN",
        date: new Date(),
        maxValue: 5,
        weight: 1,
      })
    ).rejects.toThrow(/permisos/);

    await expect(
      createGradeCenterAssessment(actor(guardian, "GUARDIAN"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Guardian assessment ${Date.now()}`,
        assessmentType: "EXAMEN",
        date: new Date(),
        maxValue: 5,
        weight: 1,
      })
    ).rejects.toThrow(/permisos/);
  });

  it("6. Rechaza valores máximos o pesos negativos / fuera de escala", async () => {
    const selected = seededContext.selected;

    // Peso negativo
    await expect(
      createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Peso negativo ${Date.now()}`,
        assessmentType: "QUIZ",
        date: new Date(),
        maxValue: 5,
        weight: -5,
      })
    ).rejects.toThrow(/peso de la evaluación no son válidos/);

    // MaxValue superior a la escala institucional (escala es 5.0)
    await expect(
      createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Escala inválida ${Date.now()}`,
        assessmentType: "QUIZ",
        date: new Date(),
        maxValue: 10,
        weight: 5,
      })
    ).rejects.toThrow(/escala o el peso/);
  });
});

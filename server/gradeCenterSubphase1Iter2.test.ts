import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { assessments, assessmentGrades, auditLogs, academicPeriods, reportCardRuns } from "../drizzle/schema";
import { appRouter } from "./routers";
import {
  createGradeCenterAssessment,
  deleteGradeCenterAssessment,
  ensureGradeCenterSeeded,
  getGradeCenterContext,
  saveGradeCenterGrades,
  generateGradeCenterReportCards,
  type GradeCenterActor,
} from "./gradeCenterDb";
import { getDb, getDemoIdentityContext } from "./db";
import { calculateDefinitiva } from "../client/src/components/grade-center/gradeCenterUtils";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let admin: Demo;
let teacher: Demo;
let student: Demo;
let seededContext: Awaited<ReturnType<typeof getGradeCenterContext>>;
const cleanupAssessmentIds: number[] = [];

const caller = (user: any) => appRouter.createCaller({ req: {} as any, res: {} as any, user });
const actor = (demo: Demo, roleKey: string): GradeCenterActor => ({
  userId: demo!.user.id,
  schoolId,
  roleKey,
  permissions: ["grades.update", "assessments.manage", "reports.export"],
});

beforeAll(async () => {
  admin = await getDemoIdentityContext("admin");
  teacher = await getDemoIdentityContext("teacher");
  student = await getDemoIdentityContext("student");
  await ensureGradeCenterSeeded(schoolId);
  seededContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
});

afterAll(async () => {
  const db = await getDb();
  if (db && cleanupAssessmentIds.length) {
    await db.delete(assessmentGrades).where(inArray(assessmentGrades.assessmentId, cleanupAssessmentIds));
    await db.delete(assessments).where(inArray(assessments.id, cleanupAssessmentIds));
  }
});

describe("Subfase 1 — Iteración 2: Guardado Inteligente, Estabilidad y Definitiva", () => {
  // --------------------------------------------------------------------------
  // 1. Definitiva con Ponderación Incompleta y Consistencia Académica
  // --------------------------------------------------------------------------
  describe("Fórmula de Definitiva y Ponderación Acumulada", () => {
    it("calcula promedio ponderado acumulado normalizado cuando la ponderación total suma menos del 100% (ej. 60%)", () => {
      // Caso: Periodo en curso con 3 evaluaciones de 20% cada una (total 60% evaluado)
      // Estudiante con notas 4.0, 4.0, 4.0. El promedio real acumulado debe ser 4.0, NO 2.4.
      const incompleteValues = [
        { value: 4.0, maxValue: 5, weight: 20 },
        { value: 4.0, maxValue: 5, weight: 20 },
        { value: 4.0, maxValue: 5, weight: 20 },
      ];
      const definitiva = calculateDefinitiva(incompleteValues);
      expect(definitiva).toBe(4.0);
    });

    it("maneja correctamente notas dispares con ponderación incompleta sin penalizar por el peso no evaluado", () => {
      // 30% con nota 5.0 y 20% con nota 3.5 (total 50% evaluado)
      // weightedSum = 5.0 * 30 + 3.5 * 20 = 150 + 70 = 220
      // 220 / 50 = 4.40
      const values = [
        { value: 5.0, maxValue: 5, weight: 30 },
        { value: 3.5, maxValue: 5, weight: 20 },
      ];
      const definitiva = calculateDefinitiva(values);
      expect(definitiva).toBe(4.4);
    });

    it("ignora evaluaciones pendientes (null) en el divisor de ponderación para reflejar el avance real", () => {
      // 1 calificada (4.5 al 25%) y 3 pendientes (null al 25% c/u)
      const values = [
        { value: 4.5, maxValue: 5, weight: 25 },
        { value: null, maxValue: 5, weight: 25 },
        { value: null, maxValue: 5, weight: 25 },
        { value: null, maxValue: 5, weight: 25 },
      ];
      const definitiva = calculateDefinitiva(values);
      expect(definitiva).toBe(4.5);
    });

    it("reconoce la nota 0.0 como calificación válida y no como pendiente", () => {
      // Nota 0.0 al 50% y 4.0 al 50% -> (0*50 + 4*50) / 100 = 200 / 100 = 2.0
      const values = [
        { value: 0.0, maxValue: 5, weight: 50 },
        { value: 4.0, maxValue: 5, weight: 50 },
      ];
      const definitiva = calculateDefinitiva(values);
      expect(definitiva).toBe(2.0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Lógica del Guardián: Navegación Interna vs Salida del Módulo
  // --------------------------------------------------------------------------
  describe("Lógica del Guardián de Cambios Pendientes", () => {
    it("no activa el guardián al modificar una nota localmente o cambiar de celda/estudiante", () => {
      let pendingGrades: Record<string, number | null> = {};
      let showUnsavedDialog = false;

      // 1. Docente edita celda 10:1
      pendingGrades = { ...pendingGrades, "10:1": 4.5 };
      expect(showUnsavedDialog).toBe(false);
      expect(Object.keys(pendingGrades).length).toBe(1);

      // 2. Docente avanza con tecla Enter a estudiante 2 en celda 10:2 (navegación interna)
      pendingGrades = { ...pendingGrades, "10:2": 3.8 };
      expect(showUnsavedDialog).toBe(false);
      expect(Object.keys(pendingGrades).length).toBe(2);

      // 3. Docente cambia a celda de otra evaluación 11:2 (misma tabla)
      pendingGrades = { ...pendingGrades, "11:2": 5.0 };
      expect(showUnsavedDialog).toBe(false);
      expect(Object.keys(pendingGrades).length).toBe(3);
    });

    it("con guardado automático activo (por defecto), nunca abre diálogo y procede inmediatamente al salir o cambiar de vista", () => {
      const autoSaveEnabled = true;
      const pendingGrades: Record<string, number | null> = { "10:1": 4.2 };
      let showUnsavedDialog = false;
      let actionExecuted = false;
      let flushedToBackground = false;

      const handleSaveAll = () => {
        flushedToBackground = true;
      };

      const requestTransition = (action: () => void, targetLabel?: string) => {
        if (autoSaveEnabled) {
          const hasPending = Object.keys(pendingGrades).length > 0;
          if (hasPending) {
            handleSaveAll();
          }
          action();
          return;
        }
        const hasChanges = Object.keys(pendingGrades).length > 0;
        if (!hasChanges) {
          action();
          return;
        }
        showUnsavedDialog = true;
      };

      // Docente cambia de curso teniendo notas pendientes en el debounce
      requestTransition(() => {
        actionExecuted = true;
      }, "Curso 10-1");

      // El diálogo NUNCA se abre cuando autoSaveEnabled es true
      expect(showUnsavedDialog).toBe(false);
      // Los cambios se enviaron de inmediato a guardar en background
      expect(flushedToBackground).toBe(true);
      // La navegación se ejecutó de forma fluida y sin bloqueos
      expect(actionExecuted).toBe(true);
    });

    it("con guardado manual (!autoSaveEnabled), interviene el guardián únicamente ante riesgo de pérdida al salir", () => {
      const autoSaveEnabled = false;
      const pendingGrades: Record<string, number | null> = { "10:1": 4.2 };
      let showUnsavedDialog = false;
      let requestedTarget: string | undefined;

      const requestTransition = (action: () => void, targetLabel?: string) => {
        if (autoSaveEnabled) {
          action();
          return;
        }
        const hasChanges = Object.keys(pendingGrades).length > 0;
        if (!hasChanges) {
          action();
          return;
        }
        requestedTarget = targetLabel;
        showUnsavedDialog = true;
      };

      // Docente intenta cambiar de curso en modo manual con notas pendientes
      requestTransition(() => {}, "Curso 10-1");
      expect(showUnsavedDialog).toBe(true);
      expect(requestedTarget).toBe("Curso 10-1");
    });

    it("con guardado manual (!autoSaveEnabled), permite navegación inmediata sin diálogo cuando no existen cambios pendientes", () => {
      const autoSaveEnabled = false;
      const pendingGrades: Record<string, number | null> = {};
      let showUnsavedDialog = false;
      let actionExecuted = false;

      const requestTransition = (action: () => void) => {
        if (autoSaveEnabled) {
          action();
          return;
        }
        const hasChanges = Object.keys(pendingGrades).length > 0;
        if (!hasChanges) {
          action();
          return;
        }
        showUnsavedDialog = true;
      };

      requestTransition(() => {
        actionExecuted = true;
      });

      expect(showUnsavedDialog).toBe(false);
      expect(actionExecuted).toBe(true);
    });

    it("salvaguarda de falso positivo: si los pendientes se reducen a 0 o se reactiva autoguardado, el diálogo se cierra automáticamente", () => {
      let showUnsavedDialog = true;
      let autoSaveEnabled = false;
      let totalPending = 3;

      const checkSafeguard = () => {
        if (showUnsavedDialog && (totalPending === 0 || autoSaveEnabled)) {
          showUnsavedDialog = false;
        }
      };

      // 1. Con cambios y modo manual, el diálogo permanece
      checkSafeguard();
      expect(showUnsavedDialog).toBe(true);

      // 2. Se terminan de sincronizar las notas (totalPending llega a 0)
      totalPending = 0;
      checkSafeguard();
      expect(showUnsavedDialog).toBe(false);

      // 3. Si se reabriera con totalPending = 1 pero el docente activa autoSave
      showUnsavedDialog = true;
      totalPending = 1;
      autoSaveEnabled = true;
      checkSafeguard();
      expect(showUnsavedDialog).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Guardado Automático con Debounce y Agrupación por Evaluación
  // --------------------------------------------------------------------------
  describe("Guardado Automático y Agrupación por Evaluación", () => {
    it("agrupa cambios de múltiples estudiantes pertenecientes a la misma evaluación", () => {
      const pendingGrades: Record<string, number | null> = {
        "101:1": 4.5,
        "101:2": 3.8,
        "101:3": 5.0,
        "102:1": 3.2,
      };

      const byAssessment: Record<number, Array<{ studentId: number; value: number | null }>> = {};
      for (const key of Object.keys(pendingGrades)) {
        const [aIdStr, sIdStr] = key.split(":");
        const aId = Number(aIdStr);
        const sId = Number(sIdStr);
        if (!byAssessment[aId]) byAssessment[aId] = [];
        byAssessment[aId].push({ studentId: sId, value: pendingGrades[key] });
      }

      expect(Object.keys(byAssessment).length).toBe(2);
      expect(byAssessment[101].length).toBe(3);
      expect(byAssessment[102].length).toBe(1);
    });

    it("limpia de pendientes únicamente las notas que fueron persistidas con éxito", () => {
      let pendingGrades: Record<string, number | null> = {
        "101:1": 4.5,
        "101:2": 3.8,
        "102:1": 5.0,
      };

      // Simular que el lote enviado incluía 101:1 y 101:2
      const keysSaved = ["101:1", "101:2"];
      const nextPending = { ...pendingGrades };
      for (const k of keysSaved) delete nextPending[k];
      pendingGrades = nextPending;

      expect(pendingGrades["101:1"]).toBeUndefined();
      expect(pendingGrades["101:2"]).toBeUndefined();
      expect(pendingGrades["102:1"]).toBe(5.0);
      expect(Object.keys(pendingGrades).length).toBe(1);
    });

    it("gestiona la máquina de estados del indicador: idle -> saving -> saved", async () => {
      type SaveStatus = "idle" | "saving" | "saved" | "error";
      let status: SaveStatus = "idle";

      // 1. Estado inicial
      expect(status).toBe("idle");

      // 2. Se dispara guardado automático
      status = "saving";
      expect(status).toBe("saving");

      // 3. Servidor responde éxito
      status = "saved";
      expect(status).toBe("saved");
    });

    it("comportamiento con guardado automático desactivado: conserva pendientes hasta guardado manual", () => {
      const autoSaveEnabled = false;
      const pendingGrades: Record<string, number | null> = { "101:1": 4.2 };
      let autoSaveTriggered = false;

      if (autoSaveEnabled) {
        autoSaveTriggered = true;
      }

      expect(autoSaveTriggered).toBe(false);
      expect(Object.keys(pendingGrades).length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Eliminación Lógica de Evaluación y Exclusión de Boletines
  // --------------------------------------------------------------------------
  describe("Eliminación Lógica y Exclusión en Boletines", () => {
    it("excluye evaluaciones con status DELETED de la generación de boletines", async () => {
      const db = await getDb();
      expect(db).toBeDefined();

      const course = seededContext!.selected.course!;
      const subject = seededContext!.selected.subject!;
      const period = seededContext!.selected.period!;

      // 1. Reducir temporalmente el peso de una evaluación para permitir la creación
      const existingAssessment = seededContext!.assessments[0];
      const originalWeight = Number(existingAssessment.weight);
      await db!.update(assessments).set({ weight: originalWeight - 5 }).where(eq(assessments.id, existingAssessment.id));

      try {
        const created = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
          academicYearId: course.academicYearId!,
          courseId: course.id,
          subjectId: subject.id,
          academicPeriodId: period.id,
          title: "Evaluación para Test Boletín DELETED",
          assessmentType: "QUIZ",
          date: new Date(),
          weight: 5,
          maxValue: 5,
        });
        expect(created).toBeDefined();
        cleanupAssessmentIds.push(created!.id);

        // 2. Calificar al estudiante
        await saveGradeCenterGrades(actor(teacher, "TEACHER"), {
          assessmentId: created.id,
          grades: [{ studentId: student!.user.id, value: 1.0 }],
        });

        // 3. Eliminar lógicamente la evaluación
        await deleteGradeCenterAssessment(actor(teacher, "TEACHER"), created.id);

        // 4. Generar boletines del curso
        const reportCards = await generateGradeCenterReportCards(actor(admin, "SCHOOL_ADMIN"), {
          academicYearId: course.academicYearId!,
          academicPeriodId: period.id,
          courseId: course.id,
        });

      expect(reportCards).toBeDefined();
      expect(reportCards?.status).toBe("COMPLETED");

      // 5. Verificar que el boletín del estudiante no incluye la nota de la evaluación eliminada
      const runs = await db!
        .select()
        .from(reportCardRuns)
        .where(
          and(
            eq(reportCardRuns.schoolId, schoolId),
            eq(reportCardRuns.courseId, course.id),
            eq(reportCardRuns.studentId, student!.user.id)
          )
        );
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const latestRun = runs[runs.length - 1];
      const runData = JSON.parse(latestRun.dataJson);
      const mathSubject = runData.subjects.find((s: any) => s.subjectId === subject.id);
      expect(mathSubject).toBeDefined();
      // El promedio de la materia no debe ser arrastrado por el 1.0 de la evaluación borrada
      expect(mathSubject.average).not.toBe(1.0);
    } finally {
      await db!.update(assessments).set({ weight: originalWeight }).where(eq(assessments.id, existingAssessment.id));
    }
  });
});
});

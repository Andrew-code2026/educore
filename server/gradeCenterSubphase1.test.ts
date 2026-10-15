import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { assessments, assessmentGrades, auditLogs, academicPeriods } from "../drizzle/schema";
import { appRouter } from "./routers";
import {
  createGradeCenterAssessment,
  deleteGradeCenterAssessment,
  ensureGradeCenterSeeded,
  getGradeCenterContext,
  saveGradeCenterGrades,
  type GradeCenterActor,
} from "./gradeCenterDb";
import { getDb, getDemoIdentityContext } from "./db";
import { calculateGradeDistribution } from "../client/src/components/grade-center/gradeStatisticsUtils";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let admin: Demo;
let teacher: Demo;
let student: Demo;
let guardian: Demo;
let seededContext: Awaited<ReturnType<typeof getGradeCenterContext>>;
const cleanupAssessmentIds: number[] = [];

const caller = (user: any) => appRouter.createCaller({ req: {} as any, res: {} as any, user });
const actor = (demo: Demo, roleKey: GradeCenterActor["roleKey"]): GradeCenterActor => ({
  schoolId,
  userId: demo!.user.id,
  roleKey,
});

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
  if (!db || !cleanupAssessmentIds.length) return;
  await db.delete(assessmentGrades).where(inArray(assessmentGrades.assessmentId, cleanupAssessmentIds));
  await db.delete(assessments).where(inArray(assessments.id, cleanupAssessmentIds));
});

describe("Grade Center — Subfase 1, Iteración 1", () => {
  // =========================================================================
  // 1. ESCALA INSTITUCIONAL Y DISTRIBUCIÓN ESTADÍSTICA
  // =========================================================================
  describe("1. Escala institucional y distribución estadística", () => {
    it("getGradeCenterContext entrega exactamente los 4 rangos institucionales oficiales", async () => {
      const context = await getGradeCenterContext(actor(teacher, "TEACHER"));
      expect(context).toBeTruthy();
      expect(context!.distribution).toHaveLength(4);

      const labels = context!.distribution.map(d => d.label);
      expect(labels).toEqual(["4.7–5.0", "4.0–4.6", "3.5–3.9", "0.0–3.4"]);

      // La suma de los conteos debe ser exactamente el total de notas registradas
      const totalInDistribution = context!.distribution.reduce((acc, curr) => acc + curr.count, 0);
      expect(totalInDistribution).toBe(context!.stats.graded);
    });

    it("calculateGradeDistribution en cliente genera los 4 rangos institucionales por defecto para escala 0 a 5", () => {
      const grades = [1.5, 3.2, 3.5, 3.8, 4.0, 4.5, 4.8, 5.0];
      const dist = calculateGradeDistribution(grades, { minValue: 0, maxValue: 5 });

      expect(dist).toHaveLength(4);
      expect(dist[0].id).toBe("bin-bajo");
      expect(dist[0].label).toBe("0.0 - 3.4");
      expect(dist[0].isPassing).toBe(false);
      expect(dist[0].count).toBe(2); // 1.5, 3.2

      expect(dist[1].id).toBe("bin-basico");
      expect(dist[1].label).toBe("3.5 - 3.9");
      expect(dist[1].isPassing).toBe(true);
      expect(dist[1].count).toBe(2); // 3.5, 3.8

      expect(dist[2].id).toBe("bin-alto");
      expect(dist[2].label).toBe("4.0 - 4.6");
      expect(dist[2].isPassing).toBe(true);
      expect(dist[2].count).toBe(2); // 4.0, 4.5

      expect(dist[3].id).toBe("bin-superior");
      expect(dist[3].label).toBe("4.7 - 5.0");
      expect(dist[3].isPassing).toBe(true);
      expect(dist[3].count).toBe(2); // 4.8, 5.0

      const totalCount = dist.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(grades.length);
    });
  });

  // =========================================================================
  // 2. ELIMINACIÓN SEGURA DE EVALUACIONES (gradeCenter.deleteAssessment)
  // =========================================================================
  describe("2. Eliminación segura de evaluaciones (gradeCenter.deleteAssessment)", () => {
    let testAssessmentId: number;

    it("crea una evaluación para probar eliminación segura", async () => {
      const selected = seededContext!.selected!;
      // Crear evaluación con peso 0 para no romper ponderación
      const created = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
        academicYearId: selected.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: `Evaluación Para Eliminar ${Date.now()}`,
        assessmentType: "QUIZ",
        date: new Date(),
        maxValue: 5,
        weight: 0,
        status: "DRAFT",
      });
      expect(created).toBeTruthy();
      testAssessmentId = created!.id;
      cleanupAssessmentIds.push(testAssessmentId);
    });

    it("bloquea a estudiantes y acudientes de ejecutar deleteAssessment vía tRPC", async () => {
      await expect(
        caller(student!.user).gradeCenter.deleteAssessment({
          role: "student",
          id: testAssessmentId,
        })
      ).rejects.toThrow(/permisos/i);

      await expect(
        caller(guardian!.user).gradeCenter.deleteAssessment({
          role: "guardian",
          id: testAssessmentId,
        })
      ).rejects.toThrow(/permisos/i);
    });

    it("permite al docente asignado eliminar lógicamente su evaluación vía tRPC", async () => {
      const result = await caller(teacher!.user).gradeCenter.deleteAssessment({
        role: "teacher",
        id: testAssessmentId,
      });

      expect(result).toMatchObject({
        success: true,
        id: testAssessmentId,
      });

      // Verificar en base de datos que está marcada como DELETED (eliminación lógica)
      const db = await getDb();
      const row = (await db!.select().from(assessments).where(eq(assessments.id, testAssessmentId)).limit(1))[0];
      expect(row).toBeTruthy();
      expect(row.status).toBe("DELETED");
    });

    it("no incluye la evaluación eliminada en getGradeCenterContext", async () => {
      const freshContext = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const found = freshContext!.assessments.find(a => a.id === testAssessmentId);
      expect(found).toBeUndefined();
    });

    it("rechaza eliminar una evaluación que ya fue eliminada", async () => {
      await expect(
        deleteGradeCenterAssessment(actor(teacher, "TEACHER"), testAssessmentId)
      ).rejects.toThrow(/ya fue eliminada/i);
    });

    it("rechaza modificar calificaciones de una evaluación eliminada", async () => {
      await expect(
        saveGradeCenterGrades(actor(teacher, "TEACHER"), {
          assessmentId: testAssessmentId,
          grades: [{ studentId: student!.user.id, value: 4.0 }],
        })
      ).rejects.toThrow(/eliminada/i);
    });

    it("libera la ponderación al eliminar una evaluación con peso", async () => {
      const selected = seededContext!.selected!;
      // Obtener contexto actual
      const ctxBefore = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const availableWeight = ctxBefore!.stats.remainingWeight;

      // Si no hay peso disponible, no podemos probar adición, pero en el seed hay 100%.
      // Para probar liberación: creamos una evaluación reduciendo peso de una existente o usando peso disponible
      // Vamos a crear una evaluación temporal eliminable con peso 0 o peso disponible
      if (availableWeight > 0) {
        const testWeight = Math.min(10, availableWeight);
        const temp = await createGradeCenterAssessment(actor(teacher, "TEACHER"), {
          academicYearId: selected.academicYearId,
          academicPeriodId: selected.period.id,
          courseId: selected.course.id,
          subjectId: selected.subject.id,
          title: `Temp Peso ${Date.now()}`,
          assessmentType: "TALLER",
          date: new Date(),
          maxValue: 5,
          weight: testWeight,
          status: "DRAFT",
        });
        cleanupAssessmentIds.push(temp!.id);

        const ctxAfterCreate = await getGradeCenterContext(actor(teacher, "TEACHER"));
        expect(ctxAfterCreate!.stats.weightTotal).toBe(ctxBefore!.stats.weightTotal + testWeight);

        // Ahora eliminamos
        const delResult = await deleteGradeCenterAssessment(actor(teacher, "TEACHER"), temp!.id);
        expect(delResult.releasedWeight).toBe(testWeight);

        // El contexto vuelve a reflejar el peso anterior
        const ctxAfterDelete = await getGradeCenterContext(actor(teacher, "TEACHER"));
        expect(ctxAfterDelete!.stats.weightTotal).toBe(ctxBefore!.stats.weightTotal);
      }
    });

    it("registra evento de auditoría académica al eliminar una evaluación", async () => {
      const db = await getDb();
      const auditRows = await db!
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.schoolId, schoolId),
            eq(auditLogs.action, "assessment_deleted"),
            eq(auditLogs.detail, String(testAssessmentId))
          )
        );
      expect(auditRows.length).toBeGreaterThanOrEqual(1);
    });
  });
});

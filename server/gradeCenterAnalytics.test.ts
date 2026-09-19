import { describe, expect, it } from "vitest";
import {
  calculateCourseHealth,
  detectCourseProblems,
  getAssessmentsHighlights,
  getStudentsNeedingAttention,
  generateCourseDeterministicInsights,
  calculateCourseDistributionBrackets,
  type CourseHealthResult,
} from "../client/src/components/grade-center/gradeAnalyticsIntelligence";
import {
  calculateAdvancedGroupStats,
  type AdvancedGroupStatistics,
} from "../client/src/components/grade-center/gradeStatisticsUtils";
import type { GradeCenterTableRow, Assessment } from "../client/src/components/grade-center/GradeCenterTable";

describe("Fase 5.3-F: Análisis Inteligente del Grade Center", () => {
  const standardScale = {
    id: 1,
    name: "Escala Estándar Colombia (0 - 5)",
    minValue: 0,
    maxValue: 5,
    passingGrade: 3.0,
    decimalPlaces: 1,
    isDefault: true,
  };

  const mockAssessments: Assessment[] = [
    {
      id: 201,
      title: "Quiz de derivadas",
      assessmentType: "QUIZ",
      weight: "20",
      maxValue: "5",
      date: new Date("2026-02-05"),
    },
    {
      id: 202,
      title: "Proyecto aplicado",
      assessmentType: "PROYECTO",
      weight: "30",
      maxValue: "5",
      date: new Date("2026-02-20"),
    },
    {
      id: 203,
      title: "Parcial 1",
      assessmentType: "EXAMEN",
      weight: "25",
      maxValue: "5",
      date: new Date("2026-03-05"),
    },
    {
      id: 204,
      title: "Taller de funciones",
      assessmentType: "TALLER",
      weight: "20",
      maxValue: "5",
      date: new Date("2026-03-20"),
    },
  ];

  // Helper para construir filas de prueba
  function createMockRow(
    studentId: number,
    studentNameStr: string,
    grades: Array<number | null>,
    definitiva?: number
  ): GradeCenterTableRow {
    const parts = studentNameStr.split(" ");
    return {
      enrollment: { id: studentId, studentUserId: studentId },
      student: {
        id: studentId,
        name: studentNameStr,
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
      },
      values: mockAssessments.map((ass, i) => ({
        assessment: ass,
        grade: grades[i] !== null ? { value: grades[i] } : null,
      })),
      average: definitiva,
    };
  }

  describe("1. Salud del Curso (calculateCourseHealth)", () => {
    it("clasifica como NO_DATA cuando no hay estudiantes o notas", () => {
      const stats = calculateAdvancedGroupStats([], mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);
      expect(health.level).toBe("NO_DATA");
      expect(health.label).toBe("Sin datos");
      expect(health.reasons.length).toBeGreaterThan(0);
    });

    it("clasifica como CRITICAL cuando la tasa de aprobación es inferior al 70%", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [2.0, 2.0, 2.0, 2.0], 2.0),
        createMockRow(2, "Carlos Ruiz", [2.5, 2.5, 2.5, 2.5], 2.5),
        createMockRow(3, "Beatriz León", [4.5, 4.5, 4.5, 4.5], 4.5),
      ];
      // 1 de 3 aprueba = 33% aprobación
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);

      expect(health.level).toBe("CRITICAL");
      expect(health.label).toBe("Atención prioritaria");
      expect(health.statusText).toContain("Atención prioritaria");
      expect(health.reasons.some(r => r.includes("aprobación"))).toBe(true);
    });

    it("clasifica como CRITICAL cuando el promedio grupal es menor que la nota mínima", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [2.5, 2.5, 2.5, 2.5], 2.5),
        createMockRow(2, "Carlos Ruiz", [2.8, 2.8, 2.8, 2.8], 2.8),
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);

      expect(health.level).toBe("CRITICAL");
      expect(health.reasons.some(r => r.includes("promedio grupal"))).toBe(true);
    });

    it("clasifica como ATTENTION cuando la aprobación está entre 70% y 84% o hay al menos 1 estudiante en riesgo", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [4.5, 4.5, 4.5, 4.5], 4.5),
        createMockRow(2, "Carlos Ruiz", [4.0, 4.0, 4.0, 4.0], 4.0),
        createMockRow(3, "Diana López", [3.8, 3.8, 3.8, 3.8], 3.8),
        createMockRow(4, "Felipe Castro", [3.5, 3.5, 3.5, 3.5], 3.5),
        createMockRow(5, "Gabriel Mora", [2.8, 2.8, 2.8, 2.8], 2.8), // 1 en riesgo -> 80% aprobación
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);

      expect(health.level).toBe("ATTENTION");
      expect(health.label).toBe("Requiere atención");
      expect(health.reasons.some(r => r.includes("riesgo académico") || r.includes("Aprobación"))).toBe(true);
    });

    it("clasifica como GOOD cuando aprobación >= 85%, promedio sólido y sin riesgo", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [4.5, 4.8, 4.5, 4.7], 4.6),
        createMockRow(2, "Carlos Ruiz", [4.0, 4.2, 4.1, 4.3], 4.15),
        createMockRow(3, "Diana López", [3.8, 4.0, 3.9, 4.1], 3.95),
        createMockRow(4, "Felipe Castro", [4.2, 4.4, 4.3, 4.5], 4.35),
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);

      expect(health.level).toBe("GOOD");
      expect(health.label).toBe("Buen rendimiento");
      expect(health.reasons.some(r => r.includes("Aprobación consolidada"))).toBe(true);
    });
  });

  describe("2. Detección Determinista de Problemas (detectCourseProblems)", () => {
    it("detecta la peor evaluación con acción directa cuando su rendimiento es bajo", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [2.5, 4.5, 4.5, 4.8]),
        createMockRow(2, "Carlos Ruiz", [2.8, 4.2, 4.0, 4.6]),
        createMockRow(3, "Diana López", [3.0, 4.0, 4.2, 4.7]),
      ];
      // Quiz 201 tiene promedio ~2.76 vs ~4.3 del resto
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const problems = detectCourseProblems(stats, rows, mockAssessments, {}, standardScale, 95);

      const assProblem = problems.find(p => p.actionType === "ASSESSMENT");
      expect(assProblem).toBeDefined();
      expect(assProblem?.title).toContain("Quiz de derivadas");
      expect(assProblem?.actionLabel).toBe("Ver evaluación");
      expect(assProblem?.targetId).toBe(201);
    });

    it("detecta calificaciones pendientes contextualizando estudiantes afectados", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [4.0, null, 4.5, null]),
        createMockRow(2, "Carlos Ruiz", [4.2, 4.0, null, null]),
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const problems = detectCourseProblems(stats, rows, mockAssessments, {}, standardScale, 95);

      const pendingProblem = problems.find(p => p.actionType === "PENDING");
      expect(pendingProblem).toBeDefined();
      expect(pendingProblem?.title).toContain("pendientes");
      expect(pendingProblem?.description).toContain("2 estudiantes");
      expect(pendingProblem?.actionLabel).toBe("Ver pendientes");
    });

    it("detecta alerta de ponderación incompleta cuando suma < 100", () => {
      const rows = [createMockRow(1, "Ana Gómez", [4.0, 4.0, 4.0, 4.0])];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const problems = detectCourseProblems(stats, rows, mockAssessments, {}, standardScale, 95);

      const weightProblem = problems.find(p => p.actionType === "WEIGHT");
      expect(weightProblem).toBeDefined();
      expect(weightProblem?.title).toContain("Ponderación incompleta");
      expect(weightProblem?.description).toContain("95% asignado");
      expect(weightProblem?.description).toContain("5% restante");
    });
  });

  describe("3. Mejor y Peor Evaluación (getAssessmentsHighlights)", () => {
    it("identifica con precisión la mejor y peor evaluación del grupo", () => {
      const rows = [
        createMockRow(1, "Estudiante 1", [3.0, 3.5, 4.0, 4.8]),
        createMockRow(2, "Estudiante 2", [3.2, 3.8, 4.2, 4.9]),
        createMockRow(3, "Estudiante 3", [3.1, 3.6, 4.1, 4.7]),
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const highlights = getAssessmentsHighlights(stats.assessmentComparison);

      expect(highlights.best).toBeDefined();
      expect(highlights.best?.title).toBe("Taller de funciones");
      expect(highlights.best?.average).toBeGreaterThan(4.5);

      expect(highlights.attention).toBeDefined();
      expect(highlights.attention?.title).toBe("Quiz de derivadas");
      expect(highlights.attention?.average).toBeLessThan(3.5);
    });
  });

  describe("4. Estudiantes que Requieren Atención (getStudentsNeedingAttention)", () => {
    it("filtra solo los estudiantes relevantes con su riesgo y definitiva", () => {
      const rows = [
        createMockRow(1, "María Camila", [2.5, 2.5, 2.6, 2.8], 2.6), // Riesgo ALTO
        createMockRow(2, "Carlos Pérez", [2.9, 3.0, 2.8, null], 2.9), // Riesgo MEDIO (puede recuperar en la pendiente)
        createMockRow(3, "Estudiante Excelente 1", [4.8, 5.0, 4.9, 5.0], 4.9),
        createMockRow(4, "Estudiante Excelente 2", [4.5, 4.7, 4.6, 4.8], 4.65),
      ];

      const attentionList = getStudentsNeedingAttention(rows, mockAssessments, {}, standardScale, 4);

      expect(attentionList.length).toBe(2);
      expect(attentionList[0].studentName).toBe("María Camila");
      expect(attentionList[0].currentDefinitiva).toBe(2.6);
      expect(attentionList[0].risk.level).toBe("ALTO");

      expect(attentionList[1].studentName).toBe("Carlos Pérez");
      expect(attentionList[1].currentDefinitiva).toBe(2.9);
      expect(attentionList[1].risk.level).toBe("MEDIO");
    });
  });

  describe("5. Insights Deterministas de EduCore (generateCourseDeterministicInsights)", () => {
    it("genera insights objetivos explicando qué se detectó y por qué importa sin inventar causas", () => {
      const rows = [
        createMockRow(1, "Ana Gómez", [3.2, 4.5, 4.2, 4.8]),
        createMockRow(2, "Carlos Ruiz", [3.4, 4.2, 4.0, 4.6]),
        createMockRow(3, "Diana López", [3.3, 4.0, 4.1, 4.7]),
      ];
      const stats = calculateAdvancedGroupStats(rows, mockAssessments, {}, standardScale);
      const health = calculateCourseHealth(stats, mockAssessments, 95);
      const problems = detectCourseProblems(stats, rows, mockAssessments, {}, standardScale, 95);
      const insights = generateCourseDeterministicInsights(stats, health, problems, standardScale);

      expect(insights.length).toBeGreaterThanOrEqual(2);
      expect(insights.length).toBeLessThanOrEqual(4);

      // Cada insight debe tener observation y significance
      insights.forEach(ins => {
        expect(ins.observation).toBeDefined();
        expect(ins.observation.length).toBeGreaterThan(10);
        expect(ins.significance).toBeDefined();
        expect(ins.significance.length).toBeGreaterThan(10);
      });

      // Debe detectar la brecha entre Quiz y Taller
      const gapInsight = insights.find(i => i.id === "insight-gap-assessments");
      expect(gapInsight).toBeDefined();
      expect(gapInsight?.observation).toContain("Quiz de derivadas");
      expect(gapInsight?.observation).toContain("Taller de funciones");
    });
  });

  describe("6. Distribución de Calificaciones (calculateCourseDistributionBrackets)", () => {
    it("distribuye las definitivas en los 4 rangos institucionales correctos", () => {
      const definitivas = [
        4.8, 4.7, // 2 Superior
        4.2, 4.4, 4.0, // 3 Alto
        3.5, 3.2, 3.8, // 3 Básico
        2.5, 2.8, // 2 Bajo
      ]; // Total 10

      const brackets = calculateCourseDistributionBrackets(definitivas, standardScale);

      expect(brackets.length).toBe(4);

      const superior = brackets.find(b => b.id === "superior");
      expect(superior?.count).toBe(2);
      expect(superior?.percentage).toBe(20);

      const alto = brackets.find(b => b.id === "alto");
      expect(alto?.count).toBe(3);
      expect(alto?.percentage).toBe(30);

      const basico = brackets.find(b => b.id === "basico");
      expect(basico?.count).toBe(3);
      expect(basico?.percentage).toBe(30);

      const bajo = brackets.find(b => b.id === "bajo");
      expect(bajo?.count).toBe(2);
      expect(bajo?.percentage).toBe(20);
    });
  });
});
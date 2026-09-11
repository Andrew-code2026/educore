import { describe, expect, it } from "vitest";
import {
  calculateAverage,
  calculateMean,
  calculateMedian,
  calculateMinimum,
  calculateMaximum,
  calculateMinMax,
  calculateStandardDeviation,
  calculateApprovalRate,
  calculateGradeDistribution,
  calculateAssessmentStatistics,
  calculateAssessmentStats,
  calculateAssessmentsComparison,
  calculatePerformanceEvolution,
  calculateGroupEvolution,
  calculateStudentStatistics,
  calculateStudentEvolution,
  generateTeacherInsights,
  calculateAdvancedGroupStats,
  getInstitutionalPassingGrade,
} from "../client/src/components/grade-center/gradeStatisticsUtils";
import type { GradeCenterTableRow, Assessment } from "../client/src/components/grade-center/GradeCenterTable";

describe("Fase 5.3-D: Estadísticas Avanzadas del Grade Center — 16 Pruebas Obligatorias", () => {
  const standardScale = {
    id: 1,
    name: "Escala Estándar Colombia (0 - 5)",
    minValue: 0,
    maxValue: 5,
    passingGrade: 3.0,
    decimalPlaces: 1,
    isDefault: true,
  };

  const scale100 = {
    id: 2,
    name: "Escala Porcentual (0 - 100)",
    minValue: 0,
    maxValue: 100,
    passingGrade: 60,
    decimalPlaces: 0,
    isDefault: false,
  };

  const scale10 = {
    id: 3,
    name: "Escala 0 a 10",
    minValue: 0,
    maxValue: 10,
    passingGrade: 6.0,
    decimalPlaces: 1,
    isDefault: false,
  };

  const mockAssessments: Assessment[] = [
    {
      id: 101,
      title: "Quiz 1",
      assessmentType: "QUIZ",
      weight: "20",
      maxValue: "5",
      date: new Date("2026-02-01"),
    },
    {
      id: 102,
      title: "Taller 1",
      assessmentType: "TALLER",
      weight: "30",
      maxValue: "5",
      date: new Date("2026-02-15"),
    },
    {
      id: 103,
      title: "Parcial 1",
      assessmentType: "EXAMEN",
      weight: "50",
      maxValue: "5",
      date: new Date("2026-03-01"),
    },
  ];

  const mockRows: GradeCenterTableRow[] = [
    {
      enrollment: { id: 1, studentUserId: 1, courseId: 10, academicYearId: 2026 },
      student: { id: 1, givenNames: "Sofía", familyNames: "Martínez" },
      values: [
        { assessment: mockAssessments[0], grade: { value: "4.5" } },
        { assessment: mockAssessments[1], grade: { value: "4.0" } },
        { assessment: mockAssessments[2], grade: { value: "4.8" } },
      ],
      average: 4.5,
    },
    {
      enrollment: { id: 2, studentUserId: 2, courseId: 10, academicYearId: 2026 },
      student: { id: 2, givenNames: "Mateo", familyNames: "Gómez" },
      values: [
        { assessment: mockAssessments[0], grade: { value: "3.5" } },
        { assessment: mockAssessments[1], grade: { value: "3.0" } },
        { assessment: mockAssessments[2], grade: { value: "3.2" } },
      ],
      average: 3.2,
    },
    {
      enrollment: { id: 3, studentUserId: 3, courseId: 10, academicYearId: 2026 },
      student: { id: 3, givenNames: "Daniel", familyNames: "Rodríguez" },
      values: [
        { assessment: mockAssessments[0], grade: { value: "2.5" } },
        { assessment: mockAssessments[1], grade: { value: "2.0" } },
        { assessment: mockAssessments[2], grade: { value: "2.8" } },
      ],
      average: 2.5,
    },
    {
      enrollment: { id: 4, studentUserId: 4, courseId: 10, academicYearId: 2026 },
      student: { id: 4, givenNames: "Laura", familyNames: "Pérez" },
      values: [
        { assessment: mockAssessments[0], grade: { value: "5.0" } },
        { assessment: mockAssessments[1], grade: { value: "4.8" } },
        { assessment: mockAssessments[2], grade: { value: null } },
      ],
      average: 4.88,
    },
  ];

  // ========================================================
  // 1. PROMEDIO (calculateAverage / calculateMean)
  // ========================================================
  describe("1. Promedio (calculateAverage)", () => {
    it("computes arithmetic mean with correct decimal precision", () => {
      expect(calculateAverage([4.0, 4.5, 3.5])).toBe(4.0);
      expect(calculateMean([3.0, 4.0])).toBe(3.5);
      expect(calculateAverage([2.8, 3.5, 4.1])).toBe(3.47);
    });

    it("returns null for empty array", () => {
      expect(calculateAverage([])).toBeNull();
      expect(calculateMean([])).toBeNull();
    });
  });

  // ========================================================
  // 2. MEDIANA (calculateMedian)
  // ========================================================
  describe("2. Mediana (calculateMedian)", () => {
    it("computes median for odd count of elements (ordered and unordered)", () => {
      expect(calculateMedian([3.0, 4.0, 5.0])).toBe(4.0);
      expect(calculateMedian([5.0, 1.0, 3.0])).toBe(3.0);
    });

    it("computes median for even count of elements (average of two central elements)", () => {
      expect(calculateMedian([3.0, 3.5, 4.5, 5.0])).toBe(4.0);
      expect(calculateMedian([2.0, 4.0])).toBe(3.0);
    });

    it("returns null for empty array", () => {
      expect(calculateMedian([])).toBeNull();
    });
  });

  // ========================================================
  // 3. MÍNIMO (calculateMinimum)
  // ========================================================
  describe("3. Mínimo (calculateMinimum)", () => {
    it("finds the minimum number in a list", () => {
      expect(calculateMinimum([3.5, 1.2, 4.8, 5.0])).toBe(1.2);
      expect(calculateMinimum([0.0, 2.5, 5.0])).toBe(0.0);
    });

    it("returns null for empty array", () => {
      expect(calculateMinimum([])).toBeNull();
    });
  });

  // ========================================================
  // 4. MÁXIMO (calculateMaximum)
  // ========================================================
  describe("4. Máximo (calculateMaximum)", () => {
    it("finds the maximum number in a list", () => {
      expect(calculateMaximum([3.5, 1.2, 4.8, 5.0])).toBe(5.0);
      expect(calculateMaximum([2.1, 4.9, 3.8])).toBe(4.9);
    });

    it("returns null for empty array", () => {
      expect(calculateMaximum([])).toBeNull();
    });
  });

  // ========================================================
  // 5. DESVIACIÓN ESTÁNDAR (calculateStandardDeviation)
  // ========================================================
  describe("5. Desviación Estándar (calculateStandardDeviation)", () => {
    it("computes population standard deviation accurately", () => {
      // Data with known standard deviation:
      // Values: [2, 4, 4, 4, 5, 5, 7, 9], Mean: 5, Variance: 4, StdDev: 2.0
      expect(calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2.0);
    });

    it("returns 0 for single value array", () => {
      expect(calculateStandardDeviation([4.5])).toBe(0);
    });

    it("returns 0 for array with all identical values", () => {
      expect(calculateStandardDeviation([3.5, 3.5, 3.5, 3.5])).toBe(0);
    });

    it("returns null for empty array", () => {
      expect(calculateStandardDeviation([])).toBeNull();
    });
  });

  // ========================================================
  // 6. APROBACIÓN (calculateApprovalRate)
  // ========================================================
  describe("6. Aprobación (calculateApprovalRate)", () => {
    it("computes passing rate and counts accurately according to scale", () => {
      // Scale standard passing grade is 3.0:
      // Grades: 2.0 (failing), 3.0 (passing), 4.0 (passing), 4.5 (passing) -> 3 out of 4 (75%)
      const result = calculateApprovalRate([2.0, 3.0, 4.0, 4.5], standardScale);
      expect(result.totalCount).toBe(4);
      expect(result.passingCount).toBe(3);
      expect(result.failingCount).toBe(1);
      expect(result.rate).toBe(75);
    });

    it("returns 0 rate and counts for empty array", () => {
      const result = calculateApprovalRate([], standardScale);
      expect(result.totalCount).toBe(0);
      expect(result.passingCount).toBe(0);
      expect(result.rate).toBe(0);
    });
  });

  // ========================================================
  // 7. VALORES VACÍOS
  // ========================================================
  describe("7. Valores vacíos", () => {
    it("sanitizes arrays containing null, undefined, or empty values", () => {
      const mixedValues = [null, 4.0, undefined, "3.5", null, 4.5];
      expect(calculateAverage(mixedValues as any)).toBe(4.0);
      expect(calculateMedian(mixedValues as any)).toBe(4.0);
      expect(calculateMinimum(mixedValues as any)).toBe(3.5);
      expect(calculateMaximum(mixedValues as any)).toBe(4.5);
    });
  });

  // ========================================================
  // 8. TODOS LOS VALORES VACÍOS
  // ========================================================
  describe("8. Todos los valores vacíos", () => {
    it("handles all empty/null inputs without runtime errors", () => {
      const emptyArray = [null, undefined, null];
      expect(calculateAverage(emptyArray as any)).toBeNull();
      expect(calculateMedian(emptyArray as any)).toBeNull();
      expect(calculateMinimum(emptyArray as any)).toBeNull();
      expect(calculateMaximum(emptyArray as any)).toBeNull();
      expect(calculateStandardDeviation(emptyArray as any)).toBeNull();
      expect(calculateApprovalRate(emptyArray as any, standardScale).rate).toBe(0);
    });
  });

  // ========================================================
  // 9. UNA SOLA NOTA
  // ========================================================
  describe("9. Una sola nota", () => {
    it("returns the exact note for average, median, min, max and 0 for stdDev", () => {
      const single = [4.2];
      expect(calculateAverage(single)).toBe(4.2);
      expect(calculateMedian(single)).toBe(4.2);
      expect(calculateMinimum(single)).toBe(4.2);
      expect(calculateMaximum(single)).toBe(4.2);
      expect(calculateStandardDeviation(single)).toBe(0);
      expect(calculateApprovalRate(single, standardScale).rate).toBe(100);
    });

    it("returns 0% approval if the single note is below passing grade", () => {
      const failingSingle = [2.5];
      expect(calculateApprovalRate(failingSingle, standardScale).rate).toBe(0);
      expect(calculateApprovalRate(failingSingle, standardScale).failingCount).toBe(1);
    });
  });

  // ========================================================
  // 10. DISTRIBUCIÓN (calculateGradeDistribution)
  // ========================================================
  describe("10. Distribución (calculateGradeDistribution)", () => {
    it("generates adaptive bins covering the scale range", () => {
      const dist = calculateGradeDistribution([1.0, 2.5, 3.2, 4.0, 5.0], standardScale, 5);
      expect(dist.length).toBe(5);
      // Top boundary (5.0) included in the last bin
      expect(dist[4].count).toBeGreaterThanOrEqual(1);

      const totalCount = dist.reduce((acc, bin) => acc + bin.count, 0);
      expect(totalCount).toBe(5);
    });

    it("correctly flags bins as passing or failing based on institutional threshold", () => {
      const dist = calculateGradeDistribution([1.0, 2.5, 3.5, 4.5], standardScale, 5);
      // Bins below 3.0 should be isPassing: false
      expect(dist[0].isPassing).toBe(false);
      // Bins reaching >= 3.0 should be isPassing: true
      expect(dist[3].isPassing).toBe(true);
    });
  });

  // ========================================================
  // 11. ESTADÍSTICAS POR ACTIVIDAD (calculateAssessmentStatistics)
  // ========================================================
  describe("11. Estadísticas por actividad (calculateAssessmentStatistics)", () => {
    it("computes complete metrics and pedagogical interpretation for an assessment", () => {
      const stats = calculateAssessmentStatistics(mockAssessments[0], mockRows, {}, standardScale);
      expect(stats.assessmentId).toBe(101);
      expect(stats.title).toBe("Quiz 1");
      expect(stats.evaluatedCount).toBe(4);
      expect(stats.pendingCount).toBe(0);
      expect(stats.average).toBe(3.88);
      expect(stats.minGrade).toBe(2.5);
      expect(stats.maxGrade).toBe(5.0);
      expect(stats.standardDeviation).toBeGreaterThan(0);
      expect(stats.passingPercentage).toBe(75); // 3 of 4 passed (4.5, 3.5, 5.0)
      expect(typeof stats.interpretation).toBe("string");
      expect(stats.interpretation.length).toBeGreaterThan(5);
    });

    it("correctly identifies pending count in incomplete assessments", () => {
      // Parcial 1 has 1 pending grade (Laura)
      const stats = calculateAssessmentStatistics(mockAssessments[2], mockRows, {}, standardScale);
      expect(stats.evaluatedCount).toBe(3);
      expect(stats.pendingCount).toBe(1);
    });
  });

  // ========================================================
  // 12. EVOLUCIÓN (calculatePerformanceEvolution / calculateGroupEvolution)
  // ========================================================
  describe("12. Evolución temporal grupal (calculatePerformanceEvolution)", () => {
    it("builds chronological sequence of activities with progression deltas", () => {
      const evolution = calculatePerformanceEvolution(mockAssessments, mockRows, {}, standardScale);
      expect(evolution.timeline.length).toBe(3);
      expect(evolution.timeline[0].index).toBe(1);
      expect(evolution.timeline[0].assessmentTitle).toBe("Quiz 1");
      expect(evolution.timeline[0].groupAverage).toBe(3.88);
      expect(evolution.timeline[1].index).toBe(2);
      expect(evolution.timeline[2].index).toBe(3);

      expect(evolution.firstAssessment?.title).toBe("Quiz 1");
      expect(evolution.latestAssessment?.title).toBe("Parcial 1");
      expect(evolution.trend).toBeDefined();
    });
  });

  // ========================================================
  // 13. ESTUDIANTE INDIVIDUAL (calculateStudentStatistics)
  // ========================================================
  describe("13. Estudiante individual (calculateStudentStatistics)", () => {
    it("computes student metrics, delta vs group and relative group ranking", () => {
      const groupAverages = { 101: 3.88, 102: 3.45, 103: 3.60 };
      const sofia = mockRows[0];
      const stats = calculateStudentStatistics(sofia, mockAssessments, {}, groupAverages, 3.6, mockRows, standardScale);

      expect(stats.studentName).toBe("Sofía Martínez");
      expect(stats.evaluatedCount).toBe(3);
      expect(stats.pendingCount).toBe(0);
      expect(stats.currentAverage).toBe(4.5);
      expect(stats.deltaVsGroup).toBe(0.9); // 4.5 - 3.6
      expect(stats.vsGroupLabel).toContain("sobre el promedio");

      // Relative rank: Sofía (4.5) is #2 after Laura (4.88)
      expect(stats.relativeRank).toBeDefined();
      expect(stats.relativeRank?.position).toBe(2);
      expect(stats.relativeRank?.total).toBe(4);
      expect(stats.bestAssessment?.title).toBe("Parcial 1");
    });
  });

  // ========================================================
  // 14. ESCALA INSTITUCIONAL DIFERENTE
  // ========================================================
  describe("14. Escala institucional diferente (0-10 and 0-100)", () => {
    it("adapts calculations and approval threshold to 0-10 scale", () => {
      expect(getInstitutionalPassingGrade(scale10)).toBe(6.0);
      const passingResult = calculateApprovalRate([5.5, 6.0, 7.5, 9.0], scale10);
      expect(passingResult.passingCount).toBe(3);
      expect(passingResult.failingCount).toBe(1);
      expect(passingResult.rate).toBe(75);
    });

    it("adapts calculations and approval threshold to 0-100 scale", () => {
      expect(getInstitutionalPassingGrade(scale100)).toBe(60);
      const passingResult = calculateApprovalRate([50, 60, 80, 95], scale100);
      expect(passingResult.passingCount).toBe(3);
      expect(passingResult.failingCount).toBe(1);
      expect(passingResult.rate).toBe(75);
    });
  });

  // ========================================================
  // 15. DIVISIÓN POR CERO
  // ========================================================
  describe("15. División por cero", () => {
    it("safely handles 0 students in calculateAdvancedGroupStats without NaN or crash", () => {
      const emptyStats = calculateAdvancedGroupStats([], mockAssessments, {}, standardScale);
      expect(emptyStats.totalStudents).toBe(0);
      expect(emptyStats.groupAverage).toBeNull();
      expect(emptyStats.median).toBeNull();
      expect(emptyStats.standardDeviation).toBeNull();
      expect(emptyStats.passingPercentage).toBe(0);
      expect(emptyStats.totalAtRisk).toBe(0);
      expect(emptyStats.totalPendingCount).toBe(0);
    });

    it("safely handles assessment with 0 evaluations", () => {
      const emptyAssessmentStats = calculateAssessmentStatistics(mockAssessments[0], [], {}, standardScale);
      expect(emptyAssessmentStats.evaluatedCount).toBe(0);
      expect(emptyAssessmentStats.passingPercentage).toBe(0);
      expect(emptyAssessmentStats.average).toBeNull();
      expect(emptyAssessmentStats.median).toBeNull();
      expect(emptyAssessmentStats.standardDeviation).toBeNull();
      expect(emptyAssessmentStats.interpretation).toContain("Sin calificaciones");
    });
  });

  // ========================================================
  // 16. VALORES INVÁLIDOS
  // ========================================================
  describe("16. Valores inválidos (NaN, Infinity, Strings)", () => {
    it("filters out NaN, Infinity, and non-numeric strings safely", () => {
      const dirtyValues = [NaN, Infinity, -Infinity, "texto_invalido", 4.0, 5.0];
      expect(calculateAverage(dirtyValues as any)).toBe(4.5);
      expect(calculateMedian(dirtyValues as any)).toBe(4.5);
      expect(calculateMinimum(dirtyValues as any)).toBe(4.0);
      expect(calculateMaximum(dirtyValues as any)).toBe(5.0);
      expect(calculateStandardDeviation(dirtyValues as any)).toBe(0.5);
    });

    it("parses valid numeric strings cleanly", () => {
      const stringValues = ["3.0", "4.0", "5.0"];
      expect(calculateAverage(stringValues as any)).toBe(4.0);
      expect(calculateMedian(stringValues as any)).toBe(4.0);
    });
  });

  // ========================================================
  // INTEGRACIÓN: TEACHER INSIGHTS Y PENDING GRADES REACTIVIDAD
  // ========================================================
  describe("Integración: Teacher Insights y Reactividad", () => {
    it("generates pedagogic insights for high failure rate", () => {
      const insights = generateTeacherInsights(
        {
          totalStudents: 10,
          groupAverage: 2.7,
          passingPercentage: 40,
          passingGrade: 3.0,
          totalAtRisk: 6,
          totalPendingCount: 0,
        },
        { items: [], highestPerforming: null, lowestPerforming: null, totalAssessments: 2 },
        []
      );

      expect(insights.some(i => i.id === "insight-failing-high")).toBe(true);
    });

    it("dynamically reflects pendingGrades in group statistics", () => {
      // Daniel (student 3) originally had 2.5 in Quiz 1.
      // Modifying it in memory to 5.0:
      const pendingGrades = { "101:3": 5.0 };
      const statsAfter = calculateAdvancedGroupStats(mockRows, mockAssessments, pendingGrades, standardScale);

      const q1 = statsAfter.assessmentComparison.items.find(i => i.assessmentId === 101);
      // New average: (4.5 + 3.5 + 5.0 + 5.0) / 4 = 4.5
      expect(q1?.average).toBe(4.5);
    });
  });
});

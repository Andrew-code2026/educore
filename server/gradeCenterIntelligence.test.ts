import { describe, expect, it } from "vitest";
import {
  getInstitutionalPassingGrade,
  calculateStudentProjection,
  calculateWhatIsNeededToPass,
  determineRiskLevel,
  getPendingGradesBreakdown,
  getGroupIntelligenceSummary,
  simulateDefinitiva,
} from "../client/src/components/grade-center/gradeIntelligenceUtils";

describe("Fase 5.3-C: Inteligencia de Calificaciones", () => {
  const standardScale = {
    id: 1,
    name: "Escala Estándar Colombia",
    minValue: 0,
    maxValue: 5,
    passingGrade: 3.0,
    decimalPlaces: 1,
    isDefault: true,
  };

  describe("1. getInstitutionalPassingGrade", () => {
    it("returns explicit passing grade from scale config", () => {
      expect(getInstitutionalPassingGrade(standardScale)).toBe(3.0);
    });

    it("defaults to 3.0 for standard 0-5 scale if passingGrade is omitted", () => {
      expect(getInstitutionalPassingGrade({ minValue: 0, maxValue: 5 } as any)).toBe(3.0);
    });

    it("calculates 60% of scale for non-standard scales", () => {
      // Scale 0 to 10: 60% is 6.0
      expect(getInstitutionalPassingGrade({ minValue: 0, maxValue: 10, decimalPlaces: 1 } as any)).toBe(6.0);
    });
  });

  describe("2. calculateStudentProjection", () => {
    it("returns null projection when all assessments are graded (hasPending: false)", () => {
      const values = [
        { value: 4.0, maxValue: 5, weight: 50 },
        { value: 4.5, maxValue: 5, weight: 50 },
      ];
      const result = calculateStudentProjection(values, standardScale);
      expect(result.hasPending).toBe(false);
      expect(result.pendingCount).toBe(0);
      expect(result.projectedDefinitiva).toBeNull();
      expect(result.currentDefinitiva).toBe(4.25);
    });

    it("returns null projection when no assessments are graded", () => {
      const values = [
        { value: null, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];
      const result = calculateStudentProjection(values, standardScale);
      expect(result.hasPending).toBe(true);
      expect(result.recordedCount).toBe(0);
      expect(result.projectedDefinitiva).toBeNull();
      expect(result.currentDefinitiva).toBeNull();
    });

    it("calculates deterministic projection when partial assessments are graded", () => {
      const values = [
        { value: 4.0, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];
      const result = calculateStudentProjection(values, standardScale);
      expect(result.hasPending).toBe(true);
      expect(result.recordedCount).toBe(1);
      expect(result.pendingCount).toBe(1);
      expect(result.currentDefinitiva).toBe(4.0);
      expect(result.projectedDefinitiva).not.toBeNull();
      expect(result.projectedDefinitiva).toBe(4.0);
    });
  });

  describe("3. calculateWhatIsNeededToPass", () => {
    it("calculates exact required grade on remaining assessments", () => {
      // Student has 2.0 on 50% weight. Passing is 3.0 on 100%.
      // Needed = (3.0 * 100 - 2.0 * 50) / 50 = (300 - 100) / 50 = 4.0
      const values = [
        { value: 2.0, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];
      const result = calculateWhatIsNeededToPass(values, standardScale);
      expect(result.hasPending).toBe(true);
      expect(result.isImpossible).toBe(false);
      expect(result.isGuaranteed).toBe(false);
      expect(result.requiredGrade).toBe(4.0);
      expect(result.scenarios.find(s => s.grade === 4.0)?.resultingDefinitiva).toBe(3.0);
      expect(result.scenarios.find(s => s.grade === 4.0)?.isPassing).toBe(true);
    });

    it("detects mathematically impossible approval (X > maxValue)", () => {
      // Student has 1.0 on 80% weight. Passing is 3.0 on 100%.
      // S_recorded = 80. Required S_total = 300. Remaining weight = 20.
      // Needed = (300 - 80) / 20 = 11.0 > 5.0
      const values = [
        { value: 1.0, maxValue: 5, weight: 80 },
        { value: null, maxValue: 5, weight: 20 },
      ];
      const result = calculateWhatIsNeededToPass(values, standardScale);
      expect(result.hasPending).toBe(true);
      expect(result.isImpossible).toBe(true);
      expect(result.isGuaranteed).toBe(false);
      expect(result.message).toContain("Matemáticamente imposible");
    });

    it("detects guaranteed approval (already passed even with 0 in remaining)", () => {
      // Student has 5.0 on 70% weight. Passing is 3.0 on 100%.
      // S_recorded = 350 >= 300.
      const values = [
        { value: 5.0, maxValue: 5, weight: 70 },
        { value: null, maxValue: 5, weight: 30 },
      ];
      const result = calculateWhatIsNeededToPass(values, standardScale);
      expect(result.hasPending).toBe(true);
      expect(result.isGuaranteed).toBe(true);
      expect(result.isImpossible).toBe(false);
      expect(result.message).toContain("Aprobación asegurada");
    });

    it("returns hasPending false when all assessments are graded", () => {
      const values = [
        { value: 4.0, maxValue: 5, weight: 50 },
        { value: 3.5, maxValue: 5, weight: 50 },
      ];
      const result = calculateWhatIsNeededToPass(values, standardScale);
      expect(result.hasPending).toBe(false);
    });
  });

  describe("4. determineRiskLevel", () => {
    it("categorizes as ALTO when approval is impossible", () => {
      const values = [
        { value: 1.0, maxValue: 5, weight: 80 },
        { value: null, maxValue: 5, weight: 20 },
      ];
      const result = determineRiskLevel(values, standardScale, "Carlos López", 101);
      expect(result.riskLevel).toBe("ALTO");
      expect(result.reason.toLowerCase()).toContain("imposible");
    });

    it("categorizes as ALTO when required grade is >= 4.5", () => {
      // Student has 1.0 on 60% weight (60 pts). To reach 300, needs 240 / 40 = 6.0 (impossible)
      // If student has 1.5 on 60% weight (90 pts). To reach 300, needs 210 / 40 = 5.25 (impossible)
      // If student has 2.0 on 60% weight (120 pts). To reach 300, needs 180 / 40 = 4.5
      const values = [
        { value: 2.0, maxValue: 5, weight: 60 },
        { value: null, maxValue: 5, weight: 40 },
      ];
      const result = determineRiskLevel(values, standardScale, "Daniel Ruiz", 102);
      expect(result.riskLevel).toBe("ALTO");
      expect(result.whatIsNeeded.requiredGrade).toBe(4.5);
    });

    it("categorizes as MEDIO when failing but recoverable (< 4.5 required)", () => {
      // Student has 2.5 on 50% weight (125 pts). Needs (300 - 125)/50 = 3.5
      const values = [
        { value: 2.5, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];
      const result = determineRiskLevel(values, standardScale, "Mariana Silva", 103);
      expect(result.riskLevel).toBe("MEDIO");
      expect(result.whatIsNeeded.requiredGrade).toBe(3.5);
    });

    it("categorizes as SIN_RIESGO when performing well", () => {
      const values = [
        { value: 4.5, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];
      const result = determineRiskLevel(values, standardScale, "Sofía Gómez", 104);
      expect(result.riskLevel).toBe("SIN_RIESGO");
    });
  });

  describe("5. simulateDefinitiva (In-Memory Simulator)", () => {
    it("computes simulated final grade without altering original values", () => {
      const originalValues = [
        { value: 3.0, maxValue: 5, weight: 50 },
        { value: null, maxValue: 5, weight: 50 },
      ];

      // Simulated overrides: assign 5.0 to the pending assessment
      const pendingOverrides = [
        { value: 5.0, maxValue: 5, weight: 50 },
      ];

      const simResult = simulateDefinitiva(originalValues, pendingOverrides);

      expect(simResult.actualDefinitiva).toBe(3.0);
      expect(simResult.simulatedDefinitiva).toBe(4.0);
      expect(simResult.pendingCount).toBe(1);
      expect(simResult.simulatedCount).toBe(1);

      // Verify original array remained unmodified
      expect(originalValues[1].value).toBeNull();
    });

    it("handles partial simulation where some pending assessments remain unset", () => {
      const originalValues = [
        { value: 4.0, maxValue: 5, weight: 40 },
        { value: null, maxValue: 5, weight: 30 },
        { value: null, maxValue: 5, weight: 30 },
      ];

      // Only simulate one of the two pending assessments
      const pendingOverrides = [
        { value: 4.0, maxValue: 5, weight: 30 },
        { value: null, maxValue: 5, weight: 30 },
      ];

      const simResult = simulateDefinitiva(originalValues, pendingOverrides);

      // Recorded weights: 40 + 30 = 70. Both are 4.0, so weighted avg is 4.0
      expect(simResult.simulatedDefinitiva).toBe(4.0);
      expect(simResult.simulatedCount).toBe(1);
      expect(simResult.pendingCount).toBe(2);
    });
  });

  describe("6. getGroupIntelligenceSummary and getPendingGradesBreakdown", () => {
    const mockAssessments = [
      { id: 1, title: "Quiz 1", assessmentType: "QUIZ", maxValue: 5, weight: 50, status: "PUBLISHED" },
      { id: 2, title: "Taller 1", assessmentType: "TALLER", maxValue: 5, weight: 50, status: "PUBLISHED" },
    ];

    const mockRows = [
      {
        enrollment: { id: 10, studentUserId: 101, courseId: 1, academicYearId: 1 },
        student: { id: 101, firstName: "Sofía", lastName: "Gómez" },
        values: [
          { assessment: mockAssessments[0], grade: { id: 1, value: 4.5 } },
          { assessment: mockAssessments[1], grade: null }, // Pending
        ],
        average: 4.5,
      },
      {
        enrollment: { id: 20, studentUserId: 102, courseId: 1, academicYearId: 1 },
        student: { id: 102, firstName: "Carlos", lastName: "López" },
        values: [
          { assessment: mockAssessments[0], grade: { id: 2, value: 1.0 } },
          { assessment: mockAssessments[1], grade: null }, // Pending
        ],
        average: 1.0,
      },
    ] as any;

    it("extracts pending grades breakdown with direct navigation metadata", () => {
      const pending = getPendingGradesBreakdown(mockRows, mockAssessments, {});
      expect(pending.flatItems.length).toBe(2);
      expect(pending.flatItems[0].studentName).toBe("Sofía Gómez");
      expect(pending.flatItems[0].assessmentTitle).toBe("Taller 1");
      expect(pending.flatItems[0].studentId).toBe(101);
      expect(pending.flatItems[0].assessmentId).toBe(2);
    });

    it("aggregates group metrics, passing percentage and risk categories", () => {
      const summary = getGroupIntelligenceSummary(mockRows, mockAssessments, {}, standardScale);
      expect(summary.totalStudents).toBe(2);
      expect(summary.totalPendingGrades).toBe(2);
      expect(summary.highRiskStudents.length + summary.mediumRiskStudents.length).toBeGreaterThan(0);
      expect(summary.passingCount).toBe(1); // Sofia is passing (4.5)
      expect(summary.failingCount).toBe(1); // Carlos is failing (1.0)
    });
  });
});

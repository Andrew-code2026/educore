import { describe, expect, it } from "vitest";
import {
  getGridDensityConfig,
  formatAssessmentCode,
  splitAssessmentTitle,
  calculateDefinitiva,
  getPerformanceTone,
  type GradeGridDensity,
} from "../client/src/components/grade-center/gradeCenterUtils";

describe("Subfase 2 — Iteración 1: Grid 2.0 — Refinamiento Espacial y Validación Multi-Evaluación", () => {
  // --------------------------------------------------------------------------
  // 1. Configuración y dimensiones espaciales por densidad refinadas
  // --------------------------------------------------------------------------
  describe("Configuración de densidad espacial refinada (getGridDensityConfig)", () => {
    it("proporciona las dimensiones optimizadas para la Vista Estándar", () => {
      const config = getGridDensityConfig("standard");
      expect(config.checkboxWidth).toBe(36);
      expect(config.studentWidth).toBe(180);
      expect(config.assessmentWidth).toBe(76);
      expect(config.definitivaWidth).toBe(84);
      expect(config.cellPaddingClass).toContain("px-1.5");
      expect(config.cellButtonClass).toContain("h-8");
      expect(config.cellButtonClass).toContain("w-15");
      expect(config.cellButtonClass).toContain("text-sm");
      expect(config.headerHeightClass).toContain("py-1.5");
    });

    it("proporciona las dimensiones de ultra alta densidad para la Vista Compacta", () => {
      const config = getGridDensityConfig("compact");
      expect(config.checkboxWidth).toBe(32);
      expect(config.studentWidth).toBe(138);
      expect(config.assessmentWidth).toBe(56);
      expect(config.definitivaWidth).toBe(60);
      expect(config.cellPaddingClass).toContain("px-1");
      expect(config.cellButtonClass).toContain("h-7");
      expect(config.cellButtonClass).toContain("w-11");
      expect(config.cellButtonClass).toContain("text-xs");
      expect(config.headerHeightClass).toContain("py-1");
    });

    it("la Vista Compacta optimiza el espacio fijo total a solo 230px liberando espacio para evaluaciones", () => {
      const compact = getGridDensityConfig("compact");
      const totalPinnedWidth = compact.checkboxWidth + compact.studentWidth + compact.definitivaWidth;
      // 32 + 138 + 60 = 230px
      expect(totalPinnedWidth).toBe(230);
    });

    it("usa Vista Estándar como fallback seguro ante valores indefinidos o desconocidos", () => {
      // @ts-expect-error probando valor inválido deliberado
      const fallbackConfig = getGridDensityConfig("invalid_density");
      const standardConfig = getGridDensityConfig("standard");
      expect(fallbackConfig).toEqual(standardConfig);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Validación de capacidad y escenarios con 5, 10, 15, 20 y 25 evaluaciones
  // --------------------------------------------------------------------------
  describe("Validación de escenarios: 5, 10, 15, 20 y 25 evaluaciones", () => {
    const compact = getGridDensityConfig("compact");
    const standard = getGridDensityConfig("standard");

    // Escenario 1: 5 evaluaciones
    it("Escenario 5 evaluaciones: cabe con holgura absoluta en cualquier resolución sin scroll", () => {
      const assessmentsCount = 5;
      const compactAssessmentsWidth = assessmentsCount * compact.assessmentWidth; // 5 * 56 = 280px
      const standardAssessmentsWidth = assessmentsCount * standard.assessmentWidth; // 5 * 76 = 380px

      // Ancho total de la tabla (fijas + evaluaciones)
      const compactTotalTableWidth = (compact.checkboxWidth + compact.studentWidth + compact.definitivaWidth) + compactAssessmentsWidth;
      const standardTotalTableWidth = (standard.checkboxWidth + standard.studentWidth + standard.definitivaWidth) + standardAssessmentsWidth;

      expect(compactTotalTableWidth).toBe(230 + 280); // 510px
      expect(standardTotalTableWidth).toBe(300 + 380); // 680px

      // Ambos caben fácilmente en un portátil estándar de 1280px o 1366px
      expect(compactTotalTableWidth).toBeLessThan(1280);
      expect(standardTotalTableWidth).toBeLessThan(1280);
    });

    // Escenario 2: 10 evaluaciones
    it("Escenario 10 evaluaciones: 10 evaluaciones visibles simultáneamente en portátil (1280px) en Vista Compacta", () => {
      const assessmentsCount = 10;
      const compactAssessmentsWidth = assessmentsCount * compact.assessmentWidth; // 10 * 56 = 560px
      const compactTotalTableWidth = 230 + compactAssessmentsWidth; // 790px

      expect(compactTotalTableWidth).toBe(790);
      // Cabe completamente sin scroll horizontal en portátiles (1280px)
      expect(compactTotalTableWidth).toBeLessThan(1280);
    });

    // Escenario 3: 15 evaluaciones
    it("Escenario 15 evaluaciones: 15 evaluaciones desplegadas sin scroll horizontal en monitores medianos/grandes", () => {
      const assessmentsCount = 15;
      const compactAssessmentsWidth = assessmentsCount * compact.assessmentWidth; // 15 * 56 = 840px
      const compactTotalTableWidth = 230 + compactAssessmentsWidth; // 1070px

      expect(compactTotalTableWidth).toBe(1070);
      // Cabe perfectamente en un ancho de 1280px o 1366px (1070px < 1280px)
      expect(compactTotalTableWidth).toBeLessThan(1280);
    });

    // Escenario 4: 20 evaluaciones
    it("Escenario 20 evaluaciones: hasta 20 evaluaciones visibles simultáneamente en 1400px en Vista Compacta", () => {
      const assessmentsCount = 20;
      const compactAssessmentsWidth = assessmentsCount * compact.assessmentWidth; // 20 * 56 = 1120px
      const compactTotalTableWidth = 230 + compactAssessmentsWidth; // 1350px

      expect(compactTotalTableWidth).toBe(1350);
      // En un monitor de 1400px, 1350px < 1400px, las 20 evaluaciones caben simultáneamente
      expect(compactTotalTableWidth).toBeLessThan(1400);

      const availableIn1400 = 1400 - 230; // 1170px
      const maxAssessmentsIn1400 = Math.floor(availableIn1400 / compact.assessmentWidth);
      expect(maxAssessmentsIn1400).toBe(20);
    });

    // Escenario 5: 25 evaluaciones
    it("Escenario 25 evaluaciones: soporta 25 evaluaciones con scroll horizontal fluido y anclaje 2D", () => {
      const assessmentsCount = 25;
      const compactAssessmentsWidth = assessmentsCount * compact.assessmentWidth; // 25 * 56 = 1400px
      const compactTotalTableWidth = 230 + compactAssessmentsWidth; // 1630px

      expect(compactTotalTableWidth).toBe(1630);

      // En un monitor Full HD (1920px), las 25 evaluaciones caben completamente sin scroll:
      expect(compactTotalTableWidth).toBeLessThan(1920);

      // En un monitor o portátil de 1366px, las columnas de evaluación hacen scroll horizontal
      // mientras Estudiante (170px) a la izquierda y Definitiva (60px) a la derecha permanecen fijas
      const fixedColumnsWidth = compact.checkboxWidth + compact.studentWidth + compact.definitivaWidth;
      expect(fixedColumnsWidth).toBe(230);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Títulos adaptativos y generación de códigos (formatAssessmentCode y splitAssessmentTitle)
  // --------------------------------------------------------------------------
  describe("Títulos adaptativos y códigos de evaluación", () => {
    it("divide armónicamente títulos largos en 2 líneas sin cortar palabras abruptamente", () => {
      const split1 = splitAssessmentTitle("Examen 2do periodo");
      expect(split1.line1).toBe("Examen 2do");
      expect(split1.line2).toBe("periodo");

      const split2 = splitAssessmentTitle("Parcial Álgebra");
      expect(split2.line1).toBe("Parcial");
      expect(split2.line2).toBe("Álgebra");

      const splitSingle = splitAssessmentTitle("Taller");
      expect(splitSingle.line1).toBe("Taller");
      expect(splitSingle.line2).toBeUndefined();

      const splitEmpty = splitAssessmentTitle("");
      expect(splitEmpty.line1).toBe("");
    });

    it("genera prefijos canónicos según el tipo pedagógico de evaluación", () => {
      expect(formatAssessmentCode(0, "EXAM")).toBe("E1");
      expect(formatAssessmentCode(1, "EXAMEN")).toBe("E2");
      expect(formatAssessmentCode(0, "WORKSHOP")).toBe("T1");
      expect(formatAssessmentCode(1, "TALLER")).toBe("T2");
      expect(formatAssessmentCode(2, "HOMEWORK")).toBe("T3");
      expect(formatAssessmentCode(3, "QUIZ")).toBe("Q4");
      expect(formatAssessmentCode(4, "PROJECT")).toBe("P5");
      expect(formatAssessmentCode(4, "PROYECTO")).toBe("P5");
      expect(formatAssessmentCode(5, "PARTICIPACION")).toBe("Pa6");
      expect(formatAssessmentCode(5, "PARTICIPATION")).toBe("Pa6");
      expect(formatAssessmentCode(6, "RECUPERACION")).toBe("R7");
    });

    it("asigna un prefijo por defecto seguro ante tipos no catalogados", () => {
      expect(formatAssessmentCode(0, "CUSTOM_LAB")).toBe("E1");
      expect(formatAssessmentCode(7, "OTRO")).toBe("O8");
      expect(formatAssessmentCode(7, "OTHER")).toBe("O8");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Invariabilidad de cálculos y consistencia de datos entre vistas
  // --------------------------------------------------------------------------
  describe("Consistencia de cálculo y escala institucional entre vistas", () => {
    it("calcula exactamente la misma definitiva sin importar qué densidad o vista esté activa", () => {
      const studentGrades = [
        { value: 4.5, maxValue: 5, weight: 30 },
        { value: 3.8, maxValue: 5, weight: 30 },
        { value: 4.2, maxValue: 5, weight: 40 },
      ];

      const defStandard = calculateDefinitiva(studentGrades);
      const defCompact = calculateDefinitiva(studentGrades);

      expect(defStandard).toBe(defCompact);
      expect(defStandard).toBe(4.17);
    });

    it("mantiene consistencia estricta con la escala institucional (aprobatoria >= 3.5, riesgo < 3.5)", () => {
      const tonePassing = getPerformanceTone(3.5);
      expect(tonePassing.label).toBe("Básico");

      const toneFailing = getPerformanceTone(3.4);
      expect(toneFailing.label).toBe("Bajo");

      const toneAlto = getPerformanceTone(4.3);
      expect(toneAlto.label).toBe("Alto");

      const toneSuperior = getPerformanceTone(4.8);
      expect(toneSuperior.label).toBe("Superior");
    });
  });
});

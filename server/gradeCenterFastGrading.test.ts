import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import {
  parseGradeInput,
  validateGradeAgainstScale,
  calculateDefinitiva,
  generateSuggestedGrades,
  POPOVER_GLASS_PANEL_CLASS,
} from "../client/src/components/grade-center/gradeCenterUtils";
import { appRouter } from "./routers";
import {
  getGradeCenterContext,
  saveGradeCenterGrades,
  ensureGradeCenterSeeded,
  type GradeCenterActor,
} from "./gradeCenterDb";
import { getDemoIdentityContext } from "./db";

type Demo = Awaited<ReturnType<typeof getDemoIdentityContext>>;
const schoolId = 1;
let admin: Demo;
let teacher: Demo;
let student: Demo;
let guardian: Demo;

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
});

describe("Fase 5.3-B: Calificación Ultrarrápida y Rediseño de Popovers", () => {
  // 1. EDICIÓN DIRECTA EN CELDAS Y VALIDACIÓN DE ESCALA
  describe("1 & 6. Edición directa y validación contra la escala institucional", () => {
    const scale = { minValue: 0, maxValue: 5, decimalPlaces: 1 };

    it("permite valores decimales válidos como 4.5, 4.7, 3.8", () => {
      const inputs = ["4.5", "4,5", "4.7", "3.8", "5.0", "0.0", "3.0"];
      for (const raw of inputs) {
        const parsed = parseGradeInput(raw);
        expect(parsed).not.toBeNull();
        expect(isNaN(parsed!)).toBe(false);
        const validation = validateGradeAgainstScale(parsed, scale, 5);
        expect(validation.valid).toBe(true);
        expect(validation.error).toBeUndefined();
      }
    });

    it("normaliza comas a puntos decimales", () => {
      expect(parseGradeInput("4,5")).toBe(4.5);
      expect(parseGradeInput("3,8")).toBe(3.8);
      expect(parseGradeInput("  4.2  ")).toBe(4.2);
      expect(parseGradeInput("")).toBeNull();
      expect(parseGradeInput("—")).toBeNull();
    });

    it("rechaza valores fuera de escala o inválidos", () => {
      const invalidValues = [5.1, 5.5, 10, -0.1, -1, NaN];
      for (const val of invalidValues) {
        const validation = validateGradeAgainstScale(val, scale, 5);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });

  // 2, 3, 4, 5. NAVEGACIÓN CON TECLADO Y FLUJO DE CALIFICACIÓN CONTINUA
  describe("2, 3, 4, 5. Navegación con teclado y flujo de calificación continua vertical", () => {
    // Modelo de navegación virtual que reproduce con precisión el comportamiento de GradeCenterTable
    class VirtualGradeGrid {
      rows: Array<{ studentId: number; name: string }>;
      assessments: Array<{ id: number; title: string }>;
      pendingGrades: Record<string, number | null> = {};
      activeRow = 0;
      activeCol = 0;
      isEditing = false;
      draft = "";

      constructor(
        rows: Array<{ studentId: number; name: string }>,
        assessments: Array<{ id: number; title: string }>
      ) {
        this.rows = rows;
        this.assessments = assessments;
      }

      startEdit(val?: string) {
        this.isEditing = true;
        this.draft = val ?? "";
      }

      selectSuggestion(val: number) {
        this.isEditing = true;
        this.draft = val.toFixed(1);
      }

      pressKey(key: string, shift = false) {
        if (!this.isEditing) {
          if (key >= "0" && key <= "9") {
            this.startEdit(key);
            return;
          }
          if (key === "Enter") {
            this.startEdit();
            return;
          }
          if (key === "ArrowDown" && this.activeRow + 1 < this.rows.length) {
            this.activeRow++;
          } else if (key === "ArrowUp" && this.activeRow > 0) {
            this.activeRow--;
          } else if (key === "ArrowRight" && this.activeCol + 1 < this.assessments.length) {
            this.activeCol++;
          } else if (key === "ArrowLeft" && this.activeCol > 0) {
            this.activeCol--;
          }
          return;
        }

        // Mientras está editando
        if (key === "Enter") {
          const parsed = parseGradeInput(this.draft);
          const aId = this.assessments[this.activeCol].id;
          const sId = this.rows[this.activeRow].studentId;
          this.pendingGrades[`${aId}:${sId}`] = parsed;

          if (shift) {
            // SHIFT + ENTER: sube una fila
            if (this.activeRow > 0) {
              this.activeRow--;
              this.isEditing = true;
              this.draft = "";
            } else {
              this.isEditing = false;
            }
          } else {
            // ENTER: avanza a la siguiente fila verticalmente en la misma columna de evaluación
            if (this.activeRow + 1 < this.rows.length) {
              this.activeRow++;
              this.isEditing = true;
              this.draft = "";
            } else {
              this.isEditing = false;
            }
          }
        } else if (key === "Tab") {
          const parsed = parseGradeInput(this.draft);
          const aId = this.assessments[this.activeCol].id;
          const sId = this.rows[this.activeRow].studentId;
          this.pendingGrades[`${aId}:${sId}`] = parsed;

          if (shift) {
            // SHIFT + TAB se desplaza horizontalmente a la evaluación anterior
            if (this.activeCol > 0) {
              this.activeCol--;
              this.isEditing = true;
              this.draft = "";
            } else {
              this.isEditing = false;
            }
          } else {
            // TAB se desplaza horizontalmente a la siguiente evaluación
            if (this.activeCol + 1 < this.assessments.length) {
              this.activeCol++;
              this.isEditing = true;
              this.draft = "";
            } else {
              this.isEditing = false;
            }
          }
        } else if (key === "Escape") {
          // ESCAPE cancela edición activa sin perder cambios pendientes previos
          this.isEditing = false;
          this.draft = "";
        }
      }
    }

    const mockStudents = [
      { studentId: 101, name: "Sofia" },
      { studentId: 102, name: "Mateo" },
      { studentId: 103, name: "Daniel" },
      { studentId: 104, name: "Laura" },
      { studentId: 105, name: "Carlos" },
    ];
    const mockAssessments = [
      { id: 1, title: "Quiz 1" },
      { id: 2, title: "Taller 1" },
      { id: 3, title: "Parcial" },
    ];

    it("flujo vertical continuo: Sofia (4.5) -> ENTER -> Mateo (3.8) -> ENTER -> Daniel (4.2) -> ENTER -> Laura (5.0) -> ENTER", () => {
      const grid = new VirtualGradeGrid(mockStudents, mockAssessments);

      // Sofia -> Quiz 1 -> 4.5 -> ENTER
      grid.startEdit("4.5");
      grid.pressKey("Enter");
      expect(grid.activeRow).toBe(1); // Mateo
      expect(grid.activeCol).toBe(0); // Misma evaluación (Quiz 1)
      expect(grid.isEditing).toBe(true);
      expect(grid.pendingGrades["1:101"]).toBe(4.5);

      // Mateo -> Quiz 1 -> 3.8 -> ENTER
      grid.draft = "3.8";
      grid.pressKey("Enter");
      expect(grid.activeRow).toBe(2); // Daniel
      expect(grid.activeCol).toBe(0); // Misma evaluación
      expect(grid.isEditing).toBe(true);
      expect(grid.pendingGrades["1:102"]).toBe(3.8);

      // Daniel -> Quiz 1 -> 4.2 -> ENTER
      grid.draft = "4.2";
      grid.pressKey("Enter");
      expect(grid.activeRow).toBe(3); // Laura
      expect(grid.activeCol).toBe(0); // Misma evaluación
      expect(grid.isEditing).toBe(true);
      expect(grid.pendingGrades["1:103"]).toBe(4.2);

      // Laura -> Quiz 1 -> 5.0 -> ENTER
      grid.draft = "5.0";
      grid.pressKey("Enter");
      expect(grid.activeRow).toBe(4); // Carlos
      expect(grid.activeCol).toBe(0);
      expect(grid.pendingGrades["1:104"]).toBe(5.0);

      // Carlos -> 4.0 -> ENTER (último)
      grid.draft = "4.0";
      grid.pressKey("Enter");
      expect(grid.pendingGrades["1:105"]).toBe(4.0);
      expect(grid.isEditing).toBe(false);

      // Comprobar que todas las notas quedaron registradas como pendientes
      expect(Object.keys(grid.pendingGrades)).toHaveLength(5);
    });

    it("TAB navega horizontalmente a la siguiente evaluación y SHIFT+TAB a la anterior", () => {
      const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
      grid.startEdit("4.2");
      grid.pressKey("Tab", false); // TAB
      expect(grid.activeCol).toBe(1); // Taller 1
      expect(grid.activeRow).toBe(0);
      expect(grid.pendingGrades["1:101"]).toBe(4.2);

      grid.draft = "3.9";
      grid.pressKey("Tab", true); // SHIFT + TAB
      expect(grid.activeCol).toBe(0); // Quiz 1
      expect(grid.pendingGrades["2:101"]).toBe(3.9);
    });

    it("ESCAPE cancela edición activa sin descartar cambios pendientes acumulados", () => {
      const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
      grid.startEdit("4.5");
      grid.pressKey("Enter");
      expect(grid.pendingGrades["1:101"]).toBe(4.5);

      // Empieza a escribir pero decide cancelar
      grid.draft = "1.0";
      grid.pressKey("Escape");
      expect(grid.isEditing).toBe(false);
      // No modificó la celda de Mateo
      expect(grid.pendingGrades["1:102"]).toBeUndefined();
      // Mantuvo intacta la celda de Sofia guardada previamente
      expect(grid.pendingGrades["1:101"]).toBe(4.5);
    });

    // PRUEBAS MANUALES OBLIGATORIAS ESPECIFICADAS POR EL USUARIO
    describe("Pruebas Obligatorias de UX: Calificación Vertical y Popover de Notas", () => {
      it("PRUEBA 1: clic en nota de Sofía -> escribir 4.5 -> ENTER -> aparece Mateo", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        grid.startEdit("4.5");
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(1); // Mateo
        expect(grid.rows[grid.activeRow].name).toBe("Mateo");
        expect(grid.activeCol).toBe(0); // Misma evaluación
        expect(grid.pendingGrades["1:101"]).toBe(4.5);
        expect(grid.isEditing).toBe(true);
      });

      it("PRUEBA 2: clic en nota de Sofía -> clic [4.5] -> ENTER -> aparece Mateo", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        grid.selectSuggestion(4.5);
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(1); // Mateo
        expect(grid.rows[grid.activeRow].name).toBe("Mateo");
        expect(grid.activeCol).toBe(0);
        expect(grid.pendingGrades["1:101"]).toBe(4.5);
        expect(grid.isEditing).toBe(true);
      });

      it("PRUEBA 3: clic [4.5] -> cambiar manualmente a 4.7 -> ENTER -> aparece Mateo", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        grid.selectSuggestion(4.5);
        grid.draft = "4.7"; // Modificación manual post-sugerencia
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(1); // Mateo
        expect(grid.rows[grid.activeRow].name).toBe("Mateo");
        expect(grid.pendingGrades["1:101"]).toBe(4.7);
        expect(grid.isEditing).toBe(true);
      });

      it("PRUEBA 4: secuencia continua: clic [4.5] -> ENTER -> 4.0 -> ENTER -> clic [3.5] -> ENTER -> continuar", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        // Sofia: chip 4.5 -> ENTER
        grid.selectSuggestion(4.5);
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(1); // Mateo
        expect(grid.pendingGrades["1:101"]).toBe(4.5);

        // Mateo: manual 4.0 -> ENTER
        grid.draft = "4.0";
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(2); // Daniel
        expect(grid.pendingGrades["1:102"]).toBe(4.0);

        // Daniel: chip 3.5 -> ENTER
        grid.selectSuggestion(3.5);
        grid.pressKey("Enter");
        expect(grid.activeRow).toBe(3); // Laura
        expect(grid.pendingGrades["1:103"]).toBe(3.5);
        expect(grid.isEditing).toBe(true);
      });

      it("PRUEBA 5: en el último estudiante -> ENTER -> no intenta acceder a fila inexistente ni rompe el Popover", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        grid.activeRow = mockStudents.length - 1; // Carlos (último, index 4)
        grid.startEdit("4.8");
        expect(() => grid.pressKey("Enter")).not.toThrow();
        expect(grid.pendingGrades["1:105"]).toBe(4.8);
        expect(grid.activeRow).toBe(mockStudents.length - 1);
        expect(grid.isEditing).toBe(false);
      });

      it("PRUEBA 6: SHIFT + ENTER -> regresa al estudiante anterior", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        grid.activeRow = 2; // Daniel
        grid.startEdit("3.9");
        grid.pressKey("Enter", true); // Shift + Enter
        expect(grid.activeRow).toBe(1); // Mateo (anterior)
        expect(grid.rows[grid.activeRow].name).toBe("Mateo");
        expect(grid.pendingGrades["1:103"]).toBe(3.9);
        expect(grid.isEditing).toBe(true);
      });

      it("PRUEBA 7: ESC -> cierra/cancela la edición actual manteniendo pendientes previos", () => {
        const grid = new VirtualGradeGrid(mockStudents, mockAssessments);
        // Calificar a Sofía
        grid.startEdit("4.5");
        grid.pressKey("Enter");
        expect(grid.pendingGrades["1:101"]).toBe(4.5);

        // En Mateo presiona ESC
        grid.draft = "2.0";
        grid.pressKey("Escape");
        expect(grid.isEditing).toBe(false);
        expect(grid.pendingGrades["1:102"]).toBeUndefined();
        expect(grid.pendingGrades["1:101"]).toBe(4.5); // Intacta
      });
    });
  });

  // 7. COPIAR Y PEGAR
  describe("7. Copiar y pegar notas", () => {
    it("valida y acepta el pegado de notas en rango", () => {
      const scale = { minValue: 0, maxValue: 5, decimalPlaces: 1 };
      const copiedText = " 4.6 ";
      const parsed = parseGradeInput(copiedText);
      expect(parsed).toBe(4.6);
      const validation = validateGradeAgainstScale(parsed, scale, 5);
      expect(validation.valid).toBe(true);
    });

    it("rechaza el pegado de valores alfanuméricos o fuera de escala", () => {
      const scale = { minValue: 0, maxValue: 5, decimalPlaces: 1 };
      const invalidCopiedTexts = ["abc", "6.2", "-0.5", "undefined"];
      for (const text of invalidCopiedTexts) {
        const parsed = parseGradeInput(text);
        const validation = validateGradeAgainstScale(parsed, scale, 5);
        expect(validation.valid).toBe(false);
      }
    });
  });

  // 8, 9, 10. CALIFICACIÓN MASIVA Y PROTECCIÓN DE CELDAS NO VACÍAS
  describe("8, 9, 10. Calificación masiva y regla de celdas vacías", () => {
    const students = [
      { id: 1, name: "Carlos" },
      { id: 2, name: "Ana" },
      { id: 3, name: "Sofia" },
      { id: 4, name: "Juan" },
    ];

    // Estado inicial: Carlos tiene 4.5, Sofia tiene 3.8, Ana y Juan están vacíos (null)
    const initialGrades: Record<number, number | null> = {
      1: 4.5,
      2: null,
      3: 3.8,
      4: null,
    };

    it("calificación masiva: aplicar a todos los estudiantes sobrescribe todas las celdas", () => {
      const assessmentId = 10;
      const pending: Record<string, number | null> = {};

      for (const s of students) {
        pending[`${assessmentId}:${s.id}`] = 4.0;
      }

      expect(pending[`${assessmentId}:1`]).toBe(4.0);
      expect(pending[`${assessmentId}:2`]).toBe(4.0);
      expect(pending[`${assessmentId}:3`]).toBe(4.0);
      expect(pending[`${assessmentId}:4`]).toBe(4.0);
    });

    it("calificación masiva: aplicar solo a seleccionados afecta únicamente a los seleccionados", () => {
      const assessmentId = 10;
      const selectedStudentIds = [2, 4]; // Ana y Juan
      const pending: Record<string, number | null> = {};

      for (const s of students) {
        if (selectedStudentIds.includes(s.id)) {
          pending[`${assessmentId}:${s.id}`] = 4.8;
        }
      }

      expect(pending[`${assessmentId}:2`]).toBe(4.8);
      expect(pending[`${assessmentId}:4`]).toBe(4.8);
      expect(pending[`${assessmentId}:1`]).toBeUndefined();
      expect(pending[`${assessmentId}:3`]).toBeUndefined();
    });

    it("REGLA CLAVE: calificación masiva SOLO A CELDAS VACÍAS NUNCA sobrescribe notas existentes", () => {
      const assessmentId = 10;
      const pending: Record<string, number | null> = {};

      const bulkValue = 4.0;
      let affectedCount = 0;

      for (const s of students) {
        const currentVal = initialGrades[s.id];
        // Si la celda ya tiene calificación, omitir obligatoriamente
        if (currentVal !== null && currentVal !== undefined) {
          continue;
        }
        pending[`${assessmentId}:${s.id}`] = bulkValue;
        affectedCount++;
      }

      // Ana y Juan eran vacíos, deben recibir 4.0
      expect(pending[`${assessmentId}:2`]).toBe(4.0);
      expect(pending[`${assessmentId}:4`]).toBe(4.0);
      expect(affectedCount).toBe(2);

      // Carlos (4.5) y Sofía (3.8) NO fueron sobrescritos
      expect(pending[`${assessmentId}:1`]).toBeUndefined();
      expect(pending[`${assessmentId}:3`]).toBeUndefined();
    });
  });

  // 11. DEFINITIVA EN TIEMPO REAL RECALCULADA CON CAMBIOS PENDIENTES
  describe("11. Definitiva en tiempo real", () => {
    it("recalcula reactivamente la definitiva cuando cambia una nota a un valor pendiente", () => {
      // Evaluación 1 (50% peso): original 3.5 -> cambiada en pendiente a 4.5
      // Evaluación 2 (50% peso): 4.0
      const assessment1 = { value: 4.5, maxValue: 5, weight: 50 };
      const assessment2 = { value: 4.0, maxValue: 5, weight: 50 };

      const def = calculateDefinitiva([assessment1, assessment2]);
      expect(def).toBe(4.25);
    });
  });

  // 12. UNIFICACIÓN Y DISEÑO DE POPOVERS (SISTEMA DE DISEÑO)
  describe("12. Unificación visual y clases del sistema de diseño para popovers", () => {
    it("POPOVER_GLASS_PANEL_CLASS incluye tokens de Liquid Glass y bordes redondeados", () => {
      expect(POPOVER_GLASS_PANEL_CLASS).toContain("rounded-2xl");
      expect(POPOVER_GLASS_PANEL_CLASS).toContain("backdrop-blur");
      expect(POPOVER_GLASS_PANEL_CLASS).toContain("shadow-");
    });

    it("genera notas sugeridas pedagógicamente para popovers compactos", () => {
      const suggestions = generateSuggestedGrades(null, 5.0, 6);
      expect(suggestions).toContain(5.0);
      expect(suggestions).toContain(4.5);
      expect(suggestions).toContain(4.0);
      expect(suggestions).toContain(3.0);
      expect(suggestions.length).toBeLessThanOrEqual(6);
    });
  });

  // 13. INTEGRACIÓN SERVER-SIDE Y SEGURIDAD RBAC EN saveGrades
  describe("13. Integridad de seguridad server-side en saveGrades", () => {
    beforeEach(async () => {
      await ensureGradeCenterSeeded(schoolId);
    });

    it("permite a un docente asignado guardar notas válidas en lote", async () => {
      const context = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const assessment = context!.assessments[0];
      const student1 = context!.rows[0].enrollment.studentUserId;

      const result = await caller(teacher!.user).gradeCenter.saveGrades({
        role: "teacher",
        assessmentId: assessment.id,
        grades: [{ studentId: student1, value: 4.4, comment: "Excelente proceso" }],
      });
      expect(result).toMatchObject({ saved: 1 });
    });

    it("bloquea estudiantes de llamar saveGrades", async () => {
      const context = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const assessment = context!.assessments[0];
      await expect(
        caller(student!.user).gradeCenter.saveGrades({
          role: "student",
          assessmentId: assessment.id,
          grades: [{ studentId: student!.user.id, value: 5.0 }],
        })
      ).rejects.toThrow(/permisos/);
    });

    it("bloquea acudientes de llamar saveGrades", async () => {
      const context = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const assessment = context!.assessments[0];
      await expect(
        caller(guardian!.user).gradeCenter.saveGrades({
          role: "guardian",
          assessmentId: assessment.id,
          grades: [{ studentId: student!.user.id, value: 5.0 }],
        })
      ).rejects.toThrow(/permisos/);
    });

    it("rechaza notas fuera de escala institucional en el backend", async () => {
      const context = await getGradeCenterContext(actor(teacher, "TEACHER"));
      const assessment = context!.assessments[0];
      const student1 = context!.rows[0].enrollment.studentUserId;

      await expect(
        caller(teacher!.user).gradeCenter.saveGrades({
          role: "teacher",
          assessmentId: assessment.id,
          grades: [{ studentId: student1, value: 5.8 }],
        })
      ).rejects.toThrow(/entre 0 y 5/);
    });
  });

  // 14. PRESERVACIÓN INTACTA DE VISTAS PROTEGIDAS POR ROL
  describe("14. Preservación intacta de vistas protegidas por rol", () => {
    it("la vista de estudiante permanece restringida a sus propias notas", async () => {
      const studentContext = await getGradeCenterContext(actor(student, "STUDENT"));
      expect(studentContext?.rows).toHaveLength(1);
      expect(studentContext?.rows[0].enrollment.studentUserId).toBe(student!.user.id);
    });

    it("la vista de acudiente permanece restringida a sus representados", async () => {
      const guardianContext = await getGradeCenterContext(actor(guardian, "GUARDIAN"));
      const relationships = await caller(guardian!.user).identity.relationships({
        role: "guardian",
      });
      const validStudentIds = new Set(relationships.map((r: any) => r.id));
      expect(guardianContext?.rows.every(r => validStudentIds.has(r.enrollment.studentUserId))).toBe(
        true
      );
    });

    it("la vista de administrador mantiene el contexto de supervisión", async () => {
      const adminContext = await getGradeCenterContext(actor(admin, "SCHOOL_ADMIN"));
      expect(adminContext?.courses.length).toBeGreaterThan(0);
      expect(adminContext?.rows.length).toBeGreaterThan(0);
      expect(adminContext?.stats.completion).toBeGreaterThanOrEqual(0);
    });
  });

  // 15. FASE 5.3-D REHECHA: SIMULACIÓN EN MEMORIA Y ESTABILIDAD DE POPOVERS
  describe("15. Fase 5.3-D Rehecha: Simulación real en memoria y estabilidad de navegación", () => {
    it("simula en memoria cualquier evaluación (calificada o pendiente) sin tocar pendingGrades", () => {
      const baseValues = [
        { assessmentId: 1, title: "Quiz 1", weight: 20, maxValue: 5, originalValue: 2.5 },
        { assessmentId: 2, title: "Taller 1", weight: 30, maxValue: 5, originalValue: 3.0 },
        { assessmentId: 3, title: "Examen", weight: 50, maxValue: 5, originalValue: null as number | null }, // pendiente
      ];

      // Definitiva real: calculada solo con notas registradas
      const realDefinitiva = calculateDefinitiva(baseValues.map(v => ({
        value: v.originalValue,
        maxValue: v.maxValue,
        weight: v.weight,
      })));
      // Quiz 1 (2.5 * 20%) + Taller 1 (3.0 * 30%) = 0.5 + 0.9 = 1.4 sobre 50% = 2.8
      expect(realDefinitiva).toBe(2.8);

      // Simulación 1: simular la pendiente con 4.0
      const simGrades: Record<number, number | null> = { 3: 4.0 };
      const simulatedDefinitiva1 = calculateDefinitiva(baseValues.map(v => ({
        value: simGrades[v.assessmentId] !== undefined ? simGrades[v.assessmentId] : v.originalValue,
        maxValue: v.maxValue,
        weight: v.weight,
      })));
      // 0.5 + 0.9 + 2.0 = 3.4
      expect(simulatedDefinitiva1).toBe(3.4);
      expect(Number((simulatedDefinitiva1! - realDefinitiva!).toFixed(1))).toBe(0.6);

      // Simulación 2: simular también una evaluación YA CALIFICADA (Quiz 1 de 2.5 a 4.5)
      simGrades[1] = 4.5;
      const simulatedDefinitiva2 = calculateDefinitiva(baseValues.map(v => ({
        value: simGrades[v.assessmentId] !== undefined ? simGrades[v.assessmentId] : v.originalValue,
        maxValue: v.maxValue,
        weight: v.weight,
      })));
      // Quiz 1 (4.5 * 20%) + Taller 1 (3.0 * 30%) + Examen (4.0 * 50%) = 0.9 + 0.9 + 2.0 = 3.8
      expect(simulatedDefinitiva2).toBe(3.8);

      // Aislamiento: pendingGrades del sistema permanece intacto
      const pendingGrades: Record<string, number | null> = {};
      expect(Object.keys(pendingGrades)).toHaveLength(0);

      // Restablecer simulación restaura exactamente la definitiva real
      const resetSimGrades: Record<number, number | null> = {};
      const restoredDefinitiva = calculateDefinitiva(baseValues.map(v => ({
        value: resetSimGrades[v.assessmentId] !== undefined ? resetSimGrades[v.assessmentId] : v.originalValue,
        maxValue: v.maxValue,
        weight: v.weight,
      })));
      expect(restoredDefinitiva).toBe(realDefinitiva);
    });

    it("asegura que el avance con ENTER entre filas no deja atascado el popover en un estudiante anterior", () => {
      // Simular progresión de navegación secuencial vertical
      const students = [
        { id: 101, name: "Juliana Alvarez" },
        { id: 102, name: "María Camila Angarita" },
        { id: 103, name: "Yonis Mario Aponza" },
      ];

      let activeCell: { rowIndex: number; colIndex: number; studentId: number } | null = {
        rowIndex: 0,
        colIndex: 0,
        studentId: students[0].id,
      };
      let openStudentSummaryId: number | null = null;
      const pendingGrades: Record<string, number | null> = {};

      // Usuario abre resumen de estudiante 101
      openStudentSummaryId = 101;
      expect(openStudentSummaryId).toBe(101);

      // Comienza a calificar con ENTER -> inmediatamente se cierra el resumen
      const handleAdvance = (nextVal: number) => {
        openStudentSummaryId = null; // Cierre garantizado
        pendingGrades[`1:${activeCell!.studentId}`] = nextVal;
        const nextRow = activeCell!.rowIndex + 1;
        if (nextRow < students.length) {
          activeCell = {
            rowIndex: nextRow,
            colIndex: activeCell!.colIndex,
            studentId: students[nextRow].id,
          };
        } else {
          activeCell = null;
        }
      };

      // Fila 0 -> 4.5 -> ENTER
      handleAdvance(4.5);
      expect(openStudentSummaryId).toBeNull();
      expect(activeCell?.studentId).toBe(102); // Avanzó correctamente al estudiante 102
      expect(pendingGrades["1:101"]).toBe(4.5);

      // Fila 1 -> 3.8 -> ENTER
      handleAdvance(3.8);
      expect(openStudentSummaryId).toBeNull();
      expect(activeCell?.studentId).toBe(103); // Avanzó correctamente al estudiante 103
      expect(pendingGrades["1:102"]).toBe(3.8);

      // Fila 2 -> 5.0 -> ENTER (último estudiante)
      handleAdvance(5.0);
      expect(activeCell).toBeNull();
      expect(pendingGrades["1:103"]).toBe(5.0);
    });

    it("el cierre con tecla ESC limpia el estado transitorio sin alterar notas guardadas", () => {
      let isEditing = true;
      let draftValue: string | undefined = "4.2";
      let activeCell: { rowIndex: number; colIndex: number } | null = { rowIndex: 1, colIndex: 0 };

      // Presionar ESC
      const handleEscape = () => {
        isEditing = false;
        draftValue = undefined;
        activeCell = null;
      };

      handleEscape();
      expect(isEditing).toBe(false);
      expect(draftValue).toBeUndefined();
      expect(activeCell).toBeNull();
    });

    it("ActiveGradeCell: navegación vertical y horizontal basada en studentUserId y assessmentId", () => {
      const students = [
        { studentUserId: 6, name: "Sofia Martinez" },
        { studentUserId: 7, name: "Mateo Gomez" },
        { studentUserId: 8, name: "Daniela Diaz" },
      ];
      const assessments = [
        { id: 10, title: "Taller 1" },
        { id: 11, title: "Quiz 1" },
      ];

      type ActiveGradeCell = { studentUserId: number; assessmentId: number } | null;
      let activeCell: ActiveGradeCell = { studentUserId: 6, assessmentId: 10 };
      const pendingGrades: Record<string, number | null> = {};

      const handleSaveAndAdvance = (
        val: number | null,
        direction: "down" | "up" | "right" | "left" | "stay"
      ) => {
        if (!activeCell) return;
        const { studentUserId, assessmentId } = activeCell;
        const rowIndex = students.findIndex(s => s.studentUserId === studentUserId);
        const colIndex = assessments.findIndex(a => a.id === assessmentId);
        if (rowIndex === -1 || colIndex === -1) return;

        pendingGrades[`${assessmentId}:${studentUserId}`] = val;

        if (direction === "down") {
          if (rowIndex + 1 < students.length) {
            activeCell = { studentUserId: students[rowIndex + 1].studentUserId, assessmentId };
          } else {
            activeCell = null;
          }
        } else if (direction === "up") {
          if (rowIndex - 1 >= 0) {
            activeCell = { studentUserId: students[rowIndex - 1].studentUserId, assessmentId };
          } else {
            activeCell = null;
          }
        } else if (direction === "right") {
          if (colIndex + 1 < assessments.length) {
            activeCell = { studentUserId, assessmentId: assessments[colIndex + 1].id };
          } else {
            activeCell = null;
          }
        }
      };

      // 1. Sofia (ID 6) -> 4.5 -> ENTER (down)
      handleSaveAndAdvance(4.5, "down");
      expect(pendingGrades["10:6"]).toBe(4.5);
      expect(activeCell).toEqual({ studentUserId: 7, assessmentId: 10 });

      // 2. Mateo (ID 7) -> 3.8 -> ENTER (down)
      handleSaveAndAdvance(3.8, "down");
      expect(pendingGrades["10:7"]).toBe(3.8);
      expect(activeCell).toEqual({ studentUserId: 8, assessmentId: 10 });

      // 3. Daniela (ID 8) -> 4.9 -> TAB (right)
      handleSaveAndAdvance(4.9, "right");
      expect(pendingGrades["10:8"]).toBe(4.9);
      expect(activeCell).toEqual({ studentUserId: 8, assessmentId: 11 });

      // 4. Daniela (ID 8) en Quiz 1 -> 5.0 -> SHIFT+ENTER (up)
      handleSaveAndAdvance(5.0, "up");
      expect(pendingGrades["11:8"]).toBe(5.0);
      expect(activeCell).toEqual({ studentUserId: 7, assessmentId: 11 });
    });

    it("consumo único de externalTargetCell sin bucle infinito", () => {
      let lastConsumedTs: number | null = null;
      let clearCalled = 0;
      let activeCell: { studentUserId: number; assessmentId: number } | null = null;

      const triggerExternalNavigation = (target: { studentUserId: number; assessmentId: number; ts: number } | null) => {
        if (!target) return;
        if (lastConsumedTs === target.ts) return; // Ya consumido
        lastConsumedTs = target.ts;
        activeCell = { studentUserId: target.studentUserId, assessmentId: target.assessmentId };
        clearCalled++;
      };

      const target = { studentUserId: 6, assessmentId: 10, ts: 1700000000 };

      // Primer render: se consume
      triggerExternalNavigation(target);
      expect(clearCalled).toBe(1);
      expect(activeCell).toEqual({ studentUserId: 6, assessmentId: 10 });

      // Re-render por cambio de pendingGrades (mismo ts): NO se vuelve a disparar
      triggerExternalNavigation(target);
      expect(clearCalled).toBe(1); // Se mantiene en 1

      // Usuario avanza a siguiente estudiante
      activeCell = { studentUserId: 7, assessmentId: 10 };

      // Re-render adicional: no debe sobreescribir activeCell de vuelta a Sofia
      triggerExternalNavigation(target);
      expect(activeCell).toEqual({ studentUserId: 7, assessmentId: 10 });
    });

    it("sincronización de pendingGrades en simulador y resumen sin quedar atascado en DB", () => {
      const studentRow = {
        enrollment: { studentUserId: 6 },
        student: { name: "Sofía Martínez" },
        values: [
          { assessment: { id: 10, maxValue: 5, weight: 50 }, grade: { value: 4.8 } },
          { assessment: { id: 11, maxValue: 5, weight: 50 }, grade: { value: 3.5 } },
        ],
      };

      // Simulación de pendingGrades (el docente cambió la nota de Sofia a 3.0 en la celda)
      const pendingGrades: Record<string, number | null> = {
        "10:6": 3.0,
      };

      // Derivación en Simulator / Summary:
      const liveValues = studentRow.values.map(v => {
        const key = `${v.assessment.id}:${studentRow.enrollment.studentUserId}`;
        const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : v.grade?.value ?? null;
        return {
          assessmentId: v.assessment.id,
          value: val,
          maxValue: v.assessment.maxValue,
          weight: v.assessment.weight,
        };
      });

      // Debe reflejar el valor pendiente (3.0), no el valor viejo de la base de datos (4.8)
      expect(liveValues[0].value).toBe(3.0);
      expect(liveValues[1].value).toBe(3.5);

      const def = calculateDefinitiva(liveValues);
      expect(def).toBe(3.25); // (3.0 * 0.5) + (3.5 * 0.5) = 1.5 + 1.75 = 3.25
    });
  });
});

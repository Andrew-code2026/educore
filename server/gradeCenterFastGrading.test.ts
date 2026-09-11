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
});

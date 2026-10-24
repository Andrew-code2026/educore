export const assessmentLabels: Record<string, string> = {
  QUIZ: "Quiz",
  TALLER: "Taller",
  EXAMEN: "Examen",
  PROYECTO: "Proyecto",
  ACTIVIDAD: "Actividad",
  PARTICIPACION: "Participación",
  RECUPERACION: "Recuperación",
  OTRO: "Otro",
};

export function studentName(student: any): string {
  if (!student) return "Estudiante";
  if (student.name) return student.name;
  const firstName = student.firstName ?? student.givenNames ?? "";
  const lastName = student.lastName ?? student.familyNames ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Estudiante";
}

export function numberValue(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return "—";
  return Number(value).toFixed(1);
}

export type GradeScaleConfig = {
  id?: number;
  name?: string;
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
  status?: string;
};

/**
 * Genera notas sugeridas adaptadas a la escala institucional.
 * Para escala estándar de 0.0 a 5.0 retorna: [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.0].
 * Permite limitar a maxItems (ej. 6) para popovers compactos.
 */
export function generateSuggestedGrades(
  scale?: GradeScaleConfig | number | null,
  assessmentMaxValue = 5,
  maxItems?: number
): number[] {
  const isScaleNumber = typeof scale === "number";
  const actualScale = isScaleNumber ? null : scale;
  const max = actualScale?.maxValue ?? (isScaleNumber ? scale : assessmentMaxValue) ?? 5;
  const min = actualScale?.minValue ?? 0;

  if (max === 5 && min === 0) {
    const defaultList = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.0];
    return maxItems ? defaultList.slice(0, maxItems) : defaultList;
  }

  // Generar escalones representativos adaptados a la escala
  const count = maxItems ?? 8;
  const step = (max - min) / count;
  const suggestions: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = max - i * step;
    suggestions.push(Number(val.toFixed(actualScale?.decimalPlaces ?? 1)));
  }
  return suggestions;
}

/**
 * Calcula el promedio ponderado de acuerdo con la lógica de negocio oficial de EduCore.
 */
export function calculateDefinitiva(
  values: Array<{ value: number | string | null; maxValue: number | string; weight: number | string }>
): number | null {
  const recorded = values.filter(item => item.value !== null && !isNaN(Number(item.value)));
  if (!recorded.length) return null;
  const weightTotal = recorded.reduce((sum, item) => sum + Number(item.weight), 0);
  if (weightTotal > 0) {
    const weightedSum = recorded.reduce(
      (sum, item) => sum + ((Number(item.value) / Number(item.maxValue)) * 5 * Number(item.weight)),
      0
    );
    return Number((weightedSum / weightTotal).toFixed(2));
  }
  const simpleSum = recorded.reduce(
    (sum, item) => sum + ((Number(item.value) / Number(item.maxValue)) * 5),
    0
  );
  return Number((simpleSum / recorded.length).toFixed(2));
}

/**
 * Estilos visuales sutiles según rango de desempeño institucional sobre 5.0:
 * - 0.0 – 3.4: Bajo / pierde
 * - 3.5 – 3.9: Básico (3.5 es la nota mínima aprobatoria)
 * - 4.0 – 4.6: Alto
 * - 4.7 – 5.0: Superior
 */
export function getPerformanceTone(value: number | null | undefined): {
  textColor: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  label: string;
} {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return {
      textColor: "text-slate-400",
      bgColor: "bg-transparent",
      borderColor: "border-slate-200",
      badgeColor: "bg-slate-100 text-slate-500",
      label: "Sin nota",
    };
  }
  const num = Number(value);
  if (num < 3.5) {
    return {
      textColor: "text-rose-600",
      bgColor: "bg-rose-50/50",
      borderColor: "border-rose-200",
      badgeColor: "bg-rose-50 text-rose-700 border border-rose-200/60",
      label: "Bajo",
    };
  }
  if (num < 4.0) {
    return {
      textColor: "text-amber-700",
      bgColor: "bg-amber-50/40",
      borderColor: "border-amber-200",
      badgeColor: "bg-amber-50 text-amber-700 border border-amber-200/60",
      label: "Básico",
    };
  }
  if (num < 4.7) {
    return {
      textColor: "text-blue-700",
      bgColor: "bg-blue-50/30",
      borderColor: "border-blue-200",
      badgeColor: "bg-blue-50 text-blue-700 border border-blue-200/60",
      label: "Alto",
    };
  }
  return {
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50/30",
    borderColor: "border-emerald-200",
    badgeColor: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    label: "Superior",
  };
}

/**
 * Normaliza y analiza un valor de entrada de texto a número decimal o null.
 * Soporta coma o punto como separador decimal.
 */
export function parseGradeInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === "—") return null;
  const normalized = trimmed.replace(",", ".");
  const num = Number(normalized);
  return isNaN(num) ? NaN : num;
}

/**
 * Valida un valor de calificación frente a la escala institucional y el valor máximo de la evaluación.
 */
export function validateGradeAgainstScale(
  val: number | null | undefined,
  scale?: GradeScaleConfig | null,
  assessmentMaxValue = 5
): { valid: boolean; error?: string } {
  if (val === null || val === undefined) {
    return { valid: true };
  }
  if (isNaN(val)) {
    return { valid: false, error: "Ingresa un número válido" };
  }
  const min = scale?.minValue ?? 0;
  const max = Math.min(scale?.maxValue ?? assessmentMaxValue, assessmentMaxValue);
  if (val < min || val > max) {
    return { valid: false, error: `La nota debe estar entre ${min} y ${max}` };
  }
  return { valid: true };
}

/**
 * Estilo visual unificado Liquid Glass para Popovers del Grade Center (Fase 5.3-B / 6)
 * Provee bordes, sombras, radio, padding y blur idénticos para StudentSummaryPopover y GradeCellEditorPopover.
 */
export const POPOVER_GLASS_PANEL_CLASS =
  "z-50 rounded-2xl border border-white/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-[0_16px_36px_rgba(29,78,137,0.14),0_0_0_1px_rgba(255,255,255,0.7)_inset] backdrop-blur-xl transition-all outline-none";

/**
 * Sistema de Vistas y Densidad Espacial (Subfase 2, Iteración 1: Grid 2.0)
 * - standard: equilibrio entre información y legibilidad
 * - compact: máxima cantidad de evaluaciones y estudiantes visibles simultáneamente
 */
export type GradeGridDensity = "standard" | "compact";

export interface GridDensityConfig {
  key: GradeGridDensity;
  label: string;
  description: string;
  checkboxWidth: number; // px
  studentWidth: number; // px
  assessmentWidth: number; // px
  definitivaWidth: number; // px
  rowHeightClass: string;
  cellPaddingClass: string;
  cellButtonClass: string;
  headerHeightClass: string;
  textSizes: {
    studentName: string;
    studentMeta: string;
    assessmentTitle: string;
    assessmentWeight: string;
    gradeValue: string;
    definitivaValue: string;
  };
}

export function getGridDensityConfig(density: GradeGridDensity): GridDensityConfig {
  if (density === "compact") {
    return {
      key: "compact",
      label: "Compacta",
      description: "Máxima cantidad de evaluaciones y estudiantes visibles",
      checkboxWidth: 32,
      studentWidth: 138,
      assessmentWidth: 56,
      definitivaWidth: 60,
      rowHeightClass: "h-8.5",
      cellPaddingClass: "px-1 py-0.5",
      cellButtonClass: "h-7 w-11 text-xs font-semibold rounded-md",
      headerHeightClass: "h-14 py-1",
      textSizes: {
        studentName: "text-xs font-bold",
        studentMeta: "text-xs",
        assessmentTitle: "text-xs",
        assessmentWeight: "text-xs",
        gradeValue: "text-xs",
        definitivaValue: "text-xs font-extrabold",
      },
    };
  }

  return {
    key: "standard",
    label: "Estándar",
    description: "Equilibrio entre espacio e información detallada",
    checkboxWidth: 36,
    studentWidth: 180,
    assessmentWidth: 76,
    definitivaWidth: 84,
    rowHeightClass: "h-10",
    cellPaddingClass: "px-1.5 py-1",
    cellButtonClass: "h-8 w-15 text-sm font-semibold rounded-lg",
    headerHeightClass: "h-16 py-1.5",
    textSizes: {
      studentName: "text-xs font-bold",
      studentMeta: "text-xs",
      assessmentTitle: "text-xs font-semibold",
      assessmentWeight: "text-xs",
      gradeValue: "text-sm",
      definitivaValue: "text-sm font-extrabold",
    },
  };
}

/**
 * Divide armónicamente el título de una evaluación en hasta dos líneas legibles,
 * evitando cortes bruscos en medio de palabras para encabezados compactos.
 */
export function splitAssessmentTitle(title: string): { line1: string; line2?: string } {
  const trimmed = title.trim();
  if (!trimmed) return { line1: "" };
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return { line1: trimmed };
  }
  if (words.length === 2) {
    return { line1: words[0], line2: words[1] };
  }
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" "),
    line2: words.slice(mid).join(" "),
  };
}

/**
 * Código corto representativo de evaluación para encabezados de alta densidad (ej. E1, T2, Q3)
 */
export function formatAssessmentCode(index: number, assessmentType: string): string {
  const prefixMap: Record<string, string> = {
    QUIZ: "Q",
    TALLER: "T",
    WORKSHOP: "T",
    HOMEWORK: "T",
    EXAMEN: "E",
    EXAM: "E",
    PROYECTO: "P",
    PROJECT: "P",
    ACTIVIDAD: "A",
    ACTIVITY: "A",
    PARTICIPACION: "Pa",
    PARTICIPATION: "Pa",
    RECUPERACION: "R",
    RECOVERY: "R",
    OTRO: "O",
    OTHER: "O",
  };
  const prefix = prefixMap[assessmentType] ?? "E";
  return `${prefix}${index + 1}`;
}


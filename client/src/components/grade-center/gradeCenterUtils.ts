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
 * Estilos visuales sutiles según rango de desempeño
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
  if (num < 3.0) {
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
      textColor: "text-slate-700",
      bgColor: "bg-slate-50/40",
      borderColor: "border-slate-200",
      badgeColor: "bg-amber-50 text-amber-700 border border-amber-200/60",
      label: "Básico",
    };
  }
  if (num < 4.6) {
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


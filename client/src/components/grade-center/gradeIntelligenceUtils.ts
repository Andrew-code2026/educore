import {
  type GradeScaleConfig,
  calculateDefinitiva,
  studentName,
} from "./gradeCenterUtils";
import type { GradeCenterTableRow } from "./GradeCenterTable";

/**
 * Obtiene la nota mínima aprobatoria institucional.
 * Por defecto 3.0 para la escala estándar colombiana (0.0 - 5.0) o el 60% del rango si difiere.
 */
export function getInstitutionalPassingGrade(scale?: GradeScaleConfig | null): number {
  if (scale && (scale as any).passingGrade !== undefined && (scale as any).passingGrade !== null) {
    return Number((scale as any).passingGrade);
  }
  const min = scale?.minValue ?? 0;
  const max = scale?.maxValue ?? 5;
  if (min === 0 && max === 5) {
    return 3.0;
  }
  // 60% estándar del rango
  const calculated = min + (max - min) * 0.6;
  const decimals = scale?.decimalPlaces ?? 1;
  return Number(calculated.toFixed(decimals));
}

export interface StudentProjectionResult {
  currentDefinitiva: number | null;
  projectedDefinitiva: number | null;
  hasPending: boolean;
  totalAssessments: number;
  recordedCount: number;
  pendingCount: number;
  recordedWeight: number;
  pendingWeight: number;
}

/**
 * Calcula la proyección de definitiva cuando existen evaluaciones pendientes.
 * Si todas están calificadas, projectedDefinitiva es null (se usa la definitiva real).
 * Si ninguna está calificada, no inventa proyección (projectedDefinitiva es null).
 * La proyección se basa en el desempeño ponderado y la tendencia de las evaluaciones ya registradas.
 */
export function calculateStudentProjection(
  values: Array<{ value: number | null; maxValue: number; weight: number }>,
  scale?: GradeScaleConfig | null
): StudentProjectionResult {
  const totalAssessments = values.length;
  const recorded = values.filter(v => v.value !== null && !isNaN(Number(v.value)));
  const pending = values.filter(v => v.value === null || isNaN(Number(v.value)));

  const recordedCount = recorded.length;
  const pendingCount = pending.length;
  const hasPending = pendingCount > 0;

  const recordedWeight = recorded.reduce((sum, v) => sum + v.weight, 0);
  const pendingWeight = pending.reduce((sum, v) => sum + v.weight, 0);

  const currentDefinitiva = calculateDefinitiva(values);

  if (!hasPending || recordedCount === 0 || currentDefinitiva === null) {
    return {
      currentDefinitiva,
      projectedDefinitiva: null,
      hasPending,
      totalAssessments,
      recordedCount,
      pendingCount,
      recordedWeight,
      pendingWeight,
    };
  }

  // Desempeño normalizado promedio actual
  const min = scale?.minValue ?? 0;
  const max = scale?.maxValue ?? 5;

  // Si hay más de 1 nota registrada, analizar la tendencia (pendiente reciente)
  let projectedPendingRate = currentDefinitiva;
  if (recorded.length >= 2) {
    const normalizedHistory = recorded.map(v => (Number(v.value) / v.maxValue) * max);
    // Tendencia ponderada: dar 60% de peso a la segunda mitad de notas y 40% al promedio global
    const recentHalf = normalizedHistory.slice(Math.floor(normalizedHistory.length / 2));
    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    projectedPendingRate = 0.4 * currentDefinitiva + 0.6 * recentAvg;
  }

  // Clampear la tasa proyectada para las pendientes dentro de la escala
  const clampedPending = Math.max(min, Math.min(max, projectedPendingRate));

  // Simular la definitiva ponderada con la nota proyectada en las evaluaciones pendientes
  const simulatedValues = values.map(v => ({
    value: v.value !== null && !isNaN(Number(v.value)) ? Number(v.value) : clampedPending,
    maxValue: v.maxValue,
    weight: v.weight,
  }));

  const projectedDefinitiva = calculateDefinitiva(simulatedValues);

  return {
    currentDefinitiva,
    projectedDefinitiva,
    hasPending,
    totalAssessments,
    recordedCount,
    pendingCount,
    recordedWeight,
    pendingWeight,
  };
}

export interface WhatIsNeededScenario {
  grade: number;
  resultingDefinitiva: number;
  passes: boolean;
  isPassing: boolean;
}

export interface WhatIsNeededResult {
  hasPending: boolean;
  isGuaranteedPass: boolean;
  isGuaranteed: boolean;
  isImpossible: boolean;
  requiredGrade: number | null;
  passingGrade: number;
  currentDefinitiva: number | null;
  pendingWeight: number;
  pendingCount?: number;
  message: string;
  scenarios: WhatIsNeededScenario[];
}

/**
 * "¿Qué necesito para aprobar?"
 * Cálculo exacto y determinístico de la nota promedio requerida en las evaluaciones pendientes
 * para alcanzar la nota mínima aprobatoria institucional.
 */
export function calculateWhatIsNeededToPass(
  values: Array<{ value: number | null; maxValue: number; weight: number }>,
  scale?: GradeScaleConfig | null
): WhatIsNeededResult {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const min = scale?.minValue ?? 0;
  const max = scale?.maxValue ?? 5;
  const decimals = scale?.decimalPlaces ?? 1;

  const recorded = values.filter(v => v.value !== null && !isNaN(Number(v.value)));
  const pending = values.filter(v => v.value === null || isNaN(Number(v.value)));

  const currentDefinitiva = calculateDefinitiva(values);
  const hasPending = pending.length > 0;
  const pendingCount = pending.length;

  const totalWeight = values.reduce((sum, v) => sum + Number(v.weight), 0) || 100;
  const pendingWeight = pending.reduce((sum, v) => sum + Number(v.weight), 0);

  // Puntos ponderados acumulados hasta el momento (normalizados a escala de max)
  const recordedPoints = recorded.reduce(
    (sum, v) => sum + ((Number(v.value) / Number(v.maxValue)) * max * Number(v.weight)),
    0
  );

  // Escenarios estándar (adaptados a la escala institucional)
  const standardTestGrades = [
    Number((min + (max - min) * 0.6).toFixed(decimals)), // ej: 3.0
    Number((min + (max - min) * 0.7).toFixed(decimals)), // ej: 3.5
    Number((min + (max - min) * 0.8).toFixed(decimals)), // ej: 4.0
    max,                                                // ej: 5.0
  ];

  // Generar escenarios para cada nota hipotética
  const scenarios: WhatIsNeededScenario[] = standardTestGrades.map(testGrade => {
    const simValues = values.map(v => ({
      value: v.value !== null && !isNaN(Number(v.value)) ? Number(v.value) : testGrade,
      maxValue: v.maxValue,
      weight: v.weight,
    }));
    const def = calculateDefinitiva(simValues) ?? 0;
    const passes = def >= passingGrade;
    return {
      grade: testGrade,
      resultingDefinitiva: def,
      passes,
      isPassing: passes,
    };
  });

  if (!hasPending) {
    const passes = (currentDefinitiva ?? 0) >= passingGrade;
    return {
      hasPending: false,
      isGuaranteedPass: passes,
      isGuaranteed: passes,
      isImpossible: !passes,
      requiredGrade: null,
      passingGrade,
      currentDefinitiva,
      pendingWeight: 0,
      pendingCount: 0,
      message: passes ? "Materia aprobada" : "Materia no aprobada (todas las notas están registradas)",
      scenarios: [],
    };
  }

  // Puntos necesarios en total para aprobar: passingGrade * totalWeight
  // Puntos faltantes = (passingGrade * totalWeight) - recordedPoints
  // Nota requerida X en las pendientes = Puntos faltantes / pendingWeight
  const pointsNeeded = (passingGrade * totalWeight) - recordedPoints;
  const rawRequired = pointsNeeded / pendingWeight;
  const roundedRequired = Number(rawRequired.toFixed(decimals));

  // 1. Ya tiene asegurada la aprobación incluso con nota mínima (0.0)
  if (rawRequired <= min) {
    return {
      hasPending: true,
      isGuaranteedPass: true,
      isGuaranteed: true,
      isImpossible: false,
      requiredGrade: min,
      passingGrade,
      currentDefinitiva,
      pendingWeight,
      pendingCount,
      message: `Aprobación asegurada (requieres ${min.toFixed(decimals)} en las evaluaciones restantes)`,
      scenarios,
    };
  }

  // 2. Es matemáticamente imposible alcanzar la nota mínima aprobatoria incluso con nota máxima (5.0)
  if (rawRequired > max) {
    return {
      hasPending: true,
      isGuaranteedPass: false,
      isGuaranteed: false,
      isImpossible: true,
      requiredGrade: null,
      passingGrade,
      currentDefinitiva,
      pendingWeight,
      pendingCount,
      message: "Matemáticamente imposible alcanzar la nota mínima con las evaluaciones restantes",
      scenarios,
    };
  }

  // 3. Es alcanzable con una nota requerida válida
  return {
    hasPending: true,
    isGuaranteedPass: false,
    isGuaranteed: false,
    isImpossible: false,
    requiredGrade: roundedRequired,
    passingGrade,
    currentDefinitiva,
    pendingWeight,
    pendingCount,
    message: `Necesitas un promedio de ${roundedRequired.toFixed(decimals)} en las evaluaciones pendientes`,
    scenarios,
  };
}

export type RiskLevel = "ALTO" | "MEDIO" | "SIN_RIESGO";

export interface RiskAssessmentResult {
  level: RiskLevel;
  riskLevel: RiskLevel;
  label: string;
  description: string;
  reason: string;
  colorClass: string;
  badgeClass: string;
  borderClass: string;
  currentDefinitiva: number | null;
  pendingCount: number;
  requiredGrade: number | null;
  studentId?: number;
  studentName?: string;
  whatIsNeeded: WhatIsNeededResult;
}

export type RiskAnalysisResult = RiskAssessmentResult;

/**
 * Clasificación determinística de riesgo académico:
 * - ALTO: Imposible de aprobar o requiere promedio >= 4.5 en las evaluaciones restantes.
 * - MEDIO: Promedio actual reprobatorio pero alcanzable con esfuerzo, o aprobando apenas con alto peso pendiente.
 * - SIN_RIESGO: Va aprobando holgadamente o ya garantizó la aprobación.
 */
export function determineRiskLevel(
  values: Array<{ value: number | null; maxValue: number; weight: number }>,
  scale?: GradeScaleConfig | null,
  studentName?: string,
  studentId?: number
): RiskAssessmentResult {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const max = scale?.maxValue ?? 5;
  const whatNeeded = calculateWhatIsNeededToPass(values, scale);
  const currentDefinitiva = calculateDefinitiva(values);
  const pendingCount = values.filter(v => v.value === null || isNaN(Number(v.value))).length;

  // Si no hay evaluaciones calificadas
  if (currentDefinitiva === null) {
    const desc = "Sin calificaciones registradas aún";
    return {
      level: "SIN_RIESGO",
      riskLevel: "SIN_RIESGO",
      label: "Sin datos",
      description: desc,
      reason: desc,
      colorClass: "text-slate-500",
      badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      borderClass: "border-slate-200",
      currentDefinitiva: null,
      pendingCount,
      requiredGrade: whatNeeded.requiredGrade,
      studentId,
      studentName,
      whatIsNeeded: whatNeeded,
    };
  }

  // RIESGO ALTO:
  // - Matemáticamente imposible de aprobar
  // - O requiere nota >= 4.5 sobre 5.0 (o >= 90% del máximo) en pendientes
  // - O no tiene pendientes y reprobó
  const thresholdAlto = max - 0.5; // ej: 4.5 en escala de 5
  if (
    whatNeeded.isImpossible ||
    (!whatNeeded.hasPending && currentDefinitiva < passingGrade) ||
    (whatNeeded.requiredGrade !== null && whatNeeded.requiredGrade >= thresholdAlto)
  ) {
    const desc = whatNeeded.isImpossible
      ? "Imposible alcanzar aprobación con las evaluaciones restantes"
      : "La trayectoria actual hace muy difícil alcanzar la aprobación";
    return {
      level: "ALTO",
      riskLevel: "ALTO",
      label: "Riesgo Alto",
      description: desc,
      reason: desc,
      colorClass: "text-rose-600 dark:text-rose-400",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
      borderClass: "border-rose-300",
      currentDefinitiva,
      pendingCount,
      requiredGrade: whatNeeded.requiredGrade,
      studentId,
      studentName,
      whatIsNeeded: whatNeeded,
    };
  }

  // RIESGO MEDIO:
  // - Actualmente reprobando (< passingGrade), pero recuperable con nota < 4.5
  // - O actualmente aprobando pero con margen muy estrecho (< passingGrade + 0.3) y alto peso pendiente (>= 30%)
  const isCurrentlyFailing = currentDefinitiva < passingGrade;
  const isCloseToMargin = currentDefinitiva < passingGrade + 0.3 && whatNeeded.pendingWeight >= 30;

  if (isCurrentlyFailing || isCloseToMargin) {
    const desc = isCurrentlyFailing
      ? "Puede aprobar, pero necesita mejorar su rendimiento"
      : "Aprobando al límite; debe mantener el ritmo en pendientes";
    return {
      level: "MEDIO",
      riskLevel: "MEDIO",
      label: "Riesgo Medio",
      description: desc,
      reason: desc,
      colorClass: "text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
      borderClass: "border-amber-300",
      currentDefinitiva,
      pendingCount,
      requiredGrade: whatNeeded.requiredGrade,
      studentId,
      studentName,
      whatIsNeeded: whatNeeded,
    };
  }

  // SIN RIESGO
  const desc = "La trayectoria actual permite alcanzar o mantener la aprobación";
  return {
    level: "SIN_RIESGO",
    riskLevel: "SIN_RIESGO",
    label: "Sin riesgo",
    description: desc,
    reason: desc,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
    borderClass: "border-emerald-200",
    currentDefinitiva,
    pendingCount,
    requiredGrade: whatNeeded.requiredGrade,
    studentId,
    studentName,
    whatIsNeeded: whatNeeded,
  };
}

export interface PendingCellItem {
  studentId: number;
  studentName: string;
  rowIndex: number;
  colIndex: number;
  assessmentId: number;
  assessmentTitle: string;
  assessmentWeight: number;
}

export interface StudentPendingGroup {
  studentId: number;
  studentName: string;
  rowIndex: number;
  items: Array<{
    colIndex: number;
    assessmentId: number;
    assessmentTitle: string;
    assessmentWeight: number;
  }>;
}

/**
 * Obtiene el desglose consolidado de todas las calificaciones pendientes en el contexto actual,
 * estructuradas para navegación interactiva directa a la celda del Grade Center.
 */
export function getPendingGradesBreakdown(
  rows: GradeCenterTableRow[],
  assessments: Array<{ id: number; title: string; weight: number }>,
  pendingGrades: Record<string, number | null> = {}
): {
  totalPending: number;
  studentsWithPending: StudentPendingGroup[];
  flatItems: PendingCellItem[];
} {
  const flatItems: PendingCellItem[] = [];
  const studentMap = new Map<number, StudentPendingGroup>();

  rows.forEach((row, rowIndex) => {
    const sId = row.enrollment.studentUserId;
    const sName = studentName(row.student);

    assessments.forEach((assessment, colIndex) => {
      const key = `${assessment.id}:${sId}`;
      const originalItem = row.values.find(v => v.assessment.id === assessment.id);
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : originalItem?.grade?.value ?? null;

      if (val === null || val === undefined || isNaN(Number(val))) {
        const item: PendingCellItem = {
          studentId: sId,
          studentName: sName,
          rowIndex,
          colIndex,
          assessmentId: assessment.id,
          assessmentTitle: assessment.title,
          assessmentWeight: assessment.weight,
        };
        flatItems.push(item);

        if (!studentMap.has(sId)) {
          studentMap.set(sId, {
            studentId: sId,
            studentName: sName,
            rowIndex,
            items: [],
          });
        }
        studentMap.get(sId)!.items.push({
          colIndex,
          assessmentId: assessment.id,
          assessmentTitle: assessment.title,
          assessmentWeight: assessment.weight,
        });
      }
    });
  });

  return {
    totalPending: flatItems.length,
    studentsWithPending: Array.from(studentMap.values()),
    flatItems,
  };
}

export type PendingGradeItem = PendingCellItem;

export interface GroupIntelligenceSummary {
  totalStudents: number;
  courseAverage: number | null;
  groupAverage: number | null;
  passingCount: number;
  failingCount: number;
  passingPercentage: number;
  atRiskCount: number;
  totalAtRisk: number;
  atRiskHighCount: number;
  atRiskMediumCount: number;
  highRiskStudents: RiskAssessmentResult[];
  mediumRiskStudents: RiskAssessmentResult[];
  totalPendingCount: number;
  totalPendingGrades: number;
  pendingItems: PendingCellItem[];
  completionRate: number;
  passingGrade: number;
}

/**
 * Resumen inteligente del grupo para la barra superior del Grade Center.
 */
export function getGroupIntelligenceSummary(
  rows: GradeCenterTableRow[],
  assessments: Array<{ id: number; title: string; weight: number; maxValue?: number; maxScore?: number }>,
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null
): GroupIntelligenceSummary {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const totalStudents = rows.length;

  const normalizedAssessments = assessments.map(a => ({
    id: a.id,
    title: a.title,
    weight: a.weight,
    maxValue: Number(a.maxValue ?? (a as any).maxScore ?? (scale?.maxValue ?? 5)),
  }));

  const { totalPending, flatItems: pendingItems } = getPendingGradesBreakdown(rows, normalizedAssessments, pendingGrades);

  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      courseAverage: null,
      groupAverage: null,
      passingCount: 0,
      failingCount: 0,
      passingPercentage: 0,
      atRiskCount: 0,
      totalAtRisk: 0,
      atRiskHighCount: 0,
      atRiskMediumCount: 0,
      highRiskStudents: [],
      mediumRiskStudents: [],
      totalPendingCount: 0,
      totalPendingGrades: 0,
      pendingItems: [],
      completionRate: 0,
      passingGrade,
    };
  }

  let sumAverages = 0;
  let studentsWithAverage = 0;
  let passingCount = 0;
  let failingCount = 0;
  const highRiskStudents: RiskAssessmentResult[] = [];
  const mediumRiskStudents: RiskAssessmentResult[] = [];

  rows.forEach(row => {
    const sId = row.enrollment.studentUserId;
    const sName = studentName(row.student);
    const liveValues = normalizedAssessments.map(assessment => {
      const key = `${assessment.id}:${sId}`;
      const originalItem = row.values.find(v => v.assessment.id === assessment.id);
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : originalItem?.grade?.value ?? null;
      return {
        value: val,
        maxValue: assessment.maxValue,
        weight: assessment.weight,
      };
    });

    const def = calculateDefinitiva(liveValues);
    if (def !== null) {
      sumAverages += def;
      studentsWithAverage++;
      if (def >= passingGrade) {
        passingCount++;
      } else {
        failingCount++;
      }
    }

    const risk = determineRiskLevel(liveValues, scale, sName, sId);
    if (risk.level === "ALTO") {
      highRiskStudents.push(risk);
    } else if (risk.level === "MEDIO") {
      mediumRiskStudents.push(risk);
    }
  });

  const courseAverage = studentsWithAverage > 0
    ? Number((sumAverages / studentsWithAverage).toFixed(2))
    : null;

  const totalCells = totalStudents * normalizedAssessments.length;
  const gradedCells = totalCells - totalPending;
  const completionRate = totalCells > 0 ? Math.round((gradedCells / totalCells) * 100) : 0;
  const passingPercentage = totalStudents > 0 ? Math.round((passingCount / totalStudents) * 100) : 0;
  const totalAtRisk = highRiskStudents.length + mediumRiskStudents.length;

  return {
    totalStudents,
    courseAverage,
    groupAverage: courseAverage,
    passingCount,
    failingCount,
    passingPercentage,
    atRiskCount: totalAtRisk,
    totalAtRisk,
    atRiskHighCount: highRiskStudents.length,
    atRiskMediumCount: mediumRiskStudents.length,
    highRiskStudents,
    mediumRiskStudents,
    totalPendingCount: totalPending,
    totalPendingGrades: totalPending,
    pendingItems,
    completionRate,
    passingGrade,
  };
}

export interface SimulationResult {
  actualDefinitiva: number | null;
  simulatedDefinitiva: number | null;
  simulatedCount: number;
  pendingCount: number;
}

/**
 * Simulación reactiva en memoria de la definitiva de un estudiante.
 * No muta la base de datos ni los objetos originales.
 */
export function simulateDefinitiva(
  baseValues: Array<{ value: number | null; maxValue: number; weight: number }>,
  pendingOverrides: Array<{ value: number | null; maxValue: number; weight: number }>
): SimulationResult {
  const actualDefinitiva = calculateDefinitiva(baseValues);

  let overrideIdx = 0;
  let simulatedCount = 0;
  let pendingCount = 0;

  const simulatedValues = baseValues.map(item => {
    if (item.value === null || isNaN(Number(item.value))) {
      pendingCount++;
      const override = pendingOverrides[overrideIdx++];
      if (override && override.value !== null && !isNaN(Number(override.value))) {
        simulatedCount++;
        return {
          value: Number(override.value),
          maxValue: override.maxValue ?? item.maxValue,
          weight: override.weight ?? item.weight,
        };
      }
      return item;
    }
    return item;
  });

  const simulatedDefinitiva = calculateDefinitiva(simulatedValues);

  return {
    actualDefinitiva,
    simulatedDefinitiva,
    simulatedCount,
    pendingCount,
  };
}

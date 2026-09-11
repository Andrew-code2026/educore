/**
 * EDUCORE — FASE 5.3-D: MOTOR DE ESTADÍSTICAS AVANZADAS DEL GRADE CENTER
 *
 * Funciones puras, deterministas y altamente optimizadas para el cálculo
 * estadístico y pedagógico del rendimiento académico en EduCore.
 *
 * - Cero dependencias de React o DOM.
 * - Sin consultas directas a base de datos.
 * - Manejo riguroso de casos borde (grupos vacíos, 1 nota, división por cero, NaN).
 * - Respeta dinámicamente la escala institucional configurada.
 */

// =======================================================
// TIPOS E INTERFACES BASE
// =======================================================

export interface GradeScaleConfig {
  id?: number;
  name?: string;
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
  passingGrade?: number;
  status?: string;
}

export interface AssessmentLike {
  id: number;
  title: string;
  assessmentType?: string;
  weight: number | string;
  maxValue: number | string;
  date?: Date | string | null;
  description?: string | null;
}

export interface StudentRowLike {
  enrollment: {
    studentUserId: number;
    id?: number;
  };
  student?: {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    givenNames?: string;
    familyNames?: string;
    email?: string;
  } | null;
  values: Array<{
    assessment: AssessmentLike;
    grade?: {
      value: number | string | null;
      comment?: string | null;
    } | null;
  }>;
  average?: number | null;
}

export interface GradeDistributionBin {
  id: string;
  min: number;
  max: number;
  label: string;
  rangeLabel?: string;
  count: number;
  percentage: number;
  isPassing: boolean;
}

export interface AssessmentStatItem {
  assessmentId: number;
  title: string;
  assessmentType: string;
  weight: number;
  maxValue: number;
  average: number | null;
  median: number | null;
  minGrade: number | null;
  maxGrade: number | null;
  standardDeviation: number | null;
  evaluatedCount: number;
  pendingCount: number;
  passingCount: number;
  passingPercentage: number;
  distribution: GradeDistributionBin[];
  interpretation: string;
  isHighestAverage?: boolean;
  isLowestAverage?: boolean;
}

export interface AssessmentComparisonResult {
  items: AssessmentStatItem[];
  highestPerforming: AssessmentStatItem | null;
  lowestPerforming: AssessmentStatItem | null;
  highestAssessment?: AssessmentStatItem | null;
  lowestAssessment?: AssessmentStatItem | null;
  totalAssessments: number;
}

export interface EvolutionPoint {
  index: number;
  assessmentId: number;
  assessmentTitle: string;
  weight: number;
  date?: string | Date | null;
  groupAverage: number | null;
  passingPercentage: number;
  evaluatedCount?: number;
}

export type TrendDirection = "ASCENDENTE" | "DESCENDENTE" | "ESTABLE" | "INSUFICIENTE";

export interface PerformanceEvolutionResult {
  timeline: EvolutionPoint[];
  trend: TrendDirection;
  trendLabel: string;
  firstAssessment: { id: number; title: string; date?: string | Date | null; average: number | null } | null;
  latestAssessment: { id: number; title: string; date?: string | Date | null; average: number | null } | null;
  overallDelta: number | null;
}

export interface StudentEvolutionPoint {
  index: number;
  assessmentId: number;
  assessmentTitle: string;
  weight: number;
  studentGrade: number | null;
  groupAverage: number | null;
  deltaVsGroup: number | null;
  isPending: boolean;
}

export interface RelativeRankInfo {
  position: number;
  total: number;
  label: string;
}

export interface StudentStatisticsResult {
  studentId: number;
  studentName: string;
  currentAverage: number | null;
  median: number | null;
  minGrade: number | null;
  maxGrade: number | null;
  standardDeviation: number | null;
  evaluatedCount: number;
  pendingCount: number;
  totalAssessments: number;
  approvalRate: number;
  groupAverage: number | null;
  deltaVsGroup: number | null;
  vsGroupLabel: string;
  relativeRank: RelativeRankInfo | null;
  trend: TrendDirection;
  trendLabel: string;
  bestAssessment: { title: string; grade: number } | null;
  lowestAssessment: { title: string; grade: number } | null;
  timeline: StudentEvolutionPoint[];
}

export type StudentEvolutionStats = StudentStatisticsResult;

export type InsightType = "INFO" | "WARNING" | "SUCCESS" | "ACTION";

export interface TeacherInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  metric?: string;
  actionTarget?: {
    type: "CELL" | "ASSESSMENT" | "RISK";
    assessmentId?: number;
    studentId?: number;
  };
}

export interface AdvancedGroupStatistics {
  totalStudents: number;
  groupAverage: number | null;
  generalMean?: number | null;
  median: number | null;
  generalMedian?: number | null;
  minGrade: number | null;
  maxGrade: number | null;
  standardDeviation: number | null;
  evaluatedStudentsCount: number;
  passingCount: number;
  passingStudentsCount?: number;
  failingCount: number;
  passingPercentage: number;
  totalAtRisk: number;
  atRiskStudentsCount?: number;
  totalPendingCount: number;
  pendingGradesCount?: number;
  passingGrade: number;
  distribution: GradeDistributionBin[];
  assessmentComparison: AssessmentComparisonResult;
  comparison?: AssessmentComparisonResult;
  evolution: EvolutionPoint[];
  performanceEvolution: PerformanceEvolutionResult;
  insights: TeacherInsight[];
}

// =======================================================
// UTILIDADES AUXILIARES INTERNAS
// =======================================================

function sanitizeValues(values: (number | string | null | undefined)[]): number[] {
  if (!Array.isArray(values)) return [];
  const result: number[] = [];
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const num = typeof v === "number" ? v : Number(v);
    if (!isNaN(num) && isFinite(num)) {
      result.push(num);
    }
  }
  return result;
}

export function getInstitutionalPassingGrade(scale?: GradeScaleConfig | null): number {
  if (scale && scale.passingGrade !== undefined && scale.passingGrade !== null) {
    const num = Number(scale.passingGrade);
    if (!isNaN(num)) return num;
  }
  const min = scale?.minValue ?? 0;
  const max = scale?.maxValue ?? 5;
  if (min === 0 && max === 5) {
    return 3.0;
  }
  // 60% estándar del rango institucional
  const calculated = min + (max - min) * 0.6;
  const decimals = scale?.decimalPlaces ?? 1;
  return Number(calculated.toFixed(decimals));
}

function resolveStudentDisplayName(student: any): string {
  if (!student) return "Estudiante";
  if (student.name) return String(student.name).trim();
  const first = student.firstName ?? student.givenNames ?? "";
  const last = student.lastName ?? student.familyNames ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Estudiante";
}

// =======================================================
// 1. PROMEDIO (CALCULATE AVERAGE / MEAN)
// =======================================================

export function calculateAverage(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2
): number | null {
  const valid = sanitizeValues(values);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return Number((sum / valid.length).toFixed(decimalPlaces));
}

export const calculateMean = calculateAverage;

// =======================================================
// 2. MEDIANA (CALCULATE MEDIAN)
// =======================================================

export function calculateMedian(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2
): number | null {
  const valid = sanitizeValues(values).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 !== 0) {
    return Number(valid[mid].toFixed(decimalPlaces));
  }
  const med = (valid[mid - 1] + valid[mid]) / 2;
  return Number(med.toFixed(decimalPlaces));
}

// =======================================================
// 3. MÍNIMO Y MÁXIMO (CALCULATE MINIMUM / MAXIMUM)
// =======================================================

export function calculateMinimum(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2
): number | null {
  const valid = sanitizeValues(values);
  if (valid.length === 0) return null;
  return Number(Math.min(...valid).toFixed(decimalPlaces));
}

export function calculateMaximum(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2
): number | null {
  const valid = sanitizeValues(values);
  if (valid.length === 0) return null;
  return Number(Math.max(...valid).toFixed(decimalPlaces));
}

export function calculateMinMax(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2
): { min: number | null; max: number | null } {
  return {
    min: calculateMinimum(values, decimalPlaces),
    max: calculateMaximum(values, decimalPlaces),
  };
}

// =======================================================
// 4. DESVIACIÓN ESTÁNDAR (CALCULATE STANDARD DEVIATION)
// =======================================================

export function calculateStandardDeviation(
  values: (number | string | null | undefined)[],
  decimalPlaces = 2,
  isSample = false
): number | null {
  const valid = sanitizeValues(values);
  if (valid.length === 0) return null;
  if (valid.length === 1) return 0.0;

  const mean = valid.reduce((acc, curr) => acc + curr, 0) / valid.length;
  const varianceSum = valid.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
  const divisor = isSample ? valid.length - 1 : valid.length;
  if (divisor <= 0) return 0.0;

  const stdDev = Math.sqrt(varianceSum / divisor);
  return Number(stdDev.toFixed(decimalPlaces));
}

// =======================================================
// 5. TASA DE APROBACIÓN (CALCULATE APPROVAL RATE)
// =======================================================

export function calculateApprovalRate(
  values: (number | string | null | undefined)[],
  scale?: GradeScaleConfig | null
): { rate: number; passingCount: number; failingCount: number; totalCount: number } {
  const valid = sanitizeValues(values);
  const totalCount = valid.length;
  if (totalCount === 0) {
    return { rate: 0, passingCount: 0, failingCount: 0, totalCount: 0 };
  }

  const passingGrade = getInstitutionalPassingGrade(scale);
  const passingCount = valid.filter(v => v >= passingGrade).length;
  const failingCount = totalCount - passingCount;
  const rate = Math.round((passingCount / totalCount) * 100);

  return { rate, passingCount, failingCount, totalCount };
}

// =======================================================
// 6. DISTRIBUCIÓN DE CALIFICACIONES (CALCULATE GRADE DISTRIBUTION)
// =======================================================

export function calculateGradeDistribution(
  grades: (number | string | null | undefined)[],
  scale?: GradeScaleConfig | null,
  numBins = 5
): GradeDistributionBin[] {
  const minVal = scale?.minValue ?? 0;
  const maxVal = scale?.maxValue ?? 5;
  const passingGrade = getInstitutionalPassingGrade(scale);
  const decimals = scale?.decimalPlaces ?? 1;

  const validGrades = sanitizeValues(grades);
  const totalCount = validGrades.length;

  const range = maxVal - minVal;
  const binsCount = numBins > 0 && range > 0 ? numBins : 5;
  const step = range > 0 ? range / binsCount : 1;

  const bins: GradeDistributionBin[] = [];

  for (let i = 0; i < binsCount; i++) {
    const binMin = Number((minVal + i * step).toFixed(decimals));
    const isLast = i === binsCount - 1;
    const binMax = Number((isLast ? maxVal : minVal + (i + 1) * step).toFixed(decimals));

    const label = `${binMin.toFixed(decimals)} - ${binMax.toFixed(decimals)}`;
    const isPassing = binMax >= passingGrade;

    const count = validGrades.filter(g => {
      if (isLast) {
        return g >= binMin && g <= maxVal;
      }
      return g >= binMin && g < binMax;
    }).length;

    const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

    bins.push({
      id: `bin-${i}`,
      min: binMin,
      max: binMax,
      label,
      rangeLabel: label,
      count,
      percentage,
      isPassing,
    });
  }

  return bins;
}

// =======================================================
// 7. ESTADÍSTICAS POR ACTIVIDAD / EVALUACIÓN
// =======================================================

function generateAssessmentInterpretation(
  stats: {
    average: number | null;
    median: number | null;
    standardDeviation: number | null;
    passingPercentage: number;
    pendingCount: number;
    evaluatedCount: number;
    totalRows: number;
  },
  maxValue: number,
  scale?: GradeScaleConfig | null,
  groupAverage?: number | null
): string {
  if (stats.evaluatedCount === 0) {
    return "Sin calificaciones registradas todavía.";
  }

  // Alerta crítica de reprobación
  if (stats.passingPercentage < 50) {
    return "Hay una concentración importante de estudiantes por debajo del mínimo aprobatorio.";
  }

  // Desempeño inferior al promedio grupal general
  if (groupAverage !== null && groupAverage !== undefined && stats.average !== null) {
    if (stats.average < groupAverage - 0.35) {
      return "Esta actividad presenta un promedio inferior al promedio general del grupo.";
    }
  }

  // Rendimiento alto
  const highThreshold = maxValue * 0.8;
  if (stats.average !== null && stats.average >= highThreshold && stats.passingPercentage >= 85) {
    return "El rendimiento del grupo fue alto con amplia tasa de aprobación.";
  }

  // Gran volumen de pendientes
  if (stats.totalRows > 0 && stats.pendingCount / stats.totalRows > 0.4) {
    return `Evaluación en progreso: ${stats.pendingCount} calificaciones aún pendientes de registro.`;
  }

  // Alta dispersión
  if (stats.standardDeviation !== null && stats.standardDeviation > maxValue * 0.25) {
    return "Existe una alta dispersión de notas: los resultados del grupo son marcadamente heterogéneos.";
  }

  // Desempeño regular estándar
  return "Rendimiento satisfactorio y homogéneo dentro de los rangos esperados.";
}

export function calculateAssessmentStatistics(
  assessment: AssessmentLike,
  rows: StudentRowLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null,
  groupAverage?: number | null
): AssessmentStatItem {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const grades: number[] = [];
  let pendingCount = 0;
  let passingCount = 0;

  rows.forEach(row => {
    const sId = row.enrollment.studentUserId;
    const key = `${assessment.id}:${sId}`;
    const originalItem = row.values.find(v => v.assessment.id === assessment.id);
    const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
      ? pendingGrades[key]
      : originalItem?.grade?.value ?? null;

    if (val !== null && val !== undefined && !isNaN(Number(val))) {
      const num = Number(val);
      grades.push(num);
      if (num >= passingGrade) {
        passingCount++;
      }
    } else {
      pendingCount++;
    }
  });

  const evaluatedCount = grades.length;
  const average = calculateAverage(grades);
  const median = calculateMedian(grades);
  const minGrade = calculateMinimum(grades);
  const maxGrade = calculateMaximum(grades);
  const standardDeviation = calculateStandardDeviation(grades);
  const passingPercentage = evaluatedCount > 0 ? Math.round((passingCount / evaluatedCount) * 100) : 0;
  const distribution = calculateGradeDistribution(grades, scale);

  const numWeight = Number(assessment.weight) || 0;
  const numMaxValue = Number(assessment.maxValue) || (scale?.maxValue ?? 5);

  const interpretation = generateAssessmentInterpretation(
    {
      average,
      median,
      standardDeviation,
      passingPercentage,
      pendingCount,
      evaluatedCount,
      totalRows: rows.length,
    },
    numMaxValue,
    scale,
    groupAverage
  );

  return {
    assessmentId: assessment.id,
    title: assessment.title,
    assessmentType: assessment.assessmentType || "ACTIVIDAD",
    weight: numWeight,
    maxValue: numMaxValue,
    average,
    median,
    minGrade,
    maxGrade,
    standardDeviation,
    evaluatedCount,
    pendingCount,
    passingCount,
    passingPercentage,
    distribution,
    interpretation,
  };
}

export const calculateAssessmentStats = calculateAssessmentStatistics;

// =======================================================
// 8. COMPARACIÓN ENTRE ACTIVIDADES
// =======================================================

export function calculateAssessmentsComparison(
  assessments: AssessmentLike[],
  rows: StudentRowLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null,
  groupAverage?: number | null
): AssessmentComparisonResult {
  const items: AssessmentStatItem[] = assessments.map(a =>
    calculateAssessmentStatistics(a, rows, pendingGrades, scale, groupAverage)
  );

  const evaluatedItems = items.filter(item => item.average !== null);

  let highestPerforming: AssessmentStatItem | null = null;
  let lowestPerforming: AssessmentStatItem | null = null;

  if (evaluatedItems.length > 0) {
    highestPerforming = evaluatedItems.reduce((prev, curr) =>
      (curr.average ?? -Infinity) > (prev.average ?? -Infinity) ? curr : prev
    );
    lowestPerforming = evaluatedItems.reduce((prev, curr) =>
      (curr.average ?? Infinity) < (prev.average ?? Infinity) ? curr : prev
    );

    items.forEach(item => {
      if (highestPerforming && item.assessmentId === highestPerforming.assessmentId) {
        item.isHighestAverage = true;
      }
      if (lowestPerforming && item.assessmentId === lowestPerforming.assessmentId) {
        item.isLowestAverage = true;
      }
    });
  }

  return {
    items,
    highestPerforming,
    lowestPerforming,
    highestAssessment: highestPerforming,
    lowestAssessment: lowestPerforming,
    totalAssessments: assessments.length,
  };
}

// =======================================================
// 9. EVOLUCIÓN DEL GRUPO (PERFORMANCE EVOLUTION)
// =======================================================

export function calculatePerformanceEvolution(
  assessments: AssessmentLike[],
  rows: StudentRowLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null
): PerformanceEvolutionResult {
  const sortedAssessments = assessments.slice().sort((a, b) => {
    if (a.date && b.date) {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
    }
    return 0;
  });

  const timeline: EvolutionPoint[] = sortedAssessments.map((assessment, index) => {
    const stats = calculateAssessmentStatistics(assessment, rows, pendingGrades, scale);
    return {
      index: index + 1,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      weight: Number(assessment.weight) || 0,
      date: assessment.date,
      groupAverage: stats.average,
      passingPercentage: stats.passingPercentage,
      evaluatedCount: stats.evaluatedCount,
    };
  });

  const evaluatedPoints = timeline.filter(p => p.groupAverage !== null);

  let trend: TrendDirection = "INSUFICIENTE";
  let trendLabel = "Datos insuficientes para determinar tendencia.";
  let firstAssessment: { id: number; title: string; date?: string | Date | null; average: number | null } | null = null;
  let latestAssessment: { id: number; title: string; date?: string | Date | null; average: number | null } | null = null;
  let overallDelta: number | null = null;

  if (evaluatedPoints.length >= 2) {
    const first = evaluatedPoints[0];
    const latest = evaluatedPoints[evaluatedPoints.length - 1];

    firstAssessment = {
      id: first.assessmentId,
      title: first.assessmentTitle,
      date: first.date,
      average: first.groupAverage,
    };

    latestAssessment = {
      id: latest.assessmentId,
      title: latest.assessmentTitle,
      date: latest.date,
      average: latest.groupAverage,
    };

    if (first.groupAverage !== null && latest.groupAverage !== null) {
      overallDelta = Number((latest.groupAverage - first.groupAverage).toFixed(2));

      if (overallDelta >= 0.2) {
        trend = "ASCENDENTE";
        trendLabel = `El grupo muestra una tendencia de mejora (+${overallDelta.toFixed(2)} pts).`;
      } else if (overallDelta <= -0.2) {
        trend = "DESCENDENTE";
        trendLabel = `El grupo muestra una tendencia a la baja (${overallDelta.toFixed(2)} pts).`;
      } else {
        trend = "ESTABLE";
        trendLabel = "El grupo mantiene un rendimiento general estable.";
      }
    }
  } else if (evaluatedPoints.length === 1) {
    firstAssessment = {
      id: evaluatedPoints[0].assessmentId,
      title: evaluatedPoints[0].assessmentTitle,
      date: evaluatedPoints[0].date,
      average: evaluatedPoints[0].groupAverage,
    };
    latestAssessment = firstAssessment;
  }

  return {
    timeline,
    trend,
    trendLabel,
    firstAssessment,
    latestAssessment,
    overallDelta,
  };
}

export function calculateGroupEvolution(
  assessments: AssessmentLike[],
  rows: StudentRowLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null
): EvolutionPoint[] {
  return calculatePerformanceEvolution(assessments, rows, pendingGrades, scale).timeline;
}

// =======================================================
// 10. ESTADÍSTICAS INDIVIDUALES (CALCULATE STUDENT STATISTICS)
// =======================================================

export function calculateStudentStatistics(
  studentRow: StudentRowLike,
  assessments: AssessmentLike[],
  pendingGrades: Record<string, number | null> = {},
  groupAverageOrAverages?: number | Record<number, number | null> | null,
  allRowsOrGroupAvg?: StudentRowLike[] | number | null,
  scaleOrAllRows?: GradeScaleConfig | StudentRowLike[] | null,
  explicitGroupAveragesOrScale?: Record<number, number | null> | GradeScaleConfig | null
): StudentStatisticsResult {
  let groupAverage: number | null = null;
  let allRows: StudentRowLike[] | undefined = undefined;
  let scale: GradeScaleConfig | null | undefined = undefined;
  let explicitGroupAverages: Record<number, number | null> | undefined = undefined;

  // Normalizar parámetros según si el 4to argumento es groupAverages (objeto) o groupAverage (número)
  if (
    groupAverageOrAverages !== null &&
    groupAverageOrAverages !== undefined &&
    typeof groupAverageOrAverages === "object" &&
    !Array.isArray(groupAverageOrAverages)
  ) {
    explicitGroupAverages = groupAverageOrAverages as Record<number, number | null>;
    if (typeof allRowsOrGroupAvg === "number") {
      groupAverage = allRowsOrGroupAvg;
    }
    if (Array.isArray(scaleOrAllRows)) {
      allRows = scaleOrAllRows;
    }
    if (explicitGroupAveragesOrScale && !Array.isArray(explicitGroupAveragesOrScale)) {
      scale = explicitGroupAveragesOrScale as GradeScaleConfig;
    }
  } else {
    groupAverage = typeof groupAverageOrAverages === "number" ? groupAverageOrAverages : null;
    if (Array.isArray(allRowsOrGroupAvg)) {
      allRows = allRowsOrGroupAvg;
    }
    if (scaleOrAllRows && !Array.isArray(scaleOrAllRows)) {
      scale = scaleOrAllRows as GradeScaleConfig;
    }
    if (
      explicitGroupAveragesOrScale &&
      typeof explicitGroupAveragesOrScale === "object" &&
      !Array.isArray(explicitGroupAveragesOrScale)
    ) {
      explicitGroupAverages = explicitGroupAveragesOrScale as Record<number, number | null>;
    }
  }

  const sId = studentRow.enrollment.studentUserId;
  const sName = resolveStudentDisplayName(studentRow.student);
  const passingGrade = getInstitutionalPassingGrade(scale);

  const timeline: StudentEvolutionPoint[] = [];
  const evaluatedGrades: Array<{ title: string; grade: number }> = [];
  let pendingCount = 0;
  let passingCount = 0;

  // Promedios por evaluación (usando explícitos si se proporcionan o calculados de allRows)
  const assessmentAverages = new Map<number, number | null>();
  if (explicitGroupAverages) {
    for (const [k, v] of Object.entries(explicitGroupAverages)) {
      assessmentAverages.set(Number(k), v);
    }
  } else if (allRows && allRows.length > 0) {
    for (const ass of assessments) {
      const gList: number[] = [];
      for (const r of allRows) {
        const k = `${ass.id}:${r.enrollment.studentUserId}`;
        const orig = r.values.find(v => v.assessment.id === ass.id);
        const v = Object.prototype.hasOwnProperty.call(pendingGrades, k)
          ? pendingGrades[k]
          : orig?.grade?.value ?? null;
        if (v !== null && v !== undefined && !isNaN(Number(v))) {
          gList.push(Number(v));
        }
      }
      assessmentAverages.set(ass.id, calculateAverage(gList));
    }
  }

  assessments.forEach((assessment, index) => {
    const key = `${assessment.id}:${sId}`;
    const originalItem = studentRow.values.find(v => v.assessment.id === assessment.id);
    const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
      ? pendingGrades[key]
      : originalItem?.grade?.value ?? null;

    const isPending = val === null || val === undefined || isNaN(Number(val));
    const gradeNum = !isPending ? Number(val) : null;
    const groupAvg = assessmentAverages.get(assessment.id) ?? null;

    const deltaVsGroup = gradeNum !== null && groupAvg !== null
      ? Number((gradeNum - groupAvg).toFixed(2))
      : null;

    if (!isPending && gradeNum !== null) {
      evaluatedGrades.push({ title: assessment.title, grade: gradeNum });
      if (gradeNum >= passingGrade) {
        passingCount++;
      }
    } else {
      pendingCount++;
    }

    timeline.push({
      index: index + 1,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      weight: Number(assessment.weight) || 0,
      studentGrade: gradeNum,
      groupAverage: groupAvg,
      deltaVsGroup,
      isPending,
    });
  });

  const numericGrades = evaluatedGrades.map(g => g.grade);
  const currentAverage = studentRow.average !== undefined && studentRow.average !== null
    ? studentRow.average
    : calculateAverage(numericGrades);

  const median = calculateMedian(numericGrades);
  const minGrade = calculateMinimum(numericGrades);
  const maxGrade = calculateMaximum(numericGrades);
  const standardDeviation = calculateStandardDeviation(numericGrades);

  const evaluatedCount = numericGrades.length;
  const approvalRate = evaluatedCount > 0 ? Math.round((passingCount / evaluatedCount) * 100) : 0;

  // Comparación matemática con el grupo
  const deltaVsGroup = currentAverage !== null && groupAverage !== null && groupAverage !== undefined
    ? Number((currentAverage - groupAverage).toFixed(2))
    : null;

  let vsGroupLabel = "Sin promedio comparativo de grupo";
  if (deltaVsGroup !== null) {
    if (deltaVsGroup > 0) {
      vsGroupLabel = `+${deltaVsGroup.toFixed(2)} sobre el promedio del grupo`;
    } else if (deltaVsGroup < 0) {
      vsGroupLabel = `${deltaVsGroup.toFixed(2)} bajo el promedio del grupo`;
    } else {
      vsGroupLabel = "Igual al promedio del grupo";
    }
  }

  // Posición relativa no agresiva dentro del grupo
  let relativeRank: RelativeRankInfo | null = null;
  if (allRows && allRows.length > 0 && currentAverage !== null) {
    const validStudents = allRows
      .map(r => ({
        id: r.enrollment.studentUserId,
        avg: r.average !== undefined && r.average !== null ? r.average : calculateAverage(
          r.values.map(v => {
            const k = `${v.assessment.id}:${r.enrollment.studentUserId}`;
            return Object.prototype.hasOwnProperty.call(pendingGrades, k)
              ? pendingGrades[k]
              : v.grade?.value ?? null;
          })
        ),
      }))
      .filter(s => s.avg !== null)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

    const rankIndex = validStudents.findIndex(s => s.id === sId);
    if (rankIndex >= 0) {
      const position = rankIndex + 1;
      const total = validStudents.length;
      relativeRank = {
        position,
        total,
        label: `Puesto ${position} de ${total}`,
      };
    }
  }

  // Mejor y menor evaluación
  let bestAssessment: { title: string; grade: number } | null = null;
  let lowestAssessment: { title: string; grade: number } | null = null;

  if (evaluatedGrades.length > 0) {
    bestAssessment = evaluatedGrades.reduce((prev, curr) => (curr.grade > prev.grade ? curr : prev));
    lowestAssessment = evaluatedGrades.reduce((prev, curr) => (curr.grade < prev.grade ? curr : prev));
  }

  // Tendencia matemática individual
  let trend: TrendDirection = "INSUFICIENTE";
  let trendLabel = "Datos insuficientes";

  if (evaluatedGrades.length >= 2) {
    const first = evaluatedGrades[0].grade;
    const last = evaluatedGrades[evaluatedGrades.length - 1].grade;
    const diff = Number((last - first).toFixed(1));

    if (diff >= 0.3) {
      trend = "ASCENDENTE";
      trendLabel = `Tendencia ascendente (+${diff.toFixed(1)})`;
    } else if (diff <= -0.3) {
      trend = "DESCENDENTE";
      trendLabel = `Tendencia descendente (${diff.toFixed(1)})`;
    } else {
      trend = "ESTABLE";
      trendLabel = "Rendimiento estable";
    }
  }

  return {
    studentId: sId,
    studentName: sName,
    currentAverage,
    median,
    minGrade,
    maxGrade,
    standardDeviation,
    evaluatedCount,
    pendingCount,
    totalAssessments: assessments.length,
    approvalRate,
    groupAverage: groupAverage ?? null,
    deltaVsGroup,
    vsGroupLabel,
    relativeRank,
    trend,
    trendLabel,
    bestAssessment,
    lowestAssessment,
    timeline,
  };
}

export function calculateStudentEvolution(
  studentRow: StudentRowLike,
  assessments: AssessmentLike[],
  pendingGrades: Record<string, number | null> = {},
  groupAverages: Record<number, number | null> = {},
  groupAverage?: number | null
): StudentEvolutionStats {
  const allGroupAverages = Object.values(groupAverages).filter((v): v is number => v !== null);
  const resolvedGroupAvg = groupAverage !== undefined ? groupAverage : calculateAverage(allGroupAverages);
  return calculateStudentStatistics(
    studentRow,
    assessments,
    pendingGrades,
    resolvedGroupAvg,
    undefined,
    undefined,
    groupAverages
  );
}

// =======================================================
// 11. GENERADOR DE INSIGHTS PEDAGÓGICOS DETERMINISTAS
// =======================================================

export function generateTeacherInsights(
  stats: {
    totalStudents: number;
    groupAverage: number | null;
    passingPercentage: number;
    passingGrade: number;
    totalAtRisk: number;
    totalPendingCount: number;
  },
  assessmentComparison: AssessmentComparisonResult,
  evolution: EvolutionPoint[]
): TeacherInsight[] {
  const insights: TeacherInsight[] = [];

  // Insight 1: Alerta de reprobación académica cuando >= 30% está reprobando o hay estudiantes en riesgo
  if (stats.passingPercentage <= 70 && stats.totalStudents > 0) {
    insights.push({
      id: "insight-failing-high",
      type: "WARNING",
      title: "Alerta de reprobación académica",
      description: `${100 - stats.passingPercentage}% del grupo se encuentra por debajo de la nota mínima aprobatoria (${stats.passingGrade}).`,
      metric: `${stats.totalAtRisk} en riesgo`,
      actionTarget: { type: "RISK" },
    });
  } else if (stats.totalAtRisk > 0) {
    insights.push({
      id: "insight-risk-alert",
      type: "WARNING",
      title: `${stats.totalAtRisk} estudiante${stats.totalAtRisk > 1 ? "s" : ""} en riesgo académico`,
      description: "Su definitiva actual se encuentra por debajo de la nota mínima aprobatoria institucional.",
      metric: `${stats.totalAtRisk} casos`,
      actionTarget: { type: "RISK" },
    });
  }

  // Insight 2: Calificaciones pendientes
  if (stats.totalPendingCount > 0) {
    insights.push({
      id: "insight-pendings",
      type: "ACTION",
      title: "Calificaciones pendientes",
      description: `Existen ${stats.totalPendingCount} calificaciones pendientes por registrar.`,
      metric: `${stats.totalPendingCount} celdas`,
    });
  }

  // Insight 3: Alto rendimiento del grupo
  if (stats.passingPercentage >= 85 && stats.totalStudents >= 3) {
    insights.push({
      id: "insight-passing-high",
      type: "SUCCESS",
      title: "Alto rendimiento del grupo",
      description: `El ${stats.passingPercentage}% del grupo supera la nota mínima aprobatoria.`,
      metric: `${stats.passingPercentage}% aprobados`,
    });
  }

  // Insight 4: Evaluación crítica
  const lowest = assessmentComparison.lowestPerforming;
  if (lowest && lowest.average !== null) {
    const avg = lowest.average;
    insights.push({
      id: "insight-lowest-assessment",
      type: "INFO",
      title: `Evaluación crítica: ${lowest.title}`,
      description: `Registra el promedio más bajo (${avg.toFixed(1)}) con ${lowest.passingPercentage}% de aprobación.`,
      metric: `${avg.toFixed(1)} / ${lowest.maxValue}`,
      actionTarget: { type: "ASSESSMENT", assessmentId: lowest.assessmentId },
    });
  }

  // Insight 5: Mayor desempeño
  const highest = assessmentComparison.highestPerforming;
  if (highest && highest.average !== null) {
    const avg = highest.average;
    insights.push({
      id: "insight-highest-assessment",
      type: "SUCCESS",
      title: `Mayor desempeño: ${highest.title}`,
      description: `Los estudiantes alcanzaron un promedio de ${avg.toFixed(1)} con ${highest.passingPercentage}% de aprobación.`,
      metric: `${avg.toFixed(1)} / ${highest.maxValue}`,
      actionTarget: { type: "ASSESSMENT", assessmentId: highest.assessmentId },
    });
  }

  // Insight 6: Tendencia de evolución grupal
  const evaluatedPoints = evolution.filter(p => p.groupAverage !== null);
  if (evaluatedPoints.length >= 2) {
    const firstAvg = evaluatedPoints[0].groupAverage;
    const lastAvg = evaluatedPoints[evaluatedPoints.length - 1].groupAverage;
    if (firstAvg !== null && lastAvg !== null) {
      const diff = Number((lastAvg - firstAvg).toFixed(2));
      if (diff >= 0.25) {
        insights.push({
          id: "insight-trend-positive",
          type: "SUCCESS",
          title: "Tendencia de superación grupal",
          description: `El promedio subió ${diff > 0 ? `+${diff}` : diff} puntos entre la primera y la última evaluación.`,
          metric: `+${diff}`,
        });
      } else if (diff <= -0.25) {
        insights.push({
          id: "insight-trend-negative",
          type: "WARNING",
          title: "Descenso en el rendimiento reciente",
          description: `El promedio descendió ${diff} puntos entre las evaluaciones analizadas. Conviene reforzar conceptos clave.`,
          metric: `${diff}`,
        });
      }
    }
  }

  return insights;
}

// =======================================================
// 12. ESTADÍSTICAS AVANZADAS DEL GRUPO (AGREGADOR COMPLETO)
// =======================================================

export function calculateAdvancedGroupStats(
  rows: StudentRowLike[],
  assessments: AssessmentLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null
): AdvancedGroupStatistics {
  const passingGrade = getInstitutionalPassingGrade(scale);

  // 1. Obtener definitivas actuales de cada estudiante
  const studentDefinitivas: number[] = [];
  let evaluatedStudentsCount = 0;
  let passingCount = 0;
  let failingCount = 0;
  let totalAtRisk = 0;

  rows.forEach(row => {
    const sId = row.enrollment.studentUserId;
    const studentGrades: number[] = [];

    row.values.forEach(v => {
      const key = `${v.assessment.id}:${sId}`;
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : v.grade?.value ?? null;
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        studentGrades.push(Number(val));
      }
    });

    const def = row.average !== undefined && row.average !== null
      ? row.average
      : calculateAverage(studentGrades);

    if (def !== null && !isNaN(def)) {
      studentDefinitivas.push(def);
      evaluatedStudentsCount++;
      if (def >= passingGrade) {
        passingCount++;
      } else {
        failingCount++;
        totalAtRisk++;
      }
    }
  });

  const totalStudents = rows.length;
  const groupAverage = calculateAverage(studentDefinitivas);
  const median = calculateMedian(studentDefinitivas);
  const minGrade = calculateMinimum(studentDefinitivas);
  const maxGrade = calculateMaximum(studentDefinitivas);
  const standardDeviation = calculateStandardDeviation(studentDefinitivas);
  const passingPercentage = evaluatedStudentsCount > 0 ? Math.round((passingCount / evaluatedStudentsCount) * 100) : 0;

  // 2. Conteo global de celdas pendientes
  let totalPendingCount = 0;
  rows.forEach(row => {
    const sId = row.enrollment.studentUserId;
    assessments.forEach(ass => {
      const key = `${ass.id}:${sId}`;
      const orig = row.values.find(v => v.assessment.id === ass.id);
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : orig?.grade?.value ?? null;
      if (val === null || val === undefined || isNaN(Number(val))) {
        totalPendingCount++;
      }
    });
  });

  // 3. Distribución adaptada a la escala
  const distribution = calculateGradeDistribution(studentDefinitivas, scale);

  // 4. Comparación de evaluaciones
  const assessmentComparison = calculateAssessmentsComparison(assessments, rows, pendingGrades, scale, groupAverage);

  // 5. Evolución temporal
  const performanceEvolution = calculatePerformanceEvolution(assessments, rows, pendingGrades, scale);
  const evolution = performanceEvolution.timeline;

  // 6. Insights pedagógicos
  const insights = generateTeacherInsights(
    {
      totalStudents,
      groupAverage,
      passingPercentage,
      passingGrade,
      totalAtRisk,
      totalPendingCount,
    },
    assessmentComparison,
    evolution
  );

  return {
    totalStudents,
    groupAverage,
    generalMean: groupAverage,
    median,
    generalMedian: median,
    minGrade,
    maxGrade,
    standardDeviation,
    evaluatedStudentsCount,
    passingCount,
    passingStudentsCount: passingCount,
    failingCount,
    passingPercentage,
    totalAtRisk,
    atRiskStudentsCount: totalAtRisk,
    totalPendingCount,
    pendingGradesCount: totalPendingCount,
    passingGrade,
    distribution,
    assessmentComparison,
    comparison: assessmentComparison,
    evolution,
    performanceEvolution,
    insights,
  };
}

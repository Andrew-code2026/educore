/**
 * EDUCORE — FASE 5.3-F: MOTOR DE ANÁLISIS INTELIGENTE DEL GRADE CENTER
 *
 * Funciones puras, deterministas y testeables para:
 * 1. Clasificación de Salud del Curso (🟢 Buen rendimiento / 🟡 Requiere atención / 🔴 Atención prioritaria).
 * 2. Detección automática de problemas y alertas pedagógicas accionables.
 * 3. Identificación precisa de mejor y peor evaluación.
 * 4. Selección de estudiantes prioritarios que requieren atención.
 * 5. Generación de insights deterministas (explicando qué se detectó y por qué importa).
 * 6. Distribución de rendimiento adaptada a la escala institucional.
 */

import {
  type GradeScaleConfig,
  type StudentRowLike,
  type AssessmentLike,
  type AdvancedGroupStatistics,
  type AssessmentStatItem,
  type AssessmentComparisonResult,
  type PerformanceEvolutionResult,
  calculateAverage,
  getInstitutionalPassingGrade,
} from "./gradeStatisticsUtils";
import { determineRiskLevel, type RiskAssessmentResult } from "./gradeIntelligenceUtils";
import { studentName } from "./gradeCenterUtils";

// =======================================================
// TIPOS E INTERFACES
// =======================================================

export type CourseHealthLevel = "GOOD" | "ATTENTION" | "CRITICAL" | "NO_DATA";

export interface CourseHealthResult {
  level: CourseHealthLevel;
  label: string;
  statusText: string;
  badgeClass: string;
  colorClass: string;
  dotColorClass: string;
  borderClass: string;
  bgClass: string;
  reasons: string[];
  primaryReason: string;
}

export type ProblemSeverity = "CRITICAL" | "WARNING" | "INFO";
export type ProblemActionType = "ASSESSMENT" | "PENDING" | "RISK" | "WEIGHT" | "STUDENT";

export interface DetectedProblemItem {
  id: string;
  severity: ProblemSeverity;
  title: string;
  description: string;
  metric?: string;
  actionLabel: string;
  actionType: ProblemActionType;
  targetId?: number;
  targetStudentId?: number;
}

export interface AttentionStudentItem {
  studentId: number;
  studentName: string;
  currentDefinitiva: number | null;
  risk: RiskAssessmentResult;
  pendingCount: number;
  reason: string;
}

export interface CourseDistributionBracket {
  id: string;
  label: string;
  rangeLabel: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
  color: string;
  bgClass: string;
  textClass: string;
  barColor: string;
}

export interface EduCoreInsightItem {
  id: string;
  type: "SUCCESS" | "WARNING" | "INFO" | "ACTION";
  title: string;
  observation: string;
  significance: string;
  actionLabel?: string;
  actionType?: ProblemActionType;
  targetId?: number;
}

// =======================================================
// 1. SALUD DEL CURSO (DETERMINISTA)
// =======================================================

/**
 * Evalúa la salud general del curso con reglas deterministas, claras y reproducibles:
 *
 * 1. NO_DATA: Sin estudiantes o sin calificaciones registradas.
 * 2. CRITICAL (🔴 Atención prioritaria):
 *    - Tasa de aprobación < 70%
 *    - O Promedio grupal < nota mínima aprobatoria (ej. < 3.0)
 *    - O Estudiantes en riesgo alto >= 25% del total
 *    - O Alguna evaluación con aprobación < 50% y peso >= 20%
 * 3. ATTENTION (🟡 Requiere atención):
 *    - Tasa de aprobación entre 70% y 84%
 *    - O Total en riesgo > 0 (al menos 1 estudiante en riesgo)
 *    - O Promedio grupal < passingGrade + 0.4 (ej. < 3.4)
 *    - O Ratio de celdas pendientes sobre total de celdas > 35%
 *    - O Alguna evaluación con promedio significativamente inferior al grupo (-0.4 pts)
 * 4. GOOD (🟢 Buen rendimiento):
 *    - Aprobación >= 85%
 *    - Promedio grupal >= passingGrade + 0.4
 *    - Cero estudiantes en riesgo
 *    - Ratio de pendientes <= 35%
 */
export function calculateCourseHealth(
  stats: AdvancedGroupStatistics,
  assessments: AssessmentLike[] = [],
  weightTotal: number = 100
): CourseHealthResult {
  const passingGrade = stats.passingGrade || 3.0;
  const reasons: string[] = [];

  // Caso 0: Sin datos
  if (stats.totalStudents === 0 || stats.evaluatedStudentsCount === 0 || stats.groupAverage === null) {
    return {
      level: "NO_DATA",
      label: "Sin datos",
      statusText: "Sin calificaciones registradas",
      badgeClass: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      colorClass: "text-slate-500",
      dotColorClass: "bg-slate-400",
      borderClass: "border-slate-200",
      bgClass: "bg-slate-50",
      reasons: ["No hay suficientes calificaciones registradas en este periodo."],
      primaryReason: "Aún no se han registrado calificaciones en el grupo.",
    };
  }

  const approvalRate = stats.passingPercentage;
  const avg = stats.groupAverage;
  const atRiskCount = stats.totalAtRisk;
  const atRiskRatio = stats.totalStudents > 0 ? atRiskCount / stats.totalStudents : 0;
  const totalCells = stats.totalStudents * Math.max(1, assessments.length);
  const pendingRatio = totalCells > 0 ? stats.totalPendingCount / totalCells : 0;

  // Evaluar evaluaciones críticas
  const criticalAssessment = stats.assessmentComparison?.items?.find(
    item => item.average !== null && item.passingPercentage < 50 && item.weight >= 20
  );

  // REGLA CRÍTICA (🔴)
  let isCritical = false;
  if (approvalRate < 70) {
    isCritical = true;
    reasons.push(`La tasa de aprobación (${approvalRate}%) se encuentra por debajo del 70%.`);
  }
  if (avg < passingGrade) {
    isCritical = true;
    reasons.push(`El promedio grupal (${avg.toFixed(2)}) es inferior al mínimo aprobatorio (${passingGrade}).`);
  }
  if (atRiskRatio >= 0.25) {
    isCritical = true;
    reasons.push(`El ${Math.round(atRiskRatio * 100)}% de los estudiantes presenta riesgo académico prioritario.`);
  }
  if (criticalAssessment) {
    isCritical = true;
    reasons.push(`La evaluación "${criticalAssessment.title}" tiene un ${100 - criticalAssessment.passingPercentage}% de reprobación.`);
  }

  if (isCritical) {
    return {
      level: "CRITICAL",
      label: "Atención prioritaria",
      statusText: "🔴 Atención prioritaria",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200/90 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
      colorClass: "text-rose-600 dark:text-rose-400",
      dotColorClass: "bg-rose-500 animate-pulse",
      borderClass: "border-rose-300 dark:border-rose-800",
      bgClass: "bg-rose-50/50 dark:bg-rose-950/20",
      reasons,
      primaryReason: reasons[0] || "El grupo presenta indicadores académicos críticos que requieren intervención.",
    };
  }

  // REGLA DE ATENCIÓN (🟡)
  let isAttention = false;
  if (approvalRate < 85) {
    isAttention = true;
    reasons.push(`Aprobación en ${approvalRate}% (por debajo del umbral óptimo del 85%).`);
  }
  if (atRiskCount > 0) {
    isAttention = true;
    reasons.push(`${atRiskCount} estudiante${atRiskCount > 1 ? "s" : ""} presenta${atRiskCount === 1 ? "" : "n"} riesgo académico.`);
  }
  if (avg < passingGrade + 0.4) {
    isAttention = true;
    reasons.push(`El promedio grupal (${avg.toFixed(2)}) está próximo al límite de aprobación.`);
  }
  if (pendingRatio > 0.35 && stats.totalPendingCount > 5) {
    isAttention = true;
    reasons.push(`${stats.totalPendingCount} calificaciones pendientes (${Math.round(pendingRatio * 100)}% del curso).`);
  }
  if (weightTotal < 100) {
    reasons.push(`Ponderación incompleta: ${weightTotal}% asignado · ${100 - weightTotal}% restante.`);
  }

  const laggingAssessment = stats.assessmentComparison?.items?.find(
    item => item.average !== null && item.average < avg - 0.45
  );
  if (laggingAssessment && laggingAssessment.average !== null) {
    isAttention = true;
    reasons.push(`"${laggingAssessment.title}" registra un promedio de ${laggingAssessment.average.toFixed(1)}, notablemente inferior al grupo.`);
  }

  if (isAttention) {
    return {
      level: "ATTENTION",
      label: "Requiere atención",
      statusText: "🟡 Requiere atención",
      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
      colorClass: "text-amber-600 dark:text-amber-400",
      dotColorClass: "bg-amber-500",
      borderClass: "border-amber-300 dark:border-amber-800",
      bgClass: "bg-amber-50/40 dark:bg-amber-950/20",
      reasons,
      primaryReason: reasons[0] || "Existen factores puntuales que demandan seguimiento pedagógico.",
    };
  }

  // REGLA DE BUEN RENDIMIENTO (🟢)
  reasons.push(`Aprobación consolidada en ${approvalRate}%.`);
  reasons.push(`Promedio grupal sólido de ${avg.toFixed(2)} sobre la nota mínima (${passingGrade}).`);
  if (stats.totalPendingCount === 0) {
    reasons.push("Todas las calificaciones se encuentran al día.");
  }

  return {
    level: "GOOD",
    label: "Buen rendimiento",
    statusText: "🟢 Buen rendimiento",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    dotColorClass: "bg-emerald-500",
    borderClass: "border-emerald-300 dark:border-emerald-800",
    bgClass: "bg-emerald-50/30 dark:bg-emerald-950/20",
    reasons,
    primaryReason: "El grupo mantiene un desempeño académico favorable y homogéneo.",
  };
}

// =======================================================
// 2. DETECCIÓN DETERMINISTA DE PROBLEMAS Y ALERTAS
// =======================================================

export function detectCourseProblems(
  stats: AdvancedGroupStatistics,
  rows: StudentRowLike[],
  assessments: AssessmentLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null,
  weightTotal: number = 100
): DetectedProblemItem[] {
  const problems: DetectedProblemItem[] = [];
  const passingGrade = getInstitutionalPassingGrade(scale);

  // 1. Detección de peor evaluación
  const lowestAss = stats.assessmentComparison?.lowestPerforming;
  if (lowestAss && lowestAss.average !== null) {
    const isSignificantlyLower =
      stats.groupAverage !== null && lowestAss.average < stats.groupAverage - 0.35;
    const isLowPassing = lowestAss.passingPercentage < 75;

    if (isSignificantlyLower || isLowPassing) {
      problems.push({
        id: `problem-assessment-${lowestAss.assessmentId}`,
        severity: lowestAss.passingPercentage < 50 ? "CRITICAL" : "WARNING",
        title: `"${lowestAss.title}" presenta bajo rendimiento`,
        description: `Promedio de ${lowestAss.average.toFixed(1)} con ${lowestAss.passingPercentage}% de aprobación (${lowestAss.pendingCount} pendientes).`,
        metric: `${lowestAss.average.toFixed(1)} / ${lowestAss.maxValue}`,
        actionLabel: "Ver evaluación",
        actionType: "ASSESSMENT",
        targetId: lowestAss.assessmentId,
      });
    }
  }

  // 2. Detección de estudiantes en riesgo
  if (stats.totalAtRisk > 0) {
    const isSevere = stats.totalStudents > 0 && stats.totalAtRisk / stats.totalStudents >= 0.2;
    problems.push({
      id: "problem-students-risk",
      severity: isSevere ? "CRITICAL" : "WARNING",
      title: `${stats.totalAtRisk} estudiante${stats.totalAtRisk > 1 ? "s" : ""} en riesgo académico`,
      description: `Su definitiva actual no alcanza la nota mínima aprobatoria (${passingGrade}).`,
      metric: `${stats.totalAtRisk} de ${stats.totalStudents}`,
      actionLabel: "Ver estudiantes en riesgo",
      actionType: "RISK",
    });
  }

  // 3. Detección de calificaciones pendientes contextualizadas
  if (stats.totalPendingCount > 0) {
    // Determinar cuántos estudiantes distintos tienen al menos 1 pendiente
    let studentsWithPendingCount = 0;
    rows.forEach(row => {
      const sId = row.enrollment.studentUserId;
      const hasAnyPending = assessments.some(ass => {
        const key = `${ass.id}:${sId}`;
        const orig = row.values.find(v => v.assessment.id === ass.id);
        const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : orig?.grade?.value ?? null;
        return val === null || val === undefined || isNaN(Number(val));
      });
      if (hasAnyPending) studentsWithPendingCount++;
    });

    const isHighPendingVolume = stats.totalPendingCount > 20;
    problems.push({
      id: "problem-pending-grades",
      severity: isHighPendingVolume ? "WARNING" : "INFO",
      title: `${stats.totalPendingCount} calificaciones pendientes`,
      description: `${studentsWithPendingCount} estudiante${studentsWithPendingCount === 1 ? "" : "s"} tiene${studentsWithPendingCount === 1 ? "" : "n"} al menos una evaluación sin calificar.`,
      metric: `${stats.totalPendingCount} celdas`,
      actionLabel: "Ver pendientes",
      actionType: "PENDING",
    });
  }

  // 4. Ponderación incompleta
  if (weightTotal < 100) {
    problems.push({
      id: "problem-incomplete-weight",
      severity: "INFO",
      title: "Ponderación incompleta del periodo",
      description: `Actualmente hay ${weightTotal}% asignado · ${100 - weightTotal}% restante para completar el 100%.`,
      metric: `${weightTotal}% / 100%`,
      actionLabel: "Revisar ponderación",
      actionType: "WEIGHT",
    });
  }

  // 5. Tendencia descendente pronunciada entre evaluaciones
  const timeline = stats.evolution?.filter(p => p.groupAverage !== null) ?? [];
  if (timeline.length >= 2) {
    const prev = timeline[timeline.length - 2];
    const current = timeline[timeline.length - 1];
    if (prev.groupAverage !== null && current.groupAverage !== null) {
      const stepDelta = Number((current.groupAverage - prev.groupAverage).toFixed(2));
      if (stepDelta <= -0.5) {
        problems.push({
          id: `problem-trend-drop-${current.assessmentId}`,
          severity: "WARNING",
          title: `Caída de rendimiento en "${current.assessmentTitle}"`,
          description: `El promedio descendió ${stepDelta} puntos respecto a la evaluación anterior (${prev.groupAverage.toFixed(1)} → ${current.groupAverage.toFixed(1)}).`,
          metric: `${stepDelta} pts`,
          actionLabel: "Ver evaluación",
          actionType: "ASSESSMENT",
          targetId: current.assessmentId,
        });
      }
    }
  }

  return problems;
}

// =======================================================
// 3. MEJOR Y PEOR EVALUACIÓN
// =======================================================

export function getAssessmentsHighlights(comparison: AssessmentComparisonResult) {
  return {
    best: comparison?.highestPerforming ?? null,
    attention: comparison?.lowestPerforming ?? null,
  };
}

// =======================================================
// 4. ESTUDIANTES QUE REQUIEREN ATENCIÓN
// =======================================================

export function getStudentsNeedingAttention(
  rows: StudentRowLike[],
  assessments: AssessmentLike[],
  pendingGrades: Record<string, number | null> = {},
  scale?: GradeScaleConfig | null,
  maxCount: number = 4
): AttentionStudentItem[] {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const items: AttentionStudentItem[] = [];

  rows.forEach(row => {
    const sId = row.enrollment.studentUserId;
    const sName = studentName(row.student);

    // Mapear valores con pendientes
    const normalized = assessments.map(ass => {
      const key = `${ass.id}:${sId}`;
      const orig = row.values.find(v => v.assessment.id === ass.id);
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : orig?.grade?.value ?? null;
      return {
        value: val !== null && val !== undefined && !isNaN(Number(val)) ? Number(val) : null,
        maxValue: Number(ass.maxValue) || 5,
        weight: Number(ass.weight) || 0,
      };
    });

    const recorded = normalized.filter(v => v.value !== null);
    const pendingCount = normalized.filter(v => v.value === null).length;

    // Definitiva actual
    const currentDefinitiva = row.average !== undefined && row.average !== null
      ? row.average
      : calculateAverage(recorded.map(r => r.value));

    // Determinar riesgo
    const risk = determineRiskLevel(normalized, scale, sName, sId);

    // Condición para necesitar atención:
    // 1. Riesgo ALTO o MEDIO
    // 2. O definitiva actual < passingGrade
    // 3. O tiene más de la mitad de evaluaciones pendientes si ya hay varias evaluaciones creadas
    const isFailing = currentDefinitiva !== null && currentDefinitiva < passingGrade;
    const isRisk = risk.level === "ALTO" || risk.level === "MEDIO";
    const isHeavyPending = assessments.length >= 2 && pendingCount >= Math.ceil(assessments.length * 0.5);

    if (isFailing || isRisk || isHeavyPending) {
      let reason = "Requiere atención pedagógica";
      if (risk.level === "ALTO") {
        reason = currentDefinitiva !== null && currentDefinitiva < passingGrade
          ? `Definitiva en ${currentDefinitiva.toFixed(1)} (por debajo de ${passingGrade})`
          : "Dificultad matemática para alcanzar aprobación";
      } else if (risk.level === "MEDIO") {
        reason = currentDefinitiva !== null && currentDefinitiva < passingGrade
          ? `Promedio de ${currentDefinitiva.toFixed(1)} con opción de recuperar`
          : "Aprobando al límite de la nota mínima";
      } else if (isHeavyPending) {
        reason = `${pendingCount} evaluaciones pendientes de registro`;
      }

      items.push({
        studentId: sId,
        studentName: sName,
        currentDefinitiva,
        risk,
        pendingCount,
        reason,
      });
    }
  });

  // Ordenar: primero ALTO riesgo, luego menor definitiva, luego pendientes
  items.sort((a, b) => {
    const riskOrder: Record<string, number> = { ALTO: 3, MEDIO: 2, SIN_RIESGO: 1 };
    const rA = riskOrder[a.risk.level] || 0;
    const rB = riskOrder[b.risk.level] || 0;
    if (rA !== rB) return rB - rA;

    const valA = a.currentDefinitiva ?? 99;
    const valB = b.currentDefinitiva ?? 99;
    if (valA !== valB) return valA - valB;

    return b.pendingCount - a.pendingCount;
  });

  return items.slice(0, maxCount);
}

// =======================================================
// 5. INSIGHTS DETERMINISTAS DE EDUCORE
// =======================================================

/**
 * Genera de 2 a 4 insights pedagógicos estrictamente deterministas
 * basados en los datos calculados. No inventa causas no demostradas.
 */
export function generateCourseDeterministicInsights(
  stats: AdvancedGroupStatistics,
  health: CourseHealthResult,
  problems: DetectedProblemItem[],
  scale?: GradeScaleConfig | null
): EduCoreInsightItem[] {
  const insights: EduCoreInsightItem[] = [];
  const passingGrade = getInstitutionalPassingGrade(scale);

  // Insight 1: Síntesis del estado general y aprobación
  if (stats.evaluatedStudentsCount > 0 && stats.groupAverage !== null) {
    if (stats.passingPercentage >= 85) {
      insights.push({
        id: "insight-general-good",
        type: "SUCCESS",
        title: "Alto nivel de aprobación global",
        observation: `El ${stats.passingPercentage}% del curso (${stats.passingCount}/${stats.evaluatedStudentsCount}) supera la nota mínima aprobatoria con promedio de ${stats.groupAverage.toFixed(2)}.`,
        significance: "Indica asimilación consistente de las competencias evaluadas hasta la fecha.",
      });
    } else if (stats.passingPercentage < 70) {
      insights.push({
        id: "insight-general-critical",
        type: "WARNING",
        title: "Concentración de reprobación académica",
        observation: `El ${100 - stats.passingPercentage}% de los estudiantes evaluados se encuentra por debajo de la nota mínima (${passingGrade}).`,
        significance: "Requiere planes de nivelación o revisión de los criterios de evaluación antes del cierre.",
        actionLabel: "Ver estudiantes en riesgo",
        actionType: "RISK",
      });
    } else {
      insights.push({
        id: "insight-general-moderate",
        type: "INFO",
        title: "Rendimiento en zona de observación",
        observation: `El curso registra una aprobación del ${stats.passingPercentage}% con promedio de ${stats.groupAverage.toFixed(2)}.`,
        significance: "El grupo mantiene estabilidad, pero convendría fortalecer a quienes están cerca del límite.",
      });
    }
  }

  // Insight 2: Disparidad entre evaluaciones (Mejor vs Peor)
  const best = stats.assessmentComparison?.highestPerforming;
  const lowest = stats.assessmentComparison?.lowestPerforming;

  if (best && lowest && best.assessmentId !== lowest.assessmentId && best.average !== null && lowest.average !== null) {
    const diff = Number((best.average - lowest.average).toFixed(1));
    if (diff >= 0.5) {
      insights.push({
        id: "insight-gap-assessments",
        type: "WARNING",
        title: `Brecha de ${diff} pts entre evaluaciones`,
        observation: `"${best.title}" alcanzó un promedio de ${best.average.toFixed(1)} (${best.passingPercentage}% aprobación), mientras "${lowest.title}" concentró el promedio más bajo con ${lowest.average.toFixed(1)} (${lowest.passingPercentage}% aprobación).`,
        significance: "Evidencia que los conceptos o el formato de la actividad con menor rendimiento presentaron mayor dificultad para el grupo.",
        actionLabel: `Ver "${lowest.title}"`,
        actionType: "ASSESSMENT",
        targetId: lowest.assessmentId,
      });
    }
  } else if (lowest && lowest.average !== null && stats.groupAverage !== null) {
    if (lowest.average < stats.groupAverage - 0.3) {
      insights.push({
        id: "insight-lowest-activity",
        type: "INFO",
        title: `Actividad con menor rendimiento: ${lowest.title}`,
        observation: `Registra un promedio de ${lowest.average.toFixed(1)} frente al ${stats.groupAverage.toFixed(2)} promedio del curso.`,
        significance: "Revisar los ítems evaluados en esta actividad antes de avanzar a temas correlacionados.",
        actionLabel: "Ver evaluación",
        actionType: "ASSESSMENT",
        targetId: lowest.assessmentId,
      });
    }
  }

  // Insight 3: Calificaciones pendientes y certeza del cierre
  if (stats.totalPendingCount > 0) {
    insights.push({
      id: "insight-pending-impact",
      type: "ACTION",
      title: "Impacto de notas pendientes en la proyección",
      observation: `Existen ${stats.totalPendingCount} notas pendientes de registro en el periodo actual.`,
      significance: "El promedio proyectado puede variar considerablemente a medida que se ingresen estas calificaciones faltantes.",
      actionLabel: "Ver pendientes",
      actionType: "PENDING",
    });
  }

  // Insight 4: Tendencia de evolución
  const timeline = stats.evolution?.filter(p => p.groupAverage !== null) ?? [];
  if (timeline.length >= 2) {
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    if (first.groupAverage !== null && last.groupAverage !== null) {
      const overallDelta = Number((last.groupAverage - first.groupAverage).toFixed(2));
      if (overallDelta >= 0.3) {
        insights.push({
          id: "insight-evolution-up",
          type: "SUCCESS",
          title: `Evolución favorable (+${overallDelta.toFixed(2)} pts)`,
          observation: `El grupo progresó de ${first.groupAverage.toFixed(1)} en "${first.assessmentTitle}" a ${last.groupAverage.toFixed(1)} en "${last.assessmentTitle}".`,
          significance: "Demuestra una curva de aprendizaje positiva a lo largo del periodo.",
        });
      } else if (overallDelta <= -0.3) {
        insights.push({
          id: "insight-evolution-down",
          type: "WARNING",
          title: `Curva descendente (${overallDelta.toFixed(2)} pts)`,
          observation: `El promedio cayó de ${first.groupAverage.toFixed(1)} en "${first.assessmentTitle}" a ${last.groupAverage.toFixed(1)} en "${last.assessmentTitle}".`,
          significance: "Indica acumulación de dificultad o sobrecarga de tareas hacia el final del periodo.",
        });
      }
    }
  }

  return insights.slice(0, 4);
}

// =======================================================
// 6. DISTRIBUCIÓN DE NOTAS POR RANGOS INSTITUCIONALES
// =======================================================

/**
 * Calcula los 4 rangos estándares de desempeño institucional en Colombia:
 * - Superior (4.6 - 5.0)
 * - Alto (4.0 - 4.5)
 * - Básico (3.0 - 3.9)
 * - Bajo (< 3.0)
 * Adaptándose proporcionalmente si la escala institucional difiere de 0-5.
 */
export function calculateCourseDistributionBrackets(
  definitivas: (number | null | undefined)[],
  scale?: GradeScaleConfig | null
): CourseDistributionBracket[] {
  const minVal = scale?.minValue ?? 0;
  const maxVal = scale?.maxValue ?? 5;
  const range = maxVal - minVal;

  const valid = definitivas
    .map(d => (d !== null && d !== undefined && !isNaN(Number(d)) ? Number(d) : null))
    .filter((d): d is number => d !== null);

  const total = valid.length;

  // Umbrales proporcionales
  const tLow = minVal + range * 0.6;      // ej 3.0
  const tBasic = minVal + range * 0.8;    // ej 4.0
  const tHigh = minVal + range * 0.92;    // ej 4.6

  const brackets = [
    {
      id: "superior",
      label: "Desempeño Superior",
      rangeLabel: `${tHigh.toFixed(1)} – ${maxVal.toFixed(1)}`,
      min: tHigh,
      max: maxVal,
      count: valid.filter(v => v >= tHigh && v <= maxVal).length,
      color: "#10b981", // emerald
      bgClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      textClass: "text-emerald-600 dark:text-emerald-400",
      barColor: "bg-emerald-500",
    },
    {
      id: "alto",
      label: "Desempeño Alto",
      rangeLabel: `${tBasic.toFixed(1)} – ${(tHigh - 0.1).toFixed(1)}`,
      min: tBasic,
      max: tHigh,
      count: valid.filter(v => v >= tBasic && v < tHigh).length,
      color: "#3b82f6", // blue
      bgClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      textClass: "text-blue-600 dark:text-blue-400",
      barColor: "bg-blue-500",
    },
    {
      id: "basico",
      label: "Desempeño Básico",
      rangeLabel: `${tLow.toFixed(1)} – ${(tBasic - 0.1).toFixed(1)}`,
      min: tLow,
      max: tBasic,
      count: valid.filter(v => v >= tLow && v < tBasic).length,
      color: "#f59e0b", // amber
      bgClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      textClass: "text-amber-600 dark:text-amber-400",
      barColor: "bg-amber-500",
    },
    {
      id: "bajo",
      label: "Desempeño Bajo",
      rangeLabel: `< ${tLow.toFixed(1)}`,
      min: minVal,
      max: tLow,
      count: valid.filter(v => v < tLow).length,
      color: "#ef4444", // rose
      bgClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      textClass: "text-rose-600 dark:text-rose-400",
      barColor: "bg-rose-500",
    },
  ];

  return brackets.map(b => ({
    ...b,
    percentage: total > 0 ? Math.round((b.count / total) * 100) : 0,
  }));
}
import {
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceStatus,
  AttendanceStudent,
  HistorySummaryStats,
} from "./types";

export type PatternSeverity = "normal" | "preventive" | "critical";

export type NegativePatternType =
  | "consecutive_absences"
  | "accumulated_absences"
  | "recent_spike"
  | "persistently_low"
  | "frequent_tardiness";

export interface StudentPatternAnalysis {
  studentId: string;
  effectiveAttendanceRate: number;
  hasNegativePattern: boolean;
  negativePatternType?: NegativePatternType;
  severity: PatternSeverity;
  headline: string;
  explanation: string;
  consecutiveAbsences: number;
  totalAbsencesInPeriod: number;
  totalLateInPeriod: number;
  totalExcusedInPeriod: number;
  isIsolatedAbsence: boolean;
  isIsolatedLate: boolean;
  isRecentSpike: boolean;
  isFrequentLate: boolean;
  isPersistentlyLow: boolean;
  hasOpenCase: boolean;
  openCaseId?: number;
  openCase?: AttendanceFollowUpCaseItem;
  rateDropPercent: number;
  priorityWeight: number; // Internal sorting weight: higher = more urgent
  badges: Array<{
    label: string;
    tone: "rose" | "amber" | "blue" | "emerald";
  }>;
}

export interface GroupPatternAnalysis {
  totalStudents: number;
  recordedCount: number;
  pendingCount: number;
  studentsInAttentionCount: number;
  criticalCasesCount: number;
  preventiveCasesCount: number;
  groupAttendanceRate: number;
  headline: string;
  statusSentence: string;
  trendSentence: string;
}

/**
 * Analyzes an individual student's attendance records to detect negative patterns:
 * - Consecutive absences (>= 2 consecutive)
 * - Accumulated absences (>= 3 in period or >= 4 with active absences)
 * - Recent spikes in absences (sudden pattern shift after regular attendance)
 * - Persistently low attendance (<= 86% with active negative events)
 * - Frequent tardiness (>= 3 tardies)
 *
 * Excludes strictly:
 * - 100% attendance students (never in attention)
 * - Isolated single absences in generally regular students (>= 88% attendance)
 * - Isolated tardiness (1-2 tardies in regular students)
 * - Isolated excuses
 * - Pedagogical follow-up cases (an open case does NOT create an attendance alert)
 */
export function analyzeStudentPattern(
  student: AttendanceStudent,
  days: AttendanceDay[],
  getStatus: (studentId: string, dateIso: string) => AttendanceStatus,
  followUpCases: AttendanceFollowUpCaseItem[] = []
): StudentPatternAnalysis {
  // 1. Follow-up case check (independent pedagogical tracking entity)
  const activeCase = followUpCases.find(
    (c) => c.studentId === student.id && c.status !== "resolved"
  );
  const hasOpenCase = Boolean(activeCase);

  // 2. Compute effective attendance rate from recorded sessions in evaluated days
  const recordedDays = days.filter((d) => getStatus(student.id, d.iso) !== "pending");
  const absentCountInDays = recordedDays.filter((d) => getStatus(student.id, d.iso) === "absent").length;
  const effectiveAttendanceRate = recordedDays.length > 0
    ? Math.round(((recordedDays.length - absentCountInDays) / recordedDays.length) * 100)
    : student.attendanceRate;

  // 3. Count consecutive absences backwards from latest recorded non-pending day
  let consecutiveAbsences = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const st = getStatus(student.id, days[i].iso);
    if (st === "pending") continue;
    if (st === "absent") {
      consecutiveAbsences++;
    } else {
      break;
    }
  }

  // 4. Count statuses across visible days
  let totalAbsencesInPeriod = 0;
  let totalLateInPeriod = 0;
  let totalExcusedInPeriod = 0;

  days.forEach((d) => {
    const st = getStatus(student.id, d.iso);
    if (st === "absent") totalAbsencesInPeriod++;
    if (st === "late") totalLateInPeriod++;
    if (st === "excused") totalExcusedInPeriod++;
  });

  // 5. Rate drop & recent spike detection (prior vs recent sessions)
  let rateDropPercent = 0;
  let isRecentSpike = false;

  if (days.length >= 4) {
    const recentSlice = days.slice(-3);
    const priorSlice = days.slice(0, -3);

    const calcPresence = (slice: AttendanceDay[]) => {
      const recorded = slice.filter((d) => getStatus(student.id, d.iso) !== "pending");
      if (!recorded.length) return 1;
      const pCount = recorded.filter((d) => getStatus(student.id, d.iso) === "present").length;
      return pCount / recorded.length;
    };

    const priorRate = calcPresence(priorSlice);
    const recentRate = calcPresence(recentSlice);
    const diff = priorRate - recentRate;

    if (diff > 0.15) {
      rateDropPercent = Math.round(diff * 100);
    }

    // Trigger spike if student was regular prior and missed at least 2 of recent 3
    const recentAbsences = recentSlice.filter((d) => getStatus(student.id, d.iso) === "absent").length;
    if (recentAbsences >= 2 && priorRate >= 0.75) {
      isRecentSpike = true;
    }
  }

  // 6. Categorize base conditions
  const isFrequentLate = totalLateInPeriod >= 3;

  // Persistently low: historical rate <= 86% with accumulated absences, or in-period rate <= 86% with >= 2 absences
  const isPersistentlyLow =
    (student.attendanceRate <= 86 && (student.absencesCount >= 3 || totalAbsencesInPeriod > 0)) ||
    (effectiveAttendanceRate <= 86 && totalAbsencesInPeriod >= 2);

  // Isolated absence: exactly 1 absence, not consecutive >= 2, rate >= 88%, no spike, < 3 tardies
  const isIsolatedAbsence =
    consecutiveAbsences === 1 &&
    totalAbsencesInPeriod === 1 &&
    effectiveAttendanceRate >= 88 &&
    student.attendanceRate >= 88 &&
    !isRecentSpike &&
    totalLateInPeriod < 3;

  // Isolated tardiness: 1 or 2 tardies without absences and good attendance
  const isIsolatedLate =
    totalLateInPeriod > 0 &&
    totalLateInPeriod <= 2 &&
    totalAbsencesInPeriod === 0 &&
    consecutiveAbsences === 0 &&
    effectiveAttendanceRate >= 88 &&
    student.attendanceRate >= 88;

  // Isolated excuse: 1 or 2 excuses without absences/tardies
  const isIsolatedExcuse =
    totalExcusedInPeriod > 0 &&
    totalAbsencesInPeriod === 0 &&
    totalLateInPeriod === 0;

  // 7. Strict negative pattern detection (SOLELY derived from attendance records, NEVER from an open case)
  let hasNegativePattern = false;
  let negativePatternType: NegativePatternType | undefined = undefined;

  if (consecutiveAbsences >= 2) {
    hasNegativePattern = true;
    negativePatternType = "consecutive_absences";
  } else if (totalAbsencesInPeriod >= 3 || (student.absencesCount >= 4 && totalAbsencesInPeriod >= 2)) {
    hasNegativePattern = true;
    negativePatternType = "accumulated_absences";
  } else if (isRecentSpike) {
    hasNegativePattern = true;
    negativePatternType = "recent_spike";
  } else if (isFrequentLate) {
    hasNegativePattern = true;
    negativePatternType = "frequent_tardiness";
  } else if (isPersistentlyLow) {
    hasNegativePattern = true;
    negativePatternType = "persistently_low";
  }

  // Strict guard 1: 100% attendance students with 0 absences in period NEVER have a negative pattern
  if (student.attendanceRate === 100 && totalAbsencesInPeriod === 0 && totalLateInPeriod < 3) {
    hasNegativePattern = false;
    negativePatternType = undefined;
  }

  // Strict guard 2: Isolated single absence NEVER enters Atención Docente
  if (isIsolatedAbsence) {
    hasNegativePattern = false;
    negativePatternType = undefined;
  }

  // Strict guard 3: Isolated tardiness NEVER enters Atención Docente
  if (isIsolatedLate) {
    hasNegativePattern = false;
    negativePatternType = undefined;
  }

  // Strict guard 4: Isolated excuse NEVER enters Atención Docente
  if (isIsolatedExcuse) {
    hasNegativePattern = false;
    negativePatternType = undefined;
  }

  // 8. Severity & Priority Weight
  let severity: PatternSeverity = "normal";
  let priorityWeight = 0;

  if (hasNegativePattern) {
    if (consecutiveAbsences >= 3 || (effectiveAttendanceRate < 80 && totalAbsencesInPeriod >= 2)) {
      severity = "critical";
      priorityWeight =
        300 +
        consecutiveAbsences * 25 +
        (100 - effectiveAttendanceRate);
    } else {
      severity = "preventive";
      priorityWeight =
        200 +
        consecutiveAbsences * 15 +
        rateDropPercent +
        (100 - effectiveAttendanceRate);
    }
  }

  // 9. Human-readable factual headline & explanation (No generic 'Alerta')
  let headline = "asistencia regular y al día";
  let explanation = "Registro consistente y puntual sin señales de riesgo de inasistencia.";

  if (hasNegativePattern) {
    switch (negativePatternType) {
      case "consecutive_absences":
        headline = `${consecutiveAbsences} ausencias consecutivas`;
        explanation = `Faltó de forma ininterrumpida a las últimas ${consecutiveAbsences} sesiones registradas.`;
        break;
      case "accumulated_absences":
        headline = totalAbsencesInPeriod >= 3
          ? `${totalAbsencesInPeriod} ausencias recientes`
          : `${student.absencesCount} ausencias acumuladas`;
        explanation = `Acumula ${totalAbsencesInPeriod >= 3 ? totalAbsencesInPeriod : student.absencesCount} inasistencias en el periodo evaluado.`;
        break;
      case "recent_spike":
        headline = rateDropPercent > 0
          ? `su asistencia bajó ${rateDropPercent}% en las últimas semanas`
          : "aumento reciente de inasistencias";
        explanation = "Presentó inasistencias en las sesiones más recientes tras un periodo previo regular.";
        break;
      case "persistently_low":
        headline = "asistencia persistentemente baja";
        explanation = `Mantiene un ${effectiveAttendanceRate}% de asistencia, por debajo del umbral institucional esperado.`;
        break;
      case "frequent_tardiness":
        headline = `${totalLateInPeriod} tardanzas este periodo`;
        explanation = `Ha registrado ${totalLateInPeriod} llegadas tarde en las sesiones evaluadas.`;
        break;
    }
  } else if (isIsolatedAbsence) {
    headline = "ausencia aislada";
    explanation = `Mantiene un ${effectiveAttendanceRate}% de asistencia general. Falta puntual sin patrón de inasistencias repetidas.`;
  } else if (isIsolatedLate) {
    headline = totalLateInPeriod === 1 ? "1 tardanza aislada" : `${totalLateInPeriod} tardanzas aisladas`;
    explanation = `Mantiene un ${effectiveAttendanceRate}% de asistencia general. Llegada tarde puntual sin constituir hábito recurrente.`;
  }

  // 10. Badges: Strictly factual attendance badges (No pedagogical case badges here)
  const badges: Array<{ label: string; tone: "rose" | "amber" | "blue" | "emerald" }> = [];

  if (hasNegativePattern) {
    if (negativePatternType === "consecutive_absences") {
      badges.push({
        label: `${consecutiveAbsences} consecutivas`,
        tone: "rose",
      });
    } else if (negativePatternType === "accumulated_absences") {
      badges.push({
        label: `${totalAbsencesInPeriod} ausencias`,
        tone: "rose",
      });
    } else if (negativePatternType === "recent_spike") {
      badges.push({
        label: "Faltas recientes",
        tone: "amber",
      });
    } else if (negativePatternType === "persistently_low") {
      badges.push({
        label: "Baja asistencia",
        tone: "rose",
      });
    } else if (negativePatternType === "frequent_tardiness") {
      badges.push({
        label: `${totalLateInPeriod} tardanzas`,
        tone: "amber",
      });
    }
  } else if (isIsolatedAbsence) {
    badges.push({
      label: "Falta aislada",
      tone: "blue",
    });
  }

  return {
    studentId: student.id,
    effectiveAttendanceRate,
    hasNegativePattern,
    negativePatternType,
    severity,
    headline,
    explanation,
    consecutiveAbsences,
    totalAbsencesInPeriod,
    totalLateInPeriod,
    totalExcusedInPeriod,
    isIsolatedAbsence,
    isIsolatedLate,
    isRecentSpike,
    isFrequentLate,
    isPersistentlyLow,
    hasOpenCase,
    openCaseId: activeCase?.id,
    openCase: activeCase,
    rateDropPercent,
    priorityWeight,
    badges,
  };
}

/**
 * Computes high-level contextual summary of the entire group:
 * - Register completeness (e.g. 34 de 36 registrados)
 * - Number of students with real negative patterns
 * - Overall group trend
 */
export function analyzeGroupPatterns(
  students: AttendanceStudent[],
  days: AttendanceDay[],
  currentDateIso: string,
  getStatus: (studentId: string, dateIso: string) => AttendanceStatus,
  followUpCases: AttendanceFollowUpCaseItem[] = []
): GroupPatternAnalysis {
  const totalStudents = students.length;
  if (!totalStudents) {
    return {
      totalStudents: 0,
      recordedCount: 0,
      pendingCount: 0,
      studentsInAttentionCount: 0,
      criticalCasesCount: 0,
      preventiveCasesCount: 0,
      groupAttendanceRate: 0,
      headline: "Sin estudiantes en el curso",
      statusSentence: "Sin alumnos asignados",
      trendSentence: "Sin registros",
    };
  }

  // Count current date recorded vs pending
  let recordedCount = 0;
  let pendingCount = 0;

  students.forEach((s) => {
    const st = getStatus(s.id, currentDateIso);
    if (st === "pending") pendingCount++;
    else recordedCount++;
  });

  // Analyze all students
  const analyses = students.map((s) =>
    analyzeStudentPattern(s, days, getStatus, followUpCases)
  );

  const studentsInAttention = analyses.filter((a) => a.hasNegativePattern);
  const studentsInAttentionCount = studentsInAttention.length;
  const criticalCasesCount = studentsInAttention.filter((a) => a.severity === "critical").length;
  const preventiveCasesCount = studentsInAttention.filter((a) => a.severity === "preventive").length;

  // Group average attendance rate
  const groupAttendanceRate = Math.round(
    students.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudents
  );

  // Group trend across periods (first half vs second half)
  let trendSentence = "Asistencia grupal estable esta semana";
  if (days.length >= 4) {
    const midpoint = Math.floor(days.length / 2);
    const firstHalf = days.slice(0, midpoint);
    const secondHalf = days.slice(midpoint);

    const calcAveragePresence = (slice: AttendanceDay[]) => {
      let totalSlots = 0;
      let presentSlots = 0;
      slice.forEach((d) => {
        students.forEach((s) => {
          const st = getStatus(s.id, d.iso);
          if (st !== "pending") {
            totalSlots++;
            if (st === "present") presentSlots++;
          }
        });
      });
      return totalSlots ? presentSlots / totalSlots : 1;
    };

    const firstRate = calcAveragePresence(firstHalf);
    const secondRate = calcAveragePresence(secondHalf);
    const rateDiff = Math.round((secondRate - firstRate) * 100);

    if (rateDiff <= -6) {
      trendSentence = `Inasistencias aumentaron ${Math.abs(rateDiff)}% en las últimas sesiones`;
    } else if (rateDiff >= 6) {
      trendSentence = `Asistencia del grupo en recuperación (+${rateDiff}%)`;
    }
  }

  // Status sentence
  let statusSentence = `${recordedCount} de ${totalStudents} estudiantes registrados`;
  if (pendingCount === 0) {
    statusSentence = `Asistencia completa hoy (${totalStudents}/${totalStudents})`;
  }

  // Headline combining the most relevant context
  let headline = "";
  if (pendingCount > 0 && studentsInAttentionCount > 0) {
    headline = `${recordedCount} de ${totalStudents} registrados · ${studentsInAttentionCount} en atención preventiva`;
  } else if (pendingCount > 0 && studentsInAttentionCount === 0) {
    headline = `${recordedCount} de ${totalStudents} registrados · Grupo al día`;
  } else if (pendingCount === 0 && studentsInAttentionCount > 0) {
    headline = `Día completo (${totalStudents}/${totalStudents}) · ${studentsInAttentionCount} en seguimiento`;
  } else {
    headline = `Día completo (${totalStudents}/${totalStudents}) · Grupo al día sin alertas`;
  }

  return {
    totalStudents,
    recordedCount,
    pendingCount,
    studentsInAttentionCount,
    criticalCasesCount,
    preventiveCasesCount,
    groupAttendanceRate,
    headline,
    statusSentence,
    trendSentence,
  };
}

/**
 * Computes consolidated history stats for a student over any given timeframe (e.g. 7 days, 4 weeks, or period).
 * Calculates:
 * - totalDays, recordedDays
 * - counts of present, absent, late, excused, pending
 * - attendanceRate over the timeframe (excluding pending)
 * - trend: 'improving' (↗), 'stable' (→), 'declining' (↘)
 */
export function calculateHistoryStats(
  studentId: string,
  daysSlice: AttendanceDay[],
  getStatus: (studentId: string, dateIso: string) => AttendanceStatus
): HistorySummaryStats {
  const totalDays = daysSlice.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let pendingCount = 0;

  daysSlice.forEach((day) => {
    const st = getStatus(studentId, day.iso);
    if (st === "present") presentCount++;
    else if (st === "absent") absentCount++;
    else if (st === "late") lateCount++;
    else if (st === "excused") excusedCount++;
    else pendingCount++;
  });

  const recordedDays = totalDays - pendingCount;
  const attendanceRate = recordedDays > 0 ? Math.round((presentCount / recordedDays) * 100) : 100;

  let trend: "improving" | "stable" | "declining" = "stable";
  let trendLabel = "Estable";

  const nonPendingDays = daysSlice.filter((d) => getStatus(studentId, d.iso) !== "pending");
  if (nonPendingDays.length >= 4) {
    const mid = Math.floor(nonPendingDays.length / 2);
    const firstHalf = nonPendingDays.slice(0, mid);
    const secondHalf = nonPendingDays.slice(mid);

    const calcPresence = (slice: AttendanceDay[]) => {
      const p = slice.filter((d) => getStatus(studentId, d.iso) === "present").length;
      return p / slice.length;
    };

    const firstRate = calcPresence(firstHalf);
    const secondRate = calcPresence(secondHalf);
    const diff = secondRate - firstRate;

    if (diff >= 0.08) {
      trend = "improving";
      trendLabel = "En mejora";
    } else if (diff <= -0.08) {
      trend = "declining";
      trendLabel = "En descenso";
    }
  }

  return {
    totalDays,
    recordedDays,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    pendingCount,
    attendanceRate,
    trend,
    trendLabel,
  };
}

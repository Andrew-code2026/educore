/**
 * Derivaciones del Panel de Asistencia: métricas de la jornada, filtros y
 * patrones de "Atención docente". La UI nunca recalcula reglas por su cuenta.
 */
import type {
  AttendanceFilter,
  AttendanceRecord,
  AttendanceStatus,
  AttentionFlag,
  AttentionKind,
  Course,
  DayMetrics,
  SessionStatuses,
  Student,
  StudentStats,
} from "../types";
import { fromISODate, toISODate } from "./dateUtils";

/** Umbrales de los patrones de atención (visibles en la leyenda del panel). */
export const ATTENTION_RULES = {
  consecutiveAbsences: 3,
  minAttendanceRate: 85,
  latesInWindow: 3,
  lateWindowDays: 15,
} as const;

export const ATTENTION_RULE_LABELS: string[] = [
  `${ATTENTION_RULES.consecutiveAbsences} ausencias consecutivas`,
  `Asistencia menor a ${ATTENTION_RULES.minAttendanceRate}%`,
  `${ATTENTION_RULES.latesInWindow} tardanzas en ${ATTENTION_RULES.lateWindowDays} jornadas recientes`,
  "Excusa pendiente de revisión",
];

const EMPTY_STATS: StudentStats = {
  recorded: 0,
  present: 0,
  absent: 0,
  late: 0,
  excuse: 0,
  attendanceRate: null,
  trendDelta: 0,
  trend: "stable",
  recent: [],
};

function rateOf(records: AttendanceRecord[]): number | null {
  const recorded = records.filter(record => record.status !== "pending");
  if (recorded.length === 0) return null;
  const attended = recorded.filter(
    record => record.status === "present" || record.status === "late",
  ).length;
  return (attended / recorded.length) * 100;
}

/** Registros del estudiante incluyendo la jornada abierta. */
export function computeStudentStats(
  student: Student,
  todayStatus: AttendanceStatus,
  todayIso: string = toISODate(new Date()),
): StudentStats {
  // La jornada abierta nunca se duplica, aunque ya exista en el histórico.
  const all = [
    ...student.history.filter(record => record.date !== todayIso),
    { date: todayIso, status: todayStatus },
  ];
  if (all.length === 0) return EMPTY_STATS;

  const recorded = all.filter(record => record.status !== "pending");
  const count = (status: AttendanceStatus) =>
    recorded.filter(record => record.status === status).length;

  // Tendencia: mitad reciente contra mitad anterior de lo registrado.
  const half = Math.floor(recorded.length / 2);
  const previous = recorded.slice(0, half);
  const current = recorded.slice(half);
  const currentRate = rateOf(current);
  const previousRate = rateOf(previous);
  const trendDelta = currentRate === null || previousRate === null ? 0 : currentRate - previousRate;

  return {
    recorded: recorded.length,
    present: count("present"),
    absent: count("absent"),
    late: count("late"),
    excuse: count("excuse"),
    attendanceRate: rateOf(recorded),
    trendDelta,
    trend: trendDelta > 1.5 ? "up" : trendDelta < -1.5 ? "down" : "stable",
    recent: all.slice(-12),
  };
}

/** Ausencias consecutivas al cierre de la jornada anterior. */
function trailingAbsences(history: AttendanceRecord[]): number {
  let streak = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].status === "absent") streak += 1;
    else break;
  }
  return streak;
}

function latesInWindow(history: AttendanceRecord[], windowDays: number): number {
  return history.slice(-windowDays).filter(record => record.status === "late").length;
}

/** Señales de atención de un estudiante (puede haber más de una). */
export function attentionFlagsFor(
  student: Student,
  todayStatus: AttendanceStatus,
  todayIso: string = toISODate(new Date()),
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const stats = computeStudentStats(student, todayStatus, todayIso);
  const streak = trailingAbsences(student.history) + (todayStatus === "absent" ? 1 : 0);
  const rateLabel = stats.attendanceRate === null
    ? "Sin historial calculable"
    : `${Math.round(stats.attendanceRate)}% asistencia`;

  if (streak >= ATTENTION_RULES.consecutiveAbsences) {
    flags.push({
      studentId: student.id,
      kind: "consecutive_absences",
      label: `${streak} ausencias consecutivas`,
      detail: rateLabel,
      severity: "high",
      weight: 100 + streak,
    });
  } else if (stats.attendanceRate !== null && stats.attendanceRate < ATTENTION_RULES.minAttendanceRate) {
    flags.push({
      studentId: student.id,
      kind: "low_attendance",
      label: `Asistencia en ${Math.round(stats.attendanceRate)}%`,
      detail: `${stats.absent} ${stats.absent === 1 ? "ausencia acumulada" : "ausencias acumuladas"}`,
      severity: "medium",
      weight: 80 + (ATTENTION_RULES.minAttendanceRate - stats.attendanceRate),
    });
  }

  const lates = latesInWindow(student.history, ATTENTION_RULES.lateWindowDays);
  if (lates >= ATTENTION_RULES.latesInWindow) {
    flags.push({
      studentId: student.id,
      kind: "late_pattern",
      label: `${lates} tardanzas en ${ATTENTION_RULES.lateWindowDays} jornadas recientes`,
      detail: `${stats.late} tardanzas acumuladas`,
      severity: "medium",
      weight: 60 + lates,
    });
  }

  if (student.pendingExcuses > 0) {
    flags.push({
      studentId: student.id,
      kind: "pending_excuse",
      label:
        student.pendingExcuses === 1
          ? "Excusa pendiente de revisión"
          : `${student.pendingExcuses} excusas pendientes`,
      detail: "Cargada por el acudiente",
      severity: "low",
      weight: 40 + student.pendingExcuses,
    });
  }

  return flags.sort((a, b) => b.weight - a.weight);
}

/** Evidencia legible para explicar por qué una regla de atención está activa. */
export interface AttentionExplanation {
  kind: AttentionKind;
  trigger: string;
  evidence: string;
  evidenceDates: string[];
  /** Límites del modelo/origen que conviene hacer explícitos en la interfaz. */
  note?: string;
}

export function explainAttentionFlag(
  flag: AttentionFlag,
  student: Student,
  todayStatus: AttendanceStatus,
  todayIso: string = toISODate(new Date()),
): AttentionExplanation {
  switch (flag.kind) {
    case "consecutive_absences": {
      const records = student.history
        .filter(record => record.date < todayIso)
        .concat(todayStatus === "absent" ? [{ date: todayIso, status: "absent" as const }] : [])
        .sort((a, b) => a.date.localeCompare(b.date));
      const consecutive: AttendanceRecord[] = [];
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index].status !== "absent") break;
        consecutive.unshift(records[index]);
      }
      return {
        kind: flag.kind,
        trigger: `La señal aparece al acumular ${ATTENTION_RULES.consecutiveAbsences} o más ausencias seguidas.`,
        evidence: `${consecutive.length} ausencias consecutivas en el historial disponible.`,
        evidenceDates: consecutive.slice(-5).map(record => record.date),
      };
    }
    case "low_attendance": {
      const stats = computeStudentStats(student, todayStatus, todayIso);
      const attended = stats.present + stats.late;
      return {
        kind: flag.kind,
        trigger: `La señal se activa cuando la asistencia queda por debajo de ${ATTENTION_RULES.minAttendanceRate}%.`,
        evidence: `${attended} de ${stats.recorded} jornadas registradas con asistencia (${stats.attendanceRate === null ? "sin tasa calculable" : `${Math.round(stats.attendanceRate)}%`}). Los pendientes no entran en el cálculo.`,
        evidenceDates: [],
      };
    }
    case "late_pattern": {
      // Reproduce exactamente el conjunto de registros que usa la regla existente.
      const window = student.history.slice(-ATTENTION_RULES.lateWindowDays);
      const lateRecords = window.filter(record => record.status === "late");
      return {
        kind: flag.kind,
        trigger: `La señal se activa con ${ATTENTION_RULES.latesInWindow} o más tardanzas en las ${ATTENTION_RULES.lateWindowDays} jornadas históricas evaluadas.`,
        evidence: `${lateRecords.length} tardanzas dentro de los últimos ${window.length} registros históricos disponibles.`,
        evidenceDates: lateRecords.slice(-5).map(record => record.date),
        note: "La regla existente cuenta jornadas registradas, no días calendario.",
      };
    }
    case "pending_excuse":
      return {
        kind: flag.kind,
        trigger: "La señal se activa si hay una o más excusas pendientes de revisión.",
        evidence: `${student.pendingExcuses} excusa${student.pendingExcuses === 1 ? "" : "s"} pendiente${student.pendingExcuses === 1 ? "" : "s"} según el contador recibido.`,
        evidenceDates: [],
        note: "El modelo no incluye el detalle del documento, motivo o fecha de solicitud.",
      };
  }
}

/** Señal principal por estudiante, ordenada por urgencia. */
export function primaryAttentionFlags(
  students: Student[],
  statuses: SessionStatuses,
  todayIso: string = toISODate(new Date()),
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  for (const student of students) {
    const [primary] = attentionFlagsFor(student, statuses[student.id] ?? "pending", todayIso);
    if (primary) flags.push(primary);
  }
  return flags.sort((a, b) => b.weight - a.weight);
}

export function computeDayMetrics(students: Student[], statuses: SessionStatuses): DayMetrics {
  let present = 0;
  let absent = 0;
  let late = 0;
  let excuse = 0;
  let pending = 0;

  for (const student of students) {
    switch (statuses[student.id] ?? "pending") {
      case "present":
        present += 1;
        break;
      case "absent":
        absent += 1;
        break;
      case "late":
        late += 1;
        break;
      case "excuse":
        excuse += 1;
        break;
      default:
        pending += 1;
    }
  }

  const recorded = present + absent + late + excuse;
  return {
    present,
    absent,
    late,
    excuse,
    pending,
    total: students.length,
    attendanceRate: recorded === 0 ? 0 : ((present + late) / recorded) * 100,
  };
}

function matchesQuery(student: Student, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const haystack = `${student.fullName} ${student.group}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return haystack.includes(needle);
}

export function filterStudents(
  students: Student[],
  statuses: SessionStatuses,
  filter: AttendanceFilter,
  query: string,
  attentionIds: Set<string>,
  todayIso: string = toISODate(new Date()),
): Student[] {
  return students.filter(student => {
    if (!matchesQuery(student, query)) return false;
    const status = statuses[student.id] ?? "pending";
    switch (filter) {
      case "pending":
        return status === "pending";
      case "absent":
        return status === "absent";
      case "late":
        return status === "late";
      case "excuse":
        return status === "excuse";
      case "attention":
        return attentionIds.has(student.id);
      default:
        return true;
    }
  });
}

export function filterCounts(
  students: Student[],
  statuses: SessionStatuses,
  attentionIds: Set<string>,
): Record<AttendanceFilter, number> {
  const counts: Record<AttendanceFilter, number> = {
    all: students.length,
    pending: 0,
    absent: 0,
    late: 0,
    excuse: 0,
    attention: 0,
  };
  for (const student of students) {
    const status = statuses[student.id] ?? "pending";
    if (status === "pending") counts.pending += 1;
    if (status === "absent") counts.absent += 1;
    if (status === "late") counts.late += 1;
    if (status === "excuse") counts.excuse += 1;
    if (attentionIds.has(student.id)) counts.attention += 1;
  }
  return counts;
}

export type ClassState = "active" | "upcoming" | "finished" | "closed" | "none";

export interface ClassStateInfo {
  state: ClassState;
  label: string;
  hint: string;
}

/** Estado de la clase para la fecha seleccionada. */
export function classStateFor(course: Course, isoDate: string, now = new Date()): ClassStateInfo {
  const date = fromISODate(isoDate);
  const isToday = isoDate === toISODate(now);
  const hasClass = course.classDays.includes(date.getDay());

  if (!hasClass) {
    return { state: "none", label: "Sin clase programada", hint: `${course.name} · jornada libre` };
  }
  if (!isToday) {
    const past = date.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return past
      ? { state: "closed", label: "Jornada cerrada", hint: `${course.start}–${course.end}` }
      : { state: "upcoming", label: "Clase programada", hint: `${course.start}–${course.end}` };
  }

  const [startH, startM] = course.start.split(":").map(Number);
  const [endH, endM] = course.end.split(":").map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (minutes < start) {
    return { state: "upcoming", label: "Clase programada", hint: `inicia ${course.start}` };
  }
  if (minutes > end) {
    return { state: "finished", label: "Clase finalizada", hint: `${course.start}–${course.end}` };
  }
  return { state: "active", label: "Clase activa", hint: `${course.start}–${course.end}` };
}

/** Mensaje contextual del encabezado según el avance del registro. */
export function progressMessage(metrics: DayMetrics): string {
  if (metrics.total === 0) return "Sin estudiantes en este curso";
  if (metrics.pending === 0) return `${metrics.total} de ${metrics.total} registrados`;
  if (metrics.pending === metrics.total) return `${metrics.total} estudiantes por registrar`;
  return `${metrics.total - metrics.pending} de ${metrics.total} registrados · faltan ${metrics.pending}`;
}

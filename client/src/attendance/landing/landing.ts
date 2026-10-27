import { attentionFlagsFor, classStateFor, computeDayMetrics } from "../data/selectors";
import { fromISODate, toISODate } from "../data/dateUtils";
import type { AttendanceRecord, AttentionKind, Course, SessionStatuses } from "../types";

/**
 * Modelo de presentación de la portada de Asistencia (diseño "EduCore Docente").
 * Deriva el resumen, las clases de hoy, las próximas clases y las justificaciones
 * por revisar. Sin dependencias de React para poder probarse aislado.
 */

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Días con clase que se listan en "Próximas clases". */
export const UPCOMING_DAY_LIMIT = 1;
/** Horizonte de búsqueda de la próxima jornada con clases. */
const UPCOMING_HORIZON_DAYS = 14;

/** Señales que cuentan como alerta "por inasistencias" (no tardanzas ni excusas). */
export const ABSENCE_ALERTS: ReadonlySet<AttentionKind> = new Set<AttentionKind>(["consecutive_absences", "low_attendance"]);

/** Estados de justificación que esperan una decisión del docente. */
const REVIEWABLE = new Set(["submitted", "in_review", "pending_physical_support"]);

const REASON_SHORT: Record<string, string> = {
  medical: "Incapacidad médica",
  family_emergency: "Calamidad familiar",
  external_appointment: "Cita médica",
  institutional: "Representación institucional",
  force_majeure: "Fuerza mayor",
  other: "Otro motivo",
};

/**
 * taken: lista completa · active: clase en curso sin lista completa ·
 * overdue: clase terminada sin lista completa · scheduled: aún no empieza (o sin estudiantes)
 */
export type SessionState = "taken" | "active" | "overdue" | "scheduled";
export type SessionAction = "take" | "edit" | "view";

export interface SessionModel {
  key: string;
  courseId: string;
  /** Fecha ISO `YYYY-MM-DD` de la sesión. */
  date: string;
  group: string;
  subject: string;
  room: string;
  start: string;
  end: string;
  students: number;
  /** Presentes (incluye tardanzas) cuando la lista ya está tomada. */
  present: number | null;
  alerts: number;
  state: SessionState;
  action: SessionAction;
}

export interface UpcomingDay {
  date: string;
  label: string;
  relative: string;
  sessions: SessionModel[];
}

/** Forma mínima de una justificación del host; cualquier objeto compatible sirve. */
export interface LandingJustificationInput {
  id: number;
  courseId: string;
  studentId: string;
  studentName?: string | null;
  submittedByName?: string | null;
  attendanceDate: string;
  reasonCategory: string;
  digitalEvidenceName?: string | null;
  status: string;
  submittedAt?: Date | string | null;
}

export interface JustificationModel {
  id: number;
  courseId: string;
  studentName: string;
  initials: string;
  absenceDate: string;
  courseLabel: string;
  reason: string;
  attachment: string | null;
}

export interface LandingPeriod {
  name: string;
  /** Límites ISO `YYYY-MM-DD`; si faltan, se usa todo el histórico. */
  start: string | null;
  end: string | null;
}

export interface LandingSummary {
  today: number;
  toTake: number;
  next: SessionModel | null;
  alerts: number;
  /** % de asistencia del periodo; null cuando no hay registros. */
  periodRate: number | null;
}

export interface AttendanceLandingModel {
  todayLabel: string;
  period: string | null;
  summary: LandingSummary;
  today: SessionModel[];
  upcoming: UpcomingDay[];
  justifications: JustificationModel[];
}

export interface AttendanceLandingInput {
  courses: Course[];
  /** Estados de la jornada de hoy por curso: id de curso → id de estudiante → estado. */
  statusesByCourse: Record<string, SessionStatuses>;
  justifications?: LandingJustificationInput[];
  period?: LandingPeriod | null;
  now?: Date;
}

// ── Formato ────────────────────────────────────────────────

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Sábado, 24 de octubre" */
export function formatToday(date: Date): string {
  return `${DAYS_LONG[date.getDay()]}, ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

/** "Lunes 26 de octubre" */
export function formatDayHeading(date: Date): string {
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

/** "Mañana" · "En 2 días" */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

/** "Lun 07:00" */
export function formatNextSlot(session: Pick<SessionModel, "date" | "start">): string {
  return `${DAYS_SHORT[fromISODate(session.date).getDay()]} ${session.start}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("es-CO");
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("es-CO");
}

export function courseLabel(course: Pick<Course, "subject" | "name">): string {
  return `${course.subject} ${course.name}`;
}

// ── Derivaciones ───────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function bySchedule(a: SessionModel, b: SessionModel): number {
  return a.start.localeCompare(b.start) || a.group.localeCompare(b.group, "es-CO", { numeric: true });
}

function absenceAlerts(course: Course, statuses: SessionStatuses, todayIso: string): Set<string> {
  const flagged = new Set<string>();
  for (const student of course.students) {
    const flags = attentionFlagsFor(student, statuses[student.id] ?? "pending", todayIso);
    if (flags.some((flag) => ABSENCE_ALERTS.has(flag.kind))) flagged.add(student.id);
  }
  return flagged;
}

function baseSession(course: Course, date: string, alerts: number): SessionModel {
  return {
    key: `${course.id}:${date}`,
    courseId: course.id,
    date,
    group: course.name,
    subject: course.subject,
    room: course.room,
    start: course.start,
    end: course.end,
    students: course.students.length,
    present: null,
    alerts,
    state: "scheduled",
    action: "view",
  };
}

function todaySession(course: Course, statuses: SessionStatuses, todayIso: string, now: Date, alerts: number): SessionModel {
  const session = baseSession(course, todayIso, alerts);
  if (course.students.length === 0) return session;

  const metrics = computeDayMetrics(course.students, statuses);
  if (metrics.pending === 0) {
    return { ...session, state: "taken", action: "edit", present: metrics.present + metrics.late };
  }
  const { state } = classStateFor(course, todayIso, now);
  if (state === "active") return { ...session, state: "active", action: "take" };
  if (state === "finished") return { ...session, state: "overdue", action: "take" };
  return session;
}

function inPeriod(date: string, period: LandingPeriod | null): boolean {
  if (!period) return true;
  if (period.start && date < period.start) return false;
  if (period.end && date > period.end) return false;
  return true;
}

/** Asistencia del periodo: (presentes + tardanzas) / registros, incluida la jornada de hoy. */
export function periodAttendanceRate(
  courses: Course[],
  statusesByCourse: Record<string, SessionStatuses>,
  todayIso: string,
  period: LandingPeriod | null = null,
): number | null {
  let recorded = 0;
  let attended = 0;
  const count = (record: AttendanceRecord) => {
    if (record.status === "pending" || !inPeriod(record.date, period)) return;
    recorded += 1;
    if (record.status === "present" || record.status === "late") attended += 1;
  };

  for (const course of courses) {
    const statuses = statusesByCourse[course.id] ?? {};
    for (const student of course.students) {
      for (const record of student.history) if (record.date !== todayIso) count(record);
      count({ date: todayIso, status: statuses[student.id] ?? "pending" });
    }
  }
  return recorded === 0 ? null : Math.round((attended / recorded) * 100);
}

function buildJustifications(items: LandingJustificationInput[], courses: Course[]): JustificationModel[] {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  return items
    .filter((item) => REVIEWABLE.has(item.status))
    .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate) || a.id - b.id)
    .map((item) => {
      const course = coursesById.get(item.courseId);
      const studentName = item.studentName?.trim() || item.submittedByName?.trim() || "Estudiante";
      return {
        id: item.id,
        courseId: item.courseId,
        studentName,
        initials: initialsOf(studentName),
        absenceDate: formatDayHeading(fromISODate(item.attendanceDate)).toLocaleLowerCase("es-CO"),
        courseLabel: course ? courseLabel(course) : item.courseId,
        reason: REASON_SHORT[item.reasonCategory] ?? REASON_SHORT.other,
        attachment: item.digitalEvidenceName?.trim() || null,
      };
    });
}

export function buildAttendanceLanding({
  courses,
  statusesByCourse,
  justifications = [],
  period = null,
  now = new Date(),
}: AttendanceLandingInput): AttendanceLandingModel {
  const todayIso = toISODate(now);
  const alertsByCourse = new Map<string, Set<string>>();
  const flaggedStudents = new Set<string>();
  for (const course of courses) {
    const flagged = absenceAlerts(course, statusesByCourse[course.id] ?? {}, todayIso);
    alertsByCourse.set(course.id, flagged);
    flagged.forEach((id) => flaggedStudents.add(id));
  }
  const alertsOf = (course: Course) => alertsByCourse.get(course.id)?.size ?? 0;
  // Un periodo cuyas fechas no cubren hoy está desactualizado: no se usa para acotar el histórico
  const rateWindow = period && inPeriod(todayIso, period) ? period : null;

  const today = courses
    .filter((course) => course.classDays.includes(now.getDay()))
    .map((course) => todaySession(course, statusesByCourse[course.id] ?? {}, todayIso, now, alertsOf(course)))
    .sort(bySchedule);

  const upcoming: UpcomingDay[] = [];
  for (let offset = 1; offset <= UPCOMING_HORIZON_DAYS && upcoming.length < UPCOMING_DAY_LIMIT; offset += 1) {
    const day = addDays(now, offset);
    const date = toISODate(day);
    const sessions = courses
      .filter((course) => course.classDays.includes(day.getDay()))
      .map((course) => baseSession(course, date, alertsOf(course)))
      .sort(bySchedule);
    if (sessions.length === 0) continue;
    upcoming.push({ date, label: formatDayHeading(day), relative: formatRelativeDays(offset), sessions });
  }

  return {
    todayLabel: formatToday(now),
    period: period?.name ?? null,
    summary: {
      today: today.length,
      toTake: today.filter((session) => session.action === "take").length,
      next: upcoming[0]?.sessions[0] ?? null,
      alerts: flaggedStudents.size,
      periodRate: periodAttendanceRate(courses, statusesByCourse, todayIso, rateWindow),
    },
    today,
    upcoming,
    justifications: buildJustifications(justifications, courses),
  };
}

interface RawPeriod {
  name?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

function isoOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Periodo activo del snapshot: el marcado como activo o, si no, el que contiene la fecha actual. */
export function resolveActivePeriod(periods: RawPeriod[] | null | undefined, now: Date = new Date()): LandingPeriod | null {
  const todayIso = toISODate(now);
  const list = (periods ?? []).map((p) => ({ name: p.name ?? "", status: p.status, start: isoOf(p.startDate), end: isoOf(p.endDate) }));
  const active =
    list.find((p) => p.status === "Activo" || p.status === "ACTIVE") ??
    list.find((p) => p.start && p.end && p.start <= todayIso && todayIso <= p.end);
  return active?.name ? { name: active.name, start: active.start, end: active.end } : null;
}

/**
 * Modelo del Inicio del estudiante: resumen, "Por hacer" y próximos eventos. El resumen y los
 * eventos también los usa el Inicio del acudiente. Mismas reglas que las páginas de detalle.
 */
import type { HomeEventItem, HomeSummaryTile } from "@/components/dashboard/types";
import { LEVELS } from "@/gradecenter/domain/scale";
import type { AttendanceModel, DayModel } from "../attendance/attendance";
import { capitalize, dayDiff, formatDue, formatGrade, formatShortDate, formatTime, plural, toDate } from "../format";
import type { GradesModel, SubjectModel } from "../grades/grades";
import type { TaskModel } from "../tasks/tasks";

export type PriorityTarget =
  | { section: "classroom"; taskId: number }
  | { section: "attendance" }
  | { section: "grades"; subjectId: number };

export interface PriorityModel {
  /** El prefijo define el ícono en la tarjeta "Por hacer": pending-, attendance-, grade-. */
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  context: string;
  actionLabel: string;
  target: PriorityTarget;
}

const MAX_PRIORITIES = 4;

/** Lo accionable de hoy, de lo más urgente a lo menos: vencidas, excusas, entregas cercanas, materias en riesgo. */
export function buildPriorities(input: { tasks: TaskModel[]; pendingExcuses: DayModel[]; subjects: SubjectModel[] }, now: Date = new Date()): PriorityModel[] {
  const open = input.tasks.filter(task => task.state === "open").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const overdue = open.filter(task => task.urgency === "overdue").map(
    (task): PriorityModel => ({
      id: `pending-overdue-${task.id}`,
      severity: "high",
      title: task.title,
      context: `${task.subject} · ${formatDue(task.dueAt, now)}`,
      actionLabel: "Entregar",
      target: { section: "classroom", taskId: task.id },
    }),
  );
  const excuses = input.pendingExcuses.map(
    (day): PriorityModel => ({
      id: `attendance-excuse-${day.id}`,
      severity: "high",
      title: `Excusa de la ausencia del ${formatShortDate(day.date)}`,
      context: "Ausencia sin justificar",
      actionLabel: "Enviar excusa",
      target: { section: "attendance" },
    }),
  );
  const soon = open.filter(task => task.daysLeft >= 0 && task.daysLeft <= 2).map(
    (task): PriorityModel => ({
      id: `pending-soon-${task.id}`,
      severity: "medium",
      title: task.title,
      context: `${task.subject} · ${formatDue(task.dueAt, now)}`,
      actionLabel: "Entregar",
      target: { section: "classroom", taskId: task.id },
    }),
  );
  const subjects = input.subjects
    .filter(subject => subject.needsAttention)
    .map(
      (subject): PriorityModel => ({
        id: `grade-${subject.id}`,
        severity: "medium",
        title: `Refuerza ${subject.name}`,
        context:
          subject.outlook.needed !== null
            ? `Definitiva ${formatGrade(subject.average!)} · necesitas ${formatGrade(subject.outlook.needed)} en lo pendiente`
            : `Definitiva ${formatGrade(subject.average!)} · por debajo de 3.5`,
        actionLabel: "Ver notas",
        target: { section: "grades", subjectId: subject.id },
      }),
    );
  return [...overdue, ...excuses, ...soon, ...subjects].slice(0, MAX_PRIORITIES);
}

/** Plazo corto de una entrega: "Hoy", "Mañana", "En 5 días", "Vencida". */
export function dueChip(task: TaskModel, now: Date = new Date()): string {
  const days = dayDiff(task.dueAt, now);
  if (days < 0) return "Vencida";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

export interface RawEvent {
  id: number;
  title: string;
  type?: string | null;
  eventDate: Date | string;
  location?: string | null;
}

const MAX_EVENTS = 3;

/**
 * Los tres datos de "¿cómo voy?": promedio, asistencia y entregas pendientes. Mismas reglas
 * que Calificaciones, Asistencia y Tareas, así los números coinciden. `null` = aún cargando.
 */
export function buildSummary(input: { grades: GradesModel | null; attendance: AttendanceModel | null; tasks: TaskModel[] | null }, now: Date = new Date()): HomeSummaryTile[] {
  const { grades, attendance, tasks } = input;
  const open = (tasks ?? []).filter(task => task.state === "open").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const overdue = open.filter(task => task.urgency === "overdue").length;
  const next = open.find(task => task.daysLeft >= 0) ?? null;
  return [
    {
      id: "grades",
      label: "Promedio",
      value: grades ? (grades.average !== null ? formatGrade(grades.average) : "—") : null,
      note: !grades
        ? "Cargando…"
        : grades.average === null
          ? "Sin notas en el periodo"
          : grades.attention
            ? `${plural(grades.attention, "materia", "materias")} en riesgo`
            : `${LEVELS[grades.level!].short} · todas al día`,
      alert: Boolean(grades?.attention),
    },
    {
      id: "attendance",
      label: "Asistencia",
      value: attendance ? (attendance.rate !== null ? String(attendance.rate) : "—") : null,
      unit: attendance?.rate != null ? "%" : undefined,
      note: !attendance
        ? "Cargando…"
        : attendance.pendingExcuses.length
          ? `${plural(attendance.pendingExcuses.length, "ausencia", "ausencias")} sin excusa`
          : attendance.registered
            ? attendance.absent
              ? plural(attendance.absent, "ausencia con excusa", "ausencias con excusa")
              : "Sin ausencias"
            : "Sin registros aún",
      alert: Boolean(attendance?.pendingExcuses.length),
    },
    {
      id: "tasks",
      label: "Por entregar",
      value: tasks ? String(open.length) : null,
      note: !tasks ? "Cargando…" : overdue ? plural(overdue, "vencida", "vencidas") : next ? `Próxima: ${dueChip(next, now).toLowerCase()}` : "Al día",
      alert: overdue > 0,
    },
  ];
}

/** Los próximos eventos del curso (hoy incluido), sin pasados. */
export function nextEvents(events: RawEvent[], now: Date = new Date(), limit = MAX_EVENTS): HomeEventItem[] {
  return events
    .map(event => ({ id: event.id, title: event.title, date: toDate(event.eventDate) }))
    .filter(event => dayDiff(event.date, now) >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map(event => ({ ...event, when: `${dayDiff(event.date, now) === 0 ? "Hoy" : capitalize(formatShortDate(event.date))}, ${formatTime(event.date)}` }));
}

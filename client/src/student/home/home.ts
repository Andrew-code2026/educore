/**
 * Modelo del Inicio del estudiante: "Por hacer", "Mis materias" y "Mi jornada".
 * Reúne tareas, asistencia y notas con las mismas reglas de sus páginas, así los números coinciden.
 */
import type { DayModel } from "../attendance/attendance";
import { dayDiff, formatDue, formatGrade, formatShortDate, formatTime, toDate } from "../format";
import type { SubjectModel } from "../grades/grades";
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

/** Chip corto de la tarjeta "Próxima entrega" (cabe en móvil): "Hoy", "Mañana", "En 5 días", "Vencida". */
export function dueChip(task: TaskModel, now: Date = new Date()): string {
  const days = dayDiff(task.dueAt, now);
  if (days < 0) return "Vencida";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

/** Línea de detalle: "Matemáticas · jue 12 nov, 11:00 p. m.". */
export function dueDetail(task: TaskModel): string {
  return `${task.subject} · ${formatShortDate(task.dueAt)}, ${formatTime(task.dueAt)}`;
}

export interface RawEvent {
  id: number;
  title: string;
  type?: string | null;
  eventDate: Date | string;
  location?: string | null;
}

export interface AgendaItemModel {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  date: Date;
  tag: string;
  isToday: boolean;
  /** Evaluaciones y cierres se resaltan en "Próximos". */
  highlight: boolean;
}

/** Eventos de hoy y próximos (ya filtrados por audiencia en el servidor). */
export function buildAgenda(events: RawEvent[], now: Date = new Date()): { today: AgendaItemModel[]; upcoming: AgendaItemModel[] } {
  const items = events
    .map((event): AgendaItemModel => {
      const date = toDate(event.eventDate);
      return {
        id: `event-${event.id}`,
        title: event.title,
        subtitle: [event.type || "Evento", event.location].filter(Boolean).join(" · "),
        time: formatTime(date),
        date,
        tag: event.type || "Evento",
        isToday: dayDiff(date, now) === 0,
        highlight: /examen|evaluaci|cierre|simulacro/i.test(`${event.type ?? ""} ${event.title}`),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    today: items.filter(item => item.isToday),
    upcoming: items.filter(item => dayDiff(item.date, now) > 0),
  };
}

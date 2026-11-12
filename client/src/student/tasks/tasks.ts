/**
 * Modelo de "Mis tareas": estado de cada actividad desde el punto de vista del estudiante.
 * Deriva del snapshot (actividades del curso y entregas propias). Sin React.
 */
import { dayDiff, formatDue, formatGrade, toDate } from "../format";
import type { Tone } from "../ui";

/** Actividad del aula tal como llega en el snapshot. */
export interface RawTask {
  id: number;
  title: string;
  subject: string;
  teacherName: string;
  description: string;
  dueAt: Date | string;
  points: number;
  status: string;
}

/** Entrega propia tal como llega en el snapshot. */
export interface RawSubmission {
  id: number;
  assignmentId: number;
  submittedAt: Date | string;
  status: string;
  fileName: string | null;
  fileUrl?: string | null;
  comment: string | null;
  grade: number | null;
}

/**
 * - open: abierta y sin entregar (pendiente, vence hoy o vencida pero aún recibe)
 * - submitted: entregada, esperando nota
 * - graded: calificada
 * - missed: cerró sin entrega
 */
export type TaskState = "open" | "submitted" | "graded" | "missed";
export type TaskUrgency = "overdue" | "today" | "soon" | "later";

export interface TaskSubmission {
  id: number;
  submittedAt: Date;
  fileName: string | null;
  fileUrl: string | null;
  /** Antes de calificar: nota del estudiante; después: retroalimentación del docente. */
  comment: string | null;
  grade: number | null;
  late: boolean;
}

export interface TaskModel {
  id: number;
  title: string;
  subject: string;
  teacherName: string;
  description: string;
  dueAt: Date;
  state: TaskState;
  urgency: TaskUrgency | null;
  /** Días hasta la entrega (negativo si ya pasó). */
  daysLeft: number;
  canSubmit: boolean;
  submission: TaskSubmission | null;
}

export type TaskFilter = "pending" | "submitted" | "graded" | "all";

const CLOSED_STATUS = "Cerrada";
const DRAFT_STATUS = "Borrador";

function urgencyOf(daysLeft: number): TaskUrgency {
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "today";
  if (daysLeft <= 6) return "soon";
  return "later";
}

export function buildTasks(assignments: RawTask[], submissions: RawSubmission[], now: Date = new Date()): TaskModel[] {
  // La entrega más reciente de cada actividad
  const latest = new Map<number, RawSubmission>();
  for (const submission of submissions) {
    const current = latest.get(submission.assignmentId);
    const delta = current ? toDate(submission.submittedAt).getTime() - toDate(current.submittedAt).getTime() : 1;
    if (delta > 0 || (delta === 0 && submission.id > current!.id)) latest.set(submission.assignmentId, submission);
  }

  return assignments
    .filter(task => task.status !== DRAFT_STATUS)
    .map((task): TaskModel => {
      const dueAt = toDate(task.dueAt);
      const raw = latest.get(task.id) ?? null;
      const submission: TaskSubmission | null = raw
        ? {
            id: raw.id,
            submittedAt: toDate(raw.submittedAt),
            fileName: raw.fileName,
            fileUrl: raw.fileUrl ?? null,
            comment: raw.comment?.trim() || null,
            grade: raw.grade,
            late: toDate(raw.submittedAt).getTime() > dueAt.getTime(),
          }
        : null;
      const closed = task.status === CLOSED_STATUS;
      const state: TaskState = submission?.grade != null ? "graded" : submission ? "submitted" : closed ? "missed" : "open";
      const daysLeft = dayDiff(dueAt, now);
      return {
        id: task.id,
        title: task.title,
        subject: task.subject,
        teacherName: task.teacherName,
        description: task.description?.trim() ?? "",
        dueAt,
        state,
        urgency: state === "open" ? urgencyOf(daysLeft) : null,
        daysLeft,
        canSubmit: !closed && submission?.grade == null,
        submission,
      };
    });
}

const byDueAsc = (a: TaskModel, b: TaskModel) => a.dueAt.getTime() - b.dueAt.getTime();
const byRecent = (a: TaskModel, b: TaskModel) => (b.submission?.submittedAt ?? b.dueAt).getTime() - (a.submission?.submittedAt ?? a.dueAt).getTime();

export function filterTasks(tasks: TaskModel[], filter: TaskFilter): TaskModel[] {
  if (filter === "pending") return tasks.filter(task => task.state === "open").sort(byDueAsc);
  if (filter === "submitted") return tasks.filter(task => task.state === "submitted").sort(byRecent);
  if (filter === "graded") return tasks.filter(task => task.state === "graded").sort(byRecent);
  return [...tasks].sort(byDueAsc);
}

export interface TaskGroup {
  key: "overdue" | "week" | "later";
  label: string;
  items: TaskModel[];
}

/** Pendientes agrupadas: vencidas, esta semana (incluye hoy) y más adelante. */
export function groupPending(tasks: TaskModel[]): TaskGroup[] {
  const open = tasks.filter(task => task.state === "open").sort(byDueAsc);
  const groups: TaskGroup[] = [
    { key: "overdue", label: "Vencidas", items: open.filter(task => task.urgency === "overdue") },
    { key: "week", label: "Esta semana", items: open.filter(task => task.urgency === "today" || task.urgency === "soon") },
    { key: "later", label: "Más adelante", items: open.filter(task => task.urgency === "later") },
  ];
  return groups.filter(group => group.items.length > 0);
}

export interface TaskSummary {
  pending: number;
  overdue: number;
  dueThisWeek: number;
  submitted: number;
  graded: number;
  /** La pendiente con fecha más cercana que aún no venció; si todas vencieron, la más antigua. */
  next: TaskModel | null;
}

export function summarizeTasks(tasks: TaskModel[]): TaskSummary {
  const open = tasks.filter(task => task.state === "open").sort(byDueAsc);
  return {
    pending: open.length,
    overdue: open.filter(task => task.urgency === "overdue").length,
    dueThisWeek: open.filter(task => task.urgency === "today" || task.urgency === "soon").length,
    submitted: tasks.filter(task => task.state === "submitted").length,
    graded: tasks.filter(task => task.state === "graded").length,
    next: open.find(task => task.daysLeft >= 0) ?? open[0] ?? null,
  };
}

export function taskCounts(tasks: TaskModel[]): Record<TaskFilter, number> {
  return {
    pending: tasks.filter(task => task.state === "open").length,
    submitted: tasks.filter(task => task.state === "submitted").length,
    graded: tasks.filter(task => task.state === "graded").length,
    all: tasks.length,
  };
}

/** Pastilla de estado de la fila. */
export function taskStatus(task: TaskModel, now: Date = new Date()): { label: string; tone: Tone } {
  if (task.state === "graded") return { label: `Calificada · ${formatGrade(task.submission!.grade!)}`, tone: "ok" };
  if (task.state === "submitted") return { label: task.submission?.late ? "Entregada tarde" : "Entregada", tone: "info" };
  if (task.state === "missed") return { label: "No entregada", tone: "alert" };
  if (task.urgency === "overdue") return { label: "Vencida", tone: "alert" };
  if (task.urgency === "today") return { label: "Vence hoy", tone: "warn" };
  if (task.daysLeft === 1) return { label: "Vence mañana", tone: "warn" };
  // La fecha exacta ya va junto a la pastilla: aquí solo el tiempo que queda
  return { label: task.urgency === "soon" ? formatDue(task.dueAt, now) : `En ${task.daysLeft} días`, tone: "neutral" };
}

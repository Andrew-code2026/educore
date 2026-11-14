/**
 * "Por atender" del Inicio del acudiente. El resumen y los eventos son los del Inicio del
 * estudiante (`@/student/home/home`); aquí solo lo que cambia para la familia.
 */
import { APPROVAL_GRADE } from "@/gradecenter/domain/scale";
import type { DayModel } from "@/student/attendance/attendance";
import { normalizeText } from "@/gradecenter/lib/format";
import { formatDue, formatGrade, formatShortDate } from "@/student/format";
import type { SubjectModel } from "@/student/grades/grades";
import type { TaskModel } from "@/student/tasks/tasks";

export type GuardianTarget = { section: "attendance" } | { section: "grades"; subjectId: number | null };

export interface GuardianPriority {
  /** El prefijo define el ícono en la tarjeta: attendance-, pending-, grade-. */
  id: string;
  severity: "high" | "medium";
  title: string;
  context: string;
  actionLabel: string;
  target: GuardianTarget;
}

const MAX_PRIORITIES = 4;

const normalize = (value: string) => normalizeText(value).trim();

/**
 * Lo que el acudiente puede resolver o acompañar, de lo más urgente a lo menos:
 * ausencias sin excusa (solo él puede enviarla), entregas vencidas y materias en riesgo.
 */
export function buildGuardianPriorities(input: { tasks: TaskModel[]; pendingExcuses: DayModel[]; subjects: SubjectModel[] }, now: Date = new Date()): GuardianPriority[] {
  const subjectIdByName = new Map(input.subjects.map(subject => [normalize(subject.name), subject.id]));

  const excuses = input.pendingExcuses.map(
    (day): GuardianPriority => ({
      id: `attendance-excuse-${day.id}`,
      severity: "high",
      title: `Ausencia del ${formatShortDate(day.date)} sin excusa`,
      context: "Envíe la excusa para que coordinación la revise",
      actionLabel: "Enviar excusa",
      target: { section: "attendance" },
    }),
  );

  const overdue = input.tasks
    .filter(task => task.state === "open" && task.urgency === "overdue")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map(
      (task): GuardianPriority => ({
        id: `pending-overdue-${task.id}`,
        severity: "high",
        title: task.title,
        context: `${task.subject} · ${formatDue(task.dueAt, now)} · sin entregar`,
        actionLabel: "Ver materia",
        target: { section: "grades", subjectId: subjectIdByName.get(normalize(task.subject)) ?? null },
      }),
    );

  const atRisk = input.subjects
    .filter(subject => subject.needsAttention && subject.average !== null)
    .map(
      (subject): GuardianPriority => ({
        id: `grade-${subject.id}`,
        severity: "medium",
        title: `${subject.name} por debajo de ${formatGrade(APPROVAL_GRADE)}`,
        context:
          subject.outlook.needed !== null
            ? `Definitiva ${formatGrade(subject.average!)} · necesita ${formatGrade(subject.outlook.needed)} en lo pendiente`
            : `Definitiva ${formatGrade(subject.average!)}`,
        actionLabel: "Ver notas",
        target: { section: "grades", subjectId: subject.id },
      }),
    );

  return [...excuses, ...overdue, ...atRisk].slice(0, MAX_PRIORITIES);
}

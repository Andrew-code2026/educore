/**
 * Modelo del Inicio del acudiente: resumen del hijo, lo que requiere atención y los próximos eventos.
 * Usa los modelos del portal estudiante, así los números coinciden con Calificaciones y Asistencia.
 */
import { APPROVAL_GRADE, LEVELS } from "@/gradecenter/domain/scale";
import type { AttendanceModel, DayModel } from "@/student/attendance/attendance";
import { capitalize, dayDiff, formatDue, formatGrade, formatShortDate, formatTime, plural, toDate } from "@/student/format";
import type { GradesModel, SubjectModel } from "@/student/grades/grades";
import type { RawEvent } from "@/student/home/home";
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
const MAX_EVENTS = 3;

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

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

export interface SummaryTile {
  id: "grades" | "attendance" | "tasks";
  label: string;
  /** `null` mientras carga. */
  value: string | null;
  unit?: string;
  note: string;
  /** Hay algo que revisar en este dato. */
  alert: boolean;
}

/**
 * Los tres datos que responden "¿cómo va mi hijo?": promedio, asistencia y entregas pendientes.
 * Mismas reglas que Calificaciones y Asistencia, así los números coinciden.
 */
export function buildChildSummary(input: { grades: GradesModel | null; attendance: AttendanceModel | null; tasks: TaskModel[] | null }): SummaryTile[] {
  const { grades, attendance, tasks } = input;
  const open = tasks?.filter(task => task.state === "open") ?? [];
  const overdue = open.filter(task => task.urgency === "overdue").length;
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
      note: !tasks ? "Cargando…" : overdue ? plural(overdue, "vencida", "vencidas") : open.length ? "Ninguna vencida" : "Al día",
      alert: overdue > 0,
    },
  ];
}

export interface EventItem {
  id: number;
  title: string;
  /** "Hoy, 9:00 a. m." o "mar 17 nov, 9:00 a. m.". */
  when: string;
  date: Date;
}

/** Los próximos eventos del curso (hoy incluido), sin pasados. */
export function nextEvents(events: RawEvent[], now: Date = new Date(), limit = MAX_EVENTS): EventItem[] {
  return events
    .map(event => ({ id: event.id, title: event.title, date: toDate(event.eventDate) }))
    .filter(event => dayDiff(event.date, now) >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map(event => ({ ...event, when: `${dayDiff(event.date, now) === 0 ? "Hoy" : capitalize(formatShortDate(event.date))}, ${formatTime(event.date)}` }));
}

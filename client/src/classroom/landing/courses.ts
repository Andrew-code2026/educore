import { courseKey } from '../adapter';

/**
 * Modelo de presentación de la portada "Mis cursos" de Classroom.
 * Deriva tarjetas de curso, entregas por revisar y resumen del periodo a partir
 * del snapshot de EduCore. Sin dependencias de React para poder probarse aislado.
 */

const DAY_MS = 86_400_000;
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const DEFAULT_SUBJECT = 'Asignatura institucional';

/** active: entregas abiertas · idle: publicadas pero ninguna abierta · empty: sin actividades publicadas */
export type CourseCardState = 'active' | 'idle' | 'empty';

export interface NextDelivery {
  assignmentId: number;
  title: string;
  dueAt: Date;
  daysLeft: number;
  submitted: number;
}

export interface CourseCardModel {
  id: string;
  group: string;
  subject: string;
  students: number;
  state: CourseCardState;
  open: number;
  toReview: number;
  next: NextDelivery | null;
  lastSubmissionAt: Date | null;
}

export interface PendingReview {
  id: string;
  courseId: string;
  assignmentId: number;
  studentName: string;
  initials: string;
  activity: string;
  courseLabel: string;
  submittedAt: Date | null;
}

export interface ClassroomSummary {
  courses: number;
  students: number;
  toReview: number;
  coursesWithReview: CourseCardModel[];
  next: NextDelivery | null;
}

export interface ClassroomLandingModel {
  academicYear: string;
  period: string | null;
  courses: CourseCardModel[];
  pending: PendingReview[];
  summary: ClassroomSummary;
}

interface RawAssignment {
  id: number;
  title: string;
  subject?: string;
  course?: string;
  dueAt?: string | Date | null;
  status?: string;
}

interface RawSubmission {
  id: number;
  assignmentId: number;
  studentName?: string;
  submittedAt?: string | Date | null;
  grade?: number | null;
}

const toDate = (value: unknown): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Diferencia en días de calendario (no en horas) entre hoy y la fecha. */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Mié 28 oct" */
export function formatShortDay(date: Date): string {
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Miércoles 28 de octubre" */
export function formatLongDay(date: Date): string {
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

/** Etiqueta compacta para el resumen: "Hoy", "Mañana", "4 días". */
export function formatDaysShort(days: number): string {
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `${days} días`;
}

/** Etiqueta relativa para tarjetas: "Hoy", "Mañana", "En 4 días". */
export function formatDaysIn(days: number): string {
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

/** Tiempo transcurrido en minúsculas: "hace 3 h", "ayer", "el 12 oct". */
export function formatAgo(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = calendarDaysBetween(date, now);
  if (days <= 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return `el ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatLastSubmission(date: Date | null, now: Date = new Date()): string {
  return date ? `Última entrega ${formatAgo(date, now)}` : 'Sin actividad reciente';
}

const isDraft = (assignment: RawAssignment) => /^borrador$/i.test(assignment.status ?? '');

/** Asignatura con más actividades del curso; empates por orden de aparición. */
function dominantSubject(assignments: RawAssignment[]): string | null {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (a.subject) counts.set(a.subject, (counts.get(a.subject) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [subject, count] of Array.from(counts)) {
    if (count > bestCount) {
      best = subject;
      bestCount = count;
    }
  }
  return best;
}

function resolvePeriod(data: any, now: Date): { academicYear: string; period: string | null } {
  const periods: any[] = data?.academicPeriods ?? [];
  const active =
    periods.find((p) => p?.status === 'Activo' || p?.status === 'ACTIVE') ??
    periods.find((p) => {
      const start = toDate(p?.startDate);
      const end = toDate(p?.endDate);
      return start && end && start <= now && now <= end;
    }) ??
    null;
  const start = toDate(active?.startDate);
  const academicYear = String(
    start?.getUTCFullYear() ?? data?.school?.academicYear ?? now.getFullYear()
  );
  return { academicYear, period: active?.name ?? null };
}

export function buildClassroomLanding(data: any, now: Date = new Date()): ClassroomLandingModel {
  const assignments: RawAssignment[] = data?.assignments ?? [];
  const submissions: RawSubmission[] = data?.submissions ?? [];
  const students: any[] = data?.students ?? [];
  const subjects: any[] = data?.subjects ?? [];
  const today = startOfDay(now);

  // Mismo origen de cursos que adaptEduCoreCourses para que los ids coincidan
  const rawCourses: any[] = data?.courses?.length
    ? data.courses
    : Array.from(new Set(assignments.map((a) => a.course).filter(Boolean))).map((name) => ({ name }));

  const submissionsByAssignment = new Map<number, RawSubmission[]>();
  for (const s of submissions) {
    const list = submissionsByAssignment.get(s.assignmentId);
    if (list) list.push(s);
    else submissionsByAssignment.set(s.assignmentId, [s]);
  }

  const pending: PendingReview[] = [];

  const courses = rawCourses.map((raw): CourseCardModel => {
    const group: string = raw.name;
    const id = courseKey(raw);
    const published = assignments.filter((a) => a.course === group && !isDraft(a));
    const enrolled = students.filter((s) => s?.course === group).length;
    const subject =
      dominantSubject(published) ??
      subjects.find((s) => s?.course === group && s?.teacherName && s.teacherName === raw.teacherName)
        ?.name ??
      DEFAULT_SUBJECT;

    let toReview = 0;
    let lastSubmissionAt: Date | null = null;
    let next: NextDelivery | null = null;
    let open = 0;

    for (const assignment of published) {
      const subs = submissionsByAssignment.get(assignment.id) ?? [];
      for (const s of subs) {
        const at = toDate(s.submittedAt);
        if (at && (!lastSubmissionAt || at > lastSubmissionAt)) lastSubmissionAt = at;
        if (s.grade == null) {
          toReview += 1;
          pending.push({
            id: String(s.id),
            courseId: id,
            assignmentId: assignment.id,
            studentName: s.studentName ?? 'Estudiante',
            initials: initialsOf(s.studentName ?? ''),
            activity: assignment.title,
            courseLabel: `${assignment.subject ?? subject} ${group}`,
            submittedAt: at,
          });
        }
      }

      const dueAt = toDate(assignment.dueAt);
      if (!dueAt || dueAt < today) continue;
      open += 1;
      if (!next || dueAt < next.dueAt) {
        next = {
          assignmentId: assignment.id,
          title: assignment.title,
          dueAt,
          daysLeft: calendarDaysBetween(now, dueAt),
          submitted: new Set(subs.map((s) => s.studentName)).size,
        };
      }
    }

    return {
      id,
      group,
      subject,
      students: enrolled || Number(raw.studentsCount ?? raw.studentCount ?? 0),
      state: open > 0 ? 'active' : published.length > 0 ? 'idle' : 'empty',
      open,
      toReview,
      next,
      lastSubmissionAt,
    };
  });

  pending.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  const next = courses.reduce<NextDelivery | null>(
    (best, c) => (c.next && (!best || c.next.dueAt < best.dueAt) ? c.next : best),
    null
  );

  return {
    ...resolvePeriod(data, now),
    courses,
    pending,
    summary: {
      courses: courses.length,
      students: courses.reduce((sum, c) => sum + c.students, 0),
      toReview: pending.length,
      coursesWithReview: courses.filter((c) => c.toReview > 0),
      next,
    },
  };
}

/** Nota bajo "Por revisar": en qué cursos están las entregas pendientes. */
export function describeReviewScope(summary: ClassroomSummary): string {
  const withReview = summary.coursesWithReview;
  if (summary.toReview === 0 || withReview.length === 0) return 'Todo al día';
  if (withReview.length === 1) return `en ${withReview[0].subject} ${withReview[0].group}`;
  return `en ${withReview.length} cursos`;
}

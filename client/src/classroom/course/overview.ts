import type { Activity } from '../types';
import { calendarDaysBetween } from '../landing/courses';

/**
 * Modelo del "Resumen" de un curso: solo lo que exige una acción del docente
 * (entregas sin calificar) y lo que viene después (entregas abiertas).
 * Sin dependencias de React para poder probarse aislado.
 */

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface ReviewItem {
  activity: Activity;
  pending: number;
  dueAt: Date | null;
}

export interface UpcomingItem {
  activity: Activity;
  dueAt: Date;
  daysLeft: number;
}

export interface CourseOverviewModel {
  toReview: ReviewItem[];
  /** Total de entregas sin calificar del curso. */
  pendingTotal: number;
  upcoming: UpcomingItem[];
}

const toDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function buildCourseOverview(activities: Activity[], now: Date = new Date()): CourseOverviewModel {
  const published = activities.filter((a) => a.status !== 'Borrador');

  const toReview = published
    .map((activity) => ({
      activity,
      pending: Math.max(0, activity.submissions - activity.graded),
      dueAt: toDate(activity.dueAt),
    }))
    .filter((item) => item.pending > 0)
    // Más entregas pendientes primero; a igual carga, la que venció antes
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)
    );

  const upcoming = published
    .map((activity) => ({ activity, dueAt: toDate(activity.dueAt) }))
    .filter((item): item is { activity: Activity; dueAt: Date } =>
      Boolean(item.dueAt && item.dueAt.getTime() >= now.getTime())
    )
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((item) => ({ ...item, daysLeft: calendarDaysBetween(now, item.dueAt) }));

  return {
    toReview,
    pendingTotal: toReview.reduce((sum, item) => sum + item.pending, 0),
    upcoming,
  };
}

/** "oct" */
export function formatMonthShort(date: Date): string {
  return MONTHS_SHORT[date.getMonth()];
}

/** "23:59" */
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "13 sep" */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Viernes · 23:59" */
export function formatWeekdayTime(date: Date): string {
  return `${DAYS_LONG[date.getDay()]} · ${formatTime(date)}`;
}

/** Contexto de fecha de una actividad por revisar: "Venció el 16 sep", "Cierra mañana". */
export function describeDue(dueAt: Date | null, now: Date = new Date()): string | null {
  if (!dueAt) return null;
  const days = calendarDaysBetween(now, dueAt);
  if (dueAt.getTime() < now.getTime()) {
    if (days === 0) return 'Venció hoy';
    if (days === -1) return 'Venció ayer';
    return `Venció el ${formatDayMonth(dueAt)}`;
  }
  if (days === 0) return 'Cierra hoy';
  if (days === 1) return 'Cierra mañana';
  return `Cierra en ${days} días`;
}

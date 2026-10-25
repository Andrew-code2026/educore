import type { Activity } from '../types';

/**
 * Modelo de la pestaña "Actividades" de un curso: filtros por estado, búsqueda y
 * orden. Sin dependencias de React para poder probarse aislado.
 */

export const ACTIVITY_FILTERS = ['Todas', 'Abiertas', 'Por revisar', 'Cerradas', 'Borradores'] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export const ACTIVITY_SORTS = [
  { value: 'fecha', label: 'Fecha límite' },
  { value: 'pendientes', label: 'Por revisar' },
  { value: 'nombre', label: 'Nombre' },
] as const;
export type ActivitySort = (typeof ACTIVITY_SORTS)[number]['value'];

/** Estado tal como lo lee el docente; agrupa los estados internos que significan lo mismo. */
export type ActivityPhase = 'open' | 'review' | 'closed' | 'draft';

export const PHASE_LABEL: Record<ActivityPhase, string> = {
  open: 'Abierta',
  review: 'Por revisar',
  closed: 'Cerrada',
  draft: 'Borrador',
};

export const pendingOf = (activity: Activity) => Math.max(0, activity.submissions - activity.graded);

export function phaseOf(activity: Activity): ActivityPhase {
  if (activity.status === 'Borrador') return 'draft';
  if (activity.status === 'Cerrada') return 'closed';
  if (activity.status === 'Por revisar') return 'review';
  return 'open';
}

/** Una actividad abierta también cuenta en "Por revisar" si ya tiene entregas sin calificar. */
function matchesFilter(activity: Activity, filter: ActivityFilter): boolean {
  const phase = phaseOf(activity);
  switch (filter) {
    case 'Todas':
      return true;
    case 'Abiertas':
      return phase === 'open';
    case 'Por revisar':
      return pendingOf(activity) > 0;
    case 'Cerradas':
      return phase === 'closed';
    case 'Borradores':
      return phase === 'draft';
  }
}

export function countByFilter(activities: Activity[]): Record<ActivityFilter, number> {
  const counts = Object.fromEntries(ACTIVITY_FILTERS.map((f) => [f, 0])) as Record<ActivityFilter, number>;
  for (const activity of activities) {
    for (const filter of ACTIVITY_FILTERS) {
      if (matchesFilter(activity, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

const dueTime = (activity: Activity) => {
  const time = activity.dueAt ? new Date(activity.dueAt).getTime() : NaN;
  return Number.isNaN(time) ? null : time;
};

/**
 * Por fecha: primero lo que sigue abierto (lo que vence antes arriba) y después
 * lo ya vencido (lo más reciente arriba). Sin fecha, al final.
 */
function compareByDue(a: Activity, b: Activity, now: number): number {
  const ta = dueTime(a);
  const tb = dueTime(b);
  if (ta === null || tb === null) return (ta === null ? 1 : 0) - (tb === null ? 1 : 0);
  const aOpen = ta >= now;
  const bOpen = tb >= now;
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  return aOpen ? ta - tb : tb - ta;
}

export function selectActivities(
  activities: Activity[],
  { filter, query, sort }: { filter: ActivityFilter; query: string; sort: ActivitySort },
  now: Date = new Date()
): Activity[] {
  const q = query.trim().toLocaleLowerCase('es');
  const result = activities.filter(
    (a) => matchesFilter(a, filter) && (!q || a.name.toLocaleLowerCase('es').includes(q))
  );

  return result.sort((a, b) => {
    if (sort === 'nombre') return a.name.localeCompare(b.name, 'es');
    if (sort === 'pendientes') return pendingOf(b) - pendingOf(a) || compareByDue(a, b, now.getTime());
    return compareByDue(a, b, now.getTime());
  });
}

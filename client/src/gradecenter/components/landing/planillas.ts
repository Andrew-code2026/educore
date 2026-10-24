import { computeDatasetMetrics, type GradebookAssignment } from "../../domain/assignments";
import { formatGrade, normalizeText, pluralize } from "../../lib/format";

/**
 * Modelo de presentación de "Mis planillas": deriva estado, orden, filtros y
 * resumen del periodo a partir de las asignaciones reales del docente.
 * Sin dependencias de React para poder probarse de forma aislada.
 */

/** Umbral visual de alerta del promedio de una planilla (escala 0–5). */
export const LOW_AVERAGE_THRESHOLD = 3;

export type PlanillaEstado = "progreso" | "nueva" | "completa";
export type PlanillaFilter = "todas" | PlanillaEstado;
export type PlanillaSortKey = "planilla" | "pct" | "pend" | "prom";
export type SortDir = "asc" | "desc";
export type PlanillasLayout = "grid" | "list";

export interface PlanillaSort {
  key: PlanillaSortKey;
  dir: SortDir;
}

export interface Planilla {
  id: string;
  assignment: GradebookAssignment;
  materia: string;
  grupo: string;
  estado: PlanillaEstado;
  students: number;
  evaluations: number;
  progressPct: number;
  gradedCells: number;
  totalCells: number;
  pending: number;
  average: number | null;
  isLow: boolean;
  lastActivityAt: Date | null;
}

export const ESTADO_META: Record<PlanillaEstado, { label: string; rank: number }> = {
  progreso: { label: "En progreso", rank: 0 },
  nueva: { label: "Sin iniciar", rank: 1 },
  completa: { label: "Completa", rank: 2 },
};

export const FILTERS: ReadonlyArray<{ id: PlanillaFilter; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "progreso", label: "En progreso" },
  { id: "nueva", label: "Sin iniciar" },
  { id: "completa", label: "Completas" },
];

export const DEFAULT_SORT: PlanillaSort = { key: "pend", dir: "desc" };

export function estadoOf(evaluations: number, progressPct: number): PlanillaEstado {
  if (evaluations === 0) return "nueva";
  return progressPct >= 100 ? "completa" : "progreso";
}

export function toPlanilla(assignment: GradebookAssignment): Planilla {
  const metrics = assignment.metrics ?? computeDatasetMetrics(assignment.dataset);
  const average = metrics.average ?? null;
  return {
    id: assignment.id,
    assignment,
    materia: assignment.dataset.subject,
    grupo: assignment.dataset.course,
    estado: estadoOf(metrics.evaluationsCount, metrics.progressPct),
    students: metrics.studentsCount,
    evaluations: metrics.evaluationsCount,
    progressPct: metrics.progressPct,
    gradedCells: metrics.gradedCells,
    totalCells: metrics.totalCells,
    pending: metrics.pendingCells,
    average,
    isLow: average !== null && average < LOW_AVERAGE_THRESHOLD,
    lastActivityAt: assignment.lastActivityAt ?? null,
  };
}

/* ── Orden ─────────────────────────────────────────────────────────────── */

/** "11-2" → [11, 2]; los grados mayores van primero y luego la sección. */
function groupParts(grupo: string): [number, number] {
  const [grade, section] = grupo.split(/[-\s°]+/).map((part) => parseInt(part, 10));
  return [Number.isFinite(grade) ? grade : 0, Number.isFinite(section) ? section : 0];
}

type Comparator = (a: Planilla, b: Planilla) => number;

const SORT_COMPARATORS: Record<PlanillaSortKey, Comparator> = {
  planilla: (a, b) => {
    const [gradeA, sectionA] = groupParts(a.grupo);
    const [gradeB, sectionB] = groupParts(b.grupo);
    return a.materia.localeCompare(b.materia, "es") || gradeB - gradeA || sectionA - sectionB;
  },
  pct: (a, b) => a.progressPct - b.progressPct,
  // Las planillas sin evaluaciones no tienen pendientes reales: siempre al final.
  pend: (a, b) => (a.estado === "nueva" ? -1 : a.pending) - (b.estado === "nueva" ? -1 : b.pending),
  prom: (a, b) => (a.average ?? -1) - (b.average ?? -1),
};

export const SORT_COLUMNS: ReadonlyArray<{
  key: PlanillaSortKey;
  label: string;
  align: "start" | "end";
  firstDir: SortDir;
  dirLabels: [asc: string, desc: string];
}> = [
  { key: "planilla", label: "Planilla", align: "start", firstDir: "asc", dirLabels: ["A–Z", "Z–A"] },
  { key: "pct", label: "Calificado", align: "start", firstDir: "desc", dirLabels: ["menor a mayor", "mayor a menor"] },
  { key: "pend", label: "Pendientes", align: "end", firstDir: "desc", dirLabels: ["menor a mayor", "mayor a menor"] },
  { key: "prom", label: "Promedio", align: "end", firstDir: "desc", dirLabels: ["menor a mayor", "mayor a menor"] },
];

export function sortPlanillas(planillas: Planilla[], sort: PlanillaSort): Planilla[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const compare = SORT_COMPARATORS[sort.key];
  return [...planillas].sort((a, b) => {
    if (sort.key === "prom" && (a.average === null) !== (b.average === null)) {
      return a.average === null ? 1 : -1;
    }
    return sign * compare(a, b) || ESTADO_META[a.estado].rank - ESTADO_META[b.estado].rank;
  });
}

/** Primer clic en una columna usa su dirección natural; los siguientes la alternan. */
export function nextSort(current: PlanillaSort, key: PlanillaSortKey): PlanillaSort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  const column = SORT_COLUMNS.find((item) => item.key === key);
  return { key, dir: column?.firstDir ?? "desc" };
}

/* ── Filtros ───────────────────────────────────────────────────────────── */

export function matchesQuery(planilla: Planilla, query: string): boolean {
  const needle = normalizeText(query.trim());
  if (!needle) return true;
  const haystack = normalizeText(`${planilla.materia} ${planilla.grupo} ${planilla.grupo.replace("-", "")}`);
  return haystack.includes(needle);
}

export function countByFilter(planillas: Planilla[]): Record<PlanillaFilter, number> {
  const counts: Record<PlanillaFilter, number> = { todas: planillas.length, progreso: 0, nueva: 0, completa: 0 };
  for (const planilla of planillas) counts[planilla.estado] += 1;
  return counts;
}

export function describeResults(shown: number, total: number, sort: PlanillaSort): string {
  const column = SORT_COLUMNS.find((item) => item.key === sort.key) ?? SORT_COLUMNS[0];
  const count = shown === total ? `${total} ${pluralize(total, "planilla", "planillas")}` : `${shown} de ${total} planillas`;
  const direction = column.dirLabels[sort.dir === "asc" ? 0 : 1];
  return `${count} · ordenadas por ${column.label.toLowerCase()} (${direction})`;
}

/* ── Resumen del periodo ───────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export interface PeriodSummary {
  progressPct: number;
  pending: number;
  sheetsWithPending: number;
  closing: { daysLeft: number; date: Date } | null;
}

export function summarizePeriod(planillas: Planilla[], now: Date = new Date()): PeriodSummary {
  let graded = 0;
  let total = 0;
  let pending = 0;
  let sheetsWithPending = 0;
  let upcoming: Date | null = null;
  let lastPast: Date | null = null;
  const today = startOfDay(now);

  for (const planilla of planillas) {
    graded += planilla.gradedCells;
    total += planilla.totalCells;
    pending += planilla.pending;
    if (planilla.pending > 0) sheetsWithPending += 1;

    const endsAt = planilla.assignment.periodEndsAt;
    if (!endsAt) continue;
    if (startOfDay(endsAt) >= today) {
      if (!upcoming || endsAt < upcoming) upcoming = endsAt;
    } else if (!lastPast || endsAt > lastPast) {
      lastPast = endsAt;
    }
  }

  // El cierre más próximo; si todos los periodos ya cerraron, el más reciente.
  const closingDate = upcoming ?? lastPast;

  return {
    progressPct: total > 0 ? Math.round((graded / total) * 100) : 0,
    pending,
    sheetsWithPending,
    closing: closingDate
      ? { daysLeft: Math.round((startOfDay(closingDate).getTime() - today.getTime()) / DAY_MS), date: closingDate }
      : null,
  };
}

/* ── Formato ───────────────────────────────────────────────────────────── */

/** Textos de una planilla compartidos por la vista de tarjetas y la de lista. */
export function planillaCopy(planilla: Planilla) {
  const isNew = planilla.estado === "nueva";
  const name = `${planilla.materia} ${planilla.grupo}`;
  return {
    name,
    meta: `${planilla.students} ${pluralize(planilla.students, "estudiante", "estudiantes")} · ${planilla.evaluations} ${pluralize(planilla.evaluations, "evaluación", "evaluaciones")}`,
    pending: isNew ? "—" : String(planilla.pending),
    pendingNote: isNew ? "Sin evaluaciones" : planilla.pending === 0 ? "Todo registrado" : "Notas por registrar",
    average: formatGrade(planilla.average),
    averageNote:
      planilla.average === null ? "Sin notas aún" : planilla.isLow ? `Por debajo de ${LOW_AVERAGE_THRESHOLD.toFixed(1)}` : "Sobre 5.0",
    progressLabel: `Calificado ${name}`,
    action: isNew ? "Crear evaluación" : "Abrir planilla",
    actionLabel: isNew ? `Crear evaluación en ${name}` : `Abrir planilla de ${name}`,
  };
}

export function formatDaysLeft(days: number): string {
  if (days < 0) return "Finalizado";
  if (days === 0) return "Hoy";
  return `${days} ${pluralize(days, "día", "días")}`;
}

const closingDateFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

/** "Jueves 29 de octubre". */
export function formatClosingDate(date: Date): string {
  const parts = Object.fromEntries(closingDateFormat.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = parts.weekday ?? "";
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${parts.day} de ${parts.month}`;
}

/** "Editada hace 2 h", "Editada ayer", "Editada hace 1 semana"… */
export function formatLastActivity(date: Date | null, now: Date = new Date()): string {
  if (!date) return "Sin actividad";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "Editada hace un momento";
  if (minutes < 60) return `Editada hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Editada hace ${hours} h`;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  if (days <= 1) return "Editada ayer";
  if (days < 7) return `Editada hace ${days} días`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Editada hace ${weeks} ${pluralize(weeks, "semana", "semanas")}`;
  }
  const months = Math.floor(days / 30);
  return `Editada hace ${months} ${pluralize(months, "mes", "meses")}`;
}

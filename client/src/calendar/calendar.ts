/**
 * Modelo de presentación del Calendario institucional: normaliza los eventos del
 * snapshot, arma la cuadrícula mensual (semana de lunes a domingo) y resume lo
 * que viene. Sin dependencias de React para poder probarse de forma aislada.
 * Todas las fechas se interpretan en la zona horaria local del navegador.
 */

export const LOCALE = "es-CO";
/** Ventana del resumen y de "Próximos eventos". */
export const UPCOMING_WINDOW_DAYS = 30;
export const UPCOMING_LIMIT = 5;
/** Eventos visibles por celda antes de "+N más". */
export const CELL_EVENT_LIMIT = 2;

export type EventKind = "evaluation" | "meeting" | "activity" | "institutional";

/** Tipos que acepta `educore.createEvent`, con la categoría visual de cada uno. */
export const EVENT_TYPES = [
  { value: "Examen", kind: "evaluation", label: "Evaluación" },
  { value: "Reunión", kind: "meeting", label: "Reunión" },
  { value: "Actividad institucional", kind: "activity", label: "Actividad" },
  { value: "Institucional", kind: "institutional", label: "Institucional" },
] as const satisfies ReadonlyArray<{
  value: string;
  kind: EventKind;
  label: string;
}>;

export type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

export const KIND_LABEL: Record<EventKind, string> = Object.fromEntries(
  EVENT_TYPES.map(({ kind, label }) => [kind, label]),
) as Record<EventKind, string>;

/** Evento tal como llega en `snapshot.events`. */
export interface RawEvent {
  id: number;
  title: string;
  type: string;
  eventDate: Date | string;
  location?: string | null;
  audience?: string | null;
}

export interface CalendarEvent {
  id: number;
  title: string;
  kind: EventKind;
  /** Tipo original ("Actividad institucional"). */
  type: string;
  date: Date;
  /** "2026-09-17" */
  dayKey: string;
  /** "8:00 a. m." */
  time: string;
  location: string | null;
  audience: string | null;
}

export interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface YearMonth {
  year: number;
  /** 0–11 */
  month: number;
}

export interface UpcomingSummary {
  total: number;
  evaluations: number;
  next: CalendarEvent | null;
  /** Días hasta el próximo evento (0 = hoy). */
  nextInDays: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-09-17" → fecha local a medianoche. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function yearMonthOf(date: Date): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Días completos entre dos fechas, ignorando la hora. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Clasifica el tipo libre guardado en la base de datos. */
export function kindOf(type: string): EventKind {
  const value = normalize(type);
  if (/examen|evaluacion|quiz|prueba/.test(value)) return "evaluation";
  if (/reunion|asamblea|entrevista/.test(value)) return "meeting";
  if (/actividad|feria|salida|celebracion|izada/.test(value)) return "activity";
  return "institutional";
}

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
});

export function normalizeEvents(raw: ReadonlyArray<RawEvent> | null | undefined): CalendarEvent[] {
  return (raw ?? [])
    .map((event) => ({ event, date: new Date(event.eventDate) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .map(({ event, date }) => ({
      id: event.id,
      title: event.title.trim(),
      kind: kindOf(event.type),
      type: event.type,
      date,
      dayKey: toDayKey(date),
      time: timeFormat.format(date),
      location: event.location?.trim() || null,
      audience: event.audience?.trim() || null,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title, LOCALE));
}

export function groupByDay(events: ReadonlyArray<CalendarEvent>): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDay.get(event.dayKey);
    if (list) list.push(event);
    else byDay.set(event.dayKey, [event]);
  }
  return byDay;
}

/** Semanas (lunes a domingo) que cubren el mes, con los días vecinos para completar filas. */
export function buildMonthGrid({ year, month }: YearMonth, today: Date): DayCell[][] {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((leading + daysInMonth) / 7);
  const todayKey = toDayKey(today);

  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(year, month, 1 - leading + week * 7 + weekday);
      const key = toDayKey(date);
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: key === todayKey,
        isWeekend: weekday >= 5,
      };
    }),
  );
}

/** Eventos desde hoy (inclusive) dentro de la ventana indicada. */
export function upcomingEvents(
  events: ReadonlyArray<CalendarEvent>,
  now: Date,
  windowDays = UPCOMING_WINDOW_DAYS,
): CalendarEvent[] {
  const from = startOfDay(now).getTime();
  const to = addDays(startOfDay(now), windowDays + 1).getTime();
  return events.filter((event) => event.date.getTime() >= from && event.date.getTime() < to);
}

export function summarizeUpcoming(events: ReadonlyArray<CalendarEvent>, now: Date): UpcomingSummary {
  const upcoming = upcomingEvents(events, now);
  const next = upcoming[0] ?? null;
  return {
    total: upcoming.length,
    evaluations: upcoming.filter((event) => event.kind === "evaluation").length,
    next,
    nextInDays: next ? daysBetween(now, next.date) : null,
  };
}

/* ── Textos ───────────────────────────────────────────── */

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Septiembre 2026" */
export function formatMonthTitle({ year, month }: YearMonth): string {
  return capitalize(
    new Date(year, month, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" }).replace(" de ", " "),
  );
}

/** "Jueves 17 de septiembre" */
export function formatLongDay(date: Date): string {
  return capitalize(
    date
      .toLocaleDateString(LOCALE, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .replace(",", ""),
  );
}

/** "sept." */
export function formatShortMonth(date: Date): string {
  return date.toLocaleDateString(LOCALE, { month: "short" });
}

/** "Hoy", "Mañana", "En 3 días", "Ayer", "Hace 2 días" */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}

/** Nombres de los días de lunes a domingo: corto para la cabecera, largo para lectores de pantalla. */
export const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"].map((long) => ({
  long,
  short: capitalize(long.slice(0, 3)),
}));

/* ── Formulario ───────────────────────────────────────── */

export interface EventDraft {
  title: string;
  type: EventTypeValue;
  /** "2026-09-17" */
  day: string;
  /** "08:00" */
  time: string;
  location: string;
  audience: string;
}

export type DraftErrors = Partial<Record<keyof EventDraft, string>>;

export function emptyDraft(day: string): EventDraft {
  return {
    title: "",
    type: "Examen",
    day,
    time: "08:00",
    location: "",
    audience: "Todo el colegio",
  };
}

export function validateDraft(draft: EventDraft): DraftErrors {
  const errors: DraftErrors = {};
  const title = draft.title.trim();
  if (title.length < 3) errors.title = "Escribe un título de al menos 3 caracteres.";
  else if (title.length > 180) errors.title = "El título no puede superar 180 caracteres.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.day)) errors.day = "Elige una fecha.";
  if (!/^\d{2}:\d{2}$/.test(draft.time)) errors.time = "Elige una hora.";
  if (draft.audience.trim().length < 2) errors.audience = "Indica a quién va dirigido.";
  return errors;
}

/** Fecha y hora locales del formulario → `Date`. */
export function draftDate(draft: Pick<EventDraft, "day" | "time">): Date {
  const [hours, minutes] = draft.time.split(":").map(Number);
  const date = parseDayKey(draft.day);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

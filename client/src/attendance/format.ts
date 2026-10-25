/** Formateo en español para el Panel de Asistencia. */
import { fromISODate } from "./data/dateUtils";

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const SHORT_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

const WEEKDAY_SHORT = new Intl.DateTimeFormat("es-CO", { weekday: "short" });

const TIME =new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "viernes, 2 de octubre" (con la primera letra en mayúscula). */
export function formatLongDate(iso: string): string {
  const text = LONG_DATE.format(fromISODate(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "2 oct" */
export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(fromISODate(iso)).replace(".", "");
}

/** "sáb 26 oct" */
export function formatWeekdayDate(iso: string): string {
  const weekday = WEEKDAY_SHORT.format(fromISODate(iso)).replace(".", "");
  return `${weekday} ${formatShortDate(iso)}`;
}

export function formatClock(date: Date): string {
  return TIME.format(date);
}

/** "hace 12 s", "hace 3 min" */
export function relativeFromNow(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

export function percent(value: number): string {
  return `${Math.round(value)}%`;
}

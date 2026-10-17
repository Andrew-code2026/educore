import { format, parseISO } from "date-fns";

/** Convierte una fecha local a YYYY-MM-DD sin introducir un desplazamiento UTC. */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Interpreta YYYY-MM-DD como fecha local de calendario. */
export function fromISODate(value: string): Date {
  return parseISO(value);
}

/** Convierte de forma determinista una fecha UTC o string ISO a YYYY-MM-DD evitando desfases de zona horaria. */
export function toUtcDateIso(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const prefix = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(prefix)) {
      return prefix;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

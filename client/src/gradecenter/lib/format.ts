import type { Student } from "../types";

export function formatGrade(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${Math.abs(value).toFixed(1)}`;
}

export function formatCompactGrade(value: number | null | undefined): string {
  if (value == null) return "–";
  return value.toFixed(1);
}

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const LONG_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export function formatShortDate(iso: string): string {
  if (!iso) return "Sin fecha";
  const date = parseIso(iso);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

export function formatLongDate(iso: string): string {
  if (!iso) return "Sin fecha definida";
  const date = parseIso(iso);
  return `${date.getUTCDate()} de ${LONG_MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

export function initials(student: Student): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

/** Búsqueda insensible a mayúsculas y tildes. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Abreviación inteligente: recorta por palabras completas antes de cortar
 * caracteres, para que un encabezado estrecho siga siendo legible.
 */
export function abbreviateToWidth(text: string, width: number, minChars = 3): string {
  const clean = text.trim();
  if (clean.length <= width) return clean;

  const words = clean.split(/\s+/);
  if (words.length > 1) {
    let acc = "";
    for (const word of words) {
      const candidate = acc ? `${acc} ${word}` : word;
      if (candidate.length > width) break;
      acc = candidate;
    }
    if (acc.length >= Math.max(minChars, 3)) {
      return acc === clean ? acc : `${acc}…`;
    }
  }

  const cut = Math.max(minChars, width - 1);
  return `${clean.slice(0, cut).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function studentDisplayName(student: Student, maxWidth: number): string {
  const full = student.fullName;
  if (full.length <= maxWidth) return full;
  const firstAndSurname = `${student.firstName} ${student.lastName.split(" ")[0]}`;
  if (firstAndSurname.length <= maxWidth) return firstAndSurname;
  if (maxWidth <= 12) {
    return `${student.firstName.slice(0, 6)}. ${student.lastName.charAt(0)}.`;
  }
  return abbreviateToWidth(full, maxWidth);
}

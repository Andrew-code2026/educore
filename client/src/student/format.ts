/**
 * Formatos del portal estudiante (es-CO). Sin React para poder probarse aislados.
 * Las notas y plurales reutilizan los helpers de las portadas docentes.
 */
export { formatGrade, initialsOf, plural } from "@/analytics/landing";

const DAY_MS = 86_400_000;
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

export const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Días de calendario entre hoy y la fecha: 0 = hoy, 1 = mañana, -1 = ayer. */
export function dayDiff(value: Date | string, now: Date = new Date()): number {
  return Math.round((startOfDay(toDate(value)) - startOfDay(now)) / DAY_MS);
}

/** "jue 13 nov" */
export function formatShortDate(value: Date | string): string {
  const date = toDate(value);
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "13 nov" */
export function formatDayMonth(value: Date | string): string {
  const date = toDate(value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "jueves 13 de noviembre" */
export function formatLongDate(value: Date | string): string {
  const date = toDate(value);
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

/** "11:59 p. m." con el formato colombiano. */
export function formatTime(value: Date | string): string {
  return toDate(value).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Partes de la insignia de fecha: { month: "NOV", day: 13 } */
export function dateBadge(value: Date | string): { month: string; day: number } {
  const date = toDate(value);
  return { month: MONTHS_SHORT[date.getMonth()].toUpperCase(), day: date.getDate() };
}

/** "Vence hoy" · "Vence mañana" · "Vence en 3 días" · "Venció ayer" · "Venció hace 4 días" */
export function formatDue(value: Date | string, now: Date = new Date()): string {
  const days = dayDiff(value, now);
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  if (days > 1) return days <= 6 ? `Vence en ${days} días` : `Vence el ${formatShortDate(value)}`;
  if (days === -1) return "Venció ayer";
  return `Venció hace ${-days} días`;
}

/** "Hoy" · "Ayer" · "Hace 3 días" · "12 nov" */
export function formatAgo(value: Date | string, now: Date = new Date()): string {
  const days = -dayDiff(value, now);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return formatDayMonth(value);
}

/** Chip de fecha del encabezado: "Martes 11 de noviembre". */
export function formatToday(now: Date = new Date()): string {
  return capitalize(formatLongDate(now));
}

export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

/** "Sofía Martínez" → "Sofía" */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Iniciales de materia para la burbuja: "Lengua Castellana" → "LC", "Química" → "QU". */
export function subjectInitials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}

/** Tamaño legible: 2.4 MB, 820 KB */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

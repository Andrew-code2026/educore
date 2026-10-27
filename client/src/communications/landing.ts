/**
 * Modelo de presentación de "Comunicaciones": normaliza los comunicados del snapshot,
 * calcula el resumen y filtra por estado y búsqueda.
 * Sin dependencias de React para poder probarse de forma aislada.
 */
import { ANNOUNCEMENT_STATUS } from "@shared/communications";

/** Ventana para considerar un comunicado "reciente". */
export const RECENT_DAYS = 7;
const DAY_MS = 86_400_000;

/** Fila de `announcements` tal como llega en el snapshot. */
export interface AnnouncementRow {
  id: number;
  title: string;
  message: string;
  audience: string;
  status: string;
  publishedAt: string | Date;
}

export type AnnouncementStatus = "published" | "draft";
export type StatusFilter = "all" | AnnouncementStatus;

export interface AnnouncementModel {
  id: number;
  title: string;
  message: string;
  audience: string;
  status: AnnouncementStatus;
  /** ISO para `<time dateTime>`. */
  dateIso: string;
  /** "Hoy · 10:00", "Hace 3 días", "12 sept." */
  dateLabel: string;
  /** Fecha completa para el tooltip. */
  dateTitle: string;
  isRecent: boolean;
  searchText: string;
}

export interface CommunicationsSummary {
  published: number;
  drafts: number;
  /** Publicados en los últimos `RECENT_DAYS` días. */
  recent: number;
  lastPublishedLabel: string | null;
}

export interface CommunicationsModel {
  summary: CommunicationsSummary;
  announcements: AnnouncementModel[];
}

/** Capacidades de redacción; reflejan `communications.create` / `communications.send` del servidor. */
export interface ComposeAbilities {
  canCompose: boolean;
  canSend: boolean;
}

export function abilitiesFor(role: string): ComposeAbilities {
  return { canCompose: role === "admin" || role === "teacher", canSend: role === "admin" };
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
const fullFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short" });

/** "Hoy · 10:00", "Ayer · 14:30", "Hace 3 días", "12 sept." o "12 sept. 2025". */
export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return `Hoy · ${timeFormat.format(date)}`;
  if (days === 1) return `Ayer · ${timeFormat.format(date)}`;
  if (days > 1 && days < RECENT_DAYS) return `Hace ${days} días`;
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

function toStatus(raw: string): AnnouncementStatus {
  return raw === ANNOUNCEMENT_STATUS.draft ? "draft" : "published";
}

function toModel(row: AnnouncementRow, now: Date): AnnouncementModel {
  const date = new Date(row.publishedAt);
  const valid = !Number.isNaN(date.getTime());
  const status = toStatus(row.status);
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    audience: row.audience,
    status,
    dateIso: valid ? date.toISOString() : "",
    dateLabel: valid ? formatRelativeDate(date, now) : "Sin fecha",
    dateTitle: valid ? fullFormat.format(date) : "",
    isRecent: valid && status === "published" && now.getTime() - date.getTime() < RECENT_DAYS * DAY_MS,
    searchText: normalizeText(`${row.title} ${row.message} ${row.audience}`),
  };
}

export function buildCommunications(rows: AnnouncementRow[], now: Date = new Date()): CommunicationsModel {
  const announcements = rows
    .map((row) => toModel(row, now))
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || b.id - a.id);
  const published = announcements.filter((item) => item.status === "published");
  return {
    summary: {
      published: published.length,
      drafts: announcements.length - published.length,
      recent: published.filter((item) => item.isRecent).length,
      lastPublishedLabel: published[0]?.dateLabel ?? null,
    },
    announcements,
  };
}

export function filterAnnouncements(
  announcements: AnnouncementModel[],
  { status, query }: { status: StatusFilter; query: string },
): AnnouncementModel[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  return announcements.filter(
    (item) =>
      (status === "all" || item.status === status) && terms.every((term) => item.searchText.includes(term)),
  );
}

/** Separa el "**Asunto:** …" que devuelve EduCore AI del cuerpo del mensaje. */
export function parseAiDraft(text: string): { title: string | null; message: string } {
  const match = text.match(/^\s*\**\s*asunto\s*:?\s*\**\s*:?\s*(.+)$/im);
  const title = match ? match[1]!.replace(/\*+/g, "").trim() : null;
  const body = match ? text.replace(match[0], "") : text;
  return { title: title || null, message: body.replace(/\*\*(.+?)\*\*/g, "$1").trim() };
}

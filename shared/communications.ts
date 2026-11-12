/** Contrato de comunicados compartido por el servidor (validación) y el cliente (formularios). */

export const ANNOUNCEMENT_AUDIENCES = [
  "Todo el colegio",
  "Docentes",
  "Estudiantes",
  "Acudientes",
  "Acudientes de 11°",
] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_STATUS = {
  published: "Publicado",
  draft: "Borrador",
} as const;

export const ANNOUNCEMENT_TITLE_MAX = 180;
export const ANNOUNCEMENT_MESSAGE_MAX = 5000;

/** Lectores que solo reciben comunicados dirigidos a su público (o a todo el colegio). */
export type AnnouncementReader = "STUDENT" | "GUARDIAN";

const READER_AUDIENCE: Record<AnnouncementReader, string> = {
  STUDENT: "Estudiantes",
  GUARDIAN: "Acudientes",
};

export function isAudienceFor(reader: AnnouncementReader, audience: string): boolean {
  return audience === "Todo el colegio" || audience.includes(READER_AUDIENCE[reader]);
}

/**
 * Eventos del calendario para estudiantes y acudientes: los de su público, los de todo el colegio
 * y los de su curso ("11-2"). Los de otros cursos o de otros públicos no se envían.
 */
export function isEventFor(reader: AnnouncementReader, audience: string | null | undefined, course: string | null | undefined): boolean {
  const value = (audience ?? "").trim();
  if (!value) return false;
  if (isAudienceFor(reader, value)) return true;
  return Boolean(course) && value === course;
}

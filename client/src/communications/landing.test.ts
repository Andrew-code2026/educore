import { describe, expect, it } from "vitest";
import {
  abilitiesFor,
  buildCommunications,
  filterAnnouncements,
  formatRelativeDate,
  parseAiDraft,
  type AnnouncementRow,
} from "./landing";

const NOW = new Date(2026, 9, 24, 9, 0);

function row(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
  return {
    id: 1,
    title: "Actualización del calendario académico",
    message: "El cierre de periodo 2 se realizará el 23 de septiembre.",
    audience: "Todo el colegio",
    status: "Publicado",
    publishedAt: new Date(2026, 9, 22, 10, 0),
    ...overrides,
  };
}

describe("formatRelativeDate", () => {
  it("usa hoy/ayer con la hora", () => {
    expect(formatRelativeDate(new Date(2026, 9, 24, 7, 5), NOW)).toBe("Hoy · 07:05");
    expect(formatRelativeDate(new Date(2026, 9, 23, 18, 30), NOW)).toBe("Ayer · 18:30");
  });

  it("cuenta días dentro de la semana", () => {
    expect(formatRelativeDate(new Date(2026, 9, 20, 12, 0), NOW)).toBe("Hace 4 días");
  });

  it("muestra fecha corta y el año solo si cambia", () => {
    expect(formatRelativeDate(new Date(2026, 8, 12), NOW)).not.toMatch(/2026/);
    expect(formatRelativeDate(new Date(2025, 8, 12), NOW)).toMatch(/2025/);
  });
});

describe("buildCommunications", () => {
  it("ordena del más reciente al más antiguo y resume", () => {
    const model = buildCommunications(
      [
        row({ id: 1, publishedAt: new Date(2026, 9, 10) }),
        row({ id: 2, status: "Borrador", publishedAt: new Date(2026, 9, 23) }),
        row({ id: 3, publishedAt: new Date(2026, 9, 22) }),
      ],
      NOW,
    );
    expect(model.announcements.map((item) => item.id)).toEqual([2, 3, 1]);
    expect(model.summary).toMatchObject({ published: 2, drafts: 1, recent: 1, lastPublishedLabel: "Hace 2 días" });
  });

  it("sin publicados no hay último envío", () => {
    const model = buildCommunications([row({ status: "Borrador" })], NOW);
    expect(model.summary.lastPublishedLabel).toBeNull();
    expect(model.announcements[0]!.isRecent).toBe(false);
  });

  it("tolera fechas inválidas", () => {
    const model = buildCommunications([row({ publishedAt: "no-es-fecha" })], NOW);
    expect(model.announcements[0]!.dateLabel).toBe("Sin fecha");
  });
});

describe("filterAnnouncements", () => {
  const { announcements } = buildCommunications(
    [
      row({ id: 1 }),
      row({ id: 2, title: "Reunión de padres", message: "Auditorio principal", audience: "Acudientes de 11°" }),
      row({ id: 3, title: "Jornada pedagógica", status: "Borrador", audience: "Docentes" }),
    ],
    NOW,
  );

  it("filtra por estado", () => {
    expect(filterAnnouncements(announcements, { status: "draft", query: "" }).map((a) => a.id)).toEqual([3]);
    expect(filterAnnouncements(announcements, { status: "published", query: "" })).toHaveLength(2);
  });

  it("busca sin tildes ni mayúsculas en título, mensaje y audiencia", () => {
    expect(filterAnnouncements(announcements, { status: "all", query: "REUNION" }).map((a) => a.id)).toEqual([2]);
    expect(filterAnnouncements(announcements, { status: "all", query: "pedagogica docentes" }).map((a) => a.id)).toEqual([3]);
    expect(filterAnnouncements(announcements, { status: "published", query: "pedagogica" })).toHaveLength(0);
  });
});

describe("parseAiDraft", () => {
  it("separa el asunto del cuerpo y limpia el markdown", () => {
    const draft = parseAiDraft("**Asunto:** Reunión de padres\n\nEstimada **comunidad** educativa,");
    expect(draft).toEqual({ title: "Reunión de padres", message: "Estimada comunidad educativa," });
  });

  it("sin asunto devuelve todo como mensaje", () => {
    expect(parseAiDraft("Hola comunidad")).toEqual({ title: null, message: "Hola comunidad" });
  });
});

describe("abilitiesFor", () => {
  it("docentes redactan, solo el administrador envía", () => {
    expect(abilitiesFor("teacher")).toEqual({ canCompose: true, canSend: false });
    expect(abilitiesFor("admin")).toEqual({ canCompose: true, canSend: true });
    expect(abilitiesFor("guardian")).toEqual({ canCompose: false, canSend: false });
  });
});

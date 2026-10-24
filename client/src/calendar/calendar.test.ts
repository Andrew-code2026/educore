import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  daysBetween,
  draftDate,
  emptyDraft,
  formatLongDay,
  formatMonthTitle,
  formatRelativeDays,
  groupByDay,
  kindOf,
  normalizeEvents,
  summarizeUpcoming,
  toDayKey,
  upcomingEvents,
  validateDraft,
  type RawEvent,
} from "./calendar";

const NOW = new Date(2026, 8, 15, 10, 30); // martes 15 de septiembre de 2026

const raw = (id: number, type: string, date: Date, title = `Evento ${id}`): RawEvent => ({
  id,
  title,
  type,
  eventDate: date,
  location: "Aula 11-2",
  audience: "Todo el colegio",
});

describe("kindOf", () => {
  it("clasifica los tipos guardados sin importar tildes ni mayúsculas", () => {
    expect(kindOf("Examen")).toBe("evaluation");
    expect(kindOf("EVALUACIÓN")).toBe("evaluation");
    expect(kindOf("Reunión")).toBe("meeting");
    expect(kindOf("Actividad institucional")).toBe("activity");
    expect(kindOf("Institucional")).toBe("institutional");
    expect(kindOf("Otro")).toBe("institutional");
  });
});

describe("normalizeEvents", () => {
  it("ordena por fecha, descarta fechas inválidas y acepta cadenas ISO", () => {
    const events = normalizeEvents([
      raw(2, "Reunión", new Date(2026, 8, 20, 17)),
      raw(1, "Examen", new Date(2026, 8, 17, 8)),
      { ...raw(3, "Examen", NOW), eventDate: "no es fecha" },
      {
        ...raw(4, "Institucional", NOW),
        eventDate: new Date(2026, 8, 18, 9).toISOString(),
      },
    ]);
    expect(events.map((e) => e.id)).toEqual([1, 4, 2]);
    expect(events[0]).toMatchObject({
      kind: "evaluation",
      dayKey: "2026-09-17",
    });
  });

  it("convierte lugar y público vacíos en null", () => {
    const [event] = normalizeEvents([{ ...raw(1, "Examen", NOW), location: "  ", audience: null }]);
    expect(event!.location).toBeNull();
    expect(event!.audience).toBeNull();
  });

  it("tolera la ausencia de eventos", () => {
    expect(normalizeEvents(undefined)).toEqual([]);
  });
});

describe("buildMonthGrid", () => {
  it("empieza en lunes y completa semanas con días vecinos", () => {
    const weeks = buildMonthGrid({ year: 2026, month: 8 }, NOW);
    // Septiembre 2026 empieza en martes: el lunes 31 de agosto abre la cuadrícula
    expect(weeks[0]![0]).toMatchObject({
      key: "2026-08-31",
      inMonth: false,
    });
    expect(weeks[0]![1]).toMatchObject({ key: "2026-09-01", inMonth: true });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks).toHaveLength(5);
    expect(weeks.flat().filter((cell) => cell.isToday)).toHaveLength(1);
    expect(weeks[0]![5]!.isWeekend && weeks[0]![6]!.isWeekend).toBe(true);
  });

  it("usa seis semanas cuando el mes lo necesita", () => {
    // Agosto 2026 empieza en sábado y tiene 31 días
    expect(buildMonthGrid({ year: 2026, month: 7 }, NOW)).toHaveLength(6);
  });
});

describe("navegación entre meses", () => {
  it("cruza el cambio de año", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027,
      month: 0,
    });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    });
  });
});

describe("próximos eventos", () => {
  const events = normalizeEvents([
    raw(1, "Examen", new Date(2026, 8, 14, 8)), // ayer
    raw(2, "Examen", new Date(2026, 8, 15, 7)), // hoy, ya pasó la hora
    raw(3, "Reunión", new Date(2026, 8, 20, 17)),
    raw(4, "Examen", new Date(2026, 9, 15, 8)), // día 30
    raw(5, "Examen", new Date(2026, 9, 16, 8)), // fuera de la ventana
  ]);

  it("incluye hoy completo y los siguientes 30 días", () => {
    expect(upcomingEvents(events, NOW).map((e) => e.id)).toEqual([2, 3, 4]);
  });

  it("resume total, evaluaciones y el próximo evento", () => {
    const summary = summarizeUpcoming(events, NOW);
    expect(summary).toMatchObject({ total: 3, evaluations: 2, nextInDays: 0 });
    expect(summary.next!.id).toBe(2);
  });

  it("sin eventos no hay próximo", () => {
    expect(summarizeUpcoming([], NOW)).toEqual({
      total: 0,
      evaluations: 0,
      next: null,
      nextInDays: null,
    });
  });

  it("agrupa por día", () => {
    const byDay = groupByDay(events);
    expect(byDay.get("2026-09-20")!.map((e) => e.id)).toEqual([3]);
    expect(byDay.has("2026-09-16")).toBe(false);
  });
});

describe("textos", () => {
  it("formatea mes, día y distancia relativa", () => {
    expect(formatMonthTitle({ year: 2026, month: 8 })).toBe("Septiembre 2026");
    expect(formatLongDay(new Date(2026, 8, 17))).toBe("Jueves 17 de septiembre");
    expect(formatRelativeDays(0)).toBe("Hoy");
    expect(formatRelativeDays(1)).toBe("Mañana");
    expect(formatRelativeDays(5)).toBe("En 5 días");
    expect(formatRelativeDays(-2)).toBe("Hace 2 días");
  });

  it("cuenta días completos sin importar la hora", () => {
    expect(daysBetween(NOW, new Date(2026, 8, 16, 0, 5))).toBe(1);
    expect(daysBetween(NOW, new Date(2026, 8, 15, 23, 59))).toBe(0);
  });
});

describe("formulario", () => {
  it("parte de un borrador válido salvo el título", () => {
    const draft = emptyDraft(toDayKey(NOW));
    expect(Object.keys(validateDraft(draft))).toEqual(["title"]);
    expect(validateDraft({ ...draft, title: "Evaluación de Física" })).toEqual({});
  });

  it("señala fecha, hora y público faltantes", () => {
    const errors = validateDraft({
      ...emptyDraft(""),
      title: "  ab ",
      time: "",
      audience: " ",
    });
    expect(Object.keys(errors).sort()).toEqual(["audience", "day", "time", "title"]);
  });

  it("combina fecha y hora locales", () => {
    const date = draftDate({ day: "2026-09-17", time: "14:45" });
    expect(toDayKey(date)).toBe("2026-09-17");
    expect([date.getHours(), date.getMinutes()]).toEqual([14, 45]);
  });
});

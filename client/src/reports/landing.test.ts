import { describe, expect, it } from "vitest";
import type { PlanillaInput } from "@/analytics/landing";
import { buildReportsLanding, formatGeneratedAt, reportCardProgress, type ReportCardInput } from "./landing";

const NOW = new Date(2026, 9, 24, 9, 0);

function planilla(overrides: Partial<PlanillaInput> = {}): PlanillaInput {
  return {
    courseId: 6,
    courseName: "11-2",
    subjectId: 1,
    subjectName: "Matemáticas",
    academicYear: "2026",
    students: 30,
    evaluations: 4,
    graded: 60,
    total: 120,
    average: 3.8,
    belowPassing: [],
    ...overrides,
  };
}

function card(overrides: Partial<ReportCardInput> = {}): ReportCardInput {
  return {
    courseId: 6,
    courseName: "11-2",
    academicYearId: 1,
    periodId: 2,
    periodName: "Periodo 2",
    students: 30,
    generated: 0,
    lastGeneratedAt: null,
    ...overrides,
  };
}

const build = (planillas: PlanillaInput[], reportCards: ReportCardInput[] = [], canGenerate = false) =>
  buildReportsLanding({ planillas, reportCards, canGenerate, now: NOW });

describe("buildReportsLanding · cursos", () => {
  it("agrupa planillas por curso con promedio ponderado por notas registradas", () => {
    const model = build([
      planilla({ subjectId: 1, average: 4.0, graded: 30 }),
      planilla({ subjectId: 2, subjectName: "Física", average: 3.0, graded: 10 }),
    ]);
    expect(model.courses).toHaveLength(1);
    expect(model.courses[0]).toMatchObject({ group: "11-2", subjects: 2, average: 3.8, tone: "ok" });
    expect(model.courses[0]!.lowestSubject).toEqual({ name: "Física", average: 3.0 });
  });

  it("ordena del promedio más bajo al más alto y separa los cursos sin notas", () => {
    const model = build([
      planilla({ courseId: 1, courseName: "11-1", average: 3.6 }),
      planilla({ courseId: 2, courseName: "10-1", average: null, graded: 0 }),
      planilla({ courseId: 3, courseName: "9-1", average: 2.7 }),
    ]);
    expect(model.courses.map((c) => c.group)).toEqual(["9-1", "11-1"]);
    expect(model.courses.map((c) => c.tone)).toEqual(["low", "ok"]);
    expect(model.ungraded.map((c) => [c.group, c.tone])).toEqual([["10-1", "empty"]]);
  });

  it("omite la materia más baja si el curso tiene una sola materia calificada", () => {
    const model = build([planilla(), planilla({ subjectId: 2, average: null, graded: 0 })]);
    expect(model.courses[0]!.lowestSubject).toBeNull();
  });

  it("cuenta estudiantes únicos bajo la aprobatoria aunque fallen varias materias", () => {
    const below = [{ studentId: 7, name: "Daniel Torres", average: 2.9 }];
    const model = build([
      planilla({ belowPassing: below }),
      planilla({ subjectId: 2, belowPassing: [...below, { studentId: 8, name: "Ana Ruiz", average: 2.5 }] }),
    ]);
    expect(model.courses[0]!.belowPassing).toBe(2);
    expect(model.summary.belowPassing).toBe(2);
  });
});

describe("buildReportsLanding · lectura del periodo", () => {
  it("señala la brecha del curso más bajo frente al resto", () => {
    const model = build([
      planilla({ courseId: 1, courseName: "11-1", average: 3.6, graded: 40 }),
      planilla({ courseId: 1, courseName: "11-1", subjectId: 2, subjectName: "Física", average: 3.2, graded: 40 }),
      planilla({ courseId: 2, courseName: "11-2", average: 3.9, graded: 80 }),
    ]);
    expect(model.reading.kind).toBe("gap");
    expect(model.reading.title).toBe("11-1 está 0.5 puntos por debajo del resto");
    expect(model.reading.detail).toContain("Física (3.2)");
  });

  it("habla de rendimiento parejo cuando la brecha es menor al umbral", () => {
    const model = build([
      planilla({ courseId: 1, courseName: "11-1", average: 3.9 }),
      planilla({ courseId: 2, courseName: "11-2", average: 3.9 }),
    ]);
    expect(model.reading.kind).toBe("even");
  });

  it("no compara con un solo curso ni sin notas", () => {
    expect(build([planilla()]).reading.kind).toBe("single");
    expect(build([planilla({ average: null, graded: 0 })]).reading.kind).toBe("none");
    expect(build([]).reading.kind).toBe("none");
  });
});

describe("buildReportsLanding · boletines", () => {
  it("calcula el estado y ordena los pendientes primero", () => {
    const model = build(
      [],
      [
        card({ courseId: 1, courseName: "11-1", generated: 30, lastGeneratedAt: new Date(2026, 9, 24, 8) }),
        card({ courseId: 2, courseName: "11-2", generated: 12 }),
        card({ courseId: 3, courseName: "10-1", generated: 0 }),
        card({ courseId: 4, courseName: "9-1", students: 0 }),
      ],
    );
    expect(model.reportCards.map((c) => [c.group, c.status])).toEqual([
      ["10-1", "pending"],
      ["11-2", "partial"],
      ["11-1", "complete"],
    ]);
    expect(model.withoutStudents).toEqual(["9-1"]);
    expect(model.summary).toMatchObject({ reportCardsGenerated: 42, reportCardsTotal: 90 });
    expect(model.period).toBe("Periodo 2");
  });

  it("no cuenta más boletines que estudiantes", () => {
    const model = build([], [card({ students: 10, generated: 12 })]);
    expect(model.reportCards[0]).toMatchObject({ generated: 10, status: "complete" });
    expect(reportCardProgress(model.reportCards[0]!)).toBe("10 de 10 estudiantes");
  });
});

describe("formatGeneratedAt", () => {
  it("usa expresiones relativas para fechas recientes", () => {
    expect(formatGeneratedAt(new Date(2026, 9, 24, 7), NOW)).toBe("hoy");
    expect(formatGeneratedAt(new Date(2026, 9, 23, 22), NOW)).toBe("ayer");
    expect(formatGeneratedAt("2026-10-20T12:00:00", NOW)).toBe("hace 4 días");
    expect(formatGeneratedAt(new Date(2026, 8, 1), NOW)).not.toMatch(/^hace/);
  });
});

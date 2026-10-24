import { describe, expect, it } from "vitest";
import type { GradebookAssignment } from "../../domain/assignments";
import type { Dataset } from "../../types";
import {
  countByFilter,
  describeResults,
  formatClosingDate,
  formatDaysLeft,
  formatLastActivity,
  matchesQuery,
  nextSort,
  sortPlanillas,
  summarizePeriod,
  toPlanilla,
} from "./planillas";

const baseDataset: Dataset = {
  key: "fixture",
  academicYear: "2026",
  course: "11-1",
  subject: "Biología",
  group: "11-1",
  period: "Periodo 2",
  evaluationCount: 0,
  teacher: { name: "Docente", role: "Docente", initials: "DO" },
  dba: [],
  students: [],
  evaluations: [],
  grades: {},
  comments: {},
};

function assignment(
  id: string,
  subject: string,
  course: string,
  metrics: { students: number; evaluations: number; graded: number; average: number | null },
  extra: Partial<GradebookAssignment> = {},
): GradebookAssignment {
  const totalCells = metrics.students * metrics.evaluations;
  return {
    id,
    sourceDatasetKey: id,
    dataset: { ...baseDataset, key: id, subject, course },
    access: "owner",
    status: "available",
    metrics: {
      studentsCount: metrics.students,
      evaluationsCount: metrics.evaluations,
      gradedCells: metrics.graded,
      totalCells,
      pendingCells: totalCells - metrics.graded,
      progressPct: totalCells > 0 ? Math.round((metrics.graded / totalCells) * 100) : 0,
      average: metrics.average,
    },
    ...extra,
  };
}

const planillas = [
  assignment("b111", "Biología", "11-1", { students: 24, evaluations: 6, graded: 144, average: 2.9 }),
  assignment("b112", "Biología", "11-2", { students: 24, evaluations: 6, graded: 72, average: 4.3 }),
  assignment("q91", "Química", "9-1", { students: 28, evaluations: 0, graded: 0, average: null }),
  assignment("b101", "Biología", "10-1", { students: 26, evaluations: 5, graded: 104, average: 3.8 }),
].map(toPlanilla);

describe("planillas del docente", () => {
  it("deriva el estado y la alerta de promedio bajo", () => {
    expect(planillas.map((p) => p.estado)).toEqual(["completa", "progreso", "nueva", "progreso"]);
    expect(planillas[0].isLow).toBe(true);
    expect(planillas[1].isLow).toBe(false);
  });

  it("ordena por pendientes dejando las planillas sin evaluaciones al final", () => {
    const sorted = sortPlanillas(planillas, { key: "pend", dir: "desc" });
    expect(sorted.map((p) => p.id)).toEqual(["b112", "b101", "b111", "q91"]);
  });

  it("ordena por planilla: materia, grado mayor primero y sección", () => {
    const sorted = sortPlanillas(planillas, { key: "planilla", dir: "asc" });
    expect(sorted.map((p) => p.id)).toEqual(["b111", "b112", "b101", "q91"]);
  });

  it("mantiene los promedios vacíos al final en ambas direcciones", () => {
    expect(sortPlanillas(planillas, { key: "prom", dir: "asc" }).at(-1)?.id).toBe("q91");
    expect(sortPlanillas(planillas, { key: "prom", dir: "desc" }).at(-1)?.id).toBe("q91");
  });

  it("alterna la dirección o usa la natural de cada columna", () => {
    expect(nextSort({ key: "pend", dir: "desc" }, "pend")).toEqual({ key: "pend", dir: "asc" });
    expect(nextSort({ key: "pend", dir: "desc" }, "planilla")).toEqual({ key: "planilla", dir: "asc" });
  });

  it("busca sin tildes y con el grupo compacto", () => {
    expect(matchesQuery(planillas[2], "quimica")).toBe(true);
    expect(matchesQuery(planillas[1], "112")).toBe(true);
    expect(matchesQuery(planillas[1], "química")).toBe(false);
  });

  it("cuenta por estado y describe los resultados", () => {
    expect(countByFilter(planillas)).toEqual({ todas: 4, progreso: 2, nueva: 1, completa: 1 });
    expect(describeResults(4, 4, { key: "pend", dir: "desc" })).toBe("4 planillas · ordenadas por pendientes (mayor a menor)");
    expect(describeResults(1, 4, { key: "planilla", dir: "asc" })).toBe("1 de 4 planillas · ordenadas por planilla (A–Z)");
  });
});

describe("resumen del periodo", () => {
  const now = new Date(2026, 9, 24, 15, 0);

  it("agrega avance, pendientes y el cierre más próximo", () => {
    const withClosing = [
      ...planillas,
      toPlanilla(assignment("x", "Física", "9-2", { students: 1, evaluations: 0, graded: 0, average: null }, { periodEndsAt: new Date(2026, 9, 29) })),
      toPlanilla(assignment("y", "Física", "9-3", { students: 1, evaluations: 0, graded: 0, average: null }, { periodEndsAt: new Date(2026, 8, 1) })),
    ];
    const summary = summarizePeriod(withClosing, now);
    expect(summary.pending).toBe(72 + 26);
    expect(summary.sheetsWithPending).toBe(2);
    expect(summary.progressPct).toBe(Math.round((320 / 418) * 100));
    expect(summary.closing?.daysLeft).toBe(5);
    expect(formatClosingDate(summary.closing!.date)).toBe("Jueves 29 de octubre");
  });

  it("muestra el cierre más reciente cuando todos los periodos ya finalizaron", () => {
    const closed = [
      toPlanilla(assignment("z", "Física", "9-2", { students: 1, evaluations: 0, graded: 0, average: null }, { periodEndsAt: new Date(2026, 5, 19) })),
    ];
    const summary = summarizePeriod(closed, now);
    expect(summary.closing?.daysLeft).toBeLessThan(0);
    expect(formatDaysLeft(summary.closing!.daysLeft)).toBe("Finalizado");
  });

  it("formatea la última edición en lenguaje natural", () => {
    expect(formatLastActivity(null, now)).toBe("Sin actividad");
    expect(formatLastActivity(new Date(2026, 9, 24, 13, 0), now)).toBe("Editada hace 2 h");
    expect(formatLastActivity(new Date(2026, 9, 23, 9, 0), now)).toBe("Editada ayer");
    expect(formatLastActivity(new Date(2026, 9, 21, 9, 0), now)).toBe("Editada hace 3 días");
    expect(formatLastActivity(new Date(2026, 9, 16, 9, 0), now)).toBe("Editada hace 1 semana");
  });
});

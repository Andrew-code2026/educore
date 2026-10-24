import { describe, expect, it } from "vitest";
import { calculateDefinitive, normalizeGrade, parseGradeInput } from "./grading";
import type { Evaluation } from "../types";

const evaluations: Evaluation[] = [
  { id: "e1", code: "E1", order: 0, name: "Diagnóstica", shortName: "Diag.", abbrev: "D", type: "quiz", weight: 40, date: "2026-01-01", period: "1", dbaIds: [] },
  { id: "e2", code: "E2", order: 1, name: "Proyecto", shortName: "Proy.", abbrev: "P", type: "proyecto", weight: 60, date: "2026-01-02", period: "1", dbaIds: [] },
];

describe("contrato de calificación", () => {
  it("acepta 0.0 y limita valores fuera de la escala 0.0–5.0", () => {
    expect(normalizeGrade(0)).toBe(0);
    expect(normalizeGrade(-1)).toBe(0);
    expect(normalizeGrade(6)).toBe(5);
    expect(normalizeGrade(4.26)).toBe(4.3);
    expect(normalizeGrade(null)).toBeNull();
  });

  it("interpreta la entrada del docente sin recortar valores inválidos", () => {
    expect(parseGradeInput("")).toEqual({ ok: true, value: null });
    expect(parseGradeInput("4,26")).toEqual({ ok: true, value: 4.3 });
    expect(parseGradeInput("45")).toEqual({ ok: true, value: 4.5 });
    expect(parseGradeInput("5")).toEqual({ ok: true, value: 5 });
    expect(parseGradeInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseGradeInput("7").ok).toBe(false);
    expect(parseGradeInput("55").ok).toBe(false);
    expect(parseGradeInput("4.5.1").ok).toBe(false);
  });

  it("renormaliza sobre el peso evaluado y marca provisionalidad con evidencia insuficiente", () => {
    const result = calculateDefinitive(evaluations, { "s::e1": 5, "s::e2": null }, "s");
    expect(result.score).toBe(5);
    expect(result.evaluatedWeight).toBe(40);
    expect(result.evaluatedPct).toBe(40);
    expect(result.provisional).toBe(true);
  });

  it("considera suficiente exactamente el 60% de evidencia", () => {
    const result = calculateDefinitive(evaluations, { "s::e1": null, "s::e2": 4 }, "s");
    expect(result.score).toBe(4);
    expect(result.evaluatedPct).toBe(60);
    expect(result.provisional).toBe(false);
  });

  it("conserva una nota cero como nota evaluada, no como pendiente", () => {
    const result = calculateDefinitive(evaluations, { "s::e1": 0, "s::e2": null }, "s");
    expect(result.score).toBe(0);
    expect(result.evaluatedWeight).toBe(40);
    expect(result.provisional).toBe(true);
  });

  it("devuelve definitiva nula cuando no hay notas calificadas", () => {
    const result = calculateDefinitive(evaluations, { "s::e1": null, "s::e2": null }, "s");
    expect(result.score).toBeNull();
    expect(result.evaluatedWeight).toBe(0);
    expect(result.evaluatedPct).toBe(0);
    expect(result.provisional).toBe(true);
  });

  it("excluye evaluaciones en preparación del cálculo académico", () => {
    const preparing = [{ ...evaluations[0], status: "preparing" as const, weight: 20 }, evaluations[1]];
    const result = calculateDefinitive(preparing, { "s::e1": 1, "s::e2": 4 }, "s");
    expect(result.score).toBe(4);
    expect(result.totalWeight).toBe(60);
    expect(result.evaluatedPct).toBe(100);
  });
});

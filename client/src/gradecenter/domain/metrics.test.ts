import { describe, expect, it } from "vitest";
import { buildAnalytics } from "./metrics";
import type { Dataset } from "../types";

const dataset: Dataset = {
  key: "metrics-test",
  academicYear: "2026",
  course: "9°A",
  subject: "Ciencias Naturales",
  group: "9A",
  period: "1",
  evaluationCount: 2,
  teacher: { name: "Docente", role: "Docente", initials: "D" },
  dba: [],
  students: [
    { id: "full", code: "F", firstName: "Completo", lastName: "A", fullName: "Completo A", hue: 0 },
    { id: "partial", code: "P", firstName: "Parcial", lastName: "B", fullName: "Parcial B", hue: 30 },
  ],
  evaluations: [
    { id: "e1", code: "E1", order: 0, name: "E1", shortName: "E1", abbrev: "E1", type: "quiz", weight: 40, date: "2026-01-01", period: "1", dbaIds: [] },
    { id: "e2", code: "E2", order: 1, name: "E2", shortName: "E2", abbrev: "E2", type: "proyecto", weight: 60, date: "2026-01-02", period: "1", dbaIds: [] },
  ],
  grades: { "full::e1": 4, "full::e2": 4, "partial::e1": 5, "partial::e2": null },
  comments: {},
};

describe("métricas oficiales del grupo", () => {
  it("excluye estudiantes con definitiva provisional de promedio, aprobación y ranking", () => {
    const analytics = buildAnalytics(dataset);

    expect(analytics.group.average).toBe(4);
    expect(analytics.group.approvalPct).toBe(100);
    expect(analytics.group.distribution.alto).toBe(1);
    expect(analytics.group.top.map((student) => student.student.id)).toEqual(["full"]);
    expect(analytics.byStudent.get("partial")?.provisional).toBe(true);
  });
});

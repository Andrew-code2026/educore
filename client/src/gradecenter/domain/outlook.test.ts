import { describe, expect, it } from "vitest";
import { buildAnalytics } from "./metrics";
import { approvalOutlook } from "./outlook";
import type { Dataset } from "../types";

const base: Dataset = {
  key: "outlook-test",
  academicYear: "2026",
  course: "9°A",
  subject: "Ciencias",
  group: "9A",
  period: "1",
  evaluationCount: 3,
  teacher: { name: "Docente", role: "Docente", initials: "D" },
  dba: [],
  students: [{ id: "s", code: "S", firstName: "Ana", lastName: "B", fullName: "Ana B", hue: 0 }],
  evaluations: [
    { id: "e1", code: "E1", order: 0, name: "E1", shortName: "E1", abbrev: "E1", type: "quiz", weight: 40, date: "2026-01-01", period: "1", dbaIds: [] },
    { id: "e2", code: "E2", order: 1, name: "E2", shortName: "E2", abbrev: "E2", type: "taller", weight: 60, date: "2026-01-02", period: "1", dbaIds: [] },
    { id: "e3", code: "E3", order: 2, name: "E3", shortName: "E3", abbrev: "E3", type: "taller", weight: 20, date: "2026-01-03", period: "1", dbaIds: [], status: "preparing" },
  ],
  grades: {},
  comments: {},
};

const outlookFor = (grades: Dataset["grades"]) =>
  approvalOutlook(buildAnalytics({ ...base, grades }).byStudent.get("s")!);

describe("perspectiva de aprobación", () => {
  it("calcula lo que falta sobre la ponderación pendiente e ignora evaluaciones en preparación", () => {
    // 3.5 × 100 − 2.0 × 40 = 270 → 270 / 60 = 4.5
    expect(outlookFor({ "s::e1": 2 }).needed).toBeCloseTo(4.5);
    expect(outlookFor({ "s::e1": 2 }).tone).toBe("neutral");
  });

  it("distingue aprobación asegurada, imposible y sin notas", () => {
    expect(outlookFor({ "s::e1": 5, "s::e2": 4 }).tone).toBe("good");
    expect(outlookFor({ "s::e1": 0 }).tone).toBe("bad");
    expect(outlookFor({}).tone).toBe("empty");
  });
});

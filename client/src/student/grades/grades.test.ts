import { describe, expect, it } from "vitest";
import { attentionNote, buildGradesModel, subjectOutlook, visiblePeriods, type RawGrades, type RawSubject } from "./grades";

const NOW = new Date(2026, 10, 11, 10);
const day = (offset: number) => new Date(2026, 10, 11 + offset, 9);

const subject = (id: number, name: string, values: Array<number | null>, average: number | null): RawSubject => ({
  subjectId: id,
  name,
  teacherName: "Docente",
  average,
  gradedWeight: values.reduce<number>((sum, value, index) => sum + (value === null ? 0 : [30, 30, 40][index]), 0),
  totalWeight: 100,
  evaluations: values.map((value, index) => ({ id: id * 10 + index, title: `Evaluación ${index + 1}`, type: ["QUIZ", "TALLER", "PROYECTO"][index], weight: [30, 30, 40][index], date: day(index === 2 ? 3 : -10 + index), value, comment: null })),
});

const data = (overrides: Partial<RawGrades> = {}): RawGrades => ({
  period: { id: 4, name: "Periodo 4", state: "active" },
  periods: [
    { id: 1, name: "Periodo 1", state: "closed" },
    { id: 4, name: "Periodo 4", state: "active" },
    { id: 5, name: "Periodo 5", state: "scheduled" },
  ],
  subjects: [subject(1, "Química", [3.1, 3.4, null], 3.3), subject(2, "Lengua Castellana", [4.8, 4.9, null], 4.9)],
  average: 4.2,
  previous: { periodName: "Periodo 3", average: 4.1 },
  reportCardGeneratedAt: null,
  ...overrides,
});

describe("subjectOutlook", () => {
  it("computes what is needed in the pending weight to reach 3.5", () => {
    // (3.5·100 − (3.1·30 + 3.4·30)) / 40 = 3.875
    expect(subjectOutlook([{ weight: 30, value: 3.1 }, { weight: 30, value: 3.4 }, { weight: 40, value: null }], false)).toEqual({
      tone: "warn",
      text: "Necesitas 3.9 en promedio en lo pendiente para aprobar.",
      needed: 3.9,
    });
  });

  it("tells when approval is already secured or out of reach", () => {
    expect(subjectOutlook([{ weight: 80, value: 5 }, { weight: 20, value: null }], false).tone).toBe("good");
    expect(subjectOutlook([{ weight: 70, value: 1 }, { weight: 30, value: null }], false).tone).toBe("bad");
  });

  it("closes the outlook in a closed period", () => {
    expect(subjectOutlook([{ weight: 100, value: 4 }], true).text).toBe("Aprobaste la materia en este periodo.");
  });

  it("is honest when there are no grades yet", () => {
    expect(subjectOutlook([{ weight: 30, value: null }], false).tone).toBe("empty");
    expect(subjectOutlook([], false).tone).toBe("empty");
  });
});

describe("buildGradesModel", () => {
  it("summarizes the period with the institutional scale", () => {
    const model = buildGradesModel(data(), NOW);
    expect(model).toMatchObject({ periodName: "Periodo 4", average: 4.2, level: "alto", deltaLabel: "+0.1 vs Periodo 3", attention: 1, graded: 4, total: 6 });
    expect(attentionNote(model)).toBe("1 requiere atención");
  });

  it("selects the subject that needs attention by default", () => {
    expect(buildGradesModel(data(), NOW).defaultSubjectId).toBe(1);
  });

  it("marks evaluations as graded, pending or upcoming", () => {
    const [chemistry] = buildGradesModel(data(), NOW).subjects;
    expect(chemistry.evaluations.map(e => e.state)).toEqual(["graded", "graded", "upcoming"]);
    expect(chemistry.evaluations[0].typeLabel).toBe("Quiz");
    expect(chemistry).toMatchObject({ level: "bajo", needsAttention: true, evaluatedPct: 60, provisional: false });
  });

  it("writes a negative delta with a real minus sign and hides it without a previous period", () => {
    expect(buildGradesModel(data({ average: 3.9, previous: { periodName: "Periodo 3", average: 4.1 } }), NOW).deltaLabel).toBe("−0.2 vs Periodo 3");
    expect(buildGradesModel(data({ previous: null }), NOW).deltaLabel).toBeNull();
  });

  it("only lists closed and active periods", () => {
    expect(visiblePeriods(data().periods).map(p => p.id)).toEqual([1, 4]);
  });
});

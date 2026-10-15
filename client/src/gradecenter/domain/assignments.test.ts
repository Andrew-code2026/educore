import { describe, expect, it } from "vitest";
import { assignmentFromDataset, filterAssignments } from "./assignments";
import type { Dataset } from "../types";

describe("modelo de asignaciones", () => {
  const base: Dataset = {
    key: "gradebook-fixture",
    academicYear: "2026",
    course: "Curso de prueba",
    subject: "Materia de prueba",
    group: "Curso de prueba · Materia de prueba",
    period: "Periodo de prueba",
    evaluationCount: 0,
    teacher: { name: "Docente de prueba", role: "Docente", initials: "DP" },
    dba: [],
    students: [],
    evaluations: [],
    grades: {},
    comments: {},
  };
  const science = assignmentFromDataset({ ...base, key: "gradebook-science-2026", course: "9°A", subject: "Ciencias Naturales", period: "Periodo 1" });
  const maths = assignmentFromDataset({ ...base, key: "gradebook-math-2026", course: "8°B", subject: "Matemáticas", period: "Periodo 2" });

  it("conserva una identidad estable y el origen de la planilla", () => {
    expect(science.id).toBe("gradebook-science-2026");
    expect(science.sourceDatasetKey).toBe(science.dataset.key);
    expect(science.access).toBe("owner");
    expect(science.status).toBe("available");
  });

  it("filtra por salón, materia, año y periodo sin mezclar asignaciones", () => {
    expect(filterAssignments([science, maths], "matemáticas", "all", "all").map((item) => item.id)).toEqual(["gradebook-math-2026"]);
    expect(filterAssignments([science, maths], "", "2026", "Periodo 2").map((item) => item.id)).toEqual(["gradebook-math-2026"]);
    expect(filterAssignments([science, maths], "8-B", "all", "all")).toHaveLength(0);
  });
});

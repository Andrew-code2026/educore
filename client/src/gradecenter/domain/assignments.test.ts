import { describe, expect, it } from "vitest";
import { assignmentFromDataset, computeDatasetMetrics, filterAssignments } from "./assignments";
import { getAssignmentsFromContext } from "../adapter";
import { gradeKey, type Dataset } from "../types";

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

  it("calcula métricas individuales por planilla sin porcentajes negativos ni contaminación entre cursos", () => {
    const activeDataset: Dataset = {
      ...base,
      key: "gc-3-1-2",
      course: "11-2",
      subject: "Matemáticas",
      period: "Periodo 2",
      students: [
        { id: "1", code: "0001", firstName: "Ana", lastName: "Pérez", fullName: "Ana Pérez", hue: 10 },
        { id: "2", code: "0002", firstName: "Luis", lastName: "Gómez", fullName: "Luis Gómez", hue: 40 },
      ],
      evaluations: [
        { id: "10", code: "E1", order: 0, name: "Taller 1", shortName: "Taller 1", abbrev: "Tall", type: "taller", weight: 50, date: "2026-05-01", period: "Periodo 2", dbaIds: [], status: "active" },
        { id: "11", code: "E2", order: 1, name: "Quiz 1", shortName: "Quiz 1", abbrev: "Quiz", type: "quiz", weight: 50, date: "2026-05-10", period: "Periodo 2", dbaIds: [], status: "active" },
      ],
      grades: {
        [gradeKey("1", "10")]: 4.5,
        [gradeKey("2", "10")]: null,
        [gradeKey("1", "11")]: null,
        [gradeKey("2", "11")]: null,
      },
    };

    const assignments = getAssignmentsFromContext(
      { selected: { course: { id: 3 }, subject: { id: 1 }, period: { id: 2, name: "Periodo 2" } } },
      activeDataset,
      [
        { courseId: 1, courseName: "10-1", subjectId: 2, subjectName: "Biología", academicYear: "2026", periodId: 2, periodName: "Periodo 2", periodClosed: false, students: 28, evaluations: 0, graded: 0, total: 0 },
        { courseId: 3, courseName: "11-2", subjectId: 1, subjectName: "Matemáticas", academicYear: "2026", periodId: 2, periodName: "Periodo 2", periodClosed: false, students: 2, evaluations: 2, graded: 1, total: 4, average: 4.2, lastActivityAt: null, periodEndsAt: "2026-10-29T00:00:00Z" },
      ],
    );

    expect(assignments).toHaveLength(2);
    expect(assignments[0].courseId).toBe(1);
    expect(assignments[0].subjectId).toBe(2);
    expect(assignments[0].metrics).toEqual({
      studentsCount: 28,
      evaluationsCount: 0,
      gradedCells: 0,
      totalCells: 0,
      pendingCells: 0,
      progressPct: 0,
      average: null,
    });

    expect(assignments[1].courseId).toBe(3);
    expect(assignments[1].subjectId).toBe(1);
    expect(assignments[1].metrics).toEqual({
      studentsCount: 2,
      evaluationsCount: 2,
      gradedCells: 1,
      totalCells: 4,
      pendingCells: 3,
      progressPct: 25,
      average: 4.5,
    });
    expect(assignments[1].periodEndsAt).toEqual(new Date("2026-10-29T00:00:00Z"));
    expect(computeDatasetMetrics(assignments[0].dataset).progressPct).toBeGreaterThanOrEqual(0);
  });
});

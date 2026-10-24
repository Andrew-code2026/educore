import { describe, expect, it } from "vitest";
import {
  buildAnalyticsLanding,
  filterAlerts,
  initialsOf,
  type AttendanceAlertInput,
  type PlanillaInput,
} from "./landing";

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

function absence(overrides: Partial<AttendanceAlertInput> = {}): AttendanceAlertInput {
  return {
    studentName: "Sofía Martínez",
    initials: "SM",
    group: "11-2",
    subject: "Biología",
    label: "3 ausencias consecutivas",
    detail: "80% asistencia",
    severity: "high",
    ...overrides,
  };
}

describe("buildAnalyticsLanding", () => {
  it("pondera el promedio general por las notas registradas de cada planilla", () => {
    const model = buildAnalyticsLanding({
      planillas: [
        planilla({ average: 4, graded: 30, total: 60 }),
        planilla({ subjectId: 2, subjectName: "Física", average: 3, graded: 10, total: 60 }),
        planilla({ subjectId: 3, subjectName: "Química", average: null, graded: 0, total: 60 }),
      ],
      attendanceAlerts: [],
      now: NOW,
    });

    expect(model.summary.average).toBe(3.8);
    expect(model.summary.planillasWithGrades).toBe(2);
    expect(model.summary.graded).toBe(40);
    expect(model.summary.total).toBe(180);
    expect(model.summary.progressPct).toBe(22);
  });

  it("no inventa promedio ni avance cuando no hay notas ni evaluaciones", () => {
    const model = buildAnalyticsLanding({
      planillas: [planilla({ evaluations: 0, graded: 0, total: 0, average: null })],
      attendanceAlerts: [],
      now: NOW,
    });

    expect(model.summary.average).toBeNull();
    expect(model.summary.progressPct).toBeNull();
    expect(model.planillas).toEqual([]);
    expect(model.unstarted).toHaveLength(1);
  });

  it("ordena las planillas por promedio ascendente y deja las que no tienen notas al final", () => {
    const model = buildAnalyticsLanding({
      planillas: [
        planilla({ courseName: "11-1", average: null, graded: 0 }),
        planilla({ courseName: "11-2", average: 4.1 }),
        planilla({ courseName: "10-1", average: 2.7 }),
      ],
      attendanceAlerts: [],
      now: NOW,
    });

    expect(model.planillas.map((p) => [p.group, p.tone])).toEqual([
      ["10-1", "low"],
      ["11-2", "ok"],
      ["11-1", "empty"],
    ]);
  });

  it("combina alertas académicas y de asistencia, con las más urgentes primero", () => {
    const model = buildAnalyticsLanding({
      planillas: [
        planilla({
          belowPassing: [
            { studentId: 7, name: "Daniel Torres", average: 2.9 },
            { studentId: 8, name: "Ana Ruiz", average: 2.1 },
          ],
        }),
      ],
      attendanceAlerts: [
        absence({ studentName: "Carlos Rojas", severity: "medium", label: "Asistencia en 80%" }),
        absence(),
        absence({ studentName: "Luis Páez", severity: "low" }),
      ],
      now: NOW,
    });

    expect(model.alerts.map((a) => [a.studentName, a.kind])).toEqual([
      ["Ana Ruiz", "academic"],
      ["Daniel Torres", "academic"],
      ["Sofía Martínez", "attendance"],
      ["Carlos Rojas", "attendance"],
    ]);
    expect(model.alerts[0].reason).toBe("Definitiva parcial 2.1");
    expect(model.summary.academic).toBe(2);
    expect(model.summary.attendance).toBe(2);
  });

  it("cuenta una sola vez al estudiante con varias alertas", () => {
    const model = buildAnalyticsLanding({
      planillas: [planilla({ belowPassing: [{ studentId: 1, name: "Sofía Martínez", average: 2.5 }] })],
      attendanceAlerts: [absence({ studentName: "sofia martinez" })],
      now: NOW,
    });

    expect(model.alerts).toHaveLength(2);
    expect(model.summary.flaggedStudents).toBe(1);
  });
});

describe("filterAlerts", () => {
  it("filtra por tipo de alerta", () => {
    const { alerts } = buildAnalyticsLanding({
      planillas: [planilla({ belowPassing: [{ studentId: 1, name: "Ana Ruiz", average: 2 }] })],
      attendanceAlerts: [absence()],
      now: NOW,
    });

    expect(filterAlerts(alerts, "all")).toHaveLength(2);
    expect(filterAlerts(alerts, "academic").map((a) => a.studentName)).toEqual(["Ana Ruiz"]);
    expect(filterAlerts(alerts, "attendance").map((a) => a.studentName)).toEqual(["Sofía Martínez"]);
  });
});

describe("initialsOf", () => {
  it("toma las iniciales de los dos primeros nombres", () => {
    expect(initialsOf("daniel torres rivas")).toBe("DT");
    expect(initialsOf("  Ana ")).toBe("A");
  });
});

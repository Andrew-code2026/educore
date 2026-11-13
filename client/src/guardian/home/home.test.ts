import { describe, expect, it } from "vitest";
import { buildAttendanceModel } from "@/student/attendance/attendance";
import { buildGradesModel } from "@/student/grades/grades";
import { buildTasks } from "@/student/tasks/tasks";
import { buildChildSummary, buildGuardianPriorities, nextEvents } from "./home";

const NOW = new Date(2026, 10, 11, 10);
const at = (days: number, hour = 23) => new Date(2026, 10, 11 + days, hour);

const tasks = buildTasks(
  [
    { id: 1, title: "Informe de laboratorio", subject: "Química", teacherName: "H. Vélez", description: "", dueAt: at(-1), points: 100, status: "Publicado" },
    { id: 2, title: "Taller de optimización", subject: "Matemáticas", teacherName: "R. Salamanca", description: "", dueAt: at(1), points: 100, status: "Publicado" },
    { id: 3, title: "Proyecto final", subject: "Sociales", teacherName: "L. Ferrer", description: "", dueAt: at(12), points: 100, status: "Publicado" },
    { id: 4, title: "Ensayo", subject: "Lengua", teacherName: "M. Ruiz", description: "", dueAt: at(3), points: 100, status: "Publicado" },
    { id: 5, title: "Quiz entregado", subject: "Inglés", teacherName: "A. Gómez", description: "", dueAt: at(2), points: 100, status: "Publicado" },
  ],
  [{ id: 50, assignmentId: 5, submittedAt: at(-1, 10), status: "Entregada", fileName: "quiz.pdf", comment: null, grade: null }],
  NOW,
);

const attendance = buildAttendanceModel([{ id: 7, courseId: "11-2", studentId: "1", attendanceDate: new Date(Date.UTC(2026, 10, 5)), status: "absent" }], []);

const grades = buildGradesModel(
  {
    period: { id: 4, name: "Periodo 4", state: "active" },
    periods: [],
    average: 4,
    previous: null,
    reportCardGeneratedAt: null,
    subjects: [
      {
        subjectId: 9,
        name: "Química",
        teacherName: "H. Vélez",
        average: 3.3,
        gradedWeight: 60,
        totalWeight: 100,
        evaluations: [
          { id: 1, title: "Quiz", type: "QUIZ", weight: 30, date: at(-15), value: 3.1, comment: null },
          { id: 2, title: "Laboratorio", type: "TALLER", weight: 30, date: at(-10), value: 3.4, comment: null },
          { id: 3, title: "Informe", type: "PROYECTO", weight: 40, date: at(-1), value: null, comment: null },
        ],
      },
    ],
  },
  NOW,
  "guardian",
);

describe("buildGuardianPriorities", () => {
  it("puts the excuse first (only the guardian can send it), then overdue work and subjects at risk", () => {
    const items = buildGuardianPriorities({ tasks, pendingExcuses: attendance.pendingExcuses, subjects: grades.subjects }, NOW);
    expect(items.map(item => item.id)).toEqual(["attendance-excuse-7", "pending-overdue-1", "grade-9"]);
    expect(items[0]).toMatchObject({ severity: "high", actionLabel: "Enviar excusa", target: { section: "attendance" } });
  });

  it("links an overdue task to its subject when the names match, ignoring accents and case", () => {
    const [, overdue] = buildGuardianPriorities({ tasks, pendingExcuses: attendance.pendingExcuses, subjects: grades.subjects }, NOW);
    expect(overdue).toMatchObject({ title: "Informe de laboratorio", actionLabel: "Ver materia", target: { section: "grades", subjectId: 9 } });
    const [unmatched] = buildGuardianPriorities({ tasks, pendingExcuses: [], subjects: [] }, NOW);
    expect(unmatched.target).toEqual({ section: "grades", subjectId: null });
  });

  it("explains a subject at risk with what is still needed, in the guardian's voice", () => {
    const risk = buildGuardianPriorities({ tasks: [], pendingExcuses: [], subjects: grades.subjects }, NOW)[0];
    expect(risk.title).toBe("Química por debajo de 3.5");
    expect(risk.context).toBe("Definitiva 3.3 · necesita 3.9 en lo pendiente");
    expect(grades.subjects[0].outlook.text).toBe("Necesita 3.9 en promedio en lo pendiente para aprobar.");
  });

  it("caps the list at four items and is empty when everything is in order", () => {
    const manyExcuses = Array.from({ length: 6 }, (_, index) => ({ ...attendance.pendingExcuses[0], id: 100 + index }));
    expect(buildGuardianPriorities({ tasks, pendingExcuses: manyExcuses, subjects: grades.subjects }, NOW)).toHaveLength(4);
    expect(buildGuardianPriorities({ tasks: [], pendingExcuses: [], subjects: [] }, NOW)).toEqual([]);
  });
});

describe("buildChildSummary", () => {
  it("answers how the child is doing with the same numbers as the detail pages", () => {
    const [average, presence, pending] = buildChildSummary({ grades, attendance, tasks });
    expect(average).toMatchObject({ label: "Promedio", value: "4.0", note: "1 materia en riesgo", alert: true });
    expect(presence).toMatchObject({ label: "Asistencia", value: "0", unit: "%", note: "1 ausencia sin excusa", alert: true });
    expect(pending).toMatchObject({ label: "Por entregar", value: "4", note: "1 vencida", alert: true });
  });

  it("shows loading placeholders instead of invented numbers", () => {
    const tiles = buildChildSummary({ grades: null, attendance: null, tasks: null });
    expect(tiles.map(tile => tile.value)).toEqual([null, null, null]);
    expect(tiles.every(tile => tile.note === "Cargando…" && !tile.alert)).toBe(true);
  });

  it("reads as all clear when nothing needs attention", () => {
    const clear = buildChildSummary({ grades: { ...grades, attention: 0, level: "alto" }, attendance: buildAttendanceModel([], []), tasks: [] });
    expect(clear.map(tile => tile.note)).toEqual(["Alto · todas al día", "Sin registros aún", "Al día"]);
    expect(clear.some(tile => tile.alert)).toBe(false);
  });
});

describe("nextEvents", () => {
  it("keeps today and upcoming events, soonest first, at most three", () => {
    const events = [
      { id: 1, title: "Pasado", eventDate: at(-2, 9) },
      { id: 2, title: "Cierre", eventDate: at(10, 17) },
      { id: 3, title: "Hoy", eventDate: at(0, 15) },
      { id: 4, title: "Simulacro", eventDate: at(2, 8) },
      { id: 5, title: "Feria", eventDate: at(5, 9) },
    ];
    const items = nextEvents(events, NOW);
    expect(items.map(item => item.title)).toEqual(["Hoy", "Simulacro", "Feria"]);
    expect(items[0].when.startsWith("Hoy, ")).toBe(true);
    expect(items[1].when.startsWith("Vie 13 nov, ")).toBe(true);
  });
});

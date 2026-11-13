import { describe, expect, it } from "vitest";
import { buildAttendanceModel } from "../attendance/attendance";
import { buildGradesModel } from "../grades/grades";
import { buildTasks } from "../tasks/tasks";
import { buildPriorities, buildSummary, dueChip, nextEvents } from "./home";

const NOW = new Date(2026, 10, 11, 10);
const at = (days: number, hour = 23) => new Date(2026, 10, 11 + days, hour);

const tasks = buildTasks(
  [
    { id: 1, title: "Informe de laboratorio", subject: "Química", teacherName: "H. Vélez", description: "", dueAt: at(-1), points: 100, status: "Publicado" },
    { id: 2, title: "Taller de optimización", subject: "Matemáticas", teacherName: "R. Salamanca", description: "", dueAt: at(1), points: 100, status: "Publicado" },
    { id: 3, title: "Proyecto final", subject: "Sociales", teacherName: "L. Ferrer", description: "", dueAt: at(12), points: 100, status: "Publicado" },
  ],
  [],
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
);

describe("buildPriorities", () => {
  it("orders overdue work, excuses, near deadlines and subjects at risk", () => {
    const items = buildPriorities({ tasks, pendingExcuses: attendance.pendingExcuses, subjects: grades.subjects }, NOW);
    expect(items.map(item => item.id)).toEqual(["pending-overdue-1", "attendance-excuse-7", "pending-soon-2", "grade-9"]);
    expect(items[0]).toMatchObject({ context: "Química · Venció ayer", actionLabel: "Entregar", target: { section: "classroom", taskId: 1 } });
    expect(items[3].context).toBe("Definitiva 3.3 · necesitas 3.9 en lo pendiente");
  });

  it("is empty when everything is up to date", () => {
    expect(buildPriorities({ tasks: [], pendingExcuses: [], subjects: [] }, NOW)).toEqual([]);
  });
});

describe("dueChip", () => {
  it("stays short enough for the mobile card", () => {
    const [overdue, tomorrow, later] = tasks;
    expect([dueChip(overdue, NOW), dueChip(tomorrow, NOW), dueChip(later, NOW)]).toEqual(["Vencida", "Mañana", "En 12 días"]);
  });
});

describe("buildSummary", () => {
  it("answers how the child is doing with the same numbers as the detail pages", () => {
    const [average, presence, pending] = buildSummary({ grades, attendance, tasks }, NOW);
    expect(average).toMatchObject({ label: "Promedio", value: "4.0", note: "1 materia en riesgo", alert: true });
    expect(presence).toMatchObject({ label: "Asistencia", value: "0", unit: "%", note: "1 ausencia sin excusa", alert: true });
    expect(pending).toMatchObject({ label: "Por entregar", value: "3", note: "1 vencida", alert: true });
  });

  it("points to the next deadline when nothing is overdue", () => {
    const [, , pending] = buildSummary({ grades, attendance, tasks: tasks.filter(task => task.urgency !== "overdue") }, NOW);
    expect(pending).toMatchObject({ value: "2", note: "Próxima: mañana", alert: false });
  });

  it("shows loading placeholders instead of invented numbers", () => {
    const tiles = buildSummary({ grades: null, attendance: null, tasks: null }, NOW);
    expect(tiles.map(tile => tile.value)).toEqual([null, null, null]);
    expect(tiles.every(tile => tile.note === "Cargando…" && !tile.alert)).toBe(true);
  });

  it("reads as all clear when nothing needs attention", () => {
    const clear = buildSummary({ grades: { ...grades, attention: 0, level: "alto" }, attendance: buildAttendanceModel([], []), tasks: [] }, NOW);
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

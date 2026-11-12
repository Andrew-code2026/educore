import { describe, expect, it } from "vitest";
import { buildAttendanceModel } from "../attendance/attendance";
import { buildGradesModel } from "../grades/grades";
import { buildTasks } from "../tasks/tasks";
import { buildAgenda, buildPriorities, dueChip } from "./home";

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

describe("buildAgenda", () => {
  it("splits today and upcoming events and highlights evaluations", () => {
    const agenda = buildAgenda(
      [
        { id: 1, title: "Feria de ciencias", type: "Actividad institucional", eventDate: at(0, 9), location: "Patio" },
        { id: 2, title: "Simulacro Saber 11", type: "Actividad institucional", eventDate: at(8, 7) },
        { id: 3, title: "Reunión pasada", type: "Reunión", eventDate: at(-2, 7) },
      ],
      NOW,
    );
    expect(agenda.today.map(item => item.title)).toEqual(["Feria de ciencias"]);
    expect(agenda.upcoming.map(item => [item.title, item.highlight])).toEqual([["Simulacro Saber 11", true]]);
  });
});

describe("dueChip", () => {
  it("stays short enough for the mobile card", () => {
    const [overdue, tomorrow, later] = tasks;
    expect([dueChip(overdue, NOW), dueChip(tomorrow, NOW), dueChip(later, NOW)]).toEqual(["Vencida", "Mañana", "En 12 días"]);
  });
});

import { describe, expect, it } from "vitest";
import { buildTasks, filterTasks, groupPending, summarizeTasks, taskCounts, taskStatus, type RawSubmission, type RawTask } from "./tasks";

const NOW = new Date(2026, 10, 11, 10, 0, 0);
const at = (days: number, hour = 23) => new Date(2026, 10, 11 + days, hour, 0, 0);

const task = (id: number, dueInDays: number, status = "Publicado"): RawTask => ({
  id,
  title: `Actividad ${id}`,
  subject: "Química",
  teacherName: "Hernando Vélez",
  description: "  Instrucciones  ",
  dueAt: at(dueInDays),
  points: 100,
  status,
});

const submission = (assignmentId: number, submittedInDays: number, grade: number | null = null, id = assignmentId * 10): RawSubmission => ({
  id,
  assignmentId,
  submittedAt: at(submittedInDays, 18),
  status: grade === null ? "Entregada" : "Calificada",
  fileName: "informe.pdf",
  fileUrl: null,
  comment: grade === null ? null : "Buen trabajo",
  grade,
});

describe("buildTasks", () => {
  it("derives the student state from the submission, not from the submission status text", () => {
    // El bug del inicio anterior: una entrega calificada con estado "Calificada" seguía pendiente
    const tasks = buildTasks([task(1, -5), task(2, -2), task(3, 3)], [submission(1, -6, 4.5), submission(2, -3)], NOW);
    expect(tasks.map(t => t.state)).toEqual(["graded", "submitted", "open"]);
  });

  it("never shows teacher drafts", () => {
    expect(buildTasks([task(1, 2, "Borrador"), task(2, 2)], [], NOW).map(t => t.id)).toEqual([2]);
  });

  it("marks closed activities without submission as missed and blocks new submissions", () => {
    const [missed] = buildTasks([task(1, -4, "Cerrada")], [], NOW);
    expect(missed.state).toBe("missed");
    expect(missed.canSubmit).toBe(false);
  });

  it("allows replacing an ungraded submission but not a graded one", () => {
    const [submitted, graded] = buildTasks([task(1, 2), task(2, -3)], [submission(1, 0), submission(2, -4, 3.8)], NOW);
    expect(submitted.canSubmit).toBe(true);
    expect(graded.canSubmit).toBe(false);
  });

  it("flags late submissions", () => {
    const [late] = buildTasks([task(1, -2)], [submission(1, -1)], NOW);
    expect(late.submission?.late).toBe(true);
  });

  it("keeps the latest submission when there are several", () => {
    const [model] = buildTasks([task(1, 2)], [submission(1, -2, null, 1), { ...submission(1, 0, null, 2), fileName: "v2.pdf" }], NOW);
    expect(model.submission?.fileName).toBe("v2.pdf");
  });
});

describe("pending views", () => {
  const tasks = buildTasks([task(1, -1), task(2, 0), task(3, 1), task(4, 9), task(5, -3, "Cerrada"), task(6, 2)], [submission(6, 0)], NOW);

  it("groups open tasks by urgency, nearest first", () => {
    const groups = groupPending(tasks);
    expect(groups.map(g => [g.key, g.items.map(t => t.id)])).toEqual([
      ["overdue", [1]],
      ["week", [2, 3]],
      ["later", [4]],
    ]);
  });

  it("summarizes and counts every filter consistently", () => {
    const summary = summarizeTasks(tasks);
    expect(summary).toMatchObject({ pending: 4, overdue: 1, dueThisWeek: 2, submitted: 1, graded: 0 });
    expect(summary.next?.id).toBe(2);
    expect(taskCounts(tasks)).toEqual({ pending: 4, submitted: 1, graded: 0, all: 6 });
    expect(filterTasks(tasks, "pending").map(t => t.id)).toEqual([1, 2, 3, 4]);
  });

  it("labels each state for the row pill", () => {
    const byId = new Map(tasks.map(t => [t.id, t]));
    expect(taskStatus(byId.get(1)!, NOW)).toEqual({ label: "Vencida", tone: "alert" });
    expect(taskStatus(byId.get(2)!, NOW)).toEqual({ label: "Vence hoy", tone: "warn" });
    expect(taskStatus(byId.get(3)!, NOW)).toEqual({ label: "Vence mañana", tone: "warn" });
    expect(taskStatus(byId.get(5)!, NOW)).toEqual({ label: "No entregada", tone: "alert" });
    expect(taskStatus(byId.get(6)!, NOW).label).toBe("Entregada");
  });
});

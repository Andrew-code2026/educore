import { describe, it, expect } from "vitest";
import {
  calculatePendingGrades,
  calculateStudentsAtRisk,
  calculateAttendanceStatus,
  calculateGradingQueue,
  getHighlightedAction,
  calculatePriorityItems,
  buildTeacherCourseCards,
} from "./dashboardSelectors";

describe("TeacherDashboard — Business Logic & Data Calculations", () => {
  it("0 pendientes debe ser estrictamente 0 y NUNCA convertirse en un número falso", () => {
    const submissions = [
      { id: 1, assignmentId: 10, studentName: "Carlos", grade: 4.5 },
      { id: 2, assignmentId: 10, studentName: "Sofía", grade: 5.0 },
    ];
    const pending = calculatePendingGrades(submissions);
    expect(pending).toBe(0);
  });

  it("calcula correctamente las entregas pendientes de calificación", () => {
    const submissions = [
      { id: 1, assignmentId: 10, studentName: "Carlos", grade: null },
      { id: 2, assignmentId: 10, studentName: "Sofía", grade: 4.0 },
      { id: 3, assignmentId: 11, studentName: "Juan", grade: null },
      { id: 4, assignmentId: 11, studentName: "María", grade: null },
    ];
    const pending = calculatePendingGrades(submissions);
    expect(pending).toBe(3);
  });

  it("identifica estudiantes en riesgo con promedio inferior a 3.0", () => {
    const grades = [
      { studentName: "Carlos Rojas", value: 2.5, course: "11-2", subject: "Matemáticas" },
      { studentName: "Carlos Rojas", value: 2.7, course: "11-2", subject: "Matemáticas" },
      { studentName: "Sofía Martínez", value: 4.8, course: "11-2", subject: "Matemáticas" },
      { studentName: "Juan Pérez", value: 1.8, course: "11-1", subject: "Física" },
    ];
    const atRisk = calculateStudentsAtRisk(grades);
    expect(atRisk.length).toBe(2);
    expect(atRisk[0].name).toBe("Juan Pérez"); // ordenado por menor promedio primero
    expect(atRisk.some((s) => s.name === "Carlos Rojas" && s.avg < 3.0)).toBe(true);
    expect(atRisk.some((s) => s.name === "Sofía Martínez")).toBe(false);
  });

  it("calcula el estado de asistencia de hoy correctamente", () => {
    const courses = [{ name: "11-1" }, { name: "11-2" }];
    const now = new Date();

    // Caso 1: Ambos cursos registrados hoy
    const attendanceAll = [
      { course: "11-1", date: now.toISOString(), status: "Presente" },
      { course: "11-2", date: now.toISOString(), status: "Presente" },
    ];
    expect(calculateAttendanceStatus(attendanceAll, courses).label).toBe("Al día");

    // Caso 2: Solo uno registrado hoy
    const attendancePartial = [
      { course: "11-1", date: now.toISOString(), status: "Presente" },
    ];
    const partialResult = calculateAttendanceStatus(attendancePartial, courses);
    expect(partialResult.label).toBe("Parcial");
    expect(partialResult.pendingCourses).toEqual(["11-2"]);

    // Caso 3: Ninguno registrado hoy (o fecha de ayer)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const attendanceNone = [
      { course: "11-1", date: yesterday.toISOString(), status: "Presente" },
    ];
    expect(calculateAttendanceStatus(attendanceNone, courses).label).toBe("Pendiente");
  });

  it("ordena la cola de calificación por número de entregas pendientes descendente", () => {
    const assignments = [
      { id: 101, title: "Taller 1", course: "11-1", subject: "Física" },
      { id: 102, title: "Parcial 2", course: "11-2", subject: "Matemáticas" },
      { id: 103, title: "Quiz 3", course: "11-2", subject: "Matemáticas" },
    ];
    const submissions = [
      { assignmentId: 101, grade: null },
      { assignmentId: 102, grade: null },
      { assignmentId: 102, grade: null },
      { assignmentId: 102, grade: null },
      { assignmentId: 103, grade: 5.0 }, // calificada
    ];

    const queue = calculateGradingQueue(assignments, submissions);
    expect(queue.length).toBe(2);
    expect(queue[0].assignmentId).toBe(102); // 3 pendientes
    expect(queue[0].pendingCount).toBe(3);
    expect(queue[1].assignmentId).toBe(101); // 1 pendiente
    expect(queue[1].pendingCount).toBe(1);
  });

  it("determina la acción contextual destacada de forma determinista", () => {
    expect(getHighlightedAction(4, "Al día")).toBe("Calificar ahora (4 pendientes)");
    expect(getHighlightedAction(1, "Al día")).toBe("Calificar ahora (1 pendiente)");
    expect(getHighlightedAction(0, "Pendiente")).toBe("Registrar asistencia de hoy");
    expect(getHighlightedAction(0, "Al día")).toBe("Preparar actividad con IA");
  });

  it("calcula ítems prioritarios solo ante alertas reales y sin redundancia", () => {
    const cleanPriorities = calculatePriorityItems("Al día", 0, 0);
    expect(cleanPriorities.length).toBe(0);

    const attendancePriority = calculatePriorityItems("Pendiente", 0, 0);
    expect(attendancePriority.length).toBe(1);
    expect(attendancePriority[0].id).toBe("attendance");

    const allPriorities = calculatePriorityItems("Parcial", 2, 1);
    expect(allPriorities.length).toBe(3);
  });

  it("sincroniza las tarjetas de cursos con las entregas reales sin contradecir el KPI global", () => {
    // El avance se mide como en la planilla: notas registradas sobre estudiantes × actividades
    const courses = [
      { id: 1, name: "11-2", subject: "Biología", studentsCount: 2, average: 4.3 },
      { id: 2, name: "11-1", subject: "Biología", studentsCount: 1, average: 4.1 },
    ];
    const assignments = [
      { id: 10, course: "11-2", title: "Lab 1" },
      { id: 20, course: "11-1", title: "Quiz 1" },
    ];
    const submissions = [
      { id: 1, assignmentId: 10, grade: null },
      { id: 2, assignmentId: 10, grade: 4.5 },
      { id: 3, assignmentId: 20, grade: 4.0 },
    ];

    const cards = buildTeacherCourseCards(courses, [], assignments, submissions, () => {});
    const totalCoursePending = cards.reduce((acc, c) => acc + c.pendingCount, 0);
    expect(totalCoursePending).toBe(calculatePendingGrades(submissions));
    expect(cards[0].pendingCount).toBe(1);
    expect(cards[0].progress).toBe(50);
    expect(cards[1].pendingCount).toBe(0);
    expect(cards[1].progress).toBe(100);
  });

  it("maneja datos nulos o vacíos sin lanzar errores", () => {
    expect(calculatePendingGrades([])).toBe(0);
    expect(calculateStudentsAtRisk([])).toEqual([]);
    expect(calculateAttendanceStatus([], []).label).toBe("Al día");
    expect(calculateGradingQueue([], [])).toEqual([]);
  });
});

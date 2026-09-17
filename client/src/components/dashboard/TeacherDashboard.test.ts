import { describe, it, expect } from "vitest";

// Helper functions that mirror the deterministic business logic in TeacherDashboard
function calculatePendingGrades(submissions: any[]) {
  return (submissions || []).filter((s: any) => s.grade === null).length;
}

function calculateStudentsAtRisk(grades: any[]) {
  const studentGradesMap: Record<
    string,
    { total: number; count: number; course: string; subject: string }
  > = {};

  (grades || []).forEach((g: any) => {
    if (!g.studentName || typeof g.value !== "number") return;
    if (!studentGradesMap[g.studentName]) {
      studentGradesMap[g.studentName] = {
        total: 0,
        count: 0,
        course: g.course || "",
        subject: g.subject || "",
      };
    }
    studentGradesMap[g.studentName].total += g.value;
    studentGradesMap[g.studentName].count += 1;
  });

  const calculated = Object.entries(studentGradesMap).map(([name, stat]) => ({
    name,
    course: stat.course,
    subject: stat.subject,
    avg: stat.count > 0 ? stat.total / stat.count : 0,
  }));

  return calculated.filter((s) => s.avg > 0 && s.avg < 3.0);
}

function calculateAttendanceStatus(attendance: any[], courses: any[]) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const attendedCoursesToday = new Set(
    (attendance || [])
      .filter((a: any) => {
        if (!a.date) return false;
        const d = new Date(a.date);
        return (
          d.getFullYear() === todayY &&
          d.getMonth() === todayM &&
          d.getDate() === todayD
        );
      })
      .map((a: any) => a.course)
  );

  const courseList = courses || [];
  if (courseList.length === 0) {
    return { label: "Al día", tone: "success" };
  }

  const attendedCount = courseList.filter((c: any) =>
    attendedCoursesToday.has(c.name)
  ).length;

  if (attendedCount === courseList.length) {
    return { label: "Al día", tone: "success" };
  } else if (attendedCount > 0) {
    return { label: "Parcial", tone: "warning" };
  } else {
    return { label: "Pendiente", tone: "danger" };
  }
}

function calculateGradingQueue(assignments: any[], submissions: any[]) {
  return (assignments || [])
    .map((a: any) => {
      const subsForA = (submissions || []).filter(
        (s: any) => s.assignmentId === a.id
      );
      const pendingForA = subsForA.filter(
        (s: any) => s.grade === null
      ).length;

      return {
        assignmentId: a.id,
        title: a.title,
        course: a.course,
        subject: a.subject,
        pendingCount: pendingForA,
        totalSubmissions: subsForA.length,
        dueAt: a.dueAt,
      };
    })
    .filter((item) => item.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount);
}

function getHighlightedAction(pendingCount: number, attendanceLabel: string) {
  if (pendingCount > 0) {
    return `Calificar ahora (${pendingCount} pendientes)`;
  }
  if (attendanceLabel !== "Al día") {
    return "Registrar asistencia de hoy";
  }
  return "Preparar actividad con IA";
}

describe("TeacherDashboard — Business Logic & Data Calculations", () => {
  it("0 pendientes debe ser estrictamente 0 y NUNCA convertirse en 2", () => {
    const submissions = [
      { id: 1, assignmentId: 10, studentName: "Carlos", grade: 4.5 },
      { id: 2, assignmentId: 10, studentName: "Sofía", grade: 5.0 },
    ];
    const pending = calculatePendingGrades(submissions);
    expect(pending).toBe(0);
    expect(pending || 2).not.toBe(0); // demuestra por qué el fallback antiguo || 2 era un error
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
    expect(atRisk.some((s) => s.name === "Carlos Rojas" && s.avg < 3.0)).toBe(true);
    expect(atRisk.some((s) => s.name === "Juan Pérez" && s.avg < 3.0)).toBe(true);
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
    expect(calculateAttendanceStatus(attendancePartial, courses).label).toBe("Parcial");

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
    // Si hay pendientes -> calificar
    expect(getHighlightedAction(4, "Al día")).toBe("Calificar ahora (4 pendientes)");

    // Si no hay pendientes de calificar pero la asistencia está pendiente -> asistencia
    expect(getHighlightedAction(0, "Pendiente")).toBe("Registrar asistencia de hoy");

    // Si todo está al día -> planear con IA
    expect(getHighlightedAction(0, "Al día")).toBe("Preparar actividad con IA");
  });

  it("maneja datos nulos o vacíos sin lanzar errores", () => {
    expect(calculatePendingGrades([])).toBe(0);
    expect(calculateStudentsAtRisk([])).toEqual([]);
    expect(calculateAttendanceStatus([], []).label).toBe("Al día");
    expect(calculateGradingQueue([], [])).toEqual([]);
  });
});

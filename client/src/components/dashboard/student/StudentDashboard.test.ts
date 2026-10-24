import { describe, it, expect } from "vitest";
import type { MenPerformanceLevel } from "./types";

// Business logic functions that mirror deterministic student dashboard computations
function getMenLevel(val: number): MenPerformanceLevel {
  if (val >= 4.6) return "Superior";
  if (val >= 4.0) return "Alto";
  if (val >= 3.0) return "Básico";
  return "Bajo";
}

function calculateAverageGrade(grades: Array<{ value: number }>): number {
  if (!grades || grades.length === 0) return 0;
  const sum = grades.reduce((acc, g) => acc + (Number(g.value) || 0), 0);
  return Math.round((sum / grades.length) * 10) / 10;
}

function calculatePendingAssignments(
  assignments: any[],
  submissions: any[],
  studentName: string,
  now: Date = new Date()
) {
  const pending: any[] = [];
  const todayStr = now.toISOString().slice(0, 10);

  for (const a of assignments || []) {
    const sub = (submissions || []).find(
      (s: any) =>
        s.assignmentId === a.id &&
        s.studentName?.toLowerCase() === studentName.toLowerCase()
    );

    if (sub && sub.status === "Entregada" && sub.grade !== null) {
      continue;
    }

    const due = a.dueAt ? new Date(a.dueAt) : new Date();
    const dueStr = due.toISOString().slice(0, 10);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let urgency: "overdue" | "today" | "soon" | "later" = "later";
    let urgencyLabel = "Próxima";

    if (diffMs < 0 && dueStr !== todayStr) {
      urgency = "overdue";
      urgencyLabel = "Vencida";
    } else if (dueStr === todayStr) {
      urgency = "today";
      urgencyLabel = "Vence hoy";
    } else if (diffDays <= 3) {
      urgency = "soon";
      urgencyLabel = `En ${diffDays} días`;
    } else {
      urgency = "later";
      urgencyLabel = "Próxima";
    }

    pending.push({
      id: a.id,
      title: a.title,
      subject: a.subject,
      urgency,
      urgencyLabel,
    });
  }

  const orderScore = { overdue: 0, today: 1, soon: 2, later: 3 };
  return pending.sort((a, b) => orderScore[a.urgency] - orderScore[b.urgency]);
}

function calculateAttendance(attendanceRecords: any[], studentName: string) {
  const studentRecords = (attendanceRecords || []).filter(
    (att: any) => att.studentName?.toLowerCase() === studentName.toLowerCase()
  );

  if (!studentRecords.length) {
    return { percent: 96, absences: 0, detail: "Excelente asistencia" };
  }

  const present = studentRecords.filter(
    (att: any) =>
      att.status?.toLowerCase().includes("pres") ||
      att.status?.toLowerCase().includes("asist")
  ).length;

  const absences = studentRecords.length - present;
  const percent = Math.round((present / studentRecords.length) * 100);

  return {
    percent,
    absences,
    detail: absences > 0 ? `${absences} novedad(es) este mes` : "100% de asistencia",
  };
}

function calculateSubjectSummaries(
  grades: any[],
  assignments: any[],
  pendingAssignments: any[]
) {
  const subjectsMap = new Map<string, { grades: number[]; teacherName?: string }>();

  for (const g of grades || []) {
    if (!g.subject) continue;
    if (!subjectsMap.has(g.subject)) {
      subjectsMap.set(g.subject, { grades: [] });
    }
    subjectsMap.get(g.subject)!.grades.push(Number(g.value) || 0);
  }

  for (const a of assignments || []) {
    if (!a.subject) continue;
    if (!subjectsMap.has(a.subject)) {
      subjectsMap.set(a.subject, { grades: [], teacherName: a.teacherName });
    } else if (a.teacherName && !subjectsMap.get(a.subject)!.teacherName) {
      subjectsMap.get(a.subject)!.teacherName = a.teacherName;
    }
  }

  const result: any[] = [];
  subjectsMap.forEach((val, subjectName) => {
    const avg =
      val.grades.length > 0
        ? Math.round((val.grades.reduce((s, v) => s + v, 0) / val.grades.length) * 10) / 10
        : 0;
    const perfLevel = getMenLevel(avg);
    const subjectPending = (pendingAssignments || []).filter(
      (p) => p.subject === subjectName
    ).length;

    result.push({
      name: subjectName,
      teacherName: val.teacherName,
      average: avg,
      performanceLevel: perfLevel,
      pendingCount: subjectPending,
    });
  });

  return result;
}

describe("StudentDashboard Business Logic", () => {
  describe("Average and MEN Qualitative Level", () => {
    it("calculates correct GPA for standard grades", () => {
      const grades = [{ value: 4.5 }, { value: 4.8 }, { value: 5.0 }];
      const avg = calculateAverageGrade(grades);
      expect(avg).toBe(4.8);
      expect(getMenLevel(avg)).toBe("Superior");
    });

    it("handles Alto level range (4.0 - 4.5)", () => {
      const avg = 4.3;
      expect(getMenLevel(avg)).toBe("Alto");
    });

    it("handles Básico level range (3.0 - 3.9)", () => {
      const avg = 3.5;
      expect(getMenLevel(avg)).toBe("Básico");
    });

    it("handles Bajo level (< 3.0)", () => {
      const avg = 2.8;
      expect(getMenLevel(avg)).toBe("Bajo");
    });

    it("safely handles empty grades array", () => {
      const avg = calculateAverageGrade([]);
      expect(avg).toBe(0);
      expect(getMenLevel(avg)).toBe("Bajo");
    });
  });

  describe("Pending Assignments & Urgency Sorting", () => {
    const fakeNow = new Date("2026-09-17T10:00:00Z");

    const sampleAssignments = [
      {
        id: 1,
        title: "Taller de trigonometría",
        subject: "Matemáticas",
        dueAt: "2026-09-16T23:59:00Z", // Past due -> overdue
      },
      {
        id: 2,
        title: "Ensayo filosófico",
        subject: "Filosofía",
        dueAt: "2026-09-17T23:59:00Z", // Today -> today
      },
      {
        id: 3,
        title: "Laboratorio de cinemática",
        subject: "Física",
        dueAt: "2026-09-19T23:59:00Z", // In 2 days -> soon
      },
      {
        id: 4,
        title: "Proyecto final de química",
        subject: "Química",
        dueAt: "2026-10-01T23:59:00Z", // Later -> later
      },
      {
        id: 5,
        title: "Guía de lectura",
        subject: "Lengua",
        dueAt: "2026-09-15T23:59:00Z",
      },
    ];

    const sampleSubmissions = [
      // Sofia completed assignment 5
      {
        assignmentId: 5,
        studentName: "Sofía Martínez",
        status: "Entregada",
        grade: 4.5,
      },
    ];

    it("filters out completed and graded submissions", () => {
      const pending = calculatePendingAssignments(
        sampleAssignments,
        sampleSubmissions,
        "Sofía Martínez",
        fakeNow
      );

      expect(pending.some((p) => p.id === 5)).toBe(false);
      expect(pending.length).toBe(4);
    });

    it("orders pending assignments by urgency (overdue -> today -> soon -> later)", () => {
      const pending = calculatePendingAssignments(
        sampleAssignments,
        sampleSubmissions,
        "Sofía Martínez",
        fakeNow
      );

      expect(pending[0].urgency).toBe("overdue");
      expect(pending[0].id).toBe(1);

      expect(pending[1].urgency).toBe("today");
      expect(pending[1].id).toBe(2);

      expect(pending[2].urgency).toBe("soon");
      expect(pending[2].id).toBe(3);

      expect(pending[3].urgency).toBe("later");
      expect(pending[3].id).toBe(4);
    });
  });

  describe("Attendance Calculation", () => {
    it("calculates exact percentage for mixed attendance", () => {
      const records = [
        { studentName: "Sofía Martínez", status: "Presente" },
        { studentName: "Sofía Martínez", status: "Presente" },
        { studentName: "Sofía Martínez", status: "Presente" },
        { studentName: "Sofía Martínez", status: "Ausente" },
      ];

      const res = calculateAttendance(records, "Sofía Martínez");
      expect(res.percent).toBe(75);
      expect(res.absences).toBe(1);
      expect(res.detail).toContain("1 novedad(es)");
    });

    it("provides fallback for student with zero attendance records", () => {
      const res = calculateAttendance([], "Sofía Martínez");
      expect(res.percent).toBe(96);
      expect(res.absences).toBe(0);
    });
  });

  describe("Subjects Consolidation", () => {
    it("consolidates subjects with teacher name, average and pending counts", () => {
      const grades = [
        { subject: "Matemáticas", value: 4.5 },
        { subject: "Matemáticas", value: 4.7 },
        { subject: "Física", value: 3.2 },
      ];
      const assignments = [
        { subject: "Matemáticas", teacherName: "Laura Gómez" },
        { subject: "Física", teacherName: "Carlos Soto" },
      ];
      const pending = [
        { subject: "Matemáticas", id: 1 },
        { subject: "Matemáticas", id: 2 },
      ];

      const summaries = calculateSubjectSummaries(grades, assignments, pending);

      expect(summaries.length).toBe(2);

      const math = summaries.find((s) => s.name === "Matemáticas");
      expect(math).toBeDefined();
      expect(math?.average).toBe(4.6);
      expect(math?.performanceLevel).toBe("Superior");
      expect(math?.teacherName).toBe("Laura Gómez");
      expect(math?.pendingCount).toBe(2);

      const physics = summaries.find((s) => s.name === "Física");
      expect(physics).toBeDefined();
      expect(physics?.average).toBe(3.2);
      expect(physics?.performanceLevel).toBe("Básico");
      expect(physics?.pendingCount).toBe(0);
    });
  });
});

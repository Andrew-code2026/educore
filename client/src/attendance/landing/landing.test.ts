import { describe, expect, it } from "vitest";
import type { AttendanceRecord, Course, Student } from "../types";
import {
  buildAttendanceLanding,
  formatDayHeading,
  formatNextSlot,
  formatRelativeDays,
  formatToday,
  initialsOf,
  periodAttendanceRate,
  resolveActivePeriod,
} from "./landing";

// Jueves 22 de octubre de 2026, 10:30 hora local
const THURSDAY = new Date(2026, 9, 22, 10, 30);
// Sábado 24 de octubre de 2026
const SATURDAY = new Date(2026, 9, 24, 15, 0);

const student = (id: string, courseId: string, history: AttendanceRecord[] = []): Student => ({
  id,
  firstName: id,
  lastName: "",
  fullName: id,
  initials: id.slice(0, 2),
  group: courseId,
  courseId,
  history,
  pendingExcuses: 0,
  pendingRequests: 0,
});

const course = (id: string, start: string, end: string, students: Student[]): Course => ({
  id,
  name: id,
  grade: "11°",
  subject: "Biología",
  room: `Aula ${id}`,
  classDays: [1, 2, 3, 4, 5],
  start,
  end,
  students,
});

const absences = (n: number): AttendanceRecord[] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, "0")}`, status: "absent" as const }));

describe("formato", () => {
  it("escribe fechas en español", () => {
    expect(formatToday(SATURDAY)).toBe("Sábado, 24 de octubre");
    expect(formatDayHeading(new Date(2026, 9, 26))).toBe("Lunes 26 de octubre");
    expect(formatNextSlot({ date: "2026-10-26", start: "07:00" })).toBe("Lun 07:00");
  });

  it("describe la distancia en días", () => {
    expect(formatRelativeDays(1)).toBe("Mañana");
    expect(formatRelativeDays(2)).toBe("En 2 días");
  });

  it("obtiene iniciales", () => {
    expect(initialsOf("Mateo Gómez")).toBe("MG");
    expect(initialsOf("ana")).toBe("AN");
    expect(initialsOf("  ")).toBe("—");
  });
});

describe("buildAttendanceLanding", () => {
  it("clasifica las clases de hoy por estado de la lista", () => {
    const courses = [
      course("11-2", "07:00", "08:30", [student("a", "11-2"), student("b", "11-2")]),
      course("11-1", "10:00", "11:30", [student("c", "11-1")]),
      course("10-1", "12:00", "13:00", [student("d", "10-1")]),
      course("9-1", "08:30", "09:30", [student("e", "9-1")]),
    ];
    const model = buildAttendanceLanding({
      courses,
      statusesByCourse: { "11-2": { a: "present", b: "late" }, "11-1": {}, "10-1": {}, "9-1": {} },
      now: THURSDAY,
    });

    expect(model.today.map((s) => [s.group, s.state, s.action])).toEqual([
      ["11-2", "taken", "edit"],
      ["9-1", "overdue", "take"],
      ["11-1", "active", "take"],
      ["10-1", "scheduled", "view"],
    ]);
    expect(model.today[0].present).toBe(2);
    expect(model.summary.today).toBe(4);
    expect(model.summary.toTake).toBe(2);
  });

  it("sin clases hoy anuncia la próxima jornada", () => {
    const courses = [
      course("11-1", "10:00", "11:30", [student("c", "11-1")]),
      course("11-2", "07:00", "08:30", [student("a", "11-2")]),
    ];
    const model = buildAttendanceLanding({ courses, statusesByCourse: {}, now: SATURDAY });

    expect(model.today).toEqual([]);
    expect(model.upcoming).toHaveLength(1);
    expect(model.upcoming[0]).toMatchObject({ date: "2026-10-26", label: "Lunes 26 de octubre", relative: "En 2 días" });
    expect(model.upcoming[0].sessions.map((s) => s.group)).toEqual(["11-2", "11-1"]);
    expect(model.summary.next).toMatchObject({ courseId: "11-2", date: "2026-10-26", start: "07:00" });
  });

  it("cuenta alertas por inasistencias una vez por estudiante", () => {
    const courses = [
      course("11-2", "07:00", "08:30", [student("a", "11-2", absences(3)), student("b", "11-2")]),
      course("11-1", "10:00", "11:30", [student("a", "11-1", absences(3))]),
    ];
    const model = buildAttendanceLanding({ courses, statusesByCourse: {}, now: SATURDAY });

    expect(model.upcoming[0].sessions.map((s) => s.alerts)).toEqual([1, 1]);
    expect(model.summary.alerts).toBe(1);
  });

  it("lista solo las justificaciones por revisar, la más antigua primero", () => {
    const courses = [course("11-2", "07:00", "08:30", [student("a", "11-2")])];
    const base = { courseId: "11-2", studentId: "a", reasonCategory: "external_appointment" };
    const model = buildAttendanceLanding({
      courses,
      statusesByCourse: {},
      now: SATURDAY,
      justifications: [
        { ...base, id: 2, studentName: "Mateo Gómez", attendanceDate: "2026-10-22", status: "submitted", digitalEvidenceName: "Incapacidad.pdf" },
        { ...base, id: 1, studentName: "Ana Ruiz", attendanceDate: "2026-10-20", status: "in_review" },
        { ...base, id: 3, studentName: "Luis Paz", attendanceDate: "2026-10-19", status: "approved" },
      ],
    });

    expect(model.justifications.map((j) => j.id)).toEqual([1, 2]);
    expect(model.justifications[1]).toMatchObject({
      studentName: "Mateo Gómez",
      initials: "MG",
      absenceDate: "jueves 22 de octubre",
      courseLabel: "Biología 11-2",
      reason: "Cita médica",
      attachment: "Incapacidad.pdf",
    });
    expect(model.justifications[0].attachment).toBeNull();
  });

  it("ignora un periodo cuyas fechas no cubren hoy", () => {
    const courses = [course("11-2", "07:00", "08:30", [student("a", "11-2", [{ date: "2026-10-20", status: "present" }])])];
    const model = buildAttendanceLanding({
      courses,
      statusesByCourse: {},
      now: SATURDAY,
      period: { name: "Periodo 2", start: "2026-04-06", end: "2026-06-19" },
    });

    expect(model.period).toBe("Periodo 2");
    expect(model.summary.periodRate).toBe(100);
  });
});

describe("periodAttendanceRate", () => {
  const courses = [
    course("11-2", "07:00", "08:30", [
      student("a", "11-2", [
        { date: "2026-03-01", status: "absent" },
        { date: "2026-10-20", status: "present" },
        { date: "2026-10-21", status: "late" },
        { date: "2026-10-22", status: "absent" },
      ]),
    ]),
  ];

  it("incluye la jornada de hoy y acota al periodo", () => {
    const period = { name: "Periodo 4", start: "2026-09-01", end: "2026-11-30" };
    expect(periodAttendanceRate(courses, { "11-2": { a: "present" } }, "2026-10-23", period)).toBe(75);
  });

  it("devuelve null sin registros", () => {
    expect(periodAttendanceRate([course("x", "07:00", "08:00", [student("z", "x")])], {}, "2026-10-23")).toBeNull();
  });
});

describe("resolveActivePeriod", () => {
  it("prefiere el periodo marcado como activo", () => {
    const period = resolveActivePeriod(
      [
        { name: "Periodo 1", status: "Cerrado", startDate: "2026-01-13T00:00:00Z", endDate: "2026-03-27T00:00:00Z" },
        { name: "Periodo 2", status: "Activo", startDate: "2026-04-06T00:00:00Z", endDate: "2026-06-19T00:00:00Z" },
      ],
      SATURDAY,
    );
    expect(period).toEqual({ name: "Periodo 2", start: "2026-04-06", end: "2026-06-19" });
  });

  it("sin periodos devuelve null", () => {
    expect(resolveActivePeriod(undefined, SATURDAY)).toBeNull();
  });
});

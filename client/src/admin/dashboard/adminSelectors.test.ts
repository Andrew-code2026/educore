import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  buildAdminPriorities,
  buildCourseHealth,
  buildInstitutionKpis,
  institutionalPerformance,
  splitAgenda,
  type AcademicSnapshotLike,
  type PlanillaSummary,
} from "./adminSelectors";

const NOW = new Date("2026-11-11T15:00:00");

const academic: AcademicSnapshotLike = {
  activeYear: { id: 1, year: 2026, name: "Año académico 2026" },
  periods: [
    { id: 1, academicYearId: 1, status: "Cerrado", name: "Periodo 1" },
    { id: 2, academicYearId: 1, status: "Activo", name: "Periodo 2" },
  ],
  courses: [
    { id: 10, name: "11-2", capacity: 30, studentCount: 2, subjectCount: 1, teacherCount: 1 },
    { id: 11, name: "11-1", capacity: 30, studentCount: 1, subjectCount: 0, teacherCount: 0 },
  ],
  courseSubjects: [{ courseId: 10, subjectId: 1 }],
  teacherAssignments: [{ teacherUserId: 100, courseId: 10 }],
  studentEnrollments: [
    { studentUserId: 1, courseId: 10 },
    { studentUserId: 2, courseId: 10 },
    { studentUserId: 3, courseId: 11 },
  ],
  teachers: [
    { userId: 100, user: { name: "Juan Diego Loaiza" } },
    { userId: 101, user: { name: "Andrés Molina" } },
  ],
  students: [
    { userId: 1, user: { name: "Sofía" } },
    { userId: 2, user: { name: "Carlos" } },
    { userId: 3, user: { name: "Daniel" } },
    { userId: 4, user: { name: "Laura Nueva" } },
  ],
};

const planillas: PlanillaSummary[] = [
  {
    courseId: 10,
    courseName: "11-2",
    subjectName: "Biología",
    students: 2,
    average: 3.5,
    graded: 3,
    total: 4,
    belowPassing: [{ studentId: 2, name: "Carlos", average: 2.4 }],
  },
  {
    courseId: 11,
    courseName: "11-1",
    subjectName: "Biología",
    students: 1,
    average: 4.4,
    graded: 1,
    total: 2,
    belowPassing: [],
  },
];

const attendance = [
  { course: "11-2", date: "2026-11-10", status: "Presente" },
  { course: "11-2", date: "2026-11-10", status: "Ausente" },
  { course: "11-2", date: "2026-11-09", status: "Tarde" },
  { course: "11-1", date: "2026-11-09", status: "Presente" },
  // Fuera de la ventana de 30 días
  { course: "11-1", date: "2026-08-01", status: "Ausente" },
];

describe("attendanceRate", () => {
  it("cuenta presentes y tardes dentro de los últimos 30 días", () => {
    expect(attendanceRate(attendance, NOW)).toEqual({ rate: 75, total: 4 });
  });

  it("devuelve null sin registros en la ventana", () => {
    expect(attendanceRate([{ date: "2026-01-01", status: "Presente" }], NOW)).toEqual({ rate: null, total: 0 });
  });
});

describe("institutionalPerformance", () => {
  it("pondera el promedio por estudiantes y deduplica a los estudiantes en riesgo", () => {
    const duplicated = [...planillas, { ...planillas[0], subjectName: "Química", belowPassing: [{ studentId: 2, name: "Carlos", average: 2.1 }] }];
    const result = institutionalPerformance(duplicated);
    expect(result.atRisk).toHaveLength(1);
    expect(result.atRisk[0].average).toBe(2.1);
    expect(result.average).toBe(3.7);
    expect(result.gradingProgress).toBe(70);
  });
});

describe("buildInstitutionKpis", () => {
  it("resume matrícula, carga docente, asistencia y rendimiento con datos reales", () => {
    expect(buildInstitutionKpis({ academic, planillas, attendance, now: NOW })).toEqual({
      enrolled: 3,
      capacity: 60,
      teachers: 2,
      teachersWithLoad: 1,
      attendance: 75,
      attendanceRecords: 4,
      average: 3.8,
      atRisk: 1,
    });
  });
});

describe("buildCourseHealth", () => {
  it("cruza estructura, planillas y asistencia por curso en orden natural", () => {
    const courses = buildCourseHealth({ courses: academic.courses, planillas, attendance, now: NOW });
    expect(courses.map(course => course.name)).toEqual(["11-1", "11-2"]);
    expect(courses[1]).toMatchObject({ students: 2, average: 3.5, attendance: 67, atRisk: 1 });
    expect(courses[0]).toMatchObject({ attendance: 100, atRisk: 0 });
  });
});

describe("buildAdminPriorities", () => {
  it("ordena las señales por urgencia y solo incluye las que existen", () => {
    const items = buildAdminPriorities({
      academic,
      planillas,
      reportCards: [
        { courseId: 10, courseName: "11-2", periodName: "Periodo 2", students: 2, generated: 0 },
        { courseId: 11, courseName: "11-1", periodName: "Periodo 2", students: 1, generated: 1 },
      ],
      announcements: [{ status: "Borrador" }, { status: "Publicado" }],
      identity: { byRole: {}, pendingInvitations: 0 },
      piar: [{ withPiar: 3, finalized: 1 }],
    });
    expect(items.map(item => item.id)).toEqual(["risk", "reports", "students", "teachers", "drafts", "piar"]);
    expect(items[0]).toMatchObject({ title: "1 estudiante por debajo de 3.0", section: "analytics" });
    expect(items[1].context).toBe("Periodo 2 · 11-2");
    expect(items.find(item => item.id === "teachers")?.context).toBe("Andrés Molina");
    expect(items.find(item => item.id === "piar")?.title).toBe("2 PIAR sin finalizar");
  });

  it("queda vacío cuando la institución está al día", () => {
    const calm = { ...academic, students: academic.students.slice(0, 3), teachers: academic.teachers.slice(0, 1) };
    expect(
      buildAdminPriorities({
        academic: calm,
        planillas: [planillas[1]],
        reportCards: [],
        announcements: [],
        identity: { byRole: {}, pendingInvitations: 0 },
        piar: [],
      }),
    ).toEqual([]);
  });
});

describe("splitAgenda", () => {
  it("separa los eventos de hoy de los próximos y descarta los pasados", () => {
    const { today, upcoming } = splitAgenda(
      [
        { id: 1, title: "Consejo académico", eventDate: "2026-11-20T08:00:00" },
        { id: 2, title: "Izada de bandera", eventDate: "2026-11-11T07:00:00" },
        { id: 3, title: "Pasado", eventDate: "2026-10-01T07:00:00" },
      ],
      NOW,
    );
    expect(today.map(item => item.event.id)).toEqual([2]);
    expect(upcoming.map(item => item.event.id)).toEqual([1]);
  });
});

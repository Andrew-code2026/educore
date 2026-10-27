import { describe, expect, it } from "vitest";
import {
  buildCourseReportCards,
  buildReportCardSchool,
  filterStudents,
  formatSchoolLocation,
  reportCardFileName,
  type CourseReportCardsInput,
  type StudentReportCardInput,
} from "./reportCard";

const NOW = new Date(2026, 9, 24, 9, 0);

function student(overrides: Partial<StudentReportCardInput> = {}): StudentReportCardInput {
  return {
    studentId: 1,
    name: "Ana Gómez",
    subjects: [
      { subjectId: 1, subjectName: "Física", average: 3.2, graded: 2, evaluations: 3 },
      { subjectId: 2, subjectName: "Matemáticas", average: 4.8, graded: 4, evaluations: 4 },
    ],
    average: 4.0,
    observations: [],
    generatedAt: null,
    ...overrides,
  };
}

function course(students: StudentReportCardInput[]): CourseReportCardsInput {
  return {
    course: { id: 6, name: "11-2", year: "2026", directorName: "Juan Diego Loaiza" },
    period: { id: 2, name: "Periodo 2", closed: false },
    academicYearId: 1,
    students,
  };
}

const build = (students: StudentReportCardInput[]) => buildCourseReportCards(course(students), NOW);

describe("buildCourseReportCards", () => {
  it("marca como vista preliminar los boletines sin generar", () => {
    const [card] = build([student()]).students;
    expect(card).toMatchObject({ state: "preview", stateLabel: "Vista preliminar" });
  });

  it("etiqueta la fecha de la última generación", () => {
    const model = build([
      student({ studentId: 1, generatedAt: new Date(2026, 9, 24, 7, 0) }),
      student({ studentId: 2, generatedAt: new Date(2026, 9, 21) }),
      student({ studentId: 3, generatedAt: new Date(2026, 9, 2) }),
    ]);
    expect(model.students.map((s) => s.state)).toEqual(["generated", "generated", "generated"]);
    expect(model.students[0]!.stateLabel).toBe("Generado hoy");
    expect(model.students[1]!.stateLabel).toBe("Generado hace 3 días");
    expect(model.students[2]!.stateLabel).toMatch(/^Generado el /);
  });

  it("asigna el desempeño con la escala institucional y cuenta las materias bajas", () => {
    const [card] = build([student()]).students;
    expect(card!.subjects.map((s) => [s.name, s.grade, s.levelLabel, s.needsAttention])).toEqual([
      ["Física", "3.2", "Bajo", true],
      ["Matemáticas", "4.8", "Superior", false],
    ]);
    expect(card).toMatchObject({ grade: "4.0", levelLabel: "Alto", attention: 1 });
    expect(card!.subjects[0]!.progress).toBe("2 de 3 notas");
  });

  it("muestra las materias sin notas como sin evaluar", () => {
    const [card] = build([
      student({
        subjects: [
          { subjectId: 3, subjectName: "Química", average: null, graded: 0, evaluations: 1 },
          { subjectId: 4, subjectName: "Inglés", average: null, graded: 0, evaluations: 0 },
        ],
        average: null,
      }),
    ]).students;
    expect(card!.subjects[0]).toMatchObject({ grade: "—", level: null, levelLabel: "Sin evaluar", needsAttention: false });
    expect(card!.subjects.map((s) => s.progress)).toEqual(["0 de 1 nota", "Sin evaluaciones"]);
    expect(card).toMatchObject({ grade: "—", levelLabel: "Sin evaluar", attention: 0 });
  });

  it("resume el curso ignorando estudiantes sin promedio", () => {
    const model = build([
      student({ studentId: 1, average: 4.0, generatedAt: NOW }),
      student({ studentId: 2, average: 3.1 }),
      student({ studentId: 3, average: null }),
    ]);
    expect(model.summary).toEqual({ students: 3, generated: 1, average: 3.6 });
    expect(model).toMatchObject({
      group: "11-2",
      academicYear: "2026",
      directorName: "Juan Diego Loaiza",
      period: "Periodo 2",
      periodClosed: false,
      issuedOn: "24 de octubre de 2026",
    });
  });
});

describe("filterStudents", () => {
  const { students } = build([
    student({ studentId: 1, name: "Ángela Ruiz" }),
    student({ studentId: 2, name: "Daniel Torres" }),
  ]);

  it("busca sin distinguir tildes ni mayúsculas", () => {
    expect(filterStudents(students, "angela").map((s) => s.name)).toEqual(["Ángela Ruiz"]);
    expect(filterStudents(students, "TORRES").map((s) => s.name)).toEqual(["Daniel Torres"]);
  });

  it("devuelve todos con la búsqueda vacía", () => {
    expect(filterStudents(students, "  ")).toHaveLength(2);
  });
});

describe("reportCardFileName", () => {
  it("arma un nombre de archivo sin tildes ni espacios", () => {
    expect(reportCardFileName({ group: "11-2", period: "Periodo 2" }, { name: "Ángela María Ruiz" })).toBe(
      "Boletin-11-2-Angela-Maria-Ruiz-Periodo-2",
    );
  });
});

describe("formatSchoolLocation", () => {
  it("completa la ciudad con departamento y país", () => {
    expect(formatSchoolLocation({ city: "Cali", department: "Valle del Cauca", country: "Colombia" })).toBe(
      "Cali, Valle del Cauca, Colombia",
    );
  });

  it("respeta una ciudad que ya trae su región y no repite datos", () => {
    expect(formatSchoolLocation({ city: "Bogotá, Colombia", department: "Valle del Cauca", country: "Colombia" })).toBe(
      "Bogotá, Colombia",
    );
    expect(formatSchoolLocation({ city: "Medellín", department: "Antioquia", country: "antioquia" })).toBe(
      "Medellín, Antioquia",
    );
  });

  it("devuelve null sin datos", () => {
    expect(formatSchoolLocation({ city: " ", department: null, country: undefined })).toBeNull();
  });
});

describe("buildReportCardSchool", () => {
  it("acepta solo colores hex y limpia valores vacíos", () => {
    expect(buildReportCardSchool({ name: "Colegio Andino", primaryColor: "#4b9bf4", logoUrl: " " })).toMatchObject({
      name: "Colegio Andino",
      brandColor: "#4b9bf4",
      logoUrl: null,
    });
    expect(buildReportCardSchool({ primaryColor: "red; background: url(x)" })).toMatchObject({
      name: "EduCore",
      brandColor: null,
    });
  });
});

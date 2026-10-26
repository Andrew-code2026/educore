import { describe, expect, it } from "vitest";
import {
  PIAR_ACTIVITIES_KEY,
  PIAR_MAX_ACTIVITIES,
  PIAR_VALUE_MAX,
  piarActivityCount,
  piarAge,
  piarDocument,
  piarFieldStats,
  piarProgress,
  piarSchema,
  piarSectionFields,
  sanitizePiarValues,
  type PiarProgress,
} from "@shared/piar";
import { buildPiarCourseDetail, buildPiarLanding, filterByName, piarRowState, type PiarCourseInput } from "./model";

const NOW = new Date(2026, 9, 26, 9, 0);

describe("Esquema del PIAR (Decreto 1421 de 2017)", () => {
  it("tiene los tres anexos del Ministerio con sus secciones", () => {
    const annexes = piarSchema({});
    expect(annexes.map(annex => annex.title)).toEqual(["Anexo 1", "Anexo 2", "Anexo 3"]);
    expect(annexes.map(annex => annex.subtitle)).toEqual([
      "Información general del estudiante",
      "Plan Individual de Ajustes Razonables",
      "Acta de acuerdo",
    ]);
    expect(annexes[0].sections).toHaveLength(7);
    expect(annexes[1].sections.find(section => section.title === "Ajustes razonables")?.subs).toHaveLength(9);
  });

  it("no repite claves de campos", () => {
    const keys = piarSchema({ [PIAR_ACTIVITIES_KEY]: String(PIAR_MAX_ACTIVITIES) })
      .flatMap(annex => annex.sections.flatMap(piarSectionFields))
      .flatMap(field => (field.key ? [field.key] : []));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("solo cuenta los campos condicionales que aplican", () => {
    const section = piarSchema({})[0].sections[1];
    const base = piarFieldStats(piarSectionFields(section), {});
    const withOther = piarFieldStats(piarSectionFields(section), { tipo_doc: "Otro" });
    expect(withOther.total).toBe(base.total + 1);
    expect(withOther.done).toBe(1);
  });

  it("no cuenta los campos vinculados ni los avisos", () => {
    const header = piarSchema({})[2].sections[0];
    // Fecha y equipo: los datos del estudiante vienen del Anexo 1
    expect(piarFieldStats(piarSectionFields(header), {}).total).toBe(2);
  });

  it("agrega y limita las actividades en casa", () => {
    const homeFields = (acts: string) => piarSchema({ [PIAR_ACTIVITIES_KEY]: acts })[2].sections[2].fields ?? [];
    expect(piarActivityCount({})).toBe(2);
    expect(homeFields("3").filter(field => field.type === "heading")).toHaveLength(3);
    expect(piarActivityCount({ [PIAR_ACTIVITIES_KEY]: "99" })).toBe(PIAR_MAX_ACTIVITIES);
    expect(homeFields(String(PIAR_MAX_ACTIVITIES)).some(field => field.type === "action")).toBe(false);
  });

  it("calcula el avance por anexo y total", () => {
    const empty = piarProgress({});
    expect(empty.pct).toBe(0);
    expect(empty.annexes).toHaveLength(3);
    const some = piarProgress({ fecha: "2026-02-10", nombres: "Samuel", a3_fecha: "2026-03-01" });
    expect(some.done).toBe(3);
    expect(some.annexes[0].done).toBe(2);
    expect(some.annexes[2].done).toBe(1);
    expect(some.total).toBe(empty.total);
  });

  it("deriva edad y documento de los datos del Anexo 1", () => {
    expect(piarAge("2009-03-22", NOW)).toBe("17 años");
    expect(piarAge("2009-11-02", NOW)).toBe("16 años");
    expect(piarAge("", NOW)).toBe("");
    expect(piarDocument({ tipo_doc: "TI", num_doc: "1.107.845.312" })).toBe("TI 1.107.845.312");
    expect(piarDocument({ tipo_doc: "Otro", tipo_doc_otro: "PEP", num_doc: "123" })).toBe("PEP 123");
  });

  it("descarta claves inválidas, valores vacíos y textos demasiado largos", () => {
    const clean = sanitizePiarValues({
      nombres: "Samuel",
      vacio: "",
      "<script>": "x",
      numero: 4 as unknown as string,
      [PIAR_ACTIVITIES_KEY]: "3",
      largo: "a".repeat(PIAR_VALUE_MAX + 50),
    });
    expect(clean).toEqual({ nombres: "Samuel", [PIAR_ACTIVITIES_KEY]: "3", largo: "a".repeat(PIAR_VALUE_MAX) });
  });
});

function course(overrides: Partial<PiarCourseInput> = {}): PiarCourseInput {
  return {
    courseId: 1,
    courseName: "11-2",
    grade: "11",
    year: "2026",
    students: 20,
    withPiar: 0,
    finalized: 0,
    averagePct: null,
    lastUpdatedAt: null,
    ...overrides,
  };
}

const progress = (done: number, total: number, annexes: number[] = [0, 0, 0]): PiarProgress => ({
  done,
  total,
  pct: total ? Math.round((done / total) * 100) : 0,
  annexes: annexes.map(pct => ({ done: 0, total: 0, pct })),
});

describe("Portada del PIAR", () => {
  it("muestra primero los cursos con PIAR y resume el avance por estudiante", () => {
    const model = buildPiarLanding(
      [
        course({ courseId: 1, courseName: "11-1" }),
        course({ courseId: 2, courseName: "11-2", withPiar: 1, averagePct: 90, lastUpdatedAt: NOW }),
        course({ courseId: 3, courseName: "10-1", withPiar: 3, finalized: 1, averagePct: 30 }),
      ],
      NOW,
    );
    expect(model.courses.map(item => item.group)).toEqual(["10-1", "11-2", "11-1"]);
    expect(model.courses[0].inProgress).toBe(2);
    expect(model.courses[1].lastUpdated).toBe("hoy");
    expect(model.summary).toEqual({ courses: 3, withPiar: 4, finalized: 1, averagePct: 45 });
  });

  it("sin PIAR no inventa un avance", () => {
    expect(buildPiarLanding([course()], NOW).summary.averagePct).toBeNull();
  });
});

describe("Estudiantes con PIAR de un curso", () => {
  const students = [
    { studentId: 1, name: "Tomás Rincón", code: "EST-11-2-06" },
    { studentId: 2, name: "Sofía Martínez", code: "EST-11-2-01" },
    { studentId: 3, name: "Ángela Díaz", code: null },
  ];

  it("separa a quienes tienen PIAR de los candidatos", () => {
    const model = buildPiarCourseDetail(
      {
        students,
        records: [
          { id: 10, studentId: 1, status: "DRAFT", progress: progress(5, 100, [10, 0, 0]), updatedAt: NOW, updatedByName: "Juan Diego Loaiza" },
          { id: 11, studentId: 3, status: "FINALIZED", progress: progress(100, 100, [100, 100, 100]), updatedAt: NOW, updatedByName: null },
        ],
      },
      NOW,
    );
    expect(model.rows.map(row => row.name)).toEqual(["Ángela Díaz", "Tomás Rincón"]);
    expect(model.rows[1]).toMatchObject({ recordId: 10, state: "progress", annexes: [10, 0, 0], updated: "hoy", updatedBy: "Juan Diego Loaiza" });
    expect(model.rows[0].state).toBe("finalized");
    expect(model.candidates.map(student => student.studentId)).toEqual([2]);
  });

  it("distingue sin iniciar, en diligenciamiento, listo y finalizado", () => {
    expect(piarRowState("DRAFT", { done: 0, total: 10 })).toBe("new");
    expect(piarRowState("DRAFT", { done: 4, total: 10 })).toBe("progress");
    expect(piarRowState("DRAFT", { done: 10, total: 10 })).toBe("complete");
    expect(piarRowState("FINALIZED", { done: 4, total: 10 })).toBe("finalized");
  });

  it("busca por nombre o código sin tildes", () => {
    expect(filterByName(students, "angela").map(student => student.studentId)).toEqual([3]);
    expect(filterByName(students, "11-2-01").map(student => student.studentId)).toEqual([2]);
    expect(filterByName(students, "  ")).toHaveLength(3);
  });
});

import type { Dataset } from "../types";

/**
 * Estado inicial cuando EduCore Main todavía no ha entregado una planilla real.
 * No contiene estudiantes, evaluaciones, notas ni identidad docente inventada.
 */
export function createEmptyDataset(): Dataset {
  return {
    key: "gradecenter-empty",
    academicYear: "",
    course: "",
    subject: "",
    group: "",
    period: "",
    evaluationCount: 0,
    teacher: { name: "", role: "", initials: "" },
    dba: [],
    students: [],
    evaluations: [],
    grades: {},
    comments: {},
  };
}

import type { EvaluationTypeId, EvaluationTypeMeta } from "../types";

/** Catálogo de tipos permitido por el formulario; no crea evaluaciones por sí solo. */
export const TYPE_META: Record<EvaluationTypeId, EvaluationTypeMeta> = {
  proyecto: { id: "proyecto", label: "Proyecto aplicado", short: "Proyecto", abbrev: "Proy." },
  taller: { id: "taller", label: "Taller", short: "Taller", abbrev: "Tall." },
  quiz: { id: "quiz", label: "Quiz", short: "Quiz", abbrev: "Qz" },
  examen: { id: "examen", label: "Examen", short: "Examen", abbrev: "Exam." },
  exposicion: { id: "exposicion", label: "Exposición", short: "Exposición", abbrev: "Exp." },
  participacion: { id: "participacion", label: "Participación", short: "Particip.", abbrev: "Part." },
  autoevaluacion: { id: "autoevaluacion", label: "Autoevaluación", short: "Autoeval.", abbrev: "Auto." },
};

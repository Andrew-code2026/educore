import type { LevelId } from "../types";

export interface LevelMeta {
  id: LevelId;
  /** Etiqueta institucional completa. */
  label: string;
  /** Etiqueta corta para espacios densos. */
  short: string;
  /** Rango textual de la escala. */
  range: string;
  min: number;
  max: number;
  /** Descripción de una línea para tooltips y leyendas. */
  description: string;
  /** Variable CSS del color de nivel. */
  color: string;
}

export const MIN_GRADE = 0.0;
export const MAX_GRADE = 5.0;
/** Umbral institucional de aprobación. */
export const APPROVAL_GRADE = 3.5;
/** Debajo de este porcentaje de evaluaciones, la definitiva es provisional. */
export const PROVISIONAL_THRESHOLD = 60;

/**
 * Escala institucional.
 *   0.0 – 3.4  Bajo · Requiere atención
 *   3.5 – 3.9  Básico
 *   4.0 – 4.6  Alto
 *   4.7 – 5.0  Superior
 */
export const LEVELS: Record<LevelId, LevelMeta> = {
  bajo: {
    id: "bajo",
    label: "Requiere atención",
    short: "Bajo",
    range: "0.0 – 3.4",
    min: 0,
    max: 3.4,
    description: "Desempeño por debajo del umbral institucional. Requiere acompañamiento.",
    color: "var(--gc-bajo)",
  },
  basico: {
    id: "basico",
    label: "Básico",
    short: "Básico",
    range: "3.5 – 3.9",
    min: 3.5,
    max: 3.9,
    description: "Alcanza los aprendizajes esenciales con oportunidades de profundización.",
    color: "var(--gc-basico)",
  },
  alto: {
    id: "alto",
    label: "Alto",
    short: "Alto",
    range: "4.0 – 4.6",
    min: 4.0,
    max: 4.6,
    description: "Demuestra dominio sólido de los aprendizajes esperados.",
    color: "var(--gc-alto)",
  },
  superior: {
    id: "superior",
    label: "Superior",
    short: "Superior",
    range: "4.7 – 5.0",
    min: 4.7,
    max: 5.0,
    description: "Desempeño destacado y consistente a lo largo del periodo.",
    color: "var(--gc-superior)",
  },
};

export const LEVEL_ORDER: LevelId[] = ["superior", "alto", "basico", "bajo"];

export function levelFromScore(score: number | null | undefined): LevelId | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= LEVELS.superior.min) return "superior";
  if (score >= LEVELS.alto.min) return "alto";
  if (score >= LEVELS.basico.min) return "basico";
  return "bajo";
}

export function levelMeta(level: LevelId | null): LevelMeta | null {
  return level ? LEVELS[level] : null;
}

/** Color de nivel con transparencia, respetando el espacio de color perceptual. */
export function levelTint(level: LevelId, alpha: number): string {
  return `color-mix(in oklab, ${LEVELS[level].color} ${Math.round(alpha * 100)}%, transparent)`;
}

export function isApproved(score: number | null | undefined): boolean {
  return score != null && score >= APPROVAL_GRADE;
}

/** ¿El resultado cuenta como "requiere atención"? */
export function needsAttention(score: number | null | undefined): boolean {
  return score != null && score < APPROVAL_GRADE;
}

/** Etiqueta de la escala aplicada a un puntaje. */
export function scaleLabel(score: number | null): string {
  const level = levelFromScore(score);
  return level ? LEVELS[level].label : "Sin evaluar";
}

/** Progreso 0–1 dentro del rango institucional completo (0.0 – 5.0). */
export function scaleProgress(score: number | null): number {
  if (score == null) return 0;
  return Math.min(1, Math.max(0, (score - MIN_GRADE) / (MAX_GRADE - MIN_GRADE)));
}

/** Utilidades numéricas compartidas por el dominio de calificaciones. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Redondeo a un decimal, como en la escala institucional. */
export function roundGrade(value: number): number {
  return Math.round(value * 10) / 10;
}

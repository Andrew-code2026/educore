/**
 * Cálculos de las figuras del Creador de recursos (recta numérica, diagramas, modelos de
 * fracción). Son funciones puras, sin dibujo: las usan los componentes que pintan la
 * figura y los validadores, para que lo que se ve salga siempre de los datos.
 */

/** Múltiplos de `step` dentro de [min, max], contados con enteros para no acumular error. */
export function tickValues(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) return [];
  const values: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) values.push(Number((k * step).toFixed(10)));
  return values;
}

/** Paso "redondo" (1, 2, 2.5 o 5 por una potencia de 10) que deja unas `target` divisiones. */
export function niceStep(maxValue: number, target = 6): number {
  if (!(maxValue > 0)) return 1;
  const rough = maxValue / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const ratio = rough / magnitude;
  const factor = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return Number((factor * magnitude).toPrecision(12));
}

/** Tope del eje: el primer múltiplo del paso que queda por encima del valor más alto. */
export function niceMax(maxValue: number, step: number): number {
  if (!(maxValue > 0)) return step;
  return Number((Math.ceil(maxValue / step - 1e-9) * step).toPrecision(12));
}

/**
 * Porcentajes enteros que suman exactamente 100 (método del resto mayor). Redondear cada
 * sector por separado puede dar 99 o 101, y un diagrama circular así confunde.
 */
export function roundPercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
  if (!(total > 0)) return values.map(() => 0);
  const exact = values.map(value => ((value > 0 ? value : 0) / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (missing <= 0) break;
    floors[index]++;
    missing--;
  }
  return floors;
}

/** Un valor de la recta como fracción de denominador fijo, en LaTeX: 0.75 con 4 → \frac{3}{4}; 1 → 1. */
export function fractionLatex(value: number, denominator: number): string {
  const numerator = Math.round(value * denominator);
  if (numerator % denominator === 0) return String(numerator / denominator);
  const sign = numerator < 0 ? "-" : "";
  return `${sign}\\frac{${Math.abs(numerator)}}{${denominator}}`;
}

/** true si el valor cae en una marca exacta de denominador `denominator`. */
export function isMultipleOfFraction(value: number, denominator: number): boolean {
  const scaled = value * denominator;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Parte un rótulo en hasta dos líneas para que quepa bajo una barra. */
export function wrapLabel(text: string, maxChars: number): string[] {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/(?<=[\s/-])/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + word).trimEnd().length > maxChars && lines.length === 0) {
      lines.push(current.trimEnd());
      current = word;
    } else {
      current += word;
    }
  }
  lines.push(current.trimEnd());
  const second = lines[1];
  if (second && second.length > maxChars + 2) lines[1] = `${second.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return lines.slice(0, 2);
}

/** Enteros que ocupa un modelo de fracción: 5/4 necesita dos figuras. */
export function wholesNeeded(numerator: number, denominator: number): number {
  return Math.max(1, Math.ceil(numerator / denominator));
}

/** Área (con signo) de un polígono; cero si sus vértices están alineados. */
export function polygonArea(vertices: Array<{ x: number; y: number }>): number {
  let twice = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

/** Ángulos de inicio y fin (grados, desde las 12 en sentido horario) de cada sector. */
export function pieAngles(values: number[]): Array<{ start: number; end: number }> {
  const total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
  let cursor = 0;
  return values.map(value => {
    const sweep = total > 0 ? ((value > 0 ? value : 0) / total) * 360 : 0;
    const slice = { start: cursor, end: cursor + sweep };
    cursor += sweep;
    return slice;
  });
}

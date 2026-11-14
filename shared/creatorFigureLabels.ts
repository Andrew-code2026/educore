/**
 * Rótulos de las figuras de geometría (triángulo, círculo unitario, sólidos): cómo se escribe en
 * LaTeX un rótulo de texto plano y cómo se ubican sus cajas sin pisar otros rótulos ni los trazos.
 * Coordenadas en píxeles del diseño, con y hacia abajo.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelSize {
  w: number;
  h: number;
}

/* ── Texto ── */

const LATEX_ESCAPES: Record<string, string> = { "#": "\\#", "%": "\\%", "&": "\\&", "~": "\\sim ", $: "\\$", "{": "\\{", "}": "\\}" };
const TEXT_ESCAPES: Record<string, string> = { "#": "\\#", "%": "\\%", "&": "\\&", $: "\\$", "{": "\\{", "}": "\\}", _: "\\_", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}", "\\": "\\textbackslash{}" };

/**
 * Un rótulo de texto plano ("x", "θ", "2x + 1", "B'", "AB") escrito en LaTeX: las letras y los
 * nombres de vértices en cursiva, como en el tablero; las palabras derechas; la coma decimal sin espacio.
 */
export function plainToLatex(text: string): string {
  return text
    .replace(/[#%&~${}]/g, char => LATEX_ESCAPES[char])
    .replace(/\p{L}{2,}/gu, word => (/^\p{Lu}{2,3}$/u.test(word) ? word : `\\text{${word}}`))
    .replace(/(\d),(\d)/g, "$1{,}$2")
    .replace(/−/g, "-");
}

/** Una unidad dentro de \text{…}: sin signos que LaTeX lea como comandos. */
export const unitLatex = (unit: string) => `\\text{ ${unit.replace(/[#%&$_{}~^\\]/g, char => TEXT_ESCAPES[char])}}`;

/** Un rótulo que es solo un número con unidad: la medida la escribe el sistema, no el rótulo. */
export const NUMBER_LABEL = /^[≈~]?\s*-?\d+(?:[.,]\d+)?\s*(?:°|(?:mm|cm|dm|m|km|u)[²³23]?)?$/;

/* ── Cajas ── */

export const boxAt = (center: Point, size: LabelSize): Box => ({ x: center.x - size.w / 2, y: center.y - size.h / 2, w: size.w, h: size.h });

/** ¿Se tocan dos cajas, o quedan a menos de `gap` una de otra? Pegados, dos rótulos se leen como uno. */
export const boxesOverlap = (a: Box, b: Box, gap = 3) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** Distancia del centro de una caja a su borde en la dirección `n` (unitaria). */
export const support = (n: Point, size: LabelSize) => (Math.abs(n.x) * size.w) / 2 + (Math.abs(n.y) * size.h) / 2;

/** Distancia de un punto a una caja (0 si está dentro). */
export const pointBoxDistance = (p: Point, box: Box) => Math.hypot(Math.max(box.x - p.x, 0, p.x - box.x - box.w), Math.max(box.y - p.y, 0, p.y - box.y - box.h));

/** ¿El segmento de p a q pasa por la caja, o a menos de `margin` de ella? (Liang–Barsky) */
export function segmentTouchesBox(p: Point, q: Point, box: Box, margin = 1): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, p.x - (box.x - margin)],
    [dx, box.x + box.w + margin - p.x],
    [-dy, p.y - (box.y - margin)],
    [dy, box.y + box.h + margin - p.y],
  ];
  for (const [step, room] of edges) {
    if (step === 0) {
      if (room < 0) return false;
      continue;
    }
    const t = room / step;
    if (step < 0) {
      if (t > t1) return false;
      t0 = Math.max(t0, t);
    } else {
      if (t < t0) return false;
      t1 = Math.min(t1, t);
    }
  }
  return true;
}

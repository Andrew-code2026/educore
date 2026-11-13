import type { GraphSpec } from "./creator";
import { formatNumberEs } from "./creatorMath";
import { hasEqualUnits } from "./creatorPlane";

/**
 * Ejes del plano cartesiano: cuánto mide la cuadrícula, qué márgenes la rodean y dónde va el
 * nombre de cada eje. Es cálculo sin dibujo: lo usan el componente y el validador, de modo que
 * un nombre que no cabe se rechaza antes de dibujar nada.
 */

/** Márgenes alrededor de la cuadrícula: caben las flechas de los ejes y los números. */
export const PLANE_PAD = { left: 30, right: 24, top: 22, bottom: 28 } as const;
const MAX_W = 320;
const MAX_H = 320;

/** Caracteres que admite el nombre de un eje. */
export const AXIS_NAME_MAX = 40;
/** Franja que se añade fuera de la cuadrícula para el nombre de un eje. */
const NAME_BAND = 16;
/** Ancho medio de un carácter del nombre de un eje, a su tamaño de letra (11,5 px). */
const NAME_CHAR_W = 6.2;
/** Ancho de un dígito de los números de los ejes (10,5 px). */
const NUMBER_CHAR_W = 6;

/**
 * Tamaño de la cuadrícula. Con rangos parecidos se usan unidades iguales en ambos ejes
 * (una recta de pendiente 1 se ve a 45°); si son muy distintos, cada eje toma su escala.
 */
export function plotSize(xSpan: number, ySpan: number): { w: number; h: number } {
  const ratio = ySpan / xSpan;
  if (hasEqualUnits(xSpan, ySpan)) {
    let w = MAX_W;
    let h = w * ratio;
    if (h > MAX_H) {
      h = MAX_H;
      w = h / ratio;
    }
    return { w, h };
  }
  return ratio > 1 ? { w: 240, h: MAX_H } : { w: MAX_W, h: 200 };
}

/** Múltiplos de `step` dentro de [min, max], contados con enteros para no acumular error. */
export function planeTicks(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) values.push(Number((k * step).toFixed(10)));
  return values;
}

/** De cada cuántas marcas se escribe el número, para que no pasen de catorce por eje. */
export const labelEvery = (count: number): number => Math.max(1, Math.ceil(count / 14));

export interface PlaneLayout {
  /** Ancho y alto de la cuadrícula. */
  w: number;
  h: number;
  pad: { left: number; right: number; top: number; bottom: number };
  /** Ancho y alto de la figura entera, con márgenes. */
  width: number;
  height: number;
  /** Centro del nombre del eje x (se escribe horizontal, bajo el plano), o null si no lleva. */
  xName: { x: number; y: number } | null;
  /** Centro del nombre del eje y (se escribe de abajo arriba, a la izquierda), o null si no lleva. */
  yName: { x: number; y: number } | null;
}

/** Ancho aproximado, en píxeles de la figura, del nombre de un eje. */
export const axisNameWidth = (name: string): number => name.length * NAME_CHAR_W;

/**
 * Medidas del plano. Sin nombres de eje son las de siempre; cada nombre añade una franja
 * fuera de la cuadrícula (abajo el de x, a la izquierda el de y), más allá de las flechas y
 * de los números, así que no pisa nada de lo que hay dentro.
 */
export function planeLayout(spec: GraphSpec): PlaneLayout | null {
  const xSpan = spec.xMax - spec.xMin;
  const ySpan = spec.yMax - spec.yMin;
  if (!(xSpan > 0) || !(ySpan > 0)) return null;
  const { w, h } = plotSize(xSpan, ySpan);
  const pad: PlaneLayout["pad"] = { ...PLANE_PAD };

  if (spec.xLabel) pad.bottom += NAME_BAND;
  if (spec.yLabel) {
    // Con el eje y en el borde izquierdo, sus números quedan fuera de la cuadrícula: el nombre va más allá de ellos
    if (spec.xMin >= 0 && spec.yStep > 0) {
      const yTicks = planeTicks(spec.yMin, spec.yMax, spec.yStep);
      const every = labelEvery(yTicks.length);
      const longest = Math.max(0, ...yTicks.filter((_, index) => index % every === 0).map(y => formatNumberEs(y).length));
      pad.left = Math.max(pad.left, longest * NUMBER_CHAR_W + 13);
    }
    pad.left += NAME_BAND;
  }

  const width = pad.left + w + pad.right;
  const height = pad.top + h + pad.bottom;
  return {
    w,
    h,
    pad,
    width,
    height,
    xName: spec.xLabel ? { x: pad.left + w / 2, y: height - 5 } : null,
    yName: spec.yLabel ? { x: 12, y: pad.top + h / 2 } : null,
  };
}

/** Problemas de los nombres de los ejes: que quepan a lo largo de su lado de la figura. */
export function planeAxisIssues(spec: GraphSpec): string[] {
  const layout = planeLayout(spec);
  if (!layout) return [];
  const issues: string[] = [];
  const check = (name: string | undefined, axis: "x" | "y", room: number, side: string) => {
    if (!name || axisNameWidth(name) <= room) return;
    issues.push(`Gráfica: el nombre del eje ${axis} («${name}») no cabe ${side} del plano, que admite unos ${Math.floor(room / NAME_CHAR_W)} caracteres con este rango. Acórtalo: la unidad puede ir abreviada, "Tiempo (h)".`);
  };
  check(spec.xLabel, "x", layout.width - 8, "a lo ancho");
  check(spec.yLabel, "y", layout.height - 8, "a lo alto");
  return issues;
}

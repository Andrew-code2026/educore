import type { GraphSpec } from "./creator";
import { formatNumber, formatNumberEs } from "./creatorMath";
import { figureNumber, figureNumberLatex, hasEqualUnits, isExactNumber } from "./creatorPlane";

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

/* ── Eje x en múltiplos de π ── */

/** Denominadores con que se escribe un múltiplo de π: los de los ángulos notables. */
const PI_DENOMINATORS = [1, 2, 3, 4, 6, 12] as const;
/** Error relativo con que se reconoce un paso escrito con cuatro decimales: 1,5708 es π/2; 1,5 no. */
const PI_WRITTEN_TOLERANCE = 1e-3;
/** Una marca que cae a menos de una centésima de paso fuera del rango (6,28 por 2π) se dibuja en el borde. */
const PI_EDGE = 0.01;

/** Un múltiplo de π como fracción irreducible: n/d · π. */
export interface PiFraction {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x || 1;
}

/**
 * El número como fracción de π con un denominador de los ángulos notables (π/6, π/4, π/3, π/2…),
 * o null si no lo es. `tolerance` es el error relativo admitido: casi nada para un valor que
 * calculó el sistema, y el de cuatro decimales para uno escrito a mano.
 */
export function piFraction(value: number, tolerance = 1e-9): PiFraction | null {
  if (!Number.isFinite(value)) return null;
  if (value === 0) return { n: 0, d: 1 };
  for (const d of PI_DENOMINATORS) {
    const n = Math.round((value / Math.PI) * d);
    if (n !== 0 && Math.abs(value - (n / d) * Math.PI) <= tolerance * Math.abs(value)) return { n, d };
  }
  return null;
}

/** Un múltiplo de π como se escribe en el eje: «π/2», «-3π/2», «2π», «0». */
export function piText({ n, d }: PiFraction): string {
  if (n === 0) return "0";
  const top = `${n < 0 ? "-" : ""}${Math.abs(n) === 1 ? "" : Math.abs(n)}π`;
  return d === 1 ? top : `${top}/${d}`;
}

/** Lo mismo en LaTeX, para los rótulos de la figura: «\frac{\pi}{2}», «-\frac{3\pi}{2}». */
export function piLatex({ n, d }: PiFraction): string {
  if (n === 0) return "0";
  const top = `${Math.abs(n) === 1 ? "" : Math.abs(n)}\\pi`;
  return `${n < 0 ? "-" : ""}${d === 1 ? top : `\\frac{${top}}{${d}}`}`;
}

/** El paso del eje x como fracción de π cuando el plano lo pide (xUnit "pi"); null si no lo pide o el paso no lo es. */
export const piStep = (spec: GraphSpec): PiFraction | null => (spec.xUnit === "pi" ? piFraction(spec.xStep, PI_WRITTEN_TOLERANCE) : null);

export interface PlaneTick {
  value: number;
  /** El número de la marca como se escribe en el eje. */
  text: string;
  /** Si la marca lleva su número: cuando hay muchas, se escribe una de cada tantas. */
  labeled: boolean;
}

/**
 * Marcas del eje x de un plano cuya cuadrícula mide `w` píxeles de ancho. En múltiplos de π van en
 * los múltiplos exactos del paso (no en los del número redondeado que se escribió) y se rotulan
 * π/2, π, 3π/2…; cuando los rótulos no caben, se escribe uno de cada tantos contando desde el cero.
 */
export function planeXTicks(spec: GraphSpec, w: number): PlaneTick[] {
  const step = piStep(spec);
  if (!step) {
    const values = planeTicks(spec.xMin, spec.xMax, spec.xStep);
    const every = labelEvery(values.length);
    return values.map((value, index) => ({ value, text: formatNumberEs(value), labeled: index % every === 0 }));
  }
  const size = (step.n / step.d) * Math.PI;
  const first = Math.ceil(spec.xMin / size - PI_EDGE);
  const last = Math.floor(spec.xMax / size + PI_EDGE);
  const marks: Array<{ k: number; text: string }> = [];
  for (let k = first; k <= last; k++) {
    const divisor = gcd(k * step.n, step.d);
    marks.push({ k, text: piText({ n: (k * step.n) / divisor, d: step.d / divisor }) });
  }
  const spacing = (w * size) / (spec.xMax - spec.xMin);
  // Se prueba a escribir todas, luego una de cada dos…: sirve el primer salto en que los rótulos caben
  // y, si se salta alguna, quedan los que se esperan en el tablero (los múltiplos de π/2 o de π)
  const fits = (every: number) => {
    const shown = marks.filter(mark => mark.k % every === 0);
    const widest = Math.max(0, ...shown.map(mark => mark.text.length)) * NUMBER_CHAR_W + 6;
    const round = every === 1 || (2 * every * step.n) % step.d === 0;
    return round && shown.length <= 14 && widest <= every * spacing;
  };
  let every = 1;
  while (!fits(every) && every < marks.length) every++;
  return marks.map(({ k, text }) => ({ value: Math.min(Math.max(k * size, spec.xMin), spec.xMax), text, labeled: k % every === 0 }));
}

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

  if (spec.xUnit === "pi") {
    const step = piStep(spec);
    if (!step) {
      issues.push(
        `Gráfica: con el eje x en múltiplos de π (xUnit "pi"), el paso (xStep) debe ser una fracción sencilla de π escrita con cuatro decimales: 0.2618 (π/12), 0.5236 (π/6), 0.7854 (π/4), 1.0472 (π/3), 1.5708 (π/2), 3.1416 (π) o un múltiplo de ellos. Ahora vale ${formatNumber(spec.xStep, 4)}.`,
      );
    } else if (!planeXTicks(spec, layout.w).some(tick => tick.value !== 0)) {
      issues.push(`Gráfica: el eje x va en múltiplos de π, pero en este rango no cabe ninguna marca: el paso es ${piText(step)}. Amplía xMin/xMax o reduce xStep.`);
    }
  }
  return issues;
}

/* ── Coordenadas de un punto calculado ── */

/** La abscisa como múltiplo de π si el plano va en múltiplos de π y lo es; null si se escribe como número. */
const piAbscissa = (spec: GraphSpec, x: number): PiFraction | null => (spec.xUnit === "pi" ? piFraction(x) : null);

/**
 * Un punto que calculó el sistema, como se lee en la figura y en la clave: «(2, -1)», con punto y
 * coma si alguna coordenada lleva coma decimal, «≈» delante si alguna va redondeada, y la abscisa
 * en múltiplos de π cuando el eje los usa: «(π/2, 1)».
 */
export function planePointText(spec: GraphSpec, x: number, y: number): string {
  const fraction = piAbscissa(spec, x);
  const xs = fraction ? piText(fraction) : figureNumber(x);
  const ys = figureNumber(y);
  const exact = (fraction !== null || isExactNumber(x)) && isExactNumber(y);
  return `${exact ? "" : "≈ "}(${xs}${xs.includes(",") || ys.includes(",") ? ";" : ","} ${ys})`;
}

/** Lo mismo en LaTeX, para el rótulo del punto en la figura. */
export function planePointLatex(spec: GraphSpec, x: number, y: number): string {
  const fraction = piAbscissa(spec, x);
  const xs = fraction ? piLatex(fraction) : figureNumberLatex(x);
  const ys = figureNumberLatex(y);
  const exact = (fraction !== null || isExactNumber(x)) && isExactNumber(y);
  return `${exact ? "" : "\\approx "}(${xs}${xs.includes("{,}") || ys.includes("{,}") ? ";" : ","}\\, ${ys})`;
}

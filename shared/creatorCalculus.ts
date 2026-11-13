import type { GraphArea, GraphSpec } from "./creator";
import { formatNumber, tryCompile, type CompiledExpression } from "./creatorMath";
import { figureNumber, figureNumberLatex, inDomain, isExactNumber, oneSidedLimit, restrictToDomain, sampleFunction, tidy } from "./creatorPlane";

/**
 * Cálculo sobre las funciones del plano cartesiano: el área de una región y las sumas de
 * Riemann. La IA y el docente indican la función y el intervalo; la región, los rectángulos
 * y los números que se escriben en la figura los calcula el sistema.
 */

/** La función `index` del plano limitada a su dominio, o null si no existe o no compila. */
export function planeFunction(spec: GraphSpec, index: number): CompiledExpression | null {
  const fn = spec.functions[index];
  if (!fn) return null;
  const compiled = tryCompile(fn.expr);
  return compiled.ok ? restrictToDomain(compiled.fn, fn) : null;
}

/** Un valor calculado como se escribe en la figura: «= 4,5» si es exacto y «≈ 2,67» si no. */
export function measureText(value: number): string {
  const clean = tidy(value);
  return `${isExactNumber(clean) ? "=" : "≈"} ${figureNumber(clean)}`;
}

/** Lo mismo en LaTeX, para los rótulos de la figura. */
export function measureLatex(value: number): string {
  const clean = tidy(value);
  return `${isExactNumber(clean) ? "=" : "\\approx"} ${figureNumberLatex(clean)}`;
}

/* ── Integral definida ── */

// Cuadratura de Gauss-Legendre de cinco puntos: no evalúa en los extremos, así que un salto
// o un hueco justo en el borde de un tramo no la estorba
const GAUSS_NODES = [0, 0.5384693101056831, 0.906179845938664];
const GAUSS_WEIGHTS = [0.5688888888888889, 0.47862867049936647, 0.23692688505618908];

function gauss(fn: CompiledExpression, a: number, b: number): number {
  const center = (a + b) / 2;
  const radius = (b - a) / 2;
  let sum = GAUSS_WEIGHTS[0] * fn(center);
  for (let i = 1; i < GAUSS_NODES.length; i++) sum += GAUSS_WEIGHTS[i] * (fn(center - radius * GAUSS_NODES[i]) + fn(center + radius * GAUSS_NODES[i]));
  return sum * radius;
}

function adaptive(fn: CompiledExpression, a: number, b: number, whole: number, tolerance: number, depth: number): number {
  const middle = (a + b) / 2;
  const left = gauss(fn, a, middle);
  const right = gauss(fn, middle, b);
  const both = left + right;
  if (Number.isFinite(both) && Number.isFinite(whole) && Math.abs(both - whole) <= tolerance) return both;
  // Un nodo sin definir puede ser un hueco aislado: se parte unas veces; si sigue, la función no existe ahí
  if (depth >= (Number.isFinite(both) ? 28 : 8)) return both;
  return adaptive(fn, a, middle, left, tolerance / 2, depth + 1) + adaptive(fn, middle, b, right, tolerance / 2, depth + 1);
}

/** Integral de la función entre a y b, partida en los puntos de `cuts` (saltos, cambios de signo). NaN si no existe. */
export function integrate(fn: CompiledExpression, a: number, b: number, cuts: number[] = []): number {
  const stops = [a, ...cuts.filter(c => c > a && c < b).sort((x, y) => x - y), b];
  let total = 0;
  for (let i = 0; i + 1 < stops.length; i++) total += adaptive(fn, stops[i], stops[i + 1], gauss(fn, stops[i], stops[i + 1]), 1e-11, 0);
  return total;
}

/** Ceros de la función dentro de (a, b) donde cambia de signo, para integrar su valor absoluto por tramos. */
function signChanges(fn: CompiledExpression, a: number, b: number): number[] {
  const roots: number[] = [];
  const steps = 96;
  // Última muestra con signo: un cero que cae justo en una muestra no tiene signo y se salta
  let px = NaN;
  let py = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = i === 0 ? a + (b - a) * 1e-9 : i === steps ? b - (b - a) * 1e-9 : a + ((b - a) * i) / steps;
    const y = fn(x);
    if (!Number.isFinite(y) || y === 0) continue;
    if (Number.isFinite(py) && py * y < 0) {
      let lo = px;
      let hi = x;
      let ylo = py;
      for (let k = 0; k < 60; k++) {
        const middle = (lo + hi) / 2;
        const ym = fn(middle);
        if (!Number.isFinite(ym)) break;
        if (ylo * ym <= 0) hi = middle;
        else {
          lo = middle;
          ylo = ym;
        }
      }
      roots.push((lo + hi) / 2);
    }
    px = x;
    py = y;
  }
  return roots;
}

/* ── Región sombreada ── */

export type RiemannSample = NonNullable<GraphArea["sample"]>;

export const RIEMANN_SAMPLE_LABELS: Record<RiemannSample, string> = {
  left: "extremo izquierdo",
  right: "extremo derecho",
  midpoint: "punto medio",
};

export interface PlaneArea {
  /** Integral de f (o de f − g) entre a y b: resta lo que queda por debajo. */
  integral: number;
  /** Área de la región: lo de abajo también suma. */
  area: number;
  /** Suma de Riemann con los rectángulos pedidos, o null si no hay. */
  sum: number | null;
}

export interface RiemannRectangle {
  x0: number;
  x1: number;
  /** Altura con signo: el valor de la función en el punto de muestra. */
  y: number;
}

/** Rectángulos de la suma de Riemann de un área; vacío si no los pide. */
export function riemannRectangles(spec: GraphSpec, area: GraphArea): RiemannRectangle[] {
  const fn = planeFunction(spec, area.fn);
  const count = area.rectangles;
  if (!fn || !count || !(area.from < area.to)) return [];
  const width = (area.to - area.from) / count;
  const sample = area.sample ?? "left";
  return Array.from({ length: count }, (_, i) => {
    const x0 = area.from + width * i;
    const x1 = i === count - 1 ? area.to : area.from + width * (i + 1);
    const at = sample === "left" ? x0 : sample === "right" ? x1 : (x0 + x1) / 2;
    return { x0, x1, y: fn(at) };
  });
}

/** Abscisas de (a, b) donde la función se corta, para integrar cada tramo por separado. */
function breaksOf(spec: GraphSpec, index: number, a: number, b: number): number[] {
  const fn = spec.functions[index];
  const compiled = fn && tryCompile(fn.expr);
  if (!compiled || !compiled.ok) return [];
  return sampleFunction(compiled.fn, { xMin: a, xMax: b, yMin: spec.yMin, yMax: spec.yMax }, fn).breaks;
}

/** Integral, área y suma de Riemann de una región del plano; null si la función no existe o el intervalo está al revés. */
export function computeArea(spec: GraphSpec, area: GraphArea): PlaneArea | null {
  const f = planeFunction(spec, area.fn);
  const g = area.between === undefined ? null : planeFunction(spec, area.between);
  if (!f || (area.between !== undefined && !g) || !(area.from < area.to)) return null;
  const difference: CompiledExpression = g ? x => f(x) - g(x) : f;
  const breaks = [...breaksOf(spec, area.fn, area.from, area.to), ...(area.between === undefined ? [] : breaksOf(spec, area.between, area.from, area.to))];
  const integral = integrate(difference, area.from, area.to, breaks);

  // El área suma por tramos de signo constante
  const stops = [area.from, ...breaks.filter(c => c > area.from && c < area.to).sort((x, y) => x - y), area.to];
  let total = 0;
  for (let i = 0; i + 1 < stops.length; i++) {
    const cuts = [stops[i], ...signChanges(difference, stops[i], stops[i + 1]), stops[i + 1]];
    for (let j = 0; j + 1 < cuts.length; j++) total += Math.abs(integrate(difference, cuts[j], cuts[j + 1]));
  }

  const rectangles = riemannRectangles(spec, area);
  const sum = rectangles.length > 0 ? tidy(rectangles.reduce((acc, rectangle) => acc + rectangle.y * (rectangle.x1 - rectangle.x0), 0)) : null;
  return { integral: tidy(integral), area: tidy(total), sum };
}

export interface AreaShape {
  /** Contorno de la región: por la curva de a a b y de vuelta por la otra curva o por el eje x. */
  outline: Array<[number, number]>;
  rectangles: RiemannRectangle[];
  /** Punto del interior donde cabe el rótulo con el valor. */
  anchor: [number, number];
}

/** Puntos de la función sobre [a, b], con los saltos en vertical. */
function trace(spec: GraphSpec, index: number, a: number, b: number): Array<[number, number]> {
  const fn = spec.functions[index];
  const compiled = fn && tryCompile(fn.expr);
  if (!compiled || !compiled.ok) return [];
  return sampleFunction(compiled.fn, { xMin: a, xMax: b, yMin: spec.yMin, yMax: spec.yMax }, fn).segments.flatMap(segment => segment.points);
}

/** La región que se sombrea y sus rectángulos, en coordenadas del plano. */
export function areaShape(spec: GraphSpec, area: GraphArea): AreaShape | null {
  const f = planeFunction(spec, area.fn);
  if (!f || !(area.from < area.to)) return null;
  const top = trace(spec, area.fn, area.from, area.to);
  if (top.length < 2) return null;
  const g = area.between === undefined ? null : planeFunction(spec, area.between);
  const bottom: Array<[number, number]> = area.between === undefined ? [[area.from, 0], [area.to, 0]] : trace(spec, area.between, area.from, area.to);
  if (bottom.length < 2) return null;
  const middle = (area.from + area.to) / 2;
  const anchor: [number, number] = [middle, (f(middle) + (g ? g(middle) : 0)) / 2];
  return { outline: [...top, ...bottom.reverse()], rectangles: riemannRectangles(spec, area), anchor: [anchor[0], Number.isFinite(anchor[1]) ? anchor[1] : 0] };
}

/** El rótulo que la región lleva dentro, en LaTeX: su área, o la suma de sus rectángulos. */
export function areaLabel(spec: GraphSpec, area: GraphArea): string | null {
  if (!area.showValue) return null;
  const result = computeArea(spec, area);
  if (!result) return null;
  if (result.sum !== null) return Number.isFinite(result.sum) ? `S_{${area.rectangles}} ${measureLatex(result.sum)}` : null;
  return Number.isFinite(result.area) ? `A ${measureLatex(result.area)}` : null;
}

/* ── Comprobaciones para el validador ── */

const EPS = 1e-9;
const SCAN_STEPS = 200;

function areaIssues(spec: GraphSpec, area: GraphArea, position: number): string[] {
  const name = `la región ${position + 1}`;
  const fail = (text: string) => [`Gráfica: ${text}`];
  const fn = spec.functions[area.fn];
  if (!fn) return fail(`${name} usa la función ${area.fn}, que no existe.`);
  const other = area.between === undefined ? null : spec.functions[area.between];
  if (area.between !== undefined && !other) return fail(`${name} llega hasta la función ${area.between}, que no existe.`);
  if (area.between === area.fn) return fail(`${name} va entre una función y ella misma; para el área bajo la curva, quita between.`);
  if (!(area.from < area.to)) return fail(`en ${name}, el inicio (from) debe ser menor que el final (to).`);
  if (area.from < spec.xMin - EPS || area.to > spec.xMax + EPS) {
    return fail(`${name} va de x = ${formatNumber(area.from, 4)} a ${formatNumber(area.to, 4)} y se sale del plano, que va de ${formatNumber(spec.xMin, 4)} a ${formatNumber(spec.xMax, 4)}.`);
  }
  if (area.rectangles !== undefined && area.between !== undefined) return fail(`en ${name}, los rectángulos de Riemann van bajo una sola curva; quita rectangles o between.`);
  if (area.sample !== undefined && area.rectangles === undefined) return fail(`${name} indica dónde se mide cada rectángulo (sample) pero no cuántos son (rectangles).`);
  if (area.between === undefined && (spec.yMin > 0 || spec.yMax < 0)) return fail(`${name} llega hasta el eje x, que no se ve en este plano; amplía yMin/yMax para que incluya y = 0.`);

  const used = other ? [fn, other] : [fn];
  const issues: string[] = [];
  for (const current of used) {
    const index = spec.functions.indexOf(current);
    const source = planeFunction(spec, index);
    // Una función que no compila ya tiene su propio aviso
    if (!source) return [];
    const label = `"${current.expr}"`;
    // Dentro del intervalo abierto la función debe existir, no irse al infinito y caber en el plano
    let low = Infinity;
    let high = -Infinity;
    let missing: number | null = null;
    for (let i = 1; i < SCAN_STEPS && missing === null; i++) {
      const x = area.from + ((area.to - area.from) * i) / SCAN_STEPS;
      const y = source(x);
      // Un punto suelto sin definir es un hueco; si a su lado tampoco existe, falta un tramo
      if (!Number.isFinite(y) && oneSidedLimit(source, x, 1) === null && oneSidedLimit(source, x, -1) === null) missing = x;
      if (Number.isFinite(y)) {
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    }
    if (missing !== null) {
      const outside = !inDomain(current, missing);
      issues.push(`Gráfica: ${name} necesita ${label} en todo el intervalo, y la función no ${outside ? "llega" : "está definida ni acotada"} cerca de x = ${formatNumber(missing, 2)}. Cambia el intervalo (from, to).`);
      continue;
    }
    const pole = breaksOf(spec, index, area.from, area.to).find(c => oneSidedLimit(source, c, -1) === null || oneSidedLimit(source, c, 1) === null);
    if (pole !== undefined && pole > area.from + EPS && pole < area.to - EPS) {
      issues.push(`Gráfica: ${name} no se puede medir: ${label} no está acotada en x = ${formatNumber(pole, 4)}, dentro del intervalo. Cambia el intervalo (from, to).`);
      continue;
    }
    for (const [end, side] of [[area.from, 1], [area.to, -1]] as const) {
      const y = oneSidedLimit(source, end, side);
      if (y === null) issues.push(`Gráfica: ${name} no se puede medir: ${label} no tiende a un número en x = ${formatNumber(end, 4)}. Cambia el intervalo (from, to).`);
      else {
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    }
    if (low < spec.yMin - EPS || high > spec.yMax + EPS) {
      issues.push(`Gráfica: ${name} se sale del plano: entre x = ${formatNumber(area.from, 4)} y ${formatNumber(area.to, 4)}, ${label} va de y = ${formatNumber(low, 2)} a ${formatNumber(high, 2)}. Amplía yMin/yMax.`);
    }
  }
  if (issues.length > 0) return issues;

  const result = computeArea(spec, area);
  if (!result || !Number.isFinite(result.area) || !Number.isFinite(result.integral)) return fail(`${name} no se pudo medir en ese intervalo; cambia el intervalo (from, to).`);
  const broken = riemannRectangles(spec, area).find(rectangle => !Number.isFinite(rectangle.y));
  if (broken) return fail(`en ${name}, un rectángulo de Riemann no tiene altura: la función no está definida donde se mide; cambia sample o el intervalo.`);
  return [];
}

/** Problemas de las regiones sombreadas de un plano. */
export function planeAreaIssues(spec: GraphSpec): string[] {
  return (spec.areas ?? []).flatMap((area, index) => areaIssues(spec, area, index));
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

const interval = (area: GraphArea) => `x = ${figureNumber(area.from)} y x = ${figureNumber(area.to)}`;

/** Una línea con el área (y la suma de Riemann) de una región, escritas como salen en la figura. */
export function describeArea(spec: GraphSpec, area: GraphArea): string | null {
  const result = computeArea(spec, area);
  const fn = spec.functions[area.fn];
  if (!result || !fn || !Number.isFinite(result.area)) return null;
  const other = area.between === undefined ? null : spec.functions[area.between];
  const where = other ? `Región entre "${fn.expr}" y "${other.expr}", entre ${interval(area)}` : `Región bajo "${fn.expr}" entre ${interval(area)}`;
  const parts = [`área ${measureText(result.area)}`];
  // La integral solo se menciona cuando no coincide con el área: parte de la región queda por debajo
  if (Math.abs(result.integral - result.area) > 1e-9) parts.push(`integral ${measureText(result.integral)} (lo que queda por debajo resta)`);
  if (result.sum !== null) parts.push(`suma de Riemann con ${area.rectangles} rectángulos (${RIEMANN_SAMPLE_LABELS[area.sample ?? "left"]}) ${measureText(result.sum)}`);
  return `${where}: ${parts.join("; ")}.`;
}

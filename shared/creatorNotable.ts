import type { GraphNotable, GraphSpec } from "./creator";
import { planeFunction } from "./creatorCalculus";
import { formatNumber, type CompiledExpression } from "./creatorMath";
import { insidePlane, tidy } from "./creatorPlane";
import { planePointLatex, planePointText } from "./creatorPlaneAxes";

/**
 * Puntos notables del plano cartesiano: las raíces de una función, su corte con el eje y, sus
 * máximos y mínimos, y los cortes entre dos funciones. La IA y el docente dicen qué buscar; el
 * sistema lo halla, lo marca y escribe sus coordenadas, de modo que la figura y la clave no
 * pueden traer un vértice mal calculado.
 */

export type NotableKind = GraphNotable["kind"];
export type NotableRole = "root" | "yIntercept" | "maximum" | "minimum" | "intersection";

export const NOTABLE_KIND_LABELS: Record<NotableKind, string> = {
  roots: "Raíces (cortes con el eje x)",
  yIntercept: "Corte con el eje y",
  extrema: "Máximos y mínimos (vértice)",
  intersections: "Cortes con otra función",
};

export interface NotablePoint {
  x: number;
  y: number;
  role: NotableRole;
}

/** Puntos que puede marcar una sola petición: con más, la curva es un peine y no se leen. */
export const NOTABLE_ITEM_MAX = 12;
/** Puntos con coordenadas escritas que caben en un plano sin montarse. */
export const NOTABLE_LABELS_MAX = 12;

/** Muestras con que se recorre el rango: dos raíces a menos de 1/600 del plano no se distinguen en el dibujo. */
const SAMPLES = 600;

interface Search {
  lo: number;
  hi: number;
  xScale: number;
  yScale: number;
  pi: boolean;
}

/** El tramo de x donde se busca: el plano recortado por el dominio de las funciones que intervienen. */
function searchRange(spec: GraphSpec, indexes: number[]): Search | null {
  let lo = spec.xMin;
  let hi = spec.xMax;
  for (const index of indexes) {
    const fn = spec.functions[index];
    if (!fn) return null;
    if (fn.from !== undefined) lo = Math.max(lo, fn.from);
    if (fn.to !== undefined) hi = Math.min(hi, fn.to);
  }
  if (!(lo < hi)) return null;
  return { lo, hi, xScale: Math.max(1, Math.abs(lo), Math.abs(hi)), yScale: Math.max(1, spec.yMax - spec.yMin), pi: spec.xUnit === "pi" };
}

const grid = ({ lo, hi }: Search): number[] => Array.from({ length: SAMPLES + 1 }, (_, i) => (i === SAMPLES ? hi : lo + ((hi - lo) * i) / SAMPLES));

/**
 * Números «redondos» pegados a x: con cuatro o seis decimales y, en un plano en múltiplos de π,
 * el múltiplo de π/12 más cercano. Un método numérico llega a 1,99999999; si el número redondo
 * de al lado cumple igual o mejor, el punto es ese.
 */
function roundNeighbours(x: number, search: Search): number[] {
  // El «+ 0» quita el signo de un cero negativo
  const list = [Number(x.toFixed(4)) + 0, Number(x.toFixed(6)) + 0];
  if (search.pi) list.unshift((Math.round((x / Math.PI) * 12) / 12) * Math.PI);
  return list.filter(candidate => Math.abs(candidate - x) <= 1e-6 * search.xScale && candidate >= search.lo && candidate <= search.hi);
}

/* ── Ceros ── */

/** Cero de g entre a y b, donde cambia de signo; null si en medio la función deja de existir. */
function bisect(g: CompiledExpression, a: number, b: number, ya: number): number | null {
  let lo = a;
  let hi = b;
  let ylo = ya;
  for (let k = 0; k < 200 && hi - lo > Number.EPSILON * Math.max(1, Math.abs(lo), Math.abs(hi)); k++) {
    const middle = (lo + hi) / 2;
    const ym = g(middle);
    if (!Number.isFinite(ym)) return null;
    if (ym === 0) return middle;
    if (ylo * ym < 0) hi = middle;
    else {
      lo = middle;
      ylo = ym;
    }
  }
  return (lo + hi) / 2;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;

/** Punto de [a, b] donde fn es mínima, por la sección áurea (fn con un solo valle en el intervalo). */
function goldenMin(fn: CompiledExpression, a: number, b: number): number {
  let lo = a;
  let hi = b;
  let x1 = hi - GOLDEN * (hi - lo);
  let x2 = lo + GOLDEN * (hi - lo);
  let f1 = fn(x1);
  let f2 = fn(x2);
  for (let k = 0; k < 120 && hi - lo > 1e-13 * Math.max(1, Math.abs(lo), Math.abs(hi)); k++) {
    if (f1 <= f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - GOLDEN * (hi - lo);
      f1 = fn(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + GOLDEN * (hi - lo);
      f2 = fn(x2);
    }
  }
  return (lo + hi) / 2;
}

/**
 * Ceros de g en el tramo. Los que cruzan el eje se hallan por bisección, y lo que cambia de signo
 * sin anularse (una asíntota, un salto) se descarta; los que solo lo tocan (una raíz doble), por
 * el mínimo de |g|. `flat` avisa de que g es cero en casi todo el tramo: no hay puntos que marcar.
 */
function zerosOf(g: CompiledExpression, search: Search): { zeros: number[]; flat: boolean } {
  const xs = grid(search);
  const ys = xs.map(g);
  const zeros: number[] = [];
  const add = (x: number) => {
    if (!zeros.some(other => Math.abs(other - x) <= 1e-7 * search.xScale)) zeros.push(x);
  };
  const snap = (x: number) => roundNeighbours(x, search).find(candidate => Math.abs(g(candidate)) <= 1e-12 * search.yScale) ?? tidy(x);
  let exact = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const y = ys[i];
    if (!Number.isFinite(y)) continue;
    if (y === 0) {
      exact++;
      add(tidy(xs[i]));
      continue;
    }
    const previous = i > 0 ? ys[i - 1] : NaN;
    if (!Number.isFinite(previous) || previous === 0) continue;
    if (previous * y < 0) {
      const root = bisect(g, xs[i - 1], xs[i], previous);
      if (root !== null && Math.abs(g(root)) <= 1e-6 * search.yScale) add(snap(root));
      continue;
    }
    const next = i < SAMPLES ? ys[i + 1] : NaN;
    if (Number.isFinite(next) && next * y > 0 && Math.abs(y) < Math.abs(previous) && Math.abs(y) <= Math.abs(next)) {
      const touch = goldenMin(x => Math.abs(g(x)), xs[i - 1], xs[i + 1]);
      if (Math.abs(g(touch)) <= 1e-9 * search.yScale) add(snap(touch));
    }
  }
  return { zeros: zeros.sort((a, b) => a - b), flat: exact > SAMPLES / 2 };
}

/* ── Máximos y mínimos ── */

/**
 * Máximos y mínimos locales de f dentro del tramo, sin contar sus extremos. Sirve igual para un
 * vértice liso (una parábola) que para una esquina (|x|); un tramo constante no tiene extremos,
 * y un salto tampoco se toma por uno.
 */
function extremaOf(f: CompiledExpression, search: Search): NotablePoint[] {
  const xs = grid(search);
  const ys = xs.map(f);
  const tolerance = 1e-12 * search.yScale;
  const found: NotablePoint[] = [];
  for (const sign of [1, -1] as const) {
    const v = (k: number) => sign * ys[k];
    for (let i = 1; i < SAMPLES; i++) {
      if (!Number.isFinite(ys[i - 1]) || !Number.isFinite(ys[i]) || !(v(i) > v(i - 1) + tolerance)) continue;
      // Dos muestras a la misma altura a cada lado de la cima cuentan como una; más son una meseta
      let j = i;
      while (j < SAMPLES && Math.abs(ys[j + 1] - ys[i]) <= tolerance) j++;
      if (j - i >= 2 || j >= SAMPLES || !Number.isFinite(ys[j + 1]) || !(v(j + 1) < v(i) - tolerance)) {
        i = j;
        continue;
      }
      const rough = goldenMin(x => -sign * f(x), xs[i - 1], xs[j + 1]);
      const best = sign * f(rough);
      const x = roundNeighbours(rough, search).find(candidate => sign * f(candidate) >= best - 1e-14 * Math.max(1, Math.abs(best))) ?? tidy(rough);
      const y = f(x);
      // A los dos lados la curva sigue pegada al punto: si no, es el borde de un salto
      const delta = 1e-7 * search.xScale;
      const continuous = [x - delta, x + delta].every(near => Math.abs(f(near) - y) <= 1e-4 * search.yScale);
      if (Number.isFinite(y) && continuous) found.push({ x, y: tidy(y), role: sign === 1 ? "maximum" : "minimum" });
      i = j;
    }
  }
  return found.sort((a, b) => a.x - b.x);
}

/* ── Los puntos de una petición ── */

export interface NotableResult {
  points: NotablePoint[];
  /** Tramo de x donde se buscó. */
  lo: number;
  hi: number;
  /** La función vale cero (o las dos coinciden) en casi todo el tramo: no hay puntos sueltos que marcar. */
  flat: boolean;
}

/** Los puntos que pide una entrada de `notable`; null si sus funciones no existen, no compilan o no se cruzan sus dominios con el plano. */
export function findNotable(spec: GraphSpec, item: GraphNotable): NotableResult | null {
  const f = planeFunction(spec, item.fn);
  if (!f) return null;
  if (item.kind === "intersections") {
    const other = item.with === undefined || item.with === item.fn ? null : planeFunction(spec, item.with);
    const search = other && searchRange(spec, [item.fn, item.with!]);
    if (!other || !search) return null;
    const { zeros, flat } = zerosOf(x => f(x) - other(x), search);
    return { points: zeros.map(x => ({ x, y: tidy(f(x)), role: "intersection" as const })), lo: search.lo, hi: search.hi, flat };
  }
  const search = searchRange(spec, [item.fn]);
  if (!search) return null;
  const base = { lo: search.lo, hi: search.hi, flat: false };
  switch (item.kind) {
    case "roots": {
      const { zeros, flat } = zerosOf(f, search);
      return { ...base, points: zeros.map(x => ({ x, y: 0, role: "root" as const })), flat };
    }
    case "yIntercept": {
      const y = f(0);
      return { ...base, points: Number.isFinite(y) ? [{ x: 0, y: tidy(y), role: "yIntercept" }] : [] };
    }
    case "extrema":
      return { ...base, points: extremaOf(f, search) };
  }
}

export interface ShownNotable extends NotablePoint {
  /** Función a la que pertenece: de ella toma el color. */
  fn: number;
  /** Coordenadas en LaTeX, o null si el punto va sin rótulo. */
  label: string | null;
}

/** Todos los puntos notables que el plano debe dibujar, sin repetir el que sale por dos peticiones. */
export function shownNotablePoints(spec: GraphSpec): ShownNotable[] {
  const shown: ShownNotable[] = [];
  for (const item of spec.notable ?? []) {
    const result = findNotable(spec, item);
    if (!result || result.flat) continue;
    for (const point of result.points.slice(0, NOTABLE_ITEM_MAX)) {
      if (!insidePlane(spec, point.x, point.y)) continue;
      const label = item.labels === false ? null : planePointLatex(spec, point.x, point.y);
      const twin = shown.find(other => Math.abs(other.x - point.x) <= 1e-7 * Math.max(1, Math.abs(point.x)) && Math.abs(other.y - point.y) <= 1e-7 * Math.max(1, Math.abs(point.y)));
      if (!twin) shown.push({ ...point, fn: item.fn, label });
      else twin.label ??= label;
    }
  }
  return shown;
}

/* ── Comprobaciones para el validador ── */

const ROLE_NAMES: Record<NotableRole, string> = { root: "la raíz", yIntercept: "el corte con el eje y", maximum: "el máximo", minimum: "el mínimo", intersection: "el corte" };
const point4 = (x: number, y: number) => `(${formatNumber(x, 4)}, ${formatNumber(y, 4)})`;

function notableIssues(spec: GraphSpec, item: GraphNotable): string[] {
  const fail = (text: string) => [`Gráfica: ${text}`];
  const fn = spec.functions[item.fn];
  if (!fn) return fail(`un punto notable usa la función ${item.fn}, que no existe.`);
  const name = `"${fn.expr}"`;
  if (item.kind === "intersections") {
    if (item.with === undefined) return fail(`para marcar los cortes de ${name} con otra función (kind "intersections") indica cuál en with.`);
    if (item.with === item.fn) return fail(`los cortes (kind "intersections") son entre dos funciones distintas, y fn y with apuntan a la misma (${item.fn}).`);
    if (!spec.functions[item.with]) return fail(`los cortes de ${name} son con la función ${item.with}, que no existe.`);
  } else if (item.with !== undefined) {
    return fail(`with solo va con kind "intersections"; quítalo de los puntos notables de ${name} (kind "${item.kind}").`);
  }
  const other = item.kind === "intersections" ? spec.functions[item.with!] : null;
  const both = other ? `${name} y "${other.expr}"` : name;
  // Una función que no compila ya tiene su propio aviso
  if (!planeFunction(spec, item.fn) || (other && !planeFunction(spec, item.with!))) return [];

  const result = findNotable(spec, item);
  if (!result) return fail(`${both} no ${other ? "comparten ningún tramo de x" : "tiene ningún tramo"} dentro del plano, así que no hay puntos notables que buscar.`);
  const range = `entre x = ${formatNumber(result.lo, 4)} y x = ${formatNumber(result.hi, 4)}`;
  const drop = `quita "${item.kind}" de notable`;

  if (item.kind === "roots" && (spec.yMin > 0 || spec.yMax < 0)) return fail(`las raíces de ${name} están sobre el eje x, que no se ve en este plano; amplía yMin/yMax para que incluya y = 0 o ${drop}.`);
  if (item.kind === "yIntercept" && (spec.xMin > 0 || spec.xMax < 0)) return fail(`el corte de ${name} con el eje y está en x = 0, que no se ve en este plano; amplía xMin/xMax o ${drop}.`);
  if (result.flat) return fail(other ? `${both} coinciden en todo el tramo ${range}: no hay cortes sueltos que marcar; ${drop}.` : `${name} vale 0 en todo el tramo ${range}: no hay raíces sueltas que marcar; ${drop}.`);

  if (result.points.length === 0) {
    switch (item.kind) {
      case "roots":
        return fail(`${name} no tiene raíces ${range}, así que no hay nada que marcar; cambia el rango o ${drop}.`);
      case "yIntercept":
        return fail(`${name} no está definida en x = 0, así que no corta el eje y; ${drop}.`);
      case "extrema":
        return fail(`${name} no tiene máximos ni mínimos ${range} (sin contar los bordes), así que no hay nada que marcar; cambia el rango o ${drop}.`);
      case "intersections":
        return fail(`${both} no se cortan ${range}, así que no hay nada que marcar; cambia el rango o ${drop}.`);
    }
  }
  if (result.points.length > NOTABLE_ITEM_MAX) return fail(`${both} ${other ? "tienen" : "tiene"} ${result.points.length} puntos de "${item.kind}" ${range} y no se distinguirían; reduce el rango de x.`);

  const issues: string[] = [];
  for (const point of result.points) {
    if (!insidePlane(spec, point.x, point.y)) issues.push(`Gráfica: ${ROLE_NAMES[point.role]} ${point4(point.x, point.y)} de ${both} queda fuera del plano; amplía yMin/yMax o ${drop}.`);
  }
  return issues;
}

/** Problemas de los puntos notables de un plano. */
export function planeNotableIssues(spec: GraphSpec): string[] {
  const items = spec.notable ?? [];
  const issues = items.flatMap(item => notableIssues(spec, item));
  if (issues.length > 0) return issues;
  const labeled = shownNotablePoints(spec).filter(point => point.label !== null).length;
  if (labeled > NOTABLE_LABELS_MAX) {
    issues.push(`Gráfica: hay ${labeled} puntos notables con sus coordenadas escritas y caben ${NOTABLE_LABELS_MAX} sin montarse; pide menos, reduce el rango de x o deja algunos sin coordenadas (labels en false).`);
  }
  return issues;
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`);

/** Una línea con los puntos que halló el sistema, escritos como salen en la figura. */
export function describeNotable(spec: GraphSpec, item: GraphNotable): string | null {
  const fn = spec.functions[item.fn];
  const result = findNotable(spec, item);
  if (!fn || !result || result.flat || result.points.length === 0) return null;
  const text = (point: NotablePoint) => planePointText(spec, point.x, point.y);
  const points = result.points.slice(0, NOTABLE_ITEM_MAX);
  switch (item.kind) {
    case "roots":
      return `Raíces de "${fn.expr}" (cortes con el eje x): ${list(points.map(text))}.`;
    case "yIntercept":
      return `Corte de "${fn.expr}" con el eje y: ${text(points[0])}.`;
    case "extrema":
      return `Extremos de "${fn.expr}": ${list(points.map(point => `${point.role === "maximum" ? "máximo" : "mínimo"} en ${text(point)}`))}.`;
    case "intersections":
      return `Cortes entre "${fn.expr}" y "${spec.functions[item.with!]?.expr}": ${list(points.map(text))}.`;
  }
}

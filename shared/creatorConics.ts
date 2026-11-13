import type { GraphConic, GraphSpec } from "./creator";
import { formatNumber } from "./creatorMath";
import { figureNumber as numberEs, figureNumberLatex as numberLatex, hasEqualUnits, isExactNumber as isExact, PLANE_EQUAL_UNITS, type PlaneRange } from "./creatorPlane";

/**
 * Cónicas del plano cartesiano: circunferencia, elipse, parábola e hipérbola dadas por sus
 * parámetros. De ellos salen la curva, el centro, los focos, los vértices, la directriz, las
 * asíntotas y la ecuación canónica: la IA y el docente indican el centro y los semiejes, y lo
 * demás lo calcula el sistema, de modo que la figura y la clave no pueden contradecirse.
 */

export type ConicKind = GraphConic["kind"];
export type ConicShow = NonNullable<GraphConic["show"]>[number];

export const CONIC_LABELS: Record<ConicKind, string> = {
  circle: "Circunferencia",
  ellipse: "Elipse",
  parabola: "Parábola",
  hyperbola: "Hipérbola",
};

/** Lo que cada cónica puede mostrar; pedir otra cosa (las asíntotas de una elipse) es un error. */
export const CONIC_SHOWS: Record<ConicKind, readonly ConicShow[]> = {
  circle: ["equation", "center"],
  ellipse: ["equation", "center", "foci", "vertices"],
  parabola: ["equation", "foci", "vertices", "directrix"],
  hyperbola: ["equation", "center", "foci", "vertices", "asymptotes"],
};

export const CONIC_SHOW_LABELS: Record<ConicShow, string> = {
  equation: "Ecuación",
  center: "Centro",
  foci: "Focos",
  vertices: "Vértices",
  directrix: "Directriz",
  asymptotes: "Asíntotas",
};

export interface ConicPoint {
  x: number;
  y: number;
  /** Nombre en LaTeX: C, F_{1}, V_{2}. */
  name: string;
  role: "center" | "focus" | "vertex" | "covertex";
}

/** Recta auxiliar de una cónica: vertical (x = `vertical`) o y = slope·x + intercept. */
export interface ConicLine {
  role: "directrix" | "asymptote";
  vertical?: number;
  slope?: number;
  intercept?: number;
}

export interface ConicElements {
  points: ConicPoint[];
  lines: ConicLine[];
  /** Distancia del centro a cada foco (c); en la parábola, del vértice al foco (|p|). */
  focal: number | null;
}

/** Quita el ruido binario de un producto o una raíz: 2.5² = 6.25, no 6.250000000000001. */
const clean = (value: number) => Number(value.toPrecision(12));
const square = (value: number) => clean(value * value);

/** Decimales con que se puede escribir exacto un número de la ecuación (los de `isExactNumber`). */
const EQUATION_DECIMALS = 4;

/* ── Elementos ── */

const pair = (name: string, role: ConicPoint["role"], first: [number, number], second: [number, number]): ConicPoint[] => [
  { x: first[0], y: first[1], name: `${name}_{1}`, role },
  { x: second[0], y: second[1], name: `${name}_{2}`, role },
];

/** Centro, focos, vértices, directriz y asíntotas de una cónica, todos los que tenga. */
export function conicElements(conic: GraphConic): ConicElements {
  const { h, k } = conic;
  switch (conic.kind) {
    case "circle":
      return { points: [{ x: h, y: k, name: "C", role: "center" }], lines: [], focal: null };
    case "ellipse": {
      // El eje mayor es el del semieje más largo: ahí van los vértices y los focos
      const horizontal = conic.rx >= conic.ry;
      const major = horizontal ? conic.rx : conic.ry;
      const minor = horizontal ? conic.ry : conic.rx;
      const c = clean(Math.sqrt(Math.max(0, square(major) - square(minor))));
      const along = (d: number): [number, number] => (horizontal ? [clean(h + d), k] : [h, clean(k + d)]);
      const across = (d: number): [number, number] => (horizontal ? [h, clean(k + d)] : [clean(h + d), k]);
      return {
        points: [
          { x: h, y: k, name: "C", role: "center" },
          ...pair("V", "vertex", along(-major), along(major)),
          ...pair("B", "covertex", across(-minor), across(minor)),
          ...pair("F", "focus", along(-c), along(c)),
        ],
        lines: [],
        focal: c,
      };
    }
    case "parabola": {
      const vertical = conic.axis === "vertical";
      const focus: [number, number] = vertical ? [h, clean(k + conic.p)] : [clean(h + conic.p), k];
      return {
        points: [
          { x: h, y: k, name: "V", role: "vertex" },
          { x: focus[0], y: focus[1], name: "F", role: "focus" },
        ],
        lines: [vertical ? { role: "directrix", slope: 0, intercept: clean(k - conic.p) } : { role: "directrix", vertical: clean(h - conic.p) }],
        focal: Math.abs(conic.p),
      };
    }
    case "hyperbola": {
      const horizontal = conic.axis === "horizontal";
      const c = clean(Math.sqrt(square(conic.a) + square(conic.b)));
      const along = (d: number): [number, number] => (horizontal ? [clean(h + d), k] : [h, clean(k + d)]);
      const slope = horizontal ? conic.b / conic.a : conic.a / conic.b;
      return {
        points: [{ x: h, y: k, name: "C", role: "center" }, ...pair("V", "vertex", along(-conic.a), along(conic.a)), ...pair("F", "focus", along(-c), along(c))],
        lines: [slope, -slope].map(m => ({ role: "asymptote" as const, slope: m, intercept: clean(k - m * h) })),
        focal: c,
      };
    }
  }
}

const shows = (conic: GraphConic, item: ConicShow) => (conic.show ?? []).includes(item);

/** Los puntos y rectas que la cónica pide dibujar (show), ya calculados. */
export function shownConicElements(conic: GraphConic): { points: ConicPoint[]; lines: ConicLine[] } {
  const all = conicElements(conic);
  return {
    points: all.points.filter(
      point => (point.role === "center" && shows(conic, "center")) || (point.role === "focus" && shows(conic, "foci")) || ((point.role === "vertex" || point.role === "covertex") && shows(conic, "vertices")),
    ),
    lines: all.lines.filter(line => (line.role === "directrix" && shows(conic, "directrix")) || (line.role === "asymptote" && shows(conic, "asymptotes"))),
  };
}

/* ── Ecuación canónica ── */

const squaredTerm = (variable: string, shift: number) => (shift === 0 ? `${variable}^{2}` : `(${variable} ${shift > 0 ? "-" : "+"} ${numberLatex(Math.abs(shift))})^{2}`);
const linearTerm = (variable: string, shift: number) => (shift === 0 ? variable : `${variable} ${shift > 0 ? "-" : "+"} ${numberLatex(Math.abs(shift))}`);
const over = (top: string, denominator: number) => (denominator === 1 ? top : `\\frac{${top}}{${numberLatex(denominator)}}`);

/** Los números que aparecen en la ecuación canónica: todos deben poder escribirse exactos. */
function equationNumbers(conic: GraphConic): number[] {
  switch (conic.kind) {
    case "circle":
      return [conic.h, conic.k, square(conic.r)];
    case "ellipse":
      return [conic.h, conic.k, square(conic.rx), square(conic.ry)];
    case "parabola":
      return [conic.h, conic.k, clean(4 * conic.p)];
    case "hyperbola":
      return [conic.h, conic.k, square(conic.a), square(conic.b)];
  }
}

/**
 * Ecuación canónica en LaTeX, o null si alguno de sus números no se puede escribir exacto
 * (un radio 2,236 daría r² = 4,999696: eso no es la ecuación que el docente tiene en mente).
 */
export function conicEquation(conic: GraphConic): string | null {
  if (!equationNumbers(conic).every(isExact)) return null;
  const { h, k } = conic;
  switch (conic.kind) {
    case "circle":
      return `${squaredTerm("x", h)} + ${squaredTerm("y", k)} = ${numberLatex(square(conic.r))}`;
    case "ellipse":
      return `${over(squaredTerm("x", h), square(conic.rx))} + ${over(squaredTerm("y", k), square(conic.ry))} = 1`;
    case "parabola": {
      const vertical = conic.axis === "vertical";
      const coefficient = clean(4 * conic.p);
      const shift = vertical ? k : h;
      const linear = linearTerm(vertical ? "y" : "x", shift);
      const grouped = shift === 0 ? linear : `(${linear})`;
      const right = coefficient === 1 ? linear : coefficient === -1 ? `-${grouped}` : `${numberLatex(coefficient)}${grouped}`;
      return `${squaredTerm(vertical ? "x" : "y", vertical ? h : k)} = ${right}`;
    }
    case "hyperbola": {
      const x = squaredTerm("x", h);
      const y = squaredTerm("y", k);
      return conic.axis === "horizontal" ? `${over(x, square(conic.a))} - ${over(y, square(conic.b))} = 1` : `${over(y, square(conic.a))} - ${over(x, square(conic.b))} = 1`;
    }
  }
}

/* ── Curva ── */

const ARC_STEPS = 180;
const BRANCH_STEPS = 240;

/** Tramos de la cónica para dibujarla: uno cerrado para la circunferencia y la elipse, dos ramas para la hipérbola. */
export function conicCurves(conic: GraphConic, range: PlaneRange): Array<Array<[number, number]>> {
  const { h, k } = conic;
  const width = range.xMax - range.xMin;
  const height = range.yMax - range.yMin;
  // Las ramas abiertas se dibujan un poco más allá del plano, que las recorta
  const xs = (step: number) => range.xMin - width * 0.05 + (width * 1.1 * step) / BRANCH_STEPS;
  const ys = (step: number) => range.yMin - height * 0.05 + (height * 1.1 * step) / BRANCH_STEPS;
  const steps = Array.from({ length: BRANCH_STEPS + 1 }, (_, step) => step);
  switch (conic.kind) {
    case "circle":
    case "ellipse": {
      const rx = conic.kind === "circle" ? conic.r : conic.rx;
      const ry = conic.kind === "circle" ? conic.r : conic.ry;
      return [Array.from({ length: ARC_STEPS + 1 }, (_, step): [number, number] => [h + rx * Math.cos((2 * Math.PI * step) / ARC_STEPS), k + ry * Math.sin((2 * Math.PI * step) / ARC_STEPS)])];
    }
    case "parabola":
      if (!(conic.p !== 0)) return [];
      return conic.axis === "vertical"
        ? [steps.map((step): [number, number] => [xs(step), k + (xs(step) - h) ** 2 / (4 * conic.p)])]
        : [steps.map((step): [number, number] => [h + (ys(step) - k) ** 2 / (4 * conic.p), ys(step)])];
    case "hyperbola": {
      const { a, b } = conic;
      return conic.axis === "horizontal"
        ? [-1, 1].map(sign => steps.map((step): [number, number] => [h + sign * a * Math.sqrt(1 + ((ys(step) - k) / b) ** 2), ys(step)]))
        : [-1, 1].map(sign => steps.map((step): [number, number] => [xs(step), k + sign * a * Math.sqrt(1 + ((xs(step) - h) / b) ** 2)]));
    }
  }
}

/* ── Comprobaciones para el validador ── */

const EPS = 1e-9;
const insidePlane = (spec: PlaneRange, x: number, y: number) => x >= spec.xMin - EPS && x <= spec.xMax + EPS && y >= spec.yMin - EPS && y <= spec.yMax + EPS;
const point4 = (x: number, y: number) => `(${formatNumber(x, 4)}, ${formatNumber(y, 4)})`;

const POINT_NAMES: Record<ConicPoint["role"], string> = { center: "el centro", focus: "el foco", vertex: "el vértice", covertex: "el covértice" };
const SHOW_OF_ROLE: Record<ConicPoint["role"], ConicShow> = { center: "center", focus: "foci", vertex: "vertices", covertex: "vertices" };

function conicIssues(conic: GraphConic, spec: GraphSpec): string[] {
  const name = CONIC_LABELS[conic.kind];
  const article = "la";
  const issues: string[] = [];
  const say = (text: string) => issues.push(`Gráfica: ${text}`);

  for (const item of conic.show ?? []) {
    if (!CONIC_SHOWS[conic.kind].includes(item)) say(`${article} ${name.toLowerCase()} no tiene "${item}"; en show admite ${CONIC_SHOWS[conic.kind].map(value => `"${value}"`).join(", ")}.`);
  }

  if (conic.kind === "circle" || conic.kind === "ellipse") {
    const rx = conic.kind === "circle" ? conic.r : conic.rx;
    const ry = conic.kind === "circle" ? conic.r : conic.ry;
    if (conic.kind === "ellipse" && rx === ry) say(`una elipse con los dos semiejes iguales (${formatNumber(rx, 4)}) es una circunferencia; usa kind "circle" con r = ${formatNumber(rx, 4)}.`);
    if (!insidePlane(spec, conic.h - rx, conic.k - ry) || !insidePlane(spec, conic.h + rx, conic.k + ry)) {
      say(
        `${article} ${name.toLowerCase()} de centro ${point4(conic.h, conic.k)} se sale del plano: ocupa de x = ${formatNumber(conic.h - rx, 4)} a ${formatNumber(conic.h + rx, 4)} y de y = ${formatNumber(conic.k - ry, 4)} a ${formatNumber(conic.k + ry, 4)}. Amplía el rango del plano.`,
      );
    }
  }
  if (conic.kind === "parabola") {
    if (conic.p === 0) return [`Gráfica: en la parábola, p no puede ser 0: es la distancia del vértice al foco.`];
    if (!insidePlane(spec, conic.h, conic.k)) say(`el vértice ${point4(conic.h, conic.k)} de la parábola queda fuera del plano; amplía el rango.`);
  }
  if (conic.kind === "hyperbola") {
    for (const vertex of conicElements(conic).points.filter(point => point.role === "vertex")) {
      if (!insidePlane(spec, vertex.x, vertex.y)) say(`el vértice ${point4(vertex.x, vertex.y)} de la hipérbola queda fuera del plano; amplía el rango.`);
    }
  }

  // Lo que se pide mostrar tiene que caber en el plano
  const shown = shownConicElements(conic);
  for (const point of shown.points) {
    if (insidePlane(spec, point.x, point.y)) continue;
    // Los vértices de la parábola y de la hipérbola ya se revisaron arriba
    if (point.role === "vertex" && conic.kind !== "ellipse") continue;
    say(`${POINT_NAMES[point.role]} ${point4(point.x, point.y)} de ${article} ${name.toLowerCase()} queda fuera del plano; amplía el rango o quita "${SHOW_OF_ROLE[point.role]}" de show.`);
  }
  for (const line of shown.lines) {
    if (line.role !== "directrix") continue;
    const outside = line.vertical !== undefined ? line.vertical < spec.xMin || line.vertical > spec.xMax : line.intercept! < spec.yMin || line.intercept! > spec.yMax;
    if (outside) say(`la directriz ${line.vertical !== undefined ? `x = ${formatNumber(line.vertical, 4)}` : `y = ${formatNumber(line.intercept!, 4)}`} de la parábola queda fuera del plano; amplía el rango o quita "directrix" de show.`);
  }

  if (shows(conic, "equation") && conicEquation(conic) === null) {
    const culprit = equationNumbers(conic).find(value => !isExact(value))!;
    say(
      `la ecuación de ${article} ${name.toLowerCase()} no se puede escribir exacta: uno de sus números es ${formatNumber(culprit, 6)}… Usa parámetros cuyo cuadrado tenga a lo sumo ${EQUATION_DECIMALS} decimales, o quita "equation" de show y escribe la ecuación en el pie (caption).`,
    );
  }
  return issues;
}

/** Problemas de las cónicas de un plano: que quepan, que lo que muestran exista y que el plano no las deforme. */
export function planeConicIssues(spec: GraphSpec): string[] {
  const conics = spec.conics ?? [];
  if (conics.length === 0) return [];
  const issues: string[] = [];
  const xSpan = spec.xMax - spec.xMin;
  const ySpan = spec.yMax - spec.yMin;
  if (!hasEqualUnits(xSpan, ySpan)) {
    issues.push(
      `Gráfica: con cónicas el plano debe tener la misma unidad en los dos ejes para no deformarlas, y este rango es demasiado ${ySpan > xSpan ? "alto" : "ancho"}: el alto (yMax − yMin = ${formatNumber(ySpan, 4)}) debe estar entre ${formatNumber(PLANE_EQUAL_UNITS.min)} y ${formatNumber(PLANE_EQUAL_UNITS.max)} veces el ancho (xMax − xMin = ${formatNumber(xSpan, 4)}).`,
    );
  }
  for (const conic of conics) issues.push(...conicIssues(conic, spec));
  return issues;
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

const hasComma = (text: string) => text.includes(",");

/** Un punto como se escribe en Colombia: con punto y coma cuando alguna coordenada lleva coma decimal. */
export function pointText(x: number, y: number): string {
  const a = numberEs(x);
  const b = numberEs(y);
  return `(${a}${hasComma(a) || hasComma(b) ? ";" : ","} ${b})`;
}

const approx = (value: number) => (isExact(value) ? "" : "≈ ");
const namedPoint = (point: ConicPoint) => `${point.name.replace(/[{}]/g, "")}${approx(point.x) || approx(point.y) ? " ≈ " : ""}${pointText(point.x, point.y)}`;
const listPoints = (points: ConicPoint[]) => points.map(namedPoint).join(" y ");

/** La distancia focal: exacta, como raíz (c = √13 ≈ 3,61) o aproximada. */
function focalText(squared: number, c: number): string {
  if (isExact(c)) return `c = ${numberEs(c)}`;
  return isExact(squared) ? `c = √${numberEs(squared)} ≈ ${numberEs(c)}` : `c ≈ ${numberEs(c)}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Pendiente de las asíntotas como fracción de los semiejes, simplificada si son enteros. */
function slopeLatex(top: number, bottom: number): string {
  const fraction = (n: number, d: number) => {
    const divisor = gcd(n, d);
    return d === divisor ? (n === d ? "" : String(n / divisor)) : `\\frac{${n / divisor}}{${d / divisor}}`;
  };
  // Con semiejes enteros, la fracción b/a de clase (3/2, no 1,5)
  if (Number.isInteger(top) && Number.isInteger(bottom)) return fraction(top, bottom);
  const ratio = clean(top / bottom);
  if (isExact(ratio)) return ratio === 1 ? "" : numberLatex(ratio);
  // Semiejes con decimales cuya razón no es exacta (2 y 1,5) se llevan a enteros: 20/15 = 4/3
  for (const scale of [10, 100, 1000, 10000]) {
    const n = clean(top * scale);
    const d = clean(bottom * scale);
    if (!Number.isInteger(n) || !Number.isInteger(d)) continue;
    const divisor = gcd(n, d);
    return `\\frac{${n / divisor}}{${d / divisor}}`;
  }
  return `\\frac{${numberLatex(top)}}{${numberLatex(bottom)}}`;
}

/** Las dos asíntotas de una hipérbola en una sola fórmula: y − k = ±(b/a)(x − h). */
export function asymptotesLatex(conic: Extract<GraphConic, { kind: "hyperbola" }>): string {
  const slope = conic.axis === "horizontal" ? slopeLatex(conic.b, conic.a) : slopeLatex(conic.a, conic.b);
  const x = conic.h === 0 ? "x" : `(${linearTerm("x", conic.h)})`;
  return `${linearTerm("y", conic.k)} = \\pm ${slope}${x}`;
}

/** Una línea con los elementos de la cónica, para que la clave de respuestas use los mismos que la figura. */
export function describeConic(conic: GraphConic): string {
  const elements = conicElements(conic);
  const equation = conicEquation(conic);
  const parts: string[] = [];
  const of = (role: ConicPoint["role"]) => elements.points.filter(point => point.role === role);
  switch (conic.kind) {
    case "circle":
      parts.push(`centro ${pointText(conic.h, conic.k)}`, `radio ${numberEs(conic.r)}`);
      break;
    case "ellipse":
      parts.push(
        `centro ${pointText(conic.h, conic.k)}`,
        `eje mayor ${conic.rx >= conic.ry ? "horizontal" : "vertical"}`,
        `vértices ${listPoints(of("vertex"))}`,
        `covértices ${listPoints(of("covertex"))}`,
        `focos ${listPoints(of("focus"))} (${focalText(Math.abs(square(conic.rx) - square(conic.ry)), elements.focal!)})`,
      );
      break;
    case "parabola": {
      const directrix = elements.lines[0];
      parts.push(
        `vértice ${pointText(conic.h, conic.k)}`,
        `foco ${pointText(of("focus")[0].x, of("focus")[0].y)}`,
        `directriz ${directrix.vertical !== undefined ? `x = ${numberEs(directrix.vertical)}` : `y = ${numberEs(directrix.intercept!)}`}`,
        `abre hacia ${conic.axis === "vertical" ? (conic.p > 0 ? "arriba" : "abajo") : conic.p > 0 ? "la derecha" : "la izquierda"}`,
      );
      break;
    }
    case "hyperbola":
      parts.push(
        `centro ${pointText(conic.h, conic.k)}`,
        `eje transversal ${conic.axis === "horizontal" ? "horizontal" : "vertical"}`,
        `vértices ${listPoints(of("vertex"))}`,
        `focos ${listPoints(of("focus"))} (${focalText(square(conic.a) + square(conic.b), elements.focal!)})`,
        `asíntotas $${asymptotesLatex(conic)}$`,
      );
      break;
  }
  if (equation) parts.push(`ecuación $${equation}$`);
  return `${CONIC_LABELS[conic.kind]}: ${parts.join(", ")}.`;
}

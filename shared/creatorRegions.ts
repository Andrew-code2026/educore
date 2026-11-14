import type { GraphInequality, GraphSpec } from "./creator";
import { formatNumber } from "./creatorMath";
import { figureNumber, figureNumberLatex, insidePlane, isExactNumber, tidy } from "./creatorPlane";
import { planePointText } from "./creatorPlaneAxes";

/**
 * Regiones de inecuaciones lineales con dos variables: el semiplano de cada a·x + b·y ≤ c, con
 * su frontera continua o punteada, y la región común de varias (la región factible de un
 * problema de programación lineal) con sus vértices. Se dan los coeficientes; la región, los
 * vértices y si es acotada los calcula el sistema.
 */

export type InequalityOp = GraphInequality["op"];
export type RegionShade = NonNullable<GraphSpec["inequalityShade"]>;
export type Pair = [number, number];

export const REGION_SHADE_LABELS: Record<RegionShade, string> = {
  common: "La región común",
  each: "Cada semiplano",
  none: "Nada (solo las fronteras)",
};

export const INEQUALITY_OP_LABELS: Record<InequalityOp, string> = { "<": "<", "<=": "≤", ">": ">", ">=": "≥" };

/** Una frontera punteada no pertenece a la solución. */
export const isStrict = (op: InequalityOp): boolean => op === "<" || op === ">";

/** La inecuación llevada a la forma a·x + b·y ≤ c: las de «mayor que» cambian de signo. */
function normal(inequality: GraphInequality): { a: number; b: number; c: number } {
  const flip = inequality.op === ">" || inequality.op === ">=" ? -1 : 1;
  return { a: flip * inequality.a, b: flip * inequality.b, c: flip * inequality.c };
}

const clean = (value: number): number => tidy(Number(value.toPrecision(12))) + 0;

/* ── Regiones ── */

/** Recorta un polígono convexo con el semiplano a·x + b·y ≤ c (Sutherland–Hodgman). */
function clip(polygon: Pair[], half: { a: number; b: number; c: number }): Pair[] {
  const side = ([x, y]: Pair) => half.a * x + half.b * y - half.c;
  const result: Pair[] = [];
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const s0 = side(current);
    const s1 = side(next);
    if (s0 <= 0) result.push(current);
    if ((s0 < 0 && s1 > 0) || (s0 > 0 && s1 < 0)) {
      const t = s0 / (s0 - s1);
      result.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t]);
    }
  });
  return result;
}

const rectangle = (xMin: number, xMax: number, yMin: number, yMax: number): Pair[] => [
  [xMin, yMin],
  [xMax, yMin],
  [xMax, yMax],
  [xMin, yMax],
];

const areaOf = (polygon: Pair[]): number => Math.abs(polygon.reduce((sum, [x, y], index) => sum + x * polygon[(index + 1) % polygon.length][1] - polygon[(index + 1) % polygon.length][0] * y, 0)) / 2;

/** La parte del plano que cumple una inecuación, como polígono. */
export function halfPlaneRegion(spec: GraphSpec, inequality: GraphInequality): Pair[] {
  return clip(rectangle(spec.xMin, spec.xMax, spec.yMin, spec.yMax), normal(inequality));
}

/** La parte del plano que cumple todas las inecuaciones; vacía si no hay ninguna o no tienen puntos en común a la vista. */
export function commonRegion(spec: GraphSpec): Pair[] {
  const inequalities = spec.inequalities ?? [];
  if (inequalities.length === 0) return [];
  const region = inequalities.reduce((polygon, inequality) => (polygon.length === 0 ? polygon : clip(polygon, normal(inequality))), rectangle(spec.xMin, spec.xMax, spec.yMin, spec.yMax));
  const whole = (spec.xMax - spec.xMin) * (spec.yMax - spec.yMin);
  return areaOf(region) > 1e-9 * whole ? region : [];
}

/** El tramo de la frontera a·x + b·y = c que cruza el plano: sus dos extremos, o null si no pasa por él. */
export function boundarySegment(spec: GraphSpec, inequality: GraphInequality): [Pair, Pair] | null {
  const { a, b, c } = inequality;
  if (a === 0 && b === 0) return null;
  const points: Pair[] = [];
  const add = (x: number, y: number) => {
    if (insidePlane(spec, x, y) && !points.some(([px, py]) => Math.abs(px - x) < 1e-9 && Math.abs(py - y) < 1e-9)) points.push([x, y]);
  };
  if (b !== 0) for (const x of [spec.xMin, spec.xMax]) add(x, (c - a * x) / b);
  if (a !== 0) for (const y of [spec.yMin, spec.yMax]) add((c - b * y) / a, y);
  return points.length >= 2 ? [points[0], points[1]] : null;
}

export interface RegionVertex {
  x: number;
  y: number;
  /** El vértice está sobre una frontera punteada: no pertenece a la región. */
  open: boolean;
}

/**
 * Vértices de la región común: los puntos donde se cortan dos fronteras y que cumplen las demás
 * inecuaciones. Son los de la región entera, no los de su recorte por el borde del plano, y
 * salen ordenados alrededor de ella.
 */
export function regionVertices(spec: GraphSpec): RegionVertex[] {
  const inequalities = spec.inequalities ?? [];
  const halves = inequalities.map(normal);
  const vertices: RegionVertex[] = [];
  for (let i = 0; i < halves.length; i++) {
    for (let j = i + 1; j < halves.length; j++) {
      const p = halves[i];
      const q = halves[j];
      const det = p.a * q.b - q.a * p.b;
      if (Math.abs(det) <= 1e-12 * Math.max(1, Math.abs(p.a * q.b), Math.abs(q.a * p.b))) continue;
      const x = clean((p.c * q.b - q.c * p.b) / det);
      const y = clean((p.a * q.c - q.a * p.c) / det);
      const slack = (half: { a: number; b: number; c: number }) => (half.a * x + half.b * y - half.c) / Math.max(1, Math.abs(half.c), Math.abs(half.a * x), Math.abs(half.b * y));
      if (halves.some(half => slack(half) > 1e-9)) continue;
      const open = inequalities.some((inequality, at) => isStrict(inequality.op) && Math.abs(slack(halves[at])) <= 1e-9);
      const twin = vertices.find(other => Math.abs(other.x - x) <= 1e-9 * Math.max(1, Math.abs(x)) && Math.abs(other.y - y) <= 1e-9 * Math.max(1, Math.abs(y)));
      if (twin) twin.open ||= open;
      else vertices.push({ x, y, open });
    }
  }
  if (vertices.length < 3) return vertices.sort((u, v) => u.x - v.x || u.y - v.y);
  const cx = vertices.reduce((sum, vertex) => sum + vertex.x, 0) / vertices.length;
  const cy = vertices.reduce((sum, vertex) => sum + vertex.y, 0) / vertices.length;
  const around = [...vertices].sort((u, v) => Math.atan2(u.y - cy, u.x - cx) - Math.atan2(v.y - cy, v.x - cx));

  // Una región no acotada es una cadena abierta: sus vértices se dan de un extremo al otro, en el orden
  // en que se recorre su borde, no girando alrededor de su centro
  const { outline, reach } = wholeRegion(spec);
  const far = (index: number) => Math.abs(outline[index][0]) >= reach / 10 || Math.abs(outline[index][1]) >= reach / 10;
  const lastFar = outline.findIndex((_, index) => far(index) && !far((index + 1) % outline.length));
  if (lastFar === -1) return around;
  const scale = Math.max(1, Math.abs(spec.xMin), Math.abs(spec.xMax), Math.abs(spec.yMin), Math.abs(spec.yMax));
  const position = (vertex: RegionVertex) => {
    const index = outline.findIndex(([x, y]) => Math.abs(x - vertex.x) <= 1e-6 * scale && Math.abs(y - vertex.y) <= 1e-6 * scale);
    return index === -1 ? -1 : (index - lastFar - 1 + outline.length) % outline.length;
  };
  const placed = vertices.map(vertex => ({ vertex, at: position(vertex) }));
  if (placed.some(item => item.at === -1)) return around;
  return placed.sort((u, v) => u.at - v.at).map(item => item.vertex);
}

/** La región común sin el recorte del plano: se recorta un cuadrado enorme, que una región no acotada alcanza. */
function wholeRegion(spec: GraphSpec): { outline: Pair[]; reach: number } {
  const reach = 1e7 * Math.max(1, Math.abs(spec.xMin), Math.abs(spec.xMax), Math.abs(spec.yMin), Math.abs(spec.yMax));
  const outline = (spec.inequalities ?? []).reduce((polygon, inequality) => (polygon.length === 0 ? polygon : clip(polygon, normal(inequality))), rectangle(-reach, reach, -reach, reach));
  return { outline, reach };
}

/** ¿La región común es acotada? Si llega hasta el cuadrado enorme, sigue sin fin. */
export function regionBounded(spec: GraphSpec): boolean {
  const { outline, reach } = wholeRegion(spec);
  return outline.every(([x, y]) => Math.abs(x) < reach / 10 && Math.abs(y) < reach / 10);
}

/* ── Escritura ── */

const OP_LATEX: Record<InequalityOp, string> = { "<": "<", "<=": "\\le", ">": ">", ">=": "\\ge" };

/** El lado izquierdo a·x + b·y con los signos y los unos como se escriben a mano. */
function leftSide(a: number, b: number, number: (value: number) => string): string {
  const term = (coefficient: number, variable: string, first: boolean) => {
    if (coefficient === 0) return "";
    const size = Math.abs(coefficient) === 1 ? "" : number(Math.abs(coefficient));
    if (first) return `${coefficient < 0 ? "-" : ""}${size}${variable}`;
    return ` ${coefficient < 0 ? "-" : "+"} ${size}${variable}`;
  };
  return `${term(a, "x", true)}${term(b, "y", a === 0)}`;
}

/** La inecuación en LaTeX: «2x + 3y \le 12», «x \ge 0», «-x + y < 4». */
export const inequalityLatex = (inequality: GraphInequality): string => `${leftSide(inequality.a, inequality.b, figureNumberLatex)} ${OP_LATEX[inequality.op]} ${figureNumberLatex(inequality.c)}`;

/** La inecuación en texto, para lo que se devuelve a la IA y los avisos del formulario. */
export const inequalityText = (inequality: GraphInequality): string => `${leftSide(inequality.a, inequality.b, figureNumber)} ${INEQUALITY_OP_LABELS[inequality.op]} ${figureNumber(inequality.c)}`;

/** ¿El punto cumple la inecuación? null si cae justo sobre la frontera. */
function satisfies(inequality: GraphInequality, x: number, y: number): boolean | null {
  const { a, b, c } = normal(inequality);
  const value = a * x + b * y - c;
  if (Math.abs(value) <= 1e-12 * Math.max(1, Math.abs(c))) return null;
  return value < 0;
}

/* ── Comprobaciones para el validador ── */

const point4 = (x: number, y: number) => `(${formatNumber(x, 4)}, ${formatNumber(y, 4)})`;

/** Problemas de las inecuaciones de un plano: fronteras que no se ven, regiones vacías y vértices fuera del plano. */
export function planeInequalityIssues(spec: GraphSpec): string[] {
  const inequalities = spec.inequalities ?? [];
  const issues: string[] = [];
  if (inequalities.length === 0) {
    if (spec.inequalityVertices) issues.push("Gráfica: inequalityVertices marca los vértices de la región común de las inecuaciones, y el plano no tiene ninguna (inequalities).");
    if (spec.inequalityShade !== undefined) issues.push("Gráfica: inequalityShade dice qué región de las inecuaciones se sombrea, y el plano no tiene ninguna (inequalities).");
    return issues;
  }

  inequalities.forEach((inequality, index) => {
    const name = `la inecuación ${index + 1}`;
    if (inequality.a === 0 && inequality.b === 0) return void issues.push(`Gráfica: ${name} no tiene x ni y (a y b valen 0): no es una inecuación con dos variables.`);
    if (inequality.label && ![inequality.a, inequality.b, inequality.c].every(isExactNumber)) {
      issues.push(`Gráfica: ${name} no se puede escribir exacta junto a su frontera: sus coeficientes tienen más de cuatro decimales. Redondéalos o quita label.`);
    }
    if (!boundarySegment(spec, inequality)) issues.push(`Gráfica: la frontera de ${name} (${inequalityText(inequality).replace(/[<>≤≥]/, "=")}) no pasa por el plano, así que no se vería; amplía el rango.`);
  });
  if (issues.length > 0) return issues;

  const shade = spec.inequalityShade ?? "common";
  const region = commonRegion(spec);
  const system = inequalities.length > 1 ? "las inecuaciones" : "la inecuación";
  if (region.length === 0 && (shade === "common" || spec.inequalityVertices)) {
    return [`Gráfica: ${system} no ${inequalities.length > 1 ? "tienen" : "tiene"} región ${inequalities.length > 1 ? "común " : ""}dentro del plano, así que no hay nada que sombrear; revisa los signos o amplía el rango.`];
  }

  const vertices = regionVertices(spec);
  if (spec.inequalityVertices && vertices.length === 0) {
    issues.push(`Gráfica: la región de ${system} no tiene vértices (hacen falta al menos dos fronteras que se corten dentro de ella); quita inequalityVertices.`);
  }
  // Un vértice fuera del plano deja la región cortada por el borde: parecería que sigue
  if (shade === "common" || spec.inequalityVertices) {
    for (const vertex of vertices) {
      if (!insidePlane(spec, vertex.x, vertex.y)) issues.push(`Gráfica: la región común tiene un vértice en ${point4(vertex.x, vertex.y)}, fuera del plano; amplía el rango para que se vea entera.`);
    }
  }
  return issues;
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`);

/** Una línea con las fronteras, la región común y sus vértices, escritos como salen en la figura. */
export function describeInequalities(spec: GraphSpec): string | null {
  const inequalities = spec.inequalities ?? [];
  if (inequalities.length === 0) return null;
  const border = (inequality: GraphInequality) => (isStrict(inequality.op) ? "frontera punteada (la recta no pertenece a la solución)" : "frontera continua (la recta pertenece a la solución)");
  if (inequalities.length === 1) {
    const [only] = inequalities;
    const origin = satisfies(only, 0, 0);
    const test = origin === null ? "" : `; el punto (0, 0) ${origin ? "la cumple" : "no la cumple"}`;
    return `Inecuación ${inequalityText(only)}: semiplano con ${border(only)}${test}.`;
  }
  const vertices = regionVertices(spec);
  const parts = [`fronteras ${list(inequalities.map(inequality => `${inequalityText(inequality)} ${isStrict(inequality.op) ? "punteada" : "continua"}`))}`];
  if (commonRegion(spec).length === 0) parts.push("sin región común dentro del plano");
  else {
    parts.push(`región común ${regionBounded(spec) ? "acotada" : "no acotada"}`);
    if (vertices.length > 0) parts.push(`vértices ${list(vertices.map(vertex => `${planePointText(spec, vertex.x, vertex.y)}${vertex.open ? " (sobre una frontera punteada: no pertenece)" : ""}`))}`);
  }
  return `Sistema de inecuaciones: ${parts.join("; ")}.`;
}

import type { BlockInput } from "./creator";
import { approxText, divide, exactText, measureText, rational, recognize, type Exact } from "./creatorExact";
import { formatNumber } from "./creatorMath";
import { exactDecimals, formatDecimalEs } from "./creatorPlane";

/**
 * Triángulo resuelto del Creador de recursos. El docente o la IA dan los datos que lo determinan
 * (tres lados; dos lados y el ángulo entre ellos; un lado y dos ángulos; dos lados y un ángulo
 * opuesto, si eso deja un solo triángulo) y aquí se calcula el resto con la ley del coseno y la del
 * seno, se comprueba que el triángulo exista y se decide dónde va cada trazo y cada rótulo.
 *
 * El dibujo, el validador y lo que se le devuelve a la IA salen de las mismas funciones: lo que no
 * cabe en la figura se rechaza aquí, antes de llegar a la hoja.
 */

export const TRIANGLE_SHOW = ["value", "label", "both", "none"] as const;
export type TriangleShow = (typeof TRIANGLE_SHOW)[number];
/** Caracteres de un rótulo de lado o de ángulo. */
export const TRIANGLE_LABEL_MAX = 10;

export type TriangleSpec = Extract<BlockInput, { type: "triangle" }>;
export type TriangleData = TriangleSpec["triangles"][number];

export const SIDE_KEYS = ["a", "b", "c"] as const;
export const ANGLE_KEYS = ["A", "B", "C"] as const;

/** Decimales de un ángulo dado o calculado para escribirse exacto. */
const ANGLE_DECIMALS = 2;
/** Diferencia admitida entre un dato de más y el valor que sale de los demás. */
const ANGLE_TOLERANCE = 0.006;
const sideTolerance = (value: number) => Math.max(0.006, value * 1e-4);

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;
const clampCos = (value: number) => Math.max(-1, Math.min(1, value));

export interface SolvedTriangle {
  /** Lados a, b y c: cada uno opuesto al vértice del mismo índice. */
  sides: [number, number, number];
  /** Ángulos en grados, en el orden de los vértices. */
  angles: [number, number, number];
  given: { sides: [boolean, boolean, boolean]; angles: [boolean, boolean, boolean] };
}

export type TriangleSolution = { ok: true; triangle: SolvedTriangle } | { ok: false; issues: string[] };

const sideName = (index: number) => SIDE_KEYS[index];
const angleName = (index: number) => ANGLE_KEYS[index];

/** Ángulos de un triángulo de lados conocidos, por la ley del coseno. */
function anglesFromSides([a, b, c]: [number, number, number]): [number, number, number] {
  return [toDeg(Math.acos(clampCos((b * b + c * c - a * a) / (2 * b * c)))), toDeg(Math.acos(clampCos((a * a + c * c - b * b) / (2 * a * c)))), toDeg(Math.acos(clampCos((a * a + b * b - c * c) / (2 * a * b))))];
}

/** Un ángulo calculado muy cerca de un valor con pocos decimales es ese valor: 89,99999999999 es 90. */
function tidyAngle(value: number): number {
  const rounded = Number(value.toFixed(ANGLE_DECIMALS));
  return Math.abs(value - rounded) < 1e-9 ? rounded : value;
}

/** Los datos de un triángulo tal como llegan: lados y ángulos conocidos, null lo que falta. */
export function triangleKnowns(data: TriangleData): { sides: Array<number | null>; angles: Array<number | null> } {
  return { sides: SIDE_KEYS.map(key => data.sides[key]?.length ?? null), angles: ANGLE_KEYS.map(key => data.angles[key]?.degrees ?? null) };
}

/**
 * Resuelve un triángulo a partir de sus datos. Con más de tres datos, resuelve con los que lo
 * determinan (tres lados, luego lado-ángulo-lado, luego dos ángulos y un lado, luego el caso de dos
 * lados y un ángulo opuesto) y comprueba que los demás coincidan.
 */
export function solveTriangle(data: TriangleData): TriangleSolution {
  const { sides, angles } = triangleKnowns(data);
  const sideCount = sides.filter(value => value !== null).length;
  const angleCount = angles.filter(value => value !== null).length;
  const given = { sides: sides.map(value => value !== null) as [boolean, boolean, boolean], angles: angles.map(value => value !== null) as [boolean, boolean, boolean] };
  const fail = (issue: string): TriangleSolution => ({ ok: false, issues: [issue] });

  if (sideCount === 0) return fail("con solo ángulos el triángulo no tiene tamaño; da al menos un lado (length).");
  if (sideCount + angleCount < 3) return fail(`faltan datos: hay ${sideCount + angleCount} y se necesitan tres que lo determinen (tres lados, dos lados y el ángulo entre ellos, o un lado y dos ángulos).`);

  const knownAngles = angles.filter((value): value is number => value !== null);
  const angleSum = knownAngles.reduce((sum, value) => sum + value, 0);
  if (angleCount === 3 && Math.abs(angleSum - 180) > ANGLE_TOLERANCE) return fail(`los tres ángulos suman ${formatNumber(angleSum, 2)}° y deben sumar 180°.`);
  if (angleCount === 2 && angleSum >= 180) return fail(`los ángulos dados suman ${formatNumber(angleSum, 2)}° y deben sumar menos de 180°.`);

  let solved: { sides: [number, number, number]; angles: [number, number, number] } | null = null;

  if (sideCount === 3) {
    const s = sides as [number, number, number];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const k = (i + 2) % 3;
      if (s[i] >= (s[j] + s[k]) * (1 - 1e-12)) {
        return fail(`con lados ${formatNumber(s[0], 4)}, ${formatNumber(s[1], 4)} y ${formatNumber(s[2], 4)} no hay triángulo: ${sideName(j)} + ${sideName(k)} = ${formatNumber(s[j] + s[k], 4)} no es mayor que ${sideName(i)} = ${formatNumber(s[i], 4)} (desigualdad triangular).`);
      }
    }
    solved = { sides: s, angles: anglesFromSides(s) };
  }

  // Dos lados y el ángulo entre ellos: el tercer lado por la ley del coseno
  if (!solved && sideCount === 2) {
    const missing = sides.findIndex(value => value === null);
    const included = angles[missing];
    if (included !== null) {
      const j = (missing + 1) % 3;
      const k = (missing + 2) % 3;
      const s = [...sides] as [number, number, number];
      s[missing] = Math.sqrt(Math.max(0, s[j] * s[j] + s[k] * s[k] - 2 * s[j] * s[k] * Math.cos(toRad(included))));
      solved = { sides: s, angles: anglesFromSides(s) };
    }
  }

  // Dos ángulos (el tercero sale de la suma) y un lado: los demás por la ley del seno
  if (!solved && angleCount >= 2) {
    const a = [...angles] as Array<number | null>;
    const missing = a.findIndex(value => value === null);
    if (missing !== -1) a[missing] = 180 - angleSum;
    const full = a as [number, number, number];
    const known = sides.findIndex(value => value !== null);
    const ratio = (sides[known] as number) / Math.sin(toRad(full[known]));
    const s = full.map((angle, index) => (index === known ? (sides[known] as number) : ratio * Math.sin(toRad(angle)))) as [number, number, number];
    solved = { sides: s, angles: full };
  }

  // Dos lados y un ángulo que no está entre ellos: puede haber cero, uno o dos triángulos
  if (!solved && sideCount === 2 && angleCount === 1) {
    const i = angles.findIndex(value => value !== null);
    const j = [0, 1, 2].find(index => index !== i && sides[index] !== null) as number;
    const k = 3 - i - j;
    const si = sides[i] as number;
    const sj = sides[j] as number;
    const Ai = angles[i] as number;
    const sinJ = (sj * Math.sin(toRad(Ai))) / si;
    const context = `con ${sideName(i)} = ${formatNumber(si, 4)}, ${sideName(j)} = ${formatNumber(sj, 4)} y ${angleName(i)} = ${formatNumber(Ai, 2)}°`;
    if (sinJ > 1 + 1e-12) return fail(`${context} no hay triángulo: el lado ${sideName(i)} es más corto que la distancia que debe alcanzar (${sideName(j)} · sen ${angleName(i)} = ${formatNumber(sj * Math.sin(toRad(Ai)), 4)}).`);
    const first = toDeg(Math.asin(Math.min(1, sinJ)));
    const options = (Math.abs(first - 90) < 1e-9 ? [90] : [first, 180 - first]).filter(Aj => Ai + Aj < 180 - 1e-9);
    if (options.length === 0) return fail(`${context} no hay triángulo: los ángulos sumarían 180° o más.`);
    if (options.length === 2) {
      return fail(`${context} hay dos triángulos posibles (${angleName(j)} ≈ ${formatNumber(options[0], 2)}° o ${angleName(j)} ≈ ${formatNumber(options[1], 2)}°). Da el tercer lado o un segundo ángulo para que quede uno solo.`);
    }
    const full = [0, 0, 0] as [number, number, number];
    full[i] = Ai;
    full[j] = options[0];
    full[k] = 180 - Ai - options[0];
    const s = [...sides] as [number, number, number];
    s[k] = (si * Math.sin(toRad(full[k]))) / Math.sin(toRad(Ai));
    solved = { sides: s, angles: full };
  }

  if (!solved) return fail("los datos no determinan el triángulo; da tres lados, dos lados y el ángulo entre ellos, o un lado y dos ángulos.");

  const tidy = { sides: solved.sides, angles: solved.angles.map(tidyAngle) as [number, number, number] };
  // Los datos de más tienen que coincidir con el triángulo que dejan los demás
  const mismatches: string[] = [];
  sides.forEach((value, index) => {
    if (value !== null && Math.abs(value - tidy.sides[index]) > sideTolerance(value)) mismatches.push(`el lado ${sideName(index)} mide ${formatNumber(tidy.sides[index], 4)} con los demás datos, no ${formatNumber(value, 4)}`);
  });
  angles.forEach((value, index) => {
    if (value !== null && Math.abs(value - tidy.angles[index]) > ANGLE_TOLERANCE) mismatches.push(`el ángulo ${angleName(index)} mide ${formatNumber(tidy.angles[index], 2)}° con los demás datos, no ${formatNumber(value, 2)}°`);
  });
  if (mismatches.length > 0) return { ok: false, issues: [`los datos no coinciden entre sí: ${mismatches.join("; ")}. Quita los datos de más o corrígelos.`] };
  return { ok: true, triangle: { ...tidy, given } };
}

/* ── Rótulos ── */

const isRightAngle = (degrees: number) => Math.abs(degrees - 90) < 1e-9;

type TrianglePart = { show?: TriangleShow; label?: string } | undefined;

/**
 * Qué se escribe junto a un lado o un ángulo: lo pedido o, si no se dijo, la medida cuando es un dato
 * y el rótulo si lo hay. Un ángulo recto dado ya lleva su cuadrito: no se le escribe «90°».
 */
export function effectiveShow(part: TrianglePart, given: boolean, markedRight = false): TriangleShow {
  if (part?.show) return part.show;
  if (part?.label) return "label";
  return given && !markedRight ? "value" : "none";
}

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
const unitLatex = (unit: string) => `\\text{ ${unit.replace(/[#%&$_{}~^\\]/g, char => TEXT_ESCAPES[char])}}`;

interface Measure {
  latex: string;
  plain: string;
  approx: boolean;
}

/** Una longitud como va en la figura: exacta (5, 2,5), como raíz (2√5) o aproximada (4,47, con ≈ delante). */
function lengthParts(value: number): Measure {
  const exact = recognize(value);
  if (exact) return { latex: exactText(exact, { format: "latex" }), plain: exactText(exact), approx: false };
  return { latex: approxText(value, "latex"), plain: approxText(value), approx: true };
}

function angleParts(value: number): Measure {
  const places = exactDecimals(value, ANGLE_DECIMALS);
  const text = places === null ? approxText(value) : formatDecimalEs(value, places);
  return { latex: `${text.replace(",", "{,}")}^{\\circ}`, plain: `${text}°`, approx: places === null };
}

export interface TriangleLabelText {
  latex: string;
  /** Lo que se ve, para medir el rótulo. */
  plain: string;
}

/** El texto de un rótulo según lo que se pidió mostrar; null si no se escribe nada. */
function labelText(show: TriangleShow, label: string | undefined, measure: Measure, unit: string): TriangleLabelText | null {
  if (show === "none") return null;
  const value = { latex: `${measure.latex}${unit ? unitLatex(unit) : ""}`, plain: `${measure.plain}${unit ? ` ${unit}` : ""}` };
  if (show === "value") return measure.approx ? { latex: `\\approx ${value.latex}`, plain: `≈ ${value.plain}` } : value;
  if (!label) return null;
  const name = { latex: plainToLatex(label), plain: label };
  if (show === "label") return name;
  return { latex: `${name.latex} ${measure.approx ? "\\approx" : "="} ${value.latex}`, plain: `${name.plain} ${measure.approx ? "≈" : "="} ${value.plain}` };
}

/* ── Disposición ── */

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

export interface TrianglePlacedLabel extends TriangleLabelText {
  /** Centro del rótulo. */
  x: number;
  y: number;
  kind: "side" | "angle" | "vertex";
  box: Box;
  /** Línea guía del arco al rótulo, cuando el rótulo de un ángulo va por fuera. */
  leader?: [Point, Point];
}

/** Marca de un ángulo: un sector de radio `radius` entre los dos lados, o el cuadrito del ángulo recto. */
export interface TriangleMark {
  vertex: number;
  right: boolean;
  center: Point;
  /** Inicio y fin del arco (o los dos extremos del cuadrito) sobre cada lado. */
  start: Point;
  end: Point;
  /** Esquina del cuadrito; en un arco, sin uso. */
  corner: Point;
  radius: number;
  sweep: 0 | 1;
}

export interface TriangleDrawing {
  points: [Point, Point, Point];
  marks: TriangleMark[];
  solved: SolvedTriangle;
}

export interface TriangleLayout {
  width: number;
  height: number;
  drawings: TriangleDrawing[];
  labels: TrianglePlacedLabel[];
  /** Lo que no se puede dibujar legible: el validador lo rechaza. */
  issues: string[];
}

/** Lado mayor, en píxeles, del triángulo más ancho y alto del más alto; con dos triángulos, cada uno tiene menos sitio. */
const WIDTH_MAX = [250, 205];
const HEIGHT_MAX = [215, 195];
/** Un triángulo más bajo que esto respecto de su base no deja sitio para sus ángulos. */
const FLAT_RATIO = 0.12;
/** Lado más corto que se dibuja: por debajo, sus rótulos y sus marcas se montan. */
const SIDE_MIN_PX = 22;
const GAP = 34;
const PAD = 6;
/** Ancho medio de un carácter de los rótulos (14 px, KaTeX) y alto de un rótulo. */
const CHAR_W = 7.6;
const LABEL_H = 20;
const CLEARANCE = 3;
/** Distancia máxima entre un vértice y el rótulo de su ángulo: más lejos ya no se sabe de qué ángulo es. */
const ANGLE_LABEL_REACH = 90;

const sub =(p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const addv = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
const scale = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const dot = (p: Point, q: Point) => p.x * q.x + p.y * q.y;
const length = (p: Point) => Math.hypot(p.x, p.y);
const unitOf = (p: Point): Point => scale(p, 1 / (length(p) || 1));
const fmt = (value: number) => value.toFixed(2);

export const labelSize = (plain: string): { w: number; h: number } => ({ w: Math.max(1, [...plain].length) * CHAR_W + 6, h: LABEL_H });

/** Distancia del centro de una caja a su borde en la dirección `n` (unitaria). */
const support = (n: Point, size: { w: number; h: number }) => (Math.abs(n.x) * size.w) / 2 + (Math.abs(n.y) * size.h) / 2;

const boxAt = (center: Point, size: { w: number; h: number }): Box => ({ x: center.x - size.w / 2, y: center.y - size.h / 2, w: size.w, h: size.h });

export const boxesOverlap = (a: Box, b: Box, gap = CLEARANCE) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** Distancia de un punto a una caja (0 si está dentro). */
const pointBoxDistance = (p: Point, box: Box) => Math.hypot(Math.max(box.x - p.x, 0, p.x - box.x - box.w), Math.max(box.y - p.y, 0, p.y - box.y - box.h));

/** La normal de un lado que apunta hacia `toward` (o en contra, con `away`). */
function sideNormal(from: Point, to: Point, toward: Point): Point {
  const along = sub(to, from);
  const normal = unitOf({ x: along.y, y: -along.x });
  return dot(normal, sub(toward, from)) >= 0 ? normal : scale(normal, -1);
}

/** Los vértices con la base opuesta a `apex`, desde el extremo p = apex + 1; y hacia arriba. */
function onBase(triangle: SolvedTriangle, apex: number): [Point, Point, Point] {
  const { sides, angles } = triangle;
  const p = (apex + 1) % 3;
  const q = (apex + 2) % 3;
  const points: Point[] = [];
  points[p] = { x: 0, y: 0 };
  points[q] = { x: sides[apex], y: 0 };
  // El ápice, desde p, a la distancia del lado opuesto a q y con el ángulo de p
  points[apex] = { x: sides[q] * Math.cos(toRad(angles[p])), y: sides[q] * Math.sin(toRad(angles[p])) };
  return points as [Point, Point, Point];
}

/** Alto sobre ancho de lo que ocupa el triángulo, contando lo que el ápice sobresale de la base. */
const aspect = (points: Point[]) => Math.max(...points.map(p => p.y)) / (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)));

/** Por debajo de esto, un triángulo obtuso se ve mejor apoyado en otro lado. */
const OBTUSE_ASPECT = 0.25;

/**
 * Vértices del triángulo con la base abajo, en las unidades de los lados y con y hacia arriba. La base
 * es el lado mayor; en uno rectángulo, el cateto mayor, con el ángulo recto en un extremo; en uno muy
 * obtuso, que sobre su lado mayor quedaría como una raya, el lado que lo deja más alto. Los vértices
 * quedan en sentido antihorario, como se nombran: A, B, C o una rotación de ese orden.
 */
function baseCoordinates(triangle: SolvedTriangle): [Point, Point, Point] {
  const { sides, angles } = triangle;
  const right = angles.findIndex(isRightAngle);
  if (right !== -1) {
    // El vértice de arriba es el opuesto al cateto mayor
    const legs = [0, 1, 2].filter(index => index !== right);
    return onBase(triangle, sides[legs[0]] >= sides[legs[1]] ? legs[0] : legs[1]);
  }
  const usual = onBase(triangle, sides.indexOf(Math.max(...sides)));
  if (aspect(usual) >= OBTUSE_ASPECT) return usual;
  return [0, 1, 2].map(apex => onBase(triangle, apex)).reduce((best, option) => (aspect(option) > aspect(best) ? option : best), usual);
}
/** Cómo se nombra un ángulo en los avisos: «el ángulo A» y, si su vértice tiene otro nombre, «(en P)». */
const angleCall = (data: TriangleData, index: number) => `el ángulo ${ANGLE_KEYS[index]}${data.vertices[index] && data.vertices[index] !== ANGLE_KEYS[index] ? ` (en ${data.vertices[index]})` : ""}`;

/**
 * Dónde va cada trazo y cada rótulo de los triángulos del bloque, en píxeles del diseño (y hacia
 * abajo). null si algún triángulo no se puede resolver.
 */
export function triangleLayout(spec: TriangleSpec): TriangleLayout | null {
  const solutions = spec.triangles.map(solveTriangle);
  if (solutions.some(solution => !solution.ok)) return null;
  const solved = solutions.map(solution => (solution as { ok: true; triangle: SolvedTriangle }).triangle);
  const unit = spec.unit ?? "";
  const many = spec.triangles.length > 1;
  const issues: string[] = [];
  const name = (index: number) => (many ? `el triángulo ${index + 1}` : "el triángulo");

  // Una sola escala para todos: así dos triángulos semejantes se ven semejantes
  const raw = solved.map(baseCoordinates);
  const extents = raw.map(points => ({ w: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), h: Math.max(...points.map(p => p.y)) }));
  const slot = many ? 1 : 0;
  const k = Math.min(WIDTH_MAX[slot] / Math.max(...extents.map(e => e.w)), HEIGHT_MAX[slot] / Math.max(...extents.map(e => e.h)));

  const groups = solved.map((triangle, t) => {
    const data = spec.triangles[t];
    const points = raw[t].map(p => ({ x: p.x * k, y: -p.y * k })) as [Point, Point, Point];
    const e = extents[t];
    if (e.h / e.w < FLAT_RATIO) issues.push(`${name(t)} es tan aplanado (su altura es menos del ${FLAT_RATIO * 100} % de su base) que sus ángulos y rótulos no se leerían; revisa los datos.`);
    else if (many && Math.max(e.w, e.h) * k < 70) issues.push(`${name(t)} queda muy pequeño junto al otro, porque los dos van a la misma escala; ponlos en bloques separados.`);
    else if (Math.min(...triangle.sides) * k < SIDE_MIN_PX) issues.push(`en ${name(t)} un lado queda de menos de ${SIDE_MIN_PX} px en la figura: con lados tan desiguales no se lee. Revisa los datos.`);

    const marks: TriangleMark[] = [];
    const labels: TrianglePlacedLabel[] = [];
    const add = (text: TriangleLabelText, center: Point, kind: TrianglePlacedLabel["kind"]) => labels.push({ ...text, x: center.x, y: center.y, kind, box: boxAt(center, labelSize(text.plain)) });

    // Cada vértice: hacia dónde salen sus lados y cuánto mide el más corto
    const corners = points.map((p, i) => {
      const toNext = sub(points[(i + 1) % 3], p);
      const toPrev = sub(points[(i + 2) % 3], p);
      const u1 = unitOf(toNext);
      const u2 = unitOf(toPrev);
      return { p, u1, u2, bisector: unitOf(addv(u1, u2)), adjacent: Math.min(length(toNext), length(toPrev)), angle: triangle.angles[i] };
    });

    // 1. Nombres de los vértices, por fuera, sobre la bisectriz exterior
    corners.forEach((corner, i) => {
      const vertexName = data.vertices[i];
      if (!vertexName) return;
      const out = scale(corner.bisector, -1);
      add({ latex: plainToLatex(vertexName), plain: vertexName }, addv(corner.p, scale(out, 4 + support(out, labelSize(vertexName)))), "vertex");
    });

    // 2. Ángulos: el arco o el cuadrito, y el rótulo por dentro, pegado a los dos lados. Si dentro no
    // cabe (un ángulo muy cerrado, o uno obtuso con el lado opuesto muy cerca), va por fuera junto al
    // vértice, con una línea guía hasta el arco
    corners.forEach((corner, i) => {
      const part = data.angles[ANGLE_KEYS[i]];
      const right = isRightAngle(corner.angle) && spec.markRight;
      const text = labelText(effectiveShow(part, triangle.given.angles[i], right), part?.label, angleParts(corner.angle), "");
      if (!text && !right) return;
      const from = points[(i + 1) % 3];
      const to = points[(i + 2) % 3];
      const inward = sideNormal(from, to, corner.p);
      // La altura desde el vértice limita la marca: en un ángulo muy abierto, el lado opuesto queda cerca
      const altitude = dot(sub(corner.p, from), inward);
      let radius = Math.max(7, Math.min(22, corner.adjacent * 0.3, altitude * 0.3));
      const square = Math.max(7, Math.min(12, corner.adjacent * 0.22, altitude * 0.3));
      let leader: [Point, Point] | undefined;

      if (text) {
        const size = labelSize(text.plain);
        const free = (box: Box) => !labels.some(other => boxesOverlap(box, other.box));
        // Más cerca de otro vértice, el rótulo se leería como de otro ángulo
        const nearest = (center: Point) => {
          const own = length(sub(center, corner.p));
          return points.every((p, j) => j === i || length(sub(center, p)) > own);
        };

        // Dentro: el punto donde la caja queda a la distancia justa de los dos lados que forman el ángulo
        const sin = Math.sin(toRad(corner.angle));
        const n1 = sideNormal(corner.p, addv(corner.p, corner.u1), addv(corner.p, corner.u2));
        const n2 = sideNormal(corner.p, addv(corner.p, corner.u2), addv(corner.p, corner.u1));
        let center = addv(corner.p, addv(scale(corner.u1, (support(n2, size) + CLEARANCE) / sin), scale(corner.u2, (support(n1, size) + CLEARANCE) / sin)));
        const clear = (right ? square * Math.SQRT2 : radius) + 2;
        for (let step = 0; step < 60 && pointBoxDistance(corner.p, boxAt(center, size)) < clear; step++) center = addv(center, scale(corner.bisector, 2));
        const inside = boxAt(center, size);
        const room = dot(sub(center, from), inward) - support(inward, size);
        const fits = room >= CLEARANCE && pointBoxDistance(corner.p, inside) <= ANGLE_LABEL_REACH && nearest(center) && free(inside);

        if (fits) {
          add(text, center, "angle");
          // En un ángulo cerrado el rótulo queda lejos del vértice, al fondo de la cuña: el arco llega hasta él para que se vea de quién es
          const gap = pointBoxDistance(corner.p, inside);
          if (!right && corner.angle < 30 && gap > radius * 2.2) radius = Math.min(gap - 5, corner.adjacent * 0.75);
        } else {
          // Fuera: junto a uno de los dos lados del ángulo, del lado de afuera, cerca del vértice
          // Un ángulo cerrado necesita un arco largo para que se vea; uno abierto, uno corto que deje sitio
          if (!right) radius = Math.max(radius, Math.min(corner.angle < 30 ? 44 : 18, corner.adjacent * (corner.angle < 30 ? 0.45 : 0.3)));
          const arcMiddle = addv(corner.p, scale(corner.bisector, right ? square * Math.SQRT2 : radius));
          const outside = [corner.u1, corner.u2]
            .flatMap(direction => {
              const away = scale(sideNormal(corner.p, addv(corner.p, direction), addv(corner.p, direction === corner.u1 ? corner.u2 : corner.u1)), -1);
              const offset = 7 + support(away, size);
              return [radius + 6, radius + 20, radius + 36].map(along => addv(addv(corner.p, scale(direction, along + support(direction, size))), scale(away, offset)));
            })
            .sort((a, b) => length(sub(a, arcMiddle)) - length(sub(b, arcMiddle)))
            .find(candidate => free(boxAt(candidate, size)) && nearest(candidate));
          if (!outside) {
            issues.push(`en ${name(t)}, el rótulo del ${angleCall(data, i).replace(/^el /, "")} («${text.plain}») no cabe junto al ángulo; usa una letra (show "label") o quita la medida.`);
          } else {
            const box = boxAt(outside, size);
            add(text, outside, "angle");
            // La guía va del arco al borde más cercano de la caja
            leader = [arcMiddle, { x: Math.max(box.x, Math.min(arcMiddle.x, box.x + box.w)), y: Math.max(box.y, Math.min(arcMiddle.y, box.y + box.h)) }];
            labels[labels.length - 1].leader = leader;
          }
        }
      }

      const reach = right ? square : radius;
      marks.push({
        vertex: i,
        right,
        center: corner.p,
        start: addv(corner.p, scale(corner.u1, reach)),
        end: addv(corner.p, scale(corner.u2, reach)),
        corner: addv(corner.p, addv(scale(corner.u1, square), scale(corner.u2, square))),
        radius,
        sweep: corner.u1.x * corner.u2.y - corner.u1.y * corner.u2.x > 0 ? 1 : 0,
      });
    });

    // 3. Lados: por fuera, junto al punto medio; si choca con otro rótulo, un poco corrido
    triangle.sides.forEach((value, i) => {
      const part = data.sides[SIDE_KEYS[i]];
      const text = labelText(effectiveShow(part, triangle.given.sides[i]), part?.label, lengthParts(value), unit);
      if (!text) return;
      const from = points[(i + 1) % 3];
      const along = sub(points[(i + 2) % 3], from);
      const normal = scale(sideNormal(from, points[(i + 2) % 3], points[i]), -1);
      const size = labelSize(text.plain);
      const reach = 5 + support(normal, size);
      const spot = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]
        .map(position => addv(addv(from, scale(along, position)), scale(normal, reach)))
        .find(center => !labels.some(other => boxesOverlap(boxAt(center, size), other.box)));
      if (!spot) issues.push(`en ${name(t)}, el rótulo del lado ${SIDE_KEYS[i]} («${text.plain}») no cabe sin montarse sobre otro; acórtalo o quita alguno (show "none").`);
      else add(text, spot, "side");
    });

    // Caja de lo dibujado: vértices y rótulos
    const xs = [...points.map(p => p.x), ...labels.flatMap(label => [label.box.x, label.box.x + label.box.w])];
    const ys = [...points.map(p => p.y), ...labels.flatMap(label => [label.box.y, label.box.y + label.box.h])];
    return { points, marks, labels, triangle, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });

  // Lado a lado, con la línea de base (y = 0 en cada uno) en común
  const top = Math.max(...groups.map(group => -group.minY)) + PAD;
  const bottom = Math.max(...groups.map(group => group.maxY));
  const drawings: TriangleDrawing[] = [];
  const labels: TrianglePlacedLabel[] = [];
  let cursor = PAD;
  for (const group of groups) {
    const dx = cursor - group.minX;
    const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + top });
    drawings.push({
      points: group.points.map(move) as [Point, Point, Point],
      marks: group.marks.map(mark => ({ ...mark, center: move(mark.center), start: move(mark.start), end: move(mark.end), corner: move(mark.corner) })),
      solved: group.triangle,
    });
    for (const label of group.labels) labels.push({ ...label, ...move(label), box: { ...label.box, x: label.box.x + dx, y: label.box.y + top }, ...(label.leader ? { leader: [move(label.leader[0]), move(label.leader[1])] as [Point, Point] } : {}) });
    cursor = dx + group.maxX + GAP;
  }
  return { width: Math.round(cursor - GAP + PAD), height: Math.round(top + bottom + PAD), drawings, labels, issues };
}

/** El trazo SVG de una marca de ángulo: el sector, o el cuadrito del recto. */
export function markPath(mark: TriangleMark): string {
  const { center, start, end, corner } = mark;
  if (mark.right) return `M${fmt(start.x)} ${fmt(start.y)} L${fmt(corner.x)} ${fmt(corner.y)} L${fmt(end.x)} ${fmt(end.y)}`;
  return `M${fmt(center.x)} ${fmt(center.y)} L${fmt(start.x)} ${fmt(start.y)} A${fmt(mark.radius)} ${fmt(mark.radius)} 0 0 ${mark.sweep} ${fmt(end.x)} ${fmt(end.y)} Z`;
}

/* ── Validación ── */

/** Un rótulo que es solo un número con unidad: la medida la escribe el sistema, no el rótulo. */
const NUMBER_LABEL = /^[≈~]?\s*-?\d+(?:[.,]\d+)?\s*(?:°|(?:mm|cm|dm|m|km|u)[²³23]?)?$/;

/** Problemas de un bloque de triángulos, redactados para quien deba corregirlos. */
export function triangleIssues(spec: TriangleSpec, compile: (latex: string) => string | null): string[] {
  const issues: string[] = [];
  const many = spec.triangles.length > 1;
  spec.triangles.forEach((data, t) => {
    const where = many ? `triángulo ${t + 1}, ` : "";
    const solution = solveTriangle(data);
    if (!solution.ok) {
      issues.push(...solution.issues.map(issue => `${where}${issue}`));
      return;
    }
    const known = triangleKnowns(data);
    known.sides.forEach((value, i) => {
      if (value !== null && !rational(value)) issues.push(`${where}el lado ${SIDE_KEYS[i]} (${formatNumber(value, 6)}) tiene más de 4 decimales y no se puede escribir completo en la figura.`);
    });
    known.angles.forEach((value, i) => {
      if (value !== null && exactDecimals(value, ANGLE_DECIMALS) === null) issues.push(`${where}el ángulo ${ANGLE_KEYS[i]} (${formatNumber(value, 6)}°) tiene más de 2 decimales y no se puede escribir completo en la figura.`);
    });
    const parts: Array<[string, TrianglePart]> = [...SIDE_KEYS.map((key): [string, TrianglePart] => [`el lado ${key}`, data.sides[key]]), ...ANGLE_KEYS.map((key, i): [string, TrianglePart] => [angleCall(data, i), data.angles[key]])];
    for (const [part, value] of parts) {
      if ((value?.show === "label" || value?.show === "both") && !value.label) issues.push(`${where}${part} pide su rótulo (show "${value.show}") y no lo tiene; escribe label o usa show "value".`);
      if (value?.label && NUMBER_LABEL.test(value.label)) issues.push(`${where}el rótulo de ${part} («${value.label}») es una medida: usa show "value" y el sistema la escribe.`);
    }
    for (const text of [...data.vertices, ...parts.map(([, value]) => value?.label ?? "")]) {
      if (!text) continue;
      const error = compile(plainToLatex(text));
      if (error) issues.push(`${where}el rótulo «${text}» no se puede escribir (${error}).`);
    }
  });
  if (issues.length > 0) return issues;
  return triangleLayout(spec)?.issues ?? [];
}

/** Los textos planos del bloque: nombres de vértices, rótulos y unidad. No admiten LaTeX. */
export function trianglePlainTexts(spec: TriangleSpec): string[] {
  return [
    spec.unit ?? "",
    ...spec.triangles.flatMap(data => [...data.vertices, ...SIDE_KEYS.map(key => data.sides[key]?.label ?? ""), ...ANGLE_KEYS.map(key => data.angles[key]?.label ?? "")]),
  ].filter(Boolean);
}

/* ── Lo que se le devuelve a la IA ── */

/** Una razón entre dos lados, exacta si los dos se reconocen (3/5, 2√5/5) o con cuatro decimales. */
function ratioText(top: number, bottom: number): string {
  const a = recognize(top);
  const b = recognize(bottom);
  const exact: Exact | null = a && b ? divide(a, b) : null;
  return exact ? `= ${exactText(exact, { fraction: true })}` : `≈ ${formatDecimalEs(top / bottom, 4)}`;
}

/** Un ángulo calculado como va en la clave: «= 90°» o «≈ 36,87°». */
export const angleMeasure = (value: number) => {
  const places = exactDecimals(value, ANGLE_DECIMALS);
  return places === null ? `≈ ${approxText(value)}°` : `= ${formatDecimalEs(value, places)}°`;
};

/** Nombre de un triángulo en la clave: «Triángulo ABC», o por su número si sus vértices no tienen nombre. */
const triangleCall = (data: TriangleData, index: number, many: boolean) => (data.vertices.every(Boolean) ? `Triángulo ${data.vertices.join("")}` : many ? `Triángulo ${index + 1}` : "Triángulo");

/**
 * Lo que calculó el sistema, como sale en la figura: lados, ángulos, perímetro y área; en un
 * triángulo rectángulo, las razones trigonométricas de sus ángulos agudos; con dos, si son semejantes.
 */
export function describeTriangles(spec: TriangleSpec): string | null {
  const solved = spec.triangles.map(solveTriangle);
  if (solved.some(solution => !solution.ok)) return null;
  const triangles = solved.map(solution => (solution as { ok: true; triangle: SolvedTriangle }).triangle);
  const unit = spec.unit ? ` ${spec.unit}` : "";
  const square = spec.unit ? ` ${spec.unit}²` : "";
  const many = triangles.length > 1;
  const parts = triangles.map((triangle, t) => {
    const data = spec.triangles[t];
    const vertex = (i: number) => data.vertices[i] || ANGLE_KEYS[i];
    const sides = triangle.sides.map((value, i) => `${SIDE_KEYS[i]} (${vertex((i + 1) % 3)}${vertex((i + 2) % 3)}) ${measureText(value)}${unit}`).join(", ");
    const angles = triangle.angles.map((value, i) => `${ANGLE_KEYS[i]}${vertex(i) === ANGLE_KEYS[i] ? "" : ` (en ${vertex(i)})`} ${angleMeasure(value)}`).join(", ");
    const [a, b, c] = triangle.sides;
    const perimeter = a + b + c;
    const area = 0.5 * b * c * Math.sin(toRad(triangle.angles[0]));
    let text = `${triangleCall(data, t, many)}: lados ${sides}; ángulos ${angles}; perímetro ${measureText(perimeter)}${unit}; área ${measureText(area)}${square}.`;
    const right = triangle.angles.findIndex(isRightAngle);
    if (right !== -1) {
      const ratios = [0, 1, 2]
        .filter(i => i !== right)
        .map(i => {
          const adjacent = 3 - i - right;
          const opposite = triangle.sides[i];
          const near = triangle.sides[adjacent];
          const hypotenuse = triangle.sides[right];
          return `sen ${ANGLE_KEYS[i]} ${ratioText(opposite, hypotenuse)}, cos ${ANGLE_KEYS[i]} ${ratioText(near, hypotenuse)}, tan ${ANGLE_KEYS[i]} ${ratioText(opposite, near)}`;
        });
      text += ` Es rectángulo en ${vertex(right)} (hipotenusa ${SIDE_KEYS[right]}): ${ratios.join("; ")}.`;
    }
    return text;
  });
  if (many) {
    const [first, second] = triangles.map(triangle => [...triangle.sides].sort((x, y) => x - y));
    const ratios = second.map((value, i) => value / first[i]);
    if (ratios.every(ratio => Math.abs(ratio - ratios[0]) < 1e-9 * Math.max(1, ratios[0]))) {
      parts.push(Math.abs(ratios[0] - 1) < 1e-9 ? "Los dos triángulos son congruentes." : `Los dos triángulos son semejantes: cada lado del segundo mide ${measureText(ratios[0]).replace(/^= /, "")} veces el correspondiente del primero (razón de semejanza ${ratioText(ratios[0], 1).replace(/^= /, "")}).`);
    } else {
      parts.push("Los dos triángulos no son semejantes.");
    }
  }
  return parts.join(" ");
}

import type { BlockInput } from "./creator";
import { add, approxText, exactText, exactValue, multiply, rational, recognize, sqrtOf, type Exact } from "./creatorExact";
import { formatNumber } from "./creatorMath";
import { exactDecimals, formatDecimalEs } from "./creatorPlane";
import { boxAt, boxesOverlap, NUMBER_LABEL, plainToLatex, segmentTouchesBox, unitLatex, type Box, type Point } from "./creatorFigureLabels";
import { FIGURE_SCALE_MIN } from "./creatorFigureSize";

/**
 * Sólidos del Creador de recursos: cubo, prismas, cilindro, cono, pirámide de base cuadrada y esfera.
 * Aquí se calculan su volumen y su área (exactos, con π y raíces cuando hace falta) y se decide el
 * dibujo: los poliedros en perspectiva caballera con las aristas ocultas punteadas, los cuerpos
 * redondos de frente con sus bases como elipses. El cubo, los prismas y el cilindro tienen además su
 * desarrollo plano (red), junto al sólido o solo, con las líneas de doblez punteadas. El dibujo, el
 * validador y lo que se le devuelve a la IA salen de las mismas funciones.
 */

export const SOLID_KINDS = ["cube", "rectangular_prism", "triangular_prism", "cylinder", "cone", "square_pyramid", "sphere"] as const;
export type SolidKind = (typeof SOLID_KINDS)[number];
export const SOLID_LABEL_MAX = 10;

export type SolidSpec = Extract<BlockInput, { type: "solid" }>;
export type Solid = SolidSpec["solids"][number];

export const SOLID_NAMES: Record<SolidKind, string> = {
  cube: "cubo",
  rectangular_prism: "prisma rectangular",
  triangular_prism: "prisma triangular",
  cylinder: "cilindro",
  cone: "cono",
  square_pyramid: "pirámide de base cuadrada",
  sphere: "esfera",
};

/** Los sólidos que tienen desarrollo plano. */
export const NET_KINDS: readonly SolidKind[] = ["cube", "rectangular_prism", "triangular_prism", "cylinder"];
export type NetMode = "beside" | "only";

/** Cómo se dibuja el desarrollo plano del sólido, o undefined si no lleva. */
export const netOf = (solid: Solid): NetMode | undefined => ("net" in solid ? solid.net : undefined);

/** «cubo», «cubo y su desarrollo plano», «desarrollo plano del cubo»: como se nombra en el resumen. */
export function solidTitle(solid: Solid): string {
  const net = netOf(solid);
  const name = SOLID_NAMES[solid.kind];
  return net === "beside" ? `${name} y su desarrollo plano` : net === "only" ? `desarrollo plano del ${name}` : name;
}

/* ── Medidas ── */

/** Una medida del sólido: su nombre, el campo que la guarda, su rótulo y si es un dato o la calcula el sistema. */
export interface SolidMeasure {
  key: string;
  name: string;
  value: number;
  label: string | undefined;
  derived: boolean;
  /** Su valor exacto, cuando no basta con reconocer el número: el largo del desarrollo del cilindro, 2πr. */
  exact?: Exact | null;
  /** El rótulo en LaTeX, cuando lo arma el sistema («2\pi r»). */
  labelLatex?: string;
}

/**
 * El largo del rectángulo del desarrollo del cilindro, 2πr. Su rótulo sigue al del radio: con el
 * valor del radio, el valor exacto (6π); con una letra, 2πr; con otro rótulo o sin escribir, nada,
 * porque el largo delataría el radio que el estudiante debe hallar.
 */
function circumferenceMeasure(solid: Extract<Solid, { kind: "cylinder" }>): SolidMeasure {
  const radius = solid.radiusLabel;
  const letter = radius !== undefined && /^\p{L}$/u.test(radius) ? radius : null;
  return {
    key: "circumference",
    name: "largo del rectángulo (la longitud de la circunferencia de la base)",
    value: 2 * Math.PI * solid.radius,
    label: radius === undefined ? undefined : letter ? `2π${letter}` : "",
    derived: true,
    exact: times(fraction(2, 1), PI, num(solid.radius)),
    ...(letter ? { labelLatex: `2\\pi ${plainToLatex(letter)}` } : {}),
  };
}

/** Las medidas que se rotulan en cada sólido, en el orden en que se nombran. */
export function solidMeasures(solid: Solid): SolidMeasure[] {
  const given = (key: string, name: string, value: number, label: string | undefined): SolidMeasure => ({ key, name, value, label, derived: false });
  switch (solid.kind) {
    case "cube":
      return [given("edge", "arista", solid.edge, solid.edgeLabel)];
    case "rectangular_prism":
      return [given("length", "largo", solid.length, solid.lengthLabel), given("width", "ancho", solid.width, solid.widthLabel), given("height", "alto", solid.height, solid.heightLabel)];
    case "triangular_prism":
      return [given("base", "base del triángulo", solid.base, solid.baseLabel), given("triangleHeight", "altura del triángulo", solid.triangleHeight, solid.triangleHeightLabel), given("length", "largo del prisma", solid.length, solid.lengthLabel)];
    case "cylinder":
      return [given("radius", "radio", solid.radius, solid.radiusLabel), given("height", "altura", solid.height, solid.heightLabel), ...(solid.net ? [circumferenceMeasure(solid)] : [])];
    case "cone":
      return [
        given("radius", "radio", solid.radius, solid.radiusLabel),
        given("height", "altura", solid.height, solid.heightLabel),
        ...(solid.slant ? [{ key: "slant", name: "generatriz", value: Math.hypot(solid.radius, solid.height), label: solid.slantLabel, derived: true }] : []),
      ];
    case "square_pyramid":
      return [
        given("base", "arista de la base", solid.base, solid.baseLabel),
        given("height", "altura", solid.height, solid.heightLabel),
        ...(solid.slant ? [{ key: "slant", name: "apotema", value: Math.hypot(solid.height, solid.base / 2), label: solid.slantLabel, derived: true }] : []),
      ];
    case "sphere":
      return [given("radius", "radio", solid.radius, solid.radiusLabel)];
  }
}

/** Una cantidad exacta o, si no se puede, su valor con ≈; `exact` es null cuando no hay forma exacta. */
export interface Quantity {
  value: number;
  exact: Exact | null;
  /** Cuando la suma no se puede escribir como un solo término: "9π + 3√13π". */
  sum?: Exact[];
}

const PI: Exact = { n: 1, d: 1, r: 1, pi: true };
const num = (value: number): Exact | null => rational(value);
const times = (...factors: Array<Exact | null>): Exact | null => factors.reduce<Exact | null>((product, factor) => (product && factor ? multiply(product, factor) : null), { n: 1, d: 1, r: 1, pi: false });
const plus = (...terms: Array<Exact | null>): Quantity => {
  const value = terms.reduce((sum, term) => sum + (term ? exactValue(term) : NaN), 0);
  if (terms.some(term => term === null)) return { value, exact: null };
  const known = terms as Exact[];
  // Se suman los términos semejantes; si quedan varios, la suma se escribe término a término
  const groups: Exact[] = [];
  for (const term of known) {
    const index = groups.findIndex(group => add(group, term) !== null);
    if (index === -1) groups.push(term);
    else groups[index] = add(groups[index], term) as Exact;
  }
  const nonzero = groups.filter(group => group.n !== 0);
  return nonzero.length <= 1 ? { value, exact: nonzero[0] ?? { n: 0, d: 1, r: 1, pi: false } } : { value, exact: null, sum: nonzero };
};
const single = (exact: Exact | null): Quantity => ({ value: exact ? exactValue(exact) : NaN, exact });
const fraction = (n: number, d: number): Exact => ({ n, d, r: 1, pi: false });

export interface SolidFacts {
  volume: Quantity;
  lateral: Quantity | null;
  total: Quantity;
  /** Generatriz del cono, o apotema y arista lateral de la pirámide. */
  extras: Array<{ name: string; quantity: Quantity }>;
  /** Caras, aristas y vértices de un poliedro. */
  elements: { faces: number; edges: number; vertices: number } | null;
}

/** Volumen y áreas de un sólido, exactos cuando las medidas lo permiten. */
export function solidFacts(solid: Solid): SolidFacts {
  switch (solid.kind) {
    case "cube": {
      const a = num(solid.edge);
      return { volume: single(times(a, a, a)), lateral: single(times(fraction(4, 1), a, a)), total: single(times(fraction(6, 1), a, a)), extras: [], elements: { faces: 6, edges: 12, vertices: 8 } };
    }
    case "rectangular_prism": {
      const [l, w, h] = [num(solid.length), num(solid.width), num(solid.height)];
      return {
        volume: single(times(l, w, h)),
        lateral: plus(times(fraction(2, 1), l, h), times(fraction(2, 1), w, h)),
        total: plus(times(fraction(2, 1), l, w), times(fraction(2, 1), l, h), times(fraction(2, 1), w, h)),
        extras: [],
        elements: { faces: 6, edges: 12, vertices: 8 },
      };
    }
    case "triangular_prism": {
      const [b, t, L] = [num(solid.base), num(solid.triangleHeight), num(solid.length)];
      const area = times(fraction(1, 2), b, t);
      // Los otros dos lados del triángulo: iguales en el isósceles; un cateto y la hipotenusa en el rectángulo
      const sideA = solid.triangle === "right" ? t : b && t ? sqrtOf(rational(solid.triangleHeight ** 2 + (solid.base / 2) ** 2, 8) ?? fraction(-1, 1)) : null;
      const sideB = solid.triangle === "right" ? (b && t ? sqrtOf(rational(solid.base ** 2 + solid.triangleHeight ** 2, 8) ?? fraction(-1, 1)) : null) : sideA;
      const lateral = plus(times(b, L), times(sideA, L), times(sideB, L));
      const lateralValue = (solid.base + triangleSides(solid).reduce((sum, side) => sum + side, 0)) * solid.length;
      return {
        volume: single(times(area, L)),
        lateral: { ...lateral, value: lateralValue },
        total: { ...plus(times(b, L), times(sideA, L), times(sideB, L), times(fraction(2, 1), area)), value: lateralValue + solid.base * solid.triangleHeight },
        extras: [],
        elements: { faces: 5, edges: 9, vertices: 6 },
      };
    }
    case "cylinder": {
      const [r, h] = [num(solid.radius), num(solid.height)];
      return {
        volume: single(times(PI, r, r, h)),
        lateral: single(times(fraction(2, 1), PI, r, h)),
        total: plus(times(fraction(2, 1), PI, r, r), times(fraction(2, 1), PI, r, h)),
        extras: [],
        elements: null,
      };
    }
    case "cone": {
      const [r, h] = [num(solid.radius), num(solid.height)];
      const g = recognize(Math.hypot(solid.radius, solid.height));
      const slant = { value: Math.hypot(solid.radius, solid.height), exact: g };
      const lateral = times(PI, r, g);
      return {
        volume: single(times(fraction(1, 3), PI, r, r, h)),
        lateral: { ...single(lateral), value: Math.PI * solid.radius * slant.value },
        total: { ...plus(times(PI, r, r), lateral), value: Math.PI * solid.radius * (solid.radius + slant.value) },
        extras: [{ name: "generatriz", quantity: slant }],
        elements: null,
      };
    }
    case "square_pyramid": {
      const [b, h] = [num(solid.base), num(solid.height)];
      const apothemValue = Math.hypot(solid.height, solid.base / 2);
      const edgeValue = Math.hypot(solid.height, solid.base / Math.SQRT2);
      const apothem = recognize(apothemValue);
      const lateral = times(fraction(2, 1), b, apothem);
      return {
        volume: single(times(fraction(1, 3), b, b, h)),
        lateral: { ...single(lateral), value: 2 * solid.base * apothemValue },
        total: { ...plus(times(b, b), lateral), value: solid.base ** 2 + 2 * solid.base * apothemValue },
        extras: [
          { name: "apotema de la pirámide (altura de cada cara)", quantity: { value: apothemValue, exact: apothem } },
          { name: "arista lateral", quantity: { value: edgeValue, exact: recognize(edgeValue) } },
        ],
        elements: { faces: 5, edges: 8, vertices: 5 },
      };
    }
    case "sphere": {
      const r = num(solid.radius);
      return { volume: single(times(fraction(4, 3), PI, r, r, r)), lateral: null, total: single(times(fraction(4, 1), PI, r, r)), extras: [], elements: null };
    }
  }
}

/** Los dos lados no basales del triángulo de un prisma triangular. */
function triangleSides(solid: Extract<Solid, { kind: "triangular_prism" }>): [number, number] {
  if (solid.triangle === "right") return [solid.triangleHeight, Math.hypot(solid.base, solid.triangleHeight)];
  const side = Math.hypot(solid.triangleHeight, solid.base / 2);
  return [side, side];
}

/** Una cantidad como va en la clave: «= 36π ≈ 113,1», «= 96», «= 9π + 3√13π ≈ 62,2», «≈ 12,57». */
export function quantityText(quantity: Quantity): string {
  if (quantity.sum) return `= ${quantity.sum.map(term => exactText(term)).join(" + ").replace(/\+ -/g, "- ")} ≈ ${approxText(quantity.value)}`;
  if (!quantity.exact) return `≈ ${approxText(quantity.value)}`;
  const text = exactText(quantity.exact);
  return quantity.exact.pi || quantity.exact.r > 1 ? `= ${text} ≈ ${approxText(quantity.value)}` : `= ${text}`;
}

/* ── Dibujo ── */

export interface SolidLabel {
  x: number;
  y: number;
  latex: string;
  plain: string;
  box: Box;
  /** Línea guía de la medida al rótulo, cuando el rótulo no cabe junto a ella. */
  leader?: [Point, Point];
}

/** Un trazo del dibujo: una línea o una curva (continuas o punteadas) o una cara rellena. */
export type SolidStroke =
  | { kind: "line"; from: Point; to: Point; hidden: boolean; thin?: boolean }
  | { kind: "face"; points: Point[]; shade: number }
  | { kind: "curve"; points: Point[]; closed: boolean; hidden: boolean; fill?: number; thin?: boolean };

export interface SolidDrawing {
  /** El sólido del bloque al que pertenece: el sólido y su desarrollo llevan el mismo color. */
  solid: number;
  /** El desarrollo plano: ahí las líneas punteadas son las de doblez. */
  net: boolean;
  strokes: SolidStroke[];
  /** Cuadritos del ángulo recto entre la altura y la base. */
  rightMarks: Point[][];
  dots: Point[];
}

export interface SolidLayout {
  width: number;
  height: number;
  drawings: SolidDrawing[];
  labels: SolidLabel[];
  issues: string[];
}

/** Lado mayor del dibujo del sólido más grande, en píxeles. */
const EXTENT = 170;
/** Lado mayor del desarrollo plano: algo más que el sólido, porque tiene más caras que rotular. */
const NET_EXTENT = 200;
/** Separación entre filas, cuando cada sólido va en la suya con su desarrollo. */
const ROW_GAP = 28;
/** Perspectiva caballera: el fondo se dibuja a la mitad, inclinado 35°. */
const DEPTH = 0.5;
const DEPTH_ANGLE = (35 * Math.PI) / 180;
/** Achatamiento de las elipses que dibujan las bases circulares. */
const ELLIPSE = 0.3;
const GAP = 44;
const PAD = 8;
const CHAR_W = 7.6;
const LABEL_H = 19;
const MIN_FEATURE = 16;

const labelSize = (plain: string) => ({ w: [...plain].reduce((sum, char) => sum + (char === "³" || char === "²" ? 5 : CHAR_W), 0) + 6, h: LABEL_H });

type V3 = [number, number, number];
const project = ([x, y, z]: V3, k: number): Point => ({ x: (x + z * DEPTH * Math.cos(DEPTH_ANGLE)) * k, y: -(y + z * DEPTH * Math.sin(DEPTH_ANGLE)) * k });
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Dirección en que se mira (hacia el fondo): una cara se ve si su normal exterior apunta en contra. */
const VIEW: V3 = [-DEPTH * Math.cos(DEPTH_ANGLE), -DEPTH * Math.sin(DEPTH_ANGLE), 1];

/** Un poliedro convexo en perspectiva: caras visibles rellenas y aristas ocultas punteadas. */
function polyhedron(vertices: V3[], faces: number[][], k: number): SolidStroke[] {
  const center = vertices.reduce<V3>((sum, v) => [sum[0] + v[0] / vertices.length, sum[1] + v[1] / vertices.length, sum[2] + v[2] / vertices.length], [0, 0, 0]);
  const visible = faces.map(face => {
    const [a, b, c] = face.map(index => vertices[index]);
    let normal = cross(sub3(b, a), sub3(c, a));
    const middle = face.reduce<V3>((sum, index) => [sum[0] + vertices[index][0] / face.length, sum[1] + vertices[index][1] / face.length, sum[2] + vertices[index][2] / face.length], [0, 0, 0]);
    if (dot3(normal, sub3(middle, center)) < 0) normal = [-normal[0], -normal[1], -normal[2]];
    return { normal, seen: dot3(normal, VIEW) < -1e-9 };
  });
  const edges = new Map<string, { from: number; to: number; seen: boolean }>();
  faces.forEach((face, f) =>
    face.forEach((from, i) => {
      const to = face[(i + 1) % face.length];
      const key = from < to ? `${from}-${to}` : `${to}-${from}`;
      const edge = edges.get(key) ?? { from, to, seen: false };
      edge.seen ||= visible[f].seen;
      edges.set(key, edge);
    }),
  );
  const strokes: SolidStroke[] = faces.flatMap((face, f) => {
    if (!visible[f].seen) return [];
    const n = visible[f].normal;
    const size = Math.hypot(...n);
    // De frente, el color pleno; arriba, más claro; al costado, intermedio
    const shade = Math.abs(n[2]) / size > 0.7 ? 1 : n[1] / size > 0.5 ? 0.45 : 0.72;
    return [{ kind: "face" as const, points: face.map(index => project(vertices[index], k)), shade }];
  });
  // Primero las ocultas, debajo de las visibles
  const lines = [...edges.values()].map(edge => ({ kind: "line" as const, from: project(vertices[edge.from], k), to: project(vertices[edge.to], k), hidden: !edge.seen }));
  return [...strokes, ...lines.filter(line => line.hidden), ...lines.filter(line => !line.hidden)];
}

/** Puntos de un arco de elipse (centro, semiejes) del ángulo `from` al `to`, en radianes; y hacia abajo. */
function ellipseArc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps = 36): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / steps;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

const rightMark = (corner: Point, size = 7): Point[] => [
  { x: corner.x + size, y: corner.y },
  { x: corner.x + size, y: corner.y - size },
  { x: corner.x, y: corner.y - size },
];

/** Un rótulo posible: el punto de la medida y hacia dónde sale la caja desde él. */
interface LabelOption {
  at: Point;
  toward: Point;
}

interface Placed {
  strokes: SolidStroke[];
  rightMarks: Point[][];
  dots: Point[];
  /** Por cada medida rotulada, sus sitios posibles en orden de preferencia y el punto del que sale la guía si ninguno sirve. */
  labels: Array<{ key: string; options: LabelOption[]; leaderFrom: Point }>;
}

/** Dimensiones del dibujo (ancho y alto en las unidades del sólido) para elegir la escala. */
function extentOf(solid: Solid): { w: number; h: number; min: number } {
  const depthX = DEPTH * Math.cos(DEPTH_ANGLE);
  const depthY = DEPTH * Math.sin(DEPTH_ANGLE);
  switch (solid.kind) {
    case "cube":
      return { w: solid.edge * (1 + depthX), h: solid.edge * (1 + depthY), min: solid.edge * DEPTH };
    case "rectangular_prism":
      return { w: solid.length + solid.width * depthX, h: solid.height + solid.width * depthY, min: Math.min(solid.length, solid.height, solid.width * DEPTH) };
    case "triangular_prism":
      return { w: solid.base + solid.length * depthX, h: solid.triangleHeight + solid.length * depthY, min: Math.min(solid.base, solid.triangleHeight, solid.length * DEPTH) };
    case "cylinder":
      return { w: 2 * solid.radius, h: solid.height + 2 * solid.radius * ELLIPSE, min: Math.min(2 * solid.radius, solid.height) };
    case "cone":
      return { w: 2 * solid.radius, h: solid.height + solid.radius * ELLIPSE, min: Math.min(2 * solid.radius, solid.height) };
    case "square_pyramid":
      return { w: solid.base * (1 + depthX), h: solid.height + solid.base * depthY, min: Math.min(solid.base * DEPTH, solid.height) };
    case "sphere":
      return { w: 2 * solid.radius, h: 2 * solid.radius, min: 2 * solid.radius };
  }
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };
const UP = { x: 0, y: -1 };
const DOWN = { x: 0, y: 1 };
/** Hacia afuera de una arista que se aleja hacia el fondo a la derecha. */
const DEPTH_OUT = { x: 0.82, y: 0.57 };

/** El dibujo de un sólido a escala k, con el origen en la esquina delantera inferior izquierda (y hacia abajo). */
function drawSolid(solid: Solid, k: number): Placed {
  const placed: Placed = { strokes: [], rightMarks: [], dots: [], labels: [] };
  const label = (key: string, leaderFrom: Point, ...options: LabelOption[]) => placed.labels.push({ key, options, leaderFrom });
  switch (solid.kind) {
    case "cube":
    case "rectangular_prism": {
      const [l, w, h] = solid.kind === "cube" ? [solid.edge, solid.edge, solid.edge] : [solid.length, solid.width, solid.height];
      const v: V3[] = [
        [0, 0, 0], [l, 0, 0], [l, h, 0], [0, h, 0],
        [0, 0, w], [l, 0, w], [l, h, w], [0, h, w],
      ];
      placed.strokes = polyhedron(v, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]], k);
      const p = (i: number) => project(v[i], k);
      if (solid.kind === "cube") label("edge", mid(p(0), p(1)), { at: mid(p(0), p(1)), toward: DOWN });
      else {
        label("length", mid(p(0), p(1)), { at: mid(p(0), p(1)), toward: DOWN });
        label("height", mid(p(0), p(3)), { at: mid(p(0), p(3)), toward: LEFT });
        label("width", mid(p(1), p(5)), { at: mid(p(1), p(5)), toward: DEPTH_OUT });
      }
      break;
    }
    case "triangular_prism": {
      const { base: b, triangleHeight: t, length: L } = solid;
      const apex = solid.triangle === "right" ? 0 : b / 2;
      const v: V3[] = [[0, 0, 0], [b, 0, 0], [apex, t, 0], [0, 0, L], [b, 0, L], [apex, t, L]];
      placed.strokes = polyhedron(v, [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [0, 2, 5, 3]], k);
      const p = (i: number) => project(v[i], k);
      label("base", mid(p(0), p(1)), { at: mid(p(0), p(1)), toward: DOWN });
      if (solid.triangle === "right") label("triangleHeight", mid(p(0), p(2)), { at: mid(p(0), p(2)), toward: LEFT });
      else {
        // La altura del triángulo, punteada del vértice a la base, con su ángulo recto
        const foot = { x: p(2).x, y: p(0).y };
        placed.strokes.push({ kind: "line", from: p(2), to: foot, hidden: true, thin: true });
        placed.rightMarks.push(rightMark(foot));
        const middle = mid(p(2), foot);
        label("triangleHeight", middle, { at: { x: middle.x - 3, y: middle.y }, toward: LEFT }, { at: { x: middle.x + 3, y: middle.y }, toward: RIGHT });
      }
      label("length", mid(p(1), p(4)), { at: mid(p(1), p(4)), toward: DEPTH_OUT });
      break;
    }
    case "cylinder": {
      const rx = solid.radius * k;
      const ry = rx * ELLIPSE;
      const h = solid.height * k;
      const cx = rx;
      const top = -h;
      placed.strokes.push({ kind: "curve", points: [...ellipseArc(cx, 0, rx, ry, 0, Math.PI), ...ellipseArc(cx, top, rx, ry, Math.PI, 0)], closed: true, hidden: false, fill: 1 });
      placed.strokes.push({ kind: "curve", points: ellipseArc(cx, top, rx, ry, 0, 2 * Math.PI, 72), closed: true, hidden: false, fill: 0.45 });
      placed.strokes.push({ kind: "curve", points: ellipseArc(cx, 0, rx, ry, Math.PI, 2 * Math.PI), closed: false, hidden: true });
      placed.strokes.push({ kind: "line", from: { x: cx, y: top }, to: { x: cx + rx, y: top }, hidden: false, thin: true });
      placed.dots.push({ x: cx, y: top });
      const radius = { x: cx + rx / 2, y: top };
      // El radio: encima de su segmento si cabe dentro de la tapa; si no, a la derecha de su extremo
      label("radius", radius, { at: { x: radius.x, y: top - 2 }, toward: UP }, { at: { x: cx + rx + 2, y: top }, toward: { x: 1, y: -0.35 } });
      label("height", { x: cx + rx, y: top / 2 }, { at: { x: cx + rx, y: top / 2 }, toward: RIGHT });
      break;
    }
    case "cone": {
      const rx = solid.radius * k;
      const ry = rx * ELLIPSE;
      const h = solid.height * k;
      const cx = rx;
      const apex = { x: cx, y: -h };
      // Puntos de tangencia desde el vértice: la parte de la base que se ve es la de adelante, entre ellos
      const ty = (ry * ry) / -h;
      const tx = rx * Math.sqrt(Math.max(0, 1 - (ty * ty) / (ry * ry)));
      const tangentAngle = Math.atan2(ty / ry, tx / rx);
      placed.strokes.push({ kind: "curve", points: [apex, ...ellipseArc(cx, 0, rx, ry, tangentAngle, Math.PI - tangentAngle)], closed: true, hidden: false, fill: 1 });
      placed.strokes.push({ kind: "curve", points: ellipseArc(cx, 0, rx, ry, Math.PI - tangentAngle, 2 * Math.PI + tangentAngle), closed: false, hidden: true });
      placed.strokes.push({ kind: "line", from: apex, to: { x: cx, y: 0 }, hidden: true, thin: true });
      placed.strokes.push({ kind: "line", from: { x: cx, y: 0 }, to: { x: cx + rx, y: 0 }, hidden: true, thin: true });
      placed.rightMarks.push(rightMark({ x: cx, y: 0 }));
      placed.dots.push({ x: cx, y: 0 });
      const height = { x: cx, y: -h / 2 };
      label("height", height, { at: { x: cx - 3, y: height.y }, toward: LEFT }, { at: { x: cx + 3, y: height.y }, toward: RIGHT });
      // El radio, debajo de la base: el borde de adelante de la elipse queda a 0,87 ry a la altura de su punto medio
      label("radius", { x: cx + rx / 2, y: 0 }, { at: { x: cx + rx / 2, y: 0.87 * ry + 1 }, toward: DOWN });
      if (solid.slant) {
        const slant = mid(apex, { x: cx + tx, y: ty });
        label("slant", slant, { at: { x: slant.x + 3, y: slant.y }, toward: { x: 1, y: -0.15 } });
      }
      break;
    }
    case "square_pyramid": {
      const { base: b, height: h } = solid;
      const v: V3[] = [[0, 0, 0], [b, 0, 0], [b, 0, b], [0, 0, b], [b / 2, h, b / 2]];
      placed.strokes = polyhedron(v, [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], k);
      const p = (i: number) => project(v[i], k);
      const center = project([b / 2, 0, b / 2], k);
      placed.strokes.push({ kind: "line", from: p(4), to: center, hidden: true, thin: true });
      placed.rightMarks.push(rightMark(center));
      placed.dots.push(center);
      label("base", mid(p(0), p(1)), { at: mid(p(0), p(1)), toward: DOWN });
      const height = mid(p(4), center);
      label("height", height, { at: { x: height.x + 3, y: height.y }, toward: RIGHT }, { at: { x: height.x - 3, y: height.y }, toward: LEFT });
      if (solid.slant) {
        // La apotema: del vértice al punto medio de la arista de adelante, sobre la cara que se ve
        const foot = project([b / 2, 0, 0], k);
        placed.strokes.push({ kind: "line", from: p(4), to: foot, hidden: false, thin: true });
        const slant = mid(p(4), foot);
        label("slant", slant, { at: { x: slant.x - 3, y: slant.y }, toward: LEFT }, { at: { x: slant.x + 3, y: slant.y }, toward: RIGHT });
      }
      break;
    }
    case "sphere": {
      const r = solid.radius * k;
      const c = { x: r, y: -r };
      placed.strokes.push({ kind: "curve", points: ellipseArc(c.x, c.y, r, r, 0, 2 * Math.PI, 96), closed: true, hidden: false, fill: 1 });
      placed.strokes.push({ kind: "curve", points: ellipseArc(c.x, c.y, r, r * ELLIPSE, 0, Math.PI), closed: false, hidden: false, thin: true });
      placed.strokes.push({ kind: "curve", points: ellipseArc(c.x, c.y, r, r * ELLIPSE, Math.PI, 2 * Math.PI), closed: false, hidden: true, thin: true });
      // El radio sube en diagonal: así su rótulo no cae sobre el ecuador
      const end = { x: c.x + r * Math.cos(Math.PI / 6), y: c.y - r * Math.sin(Math.PI / 6) };
      placed.strokes.push({ kind: "line", from: c, to: end, hidden: false, thin: true });
      placed.dots.push(c);
      const middle = mid(c, end);
      label("radius", middle, { at: middle, toward: { x: -0.5, y: -0.87 } }, { at: middle, toward: { x: 0.5, y: 0.87 } });
      break;
    }
  }
  return placed;
}

/* ── Desarrollo plano ── */

/** Sombra de cada cara del desarrollo: las caras opuestas del sólido, que son iguales, llevan la misma. */
const SHADE = { front: 1, side: 0.72, base: 0.45 } as const;

/**
 * Los lados del triángulo del prisma que salen del extremo izquierdo y del derecho de su base: son los
 * anchos de los rectángulos vecinos al de la base. En el rectángulo, el vértice está sobre el extremo
 * izquierdo, así que el de la izquierda es el cateto.
 */
const netSides = triangleSides;

/** Dimensiones del desarrollo plano, en las unidades del sólido, para elegir la escala. */
function netExtentOf(solid: Solid): { w: number; h: number; min: number } {
  switch (solid.kind) {
    case "cube":
      return { w: 4 * solid.edge, h: 3 * solid.edge, min: solid.edge };
    case "rectangular_prism":
      return { w: 2 * (solid.length + solid.width), h: solid.height + 2 * solid.width, min: Math.min(solid.length, solid.width, solid.height) };
    case "triangular_prism": {
      const [left, right] = netSides(solid);
      return { w: left + solid.base + right, h: solid.length + 2 * solid.triangleHeight, min: Math.min(solid.base, solid.triangleHeight, solid.length, left, right) };
    }
    case "cylinder":
      return { w: 2 * Math.PI * solid.radius, h: solid.height + 4 * solid.radius, min: Math.min(2 * solid.radius, solid.height) };
    default:
      // El esquema solo deja pedir desarrollo a los cuatro de arriba
      return extentOf(solid);
  }
}

/**
 * Los trazos de un desarrollo hecho de polígonos: cada cara rellena, las aristas que comparten dos
 * caras punteadas y finas (por ahí se dobla) y el contorno continuo.
 */
function netStrokes(faces: Array<{ points: Point[]; shade: number }>): SolidStroke[] {
  const key = (p: Point) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  const edges = new Map<string, { from: Point; to: Point; faces: number }>();
  for (const face of faces) {
    face.points.forEach((from, i) => {
      const to = face.points[(i + 1) % face.points.length];
      const id = [key(from), key(to)].sort().join("|");
      const edge = edges.get(id) ?? { from, to, faces: 0 };
      edge.faces += 1;
      edges.set(id, edge);
    });
  }
  const lines = [...edges.values()].map(edge => ({ kind: "line" as const, from: edge.from, to: edge.to, hidden: edge.faces > 1, ...(edge.faces > 1 ? { thin: true } : {}) }));
  return [...faces.map(face => ({ kind: "face" as const, ...face })), ...lines.filter(line => line.hidden), ...lines.filter(line => !line.hidden)];
}

/**
 * El desarrollo plano a escala k, con y hacia abajo. El cubo y el prisma rectangular, en cruz: las
 * cuatro caras laterales en fila y las bases arriba y abajo de la segunda. El prisma triangular, sus
 * tres rectángulos en fila con los triángulos arriba y abajo del de la base. El cilindro, el
 * rectángulo de largo 2πr con los dos círculos tocándolo en un extremo.
 */
function drawNet(solid: Solid, k: number): Placed {
  const placed: Placed = { strokes: [], rightMarks: [], dots: [], labels: [] };
  const label = (key: string, leaderFrom: Point, ...options: LabelOption[]) => placed.labels.push({ key, options, leaderFrom });
  const at = (x: number, y: number): Point => ({ x: x * k, y: -y * k });
  const rect = (x0: number, y0: number, x1: number, y1: number) => [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)];
  /** Una arista del contorno con el rótulo hacia afuera. */
  const edge = (from: Point, to: Point, toward: Point): LabelOption => ({ at: mid(from, to), toward });
  switch (solid.kind) {
    case "cube":
    case "rectangular_prism": {
      const [l, w, h] = solid.kind === "cube" ? [solid.edge, solid.edge, solid.edge] : [solid.length, solid.width, solid.height];
      placed.strokes = netStrokes([
        { points: rect(0, 0, w, h), shade: SHADE.side },
        { points: rect(w, 0, w + l, h), shade: SHADE.front },
        { points: rect(w + l, 0, 2 * w + l, h), shade: SHADE.side },
        { points: rect(2 * w + l, 0, 2 * (w + l), h), shade: SHADE.front },
        { points: rect(w, h, w + l, h + w), shade: SHADE.base },
        { points: rect(w, -w, w + l, 0), shade: SHADE.base },
      ]);
      const height = edge(at(0, 0), at(0, h), LEFT);
      const heightRight = edge(at(2 * (w + l), 0), at(2 * (w + l), h), RIGHT);
      const width = edge(at(0, 0), at(w, 0), DOWN);
      if (solid.kind === "cube") label("edge", width.at, width, height);
      else {
        label("height", height.at, height, heightRight);
        label("width", width.at, width, edge(at(w + l, 0), at(2 * w + l, 0), DOWN), edge(at(w, h), at(w, h + w), LEFT));
        const length = edge(at(w, -w), at(w + l, -w), DOWN);
        label("length", length.at, length, edge(at(w, h + w), at(w + l, h + w), UP));
      }
      break;
    }
    case "triangular_prism": {
      const { base: b, triangleHeight: t, length: L } = solid;
      const [left, right] = netSides(solid);
      const [x0, x1] = [left, left + b];
      const apex = x0 + (solid.triangle === "right" ? 0 : b / 2);
      placed.strokes = netStrokes([
        { points: rect(0, 0, x0, L), shade: SHADE.side },
        { points: rect(x0, 0, x1, L), shade: SHADE.front },
        { points: rect(x1, 0, x1 + right, L), shade: SHADE.side },
        { points: [at(x0, L), at(x1, L), at(apex, L + t)], shade: SHADE.base },
        { points: [at(x0, 0), at(x1, 0), at(apex, -t)], shade: SHADE.base },
      ]);
      const length = edge(at(0, 0), at(0, L), LEFT);
      label("length", length.at, length, edge(at(x1 + right, 0), at(x1 + right, L), RIGHT));
      // La base del triángulo es una línea de doblez: su rótulo va dentro del rectángulo de la base, junto
      // a ella; si no cabe, la guía sale de un poco más adentro, para no correr sobre la línea
      const base = mid(at(x0, L), at(x1, L));
      label("base", { x: base.x, y: base.y + 6 }, { at: base, toward: DOWN }, { at: mid(at(x0, 0), at(x1, 0)), toward: UP });
      if (solid.triangle === "right") {
        // El cateto es contorno: el rótulo, por fuera; el ángulo recto, en la esquina de la base
        placed.rightMarks.push(rightMark(at(x0, L)));
        const leg = edge(at(x0, L), at(x0, L + t), LEFT);
        label("triangleHeight", leg.at, leg);
      } else {
        // La altura, punteada del vértice a la base del triángulo de arriba, con su ángulo recto
        const foot = at(apex, L);
        placed.strokes.push({ kind: "line", from: at(apex, L + t), to: foot, hidden: true, thin: true });
        placed.rightMarks.push(rightMark(foot));
        const middle = mid(at(apex, L + t), foot);
        label("triangleHeight", middle, { at: { x: middle.x - 3, y: middle.y }, toward: LEFT }, { at: { x: middle.x + 3, y: middle.y }, toward: RIGHT });
      }
      break;
    }
    case "cylinder": {
      const { radius: r, height: h } = solid;
      const long = 2 * Math.PI * r;
      placed.strokes = netStrokes([{ points: rect(0, 0, long, h), shade: SHADE.front }]);
      for (const cy of [h + r, -r]) {
        const c = at(r, cy);
        placed.strokes.push({ kind: "curve", points: ellipseArc(c.x, c.y, r * k, r * k, 0, 2 * Math.PI, 72), closed: true, hidden: false, fill: SHADE.base });
      }
      // El radio, en el círculo de arriba
      const center = at(r, h + r);
      placed.strokes.push({ kind: "line", from: center, to: { x: center.x + r * k, y: center.y }, hidden: false, thin: true });
      placed.dots.push(center);
      const radius = { x: center.x + (r * k) / 2, y: center.y };
      label("radius", radius, { at: { x: radius.x, y: center.y - 2 }, toward: UP }, { at: { x: center.x + r * k + 2, y: center.y }, toward: { x: 1, y: -0.35 } });
      const height = edge(at(0, 0), at(0, h), LEFT);
      label("height", height.at, height, edge(at(long, 0), at(long, h), RIGHT));
      // El largo, por fuera del rectángulo al lado de los círculos; si no cabe, por dentro
      const bottom = edge(at(0, 0), at(long, 0), DOWN);
      label("circumference", bottom.at, bottom, edge(at(0, h), at(long, h), UP), { at: mid(at(0, h), at(long, h)), toward: DOWN });
      break;
    }
    default:
      return drawSolid(solid, k);
  }
  return placed;
}

/** El texto de una medida en la figura: su rótulo, su valor con la unidad, o nada. */
function measureLabel(measure: SolidMeasure, unit: string, showValues: boolean): { latex: string; plain: string } | null {
  if (measure.label !== undefined) return measure.label === "" ? null : { latex: measure.labelLatex ?? plainToLatex(measure.label), plain: measure.label };
  if (!showValues) return null;
  const exact = measure.exact !== undefined ? measure.exact : measure.derived ? recognize(measure.value) : rational(measure.value);
  const unitText = unit ? unitLatex(unit) : "";
  const unitPlain = unit ? ` ${unit}` : "";
  if (exact) return { latex: `${exactText(exact, { format: "latex" })}${unitText}`, plain: `${exactText(exact)}${unitPlain}` };
  return { latex: `\\approx ${approxText(measure.value, "latex")}${unitText}`, plain: `≈ ${approxText(measure.value)}${unitPlain}` };
}

/** Los tramos rectos de un trazo, para saber si un rótulo lo pisa. */
function segmentsOf(stroke: SolidStroke): Array<[Point, Point]> {
  if (stroke.kind === "line") return [[stroke.from, stroke.to]];
  const points = stroke.points;
  const closed = stroke.kind === "face" || stroke.closed;
  return points.flatMap((point, i) => (i + 1 < points.length ? [[point, points[i + 1]] as [Point, Point]] : closed ? [[point, points[0]] as [Point, Point]] : []));
}

/**
 * Dónde va cada trazo y cada rótulo de los sólidos del bloque, en píxeles del diseño. Cada sólido va
 * en su sitio, lado a lado y apoyados en la misma línea; con toScale, todos a la misma escala (y los
 * desarrollos, a la misma entre ellos). Si alguno lleva su desarrollo al lado, cada sólido va en su
 * fila con el suyo, centrados en ella. Cada rótulo toma el primero de sus sitios que no pisa ningún
 * trazo ni otro rótulo; si ninguno sirve, va al costado del dibujo con una línea guía.
 */
export function solidLayout(spec: SolidSpec): SolidLayout {
  const issues: string[] = [];
  const many = spec.solids.length > 1;
  const solidName = (index: number) => (many ? `el sólido ${index + 1} (${SOLID_NAMES[spec.solids[index].kind]})` : `el ${SOLID_NAMES[spec.solids[index].kind]}`);
  // Cada sólido da uno o dos dibujos: el sólido (salvo con net "only") y su desarrollo
  const pieces = spec.solids.flatMap((solid, index) => {
    const net = netOf(solid);
    return [
      ...(net === "only" ? [] : [{ solid: index, net: false, extent: extentOf(solid) }]),
      ...(net ? [{ solid: index, net: true, extent: netExtentOf(solid) }] : []),
    ];
  });
  const name = (piece: { solid: number; net: boolean }) => (piece.net ? solidName(piece.solid).replace(/^el /, "el desarrollo plano del ") : solidName(piece.solid));
  const fit = (piece: (typeof pieces)[number]) => (piece.net ? NET_EXTENT : EXTENT) / Math.max(piece.extent.w, piece.extent.h);
  const shared = (net: boolean) => Math.min(...pieces.filter(piece => piece.net === net).map(fit));
  const groups = pieces.map(piece => {
    const solid = spec.solids[piece.solid];
    const k = spec.toScale ? shared(piece.net) : fit(piece);
    const drawn = piece.net ? drawNet(solid, k) : drawSolid(solid, k);
    const extent = piece.extent;
    if (extent.min * k < MIN_FEATURE) {
      issues.push(
        spec.toScale && Math.max(extent.w, extent.h) * k < (piece.net ? NET_EXTENT : EXTENT) * 0.4
          ? `${name(piece)} queda muy pequeño junto a los demás, porque van a la misma escala; quita toScale o ponlos en bloques separados.`
          : `${name(piece)} es demasiado alargado para dibujarlo legible: sus medidas son muy desiguales.`,
      );
    }
    const segments = drawn.strokes.flatMap(segmentsOf);
    const points = segments.flat();
    const shape = { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)) };
    const measures = solidMeasures(solid);
    const labels: SolidLabel[] = [];
    for (const anchor of drawn.labels) {
      const measure = measures.find(item => item.key === anchor.key);
      const text = measure ? measureLabel(measure, spec.unit ?? "", spec.showValues) : null;
      if (!text) continue;
      const size = labelSize(text.plain);
      const free = (box: Box) => !labels.some(other => boxesOverlap(box, other.box, 2)) && !segments.some(([p, q]) => segmentTouchesBox(p, q, box));
      const spot = anchor.options
        .map(option => {
          const length = Math.hypot(option.toward.x, option.toward.y) || 1;
          const dir = { x: option.toward.x / length, y: option.toward.y / length };
          const reach = 5 + (Math.abs(dir.x) * size.w) / 2 + (Math.abs(dir.y) * size.h) / 2;
          return { x: option.at.x + dir.x * reach, y: option.at.y + dir.y * reach };
        })
        .find(center => free(boxAt(center, size)));
      if (spot) {
        labels.push({ ...text, ...spot, box: boxAt(spot, size) });
        continue;
      }
      // Al costado del dibujo, a la altura de la medida, con una guía hasta ella
      const from = anchor.leaderFrom;
      const sides = [
        { x: shape.maxX + 14 + size.w / 2, y: from.y },
        { x: shape.minX - 14 - size.w / 2, y: from.y },
      ].sort((a, b) => Math.abs(a.x - from.x) - Math.abs(b.x - from.x));
      const aside = sides.find(center => !labels.some(other => boxesOverlap(boxAt(center, size), other.box, 2)));
      if (!aside) {
        issues.push(`en ${name(piece)}, el rótulo «${text.plain}» no cabe sin montarse sobre otro; acórtalo o usa una letra.`);
        continue;
      }
      const box = boxAt(aside, size);
      labels.push({ ...text, ...aside, box, leader: [from, { x: aside.x > from.x ? box.x : box.x + box.w, y: aside.y }] });
    }
    const xs = [...points.map(p => p.x), ...labels.flatMap(label => [label.box.x, label.box.x + label.box.w])];
    const ys = [...points.map(p => p.y), ...labels.flatMap(label => [label.box.y, label.box.y + label.box.h])];
    return { ...piece, drawn, labels, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });

  // Una fila con todos o, si algún desarrollo va junto a su sólido, una fila por sólido
  const beside = spec.solids.some(solid => netOf(solid) === "beside");
  const rows = beside ? spec.solids.map((_, index) => groups.filter(group => group.solid === index)) : [groups];
  const rowWidth = (row: typeof groups) => row.reduce((sum, group) => sum + group.maxX - group.minX, 0) + GAP * (row.length - 1);
  const inner = Math.max(...rows.map(rowWidth));
  const drawings: SolidDrawing[] = [];
  const labels: SolidLabel[] = [];
  let rowTop = PAD;
  for (const row of rows) {
    // Los sólidos solos se apoyan en la misma línea; junto a un desarrollo, que es más alto, se centran
    const centered = row.some(group => group.net);
    const above = Math.max(...row.map(group => -group.minY));
    const height = centered ? Math.max(...row.map(group => group.maxY - group.minY)) : above + Math.max(...row.map(group => group.maxY));
    let cursor = PAD + (inner - rowWidth(row)) / 2;
    for (const group of row) {
      const dx = cursor - group.minX;
      const dy = centered ? rowTop + (height - (group.maxY - group.minY)) / 2 - group.minY : rowTop + above;
      const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
      const moveStroke = (stroke: SolidStroke): SolidStroke => (stroke.kind === "line" ? { ...stroke, from: move(stroke.from), to: move(stroke.to) } : { ...stroke, points: stroke.points.map(move) });
      drawings.push({ solid: group.solid, net: group.net, strokes: group.drawn.strokes.map(moveStroke), rightMarks: group.drawn.rightMarks.map(mark => mark.map(move)), dots: group.drawn.dots.map(move) });
      for (const label of group.labels) {
        labels.push({ ...label, ...move(label), box: { ...label.box, x: label.box.x + dx, y: label.box.y + dy }, ...(label.leader ? { leader: [move(label.leader[0]), move(label.leader[1])] as [Point, Point] } : {}) });
      }
      cursor += group.maxX - group.minX + GAP;
    }
    rowTop += height + ROW_GAP;
  }
  return { width: Math.round(inner + 2 * PAD), height: Math.round(rowTop - ROW_GAP + PAD), drawings, labels, issues };
}

/** Un trazo de puntos como `d` de SVG. */
export const pointsPath = (points: Point[], closed = false) => `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")}${closed ? " Z" : ""}`;

/* ── Validación y lo que ve la IA ── */

/**
 * Lo que impide dibujar el bloque. `sheetWidth` es el ancho útil de la hoja: la figura se puede
 * reducir hasta FIGURE_SCALE_MIN de su diseño antes de que sus rótulos dejen de leerse en papel.
 */
export function solidIssues(spec: SolidSpec, compile: (latex: string) => string | null, sheetWidth: number): string[] {
  const issues: string[] = [];
  const many = spec.solids.length > 1;
  spec.solids.forEach((solid, index) => {
    const where = many ? `el sólido ${index + 1} (${SOLID_NAMES[solid.kind]})` : `el ${SOLID_NAMES[solid.kind]}`;
    for (const measure of solidMeasures(solid)) {
      if (!measure.derived && exactDecimals(measure.value, 4) === null) issues.push(`en ${where}, la medida ${measure.name} (${formatNumber(measure.value, 6)}) tiene más de 4 decimales y no se puede escribir completa en la figura.`);
      if (measure.label && NUMBER_LABEL.test(measure.label)) issues.push(`en ${where}, el rótulo de ${measure.name} («${measure.label}») es una medida: quítalo y el sistema escribe el valor.`);
      if (measure.label) {
        const error = compile(measure.labelLatex ?? plainToLatex(measure.label));
        if (error) issues.push(`en ${where}, el rótulo «${measure.label}» no se puede escribir (${error}).`);
      }
    }
    if (solid.kind === "cone" && solid.slantLabel !== undefined && !solid.slant) issues.push(`en ${where}, hay rótulo para la generatriz (slantLabel) pero no se dibuja: pon slant en true.`);
    if (solid.kind === "square_pyramid" && solid.slantLabel !== undefined && !solid.slant) issues.push(`en ${where}, hay rótulo para la apotema (slantLabel) pero no se dibuja: pon slant en true.`);
  });
  if (issues.length > 0) return issues;
  const layout = solidLayout(spec);
  if (layout.width * FIGURE_SCALE_MIN > sheetWidth) {
    const nets = spec.solids.some(solid => netOf(solid));
    issues.push(`${nets ? "los sólidos y sus desarrollos" : "los sólidos"} no caben a lo ancho de la hoja sin que sus medidas dejen de leerse: pon algunos en otro bloque.`);
  }
  return [...layout.issues, ...issues];
}

/** Una longitud como se lee: «5», «√61/2 ≈ 3,91», «6π ≈ 18,85». */
function lengthText(value: number, exact: Exact | null = recognize(value)): string {
  if (!exact) return `≈ ${approxText(value)}`;
  return exact.pi || exact.r > 1 ? `${exactText(exact)} ≈ ${approxText(value)}` : exactText(exact);
}

/** Las caras del desarrollo plano con sus medidas, para que la IA sepa qué se dibujó. */
function netDescription(solid: Solid, unit: string): string | null {
  const net = netOf(solid);
  if (!net) return null;
  const n = (value: number) => formatDecimalEs(value, 4);
  const faces = (() => {
    switch (solid.kind) {
      case "cube":
        return `6 cuadrados de ${n(solid.edge)}${unit} de lado`;
      case "rectangular_prism": {
        const { length: l, width: w, height: h } = solid;
        return `6 rectángulos, 2 de ${n(l)} × ${n(w)}${unit}, 2 de ${n(l)} × ${n(h)}${unit} y 2 de ${n(w)} × ${n(h)}${unit}`;
      }
      case "triangular_prism": {
        const [left, right] = netSides(solid);
        const widths = [n(solid.base), lengthText(left), lengthText(right)].map(width => `${width}${unit}`);
        return `2 triángulos de base ${n(solid.base)}${unit} y altura ${n(solid.triangleHeight)}${unit}, y 3 rectángulos de ${n(solid.length)}${unit} de largo y ${widths.slice(0, 2).join(", ")} y ${widths[2]} de ancho`;
      }
      case "cylinder": {
        const long = circumferenceMeasure(solid);
        return `un rectángulo de ${lengthText(long.value, long.exact ?? null)}${unit} (la longitud de la circunferencia de la base) por ${n(solid.height)}${unit} y 2 círculos de ${n(solid.radius)}${unit} de radio`;
      }
      default:
        return null;
    }
  })();
  return faces && `desarrollo plano${net === "only" ? " (dibujado sin el sólido)" : ""}: ${faces}`;
}

export const solidPlainTexts = (spec: SolidSpec): string[] => [spec.unit ?? "", ...spec.solids.flatMap(solid => solidMeasures(solid).map(measure => measure.label ?? ""))].filter(Boolean);

/**
 * Lo que calculó el sistema de cada sólido: volumen, áreas, generatriz o apotema, y caras, aristas y
 * vértices de los poliedros, escritos como los escribe el estudiante.
 */
export function describeSolids(spec: SolidSpec): string {
  const unit = spec.unit ? ` ${spec.unit}` : "";
  const many = spec.solids.length > 1;
  const parts = spec.solids.map((solid, index) => {
    const facts = solidFacts(solid);
    const given = solidMeasures(solid)
      .filter(measure => !measure.derived)
      .map(measure => `${measure.name} ${formatDecimalEs(measure.value, 4)}${unit}`)
      .join(", ");
    const items = [
      ...facts.extras.map(extra => `${extra.name} ${quantityText(extra.quantity)}${unit}`),
      `volumen ${quantityText(facts.volume)}${unit ? `${unit}³` : ""}`,
      ...(facts.lateral ? [`área lateral ${quantityText(facts.lateral)}${unit ? `${unit}²` : ""}`] : []),
      `área ${solid.kind === "sphere" ? "de la superficie" : "total"} ${quantityText(facts.total)}${unit ? `${unit}²` : ""}`,
      ...(facts.elements ? [`${facts.elements.faces} caras, ${facts.elements.edges} aristas y ${facts.elements.vertices} vértices`] : []),
      ...[netDescription(solid, unit)].filter(text => text !== null),
    ];
    return `${many ? `${index + 1}) ` : ""}${SOLID_NAMES[solid.kind][0].toUpperCase()}${SOLID_NAMES[solid.kind].slice(1)} (${given}): ${items.join("; ")}.`;
  });
  return `Sólidos: ${parts.join(" ")}`;
}

import type { BlockInput } from "./creator";
import { add, approxText, exactText, exactValue, multiply, rational, recognize, sqrtOf, type Exact } from "./creatorExact";
import { formatNumber } from "./creatorMath";
import { exactDecimals, formatDecimalEs } from "./creatorPlane";
import { NUMBER_LABEL, plainToLatex, segmentTouchesBox, unitLatex } from "./creatorTriangle";

/**
 * Sólidos del Creador de recursos: cubo, prismas, cilindro, cono, pirámide de base cuadrada y esfera.
 * Aquí se calculan su volumen y su área (exactos, con π y raíces cuando hace falta) y se decide el
 * dibujo: los poliedros en perspectiva caballera con las aristas ocultas punteadas, los cuerpos
 * redondos de frente con sus bases como elipses. El dibujo, el validador y lo que se le devuelve a la
 * IA salen de las mismas funciones.
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

/* ── Medidas ── */

/** Una medida del sólido: su nombre, el campo que la guarda, su rótulo y si es un dato o la calcula el sistema. */
export interface SolidMeasure {
  key: string;
  name: string;
  value: number;
  label: string | undefined;
  derived: boolean;
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
      return [given("radius", "radio", solid.radius, solid.radiusLabel), given("height", "altura", solid.height, solid.heightLabel)];
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

export interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
const boxAt = (center: Point, size: { w: number; h: number }): Box => ({ x: center.x - size.w / 2, y: center.y - size.h / 2, w: size.w, h: size.h });
const overlap = (a: Box, b: Box, gap = 2) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

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

/** El texto de una medida en la figura: su rótulo, su valor con la unidad, o nada. */
function measureLabel(measure: SolidMeasure, unit: string, showValues: boolean): { latex: string; plain: string } | null {
  if (measure.label !== undefined) return measure.label === "" ? null : { latex: plainToLatex(measure.label), plain: measure.label };
  if (!showValues) return null;
  const exact = measure.derived ? recognize(measure.value) : rational(measure.value);
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
 * en su sitio, lado a lado y apoyados en la misma línea; con toScale, todos a la misma escala. Cada
 * rótulo toma el primero de sus sitios que no pisa ningún trazo ni otro rótulo; si ninguno sirve, va
 * al costado del sólido con una línea guía.
 */
export function solidLayout(spec: SolidSpec): SolidLayout {
  const issues: string[] = [];
  const extents = spec.solids.map(extentOf);
  const many = spec.solids.length > 1;
  const name = (index: number) => (many ? `el sólido ${index + 1} (${SOLID_NAMES[spec.solids[index].kind]})` : `el ${SOLID_NAMES[spec.solids[index].kind]}`);
  const fit = (e: { w: number; h: number }) => EXTENT / Math.max(e.w, e.h);
  const shared = Math.min(...extents.map(fit));
  const groups = spec.solids.map((solid, index) => {
    const k = spec.toScale ? shared : fit(extents[index]);
    const drawn = drawSolid(solid, k);
    if (extents[index].min * k < MIN_FEATURE) {
      issues.push(
        spec.toScale && Math.max(extents[index].w, extents[index].h) * k < EXTENT * 0.4
          ? `${name(index)} queda muy pequeño junto a los demás, porque van a la misma escala; quita toScale o ponlos en bloques separados.`
          : `${name(index)} es demasiado alargado para dibujarlo legible: sus medidas son muy desiguales.`,
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
      const free = (box: Box) => !labels.some(other => overlap(box, other.box)) && !segments.some(([p, q]) => segmentTouchesBox(p, q, box));
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
      // Al costado del sólido, a la altura de la medida, con una guía hasta ella
      const from = anchor.leaderFrom;
      const sides = [
        { x: shape.maxX + 14 + size.w / 2, y: from.y },
        { x: shape.minX - 14 - size.w / 2, y: from.y },
      ].sort((a, b) => Math.abs(a.x - from.x) - Math.abs(b.x - from.x));
      const aside = sides.find(center => !labels.some(other => overlap(boxAt(center, size), other.box)));
      if (!aside) {
        issues.push(`en ${name(index)}, el rótulo «${text.plain}» no cabe sin montarse sobre otro; acórtalo o usa una letra.`);
        continue;
      }
      const box = boxAt(aside, size);
      labels.push({ ...text, ...aside, box, leader: [from, { x: aside.x > from.x ? box.x : box.x + box.w, y: aside.y }] });
    }
    const xs = [...points.map(p => p.x), ...labels.flatMap(label => [label.box.x, label.box.x + label.box.w])];
    const ys = [...points.map(p => p.y), ...labels.flatMap(label => [label.box.y, label.box.y + label.box.h])];
    return { drawn, labels, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });

  // Lado a lado, apoyados en la línea y = 0
  const top = Math.max(...groups.map(group => -group.minY)) + PAD;
  const bottom = Math.max(...groups.map(group => group.maxY));
  const drawings: SolidDrawing[] = [];
  const labels: SolidLabel[] = [];
  let cursor = PAD;
  for (const group of groups) {
    const dx = cursor - group.minX;
    const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + top });
    const moveStroke = (stroke: SolidStroke): SolidStroke => (stroke.kind === "line" ? { ...stroke, from: move(stroke.from), to: move(stroke.to) } : { ...stroke, points: stroke.points.map(move) });
    drawings.push({ strokes: group.drawn.strokes.map(moveStroke), rightMarks: group.drawn.rightMarks.map(mark => mark.map(move)), dots: group.drawn.dots.map(move) });
    for (const label of group.labels) {
      labels.push({ ...label, ...move(label), box: { ...label.box, x: label.box.x + dx, y: label.box.y + top }, ...(label.leader ? { leader: [move(label.leader[0]), move(label.leader[1])] as [Point, Point] } : {}) });
    }
    cursor = dx + group.maxX + GAP;
  }
  return { width: Math.round(cursor - GAP + PAD), height: Math.round(top + bottom + PAD), drawings, labels, issues };
}

/** Un trazo de puntos como `d` de SVG. */
export const pointsPath = (points: Point[], closed = false) => `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")}${closed ? " Z" : ""}`;

/* ── Validación y lo que ve la IA ── */

export function solidIssues(spec: SolidSpec, compile: (latex: string) => string | null): string[] {
  const issues: string[] = [];
  const many = spec.solids.length > 1;
  spec.solids.forEach((solid, index) => {
    const where = many ? `el sólido ${index + 1} (${SOLID_NAMES[solid.kind]})` : `el ${SOLID_NAMES[solid.kind]}`;
    for (const measure of solidMeasures(solid)) {
      if (!measure.derived && exactDecimals(measure.value, 4) === null) issues.push(`en ${where}, la medida ${measure.name} (${formatNumber(measure.value, 6)}) tiene más de 4 decimales y no se puede escribir completa en la figura.`);
      if (measure.label && NUMBER_LABEL.test(measure.label)) issues.push(`en ${where}, el rótulo de ${measure.name} («${measure.label}») es una medida: quítalo y el sistema escribe el valor.`);
      if (measure.label) {
        const error = compile(plainToLatex(measure.label));
        if (error) issues.push(`en ${where}, el rótulo «${measure.label}» no se puede escribir (${error}).`);
      }
    }
    if (solid.kind === "cone" && solid.slantLabel !== undefined && !solid.slant) issues.push(`en ${where}, hay rótulo para la generatriz (slantLabel) pero no se dibuja: pon slant en true.`);
    if (solid.kind === "square_pyramid" && solid.slantLabel !== undefined && !solid.slant) issues.push(`en ${where}, hay rótulo para la apotema (slantLabel) pero no se dibuja: pon slant en true.`);
  });
  if (issues.length > 0) return issues;
  return solidLayout(spec).issues;
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
    ];
    return `${many ? `${index + 1}) ` : ""}${SOLID_NAMES[solid.kind][0].toUpperCase()}${SOLID_NAMES[solid.kind].slice(1)} (${given}): ${items.join("; ")}.`;
  });
  return `Sólidos: ${parts.join(" ")}`;
}

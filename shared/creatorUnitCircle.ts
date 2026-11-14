import type { BlockInput } from "./creator";
import { divide, exactText, type Exact } from "./creatorExact";
import { formatNumber } from "./creatorMath";
import { boxAt, boxesOverlap, plainToLatex, segmentTouchesBox, support, type Box, type Point } from "./creatorFigureLabels";

/**
 * Círculo unitario del Creador de recursos: los ángulos notables (múltiplos de 30° y de 45°) con sus
 * coordenadas (cos, sen) escritas exactas, √2/2 y no 0,71, y un ángulo resaltado con su lado terminal,
 * el arco de giro y su triángulo de referencia. Lo que no cabe se rechaza aquí, antes de la hoja.
 */

export const UNIT_CIRCLE_SETS = ["all", "first_quadrant", "axes"] as const;
export type UnitCircleSet = (typeof UNIT_CIRCLE_SETS)[number];
export const UNIT_CIRCLE_LABEL_MAX = 6;

export type UnitCircleSpec = Extract<BlockInput, { type: "unit_circle" }>;

const SETS: Record<UnitCircleSet, number[]> = {
  all: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
  first_quadrant: [0, 30, 45, 60, 90],
  axes: [0, 90, 180, 270],
};

export const unitCircleAngles = (set: UnitCircleSet) => SETS[set];

/** ¿Es un ángulo notable? Sus razones se escriben exactas. */
export const isNotableAngle = (degrees: number) => Number.isInteger(degrees) && (degrees % 30 === 0 || degrees % 45 === 0);

/** El mismo ángulo entre 0° y 360°. */
const normalizeAngle = (degrees: number) => ((degrees % 360) + 360) % 360;

const fraction = (n: number, d: number, r = 1): Exact => ({ n, d, r, pi: false });
/** Coseno del ángulo de referencia: 0°, 30°, 45°, 60° y 90°. */
const REFERENCE_COS: Record<number, Exact> = { 0: fraction(1, 1), 30: fraction(1, 2, 3), 45: fraction(1, 2, 2), 60: fraction(1, 2), 90: fraction(0, 1) };

/** Ángulo de referencia: el agudo (o nulo) que forma el lado terminal con el eje x. */
export function referenceAngle(degrees: number): number {
  const a = normalizeAngle(degrees);
  return a <= 90 ? a : a <= 180 ? 180 - a : a <= 270 ? a - 180 : 360 - a;
}

/** Cuadrante del lado terminal; 0 si está sobre un eje. */
export function quadrant(degrees: number): 0 | 1 | 2 | 3 | 4 {
  const a = normalizeAngle(degrees);
  if (a % 90 === 0) return 0;
  return (Math.floor(a / 90) + 1) as 1 | 2 | 3 | 4;
}

const negate = (value: Exact): Exact => ({ ...value, n: -value.n });

/** (cos, sen) exactos de un ángulo notable. */
export function exactCosSin(degrees: number): { cos: Exact; sin: Exact } {
  const a = normalizeAngle(degrees);
  const ref = referenceAngle(a);
  const cos = REFERENCE_COS[ref];
  const sin = REFERENCE_COS[90 - ref];
  const cosSign = a < 90 || a > 270 ? 1 : a === 90 || a === 270 ? 1 : -1;
  const sinSign = a > 180 ? -1 : 1;
  return { cos: cosSign < 0 ? negate(cos) : cos, sin: sinSign < 0 ? negate(sin) : sin };
}

/** Tangente exacta; null donde no está definida (90° y 270°). */
export function exactTan(degrees: number): Exact | null {
  const { cos, sin } = exactCosSin(degrees);
  return cos.n === 0 ? null : divide(sin, cos);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** Un ángulo en grados o en radianes, en texto plano ("150°", "5π/6") o en LaTeX. */
export function angleText(degrees: number, unit: "degrees" | "radians", format: "plain" | "latex" = "plain"): string {
  if (unit === "degrees") return format === "latex" ? `${degrees}^{\\circ}` : `${degrees}°`;
  if (degrees === 0) return "0";
  const g = gcd(degrees, 180);
  const n = degrees / g;
  const d = 180 / g;
  const pi = format === "latex" ? "\\pi" : "π";
  const top = `${n < 0 ? "-" : ""}${Math.abs(n) === 1 ? "" : Math.abs(n)}${pi}`;
  return d === 1 ? top : `${top}/${d}`;
}

/** Las coordenadas de un ángulo notable: "(√3/2, 1/2)" o, en LaTeX, con \tfrac. */
export function coordinatesText(degrees: number, format: "plain" | "latex" = "plain"): string {
  const { cos, sin } = exactCosSin(degrees);
  const options = { format, small: true, fraction: true } as const;
  return format === "latex" ? `\\left(${exactText(cos, options)},\\ ${exactText(sin, options)}\\right)` : `(${exactText(cos, options)}, ${exactText(sin, options)})`;
}

/* ── Disposición ── */

export interface UnitCircleLabel {
  x: number;
  y: number;
  latex: string;
  plain: string;
  kind: "angle" | "coordinates" | "rotation" | "reference" | "axis";
  box: Box;
}

export interface UnitCircleLayout {
  width: number;
  height: number;
  center: Point;
  radius: number;
  /** Hasta dónde llegan los ejes desde el centro. */
  axis: number;
  /** Puntos marcados sobre la circunferencia, con su ángulo. */
  points: Array<Point & { degrees: number }>;
  highlight: {
    point: Point;
    /** Pie del triángulo de referencia sobre el eje x; null sin triángulo. */
    foot: Point | null;
    /** Trazos SVG: el arco de giro con su flecha, el del ángulo de referencia y el cuadrito del recto. */
    rotation: string;
    arrow: string;
    reference: string | null;
    right: string | null;
  } | null;
  labels: UnitCircleLabel[];
  issues: string[];
}

const R = 170;
/** Distancia del centro a la que van los ángulos, por dentro de la circunferencia. */
const INNER = R - 27;
const ROTATION_R = 30;
const REFERENCE_R = 20;
const AXIS_REACH = R + 26;
const PAD = 8;
/** Ancho de una cifra o una letra de KaTeX a 14 px; el signo de grado es más angosto. */
const CHAR_W = 7.3;
const CLEARANCE = 3;

const fmt = (value: number) => value.toFixed(2);
const at = (degrees: number, radius: number): Point => ({ x: radius * Math.cos((degrees * Math.PI) / 180), y: -radius * Math.sin((degrees * Math.PI) / 180) });

/** Tamaño de un rótulo de texto en línea ("150°", "5π/6"). */
const textSize = (plain: string) => ({ w: [...plain].reduce((sum, char) => sum + (char === "°" ? 5 : CHAR_W), 0) + 6, h: 18 });

/** Tamaño de unas coordenadas con fracciones apiladas (\tfrac): cada fracción ocupa lo que su parte más larga. */
function coordinatesSize(degrees: number): { w: number; h: number } {
  const { cos, sin } = exactCosSin(degrees);
  const part = (value: Exact) => {
    const text = exactText({ ...value, n: Math.abs(value.n) }, { fraction: true });
    const [top, bottom = ""] = text.split("/");
    return Math.max([...top].length, [...bottom].length) * 7 + (value.n < 0 ? 12 : 0) + (bottom ? 4 : 0);
  };
  const stacked = cos.d > 1 || sin.d > 1;
  return { w: 22 + part(cos) + part(sin) + 6, h: stacked ? 27 : 18 };
}

/** Un arco de radio r de `from` a `to` grados (positivo en sentido antihorario), en coordenadas con el centro en 0. */
function arcPath(r: number, from: number, to: number): string {
  const start = at(from, r);
  const sweep = to > from ? 0 : 1;
  const span = Math.abs(to - from);
  if (span >= 360 - 1e-9) {
    const middle = at(from + (to - from) / 2, r);
    const end = at(to, r);
    return `M${fmt(start.x)} ${fmt(start.y)} A${r} ${r} 0 1 ${sweep} ${fmt(middle.x)} ${fmt(middle.y)} A${r} ${r} 0 1 ${sweep} ${fmt(end.x)} ${fmt(end.y)}`;
  }
  const end = at(to, r);
  return `M${fmt(start.x)} ${fmt(start.y)} A${r} ${r} 0 ${span > 180 ? 1 : 0} ${sweep} ${fmt(end.x)} ${fmt(end.y)}`;
}

/**
 * Centro de una caja dentro del ángulo entre los rayos a `from` y `to` grados (desde el centro), a la
 * distancia justa de los dos para no tocarlos, y sin entrar en un arco de radio `clear`.
 */
function insideWedge(from: number, to: number, size: { w: number; h: number }, clear: number): Point {
  const u1 = at(from, 1);
  const u2 = at(to, 1);
  const sin = Math.abs(Math.sin(((to - from) * Math.PI) / 180));
  // Normales hacia dentro de cada rayo
  const n1 = { x: -u1.y, y: u1.x };
  const inward1 = n1.x * u2.x + n1.y * u2.y > 0 ? n1 : { x: -n1.x, y: -n1.y };
  const n2 = { x: -u2.y, y: u2.x };
  const inward2 = n2.x * u1.x + n2.y * u1.y > 0 ? n2 : { x: -n2.x, y: -n2.y };
  const d1 = support(inward1, size) + CLEARANCE;
  const d2 = support(inward2, size) + CLEARANCE;
  let center = { x: (u1.x * d2 + u2.x * d1) / sin, y: (u1.y * d2 + u2.y * d1) / sin };
  const bisector = { x: (u1.x + u2.x) / Math.hypot(u1.x + u2.x, u1.y + u2.y), y: (u1.y + u2.y) / Math.hypot(u1.x + u2.x, u1.y + u2.y) };
  const nearest = (c: Point) => Math.hypot(Math.max(Math.abs(c.x) - size.w / 2, 0), Math.max(Math.abs(c.y) - size.h / 2, 0));
  for (let step = 0; step < 60 && nearest(center) < clear; step++) center = { x: center.x + bisector.x * 2, y: center.y + bisector.y * 2 };
  return center;
}

/** El rótulo del ángulo resaltado junto a su arco: su nombre (con la medida, si se muestran los valores) o su medida. */
function rotationText(spec: UnitCircleSpec): { latex: string; plain: string } | null {
  const highlight = spec.highlight;
  if (!highlight) return null;
  const measure = { latex: angleText(highlight.degrees, spec.unit, "latex"), plain: angleText(highlight.degrees, spec.unit) };
  if (!highlight.label) return measure;
  const name = { latex: plainToLatex(highlight.label), plain: highlight.label };
  return highlight.values ? { latex: `${name.latex} = ${measure.latex}`, plain: `${name.plain} = ${measure.plain}` } : name;
}

/**
 * Dónde va cada trazo y cada rótulo del círculo unitario, en píxeles del diseño con el centro en
 * (center.x, center.y) y la y hacia abajo.
 */
export function unitCircleLayout(spec: UnitCircleSpec): UnitCircleLayout {
  const issues: string[] = [];
  const labels: UnitCircleLabel[] = [];
  const angles = SETS[spec.angles];
  const highlight = spec.highlight && isNotableAngle(spec.highlight.degrees) ? spec.highlight : undefined;
  const target = highlight ? normalizeAngle(highlight.degrees) : null;

  // Lo resaltado: lado terminal, arco de giro, triángulo de referencia
  let drawn: UnitCircleLayout["highlight"] = null;
  // Lo que un rótulo no debe tapar: los ejes y, si hay ángulo resaltado, su lado terminal y su cateto vertical
  const segments: Array<[Point, Point]> = [[{ x: -AXIS_REACH, y: 0 }, { x: AXIS_REACH, y: 0 }], [{ x: 0, y: -AXIS_REACH }, { x: 0, y: AXIS_REACH }]];
  if (highlight && target !== null) {
    const point = at(target, R);
    // Sin decir nada, el triángulo va cuando existe: un ángulo sobre un eje no lo tiene
    const foot = highlight.triangle !== false && quadrant(target) !== 0 ? { x: point.x, y: 0 } : null;
    const end = at(highlight.degrees, ROTATION_R);
    const direction = highlight.degrees >= 0 ? 1 : -1;
    // La flecha sigue la tangente del arco en su extremo
    const tangent = { x: -Math.sin((highlight.degrees * Math.PI) / 180) * direction, y: -Math.cos((highlight.degrees * Math.PI) / 180) * direction };
    const normal = { x: -tangent.y, y: tangent.x };
    const tip = { x: end.x + tangent.x * 2, y: end.y + tangent.y * 2 };
    const arrow = `M${fmt(tip.x)} ${fmt(tip.y)} L${fmt(end.x - tangent.x * 7 + normal.x * 3.5)} ${fmt(end.y - tangent.y * 7 + normal.y * 3.5)} L${fmt(end.x - tangent.x * 7 - normal.x * 3.5)} ${fmt(end.y - tangent.y * 7 - normal.y * 3.5)} Z`;
    const ref = referenceAngle(target);
    // El arco del ángulo de referencia solo cuando no coincide con el de giro
    const axis = point.x >= 0 ? 0 : 180;
    const towards = axis === 0 ? (point.y < 0 ? ref : -ref) : point.y < 0 ? 180 - ref : 180 + ref;
    const reference = foot && Math.abs(highlight.degrees) >= 90 ? arcPath(REFERENCE_R, axis, towards) : null;
    const s = 9;
    const right = foot ? `M${fmt(foot.x - Math.sign(foot.x) * s)} 0 L${fmt(foot.x - Math.sign(foot.x) * s)} ${fmt(Math.sign(point.y) * s)} L${fmt(foot.x)} ${fmt(Math.sign(point.y) * s)}` : null;
    // Un giro de 0° no tiene arco ni flecha
    const turns = highlight.degrees !== 0;
    drawn = { point, foot, rotation: turns ? arcPath(ROTATION_R, 0, highlight.degrees) : "", arrow: turns ? arrow : "", reference, right };
    segments.push([{ x: 0, y: 0 }, point]);
    if (foot) segments.push([foot, point]);

    const free = (center: Point, size: { w: number; h: number }) => {
      const box = boxAt(center, size);
      return !segments.some(([p, q]) => segmentTouchesBox(p, q, box)) && !labels.some(other => boxesOverlap(box, other.box)) && Math.hypot(center.x, center.y) + Math.max(size.w, size.h) / 2 < R - 4;
    };

    // El nombre del giro, dentro del ángulo que barre el arco; si no cabe, junto a la flecha
    const rotation = rotationText(spec)!;
    const rotationSize = textSize(rotation.plain);
    const sweep = Math.abs(highlight.degrees);
    const candidates: Point[] = [];
    if (sweep > 0 && sweep < 180) {
      const wedge = insideWedge(0, highlight.degrees, rotationSize, ROTATION_R + 3);
      for (let push = 0; push <= 60; push += 4) candidates.push({ x: wedge.x * (1 + push / Math.hypot(wedge.x, wedge.y)), y: wedge.y * (1 + push / Math.hypot(wedge.x, wedge.y)) });
    } else if (sweep > 180) {
      // Un giro de más de media vuelta: en algún punto del barrido, del medio hacia los extremos
      for (const share of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
        const direction = highlight.degrees * share;
        for (const reach of [12, 22, 34]) candidates.push(at(direction, ROTATION_R + reach + support({ x: Math.cos((direction * Math.PI) / 180), y: Math.sin((direction * Math.PI) / 180) }, rotationSize)));
      }
    }
    for (const beyond of [16, 26, 38]) {
      const direction = highlight.degrees + Math.sign(highlight.degrees || 1) * beyond;
      candidates.push(at(direction, ROTATION_R + 6 + support({ x: Math.cos((direction * Math.PI) / 180), y: Math.sin((direction * Math.PI) / 180) }, rotationSize)));
    }
    const rotationSpot = candidates.find(candidate => free(candidate, rotationSize));
    if (rotationSpot) labels.push({ ...rotation, ...rotationSpot, kind: "rotation", box: boxAt(rotationSpot, rotationSize) });
    else issues.push(`el rótulo del ángulo resaltado («${rotation.plain}») no cabe junto a su arco; acórtalo.`);

    // La medida del ángulo de referencia, dentro del triángulo y pegada a sus dos lados
    if (reference && highlight.values) {
      const text = { latex: angleText(ref, spec.unit, "latex"), plain: angleText(ref, spec.unit) };
      const size = textSize(text.plain);
      const spot = insideWedge(axis, towards, size, REFERENCE_R + 3);
      const insideTriangle = foot && Math.abs(spot.x) + size.w / 2 < Math.abs(foot.x) - 3;
      if (insideTriangle && free(spot, size)) labels.push({ ...text, ...spot, kind: "reference", box: boxAt(spot, size) });
      else issues.push(`la medida del ángulo de referencia (${text.plain}) no cabe dentro del triángulo de referencia.`);
    }
  }

  // Ángulos por dentro; los de los ejes, a un lado del eje (el que no tapa lo resaltado)
  if (spec.showAngles) {
    for (const degrees of angles) {
      if (degrees === target) continue;
      const text = { latex: angleText(degrees, spec.unit, "latex"), plain: angleText(degrees, spec.unit) };
      const size = textSize(text.plain);
      const base = at(degrees, INNER - (degrees % 90 === 0 ? 4 : 0));
      // Si lo resaltado tapa el sitio de siempre: un poco girado, o por fuera, pegado a su punto (las coordenadas se corren)
      const dx = Math.cos((degrees * Math.PI) / 180);
      const dy = -Math.sin((degrees * Math.PI) / 180);
      const outside = { x: dx * (R + 7 + support({ x: dx, y: dy }, size)), y: dy * (R + 7 + support({ x: dx, y: dy }, size)) };
      const options: Point[] =
        degrees % 180 === 0
          ? [{ x: base.x, y: -(size.h / 2 + 4) }, { x: base.x, y: size.h / 2 + 4 }]
          : degrees % 90 === 0
            ? [{ x: size.w / 2 + 5, y: base.y }, { x: -(size.w / 2 + 5), y: base.y }]
            : [base, at(degrees + 6, INNER), at(degrees - 6, INNER), outside];
      const clear = options.filter(option => !segments.some(([p, q]) => segmentTouchesBox(p, q, boxAt(option, size))));
      const spot = clear.find(option => !labels.some(other => boxesOverlap(boxAt(option, size), other.box)));
      if (!spot) {
        issues.push(
          clear.length === 0
            ? `el rótulo del ángulo ${angleText(degrees, spec.unit)} queda encima del ángulo resaltado; quita los rótulos de los ángulos (showAngles) o marca menos ángulos (angles "axes").`
            : `el rótulo del ángulo ${angleText(degrees, spec.unit)} se monta sobre otro rótulo; quita los rótulos de los ángulos (showAngles) o marca menos ángulos (angles "axes").`,
        );
        continue;
      }
      labels.push({ ...text, ...spot, kind: "angle", box: boxAt(spot, size) });
    }
  }

  // Coordenadas por fuera, en la dirección del punto. Primero las de los ejes y las de 45°, las más anchas;
  // si una choca con otra o con un eje, gira un poco alrededor de su punto o se aleja, lo menos posible
  const coordinateAngles = new Set(spec.showCoordinates ? angles : []);
  if (target !== null && highlight?.values) coordinateAngles.add(target);
  const priority = (degrees: number) => (degrees % 90 === 0 ? 0 : degrees % 45 === 0 ? 1 : 2);
  const candidatesFor = (degrees: number, size: { w: number; h: number }) => {
    const options: Array<{ center: Point; cost: number }> = [];
    for (let push = 0; push <= 60; push += 3) {
      for (const shift of [0, 4, -4, 8, -8, 12, -12]) {
        const direction = ((degrees + shift) * Math.PI) / 180;
        const dx = Math.cos(direction);
        const dy = -Math.sin(direction);
        const reach = R + 9 + push + support({ x: dx, y: dy }, size);
        options.push({ center: { x: dx * reach, y: dy * reach }, cost: push + Math.abs(shift) * 1.6 });
      }
    }
    return options.sort((a, b) => a.cost - b.cost);
  };
  for (const degrees of [...coordinateAngles].sort((a, b) => priority(a) - priority(b) || a - b)) {
    const size = coordinatesSize(degrees);
    const spot = candidatesFor(degrees, size).find(({ center }) => {
      const box = boxAt(center, size);
      return !labels.some(other => boxesOverlap(box, other.box)) && !segments.slice(0, 2).some(([p, q]) => segmentTouchesBox(p, q, box));
    })?.center;
    if (!spot) {
      issues.push(`las coordenadas de ${angleText(degrees, spec.unit)} no caben sin montarse sobre otras.`);
      continue;
    }
    labels.push({ latex: coordinatesText(degrees, "latex"), plain: coordinatesText(degrees), ...spot, kind: "coordinates", box: boxAt(spot, size) });
  }

  // Nombres de los ejes, junto a sus flechas
  for (const [text, spot] of [["x", { x: AXIS_REACH + 2, y: 12 }], ["y", { x: 12, y: -AXIS_REACH - 2 }]] as const) {
    const size = textSize(text);
    const box = boxAt(spot, size);
    if (!labels.some(other => boxesOverlap(box, other.box, 0))) labels.push({ latex: text, plain: text, ...spot, kind: "axis", box });
  }

  // Caja de todo: la circunferencia, los ejes y los rótulos
  const xs = [-AXIS_REACH, AXIS_REACH, ...labels.flatMap(label => [label.box.x, label.box.x + label.box.w])];
  const ys = [-AXIS_REACH, AXIS_REACH, ...labels.flatMap(label => [label.box.y, label.box.y + label.box.h])];
  const center = { x: PAD - Math.min(...xs), y: PAD - Math.min(...ys) };
  const move = (p: Point): Point => ({ x: p.x + center.x, y: p.y + center.y });
  return {
    width: Math.round(Math.max(...xs) - Math.min(...xs) + 2 * PAD),
    height: Math.round(Math.max(...ys) - Math.min(...ys) + 2 * PAD),
    center,
    radius: R,
    axis: AXIS_REACH,
    points: angles.map(degrees => ({ ...move(at(degrees, R)), degrees })),
    highlight: drawn && { ...drawn, point: move(drawn.point), foot: drawn.foot && move(drawn.foot) },
    labels: labels.map(label => ({ ...label, ...move(label), box: { ...label.box, x: label.box.x + center.x, y: label.box.y + center.y } })),
    issues,
  };
}

/* ── Validación y lo que ve la IA ── */

export function unitCircleIssues(spec: UnitCircleSpec, compile: (latex: string) => string | null): string[] {
  const highlight = spec.highlight;
  if (highlight) {
    if (!isNotableAngle(highlight.degrees)) return [`el ángulo resaltado (${formatNumber(highlight.degrees, 4)}°) no es notable: usa un múltiplo de 30° o de 45°, cuyo seno y coseno se escriben exactos.`];
    if (highlight.triangle === true && quadrant(highlight.degrees) === 0) return [`el ángulo ${highlight.degrees}° está sobre un eje y no tiene triángulo de referencia; quita triangle.`];
    if (highlight.label) {
      const error = compile(plainToLatex(highlight.label));
      if (error) return [`el rótulo «${highlight.label}» no se puede escribir (${error}).`];
    }
  }
  return unitCircleLayout(spec).issues;
}

export const unitCirclePlainTexts = (spec: UnitCircleSpec): string[] => (spec.highlight?.label ? [spec.highlight.label] : []);

const QUADRANT_NAMES = ["sobre un eje", "en el cuadrante I", "en el cuadrante II", "en el cuadrante III", "en el cuadrante IV"];

/**
 * Lo que calculó el sistema: del ángulo resaltado, su cuadrante, su ángulo de referencia y sus razones
 * exactas; si la figura deja ángulos o coordenadas por completar, los valores que faltan, como los
 * escribe la figura.
 */
export function describeUnitCircle(spec: UnitCircleSpec): string | null {
  const parts: string[] = [];
  const highlight = spec.highlight;
  if (highlight && isNotableAngle(highlight.degrees)) {
    const name = highlight.label || "θ";
    const { cos, sin } = exactCosSin(highlight.degrees);
    const tan = exactTan(highlight.degrees);
    const options = { fraction: true } as const;
    const both = `${highlight.degrees}° = ${angleText(highlight.degrees, "radians")} rad`;
    const where = quadrant(highlight.degrees);
    parts.push(
      `${name} = ${both}, ${QUADRANT_NAMES[where]}` +
        (where === 0 ? "" : `; ángulo de referencia ${referenceAngle(highlight.degrees)}° = ${angleText(referenceAngle(highlight.degrees), "radians")}`) +
        `; punto ${coordinatesText(highlight.degrees)}: cos ${name} = ${exactText(cos, options)}, sen ${name} = ${exactText(sin, options)}, ${tan ? `tan ${name} = ${exactText(tan, options)}` : `tan ${name} no está definida`}.`,
    );
  }
  if (!spec.showAngles || !spec.showCoordinates) {
    const missing = SETS[spec.angles].map(degrees => `${angleText(degrees, spec.unit)} ${coordinatesText(degrees)}`);
    parts.push(`Ángulos y coordenadas de los puntos marcados${spec.showAngles ? " (faltan las coordenadas)" : spec.showCoordinates ? " (faltan los ángulos)" : " (faltan los dos)"}: ${missing.join("; ")}.`);
  }
  return parts.length > 0 ? `Círculo unitario: ${parts.join(" ")}` : null;
}

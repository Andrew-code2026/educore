import type { GraphFigure, GraphSpec, GraphTransform } from "./creator";
import { lineEquationLatex, measureText } from "./creatorCalculus";
import { pointText } from "./creatorConics";
import { formatNumber } from "./creatorMath";
import { figureNumber, figureNumberLatex, hasEqualUnits, insidePlane, isExactNumber, PLANE_EQUAL_UNITS } from "./creatorPlane";
import { cleanNumber as clean, point4, pointParts, type Pair } from "./creatorPlaneAxes";

/**
 * Geometría en el plano cartesiano: puntos con nombre, segmentos y polígonos, con sus longitudes
 * y su punto medio, y la imagen de una figura por una traslación, una reflexión, una rotación o
 * una homotecia. Se dan la figura original y la transformación; las coordenadas de A′B′C′, las
 * distancias, el perímetro y el área los calcula el sistema.
 */

export type FigureKind = GraphFigure["kind"];
export type FigureShow = NonNullable<GraphFigure["show"]>[number];
export type TransformKind = GraphTransform["kind"];
export type Mirror = Extract<GraphTransform, { kind: "reflection" }>["over"];
export type { Pair };

export const FIGURE_KIND_LABELS: Record<FigureKind, string> = {
  points: "Puntos sueltos",
  segment: "Segmento",
  polygon: "Polígono",
};

/** Lo que cada figura puede mostrar; pedir otra cosa (el punto medio de un triángulo) es un error. */
export const FIGURE_SHOWS: Record<FigureKind, readonly FigureShow[]> = {
  points: ["coordinates"],
  segment: ["coordinates", "lengths", "midpoint"],
  polygon: ["coordinates", "lengths"],
};

export const FIGURE_SHOW_LABELS: Record<FigureShow, string> = {
  coordinates: "Coordenadas",
  lengths: "Longitudes",
  midpoint: "Punto medio",
};

export const TRANSFORM_LABELS: Record<TransformKind, string> = {
  translation: "Traslación",
  reflection: "Reflexión",
  rotation: "Rotación",
  dilation: "Homotecia",
};

export const MIRROR_LABELS: Record<Mirror, string> = {
  x: "Respecto al eje x",
  y: "Respecto al eje y",
  vertical: "Respecto a una recta vertical",
  line: "Respecto a una recta y = mx + b",
};

/* ── Transformaciones ── */

/** Coseno y seno de un ángulo en grados, exactos en los múltiplos de 90°. */
function turn(degrees: number): { cos: number; sin: number } {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle === 0) return { cos: 1, sin: 0 };
  if (angle === 90) return { cos: 0, sin: 1 };
  if (angle === 180) return { cos: -1, sin: 0 };
  if (angle === 270) return { cos: 0, sin: -1 };
  const radians = (angle * Math.PI) / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
}

/** Recta de una reflexión: vertical (x = `vertical`) o y = slope·x + intercept. null si le faltan datos. */
export function mirrorLine(transform: Extract<GraphTransform, { kind: "reflection" }>): { vertical: number } | { slope: number; intercept: number } | null {
  switch (transform.over) {
    case "x":
      return { slope: 0, intercept: 0 };
    case "y":
      return { vertical: 0 };
    case "vertical":
      return transform.at === undefined ? null : { vertical: transform.at };
    case "line":
      return transform.slope === undefined || transform.intercept === undefined ? null : { slope: transform.slope, intercept: transform.intercept };
  }
}

/** La imagen de un punto por la transformación; null si a la transformación le faltan datos. */
export function transformPoint(transform: GraphTransform, [x, y]: Pair): Pair | null {
  switch (transform.kind) {
    case "translation":
      return [clean(x + transform.dx), clean(y + transform.dy)];
    case "reflection": {
      const line = mirrorLine(transform);
      if (!line) return null;
      if ("vertical" in line) return [clean(2 * line.vertical - x), y];
      // Pie de la perpendicular sobre la recta, y el punto al otro lado a la misma distancia
      const foot = (x + (y - line.intercept) * line.slope) / (1 + line.slope * line.slope);
      return [clean(2 * foot - x), clean(2 * (line.slope * foot + line.intercept) - y)];
    }
    case "rotation": {
      const { cos, sin } = turn(transform.angle);
      const dx = x - transform.cx;
      const dy = y - transform.cy;
      return [clean(transform.cx + dx * cos - dy * sin), clean(transform.cy + dx * sin + dy * cos)];
    }
    case "dilation":
      return [clean(transform.cx + transform.factor * (x - transform.cx)), clean(transform.cy + transform.factor * (y - transform.cy))];
  }
}

/** Centro de una rotación o de una homotecia; null en las demás. */
export const transformCenter = (transform: GraphTransform): Pair | null => (transform.kind === "rotation" || transform.kind === "dilation" ? [transform.cx, transform.cy] : null);

/* ── Figuras ── */

export interface PlaneVertex {
  x: number;
  y: number;
  /** Nombre en LaTeX (A, P_{1}, A'), o null si el vértice no lleva. */
  name: string | null;
}

export interface PlaneSide {
  from: PlaneVertex;
  to: PlaneVertex;
  length: number;
  /** Cuadrado de la longitud: cuando es un número exacto y la longitud no, se escribe √n. */
  squared: number;
}

export interface PlaneShape {
  kind: FigureKind;
  vertices: PlaneVertex[];
  /** Lados: uno en un segmento, todos (el último cierra) en un polígono, ninguno en puntos sueltos. */
  sides: PlaneSide[];
  /** Punto medio de un segmento. */
  midpoint: Pair | null;
  perimeter: number | null;
  area: number | null;
}

/** «P1» se escribe con subíndice; las primas quedan como están. */
export const vertexLatex = (name: string): string => name.replace(/^([A-Za-z])(\d)/, "$1_{$2}");

function shapeOf(kind: FigureKind, vertices: PlaneVertex[]): PlaneShape {
  const pairs: Array<[PlaneVertex, PlaneVertex]> =
    kind === "segment" && vertices.length >= 2 ? [[vertices[0], vertices[1]]] : kind === "polygon" && vertices.length >= 3 ? vertices.map((vertex, index) => [vertex, vertices[(index + 1) % vertices.length]]) : [];
  const sides = pairs.map(([from, to]) => {
    const squared = clean((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    return { from, to, squared, length: clean(Math.sqrt(squared)) };
  });
  const polygon = kind === "polygon" && sides.length > 0;
  // Fórmula del área de Gauss: la mitad de la suma de los productos cruzados
  const twice = vertices.reduce((sum, vertex, index) => sum + vertex.x * vertices[(index + 1) % vertices.length].y - vertices[(index + 1) % vertices.length].x * vertex.y, 0);
  return {
    kind,
    vertices,
    sides,
    midpoint: kind === "segment" && sides.length === 1 ? [clean((vertices[0].x + vertices[1].x) / 2), clean((vertices[0].y + vertices[1].y) / 2)] : null,
    perimeter: polygon ? clean(sides.reduce((sum, side) => sum + side.length, 0)) : null,
    area: polygon ? clean(Math.abs(twice) / 2) : null,
  };
}

export interface PlaneFigureView {
  original: PlaneShape;
  /** La figura transformada, con los nombres primados; null si no hay transformación o le faltan datos. */
  image: PlaneShape | null;
}

/** La figura y su imagen, con todo lo que el sistema calcula de ellas. */
export function planeFigure(figure: GraphFigure): PlaneFigureView {
  const vertices = figure.vertices.map(vertex => ({ x: vertex.x, y: vertex.y, name: vertex.name ? vertexLatex(vertex.name) : null }));
  const original = shapeOf(figure.kind, vertices);
  if (!figure.transform) return { original, image: null };
  const moved: PlaneVertex[] = [];
  for (const vertex of vertices) {
    const image = transformPoint(figure.transform, [vertex.x, vertex.y]);
    if (!image) return { original, image: null };
    moved.push({ x: image[0], y: image[1], name: vertex.name ? `${vertex.name}'` : null });
  }
  return { original, image: shapeOf(figure.kind, moved) };
}

const shows = (figure: GraphFigure, item: FigureShow) => (figure.show ?? []).includes(item);

/**
 * Rótulo de un vértice: su nombre, sus coordenadas o las dos cosas («A(2, 1)»); null si no lleva nada.
 * `pi` escribe la abscisa en múltiplos de π, como el resto del plano cuando su eje los usa.
 */
export function vertexLabel(vertex: PlaneVertex, withCoordinates: boolean, pi = false): string | null {
  if (!withCoordinates) return vertex.name;
  const { latex, exact } = pointParts(vertex.x, vertex.y, pi);
  if (!vertex.name) return `${exact ? "" : "\\approx "}${latex}`;
  return `${vertex.name}${exact ? "" : " \\approx "}${latex}`;
}

/** Rótulo de un lado: su longitud, exacta o con ≈. */
export const sideLabel = (side: PlaneSide): string => (isExactNumber(side.length) ? figureNumberLatex(side.length) : `\\approx ${figureNumberLatex(side.length)}`);

/** Rótulo del punto medio de un segmento: «M(2,5; 4)». */
export function midpointLabel([x, y]: Pair, pi = false): string {
  const { latex, exact } = pointParts(x, y, pi);
  return `M${exact ? "" : " \\approx "}${latex}`;
}

/** Lo que una figura pide escribir (show), ya resuelto para el dibujo. */
export const figureShows = (figure: GraphFigure) => ({ coordinates: shows(figure, "coordinates"), lengths: shows(figure, "lengths"), midpoint: shows(figure, "midpoint") });

/* ── Comprobaciones para el validador ── */

const plain = (name: string | null) => (name ? name.replace(/[_{}]/g, "") : "");

const POLYGON_NAMES: Record<number, string> = { 3: "Triángulo", 4: "Cuadrilátero", 5: "Pentágono", 6: "Hexágono" };

/** Cómo se nombra la figura en los avisos y en lo que se devuelve a la IA: «Triángulo ABC», «Segmento AB». */
function shapeName(shape: PlaneShape): string {
  const letters = shape.vertices.every(vertex => vertex.name) ? ` ${shape.vertices.map(vertex => plain(vertex.name)).join("")}` : "";
  if (shape.kind === "segment") return `Segmento${letters}`;
  if (shape.kind === "polygon") return `${POLYGON_NAMES[shape.vertices.length] ?? `Polígono de ${shape.vertices.length} lados`}${letters}`;
  return shape.vertices.length === 1 ? "Punto" : "Puntos";
}

/** ¿La recta pasa por dentro del plano? */
function lineCrossesPlane(spec: GraphSpec, line: { vertical: number } | { slope: number; intercept: number }): boolean {
  if ("vertical" in line) return line.vertical >= spec.xMin && line.vertical <= spec.xMax;
  const left = line.slope * spec.xMin + line.intercept;
  const right = line.slope * spec.xMax + line.intercept;
  return Math.max(left, right) >= spec.yMin && Math.min(left, right) <= spec.yMax;
}

function transformIssues(transform: GraphTransform, spec: GraphSpec, what: string): string[] {
  const fail = (text: string) => [`Gráfica: ${text}`];
  switch (transform.kind) {
    case "translation":
      return [];
    case "reflection": {
      const { over, slope, intercept, at } = transform;
      if (over === "line" && (slope === undefined || intercept === undefined)) return fail(`la reflexión de ${what} respecto a una recta (over "line") necesita su pendiente (slope) y su corte con el eje y (intercept): la recta es y = slope·x + intercept.`);
      if (over === "vertical" && at === undefined) return fail(`la reflexión de ${what} respecto a una recta vertical (over "vertical") necesita at: la recta es x = at.`);
      if (over !== "line" && (slope !== undefined || intercept !== undefined)) return fail(`en la reflexión de ${what}, slope e intercept solo van con over "line"; quítalos.`);
      if (over !== "vertical" && at !== undefined) return fail(`en la reflexión de ${what}, at solo va con over "vertical"; quítalo.`);
      const line = mirrorLine(transform)!;
      if (!lineCrossesPlane(spec, line)) return fail(`la recta de la reflexión de ${what} no pasa por el plano, así que no se vería; amplía el rango o cambia la recta.`);
      return [];
    }
    case "rotation":
    case "dilation": {
      const issues: string[] = [];
      if (transform.kind === "dilation" && transform.factor === 0) return fail(`la razón de la homotecia de ${what} no puede ser 0: toda la figura caería en el centro.`);
      if (!insidePlane(spec, transform.cx, transform.cy)) {
        issues.push(`Gráfica: el centro ${point4(transform.cx, transform.cy)} de la ${transform.kind === "rotation" ? "rotación" : "homotecia"} de ${what} queda fuera del plano; amplía el rango.`);
      }
      return issues;
    }
  }
}

function figureIssues(figure: GraphFigure, spec: GraphSpec, position: number): string[] {
  const fail = (text: string) => [`Gráfica: ${text}`];
  const count = figure.vertices.length;
  const label = FIGURE_KIND_LABELS[figure.kind].toLowerCase();
  if (figure.kind === "segment" && count !== 2) return fail(`la figura ${position + 1} es un segmento y tiene ${count} ${count === 1 ? "vértice" : "vértices"}; un segmento lleva exactamente dos. Para más, usa kind "polygon" o "points".`);
  if (figure.kind === "polygon" && count < 3) return fail(`la figura ${position + 1} es un polígono y tiene ${count} ${count === 1 ? "vértice" : "vértices"}; necesita al menos tres. Para dos, usa kind "segment".`);

  const view = planeFigure(figure);
  const named = shapeName(view.original);
  const what = `la figura ${position + 1} (${named[0].toLowerCase()}${named.slice(1)})`;
  const issues: string[] = [];

  for (const item of figure.show ?? []) {
    if (!FIGURE_SHOWS[figure.kind].includes(item)) issues.push(`Gráfica: un ${label === "puntos sueltos" ? "grupo de puntos sueltos" : label} no tiene "${item}"; en show admite ${FIGURE_SHOWS[figure.kind].map(value => `"${value}"`).join(", ")}.`);
  }

  const names = figure.vertices.map(vertex => vertex.name).filter(Boolean);
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated) issues.push(`Gráfica: en ${what} hay dos vértices llamados ${repeated}; cada uno lleva su nombre.`);

  for (const vertex of figure.vertices) {
    if (!insidePlane(spec, vertex.x, vertex.y)) issues.push(`Gráfica: el vértice ${vertex.name ?? ""}${point4(vertex.x, vertex.y)} de ${what} queda fuera del plano; amplía el rango.`);
  }
  const twin = figure.vertices.find((vertex, index) => figure.vertices.some((other, at) => at < index && other.x === vertex.x && other.y === vertex.y));
  if (twin) issues.push(`Gráfica: en ${what} hay dos vértices en el mismo punto ${point4(twin.x, twin.y)}.`);
  else if (figure.kind === "polygon" && (view.original.area ?? 0) < 1e-9) issues.push(`Gráfica: los vértices de ${what} están alineados; no forman un polígono.`);
  if (issues.length > 0 || !figure.transform) return issues;

  issues.push(...transformIssues(figure.transform, spec, what));
  if (issues.length > 0 || !view.image) return issues;

  const still = view.image.vertices.every((vertex, index) => Math.abs(vertex.x - figure.vertices[index].x) < 1e-9 && Math.abs(vertex.y - figure.vertices[index].y) < 1e-9);
  if (still) return fail(`la transformación de ${what} la deja donde estaba: la imagen coincide con la figura. Cambia la transformación o quítala.`);
  for (const vertex of view.image.vertices) {
    if (!insidePlane(spec, vertex.x, vertex.y)) issues.push(`Gráfica: la imagen ${plain(vertex.name)}${point4(vertex.x, vertex.y)} de ${what} queda fuera del plano; amplía el rango.`);
  }
  return issues;
}

/** Problemas de las figuras geométricas de un plano. */
export function planeFigureIssues(spec: GraphSpec): string[] {
  const figures = spec.figures ?? [];
  if (figures.length === 0) return [];
  const issues: string[] = [];
  const xSpan = spec.xMax - spec.xMin;
  const ySpan = spec.yMax - spec.yMin;
  if (!hasEqualUnits(xSpan, ySpan)) {
    issues.push(
      `Gráfica: con figuras geométricas el plano debe tener la misma unidad en los dos ejes para no deformar longitudes ni ángulos, y este rango es demasiado ${ySpan > xSpan ? "alto" : "ancho"}: el alto (yMax − yMin = ${formatNumber(ySpan, 4)}) debe estar entre ${formatNumber(PLANE_EQUAL_UNITS.min)} y ${formatNumber(PLANE_EQUAL_UNITS.max)} veces el ancho (xMax − xMin = ${formatNumber(xSpan, 4)}).`,
    );
  }
  figures.forEach((figure, index) => issues.push(...figureIssues(figure, spec, index)));
  return issues;
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

function namedPoint(vertex: PlaneVertex, pi: boolean): string {
  const { text, exact } = pointParts(vertex.x, vertex.y, pi);
  return `${plain(vertex.name)}${exact ? "" : vertex.name ? " ≈ " : "≈ "}${text}`;
}

/** Una longitud como va en la clave: exacta, como raíz (√20 ≈ 4,47) o aproximada. */
function lengthText(side: PlaneSide): string {
  if (isExactNumber(side.length)) return `= ${figureNumber(side.length)}`;
  return isExactNumber(side.squared) ? `= √${figureNumber(side.squared)} ≈ ${figureNumber(side.length)}` : `≈ ${figureNumber(side.length)}`;
}

const sideName = (side: PlaneSide, fallback: string) => (side.from.name && side.to.name ? `${plain(side.from.name)}${plain(side.to.name)}` : fallback);

function describeShape(shape: PlaneShape, pi: boolean): string {
  const parts = [shape.vertices.map(vertex => namedPoint(vertex, pi)).join(", ")];
  if (shape.kind === "segment" && shape.sides.length === 1) {
    parts.push(`longitud ${lengthText(shape.sides[0])}`);
    if (shape.midpoint) {
      const middle = pointParts(shape.midpoint[0], shape.midpoint[1], pi);
      parts.push(`punto medio ${middle.exact ? "" : "≈ "}${middle.text}`);
    }
  }
  if (shape.kind === "polygon" && shape.sides.length > 0) {
    parts.push(`lados ${shape.sides.map((side, index) => `${sideName(side, `lado ${index + 1}`)} ${lengthText(side)}`).join(", ")}`);
    parts.push(`perímetro ${measureText(shape.perimeter!)}`, `área ${measureText(shape.area!)}`);
  }
  return `${shapeName(shape)}: ${parts.join("; ")}.`;
}

/** La transformación en palabras: «traslación de vector (3, -2)», «rotación de 90° en sentido antihorario alrededor de (0, 0)». */
export function transformText(transform: GraphTransform): string {
  switch (transform.kind) {
    case "translation":
      return `traslación de vector ${pointText(transform.dx, transform.dy)}`;
    case "reflection": {
      if (transform.over === "x") return "reflexión respecto al eje x";
      if (transform.over === "y") return "reflexión respecto al eje y";
      if (transform.over === "vertical") return `reflexión respecto a la recta x = ${figureNumber(transform.at ?? 0)}`;
      return `reflexión respecto a la recta $${lineEquationLatex({ slope: transform.slope ?? 0, intercept: transform.intercept ?? 0, points: [] })}$`;
    }
    case "rotation":
      return `rotación de ${figureNumber(Math.abs(transform.angle))}° en sentido ${transform.angle >= 0 ? "antihorario" : "horario"} alrededor de ${pointText(transform.cx, transform.cy)}`;
    case "dilation":
      return `homotecia de centro ${pointText(transform.cx, transform.cy)} y razón ${figureNumber(transform.factor)}`;
  }
}

/** Una línea con la figura y su imagen, escritas como salen en el plano (con `pi`, las abscisas en múltiplos de π). */
export function describeFigure(figure: GraphFigure, pi = false): string {
  const view = planeFigure(figure);
  const original = describeShape(view.original, pi);
  if (!figure.transform || !view.image) return original;
  return `${original} Su imagen por la ${transformText(figure.transform)}: ${describeShape(view.image, pi)}`;
}

import { memo, useId, useMemo, type CSSProperties } from "react";
import type { GraphSpec } from "@shared/creator";
import { formatNumber, tryCompile } from "@shared/creatorMath";
import { areaLabel, areaShape, lineLabel, secantLine, tangentLine, type PlaneLine } from "@shared/creatorCalculus";
import { CONIC_LABELS, conicCurves, conicEquation, shownConicElements, type ConicLine } from "@shared/creatorConics";
import { describeNotable, shownNotablePoints } from "@shared/creatorNotable";
import { functionColors, insidePlane, sampleFunction, type CurveMark } from "@shared/creatorPlane";
import { planeAxisNumbers, planeLayout, planePointLatex, planeTicks, planeXTicks, usesPi } from "@shared/creatorPlaneAxes";
import { describeFigure, figureShows, midpointLabel, mirrorLine, planeFigure, sideLabel, transformCenter, vertexLabel } from "@shared/creatorPlaneGeometry";
import { boundarySegment, commonRegion, describeInequalities, halfPlaneRegion, inequalityLatex, isStrict, regionVertices } from "@shared/creatorRegions";
import { TEXT_HALO } from "./FigureFrame";
import { FigureNotes, useHasNotes } from "./FigureNotes";
import { Formula } from "./Formula";

const LABEL_H = 20;
/** Alto de una etiqueta con fracciones a tamaño de texto (la ecuación de una elipse o una hipérbola). */
const TALL_LABEL_H = 32;
const TONES = ["a", "b", "c", "d"] as const;
/** Radio de los puntos marcados y de los círculos de extremos y saltos. */
const POINT_R = 4.2;
const MARK_R = 3.6;

/** Una recta que cruza el plano: vertical (x = `vertical`) o y = slope·x + intercept. */
type AuxLine = Pick<ConicLine, "vertical" | "slope" | "intercept">;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PlacedLabel extends Box {
  latex: string;
  tone: string;
}

/** Ancho aproximado de una etiqueta LaTeX en pantalla, para ubicarla sin medir el DOM. */
function estimateWidth(latex: string): number {
  const plain = latex.replace(/\\[a-zA-Z]+/g, "x").replace(/[{}\\^_]/g, "");
  return Math.max(2, plain.length) * 7 + 10;
}

const FRACTION = /\\d?frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g;

/** Ancho de una fórmula con fracciones: cada fracción ocupa lo que su parte más larga, no la suma de las dos. */
const estimateFractionWidth = (latex: string) => estimateWidth(latex.replace(FRACTION, (_, top: string, bottom: string) => (top.length >= bottom.length ? top : bottom)));

const LABEL_TOKEN = /\\d?frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}|\\[a-zA-Z]+|\\,|\{,\}|_\{[^{}]*\}|[^\s{}]/g;

/**
 * Ancho de un rótulo que escribe el sistema (coordenadas, longitudes, inecuaciones), sumando lo que mide
 * cada signo a su tamaño de letra. Es más ajustado que `estimateWidth`: estos rótulos son muchos y cortos,
 * y con el ancho de sobra no cabrían donde sí caben.
 */
function measureLabel(latex: string): number {
  const inner = (text: string): number => {
    let width = 0;
    let previous = "(";
    for (const match of text.matchAll(LABEL_TOKEN)) {
      const token = match[0];
      if (match[1] !== undefined) width += 0.72 * Math.max(inner(match[1]), inner(match[2])) + 3;
      else if (token === "\\approx" || token === "\\le" || token === "\\ge" || token === "=" || token === "<" || token === ">") width += 16.5;
      else if (token === "+") width += 15;
      // Un menos tras un paréntesis, una coma o un signo es el de un número negativo: no lleva espacios
      else if (token === "-") width += /^[(,;]$|^\{,\}$|^\\(approx|le|ge|,)$|^[=<>]$/.test(previous) ? 9.7 : 15;
      else if (token === "\\pi") width += 7.1;
      else if (token === "\\,") width += 2;
      else if (token === "{,}") width += 3.5;
      else if (token === "," || token === ";") width += 5.5;
      else if (token === "(" || token === ")") width += 4.9;
      else if (token === "'") width += 3.5;
      else if (token.startsWith("_{")) width += 4.5;
      else if (/^\d$/.test(token)) width += 6.25;
      else width += 7.2;
      previous = token;
    }
    return width;
  };
  return Math.ceil(inner(latex)) + 10;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function describe(spec: GraphSpec): string {
  const functions = spec.functions.map(fn => fn.expr).join("; ");
  const points = spec.points.map(point => `(${formatNumber(point.x)}, ${formatNumber(point.y)})${point.open ? " vacío" : ""}`).join(", ");
  const lines = (spec.verticalLines ?? []).map(line => `x = ${formatNumber(line.x)}`).join(", ");
  const drawn = [functions, ...(spec.conics ?? []).map(conic => CONIC_LABELS[conic.kind].toLowerCase())].filter(Boolean).join("; ");
  const base = drawn ? `Plano cartesiano con ${drawn}` : "Plano cartesiano en blanco";
  const shaded = (spec.areas ?? []).map(area => `de x = ${formatNumber(area.from)} a x = ${formatNumber(area.to)}`).join("; ");
  const tangents = (spec.tangents ?? []).map(tangent => `x = ${formatNumber(tangent.x)}`).join(", ");
  const secants = (spec.secants ?? []).map(secant => `x = ${formatNumber(secant.x1)} y x = ${formatNumber(secant.x2)}`).join("; ");
  const axes = [spec.xLabel && `eje x: ${spec.xLabel}`, spec.yLabel && `eje y: ${spec.yLabel}`].filter(Boolean).join(", ");
  const unit = spec.xUnit === "pi" ? "Eje x en múltiplos de π" : "";
  const notable = (spec.notable ?? []).map(item => describeNotable(spec, item)).filter(Boolean).join(" ");
  const figures = (spec.figures ?? []).map(figure => describeFigure(figure, usesPi(spec))).join(" ").replace(/\$/g, "");
  const regions = describeInequalities(spec) ?? "";
  return (
    [base, axes && `Ejes con nombre, ${axes}`, unit, notable.replace(/\.$/, ""), figures.replace(/\.$/, ""), regions.replace(/\.$/, ""), lines && `Rectas verticales: ${lines}`, shaded && `Región sombreada ${shaded}`, tangents && `Recta tangente en ${tangents}`, secants && `Recta secante entre ${secants}`, points && `Puntos marcados: ${points}`]
      .filter(Boolean)
      .join(". ") + "."
  );
}

/** Plano cartesiano dibujado a partir de la función: lo que se ve siempre coincide con la fórmula. */
export const CoordinatePlane = memo(function CoordinatePlane({ spec }: { spec: GraphSpec }) {
  const clipId = useId();
  const noted = useHasNotes();

  const view = useMemo(() => {
    const layout = planeLayout(spec);
    if (!layout) return null;
    const xSpan = spec.xMax - spec.xMin;
    const ySpan = spec.yMax - spec.yMin;

    // Los márgenes dependen del plano: el nombre de un eje añade su franja
    const { w, h, width, height, pad: PAD } = layout;
    const sx = (x: number) => PAD.left + ((x - spec.xMin) / xSpan) * w;
    const sy = (y: number) => PAD.top + ((spec.yMax - y) / ySpan) * h;

    const xTicks = planeXTicks(spec, w);
    const yTicks = planeTicks(spec.yMin, spec.yMax, spec.yStep);
    // Si el cero no está en el rango, el eje se dibuja en el borde más cercano
    const axisX = Math.min(Math.max(0, spec.yMin), spec.yMax);
    const axisY = Math.min(Math.max(0, spec.xMin), spec.xMax);

    const inPlane = (x: number, y: number) => insidePlane(spec, x, y);
    const pathOf = (points: Array<[number, number]>) => points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`).join(" ");
    // Cada función toma un color por su posición, salvo que lo fije; los trozos de una misma función comparten el suyo
    const colors = functionColors(spec.functions);
    const toneOf = (index: number) => TONES[(colors[index] ?? index) % TONES.length];

    const curves = spec.functions.map((fn, index) => {
      const tone = toneOf(index);
      const compiled = tryCompile(fn.expr);
      if (!compiled.ok) return { index, tone, paths: [] as string[], samples: [] as Array<[number, number]>, marks: [] as CurveMark[], dashed: false };
      const sampled = sampleFunction(compiled.fn, spec, fn);
      const paths = sampled.segments.map(segment => pathOf(segment.points));
      const samples = sampled.segments.flatMap(segment => segment.points).filter(([, y]) => y >= spec.yMin && y <= spec.yMax);
      // Círculos de los extremos del dominio y de los saltos, solo los que caen dentro del plano
      const marks = sampled.marks.filter(mark => inPlane(mark.x, mark.y));
      return { index, tone, paths, samples, marks, dashed: fn.style === "dashed" };
    });
    const verticals = (spec.verticalLines ?? []).filter(line => line.x >= spec.xMin && line.x <= spec.xMax);

    // Regiones sombreadas: con rectángulos de Riemann se dibujan ellos en vez de la región
    const zero = sy(0);
    const areas = (spec.areas ?? []).flatMap((area, index) => {
      const shape = areaShape(spec, area);
      if (!shape) return [];
      const rectangles = shape.rectangles
        .filter(rectangle => Number.isFinite(rectangle.y))
        .map(rectangle => ({ x: sx(rectangle.x0), width: sx(rectangle.x1) - sx(rectangle.x0), y: Math.min(sy(rectangle.y), zero), height: Math.abs(sy(rectangle.y) - zero) }));
      return [{ index, tone: toneOf(area.fn), d: `${pathOf(shape.outline)} Z`, rectangles, label: areaLabel(spec, area), anchor: shape.anchor }];
    });

    // Tangentes y secantes: la recta entera, recortada por el plano, y los puntos de la curva por los que pasa
    const lineOf = (line: PlaneLine | null, index: number, tone: "t" | "s", show: "none" | "slope" | "equation" | undefined) =>
      line
        ? [
            {
              key: `${tone}${index}`,
              tone,
              line,
              d: `M${PAD.left} ${sy(line.slope * spec.xMin + line.intercept).toFixed(2)} L${PAD.left + w} ${sy(line.slope * spec.xMax + line.intercept).toFixed(2)}`,
              points: line.points.filter(([x, y]) => inPlane(x, y)),
              label: lineLabel(line, show),
            },
          ]
        : [];
    const lines = [
      ...(spec.tangents ?? []).flatMap((tangent, index) => lineOf(tangentLine(spec, tangent), index, "t", tangent.show)),
      ...(spec.secants ?? []).flatMap((secant, index) => lineOf(secantLine(spec, secant), index, "s", secant.show)),
    ];

    // Las cónicas siguen la paleta después de las funciones
    const lineY = (line: AuxLine, x: number) => line.slope! * x + line.intercept!;
    /** Puntos de una recta auxiliar dentro del plano: trazo que una etiqueta no debería tapar. */
    const lineSamples = (line: AuxLine): Array<[number, number]> =>
      Array.from({ length: 33 }, (_, i): [number, number] =>
        line.vertical !== undefined ? [line.vertical, spec.yMin + (ySpan * i) / 32] : [spec.xMin + (xSpan * i) / 32, lineY(line, spec.xMin + (xSpan * i) / 32)],
      ).filter(([x, y]) => inPlane(x, y));
    const linePath = (line: AuxLine) =>
      line.vertical !== undefined
        ? `M${sx(line.vertical).toFixed(2)} ${PAD.top} V${PAD.top + h}`
        : `M${PAD.left} ${sy(line.slope! * spec.xMin + line.intercept!).toFixed(2)} L${PAD.left + w} ${sy(line.slope! * spec.xMax + line.intercept!).toFixed(2)}`;
    const conics = (spec.conics ?? []).map((conic, index) => {
      const branches = conicCurves(conic, spec);
      const shown = shownConicElements(conic);
      return {
        index,
        tone: TONES[(spec.functions.length + index) % TONES.length],
        paths: branches.map(pathOf),
        samples: branches.flat().filter(([x, y]) => inPlane(x, y)),
        lines: shown.lines.map(linePath),
        lineSamples: [
          ...shown.lines.flatMap(lineSamples),
          ...shown.segments.flatMap(segment => Array.from({ length: 9 }, (_, i): [number, number] => [segment.from[0] + ((segment.to[0] - segment.from[0]) * i) / 8, segment.from[1] + ((segment.to[1] - segment.from[1]) * i) / 8])),
        ],
        segments: shown.segments.map(segment => ({ x1: sx(segment.from[0]), y1: sy(segment.from[1]), x2: sx(segment.to[0]), y2: sy(segment.to[1]), label: segment.label })),
        points: shown.points.filter(point => inPlane(point.x, point.y)),
        equation: (conic.show ?? []).includes("equation") ? conicEquation(conic) : null,
      };
    });

    const pi = usesPi(spec);
    // Figuras geométricas: la original y, si se transforma, su imagen en el color siguiente
    const figureBase = spec.functions.length + (spec.conics ?? []).length;
    const figures = (spec.figures ?? []).map((figure, index) => {
      const { original, image } = planeFigure(figure);
      const shapes = [original, ...(image ? [image] : [])].map((shape, order) => {
        const pixels = shape.vertices.map(vertex => [sx(vertex.x), sy(vertex.y)] as const);
        return {
          shape,
          tone: TONES[(figureBase + 2 * index + order) % TONES.length],
          d: shape.kind === "points" ? null : `${pathOf(shape.vertices.map(vertex => [vertex.x, vertex.y]))}${shape.kind === "polygon" ? " Z" : ""}`,
          // Centro de la figura en pantalla: los rótulos se alejan de él
          center: [pixels.reduce((sum, [x]) => sum + x, 0) / pixels.length, pixels.reduce((sum, [, y]) => sum + y, 0) / pixels.length] as const,
        };
      });
      // Trazos de ayuda: el vector de una traslación, el eje de una reflexión, los radios de una rotación y los rayos de una homotecia
      const guides: string[] = [];
      const guideSamples: Array<[number, number]> = [];
      let arrow: { d: string; head: string } | null = null;
      const transform = figure.transform;
      const center = transform && image ? transformCenter(transform) : null;
      const ray = (from: readonly [number, number], to: readonly [number, number]) => `M${sx(from[0]).toFixed(2)} ${sy(from[1]).toFixed(2)} L${sx(to[0]).toFixed(2)} ${sy(to[1]).toFixed(2)}`;
      if (transform && image) {
        const first = [original.vertices[0].x, original.vertices[0].y] as const;
        const moved = [image.vertices[0].x, image.vertices[0].y] as const;
        if (transform.kind === "translation") {
          const [x1, y1, x2, y2] = [sx(first[0]), sy(first[1]), sx(moved[0]), sy(moved[1])];
          const length = Math.hypot(x2 - x1, y2 - y1) || 1;
          const ux = (x2 - x1) / length;
          const uy = (y2 - y1) / length;
          // La punta queda a un paso del punto imagen, para no taparlo
          const tip = [x2 - ux * 5, y2 - uy * 5];
          arrow = {
            d: `M${x1.toFixed(2)} ${y1.toFixed(2)} L${(tip[0] - ux * 7).toFixed(2)} ${(tip[1] - uy * 7).toFixed(2)}`,
            head: `M${tip[0].toFixed(2)} ${tip[1].toFixed(2)} L${(tip[0] - ux * 8 - uy * 3.5).toFixed(2)} ${(tip[1] - uy * 8 + ux * 3.5).toFixed(2)} L${(tip[0] - ux * 8 + uy * 3.5).toFixed(2)} ${(tip[1] - uy * 8 - ux * 3.5).toFixed(2)} Z`,
          };
        } else if (transform.kind === "reflection") {
          const line = mirrorLine(transform);
          // Los ejes ya están dibujados: solo se traza una recta distinta de ellos
          if (line && (transform.over === "line" || transform.over === "vertical")) {
            guides.push(linePath(line));
            guideSamples.push(...lineSamples(line));
          }
        } else if (center) {
          if (transform.kind === "rotation") guides.push(ray(center, first), ray(center, moved));
          // En una homotecia cada vértice, su imagen y el centro están alineados: la recta va de uno a otro pasando por
          // el centro, que con razón negativa queda en medio
          else original.vertices.forEach((vertex, at) => guides.push(ray(center, [vertex.x, vertex.y]), ray(center, [image.vertices[at].x, image.vertices[at].y])));
        }
      }
      return { index, shapes, guides, guideSamples, arrow, center: center && inPlane(center[0], center[1]) ? center : null, show: figureShows(figure) };
    });
    const figureShapes = figures.flatMap(figure => figure.shapes.map(item => ({ ...item, show: figure.show })));

    // Inecuaciones: la frontera de cada una, lo que se sombrea y los vértices de la región común
    const boundBase = figureBase + 2 * figures.length;
    const shade = spec.inequalityShade ?? "common";
    const closed = (polygon: Array<[number, number]>) => (polygon.length >= 3 ? `${pathOf(polygon)} Z` : null);
    const bounds = (spec.inequalities ?? []).flatMap((inequality, index) => {
      const segment = boundarySegment(spec, inequality);
      if (!segment) return [];
      const [from, to] = segment;
      return [
        {
          index,
          tone: TONES[(boundBase + index) % TONES.length],
          dashed: isStrict(inequality.op),
          d: pathOf([from, to]),
          from,
          to,
          region: shade === "each" ? closed(halfPlaneRegion(spec, inequality)) : null,
          label: inequality.label ? inequalityLatex(inequality) : null,
        },
      ];
    });
    const regionPath = shade === "common" ? closed(commonRegion(spec)) : null;
    const corners = spec.inequalityVertices ? regionVertices(spec).filter(vertex => inPlane(vertex.x, vertex.y)) : [];

    // Puntos notables que halló el sistema: raíces, cortes y extremos, con el color de su función
    const notable = shownNotablePoints(spec).map(point => ({ ...point, tone: toneOf(point.fn) }));

    // Las etiquetas se ubican por prioridad: primero los puntos, luego las curvas
    const plot: Box = { x: PAD.left, y: PAD.top, w, h };
    const occupied: Box[] = [
      ...spec.points.map(point => ({ x: sx(point.x) - 6, y: sy(point.y) - 6, w: 12, h: 12 })),
      ...curves.flatMap(curve => curve.marks.map(mark => ({ x: sx(mark.x) - 5, y: sy(mark.y) - 5, w: 10, h: 10 }))),
      ...conics.flatMap(conic => conic.points.map(point => ({ x: sx(point.x) - 5, y: sy(point.y) - 5, w: 10, h: 10 }))),
      ...lines.flatMap(item => item.points.map(([x, y]) => ({ x: sx(x) - 5, y: sy(y) - 5, w: 10, h: 10 }))),
      ...notable.map(point => ({ x: sx(point.x) - 5, y: sy(point.y) - 5, w: 10, h: 10 })),
      ...figureShapes.flatMap(item => [
        ...item.shape.vertices.map(vertex => ({ x: sx(vertex.x) - 5, y: sy(vertex.y) - 5, w: 10, h: 10 })),
        ...(item.show.midpoint && item.shape.midpoint ? [{ x: sx(item.shape.midpoint[0]) - 5, y: sy(item.shape.midpoint[1]) - 5, w: 10, h: 10 }] : []),
      ]),
      ...figures.flatMap(figure => (figure.center ? [{ x: sx(figure.center[0]) - 5, y: sy(figure.center[1]) - 5, w: 10, h: 10 }] : [])),
      ...corners.map(vertex => ({ x: sx(vertex.x) - 5, y: sy(vertex.y) - 5, w: 10, h: 10 })),
    ];
    const labels: PlacedLabel[] = [];

    // Lo que una etiqueta no debería tapar: los números de los ejes, los ejes y las curvas
    const numbers = planeAxisNumbers(spec, layout);
    const numberBoxes: Box[] = [...numbers.x.map(number => number.box), ...numbers.y.map(number => number.box), ...(numbers.origin ? [numbers.origin] : [])];
    const axisBoxes: Box[] = [
      { x: PAD.left, y: sy(axisX) - 2, w, h: 4 },
      { x: sx(axisY) - 2, y: PAD.top, w: 4, h },
    ];
    const curvePixels = [
      ...curves.flatMap(curve => curve.samples.map(([x, y]) => [sx(x), sy(y)] as const)),
      ...conics.flatMap(conic => [...conic.samples.filter((_, i) => i % 2 === 0), ...conic.lineSamples].map(([x, y]) => [sx(x), sy(y)] as const)),
      ...lines.flatMap(item =>
        Array.from({ length: 41 }, (_, i) => spec.xMin + (xSpan * i) / 40)
          .map(x => [x, item.line.slope * x + item.line.intercept] as const)
          .filter(([x, y]) => inPlane(x, y))
          .map(([x, y]) => [sx(x), sy(y)] as const),
      ),
      // Los lados de las figuras y el eje de una reflexión
      ...figureShapes.flatMap(item =>
        item.shape.sides.flatMap(side => {
          const [x1, y1, x2, y2] = [sx(side.from.x), sy(side.from.y), sx(side.to.x), sy(side.to.y)];
          // Una muestra cada 5 px: un rótulo de 20 px de alto no cabe entre dos y siempre cuenta el lado que pisa
          const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 5));
          return Array.from({ length: steps + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps] as const);
        }),
      ),
      ...figures.flatMap(figure => figure.guideSamples.map(([x, y]) => [sx(x), sy(y)] as const)),
      ...bounds.flatMap(bound => Array.from({ length: 33 }, (_, i) => [sx(bound.from[0] + ((bound.to[0] - bound.from[0]) * i) / 32), sy(bound.from[1] + ((bound.to[1] - bound.from[1]) * i) / 32)] as const)),
      // Las rectas verticales también son trazo que una etiqueta no debería tapar
      ...verticals.flatMap(line => Array.from({ length: 25 }, (_, i) => [sx(line.x), PAD.top + (h * i) / 24] as const)),
    ];

    /** Cuánto estorba una etiqueta en esa posición; cero es un sitio limpio. */
    const cost = (box: Box) => {
      let total = 0;
      for (const other of occupied) if (overlaps(box, other)) total += 100;
      for (const number of numberBoxes) if (overlaps(box, number)) total += 14;
      for (const axis of axisBoxes) if (overlaps(box, axis)) total += 6;
      let onCurve = 0;
      for (const [px, py] of curvePixels) if (px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) onCurve++;
      return total + Math.min(24, onCurve * 3);
    };

    // Con el eje y dentro del plano, el margen izquierdo solo lleva la flecha del eje x (y el nombre del eje y, si lo hay):
    // los rótulos que escribe el sistema pueden entrar en él, como todos entran en el derecho
    const looseLeft = spec.xMin < 0 ? (layout.yName ? 20 : 2) : plot.x - 4;
    const place = (latex: string, tone: string, candidates: Array<{ x: number; y: number }>, labelW = estimateWidth(latex), labelH = LABEL_H, loose = false) => {
      const fits = (box: Box) =>
        box.x >= (loose ? looseLeft : plot.x - 4) && box.x + box.w <= plot.x + plot.w + PAD.right - 2 && box.y >= plot.y - 8 && box.y + box.h <= plot.y + plot.h + 8;
      const boxes = candidates.map(candidate => ({ x: candidate.x, y: candidate.y, w: labelW, h: labelH }));
      const fitting = boxes.filter(fits);
      const pool = fitting.length > 0 ? fitting : boxes;
      // Gana el sitio que menos estorba; a igual costo, el primero de la lista (el preferido)
      let chosen = pool[0];
      let best = cost(chosen);
      for (const box of pool.slice(1)) {
        const value = cost(box);
        if (value < best) {
          chosen = box;
          best = value;
        }
      }
      occupied.push(chosen);
      labels.push({ ...chosen, latex, tone });
    };

    /** Sitios alrededor de un punto, del preferido (arriba a la derecha) al último. */
    const around = (px: number, py: number, labelW: number) => [
      { x: px + 8, y: py - LABEL_H - 2 },
      { x: px + 8, y: py + 4 },
      { x: px - labelW - 8, y: py - LABEL_H - 2 },
      { x: px - labelW - 8, y: py + 4 },
      { x: px - labelW / 2, y: py - LABEL_H - 8 },
      { x: px - labelW / 2, y: py + 10 },
      { x: px + 12, y: py - LABEL_H / 2 },
      { x: px - labelW - 12, y: py - LABEL_H / 2 },
    ];

    /**
     * Cuánto hay que apartar del trazo el centro de un rótulo, a lo largo de la normal (nx, ny), para que su
     * caja quede entera a un lado y a 6 px: lo que la caja mide en esa dirección, que en un trazo inclinado
     * es parte de su ancho y parte de su alto.
     */
    const beside = (nx: number, ny: number, labelW: number) => 6 + (Math.abs(nx) * labelW) / 2 + (Math.abs(ny) * LABEL_H) / 2;

    /** Rótulos que escribe el sistema: medidos signo a signo y con el margen izquierdo a su alcance. */
    const placeComputed = (latex: string, tone: string, candidates: Array<{ x: number; y: number }>, labelW = measureLabel(latex)) => place(latex, tone, candidates, labelW, LABEL_H, true);

    /** Lo mismo con cuatro sitios más, algo apartados: para puntos calculados que pueden salir muy juntos. */
    const aroundFar = (px: number, py: number, labelW: number) => [
      ...around(px, py, labelW),
      { x: px - labelW / 2, y: py - 2 * LABEL_H - 8 },
      { x: px - labelW / 2, y: py + LABEL_H + 12 },
      { x: px + 8, y: py - 2 * LABEL_H - 4 },
      { x: px - labelW - 8, y: py + LABEL_H + 8 },
    ];

    for (const point of spec.points) {
      if (!point.label) continue;
      // La etiqueta de un hueco lleva el color de su curva, como el círculo
      const tone = point.open && point.on != null ? `crt-plane__label--${toneOf(point.on)}` : "crt-plane__label--point";
      place(point.label, tone, around(sx(point.x), sy(point.y), estimateWidth(point.label)));
    }

    // Los vértices de una figura se rotulan hacia fuera de ella: primero los sitios más lejos de su centro
    for (const item of figureShapes) {
      const tone = `crt-plane__label--${item.tone}`;
      const [cx, cy] = item.center;
      for (const vertex of item.shape.vertices) {
        const label = vertexLabel(vertex, item.show.coordinates, pi);
        if (!label) continue;
        const labelW = measureLabel(label);
        const away = (candidate: { x: number; y: number }) => Math.hypot(candidate.x + labelW / 2 - cx, candidate.y + LABEL_H / 2 - cy);
        placeComputed(label, tone, around(sx(vertex.x), sy(vertex.y), labelW).sort((a, b) => away(b) - away(a)), labelW);
      }
      if (item.show.midpoint && item.shape.midpoint) {
        const label = midpointLabel(item.shape.midpoint, pi);
        placeComputed(label, tone, around(sx(item.shape.midpoint[0]), sy(item.shape.midpoint[1]), measureLabel(label)));
      }
    }

    // La longitud de un lado va junto a su punto medio, del lado de fuera de la figura
    for (const item of figureShapes) {
      if (!item.show.lengths) continue;
      const [cx, cy] = item.center;
      for (const side of item.shape.sides) {
        const label = sideLabel(side);
        const labelW = measureLabel(label);
        const [x1, y1, x2, y2] = [sx(side.from.x), sy(side.from.y), sx(side.to.x), sy(side.to.y)];
        const length = Math.hypot(x2 - x1, y2 - y1) || 1;
        // Perpendicular al lado, apuntando lejos del centro de la figura
        let nx = -(y2 - y1) / length;
        let ny = (x2 - x1) / length;
        if (((x1 + x2) / 2 - cx) * nx + ((y1 + y2) / 2 - cy) * ny < 0) [nx, ny] = [-nx, -ny];
        // Junto al punto medio; si ahí estorba (el rótulo del punto medio, otro vértice), a un tercio del lado.
        // `side` es 1 hacia fuera de la figura y -1 hacia dentro: la caja queda entera de ese lado, a 6 px del trazo
        const reach = beside(nx, ny, labelW);
        const at = (t: number, side: 1 | -1) => ({ x: x1 + (x2 - x1) * t + side * nx * reach - labelW / 2, y: y1 + (y2 - y1) * t + side * ny * reach - LABEL_H / 2 });
        placeComputed(label, `crt-plane__label--${item.tone}`, [0.5, 0.32, 0.68].flatMap(t => [at(t, 1), at(t, -1)]), labelW);
      }
    }

    for (const vertex of corners) {
      const label = planePointLatex(spec, vertex.x, vertex.y);
      placeComputed(label, "crt-plane__label--line", aroundFar(sx(vertex.x), sy(vertex.y), measureLabel(label)));
    }

    for (const point of notable) {
      if (point.label) placeComputed(point.label, `crt-plane__label--${point.tone}`, aroundFar(sx(point.x), sy(point.y), measureLabel(point.label)));
    }

    // La medida del radio va a media altura del segmento, a un lado u otro sin pisarlo
    for (const conic of conics) {
      for (const segment of conic.segments) {
        const labelW = estimateWidth(segment.label);
        const mx = (segment.x1 + segment.x2) / 2;
        const my = (segment.y1 + segment.y2) / 2;
        place(segment.label, `crt-plane__label--${conic.tone}`, [
          { x: mx + 6, y: my + 2 },
          { x: mx - labelW - 6, y: my - LABEL_H - 2 },
          { x: segment.x2 + 6, y: segment.y2 - LABEL_H - 2 },
        ]);
      }
    }

    for (const conic of conics) {
      for (const point of conic.points) place(point.name, `crt-plane__label--${conic.tone}`, around(sx(point.x), sy(point.y), estimateWidth(point.name)));
    }

    // El valor de una región va dentro de ella, lo más centrado que se pueda
    for (const area of areas) {
      if (!area.label) continue;
      const labelW = estimateWidth(area.label);
      const px = sx(area.anchor[0]) - labelW / 2;
      const py = sy(area.anchor[1]) - LABEL_H / 2;
      place(area.label, `crt-plane__label--${area.tone}`, [
        { x: px, y: py },
        { x: px, y: py - LABEL_H },
        { x: px, y: py + LABEL_H },
        { x: px - labelW / 2, y: py },
        { x: px + labelW / 2, y: py },
      ]);
    }

    // La pendiente o la ecuación de una tangente o una secante va pegada a su recta y cerca de su punto:
    // con dos tangentes en el plano, cada rótulo se lee con la suya
    for (const item of lines) {
      if (!item.label || item.line.points.length === 0) continue;
      const labelW = estimateWidth(item.label);
      const ax = sx(item.line.points.reduce((sum, [x]) => sum + x, 0) / item.line.points.length);
      const ay = sy(item.line.points.reduce((sum, [, y]) => sum + y, 0) / item.line.points.length);
      // Dirección de la recta en pantalla
      const dx = sx(1) - sx(0);
      const dy = sy(item.line.slope) - sy(0);
      const length = Math.hypot(dx, dy);
      const rising = dy < 0;
      const candidates = [46, -46, 84, -84, 128, -128, 180, -180].flatMap(distance => {
        const px = ax + (dx / length) * distance;
        const py = ay + (dy / length) * distance;
        if (px < PAD.left || px > PAD.left + w || py < PAD.top || py > PAD.top + h) return [];
        // A un lado y otro de la recta sin pisarla: si sube, abajo a la derecha y arriba a la izquierda
        return rising
          ? [
              { x: px + 8, y: py + 4 },
              { x: px - labelW - 8, y: py - LABEL_H - 4 },
            ]
          : [
              { x: px + 8, y: py - LABEL_H - 4 },
              { x: px - labelW - 8, y: py + 4 },
            ];
      });
      if (candidates.length > 0) place(item.label, `crt-plane__label--${item.tone}`, candidates);
    }

    // La inecuación va pegada a su frontera, a un lado u otro y en el tramo donde menos estorbe
    for (const bound of bounds) {
      if (!bound.label) continue;
      const labelW = measureLabel(bound.label);
      const [x1, y1, x2, y2] = [sx(bound.from[0]), sy(bound.from[1]), sx(bound.to[0]), sy(bound.to[1])];
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / length;
      const ny = (x2 - x1) / length;
      const candidates = [0.5, 0.28, 0.72, 0.14, 0.86].flatMap(t => {
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        const reach = beside(nx, ny, labelW);
        return [1, -1].map(side => ({ x: px + side * nx * reach - labelW / 2, y: py + side * ny * reach - LABEL_H / 2 }));
      });
      placeComputed(bound.label, `crt-plane__label--${bound.tone}`, candidates, labelW);
    }

    for (const line of verticals) {
      if (!line.label) continue;
      const px = sx(line.x);
      const labelW = estimateWidth(line.label);
      // Arriba o abajo de la recta, a un lado u otro: donde menos estorbe
      place(
        line.label,
        "crt-plane__label--line",
        [PAD.top + 4, PAD.top + h - LABEL_H - 4, PAD.top + h * 0.25, PAD.top + h * 0.7].flatMap(y => [
          { x: px + 6, y },
          { x: px - labelW - 6, y },
        ]),
      );
    }

    for (const curve of curves) {
      const label = spec.functions[curve.index].label;
      if (!label || curve.samples.length === 0) continue;
      const labelW = estimateWidth(label);
      const candidates = [0.72, 0.5, 0.28, 0.86, 0.14].flatMap(t => {
        const [x, y] = curve.samples[Math.min(curve.samples.length - 1, Math.floor(curve.samples.length * t))];
        const px = sx(x);
        const py = sy(y);
        return [
          { x: px + 10, y: py + 4 },
          { x: px + 10, y: py - LABEL_H - 4 },
          { x: px - labelW - 10, y: py + 4 },
          { x: px - labelW - 10, y: py - LABEL_H - 4 },
        ];
      });
      place(label, `crt-plane__label--${curve.tone}`, candidates);
    }

    for (const conic of conics) {
      if (!conic.equation || conic.samples.length === 0) continue;
      // Las fracciones de la ecuación van a tamaño de texto para que se lean en papel: la etiqueta es más alta
      const tall = conic.equation.includes("\\frac");
      const latex = tall ? conic.equation.replaceAll("\\frac", "\\dfrac") : conic.equation;
      const labelH = tall ? TALL_LABEL_H : LABEL_H;
      const labelW = estimateFractionWidth(latex);
      const xs = conic.samples.map(([x]) => sx(x));
      const ys = conic.samples.map(([, y]) => sy(y));
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      // Primero fuera de la curva (encima, debajo, las esquinas del plano); si no hay sitio, pegada a ella
      const outside = [
        { x: center - labelW / 2, y: Math.min(...ys) - labelH - 6 },
        { x: center - labelW / 2, y: Math.max(...ys) + 6 },
        { x: PAD.left + w - labelW - 4, y: PAD.top + 2 },
        { x: PAD.left + 4, y: PAD.top + 2 },
        { x: PAD.left + w - labelW - 4, y: PAD.top + h - labelH - 2 },
        { x: PAD.left + 4, y: PAD.top + h - labelH - 2 },
      ];
      const beside = [0.13, 0.37, 0.63, 0.87, 0.5, 0.25, 0.75].flatMap(t => {
        const [x, y] = conic.samples[Math.min(conic.samples.length - 1, Math.floor(conic.samples.length * t))];
        const px = sx(x);
        const py = sy(y);
        return [
          { x: px + 10, y: py - labelH - 4 },
          { x: px + 10, y: py + 4 },
          { x: px - labelW - 10, y: py - labelH - 4 },
          { x: px - labelW - 10, y: py + 4 },
        ];
      });
      place(latex, `crt-plane__label--${conic.tone}${tall ? " crt-plane__label--tall" : ""}`, [...outside, ...beside], labelW, labelH);
    }

    // Los círculos rellenos van encima de los vacíos: donde un trozo termina abierto y otro empieza cerrado
    // en el mismo punto, el punto pertenece a la función y se ve relleno, sea cual sea el orden de los trozos
    const marks = curves
      .flatMap(curve => curve.marks.map((mark, index) => ({ ...mark, tone: curve.tone, key: `${curve.index}-${index}` })))
      .sort((a, b) => Number(a.filled) - Number(b.filled));

    // La descripción para lectores de pantalla repite cálculos de arriba: se hace una vez por plano, no en cada render
    return { description: describe(spec), layout, sx, sy, xTicks, yTicks, numbers, axisX, axisY, curves, marks, verticals, conics, areas, lines, notable, figures, figureShapes, bounds, regionPath, corners, labels, toneOf };
  }, [spec]);

  if (!view) return <div className="crt-plane crt-plane--invalid">Rango de la gráfica no válido.</div>;

  const { description, layout, sx, sy, xTicks, yTicks, numbers, axisX, axisY, curves, marks, verticals, conics, areas, lines, notable, figures, figureShapes, bounds, regionPath, corners, labels, toneOf } = view;
  const { w, h, width, height, pad: PAD } = layout;
  const axisXpx = sy(axisX);
  const axisYpx = sx(axisY);
  // Con el origen a la vista, el cero se escribe una sola vez junto al cruce de los ejes
  const originInside = axisX === 0 && axisY === 0;
  const left = PAD.left - 10;
  const right = PAD.left + w + 10;
  const top = PAD.top - 10;
  const bottom = PAD.top + h + 10;
  // En múltiplos de π las raíces de seno y coseno caen justo en las marcas: sus rótulos van encima de
  // las curvas, con halo, para que se lean. Con números, el eje se dibuja como siempre, debajo.
  const piAxis = usesPi(spec);
  const xNumbers = numbers.x.map(number => (
    <text key={`lx${number.value}`} x={sx(number.value)} y={axisXpx + 14} textAnchor="middle" style={piAxis ? TEXT_HALO : undefined}>
      {number.text}
    </text>
  ));

  return (
    <div className="crt-plane" data-notes={noted ? "" : undefined} style={{ "--plane-w": `${width}px`, "--plane-wn": width, "--plane-hn": height, aspectRatio: `${width} / ${height}` } as CSSProperties}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={w} height={h} />
          </clipPath>
        </defs>

        <g className="crt-plane__grid">
          {xTicks.map(tick => (
            <line key={`gx${tick.value}`} x1={sx(tick.value)} x2={sx(tick.value)} y1={PAD.top} y2={PAD.top + h} />
          ))}
          {yTicks.map(y => (
            <line key={`gy${y}`} x1={PAD.left} x2={PAD.left + w} y1={sy(y)} y2={sy(y)} />
          ))}
          <rect x={PAD.left} y={PAD.top} width={w} height={h} fill="none" />
        </g>

        <g className="crt-plane__axis">
          <line x1={left} x2={right} y1={axisXpx} y2={axisXpx} />
          <line x1={axisYpx} x2={axisYpx} y1={bottom} y2={top} />
          <path d={`M${right + 6} ${axisXpx} l-7 -3.5 v7 z`} />
          <path d={`M${left - 6} ${axisXpx} l7 -3.5 v7 z`} />
          <path d={`M${axisYpx} ${top - 6} l-3.5 7 h7 z`} />
          <path d={`M${axisYpx} ${bottom + 6} l-3.5 -7 h7 z`} />
          {xTicks.map(tick => (
            <line key={`tx${tick.value}`} x1={sx(tick.value)} x2={sx(tick.value)} y1={axisXpx - 3} y2={axisXpx + 3} />
          ))}
          {yTicks.map(y => (
            <line key={`ty${y}`} x1={axisYpx - 3} x2={axisYpx + 3} y1={sy(y)} y2={sy(y)} />
          ))}
        </g>

        <g className="crt-plane__ticks">
          {!piAxis && xNumbers}
          {numbers.y.map(number => (
            <text key={`ly${number.value}`} x={axisYpx - 7} y={sy(number.value) + 3.5} textAnchor="end">
              {number.text}
            </text>
          ))}
          {originInside && (
            <text x={axisYpx - 7} y={axisXpx + 14} textAnchor="end">
              0
            </text>
          )}
          {/* Un eje con nombre lo lleva fuera de la cuadrícula, en su propia franja; sin nombre, la letra de siempre junto a la flecha */}
          {layout.xName ? (
            <text className="crt-plane__axis-name" x={layout.xName.x} y={layout.xName.y} textAnchor="middle">
              {spec.xLabel}
            </text>
          ) : (
            <text className="crt-plane__name" x={right + 2} y={axisXpx - 8} textAnchor="middle">
              x
            </text>
          )}
          {layout.yName ? (
            <text className="crt-plane__axis-name" x={layout.yName.x} y={layout.yName.y} textAnchor="middle" transform={`rotate(-90 ${layout.yName.x} ${layout.yName.y})`}>
              {spec.yLabel}
            </text>
          ) : (
            <text className="crt-plane__name" x={axisYpx + 12} y={top - 2} textAnchor="middle">
              y
            </text>
          )}
        </g>

        <g clipPath={`url(#${clipId})`}>
          {regionPath && <path className="crt-plane__region" d={regionPath} />}
          {bounds.map(bound => (bound.region ? <path key={`r${bound.index}`} className={`crt-plane__region crt-plane__tone--${bound.tone}`} d={bound.region} /> : null))}
          {bounds.map(bound => (
            <path key={`b${bound.index}`} className={`crt-plane__bound crt-plane__tone--${bound.tone}${bound.dashed ? " crt-plane__curve--dashed" : ""}`} d={bound.d} />
          ))}
          {areas.map(area =>
            area.rectangles.length > 0 ? (
              area.rectangles.map((rectangle, index) => <rect key={`a${area.index}-${index}`} className={`crt-plane__area crt-plane__tone--${area.tone}`} {...rectangle} />)
            ) : (
              <path key={`a${area.index}`} className={`crt-plane__area crt-plane__tone--${area.tone}`} d={area.d} />
            ),
          )}
          {verticals.map((line, index) => (
            <line key={`v${index}`} className={`crt-plane__vline${line.style === "dashed" ? " crt-plane__curve--dashed" : ""}`} x1={sx(line.x)} x2={sx(line.x)} y1={PAD.top} y2={PAD.top + h} />
          ))}
          {conics.map(conic => conic.lines.map((d, index) => <path key={`cl${conic.index}-${index}`} className={`crt-plane__aux crt-plane__tone--${conic.tone}`} d={d} />))}
          {curves.map(curve =>
            curve.paths.map((d, index) => (
              <path key={`${curve.index}-${index}`} className={`crt-plane__curve crt-plane__curve--${curve.tone}${curve.dashed ? " crt-plane__curve--dashed" : ""}`} d={d} />
            )),
          )}
          {conics.map(conic => conic.paths.map((d, index) => <path key={`c${conic.index}-${index}`} className={`crt-plane__curve crt-plane__curve--${conic.tone}`} d={d} />))}
          {conics.map(conic =>
            conic.segments.map((segment, index) => <line key={`cs${conic.index}-${index}`} className={`crt-plane__radius crt-plane__tone--${conic.tone}`} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />),
          )}
          {lines.map(item => (
            <path key={item.key} className={`crt-plane__line crt-plane__tone--${item.tone}${item.tone === "s" ? " crt-plane__line--secant" : ""}`} d={item.d} />
          ))}
          {figures.map(figure => (
            <g key={`f${figure.index}`}>
              {figure.guides.map((d, index) => (
                <path key={`g${index}`} className="crt-plane__guide" d={d} />
              ))}
              {figure.arrow && (
                <>
                  <path className="crt-plane__guide" d={figure.arrow.d} />
                  <path className="crt-plane__guide-head" d={figure.arrow.head} />
                </>
              )}
              {figure.shapes.map((item, index) =>
                item.d ? <path key={`s${index}`} className={`crt-plane__shape crt-plane__tone--${item.tone}${item.shape.kind === "polygon" ? " crt-plane__shape--filled" : ""}`} d={item.d} /> : null,
              )}
            </g>
          ))}
        </g>

        <g className="crt-plane__marks">
          {corners.map((vertex, index) => (
            <circle key={`rv${index}`} className={`crt-plane__dot${vertex.open ? " crt-plane__dot--open" : ""}`} cx={sx(vertex.x)} cy={sy(vertex.y)} r={3.8} />
          ))}
        </g>

        <g className="crt-plane__marks">
          {figures.map(figure => (figure.center ? <circle key={`fc${figure.index}`} className="crt-plane__dot" cx={sx(figure.center[0])} cy={sy(figure.center[1])} r={3.4} /> : null))}
          {figureShapes.map((item, index) => (
            <g key={`fv${index}`} className={`crt-plane__tone--${item.tone}`}>
              {item.shape.vertices.map((vertex, at) => (
                <circle key={at} className="crt-plane__dot" cx={sx(vertex.x)} cy={sy(vertex.y)} r={3.6} />
              ))}
              {item.show.midpoint && item.shape.midpoint && <circle className="crt-plane__dot" cx={sx(item.shape.midpoint[0])} cy={sy(item.shape.midpoint[1])} r={3.2} />}
            </g>
          ))}
        </g>

        {piAxis && <g className="crt-plane__ticks">{xNumbers}</g>}

        <g className="crt-plane__marks">
          {marks.map(mark => (
            <circle key={mark.key} className={`crt-plane__mark crt-plane__tone--${mark.tone}${mark.filled ? "" : " crt-plane__mark--open"}`} cx={sx(mark.x)} cy={sy(mark.y)} r={MARK_R} />
          ))}
        </g>

        <g className="crt-plane__marks">
          {conics.map(conic => conic.points.map((point, index) => <circle key={`${conic.index}-${index}`} className={`crt-plane__dot crt-plane__tone--${conic.tone}`} cx={sx(point.x)} cy={sy(point.y)} r={3.2} />))}
        </g>

        <g className="crt-plane__marks">
          {lines.map(item => item.points.map(([x, y], index) => <circle key={`${item.key}-${index}`} className={`crt-plane__dot crt-plane__tone--${item.tone}`} cx={sx(x)} cy={sy(y)} r={3.6} />))}
        </g>

        <g className="crt-plane__marks">
          {notable.map((point, index) => (
            <circle key={index} className={`crt-plane__dot crt-plane__tone--${point.tone}`} cx={sx(point.x)} cy={sy(point.y)} r={3.8} />
          ))}
        </g>

        <g className="crt-plane__points">
          {spec.points.map((point, index) =>
            point.open ? (
              // Un hueco de la curva lleva el color de su función
              <circle key={index} className={`crt-plane__hole${point.on == null ? "" : ` crt-plane__tone--${toneOf(point.on)}`}`} cx={sx(point.x)} cy={sy(point.y)} r={MARK_R + 0.4} />
            ) : (
              <circle key={index} cx={sx(point.x)} cy={sy(point.y)} r={POINT_R} />
            ),
          )}
        </g>
      </svg>

      {labels.map((label, index) => (
        <span
          key={index}
          className={`crt-plane__label ${label.tone}`}
          style={{ left: `${(label.x / width) * 100}%`, top: `${(label.y / height) * 100}%` }}
        >
          <Formula latex={label.latex} />
        </span>
      ))}
      <FigureNotes />
    </div>
  );
});

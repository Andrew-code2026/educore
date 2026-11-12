import { memo, useId, useMemo, type CSSProperties } from "react";
import type { GraphSpec } from "@shared/creator";
import { formatNumber, formatNumberEs, sampleCurve, tryCompile } from "@shared/creatorMath";
import { Formula } from "./Formula";

/** Márgenes alrededor de la cuadrícula: caben las flechas de los ejes y los números. */
const PAD = { left: 30, right: 24, top: 22, bottom: 28 };
const MAX_W = 320;
const MAX_H = 320;
const MIN_SIDE = 150;
const LABEL_H = 20;
const CURVE_CLASSES = ["crt-plane__curve--a", "crt-plane__curve--b", "crt-plane__curve--c", "crt-plane__curve--d"];

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

/**
 * Tamaño de la cuadrícula. Con rangos parecidos se usan unidades iguales en ambos ejes
 * (una recta de pendiente 1 se ve a 45°); si son muy distintos, cada eje toma su escala.
 */
function plotSize(xSpan: number, ySpan: number): { w: number; h: number } {
  const ratio = ySpan / xSpan;
  if (ratio >= MIN_SIDE / MAX_W && ratio <= MAX_H / MIN_SIDE) {
    let w = MAX_W;
    let h = w * ratio;
    if (h > MAX_H) {
      h = MAX_H;
      w = h / ratio;
    }
    return { w, h };
  }
  return ratio > 1 ? { w: 240, h: MAX_H } : { w: MAX_W, h: 200 };
}

/** Múltiplos de `step` dentro de [min, max], contados con enteros para no acumular error. */
function ticks(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) values.push(Number((k * step).toFixed(10)));
  return values;
}

/** Ancho aproximado de una etiqueta LaTeX en pantalla, para ubicarla sin medir el DOM. */
function estimateWidth(latex: string): number {
  const plain = latex.replace(/\\[a-zA-Z]+/g, "x").replace(/[{}\\^_]/g, "");
  return Math.max(2, plain.length) * 7 + 10;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function describe(spec: GraphSpec): string {
  const functions = spec.functions.map(fn => fn.expr).join("; ");
  const points = spec.points.map(point => `(${formatNumber(point.x)}, ${formatNumber(point.y)})`).join(", ");
  const base = functions ? `Plano cartesiano con ${functions}` : "Plano cartesiano en blanco";
  return points ? `${base}. Puntos marcados: ${points}.` : `${base}.`;
}

/** Plano cartesiano dibujado a partir de la función: lo que se ve siempre coincide con la fórmula. */
export const CoordinatePlane = memo(function CoordinatePlane({ spec }: { spec: GraphSpec }) {
  const clipId = useId();

  const view = useMemo(() => {
    const xSpan = spec.xMax - spec.xMin;
    const ySpan = spec.yMax - spec.yMin;
    if (!(xSpan > 0) || !(ySpan > 0)) return null;

    const { w, h } = plotSize(xSpan, ySpan);
    const width = PAD.left + w + PAD.right;
    const height = PAD.top + h + PAD.bottom;
    const sx = (x: number) => PAD.left + ((x - spec.xMin) / xSpan) * w;
    const sy = (y: number) => PAD.top + ((spec.yMax - y) / ySpan) * h;

    const xTicks = ticks(spec.xMin, spec.xMax, spec.xStep);
    const yTicks = ticks(spec.yMin, spec.yMax, spec.yStep);
    // Si el cero no está en el rango, el eje se dibuja en el borde más cercano
    const axisX = Math.min(Math.max(0, spec.yMin), spec.yMax);
    const axisY = Math.min(Math.max(0, spec.xMin), spec.xMax);
    const everyX = Math.max(1, Math.ceil(xTicks.length / 14));
    const everyY = Math.max(1, Math.ceil(yTicks.length / 14));

    const curves = spec.functions.map((fn, index) => {
      const compiled = tryCompile(fn.expr);
      if (!compiled.ok) return { index, paths: [] as string[], samples: [] as Array<[number, number]> };
      const segments = sampleCurve(compiled.fn, spec);
      const paths = segments.map(segment => segment.points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`).join(" "));
      const samples = segments.flatMap(segment => segment.points).filter(([, y]) => y >= spec.yMin && y <= spec.yMax);
      return { index, paths, samples };
    });

    // Las etiquetas se ubican por prioridad: primero los puntos, luego las curvas
    const plot: Box = { x: PAD.left, y: PAD.top, w, h };
    const occupied: Box[] = spec.points.map(point => ({ x: sx(point.x) - 6, y: sy(point.y) - 6, w: 12, h: 12 }));
    const labels: PlacedLabel[] = [];

    // Lo que una etiqueta no debería tapar: los números de los ejes, los ejes y las curvas
    const originShown = axisX === 0 && axisY === 0;
    const numberBox = (text: string, anchorX: number, baseline: number, anchor: "middle" | "end"): Box => {
      const boxW = text.length * 6 + 4;
      return { x: anchor === "middle" ? anchorX - boxW / 2 : anchorX - boxW, y: baseline - 10, w: boxW, h: 13 };
    };
    const numberBoxes: Box[] = [
      ...xTicks.filter((x, index) => index % everyX === 0 && !(originShown && x === 0)).map(x => numberBox(formatNumberEs(x), sx(x), sy(axisX) + 14, "middle")),
      ...yTicks.filter((y, index) => index % everyY === 0 && !(originShown && y === 0)).map(y => numberBox(formatNumberEs(y), sx(axisY) - 7, sy(y) + 3.5, "end")),
      ...(originShown ? [numberBox("0", sx(axisY) - 7, sy(axisX) + 14, "end")] : []),
    ];
    const axisBoxes: Box[] = [
      { x: PAD.left, y: sy(axisX) - 2, w, h: 4 },
      { x: sx(axisY) - 2, y: PAD.top, w: 4, h },
    ];
    const curvePixels = curves.flatMap(curve => curve.samples.map(([x, y]) => [sx(x), sy(y)] as const));

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

    const place = (latex: string, tone: string, candidates: Array<{ x: number; y: number }>) => {
      const labelW = estimateWidth(latex);
      const fits = (box: Box) =>
        box.x >= plot.x - 4 && box.x + box.w <= plot.x + plot.w + PAD.right - 2 && box.y >= plot.y - 8 && box.y + box.h <= plot.y + plot.h + 8;
      const boxes = candidates.map(candidate => ({ x: candidate.x, y: candidate.y, w: labelW, h: LABEL_H }));
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

    for (const point of spec.points) {
      if (!point.label) continue;
      const px = sx(point.x);
      const py = sy(point.y);
      const labelW = estimateWidth(point.label);
      place(point.label, "crt-plane__label--point", [
        { x: px + 8, y: py - LABEL_H - 2 },
        { x: px + 8, y: py + 4 },
        { x: px - labelW - 8, y: py - LABEL_H - 2 },
        { x: px - labelW - 8, y: py + 4 },
        { x: px - labelW / 2, y: py - LABEL_H - 8 },
        { x: px - labelW / 2, y: py + 10 },
        { x: px + 12, y: py - LABEL_H / 2 },
        { x: px - labelW - 12, y: py - LABEL_H / 2 },
      ]);
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
      place(label, CURVE_CLASSES[curve.index % CURVE_CLASSES.length].replace("curve", "label"), candidates);
    }

    return { w, h, width, height, sx, sy, xTicks, yTicks, axisX, axisY, everyX, everyY, curves, labels };
  }, [spec]);

  if (!view) return <div className="crt-plane crt-plane--invalid">Rango de la gráfica no válido.</div>;

  const { w, h, width, height, sx, sy, xTicks, yTicks, axisX, axisY, everyX, everyY, curves, labels } = view;
  const axisXpx = sy(axisX);
  const axisYpx = sx(axisY);
  // Con el origen a la vista, el cero se escribe una sola vez junto al cruce de los ejes
  const originInside = axisX === 0 && axisY === 0;
  const left = PAD.left - 10;
  const right = PAD.left + w + 10;
  const top = PAD.top - 10;
  const bottom = PAD.top + h + 10;

  return (
    <div className="crt-plane" style={{ "--plane-w": `${width}px`, aspectRatio: `${width} / ${height}` } as CSSProperties}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={describe(spec)}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={w} height={h} />
          </clipPath>
        </defs>

        <g className="crt-plane__grid">
          {xTicks.map(x => (
            <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={PAD.top} y2={PAD.top + h} />
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
          {xTicks.map(x => (
            <line key={`tx${x}`} x1={sx(x)} x2={sx(x)} y1={axisXpx - 3} y2={axisXpx + 3} />
          ))}
          {yTicks.map(y => (
            <line key={`ty${y}`} x1={axisYpx - 3} x2={axisYpx + 3} y1={sy(y)} y2={sy(y)} />
          ))}
        </g>

        <g className="crt-plane__ticks">
          {xTicks.map((x, index) =>
            (originInside && x === 0) || index % everyX !== 0 ? null : (
              <text key={`lx${x}`} x={sx(x)} y={axisXpx + 14} textAnchor="middle">
                {formatNumberEs(x)}
              </text>
            ),
          )}
          {yTicks.map((y, index) =>
            (originInside && y === 0) || index % everyY !== 0 ? null : (
              <text key={`ly${y}`} x={axisYpx - 7} y={sy(y) + 3.5} textAnchor="end">
                {formatNumberEs(y)}
              </text>
            ),
          )}
          {originInside && (
            <text x={axisYpx - 7} y={axisXpx + 14} textAnchor="end">
              0
            </text>
          )}
          <text className="crt-plane__name" x={right + 2} y={axisXpx - 8} textAnchor="middle">
            x
          </text>
          <text className="crt-plane__name" x={axisYpx + 12} y={top - 2} textAnchor="middle">
            y
          </text>
        </g>

        <g clipPath={`url(#${clipId})`}>
          {curves.map(curve =>
            curve.paths.map((d, index) => (
              <path key={`${curve.index}-${index}`} className={`crt-plane__curve ${CURVE_CLASSES[curve.index % CURVE_CLASSES.length]}`} d={d} />
            )),
          )}
        </g>

        <g className="crt-plane__points">
          {spec.points.map((point, index) => (
            <circle key={index} cx={sx(point.x)} cy={sy(point.y)} r={4.2} />
          ))}
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
    </div>
  );
});

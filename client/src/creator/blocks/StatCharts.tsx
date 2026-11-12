import { memo, useId, useMemo, type ReactNode } from "react";
import type { BlockInput } from "@shared/creator";
import { niceMax, niceStep, wrapLabel } from "@shared/creatorFigures";
import { formatNumberEs } from "@shared/creatorMath";
import { axisTicks, fiveNumberSummary, linearRegression, resolveAxis, spreadLabels, trendLineLatex, trendLineText } from "@shared/creatorStats";
import { FigureFrame, FigureTitle, figureColor, figureTitleHeight, TEXT_HALO, type FigureLabel } from "./FigureFrame";

type HistogramSpec = Extract<BlockInput, { type: "histogram" }>;
type BoxPlotSpec = Extract<BlockInput, { type: "box_plot" }>;
type LineChartSpec = Extract<BlockInput, { type: "line_chart" }>;
type ScatterPlotSpec = Extract<BlockInput, { type: "scatter_plot" }>;

/** Mismas medidas que los diagramas de barras y circular: las figuras de una guía se ven de una familia. */
const WIDTH = 520;
const PLOT_H = 196;
const INK = "#111B24";
/** Ancho medio de un carácter de los números de los ejes (Outfit, 11,5 px). */
const CHAR_W = 6.4;


/** Margen izquierdo: caben los números del eje vertical, por largos que sean, y su nombre. */
const leftMargin = (ticks: number[], named: boolean) => Math.max(46, Math.max(...ticks.map(tick => formatNumberEs(tick).length)) * CHAR_W + 18) + (named ? 20 : 0);


function AxisNames({ xLabel, yLabel, centerX, bottom, centerY }: { xLabel?: string; yLabel?: string; centerX: number; bottom: number; centerY: number }) {
  return (
    <>
      {xLabel && (
        <text x={centerX} y={bottom} textAnchor="middle" className="crt-figure__axis-name">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text transform={`translate(14 ${centerY}) rotate(-90)`} textAnchor="middle" className="crt-figure__axis-name">
          {yLabel}
        </text>
      )}
    </>
  );
}


/* ───────────────────────── Histograma ───────────────────────── */

/** Histograma: barras contiguas sobre un eje numérico. Con `blank` quedan los ejes y los límites de las clases. */
export const Histogram = memo(function Histogram({ spec }: { spec: HistogramSpec }) {
  const view = useMemo(() => {
    const highest = Math.max(0, ...spec.classes.map(item => item.frequency));
    // Las frecuencias son conteos: el eje no baja de uno en uno
    const step = spec.yStep ?? Math.max(1, niceStep(spec.yMax ?? (highest || 10)));
    const yMax = Math.max(spec.yMax ?? niceMax(highest || step * 5, step), step);
    const ticks = axisTicks({ min: 0, max: yMax, step });
    const left = leftMargin(ticks, Boolean(spec.yLabel));
    const top = figureTitleHeight(spec.title) + 12;
    const plotW = WIDTH - left - 16;
    // Un poco de aire a los lados: la primera barra no se pega al eje vertical
    const inset = 14;
    const first = Math.min(...spec.classes.map(item => item.from));
    const last = Math.max(...spec.classes.map(item => item.to));
    const span = last - first || 1;
    const x = (value: number) => left + inset + ((value - first) / span) * (plotW - inset * 2);
    const y = (value: number) => top + PLOT_H - (Math.min(value, yMax) / yMax) * PLOT_H;
    const bounds = Array.from(new Set([...spec.classes.map(item => item.from), ...spec.classes.map(item => item.to)])).sort((a, b) => a - b);
    const boundTexts = bounds.map(bound => formatNumberEs(bound, 3));
    const room = (plotW - inset * 2) / Math.max(1, bounds.length - 1);
    const every = Math.max(1, Math.ceil((Math.max(...boundTexts.map(text => text.length)) * CHAR_W + 8) / room));
    const height = top + PLOT_H + 22 + (spec.xLabel ? 22 : 4);
    return { ticks, left, top, plotW, x, y, bounds, boundTexts, every, height };
  }, [spec]);

  const { ticks, left, top, plotW, x, y, bounds, boundTexts, every, height } = view;
  const base = top + PLOT_H;
  const description = `Histograma${spec.title ? ` «${spec.title}»` : ""}: ${spec.classes
    .map(item => `de ${formatNumberEs(item.from, 3)} a ${formatNumberEs(item.to, 3)}${spec.blank ? "" : `, ${item.frequency}`}`)
    .join("; ")}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      <FigureTitle text={spec.title} width={WIDTH} />
      <g className="crt-figure__grid">
        {ticks.map(tick => (
          <line key={tick} x1={left} x2={left + plotW} y1={y(tick)} y2={y(tick)} />
        ))}
      </g>
      <g className="crt-figure__text">
        {ticks.map(tick => (
          <text key={tick} x={left - 8} y={y(tick) + 4} textAnchor="end">
            {formatNumberEs(tick)}
          </text>
        ))}
        {bounds.map((bound, index) =>
          index % every === 0 ? (
            <text key={bound} x={x(bound)} y={base + 17} textAnchor="middle">
              {boundTexts[index]}
            </text>
          ) : null,
        )}
        <AxisNames xLabel={spec.xLabel} yLabel={spec.yLabel} centerX={left + plotW / 2} bottom={height - 6} centerY={top + PLOT_H / 2} />
      </g>
      {!spec.blank && (
        <g>
          {spec.classes.map((item, index) => (
            <rect key={index} x={x(item.from)} y={y(item.frequency)} width={Math.max(0, x(item.to) - x(item.from))} height={Math.max(0, base - y(item.frequency))} fill={figureColor(0).fill} stroke={figureColor(0).stroke} strokeWidth={1.4} />
          ))}
        </g>
      )}
      {!spec.blank && spec.showValues && (
        <g className="crt-figure__text crt-figure__text--strong">
          {spec.classes.map((item, index) => (
            <text key={index} x={(x(item.from) + x(item.to)) / 2} y={y(item.frequency) - 6} textAnchor="middle">
              {formatNumberEs(item.frequency)}
            </text>
          ))}
        </g>
      )}
      <g className="crt-figure__axis">
        <line x1={left} x2={left} y1={top - 6} y2={base} />
        <line x1={left} x2={left + plotW} y1={base} y2={base} />
        {bounds.map(bound => (
          <line key={bound} x1={x(bound)} x2={x(bound)} y1={base} y2={base + 5} />
        ))}
      </g>
    </FigureFrame>
  );
});

/* ───────────────────────── Caja y bigotes ───────────────────────── */

const BOX_HALF = 14;

/**
 * Diagrama de caja y bigotes, uno por grupo sobre un mismo eje. El resumen de cinco números
 * se calcula aquí desde los datos crudos. Con `blank` queda el eje para que el estudiante lo construya.
 */
export const BoxPlot = memo(function BoxPlot({ spec }: { spec: BoxPlotSpec }) {
  const view = useMemo(() => {
    const all = spec.series.flatMap(series => series.data);
    const axis = resolveAxis(Math.min(...all), Math.max(...all), { min: spec.xMin, max: spec.xMax, step: spec.xStep }, 8);
    const names = spec.series.map(series => (series.label ? wrapLabel(series.label, 13) : []));
    const longest = Math.max(0, ...names.flat().map(line => line.length));
    const left = 26 + (longest > 0 ? Math.min(104, longest * 6.8 + 12) : 0);
    const right = WIDTH - 26;
    const valuesShown = spec.showValues && !spec.blank;
    const rowH = valuesShown ? 70 : 54;
    const top = figureTitleHeight(spec.title) + 4;
    const axisY = top + rowH * spec.series.length + 6;
    const x = (value: number) => left + ((Math.min(Math.max(value, axis.min), axis.max) - axis.min) / (axis.max - axis.min)) * (right - left);
    const ticks = axisTicks(axis);

    const rows = spec.series.map((series, index) => {
      const summary = fiveNumberSummary(series.data);
      // Con los cinco números a la vista la caja baja un poco: ellos van encima
      const cy = top + rowH * index + (valuesShown ? rowH / 2 + 9 : rowH / 2);
      // Valores iguales (mínimo = Q1) se escriben una sola vez
      const values = summary ? Array.from(new Set([summary.min, summary.q1, summary.median, summary.q3, summary.max])) : [];
      const texts = values.map(value => formatNumberEs(value));
      const centers = spreadLabels(values.map((value, at) => ({ x: x(value), w: texts[at].length * 6.9 + 2 })), 5, left - 18, right + 18);
      return { summary, cy, name: names[index], numbers: texts.map((text, at) => ({ text, x: centers[at] })) };
    });
    const height = axisY + 22 + (spec.xLabel ? 22 : 4);
    return { axis, left, right, top, axisY, x, ticks, rows, valuesShown, height };
  }, [spec]);

  const { left, right, top, axisY, x, ticks, rows, valuesShown, height } = view;
  const description = `Diagrama de caja y bigotes${spec.title ? ` «${spec.title}»` : ""}${
    spec.blank
      ? `: eje de ${formatNumberEs(view.axis.min)} a ${formatNumberEs(view.axis.max)} para construirlo`
      : `: ${rows
          .map((row, index) => {
            const s = row.summary;
            const name = spec.series[index].label ? `${spec.series[index].label}, ` : "";
            return s ? `${name}mínimo ${formatNumberEs(s.min)}, primer cuartil ${formatNumberEs(s.q1)}, mediana ${formatNumberEs(s.median)}, tercer cuartil ${formatNumberEs(s.q3)}, máximo ${formatNumberEs(s.max)}` : name;
          })
          .join("; ")}`
  }.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      <FigureTitle text={spec.title} width={WIDTH} />
      <g className="crt-figure__grid">
        {ticks.map(tick => (
          <line key={tick} x1={x(tick)} x2={x(tick)} y1={top} y2={axisY} />
        ))}
      </g>
      <g className="crt-figure__text">
        {ticks.map(tick => (
          <text key={tick} x={x(tick)} y={axisY + 17} textAnchor="middle">
            {formatNumberEs(tick)}
          </text>
        ))}
        {rows.map((row, index) =>
          row.name.map((line, lineIndex) => (
            <text key={`${index}-${lineIndex}`} x={left - 16} y={row.cy + 4 + (lineIndex - (row.name.length - 1) / 2) * 14} textAnchor="end" className="crt-figure__axis-name">
              {line}
            </text>
          )),
        )}
        <AxisNames xLabel={spec.xLabel} centerX={(left + right) / 2} bottom={height - 6} centerY={0} />
      </g>
      {!spec.blank &&
        rows.map((row, index) => {
          const s = row.summary;
          if (!s) return null;
          const { cy } = row;
          return (
            <g key={index}>
              <g className="crt-figure__segment">
                <line x1={x(s.min)} x2={x(s.q1)} y1={cy} y2={cy} />
                <line x1={x(s.q3)} x2={x(s.max)} y1={cy} y2={cy} />
                <line x1={x(s.min)} x2={x(s.min)} y1={cy - 8} y2={cy + 8} />
                <line x1={x(s.max)} x2={x(s.max)} y1={cy - 8} y2={cy + 8} />
              </g>
              <rect className="crt-figure__outline" x={x(s.q1)} y={cy - BOX_HALF} width={Math.max(0, x(s.q3) - x(s.q1))} height={BOX_HALF * 2} fill={figureColor(index).fill} />
              <line x1={x(s.median)} x2={x(s.median)} y1={cy - BOX_HALF} y2={cy + BOX_HALF} stroke={INK} strokeWidth={2.6} />
            </g>
          );
        })}
      {valuesShown && (
        <g className="crt-figure__text crt-figure__text--strong">
          {rows.map((row, index) =>
            row.numbers.map((number, at) => (
              <text key={`${index}-${at}`} x={number.x} y={row.cy - BOX_HALF - 7} textAnchor="middle" {...TEXT_HALO}>
                {number.text}
              </text>
            )),
          )}
        </g>
      )}
      <g className="crt-figure__axis">
        <line x1={left - 10} x2={right + 10} y1={axisY} y2={axisY} />
        {ticks.map(tick => (
          <line key={tick} x1={x(tick)} x2={x(tick)} y1={axisY} y2={axisY + 5} />
        ))}
      </g>
    </FigureFrame>
  );
});

/* ───────────────────────── Gráfica de líneas ───────────────────────── */

/** Marca de cada serie: además del color, una forma distinta, para que se distingan en una fotocopia. */
function Marker({ shape, cx, cy, color }: { shape: number; cx: number; cy: number; color: string }): ReactNode {
  const common = { fill: color, stroke: "#FFFFFF", strokeWidth: 1.2 };
  switch (shape % 4) {
    case 1:
      return <rect x={cx - 4} y={cy - 4} width={8} height={8} {...common} />;
    case 2:
      return <path d={`M${cx} ${cy - 5.2} L${cx + 5} ${cy + 3.8} L${cx - 5} ${cy + 3.8} Z`} {...common} />;
    case 3:
      return <path d={`M${cx} ${cy - 5.4} L${cx + 5.4} ${cy} L${cx} ${cy + 5.4} L${cx - 5.4} ${cy} Z`} {...common} />;
    default:
      return <circle cx={cx} cy={cy} r={4.2} {...common} />;
  }
}

/** Reparte los nombres de las series en renglones centrados bajo el título. */
function legendRows(labels: string[], maxWidth: number): Array<Array<{ index: number; label: string; x: number }>> {
  const rows: Array<{ width: number; items: Array<{ index: number; label: string; offset: number }> }> = [];
  labels.forEach((label, index) => {
    const width = 34 + label.length * CHAR_W;
    let row = rows[rows.length - 1];
    if (!row || row.width + 18 + width > maxWidth) {
      row = { width: 0, items: [] };
      rows.push(row);
    }
    const offset = row.items.length > 0 ? row.width + 18 : 0;
    row.items.push({ index, label, offset });
    row.width = offset + width;
  });
  return rows.map(row => row.items.map(item => ({ index: item.index, label: item.label, x: (WIDTH - row.width) / 2 + item.offset })));
}

/** Gráfica de líneas sobre categorías ordenadas (meses, días…). Con `blank` quedan los ejes para trazarla. */
export const LineChart = memo(function LineChart({ spec }: { spec: LineChartSpec }) {
  const view = useMemo(() => {
    const count = spec.categories.length;
    const series = spec.series.map(item => item.values.slice(0, count));
    const all = series.flat();
    const axis = resolveAxis(Math.min(...all), Math.max(...all), { min: spec.yMin, max: spec.yMax, step: spec.yStep });
    const ticks = axisTicks(axis);
    const legend = spec.series.some(item => item.label) ? legendRows(spec.series.map((item, index) => item.label ?? `Serie ${index + 1}`), WIDTH - 40) : [];
    const left = leftMargin(ticks, Boolean(spec.yLabel));
    const legendTop = figureTitleHeight(spec.title) + 6;
    const top = legendTop + legend.length * 18 + (legend.length > 0 ? 12 : 6);
    const plotW = WIDTH - left - 16;
    const band = plotW / count;
    const cx = (index: number) => left + band * index + band / 2;
    const y = (value: number) => top + PLOT_H - ((Math.min(Math.max(value, axis.min), axis.max) - axis.min) / (axis.max - axis.min)) * PLOT_H;
    const names = spec.categories.map(category => wrapLabel(category, Math.max(6, Math.floor(band / 6.6))));
    const height = top + PLOT_H + 14 + Math.max(...names.map(lines => lines.length)) * 14 + (spec.xLabel ? 22 : 6);

    // El valor va encima de su punto, salvo en la serie más baja de cada categoría cuando hay varias: ahí va debajo
    const values = series.flatMap((items, s) =>
      items.map((value, index) => {
        const others = series.filter((_, other) => other !== s).map(other => other[index]).filter(other => other !== undefined);
        const below = others.length > 0 && others.every(other => other > value);
        const crowded = others.some(other => Math.abs(y(other) - y(value)) < 15 && (below ? other < value : other > value));
        return crowded ? null : { key: `${s}-${index}`, x: cx(index), y: y(value) + (below ? 17 : -9), text: formatNumberEs(value) };
      }),
    );
    return { axis, ticks, legend, legendTop, left, top, plotW, cx, y, names, height, series, values };
  }, [spec]);

  const { axis, ticks, legend, legendTop, left, top, plotW, cx, y, names, height, series, values } = view;
  const base = top + PLOT_H;
  const description = `Gráfica de líneas${spec.title ? ` «${spec.title}»` : ""}: ${
    spec.blank
      ? spec.categories.join(", ")
      : spec.series.map((item, s) => `${item.label ? `${item.label}: ` : ""}${series[s].map((value, index) => `${spec.categories[index]} ${formatNumberEs(value)}`).join(", ")}`).join("; ")
  }.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      <FigureTitle text={spec.title} width={WIDTH} />
      {legend.length > 0 && (
        <g className="crt-figure__text">
          {legend.map((row, rowIndex) =>
            row.map(item => {
              const ly = legendTop + rowIndex * 18 + 8;
              return (
                <g key={item.index}>
                  <line x1={item.x} x2={item.x + 26} y1={ly} y2={ly} stroke={figureColor(item.index).stroke} strokeWidth={2.2} />
                  <Marker shape={item.index} cx={item.x + 13} cy={ly} color={figureColor(item.index).stroke} />
                  <text x={item.x + 32} y={ly + 4}>
                    {item.label}
                  </text>
                </g>
              );
            }),
          )}
        </g>
      )}
      <g className="crt-figure__grid">
        {ticks.map(tick => (
          <line key={tick} x1={left} x2={left + plotW} y1={y(tick)} y2={y(tick)} />
        ))}
      </g>
      <g className="crt-figure__text">
        {ticks.map(tick => (
          <text key={tick} x={left - 8} y={y(tick) + 4} textAnchor="end">
            {formatNumberEs(tick)}
          </text>
        ))}
        {names.map((lines, index) =>
          lines.map((line, lineIndex) => (
            <text key={`${index}-${lineIndex}`} x={cx(index)} y={base + 18 + lineIndex * 14} textAnchor="middle">
              {line}
            </text>
          )),
        )}
        <AxisNames xLabel={spec.xLabel} yLabel={spec.yLabel} centerX={left + plotW / 2} bottom={height - 6} centerY={top + PLOT_H / 2} />
      </g>
      <g className="crt-figure__axis">
        <line x1={left} x2={left} y1={top - 6} y2={base} />
        <line x1={left} x2={left + plotW} y1={base} y2={base} />
        {spec.categories.map((_, index) => (
          <line key={index} x1={cx(index)} x2={cx(index)} y1={base} y2={base + 5} />
        ))}
        {/* Con valores negativos, el cero se marca: es la referencia para leer la gráfica */}
        {axis.min < 0 && axis.max > 0 && <line x1={left} x2={left + plotW} y1={y(0)} y2={y(0)} />}
      </g>
      {!spec.blank && (
        <g>
          {series.map((items, s) => (
            <polyline key={s} points={items.map((value, index) => `${cx(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ")} fill="none" stroke={figureColor(s).stroke} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((items, s) => items.map((value, index) => <Marker key={`${s}-${index}`} shape={s} cx={cx(index)} cy={y(value)} color={figureColor(s).stroke} />))}
        </g>
      )}
      {!spec.blank && spec.showValues && (
        <g className="crt-figure__text crt-figure__text--strong">
          {values.map(value =>
            value ? (
              <text key={value.key} x={value.x} y={value.y} textAnchor="middle" {...TEXT_HALO}>
                {value.text}
              </text>
            ) : null,
          )}
        </g>
      )}
    </FigureFrame>
  );
});

/* ───────────────────────── Diagrama de dispersión ───────────────────────── */

const SCATTER_W = 460;
const SCATTER_H = 250;
const TREND_COLOR = "#1F5FE0";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Diagrama de dispersión. Los puntos no se unen; la recta de tendencia, si se pide, se calcula
 * por mínimos cuadrados a partir de ellos. Con `blank` quedan los ejes para ubicar los puntos.
 */
export const ScatterPlot = memo(function ScatterPlot({ spec }: { spec: ScatterPlotSpec }) {
  const clipId = useId();
  const view = useMemo(() => {
    const xs = spec.points.map(point => point.x);
    const ys = spec.points.map(point => point.y);
    const xAxis = resolveAxis(Math.min(...xs), Math.max(...xs), { min: spec.xMin, max: spec.xMax, step: spec.xStep }, 8);
    const yAxis = resolveAxis(Math.min(...ys), Math.max(...ys), { min: spec.yMin, max: spec.yMax, step: spec.yStep });
    const xTicks = axisTicks(xAxis);
    const yTicks = axisTicks(yAxis);
    const left = leftMargin(yTicks, Boolean(spec.yLabel));
    const top = figureTitleHeight(spec.title) + 10;
    const plotW = SCATTER_W - left - 22;
    const sx = (value: number) => left + ((value - xAxis.min) / (xAxis.max - xAxis.min)) * plotW;
    const sy = (value: number) => top + SCATTER_H - ((value - yAxis.min) / (yAxis.max - yAxis.min)) * SCATTER_H;
    const height = top + SCATTER_H + 22 + (spec.xLabel ? 22 : 4);
    const every = Math.max(1, Math.ceil((Math.max(...xTicks.map(tick => formatNumberEs(tick).length)) * CHAR_W + 8) / (plotW / Math.max(1, xTicks.length - 1))));

    const line = spec.trendLine && !spec.blank ? linearRegression(spec.points) : null;
    const labels: FigureLabel[] = [];
    let equationBox: Box | null = null;
    if (line && spec.showEquation) {
      // La ecuación va en la esquina del plano con menos puntos y por donde no pasa la recta
      const latex = trendLineLatex(line);
      const w = latex.replace(/[{}]/g, "").length * 7.6 + 14;
      const h = 22;
      const inset = 8;
      const corner = (atRight: boolean, atBottom: boolean): { box: Box; label: FigureLabel } => {
        const box = { x: atRight ? left + plotW - inset - w : left + inset, y: atBottom ? top + SCATTER_H - inset - h : top + inset, w, h };
        return { box, label: { x: atRight ? box.x + w : box.x, y: box.y + h / 2, anchor: atRight ? "right" : "left", latex } };
      };
      // Una recta creciente deja libres la esquina superior izquierda y la inferior derecha
      const order = line.slope >= 0 ? [corner(false, false), corner(true, true), corner(true, false), corner(false, true)] : [corner(true, false), corner(false, true), corner(false, false), corner(true, true)];
      const cost = ({ box }: { box: Box }) => {
        let total = 0;
        for (const point of spec.points) {
          const px = sx(point.x);
          const py = sy(point.y);
          if (px > box.x - 6 && px < box.x + box.w + 6 && py > box.y - 6 && py < box.y + box.h + 6) total += 10;
        }
        for (let i = 0; i <= 24; i++) {
          const px = box.x + (box.w * i) / 24;
          const py = sy(line.slope * (xAxis.min + ((px - left) / plotW) * (xAxis.max - xAxis.min)) + line.intercept);
          if (py > box.y - 3 && py < box.y + box.h + 3) {
            total += 4;
            break;
          }
        }
        return total;
      };
      let best = order[0];
      let bestCost = cost(best);
      for (const candidate of order.slice(1)) {
        const value = cost(candidate);
        if (value < bestCost) {
          best = candidate;
          bestCost = value;
        }
      }
      labels.push(best.label);
      equationBox = best.box;
    }
    return { xAxis, yAxis, xTicks, yTicks, left, top, plotW, sx, sy, height, every, line, labels, equationBox };
  }, [spec]);

  const { xAxis, xTicks, yTicks, left, top, plotW, sx, sy, height, every, line, labels, equationBox } = view;
  const base = top + SCATTER_H;
  const description = `Diagrama de dispersión${spec.title ? ` «${spec.title}»` : ""}${spec.xLabel && spec.yLabel ? ` de ${spec.yLabel} según ${spec.xLabel}` : ""}${
    spec.blank ? ", en blanco para ubicar los puntos" : `: ${spec.points.map(point => `(${formatNumberEs(point.x)}; ${formatNumberEs(point.y)})`).join(", ")}`
  }.${line ? ` Recta de tendencia ${trendLineText(line)}.` : ""}`;

  return (
    <FigureFrame width={SCATTER_W} height={height} description={description} labels={labels}>
      <defs>
        <clipPath id={clipId}>
          <rect x={left} y={top} width={plotW} height={SCATTER_H} />
        </clipPath>
      </defs>
      <FigureTitle text={spec.title} width={SCATTER_W} />
      <g className="crt-figure__grid">
        {xTicks.map(tick => (
          <line key={`x${tick}`} x1={sx(tick)} x2={sx(tick)} y1={top} y2={base} />
        ))}
        {yTicks.map(tick => (
          <line key={`y${tick}`} x1={left} x2={left + plotW} y1={sy(tick)} y2={sy(tick)} />
        ))}
      </g>
      {/* La ecuación se lee sobre blanco, no sobre la cuadrícula */}
      {equationBox && <rect x={equationBox.x - 2} y={equationBox.y} width={equationBox.w + 4} height={equationBox.h} rx={3} fill="#FFFFFF" fillOpacity={0.92} />}
      <g className="crt-figure__text">
        {yTicks.map(tick => (
          <text key={tick} x={left - 8} y={sy(tick) + 4} textAnchor="end">
            {formatNumberEs(tick)}
          </text>
        ))}
        {xTicks.map((tick, index) =>
          index % every === 0 ? (
            <text key={tick} x={sx(tick)} y={base + 17} textAnchor="middle">
              {formatNumberEs(tick)}
            </text>
          ) : null,
        )}
        <AxisNames xLabel={spec.xLabel} yLabel={spec.yLabel} centerX={left + plotW / 2} bottom={height - 6} centerY={top + SCATTER_H / 2} />
      </g>
      <g className="crt-figure__axis">
        <line x1={left} x2={left} y1={top - 6} y2={base} />
        <line x1={left} x2={left + plotW + 6} y1={base} y2={base} />
        {xTicks.map(tick => (
          <line key={tick} x1={sx(tick)} x2={sx(tick)} y1={base} y2={base + 5} />
        ))}
      </g>
      {line && (
        <line
          clipPath={`url(#${clipId})`}
          x1={sx(xAxis.min)}
          y1={sy(line.slope * xAxis.min + line.intercept)}
          x2={sx(xAxis.max)}
          y2={sy(line.slope * xAxis.max + line.intercept)}
          stroke={TREND_COLOR}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      )}
      {!spec.blank && (
        <g className="crt-figure__points">
          {spec.points.map((point, index) => (
            <circle key={index} cx={sx(point.x)} cy={sy(point.y)} r={4.2} />
          ))}
        </g>
      )}
    </FigureFrame>
  );
});

import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { niceMax, niceStep, pieAngles, roundPercents, tickValues, wrapLabel } from "@shared/creatorFigures";
import { formatNumber } from "@shared/creatorMath";
import { FigureFrame, figureColor } from "./FigureFrame";

type BarChartSpec = Extract<BlockInput, { type: "bar_chart" }>;
type PieChartSpec = Extract<BlockInput, { type: "pie_chart" }>;

const WIDTH = 520;

/** Diagrama de barras. Con `blank` quedan los ejes y las categorías para que el estudiante trace las barras. */
export const BarChart = memo(function BarChart({ spec }: { spec: BarChartSpec }) {
  const view = useMemo(() => {
    const highest = Math.max(0, ...spec.bars.map(bar => bar.value));
    const step = spec.yStep ?? niceStep(spec.yMax ?? (highest || 10));
    const yMax = Math.max(spec.yMax ?? niceMax(highest || step * 5, step), step);
    const titleHeight = spec.title ? 30 : 8;
    const left = 46 + (spec.yLabel ? 20 : 0);
    const top = titleHeight + 12;
    const plotW = WIDTH - left - 16;
    const plotH = 196;
    const band = plotW / spec.bars.length;
    const barW = Math.min(band * 0.62, 66);
    const y = (value: number) => top + plotH - (value / yMax) * plotH;
    const bars = spec.bars.map((bar, index) => ({
      ...bar,
      cx: left + band * index + band / 2,
      top: y(Math.min(bar.value, yMax)),
      lines: wrapLabel(bar.label, Math.max(6, Math.floor(band / 6.6))),
    }));
    const labelLines = Math.max(...bars.map(bar => bar.lines.length));
    const height = top + plotH + 14 + labelLines * 14 + (spec.xLabel ? 22 : 6);
    return { step, yMax, titleHeight, left, top, plotW, plotH, barW, y, bars, labelLines, height, ticks: tickValues(0, yMax, step) };
  }, [spec]);

  const { left, top, plotW, plotH, barW, y, bars, height, ticks } = view;
  const description = `Diagrama de barras${spec.title ? ` «${spec.title}»` : ""}: ${spec.bars.map(bar => (spec.blank ? bar.label : `${bar.label} ${formatNumber(bar.value)}`)).join(", ")}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      {spec.title && (
        <text x={WIDTH / 2} y={20} textAnchor="middle" className="crt-figure__title">
          {spec.title}
        </text>
      )}
      <g className="crt-figure__grid">
        {ticks.map(tick => (
          <line key={tick} x1={left} x2={left + plotW} y1={y(tick)} y2={y(tick)} />
        ))}
      </g>
      <g className="crt-figure__text">
        {ticks.map(tick => (
          <text key={tick} x={left - 8} y={y(tick) + 4} textAnchor="end">
            {formatNumber(tick)}
          </text>
        ))}
        {bars.map((bar, index) =>
          bar.lines.map((line, lineIndex) => (
            <text key={`${index}-${lineIndex}`} x={bar.cx} y={top + plotH + 16 + lineIndex * 14} textAnchor="middle">
              {line}
            </text>
          )),
        )}
        {spec.xLabel && (
          <text x={left + plotW / 2} y={height - 6} textAnchor="middle" className="crt-figure__axis-name">
            {spec.xLabel}
          </text>
        )}
        {spec.yLabel && (
          <text transform={`translate(14 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="crt-figure__axis-name">
            {spec.yLabel}
          </text>
        )}
      </g>
      {!spec.blank && (
        <g>
          {bars.map((bar, index) => (
            <rect key={index} x={bar.cx - barW / 2} y={bar.top} width={barW} height={Math.max(0, top + plotH - bar.top)} fill={figureColor(0).fill} stroke={figureColor(0).stroke} strokeWidth={1.4} />
          ))}
        </g>
      )}
      {!spec.blank && spec.showValues && (
        <g className="crt-figure__text crt-figure__text--strong">
          {bars.map((bar, index) => (
            <text key={index} x={bar.cx} y={bar.top - 6} textAnchor="middle">
              {formatNumber(bar.value)}
            </text>
          ))}
        </g>
      )}
      <g className="crt-figure__axis">
        <line x1={left} x2={left} y1={top - 6} y2={top + plotH} />
        <line x1={left} x2={left + plotW} y1={top + plotH} y2={top + plotH} />
      </g>
    </FigureFrame>
  );
});

function sectorPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  // Un sector de 360° no se puede trazar con un solo arco
  if (end - start >= 359.999) return `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  return `M${cx} ${cy} L${point(start)} A${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${point(end)} Z`;
}

/** Diagrama circular. Los porcentajes se calculan de los valores y siempre suman 100. */
export const PieChart = memo(function PieChart({ spec }: { spec: PieChartSpec }) {
  const view = useMemo(() => {
    const values = spec.slices.map(slice => slice.value);
    return { angles: pieAngles(values), percents: roundPercents(values) };
  }, [spec.slices]);

  const titleHeight = spec.title ? 30 : 8;
  const radius = 92;
  const cx = 116;
  const cy = titleHeight + radius + 8;
  const rowHeight = 24;
  const legendTop = cy - (spec.slices.length * rowHeight) / 2 + 6;
  const height = Math.max(cy + radius + 12, legendTop + spec.slices.length * rowHeight + 6);
  const description = `Diagrama circular${spec.title ? ` «${spec.title}»` : ""}: ${spec.slices.map((slice, index) => (spec.blank ? slice.label : `${slice.label} ${view.percents[index]} %`)).join(", ")}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      {spec.title && (
        <text x={WIDTH / 2} y={20} textAnchor="middle" className="crt-figure__title">
          {spec.title}
        </text>
      )}
      {spec.blank ? (
        <g className="crt-figure__axis">
          <circle cx={cx} cy={cy} r={radius} fill="#FFFFFF" />
          <circle cx={cx} cy={cy} r={2.4} className="crt-figure__dot" />
          {Array.from({ length: 36 }, (_, index) => {
            const rad = ((index * 10 - 90) * Math.PI) / 180;
            const inner = radius - (index % 9 === 0 ? 10 : 5);
            return <line key={index} x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)} x2={cx + radius * Math.cos(rad)} y2={cy + radius * Math.sin(rad)} />;
          })}
        </g>
      ) : (
        <g>
          {view.angles.map((angle, index) => (
            <path key={index} d={sectorPath(cx, cy, radius, angle.start, angle.end)} fill={figureColor(index).fill} stroke="#111B24" strokeWidth={1.2} strokeLinejoin="round" />
          ))}
          {spec.showPercent && (
            <g className="crt-figure__text crt-figure__text--strong">
              {view.angles.map((angle, index) => {
                if (view.percents[index] < 6) return null;
                const rad = (((angle.start + angle.end) / 2 - 90) * Math.PI) / 180;
                return (
                  <text key={index} x={cx + radius * 0.62 * Math.cos(rad)} y={cy + radius * 0.62 * Math.sin(rad) + 4} textAnchor="middle">
                    {view.percents[index]} %
                  </text>
                );
              })}
            </g>
          )}
        </g>
      )}
      <g className="crt-figure__text">
        {spec.slices.map((slice, index) => (
          <g key={index}>
            <rect x={250} y={legendTop + index * rowHeight - 11} width={14} height={14} rx={3} fill={spec.blank ? "#FFFFFF" : figureColor(index).fill} stroke="#111B24" strokeWidth={1} />
            <text x={272} y={legendTop + index * rowHeight + 1}>
              {slice.label}
              {!spec.blank && spec.showPercent ? ` (${view.percents[index]} %)` : ""}
            </text>
          </g>
        ))}
      </g>
    </FigureFrame>
  );
});

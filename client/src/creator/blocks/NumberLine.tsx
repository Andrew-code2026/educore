import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { fractionLatex, tickValues } from "@shared/creatorFigures";
import { formatNumber } from "@shared/creatorMath";
import { FigureFrame, type FigureLabel } from "./FigureFrame";

type NumberLineSpec = Extract<BlockInput, { type: "number_line" }>;

const WIDTH = 560;
const PAD_X = 36;

/** Recta numérica con marcas, puntos y saltos en arco para sumas y restas. */
export const NumberLine = memo(function NumberLine({ spec }: { spec: NumberLineSpec }) {
  const view = useMemo(() => {
    const span = spec.max - spec.min;
    if (!(span > 0)) return null;
    const hasJumps = spec.jumps.length > 0;
    const hasPointLabels = spec.points.some(point => point.label);
    // Una recta sin puntos ni saltos es para que el estudiante trabaje: deja sitio para dibujar los arcos
    const blank = !hasJumps && spec.points.length === 0;
    const lineY = hasJumps ? 108 : hasPointLabels ? 62 : blank ? 58 : 34;
    const fraction = spec.fractionDenominator;
    const height = lineY + (spec.showNumbers ? (fraction ? 58 : 34) : 20);
    const x = (value: number) => PAD_X + ((value - spec.min) / span) * (WIDTH - 2 * PAD_X);

    const marks = tickValues(spec.min, spec.max, spec.step).map((value, index) => ({ value, x: x(value), labelled: index % spec.labelEvery === 0 }));
    const labels: FigureLabel[] = [];
    if (spec.showNumbers && fraction) {
      for (const mark of marks) if (mark.labelled) labels.push({ x: mark.x, y: lineY + 13, anchor: "top", latex: fractionLatex(mark.value, fraction) });
    }
    for (const point of spec.points) {
      if (!point.label) continue;
      // Donde llega o sale un salto, el rótulo sube para no quedar encima de la punta de la flecha
      const touchesJump = spec.jumps.some(jump => Math.abs(jump.from - point.value) < 1e-9 || Math.abs(jump.to - point.value) < 1e-9);
      labels.push({ x: x(point.value), y: lineY - (touchesJump ? 22 : 12), anchor: "bottom", latex: point.label, tone: "point" });
    }

    const jumps = spec.jumps.map(jump => {
      const x1 = x(jump.from);
      const x2 = x(jump.to);
      const base = lineY - 9;
      const rise = Math.min(58, 18 + Math.abs(x2 - x1) * 0.28);
      const mid = (x1 + x2) / 2;
      // El arco es una curva cuadrática: su punto más alto queda a media altura del punto de control
      const peak = base - rise / 2;
      // La punta de la flecha sigue la tangente del arco al llegar
      const angle = Math.atan2(base - (base - rise), x2 - mid);
      const head = [-150, 150].map(turn => {
        const a = angle + (turn * Math.PI) / 180;
        return `${(x2 + 8 * Math.cos(a)).toFixed(1)},${(base + 8 * Math.sin(a)).toFixed(1)}`;
      });
      if (jump.label) labels.push({ x: mid, y: peak - 5, anchor: "bottom", latex: jump.label, tone: "b" });
      return { d: `M${x1.toFixed(1)} ${base} Q${mid.toFixed(1)} ${base - rise} ${x2.toFixed(1)} ${base}`, head: `${x2.toFixed(1)},${base} ${head.join(" ")}` };
    });

    return { lineY, height, x, marks, labels, jumps, fraction };
  }, [spec]);

  if (!view) return <div className="crt-figure crt-figure--invalid">Rango de la recta no válido.</div>;
  const { lineY, height, x, marks, labels, jumps, fraction } = view;
  const points = spec.points.map(point => `${formatNumber(point.value)}`).join(", ");
  const description = `Recta numérica de ${formatNumber(spec.min)} a ${formatNumber(spec.max)}${points ? `. Puntos marcados: ${points}` : ""}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description} labels={labels}>
      <g className="crt-figure__axis">
        <line x1={PAD_X - 18} x2={WIDTH - PAD_X + 18} y1={lineY} y2={lineY} />
        <path d={`M${WIDTH - PAD_X + 25} ${lineY} l-8 -4 v8 z`} />
        <path d={`M${PAD_X - 25} ${lineY} l8 -4 v8 z`} />
        {marks.map(mark => (
          <line key={mark.value} x1={mark.x} x2={mark.x} y1={lineY - (mark.labelled ? 7 : 4)} y2={lineY + (mark.labelled ? 7 : 4)} />
        ))}
      </g>
      {spec.showNumbers && !fraction && (
        <g className="crt-figure__text">
          {marks.map(mark =>
            mark.labelled ? (
              <text key={mark.value} x={mark.x} y={lineY + 24} textAnchor="middle">
                {formatNumber(mark.value, 3)}
              </text>
            ) : null,
          )}
        </g>
      )}
      <g className="crt-figure__jumps">
        {jumps.map((jump, index) => (
          <g key={index}>
            <path d={jump.d} />
            <polygon points={jump.head} />
          </g>
        ))}
      </g>
      <g className="crt-figure__points">
        {spec.points.map((point, index) => (
          <circle key={index} cx={x(point.value)} cy={lineY} r={5} />
        ))}
      </g>
    </FigureFrame>
  );
});

import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { angleText, unitCircleLayout } from "@shared/creatorUnitCircle";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type UnitCircleSpec = Extract<BlockInput, { type: "unit_circle" }>;

const INK = "#111B24";
const ARROW = 7;

/**
 * Círculo unitario (shared/creatorUnitCircle.ts): ejes, circunferencia, los ángulos notables marcados
 * con sus coordenadas exactas y, si se pide, un ángulo resaltado con su arco de giro y su triángulo de
 * referencia. La disposición ya decidió dónde va cada rótulo; aquí solo se dibuja.
 */
export const UnitCircle = memo(function UnitCircle({ spec }: { spec: UnitCircleSpec }) {
  const layout = useMemo(() => unitCircleLayout(spec), [spec]);
  const { center: c, radius: r, axis, highlight } = layout;
  const labels: FigureLabel[] = layout.labels.map(label => ({ x: label.x, y: label.y, latex: label.latex }));
  const accent = figureColor(0);
  const turn = figureColor(1);

  const shown = spec.highlight ? ` con el ángulo ${angleText(spec.highlight.degrees, spec.unit)} resaltado${spec.highlight.triangle ? " y su triángulo de referencia" : ""}` : "";
  const description = `Círculo unitario${shown}; ${spec.showAngles ? "con los ángulos" : "sin los ángulos"} y ${spec.showCoordinates ? "con las coordenadas" : "sin las coordenadas"} de los puntos marcados.`;

  return (
    <FigureFrame width={layout.width} height={layout.height} description={description} labels={labels}>
      <g className="crt-figure__axis">
        <line x1={c.x - axis} y1={c.y} x2={c.x + axis - ARROW} y2={c.y} />
        <line x1={c.x} y1={c.y + axis} x2={c.x} y2={c.y - axis + ARROW} />
        <path d={`M${c.x + axis} ${c.y} l${-ARROW - 2} -4 v8 Z`} />
        <path d={`M${c.x} ${c.y - axis} l-4 ${ARROW + 2} h8 Z`} />
      </g>
      <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={INK} strokeWidth={1.6} />
      {highlight && (
        <g transform={`translate(${c.x} ${c.y})`}>
          {highlight.foot && (
            <polygon
              points={`0,0 ${(highlight.foot.x - c.x).toFixed(2)},0 ${(highlight.point.x - c.x).toFixed(2)},${(highlight.point.y - c.y).toFixed(2)}`}
              fill={accent.fill}
              stroke={accent.stroke}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          )}
          {highlight.right && <path d={highlight.right} className="crt-figure__mark" />}
          {highlight.reference && <path d={highlight.reference} fill="none" stroke={INK} strokeWidth={1.2} />}
          <line x1={0} y1={0} x2={highlight.point.x - c.x} y2={highlight.point.y - c.y} stroke={accent.stroke} strokeWidth={2.4} strokeLinecap="round" />
          <path d={highlight.rotation} fill="none" stroke={turn.stroke} strokeWidth={1.5} />
          <path d={highlight.arrow} fill={turn.stroke} />
        </g>
      )}
      {layout.points.map(point => (
        <circle key={point.degrees} cx={point.x} cy={point.y} r={3.2} className="crt-figure__dot" />
      ))}
      {highlight && <circle cx={highlight.point.x} cy={highlight.point.y} r={4.6} fill="#D92D20" stroke="#FFFFFF" strokeWidth={1.5} />}
      <circle cx={c.x} cy={c.y} r={2.4} className="crt-figure__dot" />
    </FigureFrame>
  );
});

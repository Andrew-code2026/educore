import { memo, useMemo, type ReactNode } from "react";
import type { BlockInput } from "@shared/creator";
import { wholesNeeded } from "@shared/creatorFigures";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type FractionModelSpec = Extract<BlockInput, { type: "fraction_model" }>;

const RADIUS = 44;
const OPERATOR_GAP = 46;
const WHOLE_GAP = 12;
const BAR_HEIGHT = 38;
const OPERATORS = { none: "", equals: "=", plus: "+", compare: "" } as const;

/** Sector de círculo entre dos ángulos, medidos desde las 12 en sentido horario. */
function sector(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx} ${cy} L${point(startDeg)} A${r} ${r} 0 ${large} 1 ${point(endDeg)} Z`;
}

const defaultLabel = (model: FractionModelSpec["models"][number]) => model.label ?? `\\frac{${model.numerator}}{${model.denominator}}`;

function describe(spec: FractionModelSpec): string {
  const fractions = spec.models.map(model => `${model.numerator}/${model.denominator}`).join(spec.operator === "plus" ? " más " : spec.operator === "equals" ? " igual a " : ", ");
  return `Modelo de fracciones en ${spec.shape === "circle" ? "círculos" : "barras"}: ${fractions}.`;
}

/**
 * Fracciones como partes sombreadas de un entero. Una fracción mayor que uno ocupa
 * varios enteros seguidos, así también sirve para números mixtos.
 */
export const FractionModel = memo(function FractionModel({ spec }: { spec: FractionModelSpec }) {
  const view = useMemo(() => {
    const shapes: ReactNode[] = [];
    const labels: FigureLabel[] = [];
    const signs: Array<{ x: number; y: number; compare: boolean }> = [];
    const labelSpace = spec.showLabels ? 50 : 8;

    if (spec.shape === "circle") {
      const top = 10;
      const cy = top + RADIUS;
      let cursor = 14;
      spec.models.forEach((model, index) => {
        const wholes = wholesNeeded(model.numerator, model.denominator);
        const groupStart = cursor;
        const color = figureColor(index);
        for (let whole = 0; whole < wholes; whole++) {
          const cx = cursor + RADIUS;
          const shaded = Math.max(0, Math.min(model.denominator, model.numerator - whole * model.denominator));
          if (model.denominator === 1) {
            shapes.push(<circle key={`${index}-${whole}`} cx={cx} cy={cy} r={RADIUS} fill={shaded ? color.fill : "#FFFFFF"} className="crt-figure__outline" />);
          } else {
            const step = 360 / model.denominator;
            for (let part = 0; part < model.denominator; part++) {
              shapes.push(
                <path key={`${index}-${whole}-${part}`} d={sector(cx, cy, RADIUS, part * step, (part + 1) * step)} fill={part < shaded ? color.fill : "#FFFFFF"} className="crt-figure__outline" />,
              );
            }
          }
          cursor += RADIUS * 2 + (whole < wholes - 1 ? WHOLE_GAP : 0);
        }
        if (spec.showLabels) labels.push({ x: (groupStart + cursor) / 2, y: cy + RADIUS + 8, anchor: "top", latex: defaultLabel(model) });
        if (index < spec.models.length - 1) {
          if (spec.operator !== "none") signs.push({ x: cursor + OPERATOR_GAP / 2, y: cy, compare: spec.operator === "compare" });
          cursor += spec.operator === "none" ? 26 : OPERATOR_GAP;
        }
      });
      return { width: cursor + 14, height: top + RADIUS * 2 + labelSpace, shapes, labels, signs, vertical: false };
    }

    // Barras: un modelo por renglón, con el signo entre renglones
    const left = 14;
    let y = 10;
    let widest = 0;
    spec.models.forEach((model, index) => {
      const wholes = wholesNeeded(model.numerator, model.denominator);
      const barWidth = wholes === 1 ? 250 : wholes === 2 ? 150 : 110;
      const color = figureColor(index);
      let cursor = left;
      for (let whole = 0; whole < wholes; whole++) {
        const shaded = Math.max(0, Math.min(model.denominator, model.numerator - whole * model.denominator));
        const part = barWidth / model.denominator;
        for (let i = 0; i < model.denominator; i++) {
          shapes.push(<rect key={`${index}-${whole}-${i}`} x={cursor + i * part} y={y} width={part} height={BAR_HEIGHT} fill={i < shaded ? color.fill : "#FFFFFF"} className="crt-figure__outline" />);
        }
        cursor += barWidth + (whole < wholes - 1 ? WHOLE_GAP : 0);
      }
      if (spec.showLabels) labels.push({ x: cursor + 14, y: y + BAR_HEIGHT / 2, anchor: "left", latex: defaultLabel(model) });
      widest = Math.max(widest, cursor);
      y += BAR_HEIGHT;
      if (index < spec.models.length - 1) {
        if (spec.operator !== "none") signs.push({ x: left + 125, y: y + 17, compare: spec.operator === "compare" });
        y += spec.operator === "none" ? 14 : 34;
      }
    });
    return { width: widest + (spec.showLabels ? 76 : 14), height: y + 10, shapes, labels, signs, vertical: true };
  }, [spec]);

  return (
    <FigureFrame width={view.width} height={view.height} description={describe(spec)} labels={view.labels}>
      {view.shapes}
      {view.signs.map((sign, index) =>
        sign.compare ? (
          <circle key={index} cx={sign.x} cy={sign.y} r={13} className="crt-figure__blank" />
        ) : (
          <text key={index} x={sign.x} y={sign.y + 8} textAnchor="middle" className="crt-figure__sign">
            {OPERATORS[spec.operator]}
          </text>
        ),
      )}
    </FigureFrame>
  );
});

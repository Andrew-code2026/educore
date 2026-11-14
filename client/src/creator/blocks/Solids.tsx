import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { pointsPath, SOLID_NAMES, solidLayout } from "@shared/creatorSolids";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type SolidSpec = Extract<BlockInput, { type: "solid" }>;

const INK = "#111B24";
const fmt = (value: number) => value.toFixed(2);
const width = (stroke: { thin?: boolean; hidden: boolean }) => (stroke.thin ? 1.1 : stroke.hidden ? 1.2 : 1.6);

/**
 * Sólidos (shared/creatorSolids.ts): los poliedros en perspectiva caballera con las caras que se ven
 * rellenas y las aristas ocultas punteadas; el cilindro, el cono y la esfera de frente, con sus bases
 * como elipses. Aquí solo se dibuja lo que la disposición ya decidió.
 */
export const Solids = memo(function Solids({ spec }: { spec: SolidSpec }) {
  const layout = useMemo(() => solidLayout(spec), [spec]);
  const labels: FigureLabel[] = layout.labels.map(label => ({ x: label.x, y: label.y, latex: label.latex }));
  const shown = layout.labels.map(label => label.plain);
  const description = `${spec.solids.length > 1 ? "Sólidos" : "Sólido"}: ${spec.solids.map(solid => SOLID_NAMES[solid.kind]).join(", ")}${shown.length > 0 ? `; medidas: ${shown.join(", ")}` : ""}.`;

  return (
    <FigureFrame width={layout.width} height={layout.height} description={description} labels={labels}>
      {layout.drawings.map((drawing, index) => {
        const color = figureColor(index);
        return (
          <g key={index} strokeLinejoin="round" strokeLinecap="round">
            {drawing.strokes.map((stroke, i) => {
              if (stroke.kind === "face") return <polygon key={i} points={stroke.points.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(" ")} fill={color.fill} fillOpacity={stroke.shade} stroke="none" />;
              if (stroke.kind === "line") {
                return <line key={i} x1={stroke.from.x} y1={stroke.from.y} x2={stroke.to.x} y2={stroke.to.y} stroke={INK} strokeWidth={width(stroke)} strokeDasharray={stroke.hidden ? "5 4" : undefined} />;
              }
              return (
                <path
                  key={i}
                  d={pointsPath(stroke.points, stroke.closed)}
                  fill={stroke.fill !== undefined ? color.fill : "none"}
                  fillOpacity={stroke.fill}
                  stroke={INK}
                  strokeWidth={width(stroke)}
                  strokeDasharray={stroke.hidden ? "5 4" : undefined}
                />
              );
            })}
            {drawing.rightMarks.map((mark, i) => (
              <path key={`r${i}`} d={pointsPath(mark)} className="crt-figure__mark" />
            ))}
            {drawing.dots.map((dot, i) => (
              <circle key={`d${i}`} cx={dot.x} cy={dot.y} r={2.2} fill={INK} />
            ))}
          </g>
        );
      })}
      {layout.labels.map((label, i) =>
        label.leader ? <line key={`l${i}`} x1={label.leader[0].x} y1={label.leader[0].y} x2={label.leader[1].x} y2={label.leader[1].y} stroke="#36404A" strokeWidth={0.9} /> : null,
      )}
    </FigureFrame>
  );
});

import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { markPath, triangleLayout } from "@shared/creatorTriangle";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type TriangleSpec = Extract<BlockInput, { type: "triangle" }>;

const INK = "#111B24";

/**
 * Triángulos resueltos por el sistema (shared/creatorTriangle.ts): a escala, con la base abajo, el
 * ángulo recto marcado y cada lado y ángulo con su medida, su rótulo o nada. Aquí solo se dibuja lo
 * que la disposición ya decidió; lo que no cabe lo rechaza el validador antes.
 */
export const Triangle = memo(function Triangle({ spec }: { spec: TriangleSpec }) {
  const layout = useMemo(() => triangleLayout(spec), [spec]);
  if (!layout) return <div className="crt-figure crt-figure--invalid">Revisa los datos del triángulo: con ellos no se puede construir.</div>;

  const labels: FigureLabel[] = layout.labels.map(label => ({ x: label.x, y: label.y, latex: label.latex }));
  // Lo que se lee en la figura, sin las medidas que el estudiante debe hallar
  const names = spec.triangles.map(data => (data.vertices.every(Boolean) ? data.vertices.join("") : "")).filter(Boolean);
  const shown = layout.labels.filter(label => label.kind !== "vertex").map(label => label.plain);
  const description = `${spec.triangles.length > 1 ? "Triángulos" : "Triángulo"}${names.length > 0 ? ` ${names.join(" y ")}` : ""}${shown.length > 0 ? `; rótulos: ${shown.join(", ")}` : ""}.`;

  return (
    <FigureFrame width={layout.width} height={layout.height} description={description} labels={labels}>
      {layout.drawings.map((drawing, index) => (
        <g key={index}>
          <polygon points={drawing.points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")} fill={figureColor(index === 0 ? 0 : 2).fill} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          {drawing.marks.map(mark =>
            mark.right ? (
              <path key={mark.vertex} d={markPath(mark)} className="crt-figure__mark" />
            ) : (
              <path key={mark.vertex} d={markPath(mark)} fill={figureColor(1).fill} stroke={figureColor(1).stroke} strokeWidth={1.2} strokeLinejoin="round" />
            ),
          )}
          {/* Los lados se repasan encima de los arcos: el sector no tapa el trazo */}
          <polygon points={drawing.points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      ))}
      {layout.labels.map((label, index) =>
        label.leader ? <line key={index} x1={label.leader[0].x} y1={label.leader[0].y} x2={label.leader[1].x} y2={label.leader[1].y} stroke="#36404A" strokeWidth={0.9} /> : null,
      )}
    </FigureFrame>
  );
});

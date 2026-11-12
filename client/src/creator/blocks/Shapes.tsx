import { memo, useMemo, type ReactNode } from "react";
import { SHAPE_KIND_LABELS, type BlockInput, type ShapeFigure } from "@shared/creator";
import { placeSideLabels, type SideLabelPlacement } from "@shared/creatorFigures";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type ShapesSpec = Extract<BlockInput, { type: "shapes" }>;
type BalanceSpec = Extract<BlockInput, { type: "balance" }>;

/** Lado mayor, en píxeles, de la figura más grande. */
const CELL = 150;
const PAD = { left: 50, right: 22, top: 20, bottom: 36 };
/** Margen mínimo alrededor de un polígono; crece lo necesario para que quepan sus rótulos. */
const POLYGON_PAD = { left: 22, right: 22, top: 20, bottom: 36 };
const LABEL_GAP = 4;

function extent(figure: ShapeFigure): { w: number; h: number; minX: number; minY: number } {
  switch (figure.kind) {
    case "rectangle":
      return { w: figure.width, h: figure.height, minX: 0, minY: 0 };
    case "triangle":
      return { w: figure.base, h: figure.height, minX: 0, minY: 0 };
    case "circle":
      return { w: figure.radius * 2, h: figure.radius * 2, minX: 0, minY: 0 };
    case "polygon": {
      const xs = figure.vertices.map(vertex => vertex.x);
      const ys = figure.vertices.map(vertex => vertex.y);
      return { w: Math.max(...xs) - Math.min(...xs) || 1, h: Math.max(...ys) - Math.min(...ys) || 1, minX: Math.min(...xs), minY: Math.min(...ys) };
    }
  }
}

/** Figuras geométricas con sus medidas. Con `toScale` todas comparten escala y se pueden comparar a ojo. */
export const Shapes = memo(function Shapes({ spec }: { spec: ShapesSpec }) {
  const view = useMemo(() => {
    const extents = spec.figures.map(extent);
    const shared = CELL / Math.max(...extents.map(e => Math.max(e.w, e.h)));
    const sized = spec.figures.map((figure, index) => {
      const e = extents[index];
      const scale = spec.toScale ? shared : CELL / Math.max(e.w, e.h);
      const w = Math.max(e.w * scale, 18);
      const h = Math.max(e.h * scale, 18);
      if (figure.kind !== "polygon") return { figure, e, scale, w, h, pad: PAD, points: [], sides: [] as SideLabelPlacement[] };
      // Vértices y rótulos relativos a la esquina superior izquierda de la figura; el margen sale de los rótulos
      const points = figure.vertices.map(vertex => ({ x: (vertex.x - e.minX) * scale, y: h - (vertex.y - e.minY) * scale }));
      const sides = placeSideLabels(points, figure.sideLabels);
      const pad = { ...POLYGON_PAD };
      for (const { box } of sides) {
        pad.left = Math.max(pad.left, LABEL_GAP - box.x);
        pad.right = Math.max(pad.right, box.x + box.w - w + LABEL_GAP);
        pad.top = Math.max(pad.top, LABEL_GAP - box.y);
        pad.bottom = Math.max(pad.bottom, box.y + box.h - h + LABEL_GAP);
      }
      return { figure, e, scale, w, h, pad, points, sides };
    });
    const tallest = Math.max(...sized.map(item => item.h));
    // Las figuras comparten la línea de base: el margen de arriba y el de abajo son los del que más pide
    const baseline = Math.max(...sized.map(item => item.pad.top - (tallest - item.h))) + tallest;
    const bottom = Math.max(...sized.map(item => item.pad.bottom));
    const shapes: ReactNode[] = [];
    const labels: FigureLabel[] = [];
    const label = (md: string | undefined, x: number, y: number, anchor: FigureLabel["anchor"]) => {
      if (md) labels.push({ md, x, y, anchor });
    };

    let cursor = 0;
    sized.forEach(({ figure, w, h, pad, points: local, sides }, index) => {
      const ox = cursor + pad.left;
      const oy = baseline - h;
      const color = figureColor(index);
      const common = { fill: color.fill, stroke: "#111B24", strokeWidth: 1.6, strokeLinejoin: "round" as const };

      if (figure.kind === "rectangle") {
        shapes.push(<rect key={index} x={ox} y={oy} width={w} height={h} {...common} />);
        label(figure.widthLabel, ox + w / 2, baseline + 7, "top");
        label(figure.heightLabel, ox - 9, oy + h / 2, "right");
      } else if (figure.kind === "triangle") {
        const cx = ox + figure.apex * w;
        shapes.push(<polygon key={index} points={`${ox},${baseline} ${ox + w},${baseline} ${cx},${oy}`} {...common} />);
        const atCorner = figure.apex <= 0.001 || figure.apex >= 0.999;
        if (figure.showHeight || atCorner) {
          // La marca de ángulo recto va hacia el lado con más espacio
          const dir = figure.apex >= 0.999 ? -1 : figure.apex <= 0.001 ? 1 : figure.apex > 0.5 ? -1 : 1;
          if (!atCorner) shapes.push(<line key={`${index}-h`} x1={cx} y1={oy} x2={cx} y2={baseline} className="crt-figure__dashed" />);
          shapes.push(<path key={`${index}-r`} d={`M${cx + dir * 9} ${baseline} v-9 h${-dir * 9}`} className="crt-figure__mark" />);
        }
        label(figure.baseLabel, ox + w / 2, baseline + 7, "top");
        if (figure.apex <= 0.001) label(figure.heightLabel, ox - 9, oy + h / 2, "right");
        else if (figure.apex >= 0.999) label(figure.heightLabel, ox + w + 9, oy + h / 2, "left");
        else if (figure.apex > 0.5) label(figure.heightLabel, cx - 7, oy + h * 0.55, "right");
        else label(figure.heightLabel, cx + 7, oy + h * 0.55, "left");
      } else if (figure.kind === "circle") {
        const r = w / 2;
        const cx = ox + r;
        const cy = oy + r;
        shapes.push(<circle key={index} cx={cx} cy={cy} r={r} {...common} />);
        if (figure.show !== "none") {
          shapes.push(<line key={`${index}-l`} x1={figure.show === "diameter" ? cx - r : cx} y1={cy} x2={cx + r} y2={cy} className="crt-figure__segment" />);
          shapes.push(<circle key={`${index}-c`} cx={cx} cy={cy} r={2.4} className="crt-figure__dot" />);
          label(figure.label, figure.show === "diameter" ? cx : cx + r / 2, cy - 6, "bottom");
        } else {
          label(figure.label, cx, baseline + 7, "top");
        }
      } else {
        const points = local.map(point => ({ x: ox + point.x, y: oy + point.y }));
        shapes.push(<polygon key={index} points={points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")} {...common} />);
        for (const side of sides) label(figure.sideLabels[side.side], ox + side.x, oy + side.y, side.anchor);
      }
      cursor += pad.left + w + pad.right;
    });

    return { width: Math.max(cursor, 160), height: baseline + bottom, shapes, labels };
  }, [spec]);

  const description = `Figuras geométricas: ${spec.figures.map(figure => SHAPE_KIND_LABELS[figure.kind].toLowerCase()).join(", ")}.`;
  return (
    <FigureFrame width={view.width} height={view.height} description={description} labels={view.labels}>
      {view.shapes}
    </FigureFrame>
  );
});

const BALANCE_WIDTH = 460;
const VARIABLE_ROW = 32;
const UNIT_ROW = 23;

/** Alto de la pila de un platillo: tres incógnitas o cinco unidades por renglón. */
const stackHeight = (side: BalanceSpec["left"]) => Math.ceil(side.variables / 3) * VARIABLE_ROW + Math.ceil(side.units / 5) * UNIT_ROW + 3;

/** Fichas de un platillo, apiladas desde la bandeja hacia arriba: primero las incógnitas, luego las unidades. */
function trayItems(cx: number, trayY: number, variables: number, units: number, variable: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let y = trayY - 3;
  const row = (count: number, pitch: number, draw: (x: number, index: number) => ReactNode) => {
    const start = cx - (count * pitch) / 2 + pitch / 2;
    for (let i = 0; i < count; i++) nodes.push(draw(start + i * pitch, nodes.length));
  };
  for (let remaining = variables; remaining > 0; remaining -= 3) {
    const count = Math.min(3, remaining);
    const top = y - 28;
    row(count, 34, (x, index) => (
      <g key={`${keyPrefix}v${index}`}>
        <rect x={x - 14} y={top} width={28} height={28} rx={4} fill={figureColor(0).fill} stroke="#111B24" strokeWidth={1.4} />
        <text x={x} y={top + 19} textAnchor="middle" className="crt-figure__variable">
          {variable}
        </text>
      </g>
    ));
    y = top - 4;
  }
  for (let remaining = units; remaining > 0; remaining -= 5) {
    const count = Math.min(5, remaining);
    const cy = y - 10;
    row(count, 23, (x, index) => (
      <g key={`${keyPrefix}u${index}`}>
        <circle cx={x} cy={cy} r={10} fill={figureColor(4).fill} stroke="#111B24" strokeWidth={1.3} />
        <text x={x} y={cy + 4} textAnchor="middle" className="crt-figure__unit">
          1
        </text>
      </g>
    ));
    y = cy - 13;
  }
  return nodes;
}

const describeSide = (side: BalanceSpec["left"], variable: string) =>
  [side.variables ? `${side.variables} ${variable}` : "", side.units ? `${side.units} unidades` : ""].filter(Boolean).join(" y ") || "nada";

/** Balanza en equilibrio para plantear ecuaciones: cuadros para la incógnita y fichas de valor 1. */
export const Balance = memo(function Balance({ spec }: { spec: BalanceSpec }) {
  // La altura sale de la pila más alta: una balanza con pocas fichas no deja un hueco encima
  const width = BALANCE_WIDTH;
  const trayY = 12 + Math.max(stackHeight(spec.left), stackHeight(spec.right), VARIABLE_ROW);
  const beamY = trayY + 12;
  const height = beamY + 60;
  const sides = [
    { cx: 126, side: spec.left, key: "l" },
    { cx: 334, side: spec.right, key: "r" },
  ];
  const description = `Balanza en equilibrio: a la izquierda ${describeSide(spec.left, spec.variable)}; a la derecha ${describeSide(spec.right, spec.variable)}.`;
  return (
    <FigureFrame width={width} height={height} description={description}>
      <polygon points={`${width / 2},${beamY + 4} ${width / 2 - 30},${height - 8} ${width / 2 + 30},${height - 8}`} className="crt-figure__solid" />
      <rect x={56} y={beamY} width={width - 112} height={7} rx={3.5} className="crt-figure__solid" />
      {sides.map(({ cx, side, key }) => (
        <g key={key}>
          <line x1={cx} x2={cx} y1={trayY} y2={beamY} className="crt-figure__segment" />
          <path d={`M${cx - 66} ${trayY - 9} V${trayY} H${cx + 66} V${trayY - 9}`} className="crt-figure__tray" />
          {trayItems(cx, trayY, side.variables, side.units, spec.variable, key)}
        </g>
      ))}
    </FigureFrame>
  );
});

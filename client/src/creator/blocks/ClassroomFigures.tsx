import { memo, useId, useMemo, type ReactNode } from "react";
import type { BlockInput } from "@shared/creator";
import { baseTenValue, clockAngles, clockText, formatProbability, pictogramIcons, treePaths, vennRegionName, vennRegionsFor, vennZoneChars, type VennRegion } from "@shared/creatorDiagrams";
import { wrapLabel } from "@shared/creatorFigures";
import { formatNumberEs } from "@shared/creatorMath";
import { FigureFrame, FigureTitle, figureColor, figureTitleHeight, TEXT_HALO, type FigureLabel } from "./FigureFrame";

type AngleSpec = Extract<BlockInput, { type: "angle" }>;
type VennSpec = Extract<BlockInput, { type: "venn" }>;
type TreeSpec = Extract<BlockInput, { type: "tree_diagram" }>;
type BarModelSpec = Extract<BlockInput, { type: "bar_model" }>;
type PictogramSpec = Extract<BlockInput, { type: "pictogram" }>;
type ClockSpec = Extract<BlockInput, { type: "clock" }>;
type BaseTenSpec = Extract<BlockInput, { type: "base_ten" }>;

const INK = "#111B24";
const WIDTH = 520;
/** Ancho medio de un carácter de los rótulos de 12 px. */
const CHAR_W = 6.8;

/** Texto en uno o dos renglones, centrado en vertical sobre `y`. */
function Lines({ lines, x, y, anchor = "middle", className }: { lines: string[]; x: number; y: number; anchor?: "start" | "middle" | "end"; className?: string }) {
  return (
    <>
      {lines.map((line, index) => (
        <text key={index} x={x} y={y + 4 + (index - (lines.length - 1) / 2) * 14} textAnchor={anchor} className={className}>
          {line}
        </text>
      ))}
    </>
  );
}

/* ───────────────────────── Ángulos ───────────────────────── */

const RAY = 84;
const ARC = 26;
const PROTRACTOR_R = 112;

/** Ángulos con su arco y su medida; con `protractor`, un transportador sobre cada uno para medirlo. */
export const Angle = memo(function Angle({ spec }: { spec: AngleSpec }) {
  const view = useMemo(() => {
    const reach = spec.protractor ? PROTRACTOR_R + 20 : RAY;
    // Cada ángulo ocupa lo que mide su dibujo: uno obtuso necesita sitio a la izquierda del vértice
    const items = spec.angles.map(angle => {
      const rad = (angle.degrees * Math.PI) / 180;
      const measure = `${formatNumberEs(angle.degrees)}°`;
      // Con rótulo y medida van los dos: «α = 45°» es lo que espera una clave de respuestas
      const named = Boolean(angle.label) && spec.showMeasures;
      const text = angle.label ? (named ? `${angle.label} = ${measure}` : angle.label) : spec.showMeasures ? measure : "";
      const w = Math.max(2, text.replace(/[$\\{}]/g, "").length) * 7.4 + 8;
      // En un ángulo cerrado el rótulo se aleja del vértice para no montarse en los lados
      const labelR = ARC + (angle.degrees < 35 ? 34 : 19) + (named ? w / 4 : 0);
      // «α = 45°» no cabe dentro de la abertura sin pisar un lado o el transportador: va bajo la base, que está libre hasta 180°
      const label = named && angle.degrees <= 180 ? { x: ARC + 6, y: -17, w } : { x: labelR * Math.cos(rad / 2), y: labelR * Math.sin(rad / 2), w };
      const xs = [0, reach, reach * Math.cos(rad), ...(text ? [label.x - label.w / 2, label.x + label.w / 2] : []), ...(spec.protractor ? [-PROTRACTOR_R - 4, PROTRACTOR_R + 4] : [])];
      const ys = [0, reach * Math.sin(rad), ...(angle.degrees > 180 ? [-ARC] : []), ...(text ? [label.y - 11, label.y + 11] : []), ...(spec.protractor ? [PROTRACTOR_R + 4] : [])];
      return { angle, rad, text, label, minX: Math.min(...xs) - 12, maxX: Math.max(...xs) + 12, minY: Math.min(...ys) - 10, maxY: Math.max(...ys) + 10 };
    });
    const baseY = Math.max(...items.map(item => item.maxY)) + 4;
    const height = baseY - Math.min(...items.map(item => item.minY)) + 4;
    let cursor = 10;
    const placed = items.map(item => {
      const vx = cursor - item.minX;
      cursor += item.maxX - item.minX + 14;
      return { ...item, vx };
    });
    const labels: FigureLabel[] = placed.filter(item => item.text).map(item => ({ x: item.vx + item.label.x, y: baseY - item.label.y, md: item.text }));
    return { placed, baseY, height, width: Math.max(cursor - 4, 180), reach, labels };
  }, [spec]);

  const { placed, baseY, height, width, reach, labels } = view;
  const description = `${spec.angles.length === 1 ? "Ángulo" : "Ángulos"}${spec.showMeasures ? ` de ${spec.angles.map(angle => `${formatNumberEs(angle.degrees)}°`).join(", ")}` : " para medir"}${spec.protractor ? ", con transportador" : ""}.`;

  return (
    <FigureFrame width={width} height={height} description={description} labels={labels}>
      {placed.map(({ angle, rad, vx }, index) => {
        const end = (r: number) => `${(vx + r * Math.cos(rad)).toFixed(2)} ${(baseY - r * Math.sin(rad)).toFixed(2)}`;
        const right = Math.abs(angle.degrees - 90) < 1e-9;
        return (
          <g key={index}>
            {spec.protractor && <Protractor cx={vx} cy={baseY} />}
            {right ? (
              <path d={`M${vx + 15} ${baseY} V${baseY - 15} H${vx}`} fill="none" stroke={INK} strokeWidth={1.3} />
            ) : (
              <path
                d={`M${vx} ${baseY} L${vx + ARC} ${baseY} A${ARC} ${ARC} 0 ${angle.degrees > 180 ? 1 : 0} 0 ${end(ARC)} Z`}
                fill={figureColor(index).fill}
                fillOpacity={spec.protractor ? 0.75 : 1}
                stroke={figureColor(index).stroke}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
            )}
            <g className="crt-figure__segment">
              <line x1={vx} y1={baseY} x2={vx + reach} y2={baseY} strokeLinecap="round" />
              <line x1={vx} y1={baseY} x2={vx + reach * Math.cos(rad)} y2={baseY - reach * Math.sin(rad)} strokeLinecap="round" />
            </g>
            <circle cx={vx} cy={baseY} r={2.8} className="crt-figure__dot" />
          </g>
        );
      })}
    </FigureFrame>
  );
});

/** Transportador de 0° a 180°, con marca cada 5° y número cada 10°. El cero queda sobre el lado horizontal del ángulo. */
function Protractor({ cx, cy }: { cx: number; cy: number }) {
  const R = PROTRACTOR_R;
  const at = (degrees: number, r: number) => {
    const rad = (degrees * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };
  return (
    <g>
      <path d={`M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} Z`} fill="#F4F7FB" stroke="#5D656E" strokeWidth={1.2} />
      <path d={`M${cx - R + 30} ${cy} A${R - 30} ${R - 30} 0 0 1 ${cx + R - 30} ${cy}`} fill="none" stroke="#B9C2CC" strokeWidth={0.8} />
      {Array.from({ length: 37 }, (_, index) => {
        const degrees = index * 5;
        const outer = at(degrees, R);
        const inner = at(degrees, R - (degrees % 10 === 0 ? 9 : 5));
        return <line key={degrees} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#36404A" strokeWidth={degrees % 10 === 0 ? 1 : 0.7} />;
      })}
      <g className="crt-figure__text">
        {Array.from({ length: 19 }, (_, index) => {
          const degrees = index * 10;
          const point = at(degrees, R - 18);
          return (
            <text key={degrees} x={point.x} y={point.y + (degrees % 180 === 0 ? -4 : 3)} textAnchor="middle" style={{ fontSize: 8 }}>
              {degrees}
            </text>
          );
        })}
      </g>
    </g>
  );
}

/* ───────────────────────── Diagrama de Venn ───────────────────────── */

const VENN_W = 440;
const SHADE = "#CFE0FF";

/** Diagrama de Venn de dos o tres conjuntos. Cada zona lleva su contenido y puede sombrearse. */
export const Venn = memo(function Venn({ spec }: { spec: VennSpec }) {
  const uid = useId();
  const three = spec.sets.length >= 3;
  const names = spec.sets.map(name => wrapLabel(name, 16));
  const r = three ? 74 : 84;
  const dx = three ? 46 : 52;
  const cx = VENN_W / 2;
  const frameTop = figureTitleHeight(spec.title) + 2;
  const top = frameTop + 10 + Math.max(names[0].length, names[1].length) * 14;
  const cy = top + r;
  const circles = [
    { x: cx - dx, y: cy },
    { x: cx + dx, y: cy },
    ...(three ? [{ x: cx, y: cy + 80 }] : []),
  ];
  const lowest = three ? cy + 80 + r : cy + r;
  const frameBottom = lowest + (three ? 12 + names[2].length * 14 : 0) + 16;
  const frame = { x: 26, y: frameTop, w: VENN_W - 52, h: frameBottom - frameTop };
  const outside = spec.regions.find(item => item.region === "outside");
  const universe = Boolean(spec.universe) || Boolean(outside?.text) || Boolean(outside?.shaded);
  const height = frameBottom + 8;

  // Centro de cada zona; cuánto texto cabe en cada una lo dice vennZoneChars, que también usa el validador
  const spots: Partial<Record<VennRegion, { x: number; y: number }>> = three
    ? {
        a: { x: cx - dx - 30, y: cy - 22 },
        b: { x: cx + dx + 30, y: cy - 22 },
        c: { x: cx, y: cy + 116 },
        ab: { x: cx, y: cy - 30 },
        ac: { x: cx - 44, y: cy + 52 },
        bc: { x: cx + 44, y: cy + 52 },
        abc: { x: cx, y: cy + 24 },
      }
    : { a: { x: cx - dx - 36, y: cy }, b: { x: cx + dx + 36, y: cy }, ab: { x: cx, y: cy } };
  const zones = vennRegionsFor(spec.sets.length);
  const regions = spec.regions.filter(item => zones.includes(item.region));
  const shaded = regions.filter(item => item.shaded);
  const members = (region: VennRegion) => (region === "outside" ? [] : Array.from(region).map(letter => "abc".indexOf(letter)));

  const description = `Diagrama de Venn${spec.title ? ` «${spec.title}»` : ""} de ${spec.sets.join(", ")}${
    regions.some(item => item.text)
      ? `: ${regions
          .filter(item => item.text)
          .map(item => `${vennRegionName(item.region, spec.sets)}, ${item.text}`)
          .join("; ")}`
      : ""
  }${shaded.length > 0 ? `. Zonas sombreadas: ${shaded.map(item => vennRegionName(item.region, spec.sets)).join("; ")}` : ""}.`;

  return (
    <FigureFrame width={VENN_W} height={height} description={description}>
      <defs>
        {circles.map((circle, index) => (
          <clipPath key={index} id={`${uid}c${index}`}>
            <circle cx={circle.x} cy={circle.y} r={r} />
          </clipPath>
        ))}
        {shaded.map(item => (
          <mask key={item.region} id={`${uid}m${item.region}`} maskUnits="userSpaceOnUse" x={0} y={0} width={VENN_W} height={height}>
            <rect x={0} y={0} width={VENN_W} height={height} fill="#FFFFFF" />
            {circles.map((circle, index) => (members(item.region).includes(index) ? null : <circle key={index} cx={circle.x} cy={circle.y} r={r} fill="#000000" />))}
          </mask>
        ))}
      </defs>
      <FigureTitle text={spec.title} width={VENN_W} />
      {/* Una zona es lo que queda dentro de sus conjuntos y fuera de los demás */}
      {shaded.map(item => {
        let node: ReactNode = <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill={SHADE} mask={`url(#${uid}m${item.region})`} />;
        for (const index of members(item.region)) node = <g clipPath={`url(#${uid}c${index})`}>{node}</g>;
        return <g key={item.region}>{node}</g>;
      })}
      {universe && <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={6} fill="none" stroke={INK} strokeWidth={1.4} />}
      {circles.map((circle, index) => (
        <circle key={index} cx={circle.x} cy={circle.y} r={r} fill="none" stroke={figureColor(index).stroke} strokeWidth={1.8} />
      ))}
      <g className="crt-figure__text crt-figure__text--strong">
        {names.slice(0, 2).map((lines, index) =>
          lines.map((line, at) => (
            <text key={`${index}-${at}`} x={circles[index].x + (index === 0 ? -26 : 26)} y={top - 8 - (lines.length - 1 - at) * 14} textAnchor="middle">
              {line}
            </text>
          )),
        )}
        {three &&
          names[2].map((line, at) => (
            <text key={`c-${at}`} x={cx} y={lowest + 16 + at * 14} textAnchor="middle">
              {line}
            </text>
          ))}
        {spec.universe && (
          <text x={frame.x + 10} y={frame.y + frame.h - 9}>
            {spec.universe}
          </text>
        )}
      </g>
      <g className="crt-figure__text">
        {regions.map(item => {
          if (!item.text) return null;
          if (item.region === "outside") {
            return (
              <text key="outside" x={frame.x + frame.w - 10} y={frame.y + frame.h - 9} textAnchor="end" className="crt-figure__axis-name">
                {item.text}
              </text>
            );
          }
          const spot = spots[item.region];
          return spot ? <Lines key={item.region} lines={wrapLabel(item.text, vennZoneChars(item.region, spec.sets.length))} x={spot.x} y={spot.y} className="crt-figure__axis-name" /> : null;
        })}
      </g>
    </FigureFrame>
  );
});

/* ───────────────────────── Diagrama de árbol ───────────────────────── */

const TREE_ROW = 30;

interface TreeLayoutNode {
  label: string;
  probability?: string;
  level: number;
  y: number;
  parent: TreeLayoutNode | null;
}

/** Diagrama de árbol de hasta tres niveles. La probabilidad de cada camino se calcula multiplicando las de sus ramas. */
export const TreeDiagram = memo(function TreeDiagram({ spec }: { spec: TreeSpec }) {
  const view = useMemo(() => {
    const nodes: TreeLayoutNode[] = [];
    const leaves: TreeLayoutNode[] = [];
    let row = 0;
    const place = (node: { label: string; probability?: string; children?: Array<{ label: string; probability?: string; children?: unknown[] }> }, level: number, parent: TreeLayoutNode | null): TreeLayoutNode => {
      const placed: TreeLayoutNode = { label: node.label, probability: node.probability, level, y: 0, parent };
      nodes.push(placed);
      const children = (node.children ?? []) as Array<typeof node>;
      if (children.length === 0) {
        placed.y = 10 + TREE_ROW / 2 + row++ * TREE_ROW;
        leaves.push(placed);
      } else {
        const ys = children.map(child => place(child, level + 1, placed).y);
        placed.y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      return placed;
    };
    const first = spec.branches.map(branch => place(branch, 0, null));
    const depth = Math.max(...nodes.map(node => node.level)) + 1;
    const labelW = Array.from({ length: depth }, (_, level) => Math.min(175, Math.max(...nodes.filter(node => node.level === level).map(node => node.label.length)) * CHAR_W + 10));
    const rootW = spec.root ? spec.root.length * CHAR_W + 8 : 8;
    const resultW = spec.showResults ? 64 : 0;
    // Las ramas se reparten el ancho que dejan los rótulos; si no alcanza, la figura se ensancha
    const fixed = 12 + rootW + labelW.reduce((sum, value) => sum + value, 0) + resultW + 12;
    const edge = Math.max(58, (WIDTH - fixed) / depth);
    const width = Math.max(fixed + edge * depth, 240);
    const xs: number[] = [];
    let cursor = 12 + rootW;
    for (let level = 0; level < depth; level++) {
      cursor += edge;
      xs.push(cursor);
      cursor += labelW[level];
    }
    const rootY = (first[0].y + first[first.length - 1].y) / 2;
    return { nodes, leaves, xs, labelW, rootW, rootY, width, height: row * TREE_ROW + 20, resultX: width - resultW - 4 };
  }, [spec]);

  const { nodes, leaves, xs, labelW, rootW, rootY, width, height, resultX } = view;
  const paths = treePaths(spec.branches);
  const description = `Diagrama de árbol${spec.root ? ` desde «${spec.root}»` : ""}: ${paths
    .map(path => `${path.labels.join(", ")}${spec.showResults && path.probability ? ` (${formatProbability(path.probability)})` : ""}`)
    .join("; ")}.`;

  return (
    <FigureFrame width={width} height={height} description={description}>
      <g className="crt-figure__segment">
        {nodes.map((node, index) => {
          const x1 = node.parent ? xs[node.parent.level] + labelW[node.parent.level] : 12 + rootW;
          const y1 = node.parent ? node.parent.y : rootY;
          return <line key={index} x1={x1} y1={y1} x2={xs[node.level] - 3} y2={node.y} />;
        })}
      </g>
      {spec.root ? (
        <g className="crt-figure__text">
          <text x={12} y={rootY + 4} className="crt-figure__axis-name">
            {spec.root}
          </text>
        </g>
      ) : (
        <circle cx={12 + rootW - 3} cy={rootY} r={3} className="crt-figure__dot" />
      )}
      <g className="crt-figure__text">
        {nodes.map((node, index) => (
          <text key={index} x={xs[node.level] + 3} y={node.y + 4} className="crt-figure__axis-name">
            {node.label}
          </text>
        ))}
      </g>
      <g className="crt-figure__text crt-figure__text--strong">
        {nodes.map((node, index) => {
          if (!node.probability) return null;
          const x1 = node.parent ? xs[node.parent.level] + labelW[node.parent.level] : 12 + rootW;
          const y1 = node.parent ? node.parent.y : rootY;
          const x2 = xs[node.level] - 3;
          // Algo más cerca de la punta que del origen, y por fuera del abanico: encima de la rama que sube y debajo de la que baja
          return (
            <text key={index} x={x1 + (x2 - x1) * 0.58} y={y1 + (node.y - y1) * 0.58 + (node.y > y1 + 0.5 ? 14 : -5)} textAnchor="middle" {...TEXT_HALO}>
              {node.probability.replace(".", ",")}
            </text>
          );
        })}
        {spec.showResults &&
          leaves.map((leaf, index) => {
            const probability = paths[index]?.probability;
            return probability ? (
              <text key={`r${index}`} x={resultX} y={leaf.y + 4}>
                = {formatProbability(probability)}
              </text>
            ) : null;
          })}
      </g>
    </FigureFrame>
  );
});

/* ───────────────────────── Modelo de barras ───────────────────────── */

const BAR_H = 36;

/** Modelo de barras: cada barra se parte en trozos a escala; una llave marca el total. */
export const BarModel = memo(function BarModel({ spec }: { spec: BarModelSpec }) {
  const view = useMemo(() => {
    const names = spec.bars.map(bar => (bar.label ? wrapLabel(bar.label, 12) : []));
    const longest = Math.max(0, ...names.flat().map(line => line.length));
    const left = 14 + (longest > 0 ? Math.min(100, longest * CHAR_W + 14) : 0);
    const barW = WIDTH - left - 16;
    const totals = spec.bars.map(bar => bar.parts.reduce((sum, part) => sum + part.value, 0));
    // Todas las barras comparten escala: así se pueden comparar a simple vista
    const scale = barW / Math.max(...totals);
    let cursor = 8;
    const rows = spec.bars.map((bar, index) => {
      const y = cursor + (bar.total ? 30 : 0);
      cursor = y + BAR_H + 16;
      let x = left;
      const parts = bar.parts.map(part => {
        const w = part.value * scale;
        const placed = { x, w, text: part.label ?? formatNumberEs(part.value) };
        x += w;
        return placed;
      });
      return { y, parts, end: x, name: names[index], total: bar.total };
    });
    return { left, rows, height: cursor - 6 };
  }, [spec]);

  const { left, rows, height } = view;
  const description = `Modelo de barras: ${spec.bars
    .map(bar => `${bar.label ? `${bar.label}, ` : ""}partes ${bar.parts.map(part => part.label ?? formatNumberEs(part.value)).join(" y ")}${bar.total ? `, total ${bar.total}` : ""}`)
    .join("; ")}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      {rows.map((row, index) => (
        <g key={index}>
          {row.parts.map((part, at) => (
            <rect key={at} x={part.x} y={row.y} width={part.w} height={BAR_H} fill={figureColor(index).fill} stroke={INK} strokeWidth={1.4} />
          ))}
          <g className="crt-figure__text crt-figure__text--strong">
            {row.parts.map((part, at) => (
              <text key={at} x={part.x + part.w / 2} y={row.y + BAR_H / 2 + 4.5} textAnchor="middle" style={{ fontSize: 13 }}>
                {part.text}
              </text>
            ))}
            {row.total && (
              <text x={(left + row.end) / 2} y={row.y - 15} textAnchor="middle" style={{ fontSize: 13 }}>
                {row.total}
              </text>
            )}
          </g>
          {row.total && <path d={`M${left} ${row.y - 5} V${row.y - 11} H${row.end} V${row.y - 5}`} fill="none" stroke={INK} strokeWidth={1.3} />}
          <g className="crt-figure__text">
            <Lines lines={row.name} x={left - 10} y={row.y + BAR_H / 2} anchor="end" className="crt-figure__axis-name" />
          </g>
        </g>
      ))}
    </FigureFrame>
  );
});

/* ───────────────────────── Pictograma ───────────────────────── */

const ICON_PITCH = 30;
const ICON_ROW = 34;

function iconShape(icon: PictogramSpec["icon"], cx: number, cy: number): ReactNode {
  switch (icon) {
    case "square":
      return <rect x={cx - 9.5} y={cy - 9.5} width={19} height={19} rx={3} />;
    case "star": {
      const points = Array.from({ length: 10 }, (_, index) => {
        const radius = index % 2 === 0 ? 11.5 : 4.8;
        const rad = (index * 36 - 90) * (Math.PI / 180);
        return `${(cx + radius * Math.cos(rad)).toFixed(2)},${(cy + 1 + radius * Math.sin(rad)).toFixed(2)}`;
      });
      return <polygon points={points.join(" ")} />;
    }
    case "heart":
      return <path d={`M${cx} ${cy + 9.5} C${cx - 15} ${cy - 1} ${cx - 8} ${cy - 12} ${cx} ${cy - 4.5} C${cx + 8} ${cy - 12} ${cx + 15} ${cy - 1} ${cx} ${cy + 9.5} Z`} />;
    case "person":
      return (
        <>
          <circle cx={cx} cy={cy - 6.8} r={3.9} />
          <path d={`M${cx - 6.5} ${cy + 10.5} V${cy + 4} a6.5 6.5 0 0 1 13 0 V${cy + 10.5} Z`} />
        </>
      );
    default:
      return <circle cx={cx} cy={cy} r={10} />;
  }
}

/** Pictograma: el número de dibujos de cada fila se calcula de su cantidad y del valor de cada dibujo. */
export const Pictogram = memo(function Pictogram({ spec }: { spec: PictogramSpec }) {
  const uid = useId();
  const names = spec.rows.map(row => wrapLabel(row.label, 14));
  const left = 16 + Math.min(100, Math.max(...names.flat().map(line => line.length)) * CHAR_W + 14);
  const top = figureTitleHeight(spec.title) + 4;
  const bottom = top + spec.rows.length * ICON_ROW;
  const height = bottom + 40;
  const paint = { fill: figureColor(0).fill, stroke: figureColor(0).stroke, strokeWidth: 1.4, strokeLinejoin: "round" } as const;
  const key = `= ${formatNumberEs(spec.iconValue)}${spec.unit ? ` ${spec.unit}` : ""}`;
  const description = `Pictograma${spec.title ? ` «${spec.title}»` : ""}, cada dibujo vale ${formatNumberEs(spec.iconValue)}${spec.unit ? ` ${spec.unit}` : ""}: ${spec.rows
    .map(row => (spec.blank ? row.label : `${row.label} ${formatNumberEs(row.value)}`))
    .join(", ")}.`;

  return (
    <FigureFrame width={WIDTH} height={height} description={description}>
      <defs>
        {/* Medio dibujo: la mitad izquierda de su propia caja */}
        <clipPath id={`${uid}half`} clipPathUnits="objectBoundingBox">
          <rect x={0} y={0} width={0.5} height={1} />
        </clipPath>
      </defs>
      <FigureTitle text={spec.title} width={WIDTH} />
      <g className="crt-figure__grid">
        {spec.rows.map((_, index) => (
          <line key={index} x1={left} x2={WIDTH - 12} y1={top + (index + 1) * ICON_ROW} y2={top + (index + 1) * ICON_ROW} />
        ))}
      </g>
      <g className="crt-figure__text">
        {names.map((lines, index) => (
          <Lines key={index} lines={lines} x={left - 10} y={top + index * ICON_ROW + ICON_ROW / 2} anchor="end" className="crt-figure__axis-name" />
        ))}
        <text x={left + 34} y={bottom + 26} className="crt-figure__axis-name">
          {key}
        </text>
      </g>
      <g {...paint}>
        {!spec.blank &&
          spec.rows.map((row, index) => {
            const icons = pictogramIcons(row.value, spec.iconValue);
            const cy = top + index * ICON_ROW + ICON_ROW / 2;
            const x = (at: number) => left + 22 + at * ICON_PITCH;
            return (
              <g key={index}>
                {Array.from({ length: icons.full }, (_, at) => (
                  <g key={at}>{iconShape(spec.icon, x(at), cy)}</g>
                ))}
                {icons.half && (
                  <>
                    <g clipPath={`url(#${uid}half)`}>{iconShape(spec.icon, x(icons.full), cy)}</g>
                    {/* El corte se cierra con una raya que no se sale del dibujo */}
                    <clipPath id={`${uid}cut${index}`}>{iconShape(spec.icon, x(icons.full), cy)}</clipPath>
                    <line x1={x(icons.full)} x2={x(icons.full)} y1={cy - 14} y2={cy + 14} clipPath={`url(#${uid}cut${index})`} />
                  </>
                )}
              </g>
            );
          })}
        {iconShape(spec.icon, left + 16, bottom + 22)}
      </g>
      <g className="crt-figure__axis">
        <line x1={left} x2={left} y1={top} y2={bottom} />
      </g>
    </FigureFrame>
  );
});

/* ───────────────────────── Reloj ───────────────────────── */

const CLOCK_R = 54;
const CLOCK_CELL = 128;

/** Relojes analógicos. La manecilla de la hora avanza con los minutos, como en un reloj de verdad. */
export const Clock = memo(function Clock({ spec }: { spec: ClockSpec }) {
  const labelled = spec.clocks.some(clock => clock.label);
  const width = Math.max(spec.clocks.length * CLOCK_CELL + 8, 160);
  const cy = 8 + CLOCK_R;
  const height = cy + CLOCK_R + 10 + (labelled ? 18 : 0) + (spec.showTime ? 20 : 0);
  const offset = (width - spec.clocks.length * CLOCK_CELL) / 2;
  const description = `${spec.clocks.length === 1 ? "Reloj" : "Relojes"} ${
    spec.showHands ? `que ${spec.clocks.length === 1 ? "marca" : "marcan"} ${spec.clocks.map(clock => clockText(clock.hour, clock.minute)).join(", ")}` : "sin manecillas, para dibujarlas"
  }.`;

  return (
    <FigureFrame width={width} height={height} description={description}>
      {spec.clocks.map((clock, index) => {
        const cx = offset + index * CLOCK_CELL + CLOCK_CELL / 2;
        const tip = (degrees: number, length: number) => {
          const rad = (degrees * Math.PI) / 180;
          return { x: cx + length * Math.sin(rad), y: cy - length * Math.cos(rad) };
        };
        const angles = clockAngles(clock.hour, clock.minute);
        const hour = tip(angles.hour, CLOCK_R * 0.5);
        const minute = tip(angles.minute, CLOCK_R * 0.8);
        return (
          <g key={index}>
            <circle cx={cx} cy={cy} r={CLOCK_R} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
            {Array.from({ length: 60 }, (_, at) => {
              const outer = tip(at * 6, CLOCK_R - 1.5);
              const inner = tip(at * 6, CLOCK_R - (at % 5 === 0 ? 8 : 4.5));
              return <line key={at} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke={INK} strokeWidth={at % 5 === 0 ? 1.6 : 0.7} />;
            })}
            {spec.showHands && (
              <g stroke={INK} strokeLinecap="round">
                <line x1={cx} y1={cy} x2={hour.x} y2={hour.y} strokeWidth={3.6} />
                <line x1={cx} y1={cy} x2={minute.x} y2={minute.y} strokeWidth={2.2} />
              </g>
            )}
            {/* Los números van encima de las manecillas, con halo: el 12 se lee aunque el minutero lo cruce */}
            <g className="crt-figure__text crt-figure__text--strong">
              {Array.from({ length: 12 }, (_, at) => {
                const point = tip((at + 1) * 30, CLOCK_R - 17);
                return (
                  <text key={at} x={point.x} y={point.y + 4} textAnchor="middle" {...TEXT_HALO}>
                    {at + 1}
                  </text>
                );
              })}
            </g>
            <circle cx={cx} cy={cy} r={3.2} className="crt-figure__dot" />
            <g className="crt-figure__text">
              {clock.label && (
                <text x={cx} y={cy + CLOCK_R + 22} textAnchor="middle" className="crt-figure__axis-name">
                  {clock.label}
                </text>
              )}
              {spec.showTime && (
                <text x={cx} y={cy + CLOCK_R + 22 + (labelled ? 18 : 0)} textAnchor="middle" className="crt-figure__axis-name" style={{ fontSize: 14, fontWeight: 600 }}>
                  {clockText(clock.hour, clock.minute)}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </FigureFrame>
  );
});

/* ───────────────────────── Bloques de base 10 ───────────────────────── */

const UNIT = 9;
const FLAT = UNIT * 10;

function gridLines(x: number, y: number, columns: number, rows: number): ReactNode[] {
  const lines: ReactNode[] = [];
  for (let column = 1; column < columns; column++) lines.push(<line key={`v${column}`} x1={x + column * UNIT} x2={x + column * UNIT} y1={y} y2={y + rows * UNIT} />);
  for (let row = 1; row < rows; row++) lines.push(<line key={`h${row}`} x1={x} x2={x + columns * UNIT} y1={y + row * UNIT} y2={y + row * UNIT} />);
  return lines;
}

/** Bloques de base 10: placas de 100, barras de 10 y cubos de 1, todos a la misma escala. */
export const BaseTen = memo(function BaseTen({ spec }: { spec: BaseTenSpec }) {
  const view = useMemo(() => {
    const groups: Array<{ x: number; w: number; h: number; count: number; name: string; blocks: ReactNode }> = [];
    let cursor = 12;
    const top = 10;
    const add = (count: number, w: number, h: number, singular: string, plural: string, draw: (x: number) => ReactNode) => {
      if (count === 0) return;
      groups.push({ x: cursor, w, h, count, name: `${count} ${count === 1 ? singular : plural}`, blocks: draw(cursor) });
      cursor += w + 26;
    };
    // Placas en filas de tres, barras en filas de diez y cubos en columnas de cinco
    const flatColumns = Math.min(spec.hundreds, 3);
    add(spec.hundreds, flatColumns * (FLAT + 8) - 8, Math.ceil(spec.hundreds / 3) * (FLAT + 8) - 8, "centena", "centenas", x => (
      <g fill={figureColor(0).fill} stroke={figureColor(0).stroke}>
        {Array.from({ length: spec.hundreds }, (_, index) => {
          const fx = x + (index % 3) * (FLAT + 8);
          const fy = top + Math.floor(index / 3) * (FLAT + 8);
          return (
            <g key={index}>
              <rect x={fx} y={fy} width={FLAT} height={FLAT} strokeWidth={1.3} />
              <g strokeWidth={0.5}>{gridLines(fx, fy, 10, 10)}</g>
            </g>
          );
        })}
      </g>
    ));
    const rodColumns = Math.min(spec.tens, 10);
    add(spec.tens, rodColumns * 14 - 5, Math.ceil(spec.tens / 10) * (FLAT + 8) - 8, "decena", "decenas", x => (
      <g fill={figureColor(2).fill} stroke={figureColor(2).stroke}>
        {Array.from({ length: spec.tens }, (_, index) => {
          const rx = x + (index % 10) * 14;
          const ry = top + Math.floor(index / 10) * (FLAT + 8);
          return (
            <g key={index}>
              <rect x={rx} y={ry} width={UNIT} height={FLAT} strokeWidth={1.2} />
              <g strokeWidth={0.5}>{gridLines(rx, ry, 1, 10)}</g>
            </g>
          );
        })}
      </g>
    ));
    add(spec.ones, Math.ceil(spec.ones / 5) * 14 - 5, Math.min(spec.ones, 5) * 14 - 5, "unidad", "unidades", x => (
      <g fill={figureColor(4).fill} stroke={figureColor(4).stroke} strokeWidth={1.2}>
        {Array.from({ length: spec.ones }, (_, index) => (
          <rect key={index} x={x + Math.floor(index / 5) * 14} y={top + (index % 5) * 14} width={UNIT} height={UNIT} />
        ))}
      </g>
    ));
    const tallest = Math.max(UNIT, ...groups.map(group => group.h));
    const legend = groups.map(group => group.name).join(" · ");
    return { groups, legend, width: Math.max(cursor - 26 + 12, 160, spec.showNumber ? legend.length * CHAR_W + 24 : 0), blocksWidth: cursor - 26 + 12, bottom: top + tallest };
  }, [spec]);

  const { groups, legend, width, blocksWidth, bottom } = view;
  const total = baseTenValue(spec);
  const height = bottom + (spec.showNumber ? 50 : 10);
  const description = `Bloques de base 10: ${groups.map(group => group.name).join(", ") || "ninguno"}${spec.showNumber ? `. Forman el ${formatNumberEs(total)}` : ""}.`;

  return (
    <FigureFrame width={width} height={height} description={description}>
      <g transform={`translate(${(width - blocksWidth) / 2} 0)`}>
        {groups.map((group, index) => (
          <g key={index}>{group.blocks}</g>
        ))}
      </g>
      {spec.showNumber && (
        <g className="crt-figure__text">
          <text x={width / 2} y={bottom + 18} textAnchor="middle" className="crt-figure__axis-name">
            {legend}
          </text>
          <text x={width / 2} y={bottom + 42} textAnchor="middle" className="crt-figure__title" style={{ fontSize: 16 }}>
            {formatNumberEs(total)}
          </text>
        </g>
      )}
    </FigureFrame>
  );
});

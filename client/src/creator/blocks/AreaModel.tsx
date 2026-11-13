import { memo, useMemo } from "react";
import type { BlockInput } from "@shared/creator";
import { areaModelProduct, computeAreaModel, monomialText, polynomialText } from "@shared/creatorAlgebra";
import { FigureFrame, figureColor, type FigureLabel } from "./FigureFrame";

type AreaModelSpec = Extract<BlockInput, { type: "area_model" }>;

const INK = "#111B24";
const CELL_W = 108;
const CELL_H = 62;
/** Sitio de los términos de cada lado: a la izquierda de las filas y encima de las columnas. */
const LEFT = 72;
const TOP = 34;
/** Ancho medio de un carácter de la línea del área total. */
const CHAR_W = 8.2;

/** Un color por grado: los términos semejantes, que luego se suman, se reconocen a simple vista. */
const fillFor = (exp: number) => figureColor(exp >= 3 ? 3 : exp === 2 ? 0 : exp === 1 ? 2 : 4).fill;

/**
 * Modelo de área (método de la caja): un rectángulo partido según los términos de sus lados.
 * Cada celda es el producto de su fila por su columna y lo calcula el sistema. Con las celdas
 * ocultas el estudiante multiplica; con los lados ocultos, factoriza.
 */
export const AreaModel = memo(function AreaModel({ spec }: { spec: AreaModelSpec }) {
  const view = useMemo(() => {
    const model = computeAreaModel(spec.rows, spec.columns);
    if (!model) return null;
    const gridW = model.columns.length * CELL_W;
    const gridH = model.rows.length * CELL_H;
    const product = areaModelProduct(model, "latex");
    const total = polynomialText(model.total, "latex");
    // El total es la respuesta cuando el estudiante multiplica: ahí no se escribe
    const totalLine =
      !spec.showTotal || spec.hide === "cells" ? null : spec.hide === "dimensions" ? { md: `Área total: $${total}$`, chars: 12 + total.length } : { latex: `${product} = ${total}`, chars: product.length + total.length + 3 };
    const width = Math.max(LEFT + gridW + 20, totalLine ? totalLine.chars * CHAR_W * 0.8 + 24 : 0, 220);
    // Con un total más ancho que la caja, la caja se centra
    const left = Math.max(LEFT, (width - gridW + LEFT - 20) / 2);
    const height = TOP + gridH + 12 + (totalLine ? 34 : 0);

    const labels: FigureLabel[] = [];
    if (spec.hide !== "dimensions") {
      model.columns.forEach((term, column) => labels.push({ x: left + column * CELL_W + CELL_W / 2, y: TOP - 7, anchor: "bottom", latex: monomialText(term, "latex") }));
      model.rows.forEach((term, row) => labels.push({ x: left - 12, y: TOP + row * CELL_H + CELL_H / 2, anchor: "right", latex: monomialText(term, "latex") }));
    }
    if (spec.hide !== "cells") {
      model.cells.forEach((cells, row) =>
        cells.forEach((cell, column) => labels.push({ x: left + column * CELL_W + CELL_W / 2, y: TOP + row * CELL_H + CELL_H / 2, latex: monomialText(cell, "latex") })),
      );
    }
    if (totalLine) labels.push({ x: width / 2, y: TOP + gridH + 30, ...("latex" in totalLine ? { latex: totalLine.latex } : { md: totalLine.md }) });
    return { model, gridW, gridH, left, width, height, labels };
  }, [spec]);

  if (!view) return <div className="crt-figure crt-figure--invalid">Revisa los términos del modelo de área.</div>;

  const { model, gridW, gridH, left, width, height, labels } = view;
  const product = areaModelProduct(model);
  const description =
    spec.hide === "dimensions"
      ? `Modelo de área para factorizar: celdas ${model.cells.flat().map(cell => monomialText(cell)).join(", ")}; faltan las dimensiones.`
      : `Modelo de área de ${product}${spec.hide === "cells" ? ", con las celdas en blanco" : `: celdas ${model.cells.flat().map(cell => monomialText(cell)).join(", ")}; área total ${polynomialText(model.total)}`}.`;

  return (
    <FigureFrame width={width} height={height} description={description} labels={labels}>
      {model.cells.map((cells, row) =>
        cells.map((cell, column) => (
          <rect key={`${row}-${column}`} x={left + column * CELL_W} y={TOP + row * CELL_H} width={CELL_W} height={CELL_H} fill={spec.hide === "cells" ? "#FFFFFF" : fillFor(cell.exp)} stroke={INK} strokeWidth={1.2} />
        )),
      )}
      <rect x={left} y={TOP} width={gridW} height={gridH} fill="none" stroke={INK} strokeWidth={2} />
      {/* Sin dimensiones, una raya marca dónde las escribe el estudiante */}
      {spec.hide === "dimensions" && (
        <g className="crt-figure__dashed">
          {model.columns.map((_, column) => (
            <line key={`c${column}`} x1={left + column * CELL_W + CELL_W / 2 - 24} x2={left + column * CELL_W + CELL_W / 2 + 24} y1={TOP - 8} y2={TOP - 8} />
          ))}
          {model.rows.map((_, row) => (
            <line key={`r${row}`} x1={left - 58} x2={left - 12} y1={TOP + row * CELL_H + CELL_H / 2 + 9} y2={TOP + row * CELL_H + CELL_H / 2 + 9} />
          ))}
        </g>
      )}
    </FigureFrame>
  );
});

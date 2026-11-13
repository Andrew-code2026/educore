import { Fragment, memo, type CSSProperties, type ReactNode } from "react";
import type { Block, BlockOf, InnerBlock } from "@shared/creator";
import { formatTableNumber, valueTableDecimals } from "@shared/creatorPlane";
import { computeValueTable, valueTableVariable } from "@shared/creatorValidate";
import { AreaModel } from "./AreaModel";
import { BarChart, PieChart } from "./Charts";
import { Angle, BarModel, BaseTen, Clock, Pictogram, TreeDiagram, Venn } from "./ClassroomFigures";
import { CoordinatePlane } from "./CoordinatePlane";
import { Formula } from "./Formula";
import { FractionModel } from "./FractionModel";
import { NumberLine } from "./NumberLine";
import { RichText } from "./RichText";
import { Balance, Shapes } from "./Shapes";
import { BoxPlot, Histogram, LineChart, ScatterPlot } from "./StatCharts";

/** Una figura centrada con su pie. */
function Figure({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <figure className="crt-graph">
      {children}
      {caption && (
        <figcaption>
          <RichText md={caption} inline />
        </figcaption>
      )}
    </figure>
  );
}

/** Espacio para que el estudiante responda: renglones, cuadrícula o en blanco. */
export function AnswerSpace({ kind, lines }: { kind: BlockOf<"exercise">["answerSpace"]; lines: number }) {
  if (kind === "none") return null;
  if (kind === "lines") {
    return (
      <div className="crt-answer crt-answer--lines" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }
  return <div className={`crt-answer crt-answer--${kind}`} style={{ height: `${lines * 26}px` }} aria-hidden="true" />;
}

const escapeMarkdown = (text: string) => text.replace(/([\\*_$`])/g, "\\$1");

function ExerciseView({ block }: { block: BlockOf<"exercise"> }) {
  // El rótulo va dentro del mismo párrafo que el enunciado, y las fórmulas destacadas del enunciado conservan su línea propia
  const statement = `**${escapeMarkdown(block.label)}.** ${block.md}`;
  return (
    <div className="crt-exercise">
      <RichText md={statement} className="crt-exercise__text" />
      {block.parts.length > 0 && (
        <ol className="crt-exercise__parts">
          {block.parts.map((part, index) => (
            <li key={index}>
              <span className="crt-exercise__part-label">{part.label}.</span>
              <RichText md={part.md} inline />
            </li>
          ))}
        </ol>
      )}
      <AnswerSpace kind={block.answerSpace} lines={block.lines} />
    </div>
  );
}

function TableView({ block }: { block: BlockOf<"table"> }) {
  return (
    <figure className="crt-table">
      <table>
        <thead>
          <tr>
            {block.header.map((cell, index) => (
              <th key={index} scope="col">
                <RichText md={cell} inline />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) =>
                block.firstColumnHeader && index === 0 ? (
                  <th key={index} scope="row">
                    <RichText md={cell} inline />
                  </th>
                ) : (
                  <td key={index}>{cell ? <RichText md={cell} inline /> : " "}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {block.caption && (
        <figcaption>
          <RichText md={block.caption} inline />
        </figcaption>
      )}
    </figure>
  );
}

/** Tabla de valores: los resultados se calculan aquí desde la función, no vienen escritos. */
function ValueTableView({ block }: { block: BlockOf<"value_table"> }) {
  // La primera fila lleva la variable de la función: s en A(s) = 4000s + 20000, no siempre x
  const variable = valueTableVariable(block);
  const ys = computeValueTable(block.expr, block.xs, variable);
  // Cada número con los decimales que hagan falta: en una tabla para un límite, 1,999 no puede salir como 2
  const decimals = valueTableDecimals(block.xs);
  return (
    <figure className="crt-table crt-table--values">
      <table>
        <tbody>
          <tr>
            <th scope="row">
              <Formula latex={variable} />
            </th>
            {block.xs.map((x, index) => (
              <td key={index}>{formatTableNumber(x)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">
              <Formula latex={block.exprLatex} />
            </th>
            {ys.map((y, index) => (
              <td key={index}>{block.blankY ? " " : y === null ? "—" : formatTableNumber(y, decimals)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      {block.caption && (
        <figcaption>
          <RichText md={block.caption} inline />
        </figcaption>
      )}
    </figure>
  );
}

function SolutionView({ block }: { block: BlockOf<"solution"> }) {
  return (
    <div className="crt-solution">
      <strong className="crt-solution__label">{block.label}.</strong>
      {block.steps.length > 0 && (
        <ol className="crt-solution__steps">
          {block.steps.map((step, index) => (
            <li key={index}>
              <RichText md={step} />
            </li>
          ))}
        </ol>
      )}
      {block.answer && (
        <div className="crt-solution__answer">
          <span>Respuesta</span>
          <RichText md={block.answer} />
        </div>
      )}
    </div>
  );
}

interface ContainerViewProps {
  block: BlockOf<"columns" | "cards">;
  /** Dibuja cada bloque de dentro (en el editor, con sus controles). Sin esto, la vista de la hoja impresa. */
  renderInner?: (block: InnerBlock, cell: number) => ReactNode;
  /** El título de una tarjeta, editable en el editor. Sin esto, el título como texto. */
  renderCardTitle?: (cell: number, title: string | undefined) => ReactNode;
  /** Lo que va al final de cada celda en el editor (escribir en una celda vacía). */
  renderCellEnd?: (cell: number, blocks: readonly InnerBlock[]) => ReactNode;
}

/**
 * Columnas lado a lado o una rejilla de tarjetas, cada celda con su lista de bloques. Los anchos salen
 * del bloque (fracciones de la fila); los colores, bordes y separaciones, de las variables --sheet-* de
 * la hoja, para que un tema pueda cambiarlos. La tarjeta es una caja con título y contenido apilado:
 * más adelante podrá llevar una imagen o servir de base a una plantilla de actividad.
 */
export function ContainerView({ block, renderInner, renderCardTitle, renderCellEnd }: ContainerViewProps) {
  const inner = (blocks: readonly InnerBlock[], cell: number) =>
    blocks.map((child, index) => (
      // En la vista previa de lo que escribe la IA los bloques aún no tienen id
      <Fragment key={child.id ?? index}>
        {renderInner ? (
          renderInner(child, cell)
        ) : (
          <div className={`crt-block crt-block--${child.type}`}>
            <BlockView block={child} />
          </div>
        )}
      </Fragment>
    ));

  if (block.type === "columns") {
    const template = block.columns.map(column => `minmax(0, ${column.width}fr)`).join(" ");
    return (
      <div className="crt-columns" data-count={block.columns.length} style={{ "--crt-columns": template } as CSSProperties}>
        {block.columns.map((column, cell) => (
          <div key={cell} className="crt-cell crt-cell--column" data-cell={cell}>
            {inner(column.blocks, cell)}
            {renderCellEnd?.(cell, column.blocks)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="crt-tiles" data-per-row={block.perRow} style={{ "--crt-per-row": block.perRow } as CSSProperties}>
      {block.cards.map((card, cell) => (
        <div key={cell} className="crt-cell crt-tile" data-cell={cell}>
          {renderCardTitle
            ? renderCardTitle(cell, card.title)
            : card.title && (
                <h4 className="crt-tile__title">
                  <RichText md={card.title} inline />
                </h4>
              )}
          {inner(card.blocks, cell)}
          {renderCellEnd?.(cell, card.blocks)}
        </div>
      ))}
    </div>
  );
}

/** Dibuja un bloque del recurso. Es la misma vista en pantalla y en la hoja impresa. */
export const BlockView = memo(function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "header_fields":
      return (
        <div className="crt-fields">
          {block.fields.map((field, index) => (
            <span key={index} className="crt-fields__item">
              <strong>{field}:</strong>
              <span className="crt-fields__line" />
            </span>
          ))}
        </div>
      );
    case "heading":
      return block.level === 2 ? (
        <h3 className="crt-heading crt-heading--2">
          <RichText md={block.text} inline />
        </h3>
      ) : (
        <h4 className="crt-heading crt-heading--3">
          <RichText md={block.text} inline />
        </h4>
      );
    case "paragraph":
      return <RichText md={block.md} />;
    case "callout":
      return (
        <aside className={`crt-callout crt-callout--${block.tone}`}>
          {block.title && <strong className="crt-callout__title">{block.title}</strong>}
          <RichText md={block.md} />
        </aside>
      );
    case "math":
      return <Formula latex={block.latex} display className="crt-math" />;
    case "exercise":
      return <ExerciseView block={block} />;
    case "table":
      return <TableView block={block} />;
    case "value_table":
      return <ValueTableView block={block} />;
    case "graph":
      return (
        <Figure caption={block.caption}>
          <CoordinatePlane spec={block.spec} />
        </Figure>
      );
    case "number_line":
      return (
        <Figure caption={block.caption}>
          <NumberLine spec={block} />
        </Figure>
      );
    case "fraction_model":
      return (
        <Figure caption={block.caption}>
          <FractionModel spec={block} />
        </Figure>
      );
    case "bar_chart":
      return (
        <Figure caption={block.caption}>
          <BarChart spec={block} />
        </Figure>
      );
    case "pie_chart":
      return (
        <Figure caption={block.caption}>
          <PieChart spec={block} />
        </Figure>
      );
    case "histogram":
      return (
        <Figure caption={block.caption}>
          <Histogram spec={block} />
        </Figure>
      );
    case "box_plot":
      return (
        <Figure caption={block.caption}>
          <BoxPlot spec={block} />
        </Figure>
      );
    case "line_chart":
      return (
        <Figure caption={block.caption}>
          <LineChart spec={block} />
        </Figure>
      );
    case "scatter_plot":
      return (
        <Figure caption={block.caption}>
          <ScatterPlot spec={block} />
        </Figure>
      );
    case "angle":
      return (
        <Figure caption={block.caption}>
          <Angle spec={block} />
        </Figure>
      );
    case "venn":
      return (
        <Figure caption={block.caption}>
          <Venn spec={block} />
        </Figure>
      );
    case "tree_diagram":
      return (
        <Figure caption={block.caption}>
          <TreeDiagram spec={block} />
        </Figure>
      );
    case "bar_model":
      return (
        <Figure caption={block.caption}>
          <BarModel spec={block} />
        </Figure>
      );
    case "pictogram":
      return (
        <Figure caption={block.caption}>
          <Pictogram spec={block} />
        </Figure>
      );
    case "clock":
      return (
        <Figure caption={block.caption}>
          <Clock spec={block} />
        </Figure>
      );
    case "base_ten":
      return (
        <Figure caption={block.caption}>
          <BaseTen spec={block} />
        </Figure>
      );
    case "area_model":
      return (
        <Figure caption={block.caption}>
          <AreaModel spec={block} />
        </Figure>
      );
    case "shapes":
      return (
        <Figure caption={block.caption}>
          <Shapes spec={block} />
        </Figure>
      );
    case "balance":
      return (
        <Figure caption={block.caption}>
          <Balance spec={block} />
        </Figure>
      );
    case "solution":
      return <SolutionView block={block} />;
    case "page_break":
      return (
        <div className="crt-page-break" role="separator">
          <span>Salto de página</span>
        </div>
      );
    case "columns":
    case "cards":
      return <ContainerView block={block} />;
  }
});

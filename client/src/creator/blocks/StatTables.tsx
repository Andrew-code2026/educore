import type { BlockOf } from "@shared/creator";
import { contingencyTableView, frequencyTableView, type CellText, type ContingencyCell } from "@shared/creatorStatTables";
import { Formula } from "./Formula";
import { RichText } from "./RichText";

/**
 * Las tablas estadísticas: la de frecuencias y la de contingencia. No guardan celdas escritas; cada
 * número sale de creatorStatTables.ts a partir de los datos, igual que lo que recibe la IA. Tienen el
 * aspecto de las demás tablas de la hoja (.crt-table) y encabezados algo más pequeños, para que una
 * tabla de siete columnas quepa a lo ancho de una hoja carta.
 */

/** Una celda en blanco deja el espacio para escribir; una fracción se dibuja con KaTeX. */
function CellValue({ cell, blank }: { cell: CellText; blank: boolean }) {
  if (blank) return <>{" "}</>;
  return cell.latex ? <Formula latex={cell.latex} /> : <>{cell.text}</>;
}

/** El símbolo de una columna con su subíndice: f con i, h con i y %. */
function ColumnSymbol({ letter, suffix }: { letter: string; suffix: string }) {
  return (
    <span className="crt-stat-table__symbol">
      <i>{letter}</i>
      <sub>i</sub>
      {suffix}
    </span>
  );
}

function Caption({ md }: { md?: string }) {
  if (!md) return null;
  return (
    <figcaption>
      <RichText md={md} inline />
    </figcaption>
  );
}

/** Lo que se ve mientras el borrador del formulario no forma una tabla: el aviso concreto está en el formulario. */
function Unbuildable({ caption }: { caption?: string }) {
  return (
    <figure className="crt-table crt-table--stat">
      <p className="crt-stat-table__note">La tabla se dibuja cuando sus datos estén completos.</p>
      <Caption md={caption} />
    </figure>
  );
}

export function FrequencyTable({ block }: { block: BlockOf<"frequency_table"> }) {
  const view = frequencyTableView(block);
  if (!view) return <Unbuildable caption={block.caption} />;
  return (
    <figure className="crt-table crt-table--stat">
      <table>
        <thead>
          <tr>
            <th scope="col">{view.variable}</th>
            {view.columns.map((column, index) => (
              <th key={index} scope="col">
                <span className="crt-stat-table__title">{column.title}</span>
                <ColumnSymbol letter={column.symbol} suffix={column.suffix} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {/* Una clase [150, 155) no se parte en dos renglones */}
              <th scope="row" className={view.model.grouped ? "crt-stat-table__nowrap" : undefined}>
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td key={index}>
                  <CellValue cell={cell} blank={view.columns[index].blank} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {view.totals && (
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {view.totals.map((cell, index) => (
                // Las acumuladas no tienen total: la celda queda vacía y sombreada
                <td key={index} className={cell.text ? undefined : "crt-stat-table__none"}>
                  {cell.text ? <CellValue cell={cell} blank={view.columns[index].blank} /> : null}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {view.note && <p className="crt-stat-table__note">{view.note}</p>}
      {view.measures.length > 0 && (
        <p className="crt-stat-table__measures">
          {view.measures.map(measure => (
            <span key={measure.key}>
              {measure.name}: {measure.blank ? <span className="crt-stat-table__line" aria-label="En blanco" /> : <strong>{measure.value}</strong>}
            </span>
          ))}
        </p>
      )}
      <Caption md={block.caption} />
    </figure>
  );
}

function ContingencyValue({ cell }: { cell: ContingencyCell }) {
  return <CellValue cell={cell} blank={cell.blank} />;
}

export function ContingencyTable({ block }: { block: BlockOf<"contingency_table"> }) {
  const view = contingencyTableView(block);
  if (!view) return <Unbuildable caption={block.caption} />;
  const totals = view.totals !== null;
  // Con nombre de la variable de las columnas, el encabezado lleva dos renglones: el nombre arriba y sus categorías debajo
  const twoRows = Boolean(view.columnVariable);
  return (
    <figure className="crt-table crt-table--stat crt-table--contingency">
      <table>
        <thead>
          {twoRows && (
            <tr>
              <th scope="col" rowSpan={2} className="crt-stat-table__corner">
                {view.rowVariable ?? ""}
              </th>
              <th scope="colgroup" colSpan={view.columns.length}>
                {view.columnVariable}
              </th>
              {totals && (
                <th scope="col" rowSpan={2}>
                  Total
                </th>
              )}
            </tr>
          )}
          <tr>
            {!twoRows && (
              <th scope="col" className="crt-stat-table__corner">
                {view.rowVariable ?? ""}
              </th>
            )}
            {view.columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
            {!twoRows && totals && <th scope="col">Total</th>}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, index) => (
                <td key={index}>
                  <ContingencyValue cell={cell} />
                </td>
              ))}
              {row.total && (
                <td className="crt-stat-table__total">
                  <ContingencyValue cell={row.total} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {view.totals && (
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {view.totals.cells.map((cell, index) => (
                <td key={index} className="crt-stat-table__total">
                  <ContingencyValue cell={cell} />
                </td>
              ))}
              <td className="crt-stat-table__total">
                <ContingencyValue cell={view.totals.total} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {view.note && <p className="crt-stat-table__note">{view.note}</p>}
      <Caption md={block.caption} />
    </figure>
  );
}

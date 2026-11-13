import { BLOCK_TYPE_LABELS, blockCells, CREATOR_LIMITS, INNER_BLOCK_TYPES, isContainer, type BlockInput, type ContainerInput } from "./creator";

/**
 * Qué cabe en una columna o en una tarjeta. Cada figura tiene un ancho de diseño; dentro de una
 * celda se reduce con todo y sus rótulos. Por debajo de unas tres cuartas partes de ese ancho los
 * rótulos bajan de 7 pt en papel y la figura deja de leerse, así que no se admite ahí.
 *
 * Las medidas son las de la hoja impresa en carta, que es la que manda: en pantalla la hoja mide
 * casi lo mismo (816 px con 52 de margen a cada lado).
 */

/** Ancho útil de la hoja impresa: carta (215,9 mm) menos los márgenes de 16 mm, en píxeles CSS. */
export const SHEET_WIDTH_PX = 695;
/** Separación entre columnas y entre tarjetas; la misma que dibuja creator.css (--sheet-column-gap, --sheet-card-gap). */
export const COLUMN_GAP_PX = 20;
export const CARD_GAP_PX = 12;
/** Relleno y borde de una tarjeta a cada lado (--sheet-card-pad más el borde). */
export const CARD_INSET_PX = 13;

/** Lo que mide cada celda del contenedor, en el mismo orden de sus columnas o tarjetas. */
export function cellWidths(block: ContainerInput, sheet = SHEET_WIDTH_PX): number[] {
  if (block.type === "columns") {
    const total = block.columns.reduce((sum, column) => sum + column.width, 0);
    const free = sheet - COLUMN_GAP_PX * (block.columns.length - 1);
    return block.columns.map(column => (free * column.width) / total);
  }
  const width = (sheet - CARD_GAP_PX * (block.perRow - 1)) / block.perRow - 2 * CARD_INSET_PX;
  return block.cards.map(() => width);
}

const FIGURE_SCALE_MIN = 0.75;
const fromDesign = (width: number) => Math.round(width * FIGURE_SCALE_MIN);

/**
 * El ancho más angosto en que un bloque todavía se lee bien, en píxeles de la hoja. Las figuras
 * parten de su ancho de diseño (el de su componente en client/src/creator/blocks); el texto se
 * acomoda a cualquier ancho y las tablas, a lo que piden sus columnas.
 */
export function minBlockWidth(block: BlockInput): number {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "callout":
    case "exercise":
    case "solution":
      return 110;
    case "math":
      return 150;
    case "table":
      return 16 + 64 * block.header.length;
    case "value_table":
      return 16 + 52 * (block.xs.length + 1);
    case "graph":
      // El plano mide hasta 360 px y sus rótulos son de tamaño fijo: no se reduce tanto como un dibujo
      return 270;
    case "number_line":
      return fromDesign(560);
    case "bar_chart":
    case "pie_chart":
    case "histogram":
    case "box_plot":
    case "line_chart":
    case "pictogram":
      return fromDesign(520);
    case "scatter_plot":
    case "balance":
      return fromDesign(460);
    case "venn":
      return fromDesign(440);
    case "bar_model":
      return fromDesign(380);
    case "tree_diagram":
      return fromDesign(400);
    case "fraction_model":
      return fromDesign(Math.min(520, 40 + 130 * block.models.length));
    case "clock":
      return fromDesign(Math.max(160, block.clocks.length * 128 + 8));
    case "angle":
      return fromDesign(Math.min(520, 60 + 170 * block.angles.length));
    case "base_ten":
      return fromDesign(280);
    case "area_model":
      return fromDesign(Math.max(220, 90 + 108 * block.columns.length));
    case "shapes":
      return fromDesign(Math.min(520, 40 + 150 * block.figures.length));
    default:
      // Lo que no va dentro de un contenedor pide la hoja entera
      return SHEET_WIDTH_PX;
  }
}

/** «la columna 2», «la tarjeta 3»: como se nombra una celda en los avisos. */
export const cellName = (container: ContainerInput, cell: number) => `la ${container.type === "columns" ? "columna" : "tarjeta"} ${cell + 1}`;

const SHARES: Array<[number, string]> = [
  [1 / 4, "un cuarto"],
  [1 / 3, "un tercio"],
  [1 / 2, "la mitad"],
  [2 / 3, "dos tercios"],
  [3 / 4, "tres cuartos"],
];

/** La fracción de la hoja que hace falta para un ancho, en palabras: la columna más angosta que lo alcanza. */
function shareNeeded(width: number): string {
  for (const [share, words] of SHARES) {
    if ((SHEET_WIDTH_PX - COLUMN_GAP_PX * (1 / share - 1)) * share >= width) return words;
  }
  return "todo el ancho";
}

/**
 * Por qué un bloque no puede ir en una celda de este ancho, redactado para el docente y para la IA;
 * `null` si cabe. Sin ancho solo se revisa el tipo.
 */
export function placementIssue(block: BlockInput, width?: number, where = "una columna o una tarjeta"): string | null {
  const label = BLOCK_TYPE_LABELS[block.type];
  if (isContainer(block)) return `${label} no puede ir dentro de ${where}: hay un solo nivel de columnas y tarjetas.`;
  if (!INNER_BLOCK_TYPES.has(block.type)) return `${label} no puede ir dentro de ${where}: va solo en la hoja, a todo lo ancho.`;
  if (width === undefined) return null;
  const needed = minBlockWidth(block);
  if (needed <= width + 0.5) return null;
  return `${label} no cabe legible en ${where}: necesita al menos ${shareNeeded(needed)} del ancho de la hoja. Va mejor en una columna más ancha (ancho 2), con menos columnas o tarjetas por fila, o fuera del contenedor.`;
}

/** Los problemas de colocar estos bloques en esta celda: tipo, ancho y cuántos caben. */
export function cellIssues(container: ContainerInput, cell: number, blocks: readonly BlockInput[]): string[] {
  const width = cellWidths(container)[cell];
  return blocks.flatMap(block => placementIssue(block, width, cellName(container, cell)) ?? []);
}

/** Los problemas de forma de un contenedor completo: anchos y lo que lleva cada celda. */
export function containerIssues(container: ContainerInput): string[] {
  const issues: string[] = [];
  if (container.type === "columns") {
    const total = container.columns.reduce((sum, column) => sum + column.width, 0);
    if (total > CREATOR_LIMITS.columnWidthsMax) issues.push(`Columnas: los anchos suman ${total} y pueden sumar como mucho ${CREATOR_LIMITS.columnWidthsMax}; con tres columnas, solo una puede ser ancha.`);
  }
  blockCells(container).forEach((blocks, cell) => issues.push(...cellIssues(container, cell, blocks)));
  return issues;
}

import { axisNameBands } from "./creatorPlaneAxes";
import { BLOCK_TYPE_LABELS, blockCells, blockPreview, CREATOR_LIMITS, findMath, INNER_BLOCK_TYPES, isContainer, plainText, type BlockInput, type ContainerInput } from "./creator";

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
      // El plano mide hasta 360 px y sus rótulos son de tamaño fijo: no se reduce tanto como un dibujo.
      // Las franjas de los nombres de los ejes se suman: no deben salir de la escala de la cuadrícula
      return 270 + axisNameBands(block.spec);
    case "number_line":
      return fromDesign(560);
    case "bar_chart":
    case "pie_chart":
    case "histogram":
    case "box_plot":
    case "line_chart":
    case "pictogram":
    case "tree_diagram":
    case "bar_model":
      return fromDesign(520);
    case "scatter_plot":
    case "balance":
      return fromDesign(460);
    case "venn":
      return fromDesign(440);
    case "fraction_model":
      // Círculos de unos 120 px cada uno; las barras van apiladas y miden casi media hoja
      return fromDesign(block.shape === "circle" ? Math.min(520, 10 + 120 * block.models.length) : 400);
    case "clock":
      return fromDesign(Math.max(160, block.clocks.length * 128 + 8));
    case "angle":
      return fromDesign(Math.min(520, 180 * block.angles.length));
    case "base_ten":
      return fromDesign(280);
    case "area_model":
      return fromDesign(Math.max(220, 90 + 108 * block.columns.length));
    case "shapes":
      return fromDesign(Math.min(520, 70 + 150 * block.figures.length));
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

/* ───────────────────────── Columnas que se ven mal ─────────────────────────
 *
 * Lo de arriba impide lo que no se lee. Esto otro sí se lee, pero se ve mal: una columna de texto
 * mucho más larga que su vecina deja un hueco grande debajo de la corta, y un texto largo en una
 * columna angosta se vuelve una tira de renglones de tres palabras. Para saberlo se estima el alto
 * de cada bloque en papel. Es una estimación (caracteres por renglón, alto de renglón, proporción de
 * cada figura) y por eso los umbrales son holgados: solo avisa de lo que se ve mal a simple vista.
 */

/** Alto de un renglón de texto en papel (11,5 pt con interlineado 1,5) y ancho medio de un carácter, en píxeles. */
export const LINE_PX = 23;
const CHAR_PX = 7.4;
/** Separación entre bloques de una celda en papel. */
const BLOCK_GAP_PX = 10;

/** Cuántos caracteres se ven de un texto Markdown: una fórmula ocupa menos que su LaTeX y los signos de formato no se ven. */
function visibleLength(md: string): number {
  let length = 0;
  let last = 0;
  for (const span of findMath(md)) {
    length += md.slice(last, span.start).replace(/[*_`#>]/g, "").length + span.latex.length * 0.6;
    last = span.end;
  }
  return length + md.slice(last).replace(/[*_`#>]/g, "").length;
}

/** Renglones que ocupa un texto a este ancho: cada párrafo o ítem empieza renglón. */
export function textLines(md: string, width: number): number {
  const perLine = Math.max(8, Math.floor(width / CHAR_PX));
  return md
    .split(/\n+/)
    .filter(part => part.trim().length > 0)
    .reduce((sum, part) => sum + Math.max(1, Math.ceil(visibleLength(part) / perLine)), 0);
}

/** Alto (sobre ancho) de cada figura: el plano depende de sus rangos; las demás, de su dibujo. */
const FIGURE_RATIO: Partial<Record<BlockInput["type"], number>> = {
  number_line: 0.25,
  fraction_model: 0.5,
  bar_chart: 0.62,
  pie_chart: 0.55,
  histogram: 0.62,
  box_plot: 0.5,
  line_chart: 0.62,
  scatter_plot: 0.7,
  angle: 0.7,
  venn: 0.7,
  tree_diagram: 0.6,
  bar_model: 0.45,
  pictogram: 0.5,
  clock: 1,
  base_ten: 0.7,
  area_model: 0.8,
  shapes: 0.6,
  balance: 0.55,
};

/** Bloques que son sobre todo texto: los que se alargan cuando la columna se angosta. */
const TEXT_TYPES: ReadonlySet<string> = new Set(["paragraph", "heading", "callout", "exercise", "solution"]);

/** Alto aproximado en papel de un bloque dibujado a este ancho, en píxeles. */
export function estimateHeight(block: BlockInput, width: number): number {
  const caption = "caption" in block && block.caption ? LINE_PX : 0;
  switch (block.type) {
    case "paragraph":
      return textLines(block.md, width) * LINE_PX;
    case "heading":
      return textLines(block.text, width / 1.3) * 30 + 10;
    case "callout":
      return (block.title ? LINE_PX : 0) + textLines(block.md, width - 34) * LINE_PX + 26;
    case "exercise": {
      const statement = textLines(`${block.label}. ${block.md}`, width) + block.parts.reduce((sum, part) => sum + textLines(part.md, width - 24), 0);
      const answer = block.answerSpace === "none" ? 0 : block.answerSpace === "lines" ? block.lines * 29 : block.lines * 26;
      return statement * LINE_PX + answer;
    }
    case "solution":
      return (textLines(block.label, width) + block.steps.reduce((sum, step) => sum + textLines(step, width - 20), 0) + (block.answer ? textLines(block.answer, width - 20) : 0)) * LINE_PX + 16;
    case "math":
      return 56;
    case "table":
      return (block.rows.length + 1) * 34 + caption;
    case "value_table":
      return 2 * 34 + caption;
    case "graph": {
      const ratio = Math.min(1.4, Math.max(0.5, (block.spec.yMax - block.spec.yMin) / (block.spec.xMax - block.spec.xMin)));
      return Math.min(width, 374 * 0.86) * ratio + caption;
    }
    default: {
      // Las figuras se dibujan en papel a un 86 % de su ancho de diseño, o al ancho de la celda si es menor
      const design = minBlockWidth(block) / FIGURE_SCALE_MIN;
      return Math.min(width, design * 0.86) * (FIGURE_RATIO[block.type] ?? 0.6) + caption;
    }
  }
}

/** Alto de una celda y cuánto de ese alto es texto. */
function cellHeight(blocks: readonly BlockInput[], width: number): { height: number; text: number } {
  let height = 0;
  let text = 0;
  blocks.forEach((block, index) => {
    const own = estimateHeight(block, width);
    height += own + (index > 0 ? BLOCK_GAP_PX : 0);
    if (TEXT_TYPES.has(block.type)) text += own;
  });
  return { height, text };
}

/** Una columna mucho más larga que otra (si es casi todo texto), o un texto largo en una celda angosta. */
export interface LayoutIssue {
  /** Lo identifica aunque el texto del aviso cambie: así se distingue lo que ya estaba de lo nuevo. */
  key: string;
  containerId: string;
  message: string;
}

/** Más angosta que esto (un tercio de la hoja, una tarjeta de tres o cuatro por fila), una celda es angosta para un texto largo; a media hoja se lee bien. */
const NARROW_PX = 300;
/** Un texto que en una celda angosta pasa de esto se lee mejor a todo lo ancho. */
const LONG_TEXT_LINES = 16;

/** Lo que se ve mal en un contenedor, con aviso para el docente y para la IA. */
export function containerLayoutIssues(container: ContainerInput & { id?: string }, id = container.id ?? ""): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const widths = cellWidths(container);
  const cells = blockCells(container);

  if (container.type === "columns") {
    const measured = cells.map((blocks, cell) => ({ cell, ...cellHeight(blocks, widths[cell]), empty: blocks.length === 0 })).filter(item => !item.empty);
    if (measured.length >= 2) {
      const tallest = measured.reduce((best, item) => (item.height > best.height ? item : best));
      const shortest = measured.reduce((best, item) => (item.height < best.height ? item : best));
      // Una figura alta junto a un texto corto es lo normal; lo que se ve mal es un texto largo junto a algo corto
      if (tallest.height > shortest.height * 2.5 && tallest.height - shortest.height > 11 * LINE_PX && tallest.text > tallest.height * 0.6) {
        issues.push({
          key: `${id}:desparejas`,
          containerId: id,
          message:
            `La columna ${tallest.cell + 1} es mucho más larga que la columna ${shortest.cell + 1} (unos ${Math.round(tallest.height / LINE_PX)} renglones contra ${Math.round(shortest.height / LINE_PX)}) y deja un hueco grande. ` +
            "Reparte los bloques entre las columnas, haz más ancha la columna larga o deja ese texto a todo lo ancho, fuera de las columnas.",
        });
      }
    }
  }

  cells.forEach((blocks, cell) => {
    if (widths[cell] >= NARROW_PX) return;
    blocks.forEach((block, index) => {
      if (!TEXT_TYPES.has(block.type)) return;
      const lines = Math.round(estimateHeight(block, widths[cell]) / LINE_PX);
      if (lines <= LONG_TEXT_LINES) return;
      const where = cellName(container, cell);
      const blockId = "id" in block && typeof block.id === "string" ? block.id : `${cell}.${index}`;
      issues.push({
        key: `${id}:largo:${blockId}`,
        containerId: id,
        message: `${BLOCK_TYPE_LABELS[block.type]} «${plainText(blockPreview(block), 40)}» ocupa unos ${lines} renglones en ${where}, que es angosta. Un texto así de largo se lee mejor a todo lo ancho, en una columna más ancha o partido en dos.`,
      });
    });
  });
  return issues;
}

/** Lo que se ve mal en los contenedores de unas secciones, nombrando la sección: para la IA. */
export function layoutIssues(sections: ReadonlyArray<{ title: string; blocks: readonly BlockInput[] }>): LayoutIssue[] {
  return sections.flatMap(section =>
    section.blocks.flatMap(block => (isContainer(block) ? containerLayoutIssues(block).map(issue => ({ ...issue, message: `Sección «${section.title}», ${BLOCK_TYPE_LABELS[block.type].toLowerCase()}: ${issue.message}` })) : [])),
  );
}

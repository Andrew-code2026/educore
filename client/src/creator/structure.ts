/**
 * Lógica de la estructura del documento en el editor (tanda 3), sin nada de React: qué bloques se
 * ofrecen al insertar y cómo se buscan, a dónde cae un bloque que se arrastra o se mueve con el
 * teclado, y los atajos que cambian el tipo de un bloque al escribir.
 */
import { BLOCK_TYPE_LABELS, blockCells, findBlock, type BlockInput, type BlockType, type ResourceDoc } from "@shared/creator";
import type { DocOp } from "@shared/creatorOps";

/* ───────────────────────── Catálogo de bloques ───────────────────────── */

export interface BlockFamily {
  id: string;
  label: string;
  types: BlockType[];
}

/** Las familias en que se agrupan los bloques al insertar uno, en el orden en que se ofrecen. */
export const BLOCK_FAMILIES: readonly BlockFamily[] = [
  { id: "text", label: "Texto", types: ["paragraph", "heading", "callout", "math"] },
  { id: "exercises", label: "Ejercicios y soluciones", types: ["exercise", "solution"] },
  { id: "tables", label: "Tablas", types: ["table", "value_table"] },
  {
    id: "charts",
    label: "Gráficas y estadística",
    types: ["graph", "bar_chart", "pie_chart", "line_chart", "scatter_plot", "histogram", "box_plot", "pictogram", "tree_diagram", "venn"],
  },
  { id: "geometry", label: "Geometría y medida", types: ["shapes", "triangle", "unit_circle", "solid", "angle", "clock"] },
  { id: "numbers", label: "Números y operaciones", types: ["number_line", "fraction_model", "bar_model", "base_ten", "area_model", "balance"] },
  { id: "layout", label: "Columnas y tarjetas", types: ["columns", "cards"] },
  { id: "page", label: "Página", types: ["page_break"] },
];

/** Los bloques que el docente puede añadir (los datos del estudiante solo los pone la IA, al inicio). */
export const ADDABLE_BLOCKS: readonly BlockType[] = BLOCK_FAMILIES.flatMap(family => family.types);

/** Una línea que dice para qué sirve cada bloque, y palabras con que el docente podría buscarlo. */
export const BLOCK_INFO: Partial<Record<BlockType, { hint: string; keywords: string }>> = {
  paragraph: { hint: "Párrafos con negrita, listas y fórmulas", keywords: "parrafo escribir lista viñetas" },
  heading: { hint: "Título de un apartado", keywords: "subtitulo encabezado apartado" },
  callout: { hint: "Una idea clave, un consejo o un aviso", keywords: "caja nota concepto consejo atencion definicion" },
  math: { hint: "Una fórmula destacada en su renglón", keywords: "ecuacion expresion latex matematica" },
  exercise: { hint: "Enunciado con incisos y espacio de respuesta", keywords: "problema pregunta actividad taller incisos" },
  solution: { hint: "Procedimiento paso a paso y respuesta final", keywords: "respuesta clave procedimiento pasos" },
  table: { hint: "Filas y columnas libres", keywords: "filas columnas cuadro datos" },
  value_table: { hint: "Valores de x y y calculados de una expresión", keywords: "funcion tabular" },
  graph: {
    hint: "Plano cartesiano con funciones, cónicas, figuras e inecuaciones",
    keywords:
      "funcion plano cartesiano ejes curva recta parabola coordenadas conica circunferencia elipse hiperbola tangente secante derivada integral limite trozos asintota raices vertice interceptos seno coseno trigonometrica pi segmento poligono triangulo distancia punto medio transformacion traslacion reflexion rotacion homotecia inecuacion semiplano region factible programacion lineal",
  },
  bar_chart: { hint: "Barras para comparar categorías", keywords: "frecuencia categorias" },
  pie_chart: { hint: "Partes de un total, en porcentajes", keywords: "torta pastel sectores porcentaje" },
  line_chart: { hint: "Cómo cambia un dato con el tiempo", keywords: "tendencia tiempo evolucion serie" },
  scatter_plot: { hint: "Pares de datos y su línea de tendencia", keywords: "correlacion puntos regresion tendencia" },
  histogram: { hint: "Frecuencias de datos agrupados en intervalos", keywords: "frecuencia intervalos clases distribucion" },
  box_plot: { hint: "Mediana, cuartiles y extremos de unos datos", keywords: "bigotes cuartiles mediana" },
  pictogram: { hint: "Datos contados con íconos", keywords: "iconos dibujos conteo" },
  tree_diagram: { hint: "Ramas para contar casos o calcular probabilidades", keywords: "probabilidad combinaciones ramas conteo" },
  venn: { hint: "Conjuntos, intersecciones y diferencias", keywords: "conjuntos interseccion union" },
  shapes: { hint: "Polígonos y círculos con sus medidas", keywords: "poligono triangulo rectangulo circulo perimetro area" },
  triangle: { hint: "Lados y ángulos que calcula el sistema", keywords: "pitagoras hipotenusa catetos trigonometria seno coseno tangente razones ley senos cosenos semejanza" },
  unit_circle: { hint: "Ángulos notables con su seno y coseno exactos", keywords: "trigonometria radianes grados seno coseno tangente referencia cuadrante circunferencia goniometrica" },
  solid: { hint: "Cuerpos en perspectiva con volumen y área calculados", keywords: "cubo prisma cilindro cono piramide esfera volumen area superficial caras aristas vertices cuerpos geometricos 3d" },
  angle: { hint: "Ángulos con su medida y rótulos", keywords: "grados transportador" },
  clock: { hint: "Reloj de agujas para leer la hora", keywords: "hora tiempo agujas" },
  number_line: { hint: "Puntos, saltos e intervalos sobre una recta", keywords: "enteros intervalos saltos desigualdades" },
  fraction_model: { hint: "Fracciones como partes de círculos o barras", keywords: "partes equivalentes" },
  bar_model: { hint: "Barras para plantear problemas de partes y todo", keywords: "problemas partes todo" },
  base_ten: { hint: "Unidades, decenas y centenas con bloques", keywords: "valor posicional unidades decenas centenas" },
  area_model: { hint: "Rectángulo partido para multiplicar o factorizar", keywords: "multiplicacion factorizar distributiva" },
  balance: { hint: "Una ecuación como balanza en equilibrio", keywords: "ecuaciones equilibrio igualdad" },
  page_break: { hint: "Lo que sigue empieza en una hoja nueva al imprimir", keywords: "hoja nueva imprimir" },
  columns: { hint: "Dos o tres columnas lado a lado", keywords: "lado mitad dividir comparar paralelo dos tres" },
  cards: { hint: "Recuadros en rejilla: vocabulario, casos, estaciones", keywords: "rejilla cuadricula fichas recuadros vocabulario casos estaciones grupos" },
};

/** Minúsculas y sin tildes: «grafica» encuentra «Gráfica». */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Cada palabra buscada empieza alguna palabra del texto. */
const allPrefix = (tokens: string[], haystack: string[]) => tokens.every(token => haystack.some(word => word.startsWith(token)));

/**
 * Qué tan bien responde un bloque a lo que se buscó: 0 si el nombre empieza así, 1 si todas las
 * palabras están en el nombre, 2 si están en el nombre o sus sinónimos, 3 si aparecen en su
 * descripción o en su familia. `null` si no responde.
 */
export function matchScore(type: BlockType, query: string, family = ""): number | null {
  const tokens = words(query);
  if (tokens.length === 0) return 0;
  const label = BLOCK_TYPE_LABELS[type];
  if (fold(label).startsWith(fold(query.trim()))) return 0;
  const labelWords = words(label);
  if (allPrefix(tokens, labelWords)) return 1;
  const info = BLOCK_INFO[type];
  const keywordWords = [...labelWords, ...words(info?.keywords ?? "")];
  if (allPrefix(tokens, keywordWords)) return 2;
  if (allPrefix(tokens, [...keywordWords, ...words(info?.hint ?? ""), ...words(family)])) return 3;
  return null;
}

/**
 * Las familias con los bloques que responden a la búsqueda. Sin búsqueda, el catálogo entero.
 * Con búsqueda, primero la familia del mejor resultado y, dentro de cada una, los más parecidos.
 */
export function filterBlockFamilies(query: string, families: readonly BlockFamily[] = BLOCK_FAMILIES): BlockFamily[] {
  if (words(query).length === 0) return families.map(family => ({ ...family, types: [...family.types] }));
  const scored = families
    .map((family, order) => {
      const types = family.types
        .map((type, position) => ({ type, position, score: matchScore(type, query, family.label) }))
        .filter((item): item is { type: BlockType; position: number; score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score || a.position - b.position);
      return { family, order, types, best: types[0]?.score ?? Infinity };
    })
    .filter(entry => entry.types.length > 0)
    .sort((a, b) => a.best - b.best || a.order - b.order);
  return scored.map(entry => ({ ...entry.family, types: entry.types.map(item => item.type) }));
}

/* ───────────────────────── Dónde insertar ───────────────────────── */

/**
 * Dónde va un bloque nuevo: al inicio o al final de una sección o de una celda (una columna o una
 * tarjeta, con `containerId` y `cell`), o junto a un bloque, esté donde esté.
 */
export type InsertPlace =
  | { sectionId: string; kind: "start" | "end"; containerId?: string; cell?: number }
  | { sectionId: string; kind: "after" | "before"; blockId: string };

/** La operación que inserta `blocks` en `place`. «Antes del primero» es el inicio de su lista. */
export function insertOp(doc: ResourceDoc, place: InsertPlace, blocks: BlockInput[]): DocOp {
  const base = { op: "insert_blocks" as const, sectionId: place.sectionId, blocks };
  switch (place.kind) {
    case "start":
    case "end":
      return place.containerId !== undefined ? { ...base, at: place.kind, containerId: place.containerId, cell: place.cell ?? 0 } : { ...base, at: place.kind };
    case "after":
      return { ...base, afterBlockId: place.blockId };
    case "before": {
      const found = findBlock(doc, place.blockId);
      // Si el bloque ya no está, la operación falla con su propio aviso
      if (!found) return { ...base, afterBlockId: place.blockId };
      const list = found.parent ? blockCells(found.parent.container)[found.parent.cell] : found.section.blocks;
      if (found.index > 0) return { ...base, afterBlockId: list[found.index - 1].id };
      return found.parent ? { ...base, at: "start", containerId: found.parent.container.id, cell: found.parent.cell } : { ...base, at: "start" };
    }
  }
}

/* ───────────────────────── Mover ───────────────────────── */

/**
 * A dónde va un bloque que se mueve: el hueco `index` de una lista (ver `move_block_to`). La lista es
 * la de la sección o, con `containerId` y `cell`, la de una columna o una tarjeta de esa sección.
 */
export interface DropTarget {
  sectionId: string;
  index: number;
  containerId?: string;
  cell?: number;
}

/** ¿Es la lista donde ya está el bloque? */
const inSameList = (found: NonNullable<ReturnType<typeof findBlock>>, target: DropTarget) =>
  found.section.id === target.sectionId && (found.parent ? found.parent.container.id === target.containerId && found.parent.cell === target.cell : target.containerId === undefined);

/** ¿Soltar ahí lo deja donde estaba? */
export function isSamePlace(doc: ResourceDoc, blockId: string, target: DropTarget): boolean {
  const found = findBlock(doc, blockId);
  return found !== null && inSameList(found, target) && (target.index === found.index || target.index === found.index + 1);
}

/**
 * Un paso arriba o abajo para el teclado y para «Subir» y «Bajar». En el borde de una sección pasa
 * a la vecina: al final de la anterior o al inicio de la siguiente. `null` en los extremos del documento.
 * Un bloque de dentro se mueve dentro de su celda y, en su borde, sale del contenedor: queda justo
 * encima o justo debajo de él. Un contenedor se mueve entero y los demás bloques lo saltan.
 */
export function stepTarget(doc: ResourceDoc, blockId: string, direction: "up" | "down"): DropTarget | null {
  const found = findBlock(doc, blockId);
  if (!found) return null;
  if (found.parent) {
    const { container, cell, index: containerIndex } = found.parent;
    const length = blockCells(container)[cell].length;
    const index = direction === "up" ? found.index - 1 : found.index + 2;
    if (index < 0) return { sectionId: found.section.id, index: containerIndex };
    if (index > length) return { sectionId: found.section.id, index: containerIndex + 1 };
    return { sectionId: found.section.id, containerId: container.id, cell, index };
  }
  const at = doc.sections.indexOf(found.section);
  if (direction === "up") {
    if (found.index > 0) return { sectionId: found.section.id, index: found.index - 1 };
    const previous = doc.sections[at - 1];
    return previous ? { sectionId: previous.id, index: previous.blocks.length } : null;
  }
  if (found.index < found.section.blocks.length - 1) return { sectionId: found.section.id, index: found.index + 2 };
  const next = doc.sections[at + 1];
  return next ? { sectionId: next.id, index: 0 } : null;
}

/**
 * Un bloque de dentro pasa a la columna o la tarjeta de al lado, a la misma altura de la lista (o al
 * final, si la otra es más corta). `null` si no está dentro de un contenedor o ya está en el borde.
 */
export function sideTarget(doc: ResourceDoc, blockId: string, direction: "left" | "right"): DropTarget | null {
  const found = findBlock(doc, blockId);
  if (!found?.parent) return null;
  const { container, cell } = found.parent;
  const cells = blockCells(container);
  const next = cell + (direction === "left" ? -1 : 1);
  if (next < 0 || next >= cells.length) return null;
  return { sectionId: found.section.id, containerId: container.id, cell: next, index: Math.min(found.index, cells[next].length) };
}

const MOVE_KEYS: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Alt+Mayús+↑/↓ mueven el bloque que tiene el foco; Alt+Mayús+←/→ lo pasan a la columna o la tarjeta de al lado. */
export function moveShortcut(event: Pick<KeyboardEvent, "key" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey">): "up" | "down" | "left" | "right" | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  return MOVE_KEYS[event.key] ?? null;
}

interface BlockBox {
  id: string;
  top: number;
  bottom: number;
}

/** Una columna o una tarjeta en pantalla: su caja y sus bloques. */
export interface CellLayout {
  containerId: string;
  cell: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  blocks: BlockBox[];
}

/** Dónde está cada sección y cada bloque en pantalla, de arriba abajo; un contenedor, con sus celdas. */
export interface SheetLayout {
  sections: Array<{
    id: string;
    top: number;
    /** Dónde termina la lista de bloques (arriba del botón de añadir). */
    end: number;
    blocks: Array<BlockBox & { cells?: CellLayout[] }>;
  }>;
}

/** Franja del borde de arriba y de abajo de un contenedor que cuenta como «encima» o «debajo» de él, no como dentro. */
export const CONTAINER_EDGE = 12;

/** Cuántos bloques de la lista tienen su mitad por encima de `y`. */
const slotIn = (blocks: readonly BlockBox[], y: number) => blocks.filter(block => y > (block.top + block.bottom) / 2).length;

/** Hasta dónde fuera de una celda (la separación entre columnas o tarjetas) el puntero todavía cuenta como dentro de ella. */
const CELL_REACH = 24;

/**
 * La celda bajo el punto o, en la separación entre dos, la más cercana. Lejos de todas (bajo las celdas,
 * donde el contenedor muestra un aviso o un formulario) no hay celda: el destino es encima o debajo del contenedor.
 */
function cellAt(cells: readonly CellLayout[], x: number, y: number): CellLayout | null {
  let best: CellLayout | null = null;
  let distance = CELL_REACH;
  for (const cell of cells) {
    const dx = x < cell.left ? cell.left - x : x > cell.right ? x - cell.right : 0;
    const dy = y < cell.top ? cell.top - y : y > cell.bottom ? y - cell.bottom : 0;
    const d = Math.hypot(dx, dy);
    if (d < distance) {
      best = cell;
      distance = d;
    }
  }
  return best;
}

/**
 * El hueco bajo el puntero: la sección que empieza más arriba de él y, dentro, cuántos bloques tiene
 * encima su mitad. Con `into`, un bloque que puede ir dentro de un contenedor cae en la columna o la
 * tarjeta bajo el puntero, salvo en la franja de arriba o de abajo del contenedor, que es «encima» o
 * «debajo» de él. Sin `into` (un contenedor, un salto de página), los contenedores cuentan enteros.
 */
export function dropTarget(layout: SheetLayout, y: number, x = 0, into = false): DropTarget | null {
  const sections = layout.sections;
  if (sections.length === 0) return null;
  let section = sections[0];
  for (const candidate of sections) if (y >= candidate.top) section = candidate;
  if (into) {
    const container = section.blocks.find(block => block.cells && block.cells.length > 0 && y >= block.top + CONTAINER_EDGE && y <= block.bottom - CONTAINER_EDGE);
    const cell = container?.cells && cellAt(container.cells, x, y);
    if (cell) return { sectionId: section.id, containerId: cell.containerId, cell: cell.cell, index: slotIn(cell.blocks, y) };
  }
  return { sectionId: section.id, index: slotIn(section.blocks, y) };
}

/** La celda de un destino dentro de un contenedor, para dibujar la línea a su ancho. */
export function targetCell(layout: SheetLayout, target: DropTarget): CellLayout | null {
  if (target.containerId === undefined) return null;
  const section = layout.sections.find(candidate => candidate.id === target.sectionId);
  const container = section?.blocks.find(block => block.id === target.containerId);
  return container?.cells?.find(cell => cell.cell === target.cell) ?? null;
}

/** Altura de la línea que marca el hueco: entre dos bloques, o un poco por fuera del primero o del último. En una celda vacía, a media altura. */
export function gapLine(layout: SheetLayout, target: DropTarget, outside = 6): number | null {
  let blocks: readonly BlockBox[];
  let empty: number;
  let margin = outside;
  if (target.containerId !== undefined) {
    const cell = targetCell(layout, target);
    if (!cell) return null;
    blocks = cell.blocks;
    empty = (cell.top + cell.bottom) / 2;
    margin = Math.min(outside, 3);
  } else {
    const section = layout.sections.find(candidate => candidate.id === target.sectionId);
    if (!section) return null;
    blocks = section.blocks;
    empty = section.end - outside;
  }
  if (blocks.length === 0) return empty;
  if (target.index <= 0) return blocks[0].top - margin;
  if (target.index >= blocks.length) return blocks[blocks.length - 1].bottom + margin;
  return (blocks[target.index - 1].bottom + blocks[target.index].top) / 2;
}

/**
 * Cuánto desplazar la hoja mientras se arrastra cerca de un borde: más rápido cuanto más cerca.
 * Negativo hacia arriba. `edge` es el ancho de la franja que activa el desplazamiento.
 */
export function autoScrollStep(y: number, top: number, bottom: number, edge = 56, max = 18): number {
  if (y < top + edge) return -Math.ceil(max * Math.min(1, (top + edge - y) / edge));
  if (y > bottom - edge) return Math.ceil(max * Math.min(1, (y - (bottom - edge)) / edge));
  return 0;
}

/* ───────────────────────── Atajos al escribir ───────────────────────── */

/**
 * «# », «## » o «### » al inicio de un párrafo lo vuelven título. La hoja tiene dos tamaños de
 * título: «#» y «##» dan el grande y «###» el mediano.
 */
export function headingShortcut(text: string): { level: 2 | 3; rest: string } | null {
  const match = /^(#{1,3}) ([^]*)$/.exec(text);
  if (!match) return null;
  return { level: match[1].length === 3 ? 3 : 2, rest: match[2] };
}

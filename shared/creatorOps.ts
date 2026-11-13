import {
  blockCells,
  blockPreview,
  collectIds,
  createId,
  CREATOR_LIMITS,
  escapeCurrency,
  findBlock,
  flattenBlocks,
  isContainer,
  mapBlockTexts,
  withCells,
  type Block,
  type BlockInput,
  type ContainerBlock,
  type ContainerType,
  type FoundBlock,
  type InnerBlock,
  type ResourceDoc,
  type Section,
  type SectionRole,
} from "./creator";
import { cellName, cellWidths, containerIssues, placementIssue } from "./creatorContainers";
import { sameJson } from "./creatorTurn";

/**
 * Operaciones sobre el documento. Son las mismas para la IA (cada herramienta del
 * agente es una operación) y para la edición manual del docente, así el documento
 * solo cambia por un camino. Todas son puras: reciben un documento y devuelven otro.
 *
 * Un bloque puede vivir en la lista de una sección o en la de una celda (una columna o una
 * tarjeta) de un contenedor. Las celdas se nombran por el id del contenedor y su posición
 * (`containerId` + `cell`); `sectionId` sigue siendo siempre la sección donde ocurre todo.
 */
export type DocOp =
  | { op: "set_meta"; title?: string; subtitle?: string }
  | { op: "write_section"; sectionId?: string; title: string; role: SectionRole; blocks: BlockInput[] }
  | { op: "update_section"; sectionId: string; title?: string; role?: SectionRole }
  | { op: "delete_section"; sectionId: string }
  /**
   * Inserta bloques en una lista: la de la sección o, con `containerId` y `cell`, la de una celda.
   * `afterBlockId` puede ser un bloque de dentro de una celda: los nuevos van en esa misma celda.
   */
  | { op: "insert_blocks"; sectionId: string; containerId?: string; cell?: number; afterBlockId?: string; at?: "start" | "end"; blocks: BlockInput[] }
  | { op: "update_block"; blockId: string; block: BlockInput }
  | { op: "delete_blocks"; blockIds: string[] }
  /** Un lugar arriba o abajo dentro de su propia lista (la sección o la celda). */
  | { op: "move_block"; blockId: string; direction: "up" | "down" }
  /**
   * Lleva un bloque a cualquier sitio del documento: otra sección, una celda, o fuera de su celda.
   * `index` es el hueco de destino contado con el bloque todavía en su sitio: 0 es antes del primer
   * bloque de la lista y `blocks.length`, después del último. Así lo calcula quien arrastra sin restar nada.
   */
  | { op: "move_block_to"; blockId: string; sectionId: string; containerId?: string; cell?: number; index: number }
  /** Inserta una copia del bloque justo debajo, con un id nuevo (un contenedor, con todo lo de dentro). */
  | { op: "duplicate_block"; blockId: string }
  | { op: "move_section"; sectionId: string; direction: "up" | "down" }
  /** Pone bloques seguidos de una sección en un contenedor: cada uno en su columna o en su tarjeta. */
  | { op: "wrap_blocks"; blockIds: string[]; as: ContainerType }
  /** Saca todo lo de un contenedor a la sección, en orden de lectura; el título de una tarjeta queda como un título. */
  | { op: "unwrap_container"; containerId: string }
  /** Añade una columna o una tarjeta vacía en la posición `at` (al final si se omite). */
  | { op: "add_cell"; containerId: string; at?: number }
  /** Quita una columna (sus bloques pasan a la vecina) o una tarjeta (con lo que tenga). */
  | { op: "remove_cell"; containerId: string; cell: number }
  /** Cambia los anchos de las columnas o cuántas tarjetas van por fila. */
  | { op: "set_layout"; containerId: string; widths?: number[]; perRow?: number }
  /** Cambia el título de una tarjeta; vacío lo quita. */
  | { op: "update_cell"; containerId: string; cell: number; title: string };

export type OpResult =
  | { ok: true; doc: ResourceDoc; changed: boolean; summary: string; ids: string[] }
  | { ok: false; error: string };

const fail = (error: string): OpResult => ({ ok: false, error });
const same = (doc: ResourceDoc, ids: string[], summary = "Sin cambios"): OpResult => ({ ok: true, doc, changed: false, summary, ids });

/** Normaliza el texto de un bloque antes de guardarlo (los signos de pesos no son fórmulas), también lo de dentro de un contenedor. */
export function normalizeBlock<T extends BlockInput>(block: T): T {
  const own = mapBlockTexts(block, escapeCurrency);
  if (!isContainer(own)) return own;
  return withCells(own, blockCells(own).map(cell => cell.map(inner => mapBlockTexts(inner, escapeCurrency)))) as T;
}

/** Un bloque nuevo con ids nuevos: el suyo y, si es un contenedor, los de todo lo de dentro. Un id que traiga se descarta. */
function withFreshIds(block: BlockInput, taken: Set<string>, random?: () => number): Block {
  const id = createId("b", taken, random);
  if (!isContainer(block)) return { ...block, id } as Block;
  const cells = blockCells(block).map(cell => cell.map(inner => ({ ...inner, id: createId("b", taken, random) }) as InnerBlock));
  return { ...withCells(block, cells), id } as Block;
}

function withIds(blocks: BlockInput[], taken: Set<string>, random?: () => number): Block[] {
  return blocks.map(block => withFreshIds(normalizeBlock(block), taken, random));
}

/**
 * Al reemplazar un contenedor por otro (la IA lo reescribe con update_block), lo de dentro conserva
 * sus ids: primero los bloques que quedaron idénticos (con su mismo objeto, para que el historial y las
 * marcas los reconozcan), luego los del mismo tipo en la misma celda y posición. El resto estrena id.
 */
function adoptInnerIds(next: BlockInput, previous: Block, id: string, taken: Set<string>, random?: () => number): Block {
  if (!isContainer(next)) return { ...next, id } as Block;
  const old = blockCells(previous);
  // Los ids de antes siguen apartados mientras se reparten: un id nuevo nunca coincide con uno que otro bloque va a reusar
  const free = new Set(old.flat());
  const strip = ({ id: _id, ...rest }: InnerBlock) => rest;
  const claim = (block: InnerBlock) => {
    free.delete(block);
    return block;
  };
  // Cada bloque de antes se reusa una sola vez: dos bloques nuevos idénticos no comparten el mismo
  const cells = blockCells(next).map(cell =>
    cell.map(inner => {
      const match = Array.from(free).find(candidate => sameJson(strip(candidate), inner));
      return match ? claim(match) : null;
    }),
  );
  const result = blockCells(next).map((cell, c) =>
    cell.map((inner, i) => {
      if (cells[c][i]) return cells[c][i]!;
      const positional = old[c]?.[i];
      if (positional && free.has(positional) && positional.type === inner.type) return { ...inner, id: claim(positional).id } as InnerBlock;
      return { ...inner, id: createId("b", taken, random) } as InnerBlock;
    }),
  );
  return { ...withCells(next, result), id } as Block;
}

const sectionNames = (doc: ResourceDoc) => doc.sections.map(section => `${section.id} ("${section.title}")`).join(", ") || "ninguna";

/* ───────────────────────── Listas: la de una sección o la de una celda ───────────────────────── */

interface List {
  sectionIndex: number;
  section: Section;
  /** El contenedor y su lugar en la sección cuando la lista es una celda. */
  container: ContainerBlock | null;
  containerIndex: number;
  cell: number;
  blocks: Block[];
}

const sectionList = (doc: ResourceDoc, sectionIndex: number): List => ({
  sectionIndex,
  section: doc.sections[sectionIndex],
  container: null,
  containerIndex: -1,
  cell: -1,
  blocks: doc.sections[sectionIndex].blocks,
});

const cellList = (doc: ResourceDoc, sectionIndex: number, containerIndex: number, cell: number): List => {
  const container = doc.sections[sectionIndex].blocks[containerIndex] as ContainerBlock;
  return { sectionIndex, section: doc.sections[sectionIndex], container, containerIndex, cell, blocks: blockCells(container)[cell] };
};

/** La lista donde vive un bloque encontrado. */
function listOf(doc: ResourceDoc, found: FoundBlock): List {
  const sectionIndex = doc.sections.indexOf(found.section);
  return found.parent ? cellList(doc, sectionIndex, found.parent.index, found.parent.cell) : sectionList(doc, sectionIndex);
}

/** El contenedor de primer nivel con este id, o el motivo por el que no se puede usar. */
function findContainer(doc: ResourceDoc, containerId: string): { found: FoundBlock & { block: ContainerBlock }; sectionIndex: number } | string {
  const found = findBlock(doc, containerId);
  if (!found) return `No existe el bloque ${containerId}.`;
  if (!isContainer(found.block)) return `El bloque ${containerId} no es un contenedor de columnas ni de tarjetas.`;
  return { found: found as FoundBlock & { block: ContainerBlock }, sectionIndex: doc.sections.indexOf(found.section) };
}

/** La lista de una sección, o de una celda de un contenedor de esa sección. */
function resolveList(doc: ResourceDoc, sectionId: string, containerId?: string, cell?: number): List | string {
  const sectionIndex = doc.sections.findIndex(section => section.id === sectionId);
  if (sectionIndex === -1) return `No existe la sección ${sectionId}. Secciones: ${sectionNames(doc)}.`;
  if (containerId === undefined) return sectionList(doc, sectionIndex);
  const container = findContainer(doc, containerId);
  if (typeof container === "string") return container;
  if (container.sectionIndex !== sectionIndex) return `El contenedor ${containerId} no está en la sección ${sectionId}.`;
  const cells = blockCells(container.found.block);
  if (cell === undefined || !Number.isInteger(cell) || cell < 0 || cell >= cells.length) {
    return `El contenedor ${containerId} tiene ${cells.length} ${container.found.block.type === "columns" ? "columnas" : "tarjetas"}: cell va de 0 a ${cells.length - 1}.`;
  }
  return cellList(doc, sectionIndex, container.found.index, cell);
}

/** El documento con otra lista de bloques en ese sitio; todo lo demás conserva sus objetos. */
function setList(doc: ResourceDoc, list: List, blocks: Block[]): ResourceDoc {
  let sectionBlocks: Block[];
  if (list.container) {
    const cells = blockCells(list.container).map((current, index) => (index === list.cell ? (blocks as InnerBlock[]) : current));
    const container = withCells(list.container, cells);
    sectionBlocks = list.section.blocks.map((block, index) => (index === list.containerIndex ? container : block));
  } else {
    sectionBlocks = blocks;
  }
  return { ...doc, sections: doc.sections.map((section, index) => (index === list.sectionIndex ? { ...section, blocks: sectionBlocks } : section)) };
}

/** Por qué no caben estos bloques en esa lista (cuántos y, en una celda, de qué tipo y ancho). */
function insertIssue(list: List, incoming: readonly BlockInput[]): string | null {
  if (!list.container) {
    if (list.blocks.length + incoming.length > CREATOR_LIMITS.blocksPerSectionMax) return `Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques.`;
    return null;
  }
  const where = cellName(list.container, list.cell);
  if (list.blocks.length + incoming.length > CREATOR_LIMITS.cellBlocksMax) return `En ${where} caben hasta ${CREATOR_LIMITS.cellBlocksMax} bloques.`;
  const width = cellWidths(list.container)[list.cell];
  for (const block of incoming) {
    const issue = placementIssue(block, width, where);
    if (issue) return issue;
  }
  return null;
}

const sameList = (a: List, b: List) => a.sectionIndex === b.sectionIndex && a.containerIndex === b.containerIndex && a.cell === b.cell;

/** Lo que dice el aviso cuando un cambio de forma deja algo que ya no cabe. */
const firstIssue = (container: BlockInput) => (isContainer(container) ? (containerIssues(container)[0] ?? null) : null);

/** Reemplaza un bloque de primer nivel de una sección por otros (uno o varios). */
function spliceSection(doc: ResourceDoc, sectionIndex: number, start: number, count: number, blocks: Block[]): ResourceDoc {
  const section = doc.sections[sectionIndex];
  const next = [...section.blocks.slice(0, start), ...blocks, ...section.blocks.slice(start + count)];
  return { ...doc, sections: doc.sections.map((current, index) => (index === sectionIndex ? { ...section, blocks: next } : current)) };
}

export function applyDocOp(doc: ResourceDoc, op: DocOp, random?: () => number): OpResult {
  const taken = collectIds(doc);

  switch (op.op) {
    case "set_meta": {
      const title = op.title?.trim() ?? doc.title;
      const subtitle = op.subtitle === undefined ? doc.subtitle : op.subtitle.trim() || undefined;
      const changed = title !== doc.title || subtitle !== doc.subtitle;
      return { ok: true, doc: { ...doc, title, subtitle }, changed, summary: changed ? `Título: «${title}»` : "Sin cambios en el título", ids: [] };
    }

    case "write_section": {
      if (op.blocks.length > CREATOR_LIMITS.blocksPerSectionMax) return fail(`Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques.`);
      const existing = op.sectionId ? doc.sections.findIndex(section => section.id === op.sectionId) : -1;
      if (op.sectionId && existing === -1) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}. Omite sectionId para crear una nueva.`);
      if (existing === -1 && doc.sections.length >= CREATOR_LIMITS.sectionsMax) return fail(`El recurso admite hasta ${CREATOR_LIMITS.sectionsMax} secciones.`);
      const shape = op.blocks.map(firstIssue).find(Boolean);
      if (shape) return fail(shape);

      if (existing !== -1) {
        // Al reescribir una sección sus bloques anteriores desaparecen y liberan sus ids
        for (const block of flattenBlocks(doc.sections[existing].blocks)) taken.delete(block.id);
        const section: Section = { ...doc.sections[existing], title: op.title.trim(), role: op.role, blocks: withIds(op.blocks, taken, random) };
        const sections = doc.sections.map((current, index) => (index === existing ? section : current));
        return { ok: true, doc: { ...doc, sections }, changed: true, summary: `Sección «${section.title}» actualizada`, ids: [section.id, ...section.blocks.map(b => b.id)] };
      }

      const section: Section = { id: createId("s", taken, random), title: op.title.trim(), role: op.role, blocks: withIds(op.blocks, taken, random) };
      return {
        ok: true,
        doc: { ...doc, sections: [...doc.sections, section] },
        changed: true,
        summary: `Sección «${section.title}» creada`,
        ids: [section.id, ...section.blocks.map(b => b.id)],
      };
    }

    case "update_section": {
      const index = doc.sections.findIndex(section => section.id === op.sectionId);
      if (index === -1) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      const current = doc.sections[index];
      const next: Section = { ...current, title: op.title?.trim() || current.title, role: op.role ?? current.role };
      const changed = next.title !== current.title || next.role !== current.role;
      const sections = doc.sections.map((section, i) => (i === index ? next : section));
      return { ok: true, doc: { ...doc, sections }, changed, summary: changed ? `Sección «${next.title}» actualizada` : `Sin cambios en «${current.title}»`, ids: [next.id] };
    }

    case "delete_section": {
      const target = doc.sections.find(section => section.id === op.sectionId);
      if (!target) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      return { ok: true, doc: { ...doc, sections: doc.sections.filter(section => section !== target) }, changed: true, summary: `Sección «${target.title}» eliminada`, ids: [] };
    }

    case "insert_blocks": {
      if (op.blocks.length === 0) return fail("No hay bloques para insertar.");
      let list: List;
      let position: number;
      if (op.afterBlockId) {
        const after = findBlock(doc, op.afterBlockId);
        if (!after || after.section.id !== op.sectionId) return fail(`El bloque ${op.afterBlockId} no está en la sección ${op.sectionId}.`);
        if (op.containerId !== undefined && (after.parent?.container.id !== op.containerId || (op.cell !== undefined && after.parent.cell !== op.cell))) {
          return fail(`El bloque ${op.afterBlockId} no está en ${op.cell === undefined ? "el contenedor" : `la celda ${op.cell} del contenedor`} ${op.containerId}.`);
        }
        list = listOf(doc, after);
        position = after.index + 1;
      } else {
        const resolved = resolveList(doc, op.sectionId, op.containerId, op.cell);
        if (typeof resolved === "string") return fail(resolved);
        list = resolved;
        position = op.at === "start" ? 0 : list.blocks.length;
      }
      const shape = op.blocks.map(firstIssue).find(Boolean);
      if (shape) return fail(shape);
      const issue = insertIssue(list, op.blocks);
      if (issue) return fail(issue);

      const inserted = withIds(op.blocks, taken, random);
      const blocks = [...list.blocks.slice(0, position), ...inserted, ...list.blocks.slice(position)];
      const summary = inserted.length === 1 ? `Bloque añadido en «${list.section.title}»` : `${inserted.length} bloques añadidos en «${list.section.title}»`;
      return { ok: true, doc: setList(doc, list, blocks), changed: true, summary, ids: inserted.map(b => b.id) };
    }

    case "update_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const normalized = normalizeBlock(op.block);
      if (found.parent) {
        const issue = placementIssue(normalized, cellWidths(found.parent.container)[found.parent.cell], cellName(found.parent.container, found.parent.cell));
        if (issue) return fail(issue);
      } else {
        const shape = firstIssue(normalized);
        if (shape) return fail(shape);
      }
      const next = adoptInnerIds(normalized, found.block, op.blockId, taken, random);
      const changed = !sameJson(next, found.block);
      const list = listOf(doc, found);
      // Sin cambios, el documento queda con sus mismos objetos
      if (!changed) return same(doc, [op.blockId], `Sin cambios en: ${blockPreview(found.block).slice(0, 60)}`);
      const blocks = list.blocks.map(block => (block.id === op.blockId ? next : block));
      const what = blockPreview(next).slice(0, 60);
      return { ok: true, doc: setList(doc, list, blocks), changed, summary: `Actualizado: ${what}`, ids: [op.blockId] };
    }

    case "delete_blocks": {
      const missing = op.blockIds.filter(blockId => !findBlock(doc, blockId));
      if (missing.length > 0) return fail(`No existen los bloques: ${missing.join(", ")}.`);
      if (op.blockIds.length === 0) return fail("No hay bloques para eliminar.");
      const remove = new Set(op.blockIds);
      const keep = (block: Block) => !remove.has(block.id);
      const sections = doc.sections.map(section => {
        const blocks = section.blocks.filter(keep).map(block => {
          if (!isContainer(block)) return block;
          const cells = blockCells(block);
          // Un contenedor que no pierde nada conserva su objeto
          if (!cells.some(cell => cell.some(inner => remove.has(inner.id)))) return block;
          return withCells(block, cells.map(cell => cell.filter(keep)));
        });
        return blocks.length === section.blocks.length && blocks.every((block, index) => block === section.blocks[index]) ? section : { ...section, blocks };
      });
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: remove.size === 1 ? "Bloque eliminado" : `${remove.size} bloques eliminados`, ids: [] };
    }

    case "move_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const list = listOf(doc, found);
      const target = found.index + (op.direction === "up" ? -1 : 1);
      if (target < 0 || target >= list.blocks.length) return same(doc, [op.blockId]);
      const blocks = [...list.blocks];
      [blocks[found.index], blocks[target]] = [blocks[target], blocks[found.index]];
      return { ok: true, doc: setList(doc, list, blocks), changed: true, summary: "Bloque movido", ids: [op.blockId] };
    }

    case "move_block_to": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      if (op.containerId === op.blockId) return fail("Un contenedor no puede ir dentro de sí mismo.");
      const target = resolveList(doc, op.sectionId, op.containerId, op.cell);
      if (typeof target === "string") return fail(target);
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > target.blocks.length) return fail(`La posición ${op.index} no existe en esa lista.`);
      const source = listOf(doc, found);
      const sameSpot = sameList(source, target);
      // Caer justo antes o justo después de sí mismo lo deja donde estaba
      if (sameSpot && (op.index === found.index || op.index === found.index + 1)) return same(doc, [op.blockId]);
      if (!sameSpot) {
        const issue = insertIssue(target, [found.block]);
        if (issue) return fail(issue);
      }

      // Quitarlo de su sitio corre una posición los huecos que quedan detrás de él
      const position = sameSpot && op.index > found.index ? op.index - 1 : op.index;
      // El bloque conserva su objeto: las marcas de la IA y el historial se guían por él
      const without = setList(doc, source, source.blocks.filter(block => block !== found.block));
      // Quitarlo pudo cambiar el contenedor o correr su lugar en la sección: la lista de destino se vuelve a buscar
      const again = resolveList(without, op.sectionId, op.containerId, op.cell) as List;
      const blocks = [...again.blocks];
      blocks.splice(position, 0, found.block);
      const moved = setList(without, again, blocks);
      const summary = target.section === source.section ? "Bloque movido" : `Bloque movido a «${target.section.title}»`;
      return { ok: true, doc: moved, changed: true, summary, ids: [op.blockId] };
    }

    case "duplicate_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const list = listOf(doc, found);
      const issue = insertIssue(list, [found.block]);
      if (issue) return fail(issue);
      // Copia honda con ids nuevos: la copia y el original no comparten listas que una edición pudiera tocar
      const copy = withFreshIds(structuredClone(found.block), taken, random);
      const blocks = [...list.blocks.slice(0, found.index + 1), copy, ...list.blocks.slice(found.index + 1)];
      return { ok: true, doc: setList(doc, list, blocks), changed: true, summary: "Bloque duplicado", ids: [copy.id] };
    }

    case "move_section": {
      const index = doc.sections.findIndex(section => section.id === op.sectionId);
      if (index === -1) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      const target = index + (op.direction === "up" ? -1 : 1);
      if (target < 0 || target >= doc.sections.length) return same(doc, [op.sectionId]);
      const sections = [...doc.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: `Sección «${sections[target].title}» movida`, ids: [op.sectionId] };
    }

    case "wrap_blocks": {
      const ids = Array.from(new Set(op.blockIds));
      const most = op.as === "columns" ? CREATOR_LIMITS.columnsMax : CREATOR_LIMITS.cardsMax;
      if (ids.length === 0) return fail("No hay bloques para agrupar.");
      if (ids.length > most) return fail(op.as === "columns" ? `Caben hasta ${most} columnas: agrupa como mucho ${most} bloques.` : `Caben hasta ${most} tarjetas.`);
      const found = ids.map(id => findBlock(doc, id));
      const missing = ids.filter((_, index) => !found[index]);
      if (missing.length > 0) return fail(`No existen los bloques: ${missing.join(", ")}.`);
      const blocks = (found as FoundBlock[]).sort((a, b) => a.index - b.index);
      if (blocks.some(item => item.parent)) return fail("Ese bloque ya está dentro de columnas o tarjetas.");
      if (blocks.some(item => item.section !== blocks[0].section)) return fail("Los bloques para agrupar deben estar en la misma sección.");
      if (blocks.some((item, index) => item.index !== blocks[0].index + index)) return fail("Los bloques para agrupar deben ir seguidos.");

      const cells = blocks.map(item => [item.block as InnerBlock]);
      const container =
        op.as === "columns"
          ? ({ type: "columns", columns: [...cells, ...(cells.length === 1 ? [[]] : [])].map(blocks => ({ width: 1, blocks })), id: createId("b", taken, random) } as ContainerBlock)
          : ({ type: "cards", perRow: cells.length >= 3 ? 3 : 2, cards: cells.map(blocks => ({ blocks })), id: createId("b", taken, random) } as ContainerBlock);
      const issue = blocks.map(item => placementIssue(item.block)).find(Boolean) ?? firstIssue(container);
      if (issue) return fail(issue);
      const sectionIndex = doc.sections.indexOf(blocks[0].section);
      const next = spliceSection(doc, sectionIndex, blocks[0].index, blocks.length, [container]);
      return { ok: true, doc: next, changed: true, summary: op.as === "columns" ? "Puesto en columnas" : "Puesto en tarjetas", ids: [container.id] };
    }

    case "unwrap_container": {
      const resolved = findContainer(doc, op.containerId);
      if (typeof resolved === "string") return fail(resolved);
      const { found, sectionIndex } = resolved;
      const container = found.block;
      // Nada se pierde: el título de cada tarjeta queda como un título encima de lo que guardaba
      const blocks: Block[] =
        container.type === "columns"
          ? container.columns.flatMap(column => column.blocks)
          : container.cards.flatMap(card => [...(card.title ? [{ type: "heading", text: card.title, level: 3, id: createId("b", taken, random) } as Block] : []), ...card.blocks]);
      if (found.section.blocks.length - 1 + blocks.length > CREATOR_LIMITS.blocksPerSectionMax) return fail(`Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques: no caben los de este contenedor.`);
      const next = spliceSection(doc, sectionIndex, found.index, 1, blocks);
      return { ok: true, doc: next, changed: true, summary: container.type === "columns" ? "Sacado de las columnas" : "Sacado de las tarjetas", ids: blocks.map(block => block.id) };
    }

    case "add_cell": {
      const resolved = findContainer(doc, op.containerId);
      if (typeof resolved === "string") return fail(resolved);
      const { found, sectionIndex } = resolved;
      const container = found.block;
      const count = blockCells(container).length;
      const at = op.at ?? count;
      if (!Number.isInteger(at) || at < 0 || at > count) return fail(`La posición ${at} no existe en el contenedor ${container.id}.`);
      let next: ContainerBlock;
      if (container.type === "columns") {
        if (count >= CREATOR_LIMITS.columnsMax) return fail(`Caben hasta ${CREATOR_LIMITS.columnsMax} columnas.`);
        const columns = [...container.columns.slice(0, at), { width: 1, blocks: [] }, ...container.columns.slice(at)];
        // Si los anchos ya no suman lo permitido, todas quedan iguales
        const total = columns.reduce((sum, column) => sum + column.width, 0);
        next = { ...container, columns: total > CREATOR_LIMITS.columnWidthsMax ? columns.map(column => ({ ...column, width: 1 })) : columns };
      } else {
        if (count >= CREATOR_LIMITS.cardsMax) return fail(`Caben hasta ${CREATOR_LIMITS.cardsMax} tarjetas.`);
        next = { ...container, cards: [...container.cards.slice(0, at), { blocks: [] }, ...container.cards.slice(at)] };
      }
      const issue = firstIssue(next);
      if (issue) return fail(`No se pudo añadir la columna. ${issue}`);
      return { ok: true, doc: spliceSection(doc, sectionIndex, found.index, 1, [next]), changed: true, summary: container.type === "columns" ? "Columna añadida" : "Tarjeta añadida", ids: [container.id] };
    }

    case "remove_cell": {
      const resolved = findContainer(doc, op.containerId);
      if (typeof resolved === "string") return fail(resolved);
      const { found, sectionIndex } = resolved;
      const container = found.block;
      const cells = blockCells(container);
      if (!Number.isInteger(op.cell) || op.cell < 0 || op.cell >= cells.length) return fail(`La celda ${op.cell} no existe en el contenedor ${container.id}.`);

      if (container.type === "columns") {
        if (cells.length <= CREATOR_LIMITS.columnsMin) return fail(`Unas columnas necesitan al menos ${CREATOR_LIMITS.columnsMin}. Para dejar sus bloques en la hoja, sácalos de las columnas.`);
        // Lo de la columna pasa a la vecina, en orden de lectura: a la anterior al final, o a la siguiente al principio
        const moved = cells[op.cell];
        const neighbour = op.cell === 0 ? 1 : op.cell - 1;
        const merged = op.cell === 0 ? [...moved, ...cells[1]] : [...cells[neighbour], ...moved];
        if (merged.length > CREATOR_LIMITS.cellBlocksMax) return fail(`No se puede quitar ${cellName(container, op.cell)}: sus bloques no caben en ${cellName(container, neighbour)} (hasta ${CREATOR_LIMITS.cellBlocksMax}).`);
        const columns = container.columns.flatMap((column, index) => (index === op.cell ? [] : [{ ...column, blocks: index === neighbour ? merged : column.blocks }]));
        const next: ContainerBlock = { ...container, columns };
        const issue = firstIssue(next);
        if (issue) return fail(`No se puede quitar ${cellName(container, op.cell)}. ${issue}`);
        const summary = moved.length > 0 ? `Columna quitada; sus bloques pasaron a la columna ${(op.cell === 0 ? 0 : neighbour) + 1}` : "Columna quitada";
        return { ok: true, doc: spliceSection(doc, sectionIndex, found.index, 1, [next]), changed: true, summary, ids: moved.length > 0 ? moved.map(block => block.id) : [container.id] };
      }

      if (cells.length <= 1) return fail("Las tarjetas necesitan al menos una. Para quitarlas todas, elimina el bloque de tarjetas.");
      const removed = container.cards[op.cell];
      const next: ContainerBlock = { ...container, cards: container.cards.filter((_, index) => index !== op.cell) };
      const count = removed.blocks.length;
      const summary = count > 0 ? `Tarjeta quitada con ${count === 1 ? "su bloque" : `sus ${count} bloques`}` : "Tarjeta quitada";
      return { ok: true, doc: spliceSection(doc, sectionIndex, found.index, 1, [next]), changed: true, summary, ids: [container.id] };
    }

    case "set_layout": {
      const resolved = findContainer(doc, op.containerId);
      if (typeof resolved === "string") return fail(resolved);
      const { found, sectionIndex } = resolved;
      const container = found.block;
      let next: ContainerBlock;
      if (container.type === "columns") {
        if (op.widths === undefined) return fail("Indica los anchos de las columnas (widths).");
        if (op.widths.length !== container.columns.length) return fail(`Hay ${container.columns.length} columnas: indica ${container.columns.length} anchos.`);
        if (op.widths.some(width => width !== 1 && width !== 2)) return fail("Cada ancho es 1 o 2.");
        next = { ...container, columns: container.columns.map((column, index) => ({ ...column, width: op.widths![index] })) };
      } else {
        const perRow = op.perRow;
        if (perRow === undefined || !Number.isInteger(perRow) || perRow < CREATOR_LIMITS.cardsPerRowMin || perRow > CREATOR_LIMITS.cardsPerRowMax) {
          return fail(`Las tarjetas van de ${CREATOR_LIMITS.cardsPerRowMin} a ${CREATOR_LIMITS.cardsPerRowMax} por fila (perRow).`);
        }
        next = { ...container, perRow };
      }
      if (sameJson(next, container)) return same(doc, [container.id]);
      const issue = firstIssue(next);
      if (issue) return fail(issue);
      const summary = next.type === "columns" ? "Anchos de las columnas cambiados" : `${next.perRow} tarjetas por fila`;
      return { ok: true, doc: spliceSection(doc, sectionIndex, found.index, 1, [next]), changed: true, summary, ids: [container.id] };
    }

    case "update_cell": {
      const resolved = findContainer(doc, op.containerId);
      if (typeof resolved === "string") return fail(resolved);
      const { found, sectionIndex } = resolved;
      const container = found.block;
      if (container.type !== "cards") return fail("Solo las tarjetas llevan título.");
      if (!Number.isInteger(op.cell) || op.cell < 0 || op.cell >= container.cards.length) return fail(`La tarjeta ${op.cell} no existe en el contenedor ${container.id}.`);
      const trimmed = op.title.trim();
      if (trimmed.length > CREATOR_LIMITS.cardTitleMax) return fail(`El título de una tarjeta admite hasta ${CREATOR_LIMITS.cardTitleMax} caracteres.`);
      const title = trimmed ? escapeCurrency(trimmed) : undefined;
      if ((container.cards[op.cell].title ?? undefined) === title) return same(doc, [container.id]);
      const cards = container.cards.map((card, index) => (index === op.cell ? { ...card, title } : card));
      const next: ContainerBlock = { ...container, cards };
      return { ok: true, doc: spliceSection(doc, sectionIndex, found.index, 1, [next]), changed: true, summary: `Título de la tarjeta ${op.cell + 1} cambiado`, ids: [container.id] };
    }
  }
}

import {
  blockPreview,
  collectIds,
  createId,
  CREATOR_LIMITS,
  escapeCurrency,
  findBlock,
  mapBlockTexts,
  type Block,
  type BlockInput,
  type ResourceDoc,
  type Section,
  type SectionRole,
} from "./creator";

/**
 * Operaciones sobre el documento. Son las mismas para la IA (cada herramienta del
 * agente es una operación) y para la edición manual del docente, así el documento
 * solo cambia por un camino. Todas son puras: reciben un documento y devuelven otro.
 */
export type DocOp =
  | { op: "set_meta"; title?: string; subtitle?: string }
  | { op: "write_section"; sectionId?: string; title: string; role: SectionRole; blocks: BlockInput[] }
  | { op: "update_section"; sectionId: string; title?: string; role?: SectionRole }
  | { op: "delete_section"; sectionId: string }
  | { op: "insert_blocks"; sectionId: string; afterBlockId?: string; at?: "start" | "end"; blocks: BlockInput[] }
  | { op: "update_block"; blockId: string; block: BlockInput }
  | { op: "delete_blocks"; blockIds: string[] }
  | { op: "move_block"; blockId: string; direction: "up" | "down" }
  /**
   * Lleva un bloque a cualquier sitio del documento, también a otra sección. `index` es el hueco de
   * destino contado con el bloque todavía en su sitio: 0 es antes del primer bloque de la sección y
   * `blocks.length`, después del último. Así lo calcula quien arrastra sin restar nada.
   */
  | { op: "move_block_to"; blockId: string; sectionId: string; index: number }
  /** Inserta una copia del bloque justo debajo, con un id nuevo. */
  | { op: "duplicate_block"; blockId: string }
  | { op: "move_section"; sectionId: string; direction: "up" | "down" };

export type OpResult =
  | { ok: true; doc: ResourceDoc; changed: boolean; summary: string; ids: string[] }
  | { ok: false; error: string };

const fail = (error: string): OpResult => ({ ok: false, error });

/** Normaliza el texto de un bloque antes de guardarlo (los signos de pesos no son fórmulas). */
export function normalizeBlock<T extends BlockInput>(block: T): T {
  return mapBlockTexts(block, escapeCurrency);
}

function withIds(blocks: BlockInput[], taken: Set<string>, random?: () => number): Block[] {
  return blocks.map(block => ({ ...normalizeBlock(block), id: createId("b", taken, random) }) as Block);
}

const sectionNames = (doc: ResourceDoc) => doc.sections.map(section => `${section.id} ("${section.title}")`).join(", ") || "ninguna";

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

      if (existing !== -1) {
        // Al reescribir una sección sus bloques anteriores desaparecen y liberan sus ids
        for (const block of doc.sections[existing].blocks) taken.delete(block.id);
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
      const index = doc.sections.findIndex(section => section.id === op.sectionId);
      if (index === -1) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      const section = doc.sections[index];
      if (op.blocks.length === 0) return fail("No hay bloques para insertar.");
      if (section.blocks.length + op.blocks.length > CREATOR_LIMITS.blocksPerSectionMax) return fail(`Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques.`);

      let position = op.at === "start" ? 0 : section.blocks.length;
      if (op.afterBlockId) {
        const after = section.blocks.findIndex(block => block.id === op.afterBlockId);
        if (after === -1) return fail(`El bloque ${op.afterBlockId} no está en la sección ${section.id}.`);
        position = after + 1;
      }
      const inserted = withIds(op.blocks, taken, random);
      const blocks = [...section.blocks.slice(0, position), ...inserted, ...section.blocks.slice(position)];
      const sections = doc.sections.map((current, i) => (i === index ? { ...section, blocks } : current));
      const summary = inserted.length === 1 ? `Bloque añadido en «${section.title}»` : `${inserted.length} bloques añadidos en «${section.title}»`;
      return { ok: true, doc: { ...doc, sections }, changed: true, summary, ids: inserted.map(b => b.id) };
    }

    case "update_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const next = { ...normalizeBlock(op.block), id: op.blockId } as Block;
      const changed = JSON.stringify(next) !== JSON.stringify(found.block);
      const sections = doc.sections.map(section =>
        section === found.section ? { ...section, blocks: section.blocks.map(block => (block.id === op.blockId ? next : block)) } : section,
      );
      const what = blockPreview(next).slice(0, 60);
      return { ok: true, doc: { ...doc, sections }, changed, summary: changed ? `Actualizado: ${what}` : `Sin cambios en: ${what}`, ids: [op.blockId] };
    }

    case "delete_blocks": {
      const missing = op.blockIds.filter(blockId => !findBlock(doc, blockId));
      if (missing.length > 0) return fail(`No existen los bloques: ${missing.join(", ")}.`);
      if (op.blockIds.length === 0) return fail("No hay bloques para eliminar.");
      const remove = new Set(op.blockIds);
      const sections = doc.sections.map(section => ({ ...section, blocks: section.blocks.filter(block => !remove.has(block.id)) }));
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: remove.size === 1 ? "Bloque eliminado" : `${remove.size} bloques eliminados`, ids: [] };
    }

    case "move_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const target = found.index + (op.direction === "up" ? -1 : 1);
      if (target < 0 || target >= found.section.blocks.length) return { ok: true, doc, changed: false, summary: "Sin cambios", ids: [op.blockId] };
      const blocks = [...found.section.blocks];
      [blocks[found.index], blocks[target]] = [blocks[target], blocks[found.index]];
      const sections = doc.sections.map(section => (section === found.section ? { ...section, blocks } : section));
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: "Bloque movido", ids: [op.blockId] };
    }

    case "move_block_to": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      const target = doc.sections.find(section => section.id === op.sectionId);
      if (!target) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > target.blocks.length) return fail(`La posición ${op.index} no existe en la sección ${target.id}.`);
      const same = target === found.section;
      // Caer justo antes o justo después de sí mismo lo deja donde estaba
      if (same && (op.index === found.index || op.index === found.index + 1)) return { ok: true, doc, changed: false, summary: "Sin cambios", ids: [op.blockId] };
      if (!same && target.blocks.length >= CREATOR_LIMITS.blocksPerSectionMax) return fail(`Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques.`);

      // Quitarlo de su sitio corre una posición los huecos que quedan detrás de él
      const position = same && op.index > found.index ? op.index - 1 : op.index;
      const sections = doc.sections.map(section => {
        if (section !== found.section && section !== target) return section;
        // El bloque conserva su objeto: las marcas de la IA y el historial se guían por él
        const blocks = section === found.section ? section.blocks.filter(block => block !== found.block) : [...section.blocks];
        if (section === target) blocks.splice(position, 0, found.block);
        return { ...section, blocks };
      });
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: same ? "Bloque movido" : `Bloque movido a «${target.title}»`, ids: [op.blockId] };
    }

    case "duplicate_block": {
      const found = findBlock(doc, op.blockId);
      if (!found) return fail(`No existe el bloque ${op.blockId}.`);
      if (found.section.blocks.length >= CREATOR_LIMITS.blocksPerSectionMax) return fail(`Una sección admite hasta ${CREATOR_LIMITS.blocksPerSectionMax} bloques.`);
      // Copia honda: la copia y el original no comparten listas que una edición pudiera tocar
      const copy = { ...structuredClone(found.block), id: createId("b", taken, random) } as Block;
      const blocks = [...found.section.blocks.slice(0, found.index + 1), copy, ...found.section.blocks.slice(found.index + 1)];
      const sections = doc.sections.map(section => (section === found.section ? { ...section, blocks } : section));
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: "Bloque duplicado", ids: [copy.id] };
    }

    case "move_section": {
      const index = doc.sections.findIndex(section => section.id === op.sectionId);
      if (index === -1) return fail(`No existe la sección ${op.sectionId}. Secciones: ${sectionNames(doc)}.`);
      const target = index + (op.direction === "up" ? -1 : 1);
      if (target < 0 || target >= doc.sections.length) return { ok: true, doc, changed: false, summary: "Sin cambios", ids: [op.sectionId] };
      const sections = [...doc.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ok: true, doc: { ...doc, sections }, changed: true, summary: `Sección «${sections[target].title}» movida`, ids: [op.sectionId] };
    }
  }
}

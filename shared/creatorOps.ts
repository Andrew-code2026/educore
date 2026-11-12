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
  | { op: "move_block"; blockId: string; direction: "up" | "down" };

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
  }
}

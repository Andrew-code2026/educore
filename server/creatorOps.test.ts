import { describe, expect, it } from "vitest";
import { blockInputSchema, collectIds, CREATOR_LIMITS, emptyDoc, type Block, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
import { reuseUnchanged } from "@shared/creatorTurn";

/** Generador determinista: los ids de las pruebas no dependen del azar. */
const seeded = () => {
  let state = 11;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

const ok = (result: OpResult) => {
  if (!result.ok) throw new Error(result.error);
  return result;
};

const paragraphs = (...texts: string[]) => texts.map(md => blockInputSchema.parse({ type: "paragraph", md }));

/** Dos secciones: «Guía» con A, B, C y «Clave» con X, Y. */
function twoSections(): ResourceDoc {
  const random = seeded();
  let doc = emptyDoc("Prueba");
  doc = ok(applyDocOp(doc, { op: "write_section", title: "Guía", role: "student", blocks: paragraphs("A", "B", "C") }, random)).doc;
  doc = ok(applyDocOp(doc, { op: "write_section", title: "Clave", role: "answer_key", blocks: paragraphs("X", "Y") }, random)).doc;
  return doc;
}

const texts = (doc: ResourceDoc) => doc.sections.map(section => section.blocks.map(block => (block.type === "paragraph" ? block.md : block.type)).join(""));
const blockId = (doc: ResourceDoc, text: string) => doc.sections.flatMap(section => section.blocks).find(block => block.type === "paragraph" && block.md === text)!.id;
const apply = (doc: ResourceDoc, op: DocOp) => ok(applyDocOp(doc, op));

describe("mover un bloque a cualquier sitio", () => {
  it("cuenta el hueco con el bloque todavía en su sitio, hacia arriba y hacia abajo", () => {
    const doc = twoSections();
    const guide = doc.sections[0].id;
    const a = blockId(doc, "A");
    const c = blockId(doc, "C");
    expect(texts(apply(doc, { op: "move_block_to", blockId: a, sectionId: guide, index: 3 }).doc)).toEqual(["BCA", "XY"]);
    expect(texts(apply(doc, { op: "move_block_to", blockId: a, sectionId: guide, index: 2 }).doc)).toEqual(["BAC", "XY"]);
    expect(texts(apply(doc, { op: "move_block_to", blockId: c, sectionId: guide, index: 0 }).doc)).toEqual(["CAB", "XY"]);
    expect(texts(apply(doc, { op: "move_block_to", blockId: c, sectionId: guide, index: 1 }).doc)).toEqual(["ACB", "XY"]);
  });

  it("soltarlo justo antes o justo después de sí mismo no cambia nada", () => {
    const doc = twoSections();
    const b = blockId(doc, "B");
    for (const index of [1, 2]) {
      const result = apply(doc, { op: "move_block_to", blockId: b, sectionId: doc.sections[0].id, index });
      expect(result.changed).toBe(false);
      expect(result.doc).toBe(doc);
    }
  });

  it("pasa a otra sección, al inicio, en medio o al final", () => {
    const doc = twoSections();
    const key = doc.sections[1].id;
    const b = blockId(doc, "B");
    expect(texts(apply(doc, { op: "move_block_to", blockId: b, sectionId: key, index: 0 }).doc)).toEqual(["AC", "BXY"]);
    expect(texts(apply(doc, { op: "move_block_to", blockId: b, sectionId: key, index: 1 }).doc)).toEqual(["AC", "XBY"]);
    const last = apply(doc, { op: "move_block_to", blockId: b, sectionId: key, index: 2 });
    expect(texts(last.doc)).toEqual(["AC", "XYB"]);
    expect(last.summary).toBe("Bloque movido a «Clave»");
  });

  it("conserva el objeto del bloque movido y de las secciones que no toca", () => {
    let doc = twoSections();
    doc = apply(doc, { op: "write_section", title: "Anexo", role: "student", blocks: paragraphs("Z") }).doc;
    const b = doc.sections[0].blocks[1];
    const result = apply(doc, { op: "move_block_to", blockId: b.id, sectionId: doc.sections[1].id, index: 0 });
    expect(result.doc.sections[1].blocks[0]).toBe(b);
    expect(result.doc.sections[2]).toBe(doc.sections[2]);
    expect(result.doc.sections[0].blocks[0]).toBe(doc.sections[0].blocks[0]);
    // Lo que llega del servidor después se reconcilia con estos mismos objetos
    expect(reuseUnchanged(result.doc, structuredClone(result.doc))).toBe(result.doc);
  });

  it("rechaza posiciones, bloques y secciones que no existen", () => {
    const doc = twoSections();
    const a = blockId(doc, "A");
    const guide = doc.sections[0].id;
    expect(applyDocOp(doc, { op: "move_block_to", blockId: a, sectionId: guide, index: 4 }).ok).toBe(false);
    expect(applyDocOp(doc, { op: "move_block_to", blockId: a, sectionId: guide, index: -1 }).ok).toBe(false);
    expect(applyDocOp(doc, { op: "move_block_to", blockId: a, sectionId: guide, index: 1.5 }).ok).toBe(false);
    expect(applyDocOp(doc, { op: "move_block_to", blockId: "bnoexis", sectionId: guide, index: 0 }).ok).toBe(false);
    const missing = applyDocOp(doc, { op: "move_block_to", blockId: a, sectionId: "snoexis", index: 0 });
    expect(!missing.ok && missing.error).toContain("Secciones:");
  });

  it("no pasa del máximo de bloques de la sección de destino, aunque sí reordena dentro de una llena", () => {
    let doc = twoSections();
    const key = doc.sections[1].id;
    const fill = paragraphs(...Array.from({ length: CREATOR_LIMITS.blocksPerSectionMax - 2 }, (_, index) => `relleno ${index}`));
    doc = apply(doc, { op: "insert_blocks", sectionId: key, blocks: fill }).doc;
    expect(doc.sections[1].blocks).toHaveLength(CREATOR_LIMITS.blocksPerSectionMax);
    expect(applyDocOp(doc, { op: "move_block_to", blockId: blockId(doc, "A"), sectionId: key, index: 0 }).ok).toBe(false);
    expect(apply(doc, { op: "move_block_to", blockId: blockId(doc, "X"), sectionId: key, index: 3 }).changed).toBe(true);
  });
});

describe("duplicar un bloque", () => {
  it("inserta una copia justo debajo con un id nuevo", () => {
    const doc = twoSections();
    const b = doc.sections[0].blocks[1];
    const result = apply(doc, { op: "duplicate_block", blockId: b.id });
    const blocks = result.doc.sections[0].blocks;
    expect(texts(result.doc)).toEqual(["ABBC", "XY"]);
    expect(blocks[1]).toBe(b);
    expect(blocks[2].id).not.toBe(b.id);
    expect(result.ids).toEqual([blocks[2].id]);
    expect(collectIds(doc).has(blocks[2].id)).toBe(false);
    // Ids únicos en todo el documento
    const ids = [...result.doc.sections.map(section => section.id), ...result.doc.sections.flatMap(section => section.blocks.map(block => block.id))];
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.doc.sections[1]).toBe(doc.sections[1]);
  });

  it("la copia no comparte listas con el original", () => {
    const random = seeded();
    const doc = ok(
      applyDocOp(
        emptyDoc("Tabla"),
        { op: "write_section", title: "Guía", role: "student", blocks: [blockInputSchema.parse({ type: "table", header: ["x", "y"], rows: [["1", "2"]], firstColumnHeader: false })] },
        random,
      ),
    ).doc;
    const original = doc.sections[0].blocks[0] as Extract<Block, { type: "table" }>;
    const copy = apply(doc, { op: "duplicate_block", blockId: original.id }).doc.sections[0].blocks[1] as Extract<Block, { type: "table" }>;
    expect(copy).toEqual({ ...original, id: copy.id });
    expect(copy.rows).not.toBe(original.rows);
    expect(copy.rows[0]).not.toBe(original.rows[0]);
    expect(copy.header).not.toBe(original.header);
  });

  it("usa el generador de ids que recibe y respeta el máximo de la sección", () => {
    const doc = twoSections();
    const b = blockId(doc, "B");
    const first = ok(applyDocOp(doc, { op: "duplicate_block", blockId: b }, seeded()));
    const again = ok(applyDocOp(doc, { op: "duplicate_block", blockId: b }, seeded()));
    expect(first.ids).toEqual(again.ids);

    const full = apply(doc, { op: "insert_blocks", sectionId: doc.sections[1].id, blocks: paragraphs(...Array.from({ length: CREATOR_LIMITS.blocksPerSectionMax - 2 }, () => "r")) }).doc;
    expect(applyDocOp(full, { op: "duplicate_block", blockId: blockId(full, "X") }).ok).toBe(false);
    expect(applyDocOp(doc, { op: "duplicate_block", blockId: "bnoexis" }).ok).toBe(false);
  });
});

describe("mover una sección", () => {
  it("la sube y la baja un puesto, y en los extremos no cambia nada", () => {
    let doc = twoSections();
    doc = apply(doc, { op: "write_section", title: "Anexo", role: "student", blocks: paragraphs("Z") }).doc;
    const [guide, , annex] = doc.sections;
    const titles = (next: ResourceDoc) => next.sections.map(section => section.title);

    const up = apply(doc, { op: "move_section", sectionId: annex.id, direction: "up" });
    expect(titles(up.doc)).toEqual(["Guía", "Anexo", "Clave"]);
    expect(up.doc.sections[0]).toBe(guide);
    expect(up.doc.sections[1]).toBe(annex);
    expect(up.summary).toBe("Sección «Anexo» movida");

    expect(titles(apply(doc, { op: "move_section", sectionId: guide.id, direction: "down" }).doc)).toEqual(["Clave", "Guía", "Anexo"]);
    for (const op of [
      { op: "move_section", sectionId: guide.id, direction: "up" },
      { op: "move_section", sectionId: annex.id, direction: "down" },
    ] as const) {
      const result = apply(doc, op);
      expect(result.changed).toBe(false);
      expect(result.doc).toBe(doc);
    }
  });

  it("explica cuando la sección no existe", () => {
    const result = applyDocOp(twoSections(), { op: "move_section", sectionId: "snoexis", direction: "up" });
    expect(!result.ok && result.error).toContain("Secciones:");
  });
});

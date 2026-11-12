import { describe, expect, it } from "vitest";
import type { ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp } from "@shared/creatorOps";
import { buildSampleDoc } from "@shared/creatorSample";
import { emptyHistory, historyKey, historyShortcut, locateChange, recordStep, redoStep, undoStep, type DocHistory } from "./docHistory";

const apply = (doc: ResourceDoc, op: DocOp) => {
  const result = applyDocOp(doc, op);
  if (!result.ok) throw new Error(result.error);
  return result.doc;
};

/** Aplica una edición registrándola como lo hace el editor. */
const edit = (state: { doc: ResourceDoc; history: DocHistory }, op: DocOp, at = 0) => ({
  doc: apply(state.doc, op),
  history: recordStep(state.history, state.doc, { key: historyKey(op), at }),
});

const sample = () => buildSampleDoc("funciones");

describe("historial del documento", () => {
  it("deshace y rehace un borrado, un movimiento y el título en orden", () => {
    const start = sample();
    const section = start.sections[0];
    const [first, second] = section.blocks;
    let state = { doc: start, history: emptyHistory };
    state = edit(state, { op: "move_block", blockId: first.id, direction: "down" }, 0);
    state = edit(state, { op: "delete_blocks", blockIds: [second.id] }, 5000);
    state = edit(state, { op: "set_meta", title: "Otro título" }, 10000);
    expect(state.history.past).toHaveLength(3);

    const steps: ResourceDoc[] = [];
    let current = state;
    for (let index = 0; index < 3; index++) {
      const undone = undoStep(current.history, current.doc);
      if (!undone) throw new Error("sin pasos");
      current = undone;
      steps.push(undone.doc);
    }
    expect(steps[0].title).not.toBe("Otro título");
    expect(steps[1].sections[0].blocks.map(block => block.id)).toContain(second.id);
    // Tras deshacer todo se vuelve exactamente al documento de partida
    expect(steps[2]).toBe(start);
    expect(undoStep(current.history, current.doc)).toBeNull();

    const redone = redoStep(current.history, current.doc);
    expect(redone?.doc.sections[0].blocks[1].id).toBe(first.id);
  });

  it("una edición nueva descarta lo que se podía rehacer", () => {
    const start = sample();
    let state = edit({ doc: start, history: emptyHistory }, { op: "set_meta", title: "Uno" }, 0);
    const undone = undoStep(state.history, state.doc)!;
    expect(undone.history.future).toHaveLength(1);
    state = edit({ doc: undone.doc, history: undone.history }, { op: "set_meta", subtitle: "Dos" }, 5000);
    expect(state.history.future).toHaveLength(0);
    expect(redoStep(state.history, state.doc)).toBeNull();
  });

  it("funde ediciones seguidas del mismo bloque, no las de bloques distintos ni las espaciadas", () => {
    const start = sample();
    const [first, second] = start.sections[0].blocks;
    const retext = (id: string, block: (typeof start.sections)[number]["blocks"][number], text: string): DocOp => ({ op: "update_block", blockId: id, block: { ...block, ...("text" in block ? { text } : {}) } as never });
    let state = { doc: start, history: emptyHistory };
    state = edit(state, retext(first.id, first, "a"), 0);
    state = edit(state, retext(first.id, first, "ab"), 400);
    state = edit(state, retext(first.id, first, "abc"), 900);
    expect(state.history.past).toHaveLength(1);
    // Deshacer el grupo vuelve al documento de antes de la primera edición
    expect(undoStep(state.history, state.doc)!.doc).toBe(start);
    state = edit(state, retext(second.id, second, "x"), 1000);
    expect(state.history.past).toHaveLength(2);
    state = edit(state, retext(second.id, second, "xy"), 5000);
    expect(state.history.past).toHaveLength(3);
  });

  it("guarda como mucho el tope de pasos", () => {
    let history = emptyHistory;
    const doc = sample();
    for (let index = 0; index < 130; index++) history = recordStep(history, { ...doc, title: `v${index}` }, { at: index * 10_000, limit: 100 });
    expect(history.past).toHaveLength(100);
    expect(history.past[0].doc.title).toBe("v30");
  });

  it("las instantáneas comparten los bloques que no cambiaron", () => {
    const start = sample();
    const [first] = start.sections[0].blocks;
    const next = apply(start, { op: "delete_blocks", blockIds: [first.id] });
    expect(next.sections[0].blocks[0]).toBe(start.sections[0].blocks[1]);
    // Las demás secciones conservan sus bloques tal cual
    const last = start.sections.length - 1;
    expect(start.sections.length).toBeGreaterThan(1);
    next.sections[last].blocks.forEach((block, index) => expect(block).toBe(start.sections[last].blocks[index]));
  });
});

describe("dónde quedó el cambio", () => {
  it("ubica el borrado en su sección aunque no sea la primera", () => {
    const start = sample();
    const section = start.sections[start.sections.length - 1];
    const after = apply(start, { op: "delete_blocks", blockIds: [section.blocks[0].id] });
    expect(locateChange(after, start)).toEqual({ sectionId: section.id, blockIndex: 0 });
  });

  it("ubica el bloque que vuelve al deshacer un borrado", () => {
    const start = sample();
    const target = start.sections[0].blocks[2];
    const after = apply(start, { op: "delete_blocks", blockIds: [target.id] });
    expect(locateChange(after, start)).toEqual({ sectionId: start.sections[0].id, blockIndex: 2 });
  });

  it("ubica un movimiento y un borrado al final de la sección", () => {
    const start = sample();
    const blocks = start.sections[0].blocks;
    const moved = apply(start, { op: "move_block", blockId: blocks[1].id, direction: "down" });
    expect(locateChange(start, moved)).toEqual({ sectionId: start.sections[0].id, blockIndex: 1 });
    const last = blocks[blocks.length - 1];
    const trimmed = apply(start, { op: "delete_blocks", blockIds: [last.id] });
    expect(locateChange(start, trimmed)).toEqual({ sectionId: start.sections[0].id, blockIndex: blocks.length - 2 });
  });

  it("reconoce un cambio de título y la ausencia de cambios", () => {
    const start = sample();
    expect(locateChange(start, apply(start, { op: "set_meta", title: "Nuevo" }))).toEqual({ sectionId: null, blockIndex: null });
    expect(locateChange(start, start)).toBeNull();
  });
});

describe("atajos del historial", () => {
  const key = (key: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) =>
    historyShortcut({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

  it("reconoce deshacer y rehacer en Windows y Mac", () => {
    expect(key("z", { ctrlKey: true })).toBe("undo");
    expect(key("z", { metaKey: true })).toBe("undo");
    expect(key("Z", { ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(key("Z", { metaKey: true, shiftKey: true })).toBe("redo");
    expect(key("y", { ctrlKey: true })).toBe("redo");
  });

  it("ignora lo que no es un atajo del historial", () => {
    expect(key("z")).toBeNull();
    expect(key("z", { ctrlKey: true, altKey: true })).toBeNull();
    expect(key("y", { metaKey: true })).toBeNull();
    expect(key("c", { ctrlKey: true })).toBeNull();
  });
});

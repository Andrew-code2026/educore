import { describe, expect, it } from "vitest";
import { parseDoc, type CreatorChatMessage, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp } from "@shared/creatorOps";
import { buildSampleDoc } from "@shared/creatorSample";
import { diffTurn } from "@shared/creatorTurn";
import { emptyHistory, historyKey, locateChange, peekUndo, recordStep, recordTurn, redoStep, undoStep, type DocHistory } from "./docHistory";
import { acceptMark, isReviewVisible, lastTurnMessage, pendingMarks, readStoredReview, startReview, storeReview } from "./turnReview";

const apply = (doc: ResourceDoc, op: DocOp) => {
  const result = applyDocOp(doc, op);
  if (!result.ok) throw new Error(result.error);
  return result;
};
const fresh = (doc: ResourceDoc) => parseDoc(JSON.stringify(doc));
const paragraph = (md: string) => ({ type: "paragraph" as const, md });

/** Un turno de la IA: cambia un bloque, añade otro y borra un tercero. Devuelve el documento como llega del servidor. */
function aiTurn(before: ResourceDoc) {
  const [first, second, third] = before.sections[0].blocks;
  let doc = apply(before, { op: "update_block", blockId: second.id, block: paragraph("Reescrito por la IA") }).doc;
  const inserted = apply(doc, { op: "insert_blocks", sectionId: before.sections[0].id, afterBlockId: first.id, blocks: [paragraph("Nuevo")] });
  doc = apply(inserted.doc, { op: "delete_blocks", blockIds: [third.id] }).doc;
  return { server: fresh(doc), changedId: second.id, addedId: inserted.ids[0] };
}

/** Lo que hace el editor al terminar el turno. */
function finishTurn(history: DocHistory, before: ResourceDoc) {
  const turn = aiTurn(before);
  const result = recordTurn(history, before, turn.server, 1000);
  const review = startReview(42, diffTurn(before, result.doc), result.doc);
  return { ...turn, ...result, review };
}

describe("el turno de la IA en el historial de deshacer", () => {
  it("entra como un solo paso, por muchas operaciones que haya hecho", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    expect(turn.history.past).toHaveLength(1);
    expect(peekUndo(turn.history)).toBe(before);

    const undone = undoStep(turn.history, turn.doc);
    expect(undone?.doc).toBe(before);
    const redone = redoStep(undone!.history, undone!.doc);
    expect(redone?.doc).toBe(turn.doc);
  });

  it("conserva los pasos anteriores: se puede seguir deshaciendo lo que hizo el docente antes del turno", () => {
    const start = buildSampleDoc("funciones");
    const op: DocOp = { op: "set_meta", title: "Título del docente" };
    const before = apply(start, op).doc;
    const history = recordStep(emptyHistory, start, { key: historyKey(op), at: 0 });
    const turn = finishTurn(history, before);

    const first = undoStep(turn.history, turn.doc)!;
    expect(first.doc).toBe(before);
    expect(undoStep(first.history, first.doc)?.doc).toBe(start);
  });

  it("no deja paso si el turno no cambió el documento", () => {
    const before = buildSampleDoc("funciones");
    const result = recordTurn(emptyHistory, before, fresh(before), 0);
    expect(result.doc).toBe(before);
    expect(result.history).toBe(emptyHistory);
  });

  it("un recurso escrito desde cero no deja paso: deshacer no lo vacía", () => {
    const written = buildSampleDoc("funciones");
    const empty: ResourceDoc = { title: "Guía nueva", sections: [] };
    const history = recordStep(emptyHistory, { title: "", sections: [] }, { key: "meta", at: 0 });
    const result = recordTurn(history, empty, fresh(written), 1000);
    expect(result.doc).toEqual(written);
    expect(result.history).toBe(emptyHistory);
    expect(undoStep(result.history, result.doc)).toBeNull();
  });

  it("una edición hecha justo después no se funde con el turno", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const op: DocOp = { op: "update_block", blockId: turn.changedId, block: paragraph("Retocado por el docente") };
    const history = recordStep(turn.history, turn.doc, { key: historyKey(op), at: 1001 });
    expect(history.past).toHaveLength(2);
  });

  it("al deshacer sabe dónde quedó el cambio", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    // Sin reutilizar los objetos de antes, todo el documento parecería cambiado y la vista saltaría al primer bloque
    expect(locateChange(turn.doc, before)).toEqual({ sectionId: before.sections[0].id, blockId: before.sections[0].blocks[1].id });
  });
});

describe("marcas de lo que cambió la IA", () => {
  it("marca lo añadido y lo cambiado, en el orden de la hoja", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    expect(pendingMarks(turn.review, turn.doc)).toEqual([
      { id: turn.addedId, kind: "added" },
      { id: turn.changedId, kind: "changed" },
    ]);
    expect(turn.review.changes.removed).toBe(1);
    expect(pendingMarks(null, turn.doc)).toEqual([]);
  });

  it("la marca se quita al editar ese bloque y las demás siguen", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const edited = apply(turn.doc, { op: "update_block", blockId: turn.changedId, block: paragraph("Retocado por el docente") }).doc;
    expect(pendingMarks(turn.review, edited)).toEqual([{ id: turn.addedId, kind: "added" }]);
    // Editar otro bloque no quita ninguna
    const other = before.sections[0].blocks[4];
    const elsewhere = apply(turn.doc, { op: "update_block", blockId: other.id, block: paragraph("Otro bloque") }).doc;
    expect(pendingMarks(turn.review, elsewhere)).toHaveLength(2);
  });

  it("se quita al borrar el bloque y no se pierde al moverlo", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const deleted = apply(turn.doc, { op: "delete_blocks", blockIds: [turn.addedId] }).doc;
    expect(pendingMarks(turn.review, deleted)).toEqual([{ id: turn.changedId, kind: "changed" }]);
    const moved = apply(turn.doc, { op: "move_block", blockId: turn.addedId, direction: "down" }).doc;
    expect(pendingMarks(turn.review, moved).map(mark => mark.id)).toEqual([turn.changedId, turn.addedId]);
  });

  it("desaparecen al deshacer el turno y vuelven al rehacerlo", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const undone = undoStep(turn.history, turn.doc)!;
    const pending = pendingMarks(turn.review, undone.doc);
    expect(pending).toEqual([]);
    expect(isReviewVisible(turn.review, undone.doc, pending)).toBe(false);

    const redone = redoStep(undone.history, undone.doc)!;
    expect(pendingMarks(turn.review, redone.doc)).toHaveLength(2);
  });

  it("aceptar una marca la quita; aceptar la última cierra la revisión", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const one = acceptMark(turn.review, turn.addedId)!;
    expect(pendingMarks(one, turn.doc)).toEqual([{ id: turn.changedId, kind: "changed" }]);
    expect(acceptMark(one, "bnoexiste")).toBe(one);
    expect(acceptMark(one, turn.changedId)).toBeNull();
  });

  it("un turno que solo borró no deja marcas, pero su resumen sigue hasta que el documento cambie", () => {
    const before = buildSampleDoc("funciones");
    const after = recordTurn(emptyHistory, before, fresh(apply(before, { op: "delete_blocks", blockIds: [before.sections[0].blocks[2].id] }).doc), 0).doc;
    const review = startReview(7, diffTurn(before, after), after);
    expect(pendingMarks(review, after)).toEqual([]);
    expect(isReviewVisible(review, after, [])).toBe(true);
    expect(isReviewVisible(review, before, [])).toBe(false);
    expect(isReviewVisible(null, after, [])).toBe(false);
  });
});

describe("la revisión al recargar la página", () => {
  it("recupera solo las marcas que seguían pendientes", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const accepted = acceptMark(turn.review, turn.addedId)!;
    const stored = readStoredReview(JSON.stringify(storeReview(accepted, turn.doc, pendingMarks(accepted, turn.doc))));
    expect(stored).toEqual({ messageId: 42, pending: [turn.changedId], intact: true });

    // Tras recargar, el documento es otra copia y los cambios vienen del mensaje guardado
    const reloaded = fresh(turn.doc);
    const review = startReview(42, turn.review.changes, reloaded, stored!);
    expect(pendingMarks(review, reloaded)).toEqual([{ id: turn.changedId, kind: "changed" }]);
    expect(review.after).toBe(reloaded);
  });

  it("si el documento ya no estaba como lo dejó la IA, no lo da por intacto", () => {
    const before = buildSampleDoc("funciones");
    const turn = finishTurn(emptyHistory, before);
    const edited = apply(turn.doc, { op: "update_block", blockId: turn.changedId, block: paragraph("Retocado") }).doc;
    const stored = storeReview(turn.review, edited, pendingMarks(turn.review, edited));
    expect(stored).toEqual({ messageId: 42, pending: [turn.addedId], intact: false });
    const reloaded = fresh(edited);
    const review = startReview(42, turn.review.changes, reloaded, stored);
    expect(review.after).toBeNull();
    expect(pendingMarks(review, reloaded)).toEqual([{ id: turn.addedId, kind: "added" }]);
  });

  it("ignora lo guardado si está dañado", () => {
    expect(readStoredReview(null)).toBeNull();
    expect(readStoredReview("{")).toBeNull();
    expect(readStoredReview('{"messageId":"x","pending":[]}')).toBeNull();
    expect(readStoredReview('{"messageId":3,"pending":["b1",4]}')).toEqual({ messageId: 3, pending: ["b1"], intact: false });
  });
});

describe("la respuesta que se puede deshacer desde el chat", () => {
  const message = (id: number, role: "user" | "assistant", turn = false): CreatorChatMessage => ({
    id,
    role,
    content: "",
    activity: [],
    createdAt: new Date(),
    ...(turn ? { turn: { baseVersion: id, added: [], changed: ["b1"], removed: 0, meta: false } } : {}),
  });

  it("es la última de la IA que cambió el recurso", () => {
    expect(lastTurnMessage([message(1, "user"), message(2, "assistant", true), message(3, "user"), message(4, "assistant", true), message(5, "user"), message(6, "assistant")])?.id).toBe(4);
    expect(lastTurnMessage([message(1, "user"), message(2, "assistant")])).toBeNull();
    expect(lastTurnMessage([])).toBeNull();
  });
});

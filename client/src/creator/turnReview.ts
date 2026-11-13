import { findBlock, flattenBlocks, type Block, type CreatorChatMessage, type ResourceDoc } from "@shared/creator";
import type { TurnChanges } from "@shared/creatorTurn";

/**
 * Revisión del último turno de la IA: qué bloques quedan marcados en la hoja.
 *
 * Una marca vale mientras el bloque sea exactamente el que dejó la IA (el mismo objeto). Así se
 * quita sola cuando el docente edita o borra el bloque o deshace el turno, y vuelve si lo rehace,
 * sin llevar la cuenta de cada edición.
 */
export type MarkKind = "added" | "changed";

export interface TurnMark {
  id: string;
  kind: MarkKind;
}

export interface TurnReview {
  /** Respuesta de la IA a la que pertenecen los cambios. */
  messageId: number;
  changes: TurnChanges;
  /** El documento tal como lo dejó la IA, o `null` si esta ventana ya no lo tiene (tras recargar con ediciones encima). */
  after: ResourceDoc | null;
  marks: ReadonlyMap<string, { block: Block; kind: MarkKind }>;
}

/** Lo que se guarda de una revisión para que sobreviva a recargar la página. */
export interface StoredReview {
  messageId: number;
  pending: string[];
  /** El documento seguía tal como lo dejó la IA. */
  intact: boolean;
}

/** Abre la revisión de un turno sobre el documento que dejó. Con `stored`, solo quedan las marcas que seguían pendientes. */
export function startReview(messageId: number, changes: TurnChanges, doc: ResourceDoc, stored?: StoredReview): TurnReview {
  const only = stored ? new Set(stored.pending) : null;
  const marks = new Map<string, { block: Block; kind: MarkKind }>();
  const add = (ids: string[], kind: MarkKind) => {
    for (const id of ids) {
      if (only && !only.has(id)) continue;
      const found = findBlock(doc, id);
      if (found) marks.set(id, { block: found.block, kind });
    }
  };
  add(changes.added, "added");
  add(changes.changed, "changed");
  return { messageId, changes, after: !stored || stored.intact ? doc : null, marks };
}

/** Las marcas que siguen vigentes, en el orden de la hoja. */
export function pendingMarks(review: TurnReview | null, doc: ResourceDoc): TurnMark[] {
  if (!review || review.marks.size === 0) return [];
  const pending: TurnMark[] = [];
  for (const section of doc.sections) {
    for (const block of flattenBlocks(section.blocks)) {
      const mark = review.marks.get(block.id);
      if (mark && mark.block === block) pending.push({ id: block.id, kind: mark.kind });
    }
  }
  return pending;
}

/** El docente dio por visto un bloque. Devuelve `null` cuando ya no queda ninguno por ver. */
export function acceptMark(review: TurnReview, blockId: string): TurnReview | null {
  if (!review.marks.has(blockId)) return review;
  const marks = new Map(review.marks);
  marks.delete(blockId);
  return marks.size === 0 ? null : { ...review, marks };
}

/** El resumen se muestra mientras quede algo marcado o el documento siga tal como lo dejó la IA (un turno que solo borró no deja marcas). */
export const isReviewVisible = (review: TurnReview | null, doc: ResourceDoc, pending: TurnMark[]): boolean => review !== null && (pending.length > 0 || review.after === doc);

export const storeReview = (review: TurnReview, doc: ResourceDoc, pending: TurnMark[]): StoredReview => ({ messageId: review.messageId, pending: pending.map(mark => mark.id), intact: review.after === doc });

export function readStoredReview(raw: string | null): StoredReview | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredReview> | null;
    if (!value || typeof value.messageId !== "number" || !Array.isArray(value.pending)) return null;
    return { messageId: value.messageId, pending: value.pending.filter((id): id is string => typeof id === "string"), intact: value.intact === true };
  } catch {
    return null;
  }
}

/** La última respuesta de la IA que cambió el recurso: la única que ofrece «Deshacer» en el chat. */
export function lastTurnMessage(messages: readonly CreatorChatMessage[]): CreatorChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant" && messages[index].turn) return messages[index];
  }
  return null;
}

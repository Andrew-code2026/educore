import { useCallback, useMemo, useRef, useState } from "react";
import type { ResourceDoc } from "@shared/creator";
import type { DocOp } from "@shared/creatorOps";
import { reuseUnchanged } from "@shared/creatorTurn";

/**
 * Deshacer y rehacer de todo el documento. Cada paso guarda el documento completo, que es
 * barato porque `applyDocOp` conserva la identidad de las secciones y bloques que no cambian.
 */
export const HISTORY_LIMIT = 100;

/** Ediciones seguidas del mismo bloque (o del título) en este margen cuentan como un solo paso. */
export const HISTORY_MERGE_MS = 1000;

interface Step {
  doc: ResourceDoc;
  /** Qué se editó, para fundir ediciones seguidas de lo mismo. */
  key?: string;
  at: number;
}

export interface DocHistory {
  past: Step[];
  future: Step[];
}

export const emptyHistory: DocHistory = { past: [], future: [] };

/** Las ediciones de texto de un mismo bloque se funden; mover, insertar o borrar son pasos propios. */
export function historyKey(op: DocOp): string | undefined {
  if (op.op === "update_block") return `block:${op.blockId}`;
  if (op.op === "set_meta") return "meta";
  return undefined;
}

/** Antes de aplicar una edición: el documento anterior entra a la pila de deshacer y se pierde lo rehecho. */
export function recordStep(history: DocHistory, before: ResourceDoc, options: { key?: string; at: number; limit?: number; mergeMs?: number }): DocHistory {
  const { key, at, limit = HISTORY_LIMIT, mergeMs = HISTORY_MERGE_MS } = options;
  const last = history.past[history.past.length - 1];
  // Tras deshacer no se funde: el documento actual debe poder recuperarse con su propio paso
  if (key && last?.key === key && at - last.at < mergeMs && history.future.length === 0) {
    // Se conserva el documento de antes de la primera edición del grupo
    return { past: [...history.past.slice(0, -1), { ...last, at }], future: [] };
  }
  const past = [...history.past, { doc: before, key, at }];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

export function undoStep(history: DocHistory, current: ResourceDoc, at = 0): { history: DocHistory; doc: ResourceDoc } | null {
  const last = history.past[history.past.length - 1];
  if (!last) return null;
  return { doc: last.doc, history: { past: history.past.slice(0, -1), future: [...history.future, { doc: current, at }] } };
}

export function redoStep(history: DocHistory, current: ResourceDoc, at = 0): { history: DocHistory; doc: ResourceDoc } | null {
  const next = history.future[history.future.length - 1];
  if (!next) return null;
  return { doc: next.doc, history: { past: [...history.past, { doc: current, at }], future: history.future.slice(0, -1) } };
}

/** El documento al que volvería el próximo «deshacer», sin sacarlo de la pila. */
export const peekUndo = (history: DocHistory): ResourceDoc | null => history.past[history.past.length - 1]?.doc ?? null;

/**
 * Al terminar un turno de la IA, el documento de antes entra al historial como un solo paso: deshacer
 * devuelve la hoja a como estaba antes del turno, por muchas operaciones que haya hecho la IA.
 * `after` llega del servidor como copia nueva; se devuelve con los objetos de `before` en lo que no
 * cambió, y si no cambió nada el historial queda igual.
 */
export function recordTurn(history: DocHistory, before: ResourceDoc, after: ResourceDoc, at: number): { history: DocHistory; doc: ResourceDoc } {
  const doc = reuseUnchanged(before, after);
  return doc === before ? { history, doc } : { doc, history: recordStep(history, before, { at }) };
}

/** Dónde quedó el cambio entre dos documentos, medido en `to`. `sectionId: null` es el título; `blockId: null`, la sección entera. */
export type ChangeLocation = { sectionId: string | null; blockId: string | null };

export function locateChange(from: ResourceDoc, to: ResourceDoc): ChangeLocation | null {
  for (const section of to.sections) {
    const previous = from.sections.find(candidate => candidate.id === section.id);
    if (!previous) return { sectionId: section.id, blockId: null };
    // Borrar bloques copia todas las secciones: lo que cuenta es si cambiaron sus bloques o su encabezado
    const sameBlocks = previous.blocks.length === section.blocks.length && previous.blocks.every((block, position) => block === section.blocks[position]);
    if (previous === section || (sameBlocks && previous.title === section.title && previous.role === section.role)) continue;
    const index = section.blocks.findIndex((block, position) => block !== previous.blocks[position]);
    // Si se quitaron bloques del final, el cambio queda junto al último que sigue; si no hay diferencia en los bloques, cambió el encabezado
    const at = index !== -1 ? index : section.blocks.length < previous.blocks.length ? section.blocks.length - 1 : -1;
    return { sectionId: section.id, blockId: section.blocks[at]?.id ?? null };
  }
  const removed = from.sections.findIndex(section => !to.sections.some(candidate => candidate.id === section.id));
  if (removed !== -1 && to.sections.length > 0) return { sectionId: to.sections[Math.min(removed, to.sections.length - 1)].id, blockId: null };
  if (from.title !== to.title || from.subtitle !== to.subtitle) return { sectionId: null, blockId: null };
  return null;
}

export type HistoryCommand = "undo" | "redo";

/** Ctrl/Cmd+Z deshace; Ctrl/Cmd+Shift+Z y Ctrl+Y rehacen. */
export function historyShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): HistoryCommand | null {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && event.ctrlKey && !event.shiftKey) return "redo";
  return null;
}

/** Pilas de deshacer y rehacer del editor. Las funciones son estables entre renders. */
export function useDocHistory() {
  const history = useRef<DocHistory>(emptyHistory);
  const [sizes, setSizes] = useState({ past: 0, future: 0 });

  const commit = useCallback((next: DocHistory) => {
    history.current = next;
    setSizes(current => (current.past === next.past.length && current.future === next.future.length ? current : { past: next.past.length, future: next.future.length }));
  }, []);

  const record = useCallback((before: ResourceDoc, key?: string) => commit(recordStep(history.current, before, { key, at: Date.now() })), [commit]);

  const undo = useCallback(
    (current: ResourceDoc) => {
      const result = undoStep(history.current, current, Date.now());
      if (!result) return null;
      commit(result.history);
      return result.doc;
    },
    [commit],
  );

  const redo = useCallback(
    (current: ResourceDoc) => {
      const result = redoStep(history.current, current, Date.now());
      if (!result) return null;
      commit(result.history);
      return result.doc;
    },
    [commit],
  );

  const clear = useCallback(() => commit(emptyHistory), [commit]);

  /** Registra un turno de la IA como un paso y devuelve el documento que debe mostrarse. */
  const turn = useCallback(
    (before: ResourceDoc, after: ResourceDoc) => {
      const result = recordTurn(history.current, before, after, Date.now());
      commit(result.history);
      return result.doc;
    },
    [commit],
  );

  const peek = useCallback(() => peekUndo(history.current), []);

  /** ¿Se llegaría a este documento rehaciendo? Es decir: ya se deshizo más allá de él. */
  const ahead = useCallback((doc: ResourceDoc) => history.current.future.some(step => step.doc === doc), []);

  return useMemo(() => ({ canUndo: sizes.past > 0, canRedo: sizes.future > 0, record, undo, redo, clear, turn, peek, ahead }), [ahead, clear, peek, record, redo, sizes, turn, undo]);
}

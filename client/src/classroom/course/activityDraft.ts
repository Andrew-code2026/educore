import type { Draft } from '../types';

/**
 * Borrador del creador de actividades: valores iniciales, fecha límite y validación.
 * Sin dependencias de React para poder probarse aislado.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-31" en hora local (no UTC, que corre el día en Colombia). */
export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Borrador vacío con fecha límite en una semana a las 23:59. */
export function emptyDraft(now: Date = new Date()): Draft {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  return { name: '', description: '', due: toDateInput(due), dueTime: '23:59', graded: true };
}

/** Fecha límite en hora local; un "AAAA-MM-DD" suelto se interpretaría en UTC y caería el día anterior. */
export const dueDateOf = (draft: Draft) => new Date(`${draft.due}T${draft.dueTime || '23:59'}:00`);

export interface DraftErrors {
  name?: string;
  due?: string;
}

export function validateDraft(draft: Draft, now: Date = new Date()): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.name.trim().length < 3) errors.name = 'Escribe un título de al menos 3 caracteres.';
  const due = dueDateOf(draft);
  if (!draft.due || Number.isNaN(due.getTime())) errors.due = 'Elige una fecha límite.';
  else if (due <= now) errors.due = 'La fecha límite debe ser posterior a este momento.';
  return errors;
}

/** Hay algo escrito que se perdería al cerrar. */
export const isDraftDirty = (draft: Draft, initial: Draft) =>
  draft.name.trim() !== initial.name.trim() || draft.description.trim() !== initial.description.trim();

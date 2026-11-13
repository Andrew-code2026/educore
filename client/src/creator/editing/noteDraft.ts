import { isFigure, type BlockInput } from "@shared/creator";
import { clampPoint, defaultPointer, FIGURE_NOTES_MAX, newNotePosition, type FigureNote, type NotePoint } from "@shared/creatorFigureNotes";

/** Las notas del borrador (ninguna si el bloque no es una figura). */
export const draftNotes = (draft: BlockInput): readonly FigureNote[] => (isFigure(draft) ? (draft.notes ?? []) : []);

/** El borrador con estas notas. Sin notas el campo no se escribe: el bloque queda como uno de antes. */
export function withNotes(draft: BlockInput, notes: readonly FigureNote[]): BlockInput {
  if (!isFigure(draft)) return draft;
  const { notes: _old, ...rest } = draft;
  return (notes.length > 0 ? { ...rest, notes: [...notes] } : rest) as BlockInput;
}

const changeNote = (draft: BlockInput, index: number, change: (note: FigureNote) => FigureNote) =>
  withNotes(
    draft,
    draftNotes(draft).map((note, i) => (i === index ? change(note) : note)),
  );

/** Mueve una nota, o el punto que señala, a un lugar de la caja. */
export const moveNote = (draft: BlockInput, index: number, part: "note" | "pointer", to: NotePoint) =>
  changeNote(draft, index, note => (part === "pointer" ? (note.pointer ? { ...note, pointer: clampPoint(to) } : note) : { ...note, ...clampPoint(to) }));

export const setNoteText = (draft: BlockInput, index: number, text: string) => changeNote(draft, index, note => ({ ...note, text }));

/** Pone o quita la línea que une la nota con el punto que señala. */
export const toggleNotePointer = (draft: BlockInput, index: number) =>
  changeNote(draft, index, ({ pointer, ...note }) => (pointer ? note : { ...note, pointer: defaultPointer(note) }));

/** Añade una nota en un sitio libre. Devuelve el borrador igual si ya está en el tope. */
export function addNote(draft: BlockInput, text = "Nota"): BlockInput {
  const notes = draftNotes(draft);
  if (!isFigure(draft) || notes.length >= FIGURE_NOTES_MAX) return draft;
  return withNotes(draft, [...notes, { text, ...newNotePosition(notes) }]);
}

export const removeNote = (draft: BlockInput, index: number) =>
  withNotes(
    draft,
    draftNotes(draft).filter((_, i) => i !== index),
  );

/** Por qué no se pueden guardar las notas: una vacía. */
export function notesIssue(draft: BlockInput): string | null {
  const empty = draftNotes(draft).findIndex(note => !note.text.trim());
  return empty < 0 ? null : `La nota ${empty + 1} está vacía: escribe su texto o quítala.`;
}

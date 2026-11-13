import { createContext, useContext, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { arrowStep, movePoint, pointInBox, type FigureNote, type NotePoint } from "@shared/creatorFigureNotes";
import { plainText } from "@shared/creator";
import { cn } from "@/lib/utils";
import { RichText } from "./RichText";

/** Las notas de la figura que se está dibujando (las pone `Figure` en BlockView). */
export const FigureNotesContext = createContext<readonly FigureNote[] | undefined>(undefined);

/** La nota o el punto que señala: lo que se arrastra. */
export type NotePart = "note" | "pointer";

/** Lo que la hoja le pasa a la figura que se edita en el panel: elegir y mover sus notas. */
export interface NoteEditing {
  selected: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, part: NotePart, to: NotePoint) => void;
}

export const NoteEditingContext = createContext<NoteEditing | null>(null);

/** Si la figura lleva notas: su caja pasa a medir el texto de ellas (ver `.crt-figure[data-notes]`). */
export const useHasNotes = () => (useContext(FigureNotesContext)?.length ?? 0) > 0;

const at = (point: NotePoint): CSSProperties => ({ left: `${point.x * 100}%`, top: `${point.y * 100}%` });

/**
 * Las notas del docente sobre una figura, en su caja: posición relativa, letra que crece y se achica con
 * la figura, y una línea hasta el punto que señalan. En el bloque que se edita se arrastran con el
 * puntero o se mueven con las flechas (Mayús, en pasos largos).
 */
export function FigureNotes() {
  const notes = useContext(FigureNotesContext);
  const editing = useContext(NoteEditingContext);
  if (!notes?.length) return null;

  /** Arrastra la nota (o su punto) dentro de la caja de la figura, desde donde se tomó. */
  const drag = (index: number, part: NotePart) => (event: PointerEvent<HTMLElement>) => {
    if (!editing || event.button !== 0) return;
    const handle = event.currentTarget;
    const box = handle.closest<HTMLElement>(".crt-figure, .crt-plane")?.getBoundingClientRect();
    const note = notes[index];
    const start = part === "pointer" ? note.pointer : note;
    if (!box || !start) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    editing.onSelect(index);
    const grab = { x: event.clientX - (box.left + start.x * box.width), y: event.clientY - (box.top + start.y * box.height) };
    handle.setPointerCapture(event.pointerId);
    const move = (moved: globalThis.PointerEvent) => editing.onMove(index, part, pointInBox(moved.clientX - grab.x, moved.clientY - grab.y, box));
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  const nudge = (index: number, part: NotePart) => (event: KeyboardEvent<HTMLElement>) => {
    const step = editing && arrowStep(event.key, event.shiftKey);
    const from = part === "pointer" ? notes[index].pointer : notes[index];
    if (!step || !from) return;
    event.preventDefault();
    event.stopPropagation();
    editing.onMove(index, part, movePoint(from, step));
  };

  return (
    <div className={cn("crt-notes", editing && "is-editing")}>
      {notes.some(note => note.pointer) && (
        <svg className="crt-notes__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {notes.map((note, index) => note.pointer && <line key={index} x1={note.x * 100} y1={note.y * 100} x2={note.pointer.x * 100} y2={note.pointer.y * 100} vectorEffect="non-scaling-stroke" />)}
        </svg>
      )}
      {notes.map((note, index) => {
        if (!note.pointer) return null;
        if (!editing) return <span key={`dot-${index}`} className="crt-note__dot" style={at(note.pointer)} aria-hidden="true" />;
        return (
          <button
            key={`dot-${index}`}
            type="button"
            className={cn("crt-note__dot", editing.selected === index && "is-selected")}
            style={at(note.pointer)}
            aria-label={`Punto que señala la nota ${index + 1}. Arrástralo o muévelo con las flechas.`}
            onPointerDown={drag(index, "pointer")}
            onKeyDown={nudge(index, "pointer")}
            onFocus={() => editing.onSelect(index)}
          />
        );
      })}
      {notes.map((note, index) =>
        editing ? (
          <button
            key={index}
            type="button"
            className={cn("crt-note", editing.selected === index && "is-selected")}
            style={at(note)}
            aria-label={`Nota ${index + 1}: «${plainText(note.text, 60)}». Arrástrala o muévela con las flechas.`}
            onPointerDown={drag(index, "note")}
            onKeyDown={nudge(index, "note")}
            onFocus={() => editing.onSelect(index)}
          >
            <RichText md={note.text} inline />
          </button>
        ) : (
          <span key={index} className="crt-note" style={at(note)}>
            <RichText md={note.text} inline />
          </span>
        ),
      )}
    </div>
  );
}

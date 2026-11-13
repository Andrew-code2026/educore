import { describe, expect, it } from "vitest";
import type { BlockInput } from "@shared/creator";
import { FIGURE_NOTES_MAX } from "@shared/creatorFigureNotes";
import { checkDraft } from "./BlockForm";
import { addNote, draftNotes, moveNote, notesIssue, removeNote, setNoteText, toggleNotePointer, withNotes } from "./noteDraft";

const chart = { type: "pie_chart", slices: [{ label: "A", value: 1 }, { label: "B", value: 1 }], showPercent: true, blank: false } as BlockInput;

describe("notas en el borrador del panel", () => {
  it("añadir, escribir, mover y quitar", () => {
    let draft = addNote(chart);
    expect(draftNotes(draft)).toHaveLength(1);
    draft = setNoteText(draft, 0, "La mitad");
    draft = moveNote(draft, 0, "note", { x: 0.31234, y: 1.4 });
    expect(draftNotes(draft)[0]).toEqual({ text: "La mitad", x: 0.312, y: 1 });
    draft = removeNote(draft, 0);
    // Sin notas, el campo no se escribe: el bloque queda como uno de antes
    expect("notes" in draft).toBe(false);
  });

  it("la línea al punto se pone y se quita, y el punto se mueve solo si la nota la tiene", () => {
    let draft = addNote(chart);
    expect(moveNote(draft, 0, "pointer", { x: 0.1, y: 0.1 })).toEqual(draft);
    draft = toggleNotePointer(draft, 0);
    expect(draftNotes(draft)[0].pointer).toBeDefined();
    draft = moveNote(draft, 0, "pointer", { x: 0.2, y: 0.3 });
    expect(draftNotes(draft)[0].pointer).toEqual({ x: 0.2, y: 0.3 });
    expect(draftNotes(toggleNotePointer(draft, 0))[0].pointer).toBeUndefined();
  });

  it("no pasa del tope ni añade notas a lo que no es una figura", () => {
    let draft = chart;
    for (let i = 0; i < FIGURE_NOTES_MAX + 2; i++) draft = addNote(draft);
    expect(draftNotes(draft)).toHaveLength(FIGURE_NOTES_MAX);
    const table = { type: "table", header: ["a"], rows: [["1"]], firstColumnHeader: false } as BlockInput;
    expect(addNote(table)).toBe(table);
    expect(withNotes(table, [{ text: "x", x: 0, y: 0 }])).toBe(table);
  });

  it("una nota vacía se avisa en palabras del docente y no se aplica", () => {
    const draft = setNoteText(addNote(addNote(chart)), 1, "  ");
    expect(notesIssue(draft)).toBe("La nota 2 está vacía: escribe su texto o quítala.");
    expect(checkDraft(draft)).toEqual({ ok: false, issues: ["La nota 2 está vacía: escribe su texto o quítala."] });
    expect(checkDraft(setNoteText(draft, 1, "Otra")).ok).toBe(true);
  });
});

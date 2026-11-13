import { describe, expect, it } from "vitest";
import { blockInputSchema, blockTexts, findBlock, type Block, type BlockInput, type ResourceDoc } from "@shared/creator";
import { arrowStep, clampUnit, defaultPointer, FIGURE_NOTES_MAX, movePoint, newNotePosition, pointInBox } from "@shared/creatorFigureNotes";
import { keepFigureLayout, keepSectionLayout, normalizeBlock } from "@shared/creatorOps";
import { validateBlock } from "@shared/creatorValidate";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const bars = (extra: Record<string, unknown> = {}): BlockInput =>
  ({
    type: "bar_chart",
    bars: [
      { label: "A", value: 3 },
      { label: "B", value: 5 },
    ],
    showValues: true,
    blank: false,
    ...extra,
  }) as BlockInput;
const clock = (extra: Record<string, unknown> = {}): BlockInput => ({ type: "clock", clocks: [{ hour: 7, minute: 30 }], showHands: true, showTime: false, ...extra }) as BlockInput;
const notes = [{ text: "Vértice", x: 0.3, y: 0.6, pointer: { x: 0.5, y: 0.8 } }, { text: "Eje", x: 0.5, y: 0.1 }];
const notesOf = (block: BlockInput | Block | undefined) => (block && "notes" in block ? block.notes : undefined);

describe("posición de las notas", () => {
  it("se guarda como fracción de la caja, dentro de ella y sin decimales de más", () => {
    expect(clampUnit(0.12345)).toBe(0.123);
    expect(clampUnit(-0.2)).toBe(0);
    expect(clampUnit(1.7)).toBe(1);
    expect(clampUnit(Number.NaN)).toBe(0.5);
  });

  it("un punto de la pantalla cae en su lugar de la caja, y lo de fuera se lleva al borde", () => {
    const box = { left: 100, top: 50, width: 400, height: 200 };
    expect(pointInBox(300, 150, box)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointInBox(0, 400, box)).toEqual({ x: 0, y: 1 });
    expect(pointInBox(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it("las flechas mueven un paso corto, y uno largo con Mayús", () => {
    expect(arrowStep("ArrowRight", false)).toEqual({ x: 0.01, y: 0 });
    expect(arrowStep("ArrowUp", true)).toEqual({ x: 0, y: -0.05 });
    expect(arrowStep("Enter", false)).toBeNull();
    expect(movePoint({ x: 0.99, y: 0.5 }, { x: 0.05, y: 0 })).toEqual({ x: 1, y: 0.5 });
  });

  it("una nota nueva va a una esquina libre", () => {
    const first = newNotePosition([]);
    const second = newNotePosition([first]);
    expect(second).not.toEqual(first);
    const all = Array.from({ length: 5 }).reduce<Array<{ x: number; y: number }>>(placed => [...placed, newNotePosition(placed)], []);
    expect(new Set(all.map(point => `${point.x},${point.y}`)).size).toBe(5);
  });

  it("el punto que señala una nota nueva queda dentro de la caja, hacia el centro", () => {
    const pointer = defaultPointer({ x: 0.9, y: 0.1 });
    expect(pointer.x).toBeLessThan(0.9);
    expect(pointer.y).toBeGreaterThan(0.1);
    expect(defaultPointer({ x: 0.5, y: 0.95 }).y).toBeLessThan(0.95);
  });
});

describe("campo de notas", () => {
  it("es opcional y común a todas las figuras", () => {
    expect(notesOf(blockInputSchema.parse(bars()))).toBeUndefined();
    expect(notesOf(blockInputSchema.parse(bars({ notes })))).toEqual(notes);
    expect(notesOf(blockInputSchema.parse(clock({ notes })))).toEqual(notes);
    expect(notesOf(blockInputSchema.parse({ type: "graph", spec: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, xStep: 1, yStep: 1, functions: [], points: [] }, notes }))).toEqual(notes);
    // Una tabla no lleva notas
    expect("notes" in blockInputSchema.parse({ type: "table", header: ["a"], rows: [["1"]], notes })).toBe(false);
  });

  it("tiene un tope, notas cortas y posiciones dentro de la caja", () => {
    const many = Array.from({ length: FIGURE_NOTES_MAX + 1 }, (_, index) => ({ text: `n${index}`, x: 0.5, y: 0.5 }));
    expect(blockInputSchema.safeParse(bars({ notes: many })).success).toBe(false);
    expect(blockInputSchema.safeParse(bars({ notes: [{ text: "x".repeat(81), x: 0.5, y: 0.5 }] })).success).toBe(false);
    expect(blockInputSchema.safeParse(bars({ notes: [{ text: "  ", x: 0.5, y: 0.5 }] })).success).toBe(false);
    expect(blockInputSchema.safeParse(bars({ notes: [{ text: "Fuera", x: 1.2, y: 0.5 }] })).success).toBe(false);
  });

  it("su texto se valida y se normaliza como el resto: fórmulas y signos de pesos", () => {
    expect(blockTexts(bars({ notes }))).toEqual(expect.arrayContaining(["Vértice", "Eje"]));
    expect(notesOf(normalizeBlock(bars({ notes: [{ text: "Cuesta $2.900", x: 0.5, y: 0.5 }] })))?.[0].text).toBe("Cuesta \\$2.900");
    expect(validateBlock(bars({ notes: [{ text: "$\\frac{1}{2$", x: 0.5, y: 0.5 }] })).join(" ")).toMatch(/LaTeX|fórmula/i);
  });
});

describe("la IA no escribe notas y conserva las del docente", () => {
  const doc = (blocks: Block[]): ResourceDoc => ({ title: "Prueba", sections: [{ id: "s1", title: "Guía", role: "student", blocks }] });

  it("sus herramientas no tienen el campo", () => {
    const serialized = JSON.stringify(CREATOR_TOOLS);
    expect(serialized).not.toContain("figure_notes");
    expect(serialized).not.toContain('"notes"');
  });

  it("al reescribir la figura quedan las del docente, aunque la IA mande otras o ninguna", () => {
    const previous = { ...bars({ notes, size: "large" }), id: "b1" } as Block;
    expect(notesOf(keepFigureLayout(previous, bars({ showValues: false })))).toEqual(notes);
    expect(notesOf(keepFigureLayout(previous, bars({ notes: [{ text: "De la IA", x: 0.1, y: 0.1 }] })))).toEqual(notes);
    // Otra figura: las notas ya no señalan nada y se van; el tamaño sigue
    const other = keepFigureLayout(previous, clock());
    expect(notesOf(other)).toBeUndefined();
    expect(other).toMatchObject({ size: "large" });
  });

  it("en un contenedor reescrito, las conserva cada figura que sigue en su sitio", () => {
    const previous = { type: "columns", id: "c1", columns: [{ width: 2, blocks: [{ ...bars({ notes }), id: "b1" }] }, { width: 1, blocks: [{ type: "paragraph", md: "x", id: "b2" }] }] } as Block;
    const next = { type: "columns", columns: [{ width: 2, blocks: [bars({ showValues: false })] }, { width: 1, blocks: [bars({ notes: [{ text: "IA", x: 0.2, y: 0.2 }] })] }] } as BlockInput;
    const kept = keepFigureLayout(previous, next) as { columns: Array<{ blocks: BlockInput[] }> };
    expect(notesOf(kept.columns[0].blocks[0])).toEqual(notes);
    expect(notesOf(kept.columns[1].blocks[0])).toBeUndefined();
  });

  it("al reescribir una sección, cada figura toma las de la que ocupaba su lugar, por tipo y en orden", () => {
    const previous = [{ ...bars({ notes: [notes[0]] }), id: "b1" }, { ...clock({ notes: [notes[1]], size: "small" }), id: "b2" }, { ...bars({ notes: [notes[1]] }), id: "b3" }] as Block[];
    const next = [clock(), { type: "paragraph", md: "Nuevo" }, bars(), bars(), bars()] as BlockInput[];
    const kept = keepSectionLayout(previous, next);
    expect(notesOf(kept[0])).toEqual([notes[1]]);
    expect(kept[0]).toMatchObject({ size: "small" });
    expect(notesOf(kept[2])).toEqual([notes[0]]);
    expect(notesOf(kept[3])).toEqual([notes[1]]);
    expect(notesOf(kept[4])).toBeUndefined();
    // Una sección nueva no hereda nada
    expect(keepSectionLayout([], [bars({ notes })]).map(notesOf)).toEqual([undefined]);
  });

  it("con las herramientas", () => {
    const start = doc([{ ...bars({ notes }), id: "b1" } as Block]);
    const updated = executeCreatorTool(start, "update_block", { block_id: "b1", block: bars({ bars: [{ label: "A", value: 4 }, { label: "B", value: 5 }] }) });
    expect(updated.isError).toBe(false);
    expect(notesOf(findBlock(updated.doc, "b1")?.block)).toEqual(notes);

    const inserted = executeCreatorTool(start, "insert_blocks", { section_id: "s1", at: "end", blocks: [bars({ notes })] });
    expect(inserted.isError).toBe(false);
    expect(notesOf(inserted.doc.sections[0].blocks[1])).toBeUndefined();

    const rewritten = executeCreatorTool(start, "write_section", { section_id: "s1", title: "Guía", role: "student", blocks: [{ type: "paragraph", md: "Intro" }, bars({ showValues: false })] });
    expect(rewritten.isError).toBe(false);
    expect(notesOf(rewritten.doc.sections[0].blocks[1])).toEqual(notes);
  });
});

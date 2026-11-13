import { describe, expect, it } from "vitest";
import {
  allBlocks,
  blockCells,
  blockInputSchema,
  collectIds,
  emptyDoc,
  findBlock,
  parseDoc,
  resourceDocSchema,
  type Block,
  type BlockInput,
  type ContainerBlock,
  type ResourceDoc,
} from "@shared/creator";
import { cellWidths, containerLayoutIssues, estimateHeight, layoutIssues, minBlockWidth, placementIssue, SHEET_WIDTH_PX, textLines } from "@shared/creatorContainers";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
import { diffTurn, reuseUnchanged } from "@shared/creatorTurn";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";

/** Generador determinista: los ids de las pruebas no dependen del azar. */
const seeded = () => {
  let state = 7;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

const ok = (result: OpResult) => {
  if (!result.ok) throw new Error(result.error);
  return result;
};
const failed = (result: OpResult) => {
  if (result.ok) throw new Error(`Se esperaba un error y se aplicó: ${result.summary}`);
  return result.error;
};

const p = (md: string): BlockInput => blockInputSchema.parse({ type: "paragraph", md });
const exercise = (label: string, extra: Record<string, unknown> = {}): BlockInput => blockInputSchema.parse({ type: "exercise", label, md: `Enunciado de ${label}.`, ...extra });
const graph = (): BlockInput => blockInputSchema.parse({ type: "graph", spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [], points: [] } });
const barChart = (): BlockInput =>
  blockInputSchema.parse({
    type: "bar_chart",
    bars: [
      { label: "A", value: 2 },
      { label: "B", value: 3 },
    ],
  });
const columns = (...cells: BlockInput[][]): BlockInput => blockInputSchema.parse({ type: "columns", columns: cells.map(blocks => ({ blocks })) });
const cards = (perRow: number, ...items: Array<{ title?: string; blocks: BlockInput[] }>): BlockInput => blockInputSchema.parse({ type: "cards", perRow, cards: items });

/** «Guía»: A, [columnas: (B, C) | (D)], E. «Clave»: X. */
function sample(): ResourceDoc {
  const random = seeded();
  let doc = emptyDoc("Prueba");
  doc = ok(applyDocOp(doc, { op: "write_section", title: "Guía", role: "student", blocks: [p("A"), columns([p("B"), p("C")], [p("D")]), p("E")] }, random)).doc;
  doc = ok(applyDocOp(doc, { op: "write_section", title: "Clave", role: "answer_key", blocks: [p("X")] }, random)).doc;
  return doc;
}

const name = (block: Block) => (block.type === "paragraph" ? block.md : block.type === "heading" ? `#${block.text}` : block.type);
/** El documento como texto: los contenedores entre corchetes y sus celdas separadas por «|». */
const shape = (doc: ResourceDoc) =>
  doc.sections.map(section => section.blocks.map(block => (blockCells(block).length > 0 || block.type === "columns" || block.type === "cards" ? `[${blockCells(block).map(cell => cell.map(name).join("")).join("|")}]` : name(block))).join(" "));
const id = (doc: ResourceDoc, text: string) => allBlocks(doc).find(block => block.type === "paragraph" && block.md === text)!.id;
const container = (doc: ResourceDoc) => allBlocks(doc).find(block => block.type === "columns" || block.type === "cards") as ContainerBlock;
const apply = (doc: ResourceDoc, op: DocOp) => ok(applyDocOp(doc, op, seeded()));

describe("el modelo con contenedores", () => {
  it("un recurso sin contenedores se lee igual que antes", () => {
    const random = seeded();
    const plain = ok(applyDocOp(emptyDoc("Sin columnas"), { op: "write_section", title: "Guía", role: "student", blocks: [p("Uno"), exercise("Ejercicio 1")] }, random)).doc;
    expect(parseDoc(JSON.stringify(plain))).toEqual(plain);
  });

  it("no admite un contenedor dentro de otro ni los bloques que van solo en la hoja", () => {
    expect(blockInputSchema.safeParse({ type: "columns", columns: [{ blocks: [columns([p("a")], [p("b")])] }, { blocks: [] }] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "columns", columns: [{ blocks: [{ type: "page_break" }] }, { blocks: [] }] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "cards", cards: [{ blocks: [{ type: "header_fields", fields: ["Nombre"] }] }] }).success).toBe(false);
    // Entre dos y tres columnas, hasta doce tarjetas
    expect(blockInputSchema.safeParse({ type: "columns", columns: [{ blocks: [] }] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "columns", columns: [{ blocks: [] }, { blocks: [] }, { blocks: [] }, { blocks: [] }] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "cards", perRow: 5, cards: [{ blocks: [] }] }).success).toBe(false);
  });

  it("da ids únicos a todo, también a lo de dentro, y los encuentra donde estén", () => {
    const doc = sample();
    const ids = allBlocks(doc).map(block => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(blockId => collectIds(doc).has(blockId))).toBe(true);
    const found = findBlock(doc, id(doc, "D"))!;
    expect(found.parent).toMatchObject({ cell: 1, index: 1 });
    expect(found.index).toBe(0);
    expect(found.section.title).toBe("Guía");
    // Lo guardado pasa por el esquema con sus ids
    expect(resourceDocSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});

describe("insertar dentro de una celda", () => {
  it("al inicio, al final o después de un bloque de la celda", () => {
    const doc = sample();
    const guide = doc.sections[0].id;
    const box = container(doc).id;
    let next = apply(doc, { op: "insert_blocks", sectionId: guide, containerId: box, cell: 1, at: "start", blocks: [p("d0")] }).doc;
    next = apply(next, { op: "insert_blocks", sectionId: guide, containerId: box, cell: 1, at: "end", blocks: [p("d9")] }).doc;
    next = apply(next, { op: "insert_blocks", sectionId: guide, afterBlockId: id(doc, "B"), blocks: [p("b1")] }).doc;
    expect(shape(next)[0]).toBe("A [Bb1C|d0Dd9] E");
  });

  it("rechaza lo que no cabe: un contenedor, un salto de página, una figura ancha o demasiados bloques", () => {
    const doc = sample();
    const guide = doc.sections[0].id;
    const box = container(doc).id;
    const into = (blocks: BlockInput[]) => applyDocOp(doc, { op: "insert_blocks", sectionId: guide, containerId: box, cell: 0, blocks });
    expect(failed(into([columns([p("x")], [p("y")])]))).toMatch(/no puede ir dentro de la columna 1/);
    expect(failed(into([{ type: "page_break" }]))).toMatch(/Salto de página no puede ir dentro/);
    expect(failed(into([barChart()]))).toMatch(/Diagrama de barras no cabe legible en la columna 1: necesita al menos dos tercios/);
    expect(failed(into(Array.from({ length: 7 }, (_, index) => p(`n${index}`))))).toMatch(/caben hasta 8 bloques/);
    // Una celda que no existe
    expect(failed(applyDocOp(doc, { op: "insert_blocks", sectionId: guide, containerId: box, cell: 2, blocks: [p("z")] }))).toMatch(/cell va de 0 a 1/);
  });
});

describe("mover hacia dentro, hacia fuera y entre celdas", () => {
  it("lleva un bloque de la hoja a una celda y de vuelta, conservando su objeto", () => {
    const doc = sample();
    const guide = doc.sections[0].id;
    const box = container(doc).id;
    const a = findBlock(doc, id(doc, "A"))!.block;
    const inside = apply(doc, { op: "move_block_to", blockId: a.id, sectionId: guide, containerId: box, cell: 1, index: 1 }).doc;
    expect(shape(inside)[0]).toBe("[BC|DA] E");
    expect(findBlock(inside, a.id)!.block).toBe(a);
    // Fuera, al final de la sección: el hueco se cuenta en la lista de la sección
    const outside = apply(inside, { op: "move_block_to", blockId: a.id, sectionId: guide, index: 2 }).doc;
    expect(shape(outside)[0]).toBe("[BC|D] E A");
    expect(findBlock(outside, a.id)!.block).toBe(a);
  });

  it("entre celdas y dentro de la misma, contando el hueco con el bloque en su sitio", () => {
    const doc = sample();
    const guide = doc.sections[0].id;
    const box = container(doc).id;
    expect(shape(apply(doc, { op: "move_block_to", blockId: id(doc, "B"), sectionId: guide, containerId: box, cell: 1, index: 1 }).doc)[0]).toBe("A [C|DB] E");
    expect(shape(apply(doc, { op: "move_block_to", blockId: id(doc, "B"), sectionId: guide, containerId: box, cell: 0, index: 2 }).doc)[0]).toBe("A [CB|D] E");
    // Justo antes o justo después de sí mismo: sin cambios
    expect(applyDocOp(doc, { op: "move_block_to", blockId: id(doc, "B"), sectionId: guide, containerId: box, cell: 0, index: 1 })).toMatchObject({ ok: true, changed: false });
    // A otra sección desde una celda
    expect(shape(apply(doc, { op: "move_block_to", blockId: id(doc, "C"), sectionId: doc.sections[1].id, index: 0 }).doc)).toEqual(["A [B|D] E", "C X"]);
  });

  it("no mete un contenedor en otro ni una figura ancha en una columna angosta", () => {
    let doc = sample();
    const guide = doc.sections[0].id;
    const box = container(doc).id;
    expect(failed(applyDocOp(doc, { op: "move_block_to", blockId: box, sectionId: guide, containerId: box, cell: 0, index: 0 }))).toMatch(/sí mismo/);
    doc = apply(doc, { op: "insert_blocks", sectionId: guide, at: "end", blocks: [barChart()] }).doc;
    const chart = allBlocks(doc).find(block => block.type === "bar_chart")!;
    expect(failed(applyDocOp(doc, { op: "move_block_to", blockId: chart.id, sectionId: guide, containerId: box, cell: 0, index: 0 }))).toMatch(/no cabe legible/);
  });

  it("sube y baja dentro de su celda, sin salirse de ella", () => {
    const doc = sample();
    expect(shape(apply(doc, { op: "move_block", blockId: id(doc, "C"), direction: "up" }).doc)[0]).toBe("A [CB|D] E");
    expect(apply(doc, { op: "move_block", blockId: id(doc, "C"), direction: "down" }).changed).toBe(false);
  });
});

describe("poner en columnas y sacar de ellas", () => {
  it("un bloque queda en la primera columna y la segunda vacía; varios seguidos, uno por columna", () => {
    const random = seeded();
    const doc = ok(applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks: [p("A"), p("B"), p("C")] }, random)).doc;
    const b = findBlock(doc, id(doc, "B"))!.block;
    const one = apply(doc, { op: "wrap_blocks", blockIds: [b.id], as: "columns" });
    expect(shape(one.doc)[0]).toBe("A [B|] C");
    expect(findBlock(one.doc, b.id)!.block).toBe(b);
    expect(one.ids).toEqual([container(one.doc).id]);
    // El orden en que se piden no importa; deben ir seguidos y en el primer nivel
    expect(shape(apply(doc, { op: "wrap_blocks", blockIds: [id(doc, "C"), id(doc, "B")], as: "columns" }).doc)[0]).toBe("A [B|C]");
    expect(failed(applyDocOp(doc, { op: "wrap_blocks", blockIds: [id(doc, "A"), id(doc, "C")], as: "columns" }))).toMatch(/seguidos/);
    expect(failed(applyDocOp(one.doc, { op: "wrap_blocks", blockIds: [b.id], as: "cards" }))).toMatch(/ya está dentro/);
    // En tarjetas, una por bloque y tres por fila desde tres
    const deck = apply(doc, { op: "wrap_blocks", blockIds: [id(doc, "A"), id(doc, "B"), id(doc, "C")], as: "cards" }).doc;
    expect(shape(deck)[0]).toBe("[A|B|C]");
    expect(container(deck)).toMatchObject({ type: "cards", perRow: 3 });
  });

  it("sacar deja todo en la hoja en orden de lectura; el título de cada tarjeta queda como título", () => {
    const doc = sample();
    const inner = blockCells(container(doc)).flat();
    const out = apply(doc, { op: "unwrap_container", containerId: container(doc).id });
    expect(shape(out.doc)[0]).toBe("A B C D E");
    expect(allBlocks(out.doc).filter(block => inner.includes(block as never))).toHaveLength(3);

    const random = seeded();
    const withCards = ok(applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks: [cards(2, { title: "Pendiente", blocks: [p("m")] }, { blocks: [p("b")] })] }, random)).doc;
    expect(shape(apply(withCards, { op: "unwrap_container", containerId: container(withCards).id }).doc)[0]).toBe("#Pendiente m b");
  });

  it("deshacer el envoltorio devuelve el documento de antes", () => {
    const doc = sample();
    const wrapped = apply(doc, { op: "wrap_blocks", blockIds: [id(doc, "A")], as: "columns" }).doc;
    const back = apply(wrapped, { op: "unwrap_container", containerId: findBlock(wrapped, id(doc, "A"))!.parent!.container.id }).doc;
    expect(shape(back)).toEqual(shape(doc));
    expect(findBlock(back, id(doc, "A"))!.block).toBe(findBlock(doc, id(doc, "A"))!.block);
  });
});

describe("añadir y quitar columnas y tarjetas", () => {
  it("añade una columna vacía donde se pida, hasta tres", () => {
    const doc = sample();
    const box = container(doc).id;
    const three = apply(doc, { op: "add_cell", containerId: box, at: 1 }).doc;
    expect(shape(three)[0]).toBe("A [BC||D] E");
    expect(failed(applyDocOp(three, { op: "add_cell", containerId: box }))).toMatch(/hasta 3 columnas/);
  });

  it("quitar una columna pasa sus bloques a la vecina, en orden de lectura", () => {
    const doc = apply(sample(), { op: "add_cell", containerId: container(sample()).id });
    const box = container(doc.doc).id;
    const filled = apply(doc.doc, { op: "insert_blocks", sectionId: doc.doc.sections[0].id, containerId: box, cell: 2, blocks: [p("F")] }).doc;
    const first = apply(filled, { op: "remove_cell", containerId: box, cell: 0 });
    expect(shape(first.doc)[0]).toBe("A [BCD|F] E");
    expect(first.summary).toBe("Columna quitada; sus bloques pasaron a la columna 1");
    const last = apply(filled, { op: "remove_cell", containerId: box, cell: 2 });
    expect(shape(last.doc)[0]).toBe("A [BC|DF] E");
    // Con dos columnas no se quita ninguna: para eso se sacan los bloques
    expect(failed(applyDocOp(sample(), { op: "remove_cell", containerId: container(sample()).id, cell: 0 }))).toMatch(/al menos 2/);
  });

  it("una tarjeta se quita con lo que tiene y lo dice; la última no", () => {
    const random = seeded();
    const doc = ok(applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks: [cards(2, { title: "Uno", blocks: [p("a"), p("b")] }, { blocks: [] })] }, random)).doc;
    const box = container(doc).id;
    const removed = apply(doc, { op: "remove_cell", containerId: box, cell: 0 });
    expect(removed.summary).toBe("Tarjeta quitada con sus 2 bloques");
    expect(shape(removed.doc)[0]).toBe("[]");
    expect(failed(applyDocOp(removed.doc, { op: "remove_cell", containerId: box, cell: 0 }))).toMatch(/al menos una/);
  });

  it("un cambio de forma que deja una figura sin espacio no se aplica", () => {
    const random = seeded();
    const doc = ok(applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks: [columns([graph()], [p("Texto")])] }, random)).doc;
    const box = container(doc).id;
    // El plano cabe en media hoja, no en un tercio
    expect(failed(applyDocOp(doc, { op: "add_cell", containerId: box }))).toMatch(/Gráfica no cabe legible en la columna 1/);
    expect(failed(applyDocOp(doc, { op: "set_layout", containerId: box, widths: [1, 2] }))).toMatch(/no cabe legible/);
    expect(apply(doc, { op: "set_layout", containerId: box, widths: [2, 1] }).changed).toBe(true);
    expect(apply(doc, { op: "set_layout", containerId: box, widths: [1, 1] }).changed).toBe(false);
  });

  it("cambia cuántas tarjetas van por fila y el título de una tarjeta", () => {
    const random = seeded();
    const doc = ok(applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks: [cards(2, { blocks: [p("a")] }, { blocks: [p("b")] })] }, random)).doc;
    const box = container(doc).id;
    expect(container(apply(doc, { op: "set_layout", containerId: box, perRow: 4 }).doc)).toMatchObject({ perRow: 4 });
    const titled = apply(doc, { op: "update_cell", containerId: box, cell: 1, title: " Cuesta \\$2.000 " }).doc;
    expect((container(titled) as Extract<Block, { type: "cards" }>).cards[1].title).toBe("Cuesta \\$2.000");
    const untitled = apply(titled, { op: "update_cell", containerId: box, cell: 1, title: "" }).doc;
    expect((container(untitled) as Extract<Block, { type: "cards" }>).cards[1].title).toBeUndefined();
    // Lo de dentro no se toca
    expect(blockCells(container(untitled))[0][0]).toBe(blockCells(container(doc))[0][0]);
  });
});

describe("duplicar, borrar y editar con anidamiento", () => {
  it("duplicar un contenedor copia todo lo de dentro con ids nuevos", () => {
    const doc = sample();
    const result = apply(doc, { op: "duplicate_block", blockId: container(doc).id });
    expect(shape(result.doc)[0]).toBe("A [BC|D] [BC|D] E");
    const ids = allBlocks(result.doc).map(block => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    // La copia no comparte objetos con el original
    const [original, copy] = result.doc.sections[0].blocks.filter(block => block.type === "columns");
    expect(blockCells(copy)[0][0]).not.toBe(blockCells(original)[0][0]);
  });

  it("duplicar un bloque de dentro lo deja debajo, en su misma celda", () => {
    const doc = sample();
    expect(shape(apply(doc, { op: "duplicate_block", blockId: id(doc, "D") }).doc)[0]).toBe("A [BC|DD] E");
  });

  it("borra un bloque de dentro o el contenedor entero; lo que no se toca conserva su objeto", () => {
    const doc = sample();
    const inner = apply(doc, { op: "delete_blocks", blockIds: [id(doc, "C")] }).doc;
    expect(shape(inner)[0]).toBe("A [B|D] E");
    expect(inner.sections[1]).toBe(doc.sections[1]);
    expect(shape(apply(doc, { op: "delete_blocks", blockIds: [container(doc).id] }).doc)[0]).toBe("A E");
  });

  it("edita un bloque de dentro, pero no lo vuelve contenedor ni algo que no cabe", () => {
    const doc = sample();
    const d = id(doc, "D");
    expect(shape(apply(doc, { op: "update_block", blockId: d, block: p("D2") }).doc)[0]).toBe("A [BC|D2] E");
    expect(failed(applyDocOp(doc, { op: "update_block", blockId: d, block: columns([p("x")], [p("y")]) }))).toMatch(/no puede ir dentro/);
    expect(failed(applyDocOp(doc, { op: "update_block", blockId: d, block: barChart() }))).toMatch(/no cabe legible/);
  });

  it("al reescribir un contenedor, lo que sigue igual conserva su id y su objeto", () => {
    const doc = sample();
    const box = container(doc);
    const [[b, c], [d]] = blockCells(box);
    // La IA lo reescribe: B igual, C cambiado en su sitio, D movido a la primera columna
    const rewritten = apply(doc, { op: "update_block", blockId: box.id, block: columns([p("B"), p("C2"), p("D")], [p("nuevo")]) }).doc;
    const cells = blockCells(container(rewritten));
    expect(cells[0][0]).toBe(b);
    expect(cells[0][1].id).toBe(c.id);
    expect(cells[0][2]).toBe(d);
    expect(collectIds(doc).has(cells[1][0].id)).toBe(false);
  });
});

describe("los cambios de un turno con bloques anidados", () => {
  it("editar un bloque de dentro cambia ese bloque, no las columnas", () => {
    const doc = sample();
    const after = apply(doc, { op: "update_block", blockId: id(doc, "C"), block: p("C2") }).doc;
    expect(diffTurn(doc, after)).toEqual({ added: [], changed: [id(doc, "C")], removed: 0, meta: false });
  });

  it("poner en columnas añade el contenedor sin cambiar lo que guarda; sacarlo, lo elimina", () => {
    const doc = sample();
    const wrapped = apply(doc, { op: "wrap_blocks", blockIds: [id(doc, "A")], as: "columns" }).doc;
    expect(diffTurn(doc, wrapped)).toEqual({ added: [findBlock(wrapped, id(doc, "A"))!.parent!.container.id], changed: [], removed: 0, meta: false });
    const unwrapped = apply(doc, { op: "unwrap_container", containerId: container(doc).id }).doc;
    expect(diffTurn(doc, unwrapped)).toEqual({ added: [], changed: [], removed: 1, meta: false });
    // Cambiar los anchos sí cambia las columnas
    expect(diffTurn(doc, apply(doc, { op: "set_layout", containerId: container(doc).id, widths: [2, 1] }).doc).changed).toEqual([container(doc).id]);
  });

  it("lo que llega del servidor reutiliza los objetos de lo que no cambió, también dentro", () => {
    const doc = sample();
    const edited = apply(doc, { op: "update_block", blockId: id(doc, "D"), block: p("D2") }).doc;
    const copy = JSON.parse(JSON.stringify(edited)) as ResourceDoc;
    const reused = reuseUnchanged(doc, copy);
    const before = blockCells(container(doc));
    const now = blockCells(container(reused));
    expect(now[0][0]).toBe(before[0][0]);
    expect(now[1][0]).not.toBe(before[1][0]);
    expect(reused.sections[1]).toBe(doc.sections[1]);
    expect(reuseUnchanged(doc, JSON.parse(JSON.stringify(doc)))).toBe(doc);
  });
});

describe("qué cabe en una celda", () => {
  it("mide las celdas sobre la hoja impresa", () => {
    const [left, right] = cellWidths(blockInputSchema.parse({ type: "columns", columns: [{ width: 1, blocks: [] }, { width: 2, blocks: [] }] }) as never);
    expect(left + right + 20).toBeCloseTo(SHEET_WIDTH_PX);
    expect(right).toBeCloseTo(left * 2);
  });

  it("el texto cabe en cualquier celda; las figuras, según su ancho de diseño", () => {
    expect(placementIssue(p("x"), 130)).toBeNull();
    expect(minBlockWidth(graph())).toBeLessThan(cellWidths(columns([], []) as never)[0]);
    expect(placementIssue(barChart(), 337)).toMatch(/dos tercios/);
    expect(placementIssue(barChart(), 450)).toBeNull();
    const narrowTable = blockInputSchema.parse({ type: "table", header: ["a", "b"], rows: [["1", "2"]] });
    const wideTable = blockInputSchema.parse({ type: "table", header: ["a", "b", "c", "d", "e", "f"], rows: [["1", "2", "3", "4", "5", "6"]] });
    expect(placementIssue(narrowTable, 160)).toBeNull();
    expect(placementIssue(wideTable, 337)).toMatch(/no cabe legible/);
  });
});

describe("validación de contenedores", () => {
  it("revisa lo de dentro y dice en qué celda está cada problema", () => {
    const broken = columns([p("Bien")], [blockInputSchema.parse({ type: "math", latex: "\\frac{1}{" })]);
    expect(validateBlock(broken)).toEqual([expect.stringMatching(/^Columna 2, bloque 1 — Fórmula: .* no es LaTeX válido/)]);
    expect(validateBlock(columns([], []))).toEqual(["Columnas: no tiene ningún bloque dentro."]);
    expect(validateBlock(columns([barChart()], [p("x")]))[0]).toMatch(/no cabe legible en la columna 1/);
    expect(validateBlock(blockInputSchema.parse({ type: "columns", columns: [{ width: 2, blocks: [p("a")] }, { width: 2, blocks: [p("b")] }, { width: 1, blocks: [p("c")] }] }))[0]).toMatch(
      /los anchos suman 5/,
    );
  });

  it("el orden entre ejercicio y figura se revisa dentro de cada celda, no entre columnas", () => {
    const sideBySide = { title: "Guía", blocks: [columns([exercise("Ejercicio 1")], [graph()])] };
    expect(validateBlockOrder([sideBySide])).toEqual([]);
    const stacked = { title: "Guía", blocks: [columns([exercise("Ejercicio 1"), graph()], [p("x")])] };
    expect(validateBlockOrder([stacked])).toEqual([expect.stringMatching(/^Sección «Guía», columna 1, Ejercicio 1: su espacio de respuesta queda entre el enunciado y la figura/)]);
    // Resolver sobre la figura sigue siendo válido dentro de la celda
    const solved = { title: "Guía", blocks: [columns([exercise("Ejercicio 1", { answerSpace: "none" }), graph()], [p("x")])] };
    expect(validateBlockOrder([solved])).toEqual([]);
  });
});

describe("columnas que se ven mal", () => {
  const long = (chars: number) => p("Texto de prueba con palabras de largo normal. ".repeat(Math.ceil(chars / 46)).slice(0, chars).trim());
  const issuesOf = (block: BlockInput) => containerLayoutIssues(block as never, "c");

  it("estima los renglones de un texto según el ancho", () => {
    const md = "a ".repeat(150).trim();
    expect(textLines(md, 338)).toBeLessThan(textLines(md, 160));
    expect(textLines("uno\n\ndos\n\ntres", 600)).toBe(3);
    expect(estimateHeight(long(900), 338)).toBeGreaterThan(estimateHeight(long(900), 695));
  });

  it("avisa de un texto largo junto a algo corto, no de una figura alta junto a un texto corto", () => {
    const uneven = issuesOf(columns([long(900)], [exercise("Ejercicio 1", { lines: 2 })]));
    expect(uneven.map(issue => issue.key)).toEqual(["c:desparejas"]);
    expect(uneven[0].message).toMatch(/^La columna 1 es mucho más larga que la columna 2 \(unos \d+ renglones contra \d+\)/);
    expect(issuesOf(columns([long(120)], [graph()]))).toEqual([]);
    expect(issuesOf(columns([exercise("Ejercicio 1")], [exercise("Ejercicio 2")]))).toEqual([]);
    // Una columna vacía (recién puesta en columnas) no cuenta
    expect(issuesOf(columns([long(900)], []))).toEqual([]);
  });

  it("avisa de un texto largo en una columna o tarjeta angosta", () => {
    const narrow = issuesOf(blockInputSchema.parse({ type: "columns", columns: [{ blocks: [long(520)] }, { blocks: [long(500)] }, { blocks: [long(500)] }] }));
    expect(narrow.filter(issue => issue.key.startsWith("c:largo")).length).toBe(3);
    expect(narrow[0].message).toMatch(/ocupa unos \d+ renglones en la columna 1, que es angosta/);
    expect(issuesOf(cards(4, { blocks: [long(400)] }, { blocks: [p("corto")] }))[0].message).toMatch(/en la tarjeta 1, que es angosta/);
    // A media hoja el mismo texto se lee bien
    expect(issuesOf(columns([long(520)], [long(500)]))).toEqual([]);
  });

  it("nombra la sección para la IA", () => {
    const issues = layoutIssues([{ title: "Guía", blocks: [columns([long(900)], [p("corto")])] }]);
    expect(issues[0].message).toMatch(/^Sección «Guía», columnas: La columna 1/);
  });
});

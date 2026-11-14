import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, emptyDoc, type BlockType, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp } from "@shared/creatorOps";
import {
  ADDABLE_BLOCKS,
  autoScrollStep,
  BLOCK_FAMILIES,
  BLOCK_INFO,
  dropTarget,
  filterBlockFamilies,
  fold,
  gapLine,
  headingShortcut,
  insertOp,
  isSamePlace,
  matchScore,
  moveShortcut,
  sideTarget,
  stepTarget,
  targetCell,
  type SheetLayout,
} from "./structure";

const apply = (doc: ResourceDoc, op: DocOp) => {
  const result = applyDocOp(doc, op);
  if (!result.ok) throw new Error(result.error);
  return result.doc;
};

const paragraphs = (...texts: string[]) => texts.map(md => blockInputSchema.parse({ type: "paragraph", md }));

/** «Guía» con A, B, C; «Vacía» sin bloques; «Clave» con X, Y. */
function sheet(): ResourceDoc {
  let doc = emptyDoc("Prueba");
  doc = apply(doc, { op: "write_section", title: "Guía", role: "student", blocks: paragraphs("A", "B", "C") });
  doc = apply(doc, { op: "write_section", title: "Vacía", role: "student", blocks: [] });
  doc = apply(doc, { op: "write_section", title: "Clave", role: "answer_key", blocks: paragraphs("X", "Y") });
  return doc;
}

const idOf = (doc: ResourceDoc, text: string) => doc.sections.flatMap(section => section.blocks).find(block => block.type === "paragraph" && block.md === text)!.id;
const texts = (doc: ResourceDoc) => doc.sections.map(section => section.blocks.map(block => (block.type === "paragraph" ? block.md : "?")).join(""));
const flat = (query: string) => filterBlockFamilies(query).flatMap(family => family.types);

describe("catálogo de bloques", () => {
  it("ofrece cada tipo una sola vez, todos salvo los datos del estudiante, y cada uno con su descripción", () => {
    const all = Object.keys(BLOCK_TYPE_LABELS) as BlockType[];
    expect(new Set(ADDABLE_BLOCKS).size).toBe(ADDABLE_BLOCKS.length);
    expect([...ADDABLE_BLOCKS].sort()).toEqual(all.filter(type => type !== "header_fields").sort());
    for (const type of ADDABLE_BLOCKS) expect(BLOCK_INFO[type]?.hint).toBeTruthy();
  });

  it("sin búsqueda devuelve todas las familias en su orden", () => {
    expect(filterBlockFamilies("  ").map(family => family.id)).toEqual(BLOCK_FAMILIES.map(family => family.id));
    expect(flat("")).toEqual([...ADDABLE_BLOCKS]);
  });

  it("no distingue tildes ni mayúsculas", () => {
    expect(fold("Gráfica ÁNGULOS")).toBe("grafica angulos");
    expect(flat("grafica")[0]).toBe("graph");
    expect(flat("ÁNGU")).toEqual(["angle", "triangle", "unit_circle"]);
  });

  it("pone primero lo que empieza como el nombre y agrupa por familias", () => {
    expect(flat("tabla").slice(0, 2)).toEqual(["table", "value_table"]);
    expect(filterBlockFamilies("tabla")[0].id).toBe("tables");
    expect(flat("diagrama de")[0]).toBe("bar_chart");
    expect(flat("re")[0]).toBe("callout");
  });

  it("encuentra por sinónimos, por la descripción y por la familia", () => {
    expect(flat("torta")).toEqual(["pie_chart"]);
    expect(flat("probabilidad")).toEqual(["contingency_table", "tree_diagram"]);
    expect(flat("frecuencias")).toEqual(expect.arrayContaining(["frequency_table", "histogram"]));
    expect(flat("cuartiles")).toEqual(["box_plot"]);
    expect(flat("ecuacion")).toEqual(expect.arrayContaining(["math", "balance"]));
    expect(flat("geometria")).toEqual(["shapes", "triangle", "unit_circle", "solid", "angle", "clock"]);
    expect(matchScore("pie_chart", "torta")).toBe(2);
    expect(matchScore("clock", "geometria", "Geometría y medida")).toBe(3);
  });

  it("exige todas las palabras y que cada una empiece una palabra", () => {
    expect(flat("tabla valores")).toEqual(["value_table"]);
    expect(flat("abla")).toEqual([]);
    expect(flat("zzz")).toEqual([]);
    expect(filterBlockFamilies("zzz")).toEqual([]);
  });
});

describe("dónde insertar", () => {
  it("traduce cada sitio a la operación de insertar", () => {
    const doc = sheet();
    const [guide] = doc.sections;
    const extra = paragraphs("N");
    const run = (place: Parameters<typeof insertOp>[1]) => texts(apply(doc, insertOp(doc, place, extra)))[0];
    expect(run({ sectionId: guide.id, kind: "start" })).toBe("NABC");
    expect(run({ sectionId: guide.id, kind: "end" })).toBe("ABCN");
    expect(run({ sectionId: guide.id, kind: "after", blockId: idOf(doc, "A") })).toBe("ANBC");
    expect(run({ sectionId: guide.id, kind: "before", blockId: idOf(doc, "A") })).toBe("NABC");
    expect(run({ sectionId: guide.id, kind: "before", blockId: idOf(doc, "C") })).toBe("ABNC");
  });

  it("si el bloque ya no está, la operación falla en vez de insertar en otro sitio", () => {
    const doc = sheet();
    expect(applyDocOp(doc, insertOp(doc, { sectionId: doc.sections[0].id, kind: "before", blockId: "bnoexis" }, paragraphs("N"))).ok).toBe(false);
  });
});

describe("mover con el teclado", () => {
  it("sube y baja dentro de la sección", () => {
    const doc = sheet();
    const b = idOf(doc, "B");
    const move = (direction: "up" | "down") => {
      const target = stepTarget(doc, b, direction)!;
      return texts(apply(doc, { op: "move_block_to", blockId: b, ...target }));
    };
    expect(move("up")).toEqual(["BAC", "", "XY"]);
    expect(move("down")).toEqual(["ACB", "", "XY"]);
  });

  it("en el borde pasa a la sección vecina, también a una vacía", () => {
    const doc = sheet();
    const c = idOf(doc, "C");
    const down = stepTarget(doc, c, "down")!;
    expect(down).toEqual({ sectionId: doc.sections[1].id, index: 0 });
    const moved = apply(doc, { op: "move_block_to", blockId: c, ...down });
    expect(texts(moved)).toEqual(["AB", "C", "XY"]);
    // Y desde ahí, al inicio de la siguiente
    const again = apply(moved, { op: "move_block_to", blockId: c, ...stepTarget(moved, c, "down")! });
    expect(texts(again)).toEqual(["AB", "", "CXY"]);
    // Subir desde el primero de la clave lo deja al final de la sección anterior
    const x = idOf(doc, "X");
    expect(stepTarget(doc, x, "up")).toEqual({ sectionId: doc.sections[1].id, index: 0 });
  });

  it("no hay paso más allá de los extremos del documento", () => {
    const doc = sheet();
    expect(stepTarget(doc, idOf(doc, "A"), "up")).toBeNull();
    expect(stepTarget(doc, idOf(doc, "Y"), "down")).toBeNull();
    expect(stepTarget(doc, "bnoexis", "down")).toBeNull();
  });

  it("reconoce Alt+Mayús+flecha y nada más", () => {
    const key = (key: string, mods: Partial<Record<"altKey" | "shiftKey" | "ctrlKey" | "metaKey", boolean>>) => moveShortcut({ key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods });
    expect(key("ArrowUp", { altKey: true, shiftKey: true })).toBe("up");
    expect(key("ArrowDown", { altKey: true, shiftKey: true })).toBe("down");
    expect(key("ArrowUp", { altKey: true })).toBeNull();
    expect(key("ArrowUp", { shiftKey: true })).toBeNull();
    expect(key("ArrowUp", { altKey: true, shiftKey: true, ctrlKey: true })).toBeNull();
    expect(key("ArrowLeft", { altKey: true, shiftKey: true })).toBe("left");
    expect(key("ArrowRight", { altKey: true, shiftKey: true })).toBe("right");
    expect(key("ArrowLeft", { altKey: true })).toBeNull();
    expect(key("Home", { altKey: true, shiftKey: true })).toBeNull();
  });
});

describe("arrastrar", () => {
  // Guía: A 100–140, B 152–200, C 212–240, botón en 250. Vacía empieza en 300, botón en 360. Clave en 400: X 460–500, Y 512–560
  const layout = (doc: ResourceDoc): SheetLayout => ({
    sections: [
      { id: doc.sections[0].id, top: 80, end: 250, blocks: [{ id: idOf(doc, "A"), top: 100, bottom: 140 }, { id: idOf(doc, "B"), top: 152, bottom: 200 }, { id: idOf(doc, "C"), top: 212, bottom: 240 }] },
      { id: doc.sections[1].id, top: 300, end: 360, blocks: [] },
      { id: doc.sections[2].id, top: 400, end: 580, blocks: [{ id: idOf(doc, "X"), top: 460, bottom: 500 }, { id: idOf(doc, "Y"), top: 512, bottom: 560 }] },
    ],
  });

  it("elige el hueco por la mitad de cada bloque", () => {
    const doc = sheet();
    const [guide, empty, key] = doc.sections;
    const at = (y: number) => dropTarget(layout(doc), y);
    expect(at(0)).toEqual({ sectionId: guide.id, index: 0 });
    expect(at(119)).toEqual({ sectionId: guide.id, index: 0 });
    expect(at(121)).toEqual({ sectionId: guide.id, index: 1 });
    expect(at(230)).toEqual({ sectionId: guide.id, index: 3 });
    expect(at(299)).toEqual({ sectionId: guide.id, index: 3 });
    expect(at(330)).toEqual({ sectionId: empty.id, index: 0 });
    expect(at(450)).toEqual({ sectionId: key.id, index: 0 });
    expect(at(2000)).toEqual({ sectionId: key.id, index: 2 });
    expect(dropTarget({ sections: [] }, 10)).toBeNull();
  });

  it("dibuja la línea entre dos bloques o junto al primero y al último", () => {
    const doc = sheet();
    const [guide, empty, key] = doc.sections;
    const sheetLayout = layout(doc);
    expect(gapLine(sheetLayout, { sectionId: guide.id, index: 0 })).toBe(94);
    expect(gapLine(sheetLayout, { sectionId: guide.id, index: 1 })).toBe(146);
    expect(gapLine(sheetLayout, { sectionId: guide.id, index: 3 })).toBe(246);
    expect(gapLine(sheetLayout, { sectionId: empty.id, index: 0 })).toBe(354);
    expect(gapLine(sheetLayout, { sectionId: key.id, index: 2 })).toBe(566);
    expect(gapLine(sheetLayout, { sectionId: "snoexis", index: 0 })).toBeNull();
  });

  it("sabe cuándo soltar no cambia nada", () => {
    const doc = sheet();
    const b = idOf(doc, "B");
    const guide = doc.sections[0].id;
    expect(isSamePlace(doc, b, { sectionId: guide, index: 1 })).toBe(true);
    expect(isSamePlace(doc, b, { sectionId: guide, index: 2 })).toBe(true);
    expect(isSamePlace(doc, b, { sectionId: guide, index: 0 })).toBe(false);
    expect(isSamePlace(doc, b, { sectionId: doc.sections[1].id, index: 0 })).toBe(false);
  });

  it("desplaza la hoja cerca de los bordes, más rápido cuanto más cerca", () => {
    expect(autoScrollStep(300, 0, 600)).toBe(0);
    expect(autoScrollStep(40, 0, 600)).toBeLessThan(0);
    expect(autoScrollStep(2, 0, 600)).toBeLessThan(autoScrollStep(40, 0, 600));
    expect(autoScrollStep(-50, 0, 600)).toBe(-18);
    expect(autoScrollStep(590, 0, 600)).toBeGreaterThan(0);
    expect(autoScrollStep(900, 0, 600)).toBe(18);
  });
});

describe("atajos al escribir", () => {
  it("«#», «##» y «###» seguidos de espacio vuelven título el párrafo", () => {
    expect(headingShortcut("## ")).toEqual({ level: 2, rest: "" });
    expect(headingShortcut("# Hola")).toEqual({ level: 2, rest: "Hola" });
    expect(headingShortcut("### Parte *uno*")).toEqual({ level: 3, rest: "Parte *uno*" });
    expect(headingShortcut("##")).toBeNull();
    expect(headingShortcut("#### x")).toBeNull();
    expect(headingShortcut("##x")).toBeNull();
    expect(headingShortcut("a ## b")).toBeNull();
  });
});

describe("columnas y tarjetas: insertar, mover y arrastrar", () => {
  /** «Guía»: A, [columnas: (B, C) | (D)], E. «Clave»: X. */
  function withColumns(): ResourceDoc {
    let doc = emptyDoc("Prueba");
    const columns = blockInputSchema.parse({ type: "columns", columns: [{ blocks: paragraphs("B", "C") }, { blocks: paragraphs("D") }] });
    doc = apply(doc, { op: "write_section", title: "Guía", role: "student", blocks: [...paragraphs("A"), columns, ...paragraphs("E")] });
    doc = apply(doc, { op: "write_section", title: "Clave", role: "answer_key", blocks: paragraphs("X") });
    return doc;
  }
  const all = (doc: ResourceDoc) => doc.sections.flatMap(section => section.blocks.flatMap(block => [block, ...(block.type === "columns" ? block.columns.flatMap(column => column.blocks) : [])]));
  const id = (doc: ResourceDoc, text: string) => all(doc).find(block => block.type === "paragraph" && block.md === text)!.id;
  const box = (doc: ResourceDoc) => doc.sections[0].blocks[1].id;
  /** La primera sección como texto, con las columnas entre corchetes. */
  const shape = (doc: ResourceDoc) =>
    doc.sections[0].blocks.map(block => (block.type === "columns" ? `[${block.columns.map(column => column.blocks.map(inner => (inner.type === "paragraph" ? inner.md : "?")).join("")).join("|")}]` : block.type === "paragraph" ? block.md : "?")).join(" ");

  it("inserta al inicio, al final, encima y debajo dentro de una celda", () => {
    const doc = withColumns();
    const guide = doc.sections[0].id;
    const run = (place: Parameters<typeof insertOp>[1]) => shape(apply(doc, insertOp(doc, place, paragraphs("N"))));
    expect(run({ sectionId: guide, kind: "start", containerId: box(doc), cell: 1 })).toBe("A [BC|ND] E");
    expect(run({ sectionId: guide, kind: "end", containerId: box(doc), cell: 0 })).toBe("A [BCN|D] E");
    expect(run({ sectionId: guide, kind: "before", blockId: id(doc, "B") })).toBe("A [NBC|D] E");
    expect(run({ sectionId: guide, kind: "before", blockId: id(doc, "C") })).toBe("A [BNC|D] E");
    expect(run({ sectionId: guide, kind: "after", blockId: id(doc, "D") })).toBe("A [BC|DN] E");
  });

  it("con el teclado, un bloque de dentro sale del contenedor por arriba o por abajo", () => {
    const doc = withColumns();
    const step = (text: string, direction: "up" | "down") => shape(apply(doc, { op: "move_block_to", blockId: id(doc, text), ...stepTarget(doc, id(doc, text), direction)! }));
    expect(step("C", "up")).toBe("A [CB|D] E");
    expect(step("B", "up")).toBe("A B [C|D] E");
    expect(step("C", "down")).toBe("A [B|D] C E");
    expect(step("D", "down")).toBe("A [BC|] D E");
    // Los bloques de la hoja saltan el contenedor entero
    expect(step("A", "down")).toBe("[BC|D] A E");
  });

  it("a los lados pasa a la celda vecina, a la misma altura o al final", () => {
    const doc = withColumns();
    expect(sideTarget(doc, id(doc, "C"), "right")).toEqual({ sectionId: doc.sections[0].id, containerId: box(doc), cell: 1, index: 1 });
    expect(shape(apply(doc, { op: "move_block_to", blockId: id(doc, "C"), ...sideTarget(doc, id(doc, "C"), "right")! }))).toBe("A [B|DC] E");
    expect(shape(apply(doc, { op: "move_block_to", blockId: id(doc, "D"), ...sideTarget(doc, id(doc, "D"), "left")! }))).toBe("A [DBC|] E");
    expect(sideTarget(doc, id(doc, "B"), "left")).toBeNull();
    expect(sideTarget(doc, id(doc, "A"), "right")).toBeNull();
  });

  // Guía: A 100–140, columnas 150–330 (columna 0: x 60–300, B 160–200, C 210–250; columna 1: x 320–560, D 160–220), E 340–380
  const layout = (doc: ResourceDoc): SheetLayout => ({
    sections: [
      {
        id: doc.sections[0].id,
        top: 80,
        end: 400,
        blocks: [
          { id: id(doc, "A"), top: 100, bottom: 140 },
          {
            id: box(doc),
            top: 150,
            bottom: 330,
            cells: [
              { containerId: box(doc), cell: 0, left: 60, right: 300, top: 156, bottom: 324, blocks: [{ id: id(doc, "B"), top: 160, bottom: 200 }, { id: id(doc, "C"), top: 210, bottom: 250 }] },
              { containerId: box(doc), cell: 1, left: 320, right: 560, top: 156, bottom: 324, blocks: [{ id: id(doc, "D"), top: 160, bottom: 220 }] },
            ],
          },
          { id: id(doc, "E"), top: 340, bottom: 380 },
        ],
      },
      { id: doc.sections[1].id, top: 500, end: 600, blocks: [] },
    ],
  });

  it("al arrastrar, la celda bajo el puntero; el borde del contenedor es encima o debajo de él", () => {
    const doc = withColumns();
    const guide = doc.sections[0].id;
    const at = (x: number, y: number, into = true) => dropTarget(layout(doc), y, x, into);
    expect(at(100, 205)).toEqual({ sectionId: guide, containerId: box(doc), cell: 0, index: 1 });
    expect(at(400, 300)).toEqual({ sectionId: guide, containerId: box(doc), cell: 1, index: 1 });
    // En la separación entre columnas, la más cercana
    expect(at(309, 170)).toEqual({ sectionId: guide, containerId: box(doc), cell: 0, index: 0 });
    // La franja de arriba y la de abajo del contenedor
    expect(at(100, 154)).toEqual({ sectionId: guide, index: 1 });
    expect(at(100, 326)).toEqual({ sectionId: guide, index: 2 });
    // Un contenedor o un salto de página no entran: el contenedor cuenta entero
    expect(at(100, 205, false)).toEqual({ sectionId: guide, index: 1 });
    expect(at(100, 250, false)).toEqual({ sectionId: guide, index: 2 });
  });

  it("la línea va en la celda: entre dos bloques, junto al borde o a media altura si está vacía", () => {
    const doc = withColumns();
    const guide = doc.sections[0].id;
    const sheetLayout = layout(doc);
    const inCell = (cell: number, index: number) => ({ sectionId: guide, containerId: box(doc), cell, index });
    expect(gapLine(sheetLayout, inCell(0, 1))).toBe(205);
    expect(gapLine(sheetLayout, inCell(0, 0))).toBe(157);
    expect(gapLine(sheetLayout, inCell(1, 1))).toBe(223);
    expect(targetCell(sheetLayout, inCell(1, 0))).toMatchObject({ left: 320, right: 560 });
    expect(targetCell(sheetLayout, { sectionId: guide, index: 0 })).toBeNull();
    const empty: SheetLayout = { sections: [{ ...sheetLayout.sections[0], blocks: [{ ...sheetLayout.sections[0].blocks[1], cells: [{ ...sheetLayout.sections[0].blocks[1].cells![1], blocks: [] }] }] }] };
    expect(gapLine(empty, inCell(1, 0))).toBe(240);
  });

  it("sabe cuándo soltar dentro de su propia celda no cambia nada", () => {
    const doc = withColumns();
    const guide = doc.sections[0].id;
    const c = id(doc, "C");
    expect(isSamePlace(doc, c, { sectionId: guide, containerId: box(doc), cell: 0, index: 2 })).toBe(true);
    expect(isSamePlace(doc, c, { sectionId: guide, containerId: box(doc), cell: 1, index: 1 })).toBe(false);
    expect(isSamePlace(doc, c, { sectionId: guide, index: 2 })).toBe(false);
    expect(isSamePlace(doc, id(doc, "A"), { sectionId: guide, containerId: box(doc), cell: 0, index: 0 })).toBe(false);
  });
});

describe("arrastrar sobre lo que el contenedor muestra bajo sus celdas", () => {
  it("lejos de las celdas (un aviso, un formulario) el destino es encima o debajo del contenedor", () => {
    let doc = emptyDoc("Prueba");
    const columns = blockInputSchema.parse({ type: "columns", columns: [{ blocks: paragraphs("B") }, { blocks: paragraphs("D") }] });
    doc = apply(doc, { op: "write_section", title: "Guía", role: "student", blocks: [...paragraphs("A"), columns] });
    const [a, box] = doc.sections[0].blocks;
    // Las celdas llegan hasta 300; el contenedor sigue hasta 700 con un formulario abierto debajo
    const layout: SheetLayout = {
      sections: [
        {
          id: doc.sections[0].id,
          top: 0,
          end: 800,
          blocks: [
            { id: a.id, top: 40, bottom: 80 },
            {
              id: box.id,
              top: 100,
              bottom: 700,
              cells: [
                { containerId: box.id, cell: 0, left: 0, right: 300, top: 104, bottom: 300, blocks: [] },
                { containerId: box.id, cell: 1, left: 320, right: 620, top: 104, bottom: 300, blocks: [] },
              ],
            },
          ],
        },
      ],
    };
    expect(dropTarget(layout, 310, 100, true)).toMatchObject({ containerId: box.id, cell: 0 });
    expect(dropTarget(layout, 600, 100, true)).toEqual({ sectionId: doc.sections[0].id, index: 2 });
  });
});

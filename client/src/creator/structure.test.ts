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
  stepTarget,
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
    expect(flat("ÁNGU")).toEqual(["angle"]);
  });

  it("pone primero lo que empieza como el nombre y agrupa por familias", () => {
    expect(flat("tabla").slice(0, 2)).toEqual(["table", "value_table"]);
    expect(filterBlockFamilies("tabla")[0].id).toBe("tables");
    expect(flat("diagrama de")[0]).toBe("bar_chart");
    expect(flat("re")[0]).toBe("callout");
  });

  it("encuentra por sinónimos, por la descripción y por la familia", () => {
    expect(flat("torta")).toEqual(["pie_chart"]);
    expect(flat("probabilidad")).toEqual(["tree_diagram"]);
    expect(flat("cuartiles")).toEqual(["box_plot"]);
    expect(flat("ecuacion")).toEqual(expect.arrayContaining(["math", "balance"]));
    expect(flat("geometria")).toEqual(["shapes", "angle", "clock"]);
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
    expect(key("ArrowLeft", { altKey: true, shiftKey: true })).toBeNull();
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

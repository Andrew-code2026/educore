import { describe, expect, it } from "vitest";
import { emptyDoc, type BlockInput, type CreatorActivity, type ResourceDoc } from "@shared/creator";
import { agree, blockName, clipWords, countLabel, describeActivity } from "@shared/creatorActivity";
import { parseMessageExtras, serializeMessageExtras } from "@shared/creatorTurn";
import { executeCreatorTool } from "./creatorTools";

/** Ejecuta herramientas como lo hace el agente y devuelve el documento final con la ficha de cada una. */
function run(steps: Array<[string, unknown]>, start: ResourceDoc = emptyDoc()) {
  let doc = start;
  const activities: CreatorActivity[] = [];
  for (const [name, input] of steps) {
    const outcome = executeCreatorTool(doc, name, input);
    doc = outcome.doc;
    activities.push(outcome.activity);
  }
  return { doc, activities };
}

const exercise = (label: string, md = "Calcula el área de la figura.") => ({ type: "exercise", label, md });
const guide: BlockInput[] = [
  { type: "paragraph", md: "En este taller calcularás el área de figuras compuestas, escribirás funciones lineales y factorizarás trinomios sencillos." },
  { type: "callout", title: "Conceptos clave", md: "Una figura compuesta se divide en figuras básicas." },
  exercise("Ejercicio 1"),
  exercise("Ejercicio 2"),
] as BlockInput[];

function base() {
  return run([
    ["set_document_meta", { title: "Taller: áreas, funciones lineales y factorización" }],
    ["write_section", { title: "Parte 1 · Áreas de figuras compuestas", role: "student", blocks: guide }],
    ["write_section", { title: "Clave de respuestas (docente)", role: "answer_key", blocks: [{ type: "solution", label: "Ejercicio 1", steps: ["Se suman las áreas."], answer: "24 m²" }] }],
  ]);
}

describe("cortar texto en límite de palabra", () => {
  it("no parte palabras y no deja puntuación antes de los puntos suspensivos", () => {
    const text = "En este taller calcularás el área de figuras compuestas, escribirás funciones";
    const clipped = clipWords(text, 52);
    expect(clipped).toBe("En este taller calcularás el área de figuras…");
    expect(clipped.length).toBeLessThanOrEqual(52);
    expect(clipWords("Cálculo de áreas compuestas, escribirás", 30)).toBe("Cálculo de áreas compuestas…");
  });

  it("deja igual lo que cabe y normaliza los espacios", () => {
    expect(clipWords("  Ejercicio   3  ", 40)).toBe("Ejercicio 3");
  });

  it("corta donde caiga una sola palabra más larga que el espacio", () => {
    expect(clipWords("Supercalifragilisticoespialidoso", 10)).toBe("Supercali…");
  });
});

describe("el nombre de un bloque", () => {
  it("usa el rótulo del ejercicio y el título del recuadro", () => {
    expect(blockName(exercise("Ejercicio 3") as BlockInput)).toBe("Ejercicio 3");
    expect(blockName({ type: "callout", title: "Conceptos clave", md: "…", tone: "info" })).toBe("Recuadro «Conceptos clave»");
    expect(blockName({ type: "solution", label: "Ejercicio 8", steps: [] })).toBe("Solución del Ejercicio 8");
  });

  it("cita el comienzo de un texto, sin fórmulas en crudo de más", () => {
    expect(blockName({ type: "paragraph", md: "Calcula **el área** de cada figura y escribe la función lineal que la describe." }, 30)).toBe("Texto «Calcula el área de cada…»");
  });

  it("nombra las figuras por su título o pie, y si no, por su tipo", () => {
    expect(blockName({ type: "bar_chart", title: "Frutas preferidas", bars: [{ label: "Mango", value: 4 }] } as BlockInput)).toBe("Diagrama de barras «Frutas preferidas»");
    expect(blockName({ type: "page_break" })).toBe("Salto de página");
  });
});

describe("la concordancia del participio", () => {
  it("sigue el género y el número del tipo de bloque", () => {
    expect(agree("añadid", ["exercise"])).toBe("añadido");
    expect(agree("añadid", ["graph"])).toBe("añadida");
    expect(agree("añadid", ["angle"])).toBe("añadidos");
    expect(agree("eliminad", ["table", "solution"])).toBe("eliminadas");
    expect(agree("eliminad", ["table", "exercise"])).toBe("eliminados");
  });
});

describe("cómo se lee cada acción de la IA", () => {
  it("al crear el recurso: título y secciones, que llevan a la hoja", () => {
    const { doc, activities } = base();
    const [title, section] = activities.map(activity => describeActivity(activity, doc));
    expect(title).toMatchObject({ kind: "title", subject: "Título", detail: "«Taller: áreas, funciones lineales y factorización»", linked: false });
    expect(section).toMatchObject({ kind: "section", subject: "Sección «Parte 1 · Áreas de figuras compuestas»", detail: "creada", linked: true });
  });

  it("un bloque añadido se nombra como en la hoja", () => {
    const start = base();
    const sectionId = start.doc.sections[0].id;
    const { doc, activities } = run([["insert_blocks", { section_id: sectionId, at: "end", blocks: [exercise("Ejercicio 3"), { type: "table", caption: "Costo de la cerca", header: ["Metros", "Costo"], rows: [["1", "12000"]] }] }]], start.doc);
    expect(describeActivity(activities[0], doc)).toMatchObject({ kind: "add", subject: "Ejercicio 3 y Tabla «Costo de la cerca»", detail: "añadidos en «Parte 1 · Áreas de figuras compuestas»", linked: true });
  });

  it("una edición dice qué bloque, cortado en palabra entera", () => {
    const start = base();
    const intro = start.doc.sections[0].blocks[0];
    const { doc, activities } = run([["update_block", { block_id: intro.id, block: { type: "paragraph", md: "En este taller calcularás el área de figuras compuestas, escribirás funciones lineales a partir de una situación." } }]], start.doc);
    const view = describeActivity(activities[0], doc);
    expect(view.kind).toBe("edit");
    expect(view.subject).toBe("Texto «En este taller calcularás el área de…»");
    expect(view.detail).toBe("editado");
    expect(view.linked).toBe(true);
  });

  it("una eliminación nombra lo eliminado y no lleva a ninguna parte", () => {
    const start = base();
    const [, callout, first] = start.doc.sections[0].blocks;
    const { doc, activities } = run([["delete_blocks", { block_ids: [first.id] }], ["delete_blocks", { block_ids: [callout.id] }]], start.doc);
    expect(activities[0].removed).toEqual([{ type: "exercise", name: "Ejercicio 1" }]);
    expect(describeActivity(activities[0], doc)).toMatchObject({ kind: "delete", subject: "Ejercicio 1", detail: "eliminado de «Parte 1 · Áreas de figuras compuestas»", linked: false });
    expect(describeActivity(activities[1], doc).subject).toBe("Recuadro «Conceptos clave»");
  });

  it("lo eliminado se conserva al guardar el mensaje y al leerlo", () => {
    const start = base();
    const { activities } = run([["delete_blocks", { block_ids: [start.doc.sections[1].blocks[0].id] }]], start.doc);
    const extras = parseMessageExtras(serializeMessageExtras({ activity: activities, suggestions: ["Otra cosa"] }));
    expect(extras.activity[0].removed).toEqual([{ type: "solution", name: "Solución del Ejercicio 1" }]);
    // Lo que no se reconoce se descarta sin romper la ficha
    const raw = JSON.stringify([{ label: "Bloque eliminado", ok: true, changed: true, removed: [{ type: "inventado", name: "X" }, { type: "exercise", name: 3 }] }]);
    expect(parseMessageExtras(raw).activity[0]).toEqual({ label: "Bloque eliminado", ok: true, changed: true });
  });

  it("los mensajes guardados antes de esta versión se siguen leyendo", () => {
    const { doc } = base();
    const clave = doc.sections[1];
    const intro = doc.sections[0].blocks[0];
    // Las tres fichas de la captura del docente («elimina el ejercicio 8»), tal como quedaron guardadas
    const stored: CreatorActivity[] = [
      { label: "Sección «Parte 4 · Producto final (en grupo)» eliminada", ok: true, changed: true },
      { label: "Bloque eliminado", ok: true, changed: true, sectionId: clave.id },
      { label: "Actualizado: En este taller calcularás el área de figuras compuestas, esc", ok: true, changed: true, blockIds: [intro.id], sectionId: doc.sections[0].id },
    ];
    const views = stored.map(activity => describeActivity(activity, doc));
    expect(views[0]).toMatchObject({ kind: "delete", subject: "Sección «Parte 4 · Producto final (en grupo)»", detail: "eliminada", linked: false });
    expect(views[1]).toMatchObject({ kind: "delete", subject: "Bloque", detail: "eliminado de «Clave de respuestas (docente)»", linked: false });
    expect(views[2]).toMatchObject({ kind: "edit", subject: "Texto «En este taller calcularás el área de…»", linked: true });
    expect(countLabel(views)).toBe("3 cambios");
  });

  it("si el bloque ya no está, la edición se nombra con lo que guardó la ficha", () => {
    const view = describeActivity({ label: "Actualizado: Ejercicio 3. Calcula el área sombreada", ok: true, changed: true, blockIds: ["bnoexiste"] }, emptyDoc());
    expect(view).toMatchObject({ kind: "edit", subject: "Ejercicio 3", detail: "editado", linked: false });
    const loose = describeActivity({ label: "Actualizado: Una figura compuesta se divide en figuras básicas y se suman", ok: true, changed: true }, emptyDoc());
    expect(loose.subject).toBe("Bloque «Una figura compuesta se divide en…»");
  });

  it("los reintentos y lo que no cambió no cuentan como cambios", () => {
    const retry = describeActivity({ label: "Revisando el contenido", ok: false, changed: false }, emptyDoc());
    const same = describeActivity({ label: "Sin cambios en «Guía»", ok: true, changed: false }, emptyDoc());
    expect(retry).toMatchObject({ kind: "retry", counts: false, linked: false });
    expect(same).toMatchObject({ kind: "same", counts: false });
    expect(countLabel([retry, same])).toBe("Sin cambios en el recurso");
    expect(countLabel([])).toBe("");
  });

  it("un texto desconocido se muestra recortado, sin romper", () => {
    const view = describeActivity({ label: "Algo que hizo una versión futura del asistente con un texto muy largo de verdad", ok: true, changed: true }, emptyDoc());
    expect(view.kind).toBe("edit");
    expect(view.subject.endsWith("…")).toBe(true);
    expect(view.subject.length).toBeLessThanOrEqual(60);
  });
});

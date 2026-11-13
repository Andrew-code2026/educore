import { describe, expect, it } from "vitest";
import { blockInputSchema, emptyDoc, RESOURCE_KIND_LABELS, type ResourceDoc } from "@shared/creator";
import { applyDocOp } from "@shared/creatorOps";
import { SAMPLE_IDS, SAMPLES } from "@shared/creatorSample";
import { describeActivity } from "@shared/creatorActivity";
import { buildCreatorMessages, CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { buildClarifyMessage, CLARIFY_SYSTEM_PROMPT } from "./creatorClarify";
import { CREATOR_TOOLS, executeCreatorTool, previewBlocks } from "./creatorTools";

const context = { kind: "guia" as const, schoolName: "Colegio Demo", courseLabel: "9A", subjectLabel: "Matemáticas", gradeLabel: "9°" };

function write(doc: ResourceDoc, blocks: unknown[], extra: Record<string, unknown> = {}) {
  return executeCreatorTool(doc, "write_section", { title: "Guía", role: "student", blocks, ...extra });
}

describe("herramientas del agente", () => {
  it("publica esquemas de objeto para todas las herramientas", () => {
    expect(CREATOR_TOOLS.map(tool => tool.name)).toEqual([
      "set_document_meta",
      "write_section",
      "update_section",
      "delete_section",
      "insert_blocks",
      "update_block",
      "delete_blocks",
      "wrap_blocks",
      "unwrap_container",
    ]);
    for (const tool of CREATOR_TOOLS) {
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema).not.toHaveProperty("$schema");
      expect(tool.description.length).toBeGreaterThan(10);
    }
    // Los campos con valor por defecto no son obligatorios para el modelo
    const serialized = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    expect(serialized).toContain("value_table");
    expect(serialized).toContain("answerSpace");
    // Las figuras llegan al modelo desde el mismo esquema que valida el documento
    for (const type of ["number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance"]) expect(serialized, type).toContain(`"${type}"`);
  });

  it.each(SAMPLE_IDS)("escribe el ejemplo %s completo sin errores", id => {
    let doc = emptyDoc(SAMPLES[id].title);
    for (const section of SAMPLES[id].sections) {
      const outcome = executeCreatorTool(doc, "write_section", section);
      expect(outcome.isError, outcome.result).toBe(false);
      doc = outcome.doc;
    }
    expect(doc.sections).toHaveLength(2);
  });

  it("devuelve al modelo los errores de formato sin tocar el documento", () => {
    const doc = emptyDoc();
    const outcome = write(doc, [{ type: "paragraph" }]);
    expect(outcome.isError).toBe(true);
    expect(outcome.doc).toBe(doc);
    expect(outcome.result).toContain("md");
  });

  it("rechaza un punto mal calculado y le dice el valor correcto", () => {
    const outcome = write(emptyDoc(), [
      { type: "graph", spec: { xMin: -2, xMax: 4, yMin: -7, yMax: 5, functions: [{ expr: "2*x - 3" }], points: [{ x: 2, y: 2, on: 0 }] } },
    ]);
    expect(outcome.isError).toBe(true);
    expect(outcome.result).toContain("la función vale 1");
    expect(outcome.doc.sections).toHaveLength(0);
  });

  it("devuelve al modelo un ejercicio cuyos renglones separan el enunciado de su figura", () => {
    const graph = { type: "graph", spec: { xMin: -2, xMax: 4, yMin: -4, yMax: 8, functions: [{ expr: "-2*x + 4" }], points: [] } };
    const exercise = { type: "exercise", label: "Ejercicio 4", md: "La gráfica muestra la recta. ¿Cuál es su pendiente?" };

    const rejected = write(emptyDoc(), [exercise, graph]);
    expect(rejected.isError).toBe(true);
    expect(rejected.result).toContain("Ejercicio 4");
    expect(rejected.doc.sections).toHaveLength(0);

    expect(write(emptyDoc(), [graph, exercise]).isError).toBe(false);
    expect(write(emptyDoc(), [{ ...exercise, answerSpace: "none" }, graph]).isError).toBe(false);

    // Insertar una figura justo después de un ejercicio con renglones también se revisa
    const base = write(emptyDoc(), [exercise, { type: "paragraph", md: "Cierre." }]);
    const section = base.doc.sections[0];
    const inserted = executeCreatorTool(base.doc, "insert_blocks", { section_id: section.id, after_block_id: section.blocks[0].id, blocks: [graph] });
    expect(inserted.isError).toBe(true);
  });

  it("no bloquea una edición ajena por un orden que ya venía así", () => {
    const graph = { type: "graph", spec: { xMin: -2, xMax: 4, yMin: -4, yMax: 8, functions: [{ expr: "-2*x + 4" }], points: [] } };
    // Documento que el docente dejó así a mano (las operaciones directas no validan el orden)
    const created = write(emptyDoc(), [{ type: "exercise", label: "Ejercicio 1", md: "Observa.", answerSpace: "none" }, graph, { type: "paragraph", md: "Fin" }]);
    const [first, , last] = created.doc.sections[0].blocks;
    const manual = applyDocOp(created.doc, { op: "update_block", blockId: first.id, block: { type: "exercise", label: "Ejercicio 1", md: "Observa.", parts: [], answerSpace: "lines", lines: 3 } as never });
    if (!manual.ok) throw new Error(manual.error);
    const edited = executeCreatorTool(manual.doc, "update_block", { block_id: last.id, block: { type: "paragraph", md: "Fin de la guía" } });
    expect(edited.isError, edited.result).toBe(false);
  });

  it("pide subíndices con guion bajo", () => {
    const outcome = write(emptyDoc(), [{ type: "paragraph", md: "Dados dos puntos $(x1, y1)$ y $(x2, y2)$." }]);
    expect(outcome.isError).toBe(true);
    expect(outcome.result).toContain("x_1");
  });

  it("rechaza LaTeX roto antes de que llegue al docente", () => {
    const outcome = write(emptyDoc(), [{ type: "paragraph", md: "La fracción $\\frac{1}{$ está mal." }]);
    expect(outcome.isError).toBe(true);
    expect(outcome.result).toContain("LaTeX");
  });

  it("acepta los pesos sin escapar y los guarda escapados", () => {
    const outcome = write(emptyDoc(), [{ type: "paragraph", md: "El pasaje cuesta $2.950 en Bogotá." }]);
    expect(outcome.isError).toBe(false);
    expect(outcome.doc.sections[0].blocks[0]).toMatchObject({ md: "El pasaje cuesta \\$2.950 en Bogotá." });
  });

  it("edita un bloque por id y reporta cuando no cambia nada", () => {
    const created = write(emptyDoc(), [{ type: "paragraph", md: "Original" }]);
    const blockId = created.doc.sections[0].blocks[0].id;

    const edited = executeCreatorTool(created.doc, "update_block", { block_id: blockId, block: { type: "paragraph", md: "Corregido" } });
    expect(edited.isError).toBe(false);
    expect(edited.activity.changed).toBe(true);
    expect(edited.result).toContain(blockId);

    const same = executeCreatorTool(edited.doc, "update_block", { block_id: blockId, block: { type: "paragraph", md: "Corregido" } });
    expect(same.activity.changed).toBe(false);
    expect(same.result).toContain("quedó igual");

    const missing = executeCreatorTool(edited.doc, "update_block", { block_id: "bnope99", block: { type: "paragraph", md: "x" } });
    expect(missing.isError).toBe(true);
  });

  it("inserta después de un bloque y elimina por id", () => {
    const created = write(emptyDoc(), [{ type: "paragraph", md: "Uno" }, { type: "paragraph", md: "Tres" }]);
    const section = created.doc.sections[0];
    const inserted = executeCreatorTool(created.doc, "insert_blocks", {
      section_id: section.id,
      after_block_id: section.blocks[0].id,
      blocks: [{ type: "paragraph", md: "Dos" }],
    });
    expect(inserted.doc.sections[0].blocks.map(block => (block.type === "paragraph" ? block.md : ""))).toEqual(["Uno", "Dos", "Tres"]);

    const removed = executeCreatorTool(inserted.doc, "delete_blocks", { block_ids: [section.blocks[1].id] });
    expect(removed.doc.sections[0].blocks).toHaveLength(2);
  });

  it("no ejecuta herramientas que no existen", () => {
    expect(executeCreatorTool(emptyDoc(), "run_shell", { cmd: "ls" }).isError).toBe(true);
  });

  it("muestra solo los bloques terminados mientras la IA escribe", () => {
    const preview = previewBlocks({
      title: "Guía",
      role: "student",
      blocks: [{ type: "paragraph", md: "Completo" }, { type: "math", latex: "y = 2x" }, { type: "paragraph", md: "A medi" }],
    });
    expect(preview?.blocks).toHaveLength(2);
    expect(previewBlocks({ title: "Guía" })).toBeNull();
    expect(previewBlocks(null)).toBeNull();
  });
});

describe("petición al modelo", () => {
  it("abre con un mensaje del docente e incluye contexto, documento y solicitud", () => {
    const messages = buildCreatorMessages({
      mode: "chat",
      doc: { title: "Funciones", sections: [] },
      history: [
        { id: 1, role: "assistant", content: "huérfano", activity: [], createdAt: new Date() },
        { id: 2, role: "user", content: "Crea una guía", activity: [], createdAt: new Date() },
        { id: 3, role: "assistant", content: "Listo.", activity: [], createdAt: new Date() },
      ],
      request: "Añade un ejercicio de contexto",
      context,
    });
    expect(messages[0].role).toBe("user");
    expect(messages).toHaveLength(3);
    const last = messages[messages.length - 1].content as string;
    expect(last).toContain("Matemáticas");
    expect(last).toContain("Colegio Demo");
    expect(last).toContain('"title":"Funciones"');
    expect(last).toContain("Añade un ejercicio de contexto");
  });

  it("avisa cuando el documento está vacío", () => {
    const messages = buildCreatorMessages({ mode: "generate", doc: emptyDoc(), history: [], request: "Guía de fracciones", context });
    expect(messages).toHaveLength(1);
    expect(messages[0].content as string).toContain("vacío");
  });

  it("mantiene el prompt del sistema sin datos variables, para que se pueda cachear", () => {
    expect(CREATOR_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(CREATOR_SYSTEM_PROMPT).toContain("write_section");
  });

  it("explica al modelo cada figura que puede dibujar", () => {
    for (const type of ["graph", "number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance"]) expect(CREATOR_SYSTEM_PROMPT, type).toContain(type);
  });

  it("arma la petición de preguntas con el contexto que haya", () => {
    const message = buildClarifyMessage({ kind: "taller", prompt: "  Taller de la célula  ", subjectLabel: "Ciencias Naturales", gradeLabel: null });
    expect(message).toContain(`Tipo de recurso: ${RESOURCE_KIND_LABELS.taller.label}`);
    expect(message).toContain("Asignatura: Ciencias Naturales");
    expect(message).not.toContain("Grado:");
    expect(message).toContain("<solicitud_del_docente>\nTaller de la célula\n</solicitud_del_docente>");
    expect(CLARIFY_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("la IA con columnas y tarjetas", () => {
  const paragraph = (md: string) => ({ type: "paragraph", md });
  const exercise = (label: string) => ({ type: "exercise", label, md: `Calcula lo de ${label}.` });

  it("cada tipo de bloque va una vez en el esquema, con su nombre", () => {
    const schema = CREATOR_TOOLS.find(tool => tool.name === "insert_blocks")!.input_schema as { $defs: Record<string, unknown> };
    expect(Object.keys(schema.$defs)).toContain("exercise");
    expect(Object.keys(schema.$defs).some(key => key.startsWith("__schema"))).toBe(false);
    // Escrito una sola vez: no crece por llevar los bloques también dentro de las celdas
    expect(JSON.stringify(schema).length).toBeLessThan(50_000);
    expect(JSON.stringify(schema).match(/"const":"exercise"/g)).toHaveLength(1);
  });

  it("escribe columnas y luego añade y edita dentro de una celda", () => {
    let doc = write(emptyDoc(), [paragraph("Intro"), { type: "columns", columns: [{ blocks: [exercise("Ejercicio 1")] }, { blocks: [exercise("Ejercicio 2")] }] }]).doc;
    const section = doc.sections[0];
    const columns = section.blocks[1];
    expect(columns.type).toBe("columns");
    const added = executeCreatorTool(doc, "insert_blocks", { section_id: section.id, container_id: columns.id, cell: 1, blocks: [exercise("Ejercicio 3")] });
    expect(added.isError, added.result).toBe(false);
    expect(added.activity.blockIds).toHaveLength(1);
    doc = added.doc;
    const third = added.activity.blockIds![0];
    const edited = executeCreatorTool(doc, "update_block", { block_id: third, block: exercise("Ejercicio 3b") });
    expect(edited.isError, edited.result).toBe(false);
    expect(describeActivity(edited.activity, edited.doc)).toMatchObject({ kind: "edit", subject: "Ejercicio 3b", linked: true });
  });

  it("le explica al modelo qué no cabe y dónde", () => {
    const outcome = write(emptyDoc(), [
      { type: "columns", columns: [{ blocks: [{ type: "bar_chart", bars: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }] }, { blocks: [paragraph("x")] }] },
    ]);
    expect(outcome.isError).toBe(true);
    expect(outcome.result).toMatch(/Bloque 1 — Diagrama de barras no cabe legible en la columna 1: necesita al menos dos tercios/);
  });

  it("revisa el orden dentro de una celda y deja pasar una figura en la columna de al lado", () => {
    const plane = { type: "graph", spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, functions: [], points: [] } };
    const beside = write(emptyDoc(), [{ type: "columns", columns: [{ blocks: [exercise("Ejercicio 1")] }, { blocks: [plane] }] }]);
    expect(beside.isError, beside.result).toBe(false);
    const below = write(emptyDoc(), [{ type: "columns", columns: [{ blocks: [exercise("Ejercicio 1"), plane] }, { blocks: [paragraph("x")] }] }]);
    expect(below.isError).toBe(true);
    expect(below.result).toContain("columna 1, Ejercicio 1");
  });

  it("pone en columnas lo que ya existe y lo vuelve a sacar, con fichas que se leen", () => {
    let doc = write(emptyDoc(), [exercise("Ejercicio 1"), exercise("Ejercicio 2"), paragraph("Cierre")]).doc;
    const [first, second, closing] = doc.sections[0].blocks;
    const wrapped = executeCreatorTool(doc, "wrap_blocks", { block_ids: [first.id, second.id], as: "columns" });
    expect(wrapped.isError, wrapped.result).toBe(false);
    expect(describeActivity(wrapped.activity, wrapped.doc)).toMatchObject({ kind: "move", subject: "Ejercicio 1 y Ejercicio 2", detail: "puestos en columnas", linked: true });
    doc = wrapped.doc;
    const container = wrapped.activity.blockIds![0];
    const unwrapped = executeCreatorTool(doc, "unwrap_container", { container_id: container });
    expect(unwrapped.isError, unwrapped.result).toBe(false);
    expect(describeActivity(unwrapped.activity, unwrapped.doc)).toMatchObject({ kind: "move", subject: "Ejercicio 1 y Ejercicio 2", detail: "sacados de las columnas" });
    expect(unwrapped.doc.sections[0].blocks.map(block => block.id)).toEqual([first.id, second.id, closing.id]);
  });

  it("borrar un contenedor lo nombra en la ficha", () => {
    const doc = write(emptyDoc(), [{ type: "cards", cards: [{ title: "Pendiente", blocks: [paragraph("m")] }] }]).doc;
    const removed = executeCreatorTool(doc, "delete_blocks", { block_ids: [doc.sections[0].blocks[0].id] });
    expect(removed.activity.removed).toEqual([{ type: "cards", name: "Tarjetas «Pendiente»" }]);
  });

  it("devuelve los valores calculados de una figura dentro de una celda", () => {
    const outcome = write(emptyDoc(), [
      { type: "columns", columns: [{ blocks: [paragraph("Datos")] }, { width: 2, blocks: [{ type: "box_plot", series: [{ data: [1, 2, 3, 4, 5, 6, 7] }] }] }] },
    ]);
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("Valores calculados por el sistema");
  });

  it("las instrucciones dicen cuándo convienen y cuándo no", () => {
    expect(CREATOR_SYSTEM_PROMPT).toContain("## Columnas y tarjetas");
    expect(CREATOR_SYSTEM_PROMPT).toContain("wrap_blocks");
  });
});

describe("la IA no deja columnas desparejas", () => {
  const longText = { type: "paragraph", md: "Un texto largo que explica con calma cada paso del procedimiento para el estudiante. ".repeat(12) };
  const short = { type: "exercise", label: "Ejercicio 1", md: "Calcula 2 + 2.", lines: 2 };

  it("rechaza un texto largo junto a algo corto y dice cómo arreglarlo", () => {
    const outcome = write(emptyDoc(), [{ type: "columns", columns: [{ blocks: [longText] }, { blocks: [short] }] }]);
    expect(outcome.isError).toBe(true);
    expect(outcome.activity.label).toBe("Revisando el diseño");
    expect(outcome.result).toMatch(/Sección «Guía», columnas: La columna 1 es mucho más larga que la columna 2/);
  });

  it("no la bloquea por columnas que ya estaban así", () => {
    const blocks = [blockInputSchema.parse({ type: "columns", columns: [{ blocks: [longText] }, { blocks: [short] }] }), blockInputSchema.parse({ type: "paragraph", md: "Otro" })];
    const made = applyDocOp(emptyDoc(), { op: "write_section", title: "Guía", role: "student", blocks });
    if (!made.ok) throw new Error(made.error);
    const other = made.doc.sections[0].blocks[1];
    const outcome = executeCreatorTool(made.doc, "update_block", { block_id: other.id, block: { type: "paragraph", md: "Otro texto" } });
    expect(outcome.isError, outcome.result).toBe(false);
  });
});

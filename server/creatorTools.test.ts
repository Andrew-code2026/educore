import { describe, expect, it } from "vitest";
import { emptyDoc, RESOURCE_KIND_LABELS, type ResourceDoc } from "@shared/creator";
import { SAMPLE_IDS, SAMPLES } from "@shared/creatorSample";
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

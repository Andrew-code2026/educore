import { describe, expect, it } from "vitest";
import { findBlock, parseDoc, type ResourceDoc } from "@shared/creator";
import { applyDocOp, type DocOp } from "@shared/creatorOps";
import { buildSampleDoc } from "@shared/creatorSample";
import {
  ATTACH_MAX,
  decideTurnUndo,
  describeFocus,
  describeTurn,
  diffTurn,
  hasTurnChanges,
  parseMessageExtras,
  resolveAttachments,
  reuseUnchanged,
  sameJson,
  sanitizeSuggestions,
  serializeMessageExtras,
  splitSuggestions,
  SUGGESTION_CHARS_MAX,
  visibleReply,
} from "@shared/creatorTurn";
import { buildCreatorMessages, CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { executeCreatorTool } from "./creatorTools";

const apply = (doc: ResourceDoc, op: DocOp) => {
  const result = applyDocOp(doc, op);
  if (!result.ok) throw new Error(result.error);
  return result;
};

const sample = () => buildSampleDoc("funciones");
/** Como llega del servidor: los mismos datos en objetos nuevos. */
const fresh = (doc: ResourceDoc) => parseDoc(JSON.stringify(doc));
const paragraph = (md: string) => ({ type: "paragraph" as const, md });

describe("cambios de un turno", () => {
  it("no encuentra cambios entre un documento y su copia", () => {
    const doc = sample();
    const changes = diffTurn(doc, fresh(doc));
    expect(changes).toEqual({ added: [], changed: [], removed: 0, meta: false });
    expect(hasTurnChanges(changes)).toBe(false);
  });

  it("separa lo añadido, lo cambiado y lo eliminado", () => {
    const before = sample();
    const [first, second, third] = before.sections[0].blocks;
    let after = apply(before, { op: "update_block", blockId: second.id, block: paragraph("Texto nuevo") }).doc;
    const inserted = apply(after, { op: "insert_blocks", sectionId: before.sections[0].id, afterBlockId: first.id, blocks: [paragraph("Uno"), paragraph("Dos")] });
    after = apply(inserted.doc, { op: "delete_blocks", blockIds: [third.id] }).doc;

    const changes = diffTurn(before, fresh(after));
    expect(changes.added).toEqual(inserted.ids);
    expect(changes.changed).toEqual([second.id]);
    expect(changes.removed).toBe(1);
    expect(changes.meta).toBe(false);
    expect(describeTurn(changes)).toBe("La IA añadió 2 bloques, cambió 1 y eliminó 1");
  });

  it("mover un bloque sin tocarlo no cuenta como cambio", () => {
    const before = sample();
    const after = apply(before, { op: "move_block", blockId: before.sections[0].blocks[0].id, direction: "down" }).doc;
    expect(hasTurnChanges(diffTurn(before, after))).toBe(false);
  });

  it("una sección reescrita cuenta sus bloques como eliminados y añadidos", () => {
    const before = sample();
    const section = before.sections[0];
    const after = apply(before, { op: "write_section", sectionId: section.id, title: section.title, role: section.role, blocks: [paragraph("Solo esto")] }).doc;
    const changes = diffTurn(before, after);
    expect(changes.added).toHaveLength(1);
    expect(changes.removed).toBe(section.blocks.length);
  });

  it("avisa de los cambios de título y de encabezado de sección", () => {
    const before = sample();
    const retitled = apply(before, { op: "set_meta", title: "Otro título" }).doc;
    expect(diffTurn(before, retitled)).toMatchObject({ added: [], changed: [], removed: 0, meta: true });
    expect(describeTurn(diffTurn(before, retitled))).toBe("La IA cambió los títulos");
    const renamed = apply(before, { op: "update_section", sectionId: before.sections[1].id, title: "Respuestas" }).doc;
    expect(diffTurn(before, renamed).meta).toBe(true);
  });

  it("redacta el resumen en singular y en plural", () => {
    expect(describeTurn({ added: ["a"], changed: [], removed: 0, meta: false })).toBe("La IA añadió 1 bloque");
    expect(describeTurn({ added: [], changed: ["a", "b", "c", "d"], removed: 0, meta: false })).toBe("La IA cambió 4 bloques");
    expect(describeTurn({ added: [], changed: [], removed: 2, meta: false })).toBe("La IA eliminó 2 bloques");
    expect(describeTurn({ added: [], changed: ["a"], removed: 0, meta: true })).toBe("La IA cambió 1 bloque y retocó los títulos");
  });

  it("compara datos sin depender del orden de las claves", () => {
    expect(sameJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameJson([], {})).toBe(false);
  });
});

describe("documento del servidor con los objetos de antes", () => {
  it("devuelve el mismo documento si nada cambió", () => {
    const doc = sample();
    expect(reuseUnchanged(doc, fresh(doc))).toBe(doc);
  });

  it("conserva los bloques y secciones intactos y estrena solo lo que cambió", () => {
    const before = sample();
    const target = before.sections[0].blocks[1];
    const after = fresh(apply(before, { op: "update_block", blockId: target.id, block: paragraph("Cambiado") }).doc);
    const merged = reuseUnchanged(before, after);

    expect(merged).not.toBe(before);
    expect(merged).toEqual(after);
    expect(merged.sections[1]).toBe(before.sections[1]);
    expect(merged.sections[0]).not.toBe(before.sections[0]);
    expect(merged.sections[0].blocks[0]).toBe(before.sections[0].blocks[0]);
    expect(merged.sections[0].blocks[1]).not.toBe(target);
    expect(merged.sections[0].blocks[1]).toMatchObject({ md: "Cambiado" });
  });

  it("reconoce un bloque intacto aunque haya cambiado de sitio", () => {
    const before = sample();
    const moved = before.sections[0].blocks[0];
    const merged = reuseUnchanged(before, fresh(apply(before, { op: "move_block", blockId: moved.id, direction: "down" }).doc));
    expect(merged.sections[0].blocks[1]).toBe(moved);
    expect(merged.sections[0]).not.toBe(before.sections[0]);
  });
});

describe("bloques señalados", () => {
  it("describe los bloques que existen y quita los repetidos", () => {
    const doc = sample();
    const [first, second] = doc.sections[0].blocks;
    const check = resolveAttachments(doc, [second.id, first.id, second.id]);
    if (!check.ok) throw new Error("deberían existir");
    expect(check.attachments.map(item => item.id)).toEqual([second.id, first.id]);
    expect(check.attachments[0]).toMatchObject({ id: second.id, type: second.type });
    expect(check.attachments.every(item => item.preview.length > 0 && item.preview.length <= 90)).toBe(true);
  });

  it("rechaza los ids que no están en el documento y dice cuáles", () => {
    const doc = sample();
    const check = resolveAttachments(doc, [doc.sections[0].blocks[0].id, "bnoexiste", doc.sections[0].id]);
    expect(check).toEqual({ ok: false, missing: ["bnoexiste", doc.sections[0].id] });
  });

  it("no pasa del máximo de bloques por mensaje", () => {
    const doc = sample();
    const ids = doc.sections.flatMap(section => section.blocks.map(block => block.id));
    expect(ids.length).toBeGreaterThan(ATTACH_MAX);
    const check = resolveAttachments(doc, ids);
    expect(check.ok && check.attachments.length).toBe(ATTACH_MAX);
  });

  it("le dice al modelo qué bloques señaló el docente", () => {
    const doc = sample();
    const exercise = doc.sections[0].blocks.find(block => block.type === "exercise")!;
    const focus = describeFocus(doc, [exercise.id, "bnoexiste"]);
    expect(focus.split("\n")).toHaveLength(1);
    expect(focus).toContain(exercise.id);
    expect(focus).toContain("Ejercicio");
    expect(focus).toContain(`«${doc.sections[0].title}»`);

    const context = { kind: "guia" as const, schoolName: "Colegio Demo", courseLabel: null, subjectLabel: "Matemáticas", gradeLabel: "9°" };
    const withFocus = buildCreatorMessages({ mode: "chat", doc, history: [], request: "Hazlo más fácil", context, focusBlockIds: [exercise.id] });
    const content = withFocus[0].content as string;
    expect(content).toContain(`<bloques_señalados>\n- ${exercise.id}`);
    expect(content.indexOf("<bloques_señalados>")).toBeGreaterThan(content.indexOf("</documento_actual>"));
    expect(content.indexOf("<bloques_señalados>")).toBeLessThan(content.indexOf("<solicitud_del_docente>"));

    const without = buildCreatorMessages({ mode: "chat", doc, history: [], request: "Hazlo más fácil", context });
    expect(without[0].content as string).not.toContain("bloques_señalados>");
    expect(CREATOR_SYSTEM_PROMPT).toContain("<bloques_señalados>");
  });

  it("recuerda en el historial qué bloques se señalaron en un mensaje anterior", () => {
    const doc = sample();
    const context = { kind: "guia" as const, schoolName: "Colegio Demo", courseLabel: null, subjectLabel: null, gradeLabel: null };
    const messages = buildCreatorMessages({
      mode: "chat",
      doc,
      context,
      request: "Ahora más corto",
      history: [
        { id: 1, role: "user", content: "Hazlo más fácil", activity: [], createdAt: new Date(), attachments: [{ id: "b1", type: "exercise", preview: "Ejercicio 3. Halla la pendiente" }] },
        { id: 2, role: "assistant", content: "Listo.", activity: [], createdAt: new Date() },
      ],
    });
    expect(messages[0].content).toContain("Hazlo más fácil");
    expect(messages[0].content).toContain("«Ejercicio 3. Halla la pendiente»");
  });
});

describe("fichas que llevan al cambio", () => {
  const start = () => executeCreatorTool({ title: "Guía", sections: [] }, "write_section", { title: "Guía", role: "student", blocks: [paragraph("Uno"), paragraph("Dos")] });

  it("una sección escrita guarda sus bloques y su sección", () => {
    const written = start();
    const section = written.doc.sections[0];
    expect(written.activity.blockIds).toEqual(section.blocks.map(block => block.id));
    expect(written.activity.sectionId).toBe(section.id);
  });

  it("insertar y actualizar guardan los bloques tocados", () => {
    const { doc } = start();
    const section = doc.sections[0];
    const inserted = executeCreatorTool(doc, "insert_blocks", { section_id: section.id, after_block_id: section.blocks[0].id, blocks: [paragraph("Uno y medio")] });
    expect(inserted.activity.blockIds).toHaveLength(1);
    expect(findBlock(inserted.doc, inserted.activity.blockIds![0])?.index).toBe(1);

    const updated = executeCreatorTool(doc, "update_block", { block_id: section.blocks[1].id, block: paragraph("Dos, corregido") });
    expect(updated.activity.blockIds).toEqual([section.blocks[1].id]);

    const same = executeCreatorTool(doc, "update_block", { block_id: section.blocks[1].id, block: paragraph("Dos") });
    expect(same.activity.changed).toBe(false);
    expect(same.activity.blockIds).toBeUndefined();
  });

  it("borrar bloques lleva a la sección donde estaban", () => {
    const { doc } = start();
    const removed = executeCreatorTool(doc, "delete_blocks", { block_ids: [doc.sections[0].blocks[0].id] });
    expect(removed.activity.blockIds).toBeUndefined();
    expect(removed.activity.sectionId).toBe(doc.sections[0].id);

    const gone = executeCreatorTool(doc, "delete_section", { section_id: doc.sections[0].id });
    expect(gone.activity.sectionId).toBeUndefined();
  });
});

describe("sugerencias de seguimiento", () => {
  const reply = "Añadí dos ejercicios de contexto.\n\n<sugerencias>\n- Añade una gráfica al ejercicio 7\n- «Haz una versión más corta»\n1. Agrega un reto opcional\n- Otra más que ya no cabe\n</sugerencias>";

  it("separa el mensaje de las sugerencias", () => {
    const parsed = splitSuggestions(reply);
    expect(parsed.text).toBe("Añadí dos ejercicios de contexto.");
    expect(parsed.suggestions).toEqual(["Añade una gráfica al ejercicio 7", "Haz una versión más corta", "Agrega un reto opcional"]);
  });

  it("deja el mensaje como está cuando no hay sugerencias", () => {
    expect(splitSuggestions("  ¿Para qué grado es?  ")).toEqual({ text: "¿Para qué grado es?", suggestions: [] });
  });

  it("aprovecha un bloque que quedó sin cerrar y conserva el texto que venga después", () => {
    expect(splitSuggestions("Listo.\n<sugerencias>\n- Añade la clave de respuestas").suggestions).toEqual(["Añade la clave de respuestas"]);
    expect(splitSuggestions("Listo.\n<sugerencias>\n- Añade la clave\n</sugerencias>\nRevisa el ejercicio 2.").text).toBe("Listo.\n\nRevisa el ejercicio 2.");
  });

  it("descarta las repetidas, las vacías y las que no caben en un botón", () => {
    expect(sanitizeSuggestions(["- Hazlo más corto", "hazlo más corto", "", "  ", 4, "x".repeat(SUGGESTION_CHARS_MAX + 1), "* Añade un reto"])).toEqual(["Hazlo más corto", "Añade un reto"]);
  });

  it("las deja como texto de botón, sin marcas de Markdown", () => {
    expect(sanitizeSuggestions(["- Cambia el costo fijo a \\$75.000", "- Haz **más corto** el Ejercicio 4"])).toEqual(["Cambia el costo fijo a $75.000", "Haz más corto el Ejercicio 4"]);
  });

  it("nunca muestra el bloque mientras la respuesta va llegando", () => {
    let shown = "";
    for (let length = 1; length <= reply.length; length++) {
      const visible = visibleReply(reply.slice(0, length));
      // Lo mostrado solo crece: lo ya enviado al docente no se puede retirar
      expect(visible.startsWith(shown)).toBe(true);
      expect(visible).not.toContain("<s");
      shown = visible;
    }
    expect(shown.trim()).toBe("Añadí dos ejercicios de contexto.");
  });

  it("reconoce la etiqueta en mayúsculas y corta bien aunque el texto tenga letras que cambian de longitud en minúsculas", () => {
    const odd = "İstanbul: listo.\n<SUGERENCIAS>\n- Añade un mapa de İstanbul\n</Sugerencias>\nFin.";
    expect(visibleReply(odd)).toBe("İstanbul: listo.\n");
    expect(splitSuggestions(odd)).toEqual({ text: "İstanbul: listo.\n\nFin.", suggestions: ["Añade un mapa de İstanbul"] });
  });

  it("no retiene para siempre un signo «<» que no abre el bloque", () => {
    expect(visibleReply("Si x <")).toBe("Si x ");
    expect(visibleReply("Si x <", true)).toBe("Si x <");
    expect(visibleReply("Listo.\n<sugerencias>\n- Hazlo más corto", true)).toBe("Listo.\n");
    expect(visibleReply("Si x < 3")).toBe("Si x < 3");
    expect(visibleReply("Usa <sub>")).toBe("Usa <sub>");
  });

  it("el prompt pide las sugerencias con el formato que se sabe leer", () => {
    expect(CREATOR_SYSTEM_PROMPT).toContain("<sugerencias>");
    expect(CREATOR_SYSTEM_PROMPT).toContain("</sugerencias>");
  });
});

describe("deshacer un turno", () => {
  const before = sample();
  const after = apply(before, { op: "update_block", blockId: before.sections[0].blocks[1].id, block: paragraph("Lo que escribió la IA") }).doc;
  const edited = apply(after, { op: "set_meta", title: "Editado después" }).doc;

  it("restaura sin preguntar si el documento sigue como lo dejó la IA", () => {
    expect(decideTurnUndo({ current: fresh(after), before, after })).toBe("restore");
  });

  it("no hace nada si ya está como antes del turno", () => {
    expect(decideTurnUndo({ current: fresh(before), before, after })).toBe("already");
    expect(decideTurnUndo({ current: fresh(before), before, after, force: true })).toBe("already");
  });

  it("pregunta antes de llevarse cambios posteriores, y con la respuesta restaura", () => {
    expect(decideTurnUndo({ current: edited, before, after })).toBe("confirm");
    expect(decideTurnUndo({ current: edited, before, after, force: true })).toBe("restore");
  });

  it("pregunta si ya no se conserva la versión que dejó la IA", () => {
    expect(decideTurnUndo({ current: after, before, after: null })).toBe("confirm");
  });
});

describe("lo que se guarda con cada mensaje", () => {
  it("un mensaje con solo fichas se guarda como lista, igual que antes", () => {
    const raw = serializeMessageExtras({ activity: [{ label: "Bloque eliminado", ok: true, changed: true }] });
    expect(raw).toBe('[{"label":"Bloque eliminado","ok":true,"changed":true}]');
    expect(parseMessageExtras(raw)).toEqual({ activity: [{ label: "Bloque eliminado", ok: true, changed: true }] });
    expect(serializeMessageExtras({})).toBeNull();
  });

  it("guarda y recupera bloques señalados, cambios del turno y sugerencias", () => {
    const extras = {
      activity: [{ label: "Actualizado: Ejercicio 3", ok: true, changed: true, blockIds: ["b1"], sectionId: "s1" }],
      attachments: [{ id: "b1", type: "exercise" as const, preview: "Ejercicio 3. Halla la pendiente" }],
      turn: { baseVersion: 7, added: ["b9"], changed: ["b1"], removed: 2, meta: false },
      suggestions: ["Añade una gráfica al ejercicio 3"],
    };
    expect(parseMessageExtras(serializeMessageExtras(extras))).toEqual(extras);
  });

  it("lee lo guardado antes de este cambio y no falla con datos dañados", () => {
    expect(parseMessageExtras('[{"label":"Sección «Guía» creada","ok":true,"changed":true},{"sin":"rótulo"}]').activity).toHaveLength(1);
    expect(parseMessageExtras(null)).toEqual({ activity: [] });
    expect(parseMessageExtras("{no es json")).toEqual({ activity: [] });
    expect(parseMessageExtras('"texto"')).toEqual({ activity: [] });
    const odd = parseMessageExtras(JSON.stringify({ activity: "x", attachments: [{ id: 3 }, { id: "b1", type: "inventado", preview: "x" }], turn: { added: ["b1"] }, suggestions: [7] }));
    expect(odd).toEqual({ activity: [] });
  });
});

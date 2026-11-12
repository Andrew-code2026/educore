import { describe, expect, it } from "vitest";
import { blockInputSchema, type Block, type BlockInput } from "@shared/creator";
import { buildSampleDoc } from "@shared/creatorSample";
import { validateBlock } from "@shared/creatorValidate";
import { canonicalDraft, insertPart, isInlineBlock, isInlineType, lineMd, nextPartLabel, removePart, resolveDraft, richMd, sameContent, toDraft } from "./inlineDraft";
import { collapseSpaces, isolateDisplayFormulas, parseMd, serializeMd, serializeSingleLine } from "./mdModel";

const paragraph = (md: string): Block => ({ id: "b1", type: "paragraph", md });

describe("texto del editor en sitio", () => {
  it("deja cada fórmula destacada en su propio párrafo, como la dibuja la hoja", () => {
    const blocks = isolateDisplayFormulas(parseMd("El área es $$A = b \\cdot h$$ donde $b$ es la base."));
    expect(blocks).toEqual([
      { t: "p", inlines: [{ t: "text", text: "El área es" }] },
      { t: "p", inlines: [{ t: "formula", latex: "A = b \\cdot h", display: true }] },
      { t: "p", inlines: [{ t: "text", text: "donde " }, { t: "formula", latex: "b" }, { t: "text", text: " es la base." }] },
    ]);
    expect(serializeMd(blocks)).toBe("El área es\n\n$$A = b \\cdot h$$\n\ndonde $b$ es la base.");
  });

  it("no toca los párrafos sin fórmula destacada ni las listas", () => {
    const blocks = parseMd("Con $x^2$ en línea.\n\n- uno\n- dos");
    expect(isolateDisplayFormulas(blocks)).toEqual(blocks);
  });

  it("no deja párrafos vacíos cuando la fórmula destacada va sola o al principio", () => {
    expect(richMd("$$x = 2$$")).toBe("$$x = 2$$");
    expect(richMd("$$x = 2$$ es la solución.")).toBe("$$x = 2$$\n\nes la solución.");
  });

  it("deja un solo espacio donde hay varios, como los dibuja la hoja", () => {
    const blocks = collapseSpaces(parseMd("  a) $x = 2$   b)  **dos**  palabras  \n\n-  uno   solo"));
    expect(serializeMd(blocks)).toBe("a) $x = 2$ b) **dos** palabras\n\n- uno solo");
    expect(richMd("Sin  espacios   dobles.")).toBe("Sin espacios dobles.");
    // Un texto que solo difiere en espacios repetidos no es un cambio
    expect(resolveDraft(paragraph("Hola   $x^2$  mundo."), { type: "paragraph", md: "Hola $x^2$ mundo." })).toEqual({ status: "unchanged" });
  });

  it("une en un renglón lo que el docente pegó en varios", () => {
    expect(serializeSingleLine(parseMd("Halla $x$\n\ny explica\n\n- por qué"))).toBe("Halla $x$ y explica por qué");
    expect(lineMd("  Un **título**  ")).toBe("Un **título**");
  });
});

describe("qué bloques se editan en sitio", () => {
  it("los de texto sí; las figuras, tablas y fórmulas conservan su formulario", () => {
    for (const type of ["paragraph", "heading", "callout", "exercise", "solution"] as const) expect(isInlineType(type), type).toBe(true);
    for (const type of ["math", "table", "value_table", "graph", "number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance", "header_fields", "page_break"] as const) {
      expect(isInlineType(type), type).toBe(false);
    }
  });
});

describe("salir de un bloque editado en sitio", () => {
  it("no guarda nada si no se escribió nada", () => {
    expect(resolveDraft(paragraph("Hola $x^2$."), { type: "paragraph", md: "Hola $x^2$." })).toEqual({ status: "unchanged" });
  });

  it("no cuenta como cambio que el editor reescriba el Markdown a su manera", () => {
    // Lo que devuelve el editor al tocar y deshacer: cursiva con asterisco, viñetas con guion, fórmula destacada aparte
    const original = paragraph("Una _idea_ clave: $$a^2 + b^2 = c^2$$\n\n* uno\n* dos");
    const rewritten = richMd(original.type === "paragraph" ? original.md : "");
    expect(rewritten).not.toBe("Una _idea_ clave: $$a^2 + b^2 = c^2$$\n\n* uno\n* dos");
    expect(resolveDraft(original, { type: "paragraph", md: rewritten })).toEqual({ status: "unchanged" });
  });

  it("guarda el cambio ya normalizado: los pesos no se leen como fórmulas", () => {
    const outcome = resolveDraft(paragraph("El pasaje cuesta poco."), { type: "paragraph", md: "El pasaje cuesta $2.900 y el taxi $9.000 en total." });
    expect(outcome).toEqual({ status: "ok", block: { type: "paragraph", md: "El pasaje cuesta \\$2.900 y el taxi \\$9.000 en total." } });
  });

  it("rechaza un texto vacío con un aviso que el docente entiende", () => {
    expect(resolveDraft(paragraph("Hola"), { type: "paragraph", md: "" })).toEqual({ status: "invalid", issues: ["El texto no puede quedar vacío."] });
    const heading: Block = { id: "b2", type: "heading", text: "Actividad", level: 2 };
    expect(resolveDraft(heading, { type: "heading", text: "  ", level: 2 })).toEqual({ status: "invalid", issues: ["El título no puede quedar vacío."] });
  });

  it("rechaza una fórmula que no compila, con las mismas reglas que sigue la IA", () => {
    const outcome = resolveDraft(paragraph("Hola"), { type: "paragraph", md: "Resuelve $\\frac{1}{$ ahora." });
    expect(outcome.status).toBe("invalid");
    expect(outcome.status === "invalid" && outcome.issues[0]).toContain("no es LaTeX válido");
    // El aviso no arrastra el nombre interno del tipo de bloque
    expect(outcome.status === "invalid" && outcome.issues[0]).toMatch(/^La fórmula /);
  });

  it("guarda el cambio de tamaño de un título aunque el texto sea el mismo", () => {
    const heading: Block = { id: "b2", type: "heading", text: "Actividad", level: 2 };
    expect(resolveDraft(heading, { type: "heading", text: "Actividad", level: 3 })).toEqual({ status: "ok", block: { type: "heading", text: "Actividad", level: 3 } });
  });

  it("quita el título de un recuadro que quedó en blanco", () => {
    const callout: Block = { id: "b3", type: "callout", title: "Recuerda", md: "La pendiente es $m$.", tone: "info" };
    const outcome = resolveDraft(callout, { type: "callout", title: "   ", md: "La pendiente es $m$.", tone: "info" });
    expect(outcome.status).toBe("ok");
    expect(outcome.status === "ok" && outcome.block).toEqual({ type: "callout", title: undefined, md: "La pendiente es $m$.", tone: "info" });
    // Abrir el campo del título y dejarlo vacío en un recuadro que no tenía no es un cambio
    const plain: Block = { id: "b4", type: "callout", md: "Texto.", tone: "tip" };
    expect(resolveDraft(plain, { type: "callout", title: "", md: "Texto.", tone: "tip" })).toEqual({ status: "unchanged" });
  });

  it("nombra el inciso o el paso que quedó vacío", () => {
    const exercise: Block = { id: "b5", type: "exercise", label: "Ejercicio 1", md: "Calcula.", parts: [{ label: "a", md: "$2 + 2$" }], answerSpace: "lines", lines: 4 };
    const withEmpty: BlockInput = { ...toDraft(exercise), parts: [{ label: "a", md: "$2 + 2$" }, { label: "b", md: "" }] };
    expect(resolveDraft(exercise, withEmpty)).toEqual({ status: "invalid", issues: ["El inciso b no puede quedar vacío."] });

    const solution: Block = { id: "b6", type: "solution", label: "Ejercicio 1", steps: ["Se suma."], answer: "$4$" };
    expect(resolveDraft(solution, { ...toDraft(solution), steps: ["Se suma.", ""] })).toEqual({ status: "invalid", issues: ["El paso 2 no puede quedar vacío."] });
    // Una respuesta final en blanco se quita en vez de bloquear el guardado
    const cleared = resolveDraft(solution, { ...toDraft(solution), answer: "" });
    expect(cleared.status === "ok" && cleared.block).toEqual({ type: "solution", label: "Ejercicio 1", steps: ["Se suma."], answer: undefined });
  });

  it("guarda un inciso nuevo y el espacio de respuesta elegido en la barra", () => {
    const exercise: Block = { id: "b5", type: "exercise", label: "Ejercicio 1", md: "Calcula.", parts: [], answerSpace: "lines", lines: 4 };
    const outcome = resolveDraft(exercise, { ...toDraft(exercise), parts: [{ label: nextPartLabel(0), md: "Halla $x$" }], answerSpace: "grid", lines: 6 });
    expect(outcome.status === "ok" && outcome.block).toMatchObject({ parts: [{ label: "a", md: "Halla $x$" }], answerSpace: "grid", lines: 6 });
    expect(resolveDraft(exercise, { ...toDraft(exercise), lines: Number.NaN })).toEqual({ status: "invalid", issues: ["El alto del espacio de respuesta no es válido."] });
  });

  it("al añadir o quitar un inciso las letras siguen en orden", () => {
    const parts = [
      { label: "a", md: "uno" },
      { label: "b", md: "dos" },
      { label: "c", md: "tres" },
    ];
    expect(insertPart(parts, 0).map(part => `${part.label}:${part.md}`)).toEqual(["a:uno", "b:", "c:dos", "d:tres"]);
    expect(removePart(parts, 0).map(part => `${part.label}:${part.md}`)).toEqual(["a:dos", "b:tres"]);
    expect(insertPart([], -1)).toEqual([{ label: "a", md: "" }]);
  });

  it("no toca las letras que el docente puso a su manera", () => {
    const parts = [
      { label: "i", md: "uno" },
      { label: "ii", md: "dos" },
    ];
    expect(insertPart(parts, 1).map(part => part.label)).toEqual(["i", "ii", "c"]);
    expect(removePart(parts, 0).map(part => part.label)).toEqual(["ii"]);
  });

  it("compara sin depender del orden de las claves", () => {
    const a: BlockInput = { type: "callout", title: "T", md: "Texto.", tone: "info" };
    const b: BlockInput = { tone: "info", md: "Texto.", type: "callout", title: "T" };
    expect(sameContent(a, b)).toBe(true);
  });
});

describe("el recurso de ejemplo en el editor en sitio", () => {
  const blocks = buildSampleDoc().sections.flatMap(section => section.blocks).filter(isInlineBlock);

  it("tiene bloques de los cinco tipos de texto", () => {
    expect(new Set(blocks.map(block => block.type))).toEqual(new Set(["paragraph", "heading", "callout", "exercise", "solution"]));
  });

  it("lo que devuelve el editor sin tocar nada es estable y pasa las validaciones", () => {
    for (const block of blocks) {
      const written = canonicalDraft(toDraft(block));
      expect(canonicalDraft(written), block.id).toEqual(written);
      expect(blockInputSchema.safeParse(written).success, block.id).toBe(true);
      expect(validateBlock(written), block.id).toEqual([]);
      expect(resolveDraft(block, written), block.id).toEqual({ status: "unchanged" });
    }
  });
});

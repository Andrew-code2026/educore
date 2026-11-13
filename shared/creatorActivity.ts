import { BLOCK_TYPE_LABELS, findBlock, plainText, type BlockInput, type BlockType, type CreatorActivity, type ResourceDoc } from "./creator";

/**
 * Cómo se lee en el chat cada cosa que hizo la IA: qué tipo de acción fue (para el icono) y qué tocó,
 * con las palabras del docente («Ejercicio 3», «Recuadro “Conceptos clave”»). Puro: parte de la ficha
 * guardada (su texto lo escribe `applyDocOp` en creatorOps.ts) y del documento tal como está ahora.
 */

export type ActivityKind = "title" | "section" | "add" | "edit" | "delete" | "move" | "same" | "retry";

export interface ActivityView {
  kind: ActivityKind;
  /** Lo que se tocó: «Ejercicio 3», «Sección “Parte 1”». */
  subject: string;
  /** El verbo y el lugar: «añadido en “Parte 2”». Puede ir vacío. */
  detail: string;
  /** Sigue en la hoja algo a lo que ir. Lo eliminado nunca lleva a ninguna parte. */
  linked: boolean;
  /** Cuenta en el resumen del turno: las fichas sin cambios y los reintentos no. */
  counts: boolean;
}

/** Palabras que no deben quedar al final de un texto cortado: «el área de…» se lee mejor como «el área…». */
const DANGLING = new Set(["a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "lo", "los", "o", "para", "por", "que", "se", "su", "sus", "u", "un", "una", "y"]);

/** Corta en límite de palabra, sin dejar puntuación ni una preposición colgando antes de los puntos suspensivos. */
export function clipWords(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const room = flat.slice(0, Math.max(1, max - 1));
  const space = room.lastIndexOf(" ");
  // Una sola palabra más larga que el espacio se corta donde caiga
  if (space < max * 0.4) return `${room}…`;
  const words = room.slice(0, space).split(" ");
  while (words.length > 1 && DANGLING.has(words[words.length - 1].toLowerCase()) && words.slice(0, -1).join(" ").length >= max * 0.4) words.pop();
  return `${words.join(" ").replace(/[\s,;:.·—–-]+$/u, "")}…`;
}

const quote = (text: string, max = 40) => `«${clipWords(text, max)}»`;

/** Género y número de cada tipo, para que el participio concuerde: «Gráfica añadida», «Ángulos añadidos». */
export type Agreement = "m" | "f" | "mp" | "fp";

const AGREEMENT: Record<BlockType, Agreement> = {
  header_fields: "mp",
  heading: "m",
  paragraph: "m",
  callout: "m",
  math: "f",
  exercise: "m",
  table: "f",
  value_table: "f",
  graph: "f",
  number_line: "f",
  fraction_model: "m",
  bar_chart: "m",
  pie_chart: "m",
  histogram: "m",
  box_plot: "m",
  line_chart: "f",
  scatter_plot: "m",
  angle: "mp",
  venn: "m",
  tree_diagram: "m",
  bar_model: "m",
  pictogram: "m",
  clock: "m",
  base_ten: "mp",
  area_model: "m",
  shapes: "fp",
  balance: "f",
  solution: "f",
  page_break: "m",
};

const ENDINGS: Record<Agreement, string> = { m: "o", f: "a", mp: "os", fp: "as" };

/**
 * Un ejercicio se llama como su rótulo, y el rótulo lo pone quien escribe: «Pregunta 12», «Actividad 2».
 * El participio concuerda con la primera palabra del rótulo; si no se reconoce, en masculino como «Ejercicio».
 */
const FEMININE_LABELS = new Set(["actividad", "consigna", "evaluacion", "lectura", "mision", "parte", "practica", "pregunta", "prueba", "situacion", "tarea"]);

function labelAgreement(label: string): Agreement {
  const first = (label.trim().split(/\s+/)[0] ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return FEMININE_LABELS.has(first) ? "f" : "m";
}

/** La concordancia de un bloque: la de su tipo, o la de su rótulo si es un ejercicio. */
export function agreementOf(item: { type: BlockType; name: string }): Agreement {
  return item.type === "exercise" ? labelAgreement(item.name) : AGREEMENT[item.type];
}

/** «añadid» + concordancias → «añadido», «añadida», «añadidos»… Varias mezcladas van en masculino plural. */
export function agree(stem: string, agreements: readonly Agreement[]): string {
  if (agreements.length === 0) return `${stem}o`;
  if (agreements.length === 1) return stem + ENDINGS[agreements[0]];
  return stem + (agreements.every(agreement => agreement === "f" || agreement === "fp") ? "as" : "os");
}

const agreeAll = (stem: string, items: ReadonlyArray<{ type: BlockType; name: string }>) => agree(stem, items.map(agreementOf));

/** El nombre con que el docente reconoce un bloque en la hoja. */
export function blockName(block: BlockInput, max = 40): string {
  const type = BLOCK_TYPE_LABELS[block.type];
  switch (block.type) {
    case "exercise":
      return clipWords(block.label, 28);
    case "solution":
      return /^ejercicio\b/i.test(block.label) ? `Solución del ${clipWords(block.label, 28)}` : `Solución ${quote(block.label, 28)}`;
    case "heading":
      return `Título ${quote(block.text, max)}`;
    case "paragraph":
      return `Texto ${quote(plainText(block.md, 400), max)}`;
    case "callout":
      return `Recuadro ${quote(block.title || plainText(block.md, 400), max)}`;
    case "math":
    case "header_fields":
    case "page_break":
      return type;
  }
  // Tablas y figuras: el título o el pie de figura las distinguen de otras del mismo tipo
  const named = ("title" in block && block.title) || ("caption" in block && block.caption) || "";
  return named ? `${type} ${quote(plainText(named, 400), max)}` : type;
}

/** «Ejercicio 3», «Ejercicio 3 y Gráfica», «Ejercicio 3, Gráfica y 4 más». `total` cuenta también los que no tienen nombre guardado. */
function listNames(items: ReadonlyArray<{ name: string }>, total = items.length): string {
  if (total <= 1) return items[0].name;
  if (total === 2 && items.length >= 2) return `${items[0].name} y ${items[1].name}`;
  if (items.length === 1) return `${items[0].name} y ${total - 1} más`;
  return `${items[0].name}, ${items[1].name} y ${total - 2} más`;
}

/** Bloques de la ficha que siguen en el documento, con su nombre de ahora. */
function liveBlocks(activity: CreatorActivity, doc: ResourceDoc, max: number) {
  return (activity.blockIds ?? []).flatMap(id => {
    const found = findBlock(doc, id);
    return found ? [{ type: found.block.type, name: blockName(found.block, max) }] : [];
  });
}

/** «Ejercicio 3. Calcula…» → «Ejercicio 3»; si no hay rótulo, un fragmento entre comillas. */
function nameFromPreview(preview: string): string {
  const own = /^([A-ZÁÉÍÓÚÑ][^.:]{0,24}?\s\d+[a-z]?)[.:](\s|$)/u.exec(preview);
  return own ? own[1] : `Bloque ${quote(preview)}`;
}

const many = (count: number, one: string, other: string) => (count === 1 ? one : `${count} ${other}`);

export function describeActivity(activity: CreatorActivity, doc: ResourceDoc): ActivityView {
  const label = activity.label.replace(/\s+/g, " ").trim();
  // Un intento que el sistema rechazó y la IA corrige: no es un error del docente ni un cambio
  if (!activity.ok) return { kind: "retry", subject: clipWords(label, 60), detail: "", linked: false, counts: false };
  if (!activity.changed) return { kind: "same", subject: clipWords(label, 60), detail: "", linked: false, counts: false };

  const section = activity.sectionId ? doc.sections.find(candidate => candidate.id === activity.sectionId) : undefined;
  let match: RegExpExecArray | null;

  if ((match = /^Título: «(.*)»$/.exec(label))) return { kind: "title", subject: "Título", detail: quote(match[1], 56), linked: false, counts: true };

  if ((match = /^Sección «(.*)» (creada|actualizada|eliminada)$/.exec(label))) {
    const subject = `Sección ${quote(match[1], 44)}`;
    if (match[2] === "eliminada") return { kind: "delete", subject, detail: "eliminada", linked: false, counts: true };
    return { kind: "section", subject, detail: match[2] === "creada" ? "creada" : "editada", linked: section !== undefined || liveBlocks(activity, doc, 40).length > 0, counts: true };
  }

  if ((match = /^(?:Bloque añadido|(\d+) bloques añadidos) en «(.*)»$/.exec(label))) {
    const where = `en ${quote(match[2], 40)}`;
    const blocks = liveBlocks(activity, doc, 28);
    if (blocks.length > 0) return { kind: "add", subject: listNames(blocks), detail: `${agreeAll("añadid", blocks)} ${where}`, linked: true, counts: true };
    const count = Number(match[1] ?? 1);
    return { kind: "add", subject: many(count, "Bloque", "bloques"), detail: `${count === 1 ? "añadido" : "añadidos"} ${where}`, linked: section !== undefined, counts: true };
  }

  if ((match = /^Actualizado: (.*)$/.exec(label))) {
    const blocks = liveBlocks(activity, doc, 40);
    if (blocks.length > 0) return { kind: "edit", subject: listNames(blocks), detail: agreeAll("editad", blocks), linked: true, counts: true };
    return { kind: "edit", subject: nameFromPreview(match[1]), detail: "editado", linked: false, counts: true };
  }

  if ((match = /^(?:Bloque eliminado|(\d+) bloques eliminados)$/.exec(label))) {
    const removed = activity.removed ?? [];
    const count = Number(match[1] ?? 1);
    // La ficha guarda la sección del primer bloque borrado: solo se nombra si fue uno solo (un ejercicio y su solución viven en secciones distintas)
    const where = section && count === 1 ? ` de ${quote(section.title, 40)}` : "";
    // El servidor guarda hasta REMOVED_MAX nombres; el recuento real lo da el texto de la ficha
    const total = Math.max(count, removed.length);
    if (removed.length > 0) {
      const agreement = total > removed.length ? agree("eliminad", ["m", "m"]) : agreeAll("eliminad", removed);
      return { kind: "delete", subject: listNames(removed, total), detail: `${agreement}${where}`, linked: false, counts: true };
    }
    return { kind: "delete", subject: many(count, "Bloque", "bloques"), detail: `${count === 1 ? "eliminado" : "eliminados"}${where}`, linked: false, counts: true };
  }

  // La IA no tiene hoy herramienta para mover, pero la operación existe en creatorOps.ts y su ficha se reconoce
  if (label === "Bloque movido") {
    const blocks = liveBlocks(activity, doc, 40);
    return { kind: "move", subject: blocks.length > 0 ? listNames(blocks) : "Bloque", detail: agreeAll("movid", blocks), linked: blocks.length > 0, counts: true };
  }

  // Un texto que no se reconoce (de una versión futura o anterior): se muestra tal cual, recortado
  const linked = liveBlocks(activity, doc, 40).length > 0 || section !== undefined;
  return { kind: "edit", subject: clipWords(label, 60), detail: "", linked, counts: true };
}

/** «3 cambios»: lo que dice el resumen plegado de un turno. */
export function countLabel(views: readonly ActivityView[]): string {
  const count = views.filter(view => view.counts).length;
  if (count === 0) return views.length > 0 ? "Sin cambios en el recurso" : "";
  return count === 1 ? "1 cambio" : `${count} cambios`;
}

/** Cuántas fichas se ven sin desplegar: un turno con más acciones arranca plegado. */
export const ACTIVITY_OPEN_MAX = 4;

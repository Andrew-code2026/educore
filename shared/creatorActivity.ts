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

/** Corta en límite de palabra, sin dejar puntuación colgando antes de los puntos suspensivos. */
export function clipWords(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const room = flat.slice(0, Math.max(1, max - 1));
  const space = room.lastIndexOf(" ");
  // Una sola palabra más larga que el espacio se corta donde caiga
  const cut = space >= max * 0.4 ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:.·—–-]+$/u, "")}…`;
}

const quote = (text: string, max = 40) => `«${clipWords(text, max)}»`;

/** Género y número de cada tipo, para que el participio concuerde: «Gráfica añadida», «Ángulos añadidos». */
type Agreement = "m" | "f" | "mp" | "fp";

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

/** «añadid» + tipos → «añadido», «añadida», «añadidos»… Varios tipos mezclados van en masculino plural. */
export function agree(stem: string, types: readonly BlockType[]): string {
  if (types.length === 0) return `${stem}o`;
  if (types.length === 1) return stem + ENDINGS[AGREEMENT[types[0]]];
  return stem + (types.every(type => AGREEMENT[type] === "f" || AGREEMENT[type] === "fp") ? "as" : "os");
}

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

function listNames(items: ReadonlyArray<{ name: string }>): string {
  if (items.length === 1) return items[0].name;
  if (items.length === 2) return `${items[0].name} y ${items[1].name}`;
  return `${items[0].name}, ${items[1].name} y ${items.length - 2} más`;
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
    if (blocks.length > 0) return { kind: "add", subject: listNames(blocks), detail: `${agree("añadid", blocks.map(block => block.type))} ${where}`, linked: true, counts: true };
    const count = Number(match[1] ?? 1);
    return { kind: "add", subject: many(count, "Bloque", "bloques"), detail: `${count === 1 ? "añadido" : "añadidos"} ${where}`, linked: section !== undefined, counts: true };
  }

  if ((match = /^Actualizado: (.*)$/.exec(label))) {
    const blocks = liveBlocks(activity, doc, 40);
    if (blocks.length > 0) return { kind: "edit", subject: listNames(blocks), detail: agree("editad", blocks.map(block => block.type)), linked: true, counts: true };
    return { kind: "edit", subject: nameFromPreview(match[1]), detail: "editado", linked: false, counts: true };
  }

  if ((match = /^(?:Bloque eliminado|(\d+) bloques eliminados)$/.exec(label))) {
    const where = section ? ` de ${quote(section.title, 40)}` : "";
    const removed = activity.removed ?? [];
    if (removed.length > 0) return { kind: "delete", subject: listNames(removed), detail: `${agree("eliminad", removed.map(item => item.type))}${where}`, linked: false, counts: true };
    const count = Number(match[1] ?? 1);
    return { kind: "delete", subject: many(count, "Bloque", "bloques"), detail: `${count === 1 ? "eliminado" : "eliminados"}${where}`, linked: false, counts: true };
  }

  if (label === "Bloque movido") {
    const blocks = liveBlocks(activity, doc, 40);
    return { kind: "move", subject: blocks.length > 0 ? listNames(blocks) : "Bloque", detail: agree("movid", blocks.map(block => block.type)), linked: blocks.length > 0, counts: true };
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

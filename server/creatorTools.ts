import { z } from "zod";
import { blockInputSchema, CREATOR_LIMITS, findBlock, flattenBlocks, SECTION_ROLES, type BlockInput, type CreatorActivity, type ResourceDoc } from "@shared/creator";
import { blockName } from "@shared/creatorActivity";
import { applyDocOp, normalizeBlock, type DocOp } from "@shared/creatorOps";
import { layoutIssues } from "@shared/creatorContainers";
import { describeComputed } from "@shared/creatorStats";
import { REMOVED_MAX } from "@shared/creatorTurn";
import { blockOrderIssues, validateBlocks } from "@shared/creatorValidate";

/**
 * Herramientas con las que la IA escribe y edita un recurso. Cada una se traduce a una
 * operación sobre el documento (creatorOps). Antes de aplicarla se valida todo lo que
 * se puede comprobar; si algo falla, la herramienta devuelve el detalle para que el
 * modelo lo corrija en el mismo turno y el docente nunca vea el error.
 */

const sectionId = z.string().min(1).max(24);
const blockId = z.string().min(1).max(24);
const blocks = z.array(blockInputSchema).min(1).max(CREATOR_LIMITS.blocksPerSectionMax);

const TOOL_INPUTS = {
  set_document_meta: z.object({
    title: z.string().trim().min(1).max(CREATOR_LIMITS.titleMax).optional().describe("Título del recurso."),
    subtitle: z.string().trim().max(CREATOR_LIMITS.subtitleMax).optional().describe('Línea bajo el título, p. ej. "Guía de práctica · Matemáticas · Grado 9".'),
  }),
  write_section: z.object({
    section_id: sectionId.optional().describe("Id de una sección existente para reescribirla completa. Omítelo para crear una sección nueva al final."),
    title: z.string().trim().min(1).max(CREATOR_LIMITS.titleMax),
    role: z.enum(SECTION_ROLES).describe('"student" para lo que recibe el estudiante; "answer_key" para la clave de respuestas del docente.'),
    blocks,
  }),
  update_section: z.object({
    section_id: sectionId,
    title: z.string().trim().min(1).max(CREATOR_LIMITS.titleMax).optional(),
    role: z.enum(SECTION_ROLES).optional(),
  }),
  delete_section: z.object({ section_id: sectionId }),
  insert_blocks: z.object({
    section_id: sectionId,
    after_block_id: blockId
      .optional()
      .describe("Inserta justo después de este bloque. Puede ser un bloque de dentro de una columna o tarjeta: los nuevos van en esa misma celda. Si se omite, se usa `at`."),
    at: z.enum(["start", "end"]).default("end").describe("Dónde insertar cuando no se indica after_block_id."),
    container_id: blockId.optional().describe("Para insertar dentro de un bloque de columnas o de tarjetas: su id. Va con cell."),
    cell: z.number().int().min(0).max(CREATOR_LIMITS.cardsMax - 1).optional().describe("La columna o la tarjeta, contando desde 0, cuando se indica container_id."),
    blocks,
  }),
  update_block: z.object({
    block_id: blockId,
    block: blockInputSchema.describe("El bloque completo que reemplaza al actual. Puede cambiar de tipo."),
  }),
  delete_blocks: z.object({ block_ids: z.array(blockId).min(1).max(CREATOR_LIMITS.blocksPerSectionMax) }),
  wrap_blocks: z.object({
    block_ids: z.array(blockId).min(1).max(CREATOR_LIMITS.cardsMax).describe("Bloques seguidos de una misma sección, fuera de cualquier contenedor."),
    as: z.enum(["columns", "cards"]).describe('"columns" pone cada bloque en su columna (hasta 3; con uno solo, la segunda queda vacía). "cards" pone cada bloque en su tarjeta.'),
  }),
  unwrap_container: z.object({ container_id: blockId }),
} as const;

export type CreatorToolName = keyof typeof TOOL_INPUTS;

const TOOL_DESCRIPTIONS: Record<CreatorToolName, string> = {
  set_document_meta: "Cambia el título o el subtítulo del recurso.",
  write_section:
    "Escribe una sección completa del recurso con todos sus bloques. Úsala para crear el recurso (una llamada por sección) o para rehacer una sección entera. Para cambios puntuales usa update_block, insert_blocks o delete_blocks.",
  update_section: "Cambia el nombre o el tipo de una sección sin tocar sus bloques.",
  delete_section: "Elimina una sección con todos sus bloques.",
  insert_blocks: "Añade bloques nuevos a una sección existente, en la posición indicada.",
  update_block: "Reemplaza un bloque por una versión corregida. Es la herramienta para ediciones puntuales: cambia solo lo que se pidió y conserva el resto del bloque.",
  delete_blocks: "Elimina uno o varios bloques. Un bloque de columnas o de tarjetas se va con todo lo que guarda.",
  wrap_blocks: "Pone bloques que ya están en el recurso lado a lado en columnas, o cada uno en una tarjeta, sin reescribirlos.",
  unwrap_container: "Saca los bloques de un bloque de columnas o de tarjetas y los deja en la sección, en orden de lectura. El título de cada tarjeta queda como un título.",
};

export interface CreatorToolDefinition {
  name: CreatorToolName;
  description: string;
  input_schema: { type: "object"; [key: string]: unknown };
}

type Json = unknown;

/**
 * Cada tipo de bloque aparece dos veces en el esquema: en la sección y dentro de las columnas y las
 * tarjetas. Escrito dos veces, el esquema de una herramienta pasaría de 38 KB a 115 KB y cada turno
 * pagaría esa diferencia. Zod lo escribe una sola vez en `$defs`, con nombres genéricos (`__schema12`):
 * aquí cada bloque toma el nombre de su tipo, y lo demás que zod reutilizó vuelve a su sitio.
 */
export function nameBlockDefs(schema: Record<string, Json>): Record<string, Json> {
  const defs = (schema.$defs ?? {}) as Record<string, Record<string, Json>>;
  const names = new Map<string, string>();
  for (const [key, def] of Object.entries(defs)) {
    const type = (def.properties as Record<string, { const?: unknown }> | undefined)?.type?.const;
    if (typeof type === "string") names.set(key, type);
  }
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const { $ref, ...rest } = node as Record<string, Json>;
    if (typeof $ref === "string" && $ref.startsWith("#/$defs/")) {
      const key = $ref.slice("#/$defs/".length);
      const named = names.get(key);
      if (named) return { $ref: `#/$defs/${named}`, ...(walk(rest) as object) };
      return { ...(walk(defs[key]) as object), ...(walk(rest) as object) };
    }
    return Object.fromEntries(Object.entries(node as Record<string, Json>).map(([field, value]) => [field, walk(value)]));
  };
  const { $defs: _defs, ...body } = schema;
  const named = Object.fromEntries(Array.from(names, ([key, name]) => [name, walk(defs[key])]));
  return { ...(walk(body) as Record<string, Json>), ...(names.size > 0 ? { $defs: named } : {}) };
}

/** Definiciones para la API, en orden fijo: el prefijo de la petición no cambia y se puede cachear. */
export const CREATOR_TOOLS: CreatorToolDefinition[] = (Object.keys(TOOL_INPUTS) as CreatorToolName[]).map(name => {
  const { $schema: _schema, ...schema } = nameBlockDefs(z.toJSONSchema(TOOL_INPUTS[name], { io: "input", reused: "ref" }) as Record<string, Json>);
  return { name, description: TOOL_DESCRIPTIONS[name], input_schema: { ...schema, type: "object" } };
});

export interface ToolOutcome {
  doc: ResourceDoc;
  isError: boolean;
  /** Lo que lee el modelo como resultado de la herramienta. */
  result: string;
  activity: CreatorActivity;
}

const failure = (doc: ResourceDoc, label: string, result: string): ToolOutcome => ({
  doc,
  isError: true,
  result,
  activity: { label, ok: false, changed: false },
});

function toOp(name: CreatorToolName, input: unknown): { op: DocOp; blocks: BlockInput[] } {
  switch (name) {
    case "set_document_meta": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["set_document_meta"]>;
      return { op: { op: "set_meta", title: data.title, subtitle: data.subtitle }, blocks: [] };
    }
    case "write_section": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["write_section"]>;
      return { op: { op: "write_section", sectionId: data.section_id, title: data.title, role: data.role, blocks: data.blocks }, blocks: data.blocks };
    }
    case "update_section": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["update_section"]>;
      return { op: { op: "update_section", sectionId: data.section_id, title: data.title, role: data.role }, blocks: [] };
    }
    case "delete_section": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["delete_section"]>;
      return { op: { op: "delete_section", sectionId: data.section_id }, blocks: [] };
    }
    case "insert_blocks": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["insert_blocks"]>;
      const cell = data.container_id !== undefined ? { containerId: data.container_id, cell: data.cell ?? 0 } : {};
      return { op: { op: "insert_blocks", sectionId: data.section_id, afterBlockId: data.after_block_id, at: data.at, ...cell, blocks: data.blocks }, blocks: data.blocks };
    }
    case "update_block": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["update_block"]>;
      return { op: { op: "update_block", blockId: data.block_id, block: data.block }, blocks: [data.block] };
    }
    case "delete_blocks": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["delete_blocks"]>;
      return { op: { op: "delete_blocks", blockIds: data.block_ids }, blocks: [] };
    }
    case "wrap_blocks": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["wrap_blocks"]>;
      return { op: { op: "wrap_blocks", blockIds: data.block_ids, as: data.as }, blocks: [] };
    }
    case "unwrap_container": {
      const data = input as z.infer<(typeof TOOL_INPUTS)["unwrap_container"]>;
      return { op: { op: "unwrap_container", containerId: data.container_id }, blocks: [] };
    }
  }
}

export const isCreatorTool = (name: string): name is CreatorToolName => name in TOOL_INPUTS;

/** A dónde lleva la ficha de una operación: los bloques que creó o cambió y la sección donde ocurrió, si sigue en el documento. */
function locateActivity(before: ResourceDoc, after: ResourceDoc, op: DocOp, ids: string[]): Pick<CreatorActivity, "blockIds" | "sectionId"> {
  const blockIds = ids.filter(id => findBlock(after, id) !== null);
  const touched =
    op.op === "delete_blocks" || op.op === "wrap_blocks"
      ? findBlock(before, op.blockIds[0])?.section.id
      : op.op === "unwrap_container"
        ? findBlock(before, op.containerId)?.section.id
        : "sectionId" in op && op.sectionId
        ? op.sectionId
        : (ids.find(id => after.sections.some(section => section.id === id)) ?? (blockIds[0] ? findBlock(after, blockIds[0])?.section.id : undefined));
  const sectionId = after.sections.some(section => section.id === touched) ? touched : undefined;
  return { ...(blockIds.length > 0 ? { blockIds } : {}), ...(sectionId ? { sectionId } : {}) };
}

/** Qué eliminó la operación, con el nombre que el docente ve en la hoja: después ya no se puede buscar. */
function namedRemoved(before: ResourceDoc, blockIds: string[]): Pick<CreatorActivity, "removed"> {
  // Los repetidos cuentan una vez, como en applyDocOp
  const removed = Array.from(new Set(blockIds)).flatMap(id => {
    const found = findBlock(before, id);
    return found ? [{ type: found.block.type, name: blockName(found.block) }] : [];
  });
  return removed.length > 0 ? { removed: removed.slice(0, REMOVED_MAX) } : {};
}

/** Ejecuta una llamada de herramienta sobre el documento. No toca la base de datos. */
export function executeCreatorTool(doc: ResourceDoc, name: string, rawInput: unknown, random?: () => number): ToolOutcome {
  if (!isCreatorTool(name)) return failure(doc, "Herramienta desconocida", `No existe la herramienta "${name}".`);

  const parsed = TOOL_INPUTS[name].safeParse(rawInput);
  if (!parsed.success) {
    return failure(doc, "Formato no válido, corrigiendo", `La entrada no cumple el formato. Corrígela y vuelve a llamar la herramienta.\n${z.prettifyError(parsed.error)}`);
  }

  const { op, blocks: written } = toOp(name, parsed.data);
  const issues = validateBlocks(written.map(normalizeBlock));
  if (issues.length > 0) {
    return failure(
      doc,
      "Revisando el contenido",
      `No se aplicó ningún cambio porque el contenido tiene errores. Corrígelos y vuelve a llamar la herramienta con el contenido completo:\n- ${issues.slice(0, 20).join("\n- ")}`,
    );
  }

  const applied = applyDocOp(doc, op, random);
  if (!applied.ok) return failure(doc, "Sin cambios", applied.error);

  // El orden se revisa sobre el documento resultante y solo cuenta lo que este cambio introduce:
  // lo que el docente ya había dejado así no bloquea una edición ajena.
  const known = new Set(blockOrderIssues(doc.sections).map(issue => issue.key));
  const orderIssues = blockOrderIssues(applied.doc.sections)
    .filter(issue => !known.has(issue.key))
    .map(issue => issue.message);
  if (orderIssues.length > 0) {
    return failure(
      doc,
      "Revisando el orden",
      `No se aplicó ningún cambio porque el orden de los bloques deja mal ubicado un espacio de respuesta. Corrígelo y vuelve a llamar la herramienta:\n- ${orderIssues.slice(0, 8).join("\n- ")}`,
    );
  }

  // Columnas desparejas o un texto largo en una columna angosta: igual que el orden, solo cuenta lo que este cambio trae
  const knownLayout = new Set(layoutIssues(doc.sections).map(issue => issue.key));
  const layout = layoutIssues(applied.doc.sections).filter(issue => !knownLayout.has(issue.key));
  if (layout.length > 0) {
    return failure(
      doc,
      "Revisando el diseño",
      `No se aplicó ningún cambio porque unas columnas o tarjetas se verían mal en la hoja. Corrígelo y vuelve a llamar la herramienta:\n- ${layout.slice(0, 6).map(issue => issue.message).join("\n- ")}`,
    );
  }

  const ids = applied.ids.length > 0 ? ` Ids: ${applied.ids.join(", ")}.` : "";
  // Cuartiles, recta de tendencia…: el modelo los recibe ya calculados, para que la clave coincida con la figura
  const facts = flattenBlocks(written).map(describeComputed).filter(Boolean);
  const computed = facts.length > 0 ? ` Valores calculados por el sistema, tal como salen en la figura: ${facts.join(" ")}` : "";
  return {
    doc: applied.doc,
    isError: false,
    result: `${applied.summary}.${applied.changed ? ids : " El documento quedó igual."}${computed}`,
    activity: {
      label: applied.summary,
      ok: true,
      changed: applied.changed,
      ...(applied.changed ? locateActivity(doc, applied.doc, op, applied.ids) : {}),
      ...(op.op === "delete_blocks" ? namedRemoved(doc, op.blockIds) : {}),
    },
  };
}

/**
 * Bloques ya terminados de una sección que la IA aún está escribiendo. El último elemento
 * del arreglo parcial puede estar a medias, así que se descarta.
 */
export function previewBlocks(snapshot: unknown): { sectionId: string | null; title: string; role: (typeof SECTION_ROLES)[number]; blocks: BlockInput[] } | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const partial = snapshot as { section_id?: unknown; title?: unknown; role?: unknown; blocks?: unknown };
  if (typeof partial.title !== "string" || !Array.isArray(partial.blocks)) return null;
  const complete = partial.blocks.slice(0, -1);
  const blocks: BlockInput[] = [];
  for (const candidate of complete) {
    const parsed = blockInputSchema.safeParse(candidate);
    if (parsed.success) blocks.push(parsed.data);
  }
  return {
    sectionId: typeof partial.section_id === "string" ? partial.section_id : null,
    title: partial.title,
    role: partial.role === "answer_key" ? "answer_key" : "student",
    blocks,
  };
}

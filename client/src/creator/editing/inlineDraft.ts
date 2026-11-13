/**
 * Lógica de la edición en sitio, sin nada de React: qué bloques se editan sobre la hoja,
 * cuándo lo escrito cuenta como un cambio y con qué aviso se rechaza lo que no valida.
 */
import type { z } from "zod";
import { blockInputSchema, type Block, type BlockInput, type BlockOf, type BlockType } from "@shared/creator";
import { normalizeBlock } from "@shared/creatorOps";
import { validateBlock } from "@shared/creatorValidate";
import { collapseSpaces, inPlaceBlocks, parseMd, serializeMd, serializeSingleLine } from "./mdModel";

/** Bloques de texto: se editan sobre la hoja, sin formulario. Los demás conservan el suyo. */
export const INLINE_BLOCK_TYPES = ["paragraph", "heading", "callout", "exercise", "solution"] as const;
export type InlineBlockType = (typeof INLINE_BLOCK_TYPES)[number];
export type InlineBlock = BlockOf<InlineBlockType>;
export type InlineDraft = Extract<BlockInput, { type: InlineBlockType }>;

export const isInlineType = (type: BlockType): type is InlineBlockType => (INLINE_BLOCK_TYPES as readonly BlockType[]).includes(type);
export const isInlineBlock = (block: Block): block is InlineBlock => isInlineType(block.type);

/** El contenido de un bloque, sin su id. */
export function toDraft<T extends Block>(block: T): Extract<BlockInput, { type: T["type"] }> {
  const { id: _id, ...content } = block;
  return content as Extract<BlockInput, { type: T["type"] }>;
}

/** Texto con párrafos y listas, tal como lo devuelve el editor en sitio. */
export const richMd = (md: string) => serializeMd(inPlaceBlocks(parseMd(md)));
/** Texto de un renglón (títulos, incisos), tal como lo devuelve el editor en sitio. */
export const lineMd = (md: string) => serializeSingleLine(collapseSpaces(parseMd(md)));

/**
 * El bloque como lo escribiría el editor sin que el docente tocara nada. El editor reescribe
 * el Markdown a su manera (`_x_` pasa a `*x*`, las viñetas a `-`): comparar esta forma evita
 * guardar un cambio que nadie hizo.
 */
export function canonicalDraft(draft: BlockInput): BlockInput {
  switch (draft.type) {
    case "paragraph":
      return { ...draft, md: richMd(draft.md) };
    case "heading":
      return { ...draft, text: lineMd(draft.text) };
    case "callout":
      return { ...draft, title: draft.title?.trim() || undefined, md: richMd(draft.md) };
    case "exercise":
      return { ...draft, label: draft.label.trim(), md: richMd(draft.md), parts: draft.parts.map(part => ({ label: part.label.trim(), md: lineMd(part.md) })) };
    case "solution":
      return { ...draft, label: draft.label.trim(), steps: draft.steps.map(richMd), answer: (draft.answer && richMd(draft.answer)) || undefined };
    default:
      return draft;
  }
}

/** JSON con las claves ordenadas: dos objetos con el mismo contenido dan el mismo texto. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );

export const sameContent = (a: BlockInput, b: BlockInput) => stable(canonicalDraft(a)) === stable(canonicalDraft(b));

function fieldName(path: PropertyKey[], draft: BlockInput): string {
  const [head, index, leaf] = path;
  switch (head) {
    case "md":
      return draft.type === "exercise" ? "El enunciado" : "El texto";
    case "text":
      return "El título";
    case "title":
      return "El título del recuadro";
    case "label":
      return "El rótulo";
    case "answer":
      return "La respuesta final";
    case "lines":
      return "El alto del espacio de respuesta";
    case "parts": {
      if (typeof index !== "number") return "La lista de incisos";
      const letter = draft.type === "exercise" ? draft.parts[index]?.label.trim() : "";
      return leaf === "label" ? `La letra del inciso ${index + 1}` : `El inciso ${letter || index + 1}`;
    }
    case "steps":
      return typeof index === "number" ? `El paso ${index + 1}` : "La lista de pasos";
    default:
      return "Un dato del bloque";
  }
}

/** Avisos del esquema redactados para el docente, no para quien programa. */
export function describeSchemaIssues(error: z.ZodError, draft: BlockInput): string[] {
  const messages = error.issues.map(issue => {
    const name = fieldName(issue.path, draft);
    if (issue.code === "too_small") {
      return issue.origin === "string" ? `${name} no puede quedar vacío.` : `${name} no llega al mínimo (${String(issue.minimum)}).`;
    }
    if (issue.code === "too_big") {
      return issue.origin === "string" ? `${name} es demasiado largo (máximo ${String(issue.maximum)} caracteres).` : `${name} pasa del máximo (${String(issue.maximum)}).`;
    }
    return `${name} no es válido.`;
  });
  return Array.from(new Set(messages)).slice(0, 6);
}

/** Un título o una respuesta final que quedaron en blanco se quitan: en la hoja no se dibujan. */
export function tidyDraft(draft: BlockInput): BlockInput {
  if (draft.type === "callout") return { ...draft, title: draft.title?.trim() || undefined };
  if (draft.type === "solution") return { ...draft, answer: draft.answer?.trim() || undefined };
  return draft;
}

/**
 * Los avisos de validación nombran el bloque por su tipo interno ("paragraph: …"), que le sirve a la IA.
 * Bajo el bloque que el docente está editando ese prefijo sobra.
 */
function withoutTypePrefix(problem: string, type: BlockType): string {
  if (!problem.startsWith(`${type}: `)) return problem;
  const rest = problem.slice(type.length + 2);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export type DraftOutcome =
  | { status: "unchanged" }
  | { status: "invalid"; issues: string[] }
  | { status: "ok"; block: BlockInput };

/**
 * Qué hacer con lo escrito al salir del bloque: nada si no cambió, guardarlo si pasa las
 * mismas validaciones que sigue la IA, o devolver los avisos para que el editor siga abierto.
 */
export function resolveDraft(original: Block, written: BlockInput): DraftOutcome {
  if (sameContent(written, toDraft(original))) return { status: "unchanged" };
  const draft = tidyDraft(written);
  const parsed = blockInputSchema.safeParse(draft);
  if (!parsed.success) return { status: "invalid", issues: describeSchemaIssues(parsed.error, draft) };
  const block = normalizeBlock(parsed.data);
  const problems = validateBlock(block);
  if (problems.length > 0) return { status: "invalid", issues: problems.slice(0, 6).map(problem => withoutTypePrefix(problem, block.type)) };
  return { status: "ok", block };
}

/** Un bloque armado por un atajo, ya normalizado, o `null` si no pasaría las validaciones. */
export function checkedInput(input: BlockInput): BlockInput | null {
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return null;
  const block = normalizeBlock(parsed.data);
  return validateBlock(block).length === 0 ? block : null;
}

/** Letra del inciso que sigue: a, b, c… */
export const nextPartLabel = (count: number) => String.fromCharCode(97 + Math.min(count, 25));

type Part = { label: string; md: string };

/** Los incisos van rotulados a, b, c… en orden: al añadir o quitar uno, las letras se pueden recorrer. */
const inSequence = (parts: Part[]) => parts.every((part, index) => part.label.trim() === nextPartLabel(index));
const relabel = (parts: Part[]) => parts.map((part, index) => ({ ...part, label: nextPartLabel(index) }));

/** Añade un inciso vacío después de `index`. Si las letras iban en orden, siguen en orden. */
export function insertPart(parts: Part[], index: number): Part[] {
  const next = [...parts.slice(0, index + 1), { label: nextPartLabel(parts.length), md: "" }, ...parts.slice(index + 1)];
  return inSequence(parts) ? relabel(next) : next;
}

/** Quita el inciso `index`. Si las letras iban en orden, se recorren para no dejar un hueco. */
export function removePart(parts: Part[], index: number): Part[] {
  const next = parts.filter((_, i) => i !== index);
  return inSequence(parts) ? relabel(next) : next;
}

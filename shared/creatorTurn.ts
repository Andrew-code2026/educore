import {
  BLOCK_TYPE_LABELS,
  blockPreview,
  findBlock,
  type Block,
  type CreatorActivity,
  type CreatorAttachment,
  type CreatorChatMessage,
  type CreatorTurn,
  type ResourceDoc,
} from "./creator";

/**
 * El turno de la IA visto desde el chat: qué bloques señaló el docente, qué cambió el turno,
 * cómo se deshace y qué propone después. Todo es lógica pura, compartida por servidor y cliente.
 */

/** Bloques que se pueden señalar en un mismo mensaje. */
export const ATTACH_MAX = 8;
export const SUGGESTIONS_MAX = 3;
/** Una sugerencia es un botón: más larga que esto ya no se lee de un vistazo. */
export const SUGGESTION_CHARS_MAX = 90;
const PREVIEW_CHARS = 90;
/** Ids que guarda cada ficha o cada lista del turno: acota lo que ocupa un mensaje en la base de datos. */
const IDS_MAX = 200;

/* ───────────────────────── Comparar documentos ───────────────────────── */

/** Igualdad de datos JSON: no importa el orden de las claves ni las que valen `undefined`. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameJson(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => left[key] !== undefined);
  if (keys.length !== Object.keys(right).filter(key => right[key] !== undefined).length) return false;
  return keys.every(key => sameJson(left[key], right[key]));
}

export type TurnChanges = Omit<CreatorTurn, "baseVersion">;

/**
 * Qué cambió entre el documento de antes de un turno y el de después. Los bloques se siguen por su id:
 * una sección reescrita entera estrena ids, así que cuenta como bloques eliminados y bloques añadidos.
 * Cambiar un bloque de sitio sin tocarlo no cuenta.
 */
export function diffTurn(before: ResourceDoc, after: ResourceDoc): TurnChanges {
  const previous = new Map<string, Block>();
  for (const section of before.sections) for (const block of section.blocks) previous.set(block.id, block);

  const added: string[] = [];
  const changed: string[] = [];
  let kept = 0;
  for (const section of after.sections) {
    for (const block of section.blocks) {
      const old = previous.get(block.id);
      if (!old) added.push(block.id);
      else {
        kept++;
        if (!sameJson(old, block)) changed.push(block.id);
      }
    }
  }

  const headers = after.sections.some(section => {
    const old = before.sections.find(candidate => candidate.id === section.id);
    return old !== undefined && (old.title !== section.title || old.role !== section.role);
  });
  const meta = before.title !== after.title || (before.subtitle ?? "") !== (after.subtitle ?? "") || headers;
  return { added, changed, removed: previous.size - kept, meta };
}

export const hasTurnChanges = (changes: TurnChanges) => changes.added.length > 0 || changes.changed.length > 0 || changes.removed > 0 || changes.meta;

/** El resumen que va encima de la hoja: «La IA añadió 2 bloques, cambió 1 y eliminó 1». */
export function describeTurn(changes: TurnChanges): string {
  const counts: Array<[string, number]> = [
    ["añadió", changes.added.length],
    ["cambió", changes.changed.length],
    ["eliminó", changes.removed],
  ];
  const parts = counts.filter(([, count]) => count > 0).map(([verb, count], index) => (index === 0 ? `${verb} ${count} ${count === 1 ? "bloque" : "bloques"}` : `${verb} ${count}`));
  if (changes.meta) parts.push(parts.length === 0 ? "cambió los títulos" : "retocó los títulos");
  if (parts.length === 0) return "La IA no cambió el recurso";
  const last = parts.pop()!;
  return `La IA ${parts.length > 0 ? `${parts.join(", ")} y ${last}` : last}`;
}

/**
 * El documento `next`, pero con los mismos objetos de `prev` en todo lo que no cambió. Lo que llega
 * del servidor es una copia nueva; así el editor reconoce por identidad qué bloques son los de antes
 * (el historial de deshacer y las marcas de la IA se apoyan en eso) y no vuelve a dibujar el resto.
 */
export function reuseUnchanged(prev: ResourceDoc, next: ResourceDoc): ResourceDoc {
  if (prev === next) return prev;
  const known = new Map<string, Block>();
  for (const section of prev.sections) for (const block of section.blocks) known.set(block.id, block);

  const sections = next.sections.map(section => {
    const old = prev.sections.find(candidate => candidate.id === section.id);
    const blocks = section.blocks.map(block => {
      const same = known.get(block.id);
      return same && sameJson(same, block) ? same : block;
    });
    const untouched = old !== undefined && old.blocks.length === blocks.length && blocks.every((block, index) => block === old.blocks[index]);
    return untouched && old.title === section.title && old.role === section.role ? old : { ...section, blocks };
  });

  const untouched = sections.length === prev.sections.length && sections.every((section, index) => section === prev.sections[index]);
  return untouched && prev.title === next.title && (prev.subtitle ?? "") === (next.subtitle ?? "") ? prev : { ...next, sections };
}

/* ───────────────────────── Bloques señalados ───────────────────────── */

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function describeAttachment(block: Block): CreatorAttachment {
  return { id: block.id, type: block.type, preview: clip(blockPreview(block).replace(/\s+/g, " ").trim(), PREVIEW_CHARS) };
}

export type AttachmentCheck = { ok: true; attachments: CreatorAttachment[] } | { ok: false; missing: string[] };

/** Los bloques que el docente señaló, comprobando que siguen en el documento. Los repetidos cuentan una vez. */
export function resolveAttachments(doc: ResourceDoc, blockIds: readonly string[]): AttachmentCheck {
  const ids = Array.from(new Set(blockIds));
  const missing = ids.filter(id => !findBlock(doc, id));
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, attachments: ids.slice(0, ATTACH_MAX).map(id => describeAttachment(findBlock(doc, id)!.block)) };
}

/** Lo que lee el modelo sobre los bloques señalados: una línea por bloque, con su id y dónde está. */
export function describeFocus(doc: ResourceDoc, blockIds: readonly string[]): string {
  return blockIds
    .map(id => findBlock(doc, id))
    .filter(found => found !== null)
    .map(found => `- ${found.block.id} (${BLOCK_TYPE_LABELS[found.block.type]}, en «${found.section.title}»): ${describeAttachment(found.block).preview}`)
    .join("\n");
}

/* ───────────────────────── Sugerencias de seguimiento ───────────────────────── */

const OPEN = "<sugerencias>";
const CLOSE = "</sugerencias>";

/**
 * Mientras llega la respuesta: la parte que ya se puede mostrar. El bloque de sugerencias no se
 * muestra nunca, y un final que podría ser el comienzo de su etiqueta se retiene hasta saberlo.
 */
export function visibleReply(text: string, complete = false): string {
  const lower = text.toLowerCase();
  const start = lower.indexOf(OPEN);
  if (start !== -1) return text.slice(0, start);
  // Con la respuesta ya completa no queda nada por saber: lo retenido era texto
  if (complete) return text;
  for (let length = Math.min(OPEN.length - 1, text.length); length > 0; length--) {
    if (lower.endsWith(OPEN.slice(0, length))) return text.slice(0, text.length - length);
  }
  return text;
}

/** Limpia lo que propuso el modelo: sin viñetas ni comillas, sin repetidas y solo las que caben en un botón. */
export function sanitizeSuggestions(raw: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    // Es el texto de un botón, no Markdown: fuera el escape de los pesos y las negritas
    const text = item
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      .replace(/\\\$/g, "$")
      .replace(/\*\*/g, "")
      .replace(/^["«“]+|["»”]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 4 || text.length > SUGGESTION_CHARS_MAX || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    clean.push(text);
    if (clean.length === SUGGESTIONS_MAX) break;
  }
  return clean;
}

/** Separa el mensaje para el docente del bloque `<sugerencias>` con que el modelo lo cierra. */
export function splitSuggestions(text: string): { text: string; suggestions: string[] } {
  const lower = text.toLowerCase();
  const start = lower.indexOf(OPEN);
  if (start === -1) return { text: text.trim(), suggestions: [] };
  const end = lower.indexOf(CLOSE, start);
  const inner = text.slice(start + OPEN.length, end === -1 ? undefined : end);
  const rest = end === -1 ? "" : text.slice(end + CLOSE.length);
  return { text: `${text.slice(0, start).trimEnd()}${rest.trim() ? `\n\n${rest.trim()}` : ""}`.trim(), suggestions: sanitizeSuggestions(inner.split("\n")) };
}

/* ───────────────────────── Deshacer un turno ───────────────────────── */

export type TurnUndoDecision = "restore" | "already" | "confirm";

/**
 * Qué hacer cuando el docente pide deshacer un turno. Si el documento ya está como antes del turno
 * no hay nada que hacer; si cambió después del turno, deshacerlo se lleva también esos cambios y
 * hay que preguntarlo antes (`force` es la respuesta).
 */
export function decideTurnUndo(input: { current: ResourceDoc; before: ResourceDoc; after: ResourceDoc | null; force?: boolean }): TurnUndoDecision {
  if (sameJson(input.current, input.before)) return "already";
  if (input.force || (input.after !== null && sameJson(input.current, input.after))) return "restore";
  return "confirm";
}

/* ───────────────────────── Lo que se guarda con cada mensaje ───────────────────────── */

export type MessageExtras = Pick<CreatorChatMessage, "activity" | "attachments" | "turn" | "suggestions">;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const idList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 24).slice(0, IDS_MAX) : []);

function readActivity(value: unknown): CreatorActivity[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap(item => {
    if (typeof item.label !== "string") return [];
    const blockIds = idList(item.blockIds);
    return [
      {
        label: item.label,
        ok: item.ok !== false,
        changed: item.changed === true,
        ...(blockIds.length > 0 ? { blockIds } : {}),
        ...(typeof item.sectionId === "string" ? { sectionId: item.sectionId } : {}),
      },
    ];
  });
}

/**
 * Texto que se guarda en `creator_messages.activity`. Si el mensaje solo lleva fichas se guarda la
 * lista, como siempre; si lleva algo más (bloques señalados, cambios del turno, sugerencias), un objeto.
 */
export function serializeMessageExtras(extras: Partial<MessageExtras>): string | null {
  const activity = (extras.activity ?? []).slice(0, 40).map(item => (item.blockIds ? { ...item, blockIds: item.blockIds.slice(0, IDS_MAX) } : item));
  const attachments = extras.attachments?.length ? extras.attachments.slice(0, ATTACH_MAX) : undefined;
  const suggestions = extras.suggestions?.length ? extras.suggestions.slice(0, SUGGESTIONS_MAX) : undefined;
  const turn = extras.turn ? { ...extras.turn, added: extras.turn.added.slice(0, IDS_MAX), changed: extras.turn.changed.slice(0, IDS_MAX) } : undefined;
  if (!attachments && !suggestions && !turn) return activity.length > 0 ? JSON.stringify(activity) : null;
  return JSON.stringify({ activity, attachments, turn, suggestions });
}

/** Lee lo guardado con un mensaje. Nunca falla: lo que no reconoce se descarta. */
export function parseMessageExtras(raw: string | null | undefined): MessageExtras {
  if (!raw) return { activity: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { activity: [] };
  }
  if (Array.isArray(value)) return { activity: readActivity(value) };
  if (!isRecord(value)) return { activity: [] };

  const extras: MessageExtras = { activity: readActivity(value.activity) };
  if (Array.isArray(value.attachments)) {
    const attachments = value.attachments
      .filter(isRecord)
      .filter(item => typeof item.id === "string" && typeof item.preview === "string" && typeof item.type === "string" && item.type in BLOCK_TYPE_LABELS)
      .map(item => ({ id: item.id, type: item.type, preview: item.preview }) as CreatorAttachment);
    if (attachments.length > 0) extras.attachments = attachments;
  }
  if (isRecord(value.turn) && typeof value.turn.baseVersion === "number") {
    const removed = typeof value.turn.removed === "number" && value.turn.removed > 0 ? Math.floor(value.turn.removed) : 0;
    extras.turn = { baseVersion: value.turn.baseVersion, added: idList(value.turn.added), changed: idList(value.turn.changed), removed, meta: value.turn.meta === true };
  }
  if (Array.isArray(value.suggestions)) {
    const suggestions = sanitizeSuggestions(value.suggestions);
    if (suggestions.length > 0) extras.suggestions = suggestions;
  }
  return extras;
}

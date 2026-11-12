import type { ChangeLocation } from "./docHistory";

/**
 * Llevar la hoja del editor hasta un bloque: tras deshacer o rehacer, desde una ficha del chat
 * o desde el resumen del turno de la IA.
 */

/** A dónde ir: unos bloques o, si ya no hay ninguno, su sección. */
export interface RevealTarget {
  blockIds?: string[];
  sectionId?: string;
}

/** Cuánto dura el destello de un bloque al que se llegó desde el chat o desde el resumen del turno. */
const FLASH_MS = 1800;
const flashTimers = new WeakMap<HTMLElement, number>();

const stageElement = () => document.querySelector<HTMLElement>(".crt-stage");
const blockElement = (stage: ParentNode, blockId: string) => stage.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
const sectionElement = (sectionId: string) => document.getElementById(`crt-${sectionId}`);

function flash(element: HTMLElement) {
  // Un destello nuevo sobre el mismo bloque empieza de cero: el temporizador del anterior no lo corta
  window.clearTimeout(flashTimers.get(element));
  element.removeAttribute("data-flash");
  // Leer el ancho reinicia la animación si el bloque ya estaba destellando
  void element.offsetWidth;
  element.setAttribute("data-flash", "");
  flashTimers.set(
    element,
    window.setTimeout(() => element.removeAttribute("data-flash"), FLASH_MS),
  );
}

/** Tras deshacer o rehacer, lo que cambió se trae a la vista si quedó fuera de pantalla. */
export function revealChange(location: ChangeLocation | null) {
  if (!location) return;
  window.requestAnimationFrame(() => {
    const stage = stageElement();
    const block = stage && location.blockId ? blockElement(stage, location.blockId) : null;
    const target = block ?? (location.sectionId ? sectionElement(location.sectionId) : (stage?.querySelector<HTMLElement>(".crt-paper") ?? null));
    if (!target) return;
    const box = (stage ?? document.documentElement).getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (rect.bottom < box.top + 24 || rect.top > box.bottom - 24) target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/** Lleva la hoja hasta unos bloques (o su sección) y los destaca un momento. Devuelve `false` si ya no están. */
export function revealTarget(target: RevealTarget): boolean {
  const stage = stageElement();
  if (!stage) return false;
  const blocks = (target.blockIds ?? []).flatMap(id => blockElement(stage, id) ?? []);
  const section = blocks.length === 0 && target.sectionId ? sectionElement(target.sectionId) : null;
  const first = blocks[0] ?? section;
  if (!first) return false;
  // Un bloque más alto que la vista se alinea arriba; los demás, al centro
  const tall = first.getBoundingClientRect().height > stage.clientHeight * 0.7;
  first.scrollIntoView({ behavior: "smooth", block: section || tall ? "start" : "center" });
  for (const element of blocks.length > 0 ? blocks : [first]) flash(element);
  return true;
}

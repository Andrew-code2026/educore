import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { findBlock, INNER_BLOCK_TYPES, type ResourceDoc } from "@shared/creator";
import { autoScrollStep, dropTarget, gapLine, isSamePlace, targetCell, type CellLayout, type DropTarget, type SheetLayout } from "./structure";

/** Lo que hay que mover el puntero antes de que una pulsación en el asa cuente como arrastre y no como clic. */
const DRAG_THRESHOLD = 5;

const boxOf = (block: HTMLElement) => {
  const rect = block.getBoundingClientRect();
  return { id: block.dataset.blockId!, top: rect.top, bottom: rect.bottom };
};

/** Las columnas o tarjetas de un contenedor en pantalla, con sus bloques. */
function readCells(container: HTMLElement): CellLayout[] {
  return Array.from(container.querySelectorAll<HTMLElement>(":scope > .crt-frame > * > .crt-cell")).map((cell, index) => {
    const rect = cell.getBoundingClientRect();
    return {
      containerId: container.dataset.blockId!,
      cell: Number(cell.dataset.cell ?? index),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      blocks: Array.from(cell.querySelectorAll<HTMLElement>(":scope > .crt-block[data-block-id]")).map(boxOf),
    };
  });
}

/** Dónde está cada sección, cada bloque y cada celda de la hoja ahora mismo (se lee en cada paso: la hoja se desplaza). */
function readLayout(paper: HTMLElement): SheetLayout {
  const sections = Array.from(paper.querySelectorAll<HTMLElement>(".crt-doc:not(.crt-doc--preview) > .crt-doc__section"));
  return {
    sections: sections.map(section => {
      const box = section.getBoundingClientRect();
      const footer = section.querySelector<HTMLElement>(":scope > .crt-add");
      return {
        id: section.id.replace(/^crt-/, ""),
        top: box.top,
        end: footer ? footer.getBoundingClientRect().top : box.bottom,
        blocks: Array.from(section.querySelectorAll<HTMLElement>(":scope > .crt-block[data-block-id]")).map(block => {
          const cells = block.matches(".crt-block--columns, .crt-block--cards") ? readCells(block) : undefined;
          return { ...boxOf(block), ...(cells ? { cells } : {}) };
        }),
      };
    }),
  };
}

interface DragOptions {
  paper: RefObject<HTMLElement | null>;
  /** La línea que marca dónde caerá el bloque y la etiqueta que sigue al puntero: se mueven sin volver a dibujar la hoja. */
  line: RefObject<HTMLElement | null>;
  chip: RefObject<HTMLElement | null>;
  doc: () => ResourceDoc;
  onDrop: (blockId: string, target: DropTarget) => void;
  /** Por qué el bloque no puede caer ahí (no cabe en esa columna), o `null`. Se pregunta solo al cambiar de hueco. */
  blocked?: (blockId: string, target: DropTarget) => string | null;
}

/** ¿Puede este bloque ir dentro de una columna o una tarjeta? Si no (un contenedor, un salto de página), los contenedores cuentan enteros. */
const goesInside = (doc: ResourceDoc, blockId: string) => {
  const found = findBlock(doc, blockId);
  return found !== null && INNER_BLOCK_TYPES.has(found.block.type);
};

const targetKey = (target: DropTarget) => `${target.sectionId}/${target.containerId ?? ""}/${target.cell ?? ""}/${target.index}`;

/**
 * Arrastrar un bloque desde su asa, con eventos de puntero (ratón, lápiz y dedo por igual).
 * Mientras se arrastra solo se mueven la línea y la etiqueta; la hoja se dibuja dos veces: al empezar y al soltar.
 * Cerca del borde de la hoja esta se desplaza sola, y Escape cancela.
 */
export function useBlockDrag({ paper, line, chip, doc, onDrop, blocked }: DragOptions) {
  const [dragging, setDragging] = useState<string | null>(null);
  /** El bloque cuya asa está pulsada, se mueva o no. Lo suelta el propio arrastre: si el bloque cambió de
   *  sección, el asa ya no existe cuando llega el `pointerup` a React. */
  const [held, setHeld] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const handlers = useRef({ doc, onDrop, blocked });
  handlers.current = { doc, onDrop, blocked };

  const cancel = useCallback(() => stop.current?.(), []);
  useEffect(() => cancel, [cancel]);

  /** Pulsación en el asa: si el puntero se mueve es un arrastre; si no, al soltar se llama `onTap`. */
  const press = useCallback(
    (event: ReactPointerEvent<HTMLElement>, blockId: string, label: string, onTap: () => void) => {
      if (event.button !== 0 || stop.current) return;
      // Ni selección de texto ni el menú del asa al pulsar: el menú se abre al soltar sin haber arrastrado
      event.preventDefault();
      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;
      let pointerX = startX;
      let pointerY = startY;
      let target: DropTarget | null = null;
      let frame = 0;
      /** Un solo cálculo del hueco por cuadro, por muchos eventos de puntero o de desplazamiento que lleguen. */
      let placeFrame = 0;
      const into = goesInside(handlers.current.doc(), blockId);
      /** El último hueco revisado y si el bloque cabe ahí: solo se vuelve a preguntar al cambiar de hueco. */
      let checked: { key: string; reason: string | null } | null = null;
      setHeld(blockId);
      const stage = paper.current?.closest<HTMLElement>(".crt-stage") ?? null;
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Sin captura el arrastre sigue funcionando mientras el puntero no salga de la ventana
      }

      const place = () => {
        const sheet = paper.current;
        const marker = line.current;
        if (!sheet || !marker) return;
        const layout = readLayout(sheet);
        const next = dropTarget(layout, pointerY, pointerX, into);
        target = next && !isSamePlace(handlers.current.doc(), blockId, next) ? next : null;
        const y = target ? gapLine(layout, target) : null;
        const section = target ? document.getElementById(`crt-${target.sectionId}`) : null;
        if (y === null || !section || !target) {
          marker.hidden = true;
          if (chip.current) chip.current.dataset.reason = "";
          return;
        }
        // Dentro de una celda la línea mide lo que la celda; si el bloque no cabe ahí, se ve y se dice
        const key = targetKey(target);
        if (checked?.key !== key) checked = { key, reason: handlers.current.blocked?.(blockId, target) ?? null };
        const cell = targetCell(layout, target);
        const origin = sheet.getBoundingClientRect();
        const box = cell ?? section.getBoundingClientRect();
        marker.hidden = false;
        marker.toggleAttribute("data-blocked", checked.reason !== null);
        marker.toggleAttribute("data-cell", cell !== null);
        marker.style.transform = `translateY(${y - origin.top}px)`;
        marker.style.left = `${box.left - origin.left}px`;
        marker.style.width = `${box.right - box.left}px`;
        if (chip.current) chip.current.dataset.reason = checked.reason ? "No cabe aquí" : "";
      };

      const follow = () => {
        const label = chip.current;
        if (!label) return;
        label.hidden = false;
        label.style.transform = `translate(${pointerX + 14}px, ${pointerY + 12}px)`;
      };

      // Cerca del borde de la hoja, se desplaza sola; tras cada paso el hueco se vuelve a calcular
      const scroll = () => {
        frame = 0;
        if (!active || !stage) return;
        const box = stage.getBoundingClientRect();
        const step = autoScrollStep(pointerY, box.top, box.bottom);
        if (step === 0) return;
        // El evento de desplazamiento vuelve a calcular el hueco
        stage.scrollTop += step;
        frame = requestAnimationFrame(scroll);
      };

      const schedule = () => {
        if (placeFrame) return;
        placeFrame = requestAnimationFrame(() => {
          placeFrame = 0;
          place();
        });
      };

      const onScroll = () => {
        if (active) schedule();
      };

      const onMove = (move: PointerEvent) => {
        if (move.pointerId !== pointerId) return;
        pointerX = move.clientX;
        pointerY = move.clientY;
        if (!active) {
          if (Math.hypot(pointerX - startX, pointerY - startY) < DRAG_THRESHOLD) return;
          active = true;
          document.body.classList.add("crt-is-dragging");
          setDragging(blockId);
          if (chip.current) chip.current.textContent = label;
        }
        follow();
        schedule();
        if (!frame) frame = requestAnimationFrame(scroll);
      };

      const finish = (drop: boolean) => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        handle.removeEventListener("lostpointercapture", onCancel);
        stage?.removeEventListener("scroll", onScroll);
        window.removeEventListener("keydown", onKey, true);
        cancelAnimationFrame(frame);
        // Al soltar, el hueco se calcula con la última posición del puntero aunque su cuadro no haya llegado
        if (placeFrame) {
          cancelAnimationFrame(placeFrame);
          placeFrame = 0;
          if (drop && active) place();
        }
        stop.current = null;
        try {
          if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        } catch {
          // El asa ya no está en la hoja
        }
        if (line.current) line.current.hidden = true;
        if (chip.current) chip.current.hidden = true;
        document.body.classList.remove("crt-is-dragging");
        const wasActive = active;
        const where = target;
        active = false;
        setHeld(null);
        if (wasActive) setDragging(null);
        if (drop && wasActive && where) handlers.current.onDrop(blockId, where);
        return wasActive;
      };

      function onUp(up: PointerEvent) {
        if (up.pointerId !== pointerId) return;
        if (!finish(true)) onTap();
      }
      function onCancel() {
        finish(false);
      }
      function onKey(key: KeyboardEvent) {
        if (key.key !== "Escape" || !active) return;
        key.preventDefault();
        key.stopPropagation();
        finish(false);
      }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
      handle.addEventListener("lostpointercapture", onCancel);
      // La rueda del ratón también desplaza la hoja mientras se arrastra
      stage?.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("keydown", onKey, true);
      stop.current = () => void finish(false);
    },
    [chip, line, paper],
  );

  return { dragging, held, press, cancel };
}

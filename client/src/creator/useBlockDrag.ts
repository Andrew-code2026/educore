import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ResourceDoc } from "@shared/creator";
import { autoScrollStep, dropTarget, gapLine, isSamePlace, type DropTarget, type SheetLayout } from "./structure";

/** Lo que hay que mover el puntero antes de que una pulsación en el asa cuente como arrastre y no como clic. */
const DRAG_THRESHOLD = 5;

/** Dónde está cada sección y cada bloque de la hoja ahora mismo (se lee en cada paso: la hoja se desplaza). */
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
          const rect = block.getBoundingClientRect();
          return { id: block.dataset.blockId!, top: rect.top, bottom: rect.bottom };
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
}

/**
 * Arrastrar un bloque desde su asa, con eventos de puntero (ratón, lápiz y dedo por igual).
 * Mientras se arrastra solo se mueven la línea y la etiqueta; la hoja se dibuja dos veces: al empezar y al soltar.
 * Cerca del borde de la hoja esta se desplaza sola, y Escape cancela.
 */
export function useBlockDrag({ paper, line, chip, doc, onDrop }: DragOptions) {
  const [dragging, setDragging] = useState<string | null>(null);
  /** El bloque cuya asa está pulsada, se mueva o no. Lo suelta el propio arrastre: si el bloque cambió de
   *  sección, el asa ya no existe cuando llega el `pointerup` a React. */
  const [held, setHeld] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const handlers = useRef({ doc, onDrop });
  handlers.current = { doc, onDrop };

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
        const next = dropTarget(layout, pointerY);
        target = next && !isSamePlace(handlers.current.doc(), blockId, next) ? next : null;
        const y = target ? gapLine(layout, target) : null;
        const section = target ? document.getElementById(`crt-${target.sectionId}`) : null;
        if (y === null || !section) {
          marker.hidden = true;
          return;
        }
        const origin = sheet.getBoundingClientRect();
        const box = section.getBoundingClientRect();
        marker.hidden = false;
        marker.style.transform = `translateY(${y - origin.top}px)`;
        marker.style.left = `${box.left - origin.left}px`;
        marker.style.width = `${box.width}px`;
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
        const before = stage.scrollTop;
        stage.scrollTop += step;
        if (stage.scrollTop !== before) place();
        frame = requestAnimationFrame(scroll);
      };

      const onScroll = () => {
        if (active) place();
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
        place();
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

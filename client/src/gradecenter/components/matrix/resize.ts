import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Redimensionado por puntero, sin dependencias.
 * Devuelve el manejador que se engancha a un `pointerdown`. Las actualizaciones
 * se agrupan por frame para no repintar la matriz en cada evento del puntero.
 */
export function createResizeHandler(
  currentWidth: number,
  onResize: (width: number) => void,
  /** -1 cuando el borde de arrastre está a la izquierda (columna fija a la derecha). */
  direction: 1 | -1 = 1,
): (event: ReactPointerEvent<HTMLElement>) => void {
  return (event) => {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = currentWidth;
    let frame = 0;
    let latestX = startX;
    handle.dataset.active = "true";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: PointerEvent) => {
      latestX = moveEvent.clientX;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onResize(startWidth + direction * (latestX - startX));
      });
    };

    const onUp = () => {
      if (frame) cancelAnimationFrame(frame);
      if (latestX !== startX) onResize(startWidth + direction * (latestX - startX));
      handle.dataset.active = "false";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
}

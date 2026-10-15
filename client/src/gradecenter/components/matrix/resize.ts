import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Redimensionado por puntero, sin dependencias.
 * Devuelve el manejador que se engancha a un `pointerdown`.
 */
export function createResizeHandler(
  currentWidth: number,
  onResize: (width: number) => void,
): (event: ReactPointerEvent<HTMLElement>) => void {
  return (event) => {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = currentWidth;
    handle.dataset.active = "true";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: PointerEvent) => {
      onResize(startWidth + (moveEvent.clientX - startX));
    };

    const onUp = () => {
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
import React from "react";

/**
 * Plegado del riel sin re-layout de la página en cada fotograma.
 *
 * El marco anima `grid-template-columns`; sin más, el panel principal cambiaría de ancho en
 * cada frame y toda la página (Grade Center, tablas, gráficas con ResizeObserver) recalcularía
 * su layout ~20 veces. Mientras dura la transición, el contenido del panel se fija al ancho
 * FINAL: se reacomoda una sola vez y la caja del panel (que recorta) es lo único que cambia.
 * Mientras tanto el marco lleva `data-rail-animating="true"`.
 */

export interface FrozenWidthInput {
  /** Ancho interior del marco (sin su padding). */
  frameInnerWidth: number;
  /** Separación entre columnas del marco. */
  gap: number;
  /** Ancho de la columna del riel en el estado destino. */
  railTarget: number;
  /** Bordes + padding + barra de scroll del panel principal. */
  mainChromeX: number;
}

/** Ancho que tendrá el contenido del panel cuando termine la transición. */
export function computeFrozenContentWidth({ frameInnerWidth, gap, railTarget, mainChromeX }: FrozenWidthInput): number {
  return Math.max(0, Math.round(frameInnerWidth - gap - railTarget - mainChromeX));
}

const px = (value: string) => Number.parseFloat(value) || 0;

/** Lee una duración CSS ("280ms" | ".28s") en milisegundos. */
export function parseCssDuration(value: string, fallback = 300): number {
  const v = value.trim();
  if (!v) return fallback;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(v.endsWith("ms") ? n : n * 1000);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type SavedWidths = { width: string; minWidth: string; maxWidth: string };

export function useRailTransition(frameRef: React.RefObject<HTMLElement | null>, collapsed: boolean) {
  const first = React.useRef(true);
  // Valores inline originales de cada hijo congelado, para devolverlos intactos al terminar.
  const frozen = React.useRef(new Map<HTMLElement, SavedWidths>());

  const release = React.useCallback(() => {
    frozen.current.forEach((saved, el) => {
      el.style.width = saved.width;
      el.style.minWidth = saved.minWidth;
      el.style.maxWidth = saved.maxWidth;
    });
    frozen.current.clear();
    frameRef.current?.removeAttribute("data-rail-animating");
  }, [frameRef]);

  React.useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;

    const side = frame.querySelector<HTMLElement>(":scope > .edc-side");
    const main = frame.querySelector<HTMLElement>(":scope > .edc-main");
    if (!side || !main || frame.dataset.focus === "true" || prefersReducedMotion() || getComputedStyle(side).display === "none") {
      release();
      return;
    }

    const frameStyle = getComputedStyle(frame);
    const mainStyle = getComputedStyle(main);
    const width = computeFrozenContentWidth({
      frameInnerWidth: frame.clientWidth - px(frameStyle.paddingLeft) - px(frameStyle.paddingRight),
      gap: px(frameStyle.columnGap),
      railTarget: px(frameStyle.getPropertyValue(collapsed ? "--edc-rail-w-collapsed" : "--edc-rail-w")),
      mainChromeX: main.offsetWidth - main.clientWidth + px(mainStyle.paddingLeft) + px(mainStyle.paddingRight),
    });

    // Ancho inline en los hijos directos del panel, no una variable CSS en el marco: una custom
    // property heredable obligaría a recalcular el estilo de toda la página.
    const value = `${width}px`;
    for (const child of Array.from(main.children)) {
      if (!(child instanceof HTMLElement) || child.classList.contains("edc-main__glow")) continue;
      if (!frozen.current.has(child)) {
        frozen.current.set(child, { width: child.style.width, minWidth: child.style.minWidth, maxWidth: child.style.maxWidth });
      }
      child.style.width = value;
      child.style.minWidth = value;
      child.style.maxWidth = "none";
    }
    frame.setAttribute("data-rail-animating", "true");

    const onEnd = (event: TransitionEvent) => {
      if (event.target === frame && event.propertyName === "grid-template-columns") release();
    };
    frame.addEventListener("transitionend", onEnd);
    frame.addEventListener("transitioncancel", onEnd);
    // Respaldo por si el navegador no emite transitionend (pestaña en segundo plano, etc.).
    const timer = window.setTimeout(release, parseCssDuration(frameStyle.getPropertyValue("--edc-rail-dur")) + 80);

    return () => {
      // Si se vuelve a pulsar a mitad de camino, el siguiente efecto fija el nuevo destino.
      window.clearTimeout(timer);
      frame.removeEventListener("transitionend", onEnd);
      frame.removeEventListener("transitioncancel", onEnd);
    };
  }, [collapsed, frameRef, release]);
}

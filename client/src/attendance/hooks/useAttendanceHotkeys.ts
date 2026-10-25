/**
 * Atajos de teclado de la toma de asistencia: P · A · T · E · Enter · Supr ·
 * ↑ ↓ · Tab / ⇧Tab · Ctrl/Cmd+Z, con feedback inmediato en la planilla.
 *
 * Reglas de convivencia:
 * - Los atajos de edición solo actúan mientras el foco está dentro del roster.
 * - `/` (buscar) y `?` (ayuda) funcionan en todo el panel.
 * - En campos de texto no se intercepta nada (incluido Ctrl/Cmd+Z).
 * - Enter sobre un botón conserva su activación nativa (abrir el detalle, etc.).
 * - Con un popover, menú o diálogo abierto el hook no actúa.
 */
import { useEffect } from "react";
import type { AttendanceStatus } from "../types";

interface Options {
  /** Se desactiva mientras hay un popover o diálogo del panel abierto. */
  enabled: boolean;
  onStatus: (status: AttendanceStatus) => void;
  onUndo: () => void;
  onMove: (delta: number) => void;
  /**
   * Devuelve true cuando consumió el Tab (el foco sigue dentro de la planilla).
   * Devolver false deja que el navegador siga con el orden natural, de modo que
   * Tab / ⇧Tab también permiten salir de la planilla.
   */
  onTab?: (delta: number) => boolean;
  onOpenShortcuts: () => void;
  onFocusSearch: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox" ||
    target.getAttribute("role") === "combobox"
  );
}

/** Capas Radix abiertas (menús, popovers, diálogos) que tienen prioridad sobre los atajos. */
function hasOpenLayer(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper], [role=dialog], [role=menu]")) {
    return true;
  }
  return document.querySelector(
    '[data-radix-popper-content-wrapper] [data-state="open"], [role="dialog"][data-state="open"], [role="menu"][data-state="open"]',
  ) !== null;
}

function isRosterTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-attendance-roster]") !== null;
}

const LETTER_STATUS: Record<string, AttendanceStatus> = {
  p: "present",
  a: "absent",
  t: "late",
  e: "excuse",
};

export function useAttendanceHotkeys({
  enabled,
  onStatus,
  onUndo,
  onMove,
  onTab,
  onOpenShortcuts,
  onFocusSearch,
}: Options) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!enabled || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || hasOpenLayer(event.target)) return;

      const meta = event.ctrlKey || event.metaKey;

      if (!meta && !event.altKey && (event.key === "?" || (event.shiftKey && event.key === "/"))) {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }
      if (!meta && !event.altKey && !event.shiftKey && event.key === "/") {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (!isRosterTarget(event.target)) return;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
        return;
      }

      if (event.key === "Tab") {
        if (!onTab || meta || event.altKey) return;
        if (onTab(event.shiftKey ? -1 : 1)) event.preventDefault();
        return;
      }

      if (meta || event.altKey) return;

      const letter = LETTER_STATUS[event.key.toLowerCase()];
      if (letter && !event.shiftKey) {
        event.preventDefault();
        onStatus(letter);
        return;
      }

      switch (event.key) {
        case "Enter":
          if (event.target instanceof Element && event.target.closest("button")) return;
          event.preventDefault();
          onStatus("present");
          break;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          onStatus("pending");
          break;
        case "ArrowUp":
          event.preventDefault();
          onMove(-1);
          break;
        case "ArrowDown":
          event.preventDefault();
          onMove(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onFocusSearch, onMove, onOpenShortcuts, onStatus, onTab, onUndo]);
}

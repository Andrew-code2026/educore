/** Lo que comparten los atajos de teclado del editor: la ventana (deshacer) y cada bloque (moverlo). */

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Dentro de un campo, del bloque que se edita en su sitio, de un menú o de un diálogo, las teclas
 * son suyas: los atajos de la hoja (Ctrl+Z, Alt+Mayús+flechas) no actúan.
 */
export function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .crt-inplace, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null;
}

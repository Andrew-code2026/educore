import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { ArrowDown, ArrowUp, ArrowUpToLine, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import { CREATOR_LIMITS, type Section } from "@shared/creator";
import type { DocOp } from "@shared/creatorOps";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { oneLine, pastePlainLine, PLAINTEXT_ONLY } from "./editing/InlineText";

/**
 * Lo que una acción de menú hace con el foco (renombrar, abrir el buscador, ir al bloque movido) debe
 * esperar a que el menú se cierre: al cerrarse, el menú devuelve el foco a su botón y se lo quitaría.
 * `then` guarda ese paso y `onCloseAutoFocus` lo corre en lugar de devolver el foco; `later` sirve
 * de `onSelect` para una acción que es toda de foco.
 */
export function useMenuFollowUp() {
  const pending = useRef<(() => void) | null>(null);
  const then = useCallback((action: () => void) => {
    pending.current = action;
  }, []);
  const later = useCallback((action: () => void) => () => then(action), [then]);
  const onCloseAutoFocus = useCallback((event: Event) => {
    const action = pending.current;
    pending.current = null;
    if (!action) return;
    event.preventDefault();
    action();
  }, []);
  return useMemo(() => ({ then, later, onCloseAutoFocus }), [later, onCloseAutoFocus, then]);
}

export interface SectionTitleHandle {
  /** Lleva el foco al título con todo el texto seleccionado, para renombrarlo. */
  rename: () => void;
}

interface SectionTitleProps {
  section: Section;
  applyOp: (op: DocOp) => unknown;
}

/**
 * El título de una sección, renombrable en su sitio: es el mismo `h2` de la hoja con su texto
 * editable, así que no cambia de tamaño al entrar. Intro o salir lo guardan; Escape lo deja como estaba.
 * Mientras la IA trabaja la hoja dibuja el `h2` de siempre en su lugar.
 */
export const SectionTitle = forwardRef<SectionTitleHandle, SectionTitleProps>(function SectionTitle({ section, applyOp }, ref) {
  const text = useRef<HTMLSpanElement>(null);

  // El texto lo lleva el elemento: React no lo toca mientras el docente escribe. Desde fuera solo cambia sin el foco
  useLayoutEffect(() => {
    const element = text.current;
    if (element && document.activeElement !== element && element.textContent !== section.title) element.textContent = section.title;
  }, [section.title]);

  useImperativeHandle(ref, () => ({
    rename: () => {
      const element = text.current;
      if (!element) return;
      element.focus();
      getSelection()?.selectAllChildren(element);
    },
  }));

  const commit = () => {
    const element = text.current;
    if (!element) return;
    const title = oneLine(element.textContent ?? "").trim().slice(0, CREATOR_LIMITS.titleMax);
    // Un título vacío no vale: vuelve el que tenía
    if (!title || title === section.title) {
      element.textContent = section.title;
      return;
    }
    element.textContent = title;
    applyOp({ op: "update_section", sectionId: section.id, title });
  };

  return (
    <h2 className="crt-doc__section-title">
      <span
        ref={text}
        className="crt-section-title"
        contentEditable={PLAINTEXT_ONLY ? "plaintext-only" : true}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Título de la sección"
        title="Clic para cambiar el nombre de la sección"
        spellCheck={false}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.textContent = section.title;
            event.currentTarget.blur();
          }
        }}
        onPaste={pastePlainLine}
      />
    </h2>
  );
});

interface SectionMenuProps {
  section: Section;
  index: number;
  count: number;
  /** La primera sección no muestra su título en la hoja: no se ofrece renombrarla. */
  onRename?: () => void;
  onAddAtStart: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}

/** Las acciones de una sección, en el pie de la sección (siempre a la vista al editar, también en pantallas táctiles). */
export function SectionMenu({ section, index, count, onRename, onAddAtStart, onMove, onDelete }: SectionMenuProps) {
  const { later, onCloseAutoFocus } = useMenuFollowUp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="crt-add__more" title="Opciones de la sección" aria-label={`Opciones de la sección «${section.title}»`}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="crt-menu w-60 data-[state=closed]:animate-none" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuLabel className="truncate">Sección «{section.title}»</DropdownMenuLabel>
        {onRename && (
          <DropdownMenuItem onSelect={later(onRename)}>
            <PencilLine aria-hidden="true" />
            Renombrar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={later(onAddAtStart)}>
          <ArrowUpToLine aria-hidden="true" />
          Añadir un bloque al inicio
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onSelect={() => onMove("up")}>
          <ArrowUp aria-hidden="true" />
          Subir sección
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove("down")}>
          <ArrowDown aria-hidden="true" />
          Bajar sección
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={count <= 1} title={count <= 1 ? "El recurso necesita al menos una sección" : undefined} onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          Eliminar sección
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

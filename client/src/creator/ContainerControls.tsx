import { useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { CREATOR_LIMITS } from "@shared/creator";
import type { DocOp } from "@shared/creatorOps";
import { RichText } from "./blocks/RichText";
import { oneLine, pastePlainLine, PLAINTEXT_ONLY } from "./editing/InlineText";

/**
 * Controles propios de las columnas y las tarjetas en el editor: el título de cada tarjeta, que se
 * cambia en su sitio, y lo que muestra una celda vacía. Las acciones del contenedor entero (anchos,
 * añadir o quitar celdas, sacar los bloques) van en el menú de su barra, en EditableDocument.
 */

interface CardTitleProps {
  containerId: string;
  cell: number;
  title: string | undefined;
  readOnly: boolean;
  applyOp: (op: DocOp) => unknown;
}

/**
 * El título de una tarjeta. Se ve como en papel; al hacer clic se edita el mismo renglón como texto
 * (una fórmula se ve escrita mientras tanto). Intro o salir lo guardan, Escape lo deja como estaba y
 * vaciarlo lo quita. Una tarjeta sin título ofrece ponerle uno con un botón sobre su borde, que no
 * mueve nada de la hoja.
 */
export function CardTitle({ containerId, cell, title, readOnly, applyOp }: CardTitleProps) {
  const [editing, setEditing] = useState(false);
  const text = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = text.current;
    if (!editing || !element) return;
    element.textContent = title ?? "";
    element.focus();
    getSelection()?.selectAllChildren(element);
    // Solo al entrar: mientras se escribe, el texto lo lleva el elemento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (readOnly) {
    return title ? (
      <h4 className="crt-tile__title">
        <RichText md={title} inline />
      </h4>
    ) : null;
  }

  const commit = () => {
    const next = oneLine(text.current?.textContent ?? "").trim().slice(0, CREATOR_LIMITS.cardTitleMax);
    setEditing(false);
    if (next !== (title ?? "")) applyOp({ op: "update_cell", containerId, cell, title: next });
  };

  if (editing) {
    return (
      <h4 className="crt-tile__title">
        <span
          // Otra clave que la vista: el texto que se escribió vive fuera de React y no debe quedar al volver a ella
          key="input"
          ref={text}
          className="crt-tile__title-input"
          contentEditable={PLAINTEXT_ONLY ? "plaintext-only" : true}
          suppressContentEditableWarning
          role="textbox"
          aria-label={`Título de la tarjeta ${cell + 1}`}
          data-placeholder="Título de la tarjeta"
          spellCheck={false}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.textContent = title ?? "";
              event.currentTarget.blur();
            }
          }}
          onPaste={pastePlainLine}
        />
      </h4>
    );
  }

  if (!title) {
    return (
      <button type="button" className="crt-tile__add-title" onClick={() => setEditing(true)}>
        <Plus aria-hidden="true" />
        Título
      </button>
    );
  }

  return (
    <h4 className="crt-tile__title">
      <span
        key="view"
        className="crt-tile__title-view"
        role="button"
        tabIndex={0}
        title="Clic para cambiar el título de la tarjeta"
        aria-label={`Cambiar el título de la tarjeta ${cell + 1}`}
        onClick={() => setEditing(true)}
        onKeyDown={event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setEditing(true);
        }}
      >
        <RichText md={title} inline />
      </span>
    </h4>
  );
}

interface EmptyCellProps {
  /** «columna» o «tarjeta». */
  noun: string;
  onWrite: () => void;
  /** Sin esto la celda no se puede quitar (son dos columnas o es la única tarjeta). */
  onRemove?: () => void;
}

/** Una celda vacía en el editor: un recuadro punteado para empezar a escribir ahí, o quitarla. En papel queda en blanco. */
export function EmptyCell({ noun, onWrite, onRemove }: EmptyCellProps) {
  return (
    <div className="crt-cell__empty">
      <button type="button" className="crt-cell__write" onClick={onWrite}>
        <Plus aria-hidden="true" />
        Escribir aquí
      </button>
      {onRemove && (
        <button type="button" className="crt-cell__remove" title={`Quitar esta ${noun}`} aria-label={`Quitar esta ${noun}`} onClick={onRemove}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

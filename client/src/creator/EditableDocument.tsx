import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { BLOCK_TYPE_LABELS, CREATOR_LIMITS, type Block, type BlockInput, type BlockType, type CreatorEvent, type ResourceDoc, type Section } from "@shared/creator";
import type { DocOp, OpResult } from "@shared/creatorOps";
import { cn } from "@/lib/utils";
import { BlockView } from "./blocks/BlockView";
import { ADDABLE_BLOCKS, BLOCK_TEMPLATES, BlockEditor } from "./editing/BlockEditor";
import { InlineBlockEditor, type BlockEditorHandle, type CloseReason } from "./editing/InlineBlockEditor";
import { isInlineBlock, isInlineType } from "./editing/inlineDraft";
import type { EditEntry } from "./editing/InlineText";
import { ResourceSheet } from "./ResourceSheet";

type Preview = Extract<CreatorEvent, { type: "preview" }>;

interface EditableDocumentProps {
  doc: ResourceDoc;
  /** La IA está trabajando: el documento se ve pero no se edita. */
  readOnly: boolean;
  applyOp: (op: DocOp) => OpResult;
  schoolName?: string;
  logoUrl?: string | null;
  /** Sección que la IA está escribiendo ahora mismo. */
  preview: Preview | null;
  working: boolean;
}

export interface EditableDocumentHandle {
  /** Guarda el bloque que esté abierto, si es válido. Devuelve `false` si sigue abierto con datos por corregir. */
  settle: () => boolean;
}

/** El bloque abierto: los de texto se editan en su sitio y los demás con su formulario. */
interface Editing {
  id: string;
  inline: boolean;
  entry: EditEntry;
}

/** Espera antes de mostrar las acciones de un bloque: al desplazar la hoja o cruzarla con el puntero no aparece nada. */
const HOVER_IN_MS = 110;
/** Margen para llegar con el puntero del bloque a su barra sin que se esconda. */
const HOVER_OUT_MS = 160;

/** En pantallas táctiles no hay puntero que pase por encima: las acciones de cada bloque van siempre a la vista. */
function useNoHover() {
  const [noHover, setNoHover] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);
  useEffect(() => {
    const media = window.matchMedia("(hover: none)");
    const onChange = () => setNoHover(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return noHover;
}

interface ActiveBlock {
  hoverId: string | null;
  focusId: string | null;
  /** Lo último que usó el docente: manda sobre lo otro cuando puntero y foco apuntan a bloques distintos. */
  last: "hover" | "focus";
}

/**
 * El bloque activo es el que está bajo el puntero o el que tiene el foco del teclado.
 * Solo ese bloque monta su barra de acciones: una barra en toda la hoja en vez de una por bloque.
 */
function useActiveBlock() {
  const [state, setState] = useState<ActiveBlock>({ hoverId: null, focusId: null, last: "hover" });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState(current => ({ ...current, hoverId: id, last: "hover" })), HOVER_IN_MS);
  }, []);

  const leave = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState(current => (current.hoverId === id ? { ...current, hoverId: null } : current)), HOVER_OUT_MS);
  }, []);

  const focus = useCallback((id: string) => setState(current => (current.focusId === id && current.last === "focus" ? current : { ...current, focusId: id, last: "focus" })), []);
  const blur = useCallback((id: string) => setState(current => (current.focusId === id ? { ...current, focusId: null } : current)), []);

  const activeId = state.last === "focus" ? (state.focusId ?? state.hoverId) : (state.hoverId ?? state.focusId);
  return { activeId, enter, leave, focus, blur };
}

function BlockTypeMenu({ onPick, onClose }: { onPick: (type: BlockType) => void; onClose: () => void }) {
  return (
    <div className="crt-add__menu" role="menu" aria-label="Tipo de bloque" onKeyDown={event => event.key === "Escape" && onClose()}>
      {ADDABLE_BLOCKS.map((type, index) => (
        <button key={type} type="button" role="menuitem" autoFocus={index === 0} className="crt-add__option" onClick={() => onPick(type)}>
          {BLOCK_TYPE_LABELS[type]}
        </button>
      ))}
      <button type="button" className="crt-add__option crt-add__option--cancel" onClick={onClose}>
        Cancelar
      </button>
    </div>
  );
}

function TitleEditor({ doc, readOnly, applyOp }: Pick<EditableDocumentProps, "doc" | "readOnly" | "applyOp">) {
  const [title, setTitle] = useState(doc.title);
  const [subtitle, setSubtitle] = useState(doc.subtitle ?? "");

  // La IA o una restauración pueden cambiar el título desde fuera
  useEffect(() => setTitle(doc.title), [doc.title]);
  useEffect(() => setSubtitle(doc.subtitle ?? ""), [doc.subtitle]);

  const commit = () => {
    if (title.trim() === doc.title && subtitle.trim() === (doc.subtitle ?? "")) return;
    applyOp({ op: "set_meta", title: title.trim() || doc.title, subtitle: subtitle.trim() });
  };

  return (
    <>
      <input
        className="crt-doc__title crt-doc__title-input"
        aria-label="Título del recurso"
        value={title}
        placeholder="Título del recurso"
        maxLength={CREATOR_LIMITS.titleMax}
        readOnly={readOnly}
        onChange={event => setTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()}
      />
      <input
        className="crt-doc__subtitle crt-doc__subtitle-input"
        aria-label="Subtítulo del recurso"
        value={subtitle}
        placeholder="Subtítulo (asignatura, grado…)"
        maxLength={CREATOR_LIMITS.subtitleMax}
        readOnly={readOnly}
        onChange={event => setSubtitle(event.target.value)}
        onBlur={commit}
        onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()}
      />
    </>
  );
}

/** El recurso en pantalla: cada bloque se edita en su sitio, con las mismas reglas que sigue la IA. */
export const EditableDocument = forwardRef<EditableDocumentHandle, EditableDocumentProps>(function EditableDocument({ doc, readOnly, applyOp, schoolName, logoUrl, preview, working }, ref) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const editor = useRef<BlockEditorHandle | null>(null);
  const paper = useRef<HTMLDivElement>(null);
  /** Dónde está abierto el menú de añadir: después de un bloque o al final de una sección. */
  const [inserter, setInserter] = useState<{ sectionId: string; afterBlockId?: string } | null>(null);
  const { activeId, enter, leave, focus, blur } = useActiveBlock();
  const noHover = useNoHover();

  // Antes de que la IA empiece a trabajar, quien envía el mensaje pide guardar lo abierto (ver CreatorWorkspace)
  useImperativeHandle(ref, () => ({ settle: () => editor.current?.settle() ?? true }), []);

  useEffect(() => {
    if (readOnly) {
      setEditing(null);
      setInserter(null);
    }
  }, [readOnly]);

  /** Abre un bloque para editarlo. Un texto abierto con un dato por corregir no se cierra: se perdería lo escrito. */
  const open = (id: string, type: BlockType, entry: EditEntry) => {
    const current = editingRef.current;
    if (current && current.id !== id && current.inline && editor.current && !editor.current.settle()) {
      editor.current.focus();
      return;
    }
    setEditing({ id, inline: isInlineType(type), entry });
  };

  const close = (id: string, reason: CloseReason = "blur") => {
    setEditing(current => (current?.id === id ? null : current));
    // Cerrado desde el teclado, el foco vuelve al bloque para seguir con Tab
    if (reason === "keyboard") {
      requestAnimationFrame(() => paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"] .crt-block__view`)?.focus());
    }
  };

  const insert = (type: BlockType) => {
    if (!inserter) return;
    const result = applyOp({ op: "insert_blocks", sectionId: inserter.sectionId, afterBlockId: inserter.afterBlockId, blocks: [BLOCK_TEMPLATES[type]] });
    setInserter(null);
    // El bloque nuevo se abre de una vez para completarlo, con su texto de muestra seleccionado
    if (result.ok && type !== "page_break" && result.ids[0]) open(result.ids[0], type, "all");
  };

  const renderBlock = (block: Block, section: Section) => {
    const isEditing = editing?.id === block.id;
    const inline = isInlineBlock(block);
    const index = section.blocks.indexOf(block);
    const canEdit = !readOnly && block.type !== "page_break";
    const active = !readOnly && !isEditing && activeId === block.id;
    const showTools = !readOnly && (noHover || active);
    return (
      <div
        className={cn("crt-block", `crt-block--${block.type}`, isEditing && (inline ? "is-inplace" : "is-editing"), !readOnly && "is-editable", active && "is-active")}
        data-block-id={block.id}
        onPointerEnter={event => event.pointerType !== "touch" && enter(block.id)}
        onPointerLeave={() => leave(block.id)}
        onFocus={() => focus(block.id)}
        onBlur={event => !event.currentTarget.contains(event.relatedTarget) && blur(block.id)}
      >
        {isEditing && inline ? (
          <InlineBlockEditor
            ref={editor}
            block={block}
            entry={editing.entry}
            onCommit={(next: BlockInput) => void applyOp({ op: "update_block", blockId: block.id, block: next })}
            onClose={reason => close(block.id, reason)}
          />
        ) : isEditing ? (
          <BlockEditor
            ref={editor}
            block={block}
            onCancel={() => close(block.id)}
            onSave={(next: BlockInput) => {
              applyOp({ op: "update_block", blockId: block.id, block: next });
              close(block.id);
            }}
          />
        ) : (
          <>
            <div
              className="crt-block__view"
              {...(canEdit
                ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `Editar ${BLOCK_TYPE_LABELS[block.type].toLowerCase()}`,
                    // El cursor queda donde se hizo clic; con el teclado, al final del texto
                    onClick: (event: React.MouseEvent) => open(block.id, block.type, event.detail > 0 ? { x: event.clientX, y: event.clientY } : "end"),
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        open(block.id, block.type, "end");
                      }
                    },
                  }
                : {})}
            >
              <BlockView block={block} />
            </div>
            {showTools && (
              <div className="crt-block__tools" role="toolbar" aria-label={`Acciones de ${BLOCK_TYPE_LABELS[block.type].toLowerCase()}`}>
                {canEdit && (
                  <button type="button" title="Editar" aria-label="Editar" onClick={() => open(block.id, block.type, "end")}>
                    <Pencil aria-hidden="true" />
                  </button>
                )}
                <button type="button" title="Subir" aria-label="Subir" disabled={index === 0} onClick={() => applyOp({ op: "move_block", blockId: block.id, direction: "up" })}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button type="button" title="Bajar" aria-label="Bajar" disabled={index === section.blocks.length - 1} onClick={() => applyOp({ op: "move_block", blockId: block.id, direction: "down" })}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button type="button" title="Añadir debajo" aria-label="Añadir un bloque debajo" onClick={() => setInserter({ sectionId: section.id, afterBlockId: block.id })}>
                  <Plus aria-hidden="true" />
                </button>
                <button type="button" title="Eliminar" aria-label="Eliminar" className="is-danger" onClick={() => applyOp({ op: "delete_blocks", blockIds: [block.id] })}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
        {inserter?.afterBlockId === block.id && <BlockTypeMenu onPick={insert} onClose={() => setInserter(null)} />}
      </div>
    );
  };

  const renderSectionEnd = (section: Section) => {
    if (readOnly) return null;
    const open = inserter?.sectionId === section.id && !inserter.afterBlockId;
    return (
      <div className="crt-add">
        {open ? (
          <BlockTypeMenu onPick={insert} onClose={() => setInserter(null)} />
        ) : (
          <button type="button" className="crt-add__button" onClick={() => setInserter({ sectionId: section.id })}>
            <Plus aria-hidden="true" />
            Añadir bloque
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="crt-paper" ref={paper}>
      <ResourceSheet
        doc={doc}
        schoolName={schoolName}
        logoUrl={logoUrl}
        renderBlock={renderBlock}
        renderSectionEnd={renderSectionEnd}
        renderTitle={() => <TitleEditor doc={doc} readOnly={readOnly} applyOp={applyOp} />}
      />

      {preview && (
        <section className="crt-doc crt-doc--preview" aria-live="polite" aria-busy="true">
          <span className="crt-writing">
            <span className="crt-writing__dot" aria-hidden="true" />
            Escribiendo «{preview.title}»
          </span>
          {preview.blocks.map((block, index) => (
            <div key={index} className={`crt-block crt-block--${block.type}`}>
              <BlockView block={{ ...block, id: `preview-${index}` } as Block} />
            </div>
          ))}
        </section>
      )}

      {working && !preview && doc.sections.length === 0 && (
        <div className="crt-doc crt-doc--skeleton" aria-hidden="true">
          {[72, 100, 94, 60, 100, 88, 40].map((width, index) => (
            <span key={index} className="crt-skeleton" style={{ width: `${width}%` }} />
          ))}
        </div>
      )}
    </div>
  );
});

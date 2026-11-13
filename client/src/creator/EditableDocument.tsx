import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, BetweenHorizontalStart, Copy, GripVertical, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { BLOCK_TYPE_LABELS, CREATOR_LIMITS, type Block, type BlockInput, type BlockType, type CreatorEvent, type ResourceDoc, type Section } from "@shared/creator";
import type { DocOp, OpResult } from "@shared/creatorOps";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BlockPicker } from "./BlockPicker";
import { BlockView } from "./blocks/BlockView";
import { BLOCK_TEMPLATES, BlockEditor } from "./editing/BlockEditor";
import { InlineBlockEditor, type BlockEditorHandle, type CloseReason } from "./editing/InlineBlockEditor";
import { IS_MAC, isEditingTarget } from "./keyboard";
import { isInlineBlock, isInlineType } from "./editing/inlineDraft";
import type { EditEntry } from "./editing/InlineText";
import { revealTarget } from "./reveal";
import { ResourceSheet } from "./ResourceSheet";
import { SectionMenu, SectionTitle, useMenuFollowUp, type SectionTitleHandle } from "./SectionControls";
import { insertOp, moveShortcut, stepTarget, type DropTarget, type InsertPlace } from "./structure";
import type { MarkKind } from "./turnReview";
import { useBlockDrag } from "./useBlockDrag";

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
  /** Bloques señalados para el próximo mensaje al asistente. */
  attachedIds: ReadonlySet<string>;
  /** Señala un bloque para el chat o lo suelta. Sin esto la acción no se ofrece (la IA no está disponible). */
  onToggleAttach?: (blockId: string) => void;
  /** Bloques que la IA añadió o cambió en su último turno y que el docente aún no da por vistos. */
  marks: ReadonlyMap<string, MarkKind>;
  onAcceptMark: (blockId: string) => void;
}

const MARK_LABELS: Record<MarkKind, string> = { added: "Añadido por la IA", changed: "Cambiado por la IA" };

const MOVE_HINT = IS_MAC ? { up: "⌥⇧↑", down: "⌥⇧↓" } : { up: "Alt+Mayús+↑", down: "Alt+Mayús+↓" };

export interface EditableDocumentHandle {
  /** Guarda el bloque que esté abierto, si es válido. Devuelve `false` si sigue abierto con datos por corregir. */
  settle: () => boolean;
}

/** El bloque abierto: los de texto se editan en su sitio y los demás con su formulario. */
interface Editing {
  id: string;
  inline: boolean;
  entry: EditEntry;
  /** Cambia cada vez que se abre: un bloque reemplazado por otro del mismo tipo monta un editor nuevo. */
  seq: number;
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

/** En lugar de un texto vacío se ofrece cualquier otro bloque. */
const SLASH_EXCLUDE: readonly BlockType[] = ["paragraph"];

const PICKER_TITLES: Record<InsertPlace["kind"], string> = {
  after: "Insertar debajo",
  before: "Insertar encima",
  start: "Insertar al inicio de la sección",
  end: "Añadir al final de la sección",
};

/** El menú de bloques colgado de su sitio en la hoja: debajo (o encima) de donde se insertará. */
function PickerAnchor({ above = false, children }: { above?: boolean; children: ReactNode }) {
  return (
    <div className="crt-picker-anchor" data-side={above ? "above" : "below"}>
      {children}
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
export const EditableDocument = forwardRef<EditableDocumentHandle, EditableDocumentProps>(function EditableDocument(
  { doc, readOnly, applyOp, schoolName, logoUrl, preview, working, attachedIds, onToggleAttach, marks, onAcceptMark },
  ref,
) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const seq = useRef(0);
  const editor = useRef<BlockEditorHandle | null>(null);
  const paper = useRef<HTMLDivElement>(null);
  const dropLine = useRef<HTMLDivElement>(null);
  const dragChip = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  /** Dónde está abierto el menú de bloques para insertar. */
  const [picker, setPicker] = useState<InsertPlace | null>(null);
  /** El párrafo vacío en el que se escribió «/»: su menú reemplaza el bloque. */
  const [slashFor, setSlashFor] = useState<string | null>(null);
  /** El bloque cuyo menú «más» está abierto. */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** Lo que se le dice a un lector de pantalla tras mover un bloque o una sección. */
  const [announcement, setAnnouncement] = useState("");
  const titles = useRef(new Map<string, SectionTitleHandle>());
  const { activeId: hoverOrFocusId, enter, leave, focus, blur } = useActiveBlock();
  const noHover = useNoHover();
  const blockMenu = useMenuFollowUp();

  // Antes de que la IA empiece a trabajar, quien envía el mensaje pide guardar lo abierto (ver CreatorWorkspace)
  useImperativeHandle(ref, () => ({ settle: () => editor.current?.settle() ?? true }), []);

  /** Lleva el foco a un bloque (tras moverlo, duplicarlo o cerrar un menú). Espera a que la hoja se dibuje. */
  const focusBlock = useCallback((id: string, options?: { flash?: boolean }) => {
    requestAnimationFrame(() => {
      const view = paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"] .crt-block__view`);
      if (options?.flash) revealTarget({ blockIds: [id] });
      view?.focus({ preventScroll: options?.flash });
      // Un bloque sin vista enfocable (el salto de página) al menos se trae a la vista
      if (!view) paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  /** Mueve un bloque a un hueco. Un solo paso de deshacer, sea arrastre, menú o teclado. */
  const moveTo = useCallback(
    (blockId: string, target: DropTarget) => {
      const result = applyOp({ op: "move_block_to", blockId, ...target });
      if (!result.ok || !result.changed) return;
      const moved = result.doc.sections.find(section => section.id === target.sectionId);
      if (!moved) return;
      const position = moved.blocks.findIndex(block => block.id === blockId) + 1;
      setAnnouncement(`Bloque movido: lugar ${position} de ${moved.blocks.length} en «${moved.title}».`);
      focusBlock(blockId);
    },
    [applyOp, focusBlock],
  );

  const { dragging, held, press, cancel: cancelDrag } = useBlockDrag({ paper, line: dropLine, chip: dragChip, doc: () => docRef.current, onDrop: moveTo });

  // Mientras la IA trabaja nada de esto se puede usar
  useEffect(() => {
    if (!readOnly) return;
    setEditing(null);
    setPicker(null);
    setSlashFor(null);
    setMenuFor(null);
    cancelDrag();
  }, [cancelDrag, readOnly]);

  // Un menú abierto o el asa pulsada mantienen su bloque activo: su barra no desaparece debajo
  const activeId = dragging ?? held ?? menuFor ?? hoverOrFocusId;

  /** Abre un bloque para editarlo. Un texto abierto con un dato por corregir no se cierra: se perdería lo escrito. */
  const open = (id: string, type: BlockType, entry: EditEntry) => {
    const current = editingRef.current;
    if (current && current.id !== id && current.inline && editor.current && !editor.current.settle()) {
      editor.current.focus();
      return;
    }
    setEditing({ id, inline: isInlineType(type), entry, seq: ++seq.current });
  };

  const close = (id: string, reason: CloseReason = "blur") => {
    setEditing(current => (current?.id === id ? null : current));
    setSlashFor(current => (current === id ? null : current));
    // Cerrado desde el teclado, el foco vuelve al bloque para seguir con Tab
    if (reason === "keyboard") focusBlock(id);
  };

  const insert = (type: BlockType) => {
    if (!picker) return;
    const result = applyOp(insertOp(docRef.current, picker, [BLOCK_TEMPLATES[type]]));
    setPicker(null);
    // El bloque nuevo se abre de una vez para completarlo, con su texto de muestra seleccionado
    if (!result.ok || !result.ids[0]) return;
    if (type === "page_break") focusBlock(result.ids[0]);
    else open(result.ids[0], type, "all");
  };

  /** Cerrar el menú sin elegir con Escape devuelve el foco a lo que lo abrió. */
  const closePicker = (reason: "escape" | "blur") => {
    const place = picker;
    setPicker(null);
    if (reason !== "escape" || !place) return;
    if (place.kind === "after" || place.kind === "before") focusBlock(place.blockId);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>(`#crt-${CSS.escape(place.sectionId)} > .crt-add .crt-add__button`)?.focus());
  };

  const openPicker = (place: InsertPlace) => {
    setMenuFor(null);
    setPicker(place);
  };

  /** El bloque que se edita pasa a ser otro (un atajo al escribir o la «/»): un solo paso de deshacer. */
  const replace = (id: string, next: BlockInput, entry: EditEntry) => {
    setSlashFor(null);
    const result = applyOp({ op: "update_block", blockId: id, block: next });
    // Si no se pudo, el editor sigue abierto con lo escrito; si se pudo, lo escrito ya no se guarda encima
    if (!result.ok) return;
    editor.current?.release?.();
    if (next.type === "page_break") {
      setEditing(null);
      focusBlock(id);
    } else {
      setEditing({ id, inline: isInlineType(next.type), entry, seq: ++seq.current });
    }
  };

  /** Duplica un bloque y devuelve el id de la copia. */
  const duplicate = (id: string) => {
    const result = applyOp({ op: "duplicate_block", blockId: id });
    return result.ok ? result.ids[0] : undefined;
  };

  /** Borra un bloque (el aviso permite deshacerlo) y devuelve el vecino, para seguir con el teclado desde ahí. */
  const remove = (id: string) => {
    const section = docRef.current.sections.find(candidate => candidate.blocks.some(block => block.id === id));
    const index = section?.blocks.findIndex(block => block.id === id) ?? -1;
    const neighbour = section && (section.blocks[index + 1] ?? section.blocks[index - 1]);
    const result = applyOp({ op: "delete_blocks", blockIds: [id] });
    return result.ok ? neighbour?.id : undefined;
  };

  const step = (id: string, direction: "up" | "down") => {
    const target = stepTarget(docRef.current, id, direction);
    if (target) moveTo(id, target);
  };

  const addSection = () => {
    const result = applyOp({ op: "write_section", title: "Nueva sección", role: "student", blocks: [] });
    const id = result.ok ? result.ids[0] : undefined;
    if (!id) return;
    setAnnouncement("Sección nueva al final del recurso.");
    // Se abre con el nombre seleccionado para escribir el suyo
    requestAnimationFrame(() => {
      document.getElementById(`crt-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      titles.current.get(id)?.rename();
    });
  };

  /** Borra una sección (el aviso permite deshacerlo) y deja el foco en «Añadir bloque» de la que ocupa su lugar. */
  const removeSection = (section: Section) => {
    const sections = docRef.current.sections;
    const index = sections.indexOf(section);
    const neighbour = sections[index + 1] ?? sections[index - 1];
    const result = applyOp({ op: "delete_section", sectionId: section.id });
    if (!result.ok || !neighbour) return;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#crt-${CSS.escape(neighbour.id)} > .crt-add .crt-add__button`)?.focus());
  };

  const moveSection = (section: Section, direction: "up" | "down") => {
    const result = applyOp({ op: "move_section", sectionId: section.id, direction });
    if (!result.ok || !result.changed) return;
    const position = result.doc.sections.findIndex(candidate => candidate.id === section.id) + 1;
    setAnnouncement(`Sección «${section.title}» movida: ahora es la ${position} de ${result.doc.sections.length}.`);
  };

  const renderBlock = (block: Block, section: Section) => {
    const isEditing = editing?.id === block.id;
    const inline = isInlineBlock(block);
    const canEdit = !readOnly && block.type !== "page_break";
    const active = !readOnly && !isEditing && activeId === block.id;
    const showTools = !readOnly && (noHover || active);
    const mark = marks.get(block.id);
    const canAttach = !readOnly && onToggleAttach !== undefined && block.type !== "page_break";
    const attached = canAttach && attachedIds.has(block.id);
    const attachLabel = attached ? "Quitar del chat" : "Llevar al chat";
    const label = BLOCK_TYPE_LABELS[block.type];
    // Subir y Bajar pasan a la sección vecina: solo se detienen en los extremos del documento
    const index = section.blocks.indexOf(block);
    const sectionIndex = doc.sections.indexOf(section);
    const canUp = index > 0 || sectionIndex > 0;
    const canDown = index < section.blocks.length - 1 || sectionIndex < doc.sections.length - 1;
    const pickerHere = picker && (picker.kind === "after" || picker.kind === "before") && picker.blockId === block.id ? picker : null;
    const blockPicker = pickerHere && (
      <PickerAnchor above={pickerHere.kind === "before"}>
        <BlockPicker title={PICKER_TITLES[pickerHere.kind]} onPick={insert} onClose={closePicker} />
      </PickerAnchor>
    );

    return (
      <div
        className={cn(
          "crt-block",
          `crt-block--${block.type}`,
          isEditing && (inline ? "is-inplace" : "is-editing"),
          !readOnly && "is-editable",
          active && "is-active",
          attached && "is-attached",
          dragging === block.id && "is-dragging",
          pickerHere && "has-picker",
        )}
        data-block-id={block.id}
        onPointerEnter={event => event.pointerType !== "touch" && enter(block.id)}
        onPointerLeave={() => leave(block.id)}
        onFocus={() => focus(block.id)}
        onBlur={event => !event.currentTarget.contains(event.relatedTarget) && blur(block.id)}
        onKeyDown={event => {
          // Alt+Mayús+↑/↓ mueve el bloque que tiene el foco; dentro de un texto o un campo, las teclas son suyas
          const direction = moveShortcut(event);
          if (!direction || readOnly || isEditing || isEditingTarget(event.target)) return;
          event.preventDefault();
          step(block.id, direction);
        }}
      >
        {pickerHere?.kind === "before" && blockPicker}
        {mark && (
          <button type="button" className="crt-block__mark" data-kind={mark} title={`${MARK_LABELS[mark]}. Clic para darlo por visto.`} aria-label={`${MARK_LABELS[mark]}: darlo por visto`} onClick={() => onAcceptMark(block.id)} />
        )}
        {isEditing && inline ? (
          <InlineBlockEditor
            key={editing.seq}
            ref={editor}
            block={block}
            entry={editing.entry}
            onCommit={(next: BlockInput) => void applyOp({ op: "update_block", blockId: block.id, block: next })}
            onClose={reason => close(block.id, reason)}
            onSlash={() => setSlashFor(block.id)}
            onReplace={(next, entry) => replace(block.id, next, entry)}
            overlay={
              slashFor === block.id && (
                <PickerAnchor>
                  <BlockPicker
                    title="Cambiar este texto por…"
                    exclude={SLASH_EXCLUDE}
                    onPick={type => replace(block.id, BLOCK_TEMPLATES[type], "all")}
                    onClose={reason => {
                      setSlashFor(null);
                      // Con Escape se sigue escribiendo en el texto
                      if (reason === "escape") editor.current?.focus();
                    }}
                  />
                </PickerAnchor>
              )
            }
            barEnd={
              canAttach && (
                <button type="button" title={attached ? "Quitar este bloque del chat" : "Señalar este bloque en el chat para pedirle un cambio al asistente"} aria-pressed={attached} onClick={() => onToggleAttach(block.id)}>
                  <MessageSquarePlus aria-hidden="true" />
                  {attached ? "En el chat" : "Al chat"}
                </button>
              )
            }
          />
        ) : isEditing ? (
          <BlockEditor
            key={editing.seq}
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
                    "aria-label": `Editar ${label.toLowerCase()}`,
                    "aria-keyshortcuts": "Alt+Shift+ArrowUp Alt+Shift+ArrowDown",
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
              <div className="crt-block__tools" role="toolbar" aria-label={`Acciones de ${label.toLowerCase()}`}>
                <DropdownMenu open={menuFor === block.id} onOpenChange={open => setMenuFor(open ? block.id : null)}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="crt-block__grip"
                      title="Arrastra para mover · Clic para más acciones"
                      aria-label={`Mover ${label.toLowerCase()} o más acciones`}
                      onPointerDown={event => press(event, block.id, label, () => setMenuFor(block.id))}
                    >
                      <GripVertical aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="crt-menu w-64 data-[state=closed]:animate-none" onCloseAutoFocus={blockMenu.onCloseAutoFocus}>
                    {canEdit && (
                      <DropdownMenuItem onSelect={blockMenu.later(() => open(block.id, block.type, "end"))}>
                        <Pencil aria-hidden="true" />
                        Editar
                        <DropdownMenuShortcut className="crt-keys">Intro</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => {
                        const copy = duplicate(block.id);
                        if (copy) blockMenu.then(() => focusBlock(copy, { flash: true }));
                      }}
                    >
                      <Copy aria-hidden="true" />
                      Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={blockMenu.later(() => openPicker({ sectionId: section.id, kind: "before", blockId: block.id }))}>
                      <BetweenHorizontalStart aria-hidden="true" />
                      Insertar encima
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canUp}
                      onSelect={() => {
                        step(block.id, "up");
                        blockMenu.then(() => focusBlock(block.id));
                      }}
                    >
                      <ArrowUp aria-hidden="true" />
                      Subir
                      <DropdownMenuShortcut className="crt-keys">{MOVE_HINT.up}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canDown}
                      onSelect={() => {
                        step(block.id, "down");
                        blockMenu.then(() => focusBlock(block.id));
                      }}
                    >
                      <ArrowDown aria-hidden="true" />
                      Bajar
                      <DropdownMenuShortcut className="crt-keys">{MOVE_HINT.down}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        const next = remove(block.id);
                        if (next) blockMenu.then(() => focusBlock(next));
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" title="Añadir debajo" aria-label="Añadir un bloque debajo" aria-expanded={pickerHere?.kind === "after"} onClick={() => openPicker({ sectionId: section.id, kind: "after", blockId: block.id })}>
                  <Plus aria-hidden="true" />
                </button>
                {canAttach && (
                  <button type="button" title={attachLabel} aria-label={attachLabel} aria-pressed={attached} onClick={() => onToggleAttach(block.id)}>
                    <MessageSquarePlus aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {attached && !showTools && (
              <button type="button" className="crt-block__pin" title="Señalado en el chat. Clic para quitarlo." aria-label="Quitar del chat" onClick={() => onToggleAttach(block.id)}>
                <MessageSquarePlus aria-hidden="true" />
              </button>
            )}
          </>
        )}
        {pickerHere?.kind === "after" && blockPicker}
      </div>
    );
  };

  const renderSectionTitle = (section: Section, index: number) => (
    <>
      {/* La primera sección es la guía misma: su nombre ya lo dice el título del recurso */}
      {index > 0 &&
        (readOnly ? (
          <h2 className="crt-doc__section-title">{section.title}</h2>
        ) : (
          <SectionTitle
            ref={handle => {
              if (handle) titles.current.set(section.id, handle);
              else titles.current.delete(section.id);
            }}
            section={section}
            applyOp={applyOp}
          />
        ))}
      {picker?.kind === "start" && picker.sectionId === section.id && (
        <PickerAnchor>
          <BlockPicker title={PICKER_TITLES.start} onPick={insert} onClose={closePicker} />
        </PickerAnchor>
      )}
    </>
  );

  const renderSectionEnd = (section: Section) => {
    if (readOnly) return null;
    const index = doc.sections.indexOf(section);
    const count = doc.sections.length;
    const pickerAtEnd = picker?.kind === "end" && picker.sectionId === section.id;
    return (
      <div className="crt-add">
        <div className="crt-add__row">
          <button type="button" className="crt-add__button" aria-expanded={pickerAtEnd} onClick={() => openPicker({ sectionId: section.id, kind: "end" })}>
            <Plus aria-hidden="true" />
            Añadir bloque
          </button>
          <SectionMenu
            section={section}
            index={index}
            count={count}
            onRename={index > 0 ? () => titles.current.get(section.id)?.rename() : undefined}
            onAddAtStart={() => openPicker({ sectionId: section.id, kind: section.blocks.length > 0 ? "start" : "end" })}
            onMove={direction => moveSection(section, direction)}
            onDelete={() => removeSection(section)}
          />
        </div>
        {/* Fuera de la fila: el menú toma el ancho de la hoja, no el de un elemento de la fila */}
        {pickerAtEnd && (
          <PickerAnchor>
            <BlockPicker title={PICKER_TITLES.end} onPick={insert} onClose={closePicker} />
          </PickerAnchor>
        )}
        {index === count - 1 && count < CREATOR_LIMITS.sectionsMax && (
          <button type="button" className="crt-add__section" onClick={addSection}>
            <Plus aria-hidden="true" />
            Nueva sección
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
        renderSectionTitle={renderSectionTitle}
        renderSectionEnd={renderSectionEnd}
        renderTitle={() => <TitleEditor doc={doc} readOnly={readOnly} applyOp={applyOp} />}
      />

      {/* Mientras se arrastra: dónde caerá el bloque y qué se lleva. Se mueven sin volver a dibujar la hoja */}
      <div ref={dropLine} className="crt-drop-line" hidden aria-hidden="true" />
      {/* La etiqueta va en el cuerpo de la página: la hoja es un contenedor de consultas y no deja que `fixed` siga al puntero */}
      {createPortal(<div ref={dragChip} className="crt-drag-chip" hidden aria-hidden="true" />, document.body)}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

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

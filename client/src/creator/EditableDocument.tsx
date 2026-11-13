import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BetweenHorizontalStart, Columns2, Copy, GripVertical, LayoutGrid, MessageSquarePlus, Pencil, Plus, SquareDashedMousePointer, Trash2, TriangleAlert, Ungroup, X } from "lucide-react";
import {
  BLOCK_TYPE_LABELS,
  blockCells,
  CREATOR_LIMITS,
  findBlock,
  INNER_BLOCK_TYPES,
  isContainer,
  isContainerType,
  type Block,
  type BlockInput,
  type BlockType,
  type ContainerBlock,
  type CreatorEvent,
  type ResourceDoc,
  type Section,
} from "@shared/creator";
import { cellName, cellWidths, containerLayoutIssues, placementIssue, type LayoutIssue } from "@shared/creatorContainers";
import { applyDocOp, type DocOp, type OpResult } from "@shared/creatorOps";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BlockPicker } from "./BlockPicker";
import { BlockView, ContainerView } from "./blocks/BlockView";
import { NoteEditingContext, type NoteEditing } from "./blocks/FigureNotes";
import { CardTitle, EmptyCell } from "./ContainerControls";
import { BLOCK_TEMPLATES } from "./editing/BlockEditor";
import { BlockPanel, type FigureMeasure, type PanelPlace } from "./editing/BlockPanel";
import { moveNote } from "./editing/noteDraft";
import { InlineBlockEditor, type BlockEditorHandle, type CloseReason } from "./editing/InlineBlockEditor";
import { IS_MAC, isEditingTarget } from "./keyboard";
import { isInlineBlock, isInlineType } from "./editing/inlineDraft";
import type { EditEntry } from "./editing/InlineText";
import { revealTarget } from "./reveal";
import { ResourceSheet } from "./ResourceSheet";
import { SectionMenu, SectionTitle, useMenuFollowUp, type SectionTitleHandle } from "./SectionControls";
import { ADDABLE_BLOCKS, insertOp, moveShortcut, sideTarget, stepTarget, type DropTarget, type InsertPlace } from "./structure";
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
  /** Dónde se monta el panel de edición de figuras y tablas (lo pone el espacio de trabajo, fuera de la hoja). */
  panelHost: HTMLElement | null;
  /** Pantalla angosta: el panel es una lámina propia, con su vista previa. */
  panelSheet: boolean;
  /** Avisa cuando el panel se abre o se cierra, para que el espacio de trabajo le haga sitio. */
  onPanelChange?: (open: boolean) => void;
}

const MARK_LABELS: Record<MarkKind, string> = { added: "Añadido por la IA", changed: "Cambiado por la IA" };

const MOVE_HINT = IS_MAC ? { up: "⌥⇧↑", down: "⌥⇧↓", left: "⌥⇧←", right: "⌥⇧→" } : { up: "Alt+Mayús+↑", down: "Alt+Mayús+↓", left: "Alt+Mayús+←", right: "Alt+Mayús+→" };

export interface EditableDocumentHandle {
  /** Guarda el bloque que esté abierto, si es válido. Devuelve `false` si sigue abierto con datos por corregir. */
  settle: () => boolean;
}

/** El bloque abierto: los de texto se editan en su sitio y los demás en el panel lateral. */
interface Editing {
  id: string;
  inline: boolean;
  entry: EditEntry;
  /** Cambia cada vez que se abre: un bloque reemplazado por otro del mismo tipo monta un editor nuevo. */
  seq: number;
}

/** Dónde vive un bloque de dentro: el contenedor y su celda. */
interface Parent {
  container: ContainerBlock;
  cell: number;
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

/** El bloque de la hoja que contiene un elemento: el de más adentro, si hay uno dentro de unas columnas o una tarjeta. */
function blockOf(target: EventTarget | null): string | null {
  return target instanceof Element ? (target.closest<HTMLElement>("[data-block-id]")?.dataset.blockId ?? null) : null;
}

/**
 * El bloque activo es el que está bajo el puntero o el que tiene el foco del teclado. Solo ese bloque
 * monta su barra de acciones: una barra en toda la hoja en vez de una por bloque. Con columnas y
 * tarjetas manda el bloque de más adentro; el contenedor queda activo cuando el puntero o el foco están
 * en él pero fuera de sus bloques (el espacio entre columnas, el borde de una tarjeta).
 */
function useActiveBlock() {
  const [state, setState] = useState<ActiveBlock>({ hoverId: null, focusId: null, last: "hover" });
  const timer = useRef<number | undefined>(undefined);
  /** El bloque al que va a pasar el puntero cuando venza la espera (`undefined`: no hay nada pendiente). */
  const pending = useRef<string | null | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /** El puntero pasó a estar sobre este bloque, o sobre ninguno. */
  const point = useCallback((id: string | null) => {
    if (pending.current === id) return;
    window.clearTimeout(timer.current);
    pending.current = id;
    timer.current = window.setTimeout(
      () => {
        pending.current = undefined;
        setState(current => (id === null ? (current.hoverId === null ? current : { ...current, hoverId: null }) : current.hoverId === id && current.last === "hover" ? current : { ...current, hoverId: id, last: "hover" }));
      },
      id === null ? HOVER_OUT_MS : HOVER_IN_MS,
    );
  }, []);

  const focus = useCallback((id: string | null) => setState(current => (current.focusId === id && (id === null || current.last === "focus") ? current : { ...current, focusId: id, ...(id ? { last: "focus" as const } : {}) })), []);

  const activeId = state.last === "focus" ? (state.focusId ?? state.hoverId) : (state.hoverId ?? state.focusId);
  return { activeId, point, focus };
}

/** En lugar de un texto vacío se ofrece cualquier otro bloque. */
const SLASH_EXCLUDE: readonly BlockType[] = ["paragraph"];

/**
 * Lo que no se ofrece en una celda: lo que no puede ir dentro o no cabe a ese ancho (medido con su
 * plantilla). Al cambiar un texto con «/» tampoco se ofrece otro texto.
 */
function cellExclude(parent: Parent, slash = true): BlockType[] {
  const width = cellWidths(parent.container)[parent.cell];
  return ADDABLE_BLOCKS.filter(type => (slash && type === "paragraph") || !INNER_BLOCK_TYPES.has(type) || placementIssue(BLOCK_TEMPLATES[type], width) !== null);
}

/** La celda donde va a insertar el menú de bloques, si es dentro de un contenedor. */
function placeParent(doc: ResourceDoc, place: InsertPlace): Parent | null {
  if ("blockId" in place) {
    const found = findBlock(doc, place.blockId);
    return found?.parent ? { container: found.parent.container, cell: found.parent.cell } : null;
  }
  if (place.containerId === undefined) return null;
  const found = findBlock(doc, place.containerId);
  return found && isContainer(found.block) ? { container: found.block, cell: place.cell ?? 0 } : null;
}

const PICKER_TITLES: Record<InsertPlace["kind"], string> = {
  after: "Insertar debajo",
  before: "Insertar encima",
  start: "Insertar al inicio de la sección",
  end: "Añadir al final de la sección",
};

/** Los repartos que se ofrecen según cuántas columnas hay. */
const COLUMN_LAYOUTS: Record<number, Array<{ widths: number[]; label: string }>> = {
  2: [
    { widths: [1, 1], label: "Dos iguales" },
    { widths: [2, 1], label: "Ancha la izquierda" },
    { widths: [1, 2], label: "Ancha la derecha" },
  ],
  3: [
    { widths: [1, 1, 1], label: "Tres iguales" },
    { widths: [1, 2, 1], label: "Ancha la del centro" },
    { widths: [2, 1, 1], label: "Ancha la izquierda" },
    { widths: [1, 1, 2], label: "Ancha la derecha" },
  ],
};

const countLabel = (count: number) => (count === 0 ? "vacía" : count === 1 ? "1 bloque" : `${count} bloques`);

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
  { doc, readOnly, applyOp, schoolName, logoUrl, preview, working, attachedIds, onToggleAttach, marks, onAcceptMark, panelHost, panelSheet, onPanelChange },
  ref,
) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const seq = useRef(0);
  const editor = useRef<BlockEditorHandle | null>(null);
  /** Lo que el panel tiene escrito y la hoja dibuja en lugar del bloque, mientras se puede dibujar. */
  const [live, setLive] = useState<{ seq: number; block: BlockInput } | null>(null);
  /** El ancho de diseño de la figura que se edita, tal como la dibuja la hoja: de él salen los tamaños que se ofrecen. */
  const [measure, setMeasure] = useState<FigureMeasure | null>(null);
  /** La nota elegida de la figura abierta en el panel: se marca en la figura y en la lista. */
  const [noteSelected, setNoteSelected] = useState<number | null>(null);
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
  const { activeId: hoverOrFocusId, point, focus } = useActiveBlock();
  const noHover = useNoHover();
  const blockMenu = useMenuFollowUp();
  /** Los contenedores que se ven mal en la hoja (columnas desparejas, texto largo en una columna angosta), con su aviso. */
  const layoutHints = useMemo(() => {
    const hints = new Map<string, LayoutIssue[]>();
    for (const block of doc.sections.flatMap(section => section.blocks)) {
      if (!isContainer(block)) continue;
      const issues = containerLayoutIssues(block);
      if (issues.length > 0) hints.set(block.id, issues);
    }
    return hints;
  }, [doc]);

  // Antes de que la IA empiece a trabajar, quien envía el mensaje pide guardar lo abierto (ver CreatorWorkspace)
  useImperativeHandle(ref, () => ({ settle: () => editor.current?.settle() ?? true }), []);

  /** Lleva el foco a un bloque (tras moverlo, duplicarlo o cerrar un menú). Espera a que la hoja se dibuje. */
  const focusBlock = useCallback((id: string, options?: { flash?: boolean; stay?: boolean }) => {
    requestAnimationFrame(() => {
      // La vista propia del bloque, no la de un bloque de dentro si es un contenedor
      const view = paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"] > .crt-block__view`);
      if (options?.flash) revealTarget({ blockIds: [id] });
      view?.focus({ preventScroll: options?.flash || options?.stay });
      // Un bloque sin vista enfocable (el salto de página) al menos se trae a la vista
      if (!view) paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  /** Mueve un bloque a un hueco. Un solo paso de deshacer, sea arrastre, menú o teclado. */
  const moveTo = useCallback(
    (blockId: string, target: DropTarget) => {
      const result = applyOp({ op: "move_block_to", blockId, ...target });
      if (!result.ok || !result.changed) return;
      const found = findBlock(result.doc, blockId);
      if (!found) return;
      const list = found.parent ? blockCells(found.parent.container)[found.parent.cell] : found.section.blocks;
      const where = found.parent ? `${cellName(found.parent.container, found.parent.cell)} de «${found.section.title}»` : `«${found.section.title}»`;
      setAnnouncement(`Bloque movido: lugar ${found.index + 1} de ${list.length} en ${where}.`);
      focusBlock(blockId);
    },
    [applyOp, focusBlock],
  );

  /** Por qué no se puede soltar ahí (no cabe en esa columna), para avisarlo mientras se arrastra. Soltar igual da el aviso completo. */
  const dropBlocked = useCallback((blockId: string, target: DropTarget) => {
    const result = applyDocOp(docRef.current, { op: "move_block_to", blockId, ...target });
    return result.ok ? null : result.error;
  }, []);

  const { dragging, held, press, cancel: cancelDrag } = useBlockDrag({ paper, line: dropLine, chip: dragChip, doc: () => docRef.current, onDrop: moveTo, blocked: dropBlocked });

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

  /**
   * Abre un bloque para editarlo. Lo que estaba abierto se guarda antes (lo del panel se aplica); si tiene un
   * dato por corregir no se cierra: se perdería lo escrito.
   */
  const open = (id: string, type: BlockType, entry: EditEntry) => {
    const current = editingRef.current;
    if (current && current.id !== id && editor.current && !editor.current.settle()) {
      editor.current.focus();
      return;
    }
    // Un contenedor no tiene formulario: se abre lo primero que guarda
    const found = isContainerType(type) ? findBlock(docRef.current, id) : null;
    if (found && isContainer(found.block)) {
      const first = blockCells(found.block).flat()[0];
      if (first) open(first.id, first.type, entry);
      else focusBlock(id);
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

  /** Cierra el panel, aplicado o descartado. El foco vuelve al bloque sin mover la hoja. */
  const closePanel = (id: string) => {
    setEditing(current => (current?.id === id ? null : current));
    setLive(null);
    setNoteSelected(null);
    focusBlock(id, { stay: true });
  };

  /** El bloque abierto en el panel y dónde vive; `null` si no hay panel. */
  const panelFound = editing && !editing.inline ? findBlock(doc, editing.id) : null;
  const panelId = panelFound?.block.id;
  const panelPlace: PanelPlace | null = panelFound?.parent ? { container: panelFound.parent.container, cell: panelFound.parent.cell } : null;

  // Si el bloque del panel deja de existir (se deshizo su llegada, se restauró una versión), el panel se cierra sin aplicar nada
  const panelGone = editing !== null && !editing.inline && !panelFound;
  useEffect(() => {
    if (panelGone) setEditing(null);
  }, [panelGone]);

  const panelOpen = panelId !== undefined;
  // Otra figura en el panel empieza sin nota elegida
  useEffect(() => setNoteSelected(null), [panelId]);

  /** Las notas de la figura abierta se arrastran sobre ella; cada movimiento cambia el borrador del panel. */
  const noteEditing = useMemo<NoteEditing | null>(
    () => (panelOpen ? { selected: noteSelected, onSelect: setNoteSelected, onMove: (index, part, to) => editor.current?.edit?.(draft => moveNote(draft, index, part, to)) } : null),
    [noteSelected, panelOpen],
  );
  useEffect(() => onPanelChange?.(panelOpen), [onPanelChange, panelOpen]);
  useEffect(() => () => onPanelChange?.(false), [onPanelChange]);

  // El ancho de diseño de la figura abierta, leído de su dibujo en la hoja (cada figura lo fija según sus datos)
  useLayoutEffect(() => {
    const figure = panelId ? paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(panelId)}"] > .crt-block__view > .crt-graph > :is(.crt-figure, .crt-plane)`) : null;
    const plane = figure?.classList.contains("crt-plane") ?? false;
    const design = figure ? Number.parseFloat(figure.style.getPropertyValue(plane ? "--plane-wn" : "--fig-wn")) : Number.NaN;
    const next: FigureMeasure | null = Number.isFinite(design) ? { design, kind: plane ? "plane" : "figure" } : null;
    setMeasure(current => (current?.design === next?.design && current?.kind === next?.kind ? current : next));
  });

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
    if ("blockId" in place) focusBlock(place.blockId);
    else if (place.containerId !== undefined) {
      const { containerId, cell } = place;
      requestAnimationFrame(() => paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(containerId)}"] .crt-cell[data-cell="${cell}"] .crt-cell__more`)?.focus());
    }
    else requestAnimationFrame(() => document.querySelector<HTMLElement>(`#crt-${CSS.escape(place.sectionId)} > .crt-add .crt-add__button`)?.focus());
  };

  /** El título del menú de bloques y lo que no ofrece, según dónde se va a insertar. */
  const pickerFor = (place: InsertPlace): { title: string; exclude?: BlockType[] } => {
    const parent = placeParent(docRef.current, place);
    if (!parent) return { title: PICKER_TITLES[place.kind] };
    const noun = parent.container.type === "columns" ? "columna" : "tarjeta";
    const titles: Record<InsertPlace["kind"], string> = { after: "Insertar debajo", before: "Insertar encima", start: `Insertar al inicio de la ${noun}`, end: `Añadir a la ${noun}` };
    return { title: titles[place.kind], exclude: cellExclude(parent, false) };
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
    } else if (isContainer(next)) {
      setEditing(null);
      open(id, next.type, entry);
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
    const found = findBlock(docRef.current, id);
    const list = found ? (found.parent ? blockCells(found.parent.container)[found.parent.cell] : found.section.blocks) : [];
    // El último bloque de una celda deja el foco en su contenedor
    const neighbour = found && (list[found.index + 1] ?? list[found.index - 1] ?? found.parent?.container);
    const result = applyOp({ op: "delete_blocks", blockIds: [id] });
    return result.ok ? neighbour?.id : undefined;
  };

  /** Arriba y abajo dentro de su lista (y fuera de la celda en su borde); a los lados, a la columna o tarjeta vecina. */
  const step = (id: string, direction: "up" | "down" | "left" | "right") => {
    const target = direction === "left" || direction === "right" ? sideTarget(docRef.current, id, direction) : stepTarget(docRef.current, id, direction);
    if (target) moveTo(id, target);
  };

  /** Una operación sobre un contenedor desde su menú; el foco vuelve a él (o a lo que diga `focusOn`). */
  const containerOp = (op: DocOp, focusOn?: (result: Extract<OpResult, { ok: true }>) => string | undefined) => {
    const result = applyOp(op);
    if (!result.ok || !result.changed) return;
    const target = focusOn?.(result) ?? ("containerId" in op ? op.containerId : result.ids[0]);
    if (target) blockMenu.then(() => focusBlock(target));
  };

  /** Escribir en una celda vacía: un párrafo nuevo, abierto con su texto de muestra seleccionado. */
  const writeInCell = (section: Section, container: ContainerBlock, cell: number) => {
    const result = applyOp({ op: "insert_blocks", sectionId: section.id, containerId: container.id, cell, at: "end", blocks: [BLOCK_TEMPLATES.paragraph] });
    if (result.ok && result.ids[0]) open(result.ids[0], "paragraph", "all");
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

  /** ¿Se puede aplicar? Sirve para apagar en el menú lo que no cabría, con el motivo como ayuda. */
  const tryOp = (op: DocOp): string | null => {
    const result = applyDocOp(docRef.current, op);
    return result.ok ? null : result.error;
  };

  /** Lo que el menú de un contenedor añade: el reparto, las celdas y sacar los bloques. */
  const containerItems = (block: ContainerBlock) => {
    const cells = blockCells(block);
    const columns = block.type === "columns";
    const noun = columns ? "columna" : "tarjeta";
    const addIssue = tryOp({ op: "add_cell", containerId: block.id });
    const canRemove = columns ? cells.length > CREATOR_LIMITS.columnsMin : cells.length > 1;
    const current = columns ? block.columns.map(column => column.width).join(":") : String(block.perRow);
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {columns ? <Columns2 aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
            {columns ? "Reparto" : "Tarjetas por fila"}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="crt-menu w-56">
            <DropdownMenuRadioGroup value={current}>
              {columns
                ? COLUMN_LAYOUTS[cells.length].map(layout => {
                    const issue = tryOp({ op: "set_layout", containerId: block.id, widths: layout.widths });
                    const value = layout.widths.join(":");
                    return (
                      <DropdownMenuRadioItem key={value} value={value} disabled={issue !== null && value !== current} title={issue ?? undefined} onSelect={() => containerOp({ op: "set_layout", containerId: block.id, widths: layout.widths })}>
                        {layout.label}
                      </DropdownMenuRadioItem>
                    );
                  })
                : [2, 3, 4].map(perRow => {
                    const issue = tryOp({ op: "set_layout", containerId: block.id, perRow });
                    return (
                      <DropdownMenuRadioItem key={perRow} value={String(perRow)} disabled={issue !== null && perRow !== block.perRow} title={issue ?? undefined} onSelect={() => containerOp({ op: "set_layout", containerId: block.id, perRow })}>
                        {perRow} por fila
                      </DropdownMenuRadioItem>
                    );
                  })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          disabled={addIssue !== null}
          title={addIssue ?? undefined}
          onSelect={() =>
            containerOp({ op: "add_cell", containerId: block.id }, () => {
              // El foco va a «Escribir aquí» de la celda nueva
              blockMenu.then(() => requestAnimationFrame(() => paper.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block.id)}"] .crt-cell[data-cell="${cells.length}"] .crt-cell__write`)?.focus()));
              return undefined;
            })
          }
        >
          <Plus aria-hidden="true" />
          Añadir {noun}
        </DropdownMenuItem>
        {canRemove && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <X aria-hidden="true" />
              Quitar {noun}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="crt-menu w-64">
              {cells.map((cell, index) => {
                const issue = tryOp({ op: "remove_cell", containerId: block.id, cell: index });
                const title = block.type === "cards" ? block.cards[index].title : undefined;
                return (
                  <DropdownMenuItem key={index} disabled={issue !== null} title={issue ?? undefined} onSelect={() => containerOp({ op: "remove_cell", containerId: block.id, cell: index })}>
                    <span className="truncate">
                      {columns ? "Columna" : "Tarjeta"} {index + 1}
                      {title ? ` «${title}»` : ""}
                    </span>
                    <DropdownMenuShortcut>{countLabel(cell.length)}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={() => containerOp({ op: "unwrap_container", containerId: block.id }, result => result.ids[0])}>
          <Ungroup aria-hidden="true" />
          Sacar de {columns ? "las columnas" : "las tarjetas"}
        </DropdownMenuItem>
      </>
    );
  };

  const renderBlock = (block: Block, section: Section, parent?: Parent) => {
    const isEditing = editing?.id === block.id;
    const inline = isInlineBlock(block);
    const container = isContainer(block) ? block : null;
    // Abierto en el panel, el bloque se queda en su sitio y dibuja lo que se va escribiendo; no se vuelve a abrir desde la hoja
    const inPanel = isEditing && !editing.inline;
    const shown = inPanel && live?.seq === editing.seq ? ({ ...live.block, id: block.id } as Block) : block;
    const canEdit = !readOnly && block.type !== "page_break" && !container && !inPanel;
    const active = !readOnly && !isEditing && activeId === block.id;
    const showTools = !readOnly && (noHover || active);
    const mark = marks.get(block.id);
    const canAttach = !readOnly && onToggleAttach !== undefined && block.type !== "page_break";
    const attached = canAttach && attachedIds.has(block.id);
    const attachLabel = attached ? "Quitar del chat" : "Llevar al chat";
    const label = BLOCK_TYPE_LABELS[block.type];
    // Subir y Bajar pasan a la sección vecina: solo se detienen en los extremos del documento. Desde el borde de
    // una celda salen del contenedor; a los lados, pasan a la columna o la tarjeta vecina
    const list = parent ? blockCells(parent.container)[parent.cell] : section.blocks;
    const index = list.indexOf(block as never);
    const sectionIndex = doc.sections.indexOf(section);
    const canUp = parent !== undefined || index > 0 || sectionIndex > 0;
    const canDown = parent !== undefined || index < list.length - 1 || sectionIndex < doc.sections.length - 1;
    const cellNoun = parent?.container.type === "columns" ? "columna" : "tarjeta";
    // Poner en columnas: un bloque del primer nivel que pueda ir dentro, solo o con el que le sigue. Lo que
    // depende de aplicar la operación se calcula solo con el menú abierto (en táctil todas las barras están a la vista)
    const menuOpen = menuFor === block.id;
    const wrappable = menuOpen && !parent && !container && INNER_BLOCK_TYPES.has(block.type);
    const next = wrappable ? section.blocks[index + 1] : undefined;
    const wrapWithNext = wrappable && next !== undefined && !isContainer(next) && INNER_BLOCK_TYPES.has(next.type) && tryOp({ op: "wrap_blocks", blockIds: [block.id, next.id], as: "columns" }) === null;
    const wrapIssue = wrappable ? tryOp({ op: "wrap_blocks", blockIds: [block.id], as: "columns" }) : null;
    const pickerHere = picker && (picker.kind === "after" || picker.kind === "before") && picker.blockId === block.id ? picker : null;
    const blockPicker = pickerHere && (
      <PickerAnchor above={pickerHere.kind === "before"}>
        <BlockPicker {...pickerFor(pickerHere)} onPick={insert} onClose={closePicker} />
      </PickerAnchor>
    );
    /** El menú de bloques al final de una celda vacía de este contenedor. */
    const cellPicker = (cell: number) =>
      container && picker?.kind === "end" && picker.containerId === container.id && picker.cell === cell ? (
        <PickerAnchor>
          <BlockPicker {...pickerFor(picker)} onPick={insert} onClose={closePicker} />
        </PickerAnchor>
      ) : null;

    const view = container ? (
      // El marco del contenedor se enfoca con Tab o con un clic entre sus bloques: así se elige el contenedor entero
      <div
        className="crt-block__view crt-frame"
        {...(!readOnly ? { tabIndex: 0, role: "group", "aria-label": `${label}: ${blockCells(container).length} ${container.type === "columns" ? "columnas" : "tarjetas"}` } : {})}
      >
        <ContainerView
          block={container}
          renderInner={(inner, cell) => renderBlock(inner, section, { container, cell })}
          renderCardTitle={(cell, title) => <CardTitle containerId={container.id} cell={cell} title={title} readOnly={readOnly} applyOp={applyOp} />}
          renderCellEnd={(cell, blocks) =>
            !readOnly &&
            blocks.length === 0 && (
              <>
                <EmptyCell
                  noun={container.type === "columns" ? "columna" : "tarjeta"}
                  onWrite={() => writeInCell(section, container, cell)}
                  onMore={() => openPicker({ sectionId: section.id, kind: "end", containerId: container.id, cell })}
                  moreOpen={picker?.kind === "end" && picker.containerId === container.id && picker.cell === cell}
                  // Sin bloques que mover, una celda vacía se puede quitar si quedan las suficientes
                  onRemove={blockCells(container).length > (container.type === "columns" ? CREATOR_LIMITS.columnsMin : 1) ? () => containerOp({ op: "remove_cell", containerId: container.id, cell }) : undefined}
                />
                {cellPicker(cell)}
              </>
            )
          }
        />
        {!readOnly && (layoutHints.get(container.id) ?? []).map(hint => (
          // Solo en pantalla: un aviso de que las columnas se ven mal en la hoja, sin impedir nada
          <p key={hint.key} className="crt-layout-hint">
            <TriangleAlert aria-hidden="true" />
            {hint.message}
          </p>
        ))}
      </div>
    ) : (
      <div
        className="crt-block__view"
        {...(canEdit
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `Editar ${label.toLowerCase()}`,
              "aria-keyshortcuts": parent ? "Alt+Shift+ArrowUp Alt+Shift+ArrowDown Alt+Shift+ArrowLeft Alt+Shift+ArrowRight" : "Alt+Shift+ArrowUp Alt+Shift+ArrowDown",
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
        {/* En la figura abierta en el panel, sus notas se arrastran aquí mismo (en pantalla angosta, en la lámina) */}
        <NoteEditingContext.Provider value={inPanel && !panelSheet ? noteEditing : null}>
          <BlockView block={shown} />
        </NoteEditingContext.Provider>
      </div>
    );

    return (
      <div
        className={cn(
          "crt-block",
          `crt-block--${block.type}`,
          parent && "crt-block--inner",
          isEditing && (inline ? "is-inplace" : "is-editing"),
          !readOnly && "is-editable",
          active && "is-active",
          attached && "is-attached",
          dragging === block.id && "is-dragging",
          pickerHere && "has-picker",
        )}
        data-block-id={block.id}
        onKeyDown={event => {
          // Alt+Mayús+↑/↓ mueve el bloque que tiene el foco; dentro de un texto o un campo, las teclas son suyas.
          // Un bloque de dentro de unas columnas lo atiende él: su contenedor no se mueve con él
          const direction = moveShortcut(event);
          if (!direction || readOnly || isEditing || isEditingTarget(event.target) || blockOf(event.target) !== block.id) return;
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
                    exclude={parent ? cellExclude(parent) : SLASH_EXCLUDE}
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
        ) : inPanel ? (
          // El formulario está en el panel lateral; aquí queda el bloque, marcado, con el borrador dibujado
          view
        ) : (
          <>
            {view}
            {showTools && (
              <div className="crt-block__tools" role="toolbar" aria-label={`Acciones de ${label.toLowerCase()}`}>
                <DropdownMenu open={menuOpen} onOpenChange={open => setMenuFor(open ? block.id : null)}>
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
                    {wrappable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={wrapIssue !== null} title={wrapIssue ?? undefined} onSelect={() => containerOp({ op: "wrap_blocks", blockIds: [block.id], as: "columns" })}>
                          <Columns2 aria-hidden="true" />
                          Poner en columnas
                        </DropdownMenuItem>
                        {wrapWithNext && (
                          <DropdownMenuItem onSelect={() => containerOp({ op: "wrap_blocks", blockIds: [block.id, next!.id], as: "columns" })}>
                            <Columns2 aria-hidden="true" />
                            En columnas con el siguiente
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    {container && menuOpen && containerItems(container)}
                    {parent && menuOpen && (
                      <>
                        {(["left", "right"] as const).map(direction => {
                          const target = sideTarget(doc, block.id, direction);
                          const issue = target && tryOp({ op: "move_block_to", blockId: block.id, ...target });
                          return (
                            <DropdownMenuItem
                              key={direction}
                              disabled={!target || issue !== null}
                              title={issue ?? undefined}
                              onSelect={() => {
                                step(block.id, direction);
                                blockMenu.then(() => focusBlock(block.id));
                              }}
                            >
                              {direction === "left" ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                              A la {cellNoun} {direction === "left" ? "anterior" : "siguiente"}
                              <DropdownMenuShortcut className="crt-keys">{direction === "left" ? MOVE_HINT.left : MOVE_HINT.right}</DropdownMenuShortcut>
                            </DropdownMenuItem>
                          );
                        })}
                      </>
                    )}
                    {parent && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={blockMenu.later(() => focusBlock(parent.container.id))}>
                          <SquareDashedMousePointer aria-hidden="true" />
                          Elegir {parent.container.type === "columns" ? "las columnas" : "las tarjetas"}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        const neighbour = remove(block.id);
                        if (neighbour) blockMenu.then(() => focusBlock(neighbour));
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
    <div
      className="crt-paper"
      ref={paper}
      // Un solo oyente para toda la hoja: el bloque activo es el de más adentro bajo el puntero o con el foco
      onPointerOver={event => event.pointerType !== "touch" && point(blockOf(event.target))}
      onPointerLeave={event => event.pointerType !== "touch" && point(null)}
      onFocus={event => {
        const id = blockOf(event.target);
        if (id) focus(id);
      }}
      onBlur={event => {
        // El foco que sale de la hoja (o a algo que no es un bloque) deja de marcar un bloque
        if (!blockOf(event.relatedTarget) || !paper.current?.contains(event.relatedTarget as Node)) focus(null);
      }}
    >
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

      {/* Fuera de la hoja: el panel va donde lo monta el espacio de trabajo (en el sitio del copiloto, o como lámina) */}
      {panelHost &&
        panelFound &&
        editing &&
        createPortal(
          <BlockPanel
            key={editing.seq}
            ref={editor}
            block={panelFound.block}
            place={panelPlace}
            measure={measure}
            sheet={panelSheet}
            onLive={draft => setLive({ seq: editing.seq, block: draft })}
            // Aplicar es una sola operación: un paso de deshacer. Si no cabe en su celda, sale el aviso y el panel sigue abierto
            onApply={next => applyOp({ op: "update_block", blockId: panelFound.block.id, block: next }).ok}
            onClose={() => closePanel(panelFound.block.id)}
            selectedNote={noteSelected}
            onSelectNote={setNoteSelected}
            noteEditing={panelSheet ? noteEditing : null}
          />,
          panelHost,
        )}
    </div>
  );
});

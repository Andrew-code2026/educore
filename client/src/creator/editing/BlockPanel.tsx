import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Crosshair, Move, MoveUpRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { BLOCK_TYPE_LABELS, blockInputSchema, isFigure, type Block, type BlockInput, type BlockType, type ContainerBlock } from "@shared/creator";
import { cellWidths, SHEET_WIDTH_PX } from "@shared/creatorContainers";
import { arrowStep, FIGURE_NOTE_TEXT_MAX, FIGURE_NOTES_MAX, movePoint, type NotePoint } from "@shared/creatorFigureNotes";
import {
  currentSizeChoice,
  FIGURE_SIZE_LABELS,
  FIGURE_SIZES,
  figureSizeAllowed,
  figureSizeChoices,
  figureWidth,
  pxToCm,
  storedFigureSize,
  type FigureKind,
  type FigureSize,
  type FigureSizeChoice,
} from "@shared/creatorFigureSize";
import { sameJson } from "@shared/creatorTurn";
import { PortalContainerProvider, usePortalContainerHost } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";
import { BlockView } from "../blocks/BlockView";
import { NoteEditingContext, type NoteEditing, type NotePart } from "../blocks/FigureNotes";
import { IS_MAC } from "../keyboard";
import { BlockForm, checkDraft } from "./BlockForm";
import type { BlockEditorHandle } from "./InlineBlockEditor";
import { addNote, draftNotes, moveNote, removeNote, setNoteText, toggleNotePointer } from "./noteDraft";

/** La figura tal como se dibuja en la hoja: su ancho de diseño (el del componente) y si es el plano. */
export interface FigureMeasure {
  design: number;
  kind: FigureKind;
}

/** Dónde vive el bloque: suelto en la hoja o en una celda de unas columnas o unas tarjetas. */
export interface PanelPlace {
  container: ContainerBlock;
  cell: number;
}

interface BlockPanelProps {
  block: Block;
  place: PanelPlace | null;
  /** Medida de la figura en la hoja; `null` si no es una figura o aún no se dibuja. */
  measure: FigureMeasure | null;
  /** Pantalla angosta: el panel es una lámina propia y lleva su vista previa. */
  sheet: boolean;
  /** Lo que la hoja dibuja mientras se edita: el borrador, cada vez que se puede dibujar. */
  onLive: (draft: BlockInput) => void;
  /** Aplica el borrador como un solo paso de deshacer. Si no se pudo (no cabe en su celda), devuelve el motivo. */
  onApply: (next: BlockInput) => string | null;
  /** Cierra el panel: tras aplicar, o descartando el borrador. */
  onClose: (reason: "applied" | "cancel") => void;
  /** La nota elegida (en la hoja o en la lista): se marca en los dos sitios. */
  selectedNote: number | null;
  onSelectNote: (index: number | null) => void;
  /** Mover y elegir notas sobre la vista previa de la lámina (en pantalla ancha, sobre la hoja). */
  noteEditing: NoteEditing | null;
}

interface NotesSectionProps {
  draft: BlockInput;
  selected: number | null;
  sheet: boolean;
  onSelect: (index: number | null) => void;
  onChange: (next: BlockInput) => void;
}

/** Las notas del docente sobre la figura: su texto, la línea al punto que señalan y moverlas con el teclado. */
function NotesSection({ draft, selected, sheet, onSelect, onChange }: NotesSectionProps) {
  const labelId = useId();
  const hintId = useId();
  const list = useRef<HTMLDivElement>(null);
  const notes = draftNotes(draft);

  const add = () => {
    onChange(addNote(draft));
    onSelect(notes.length);
    // El texto de muestra queda seleccionado para escribir el propio
    requestAnimationFrame(() => {
      const input = list.current?.querySelectorAll<HTMLInputElement>(".crt-note-row input")[notes.length];
      input?.focus();
      input?.select();
    });
  };

  const nudge = (index: number, part: NotePart) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = arrowStep(event.key, event.shiftKey);
    const from = part === "pointer" ? notes[index].pointer : notes[index];
    if (!step || !from) return;
    event.preventDefault();
    onChange(moveNote(draft, index, part, movePoint(from, step)));
  };

  const where = (point: NotePoint) => `${Math.round(point.x * 100)} % desde la izquierda, ${Math.round(point.y * 100)} % desde arriba`;

  return (
    <section className="crt-panel__section" aria-labelledby={labelId}>
      <div className="crt-panel__row">
        <h3 id={labelId} className="crt-panel__label">
          Notas sobre la figura
        </h3>
        {notes.length > 0 && (
          <span className="crt-panel__count">
            {notes.length} de {FIGURE_NOTES_MAX}
          </span>
        )}
      </div>
      <p id={hintId} className="crt-panel__hint">
        {notes.length === 0 ? "Textos cortos encima de la figura, que se imprimen con ella." : `Arrástralas en la figura${sheet ? " de arriba" : ""}, o con las flechas desde aquí (Mayús, más lejos).`}
      </p>
      {notes.length > 0 && (
        <div ref={list} className="crt-note-rows">
          {notes.map((note, index) => (
            <div key={index} className={cn("crt-note-row", selected === index && "is-selected")}>
              <input
                className="crt-input"
                value={note.text}
                maxLength={FIGURE_NOTE_TEXT_MAX}
                placeholder="Texto de la nota"
                aria-label={`Texto de la nota ${index + 1}`}
                onFocus={() => onSelect(index)}
                onChange={event => onChange(setNoteText(draft, index, event.target.value))}
              />
              <button type="button" className="crt-icon-btn" title={`Mover la nota con las flechas (${where(note)})`} aria-label={`Mover la nota ${index + 1} con las flechas: ${where(note)}`} aria-describedby={hintId} onFocus={() => onSelect(index)} onKeyDown={nudge(index, "note")}>
                <Move aria-hidden="true" />
              </button>
              <button
                type="button"
                className="crt-icon-btn"
                aria-pressed={note.pointer !== undefined}
                title={note.pointer ? "Quitar la línea al punto que señala" : "Señalar un punto con una línea"}
                aria-label={`Línea de la nota ${index + 1} a un punto`}
                onClick={() => {
                  onChange(toggleNotePointer(draft, index));
                  onSelect(index);
                }}
              >
                <MoveUpRight aria-hidden="true" />
              </button>
              <button
                type="button"
                className="crt-icon-btn crt-icon-btn--danger"
                aria-label={`Quitar la nota ${index + 1}`}
                onClick={() => {
                  onChange(removeNote(draft, index));
                  onSelect(null);
                }}
              >
                <Trash2 aria-hidden="true" />
              </button>
              {note.pointer && (
                <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm crt-note-row__point" title={where(note.pointer)} aria-label={`Mover el punto que señala la nota ${index + 1} con las flechas: ${where(note.pointer)}`} onFocus={() => onSelect(index)} onKeyDown={nudge(index, "pointer")}>
                  <Crosshair aria-hidden="true" />
                  Punto señalado: muévelo con las flechas
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {notes.length < FIGURE_NOTES_MAX && (
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm crt-panel__add" onClick={add}>
          <Plus aria-hidden="true" />
          Añadir nota
        </button>
      )}
    </section>
  );
}

const APPLY_HINT = IS_MAC ? "⌘ Intro" : "Ctrl+Intro";

/** En la lámina (pantalla angosta) la hoja queda tapada: Tab da la vuelta dentro del panel en vez de irse a ella. */
function keepFocusInside(event: KeyboardEvent<HTMLElement>) {
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea, select, math-field, [tabindex]:not([tabindex='-1'])")).filter(
    element => element.getClientRects().length > 0,
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

const withoutId = ({ id: _id, ...content }: Block) => content as BlockInput;

/** El nombre de la opción de tamaño: dentro de una celda, el ancho completo es el de la celda. */
function choiceLabel(choice: FigureSizeChoice, place: PanelPlace | null): string {
  if (!choice.sizes.includes("full")) return FIGURE_SIZE_LABELS[choice.size];
  if (!place) return FIGURE_SIZE_LABELS.full;
  return place.container.type === "columns" ? "Toda la columna" : "Toda la tarjeta";
}

interface SizePickerProps {
  type: BlockType;
  value: FigureSize | undefined;
  measure: FigureMeasure | null;
  place: PanelPlace | null;
  onChange: (size: FigureSize | undefined) => void;
}

/** Tamaño en la hoja: solo las opciones que dan un ancho distinto ahí, con lo que mide en papel. */
function SizePicker({ type, value, measure, place, onChange }: SizePickerProps) {
  const labelId = useId();
  const group = useRef<HTMLDivElement>(null);
  // Las opciones se cuentan en papel, que es lo que se entrega: en una pantalla angosta dos tamaños pueden verse
  // iguales y salir distintos al imprimir
  const paper = place ? cellWidths(place.container)[place.cell] : SHEET_WIDTH_PX;
  // Sin medida (la figura aún no se dibuja o sus datos no la dejan dibujar) se ofrecen todos los que admite
  const choices = useMemo(
    () => (measure ? figureSizeChoices(measure.design, paper, type, measure.kind) : FIGURE_SIZES.filter(size => figureSizeAllowed(type, size)).map(size => ({ size, sizes: [size], width: paper }))),
    [measure, paper, type],
  );
  const current = currentSizeChoice(choices, value);
  const printed = measure ? figureWidth(value, measure.design, paper, measure.kind) : null;
  const noun = place?.container.type === "columns" ? "columna" : "tarjeta";

  const pick = (choice: FigureSizeChoice) => {
    // La opción que ya está elegida no cambia nada, aunque reúna varios tamaños
    if (choice === current) return;
    onChange(storedFigureSize(choice.size));
  };

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = current ? choices.indexOf(current) : 0;
    const last = choices.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(last, index + 1) : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    pick(choices[next]);
    requestAnimationFrame(() => group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus());
  };

  return (
    <section className="crt-panel__section" aria-labelledby={labelId}>
      <h3 id={labelId} className="crt-panel__label">
        Tamaño en la hoja
      </h3>
      <div ref={group} className="crt-sizes" role="radiogroup" aria-labelledby={labelId} onKeyDown={move}>
        {choices.map(choice => {
          const checked = choice === current;
          return (
            <button key={choice.size} type="button" role="radio" aria-checked={checked} tabIndex={checked || (!current && choice === choices[0]) ? 0 : -1} className="crt-size" onClick={() => pick(choice)}>
              {/* La hoja (o la celda) y lo que ocupa la figura en ella */}
              <span className="crt-size__glyph" aria-hidden="true">
                <span style={{ width: `${Math.max(18, Math.min(100, (choice.width / paper) * 100))}%` }} />
              </span>
              {choiceLabel(choice, place)}
            </button>
          );
        })}
      </div>
      {printed !== null && (
        <p className="crt-panel__hint">
          En papel mide {pxToCm(printed)} cm de ancho{place ? `, en una ${noun} de ${pxToCm(paper)} cm` : ""}.
        </p>
      )}
    </section>
  );
}

/**
 * Panel lateral para editar un bloque con parámetros (figuras, tablas, fórmulas destacadas, datos del
 * estudiante). La hoja no se mueve: el bloque se queda en su sitio y dibuja el borrador mientras se edita.
 * Aplicar es un solo paso de deshacer; cancelar o Escape lo deja como estaba. Lo que no valida se avisa
 * aquí, sin perder lo escrito.
 */
export const BlockPanel = forwardRef<BlockEditorHandle, BlockPanelProps>(function BlockPanel({ block, place, measure, sheet, onLive, onApply, onClose, selectedNote, onSelectNote, noteEditing }, ref) {
  const initial = useMemo(() => withoutId(block), [block]);
  const [draft, setDraft] = useState<BlockInput>(initial);
  /** Lo guardado contra lo que se compara el borrador. */
  const [base, setBase] = useState(initial);
  // Si el bloque cambia mientras está abierto (deshacer) y aquí no se tocó nada, el panel sigue a la hoja
  if (initial !== base) {
    setBase(initial);
    if (sameJson(draft, base)) setDraft(initial);
  }
  const [issues, setIssues] = useState<string[]>([]);
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  // Las listas de los selects se montan dentro del panel, igual que el resto de sus campos
  const [portalContainer, rootRef] = usePortalContainerHost(root);

  const dirty = !sameJson(draft, base);
  const drawable = useMemo(() => {
    const parsed = blockInputSchema.safeParse(draft);
    return parsed.success ? parsed.data : null;
  }, [draft]);

  // La hoja dibuja el borrador; mientras no se puede dibujar, se queda con el último que sí
  const onLiveRef = useRef(onLive);
  onLiveRef.current = onLive;
  useEffect(() => {
    if (drawable) onLiveRef.current(drawable);
  }, [drawable]);

  // Al abrir, el foco entra al panel (al primer campo si el formulario no eligió otro): así Escape y Tab funcionan de una vez.
  // En una pantalla táctil va al panel mismo: un campo enfocado abriría el teclado encima de la figura
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const panel = root.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const touch = window.matchMedia("(hover: none)").matches;
      const field = touch ? null : panel.querySelector<HTMLElement>(".crt-panel__body :is(input, textarea, select, [contenteditable='true'], math-field)");
      (field ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Aplica lo que hay. Sin cambios no hay nada que aplicar. */
  const commit = (): boolean => {
    if (!dirty) return true;
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setIssues(checked.issues);
      return false;
    }
    const error = onApply(checked.block);
    if (error) setIssues([error]);
    return error === null;
  };

  const apply = () => {
    if (commit()) onClose("applied");
  };
  const cancel = () => onClose("cancel");

  // La hoja puede pedir que se aplique lo que hay (al abrir otro bloque o antes de que la IA trabaje), con el borrador al día
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useImperativeHandle(
    ref,
    () => ({
      settle: () => commitRef.current(),
      focus: () => root.current?.querySelector<HTMLElement>(".crt-panel__body :is(input, textarea, select, [contenteditable='true'], math-field)")?.focus(),
      // Lo que se hace sobre la figura (arrastrar una nota) cambia el mismo borrador
      edit: change => {
        setDraft(change);
        setIssues([]);
      },
    }),
    [],
  );

  const change = (next: BlockInput) => {
    setDraft(next);
    if (issues.length > 0) setIssues([]);
  };

  const label = BLOCK_TYPE_LABELS[block.type];
  const figure = isFigure(draft) ? draft : null;

  return (
    <PortalContainerProvider container={portalContainer}>
      <section
        ref={rootRef}
        className="crt-panel"
        role="dialog"
        aria-modal={sheet}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={event => {
          if (event.defaultPrevented) return;
          if (sheet && event.key === "Tab") keepFocusInside(event);
          else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
          }
        }}
      >
        <header className="crt-panel__head">
          <span className="crt-panel__icon" aria-hidden="true">
            <Pencil />
          </span>
          <div className="crt-panel__titles">
            <h2 id={titleId} className="crt-panel__title">
              {label}
            </h2>
            <p className="crt-panel__sub">{sheet ? "Los cambios se ven aquí arriba." : "Los cambios se ven en la hoja."}</p>
          </div>
          <button type="button" className="crt-icon-btn" aria-label="Cerrar sin aplicar" title="Cerrar sin aplicar (Esc)" onClick={cancel}>
            <X aria-hidden="true" />
          </button>
        </header>

        {sheet && (
          // En pantalla angosta la hoja queda debajo de la lámina: la vista previa va aquí
          <div className="crt-panel__preview" role="group" aria-label="Vista previa">
            <div className="crt-doc crt-panel__paper">
              <NoteEditingContext.Provider value={noteEditing}>
                <BlockView block={{ ...(drawable ?? initial), id: block.id } as Block} />
              </NoteEditingContext.Provider>
            </div>
          </div>
        )}

        <div className="crt-panel__body">
          {figure && <SizePicker type={figure.type} value={figure.size} measure={measure} place={place} onChange={size => change({ ...figure, size } as BlockInput)} />}
          {figure && <NotesSection draft={draft} selected={selectedNote} sheet={sheet} onSelect={onSelectNote} onChange={change} />}
          <section className="crt-panel__section crt-form" aria-label={`Datos de ${label.toLowerCase()}`}>
            <BlockForm draft={draft} onChange={change} actions={{ submit: apply, cancel }} />
          </section>
        </div>

        {issues.length > 0 && (
          <ul className="crt-form__issues crt-panel__issues" role="alert">
            {issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        )}

        <footer className="crt-panel__foot">
          <span className="crt-panel__keys" aria-hidden="true">
            {APPLY_HINT} aplica · Esc cancela
          </span>
          <button type="button" className="crt-btn crt-btn--ghost" onClick={cancel}>
            Cancelar
          </button>
          <button type="button" className="crt-btn crt-btn--primary" onClick={apply}>
            Aplicar
          </button>
        </footer>
      </section>
    </PortalContainerProvider>
  );
});

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { Bold, Italic, List, ListOrdered, Plus, Sigma, Trash2 } from "lucide-react";
import { BLOCK_TYPE_LABELS, type BlockInput } from "@shared/creator";
import { AnswerSpace } from "../blocks/BlockView";
import { insertPart, removePart, resolveDraft, toDraft, type InlineBlock, type InlineBlockType, type InlineDraft } from "./inlineDraft";
import { focusInlineField, InlineText, placeCaret, PlainText, type ActiveField, type EditEntry } from "./InlineText";
import { insertFormula } from "./RichTextEditor";

/** Cómo se cerró el editor: al salir del bloque, o desde el teclado (Escape, Intro), que devuelve el foco al bloque. */
export type CloseReason = "blur" | "keyboard";

/** Lo que la hoja puede pedirle al editor que tiene abierto. */
export interface BlockEditorHandle {
  /** Guarda lo escrito si es válido y cierra. Devuelve `false` si el editor sigue abierto con un aviso. */
  settle: () => boolean;
  focus: () => void;
}

const PARTS_MAX = 8;
const STEPS_MAX = 12;

/* ───────────────────────── Barra flotante ───────────────────────── */

interface Format {
  bold: boolean;
  italic: boolean;
  list: string | null;
}

const NO_FORMAT: Format = { bold: false, italic: false, list: null };

function useFormat(editor: LexicalEditor | null): Format {
  const [format, setFormat] = useState<Format>(NO_FORMAT);
  useEffect(() => {
    if (!editor) {
      setFormat(NO_FORMAT);
      return;
    }
    const read = () =>
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const top = selection.anchor.getNode().getTopLevelElement();
        const next: Format = { bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic"), list: $isListNode(top) ? top.getListType() : null };
        setFormat(current => (current.bold === next.bold && current.italic === next.italic && current.list === next.list ? current : next));
      });
    read();
    return editor.registerUpdateListener(read);
  }, [editor]);
  return format;
}

interface FormatBarProps {
  active: ActiveField | null;
  /** Un título es un solo renglón y ya va en negrita: ni negrita ni listas. */
  heading?: boolean;
  children?: ReactNode;
}

/** La única barra de formato de la hoja: flota sobre el bloque que se edita y actúa sobre el campo con el foco. */
function FormatBar({ active, heading = false, children }: FormatBarProps) {
  const editor = active?.editor ?? null;
  const format = useFormat(editor);
  const lists = Boolean(editor) && !active?.line;
  const anchor = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // El ancla se pega a la altura de la barra: tenga uno o dos renglones, al pegarse queda entera a la vista
  useLayoutEffect(() => {
    const host = anchor.current;
    const element = bar.current;
    if (!host || !element) return;
    const place = () => {
      // Si la hoja tiene algo pegado arriba (el resumen del turno de la IA), la barra queda debajo
      host.style.top = `calc(${element.offsetHeight}px + var(--crt-sticky-top, 0px))`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Los botones no se llevan el foco: el formato cae sobre la selección que el docente tiene en el texto
  const keepFocus = (event: React.MouseEvent) => {
    if (!(event.target as HTMLElement).closest("select, input")) event.preventDefault();
  };

  return (
    <div className="crt-inplace__anchor" ref={anchor}>
      <div className="crt-inplace__bar" ref={bar} role="toolbar" aria-label="Formato del texto" onMouseDown={keepFocus}>
        {!heading && (
          <button type="button" title="Negrita (Ctrl+B)" aria-label="Negrita" aria-pressed={format.bold} disabled={!editor} onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
            <Bold aria-hidden="true" />
          </button>
        )}
        <button type="button" title="Cursiva (Ctrl+I)" aria-label="Cursiva" aria-pressed={format.italic} disabled={!editor} onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
          <Italic aria-hidden="true" />
        </button>
        {!heading && (
          <>
            <button
              type="button"
              title="Lista con viñetas"
              aria-label="Lista con viñetas"
              aria-pressed={format.list === "bullet"}
              disabled={!lists}
              onClick={() => editor?.dispatchCommand(format.list === "bullet" ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined)}
            >
              <List aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Lista numerada"
              aria-label="Lista numerada"
              aria-pressed={format.list === "number"}
              disabled={!lists}
              onClick={() => editor?.dispatchCommand(format.list === "number" ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined)}
            >
              <ListOrdered aria-hidden="true" />
            </button>
          </>
        )}
        <span className="crt-inplace__sep" aria-hidden="true" />
        <button type="button" disabled={!editor} onClick={() => editor && insertFormula(editor)}>
          <Sigma aria-hidden="true" />
          Fórmula
        </button>
        {children}
      </div>
    </div>
  );
}

const Sep = () => <span className="crt-inplace__sep" aria-hidden="true" />;

/* ───────────────────────── Cada tipo de bloque ───────────────────────── */

type Draft<T extends InlineBlockType> = Extract<InlineDraft, { type: T }>;

interface PartProps<T extends InlineBlockType> {
  draft: Draft<T>;
  /** Cambia el borrador. Con `redraw`, el cambio también se ve fuera de los campos de texto. */
  update: (change: (draft: Draft<T>) => Draft<T>, redraw?: boolean) => void;
  active: ActiveField | null;
  setActive: (field: ActiveField | null) => void;
  /** Claves estables de los incisos o pasos, en su orden. */
  keys: number[];
  /** Añade un elemento a la lista (inciso o paso) después de `index` y le lleva el foco. */
  addItem: (index: number) => void;
  removeItem: (index: number) => void;
  focusField: (id: string, entry?: EditEntry) => void;
  /** Guarda y cierra desde el teclado. */
  submit: () => void;
  /** Cierra sin guardar. */
  discard: () => void;
}

function ParagraphContent({ draft, update, setActive, submit, discard }: PartProps<"paragraph">) {
  return <InlineText id="md" main className="crt-rich" label="Texto" placeholder="Escribe aquí…" value={draft.md} onChange={md => update(current => ({ ...current, md }))} onActive={setActive} onSubmit={submit} onEscape={discard} />;
}

function HeadingContent({ draft, update, setActive, submit, discard }: PartProps<"heading">) {
  return (
    <div className={`crt-heading crt-heading--${draft.level}`}>
      <InlineText id="text" main line label="Título" placeholder="Título" value={draft.text} onChange={text => update(current => ({ ...current, text }))} onActive={setActive} onEnter={submit} onSubmit={submit} onEscape={discard} />
    </div>
  );
}

function HeadingTools({ draft, update }: PartProps<"heading">) {
  return (
    <>
      <Sep />
      <div className="crt-inplace__seg" role="group" aria-label="Tamaño del título">
        <button type="button" aria-pressed={draft.level === 2} onClick={() => update(current => ({ ...current, level: 2 }), true)}>
          Grande
        </button>
        <button type="button" aria-pressed={draft.level === 3} onClick={() => update(current => ({ ...current, level: 3 }), true)}>
          Mediano
        </button>
      </div>
    </>
  );
}

function CalloutContent({ draft, update, setActive, focusField, submit, discard }: PartProps<"callout">) {
  return (
    <aside className={`crt-callout crt-callout--${draft.tone}`}>
      {draft.title !== undefined && (
        <PlainText
          id="title"
          as="strong"
          className="crt-callout__title"
          label="Título del recuadro"
          placeholder="Título del recuadro"
          maxLength={120}
          value={draft.title}
          onChange={title => update(current => ({ ...current, title }))}
          onEnter={() => focusField("md")}
          onFocus={() => setActive(null)}
        />
      )}
      <InlineText id="md" main className="crt-rich" label="Contenido del recuadro" placeholder="Escribe aquí…" value={draft.md} onChange={md => update(current => ({ ...current, md }))} onActive={setActive} onSubmit={submit} onEscape={discard} />
    </aside>
  );
}

function CalloutTools({ draft, update, focusField }: PartProps<"callout">) {
  const hasTitle = draft.title !== undefined;
  return (
    <>
      <Sep />
      <label className="crt-inplace__opt">
        Estilo
        <select value={draft.tone} onChange={event => update(current => ({ ...current, tone: event.target.value as Draft<"callout">["tone"] }), true)}>
          <option value="info">Concepto</option>
          <option value="tip">Consejo</option>
          <option value="warning">Atención</option>
        </select>
      </label>
      <button
        type="button"
        aria-pressed={hasTitle}
        title={hasTitle ? "Quitar el título del recuadro" : "Poner un título al recuadro"}
        onClick={() => {
          if (hasTitle) focusField("md");
          update(current => ({ ...current, title: hasTitle ? undefined : "" }), true);
          if (!hasTitle) focusField("title");
        }}
      >
        Título
      </button>
    </>
  );
}

/**
 * Cuánto mide de más un espacio normal que uno en negrita, con la letra de `host`. En la hoja el
 * espacio que sigue al rótulo va en letra normal; aquí va dentro del rótulo, en negrita. Sin esta
 * corrección el enunciado queda corrido una fracción de píxel, lo bastante para partir el renglón en otra palabra.
 */
function spaceGap(host: HTMLElement): number {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
  const widths = [400, 600].map(weight => {
    const span = document.createElement("span");
    span.style.fontWeight = String(weight);
    span.textContent = " ".repeat(20);
    probe.appendChild(span);
    return span;
  });
  host.appendChild(probe);
  const gap = (widths[0].getBoundingClientRect().width - widths[1].getBoundingClientRect().width) / 20;
  probe.remove();
  return Number.isFinite(gap) ? gap : 0;
}

function ExerciseContent({ draft, update, setActive, keys, addItem, removeItem, focusField, submit, discard }: PartProps<"exercise">) {
  const setPart = (index: number, patch: Partial<Draft<"exercise">["parts"][number]>) =>
    update(current => ({ ...current, parts: current.parts.map((part, i) => (i === index ? { ...part, ...patch } : part)) }));
  const host = useRef<HTMLDivElement>(null);
  const [gap, setGap] = useState(0);
  useLayoutEffect(() => {
    if (host.current) setGap(spaceGap(host.current));
  }, []);
  // El rótulo va delante del enunciado, en su mismo renglón, igual que en la hoja
  const labelled = { "--crt-label": JSON.stringify(`${draft.label.trim()}. `), "--crt-label-gap": `${gap}px` } as CSSProperties;

  return (
    <div className="crt-exercise" ref={host}>
      <InlineText id="md" main className="crt-rich crt-exercise__text crt-inplace__labelled" style={labelled} label="Enunciado" value={draft.md} onChange={md => update(current => ({ ...current, md }))} onActive={setActive} onSubmit={submit} onEscape={discard} />
      {draft.parts.length > 0 && (
        <ol className="crt-exercise__parts">
          {draft.parts.map((part, index) => (
            <li key={keys[index]}>
              <span className="crt-exercise__part-label">
                <PlainText id={`letter-${keys[index]}`} placeholder="a" label={`Letra del inciso ${index + 1}`} maxLength={8} value={part.label} onChange={label => setPart(index, { label })} onEnter={() => focusField(`part-${keys[index]}`)} onFocus={() => setActive(null)} />.
              </span>
              <InlineText
                id={`part-${keys[index]}`}
                line
                label={`Inciso ${part.label}`}
                placeholder="Escribe el inciso…"
                value={part.md}
                onChange={md => setPart(index, { md })}
                onActive={setActive}
                onEnter={() => addItem(index)}
                onSubmit={submit} onEscape={discard}
                onBackspaceEmpty={() => removeItem(index)}
              />
            </li>
          ))}
        </ol>
      )}
      <AnswerSpace kind={draft.answerSpace} lines={Number.isFinite(draft.lines) ? Math.min(Math.max(Math.round(draft.lines), 1), 14) : 1} />
    </div>
  );
}

function ExerciseTools({ draft, update, active, keys, addItem, removeItem }: PartProps<"exercise">) {
  const activePart = active ? keys.findIndex(key => active.id === `part-${key}`) : -1;
  return (
    <>
      <Sep />
      <label className="crt-inplace__opt" title="Rótulo del ejercicio">
        <input type="text" aria-label="Rótulo del ejercicio" placeholder="Rótulo" maxLength={60} value={draft.label} onChange={event => update(current => ({ ...current, label: event.target.value }), true)} />
      </label>
      <label className="crt-inplace__opt">
        Respuesta
        <select value={draft.answerSpace} onChange={event => update(current => ({ ...current, answerSpace: event.target.value as Draft<"exercise">["answerSpace"] }), true)}>
          <option value="lines">Renglones</option>
          <option value="grid">Cuadrícula</option>
          <option value="blank">En blanco</option>
          <option value="none">Ninguno</option>
        </select>
      </label>
      {draft.answerSpace !== "none" && (
        <label className="crt-inplace__opt">
          Alto
          <input
            type="number"
            min={1}
            max={14}
            aria-label="Alto del espacio de respuesta, en renglones"
            value={Number.isFinite(draft.lines) ? draft.lines : ""}
            onChange={event => update(current => ({ ...current, lines: event.target.valueAsNumber }), true)}
          />
        </label>
      )}
      <Sep />
      <button type="button" disabled={draft.parts.length >= PARTS_MAX} title="Añadir un inciso (Intro dentro de un inciso)" onClick={() => addItem(activePart === -1 ? draft.parts.length - 1 : activePart)}>
        <Plus aria-hidden="true" />
        Inciso
      </button>
      <button type="button" className="is-danger" disabled={activePart === -1} title="Quitar el inciso en el que está el cursor" aria-label="Quitar este inciso" onClick={() => removeItem(activePart)}>
        <Trash2 aria-hidden="true" />
      </button>
    </>
  );
}

function SolutionContent({ draft, update, setActive, keys, removeItem, focusField, submit, discard }: PartProps<"solution">) {
  return (
    <div className="crt-solution">
      <strong className="crt-solution__label">
        <PlainText
          id="label"
          label="Ejercicio al que responde"
          placeholder="Ejercicio"
          maxLength={60}
          value={draft.label}
          onChange={label => update(current => ({ ...current, label }))}
          onEnter={() => focusField(keys.length > 0 ? `step-${keys[0]}` : "answer")}
          onFocus={() => setActive(null)}
        />
        .
      </strong>
      {draft.steps.length > 0 && (
        <ol className="crt-solution__steps">
          {draft.steps.map((step, index) => (
            <li key={keys[index]}>
              <InlineText
                id={`step-${keys[index]}`}
                main={index === 0}
                className="crt-rich"
                label={`Paso ${index + 1}`}
                placeholder="Escribe el paso…"
                value={step}
                onChange={md => update(current => ({ ...current, steps: current.steps.map((value, i) => (i === index ? md : value)) }))}
                onActive={setActive}
                onSubmit={submit} onEscape={discard}
                onBackspaceEmpty={() => removeItem(index)}
              />
            </li>
          ))}
        </ol>
      )}
      {draft.answer !== undefined && (
        <div className="crt-solution__answer">
          <span>Respuesta</span>
          <InlineText
            id="answer"
            main={draft.steps.length === 0}
            className="crt-rich"
            label="Respuesta final"
            placeholder="Respuesta final"
            value={draft.answer}
            onChange={answer => update(current => ({ ...current, answer }))}
            onActive={setActive}
            onSubmit={submit} onEscape={discard}
          />
        </div>
      )}
    </div>
  );
}

function SolutionTools({ draft, update, active, keys, addItem, removeItem, focusField }: PartProps<"solution">) {
  const activeStep = active ? keys.findIndex(key => active.id === `step-${key}`) : -1;
  const hasAnswer = draft.answer !== undefined;
  return (
    <>
      <Sep />
      <button type="button" disabled={draft.steps.length >= STEPS_MAX} title="Añadir un paso al procedimiento" onClick={() => addItem(activeStep === -1 ? draft.steps.length - 1 : activeStep)}>
        <Plus aria-hidden="true" />
        Paso
      </button>
      <button type="button" className="is-danger" disabled={activeStep === -1 || draft.steps.length <= 1} title="Quitar el paso en el que está el cursor" aria-label="Quitar este paso" onClick={() => removeItem(activeStep)}>
        <Trash2 aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={hasAnswer}
        title={hasAnswer ? "Quitar la respuesta final" : "Añadir la respuesta final"}
        onClick={() => {
          if (hasAnswer) focusField(keys.length > 0 ? `step-${keys[0]}` : "label");
          update(current => ({ ...current, answer: hasAnswer ? undefined : "" }), true);
          if (!hasAnswer) focusField("answer");
        }}
      >
        Respuesta final
      </button>
    </>
  );
}

/* ───────────────────────── Editor ───────────────────────── */

interface InlineBlockEditorProps {
  block: InlineBlock;
  /** Dónde poner el cursor al abrir. */
  entry: EditEntry;
  onCommit: (next: BlockInput) => void;
  onClose: (reason: CloseReason) => void;
  /** Acciones de la hoja que van al final de la barra (señalar el bloque en el chat). */
  barEnd?: ReactNode;
}

const listOf = (draft: InlineDraft): unknown[] => (draft.type === "exercise" ? draft.parts : draft.type === "solution" ? draft.steps : []);

/**
 * Edición de un bloque de texto en su sitio. Dibuja el mismo marcado que la vista, así que el
 * bloque no cambia de tamaño al entrar. No hay Guardar ni Cancelar: lo escrito se confirma al
 * salir del bloque, Escape lo descarta, y lo que no valida deja el editor abierto con su aviso.
 */
export const InlineBlockEditor = forwardRef<BlockEditorHandle, InlineBlockEditorProps>(function InlineBlockEditor({ block, entry, onCommit, onClose, barEnd }, ref) {
  const wrapper = useRef<HTMLDivElement>(null);
  const original = useRef(block);
  original.current = block;
  // Lo escrito vive en una referencia: teclear no vuelve a dibujar el bloque
  const draftRef = useRef<InlineDraft>(toDraft(block));
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const [issues, setIssues] = useState<string[]>([]);
  const [active, setActive] = useState<ActiveField | null>(null);
  const closed = useRef(false);
  const keys = useRef<number[]>(listOf(draftRef.current).map((_, index) => index));
  const nextKey = useRef(keys.current.length);
  const pendingFocus = useRef<{ id: string; entry: EditEntry } | null>(null);

  const update = useCallback((change: (draft: InlineDraft) => InlineDraft, shouldRedraw = false) => {
    draftRef.current = change(draftRef.current);
    setIssues(current => (current.length > 0 ? [] : current));
    if (shouldRedraw) redraw();
  }, []);

  const finish = useCallback(
    (close: boolean, reason: CloseReason = "blur"): boolean => {
      if (closed.current) return true;
      const outcome = resolveDraft(original.current, draftRef.current);
      if (outcome.status === "invalid") {
        setIssues(outcome.issues);
        return false;
      }
      if (outcome.status === "ok") onCommit(outcome.block);
      if (close) {
        closed.current = true;
        onClose(reason);
      }
      return true;
    },
    [onClose, onCommit],
  );

  const discard = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose("keyboard");
  }, [onClose]);

  const submit = useCallback(() => void finish(true, "keyboard"), [finish]);

  /** Lleva el foco a un campo. Si aún no existe (se acaba de añadir), espera a que se dibuje. */
  const focusField = useCallback((id: string, at: EditEntry = "end") => {
    const field = wrapper.current?.querySelector<HTMLElement>(`[data-inline-field="${id}"]`);
    if (field) focusInlineField(field, at);
    else pendingFocus.current = { id, entry: at };
  }, []);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const field = wrapper.current?.querySelector<HTMLElement>(`[data-inline-field="${pending.id}"]`);
    if (field) focusInlineField(field, pending.entry);
  });

  const addItem = useCallback(
    (index: number) => {
      const draft = draftRef.current;
      const key = nextKey.current++;
      if (draft.type === "exercise") {
        if (draft.parts.length >= PARTS_MAX) return;
        keys.current.splice(index + 1, 0, key);
        update(current => (current.type === "exercise" ? { ...current, parts: insertPart(current.parts, index) } : current), true);
        focusField(`part-${key}`);
      } else if (draft.type === "solution") {
        if (draft.steps.length >= STEPS_MAX) return;
        keys.current.splice(index + 1, 0, key);
        update(current => (current.type === "solution" ? { ...current, steps: [...current.steps.slice(0, index + 1), "", ...current.steps.slice(index + 1)] } : current), true);
        focusField(`step-${key}`);
      }
    },
    [focusField, update],
  );

  const removeItem = useCallback(
    (index: number) => {
      const draft = draftRef.current;
      if (draft.type !== "exercise" && draft.type !== "solution") return;
      const prefix = draft.type === "exercise" ? "part" : "step";
      // El foco pasa al campo vecino antes de quitar este: así el bloque no se queda sin foco y no se cierra
      const neighbour = keys.current[index - 1] ?? keys.current[index + 1];
      focusField(neighbour !== undefined ? `${prefix}-${neighbour}` : draft.type === "exercise" ? "md" : "label");
      keys.current.splice(index, 1);
      update(current => {
        if (current.type === "exercise") return { ...current, parts: removePart(current.parts, index) };
        if (current.type === "solution") return { ...current, steps: current.steps.filter((_, i) => i !== index) };
        return current;
      }, true);
    },
    [focusField, update],
  );

  useImperativeHandle(
    ref,
    () => ({
      settle: () => finish(true),
      focus: () => {
        const field = wrapper.current?.querySelector<HTMLElement>("[data-inline-main]") ?? wrapper.current?.querySelector<HTMLElement>("[data-inline-field]");
        if (field) focusInlineField(field, "end");
      },
    }),
    [finish],
  );

  // Al abrir: un cuadro después, cuando las fórmulas ya están dibujadas y el texto ocupa su sitio
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (wrapper.current) placeCaret(wrapper.current, entry);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  const draft = draftRef.current;
  // Cada tipo recibe las mismas piezas; el borrador ya viene acotado a su tipo por el `switch`
  const shared = { active, setActive, keys: keys.current, addItem, removeItem, focusField, submit, discard };
  let content: ReactNode;
  let tools: ReactNode = null;
  switch (draft.type) {
    case "paragraph": {
      const props = { ...shared, draft, update: update as PartProps<"paragraph">["update"] };
      content = <ParagraphContent {...props} />;
      break;
    }
    case "heading": {
      const props = { ...shared, draft, update: update as PartProps<"heading">["update"] };
      content = <HeadingContent {...props} />;
      tools = <HeadingTools {...props} />;
      break;
    }
    case "callout": {
      const props = { ...shared, draft, update: update as PartProps<"callout">["update"] };
      content = <CalloutContent {...props} />;
      tools = <CalloutTools {...props} />;
      break;
    }
    case "exercise": {
      const props = { ...shared, draft, update: update as PartProps<"exercise">["update"] };
      content = <ExerciseContent {...props} />;
      tools = <ExerciseTools {...props} />;
      break;
    }
    case "solution": {
      const props = { ...shared, draft, update: update as PartProps<"solution">["update"] };
      content = <SolutionContent {...props} />;
      tools = <SolutionTools {...props} />;
      break;
    }
  }

  return (
    <div
      ref={wrapper}
      className={`crt-inplace crt-inplace--${block.type}`}
      role="group"
      aria-label={`Editar ${BLOCK_TYPE_LABELS[block.type].toLowerCase()}`}
      onBlur={event => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        // Cambiar de ventana guarda lo escrito pero no cierra: al volver, el cursor sigue en su sitio
        void finish(document.hasFocus());
      }}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        discard();
      }}
      onMouseDown={event => {
        // Un clic en el borde del bloque o entre dos campos no debe sacar el foco (y cerrar el editor)
        if (!(event.target as HTMLElement).closest("[contenteditable]:not([contenteditable='false']), input, textarea, select, button, [role='button'], [role='dialog']")) event.preventDefault();
      }}
    >
      <FormatBar active={active} heading={block.type === "heading"}>
        {tools}
        {barEnd && (
          <>
            <Sep />
            {barEnd}
          </>
        )}
      </FormatBar>
      {content}
      {issues.length > 0 && (
        <div className="crt-inplace__issues" role="alert">
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          <p>
            Corrígelo para guardar el cambio, o{" "}
            <button type="button" className="crt-inplace__discard" onClick={discard}>
              descarta lo escrito
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
});

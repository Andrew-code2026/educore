import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer, type InitialConfigType } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  DecoratorNode,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { Bold, Italic, List, ListOrdered, Sigma } from "lucide-react";
import { Formula } from "../blocks/Formula";
import { FormulaInput } from "./FormulaInput";
import { isKeyboardSurface } from "./mathField";
import { parseMd, serializeMd, type Inline, type MdBlock } from "./mdModel";

/* ───────────────────────── Nodo de fórmula ───────────────────────── */

type SerializedFormulaNode = Spread<{ latex: string; display: boolean }, SerializedLexicalNode>;

/**
 * Verdadero dentro del editor en sitio: la fórmula se dibuja igual que en la hoja (sin ficha,
 * y la destacada en su propia línea) para que el texto no cambie de forma al editarlo.
 */
export const InPlaceContext = createContext(false);

/** Fórmulas recién insertadas desde la barra: abren su editor al aparecer. */
const openOnMount = new Set<NodeKey>();

/** Una fórmula dentro del texto: se ve dibujada y se edita como una sola pieza. */
export class FormulaNode extends DecoratorNode<ReactNode> {
  __latex: string;
  __display: boolean;

  static getType(): string {
    return "crt-formula";
  }

  static clone(node: FormulaNode): FormulaNode {
    return new FormulaNode(node.__latex, node.__display, node.__key);
  }

  static importJSON(serialized: SerializedFormulaNode): FormulaNode {
    return new FormulaNode(serialized.latex, serialized.display);
  }

  constructor(latex: string, display = false, key?: NodeKey) {
    super(key);
    this.__latex = latex;
    this.__display = display;
  }

  exportJSON(): SerializedFormulaNode {
    return { ...super.exportJSON(), type: "crt-formula", version: 1, latex: this.__latex, display: this.__display };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = this.__display ? "crt-rte__formula crt-rte__formula--display" : "crt-rte__formula";
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  getTextContent(): string {
    return this.__display ? `$$${this.__latex}$$` : `$${this.__latex}$`;
  }

  getLatex(): string {
    return this.getLatest().__latex;
  }

  isDisplay(): boolean {
    return this.getLatest().__display;
  }

  setLatex(latex: string): void {
    this.getWritable().__latex = latex;
  }

  decorate(): ReactNode {
    return <FormulaChip nodeKey={this.__key} latex={this.__latex} display={this.__display} />;
  }
}

const $isFormulaNode = (node: LexicalNode | null | undefined): node is FormulaNode => node instanceof FormulaNode;

function FormulaChip({ nodeKey, latex, display }: { nodeKey: NodeKey; latex: string; display: boolean }) {
  const [editor] = useLexicalComposerContext();
  const inPlace = useContext(InPlaceContext);
  const [open, setOpen] = useState(() => openOnMount.delete(nodeKey));
  const [draft, setDraft] = useState(latex);
  const containerRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) setDraft(latex);
  }, [latex, open]);

  /**
   * Cierra el cuadro y deja la fórmula con `next`. Desde el teclado (Intro, Escape) el cursor vuelve
   * al texto, justo después de la fórmula; con un clic fuera, el foco es de lo que se pulsó.
   */
  const close = useCallback(
    (next: string, refocus: boolean) => {
      // El foco vuelve al texto antes de quitar el cuadro: el bloque no llega a quedarse sin foco,
      // y con el foco ya fuera del cuadro el editor acepta colocar el cursor
      if (refocus) editor.getRootElement()?.focus({ preventScroll: true });
      editor.update(
        () => {
          const node = $getNodeByKey(nodeKey);
          if (!$isFormulaNode(node)) return;
          const value = next.trim();
          // Una fórmula vacía no deja rastro en el texto
          if (value === "") {
            const parent = node.getParent();
            const index = node.getIndexWithinParent();
            node.remove();
            if (refocus) parent?.select(index, index);
            return;
          }
          if (value !== node.getLatex()) node.setLatex(value);
          if (refocus) node.selectNext(0, 0);
        },
        { discrete: true },
      );
      setOpen(false);
    },
    [editor, nodeKey],
  );

  const commit = useCallback(() => close(draft, true), [close, draft]);
  // Escape deja la fórmula como estaba
  const cancel = useCallback(() => close(latex, true), [close, latex]);

  // El cuadro se abre bajo la fórmula y se corre lo justo para no salirse del editor
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!open) return;
    const chip = containerRef.current;
    const host = chip?.closest(".crt-rte, .crt-inplace");
    const popover = popoverRef.current;
    if (!chip || !host || !popover) return;
    const bounds = host.getBoundingClientRect();
    const left = chip.getBoundingClientRect().left;
    setShift(Math.round(Math.max(bounds.left - left, Math.min(0, bounds.right - left - popover.offsetWidth))));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      // Las variantes de una tecla del teclado en pantalla se dibujan fuera del cuadro
      if (containerRef.current?.contains(target) || isKeyboardSurface(target)) return;
      close(draft, false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, draft, open]);

  // Con el foco en la fórmula, Intro o Espacio abren su cuadro. El editor de texto escucha el teclado
  // en su raíz, antes que React: la tecla se detiene aquí para que no parta el párrafo.
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== chip || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    chip.addEventListener("keydown", onKeyDown);
    return () => chip.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <span ref={containerRef} className="crt-rte__chip-wrap">
      {/* Un <span> y no un <button>: en el editor en sitio la fórmula fluye con el renglón, como en la hoja */}
      <span ref={chipRef} role="button" tabIndex={0} className="crt-rte__chip" aria-label={`Editar fórmula ${latex}`} onClick={() => setOpen(true)}>
        {latex ? <Formula latex={latex} display={inPlace && display} /> : <span className="crt-rte__chip-empty">fórmula</span>}
      </span>
      {open && (
        <span ref={popoverRef} className="crt-rte__popover crt-mf-popover" style={{ left: shift }} role="dialog" aria-label="Editar fórmula">
          <FormulaInput value={latex} onChange={setDraft} onEnter={commit} onEscape={cancel} autoFocus preview />
        </span>
      )}
    </span>
  );
}

/* ───────────────────────── Markdown ↔ editor ───────────────────────── */

function appendInlines(parent: ElementNode, inlines: Inline[]) {
  for (const inline of inlines) {
    if (inline.t === "formula") {
      parent.append(new FormulaNode(inline.latex, Boolean(inline.display)));
      continue;
    }
    const node = $createTextNode(inline.text);
    if (inline.bold) node.toggleFormat("bold");
    if (inline.italic) node.toggleFormat("italic");
    parent.append(node);
  }
}

export function $loadMd(blocks: MdBlock[]) {
  const root = $getRoot();
  root.clear();
  for (const block of blocks) {
    if (block.t === "p") {
      const paragraph = $createParagraphNode();
      appendInlines(paragraph, block.inlines);
      root.append(paragraph);
      continue;
    }
    const list = $createListNode(block.t === "ol" ? "number" : "bullet");
    for (const item of block.items) {
      const listItem = $createListItemNode();
      appendInlines(listItem, item);
      list.append(listItem);
    }
    root.append(list);
  }
  if (root.getChildrenSize() === 0) root.append($createParagraphNode());
}

function $inlines(node: ElementNode): Inline[] {
  const out: Inline[] = [];
  for (const child of node.getChildren()) {
    if ($isFormulaNode(child)) {
      out.push({ t: "formula", latex: child.getLatex(), ...(child.isDisplay() ? { display: true } : {}) });
    } else if ($isTextNode(child)) {
      out.push({
        t: "text",
        text: child.getTextContent(),
        ...(child.hasFormat("bold") ? { bold: true } : {}),
        ...(child.hasFormat("italic") ? { italic: true } : {}),
      });
    } else if ($isLineBreakNode(child)) {
      out.push({ t: "text", text: " " });
    } else if ($isElementNode(child)) {
      out.push(...$inlines(child));
    }
  }
  return out;
}

export function $readMd(): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const node of $getRoot().getChildren()) {
    if ($isListNode(node)) {
      const items = node.getChildren().filter($isListItemNode).map(item => $inlines(item));
      blocks.push({ t: node.getListType() === "number" ? "ol" : "ul", items });
    } else if ($isElementNode(node)) {
      blocks.push({ t: "p", inlines: $inlines(node) });
    }
  }
  return blocks;
}

/* ───────────────────────── Barra de formato ───────────────────────── */

/** Inserta una fórmula vacía donde está el cursor y abre su cuadro para escribirla. */
export function insertFormula(editor: LexicalEditor) {
  editor.update(() => {
    const node = new FormulaNode("");
    openOnMount.add(node.getKey());
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      $insertNodes([node]);
      return;
    }
    const last = $getRoot().getLastChild();
    if ($isElementNode(last)) last.append(node);
  });
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();

  // onMouseDown sin perder el foco: el formato se aplica sobre la selección actual
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div className="crt-rte__toolbar" role="toolbar" aria-label="Formato del texto">
      <button type="button" title="Negrita" aria-label="Negrita" onMouseDown={keepFocus} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
        <Bold aria-hidden="true" />
      </button>
      <button type="button" title="Cursiva" aria-label="Cursiva" onMouseDown={keepFocus} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
        <Italic aria-hidden="true" />
      </button>
      <button type="button" title="Lista con viñetas" aria-label="Lista con viñetas" onMouseDown={keepFocus} onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
        <List aria-hidden="true" />
      </button>
      <button type="button" title="Lista numerada" aria-label="Lista numerada" onMouseDown={keepFocus} onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
        <ListOrdered aria-hidden="true" />
      </button>
      <span className="crt-rte__sep" aria-hidden="true" />
      <button type="button" className="crt-rte__formula-btn" onMouseDown={keepFocus} onClick={() => insertFormula(editor)}>
        <Sigma aria-hidden="true" />
        Fórmula
      </button>
    </div>
  );
}

/* ───────────────────────── Editor ───────────────────────── */

interface RichTextEditorProps {
  /** Markdown inicial. El editor no se vuelve a cargar si cambia: móntalo con una `key` distinta. */
  value: string;
  onChange: (md: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Campos cortos (incisos, pasos): menos alto. */
  compact?: boolean;
}

const THEME = {
  paragraph: "crt-rte__p",
  text: { bold: "crt-rte__bold", italic: "crt-rte__italic" },
  list: { ul: "crt-rte__ul", ol: "crt-rte__ol", listitem: "crt-rte__li" },
};

/** Editor visual de texto con fórmulas. Guarda Markdown; el docente ve el resultado final mientras escribe. */
export function RichTextEditor({ value, onChange, label, placeholder, autoFocus, compact }: RichTextEditorProps) {
  const initial = useRef(value);
  const config = useMemo<InitialConfigType>(
    () => ({
      namespace: "educore-creator",
      theme: THEME,
      nodes: [ListNode, ListItemNode, FormulaNode],
      editorState: () => $loadMd(parseMd(initial.current)),
      onError: error => console.error("[Creator] Error del editor de texto:", error),
    }),
    [],
  );

  const handleChange = useCallback((state: EditorState) => state.read(() => onChange(serializeMd($readMd()))), [onChange]);

  return (
    <LexicalComposer initialConfig={config}>
      <div className={compact ? "crt-rte crt-rte--compact" : "crt-rte"}>
        <Toolbar />
        <div className="crt-rte__body">
          <RichTextPlugin
            contentEditable={<ContentEditable className="crt-rte__content crt-rich" aria-label={label} />}
            placeholder={<div className="crt-rte__placeholder">{placeholder ?? "Escribe aquí…"}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        {autoFocus && <AutoFocusPlugin />}
      </div>
    </LexicalComposer>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { Bold, Italic, List, ListOrdered, Sigma } from "lucide-react";
import { checkLatex } from "@shared/creatorValidate";
import { Formula } from "../blocks/Formula";
import { parseMd, serializeMd, type Inline, type MdBlock } from "./mdModel";

/* ───────────────────────── Nodo de fórmula ───────────────────────── */

type SerializedFormulaNode = Spread<{ latex: string; display: boolean }, SerializedLexicalNode>;

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
    element.className = "crt-rte__formula";
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
    return <FormulaChip nodeKey={this.__key} latex={this.__latex} />;
  }
}

const $isFormulaNode = (node: LexicalNode | null | undefined): node is FormulaNode => node instanceof FormulaNode;

function FormulaChip({ nodeKey, latex }: { nodeKey: NodeKey; latex: string }) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(() => openOnMount.delete(nodeKey));
  const [draft, setDraft] = useState(latex);
  const containerRef = useRef<HTMLSpanElement>(null);
  const error = draft.trim() ? checkLatex(draft) : null;

  useEffect(() => {
    if (!open) setDraft(latex);
  }, [latex, open]);

  const commit = useCallback(() => {
    setOpen(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isFormulaNode(node)) return;
      // Una fórmula vacía no deja rastro en el texto
      if (draft.trim() === "") node.remove();
      else node.setLatex(draft.trim());
    });
  }, [draft, editor, nodeKey]);

  // Cerca del borde derecho del editor, el cuadro se abre hacia la izquierda para no salirse de la hoja
  const [alignRight, setAlignRight] = useState(false);
  useEffect(() => {
    if (!open) return;
    const chip = containerRef.current;
    const host = chip?.closest(".crt-rte");
    if (chip && host) setAlignRight(host.getBoundingClientRect().right - chip.getBoundingClientRect().left < 348);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) commit();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [commit, open]);

  return (
    <span ref={containerRef} className="crt-rte__chip-wrap">
      <button type="button" className="crt-rte__chip" aria-label={`Editar fórmula ${latex}`} onClick={() => setOpen(true)}>
        {latex ? <Formula latex={latex} /> : <span className="crt-rte__chip-empty">fórmula</span>}
      </button>
      {open && (
        <span className={alignRight ? "crt-rte__popover crt-rte__popover--right" : "crt-rte__popover"} role="dialog" aria-label="Editar fórmula">
          <label className="crt-rte__popover-label" htmlFor={`formula-${nodeKey}`}>
            Fórmula en LaTeX
          </label>
          <input
            id={`formula-${nodeKey}`}
            autoFocus
            className="crt-input"
            value={draft}
            spellCheck={false}
            placeholder="x = \frac{-b}{2a}"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              // El editor de texto no debe recibir estas teclas
              event.stopPropagation();
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                commit();
              }
            }}
          />
          <span className="crt-rte__popover-preview" aria-live="polite">
            {error ? <span className="crt-rte__popover-error">{error}</span> : draft.trim() ? <Formula latex={draft} /> : <span className="crt-muted">Vista previa</span>}
          </span>
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

function $load(blocks: MdBlock[]) {
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

function $read(): MdBlock[] {
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

function Toolbar() {
  const [editor] = useLexicalComposerContext();

  const insertFormula = () => {
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
  };

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
      <button type="button" className="crt-rte__formula-btn" onMouseDown={keepFocus} onClick={insertFormula}>
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
      editorState: () => $load(parseMd(initial.current)),
      onError: error => console.error("[Creator] Error del editor de texto:", error),
    }),
    [],
  );

  const handleChange = useCallback((state: EditorState) => state.read(() => onChange(serializeMd($read()))), [onChange]);

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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { LexicalComposer, type InitialConfigType } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR, ORDERED_LIST, registerMarkdownShortcuts, UNORDERED_LIST, type Transformer } from "@lexical/markdown";
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  $getSelection,
  $selectAll,
  COMMAND_PRIORITY_HIGH,
  getNearestEditorFromDOMNode,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { cn } from "@/lib/utils";
import { collapseSpaces, inPlaceBlocks, parseMd, serializeMd, serializeSingleLine } from "./mdModel";
import { headingShortcut } from "../structure";
import { $loadMd, $readMd, FormulaNode, InPlaceContext } from "./RichTextEditor";

/** Dónde queda el cursor al abrir un campo: al final, con todo seleccionado o donde se hizo clic. */
export type EditEntry = "end" | "all" | { x: number; y: number };

/** El campo de texto con formato que tiene el foco: la barra flotante actúa sobre él. */
export interface ActiveField {
  id: string;
  editor: LexicalEditor;
  /** Campo de un solo renglón: no admite listas. */
  line: boolean;
}

const THEME = { text: { bold: "crt-rte__bold", italic: "crt-rte__italic" } };

interface KeysProps {
  line: boolean;
  onEnter?: () => void;
  onSubmit?: () => void;
  onEscape?: () => void;
  onBackspaceEmpty?: () => void;
}

function KeysPlugin({ line, onEnter, onSubmit, onEscape, onBackspaceEmpty }: KeysProps) {
  const [editor] = useLexicalComposerContext();
  const handlers = useRef({ onEnter, onSubmit, onEscape, onBackspaceEmpty });
  handlers.current = { onEnter, onSubmit, onEscape, onBackspaceEmpty };

  useEffect(() => {
    const offEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      event => {
        const submit = Boolean(event && (event.ctrlKey || event.metaKey));
        if (!submit && !line) return false;
        event?.preventDefault();
        if (submit) handlers.current.onSubmit?.();
        else handlers.current.onEnter?.();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    const offBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      event => {
        const remove = handlers.current.onBackspaceEmpty;
        if (!remove || $getRoot().getTextContentSize() > 0) return false;
        event.preventDefault();
        remove();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    // Por defecto el editor suelta el foco con Escape, y soltar el foco aquí significa guardar: se ataja antes.
    // Dentro del cuadro de una fórmula, Escape es del cuadro.
    const offEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      event => {
        const escape = handlers.current.onEscape;
        if (!escape || (event.target instanceof Element && event.target.closest("[data-lexical-decorator]"))) return false;
        event.preventDefault();
        escape();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    return () => {
      offEnter();
      offBackspace();
      offEscape();
    };
  }, [editor, line]);

  return null;
}

/**
 * Atajos al escribir, dentro de lo que guarda el modelo de texto: «- » y «1. » empiezan una lista,
 * «**…**» y «*…*» dan negrita y cursiva. Un campo de un renglón no admite listas; un título ya va en negrita.
 */
export type ShortcutSet = "rich" | "line" | "heading";

/** Solo «1. » empieza una lista numerada: la hoja numera desde 1 y «3. » mostraría otro número al editar que al guardar. */
const ORDERED_FROM_ONE: Transformer = { ...ORDERED_LIST, regExp: /^(\s*)(1)\.\s/ };

const SHORTCUTS: Record<ShortcutSet, Transformer[]> = {
  rich: [UNORDERED_LIST, ORDERED_FROM_ONE, BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR],
  line: [BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR],
  heading: [ITALIC_STAR],
};

function MarkdownPlugin({ set }: { set: ShortcutSet }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerMarkdownShortcuts(editor, SHORTCUTS[set]), [editor, set]);
  return null;
}

/** Atajos que cambian el bloque entero. Solo los tiene el párrafo. */
export interface BlockShortcuts {
  /** El texto quedó en «/» (estaba vacío, o todo seleccionado): se abre el menú de bloques. */
  onSlash?: () => void;
  /** «## » al inicio de un párrafo único: el bloque pasa a ser título. `rest` es lo que sigue, en Markdown. */
  onHeading?: (level: 2 | 3, rest: string) => void;
}

function BlockShortcutsPlugin({ onSlash, onHeading }: BlockShortcuts) {
  const [editor] = useLexicalComposerContext();
  const handlers = useRef({ onSlash, onHeading });
  handlers.current = { onSlash, onHeading };

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, tags, dirtyLeaves }) => {
        // Solo lo que escribe el docente: ni deshacer ni la carga inicial
        if (tags.has("historic") || dirtyLeaves.size === 0) return;
        const found = editorState.read(() => {
          const root = $getRoot();
          const text = root.getTextContent();
          if (text === "/" && handlers.current.onSlash) return { kind: "slash" as const };
          const paragraph = root.getFirstChild();
          if (!handlers.current.onHeading || root.getChildrenSize() !== 1 || !$isParagraphNode(paragraph)) return null;
          const shortcut = headingShortcut(text);
          const selection = $getSelection();
          const first = paragraph.getFirstChild();
          // Justo tras el espacio que se acaba de escribir: un «## » pegado o escrito en medio no cuenta
          if (!shortcut || !$isRangeSelection(selection) || !selection.isCollapsed() || !$isTextNode(first)) return null;
          const marker = text.length - shortcut.rest.length;
          if (selection.anchor.getNode() !== first || selection.anchor.offset !== marker) return null;
          const md = serializeSingleLine(collapseSpaces($readMd()));
          const rest = headingShortcut(md)?.rest ?? shortcut.rest;
          return { kind: "heading" as const, level: shortcut.level, rest };
        });
        if (!found) return;
        if (found.kind === "slash") {
          // La barra no se queda en el texto: el menú tiene su propio buscador. Se abre cuando el editor
          // ya dejó el cursor en su sitio; si no, el cursor le quitaría el foco al buscador y lo cerraría
          editor.update(
            () => {
              const root = $getRoot();
              root.clear();
              root.append($createParagraphNode());
              root.selectEnd();
            },
            { onUpdate: () => handlers.current.onSlash?.() },
          );
        } else {
          handlers.current.onHeading?.(found.level, found.rest);
        }
      }),
    [editor],
  );
  return null;
}

interface SurfaceProps {
  id: string;
  main: boolean;
  label: string;
  line: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  onActive: (field: ActiveField) => void;
}

function Surface({ id, main, label, line, className, style, placeholder, onActive }: SurfaceProps) {
  const [editor] = useLexicalComposerContext();
  return (
    <RichTextPlugin
      contentEditable={
        <ContentEditable
          className={cn("crt-inplace__field", className)}
          style={style}
          aria-label={label}
          aria-multiline={!line}
          data-inline-field={id}
          data-inline-main={main ? "" : undefined}
          data-placeholder={placeholder}
          onFocus={() => onActive({ id, editor, line })}
        />
      }
      ErrorBoundary={LexicalErrorBoundary}
    />
  );
}

interface InlineTextProps extends Omit<KeysProps, "line">, BlockShortcuts {
  /** Nombre del campo dentro del bloque: sirve para llevarle el foco. */
  id: string;
  /** El campo que recibe el cursor cuando no se sabe dónde se hizo clic. */
  main?: boolean;
  /** Markdown inicial. El campo no se vuelve a cargar si cambia: móntalo con una `key` distinta. */
  value: string;
  onChange: (md: string) => void;
  label: string;
  line?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  onActive: (field: ActiveField) => void;
  /** Qué atajos de Markdown admite. Por omisión, los de un texto o los de un renglón según `line`. */
  shortcuts?: ShortcutSet;
}

/**
 * Un texto de la hoja vuelto editable en su sitio: mismas clases y mismo marcado que la vista,
 * sin marco ni barra propia. La barra de formato es una sola y la pone el bloque.
 */
export function InlineText({
  id,
  main = false,
  value,
  onChange,
  label,
  line = false,
  className,
  style,
  placeholder,
  onActive,
  onEnter,
  onSubmit,
  onEscape,
  onBackspaceEmpty,
  shortcuts,
  onSlash,
  onHeading,
}: InlineTextProps) {
  const initial = useRef(value);
  const config = useMemo<InitialConfigType>(
    () => ({
      namespace: "educore-creator-inplace",
      theme: THEME,
      nodes: [ListNode, ListItemNode, FormulaNode],
      editorState: () => $loadMd(line ? collapseSpaces(parseMd(initial.current)) : inPlaceBlocks(parseMd(initial.current))),
      onError: error => console.error("[Creator] Error del editor de texto:", error),
    }),
    [line],
  );

  const changed = useRef(onChange);
  changed.current = onChange;
  const handleChange = useCallback((state: EditorState) => state.read(() => changed.current(line ? serializeSingleLine(collapseSpaces($readMd())) : serializeMd(collapseSpaces($readMd())))), [line]);

  return (
    <InPlaceContext.Provider value>
      <LexicalComposer initialConfig={config}>
        <Surface id={id} main={main} label={label} line={line} className={className} style={style} placeholder={placeholder} onActive={onActive} />
        <HistoryPlugin />
        {!line && <ListPlugin />}
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <KeysPlugin line={line} onEnter={onEnter} onSubmit={onSubmit} onEscape={onEscape} onBackspaceEmpty={onBackspaceEmpty} />
        <MarkdownPlugin set={shortcuts ?? (line ? "line" : "rich")} />
        {(onSlash || onHeading) && <BlockShortcutsPlugin onSlash={onSlash} onHeading={onHeading} />}
      </LexicalComposer>
    </InPlaceContext.Provider>
  );
}

/* ───────────────────────── Texto llano (títulos y rótulos) ───────────────────────── */

/** `contenteditable="plaintext-only"` no existe en todos los navegadores; sin él se limpia lo pegado a mano. */
export const PLAINTEXT_ONLY = (() => {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("span");
  probe.setAttribute("contenteditable", "plaintext-only");
  return probe.contentEditable === "plaintext-only";
})();

interface PlainTextProps {
  id: string;
  /** Etiqueta con la que se dibuja: la misma que usa la vista para ese texto. */
  as?: "span" | "strong";
  className?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  onEnter?: () => void;
  onFocus?: () => void;
}

export const oneLine = (text: string) => text.replace(/\s+/g, " ");

/** Sin `plaintext-only`, lo pegado en un texto de un renglón llega con formato: se pega como texto llano. */
export function pastePlainLine(event: React.ClipboardEvent) {
  if (PLAINTEXT_ONLY) return;
  event.preventDefault();
  document.execCommand("insertText", false, oneLine(event.clipboardData.getData("text/plain")));
}

/**
 * Texto sin formato de la hoja (el título de un recuadro, la letra de un inciso) vuelto editable.
 * No es un `<input>` ni un `<textarea>`: es el mismo elemento de la vista, así que mide y se dibuja igual.
 */
export function PlainText({ id, as: Tag = "span", className, value, onChange, label, placeholder, maxLength, onEnter, onFocus }: PlainTextProps) {
  const element = useRef<HTMLElement>(null);

  // Manda lo que escribe el docente. Desde fuera solo cambia sin el foco (al reordenar las letras de los incisos)
  useLayoutEffect(() => {
    const target = element.current;
    if (target && target.textContent !== value && document.activeElement !== target) target.textContent = value;
  }, [value]);

  return (
    <Tag
      ref={element}
      className={cn("crt-inplace__plain", className)}
      contentEditable={PLAINTEXT_ONLY ? "plaintext-only" : true}
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      data-inline-field={id}
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={event => {
        const target = event.currentTarget;
        let text = oneLine(target.textContent ?? "");
        if (maxLength !== undefined && text.length > maxLength) {
          text = text.slice(0, maxLength);
          target.textContent = text;
          getSelection()?.selectAllChildren(target);
          getSelection()?.collapseToEnd();
        }
        onChange(text);
      }}
      onPaste={pastePlainLine}
      onKeyDown={event => {
        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        onEnter?.();
      }}
      onFocus={onFocus}
    />
  );
}

/* ───────────────────────── Foco y cursor ───────────────────────── */

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/** Lleva el foco a un campo del editor en sitio y deja el cursor donde pide `entry`. */
export function focusInlineField(field: HTMLElement, entry: EditEntry) {
  const point = typeof entry === "object" ? entry : null;

  const editor = getNearestEditorFromDOMNode(field);
  if (!editor) {
    // Un rótulo llano: texto editable sin editor detrás
    field.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(field);
    if (entry !== "all") {
      const caret = point ? caretAt(point.x, point.y) : null;
      if (caret && field.contains(caret.node)) range.setStart(caret.node, caret.offset);
      else range.collapse(false);
      range.collapse(true);
    }
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return;
  }
  editor.update(
    () => {
      if (entry === "all") {
        $selectAll();
        return;
      }
      const caret = point ? caretAt(point.x, point.y) : null;
      if (caret && field.contains(caret.node)) {
        const node = $getNearestNodeFromDOMNode(caret.node);
        if ($isTextNode(node)) {
          const offset = Math.min(caret.offset, node.getTextContentSize());
          node.select(offset, offset);
          return;
        }
        if ($isDecoratorNode(node)) {
          node.selectNext(0, 0);
          return;
        }
        if ($isElementNode(node) && !$isRootNode(node)) {
          const offset = Math.min(caret.offset, node.getChildrenSize());
          node.select(offset, offset);
          return;
        }
      }
      $getRoot().selectEnd();
    },
    { discrete: true },
  );
  editor.focus();
}

/**
 * Abre la edición de un bloque dejando el cursor donde se hizo clic. La vista y el editor ocupan
 * el mismo sitio, así que el punto del clic cae sobre el mismo texto. Si cayó sobre una fórmula,
 * abre su cuadro.
 */
export function placeCaret(wrapper: HTMLElement, entry: EditEntry) {
  const point = typeof entry === "object" ? entry : null;
  const hit = point ? document.elementFromPoint(point.x, point.y) : null;
  const owner = hit?.closest<HTMLElement>("[data-inline-field]");
  const field = owner && wrapper.contains(owner) ? owner : (wrapper.querySelector<HTMLElement>("[data-inline-main]") ?? wrapper.querySelector<HTMLElement>("[data-inline-field]"));
  if (!field) return;
  focusInlineField(field, owner === field ? entry : entry === "all" ? "all" : "end");
  const formula = owner === field ? hit?.closest<HTMLElement>(".crt-rte__chip") : null;
  formula?.click();
}

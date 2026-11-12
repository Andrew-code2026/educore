/**
 * Conversión entre el Markdown con fórmulas que guarda un recurso y un modelo simple
 * de párrafos, listas y trozos de texto. El editor visual trabaja sobre este modelo,
 * así el docente nunca ve asteriscos, signos de dólar ni barras de escape.
 */

export type Inline =
  | { t: "text"; text: string; bold?: boolean; italic?: boolean }
  | { t: "formula"; latex: string; display?: boolean };

export type MdBlock = { t: "p"; inlines: Inline[] } | { t: "ul" | "ol"; items: Inline[][] };

const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;

function pushText(out: Inline[], text: string, bold: boolean, italic: boolean) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.t === "text" && Boolean(last.bold) === bold && Boolean(last.italic) === italic) {
    last.text += text;
    return;
  }
  out.push({ t: "text", text, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) });
}

/** Lee una línea de Markdown: negrita, cursiva, fórmulas y signos de pesos escapados. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let bold = false;
  let italic = false;
  let buffer = "";
  const flush = () => {
    pushText(out, buffer, bold, italic);
    buffer = "";
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length && /[$*_\\]/.test(source[i + 1])) {
      buffer += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = source[i + 1] === "$";
      const open = display ? 2 : 1;
      const close = display ? source.indexOf("$$", i + 2) : closingDollar(source, i + 1);
      if (close !== -1) {
        const latex = source.slice(i + open, close).trim();
        if (latex) {
          flush();
          out.push({ t: "formula", latex, ...(display ? { display } : {}) });
          i = close + open;
          continue;
        }
      }
      buffer += ch;
      i++;
      continue;
    }
    if (ch === "*" && source[i + 1] === "*") {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (ch === "*" || (ch === "_" && isEmphasisBoundary(source, i))) {
      flush();
      italic = !italic;
      i++;
      continue;
    }
    buffer += ch;
    i++;
  }
  flush();
  return out;
}

function closingDollar(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
      continue;
    }
    if (source[i] === "$") return i;
  }
  return -1;
}

/** Un guion bajo solo es cursiva en el borde de una palabra: "x_1" o "mi_archivo" son texto. */
function isEmphasisBoundary(source: string, index: number): boolean {
  const before = source[index - 1];
  const after = source[index + 1];
  const wordBefore = before !== undefined && /[\p{L}\p{N}]/u.test(before);
  const wordAfter = after !== undefined && /[\p{L}\p{N}]/u.test(after);
  return !(wordBefore && wordAfter);
}

export function parseMd(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ t: "p", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const type = item[2] ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      const inlines = parseInline(item[3]);
      if (last && last.t === type) last.items.push(inlines);
      else blocks.push({ t: type, items: [inlines] });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

const escapeText = (text: string) => text.replace(/([\\$*])/g, "\\$1");

export function serializeInline(inlines: Inline[]): string {
  let out = "";
  for (const inline of inlines) {
    if (inline.t === "formula") {
      const latex = inline.latex.trim();
      if (latex) out += inline.display ? `$$${latex}$$` : `$${latex}$`;
      continue;
    }
    if (!inline.text) continue;
    // Los espacios quedan fuera de los marcadores: "** texto**" no es negrita en Markdown
    const lead = /^\s*/.exec(inline.text)![0];
    const trail = /\s*$/.exec(inline.text.slice(lead.length))![0];
    const core = inline.text.slice(lead.length, inline.text.length - trail.length);
    if (!core) {
      out += inline.text;
      continue;
    }
    const mark = inline.bold && inline.italic ? "***" : inline.bold ? "**" : inline.italic ? "*" : "";
    out += `${lead}${mark}${escapeText(core)}${mark}${trail}`;
  }
  return out;
}

/** Quita los espacios de los extremos de un párrafo y los trozos que quedan vacíos. */
function trimInlines(inlines: Inline[]): Inline[] {
  const out = inlines.map(inline => ({ ...inline }));
  const first = out[0];
  if (first?.t === "text") first.text = first.text.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.t === "text") last.text = last.text.replace(/\s+$/, "");
  return out.filter(inline => inline.t === "formula" || inline.text !== "");
}

/**
 * Deja cada fórmula destacada (`$$…$$`) en un párrafo propio, que es como la dibuja la hoja.
 * El editor en sitio parte de aquí para que el texto no cambie de forma al entrar a editarlo.
 */
export function isolateDisplayFormulas(blocks: MdBlock[]): MdBlock[] {
  const out: MdBlock[] = [];
  for (const block of blocks) {
    if (block.t !== "p" || !block.inlines.some(inline => inline.t === "formula" && inline.display)) {
      out.push(block);
      continue;
    }
    let run: Inline[] = [];
    const flush = () => {
      const inlines = trimInlines(run);
      if (inlines.length > 0) out.push({ t: "p", inlines });
      run = [];
    };
    for (const inline of block.inlines) {
      if (inline.t === "formula" && inline.display) {
        flush();
        out.push({ t: "p", inlines: [inline] });
      } else {
        run.push(inline);
      }
    }
    flush();
  }
  return out;
}

/**
 * Deja un solo espacio donde hay varios y ninguno en los extremos de cada párrafo. La hoja ya los
 * dibuja así; el editor, que respeta cada espacio escrito, los enseñaría todos y correría el texto.
 */
export function collapseSpaces(blocks: MdBlock[]): MdBlock[] {
  const tidy = (inlines: Inline[]): Inline[] => {
    const out: Inline[] = [];
    for (const inline of inlines) {
      if (inline.t === "formula") {
        out.push(inline);
        continue;
      }
      let text = inline.text.replace(/[ \t\n]+/g, " ");
      const previous = out[out.length - 1];
      if (previous?.t === "text" && previous.text.endsWith(" ") && text.startsWith(" ")) text = text.slice(1);
      if (text) out.push({ ...inline, text });
    }
    return trimInlines(out);
  };
  return blocks.map(block => (block.t === "p" ? { ...block, inlines: tidy(block.inlines) } : { ...block, items: block.items.map(tidy) }));
}

/** El texto de un bloque tal como lo carga y lo devuelve el editor en sitio. */
export const inPlaceBlocks = (blocks: MdBlock[]) => collapseSpaces(isolateDisplayFormulas(blocks));

/** Texto de un solo renglón (títulos, incisos): si hay varios párrafos o una lista, se unen con espacios. */
export function serializeSingleLine(blocks: MdBlock[]): string {
  return blocks
    .flatMap(block => (block.t === "p" ? [block.inlines] : block.items))
    .map(inlines => serializeInline(inlines).trim())
    .filter(Boolean)
    .join(" ");
}

export function serializeMd(blocks: MdBlock[]): string {
  return blocks
    .map(block => {
      if (block.t === "p") return serializeInline(block.inlines).trim();
      return block.items
        .map((item, index) => `${block.t === "ol" ? `${index + 1}.` : "-"} ${serializeInline(item).trim()}`)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

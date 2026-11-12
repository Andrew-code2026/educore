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

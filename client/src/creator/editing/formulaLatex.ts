import katex from "katex";
import { checkLatex } from "@shared/creatorValidate";

/**
 * Puente entre el campo matemático (MathLive) y lo que guarda la hoja (LaTeX que dibuja KaTeX).
 *
 * El campo solo sirve para escribir. Al leerlo devuelve LaTeX válido pero con su propio estilo
 * (`\frac12`, `\left(x\right)`, `\placeholder{}`), y no entiende todo lo que KaTeX sí. Aquí se
 * decide, sin tocar el DOM, cómo queda lo que el docente escribió y qué fórmulas no deben pasar
 * por el campo.
 */

/* ───────────────────────── Lectura del LaTeX ───────────────────────── */

/** Comandos cuyo argumento es texto: lo de dentro no se toca. */
const TEXT_COMMANDS = new Set(["\\text", "\\textbf", "\\textit", "\\textrm", "\\textsf", "\\texttt", "\\textnormal", "\\mbox", "\\hbox"]);

/**
 * Parte el LaTeX en piezas: comandos (`\frac`), símbolos de control (`\,`), llaves, espacios y
 * caracteres sueltos. Un comando de texto con su argumento (`\text{ cm}`) es una sola pieza.
 * Unir las piezas devuelve la cadena original.
 */
export function tokenize(latex: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < latex.length) {
    const char = latex[i];
    if (char === "\\") {
      let end = i + 1;
      while (end < latex.length && /[a-zA-Z]/.test(latex[end])) end++;
      if (end === i + 1) end = Math.min(latex.length, i + 2);
      else if (latex[end] === "*" && latex.slice(i, end) === "\\operatorname") end++;
      const command = latex.slice(i, end);
      if (TEXT_COMMANDS.has(command)) {
        let open = end;
        while (open < latex.length && /\s/.test(latex[open])) open++;
        const close = latex[open] === "{" ? matchingBrace(latex, open) : -1;
        if (close !== -1) end = close + 1;
      }
      tokens.push(latex.slice(i, end));
      i = end;
      continue;
    }
    if (/\s/.test(char)) {
      let end = i + 1;
      while (end < latex.length && /\s/.test(latex[end])) end++;
      tokens.push(latex.slice(i, end));
      i = end;
      continue;
    }
    // Un carácter fuera del plano básico ocupa dos unidades
    const size = (latex.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
    tokens.push(latex.slice(i, i + size));
    i += size;
  }
  return tokens;
}

function matchingBrace(latex: string, open: number): number {
  let depth = 0;
  for (let i = open; i < latex.length; i++) {
    if (latex[i] === "\\") i++;
    else if (latex[i] === "{") depth++;
    else if (latex[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

const isSpace = (token: string | undefined) => token !== undefined && /^\s+$/.test(token);

/** Índice de la pieza que cierra el grupo abierto en `open`, o -1. */
function closing(tokens: string[], open: number, left = "{", right = "}"): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    if (tokens[i] === left) depth++;
    else if (tokens[i] === right && --depth === 0) return i;
  }
  return -1;
}

/* ───────────────────────── Del campo a la hoja ───────────────────────── */

/** Cuántos argumentos toma cada comando al que el campo le quita las llaves (`\frac12`). */
const ARITY: Record<string, number> = {
  "\\frac": 2,
  "\\dfrac": 2,
  "\\tfrac": 2,
  "\\cfrac": 2,
  "\\binom": 2,
  "\\sqrt": 1,
  "\\overline": 1,
  "\\underline": 1,
  "\\vec": 1,
  "\\hat": 1,
  "\\bar": 1,
  "\\widehat": 1,
  "\\overrightarrow": 1,
  "\\mathrm": 1,
  "\\mathbf": 1,
  "\\mathbb": 1,
};

/** Un argumento sin llaves solo se envuelve si es una pieza que se sostiene sola: `1`, `x`, `\pi`. */
const standsAlone = (token: string) => /^[0-9A-Za-z]$/.test(token) || (/^\\[a-zA-Z]+$/.test(token) && !(token in ARITY) && !STRUCTURAL.has(token));

const STRUCTURAL = new Set(["\\left", "\\right", "\\begin", "\\end", "\\middle", "\\placeholder", "\\operatorname", "\\displaystyle", "\\textstyle", "\\limits", "\\nolimits"]);

/** `\frac12` → `\frac{1}{2}`, `\sqrt2` → `\sqrt{2}`: como lo escribe la IA y como se lee mejor. */
function braceArguments(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i++];
    out.push(token);
    let pending = ARITY[token] ?? 0;
    if (pending === 0) continue;
    // El índice de la raíz va entre corchetes, antes del radicando
    if (token === "\\sqrt" && tokens[i] === "[") {
      const end = closing(tokens, i, "[", "]");
      if (end === -1) continue;
      out.push(...tokens.slice(i, end + 1));
      i = end + 1;
    }
    while (pending > 0) {
      let next = i;
      while (isSpace(tokens[next])) next++;
      const argument = tokens[next];
      if (argument === "{") {
        const end = closing(tokens, next);
        if (end === -1) break;
        out.push(...braceArguments(tokens.slice(next, end + 1)));
        i = end + 1;
      } else if (argument !== undefined && standsAlone(argument)) {
        out.push("{", argument, "}");
        i = next + 1;
      } else break;
      pending--;
    }
  }
  return out;
}

/** `\log_28` se lee «logaritmo en base 28» aunque TeX entienda base 2 y luego un 8: `\log_{2}8`. */
function braceDigitScripts(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if ((token === "^" || token === "_") && /^[0-9]$/.test(tokens[i + 1] ?? "") && /^[0-9]$/.test(tokens[i + 2] ?? "")) {
      out.push(token, "{", tokens[i + 1], "}");
      i++;
    } else out.push(token);
  }
  return out;
}

/** Una casilla que quedó vacía es un grupo vacío: KaTeX la dibuja en blanco en lugar de fallar. */
function dropPlaceholders(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "\\placeholder") {
      out.push(tokens[i]);
      continue;
    }
    let next = i + 1;
    if (tokens[next] === "[") next = closing(tokens, next, "[", "]") + 1 || next;
    const end = tokens[next] === "{" ? closing(tokens, next) : -1;
    if (end !== -1) i = end;
    out.push("{", "}");
  }
  return out;
}

/** El campo escribe `\operatorname{\mathrm{mcd}}`; `\operatorname` ya pone la letra recta. */
function unwrapOperatorName(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if (tokens[i] !== "\\operatorname" && tokens[i] !== "\\operatorname*") continue;
    if (tokens[i + 1] !== "{" || tokens[i + 2] !== "\\mathrm" || tokens[i + 3] !== "{") continue;
    const inner = closing(tokens, i + 3);
    if (inner === -1 || tokens[inner + 1] !== "}") continue;
    out.push("{", ...tokens.slice(i + 4, inner), "}");
    i = inner + 1;
  }
  return out;
}

/** El grado se escribe como en el resto de la hoja: `90^{\circ}`. */
function degrees(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (token === "\\degree" || token === "°") out.push("^", "{", "\\circ", "}");
    else out.push(token);
  }
  return out;
}

const isDigit = (token: string | undefined) => token !== undefined && /^[0-9]$/.test(token);
const isDecimalComma = (tokens: string[], at: number) => tokens[at] === "{" && tokens[at + 1] === "," && tokens[at + 2] === "}";

/**
 * Con coma decimal, el campo pega al número toda coma que sigue a una cifra (`{,}`). Eso está bien
 * en `3{,}75`, pero un número no lleva dos comas: `1{,}2{,}3` es una lista y sus comas se dejan sueltas.
 * Una sola coma, como en `(1{,}5)`, se queda como decimal: no hay forma de saber si era un punto del plano.
 */
function listCommas(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isDigit(tokens[i])) {
      out.push(tokens[i++]);
      continue;
    }
    // Un número con sus comas: cifras, puntos de miles y comas pegadas
    let end = i;
    const commas: number[] = [];
    while (end < tokens.length) {
      if (isDigit(tokens[end]) || (tokens[end] === "." && isDigit(tokens[end + 1]))) end++;
      else if (isDecimalComma(tokens, end)) {
        commas.push(end);
        end += 3;
      } else break;
    }
    for (let k = i; k < end; k++) {
      if (commas.length > 1 && commas.includes(k)) {
        out.push(",");
        k += 2;
      } else out.push(tokens[k]);
    }
    i = end;
  }
  return out;
}

/** Lo que, dentro de un paréntesis, pide que crezca con el contenido. */
const TALL = new Set([
  "\\frac",
  "\\dfrac",
  "\\tfrac",
  "\\cfrac",
  "\\binom",
  "\\sqrt",
  "\\sum",
  "\\prod",
  "\\int",
  "\\begin",
  "\\displaystyle",
  "\\over",
  "\\underbrace",
  "\\overbrace",
  "\\overset",
  "\\underset",
  "\\stackrel",
  "\\\\",
]);

/** Delimitadores que tienen una forma llana equivalente. */
const PLAIN_OPEN: Record<string, string> = { "(": "(", "[": "[", "\\lbrack": "[", "|": "|", "\\vert": "|", "\\lbrace": "\\{", "\\{": "\\{" };
const PLAIN_CLOSE: Record<string, string> = { ")": ")", "]": "]", "\\rbrack": "]", "|": "|", "\\vert": "|", "\\rbrace": "\\}", "\\}": "\\}" };
/** Un intervalo puede abrir con paréntesis y cerrar con corchete; las barras y las llaves van con su pareja. */
const PAIRS: Record<string, string[]> = { "(": [")", "]"], "[": [")", "]"], "|": ["|"], "\\{": ["\\}"] };

/**
 * El campo cierra solo los paréntesis y los escribe como `\left( … \right)`. Alrededor de algo
 * alto (una fracción, una raíz) eso es lo correcto. Alrededor de `x + 1` no: KaTeX los separa del
 * número que multiplican y los agranda con un simple exponente. Ahí se dejan llanos, como en el
 * resto de la hoja.
 */
function plainDelimiters(tokens: string[]): string[] {
  const out = [...tokens];
  const open: { at: number; tall: boolean }[] = [];
  for (let i = 0; i < out.length; i++) {
    const token = out[i];
    if (TALL.has(token)) for (const frame of open) frame.tall = true;
    if (token === "\\left") open.push({ at: i, tall: false });
    if (token !== "\\right") continue;
    const frame = open.pop();
    if (!frame) continue;
    const left = PLAIN_OPEN[out[frame.at + 1]];
    const right = PLAIN_CLOSE[out[i + 1]];
    if (frame.tall || left === undefined || right === undefined || !PAIRS[left].includes(right)) {
      // Un par que se queda con `\left` es alto para el que lo envuelve
      for (const outer of open) outer.tall = true;
      continue;
    }
    out[frame.at] = "";
    out[frame.at + 1] = left;
    out[i] = "";
    out[i + 1] = right;
  }
  return out.filter(token => token !== "");
}

/** Un comando seguido de una letra necesita un espacio para no fundirse con ella. */
function join(tokens: string[]): string {
  let start = 0;
  let end = tokens.length;
  while (start < end && isSpace(tokens[start])) start++;
  while (end > start && isSpace(tokens[end - 1])) end--;
  let out = "";
  for (const token of tokens.slice(start, end)) {
    if (/^[a-zA-Z]/.test(token) && /\\[a-zA-Z]+$/.test(out)) out += " ";
    out += token;
  }
  return out;
}

/**
 * Deja lo que devuelve el campo matemático como se guarda en la hoja. No cambia lo que se dibuja,
 * salvo los paréntesis llanos y el signo de grado; aplicarla dos veces da lo mismo que una.
 */
export function fromField(latex: string): string {
  try {
    let tokens = tokenize(latex);
    tokens = dropPlaceholders(tokens);
    tokens = unwrapOperatorName(tokens);
    tokens = degrees(tokens);
    tokens = listCommas(tokens);
    tokens = plainDelimiters(tokens);
    tokens = braceArguments(tokens);
    tokens = braceDigitScripts(tokens);
    return join(tokens);
  } catch {
    return latex.trim();
  }
}

/** ¿Quedó alguna casilla sin llenar (el numerador de una fracción, un exponente)? */
export function hasEmptySlot(fieldLatex: string): boolean {
  return fieldLatex.includes("\\placeholder");
}

/* ───────────────────────── ¿Se dibuja igual? ───────────────────────── */

interface ParseNode {
  type?: string;
  body?: unknown;
  [key: string]: unknown;
}

/** Piezas que se comportan igual sueltas que dentro de un grupo: `a{b}c` se dibuja como `abc`. */
const ORDINARY = new Set(["mathord", "textord", "sqrt", "text", "accent", "overline", "underline", "kern", "ordgroup"]);

function simplify(node: unknown, inList: boolean): unknown {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const child of node) {
      const clean = simplify(child, true) as ParseNode | null;
      if (clean && clean.type === "ordgroup" && Array.isArray(clean.body) && clean.body.every(item => ORDINARY.has((item as ParseNode).type ?? ""))) out.push(...clean.body);
      else out.push(clean);
    }
    return out;
  }
  if (node === null || typeof node !== "object") return node;
  const out: ParseNode = {};
  for (const [key, value] of Object.entries(node)) {
    // La posición en el texto no forma parte del dibujo
    if (key !== "loc") out[key] = simplify(value, false);
  }
  // Como argumento (un exponente, un numerador), un grupo de una sola pieza es esa pieza: x^{2} ≡ x^2
  if (!inList && out.type === "ordgroup" && Array.isArray(out.body) && out.body.length === 1) return out.body[0];
  return out;
}

type KatexParser = (latex: string, options: katex.KatexOptions) => unknown;

/**
 * Huella de cómo KaTeX entiende una fórmula, sin lo que no cambia el dibujo (espacios, llaves de
 * más). Dos fórmulas con la misma huella se dibujan igual. `null` si la fórmula no es válida.
 */
export function drawingSignature(latex: string): string | null {
  const parse = (katex as unknown as { __parse?: KatexParser }).__parse;
  try {
    // Sin acceso al árbol, solo cuentan como iguales las fórmulas que dan el mismo dibujo letra por letra
    if (typeof parse !== "function") return katex.renderToString(latex, { throwOnError: true, strict: "ignore", output: "html" });
    return JSON.stringify(simplify(parse(latex, { throwOnError: true, strict: "ignore" }), true));
  } catch {
    return null;
  }
}

export function sameDrawing(a: string, b: string): boolean {
  const signature = drawingSignature(a);
  return signature !== null && signature === drawingSignature(b);
}

/* ───────────────────────── Decisiones del cuadro de fórmula ───────────────────────── */

/**
 * ¿Se puede editar esta fórmula en el campo sin estropearla? Se le da al campo, se lee lo que
 * devuelve y se compara con la original: si el campo no la entendió, perdió algo o devolvió algo
 * que KaTeX no acepta, la fórmula se edita en LaTeX y queda como estaba.
 */
export function fitsField(original: string, readBack: string, fieldErrors = 0): boolean {
  if (original.trim() === "") return true;
  if (fieldErrors > 0 || hasEmptySlot(readBack)) return false;
  const stored = fromField(readBack);
  return checkLatex(stored) === null && sameDrawing(fromField(original), stored);
}

/**
 * Lo que se guarda al salir del campo. Si el campo devuelve lo mismo que al abrir, la fórmula
 * no se tocó y se conserva tal cual estaba, con su estilo y sus espacios.
 */
export function fieldResult(original: string, baseline: string, current: string): string {
  return current === baseline ? original : fromField(current);
}

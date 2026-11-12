/**
 * Evaluador de expresiones matemáticas de una variable para el Creador de recursos.
 *
 * Las gráficas y las tablas de valores se calculan con esto en lugar de confiar en
 * los números que escribe el modelo. Es un parser propio (sin `eval` ni dependencias)
 * que corre igual en el servidor y en el navegador.
 *
 * Admite: + - * / ^, paréntesis, multiplicación implícita (2x, 3(x+1)), las funciones
 * sqrt abs sin cos tan ln log exp y las constantes pi y e.
 */

export const MATH_EXPR_MAX = 120;
const MAX_DEPTH = 48;

export class MathSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathSyntaxError";
  }
}

export type MathNode =
  | { kind: "num"; value: number }
  | { kind: "var" }
  | { kind: "neg"; arg: MathNode }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: MathNode; right: MathNode }
  | { kind: "call"; fn: MathFunction; arg: MathNode };

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
} as const;

type MathFunction = keyof typeof FUNCTIONS;

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { type: "num"; value: number }
  | { type: "id"; name: string }
  | { type: "op"; op: "+" | "-" | "*" | "/" | "^" | "(" | ")" };

/** Signos tipográficos que suelen llegar pegados desde un documento. */
const NORMALIZE: Array<[RegExp, string]> = [
  [/[−–—]/g, "-"],
  [/[·×⋅]/g, "*"],
  [/÷/g, "/"],
  [/π/g, "pi"],
  [/²/g, "^2"],
  [/³/g, "^3"],
];

function tokenize(source: string, variable: string): Token[] {
  let text = source;
  for (const [pattern, replacement] of NORMALIZE) text = text.replace(pattern, replacement);

  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j])) j++;
      const raw = text.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new MathSyntaxError(`Número no válido: "${raw}"`);
      tokens.push({ type: "num", value: Number(raw) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
      // "2xsqrt" no existe, pero "xsin" tampoco: los nombres se separan del resto por el más largo conocido
      for (const name of splitIdentifiers(text.slice(i, j).toLowerCase(), variable)) tokens.push({ type: "id", name });
      i = j;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      tokens.push({ type: "op", op: ch as "+" });
      i++;
      continue;
    }
    throw new MathSyntaxError(`Símbolo no reconocido: "${ch}"`);
  }
  return tokens;
}

/** Parte "xsqrt" o "pix" en nombres conocidos; así "2xsqrt(x)" y "pix" funcionan como en el cuaderno. */
function splitIdentifiers(word: string, variable: string): string[] {
  const known = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), variable].sort((a, b) => b.length - a.length);
  const parts: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    const match = known.find(name => rest.startsWith(name));
    if (!match) throw new MathSyntaxError(`Nombre no reconocido: "${word}"`);
    parts.push(match);
    rest = rest.slice(match.length);
  }
  return parts;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly variable: string,
  ) {}

  parse(): MathNode {
    const node = this.expression(0);
    if (this.pos < this.tokens.length) throw new MathSyntaxError("La expresión tiene símbolos de sobra al final.");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(op: string): boolean {
    const token = this.peek();
    return token?.type === "op" && token.op === op;
  }

  private expression(depth: number): MathNode {
    if (depth > MAX_DEPTH) throw new MathSyntaxError("La expresión es demasiado compleja.");
    let left = this.term(depth);
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.tokens[this.pos++] as { op: "+" | "-" }).op;
      left = { kind: "bin", op, left, right: this.term(depth) };
    }
    return left;
  }

  private term(depth: number): MathNode {
    let left = this.unary(depth);
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.tokens[this.pos++] as { op: "*" | "/" }).op;
        left = { kind: "bin", op, left, right: this.unary(depth) };
        continue;
      }
      // Multiplicación implícita: 2x, 3(x+1), x sqrt(x)
      const next = this.peek();
      if (next && (next.type === "num" || next.type === "id" || (next.type === "op" && next.op === "("))) {
        left = { kind: "bin", op: "*", left, right: this.power(depth) };
        continue;
      }
      return left;
    }
  }

  private unary(depth: number): MathNode {
    if (this.isOp("-")) {
      this.pos++;
      return { kind: "neg", arg: this.unary(depth + 1) };
    }
    if (this.isOp("+")) {
      this.pos++;
      return this.unary(depth + 1);
    }
    return this.power(depth);
  }

  /** La potencia asocia a la derecha y liga más fuerte que el signo: -x^2 es -(x^2). */
  private power(depth: number): MathNode {
    const base = this.primary(depth);
    if (this.isOp("^")) {
      this.pos++;
      return { kind: "bin", op: "^", left: base, right: this.unary(depth + 1) };
    }
    return base;
  }

  private primary(depth: number): MathNode {
    const token = this.peek();
    if (!token) throw new MathSyntaxError("La expresión está incompleta.");
    if (token.type === "num") {
      this.pos++;
      return { kind: "num", value: token.value };
    }
    if (token.type === "id") {
      this.pos++;
      if (token.name === this.variable) return { kind: "var" };
      if (token.name in CONSTANTS) return { kind: "num", value: CONSTANTS[token.name] };
      if (!this.isOp("(")) throw new MathSyntaxError(`La función ${token.name} necesita paréntesis.`);
      this.pos++;
      const arg = this.expression(depth + 1);
      this.expect(")");
      return { kind: "call", fn: token.name as MathFunction, arg };
    }
    if (token.op === "(") {
      this.pos++;
      const inner = this.expression(depth + 1);
      this.expect(")");
      return inner;
    }
    throw new MathSyntaxError(`No se esperaba "${token.op}".`);
  }

  private expect(op: string) {
    if (!this.isOp(op)) throw new MathSyntaxError(`Falta "${op}".`);
    this.pos++;
  }
}

export function parseExpression(source: string, variable = "x"): MathNode {
  if (typeof source !== "string" || source.trim() === "") throw new MathSyntaxError("La expresión está vacía.");
  if (source.length > MATH_EXPR_MAX) throw new MathSyntaxError("La expresión es demasiado larga.");
  if (!/^[a-z]$/.test(variable)) throw new MathSyntaxError("La variable debe ser una sola letra.");
  // Acepta "y = 2x - 3" o "f(x) = ..." quedándose con el lado derecho
  const rhs = source.includes("=") ? source.slice(source.lastIndexOf("=") + 1) : source;
  return new Parser(tokenize(rhs, variable), variable).parse();
}

export function evaluate(node: MathNode, x: number): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "var":
      return x;
    case "neg":
      return -evaluate(node.arg, x);
    case "call":
      return FUNCTIONS[node.fn](evaluate(node.arg, x));
    case "bin": {
      const left = evaluate(node.left, x);
      const right = evaluate(node.right, x);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "^":
          return Math.pow(left, right);
      }
    }
  }
}

export type CompiledExpression = (x: number) => number;

export function compileExpression(source: string, variable = "x"): CompiledExpression {
  const ast = parseExpression(source, variable);
  return x => evaluate(ast, x);
}

export type CompileResult = { ok: true; fn: CompiledExpression } | { ok: false; error: string };

/** Igual que `compileExpression` pero sin lanzar: para validar lo que escribe el modelo o el docente. */
export function tryCompile(source: string, variable = "x"): CompileResult {
  try {
    return { ok: true, fn: compileExpression(source, variable) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Expresión no válida." };
  }
}

/** Quita el ruido binario (0.1 + 0.2) y los ceros de sobra: 3 → "3", 1.5 → "1.5", 0.333… → "0.33". */
export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(maxDecimals));
  // Evita "-0"
  return String(rounded === 0 ? 0 : rounded);
}

/**
 * El mismo número como se escribe en Colombia, para lo que lee el estudiante (tablas, ejes,
 * barras): punto de miles y coma decimal, 20000 → "20.000" y 1.5 → "1,5". Los avisos de
 * validación siguen con `formatNumber`: los lee la IA, que escribe las expresiones con punto.
 */
export function formatNumberEs(value: number, maxDecimals = 2): string {
  const plain = formatNumber(value, maxDecimals);
  if (!Number.isFinite(value)) return plain;
  const [whole, decimals] = plain.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals ? `${grouped},${decimals}` : grouped;
}

/** Igualdad con tolerancia relativa: para comprobar que un punto está sobre su curva. */
export function nearlyEqual(a: number, b: number, tolerance = 0.02): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

export interface CurveSegment {
  points: Array<[number, number]>;
}

/**
 * Muestrea una función para dibujarla. Corta la curva donde no está definida o donde
 * salta (asíntotas), para no unir con una línea los dos lados de una discontinuidad.
 */
export function sampleCurve(
  fn: CompiledExpression,
  range: { xMin: number; xMax: number; yMin: number; yMax: number },
  samples = 240,
): CurveSegment[] {
  const { xMin, xMax, yMin, yMax } = range;
  const height = yMax - yMin;
  const segments: CurveSegment[] = [];
  let current: Array<[number, number]> = [];
  let previousY: number | null = null;

  const close = () => {
    if (current.length > 1) segments.push({ points: current });
    current = [];
    previousY = null;
  };

  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = fn(x);
    if (!Number.isFinite(y)) {
      close();
      continue;
    }
    // Un salto mayor que dos alturas del plano entre muestras vecinas es una asíntota
    if (previousY !== null && Math.abs(y - previousY) > height * 2) close();
    // Fuera del plano se conserva un margen para que la curva salga por el borde y no se corte antes
    if (y < yMin - height || y > yMax + height) {
      close();
      continue;
    }
    current.push([x, y]);
    previousY = y;
  }
  close();
  return segments;
}

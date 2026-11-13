import { formatNumberEs } from "./creatorMath";

/**
 * Álgebra del modelo de área del Creador de recursos: monomios de una variable, su producto
 * y la suma de términos semejantes. Funciones puras: el dibujo, el formulario y el validador
 * sacan de aquí cada celda y el área total, de modo que la figura no puede decir 3 · 2 = 12.
 */

export interface Monomial {
  coef: number;
  /** Exponente de la variable; 0 en un número. */
  exp: number;
  /** Letra de la variable; null en un número. */
  variable: string | null;
}

export type AlgebraFormat = "latex" | "plain";

/** Quita el ruido binario de un producto de decimales (0.1 · 3). */
const clean = (value: number) => Number(value.toPrecision(12));

/** Lee un monomio en texto plano: "3", "x", "2x", "-4", "x^2", "0.5x", "2*x". null si no lo es. */
export function parseMonomial(text: string): Monomial | null {
  const compact = text.replace(/\s+/g, "").replace(/−/g, "-").replace(/\*/g, "");
  const match = /^([+-]?)(\d+(?:[.,]\d+)?)?(?:([a-zA-Z])(?:\^\{?(\d)\}?)?)?$/.exec(compact);
  if (!match || (match[2] === undefined && match[3] === undefined)) return null;
  const coef = (match[1] === "-" ? -1 : 1) * (match[2] === undefined ? 1 : Number(match[2].replace(",", ".")));
  const exp = match[3] === undefined ? 0 : match[4] === undefined ? 1 : Number(match[4]);
  // x^0 es un número: no arrastra la letra
  return { coef, exp, variable: exp === 0 ? null : match[3] };
}

/**
 * Parte lo que escribe el docente en el formulario en términos: "x + 3", "2x - 5" o "x, 3".
 * Una coma entre dos cifras es decimal (0,5x); en cualquier otro sitio separa términos.
 */
export function splitTerms(text: string): string[] {
  const normalized = text.replace(/−/g, "-").replace(/(?<!\d),|,(?!\d)/g, ";");
  return normalized
    .split(";")
    .flatMap(part => part.match(/[+-]?[^+-]+/g) ?? [])
    .map(term => term.replace(/\s+/g, "").replace(/^\+/, ""))
    .filter(Boolean);
}

export function multiplyMonomials(a: Monomial, b: Monomial): Monomial {
  const exp = a.exp + b.exp;
  return { coef: clean(a.coef * b.coef), exp, variable: exp === 0 ? null : (a.variable ?? b.variable) };
}

/** Suma de términos semejantes, del grado mayor al menor y sin los que se anulan. */
export function sumMonomials(terms: Monomial[]): Monomial[] {
  const byExp = new Map<number, Monomial>();
  for (const term of terms) {
    const current = byExp.get(term.exp);
    byExp.set(term.exp, current ? { ...current, coef: clean(current.coef + term.coef), variable: current.variable ?? term.variable } : { ...term });
  }
  return Array.from(byExp.values())
    .filter(term => term.coef !== 0)
    .sort((a, b) => b.exp - a.exp);
}

/** El monomio sin signo: "2x", "x^{2}", "0,5". */
function monomialBody(term: Monomial, format: AlgebraFormat): string {
  const size = Math.abs(term.coef);
  const number = format === "latex" ? formatNumberEs(size, 4).replace(",", "{,}") : formatNumberEs(size, 4);
  if (term.exp === 0 || !term.variable) return number;
  const power = term.exp === 1 ? "" : format === "latex" ? `^{${term.exp}}` : `^${term.exp}`;
  return `${size === 1 ? "" : number}${term.variable}${power}`;
}

/** Un monomio con su signo: "-3x", "x^{2}". */
export const monomialText = (term: Monomial, format: AlgebraFormat = "plain"): string => `${term.coef < 0 ? "-" : ""}${monomialBody(term, format)}`;

/** Una suma de monomios tal como se escribe: "x^{2} + 5x + 6", "2x - 3". "0" si no queda nada. */
export function polynomialText(terms: Monomial[], format: AlgebraFormat = "plain"): string {
  if (terms.length === 0) return "0";
  return terms.map((term, index) => (index === 0 ? monomialText(term, format) : `${term.coef < 0 ? "-" : "+"} ${monomialBody(term, format)}`)).join(" ");
}

export interface AreaModel {
  rows: Monomial[];
  columns: Monomial[];
  /** Producto de cada fila por cada columna: cells[fila][columna]. */
  cells: Monomial[][];
  /** Área total: la suma de las celdas, ya simplificada. */
  total: Monomial[];
  /** true cuando todos los términos son números: es una multiplicación por descomposición. */
  numeric: boolean;
}

/** El modelo de área de dos lados dados por sus términos. null si algún término no se entiende. */
export function computeAreaModel(rows: string[], columns: string[]): AreaModel | null {
  const parsedRows = rows.map(parseMonomial);
  const parsedColumns = columns.map(parseMonomial);
  if (parsedRows.some(term => term === null) || parsedColumns.some(term => term === null) || rows.length === 0 || columns.length === 0) return null;
  const rowTerms = parsedRows as Monomial[];
  const columnTerms = parsedColumns as Monomial[];
  const cells = rowTerms.map(row => columnTerms.map(column => multiplyMonomials(row, column)));
  return { rows: rowTerms, columns: columnTerms, cells, total: sumMonomials(cells.flat()), numeric: [...rowTerms, ...columnTerms].every(term => term.exp === 0) };
}

/** Un lado como factor: entre paréntesis si tiene más de un término. */
const factorText = (terms: Monomial[], format: AlgebraFormat) => (terms.length > 1 ? `(${polynomialText(terms, format)})` : polynomialText(terms, format));

/** El producto que representa el modelo: "(x + 3)(x + 2)", "3(x + 2)" o, con números, "23 × 45". */
export function areaModelProduct(model: AreaModel, format: AlgebraFormat = "plain"): string {
  const times = format === "latex" ? " \\times " : " × ";
  if (model.numeric) return `${polynomialText(sumMonomials(model.rows), format)}${times}${polynomialText(sumMonomials(model.columns), format)}`;
  if (model.rows.length === 1 && model.columns.length === 1) return `${polynomialText(model.rows, format)}${format === "latex" ? " \\cdot " : " · "}${polynomialText(model.columns, format)}`;
  // Un solo término va delante sin paréntesis: 3(x + 2)
  const [first, second] = model.columns.length === 1 && model.rows.length > 1 ? [model.columns, model.rows] : [model.rows, model.columns];
  return `${factorText(first, format)}${factorText(second, format)}`;
}

/** Problemas de los términos de un modelo de área, redactados para quien deba corregirlos. */
export function areaModelIssues(rows: string[], columns: string[]): string[] {
  const issues: string[] = [];
  const parsed = [...rows, ...columns].map(text => ({ text, term: parseMonomial(text) }));
  for (const { text, term } of parsed) {
    if (!term) issues.push(`no se entiende el término "${text}". Escribe un número o un monomio de una letra en texto plano: 3, x, 2x, -4, x^2.`);
    else if (term.coef === 0) issues.push(`el término "${text}" vale cero; quítalo.`);
  }
  const letters = Array.from(new Set(parsed.map(item => item.term?.variable).filter((letter): letter is string => Boolean(letter))));
  if (letters.length > 1) issues.push(`los términos usan varias letras (${letters.join(", ")}) y el modelo trabaja con una sola.`);
  if (rows.length * columns.length < 2) issues.push("con un término en cada lado no hay nada que partir; pon al menos dos términos en un lado.");
  return issues;
}

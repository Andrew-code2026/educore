import { exactDecimals, formatDecimalEs } from "./creatorPlane";

/**
 * Números exactos de las figuras de geometría (triángulo, círculo unitario, sólidos): un racional
 * por una raíz cuadrada y, si hace falta, por π, escrito como lo escribe el estudiante: 5, 2,5, 3/5,
 * 2√5, √3/2, 36π, 32π/3. Lo que no se puede escribir así se da aproximado y con ≈, nunca redondeado
 * en silencio.
 *
 * Las medidas se calculan en coma flotante y se reconocen al final: un lado de 4,358898… cuyo cuadrado
 * es 19 es √19. Los cuadrados se reconocen con cuatro decimales como mucho y el radicando simplificado
 * no pasa de RADICAND_MAX, de modo que una coincidencia numérica no se escriba como una raíz absurda.
 */

/** (n/d)·√r·π^pi, con la fracción reducida, d > 0 y r libre de cuadrados. */
export interface Exact {
  n: number;
  d: number;
  r: number;
  pi: boolean;
}

/** Decimales con que se escribe exacta una medida dada o calculada. */
export const EXACT_DECIMALS = 4;
/** Decimales del cuadrado de una medida para reconocerla como raíz: (15√3/4)² = 42,1875. */
const SQUARE_DECIMALS = 4;
const RADICAND_MAX = 10_000;
/** Más allá de esto los enteros dejan de ser exactos en coma flotante: se da la aproximación. */
const SAFE = 1e12;

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
};

/** Fracción reducida con el signo en el numerador; null si no es exacta en coma flotante. */
function fraction(n: number, d: number, r = 1, pi = false): Exact | null {
  if (d === 0 || !Number.isInteger(n) || !Number.isInteger(d) || Math.abs(n) > SAFE || Math.abs(d) > SAFE) return null;
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g || 0, d: Math.abs(d) / g, r: n === 0 ? 1 : r, pi: n === 0 ? false : pi };
}

/** Un entero positivo como k²·m, con m libre de cuadrados. */
function squareFree(value: number): { outside: number; inside: number } | null {
  if (!Number.isInteger(value) || value < 0 || value > 1e10) return null;
  let outside = 1;
  let inside = value;
  for (let p = 2; p * p <= inside; p++) {
    while (inside % (p * p) === 0) {
      inside /= p * p;
      outside *= p;
    }
  }
  return { outside, inside };
}

/** El número decimal como fracción exacta, si se escribe con hasta `decimals` decimales. */
export function rational(value: number, decimals = EXACT_DECIMALS): Exact | null {
  const places = exactDecimals(value, decimals);
  if (places === null) return null;
  const scale = 10 ** places;
  return fraction(Math.round(value * scale), scale);
}

/** √(n/d) de un racional no negativo, racionalizado: √(4/5) = 2√5/5. */
export function sqrtOf(value: Exact): Exact | null {
  if (value.r !== 1 || value.pi || value.n < 0) return null;
  const root = squareFree(value.n * value.d);
  if (!root) return null;
  return fraction(root.outside, value.d, root.inside);
}

export function multiply(a: Exact, b: Exact): Exact | null {
  if (a.pi && b.pi) return null;
  const root = squareFree(a.r * b.r);
  if (!root) return null;
  return fraction(a.n * b.n * root.outside, a.d * b.d, root.inside, a.pi || b.pi);
}

export function divide(a: Exact, b: Exact): Exact | null {
  if (b.n === 0 || b.pi) return null;
  // 1/((n/d)√r) = d√r/(n·r)
  return multiply(a, { n: b.d, d: b.n * b.r, r: b.r, pi: false });
}

/** Suma de dos términos semejantes (misma raíz y los dos con π o sin él); null si no lo son. */
export function add(a: Exact, b: Exact): Exact | null {
  if (a.n === 0) return b;
  if (b.n === 0) return a;
  if (a.r !== b.r || a.pi !== b.pi) return null;
  return fraction(a.n * b.d + b.n * a.d, a.d * b.d, a.r, a.pi);
}

export const exactValue = (value: Exact): number => (value.n / value.d) * Math.sqrt(value.r) * (value.pi ? Math.PI : 1);

export const exactInteger = (n: number): Exact => ({ n, d: 1, r: 1, pi: false });

/**
 * Reconoce una medida calculada: exacta si se escribe con pocos decimales, raíz si su cuadrado sí
 * (√19, 5√3, 5√6/2), y null si no es ninguna de las dos.
 */
export function recognize(value: number): Exact | null {
  if (!Number.isFinite(value)) return null;
  const plain = rational(value);
  if (plain) return plain;
  if (value <= 0) return null;
  const square = rational(value * value, SQUARE_DECIMALS);
  const root = square ? sqrtOf(square) : null;
  return root && root.r <= RADICAND_MAX ? root : null;
}

/** El denominador se escribe como decimal exacto si solo tiene factores 2 y 5 y caben los decimales. */
function asDecimal(value: Exact): string | null {
  let d = value.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  if (d !== 1) return null;
  const places = exactDecimals(value.n / value.d, EXACT_DECIMALS);
  return places === null ? null : formatDecimalEs(value.n / value.d, places);
}

export type ExactFormat = "plain" | "latex";

export interface ExactTextOptions {
  format?: ExactFormat;
  /** En LaTeX, \tfrac en vez de \frac: para rótulos apretados como los del círculo unitario. */
  small?: boolean;
  /** Una razón se escribe como fracción aunque tenga decimal exacto: 3/5, no 0,6. */
  fraction?: boolean;
}

/**
 * El número como se escribe: "2,5", "3/5", "2√5", "√3/2", "36π", "32π/3", "-√2/2". En LaTeX, con
 * \frac (o \tfrac si se pide pequeño) y la coma decimal entre llaves.
 */
export function exactText(value: Exact, { format = "plain", small = false, fraction: asFraction = false }: ExactTextOptions = {}): string {
  const sign = value.n < 0 ? "-" : "";
  const size = Math.abs(value.n);
  const root = value.r === 1 ? "" : format === "latex" ? `\\sqrt{${value.r}}` : `√${value.r}`;
  const pi = value.pi ? (format === "latex" ? "\\pi" : "π") : "";
  const symbols = `${root}${pi}`;
  if (size === 0) return "0";
  // Un racional con denominador de potencias de 2 y 5 va en decimal: 2,5 o 6,25π
  if (value.r === 1 && (!asFraction || value.d === 1)) {
    const decimal = asDecimal({ ...value, n: size });
    if (decimal !== null) {
      const number = format === "latex" ? decimal.replace(",", "{,}") : decimal;
      return `${sign}${symbols && number === "1" ? "" : number}${symbols}`;
    }
  }
  const numerator = `${size === 1 && symbols ? "" : size}${symbols}`;
  if (value.d === 1) return `${sign}${numerator}`;
  if (format === "latex") return `${sign}\\${small ? "tfrac" : "frac"}{${numerator}}{${value.d}}`;
  return `${sign}${numerator}/${value.d}`;
}

/** Un número aproximado como lo lee el estudiante: dos decimales con coma. */
export const approxText = (value: number, format: ExactFormat = "plain"): string => {
  const text = formatDecimalEs(value, 2);
  return format === "latex" ? text.replace(",", "{,}") : text;
};

/**
 * Una medida calculada para la clave: exacta ("= 5", "= √19 ≈ 4,36") o aproximada ("≈ 36,87").
 * La parte decimal acompaña a una raíz o a π para que la clave pueda dar las dos.
 */
export function measureText(value: number, exact: Exact | null = recognize(value), options: ExactTextOptions = {}): string {
  if (!exact) return `≈ ${approxText(value)}`;
  const text = exactText(exact, options);
  return exact.r === 1 && !exact.pi ? `= ${text}` : `= ${text} ≈ ${approxText(value)}`;
}

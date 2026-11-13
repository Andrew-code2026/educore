import { formatNumberEs } from "./creatorMath";

/**
 * Cálculos de las figuras de aula del Creador de recursos (diagrama de árbol, Venn, reloj,
 * pictograma, bloques de base 10). Funciones puras: las usan los componentes que dibujan,
 * los formularios y los validadores, para que la probabilidad de un camino, la posición de
 * la manecilla o el número de dibujos salgan de los datos.
 */

/* ── Probabilidades del diagrama de árbol ── */

export interface Probability {
  /** Numerador y denominador, ya simplificados. */
  n: number;
  d: number;
  /** Cómo la escribió el docente o la IA: se responde en el mismo formato. */
  style: "fraction" | "decimal" | "percent";
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function reduce(n: number, d: number, style: Probability["style"]): Probability {
  const divisor = gcd(n, d) || 1;
  return { n: n / divisor, d: d / divisor, style };
}

/** Lee "1/2", "0.25", "0,25" o "25%". null si no es una probabilidad escrita así. */
export function parseProbability(text: string | undefined): Probability | null {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, "");
  const fraction = /^(\d{1,6})\/(\d{1,6})$/.exec(clean);
  if (fraction) {
    const d = Number(fraction[2]);
    return d === 0 ? null : reduce(Number(fraction[1]), d, "fraction");
  }
  const number = /^(\d{1,6})(?:[.,](\d{1,6}))?(%?)$/.exec(clean);
  if (!number) return null;
  const decimals = number[2] ?? "";
  const scale = Math.pow(10, decimals.length);
  const percent = number[3] === "%";
  return reduce(Number(number[1]) * scale + Number(decimals || 0), scale * (percent ? 100 : 1), percent ? "percent" : "decimal");
}

export const probabilityValue = (probability: Probability): number => probability.n / probability.d;

/** Producto de las probabilidades de un camino. Sale como fracción solo si todas lo eran. */
export function multiplyProbabilities(parts: Probability[]): Probability {
  const style = parts.every(part => part.style === "fraction") ? "fraction" : parts.every(part => part.style === "percent") ? "percent" : "decimal";
  return parts.reduce<Probability>((product, part) => reduce(product.n * part.n, product.d * part.d, style), { n: 1, d: 1, style });
}

/** Suma exacta de unas probabilidades, como número. */
export function sumProbabilities(parts: Probability[]): number {
  const sum = parts.reduce((total, part) => reduce(total.n * part.d + part.n * total.d, total.d * part.d, "fraction"), { n: 0, d: 1, style: "fraction" } as Probability);
  return sum.n / sum.d;
}

/** La probabilidad como la lee el estudiante: "1/4", "0,25" o "25 %". */
export function formatProbability(probability: Probability): string {
  if (probability.style === "fraction") return probability.d === 1 ? String(probability.n) : `${probability.n}/${probability.d}`;
  if (probability.style === "percent") return `${formatNumberEs(probabilityValue(probability) * 100, 2)} %`;
  return formatNumberEs(probabilityValue(probability), 4);
}

export interface TreeNode {
  label: string;
  probability?: string;
  children?: TreeNode[];
}

export interface TreePath {
  labels: string[];
  /** Probabilidad del camino; null si a alguna rama le falta o no se entiende. */
  probability: Probability | null;
}

/** Los caminos del árbol, de la raíz a cada hoja, en el orden en que se dibujan. */
export function treePaths(branches: TreeNode[]): TreePath[] {
  const paths: TreePath[] = [];
  const walk = (node: TreeNode, labels: string[], factors: Array<Probability | null>) => {
    const nextLabels = [...labels, node.label];
    const nextFactors = [...factors, parseProbability(node.probability)];
    const children = node.children ?? [];
    if (children.length === 0) {
      const known = nextFactors.filter((factor): factor is Probability => factor !== null);
      paths.push({ labels: nextLabels, probability: known.length === nextFactors.length ? multiplyProbabilities(known) : null });
      return;
    }
    for (const child of children) walk(child, nextLabels, nextFactors);
  };
  for (const branch of branches) walk(branch, [], []);
  return paths;
}

/** Grupos de ramas hermanas (las que salen del mismo punto), para revisar que sumen 1. */
export function siblingGroups(branches: TreeNode[]): Array<{ parent: string; nodes: TreeNode[] }> {
  const groups: Array<{ parent: string; nodes: TreeNode[] }> = [{ parent: "el inicio", nodes: branches }];
  const walk = (node: TreeNode) => {
    const children = node.children ?? [];
    if (children.length === 0) return;
    groups.push({ parent: `«${node.label}»`, nodes: children });
    children.forEach(walk);
  };
  branches.forEach(walk);
  return groups;
}

/**
 * El árbol como esquema de texto, que es como lo escribe el docente en el formulario: una
 * rama por renglón, dos espacios de sangría por nivel y, al final, la probabilidad.
 */
export function treeToText(branches: TreeNode[]): string {
  const lines: string[] = [];
  const walk = (node: TreeNode, depth: number) => {
    lines.push(`${"  ".repeat(depth)}${node.label}${node.probability ? ` ${node.probability}` : ""}`);
    (node.children ?? []).forEach(child => walk(child, depth + 1));
  };
  branches.forEach(branch => walk(branch, 0));
  return lines.join("\n");
}

/** Lee el esquema de texto. La última palabra de un renglón es la probabilidad si tiene forma de serlo. */
export function textToTree(text: string, maxDepth = 3): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: Array<{ depth: number; node: TreeNode }> = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const indent = /^\s*/.exec(raw.replace(/\t/g, "  "))?.[0].length ?? 0;
    const words = raw.trim().split(/\s+/);
    const last = words[words.length - 1];
    // "Bola 2" es un nombre; "Roja 2/5" lleva probabilidad: solo cuenta si tiene barra, coma, punto o %
    const hasProbability = words.length > 1 && /[/.,%]/.test(last) && parseProbability(last) !== null;
    const node: TreeNode = { label: (hasProbability ? words.slice(0, -1) : words).join(" "), ...(hasProbability ? { probability: last } : {}), children: [] };
    // La sangría manda: un renglón cuelga del último que tenga menos sangría que él
    while (stack.length > 0 && stack[stack.length - 1].depth >= indent) stack.pop();
    // Más sangría de la que admite el árbol: el renglón queda en el último nivel
    while (stack.length > maxDepth - 1) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children!.push(node);
    stack.push({ depth: indent, node });
  }
  return roots;
}

/* ── Diagrama de Venn ── */

export const VENN_REGIONS = ["a", "b", "c", "ab", "ac", "bc", "abc", "outside"] as const;
export type VennRegion = (typeof VENN_REGIONS)[number];

/** Zonas que existen con dos o con tres conjuntos. */
export const vennRegionsFor = (sets: number): VennRegion[] => (sets >= 3 ? ["a", "b", "c", "ab", "ac", "bc", "abc", "outside"] : ["a", "b", "ab", "outside"]);

/** Nombre de una zona con los nombres de los conjuntos: "solo Fútbol", "Fútbol y Baloncesto". */
export function vennRegionName(region: VennRegion, sets: string[]): string {
  if (region === "outside") return "fuera de los conjuntos";
  const names = Array.from(region).map(letter => sets["abc".indexOf(letter)] ?? letter.toUpperCase());
  return names.length === 1 ? `solo ${names[0]}` : names.length === 2 ? `${names[0]} y ${names[1]}` : names.join(", ").replace(/, ([^,]*)$/, " y $1");
}

/**
 * Caracteres por renglón que caben en cada zona. Las zonas de dentro llevan hasta dos
 * renglones; la de fuera, uno solo, y con tres conjuntos comparte el borde inferior con el
 * nombre del tercero.
 */
export function vennZoneChars(region: VennRegion, sets: number): number {
  if (region === "outside") return sets >= 3 ? 14 : 24;
  if (sets >= 3) return region.length === 3 ? 5 : region.length === 2 ? 6 : region === "c" ? 10 : 9;
  return region === "ab" ? 8 : 12;
}

/** Lo que cabe en el rótulo del conjunto universal, por la misma razón. */
export const vennUniverseChars = (sets: number): number => (sets >= 3 ? 14 : 24);

/* ── Modelo de barras ── */

/** Ancho mínimo de la zona de barras (con el nombre más largo a la izquierda) y de un carácter del texto de una parte. */
const BAR_MODEL_WIDTH = 380;
const BAR_MODEL_CHAR_W = 7.6;

/** true si el texto de una parte cabe dentro de ella, con la barra más larga ocupando todo el ancho. */
export function barPartFits(text: string, value: number, longest: number): boolean {
  return text.length * BAR_MODEL_CHAR_W + 6 <= (value / longest) * BAR_MODEL_WIDTH;
}

/* ── Reloj ── */

/** Ángulo de cada manecilla en grados, desde las 12 y en sentido horario. La de la hora avanza con los minutos. */
export function clockAngles(hour: number, minute: number): { hour: number; minute: number } {
  return { hour: ((hour % 12) + minute / 60) * 30, minute: minute * 6 };
}

export const clockText = (hour: number, minute: number): string => `${hour}:${String(minute).padStart(2, "0")}`;

/* ── Pictograma ── */

/** Cuántos dibujos enteros y si lleva medio. `exact` es false si la cantidad no cae en medios dibujos. */
export function pictogramIcons(value: number, iconValue: number): { full: number; half: boolean; exact: boolean } {
  if (!(iconValue > 0) || !(value >= 0)) return { full: 0, half: false, exact: false };
  const halves = (value / iconValue) * 2;
  const rounded = Math.round(halves);
  return { full: Math.floor(rounded / 2), half: rounded % 2 === 1, exact: Math.abs(halves - rounded) < 1e-9 };
}

/* ── Bloques de base 10 ── */

export const baseTenValue = (blocks: { hundreds: number; tens: number; ones: number }): number => blocks.hundreds * 100 + blocks.tens * 10 + blocks.ones;

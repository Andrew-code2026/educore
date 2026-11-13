import type { GraphFunction, GraphPoint, GraphSpec } from "./creator";
import { formatNumber, nearlyEqual, type CompiledExpression, type CurveSegment } from "./creatorMath";

/**
 * Cálculo del plano cartesiano del Creador de recursos: muestreo de curvas con sus
 * discontinuidades, dominios con extremos abiertos o cerrados y límites laterales.
 *
 * Son funciones puras, sin dibujo: las usan el componente, el formulario y el validador,
 * de modo que los círculos de un salto o el hueco de un límite salen de la función y no
 * de lo que escriba la IA.
 */

export interface PlaneRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type EndStyle = "closed" | "open" | "none";

/** Dominio declarado de una función: los campos `from`, `to`, `fromEnd` y `toEnd` del bloque. */
export type FunctionDomain = Pick<GraphFunction, "from" | "to" | "fromEnd" | "toEnd">;

/** Círculo que marca un extremo o un salto: relleno si el punto pertenece a la gráfica, vacío si no. */
export interface CurveMark {
  x: number;
  y: number;
  filled: boolean;
}

export interface SampledCurve {
  segments: CurveSegment[];
  marks: CurveMark[];
  /** Saltos finitos encontrados (los de una parte entera, los de una función a trozos). */
  jumps: number;
  /** Abscisas donde la curva se corta: saltos, asíntotas y bordes del dominio. */
  breaks: number[];
  /** La función cambia tan rápido que no se pudo seguir: lo que se dibuje no es de fiar. */
  exhausted: boolean;
}

/**
 * Proporción alto/ancho del rango con la que el plano se dibuja con la misma unidad en los
 * dos ejes (una recta de pendiente 1 a 45°, una circunferencia redonda). Fuera de ella cada
 * eje toma su propia escala para que la figura no quede como una tira.
 */
export const PLANE_EQUAL_UNITS = { min: 150 / 320, max: 320 / 150 } as const;

export const hasEqualUnits = (xSpan: number, ySpan: number): boolean => {
  const ratio = ySpan / xSpan;
  return ratio >= PLANE_EQUAL_UNITS.min && ratio <= PLANE_EQUAL_UNITS.max;
};

/* ── Números ── */

/** Tolerancia de las comparaciones de coordenadas: lo que está a menos de esto es el mismo punto. */
export const EPS = 1e-9;

/** ¿El punto cae dentro del plano (bordes incluidos)? */
export const insidePlane = (range: PlaneRange, x: number, y: number): boolean =>
  x >= range.xMin - EPS && x <= range.xMax + EPS && y >= range.yMin - EPS && y <= range.yMax + EPS;

/** Quita el ruido de un cálculo numérico: 1.9999999996 → 2, 1e-17 → 0. Un número como π queda igual. */
export function tidy(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (Math.abs(value) < 1e-10) return 0;
  const rounded = Number(value.toFixed(6));
  return Math.abs(value - rounded) <= 1e-9 * Math.max(1, Math.abs(value)) ? rounded : value;
}

/** Decimales que necesita un número para escribirse exacto, hasta `max`; null si no le alcanzan. */
export function exactDecimals(value: number, max = 8): number | null {
  if (!Number.isFinite(value)) return null;
  const size = Math.max(1, Math.abs(value));
  for (let decimals = 0; decimals <= max; decimals++) {
    if (Math.abs(value - Number(value.toFixed(decimals))) <= 1e-11 * size) return decimals;
  }
  return null;
}

/**
 * Número con coma decimal y punto de miles, con hasta `decimals` decimales y sin ceros de sobra.
 * A diferencia de `formatNumberEs`, no pasa por la notación científica: 0,0000001 sale entero.
 */
export function formatDecimalEs(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  let text = value.toFixed(Math.max(0, Math.min(20, decimals)));
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  if (/^-0(\.0*)?$/.test(text) || text === "-") text = "0";
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/**
 * Decimales con que se escriben los resultados de una tabla de valores que no son exactos.
 * Con x enteros bastan dos; cuando los x se acercan a un número (1,9; 1,99; 1,999) el
 * resultado necesita más para que se vea a dónde tiende: con dos, 0,99998 se leería 1.
 */
export function valueTableDecimals(xs: number[]): number {
  const finest = Math.max(0, ...xs.map(x => exactDecimals(x) ?? 8));
  return Math.min(8, Math.max(2, 2 * finest + 1));
}

/** Una celda de la tabla de valores: exacta si el número se puede escribir entero, y si no, redondeada a `fallback`. */
export function formatTableNumber(value: number, fallback = 2): string {
  return formatDecimalEs(value, exactDecimals(value) ?? fallback);
}

/** Decimales con que se escribe exacto un valor calculado dentro de una figura; con más ya no se lee. */
const FIGURE_DECIMALS = 4;

/** ¿El valor se puede escribir exacto en una figura? Si no, se redondea a dos decimales y se marca con ≈. */
export const isExactNumber = (value: number): boolean => exactDecimals(value, FIGURE_DECIMALS) !== null;

/** Un valor calculado como lo lee el estudiante: exacto si se puede, y si no con dos decimales. */
export const figureNumber = (value: number): string => formatDecimalEs(value, exactDecimals(value, FIGURE_DECIMALS) ?? 2);

/** Lo mismo para una fórmula: en LaTeX la coma decimal va entre llaves. */
export const figureNumberLatex = (value: number): string => figureNumber(value).replace(",", "{,}");

/* ── Dominio ── */

/** Marca de un extremo del dominio: cerrado si no se dice otra cosa. */
export const endStyle = (bound: number | undefined, style: EndStyle | undefined): EndStyle => (bound === undefined ? "none" : (style ?? "closed"));

/** ¿x pertenece al dominio declarado? Un extremo abierto no pertenece. */
export function inDomain(domain: FunctionDomain, x: number): boolean {
  const { from, to } = domain;
  if (from !== undefined) {
    if (x < from - EPS) return false;
    if (Math.abs(x - from) <= EPS && endStyle(from, domain.fromEnd) === "open") return false;
  }
  if (to !== undefined) {
    if (x > to + EPS) return false;
    if (Math.abs(x - to) <= EPS && endStyle(to, domain.toEnd) === "open") return false;
  }
  return true;
}

/** La función limitada a su dominio: fuera de él no está definida. */
export const restrictToDomain =
  (fn: CompiledExpression, domain: FunctionDomain): CompiledExpression =>
  x =>
    inDomain(domain, x) ? fn(x) : NaN;

/** Colores de la paleta de curvas del plano. */
export const PLANE_COLORS = 4;

const touches = (a: FunctionDomain, b: FunctionDomain) =>
  (a.to !== undefined && b.from !== undefined && Math.abs(a.to - b.from) <= EPS) || (a.from !== undefined && b.to !== undefined && Math.abs(a.from - b.to) <= EPS);

/**
 * Color de cada función del plano. La que lo fija lo conserva; las demás toman el de su
 * posición, salvo que su dominio empiece donde termina el de una función anterior: entonces
 * son trozos de la misma función y comparten color, aunque nadie lo haya indicado.
 */
export function functionColors(functions: GraphFunction[]): number[] {
  const colors: number[] = [];
  functions.forEach((fn, index) => {
    if (fn.color !== undefined) {
      colors[index] = fn.color % PLANE_COLORS;
      return;
    }
    const previous = functions.findIndex((other, position) => position < index && touches(other, fn));
    colors[index] = previous === -1 ? index % PLANE_COLORS : colors[previous];
  });
  return colors;
}

/* ── Límites laterales ── */

/**
 * Límite de la función en x por un lado (−1 izquierda, 1 derecha), o null si no tiende a un
 * número. Se evalúa cada vez más cerca y se exige que las diferencias se achiquen de forma
 * sostenida; el valor se afina con la extrapolación de Aitken, que acierta tanto con
 * (x² − 1)/(x − 1) como con √x o sen(x)/x.
 */
export function oneSidedLimit(fn: CompiledExpression, x: number, side: -1 | 1): number | null {
  const scale = Math.max(1, Math.abs(x));
  const values = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7].map(delta => fn(x + side * delta * scale));
  if (!values.every(Number.isFinite)) return null;
  const [, v1, v2, v3, v4] = values;
  const d2 = v2 - v1;
  const d3 = v3 - v2;
  const d4 = v4 - v3;
  const size = Math.max(1, Math.abs(v4));
  if (Math.abs(d4) <= 1e-8 * size && Math.abs(d3) <= 1e-6 * size) return tidy(v4);
  // Converge si cada paso se acerca más que el anterior
  if (!(Math.abs(d4) <= 0.7 * Math.abs(d3) && Math.abs(d3) <= 0.7 * Math.abs(d2))) return null;
  const limit = v4 - (d4 * d4) / (d4 - d3);
  if (!Number.isFinite(limit) || Math.abs(limit - v4) > 10 * Math.abs(d4)) return null;
  return tidy(limit);
}

/* ── Muestreo ── */

const BASE_SAMPLES = 240;
/** Niveles de subdivisión donde la curva sube o baja rápido: 64 veces más fino. */
const REFINE_DEPTH = 6;
const BISECT_STEPS = 60;
const EVALUATION_BUDGET = 60_000;

/**
 * Muestrea una función para dibujarla dentro del plano y de su dominio.
 *
 * Donde la curva cambia rápido se afina el muestreo, y cada cambio brusco se persigue por
 * bisección hasta saber qué es: si la diferencia se desvanece, la curva es continua; si no,
 * es un salto o una asíntota y la curva se corta justo ahí. En un salto, cada lado llega
 * hasta su límite lateral y lleva su círculo: relleno donde está el valor de la función y
 * vacío donde no (así se dibuja la parte entera).
 */
export function sampleFunction(source: CompiledExpression, range: PlaneRange, domain: FunctionDomain = {}): SampledCurve {
  const { xMin, xMax, yMin, yMax } = range;
  const lo = Math.max(xMin, domain.from ?? -Infinity);
  const hi = Math.min(xMax, domain.to ?? Infinity);
  const height = yMax - yMin;
  const result: SampledCurve = { segments: [], marks: [], jumps: 0, breaks: [], exhausted: false };
  if (!(lo < hi) || !(height > 0)) return result;

  let evaluations = 0;
  const fn = (x: number) => {
    evaluations++;
    return inDomain(domain, x) ? source(x) : NaN;
  };

  const scale = Math.max(1, Math.abs(lo), Math.abs(hi));
  // En el borde del plano la función sigue: ahí no hay extremo que marcar ni lado de fuera que dibujar
  const loIsPlaneEdge = domain.from === undefined || domain.from < xMin;
  const hiIsPlaneEdge = domain.to === undefined || domain.to > xMax;
  // Un cambio de más de un par de píxeles entre muestras vecinas se mira de cerca: así también se
  // encuentran los saltos pequeños (los de floor(x)/2 en un plano alto), no solo los grandes
  const steep = height / 160;
  /** Diferencia que ya no se ve en el dibujo: por debajo, la curva es continua. */
  const tolerance = height * 1e-3;
  const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  // Fuera del plano se conserva un margen para que la curva salga por el borde y no se corte antes
  const farLo = yMin - height;
  const farHi = yMax + height;
  const sideOf = (y: number) => (y < farLo ? -1 : y > farHi ? 1 : 0);

  let current: Array<[number, number]> = [];
  /** Último punto fuera del margen: si la curva vuelve a entrar, arranca desde él. */
  let pending: [number, number] | null = null;
  const flush = () => {
    if (current.length > 1) result.segments.push({ points: current });
    current = [];
  };
  const cut = () => {
    flush();
    pending = null;
  };
  const emit = (x: number, y: number) => {
    if (!Number.isFinite(y)) return cut();
    if (sideOf(y) !== 0) {
      const clamped: [number, number] = [x, Math.min(Math.max(y, farLo), farHi)];
      if (current.length > 0) {
        current.push(clamped);
        flush();
      }
      pending = clamped;
      return;
    }
    if (current.length === 0 && pending) current.push(pending);
    pending = null;
    current.push([x, y]);
  };

  /** Puntos desde `fromX` hacia `c`, cada vez más cerca, hasta que la curva sale del margen: el camino hacia una asíntota. */
  const approach = (fromX: number, c: number): Array<[number, number]> => {
    const points: Array<[number, number]> = [];
    for (let k = 1; k <= 48; k++) {
      const x = c + (fromX - c) / 2 ** k;
      if (x === c) break;
      const y = fn(x);
      if (!Number.isFinite(y)) break;
      points.push([x, y]);
      if (sideOf(y) !== 0) break;
    }
    return points;
  };

  /** Un número redondo dentro del intervalo, si lo hay: el salto de una parte entera cae en él exactamente. */
  const pick = (a: number, b: number): { c: number; exact: boolean } => {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const round = Number(((low + high) / 2).toFixed(9));
    return round >= low - 1e-12 * scale && round <= high + 1e-12 * scale ? { c: round === 0 ? 0 : round, exact: true } : { c: (low + high) / 2, exact: false };
  };

  const breakAt = (a: number, b: number, x0: number, x1: number) => {
    const { c, exact } = pick(a, b);
    const atLeftEdge = loIsPlaneEdge && c <= lo + EPS * scale;
    const atRightEdge = hiIsPlaneEdge && c >= hi - EPS * scale;
    const left = oneSidedLimit(fn, c, -1);
    const right = oneSidedLimit(fn, c, 1);
    if (!atLeftEdge) {
      if (left !== null) emit(c, left);
      else for (const [x, y] of approach(x0, c)) emit(x, y);
    }
    cut();
    if (!atRightEdge) {
      if (right !== null) emit(c, right);
      else for (const [x, y] of approach(x1, c).reverse()) emit(x, y);
    }
    // En el borde del plano la curva llega hasta él, pero no hay corte que contar ni círculos que poner
    if (atLeftEdge || atRightEdge) return;
    if (!result.breaks.some(other => Math.abs(other - c) <= EPS * scale)) result.breaks.push(c);

    if (left !== null && right !== null) {
      // El mismo límite por los dos lados: un hueco, que solo se marca si alguien pone el punto vacío
      if (near(left, right)) return;
      result.jumps++;
    }
    // El círculo relleno va donde está el valor de la función; solo se sabe si el salto cae en un número exacto
    if (!exact) return;
    const value = fn(c);
    if (left !== null && right !== null) {
      result.marks.push({ x: c, y: left, filled: near(value, left) }, { x: c, y: right, filled: near(value, right) });
      if (Number.isFinite(value) && !near(value, left) && !near(value, right)) result.marks.push({ x: c, y: value, filled: true });
    } else {
      const limit = left ?? right;
      if (limit !== null && Number.isFinite(value) && !near(value, limit)) result.marks.push({ x: c, y: limit, filled: false }, { x: c, y: value, filled: true });
    }
  };

  /** Qué pasa dentro de un intervalo ya muy fino donde la curva sigue cambiando de golpe. */
  const resolve = (x0: number, y0: number, x1: number, y1: number): void => {
    const finite0 = Number.isFinite(y0);
    const finite1 = Number.isFinite(y1);
    if (finite0 && finite1) {
      // Se sigue la mitad con la diferencia mayor: en una función continua la diferencia se desvanece
      let a = x0;
      let ya = y0;
      let b = x1;
      let yb = y1;
      for (let i = 0; i < BISECT_STEPS && Math.abs(yb - ya) > tolerance && b - a > 1e-13 * scale; i++) {
        const m = (a + b) / 2;
        const ym = fn(m);
        if (!Number.isFinite(ym)) {
          // Un punto sin definir en medio: cada lado se resuelve por separado
          resolve(x0, y0, m, ym);
          emit(m, ym);
          resolve(m, ym, x1, y1);
          return;
        }
        if (Math.abs(ym - ya) >= Math.abs(yb - ym)) {
          b = m;
          yb = ym;
        } else {
          a = m;
          ya = ym;
        }
      }
      if (Math.abs(yb - ya) > tolerance) breakAt(a, b, x0, x1);
      return;
    }
    // Borde del dominio: de un lado la función existe y del otro no
    let inside = finite0 ? x0 : x1;
    let outside = finite0 ? x1 : x0;
    for (let i = 0; i < BISECT_STEPS && Math.abs(outside - inside) > 1e-13 * scale; i++) {
      const m = (inside + outside) / 2;
      if (Number.isFinite(fn(m))) inside = m;
      else outside = m;
    }
    breakAt(inside, outside, x0, x1);
  };

  const visit = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
    const finite0 = Number.isFinite(y0);
    const finite1 = Number.isFinite(y1);
    if (!finite0 && !finite1) return;
    const sameSideOut = finite0 && finite1 && sideOf(y0) !== 0 && sideOf(y0) === sideOf(y1);
    if (finite0 === finite1 && (sameSideOut || Math.abs(y1 - y0) <= steep)) return;
    if (evaluations > EVALUATION_BUDGET) {
      result.exhausted = true;
      return;
    }
    if (depth >= REFINE_DEPTH) return resolve(x0, y0, x1, y1);
    const xm = (x0 + x1) / 2;
    const ym = fn(xm);
    visit(x0, y0, xm, ym, depth + 1);
    emit(xm, ym);
    visit(xm, ym, x1, y1, depth + 1);
  };

  let px = lo;
  let py = fn(lo);
  emit(px, py);
  for (let i = 1; i <= BASE_SAMPLES; i++) {
    const x = i === BASE_SAMPLES ? hi : lo + ((hi - lo) * i) / BASE_SAMPLES;
    const y = fn(x);
    visit(px, py, x, y, 0);
    emit(x, y);
    px = x;
    py = y;
  }
  cut();

  // Extremos del dominio declarado: relleno con el valor de la función, vacío con su límite
  const ends: Array<[number | undefined, EndStyle, -1 | 1]> = [
    [domain.from, endStyle(domain.from, domain.fromEnd), 1],
    [domain.to, endStyle(domain.to, domain.toEnd), -1],
  ];
  for (const [bound, style, inward] of ends) {
    if (bound === undefined || style === "none" || bound < xMin - EPS || bound > xMax + EPS) continue;
    const y = style === "closed" ? source(bound) : oneSidedLimit(fn, bound, inward);
    if (y !== null && Number.isFinite(y)) result.marks.push({ x: bound, y, filled: style === "closed" });
  }

  result.marks = dedupeMarks(result.marks, tolerance);
  return result;
}

/** Un solo círculo por sitio; si coinciden uno relleno y uno vacío, queda el relleno. */
function dedupeMarks(marks: CurveMark[], tolerance: number): CurveMark[] {
  const kept: CurveMark[] = [];
  for (const mark of marks) {
    const twin = kept.find(other => Math.abs(other.x - mark.x) <= EPS * Math.max(1, Math.abs(mark.x)) && Math.abs(other.y - mark.y) <= tolerance);
    if (!twin) kept.push({ ...mark });
    else if (mark.filled) twin.filled = true;
  }
  return kept;
}

/* ── Comprobaciones para el validador ── */

/** Más saltos que estos en un plano ya no se distinguen. */
const JUMPS_MAX = 40;

const inside = (value: number, min: number, max: number) => value >= min - EPS && value <= max + EPS;

/** Problemas de una función del plano que ya compila: dominio, extremos y si se llega a ver. */
export function planeFunctionIssues(spec: GraphSpec, index: number, source: CompiledExpression): string[] {
  const fn = spec.functions[index];
  const name = `la función ${index} ("${fn.expr}")`;
  if (fn.fromEnd !== undefined && fn.from === undefined) return [`Gráfica: ${name} indica cómo es el extremo izquierdo (fromEnd) pero no dónde empieza (from).`];
  if (fn.toEnd !== undefined && fn.to === undefined) return [`Gráfica: ${name} indica cómo es el extremo derecho (toEnd) pero no dónde termina (to).`];
  if (fn.from !== undefined && fn.to !== undefined && !(fn.from < fn.to)) return [`Gráfica: en ${name}, el inicio del dominio (from) debe ser menor que el final (to).`];
  if ((fn.from !== undefined && fn.from >= spec.xMax) || (fn.to !== undefined && fn.to <= spec.xMin)) {
    return [`Gráfica: el dominio de ${name} queda fuera del plano, que va de x = ${formatNumber(spec.xMin, 4)} a x = ${formatNumber(spec.xMax, 4)}.`];
  }

  const issues: string[] = [];
  const curve = sampleFunction(source, spec, fn);
  if (curve.exhausted) issues.push(`Gráfica: ${name} cambia demasiado rápido para dibujarla bien en este rango; reduce el rango de x o simplifica la función.`);
  // La curva debe verse: al menos un tramo dentro del plano
  const visible = curve.segments.some(segment => segment.points.some(([, y]) => y >= spec.yMin && y <= spec.yMax));
  if (!visible) issues.push(`Gráfica: la función ${index} ("${fn.expr}") no se ve en el rango elegido; ajusta yMin/yMax.`);
  if (curve.jumps > JUMPS_MAX) issues.push(`Gráfica: ${name} tiene ${curve.jumps} saltos en este rango y no se distinguen; reduce el rango de x.`);

  const restricted = restrictToDomain(source, fn);
  const ends: Array<[number | undefined, EndStyle, -1 | 1, string]> = [
    [fn.from, endStyle(fn.from, fn.fromEnd), 1, "fromEnd"],
    [fn.to, endStyle(fn.to, fn.toEnd), -1, "toEnd"],
  ];
  for (const [bound, style, inward, field] of ends) {
    if (bound === undefined || style === "none" || !inside(bound, spec.xMin, spec.xMax)) continue;
    const y = style === "closed" ? source(bound) : oneSidedLimit(restricted, bound, inward);
    if (style === "closed" && !Number.isFinite(y)) {
      issues.push(`Gráfica: ${name} no está definida en x = ${formatNumber(bound, 4)}, así que ese extremo no puede ser cerrado; usa ${field} "open" o "none".`);
    } else if (y !== null && Number.isFinite(y) && !inside(y, spec.yMin, spec.yMax)) {
      issues.push(`Gráfica: el extremo (${formatNumber(bound, 4)}, ${formatNumber(y, 4)}) de ${name} queda fuera del plano; amplía yMin/yMax.`);
    }
  }
  return issues;
}

/**
 * Problema de un punto que dice estar sobre una función, o null. Un punto relleno debe
 * coincidir con el valor de la función; uno vacío (un hueco), con su límite en ese x.
 */
export function planePointIssue(point: GraphPoint, fn: GraphFunction, source: CompiledExpression): string | null {
  const name = `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
  const at = formatNumber(point.x, 4);
  const restricted = restrictToDomain(source, fn);
  if (point.open) {
    const left = oneSidedLimit(restricted, point.x, -1);
    const right = oneSidedLimit(restricted, point.x, 1);
    if (left === null && right === null) return `Gráfica: el punto vacío ${name} no puede ir sobre "${fn.expr}": la función no tiende a un número en x = ${at}.`;
    if ((left !== null && nearlyEqual(left, point.y)) || (right !== null && nearlyEqual(right, point.y))) return null;
    const limits =
      left !== null && right !== null && !nearlyEqual(left, right)
        ? `por la izquierda tiende a ${formatNumber(left, 4)} y por la derecha a ${formatNumber(right, 4)}`
        : `tiende a ${formatNumber((left ?? right)!, 4)}`;
    return `Gráfica: el punto vacío ${name} no coincide con el límite de "${fn.expr}" en x = ${at}: la función ${limits}. Corrige el punto.`;
  }
  if (!inDomain(fn, point.x)) return `Gráfica: el punto ${name} dice estar sobre "${fn.expr}", pero x = ${at} no pertenece al dominio de ese trozo. Corrige el punto o márcalo como vacío (open).`;
  const expected = source(point.x);
  if (nearlyEqual(expected, point.y)) return null;
  if (!Number.isFinite(expected)) return `Gráfica: el punto ${name} no puede ir relleno sobre "${fn.expr}": la función no está definida en x = ${at}. Si es un hueco, márcalo como vacío (open).`;
  return `Gráfica: el punto ${name} no está sobre "${fn.expr}": en x = ${at} la función vale ${formatNumber(expected, 4)}. Corrige el punto.`;
}

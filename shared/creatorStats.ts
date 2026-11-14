import type { BlockInput } from "./creator";
import { areaModelProduct, computeAreaModel, monomialText, polynomialText } from "./creatorAlgebra";
import { niceStep, tickValues } from "./creatorFigures";
import { describeGraph } from "./creatorGraphFacts";
import { describeTriangles } from "./creatorTriangle";
import { describeUnitCircle } from "./creatorUnitCircle";
import { formatNumber, formatNumberEs } from "./creatorMath";

/**
 * Estadística de las figuras del Creador de recursos: resumen de cinco números, conteo por
 * clases y recta de mínimos cuadrados. Son funciones puras, sin dibujo: las usan los
 * componentes, los formularios y los validadores, de modo que la caja, las barras del
 * histograma y la recta de tendencia salen siempre de los datos y no de lo que escriba la IA.
 */

/** Quita el ruido binario de una operación ((0.1 + 0.2) / 2) sin perder precisión útil. */
const clean = (value: number) => Number(value.toPrecision(12));

export const sortAscending = (data: number[]): number[] => [...data].sort((a, b) => a - b);

/** Mediana de una lista ya ordenada; NaN si está vacía. */
export function medianOfSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const middle = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[middle] : clean((sorted[middle - 1] + sorted[middle]) / 2);
}

export interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/**
 * Resumen de cinco números de unos datos crudos, en cualquier orden.
 *
 * Método de cuartiles: la mediana de cada mitad (Moore y McCabe). Se ordenan los datos y se
 * parten por la mediana; Q1 es la mediana de la mitad inferior y Q3 la de la superior. Con
 * un número impar de datos, la mediana central no entra en ninguna de las dos mitades.
 *
 * Es el método que se hace a mano en clase y el de las calculadoras escolares. No interpola
 * por posición como una hoja de cálculo: con 1, 2, …, 9 da Q1 = 2,5 y Q3 = 7,5, mientras que
 * CUARTIL.INC da 3 y 7. Los bigotes llegan al mínimo y al máximo; no se separan atípicos.
 */
export function fiveNumberSummary(data: number[]): FiveNumberSummary | null {
  const sorted = sortAscending(data.filter(Number.isFinite));
  const n = sorted.length;
  if (n < 2) return null;
  const half = Math.floor(n / 2);
  return {
    min: sorted[0],
    q1: medianOfSorted(sorted.slice(0, half)),
    median: medianOfSorted(sorted),
    q3: medianOfSorted(sorted.slice(n - half)),
    max: sorted[n - 1],
  };
}

export interface TrendLine {
  slope: number;
  intercept: number;
  /** Coeficiente de correlación de Pearson; 0 si todas las y son iguales. */
  r: number;
}

/**
 * Recta de mejor ajuste y = slope·x + intercept por mínimos cuadrados.
 * null si no hay recta: menos de dos puntos, o todos con la misma x.
 */
export function linearRegression(points: Array<{ x: number; y: number }>): TrendLine | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const scale = Math.max(1, ...points.map(point => Math.abs(point.x)));
  if (!(sxx > 1e-18 * scale * scale)) return null;
  const slope = sxy / sxx;
  return { slope: clean(slope), intercept: clean(meanY - slope * meanX), r: syy > 0 ? clean(sxy / Math.sqrt(sxx * syy)) : 0 };
}

/** Decimales con los que se escribe un coeficiente: dos, o los que hagan falta para que uno pequeño no quede en cero. */
function coefficientDecimals(value: number): number {
  const size = Math.abs(value);
  if (size === 0 || size >= 0.1) return 2;
  return Math.min(6, Math.ceil(-Math.log10(size)) + 2);
}

function trendLineParts(line: TrendLine, format: (value: number, decimals: number) => string) {
  const slope = Number(line.slope.toFixed(coefficientDecimals(line.slope)));
  const intercept = Number(line.intercept.toFixed(coefficientDecimals(line.intercept)));
  const number = (value: number) => format(Math.abs(value), coefficientDecimals(value));
  const term = slope === 0 ? "" : `${slope < 0 ? "-" : ""}${Math.abs(slope) === 1 ? "" : number(slope)}x`;
  if (!term) return `y = ${intercept < 0 ? "-" : ""}${number(intercept)}`;
  if (intercept === 0) return `y = ${term}`;
  return `y = ${term} ${intercept < 0 ? "-" : "+"} ${number(intercept)}`;
}

/** La recta como la lee el estudiante, con coma decimal: "y = 0,9x + 1,3". */
export const trendLineText = (line: TrendLine): string => trendLineParts(line, formatNumberEs);

/** La misma ecuación en LaTeX, para dibujarla dentro de la figura: "y = 0{,}9x + 1{,}3". */
export const trendLineLatex = (line: TrendLine): string => trendLineParts(line, (value, decimals) => formatNumberEs(value, decimals).replace(",", "{,}"));

/* ── Histograma ── */

const sameNumber = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Cuántos datos caen en cada clase. Las clases son intervalos [from, to): un dato que coincide
 * con un límite cuenta en la clase que empieza ahí. La última clase incluye también su límite
 * superior, para que el dato más alto no se quede por fuera.
 */
export function histogramCounts(data: number[], classes: Array<{ from: number; to: number }>): { counts: number[]; outside: number[] } {
  const counts = classes.map(() => 0);
  const outside: number[] = [];
  const last = classes.length - 1;
  for (const value of data) {
    const index = classes.findIndex((item, at) => {
      const aboveFrom = value > item.from || sameNumber(value, item.from);
      const belowTo = at === last ? value < item.to || sameNumber(value, item.to) : value < item.to && !sameNumber(value, item.to);
      return aboveFrom && belowTo;
    });
    if (index === -1) outside.push(value);
    else counts[index]++;
  }
  return { counts, outside };
}

/** Problemas de forma de las clases: límites invertidos, huecos o solapes, y anchos distintos. */
export function histogramClassIssues(classes: Array<{ from: number; to: number }>): string[] {
  const issues: string[] = [];
  classes.forEach((item, index) => {
    if (!(item.from < item.to)) issues.push(`la clase ${index + 1} va de ${formatNumber(item.from, 4)} a ${formatNumber(item.to, 4)}: el límite inferior (from) debe ser menor que el superior (to).`);
  });
  if (issues.length > 0) return issues;
  for (let index = 1; index < classes.length; index++) {
    if (!sameNumber(classes[index].from, classes[index - 1].to)) {
      issues.push(
        `la clase ${index + 1} empieza en ${formatNumber(classes[index].from, 4)} y la anterior termina en ${formatNumber(classes[index - 1].to, 4)}: las clases deben ser contiguas, cada una empieza donde termina la anterior.`,
      );
    }
  }
  if (issues.length > 0) return issues;
  const width = classes[0].to - classes[0].from;
  const uneven = classes.findIndex(item => Math.abs(item.to - item.from - width) > 1e-9 * Math.max(1, Math.abs(width)));
  if (uneven !== -1) {
    issues.push(
      `la clase ${uneven + 1} mide ${formatNumber(classes[uneven].to - classes[uneven].from, 4)} y la primera ${formatNumber(width, 4)}: todas las clases deben tener el mismo ancho, o la altura de la barra deja de representar la frecuencia.`,
    );
  }
  return issues;
}

/** Clases contiguas del mismo ancho a partir del límite inferior: lo que arma el formulario del docente. */
export function buildHistogramClasses(start: number, width: number, frequencies: number[]): Array<{ from: number; to: number; frequency: number }> {
  return frequencies.map((frequency, index) => ({ from: clean(start + index * width), to: clean(start + (index + 1) * width), frequency }));
}

/* ── Ejes ── */

export interface AxisOverride {
  min?: number;
  max?: number;
  step?: number;
}

export interface Axis {
  min: number;
  max: number;
  step: number;
}

/**
 * Eje "redondo" que cubre los datos. Arranca en cero cuando los datos quedan cerca de él
 * (un eje que empieza en 37 exagera las diferencias); si están lejos, en el múltiplo del
 * paso más cercano por debajo.
 */
export function niceAxis(dataMin: number, dataMax: number, target = 6): Axis {
  let lo = Math.min(dataMin, dataMax);
  let hi = Math.max(dataMin, dataMax);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 10, step: 2 };
  if (hi === lo) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.5;
    lo -= pad;
    hi += pad;
  }
  if (lo >= 0 && lo <= hi * 0.5) lo = 0;
  if (hi <= 0 && hi >= lo * 0.5) hi = 0;
  const step = niceStep(hi - lo, target);
  const min = clean(Math.floor(lo / step + 1e-9) * step);
  const max = clean(Math.ceil(hi / step - 1e-9) * step);
  return { min, max: max > min ? max : clean(min + step), step };
}

/** El eje que se dibuja: el automático, con lo que el docente o la IA hayan fijado a mano. */
export function resolveAxis(dataMin: number, dataMax: number, override: AxisOverride = {}, target = 6): Axis {
  const auto = niceAxis(dataMin, dataMax, target);
  const min = override.min ?? auto.min;
  let max = override.max ?? auto.max;
  const manual = override.min !== undefined || override.max !== undefined;
  let step = override.step ?? (manual && max > min ? niceStep(max - min, target) : auto.step);
  if (!(step > 0)) step = auto.step;
  // Un rango invertido lo señala el validador; aquí solo se evita dividir por cero al dibujar
  if (!(max > min)) max = clean(min + step);
  return { min, max, step };
}

/** Marcas que se llegan a dibujar en un eje; el validador admite muchas menos. */
const TICKS_DRAWN_MAX = 200;

/**
 * Marcas de un eje para dibujarlo. Un paso absurdo (un 0.0001 a medio escribir en el formulario)
 * no genera miles de marcas: se dibuja con un paso redondo y el validador se encarga del aviso.
 */
export function axisTicks(axis: Axis): number[] {
  const step = (axis.max - axis.min) / axis.step > TICKS_DRAWN_MAX ? niceStep(axis.max - axis.min) : axis.step;
  return tickValues(axis.min, axis.max, step);
}

/* ── Rótulos sobre una recta ── */

/**
 * Centros de unos rótulos puestos en fila, sin que se pisen. Cada rótulo quiere quedar en su
 * `x`; los que chocan se agrupan y el grupo se centra sobre lo que pedían sus rótulos, de modo
 * que se apartan lo mínimo y conservan el orden. Los rótulos llegan ordenados por `x`.
 */
export function spreadLabels(items: Array<{ x: number; w: number }>, gap: number, lo = -Infinity, hi = Infinity): number[] {
  interface Group {
    from: number;
    to: number;
    width: number;
    start: number;
  }
  const place = (from: number, to: number): Group => {
    let width = 0;
    let wanted = 0;
    for (let i = from; i <= to; i++) {
      // Lo que cada rótulo pide como inicio del grupo, para quedar centrado en su x
      wanted += items[i].x - (width + items[i].w / 2);
      width += items[i].w + (i < to ? gap : 0);
    }
    const start = Math.min(Math.max(wanted / (to - from + 1), lo), Math.max(lo, hi - width));
    return { from, to, width, start };
  };
  const groups: Group[] = [];
  items.forEach((_, index) => {
    let group = place(index, index);
    while (groups.length > 0 && groups[groups.length - 1].start + groups[groups.length - 1].width + gap > group.start) {
      group = place(groups.pop()!.from, group.to);
    }
    groups.push(group);
  });
  const centers: number[] = [];
  for (const group of groups) {
    let cursor = group.start;
    for (let i = group.from; i <= group.to; i++) {
      centers.push(cursor + items[i].w / 2);
      cursor += items[i].w + gap;
    }
  }
  return centers;
}

/* ── Lo que el sistema calculó, para devolvérselo a la IA ── */

/**
 * Valores que el sistema calculó de un bloque, en una línea. La herramienta se los devuelve
 * al modelo para que la clave de respuestas use exactamente los que muestra la figura, y
 * escritos igual que en ella (coma decimal): el modelo los copia tal cual en el texto.
 */
export function describeComputed(block: BlockInput): string | null {
  switch (block.type) {
    case "box_plot": {
      const parts = block.series.map(series => {
        const summary = fiveNumberSummary(series.data);
        if (!summary) return null;
        const name = series.label ? `«${series.label}»: ` : "";
        return `${name}mínimo ${formatNumberEs(summary.min)} · Q1 ${formatNumberEs(summary.q1)} · mediana ${formatNumberEs(summary.median)} · Q3 ${formatNumberEs(summary.q3)} · máximo ${formatNumberEs(summary.max)}`;
      });
      const known = parts.filter(Boolean);
      return known.length > 0 ? `Caja y bigotes${block.title ? ` «${block.title}»` : ""}: ${known.join("; ")}.` : null;
    }
    case "scatter_plot": {
      if (!block.trendLine) return null;
      const line = linearRegression(block.points);
      return line ? `Dispersión${block.title ? ` «${block.title}»` : ""}: recta de tendencia ${trendLineText(line)} (r = ${formatNumberEs(line.r)}).` : null;
    }
    case "histogram": {
      const total = block.classes.reduce((sum, item) => sum + item.frequency, 0);
      return `Histograma${block.title ? ` «${block.title}»` : ""}: ${total} datos en ${block.classes.length} clases.`;
    }
    case "graph":
      return describeGraph(block.spec);
    case "area_model": {
      const model = computeAreaModel(block.rows, block.columns);
      if (!model) return null;
      const cells = model.cells.map(row => row.map(cell => monomialText(cell)).join(", ")).join(" | ");
      return `Modelo de área: ${areaModelProduct(model)} = ${polynomialText(model.total)}; celdas por filas: ${cells}.`;
    }
    case "triangle":
      return describeTriangles(block);
    case "unit_circle":
      return describeUnitCircle(block);
    default:
      return null;
  }
}

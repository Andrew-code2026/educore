import { CREATOR_LIMITS, type BlockInput } from "./creator";
import { gcd } from "./creatorDiagrams";
import { roundPercents } from "./creatorFigures";
import { formatNumber } from "./creatorMath";
import { figureNumber, formatTableNumber, isExactNumber } from "./creatorPlane";
import { buildHistogramClasses, histogramCounts } from "./creatorStats";

/**
 * Tablas estadísticas del Creador de recursos (la tabla de frecuencias y la de contingencia) y las
 * medidas de tendencia central y de dispersión de unos datos. Igual que en las figuras estadísticas,
 * la IA da los datos y el sistema calcula cada celda: los conteos, las frecuencias relativas y
 * acumuladas, los totales, la media, la mediana, la moda y las probabilidades condicionales salen de
 * aquí y nunca del texto del modelo. La vista, el formulario, el validador y lo que se le devuelve a
 * la IA usan las mismas funciones, así que la clave de respuestas dice lo mismo que la hoja.
 *
 * creatorStats.ts importa este módulo para describeComputed y este importa de allí el conteo por
 * clases. Las funciones de un lado solo se llaman dentro de funciones del otro, nunca al cargar el
 * módulo, así que ese ciclo no tiene efecto.
 */

type FrequencyTableSpec = Extract<BlockInput, { type: "frequency_table" }>;
type ContingencyTableSpec = Extract<BlockInput, { type: "contingency_table" }>;

/** Quita el ruido binario de una operación sin perder precisión útil (el mismo criterio de creatorStats.ts). */
const clean = (value: number) => Number(value.toPrecision(12));

/** Comparación de rótulos: sin espacios de sobra ni distinción de mayúsculas. */
const sameLabel = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
const isTotalLabel = (label: string) => sameLabel(label, "Total");

/** «2», «2 y 4», «1, 3 y 5»; delante de i- o hi- va «e»: «Arte e Inglés». */
export function joinEs(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const last = items[items.length - 1];
  const and = /^h?[ií](?![aeiouáéíóú])/i.test(last) ? "e" : "y";
  return `${items.slice(0, -1).join(", ")} ${and} ${last}`;
}

/* ── Medidas de tendencia central y de dispersión ── */

export interface ValueCount {
  value: number;
  count: number;
}

/** Los valores distintos de unos datos, de menor a mayor, con cuántas veces aparece cada uno. */
export function distributionOf(data: readonly number[]): ValueCount[] {
  const counts = new Map<number, number>();
  for (const value of data) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => a.value - b.value);
}

/**
 * Posiciones de la moda en una lista de frecuencias: las de mayor frecuencia, en el orden de la lista.
 *
 * - Puede haber varias (en 2, 2, 3, 4, 4 las modas son 2 y 4): se devuelven todas.
 * - Si todo lo que aparece en los datos (frecuencia mayor que cero) se repite el mismo número de
 *   veces, no hay moda y la lista sale vacía: en 1, 1, 2, 2 ningún valor se repite más que otro.
 *   Una fila con frecuencia cero no cambia los datos, así que no cuenta para esa regla.
 * - Con un solo valor distinto (5, 5, 5), ese valor es la moda.
 */
export function modeIndices(counts: readonly number[]): number[] {
  const present = counts.filter(count => count > 0);
  if (present.length === 0) return [];
  const top = Math.max(...present);
  if (present.length > 1 && present.every(count => count === top)) return [];
  return counts.flatMap((count, index) => (count === top ? [index] : []));
}

export interface Measures {
  n: number;
  mean: number;
  median: number;
  /** Los valores de la moda, de menor a mayor; vacío si no hay moda (ver modeIndices). */
  modes: number[];
  min: number;
  max: number;
  range: number;
  /** Varianza poblacional: la suma de los cuadrados de las desviaciones, dividida entre n. */
  variance: number;
  /** Desviación estándar poblacional: la raíz de `variance`. */
  stdDev: number;
  /** Varianza muestral (dividida entre n − 1); null con un solo dato. */
  sampleVariance: number | null;
  sampleStdDev: number | null;
}

/** El dato que ocupa la posición `k` (desde 0) de los datos ordenados. */
function valueAt(items: readonly ValueCount[], k: number): number {
  let seen = 0;
  for (const item of items) {
    seen += item.count;
    if (k < seen) return item.value;
  }
  return NaN;
}

/**
 * Medidas de unos datos dados como valores con su frecuencia; los de frecuencia cero no cuentan.
 *
 * La mediana sigue el criterio de la caja y bigotes (medianOfSorted en creatorStats.ts): el dato
 * central de los datos ordenados, o el promedio de los dos centrales si n es par. La varianza y la
 * desviación estándar son las poblacionales (entre n), las de los textos escolares; la muestral
 * (entre n − 1) va aparte, para el docente que trabaje con ella.
 */
export function measuresOf(distribution: readonly ValueCount[]): Measures | null {
  const items = distribution.filter(item => item.count > 0).sort((a, b) => a.value - b.value);
  const n = items.reduce((sum, item) => sum + item.count, 0);
  if (n === 0) return null;
  const rawMean = items.reduce((sum, item) => sum + item.value * item.count, 0) / n;
  const squares = items.reduce((sum, item) => sum + item.count * (item.value - rawMean) ** 2, 0);
  const lower = valueAt(items, Math.floor((n - 1) / 2));
  const upper = valueAt(items, Math.floor(n / 2));
  const min = items[0].value;
  const max = items[items.length - 1].value;
  return {
    n,
    mean: clean(rawMean),
    // Con n impar las dos posiciones son la misma y el dato sale tal cual, como en medianOfSorted
    median: lower === upper ? lower : clean((lower + upper) / 2),
    modes: modeIndices(items.map(item => item.count)).map(index => items[index].value),
    min,
    max,
    range: clean(max - min),
    variance: clean(squares / n),
    stdDev: clean(Math.sqrt(squares / n)),
    sampleVariance: n > 1 ? clean(squares / (n - 1)) : null,
    sampleStdDev: n > 1 ? clean(Math.sqrt(squares / (n - 1))) : null,
  };
}

/** Medidas de unos datos crudos, en cualquier orden. */
export const dataMeasures = (data: readonly number[]): Measures | null => measuresOf(distributionOf(data));

/** Un número con `decimals` decimales fijos, coma decimal y punto de miles: 0.098 con 2 → "0,10". */
function fixedEs(value: number, decimals: number): string {
  const [whole, fraction] = Math.abs(value).toFixed(decimals).split(".");
  const sign = value < 0 && Number(value.toFixed(decimals)) !== 0 ? "-" : "";
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction ? `,${fraction}` : ""}`;
}

/** Una medida como la lee el estudiante: exacta si se escribe con hasta cuatro decimales; si no, con dos fijos y el signo ≈ (≈ 0,10, no ≈ 0,1). */
export const measureText = (value: number): string => (isExactNumber(value) ? figureNumber(value) : `≈ ${fixedEs(value, 2)}`);

const modesText = (modes: readonly number[]) => (modes.length === 0 ? "no hay" : joinEs(modes.map(value => formatTableNumber(value))));

/**
 * Las medidas en una línea para la IA, escritas como en la hoja. `skip` omite las que la figura ya
 * dice (la caja y bigotes trae su mediana).
 */
export function measuresFacts(measures: Measures, skip: ReadonlyArray<"median"> = []): string {
  const parts = [`media ${measureText(measures.mean)}`];
  if (!skip.includes("median")) parts.push(`mediana ${measureText(measures.median)}`);
  parts.push(measures.modes.length === 0 ? "sin moda (todos los valores se repiten igual)" : `${measures.modes.length > 1 ? "modas" : "moda"} ${modesText(measures.modes)}`);
  parts.push(`rango ${measureText(measures.range)}`);
  const sample =
    measures.sampleVariance !== null && measures.sampleStdDev !== null
      ? `; con n − 1 serían ${measureText(measures.sampleVariance)} y ${measureText(measures.sampleStdDev)}`
      : "";
  parts.push(`varianza ${measureText(measures.variance)} · desviación estándar ${measureText(measures.stdDev)} (dividiendo entre n${sample})`);
  return parts.join(" · ");
}

/* ── Frecuencias relativas ── */

export type RelativeFormat = "fraction" | "decimal" | "percent";

export interface RelativeShares {
  /**
   * Cada frecuencia relativa en unidades enteras del porcentaje con `percentDecimals` decimales:
   * con 0 son puntos porcentuales (25 = 25 %), con 1 décimas (125 = 12,5 %). Suman 100 · 10^decimales.
   */
  units: number[];
  /** Decimales del porcentaje: 0 (25 %), 1 (12,5 %) o 2 (6,25 %). La frecuencia decimal lleva dos más. */
  percentDecimals: number;
  /** true si alguna no se podía escribir exacta y la columna va redondeada. */
  rounded: boolean;
}

/** Hasta dos decimales en el porcentaje y cuatro en la frecuencia decimal: 1/16 = 6,25 % = 0,0625. */
const PERCENT_DECIMALS_MAX = 2;

/**
 * Frecuencias relativas de unos conteos, listas para escribirse como porcentaje o como decimal.
 *
 * Si todas se escriben exactas con hasta dos decimales en el porcentaje, van exactas (con 8 datos,
 * 12,5 % y 0,125). Si no (con 30 datos, 1/30 = 3,33… %), se redondean al porcentaje entero, y a
 * centésimas en decimal, por el método del resto mayor (roundPercents): cada una baja a su entero y
 * los puntos que faltan para 100 van a las de mayor parte decimal. Así la columna suma exactamente
 * 100 % y 1, aunque alguna quede un punto por encima de su redondeo aislado (tres datos de 1/3:
 * 34 %, 33 % y 33 %). La hoja lo dice en una nota bajo la tabla y la IA recibe los valores tal cual.
 */
export function relativeShares(counts: readonly number[]): RelativeShares {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!(total > 0)) return { units: counts.map(() => 0), percentDecimals: 0, rounded: false };
  for (let decimals = 0; decimals <= PERCENT_DECIMALS_MAX; decimals++) {
    const scale = 100 * 10 ** decimals;
    if (counts.every(count => (count * scale) % total === 0)) return { units: counts.map(count => (count * scale) / total), percentDecimals: decimals, rounded: false };
  }
  return { units: roundPercents([...counts]), percentDecimals: 0, rounded: true };
}

/** Un entero de unidades escrito con `decimals` decimales fijos y coma, sin pasar por coma flotante: 125 con 3 → "0,125". */
function unitsText(units: number, decimals: number): string {
  const digits = String(Math.round(Math.abs(units))).padStart(decimals + 1, "0");
  const whole = decimals > 0 ? digits.slice(0, -decimals) : digits;
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimals > 0 ? `,${digits.slice(-decimals)}` : ""}`;
}

/** Una celda: `text` es como la lee la IA (y la hoja, si no hay `latex`); `latex`, como se dibuja una fracción. */
export interface CellText {
  text: string;
  latex?: string;
}

/** Una frecuencia relativa (o una acumulada) en el formato pedido, a partir de su conteo y de sus unidades. */
export function shareCell(format: RelativeFormat, count: number, total: number, units: number, shares: RelativeShares): CellText {
  // \dfrac: en una tabla, la fracción de texto (\frac) sale más pequeña que los números de al lado
  if (format === "fraction") return { text: `${count}/${total}`, latex: `\\dfrac{${count}}{${total}}` };
  if (format === "decimal") return { text: unitsText(units, shares.percentDecimals + 2) };
  return { text: `${unitsText(units, shares.percentDecimals)} %` };
}

/** El total de una columna de frecuencias relativas: siempre 1, o 100 %. */
export const shareTotal = (format: RelativeFormat): CellText => ({ text: format === "percent" ? "100 %" : "1" });

/** La nota bajo una tabla con frecuencias relativas redondeadas, según los formatos que se ven. */
export function roundingNote(formats: readonly RelativeFormat[]): string | null {
  const decimal = formats.includes("decimal");
  const percent = formats.includes("percent");
  if (decimal && percent) return "Frecuencias relativas redondeadas y ajustadas para que sumen 1 (100 %).";
  if (decimal) return "Frecuencias relativas redondeadas a centésimas y ajustadas para que sumen 1.";
  if (percent) return "Porcentajes redondeados al entero y ajustados para que sumen 100 %.";
  return null;
}

/* ── Ancho de una tabla en la hoja ── */

/**
 * Medidas de las tablas de creator.css (letra Outfit de 14 px, relleno de 12 px a cada lado), algo holgadas:
 * medidas en Chrome, las tablas de prueba resultaron entre un 10 % y un 30 % más angostas que lo estimado.
 */
const TABLE_CHAR_PX = 8;
const TABLE_CELL_PAD_PX = 26;
const TABLE_CELL_MIN_PX = 64;
/** Las tablas estadísticas escriben sus encabezados más pequeños (12,5 px) y con menos relleno (creator.css). */
const TABLE_HEAD_CHAR_PX = 7.4;
const TABLE_HEAD_PAD_PX = 18;

/** La palabra más larga de un texto: una celda no se puede angostar más que ella. */
const longestWord = (text: string) => Math.max(0, ...text.split(/\s+/).map(word => Array.from(word).length));

/**
 * Ancho aproximado que necesita una tabla, en píxeles de la hoja: cada columna mide lo de su palabra
 * más larga (las celdas parten el texto entre palabras, nunca dentro de una), o el mínimo de una celda.
 */
export function statTableWidth(columns: ReadonlyArray<{ head: readonly string[]; cells: readonly string[] }>): number {
  return Math.round(
    columns.reduce((sum, column) => {
      const head = Math.max(0, ...column.head.map(longestWord)) * TABLE_HEAD_CHAR_PX + TABLE_HEAD_PAD_PX;
      const cells = Math.max(0, ...column.cells.map(longestWord)) * TABLE_CHAR_PX + TABLE_CELL_PAD_PX;
      return sum + Math.max(TABLE_CELL_MIN_PX, head, cells);
    }, 0) + 2,
  );
}

/* ── Tabla de frecuencias ── */

/** Filas de una tabla de frecuencias: las mismas clases que admite un histograma. */
export const FREQUENCY_ROWS_MAX = CREATOR_LIMITS.statTableRowsMax;

export type FrequencySource = "data" | "values" | "categories";

/** De dónde salen las filas; null si el bloque no trae exactamente una fuente. */
export function frequencySource(spec: Pick<FrequencyTableSpec, "data" | "values" | "categories">): FrequencySource | null {
  const present = (["data", "values", "categories"] as const).filter(key => spec[key] !== undefined);
  return present.length === 1 ? present[0] : null;
}

export interface FrequencyRow {
  /** Lo que va en la primera columna: el valor, la clase [a, b) o la categoría. */
  label: string;
  count: number;
  value?: number;
  from?: number;
  to?: number;
}

export interface FrequencyModel {
  source: FrequencySource;
  grouped: boolean;
  rows: FrequencyRow[];
  total: number;
  /** Medidas de los datos numéricos (null con categorías). Con clases, de los datos crudos. */
  measures: Measures | null;
  /** Filas de la moda: valores, clases modales o categorías; vacío si no hay moda. */
  modeRows: number[];
}

/**
 * Rótulo de una clase: [a, b), la última cerrada [a, b]. Con decimales los límites se separan con
 * punto y coma, porque la coma ya es la decimal: [1,5; 2).
 */
export function classLabel(from: number, to: number, last: boolean): string {
  const a = formatTableNumber(from);
  const b = formatTableNumber(to);
  return `[${a}${a.includes(",") || b.includes(",") ? "; " : ", "}${b}${last ? "]" : ")"}`;
}

/**
 * Cuántas clases hacen falta, empezando en `start`, para que entren todos los datos: la última
 * incluye su límite superior, así que un dato justo en el borde no pide otra clase.
 */
export function classesNeeded(start: number, width: number, data: readonly number[]): number {
  const highest = Math.max(...data);
  if (!(width > 0) || !Number.isFinite(highest)) return 1;
  return Math.max(1, Math.ceil(clean((highest - start) / width) - 1e-9));
}

export type FrequencyBuild = { ok: true; model: FrequencyModel } | { ok: false; issues: string[] };

/** Las filas de la tabla y sus conteos, o qué impide armarla (redactado para quien deba corregirlo). */
export function buildFrequencyTable(spec: Pick<FrequencyTableSpec, "data" | "values" | "categories" | "classes">): FrequencyBuild {
  const source = frequencySource(spec);
  if (source === null) {
    return { ok: false, issues: ["da los datos de una sola forma: data (datos numéricos crudos), values (valores numéricos ya contados) o categories (categorías con su conteo)."] };
  }
  if (spec.classes && source !== "data") return { ok: false, issues: ["las clases (classes) agrupan datos crudos: úsalas con data, no con values ni categories."] };

  if (source === "categories") {
    const categories = spec.categories!;
    const issues: string[] = [];
    categories.forEach((item, index) => {
      if (isTotalLabel(item.label)) issues.push(`la categoría ${index + 1} se llama «${item.label}», el nombre de la fila de totales; cámbialo.`);
      else if (categories.findIndex(other => sameLabel(other.label, item.label)) < index) issues.push(`la categoría «${item.label}» está repetida; déjala una sola vez con su conteo total.`);
    });
    const total = categories.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) issues.push("todas las categorías tienen conteo cero: no hay datos.");
    if (issues.length > 0) return { ok: false, issues };
    const counts = categories.map(item => item.count);
    return { ok: true, model: { source, grouped: false, rows: categories.map(item => ({ label: item.label.trim(), count: item.count })), total, measures: null, modeRows: modeIndices(counts) } };
  }

  if (source === "values") {
    const values = spec.values!;
    const issues: string[] = [];
    for (let index = 1; index < values.length; index++) {
      if (!(values[index].value > values[index - 1].value)) {
        issues.push(
          values[index].value === values[index - 1].value
            ? `el valor ${formatNumber(values[index].value, 6)} está repetido en values; déjalo una sola vez con su conteo total.`
            : `los valores (values) van de menor a mayor, y ${formatNumber(values[index].value, 6)} viene después de ${formatNumber(values[index - 1].value, 6)}: ordénalos.`,
        );
        break;
      }
    }
    const total = values.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) issues.push("todos los valores tienen conteo cero: no hay datos.");
    if (issues.length > 0) return { ok: false, issues };
    return {
      ok: true,
      model: {
        source,
        grouped: false,
        rows: values.map(item => ({ label: formatTableNumber(item.value), count: item.count, value: item.value })),
        total,
        measures: measuresOf(values),
        modeRows: modeIndices(values.map(item => item.count)),
      },
    };
  }

  const data = spec.data!;
  if (data.length === 0) return { ok: false, issues: ["no hay datos (data está vacío)."] };
  const measures = dataMeasures(data);

  if (!spec.classes) {
    const distribution = distributionOf(data);
    if (distribution.length > FREQUENCY_ROWS_MAX) {
      return { ok: false, issues: [`los datos tienen ${distribution.length} valores distintos y la tabla admite ${FREQUENCY_ROWS_MAX} filas: agrúpalos en clases (classes).`] };
    }
    if (distribution.length < 2) return { ok: false, issues: [`todos los datos valen ${formatNumber(data[0], 6)}: una tabla de frecuencias necesita al menos dos valores distintos.`] };
    return {
      ok: true,
      model: {
        source,
        grouped: false,
        rows: distribution.map(item => ({ label: formatTableNumber(item.value), count: item.count, value: item.value })),
        total: data.length,
        measures,
        modeRows: modeIndices(distribution.map(item => item.count)),
      },
    };
  }

  const { start, width } = spec.classes;
  // Un dato antes de la primera clase no se arregla con más clases ni con otro ancho: se dice eso
  const below = data.filter(value => value < start && Math.abs(value - start) > 1e-9 * Math.max(1, Math.abs(start)));
  if (below.length > 0) {
    const shown = below
      .slice(0, 5)
      .map(value => formatNumber(value, 6))
      .join(", ");
    return { ok: false, issues: [`${below.length === 1 ? "un dato es menor" : `${below.length} datos son menores`} que el inicio de la primera clase (start = ${formatNumber(start, 6)}): ${shown}${below.length > 5 ? "…" : ""}. Empieza las clases en un valor menor o igual que el dato más pequeño.`] };
  }
  const count = spec.classes.count ?? classesNeeded(start, width, data);
  if (count > FREQUENCY_ROWS_MAX) {
    return { ok: false, issues: [`con clases de ancho ${formatNumber(width, 6)} desde ${formatNumber(start, 6)} hacen falta ${count} clases y la tabla admite ${FREQUENCY_ROWS_MAX}: aumenta el ancho (width).`] };
  }
  if (count < 2) return { ok: false, issues: [`con clases de ancho ${formatNumber(width, 6)} todos los datos caben en una sola clase: reduce el ancho (width) para que haya al menos dos.`] };
  const classes = buildHistogramClasses(start, width, Array.from({ length: count }, () => 0));
  const { counts, outside } = histogramCounts(data, classes);
  if (outside.length > 0) {
    const shown = outside
      .slice(0, 5)
      .map(value => formatNumber(value, 6))
      .join(", ");
    const last = classes[classes.length - 1].to;
    return {
      ok: false,
      issues: [
        `${outside.length === 1 ? "un dato queda" : `${outside.length} datos quedan`} fuera de las clases, que van de ${formatNumber(start, 6)} a ${formatNumber(last, 6)}: ${shown}${outside.length > 5 ? "…" : ""}. Cambia el inicio (start), el ancho (width) o el número de clases (count).`,
      ],
    };
  }
  return {
    ok: true,
    model: {
      source,
      grouped: true,
      rows: classes.map((item, index) => ({ label: classLabel(item.from, item.to, index === classes.length - 1), count: counts[index], from: item.from, to: item.to })),
      total: data.length,
      measures,
      modeRows: modeIndices(counts),
    },
  };
}

export interface GroupedEstimates {
  /** Media estimada con las marcas de clase: Σ x·f / n. */
  mean: number;
  /** La clase donde cae la mediana: la primera cuya frecuencia acumulada llega a n/2. */
  medianClass: number;
  /** Mediana estimada por interpolación lineal dentro de esa clase: L + (n/2 − F anterior) / f · ancho. */
  median: number;
  /** Clases modales (mismo criterio de modeIndices). */
  modalClasses: number[];
  /** Rango de las clases: del límite inferior de la primera al superior de la última. */
  range: number;
  /** Varianza y desviación estándar con las marcas de clase (entre n). */
  variance: number;
  stdDev: number;
}

/** Lo que se estima de unos datos agrupados solo con sus clases y frecuencias, como en clase sin los datos crudos. */
export function groupedEstimates(classes: ReadonlyArray<{ from: number; to: number; count: number }>): GroupedEstimates | null {
  const n = classes.reduce((sum, item) => sum + item.count, 0);
  if (n === 0) return null;
  const mean = classes.reduce((sum, item) => sum + ((item.from + item.to) / 2) * item.count, 0) / n;
  let before = 0;
  let medianClass = classes.length - 1;
  for (let index = 0; index < classes.length; index++) {
    if (before + classes[index].count >= n / 2 && classes[index].count > 0) {
      medianClass = index;
      break;
    }
    before += classes[index].count;
  }
  const middle = classes[medianClass];
  const median = middle.from + ((n / 2 - before) / middle.count) * (middle.to - middle.from);
  const squares = classes.reduce((sum, item) => sum + item.count * ((item.from + item.to) / 2 - mean) ** 2, 0);
  return {
    mean: clean(mean),
    medianClass,
    median: clean(median),
    modalClasses: modeIndices(classes.map(item => item.count)),
    range: clean(classes[classes.length - 1].to - classes[0].from),
    variance: clean(squares / n),
    stdDev: clean(Math.sqrt(squares / n)),
  };
}

export type FrequencyColumnKey = "classMark" | "absolute" | "relative" | "cumulative" | "cumulativeRelative";
export type StatMeasureKey = "mean" | "median" | "mode" | "range" | "variance" | "stdDev";
export const STAT_MEASURE_KEYS: readonly StatMeasureKey[] = ["mean", "median", "mode", "range", "variance", "stdDev"];

export interface FrequencyColumn {
  key: FrequencyColumnKey;
  /** Encabezado en palabras y su símbolo: «Frecuencia absoluta», f (subíndice i). */
  title: string;
  symbol: string;
  /** Lo que sigue al símbolo: « %» en una columna de porcentajes. */
  suffix: string;
  format?: RelativeFormat;
  blank: boolean;
}

export interface FrequencyView {
  model: FrequencyModel;
  shares: RelativeShares;
  /** Con datos agrupados, las medidas bajo la tabla salen de las marcas de clase, como las calcula el estudiante desde la tabla. */
  estimates: GroupedEstimates | null;
  variable: string;
  columns: FrequencyColumn[];
  rows: Array<{ label: string; cells: CellText[] }>;
  /** La fila de totales, alineada con `columns`; una celda vacía donde no hay total (las acumuladas). */
  totals: CellText[] | null;
  /** Aviso de redondeo, si alguna frecuencia relativa visible va redondeada. */
  note: string | null;
  measures: Array<{ key: StatMeasureKey; name: string; value: string; blank: boolean }>;
}

const FORMAT_ORDER: readonly RelativeFormat[] = ["fraction", "decimal", "percent"];

/** El formato de la frecuencia relativa acumulada: el primero de la relativa, o decimal si no se muestra. */
export const cumulativeFormat = (spec: Pick<FrequencyTableSpec, "relative">): RelativeFormat => FORMAT_ORDER.find(format => spec.relative.includes(format)) ?? "decimal";

const MEASURE_NAMES: Record<Exclude<StatMeasureKey, "mode">, string> = { mean: "Media", median: "Mediana", range: "Rango", variance: "Varianza", stdDev: "Desviación estándar" };

/** La tabla tal como se dibuja: encabezados, celdas, totales, nota y medidas. null si no se puede armar. */
export function frequencyTableView(spec: FrequencyTableSpec): FrequencyView | null {
  const built = buildFrequencyTable(spec);
  return built.ok ? viewOf(spec, built.model) : null;
}

function viewOf(spec: FrequencyTableSpec, model: FrequencyModel): FrequencyView {
  const blank = new Set<string>(spec.blank);
  const formats = FORMAT_ORDER.filter(format => spec.relative.includes(format));
  const hFormat = cumulativeFormat(spec);
  const columns: FrequencyColumn[] = [];
  if (spec.classMark && model.grouped) columns.push({ key: "classMark", title: "Marca de clase", symbol: "x", suffix: "", blank: blank.has("classMark") });
  columns.push({ key: "absolute", title: "Frecuencia absoluta", symbol: "f", suffix: "", blank: blank.has("absolute") });
  // Con fracción y decimal a la vez, cada encabezado dice cuál es: en blanco, el estudiante no lo vería
  const both = formats.includes("fraction") && formats.includes("decimal");
  for (const format of formats) {
    const title = format === "percent" ? "Porcentaje" : both ? `Frecuencia relativa (${format === "fraction" ? "fracción" : "decimal"})` : "Frecuencia relativa";
    columns.push({ key: "relative", title, symbol: "h", suffix: format === "percent" ? " %" : "", format, blank: blank.has("relative") });
  }
  if (spec.cumulative) columns.push({ key: "cumulative", title: "Frecuencia acumulada", symbol: "F", suffix: "", blank: blank.has("cumulative") });
  if (spec.cumulativeRelative) {
    columns.push({ key: "cumulativeRelative", title: hFormat === "percent" ? "Porcentaje acumulado" : "Frecuencia relativa acumulada", symbol: "H", suffix: hFormat === "percent" ? " %" : "", format: hFormat, blank: blank.has("cumulativeRelative") });
  }

  const counts = model.rows.map(row => row.count);
  const shares = relativeShares(counts);
  let cumulative = 0;
  let cumulativeUnits = 0;
  const rows = model.rows.map((row, index) => {
    cumulative += row.count;
    cumulativeUnits += shares.units[index];
    const cells = columns.map((column): CellText => {
      switch (column.key) {
        case "classMark":
          return { text: formatTableNumber(clean(((row.from ?? 0) + (row.to ?? 0)) / 2)) };
        case "absolute":
          return { text: String(row.count) };
        case "relative":
          return shareCell(column.format!, row.count, model.total, shares.units[index], shares);
        case "cumulative":
          return { text: String(cumulative) };
        case "cumulativeRelative":
          return shareCell(column.format!, cumulative, model.total, cumulativeUnits, shares);
      }
    });
    return { label: row.label, cells };
  });

  const totals = spec.totals
    ? columns.map((column): CellText => {
        if (column.key === "absolute") return { text: String(model.total) };
        if (column.key === "relative") return shareTotal(column.format!);
        return { text: "" };
      })
    : null;

  const visibleRounded = columns.filter(column => column.format && column.format !== "fraction" && !column.blank).map(column => column.format!);
  const note = shares.rounded ? roundingNote(visibleRounded) : null;

  const estimates = model.grouped ? groupedEstimates(model.rows.map(row => ({ from: row.from!, to: row.to!, count: row.count }))) : null;
  const measures = STAT_MEASURE_KEYS.filter(key => spec.measures.includes(key)).map(key => {
    const blankMeasure = blank.has("measures");
    // Con clases, lo que el estudiante puede calcular desde la tabla: marcas de clase y mediana interpolada
    if (estimates && key !== "mode") return { key, name: MEASURE_NAMES[key], value: measureText(estimates[key]), blank: blankMeasure };
    if (key === "mode") {
      const labels = model.modeRows.map(index => model.rows[index].label);
      const name = model.grouped ? (labels.length > 1 ? "Clases modales" : "Clase modal") : labels.length > 1 ? "Modas" : "Moda";
      return { key, name, value: labels.length === 0 ? "no hay" : joinEs(labels), blank: blankMeasure };
    }
    const value = model.measures ? measureText(model.measures[key]) : "";
    return { key, name: MEASURE_NAMES[key], value, blank: blankMeasure };
  });

  return { model, shares, estimates, variable: spec.variable.trim(), columns, rows, totals, note, measures };
}

/** Encabezado de una columna como lo lee la IA: «Frecuencia absoluta (f)». */
const columnName = (column: FrequencyColumn) => `${column.title} (${column.symbol}${column.suffix})`;

/** Ancho que pide la tabla de frecuencias en la hoja (ver statTableWidth). */
export function frequencyTableWidth(view: FrequencyView): number {
  const totalLabel = view.totals ? ["Total"] : [];
  // Una clase se escribe en un renglón (creator.css): cuenta como una sola palabra
  const labels = view.rows.map(row => (view.model.grouped ? row.label.replace(/\s+/g, "_") : row.label));
  return statTableWidth([
    { head: [view.variable], cells: [...labels, ...totalLabel] },
    ...view.columns.map((column, index) => ({ head: [column.title, `${column.symbol}i${column.suffix}`], cells: view.rows.map(row => row.cells[index].text) })),
  ]);
}

/** Problemas de una tabla de frecuencias, redactados para quien deba corregirlos. Vacío si está bien. */
export function frequencyTableIssues(spec: FrequencyTableSpec, sheetWidth: number): string[] {
  const built = buildFrequencyTable(spec);
  if (!built.ok) return built.issues;
  const { model } = built;
  const issues: string[] = [];
  const repeated = <T>(list: readonly T[]) => list.find((item, index) => list.indexOf(item) !== index);
  const twiceFormat = repeated(spec.relative);
  if (twiceFormat) issues.push(`el formato "${twiceFormat}" está repetido en relative; déjalo una sola vez.`);
  const twiceMeasure = repeated(spec.measures);
  if (twiceMeasure) issues.push(`la medida "${twiceMeasure}" está repetida en measures; déjala una sola vez.`);
  const twiceBlank = repeated(spec.blank);
  if (twiceBlank) issues.push(`"${twiceBlank}" está repetido en blank; déjalo una sola vez.`);

  if (spec.classMark && !model.grouped) issues.push("la marca de clase (classMark) solo existe con datos agrupados en clases (classes).");
  if (model.source === "categories") {
    const numeric = spec.measures.filter(key => key !== "mode");
    if (numeric.length > 0) issues.push(`con categorías solo se calcula la moda; ${numeric.map(key => `"${key}"`).join(", ")} necesita${numeric.length > 1 ? "n" : ""} datos numéricos (data o values).`);
  }
  // Una columna en blanco que no se muestra no se le puede pedir al estudiante
  const shown: Record<string, boolean> = {
    classMark: spec.classMark,
    absolute: true,
    relative: spec.relative.length > 0,
    cumulative: spec.cumulative,
    cumulativeRelative: spec.cumulativeRelative,
    measures: spec.measures.length > 0,
  };
  for (const key of spec.blank) if (!shown[key]) issues.push(`blank incluye "${key}", pero esa ${key === "measures" ? "parte" : "columna"} no se muestra; quítala de blank o muéstrala.`);

  if (issues.length > 0) return issues;
  const width = frequencyTableWidth(viewOf(spec, model));
  if (width > sheetWidth) issues.push(`la tabla mide unos ${width} px y la hoja ${sheetWidth}: quita columnas o acorta los rótulos.`);
  return issues;
}

/** Lo que el sistema calculó de una tabla de frecuencias, en una línea para la IA, escrito como en la hoja. */
export function describeFrequencyTable(spec: FrequencyTableSpec): string | null {
  const view = frequencyTableView(spec);
  if (!view) return null;
  const { model } = view;
  const rows = view.rows.map(row => `${row.label}: ${row.cells.map((cell, index) => `${view.columns[index].symbol}${view.columns[index].suffix ? " %" : ""} = ${cell.text}`).join(", ")}`);
  const parts = [`Tabla de frecuencias «${view.variable}» (n = ${model.total}; columnas: ${view.columns.map(columnName).join(", ")}): ${rows.join("; ")}.`];
  if (view.shares.rounded && (spec.relative.some(format => format !== "fraction") || (spec.cumulativeRelative && cumulativeFormat(spec) !== "fraction"))) {
    parts.push("Las frecuencias relativas van redondeadas por el método del resto mayor para que sumen 1 (100 %): usa esos valores, no los de redondear cada una aparte.");
  }
  if (model.measures) parts.push(`Medidas de los datos${model.grouped ? " crudos" : ""}: ${measuresFacts(model.measures)}.`);
  else {
    const modes = model.modeRows.map(index => model.rows[index].label);
    parts.push(modes.length === 0 ? "No hay moda: todas las categorías tienen la misma frecuencia." : `${modes.length > 1 ? "Modas" : "Moda"}: ${joinEs(modes)}.`);
  }
  if (view.estimates) {
    parts.push(groupedFacts(view.estimates, model.rows.map(row => row.label)));
    if (view.measures.length > 0) parts.push("Las medidas escritas bajo la tabla son las de las marcas de clase.");
  }
  return parts.join(" ");
}

/** Las estimaciones con clases para la IA: lo que el estudiante calcula desde la tabla, sin los datos crudos. */
export function groupedFacts(estimates: GroupedEstimates, labels: readonly string[]): string {
  const modal = estimates.modalClasses.map(index => labels[index]);
  return `Con las marcas de clase (sin los datos crudos): media estimada ${measureText(estimates.mean)}; la mediana cae en la clase ${labels[estimates.medianClass]} y por interpolación es ${measureText(estimates.median)}; ${
    modal.length === 0 ? "no hay clase modal (todas tienen la misma frecuencia)" : `${modal.length > 1 ? "clases modales" : "clase modal"} ${joinEs(modal)}`
  }; rango de las clases ${measureText(estimates.range)}; varianza ${measureText(estimates.variance)} y desviación estándar ${measureText(estimates.stdDev)} (entre n).`;
}

/* ── Tabla de contingencia ── */

export type ContingencyDisplay = ContingencyTableSpec["display"];

export interface ContingencyCell extends CellText {
  blank: boolean;
}

export interface ContingencyView {
  rowVariable?: string;
  columnVariable?: string;
  columns: string[];
  rows: Array<{ label: string; cells: ContingencyCell[]; total: ContingencyCell | null }>;
  /** La fila de totales: uno por columna y el total general. */
  totals: { cells: ContingencyCell[]; total: ContingencyCell } | null;
  note: string | null;
  rowTotals: number[];
  columnTotals: number[];
  total: number;
}

/** Celdas en blanco por los rótulos de su fila y su columna; «Total» nombra la fila o la columna de totales. */
const blankKey = (row: string, column: string) => `${row.trim().toLocaleLowerCase("es")}\u0000${column.trim().toLocaleLowerCase("es")}`;

/** Totales por fila, por columna y general; null si alguna fila no tiene un conteo por columna. */
export function contingencyTotals(spec: Pick<ContingencyTableSpec, "rows" | "columns">): { rowTotals: number[]; columnTotals: number[]; total: number } | null {
  if (spec.rows.some(row => row.counts.length !== spec.columns.length)) return null;
  const rowTotals = spec.rows.map(row => row.counts.reduce((sum, count) => sum + count, 0));
  const columnTotals = spec.columns.map((_, column) => spec.rows.reduce((sum, row) => sum + row.counts[column], 0));
  return { rowTotals, columnTotals, total: rowTotals.reduce((sum, value) => sum + value, 0) };
}

/** La tabla tal como se dibuja, en conteos o en frecuencias relativas al total. null si no cuadra. */
export function contingencyTableView(spec: ContingencyTableSpec): ContingencyView | null {
  const sums = contingencyTotals(spec);
  if (!sums || sums.total === 0) return null;
  const { rowTotals, columnTotals, total } = sums;
  const blanks = new Set(spec.blank.map(cell => blankKey(cell.row, cell.column)));
  const isBlank = (row: string, column: string) => blanks.has(blankKey(row, column));
  const columns = spec.columns.map(label => label.trim());

  let cell: (count: number, units: number) => CellText;
  let grand: CellText;
  let note: string | null = null;
  let units: number[][] = spec.rows.map(row => row.counts.map(() => 0));
  if (spec.display === "counts") {
    cell = count => ({ text: String(count) });
    grand = { text: String(total) };
  } else {
    // Las relativas se redondean juntas, sobre las celdas del cuerpo: los totales suman lo que se ve
    const format = spec.display;
    const shares = relativeShares(spec.rows.flatMap(row => row.counts));
    units = spec.rows.map((row, r) => row.counts.map((_, c) => shares.units[r * columns.length + c]));
    cell = (count, value) => shareCell(format, count, total, value, shares);
    grand = shareTotal(format);
    if (shares.rounded) note = roundingNote([format]);
  }
  const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
  const rows = spec.rows.map((row, r) => {
    const label = row.label.trim();
    return {
      label,
      cells: row.counts.map((count, c) => ({ ...cell(count, units[r][c]), blank: isBlank(label, columns[c]) })),
      total: spec.totals ? { ...cell(rowTotals[r], sum(units[r])), blank: isBlank(label, "Total") } : null,
    };
  });
  const totals = spec.totals
    ? {
        cells: columns.map((column, c) => ({ ...cell(columnTotals[c], sum(units.map(row => row[c]))), blank: isBlank("Total", column) })),
        total: { ...grand, blank: isBlank("Total", "Total") },
      }
    : null;
  return { rowVariable: spec.rowVariable?.trim(), columnVariable: spec.columnVariable?.trim(), columns, rows, totals, note, rowTotals, columnTotals, total };
}

/** Ancho que pide la tabla de contingencia en la hoja (ver statTableWidth). */
export function contingencyTableWidth(view: ContingencyView): number {
  const totalColumn = view.rows[0]?.total ? [{ head: ["Total"], cells: [...view.rows.map(row => row.total?.text ?? ""), view.totals?.total.text ?? ""] }] : [];
  return statTableWidth([
    { head: [view.rowVariable ?? ""], cells: [...view.rows.map(row => row.label), ...(view.totals ? ["Total"] : [])] },
    ...view.columns.map((column, c) => ({ head: [column], cells: [...view.rows.map(row => row.cells[c].text), view.totals?.cells[c].text ?? ""] })),
    ...totalColumn,
  ]);
}

/** Problemas de una tabla de contingencia. Vacío si está bien. */
export function contingencyTableIssues(spec: ContingencyTableSpec, sheetWidth: number): string[] {
  const issues: string[] = [];
  spec.rows.forEach(row => {
    if (row.counts.length !== spec.columns.length) issues.push(`la fila «${row.label}» tiene ${row.counts.length} conteos y hay ${spec.columns.length} columnas: debe haber uno por columna.`);
  });
  const labels = (list: readonly string[], noun: string) =>
    list.forEach((label, index) => {
      if (isTotalLabel(label)) issues.push(`${noun} ${index + 1} se llama «${label}», el nombre de los totales; cámbialo.`);
      else if (list.findIndex(other => sameLabel(other, label)) < index) issues.push(`${noun} «${label}» está repetida; cada ${noun.replace(/^la /, "")} necesita su propio rótulo.`);
    });
  labels(
    spec.rows.map(row => row.label),
    "la fila",
  );
  labels(spec.columns, "la columna");
  if (issues.length > 0) return issues;

  const sums = contingencyTotals(spec)!;
  if (sums.total === 0) return ["todos los conteos valen cero: no hay datos."];
  // Una fila o columna vacía deja sin definir sus probabilidades condicionales
  spec.rows.forEach((row, r) => {
    if (sums.rowTotals[r] === 0) issues.push(`la fila «${row.label}» suma cero: quítala o corrige sus conteos.`);
  });
  spec.columns.forEach((column, c) => {
    if (sums.columnTotals[c] === 0) issues.push(`la columna «${column}» suma cero: quítala o corrige sus conteos.`);
  });

  const rowNames = [...spec.rows.map(row => row.label), ...(spec.totals ? ["Total"] : [])];
  const columnNames = [...spec.columns, ...(spec.totals ? ["Total"] : [])];
  const seen = new Set<string>();
  for (const cell of spec.blank) {
    const key = blankKey(cell.row, cell.column);
    if (seen.has(key)) issues.push(`la celda en blanco («${cell.row}», «${cell.column}») está repetida; déjala una sola vez.`);
    seen.add(key);
    const knownRow = rowNames.some(name => sameLabel(name, cell.row));
    const knownColumn = columnNames.some(name => sameLabel(name, cell.column));
    if (!knownRow || !knownColumn) {
      const missing = !knownRow ? `la fila «${cell.row}»` : `la columna «${cell.column}»`;
      const totalsHint = !spec.totals && (isTotalLabel(cell.row) || isTotalLabel(cell.column)) ? " (los totales no se muestran: pon totals en true)" : "";
      issues.push(`una celda en blanco nombra ${missing}, que no existe${totalsHint}. Las filas son ${joinEs(rowNames.map(name => `«${name}»`))} y las columnas ${joinEs(columnNames.map(name => `«${name}»`))}.`);
    }
  }
  if (issues.length > 0) return issues;

  const view = contingencyTableView(spec);
  if (view) {
    const width = contingencyTableWidth(view);
    if (width > sheetWidth) issues.push(`la tabla mide unos ${width} px y la hoja ${sheetWidth}: quita columnas o acorta los rótulos.`);
  }
  return issues;
}

/** Una probabilidad como la escribe la clave: «8/20 = 2/5 = 0,4», «7/30 ≈ 0,23», «0/20 = 0». */
export function probabilityText(part: number, whole: number): string {
  const value = part / whole;
  const divisor = gcd(part, whole);
  const simplified = divisor > 1 && part !== 0 && part !== whole ? ` = ${part / divisor}/${whole / divisor}` : "";
  const decimal = isExactNumber(value) ? ` = ${figureNumber(value)}` : ` ${measureText(value)}`;
  return `${part}/${whole}${simplified}${decimal}`;
}

/**
 * Lo que se desprende de una tabla de contingencia, en una línea para la IA: los totales, las
 * probabilidades de cada categoría, las conjuntas, las condicionales en los dos sentidos y si las dos
 * variables son independientes (comprobado con enteros: n·n(A y B) = n(A)·n(B) en cada celda).
 */
export function describeContingencyTable(spec: ContingencyTableSpec): string | null {
  const view = contingencyTableView(spec);
  if (!view) return null;
  const { rowTotals, columnTotals, total } = view;
  const rowLabels = view.rows.map(row => row.label);
  const columns = view.columns;
  const counts = spec.rows.map(row => row.counts);
  const names = [view.rowVariable && `filas: ${view.rowVariable}`, view.columnVariable && `columnas: ${view.columnVariable}`].filter(Boolean).join("; ");
  const parts: string[] = [];
  parts.push(
    `Tabla de contingencia (n = ${total}${names ? `; ${names}` : ""}): totales por fila ${rowLabels.map((label, r) => `${label} ${rowTotals[r]}`).join(", ")}; por columna ${columns.map((label, c) => `${label} ${columnTotals[c]}`).join(", ")}.`,
  );
  if (spec.display !== "counts") {
    parts.push(`La tabla muestra frecuencias relativas al total: ${view.rows.map(row => `${row.label}: ${row.cells.map((cell, c) => `${columns[c]} ${cell.text}`).join(", ")}`).join("; ")}.${view.note ? " Van redondeadas por el método del resto mayor para que sumen 1 (100 %)." : ""}`);
  }
  const marginal = [...rowLabels.map((label, r) => `P(${label}) = ${probabilityText(rowTotals[r], total)}`), ...columns.map((label, c) => `P(${label}) = ${probabilityText(columnTotals[c], total)}`)];
  parts.push(`Probabilidades: ${marginal.join("; ")}.`);
  const joint = rowLabels.flatMap((row, r) => columns.map((column, c) => `P(${row} y ${column}) = ${probabilityText(counts[r][c], total)}`));
  parts.push(`Conjuntas: ${joint.join("; ")}.`);
  const byRow = rowLabels.flatMap((row, r) => columns.map((column, c) => `P(${column} | ${row}) = ${probabilityText(counts[r][c], rowTotals[r])}`));
  const byColumn = columns.flatMap((column, c) => rowLabels.map((row, r) => `P(${row} | ${column}) = ${probabilityText(counts[r][c], columnTotals[c])}`));
  parts.push(`Condicionales: ${[...byRow, ...byColumn].join("; ")}.`);
  let witness: { r: number; c: number } | null = null;
  for (let r = 0; r < rowLabels.length && !witness; r++) {
    for (let c = 0; c < columns.length && !witness; c++) if (counts[r][c] * total !== rowTotals[r] * columnTotals[c]) witness = { r, c };
  }
  if (!witness) parts.push("Las dos variables son independientes: en cada celda P(fila y columna) = P(fila) · P(columna).");
  else {
    const { r, c } = witness;
    parts.push(
      `Las variables no son independientes: por ejemplo, P(${columns[c]} | ${rowLabels[r]}) = ${probabilityText(counts[r][c], rowTotals[r])}, pero P(${columns[c]}) = ${probabilityText(columnTotals[c], total)}.`,
    );
  }
  return parts.join(" ");
}

/**
 * Clases de datos agrupados: intervalos [a, b) contiguos del mismo ancho, la última cerrada. Las usan
 * el histograma (creatorStats.ts) y la tabla de frecuencias (creatorStatTables.ts); viven aparte para
 * que esos dos módulos no se importen el uno al otro. creatorStats.ts las vuelve a exportar.
 */

/** Quita el ruido binario de una operación ((0.1 + 0.2) / 2) sin perder precisión útil. */
const clean = (value: number) => Number(value.toPrecision(12));

/** Dos límites de clase son el mismo aunque difieran en el ruido de una suma (150 + 3 · 0,1). */
export const sameNumber = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

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

/** Clases contiguas del mismo ancho a partir del límite inferior: lo que arma el formulario del docente. */
export function buildHistogramClasses(start: number, width: number, frequencies: number[]): Array<{ from: number; to: number; frequency: number }> {
  return frequencies.map((frequency, index) => ({ from: clean(start + index * width), to: clean(start + (index + 1) * width), frequency }));
}

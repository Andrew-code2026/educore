import { describe, expect, it } from "vitest";
import {
  buildHistogramClasses,
  fiveNumberSummary,
  histogramClassIssues,
  histogramCounts,
  linearRegression,
  medianOfSorted,
  niceAxis,
  resolveAxis,
  spreadLabels,
  trendLineLatex,
  trendLineText,
} from "@shared/creatorStats";

describe("resumen de cinco números", () => {
  it("saca la mediana de una lista ordenada", () => {
    expect(medianOfSorted([1, 2, 3])).toBe(2);
    expect(medianOfSorted([1, 2, 3, 4])).toBe(2.5);
    expect(medianOfSorted([7])).toBe(7);
    expect(medianOfSorted([])).toBeNaN();
  });

  it("con número impar de datos deja la mediana fuera de las dos mitades", () => {
    // El caso que distingue los métodos: una hoja de cálculo (CUARTIL.INC) daría Q1 = 3 y Q3 = 7
    expect(fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ min: 1, q1: 2.5, median: 5, q3: 7.5, max: 9 });
    expect(fiveNumberSummary([6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49])).toEqual({ min: 6, q1: 15, median: 40, q3: 43, max: 49 });
    expect(fiveNumberSummary([1, 2, 3, 4, 5])).toEqual({ min: 1, q1: 1.5, median: 3, q3: 4.5, max: 5 });
  });

  it("con número par de datos parte la lista en dos mitades iguales", () => {
    expect(fiveNumberSummary([7, 15, 36, 39, 40, 41])).toEqual({ min: 7, q1: 15, median: 37.5, q3: 40, max: 41 });
    expect(fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ min: 1, q1: 2.5, median: 4.5, q3: 6.5, max: 8 });
  });

  it("no depende del orden ni se confunde con datos repetidos o decimales", () => {
    expect(fiveNumberSummary([9, 1, 5, 3, 7, 2, 8, 4, 6])).toEqual({ min: 1, q1: 2.5, median: 5, q3: 7.5, max: 9 });
    expect(fiveNumberSummary([3, 3, 3, 4, 4, 5, 5, 5])).toEqual({ min: 3, q1: 3, median: 4, q3: 5, max: 5 });
    // (0.1 + 0.2) / 2 no deja 0.15000000000000002
    expect(fiveNumberSummary([0.1, 0.2, 0.3, 0.4])).toEqual({ min: 0.1, q1: 0.15, median: 0.25, q3: 0.35, max: 0.4 });
    expect(fiveNumberSummary([-4, -1, 0, 2, 10])).toEqual({ min: -4, q1: -2.5, median: 0, q3: 6, max: 10 });
  });

  it("no ordena los datos que recibe ni resume menos de dos", () => {
    const data = [5, 1, 4];
    fiveNumberSummary(data);
    expect(data).toEqual([5, 1, 4]);
    expect(fiveNumberSummary([3])).toBeNull();
    expect(fiveNumberSummary([])).toBeNull();
  });
});

describe("recta de mínimos cuadrados", () => {
  it("recupera una recta exacta", () => {
    const line = linearRegression([0, 1, 2, 3, 4].map(x => ({ x, y: 2 * x + 1 })))!;
    expect(line.slope).toBeCloseTo(2, 10);
    expect(line.intercept).toBeCloseTo(1, 10);
    expect(line.r).toBeCloseTo(1, 10);
  });

  it("ajusta una nube de puntos", () => {
    // Medias 3 y 4; Sxx = 10, Sxy = 9, Syy = 10
    const line = linearRegression([{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 6 }])!;
    expect(line.slope).toBeCloseTo(0.9, 10);
    expect(line.intercept).toBeCloseTo(1.3, 10);
    expect(line.r).toBeCloseTo(0.9, 10);
  });

  it("da pendiente negativa y correlación −1 cuando la relación es inversa", () => {
    const line = linearRegression([{ x: 1, y: 10 }, { x: 2, y: 8 }, { x: 3, y: 6 }])!;
    expect(line.slope).toBeCloseTo(-2, 10);
    expect(line.intercept).toBeCloseTo(12, 10);
    expect(line.r).toBeCloseTo(-1, 10);
  });

  it("no inventa una recta cuando no la hay", () => {
    expect(linearRegression([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }])).toBeNull();
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull();
    // Horizontal: hay recta, y la correlación no está definida (se informa 0)
    expect(linearRegression([{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }])).toEqual({ slope: 0, intercept: 4, r: 0 });
  });

  it("escribe la ecuación con punto para la IA y con coma para el estudiante", () => {
    expect(trendLineText({ slope: 0.9, intercept: 1.3, r: 0.9 })).toBe("y = 0.9x + 1.3");
    expect(trendLineLatex({ slope: 0.9, intercept: 1.3, r: 0.9 })).toBe("y = 0{,}9x + 1{,}3");
    expect(trendLineText({ slope: -2, intercept: 12, r: -1 })).toBe("y = -2x + 12");
    expect(trendLineText({ slope: 1, intercept: -0.456, r: 1 })).toBe("y = x - 0.46");
    expect(trendLineText({ slope: -1, intercept: 0, r: -1 })).toBe("y = -x");
    expect(trendLineText({ slope: 0, intercept: 4, r: 0 })).toBe("y = 4");
    expect(trendLineText({ slope: 2.5, intercept: 0.001, r: 1 })).toBe("y = 2.5x + 0.001");
    // Una pendiente pequeña no se redondea a cero
    expect(trendLineText({ slope: 0.0042, intercept: 150, r: 0.8 })).toBe("y = 0.0042x + 150");
    expect(trendLineLatex({ slope: 1250.5, intercept: -20000, r: 0.8 })).toBe("y = 1.250{,}5x - 20.000");
  });
});

describe("histograma: clases y conteo", () => {
  const classes = buildHistogramClasses(140, 10, [0, 0, 0, 0]);

  it("arma clases contiguas del mismo ancho", () => {
    expect(classes.map(item => [item.from, item.to])).toEqual([[140, 150], [150, 160], [160, 170], [170, 180]]);
    expect(buildHistogramClasses(0, 0.1, [1, 2, 3]).map(item => item.to)).toEqual([0.1, 0.2, 0.3]);
    expect(histogramClassIssues(classes)).toEqual([]);
    expect(histogramClassIssues(buildHistogramClasses(0, 0.1, [1, 2, 3]))).toEqual([]);
  });

  it("cuenta cada dato en su clase: el límite inferior entra y el superior no, salvo en la última", () => {
    const { counts, outside } = histogramCounts([140, 149.9, 150, 159, 160, 170, 180], classes);
    expect(counts).toEqual([2, 2, 1, 2]);
    expect(outside).toEqual([]);
  });

  it("separa los datos que no caben en ninguna clase", () => {
    expect(histogramCounts([139, 150, 181], classes)).toEqual({ counts: [0, 1, 0, 0], outside: [139, 181] });
  });

  it("señala límites invertidos, huecos, solapes y anchos distintos", () => {
    expect(histogramClassIssues([{ from: 10, to: 5 }, { from: 5, to: 10 }])[0]).toContain("límite inferior");
    expect(histogramClassIssues([{ from: 0, to: 10 }, { from: 11, to: 21 }])[0]).toContain("contiguas");
    expect(histogramClassIssues([{ from: 0, to: 10 }, { from: 5, to: 15 }])[0]).toContain("contiguas");
    expect(histogramClassIssues([{ from: 0, to: 10 }, { from: 10, to: 30 }])[0]).toContain("mismo ancho");
  });
});

describe("ejes de las figuras estadísticas", () => {
  it("arranca en cero cuando los datos están cerca de él", () => {
    expect(niceAxis(2, 9)).toEqual({ min: 0, max: 10, step: 2 });
    expect(niceAxis(0, 47)).toEqual({ min: 0, max: 50, step: 10 });
  });

  it("no arrastra el eje hasta cero cuando los datos están lejos", () => {
    expect(niceAxis(142, 178)).toEqual({ min: 140, max: 180, step: 10 });
    expect(niceAxis(14, 22)).toEqual({ min: 14, max: 22, step: 2 });
  });

  it("cubre datos negativos y un único valor", () => {
    const axis = niceAxis(-3, 12);
    expect(axis.min).toBeLessThanOrEqual(-3);
    expect(axis.max).toBeGreaterThanOrEqual(12);
    const flat = niceAxis(5, 5);
    expect(flat.min).toBeLessThan(5);
    expect(flat.max).toBeGreaterThan(5);
  });

  it("respeta lo que se fija a mano y nunca devuelve un rango vacío", () => {
    expect(resolveAxis(2, 9, { max: 20, step: 5 })).toEqual({ min: 0, max: 20, step: 5 });
    expect(resolveAxis(142, 178, { min: 100 })).toMatchObject({ min: 100, max: 180 });
    const inverted = resolveAxis(2, 9, { min: 10, max: 5 });
    expect(inverted.max).toBeGreaterThan(inverted.min);
  });
});

describe("rótulos sobre una recta", () => {
  it("deja en su sitio los que no chocan", () => {
    expect(spreadLabels([{ x: 10, w: 10 }, { x: 60, w: 10 }, { x: 120, w: 10 }], 4)).toEqual([10, 60, 120]);
  });

  it("aparta los que chocan sin cambiar el orden y sin salirse", () => {
    const items = [{ x: 50, w: 20 }, { x: 52, w: 20 }, { x: 55, w: 20 }, { x: 200, w: 20 }];
    const centers = spreadLabels(items, 4, 0, 220);
    for (let i = 1; i < centers.length; i++) expect(centers[i] - centers[i - 1]).toBeGreaterThanOrEqual(24 - 1e-9);
    expect(centers[3]).toBe(200);
    // El grupo queda centrado sobre lo que pedían sus rótulos
    expect((centers[0] + centers[1] + centers[2]) / 3).toBeCloseTo((50 + 52 + 55) / 3, 6);
    const edge = spreadLabels([{ x: 2, w: 20 }, { x: 4, w: 20 }], 4, 0, 220);
    expect(edge[0] - 10).toBeGreaterThanOrEqual(0);
  });
});

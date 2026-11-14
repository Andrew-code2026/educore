import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { minBlockWidth } from "@shared/creatorContainers";
import { roundPercents } from "@shared/creatorFigures";
import { buildHistogramClasses, describeComputed, fiveNumberSummary, histogramCounts, medianOfSorted, sortAscending } from "@shared/creatorStats";
import {
  buildFrequencyTable,
  classesNeeded,
  classLabel,
  contingencyTableView,
  dataMeasures,
  describeContingencyTable,
  describeFrequencyTable,
  distributionOf,
  frequencyTableView,
  groupedEstimates,
  joinEs,
  measuresOf,
  measureText,
  modeIndices,
  probabilityText,
  relativeShares,
} from "@shared/creatorStatTables";
import { validateBlock } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const frequency = (input: Record<string, unknown>) => block({ type: "frequency_table", variable: "Dato", ...input }) as Extract<BlockInput, { type: "frequency_table" }>;
const contingency = (input: Record<string, unknown>) =>
  block({
    type: "contingency_table",
    columns: ["A pie", "En bus", "En bicicleta"],
    rows: [
      { label: "Sexto", counts: [12, 8, 5] },
      { label: "Séptimo", counts: [9, 11, 6] },
    ],
    ...input,
  }) as Extract<BlockInput, { type: "contingency_table" }>;

/** Generador con semilla: las pruebas al azar dan siempre lo mismo. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("medidas de tendencia central y de dispersión", () => {
  it("la moda: varias, ninguna o la única", () => {
    expect(modeIndices([2, 1, 2])).toEqual([0, 2]);
    // Todos los valores se repiten igual: no hay moda
    expect(modeIndices([2, 2, 2])).toEqual([]);
    expect(modeIndices([1, 1])).toEqual([]);
    // Un solo valor distinto es la moda
    expect(modeIndices([5])).toEqual([0]);
    // Una fila con frecuencia cero no son datos: A y B se repiten igual, no hay moda
    expect(modeIndices([5, 5, 0])).toEqual([]);
    expect(modeIndices([5, 3, 0])).toEqual([0]);
    expect(modeIndices([0, 0])).toEqual([]);
  });

  it("calcula media, mediana, moda, rango y varianza de datos crudos", () => {
    const measures = dataMeasures([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(measures).toMatchObject({ n: 8, mean: 5, median: 4.5, modes: [4], min: 2, max: 9, range: 7, variance: 4, stdDev: 2 });
    // La muestral divide entre n − 1: 32 / 7
    expect(measures.sampleVariance).toBeCloseTo(32 / 7, 10);
    expect(dataMeasures([1, 1, 3, 3])!.modes).toEqual([]);
    expect(dataMeasures([3, 1, 3, 1, 2])!.modes).toEqual([1, 3]);
    expect(dataMeasures([7])).toMatchObject({ n: 1, mean: 7, median: 7, modes: [7], range: 0, variance: 0, sampleVariance: null });
    expect(dataMeasures([])).toBeNull();
    // Sin ruido binario: (0.1 + 0.2) / 2
    expect(dataMeasures([0.1, 0.2])!.mean).toBe(0.15);
  });

  it("de valores ya contados da lo mismo que de los datos sueltos", () => {
    const values = [
      { value: 0, count: 4 },
      { value: 1, count: 7 },
      { value: 2, count: 5 },
      { value: 3, count: 3 },
      { value: 4, count: 1 },
    ];
    const expanded = values.flatMap(item => Array.from({ length: item.count }, () => item.value));
    expect(measuresOf(values)).toEqual(dataMeasures(expanded));
    expect(measuresOf(values)).toMatchObject({ n: 20, mean: 1.5, median: 1, modes: [1], range: 4, variance: 1.25 });
    // Los de frecuencia cero no son datos
    expect(measuresOf([...values, { value: 10, count: 0 }])).toEqual(measuresOf(values));
  });

  it("la mediana sigue el criterio de la caja y bigotes", () => {
    const random = seeded(7);
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(random() * 30);
      const data = Array.from({ length: n }, () => Math.round(random() * 40) / 4 - 3);
      const median = dataMeasures(data)!.median;
      expect(median).toBe(medianOfSorted(sortAscending(data)));
      if (n >= 2) expect(median).toBe(fiveNumberSummary(data)!.median);
    }
  });

  it("escribe una medida exacta, o redondeada con ≈", () => {
    expect(measureText(1.5)).toBe("1,5");
    expect(measureText(10 / 3)).toBe("≈ 3,33");
    expect(measureText(1234.5)).toBe("1.234,5");
    // Redondeado, siempre con dos decimales: 5/51 no sale «≈ 0,1»
    expect(measureText(5 / 51)).toBe("≈ 0,10");
    expect(measureText(-10 / 3)).toBe("≈ -3,33");
    expect(measureText(100000 / 7)).toBe("≈ 14.285,71");
    expect(joinEs(["2"])).toBe("2");
    expect(joinEs(["2", "4"])).toBe("2 y 4");
    expect(joinEs(["1", "3", "5"])).toBe("1, 3 y 5");
    expect(joinEs(["Arte", "Inglés"])).toBe("Arte e Inglés");
    expect(joinEs(["Agua", "hielo"])).toBe("Agua y hielo");
  });

  it("cuenta los valores distintos en orden", () => {
    expect(distributionOf([3, 1, 3, 2, 1, 3])).toEqual([
      { value: 1, count: 2 },
      { value: 2, count: 1 },
      { value: 3, count: 3 },
    ]);
  });
});

describe("frecuencia relativa", () => {
  it("exacta cuando el número de datos lo permite", () => {
    expect(relativeShares([4, 7, 5, 3, 1])).toEqual({ units: [20, 35, 25, 15, 5], percentDecimals: 0, rounded: false });
    // Con 8 datos hace falta un decimal en el porcentaje: 12,5 %
    expect(relativeShares([1, 3, 4])).toEqual({ units: [125, 375, 500], percentDecimals: 1, rounded: false });
    // Con 16, dos: 6,25 %
    expect(relativeShares([1, 15])).toEqual({ units: [625, 9375], percentDecimals: 2, rounded: false });
  });

  it("si no es exacta, redondea por el resto mayor y la columna suma 100", () => {
    const thirds = relativeShares([1, 1, 1]);
    expect(thirds).toEqual({ units: [34, 33, 33], percentDecimals: 0, rounded: true });
    expect(thirds.units).toEqual(roundPercents([1, 1, 1]));
    const random = seeded(3);
    for (let trial = 0; trial < 100; trial++) {
      const counts = Array.from({ length: 2 + Math.floor(random() * 10) }, () => Math.floor(random() * 15));
      if (counts.every(count => count === 0)) continue;
      const shares = relativeShares(counts);
      expect(shares.units.reduce((sum, value) => sum + value, 0)).toBe(100 * 10 ** shares.percentDecimals);
    }
  });

  it("la tabla escribe los valores redondeados y avisa", () => {
    const view = frequencyTableView(frequency({ categories: [{ label: "A", count: 1 }, { label: "B", count: 1 }, { label: "C", count: 1 }], relative: ["decimal", "percent"], cumulativeRelative: true }))!;
    expect(view.rows.map(row => row.cells.map(cell => cell.text))).toEqual([
      ["1", "0,34", "34 %", "0,34"],
      ["1", "0,33", "33 %", "0,67"],
      ["1", "0,33", "33 %", "1,00"],
    ]);
    expect(view.totals!.map(cell => cell.text)).toEqual(["3", "1", "100 %", ""]);
    expect(view.note).toContain("ajustadas para que sumen 1");
    // Si la columna redondeada va en blanco, la nota sobra
    expect(frequencyTableView(frequency({ categories: [{ label: "A", count: 1 }, { label: "B", count: 2 }], relative: ["percent"], blank: ["relative"] }))!.note).toBeNull();
  });
});

describe("tabla de frecuencias", () => {
  it("cuenta datos sueltos: un valor por fila, de menor a mayor", () => {
    const view = frequencyTableView(frequency({ data: [2, 0, 1, 1, 2, 2, 3, 1, 0, 2], relative: ["fraction", "decimal", "percent"], cumulative: true }))!;
    expect(view.columns.map(column => column.title)).toEqual(["Frecuencia absoluta", "Frecuencia relativa (fracción)", "Frecuencia relativa (decimal)", "Porcentaje", "Frecuencia acumulada"]);
    expect(view.rows.map(row => row.label)).toEqual(["0", "1", "2", "3"]);
    expect(view.rows[1].cells).toEqual([{ text: "3" }, { text: "3/10", latex: "\\dfrac{3}{10}" }, { text: "0,30" }, { text: "30 %" }, { text: "5" }]);
    expect(view.totals!.map(cell => cell.text)).toEqual(["10", "1", "1", "100 %", ""]);
    expect(view.note).toBeNull();
  });

  it("agrupa con las mismas clases y el mismo conteo que el histograma", () => {
    const data = [150, 152, 154.5, 155, 158, 160, 161, 163, 165, 170];
    const spec = frequency({ data, classes: { start: 150, width: 5 }, classMark: true });
    const built = buildFrequencyTable(spec);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // 170 es el límite superior de la última clase, que lo incluye: no pide otra clase
    expect(classesNeeded(150, 5, data)).toBe(4);
    const classes = buildHistogramClasses(150, 5, [0, 0, 0, 0]);
    expect(built.model.rows.map(row => row.count)).toEqual(histogramCounts(data, classes).counts);
    expect(built.model.rows.map(row => row.label)).toEqual(["[150, 155)", "[155, 160)", "[160, 165)", "[165, 170]"]);
    const view = frequencyTableView(spec)!;
    expect(view.columns[0]).toMatchObject({ key: "classMark", title: "Marca de clase" });
    expect(view.rows.map(row => row.cells[0].text)).toEqual(["152,5", "157,5", "162,5", "167,5"]);
  });

  it("separa con punto y coma los límites con decimales", () => {
    expect(classLabel(1.5, 2, false)).toBe("[1,5; 2)");
    expect(classLabel(10, 20, true)).toBe("[10, 20]");
  });

  it("estima con las marcas de clase como se hace sin los datos crudos", () => {
    const estimates = groupedEstimates([
      { from: 150, to: 155, count: 3 },
      { from: 155, to: 160, count: 7 },
      { from: 160, to: 165, count: 6 },
      { from: 165, to: 170, count: 4 },
    ])!;
    // (152,5·3 + 157,5·7 + 162,5·6 + 167,5·4) / 20 = 160,25; n/2 = 10 cae en la segunda clase: 155 + (10 − 3)/7 · 5 = 160
    expect(estimates).toMatchObject({ mean: 160.25, medianClass: 1, median: 160, modalClasses: [1], range: 20 });
    // Σ f·(x − 160,25)² / 20 con las marcas 152,5 · 157,5 · 162,5 · 167,5
    expect(estimates.variance).toBeCloseTo((3 * 7.75 ** 2 + 7 * 2.75 ** 2 + 6 * 2.25 ** 2 + 4 * 7.25 ** 2) / 20, 9);
  });

  it("escribe las medidas bajo la tabla, o su espacio en blanco", () => {
    const spec = frequency({ values: [{ value: 0, count: 4 }, { value: 1, count: 7 }, { value: 2, count: 5 }, { value: 3, count: 3 }, { value: 4, count: 1 }], measures: ["mode", "mean", "stdDev"] });
    expect(frequencyTableView(spec)!.measures).toEqual([
      { key: "mean", name: "Media", value: "1,5", blank: false },
      { key: "mode", name: "Moda", value: "1", blank: false },
      { key: "stdDev", name: "Desviación estándar", value: "≈ 1,12", blank: false },
    ]);
    const blank = frequencyTableView(frequency({ data: [1, 1, 2, 2], measures: ["mode"], blank: ["measures"] }))!;
    expect(blank.measures).toEqual([{ key: "mode", name: "Moda", value: "no hay", blank: true }]);
    const grouped = frequencyTableView(frequency({ data: [1, 2, 2, 7], classes: { start: 0, width: 5 }, measures: ["mode", "mean", "median", "range"] }))!;
    // Con clases, lo que sale de la tabla: marcas 2,5 y 7,5 → media (3·2,5 + 7,5)/4 = 3,75; mediana 0 + (2 − 0)/3 · 5; rango 10 − 0
    expect(grouped.measures).toEqual([
      { key: "mean", name: "Media", value: "3,75", blank: false },
      { key: "median", name: "Mediana", value: "≈ 3,33", blank: false },
      { key: "mode", name: "Clase modal", value: "[0, 5)", blank: false },
      { key: "range", name: "Rango", value: "10", blank: false },
    ]);
    const categories = frequencyTableView(frequency({ categories: [{ label: "Fútbol", count: 5 }, { label: "Tenis", count: 5 }, { label: "Patinaje", count: 2 }], measures: ["mode"] }))!;
    expect(categories.measures[0]).toMatchObject({ name: "Modas", value: "Fútbol y Tenis" });
  });

  it("rechaza lo que no se puede armar, con un aviso claro", () => {
    const issues = (input: Record<string, unknown>) => validateBlock(frequency(input)).join(" | ");
    expect(issues({})).toContain("da los datos de una sola forma");
    expect(issues({ data: [1, 2], categories: [{ label: "A", count: 1 }, { label: "B", count: 1 }] })).toContain("da los datos de una sola forma");
    expect(issues({ data: Array.from({ length: 13 }, (_, i) => i) })).toContain("13 valores distintos");
    expect(issues({ data: [4, 4, 4] })).toContain("al menos dos valores distintos");
    expect(issues({ data: [1, 2, 30], classes: { start: 0, width: 2 } })).toContain("hacen falta 15 clases");
    expect(issues({ data: [1, 2, 30], classes: { start: 0, width: 5, count: 3 } })).toContain("un dato queda fuera de las clases");
    // Datos antes de la primera clase: no sirve «reduce el ancho»
    expect(issues({ data: [1, 2, 3], classes: { start: 10, width: 5 } })).toContain("3 datos son menores que el inicio de la primera clase");
    expect(issues({ values: [{ value: 2, count: 1 }, { value: 1, count: 1 }] })).toContain("ordénalos");
    expect(issues({ values: [{ value: 1, count: 1 }, { value: 1, count: 2 }] })).toContain("está repetido");
    expect(issues({ categories: [{ label: "Sí", count: 1 }, { label: "sí ", count: 2 }] })).toContain("repetida");
    expect(issues({ categories: [{ label: "Total", count: 1 }, { label: "Otro", count: 2 }] })).toContain("fila de totales");
    expect(issues({ categories: [{ label: "A", count: 0 }, { label: "B", count: 0 }] })).toContain("no hay datos");
    expect(issues({ categories: [{ label: "A", count: 1 }, { label: "B", count: 2 }], measures: ["mean", "mode"] })).toContain('"mean" necesita datos numéricos');
    expect(issues({ values: [{ value: 1, count: 1 }, { value: 2, count: 2 }], classes: { start: 0, width: 1 } })).toContain("úsalas con data");
    expect(issues({ data: [1, 2], classMark: true })).toContain("solo existe con datos agrupados");
    expect(issues({ data: [1, 2], blank: ["cumulative"] })).toContain('blank incluye "cumulative"');
    expect(issues({ data: [1, 2], relative: ["percent", "percent"] })).toContain("repetido en relative");
    // Los rótulos son texto plano: el LaTeX saldría con los signos a la vista
    expect(issues({ variable: "$x_i$", data: [1, 2] })).toContain("texto plano");
    expect(issues({ data: [1, 2] })).toBe("");
  });

  it("rechaza una tabla que no cabe a lo ancho de la hoja", () => {
    const wide = frequency({ variable: "Electrodomésticosdelhogarcolombiano", data: [1, 2], relative: ["fraction", "decimal", "percent"], cumulative: true, cumulativeRelative: true });
    expect(validateBlock(wide).join(" ")).toMatch(/mide unos \d+ px y la hoja 695/);
  });
});

describe("tabla de contingencia", () => {
  it("calcula los totales por fila, por columna y el general", () => {
    const view = contingencyTableView(contingency({}))!;
    expect(view.rowTotals).toEqual([25, 26]);
    expect(view.columnTotals).toEqual([21, 19, 11]);
    expect(view.total).toBe(51);
    expect(view.rows.map(row => row.total!.text)).toEqual(["25", "26"]);
    expect(view.totals!.cells.map(cell => cell.text)).toEqual(["21", "19", "11"]);
    expect(view.totals!.total.text).toBe("51");
  });

  it("en frecuencias relativas, los totales suman lo que se ve", () => {
    const view = contingencyTableView(
      contingency({
        columns: ["Sí", "No"],
        rows: [
          { label: "A", counts: [1, 1] },
          { label: "B", counts: [1, 0] },
        ],
        display: "percent",
      }),
    )!;
    expect(view.rows.map(row => row.cells.map(cell => cell.text))).toEqual([
      ["34 %", "33 %"],
      ["33 %", "0 %"],
    ]);
    expect(view.rows.map(row => row.total!.text)).toEqual(["67 %", "33 %"]);
    expect(view.totals!.cells.map(cell => cell.text)).toEqual(["67 %", "33 %"]);
    expect(view.totals!.total.text).toBe("100 %");
    expect(view.note).toContain("100 %");
    const fractions = contingencyTableView(contingency({ display: "fraction" }))!;
    expect(fractions.rows[0].cells[0]).toMatchObject({ text: "12/51", latex: "\\dfrac{12}{51}" });
  });

  it("deja en blanco las celdas pedidas por su fila y su columna, totales incluidos", () => {
    const view = contingencyTableView(
      contingency({
        blank: [
          { row: "sexto", column: "En bus" },
          { row: "Total", column: "A pie" },
          { row: "Séptimo", column: "Total" },
          { row: "Total", column: "Total" },
        ],
      }),
    )!;
    expect(view.rows[0].cells.map(cell => cell.blank)).toEqual([false, true, false]);
    expect(view.rows[1].total!.blank).toBe(true);
    expect(view.totals!.cells.map(cell => cell.blank)).toEqual([true, false, false]);
    expect(view.totals!.total.blank).toBe(true);
  });

  it("rechaza lo que no cuadra", () => {
    const issues = (input: Record<string, unknown>) => validateBlock(contingency(input)).join(" | ");
    expect(issues({ rows: [{ label: "A", counts: [1, 2] }, { label: "B", counts: [1, 2, 3] }] })).toContain("tiene 2 conteos y hay 3 columnas");
    expect(issues({ columns: ["Sí", "sí", "No"] })).toContain("la columna «sí» está repetida");
    expect(issues({ rows: [{ label: "Total", counts: [1, 2, 3] }, { label: "B", counts: [1, 2, 3] }] })).toContain("el nombre de los totales");
    expect(issues({ rows: [{ label: "A", counts: [0, 0, 0] }, { label: "B", counts: [1, 2, 3] }] })).toContain("la fila «A» suma cero");
    expect(issues({ blank: [{ row: "Octavo", column: "A pie" }] })).toContain("nombra la fila «Octavo», que no existe");
    expect(issues({ totals: false, blank: [{ row: "Total", column: "A pie" }] })).toContain("pon totals en true");
    const longColumns = ["Electrodomésticos", "Herramientaseléctricas", "Instrumentosmusicales", "Juguetesdidácticos"];
    expect(issues({ columns: longColumns, rows: [{ label: "A", counts: [1, 2, 3, 4] }, { label: "B", counts: [4, 3, 2, 1] }] })).toMatch(/mide unos \d+ px/);
    expect(issues({ rowVariable: "\\text{Grado}" })).toContain("texto plano");
    expect(issues({})).toBe("");
  });

  it("escribe las probabilidades como las pone la clave", () => {
    expect(probabilityText(8, 20)).toBe("8/20 = 2/5 = 0,4");
    expect(probabilityText(7, 30)).toBe("7/30 ≈ 0,23");
    expect(probabilityText(0, 20)).toBe("0/20 = 0");
    expect(probabilityText(20, 20)).toBe("20/20 = 1");
  });

  it("le devuelve a la IA las condicionales y si hay independencia", () => {
    const text = describeContingencyTable(contingency({ rowVariable: "Grado", columnVariable: "Transporte" }))!;
    expect(text).toContain("n = 51; filas: Grado; columnas: Transporte");
    expect(text).toContain("P(Sexto) = 25/51 ≈ 0,49");
    expect(text).toContain("P(Sexto y A pie) = 12/51 = 4/17 ≈ 0,24");
    expect(text).toContain("P(A pie | Sexto) = 12/25 = 0,48");
    expect(text).toContain("P(Sexto | A pie) = 12/21 = 4/7 ≈ 0,57");
    expect(text).toContain("no son independientes");
    const independent = describeContingencyTable(
      contingency({
        columns: ["Sí", "No"],
        rows: [
          { label: "A", counts: [2, 4] },
          { label: "B", counts: [3, 6] },
        ],
      }),
    )!;
    expect(independent).toContain("Las dos variables son independientes");
  });
});

describe("lo que ve la IA", () => {
  it("recibe los dos tipos en el esquema y en las instrucciones", () => {
    const serialized = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    for (const type of ["frequency_table", "contingency_table"]) {
      expect(serialized, type).toContain(`"${type}"`);
      expect(CREATOR_SYSTEM_PROMPT, type).toContain(type);
    }
    expect(CREATOR_SYSTEM_PROMPT).toMatch(/nunca va en un bloque table/);
    expect(BLOCK_TYPE_LABELS.frequency_table).toBe("Tabla de frecuencias");
  });

  it("le devuelve la tabla y las medidas como salen en la hoja", () => {
    const text = describeFrequencyTable(frequency({ variable: "Hermanos", values: [{ value: 0, count: 4 }, { value: 1, count: 7 }, { value: 2, count: 5 }, { value: 3, count: 3 }, { value: 4, count: 1 }], cumulative: true }))!;
    expect(text).toContain("Tabla de frecuencias «Hermanos» (n = 20");
    expect(text).toContain("1: f = 7, h = 0,35, F = 11");
    expect(text).toContain("media 1,5 · mediana 1 · moda 1 · rango 4 · varianza 1,25 · desviación estándar ≈ 1,12 (dividiendo entre n; con n − 1 serían ≈ 1,32 y ≈ 1,15)");
    const rounded = describeFrequencyTable(frequency({ categories: [{ label: "A", count: 1 }, { label: "B", count: 1 }, { label: "C", count: 1 }], relative: ["percent"] }))!;
    expect(rounded).toContain("A: f = 1, h % = 34 %");
    expect(rounded).toContain("resto mayor");
    expect(rounded).toContain("No hay moda");
    const grouped = describeFrequencyTable(frequency({ data: [150, 152, 156, 158, 159, 161, 166], classes: { start: 150, width: 5 } }))!;
    expect(grouped).toContain("Medidas de los datos crudos");
    expect(grouped).toContain("Con las marcas de clase");
    expect(describeComputed(frequency({ data: [1, 2, 2] }))).toBe(describeFrequencyTable(frequency({ data: [1, 2, 2] })));
  });

  it("las figuras con datos crudos también devuelven la media y la moda", () => {
    expect(describeComputed(block({ type: "box_plot", series: [{ label: "9A", data: [1, 2, 3, 4, 5, 6, 7, 8, 9] }] }))).toBe(
      "Caja y bigotes: «9A»: mínimo 1 · Q1 2,5 · mediana 5 · Q3 7,5 · máximo 9 · media 5 · sin moda (todos los valores se repiten igual) · rango 8 · varianza ≈ 6,67 · desviación estándar ≈ 2,58 (dividiendo entre n; con n − 1 serían 7,5 y ≈ 2,74).",
    );
    const histogram = describeComputed(
      block({
        type: "histogram",
        classes: buildHistogramClasses(0, 10, [1, 3, 1]),
        data: [5, 12, 15, 15, 28],
      }),
    )!;
    expect(histogram).toContain("Medidas de los datos: media 15 · mediana 15 · moda 15");
    expect(histogram).toContain("Con las marcas de clase (sin los datos crudos): media estimada 15");
    // Sin datos crudos, solo lo que se estima de las clases
    expect(describeComputed(block({ type: "histogram", classes: buildHistogramClasses(0, 10, [2, 2]) }))).toContain("no hay clase modal");
  });

  it("al escribir la sección, el resultado de la herramienta trae lo calculado", () => {
    const outcome = executeCreatorTool(emptyDoc(), "write_section", {
      title: "Guía",
      role: "student",
      blocks: [
        { type: "frequency_table", variable: "Goles", data: [0, 1, 1, 2, 3], measures: ["mean"] },
        { type: "contingency_table", columns: ["Sí", "No"], rows: [{ label: "A", counts: [1, 2] }, { label: "B", counts: [3, 4] }] },
      ],
    });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("Valores calculados por el sistema");
    expect(outcome.result).toContain("media 1,4");
    expect(outcome.result).toContain("P(Sí | A) = 1/3 ≈ 0,33");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "frequency_table", variable: "Goles", data: [1, 2], classMark: true }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("marca de clase");
  });
});

describe("en la hoja", () => {
  it("se resumen en el índice y piden su ancho dentro de una columna", () => {
    expect(blockPreview(frequency({ data: [1, 2] }))).toBe("Tabla de frecuencias: Dato");
    expect(blockPreview(contingency({ rowVariable: "Grado", columnVariable: "Transporte" }))).toBe("Tabla de contingencia: Grado por Transporte");
    const narrow = minBlockWidth(frequency({ data: [1, 2] }));
    const wide = minBlockWidth(frequency({ data: [1, 2], relative: ["fraction", "decimal", "percent"], cumulative: true, cumulativeRelative: true }));
    expect(narrow).toBeLessThan(wide);
    expect(wide).toBeLessThanOrEqual(695);
  });
});

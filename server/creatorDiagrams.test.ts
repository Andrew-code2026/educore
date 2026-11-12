import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, blockTexts, emptyDoc, mapBlockTexts, parseDoc, resourceDocSchema, type BlockInput } from "@shared/creator";
import {
  baseTenValue,
  clockAngles,
  clockText,
  formatProbability,
  multiplyProbabilities,
  parseProbability,
  pictogramIcons,
  siblingGroups,
  sumProbabilities,
  textToTree,
  treePaths,
  treeToText,
  vennRegionName,
  vennRegionsFor,
} from "@shared/creatorDiagrams";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const CLASSROOM_TYPES = ["angle", "venn", "tree_diagram", "bar_model", "pictogram", "clock", "base_ten"] as const;

const coin = (probability?: string) => [
  { label: "Cara", probability, children: [{ label: "Cara", probability }, { label: "Sello", probability }] },
  { label: "Sello", probability, children: [{ label: "Cara", probability }, { label: "Sello", probability }] },
];

describe("probabilidades del diagrama de árbol", () => {
  it("lee fracciones, decimales y porcentajes", () => {
    expect(parseProbability("1/2")).toEqual({ n: 1, d: 2, style: "fraction" });
    expect(parseProbability(" 2 / 6 ")).toEqual({ n: 1, d: 3, style: "fraction" });
    expect(parseProbability("0.25")).toEqual({ n: 1, d: 4, style: "decimal" });
    expect(parseProbability("0,25")).toEqual({ n: 1, d: 4, style: "decimal" });
    expect(parseProbability("25%")).toEqual({ n: 1, d: 4, style: "percent" });
    expect(parseProbability("12.5 %")).toEqual({ n: 1, d: 8, style: "percent" });
    expect(parseProbability("1")).toEqual({ n: 1, d: 1, style: "decimal" });
  });

  it("no inventa una probabilidad donde no la hay", () => {
    for (const text of ["", "un medio", "1/0", "-1/2", "1/2/3", "x"]) expect(parseProbability(text), text).toBeNull();
    expect(parseProbability(undefined)).toBeNull();
  });

  it("multiplica las ramas de un camino y responde en el formato en que se escribieron", () => {
    const fraction = (text: string) => parseProbability(text)!;
    expect(formatProbability(multiplyProbabilities([fraction("1/2"), fraction("1/2")]))).toBe("1/4");
    expect(formatProbability(multiplyProbabilities([fraction("2/5"), fraction("1/4")]))).toBe("1/10");
    expect(formatProbability(multiplyProbabilities([fraction("0.5"), fraction("0.3")]))).toBe("0,15");
    expect(formatProbability(multiplyProbabilities([fraction("50%"), fraction("30%")]))).toBe("15 %");
    // Mezclar formatos da un decimal
    expect(formatProbability(multiplyProbabilities([fraction("1/2"), fraction("0.3")]))).toBe("0,15");
    expect(formatProbability(multiplyProbabilities([fraction("1/1"), fraction("3/3")]))).toBe("1");
  });

  it("suma sin error de redondeo", () => {
    expect(sumProbabilities(["1/3", "1/3", "1/3"].map(text => parseProbability(text)!))).toBe(1);
    expect(sumProbabilities(["0.1", "0.2", "0.7"].map(text => parseProbability(text)!))).toBe(1);
    expect(sumProbabilities(["1/2", "1/3"].map(text => parseProbability(text)!))).toBeCloseTo(5 / 6, 12);
  });

  it("recorre los caminos del árbol en el orden en que se dibujan", () => {
    const paths = treePaths(coin("1/2"));
    expect(paths.map(path => path.labels.join(""))).toEqual(["CaraCara", "CaraSello", "SelloCara", "SelloSello"]);
    expect(paths.map(path => formatProbability(path.probability!))).toEqual(["1/4", "1/4", "1/4", "1/4"]);
    // Sin reposición: 3 rojas y 2 azules
    const urn = [
      { label: "Roja", probability: "3/5", children: [{ label: "Roja", probability: "2/4" }, { label: "Azul", probability: "2/4" }] },
      { label: "Azul", probability: "2/5", children: [{ label: "Roja", probability: "3/4" }, { label: "Azul", probability: "1/4" }] },
    ];
    expect(treePaths(urn).map(path => formatProbability(path.probability!))).toEqual(["3/10", "3/10", "3/10", "1/10"]);
    expect(treePaths(coin()).every(path => path.probability === null)).toBe(true);
    expect(siblingGroups(coin("1/2")).map(group => group.nodes.length)).toEqual([2, 2, 2]);
  });

  it("pasa el árbol a esquema de texto y de vuelta", () => {
    const text = treeToText(coin("1/2"));
    expect(text).toBe("Cara 1/2\n  Cara 1/2\n  Sello 1/2\nSello 1/2\n  Cara 1/2\n  Sello 1/2");
    expect(treeToText(textToTree(text))).toBe(text);
    const parsed = textToTree("Bola 2\n  Sale par 50%\n\tSale impar 0.5\nDado 1");
    expect(parsed.map(node => [node.label, node.probability])).toEqual([["Bola 2", undefined], ["Dado 1", undefined]]);
    expect(parsed[0].children!.map(node => [node.label, node.probability])).toEqual([["Sale par", "50%"], ["Sale impar", "0.5"]]);
    // Más sangría de la que admite el árbol: el renglón se queda en el tercer nivel
    const deep = textToTree("A\n  B\n    C\n      D");
    expect(deep[0].children![0].children!.map(node => node.label)).toEqual(["C", "D"]);
  });
});

describe("cálculos de las demás figuras de aula", () => {
  it("nombra las zonas de un diagrama de Venn", () => {
    expect(vennRegionsFor(2)).toEqual(["a", "b", "ab", "outside"]);
    expect(vennRegionsFor(3)).toHaveLength(8);
    const sets = ["Fútbol", "Baloncesto", "Voleibol"];
    expect(vennRegionName("a", sets)).toBe("solo Fútbol");
    expect(vennRegionName("bc", sets)).toBe("Baloncesto y Voleibol");
    expect(vennRegionName("abc", sets)).toBe("Fútbol, Baloncesto y Voleibol");
    expect(vennRegionName("outside", sets)).toBe("fuera de los conjuntos");
  });

  it("mueve la manecilla de la hora con los minutos", () => {
    expect(clockAngles(3, 0)).toEqual({ hour: 90, minute: 0 });
    expect(clockAngles(7, 30)).toEqual({ hour: 225, minute: 180 });
    expect(clockAngles(12, 0)).toEqual({ hour: 0, minute: 0 });
    expect(clockAngles(15, 45)).toEqual({ hour: 112.5, minute: 270 });
    expect(clockText(7, 5)).toBe("7:05");
  });

  it("calcula cuántos dibujos lleva una fila del pictograma", () => {
    expect(pictogramIcons(8, 2)).toEqual({ full: 4, half: false, exact: true });
    expect(pictogramIcons(5, 2)).toEqual({ full: 2, half: true, exact: true });
    expect(pictogramIcons(0, 2)).toEqual({ full: 0, half: false, exact: true });
    expect(pictogramIcons(4.5, 2).exact).toBe(false);
    expect(pictogramIcons(25, 10)).toEqual({ full: 2, half: true, exact: true });
  });

  it("suma el valor de los bloques de base 10", () => {
    expect(baseTenValue({ hundreds: 2, tens: 3, ones: 5 })).toBe(235);
    expect(baseTenValue({ hundreds: 0, tens: 12, ones: 14 })).toBe(134);
  });
});

describe("figuras de aula: esquema y validación", () => {
  it("revisa los ángulos", () => {
    expect(validateBlock(block({ type: "angle", angles: [{ degrees: 65 }] }))).toEqual([]);
    expect(validateBlock(block({ type: "angle", angles: [{ degrees: 65, label: "$\\alpha$" }, { degrees: 200 }], showMeasures: false }))).toEqual([]);
    expect(validateBlock(block({ type: "angle", angles: [{ degrees: 200 }], protractor: true }))).toHaveLength(1);
    expect(validateBlock(block({ type: "angle", angles: [{ degrees: 30 }, { degrees: 60 }, { degrees: 90 }], protractor: true }))).toHaveLength(1);
    expect(validateBlock(block({ type: "angle", angles: [{ degrees: 30, label: "$\\frac{1}{$" }] }))).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "angle", angles: [{ degrees: 400 }] }).success).toBe(false);
  });

  it("revisa el diagrama de Venn", () => {
    const sets = ["Fútbol", "Baloncesto"];
    expect(validateBlock(block({ type: "venn", sets, regions: [{ region: "a", text: "8" }, { region: "ab", text: "5", shaded: true }, { region: "outside", text: "3" }] }))).toEqual([]);
    expect(validateBlock(block({ type: "venn", sets }))).toEqual([]);
    const third = validateBlock(block({ type: "venn", sets, regions: [{ region: "abc", text: "2" }] }));
    expect(third).toHaveLength(1);
    expect(third[0]).toContain("2 conjuntos");
    expect(validateBlock(block({ type: "venn", sets, regions: [{ region: "a", text: "8" }, { region: "a", text: "9" }] }))).toHaveLength(1);
    expect(validateBlock(block({ type: "venn", sets: [...sets, "Voleibol"], regions: [{ region: "abc", text: "2" }] }))).toEqual([]);
    expect(blockInputSchema.safeParse({ type: "venn", sets: ["Solo uno"] }).success).toBe(false);
  });

  it("comprueba que las ramas del árbol sumen 1", () => {
    expect(validateBlock(block({ type: "tree_diagram", branches: coin("1/2"), showResults: true }))).toEqual([]);
    expect(validateBlock(block({ type: "tree_diagram", branches: coin() }))).toEqual([]);
    const wrong = validateBlock(block({ type: "tree_diagram", branches: [{ label: "Roja", probability: "3/5" }, { label: "Azul", probability: "3/5" }] }));
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toContain("suman 1.2");
    // Tercios escritos como decimales: se acepta el redondeo
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "0.33" }, { label: "B", probability: "0.33" }, { label: "C", probability: "0.34" }] }))).toEqual([]);
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "0.4" }, { label: "B", probability: "0.4" }] }))).toHaveLength(1);
  });

  it("revisa probabilidades ilegibles, mayores que 1 y caminos sin probabilidad", () => {
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "medio" }, { label: "B", probability: "1/2" }] }))[0]).toContain("no se entiende");
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "3/2" }, { label: "B" }] }))[0]).toContain("mayor que 1");
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "1/2" }, { label: "B" }] }))).toEqual([]);
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "A", probability: "1/2" }, { label: "B" }], showResults: true }))).toHaveLength(1);
    const wide = Array.from({ length: 4 }, (_, i) => ({ label: `R${i}`, children: Array.from({ length: 4 }, (_, j) => ({ label: `S${j}` })) }));
    expect(validateBlock(block({ type: "tree_diagram", branches: wide }))[0]).toContain("16 caminos");
  });

  it("revisa el modelo de barras y el pictograma", () => {
    expect(validateBlock(block({ type: "bar_model", bars: [{ label: "Ana", parts: [{ value: 12 }, { value: 8, label: "?" }], total: "20" }, { label: "Luis", parts: [{ value: 15 }] }] }))).toEqual([]);
    expect(validateBlock(block({ type: "bar_model", bars: [{ parts: [{ value: 1 }, { value: 999 }] }] }))).toHaveLength(1);
    const rows = [{ label: "Fútbol", value: 8 }, { label: "Baloncesto", value: 5 }];
    expect(validateBlock(block({ type: "pictogram", iconValue: 2, rows }))).toEqual([]);
    expect(validateBlock(block({ type: "pictogram", iconValue: 4, rows }))[0]).toContain("Baloncesto");
    expect(validateBlock(block({ type: "pictogram", iconValue: 1, rows: [{ label: "A", value: 30 }, { label: "B", value: 2 }] }))[0]).toContain("más de 12");
    const empty = [{ label: "A", value: 0 }, { label: "B", value: 0 }];
    expect(validateBlock(block({ type: "pictogram", rows: empty }))).toHaveLength(1);
    expect(validateBlock(block({ type: "pictogram", rows: empty, blank: true }))).toEqual([]);
  });

  it("revisa el reloj y los bloques de base 10", () => {
    expect(validateBlock(block({ type: "clock", clocks: [{ hour: 7, minute: 30 }, { hour: 15 }] }))).toEqual([]);
    expect(blockInputSchema.safeParse({ type: "clock", clocks: [{ hour: 25, minute: 0 }] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "clock", clocks: [{ hour: 7, minute: 60 }] }).success).toBe(false);
    expect(validateBlock(block({ type: "base_ten", hundreds: 2, tens: 3, ones: 5 }))).toEqual([]);
    expect(validateBlock(block({ type: "base_ten" }))).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "base_ten", hundreds: 10 }).success).toBe(false);
  });

  it("nombra, resume y guarda los siete tipos, y los trata como figuras", () => {
    const samples: BlockInput[] = [
      block({ type: "angle", angles: [{ degrees: 65 }] }),
      block({ type: "venn", sets: ["A", "B"] }),
      block({ type: "tree_diagram", branches: coin("1/2") }),
      block({ type: "bar_model", bars: [{ parts: [{ value: 3 }, { value: 2 }] }] }),
      block({ type: "pictogram", rows: [{ label: "A", value: 2 }, { label: "B", value: 1 }] }),
      block({ type: "clock", clocks: [{ hour: 3, minute: 15 }] }),
      block({ type: "base_ten", tens: 4, ones: 2 }),
    ];
    expect(samples.map(sample => sample.type)).toEqual([...CLASSROOM_TYPES]);
    const exercise = block({ type: "exercise", label: "Ejercicio 1", md: "Responde." });
    for (const sample of samples) {
      expect(BLOCK_TYPE_LABELS[sample.type].length).toBeGreaterThan(3);
      expect(blockPreview(sample).length).toBeGreaterThan(0);
      expect(validateBlockOrder([{ title: "Guía", blocks: [exercise, sample] }]), sample.type).toHaveLength(1);
    }
    const doc = { ...emptyDoc("Figuras"), sections: [{ id: "s1", title: "Guía", role: "student", blocks: samples.map((sample, index) => ({ ...sample, id: `b${index}` })) }] };
    expect(resourceDocSchema.safeParse(doc).success).toBe(true);
  });

  it("normaliza y valida el rótulo de un ángulo como cualquier otro texto", () => {
    const angle = block({ type: "angle", angles: [{ degrees: 40, label: "$x$" }, { degrees: 50 }] });
    expect(blockTexts(angle)).toEqual(["$x$"]);
    expect(mapBlockTexts(angle, text => text.toUpperCase())).toMatchObject({ angles: [{ label: "$X$" }, { degrees: 50 }] });
  });
});

describe("recta numérica con intervalos y balanza con pesas", () => {
  const line = (intervals: unknown[]) => validateBlock(block({ type: "number_line", min: -5, max: 5, step: 1, intervals }));

  it("acepta intervalos y semirrectas", () => {
    expect(line([{ from: -2, to: 3, fromClosed: true }])).toEqual([]);
    expect(line([{ from: 2 }])).toEqual([]);
    expect(line([{ to: -1, toClosed: true }, { from: 3, to: null }])).toEqual([]);
  });

  it("rechaza intervalos sin extremos, invertidos o fuera de la recta", () => {
    expect(line([{}])).toHaveLength(1);
    expect(line([{ from: 3, to: 1 }])).toHaveLength(1);
    expect(line([{ from: 2, to: 9 }])).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "number_line", min: 0, max: 5, step: 1, intervals: [{ from: 1 }, { from: 2 }, { from: 3 }, { from: 4 }] }).success).toBe(false);
  });

  it("una pesa con número cuenta como contenido del platillo", () => {
    expect(validateBlock(block({ type: "balance", left: { variables: 2, units: 5 }, right: { weights: [15] } }))).toEqual([]);
    expect(validateBlock(block({ type: "balance", left: { variables: 2 }, right: {} }))).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "balance", left: { variables: 1 }, right: { weights: [0] } }).success).toBe(false);
  });

  it("los recursos guardados antes de estos campos se siguen abriendo", () => {
    const old = { title: "Guía", sections: [{ id: "s1", title: "Guía", role: "student", blocks: [
      { id: "b1", type: "number_line", min: 0, max: 10, step: 1, labelEvery: 1, showNumbers: true, points: [], jumps: [] },
      { id: "b2", type: "balance", variable: "x", left: { variables: 2, units: 1 }, right: { variables: 0, units: 7 } },
    ] }] };
    const doc = parseDoc(old);
    expect(doc.sections[0].blocks).toHaveLength(2);
    expect(doc.sections[0].blocks[0]).toMatchObject({ intervals: [] });
    expect(doc.sections[0].blocks[1]).toMatchObject({ right: { weights: [] } });
  });
});

describe("figuras de aula: lo que ve la IA", () => {
  it("recibe los tipos y los campos nuevos en el esquema y en las instrucciones", () => {
    const serialized = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    for (const type of CLASSROOM_TYPES) {
      expect(serialized, type).toContain(`"${type}"`);
      expect(CREATOR_SYSTEM_PROMPT, type).toContain(type);
    }
    for (const field of ["intervals", "weights"]) {
      expect(serialized, field).toContain(`"${field}"`);
      expect(CREATOR_SYSTEM_PROMPT, field).toContain(field);
    }
  });

  it("rechaza un árbol cuyas ramas no suman 1 y deja pasar el corregido", () => {
    const write = (branches: unknown[]) => executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "tree_diagram", branches, showResults: true }] });
    const wrong = write([{ label: "Roja", probability: "3/5" }, { label: "Azul", probability: "1/5" }]);
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("suman 0.8");
    expect(write([{ label: "Roja", probability: "3/5" }, { label: "Azul", probability: "2/5" }]).isError).toBe(false);
  });
});

describe("lo que encontró la revisión de las figuras de aula", () => {
  it("avisa cuando el contenido de una zona de Venn no cabe y se recortaría", () => {
    const three = (regions: unknown[], extra: Record<string, unknown> = {}) => validateBlock(block({ type: "venn", sets: ["A", "B", "C"], regions, ...extra }));
    expect(three([{ region: "ac", text: "10, 20" }, { region: "abc", text: "30" }, { region: "outside", text: "1, 7, 11" }])).toEqual([]);
    const cut = three([{ region: "ac", text: "10, 20, 40, 50, 70" }]);
    expect(cut).toHaveLength(1);
    expect(cut[0]).toContain("no cabe");
    expect(three([{ region: "outside", text: "1, 7, 11, 13, 17, 19" }])).toHaveLength(1);
    expect(three([], { universe: "Estudiantes del grado 6A" })).toHaveLength(1);
    // Con dos conjuntos las zonas son más anchas
    expect(validateBlock(block({ type: "venn", sets: ["A", "B"], universe: "Estudiantes del grado 6A", regions: [{ region: "a", text: "2, 4, 8, 10, 14, 16" }] }))).toEqual([]);
  });

  it("avisa cuando el texto de una parte no cabe en su tramo de la barra", () => {
    const bars = (parts: unknown[]) => validateBlock(block({ type: "bar_model", bars: [{ parts }] }));
    expect(bars([{ value: 3, label: "1 parte" }, { value: 3, label: "1 parte" }, { value: 3, label: "1 parte" }])).toEqual([]);
    const tight = bars([{ value: 1, label: "1 parte" }, { value: 20 }]);
    expect(tight).toHaveLength(1);
    expect(tight[0]).toContain("no cabe");
    expect(bars([{ value: 1 }, { value: 20 }])).toEqual([]);
  });

  it("rechaza fórmulas en conjuntos, ramas y partes, que son texto plano", () => {
    const venn = validateBlock(block({ type: "venn", sets: ["$A$", "$B$"] }));
    expect(venn).toHaveLength(2);
    expect(venn[0]).toContain("texto plano");
    expect(validateBlock(block({ type: "tree_diagram", branches: [{ label: "$A$" }, { label: "No A" }] }))).toHaveLength(1);
    expect(validateBlock(block({ type: "bar_model", bars: [{ label: "Ahorro", parts: [{ value: 3, label: "$x$" }, { value: 2 }], total: "$20.000" }] }))).toHaveLength(1);
    expect(validateBlock(block({ type: "pictogram", unit: "\\text{kg}", rows: [{ label: "A", value: 2 }, { label: "B", value: 1 }] }))).toHaveLength(1);
    expect(validateBlock(block({ type: "clock", clocks: [{ hour: 7, label: "Salida ($7.000)" }] }))).toEqual([]);
  });
});

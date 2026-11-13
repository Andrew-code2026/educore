import { describe, expect, it } from "vitest";
import { blockInputSchema, emptyDoc, type BlockInput, type GraphSpec } from "@shared/creator";
import {
  areaLabel,
  areaShape,
  computeArea,
  derivativeAt,
  describeArea,
  describeSecant,
  describeTangent,
  integrate,
  lineEquationLatex,
  lineLabel,
  measureLatex,
  measureText,
  riemannRectangles,
  secantLine,
  tangentLine,
} from "@shared/creatorCalculus";
import { compileExpression } from "@shared/creatorMath";
import { describeComputed } from "@shared/creatorStats";
import { checkLatex, validateBlock } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -4, xMax: 4, yMin: -6, yMax: 10 };
const graph = (spec: Record<string, unknown>) => block({ type: "graph", spec: { ...PLANE, ...spec } });
const specOf = (spec: Record<string, unknown>): GraphSpec => {
  const parsed = graph(spec);
  if (parsed.type !== "graph") throw new Error("no es una gráfica");
  return parsed.spec;
};
const issuesOf = (spec: Record<string, unknown>) => validateBlock(graph(spec));
const areaOf = (functions: unknown[], area: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const spec = specOf({ functions, areas: [area], ...extra });
  return computeArea(spec, spec.areas![0])!;
};

describe("integral definida", () => {
  it("integra polinomios, trigonométricas y exponenciales con muchas cifras", () => {
    expect(integrate(compileExpression("x^2"), 0, 3)).toBeCloseTo(9, 10);
    expect(integrate(compileExpression("sin(x)"), 0, Math.PI)).toBeCloseTo(2, 10);
    expect(integrate(compileExpression("exp(x)"), 0, 1)).toBeCloseTo(Math.E - 1, 10);
    expect(integrate(compileExpression("1/x"), 1, Math.E)).toBeCloseTo(1, 10);
    expect(integrate(compileExpression("sqrt(x)"), 0, 4)).toBeCloseTo(16 / 3, 8);
  });

  it("pasa por un hueco y da NaN donde la función no existe", () => {
    // (x² − 1)/(x − 1) = x + 1 salvo en x = 1
    expect(integrate(compileExpression("(x^2 - 1)/(x - 1)"), 0, 2)).toBeCloseTo(4, 9);
    expect(Number.isNaN(integrate(compileExpression("sqrt(x)"), -2, 2))).toBe(true);
  });

  it("partida en los saltos, integra la parte entera exacta", () => {
    expect(integrate(compileExpression("floor(x)"), 0, 3, [1, 2])).toBeCloseTo(3, 10);
  });
});

describe("área de una región", () => {
  it("bajo una curva: el área coincide con la integral si la curva queda arriba", () => {
    expect(areaOf([{ expr: "x^2" }], { fn: 0, from: 0, to: 3 })).toEqual({ integral: 9, area: 9, sum: null });
    const third = areaOf([{ expr: "x^2" }], { fn: 0, from: 0, to: 2 });
    expect(third.area).toBeCloseTo(8 / 3, 10);
    expect(areaOf([{ expr: "2*x + 1" }], { fn: 0, from: 0, to: 2 }).area).toBe(6);
  });

  it("lo que queda bajo el eje resta en la integral y suma en el área", () => {
    const result = areaOf([{ expr: "x" }], { fn: 0, from: -2, to: 3 });
    expect(result.integral).toBe(2.5);
    expect(result.area).toBe(6.5);
    const sine = areaOf([{ expr: "sin(x)" }], { fn: 0, from: -3, to: 3 });
    expect(sine.integral).toBe(0);
    expect(sine.area).toBeCloseTo(2 * (1 - Math.cos(3)), 9);
    const below = areaOf([{ expr: "x^2 - 4" }], { fn: 0, from: -2, to: 2 });
    expect(below.integral).toBeCloseTo(-32 / 3, 10);
    expect(below.area).toBeCloseTo(32 / 3, 10);
  });

  it("entre dos curvas, sin importar cuál va arriba", () => {
    // Entre y = x e y = x² de 0 a 1: 1/6
    const lens = areaOf([{ expr: "x" }, { expr: "x^2" }], { fn: 0, between: 1, from: 0, to: 1 });
    expect(lens.area).toBeCloseTo(1 / 6, 10);
    expect(areaOf([{ expr: "x" }, { expr: "x^2" }], { fn: 1, between: 0, from: 0, to: 1 }).area).toBeCloseTo(1 / 6, 10);
    // Las curvas se cruzan en x = 1: el área suma los dos lados
    const crossed = areaOf([{ expr: "x" }, { expr: "x^2" }], { fn: 0, between: 1, from: 0, to: 2 });
    expect(crossed.area).toBe(1);
    expect(crossed.integral).toBeCloseTo(2 - 8 / 3, 9);
  });

  it("respeta los saltos y el dominio de una función a trozos", () => {
    expect(areaOf([{ expr: "floor(x)" }], { fn: 0, from: 0, to: 3 }).area).toBe(3);
    expect(areaOf([{ expr: "x + 1", from: 0, to: 2 }], { fn: 0, from: 0, to: 2 }).area).toBe(4);
  });

  it("sumas de Riemann por la izquierda, la derecha y el punto medio", () => {
    const sum = (sample: string | undefined, rectangles = 4) => areaOf([{ expr: "x^2" }], { fn: 0, from: 0, to: 2, rectangles, ...(sample ? { sample } : {}) }).sum;
    expect(sum(undefined)).toBe(1.75);
    expect(sum("left")).toBe(1.75);
    expect(sum("right")).toBe(3.75);
    expect(sum("midpoint")).toBe(2.625);
    expect(sum("midpoint", 40)).toBeCloseTo(8 / 3, 2);
    const spec = specOf({ functions: [{ expr: "x^2" }], areas: [{ fn: 0, from: 0, to: 2, rectangles: 4, sample: "right" }] });
    expect(riemannRectangles(spec, spec.areas![0])).toEqual([
      { x0: 0, x1: 0.5, y: 0.25 },
      { x0: 0.5, x1: 1, y: 1 },
      { x0: 1, x1: 1.5, y: 2.25 },
      { x0: 1.5, x1: 2, y: 4 },
    ]);
  });

  it("el contorno recorre la curva y vuelve por el eje o por la otra curva", () => {
    const spec = specOf({ functions: [{ expr: "x^2" }, { expr: "x" }], areas: [{ fn: 0, from: 0, to: 2 }, { fn: 0, between: 1, from: 0, to: 1 }] });
    const under = areaShape(spec, spec.areas![0])!;
    expect(under.outline[0]).toEqual([0, 0]);
    expect(under.outline.slice(-2)).toEqual([
      [2, 0],
      [0, 0],
    ]);
    expect(under.outline.some(([x, y]) => x === 2 && y === 4)).toBe(true);
    expect(under.anchor).toEqual([1, 0.5]);
    const between = areaShape(spec, spec.areas![1])!;
    expect(between.outline[between.outline.length - 1]).toEqual([0, 0]);
    expect(between.anchor).toEqual([0.5, 0.375]);
  });
});

describe("valores como salen en la figura", () => {
  it("un valor exacto lleva = y uno redondeado lleva ≈", () => {
    expect(measureText(4.5)).toBe("= 4,5");
    expect(measureText(8 / 3)).toBe("≈ 2,67");
    expect(measureText(9.000000000002)).toBe("= 9");
    expect(measureLatex(1 / 6)).toBe("\\approx 0{,}17");
    expect(measureLatex(2.625)).toBe("= 2{,}625");
  });

  it("el rótulo de la región es su área, o la suma de sus rectángulos", () => {
    const label = (area: Record<string, unknown>) => {
      const spec = specOf({ functions: [{ expr: "x^2" }], areas: [area] });
      return areaLabel(spec, spec.areas![0]);
    };
    expect(label({ fn: 0, from: 0, to: 3, showValue: true })).toBe("A = 9");
    expect(label({ fn: 0, from: 0, to: 2, showValue: true })).toBe("A \\approx 2{,}67");
    expect(label({ fn: 0, from: 0, to: 2, rectangles: 4, showValue: true })).toBe("S_{4} = 1{,}75");
    expect(label({ fn: 0, from: 0, to: 2 })).toBeNull();
    expect(checkLatex(label({ fn: 0, from: 0, to: 2, rectangles: 4, showValue: true })!)).toBeNull();
  });
});

describe("validación de las regiones", () => {
  const parabola = [{ expr: "x^2" }];

  it("acepta regiones bajo una curva, entre dos curvas y con rectángulos", () => {
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, from: 0, to: 3, showValue: true }] })).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "x" }, { expr: "x^2" }], areas: [{ fn: 0, between: 1, from: 0, to: 1 }] })).toEqual([]);
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, from: 0, to: 2, rectangles: 8, sample: "midpoint" }] })).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "sqrt(x)" }], areas: [{ fn: 0, from: 0, to: 4 }] })).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "floor(x)" }], areas: [{ fn: 0, from: 0, to: 3 }] })).toEqual([]);
    // Un hueco dentro del intervalo no impide medir
    expect(issuesOf({ functions: [{ expr: "(x^2 - 1)/(x - 1)" }], areas: [{ fn: 0, from: 0, to: 2 }] })).toEqual([]);
  });

  it("rechaza índices, intervalos y combinaciones que no tienen sentido", () => {
    expect(issuesOf({ functions: parabola, areas: [{ fn: 2, from: 0, to: 1 }] })[0]).toContain("la función 2, que no existe");
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, between: 3, from: 0, to: 1 }] })[0]).toContain("la función 3, que no existe");
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, between: 0, from: 0, to: 1 }] })[0]).toContain("ella misma");
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, from: 2, to: 1 }] })[0]).toContain("debe ser menor");
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, from: 0, to: 9 }] })[0]).toContain("se sale del plano");
    expect(issuesOf({ functions: [{ expr: "x" }, { expr: "x^2" }], areas: [{ fn: 0, between: 1, from: 0, to: 1, rectangles: 4 }] })[0]).toContain("una sola curva");
    expect(issuesOf({ functions: parabola, areas: [{ fn: 0, from: 0, to: 1, sample: "right" }] })[0]).toContain("no cuántos son");
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, functions: parabola, areas: [{ fn: 0, from: 0, to: 1, rectangles: 41 }] } }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, functions: parabola, areas: [{ fn: 0, from: 0, to: 1, rectangles: 2.5 }] } }).success).toBe(false);
  });

  it("rechaza una región que no se puede medir o que no cabe", () => {
    expect(issuesOf({ functions: [{ expr: "1/x" }], areas: [{ fn: 0, from: -1, to: 2 }] })[0]).toContain("no está acotada en x = 0");
    expect(issuesOf({ functions: [{ expr: "1/x" }], areas: [{ fn: 0, from: 0, to: 2 }] })[0]).toContain("no tiende a un número en x = 0");
    expect(issuesOf({ functions: [{ expr: "sqrt(x)" }], areas: [{ fn: 0, from: -2, to: 2 }] })[0]).toContain("en todo el intervalo");
    expect(issuesOf({ functions: [{ expr: "x", from: 0, to: 2 }], areas: [{ fn: 0, from: 0, to: 3 }] })[0]).toContain("no llega");
    const tall = issuesOf({ functions: parabola, areas: [{ fn: 0, from: 0, to: 4 }] });
    expect(tall).toHaveLength(1);
    expect(tall[0]).toContain("se sale del plano");
    expect(tall[0]).toContain("de y = 0 a 16");
    // Sin el eje x a la vista no hay hasta dónde sombrear
    expect(issuesOf({ yMin: 1, yMax: 9, functions: [{ expr: "x + 5" }], areas: [{ fn: 0, from: 0, to: 2 }] })[0]).toContain("el eje x");
  });
});

describe("lo que se le devuelve a la IA sobre las regiones", () => {
  const describeOne = (functions: unknown[], area: Record<string, unknown>) => {
    const spec = specOf({ functions, areas: [area] });
    return describeArea(spec, spec.areas![0]);
  };

  it("da el área como sale en la figura, y la integral solo si es distinta", () => {
    expect(describeOne([{ expr: "x^2" }], { fn: 0, from: 0, to: 3 })).toBe('Región bajo "x^2" entre x = 0 y x = 3: área = 9.');
    expect(describeOne([{ expr: "x^2" }], { fn: 0, from: 0, to: 2 })).toBe('Región bajo "x^2" entre x = 0 y x = 2: área ≈ 2,67.');
    expect(describeOne([{ expr: "x" }], { fn: 0, from: -2, to: 3 })).toBe('Región bajo "x" entre x = -2 y x = 3: área = 6,5; integral = 2,5 (lo que queda por debajo resta).');
    expect(describeOne([{ expr: "x" }, { expr: "x^2" }], { fn: 0, between: 1, from: 0, to: 1 })).toBe('Región entre "x" y "x^2", entre x = 0 y x = 1: área ≈ 0,17.');
    expect(describeOne([{ expr: "x^2" }], { fn: 0, from: 0, to: 2, rectangles: 4, sample: "right" })).toBe(
      'Región bajo "x^2" entre x = 0 y x = 2: área ≈ 2,67; suma de Riemann con 4 rectángulos (extremo derecho) = 3,75.',
    );
  });

  it("la herramienta lo devuelve al escribir la gráfica", () => {
    const shaded = graph({ functions: [{ expr: "x^2" }], areas: [{ fn: 0, from: 0, to: 3 }] });
    expect(describeComputed(shaded)).toBe('Gráfica: Región bajo "x^2" entre x = 0 y x = 3: área = 9.');
    const outcome = executeCreatorTool(emptyDoc("Integrales"), "write_section", { title: "Guía", role: "student", blocks: [shaded] }, Math.random);
    expect(outcome.isError).toBe(false);
    expect(outcome.result).toContain("área = 9");
  });

  it("el esquema de las herramientas y las instrucciones conocen las regiones", () => {
    const schema = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    for (const word of ["areas", "rectangles", "midpoint", "showValue"]) expect(schema, word).toContain(word);
    expect(CREATOR_SYSTEM_PROMPT).toContain("areas");
  });
});

describe("derivada en un punto", () => {
  const derivative = (expr: string, x: number) => derivativeAt(compileExpression(expr), x);

  it("coincide con la derivada exacta de las funciones de clase", () => {
    expect(derivative("x^2", 1).value).toBe(2);
    expect(derivative("x^2", -3).value).toBe(-6);
    expect(derivative("x^3 - 2*x", 2).value).toBe(10);
    expect(derivative("sin(x)", 0).value).toBe(1);
    expect(derivative("exp(x)", 0).value).toBe(1);
    expect(derivative("1/x", 2).value).toBe(-0.25);
    expect(derivative("sqrt(x)", 4).value).toBe(0.25);
    expect(derivative("x^3", 0).value).toBe(0);
    expect(derivative("3", 5).value).toBe(0);
    expect(derivative("cos(x)", 1).value).toBeCloseTo(-Math.sin(1), 10);
    expect(derivative("sin(50*x)", 0.3).value).toBeCloseTo(50 * Math.cos(15), 6);
  });

  it("no da derivada en una esquina, un salto o un borde, y dice la pendiente de cada lado", () => {
    expect(derivative("abs(x)", 0)).toEqual({ value: null, left: -1, right: 1 });
    expect(derivative("abs(x^2 - 4)", 2)).toEqual({ value: null, left: -4, right: 4 });
    expect(derivative("floor(x)", 2).value).toBeNull();
    expect(derivative("sqrt(x)", 0).value).toBeNull();
    expect(derivative("1/x", 0).value).toBeNull();
    // Lejos de la esquina, la misma función sí es derivable
    expect(derivative("abs(x)", 1).value).toBe(1);
    expect(derivative("floor(x)", 2.5).value).toBe(0);
  });
});

describe("tangente y secante", () => {
  const spec = specOf({
    functions: [{ expr: "x^2" }, { expr: "sin(x)" }],
    tangents: [{ fn: 0, x: 1, show: "equation" }, { fn: 1, x: 1 }],
    secants: [{ fn: 0, x1: 1, x2: 3 }, { fn: 0, x1: -1, x2: 1 }],
  });

  it("la tangente pasa por el punto con la pendiente de la derivada", () => {
    expect(tangentLine(spec, spec.tangents![0])).toEqual({ slope: 2, intercept: -1, points: [[1, 1]] });
    const sine = tangentLine(spec, spec.tangents![1])!;
    expect(sine.slope).toBeCloseTo(Math.cos(1), 10);
    expect(sine.points[0][1]).toBeCloseTo(Math.sin(1), 10);
    expect(sine.slope * 1 + sine.intercept).toBeCloseTo(Math.sin(1), 9);
  });

  it("la secante pasa por los dos puntos: su pendiente es la razón de cambio promedio", () => {
    expect(secantLine(spec, spec.secants![0])).toEqual({
      slope: 4,
      intercept: -3,
      points: [
        [1, 1],
        [3, 9],
      ],
    });
    expect(secantLine(spec, spec.secants![1])).toMatchObject({ slope: 0, intercept: 1 });
    expect(secantLine(spec, { fn: 0, x1: 2, x2: 2 })).toBeNull();
    expect(tangentLine(specOf({ functions: [{ expr: "abs(x)" }] }), { fn: 0, x: 0 })).toBeNull();
  });

  it("escribe la ecuación como en el cuaderno", () => {
    const equation = (slope: number, intercept: number) => lineEquationLatex({ slope, intercept, points: [] });
    expect(equation(2, -1)).toBe("y = 2x - 1");
    expect(equation(-1, 0)).toBe("y = -x");
    expect(equation(1, 3)).toBe("y = x + 3");
    expect(equation(0, 3)).toBe("y = 3");
    expect(equation(0.5, 2)).toBe("y = 0{,}5x + 2");
    expect(equation(-2.25, -0.5)).toBe("y = -2{,}25x - 0{,}5");
    expect(equation(Math.cos(1), Math.sin(1) - Math.cos(1))).toBe("y \\approx 0{,}54x + 0{,}3");
    // Una pendiente que al redondear queda en cero no se escribe como «0x»
    expect(equation(0.001234567, 2)).toBe("y \\approx 2");
    for (const [m, b] of [[2, -1], [Math.cos(1), 0.3], [-2.25, -0.5]]) expect(checkLatex(equation(m, b))).toBeNull();
  });

  it("el rótulo es la pendiente o la ecuación, calculadas", () => {
    const line = tangentLine(spec, spec.tangents![0])!;
    expect(lineLabel(line, "slope")).toBe("m = 2");
    expect(lineLabel(line, "equation")).toBe("y = 2x - 1");
    expect(lineLabel(line, "none")).toBeNull();
    expect(lineLabel(line, undefined)).toBeNull();
    expect(lineLabel(tangentLine(spec, spec.tangents![1])!, "slope")).toBe("m \\approx 0{,}54");
  });

  it("acepta tangentes y secantes sobre funciones a trozos, dentro de su dominio", () => {
    expect(issuesOf({ functions: [{ expr: "x^2" }], tangents: [{ fn: 0, x: 1, show: "slope" }], secants: [{ fn: 0, x1: 1, x2: 3, show: "equation" }] })).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "x^2", from: 0, to: 3 }], tangents: [{ fn: 0, x: 2 }] })).toEqual([]);
  });

  it("rechaza una tangente donde no la hay", () => {
    const corner = issuesOf({ functions: [{ expr: "abs(x)" }], tangents: [{ fn: 0, x: 0 }] });
    expect(corner).toHaveLength(1);
    expect(corner[0]).toContain("no es derivable en x = 0");
    expect(corner[0]).toContain("por la izquierda la pendiente es -1 y por la derecha 1");
    expect(issuesOf({ functions: [{ expr: "floor(x)" }], tangents: [{ fn: 0, x: 2 }] })[0]).toContain("no es derivable en x = 2");
    expect(issuesOf({ functions: [{ expr: "sqrt(x)" }], tangents: [{ fn: 0, x: 0 }] })[0]).toContain("no es derivable en x = 0");
    expect(issuesOf({ functions: [{ expr: "1/x" }], tangents: [{ fn: 0, x: 0 }] })[0]).toContain("no está definida en x = 0");
    expect(issuesOf({ functions: [{ expr: "x^2" }], tangents: [{ fn: 1, x: 0 }] })[0]).toContain("la función 1, que no existe");
    expect(issuesOf({ functions: [{ expr: "x^2" }], tangents: [{ fn: 0, x: 3.5 }] })[0]).toContain("queda fuera del plano");
    expect(issuesOf({ functions: [{ expr: "x^2", from: 0, to: 2 }], tangents: [{ fn: 0, x: 3 }] })[0]).toContain("no pertenece al dominio");
    // En el extremo de un trozo solo hay curva a un lado
    expect(issuesOf({ functions: [{ expr: "x^2", from: 0, to: 2 }], tangents: [{ fn: 0, x: 2 }] })[0]).toContain("no es derivable en x = 2");
  });

  it("rechaza una secante sin dos puntos distintos sobre la curva", () => {
    expect(issuesOf({ functions: [{ expr: "x^2" }], secants: [{ fn: 0, x1: 1, x2: 1 }] })[0]).toContain("dos puntos distintos");
    expect(issuesOf({ functions: [{ expr: "x^2" }], secants: [{ fn: 0, x1: 1, x2: 3.5 }] })[0]).toContain("queda fuera del plano");
    expect(issuesOf({ functions: [{ expr: "sqrt(x)" }], secants: [{ fn: 0, x1: -1, x2: 1 }] })[0]).toContain("no está definida en x = -1");
    expect(issuesOf({ functions: [{ expr: "x^2" }], secants: [{ fn: 4, x1: 0, x2: 1 }] })[0]).toContain("que no existe");
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, functions: [{ expr: "x" }], tangents: [{ fn: 0, x: 1, show: "angle" }] } }).success).toBe(false);
  });

  it("le devuelve a la IA el punto, la pendiente y la ecuación", () => {
    expect(describeTangent(spec, spec.tangents![0])).toBe('Tangente a "x^2" en x = 1: punto (1, 1), pendiente m = 2, ecuación $y = 2x - 1$.');
    expect(describeTangent(spec, spec.tangents![1])).toBe('Tangente a "sin(x)" en x = 1: punto ≈ (1; 0,84), pendiente m ≈ 0,54, ecuación $y \\approx 0{,}54x + 0{,}3$.');
    expect(describeSecant(spec, spec.secants![0])).toBe('Secante de "x^2" entre x = 1 y x = 3: puntos (1, 1) y (3, 9), pendiente m = 4 (razón de cambio promedio), ecuación $y = 4x - 3$.');

    const derivada = graph({ functions: [{ expr: "x^2" }], tangents: [{ fn: 0, x: 1 }], secants: [{ fn: 0, x1: 1, x2: 3 }] });
    expect(describeComputed(derivada)).toContain("pendiente m = 2");
    const outcome = executeCreatorTool(emptyDoc("Derivadas"), "write_section", { title: "Guía", role: "student", blocks: [derivada] }, Math.random);
    expect(outcome.isError).toBe(false);
    expect(outcome.result).toContain("ecuación $y = 2x - 1$");
    expect(outcome.result).toContain("razón de cambio promedio");
  });

  it("el esquema de las herramientas y las instrucciones conocen las tangentes y las secantes", () => {
    const schema = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    for (const word of ["tangents", "secants", "equation"]) expect(schema, word).toContain(word);
    expect(CREATOR_SYSTEM_PROMPT).toContain("tangents");
    expect(CREATOR_SYSTEM_PROMPT).toContain("secants");
  });
});

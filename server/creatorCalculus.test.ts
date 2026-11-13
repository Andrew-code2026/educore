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
import { conicCurves, conicElements, conicEquation, describeConic, shownConicElements } from "@shared/creatorConics";
import { compileExpression } from "@shared/creatorMath";
import { functionColors, sampleFunction } from "@shared/creatorPlane";
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

/**
 * Los ocho casos con que el usuario probó otro generador de guías para grado 11. Son los
 * casos de aceptación del plano: cada uno debe validar y dar los valores exactos, y los dos
 * errores que cometió aquel (cerrar el último escalón de la parte entera en el extremo del
 * dominio y sombrear por debajo del eje) no pueden ocurrir aquí.
 */
describe("casos de aceptación de 10° y 11°", () => {
  const SQUARE = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 };
  const conicOf = (input: Record<string, unknown>) => specOf({ ...SQUARE, conics: [input] }).conics![0];

  it("1. circunferencia (x − 2)² + (y + 1)² = 9 con centro y radio marcados", () => {
    const circle = { kind: "circle", h: 2, k: -1, r: 3, show: ["center", "radius", "equation"] };
    expect(issuesOf({ xMin: -3, xMax: 7, yMin: -6, yMax: 4, conics: [circle] })).toEqual([]);
    const shown = shownConicElements(conicOf(circle));
    expect(shown.points).toEqual([{ x: 2, y: -1, name: "C", role: "center" }]);
    expect(shown.segments[0].label).toBe("r = 3");
    expect(conicEquation(conicOf(circle))).toBe("(x - 2)^{2} + (y + 1)^{2} = 9");
    expect(describeConic(conicOf(circle))).toContain("centro (2, -1), radio 3");
  });

  it("2. elipse x²/16 + y²/9 = 1 con focos en (±√7, 0) y vértices en (±4, 0) y (0, ±3)", () => {
    const ellipse = { kind: "ellipse", h: 0, k: 0, rx: 4, ry: 3, show: ["foci", "vertices"] };
    expect(issuesOf({ xMin: -6, xMax: 6, yMin: -5, yMax: 5, conics: [ellipse] })).toEqual([]);
    const points = Object.fromEntries(conicElements(conicOf(ellipse)).points.map(point => [point.name, [point.x, point.y]]));
    expect(points["V_{1}"]).toEqual([-4, 0]);
    expect(points["V_{2}"]).toEqual([4, 0]);
    expect(points["B_{1}"]).toEqual([0, -3]);
    expect(points["B_{2}"]).toEqual([0, 3]);
    expect(points["F_{2}"][0]).toBeCloseTo(Math.sqrt(7), 10);
    expect(conicEquation(conicOf(ellipse))).toBe("\\frac{x^{2}}{16} + \\frac{y^{2}}{9} = 1");
    // Con coma decimal, no con punto
    expect(describeConic(conicOf(ellipse))).toContain("focos F_1 ≈ (-2,65; 0) y F_2 ≈ (2,65; 0) (c = √7 ≈ 2,65)");
  });

  it("3. hipérbola x²/4 − y²/9 = 1 con vértices en (±2, 0) y asíntotas y = ±1,5x", () => {
    const hyperbola = { kind: "hyperbola", h: 0, k: 0, a: 2, b: 3, show: ["vertices", "asymptotes"] };
    expect(issuesOf({ ...SQUARE, conics: [hyperbola] })).toEqual([]);
    const elements = conicElements(conicOf(hyperbola));
    expect(elements.points.filter(point => point.role === "vertex").map(point => [point.x, point.y])).toEqual([
      [-2, 0],
      [2, 0],
    ]);
    expect(elements.lines).toEqual([
      { role: "asymptote", slope: 1.5, intercept: 0 },
      { role: "asymptote", slope: -1.5, intercept: 0 },
    ]);
    expect(conicEquation(conicOf(hyperbola))).toBe("\\frac{x^{2}}{4} - \\frac{y^{2}}{9} = 1");
  });

  it("4. parábola horizontal x = y² − 4 con vértice en (−4, 0), que pasa por (0, ±2) y (5, ±3)", () => {
    const parabola = { kind: "parabola", h: -4, k: 0, p: 0.25, axis: "horizontal", show: ["vertices"] };
    expect(issuesOf({ xMin: -6, xMax: 7, yMin: -5, yMax: 5, conics: [parabola], points: [{ x: 0, y: 2 }, { x: 0, y: -2 }, { x: 5, y: 3 }, { x: 5, y: -3 }] })).toEqual([]);
    expect(conicEquation(conicOf(parabola))).toBe("y^{2} = x + 4");
    expect(shownConicElements(conicOf(parabola)).points).toEqual([{ x: -4, y: 0, name: "V", role: "vertex" }]);
    const [curve] = conicCurves(conicOf(parabola), { xMin: -6, xMax: 7, yMin: -5, yMax: 5 });
    for (const [x, y] of curve) expect(x).toBeCloseTo(y * y - 4, 9);
    // La curva cruza las alturas ±2 y ±3 justo en x = 0 y x = 5
    for (const [px, py] of [[0, 2], [0, -2], [5, 3], [5, -3]]) expect(px).toBe(py * py - 4);
  });

  it("5. función a trozos: donde los trozos se encuentran va un solo punto relleno; con salto, uno vacío y uno relleno", () => {
    const meet = { functions: [{ expr: "x + 2", to: 1, toEnd: "open" }, { expr: "4 - x", from: 1 }] };
    expect(issuesOf(meet)).toEqual([]);
    const marksOf = (functions: Array<{ expr: string; from?: number; to?: number; toEnd?: "open" }>) => functions.map(fn => sampleFunction(compileExpression(fn.expr), PLANE, fn).marks);
    // Los dos extremos caen en (1, 3): el dibujo pone el relleno encima, porque f(1) = 3
    expect(marksOf(meet.functions as never)).toEqual([[{ x: 1, y: 3, filled: false }], [{ x: 1, y: 3, filled: true }]]);
    expect(functionColors(specOf(meet).functions)).toEqual([0, 0]);

    const jump = { functions: [{ expr: "x + 2", to: 1, toEnd: "open" }, { expr: "5 - x", from: 1 }] };
    expect(issuesOf(jump)).toEqual([]);
    expect(marksOf(jump.functions as never)).toEqual([[{ x: 1, y: 3, filled: false }], [{ x: 1, y: 4, filled: true }]]);
    // El punto del enunciado: f(1) = 4, no 3
    expect(issuesOf({ ...jump, points: [{ x: 1, y: 4, on: 1 }] })).toEqual([]);
    expect(issuesOf({ ...jump, points: [{ x: 1, y: 3, on: 0 }] })[0]).toContain("no pertenece al dominio");
  });

  it("6. parte entera en [−3, 3]: en x = 3 el escalón queda abierto en (3, 2) y el valor va en (3, 3)", () => {
    const spec = { xMin: -4, xMax: 4, yMin: -4, yMax: 4, functions: [{ expr: "floor(x)", from: -3, to: 3 }] };
    expect(issuesOf(spec)).toEqual([]);
    const curve = sampleFunction(compileExpression("floor(x)"), spec, { from: -3, to: 3 });
    const at = (x: number, y: number) => curve.marks.filter(mark => mark.x === x && mark.y === y);
    // ⌊3⌋ = 3: cerrar el último escalón en (3, 2) sería un error
    expect(at(3, 2)).toEqual([{ x: 3, y: 2, filled: false }]);
    expect(at(3, 3)).toEqual([{ x: 3, y: 3, filled: true }]);
    expect(at(-3, -3)).toEqual([{ x: -3, y: -3, filled: true }]);
    // Seis escalones, cada uno cerrado a la izquierda y abierto a la derecha
    expect(curve.segments).toHaveLength(6);
    for (let n = -3; n < 3; n++) {
      expect(at(n, n), `inicio del escalón ${n}`).toEqual([{ x: n, y: n, filled: true }]);
      expect(at(n + 1, n), `final del escalón ${n}`).toEqual([{ x: n + 1, y: n, filled: false }]);
    }
    // Sin dominio declarado, en el borde del plano no se marca nada: la función sigue
    const open = sampleFunction(compileExpression("floor(x)"), { xMin: -3, xMax: 3, yMin: -4, yMax: 4 });
    expect(open.marks.some(mark => mark.x === 3)).toBe(false);
  });

  it("7. f(x) = (x² − 4)/(x − 2): la recta y = x + 2 con un hueco en (2, 4)", () => {
    const hole = { functions: [{ expr: "(x^2 - 4)/(x - 2)" }] };
    expect(issuesOf({ ...hole, points: [{ x: 2, y: 4, on: 0, open: true }] })).toEqual([]);
    // Un punto relleno ahí sería falso: la función no está definida en x = 2
    expect(issuesOf({ ...hole, points: [{ x: 2, y: 4, on: 0 }] })).toHaveLength(1);
    const curve = sampleFunction(compileExpression("(x^2 - 4)/(x - 2)"), PLANE);
    for (const segment of curve.segments) for (const [x, y] of segment.points) expect(y).toBeCloseTo(x + 2, 6);
  });

  it("8. tangente a y = x² en x = 1 (y = 2x − 1) y área bajo la curva entre 0 y 2 (8/3), sombreada hasta el eje", () => {
    const spec = specOf({ xMin: -2, xMax: 3, yMin: -1, yMax: 5, functions: [{ expr: "x^2" }], tangents: [{ fn: 0, x: 1, show: "equation" }], areas: [{ fn: 0, from: 0, to: 2, showValue: true }] });
    expect(validateBlock({ type: "graph", spec })).toEqual([]);
    const tangent = tangentLine(spec, spec.tangents![0])!;
    expect(tangent.points).toEqual([[1, 1]]);
    expect(lineEquationLatex(tangent)).toBe("y = 2x - 1");
    expect(computeArea(spec, spec.areas![0])!.area).toBeCloseTo(8 / 3, 10);
    expect(areaLabel(spec, spec.areas![0])).toBe("A \\approx 2{,}67");
    // El plano baja hasta y = −1, pero la región termina en el eje x
    const outline = areaShape(spec, spec.areas![0])!.outline;
    expect(Math.min(...outline.map(([, y]) => y))).toBe(0);
    expect(outline.slice(-2)).toEqual([
      [2, 0],
      [0, 0],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { blockInputSchema, parseDoc, resourceDocSchema, type BlockInput, type GraphSpec } from "@shared/creator";
import { compileExpression, sampleCurve } from "@shared/creatorMath";
import { exactDecimals, formatDecimalEs, formatTableNumber, functionColors, inDomain, oneSidedLimit, sampleFunction, tidy, valueTableDecimals } from "@shared/creatorPlane";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const graph = (spec: Record<string, unknown>) => block({ type: "graph", spec: { ...PLANE, ...spec } });
const issuesOf = (spec: Record<string, unknown>) => validateBlock(graph(spec));

/** Extremos de cada tramo dibujado, redondeados: así se lee dónde se cortó la curva. */
const pieces = (expr: string, range = PLANE, domain = {}) =>
  sampleFunction(compileExpression(expr), range, domain).segments.map(segment => {
    const first = segment.points[0];
    const last = segment.points[segment.points.length - 1];
    return [first, last].map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);
  });

describe("parte entera en el evaluador", () => {
  it("floor y ceil redondean hacia abajo y hacia arriba", () => {
    const floor = compileExpression("floor(x)");
    expect([-1.5, -1, 0, 0.99, 2.5].map(floor)).toEqual([-2, -1, 0, 0, 2]);
    const ceil = compileExpression("ceil(x)");
    expect([-1.5, 0, 0.01, 2].map(ceil)).toEqual([-1, 0, 1, 2]);
    // La parte decimal: x - floor(x)
    expect(compileExpression("x - floor(x)")(2.25)).toBe(0.25);
    expect(compileExpression("2floor(x/2)")(5)).toBe(4);
  });
});

describe("límites laterales", () => {
  it("encuentra el límite de un hueco, de una raíz y de sen(x)/x", () => {
    const hole = compileExpression("(x^2 - 1)/(x - 1)");
    expect(oneSidedLimit(hole, 1, -1)).toBe(2);
    expect(oneSidedLimit(hole, 1, 1)).toBe(2);
    expect(oneSidedLimit(compileExpression("sqrt(x)"), 0, 1)).toBe(0);
    expect(oneSidedLimit(compileExpression("sin(x)/x"), 0, 1)).toBe(1);
    expect(oneSidedLimit(compileExpression("x^2 + 1"), 2, -1)).toBe(5);
  });

  it("distingue los dos lados de un salto", () => {
    const floor = compileExpression("floor(x)");
    expect(oneSidedLimit(floor, 2, -1)).toBe(1);
    expect(oneSidedLimit(floor, 2, 1)).toBe(2);
    const sign = compileExpression("abs(x)/x");
    expect(oneSidedLimit(sign, 0, -1)).toBe(-1);
    expect(oneSidedLimit(sign, 0, 1)).toBe(1);
  });

  it("no inventa un límite donde la función se va al infinito o no existe", () => {
    expect(oneSidedLimit(compileExpression("1/x"), 0, 1)).toBeNull();
    expect(oneSidedLimit(compileExpression("ln(x)"), 0, 1)).toBeNull();
    expect(oneSidedLimit(compileExpression("sqrt(x)"), 0, -1)).toBeNull();
    expect(oneSidedLimit(compileExpression("1/(x - 2)^2"), 2, -1)).toBeNull();
  });
});

describe("muestreo de una función", () => {
  it("una función continua sale en un solo tramo, de borde a borde y sin círculos", () => {
    for (const expr of ["2*x - 3", "x^2 - 4", "sin(x)", "abs(x)", "x^3", "exp(x)"]) {
      const curve = sampleFunction(compileExpression(expr), PLANE);
      expect(curve.segments, expr).toHaveLength(1);
      expect(curve.marks, expr).toEqual([]);
      expect(curve.jumps, expr).toBe(0);
      expect(curve.exhausted, expr).toBe(false);
    }
    expect(pieces("2*x - 3", { xMin: -2, xMax: 4, yMin: -8, yMax: 6 })).toEqual([
      [
        [-2, -7],
        [4, 5],
      ],
    ]);
  });

  it("corta la parte entera en cada salto: un escalón por entero, cada uno hasta su límite", () => {
    const steps = pieces("floor(x)", { xMin: -2, xMax: 3, yMin: -3, yMax: 4 });
    expect(steps).toEqual([
      [
        [-2, -2],
        [-1, -2],
      ],
      [
        [-1, -1],
        [0, -1],
      ],
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 1],
        [2, 1],
      ],
      [
        [2, 2],
        [3, 2],
      ],
    ]);
  });

  it("en cada salto de la parte entera pone el círculo relleno a la derecha y el vacío a la izquierda", () => {
    const curve = sampleFunction(compileExpression("floor(x)"), { xMin: -0.5, xMax: 2.5, yMin: -2, yMax: 3 });
    expect(curve.jumps).toBe(3);
    expect(curve.breaks).toEqual([0, 1, 2]);
    expect(curve.marks).toEqual([
      { x: 0, y: -1, filled: false },
      { x: 0, y: 0, filled: true },
      { x: 1, y: 0, filled: false },
      { x: 1, y: 1, filled: true },
      { x: 2, y: 1, filled: false },
      { x: 2, y: 2, filled: true },
    ]);
    // El techo es al revés: el valor queda en el escalón de la izquierda
    const ceil = sampleFunction(compileExpression("ceil(x)"), { xMin: 0.5, xMax: 1.5, yMin: -1, yMax: 3 });
    expect(ceil.marks).toEqual([
      { x: 1, y: 1, filled: true },
      { x: 1, y: 2, filled: false },
    ]);
  });

  it("encuentra saltos que no caen en una muestra y saltos pequeños", () => {
    const half = sampleFunction(compileExpression("floor(2*x)/2"), { xMin: 0.1, xMax: 1.9, yMin: -1, yMax: 3 });
    expect(half.breaks).toEqual([0.5, 1, 1.5]);
    const third = sampleFunction(compileExpression("floor(3*x)"), { xMin: 0.05, xMax: 0.95, yMin: -1, yMax: 4 });
    expect(third.breaks.map(x => Number(x.toFixed(9)))).toEqual([0.333333333, 0.666666667]);
    expect(third.jumps).toBe(2);
    // Sin un número exacto donde evaluar, no se decide qué lado lleva el valor: solo se corta
    expect(third.marks).toEqual([]);
  });

  it("corta en las asíntotas sin unir los dos lados y sin círculos", () => {
    const inverse = sampleFunction(compileExpression("1/x"), { xMin: -4, xMax: 4, yMin: -5, yMax: 5 });
    expect(inverse.segments).toHaveLength(2);
    expect(inverse.marks).toEqual([]);
    expect(inverse.jumps).toBe(0);
    expect(inverse.breaks).toEqual([0]);
    // Cada rama sale del plano por arriba o por abajo: no queda un hueco antes del borde
    const [leftBranch, rightBranch] = inverse.segments;
    expect(leftBranch.points[leftBranch.points.length - 1][1]).toBeLessThan(-5);
    expect(rightBranch.points[0][1]).toBeGreaterThan(5);
    for (const segment of inverse.segments) for (const [x] of segment.points) expect(Math.abs(x)).toBeGreaterThan(0);

    const tangent = sampleFunction(compileExpression("tan(x)"), { xMin: -4, xMax: 4, yMin: -4, yMax: 4 });
    expect(tangent.segments).toHaveLength(3);
    expect(tangent.marks).toEqual([]);
  });

  it("empieza la curva justo en el borde del dominio natural", () => {
    // sqrt(x - 0.5) empieza en 0.5, que no coincide con ninguna muestra
    expect(pieces("sqrt(x - 0.5)", { xMin: -4, xMax: 4, yMin: -1, yMax: 3 })[0][0]).toEqual([0.5, 0]);
    const log = sampleFunction(compileExpression("ln(x)"), { xMin: -1, xMax: 5, yMin: -20, yMax: 3 });
    expect(log.segments).toHaveLength(1);
    // Baja hasta salir del plano junto a la asíntota
    expect(log.segments[0].points[0][1]).toBeLessThan(-20);
    expect(log.marks).toEqual([]);
  });

  it("un hueco no parte la curva a la vista ni se marca solo", () => {
    const curve = sampleFunction(compileExpression("(x^2 - 1)/(x - 1)"), PLANE);
    expect(curve.marks).toEqual([]);
    expect(curve.jumps).toBe(0);
    // Los tramos se tocan en (1, 2): el hueco lo dibuja el punto vacío que ponga quien hace la gráfica
    const ends = curve.segments.flatMap(segment => [segment.points[0], segment.points[segment.points.length - 1]]);
    expect(ends.filter(([x]) => Math.abs(x - 1) < 1e-9).every(([, y]) => Math.abs(y - 2) < 1e-6)).toBe(true);
  });

  it("no pierde el rastro de una función que oscila sin control: avisa", () => {
    expect(sampleFunction(compileExpression("5*sin(3000*x)"), PLANE).exhausted).toBe(true);
    expect(issuesOf({ functions: [{ expr: "5*sin(3000*x)" }] }).join(" ")).toContain("demasiado rápido");
  });

  it("dibuja igual que antes las funciones de los recursos ya guardados", () => {
    // Mismos extremos que el muestreo anterior en curvas continuas
    for (const expr of ["2*x - 3", "x^2 - 4*x + 3", "sqrt(x)", "-0.5*x + 2"]) {
      const before = sampleCurve(compileExpression(expr), PLANE);
      const after = sampleFunction(compileExpression(expr), PLANE).segments;
      expect(after, expr).toHaveLength(before.length);
      before.forEach((segment, index) => {
        const last = segment.points.length - 1;
        const now = after[index].points;
        // El muestreo nuevo llega hasta el margen del plano; el anterior se detenía una muestra antes
        const from = now.findIndex(([x]) => Math.abs(x - segment.points[0][0]) < 1e-9);
        const to = now.findIndex(([x]) => Math.abs(x - segment.points[last][0]) < 1e-9);
        expect(from, expr).toBeGreaterThanOrEqual(0);
        expect(to, expr).toBeGreaterThan(from);
        expect(now[from][1]).toBeCloseTo(segment.points[0][1], 9);
        expect(now[to][1]).toBeCloseTo(segment.points[last][1], 9);
      });
    }
  });
});

describe("dominio de una función", () => {
  it("un extremo abierto no pertenece al dominio", () => {
    expect(inDomain({ from: 1, to: 3 }, 1)).toBe(true);
    expect(inDomain({ from: 1, to: 3, fromEnd: "open" }, 1)).toBe(false);
    expect(inDomain({ from: 1, to: 3, toEnd: "none" }, 3)).toBe(true);
    expect(inDomain({ from: 1 }, 0.5)).toBe(false);
    expect(inDomain({}, 1e9)).toBe(true);
  });

  it("dibuja solo el trozo pedido y marca sus extremos", () => {
    const curve = sampleFunction(compileExpression("x + 1"), PLANE, { from: -2, to: 1, toEnd: "open" });
    expect(pieces("x + 1", PLANE, { from: -2, to: 1, toEnd: "open" })).toEqual([
      [
        [-2, -1],
        [1, 2],
      ],
    ]);
    expect(curve.marks).toEqual([
      { x: -2, y: -1, filled: true },
      { x: 1, y: 2, filled: false },
    ]);
    expect(sampleFunction(compileExpression("x^2"), PLANE, { from: 1, fromEnd: "none" }).marks).toEqual([]);
  });

  it("el extremo abierto de un trozo con un hueco cae en el límite", () => {
    const curve = sampleFunction(compileExpression("(x^2 - 1)/(x - 1)"), PLANE, { to: 1, toEnd: "open" });
    expect(curve.marks).toEqual([{ x: 1, y: 2, filled: false }]);
    expect(curve.segments).toHaveLength(1);
  });

  it("un trozo de la parte entera que termina en un salto deja el valor aparte", () => {
    // floor(x) en [0, 2]: el escalón [1, 2) queda abierto en 2 y el punto (2, 2) va relleno
    const curve = sampleFunction(compileExpression("floor(x)"), { xMin: -1, xMax: 4, yMin: -1, yMax: 4 }, { from: 0, to: 2 });
    expect(curve.marks).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0, filled: true },
        { x: 1, y: 0, filled: false },
        { x: 1, y: 1, filled: true },
        { x: 2, y: 1, filled: false },
        { x: 2, y: 2, filled: true },
      ]),
    );
    expect(curve.marks).toHaveLength(5);
  });

  it("los trozos cuyos dominios se tocan comparten color sin que nadie lo indique", () => {
    // Sin dominios, cada función toma el color de su posición, como siempre
    expect(functionColors([{ expr: "x" }, { expr: "x^2" }, { expr: "1" }, { expr: "2" }, { expr: "3" }])).toEqual([0, 1, 2, 3, 0]);
    // f(x) = x² si x < 1, x + 2 si x ≥ 1, y otra función aparte
    expect(functionColors([{ expr: "x^2", to: 1, toEnd: "open" }, { expr: "x + 2", from: 1 }, { expr: "-x" }])).toEqual([0, 0, 2]);
    // Tres trozos en cualquier orden
    expect(functionColors([{ expr: "3", from: 2 }, { expr: "x^2", from: 0, to: 2 }, { expr: "x + 2", to: 0 }])).toEqual([0, 0, 0]);
    // Dos funciones recortadas que no se tocan siguen siendo dos funciones
    expect(functionColors([{ expr: "x", from: 0, to: 1 }, { expr: "x^2", from: 2, to: 3 }])).toEqual([0, 1]);
    // El color fijado manda, y un trozo sin color sigue al que continúa
    expect(functionColors([{ expr: "x", to: 0, color: 2 }, { expr: "x^2", from: 0 }, { expr: "1", color: 3 }])).toEqual([2, 2, 3]);
    expect(functionColors([{ expr: "x", to: 0, color: 2 }, { expr: "x^2", from: 0, color: 1 }])).toEqual([2, 1]);
  });

  it("acepta una función a trozos y rechaza un dominio mal escrito", () => {
    const piecewise = {
      functions: [
        { expr: "x + 2", to: 0, toEnd: "open", color: 0, label: "f" },
        { expr: "x^2", from: 0, to: 2, color: 0 },
        { expr: "3", from: 2, fromEnd: "open", color: 0 },
      ],
    };
    expect(issuesOf(piecewise)).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "x", from: 3, to: 1 }] })[0]).toContain("debe ser menor");
    expect(issuesOf({ functions: [{ expr: "x", from: 8 }] })[0]).toContain("fuera del plano");
    expect(issuesOf({ functions: [{ expr: "x", toEnd: "open" }] })[0]).toContain("toEnd");
    expect(issuesOf({ functions: [{ expr: "1/x", from: 0 }] })[0]).toContain("no puede ser cerrado");
    expect(issuesOf({ functions: [{ expr: "1/x", from: 0, fromEnd: "open" }] })).toEqual([]);
    // El extremo tiene que verse: (4, 16) no cabe en un plano que llega a y = 5
    expect(issuesOf({ functions: [{ expr: "x^2", from: 0, to: 4 }] })[0]).toContain("queda fuera del plano");
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, functions: [{ expr: "x", color: 7 }] } }).success).toBe(false);
  });

  it("no deja ver una función cuyo trozo no cabe en el plano", () => {
    expect(issuesOf({ functions: [{ expr: "x + 20", from: 0, to: 2, fromEnd: "none", toEnd: "none" }] })[0]).toContain("no se ve");
    expect(issuesOf({ functions: [{ expr: "floor(10*x)/2" }] }).join(" ")).toContain("saltos");
    // Un salto en el borde del plano no se marca: la función sigue más allá
    const edge = sampleFunction(compileExpression("floor(x)"), { xMin: 0.5, xMax: 3, yMin: -1, yMax: 4 });
    expect(edge.breaks).toEqual([1, 2]);
    expect(edge.marks.every(mark => mark.x < 3)).toBe(true);
  });
});

describe("rectas verticales y trazo punteado", () => {
  it("acepta asíntotas verticales y funciones punteadas", () => {
    const spec = {
      functions: [{ expr: "1/(x - 2) + 1" }, { expr: "1", style: "dashed", label: "y = 1" }],
      verticalLines: [{ x: 2, style: "dashed", label: "x = 2" }, { x: -3 }],
    };
    expect(issuesOf(spec)).toEqual([]);
    const parsed = graph(spec);
    expect(parsed.type === "graph" && parsed.spec.verticalLines).toEqual([{ x: 2, style: "dashed", label: "x = 2" }, { x: -3 }]);
  });

  it("rechaza una recta fuera del plano, una etiqueta rota o un trazo desconocido", () => {
    expect(issuesOf({ verticalLines: [{ x: 9 }] })[0]).toContain("queda fuera del plano");
    expect(issuesOf({ verticalLines: [{ x: 1, label: "\\frac{1}{" }] })[0]).toContain("no es LaTeX válido");
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, verticalLines: [{ x: 1, style: "dotted" }] } }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...PLANE, verticalLines: Array.from({ length: 7 }, (_, x) => ({ x })) } }).success).toBe(false);
  });

  it("un plano sin rectas verticales no gana el campo al leerse", () => {
    const parsed = graph({ functions: [{ expr: "x" }] });
    expect(parsed.type === "graph" && "verticalLines" in parsed.spec).toBe(false);
  });
});

describe("puntos sobre una función", () => {
  const hole = { expr: "(x^2 - 1)/(x - 1)" };

  it("un punto vacío va en el límite de la función", () => {
    expect(issuesOf({ functions: [hole], points: [{ x: 1, y: 2, on: 0, open: true }] })).toEqual([]);
    const wrong = issuesOf({ functions: [hole], points: [{ x: 1, y: 3, on: 0, open: true }] });
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toContain("tiende a 2");
    // En un salto vale cualquiera de los dos lados
    expect(issuesOf({ functions: [{ expr: "floor(x)" }], points: [{ x: 2, y: 1, on: 0, open: true }] })).toEqual([]);
    const jump = issuesOf({ functions: [{ expr: "floor(x)" }], points: [{ x: 2, y: 1.5, on: 0, open: true }] });
    expect(jump[0]).toContain("por la izquierda tiende a 1 y por la derecha a 2");
    expect(issuesOf({ functions: [{ expr: "1/x" }], points: [{ x: 0, y: 1, on: 0, open: true }] })[0]).toContain("no tiende a un número");
  });

  it("un punto relleno sigue yendo en el valor de la función, y dentro de su dominio", () => {
    expect(issuesOf({ functions: [{ expr: "floor(x)" }], points: [{ x: 2, y: 2, on: 0 }] })).toEqual([]);
    expect(issuesOf({ functions: [{ expr: "floor(x)" }], points: [{ x: 2, y: 1, on: 0 }] })[0]).toContain("la función vale 2");
    const outside = issuesOf({ functions: [{ expr: "x + 1", to: 1, toEnd: "open" }], points: [{ x: 1, y: 2, on: 0 }] });
    expect(outside[0]).toContain("no pertenece al dominio");
    expect(issuesOf({ functions: [{ expr: "x + 1", to: 1, toEnd: "open" }], points: [{ x: 1, y: 2, on: 0, open: true }] })).toEqual([]);
    // Un punto libre puede ser vacío o relleno
    expect(issuesOf({ points: [{ x: 1, y: 3, on: null, open: true }] })).toEqual([]);
  });
});

describe("números con los decimales que hagan falta", () => {
  it("cuenta los decimales de un número exacto", () => {
    expect(exactDecimals(3)).toBe(0);
    expect(exactDecimals(1.999)).toBe(3);
    expect(exactDecimals(0.1 + 0.2)).toBe(1);
    expect(exactDecimals(1.999 * 1.999)).toBe(6);
    expect(exactDecimals(1 / 3)).toBeNull();
    expect(exactDecimals(Math.PI)).toBeNull();
    expect(tidy(1.9999999996)).toBe(2);
    expect(tidy(1e-17)).toBe(0);
    expect(tidy(Math.PI)).toBe(Math.PI);
  });

  it("escribe con coma y sin notación científica", () => {
    expect(formatDecimalEs(1.999, 3)).toBe("1,999");
    expect(formatDecimalEs(20000, 2)).toBe("20.000");
    expect(formatDecimalEs(1234567.5, 2)).toBe("1.234.567,5");
    expect(formatDecimalEs(0.0000001, 8)).toBe("0,0000001");
    expect(formatDecimalEs(-0.0001, 2)).toBe("0");
    expect(formatDecimalEs(-2.5, 2)).toBe("-2,5");
    expect(formatDecimalEs(2.0, 4)).toBe("2");
    expect(formatDecimalEs(Number.NaN, 2)).toBe("—");
  });

  it("la tabla de valores no redondea lo que se puede escribir entero", () => {
    expect(formatTableNumber(1.999)).toBe("1,999");
    expect(formatTableNumber(2.999)).toBe("2,999");
    expect(formatTableNumber(0.125)).toBe("0,125");
    expect(formatTableNumber(28000)).toBe("28.000");
    expect(formatTableNumber(1 / 3)).toBe("0,33");
  });

  it("da más decimales a los resultados cuando los x se acercan a un número", () => {
    expect(valueTableDecimals([-2, -1, 0, 1, 2])).toBe(2);
    expect(valueTableDecimals([0.1, 0.5])).toBe(3);
    expect(valueTableDecimals([1.9, 1.99, 1.999])).toBe(7);
    expect(valueTableDecimals([0.0001, 0.00001])).toBe(8);
    const sinc = (x: number) => Math.sin(x) / x;
    const decimals = valueTableDecimals([0.1, 0.01, 0.001]);
    expect([0.1, 0.01, 0.001].map(x => formatTableNumber(sinc(x), decimals))).toEqual(["0,9983342", "0,9999833", "0,9999998"]);
  });
});

describe("recursos guardados antes de ampliar el plano", () => {
  // Tal como quedó guardado un recurso con la primera versión del plano y de la tabla de valores
  const saved = {
    title: "Función lineal",
    subtitle: "Guía de práctica · Grado 9",
    sections: [
      {
        id: "sabc123",
        title: "Guía",
        role: "student",
        blocks: [
          {
            id: "bgraf01",
            type: "graph",
            caption: "Recta y parábola",
            spec: {
              xMin: -2,
              xMax: 5,
              yMin: -4,
              yMax: 8,
              xStep: 1,
              yStep: 1,
              functions: [
                { expr: "2*x - 3", label: "y = 2x - 3" },
                { expr: "x^2 - 4*x + 3", label: "y = x^{2} - 4x + 3" },
              ],
              points: [
                { x: 0, y: -3, label: "(0, -3)", on: 0 },
                { x: 1.5, y: 0, on: 0 },
                { x: 2, y: -1, on: 1 },
                { x: 4, y: 6, on: null },
              ],
            },
          },
          { id: "bblank1", type: "graph", spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [], points: [] } },
          { id: "btabla1", type: "value_table", expr: "2*x - 3", exprLatex: "y = 2x - 3", xs: [-1, 0, 1, 2], blankY: false },
        ],
      },
    ],
  };

  it("se leen exactamente como se guardaron: los campos nuevos no añaden nada", () => {
    expect(resourceDocSchema.safeParse(saved).success).toBe(true);
    expect(parseDoc(JSON.stringify(saved))).toEqual(saved);
  });

  it("siguen pasando la validación y se dibujan con los mismos tramos y sin círculos", () => {
    const doc = parseDoc(saved);
    for (const item of doc.sections[0].blocks) {
      const { id: _id, ...content } = item;
      expect(validateBlock(content as BlockInput), item.id).toEqual([]);
    }
    const spec = (doc.sections[0].blocks[0] as { spec: GraphSpec }).spec;
    for (const fn of spec.functions) {
      const curve = sampleFunction(compileExpression(fn.expr), spec, fn);
      expect(curve.segments).toHaveLength(1);
      expect(curve.marks).toEqual([]);
    }
  });
});

import { describe, expect, it } from "vitest";
import { blockInputSchema, graphSpecSchema, type BlockInput, type GraphSpec } from "@shared/creator";
import { describeGraph } from "@shared/creatorGraphFacts";
import { describeNotable, findNotable, shownNotablePoints } from "@shared/creatorNotable";
import { planePointLatex, planePointText } from "@shared/creatorPlaneAxes";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
const spec = (extra: Record<string, unknown> = {}): GraphSpec => graphSpecSchema.parse({ ...PLANE, ...extra });
const issuesOf = (extra: Record<string, unknown>) => validateBlock(block({ type: "graph", spec: { ...PLANE, ...extra } }));
const fns = (...exprs: string[]) => exprs.map(expr => ({ expr }));

/** Los puntos de una petición, como pares. */
const found = (extra: Record<string, unknown>, item: Record<string, unknown>) => {
  const plane = spec({ ...extra, notable: [item] });
  return findNotable(plane, plane.notable![0])!.points.map(point => [point.x, point.y]);
};

describe("raíces", () => {
  it("halla las raíces exactas de una cuadrática y de una recta", () => {
    expect(found({ functions: fns("x^2 - 4") }, { fn: 0, kind: "roots" })).toEqual([
      [-2, 0],
      [2, 0],
    ]);
    expect(found({ functions: fns("2*x - 3") }, { fn: 0, kind: "roots" })).toEqual([[1.5, 0]]);
    expect(found({ functions: fns("x^3 - x") }, { fn: 0, kind: "roots" })).toEqual([
      [-1, 0],
      [0, 0],
      [1, 0],
    ]);
  });

  it("halla una raíz doble, que toca el eje sin cruzarlo", () => {
    expect(found({ functions: fns("(x - 1)^2") }, { fn: 0, kind: "roots" })).toEqual([[1, 0]]);
    expect(found({ functions: fns("x^2 - 5x + 6.25") }, { fn: 0, kind: "roots" })).toEqual([[2.5, 0]]);
  });

  it("una raíz irracional queda con toda su precisión y se escribe con ≈", () => {
    const [[x]] = found({ functions: fns("x^2 - 2") }, { fn: 0, kind: "roots", labels: true }).slice(1);
    expect(x).toBeCloseTo(Math.SQRT2, 12);
    expect(describeNotable(spec({ functions: fns("x^2 - 2"), notable: [{ fn: 0, kind: "roots" }] }), { fn: 0, kind: "roots" })).toBe('Raíces de "x^2 - 2" (cortes con el eje x): ≈ (-1,41; 0) y ≈ (1,41; 0).');
  });

  it("no toma por raíz una asíntota ni un salto que cambian de signo", () => {
    expect(found({ functions: fns("1/x") }, { fn: 0, kind: "roots" })).toEqual([]);
    expect(found({ functions: fns("floor(x) + 0.5") }, { fn: 0, kind: "roots" })).toEqual([]);
    expect(found({ functions: fns("tan(x)"), xMin: -2, xMax: 2 }, { fn: 0, kind: "roots" })).toEqual([[0, 0]]);
  });

  it("solo busca dentro del dominio del trozo", () => {
    expect(found({ functions: [{ expr: "x^2 - 4", from: 0 }] }, { fn: 0, kind: "roots" })).toEqual([[2, 0]]);
    // Una raíz justo en un extremo cerrado cuenta; en uno abierto, no
    expect(found({ functions: [{ expr: "x - 1", from: 1, to: 4 }] }, { fn: 0, kind: "roots" })).toEqual([[1, 0]]);
    expect(found({ functions: [{ expr: "x - 1", from: 1, fromEnd: "open", to: 4 }] }, { fn: 0, kind: "roots" })).toEqual([]);
  });

  it("rechaza pedir raíces donde no hay, donde no se ve el eje x o donde la función es cero", () => {
    expect(issuesOf({ functions: fns("x^2 + 1"), notable: [{ fn: 0, kind: "roots" }] })[0]).toContain("no tiene raíces entre x = -6 y x = 6");
    expect(issuesOf({ functions: fns("x^2 + 1"), yMin: 0.5, yMax: 8, notable: [{ fn: 0, kind: "roots" }] })[0]).toContain("eje x, que no se ve");
    expect(issuesOf({ functions: fns("0*x"), notable: [{ fn: 0, kind: "roots" }] })[0]).toContain("vale 0 en todo el tramo");
    expect(issuesOf({ functions: fns("x^2 - 4"), notable: [{ fn: 0, kind: "roots" }] })).toEqual([]);
  });

  it("rechaza una función con demasiadas raíces para distinguirlas", () => {
    const issues = issuesOf({ functions: fns("sin(5x)"), yMin: -2, yMax: 2, notable: [{ fn: 0, kind: "roots" }] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("no se distinguirían");
  });
});

describe("corte con el eje y", () => {
  it("es el valor de la función en cero", () => {
    expect(found({ functions: fns("x^2 - 4x + 3") }, { fn: 0, kind: "yIntercept" })).toEqual([[0, 3]]);
    expect(found({ functions: fns("2^x") }, { fn: 0, kind: "yIntercept" })).toEqual([[0, 1]]);
  });

  it("rechaza pedirlo donde la función no existe en cero o el eje y no se ve", () => {
    expect(issuesOf({ functions: fns("1/x"), notable: [{ fn: 0, kind: "yIntercept" }] })[0]).toContain("no está definida en x = 0");
    expect(issuesOf({ functions: [{ expr: "x + 1", from: 1 }], notable: [{ fn: 0, kind: "yIntercept" }] })[0]).toContain("no está definida en x = 0");
    expect(issuesOf({ functions: fns("x + 1"), xMin: 1, xMax: 8, notable: [{ fn: 0, kind: "yIntercept" }] })[0]).toContain("x = 0, que no se ve");
    expect(issuesOf({ functions: fns("x + 8"), notable: [{ fn: 0, kind: "yIntercept" }] })[0]).toContain("el corte con el eje y (0, 8)");
  });
});

describe("máximos y mínimos", () => {
  it("halla el vértice exacto de una parábola", () => {
    const plane = spec({ functions: fns("x^2 - 4x + 3"), notable: [{ fn: 0, kind: "extrema" }] });
    expect(findNotable(plane, plane.notable![0])!.points).toEqual([{ x: 2, y: -1, role: "minimum" }]);
    expect(found({ functions: fns("-2x^2 + 6x - 1") }, { fn: 0, kind: "extrema" })).toEqual([[1.5, 3.5]]);
    expect(found({ functions: fns("-x^2 + 4") }, { fn: 0, kind: "extrema" })).toEqual([[0, 4]]);
  });

  it("halla el máximo y el mínimo de una cúbica, y la esquina de un valor absoluto", () => {
    const cubic = spec({ functions: fns("x^3 - 3x"), notable: [{ fn: 0, kind: "extrema" }] });
    expect(findNotable(cubic, cubic.notable![0])!.points).toEqual([
      { x: -1, y: 2, role: "maximum" },
      { x: 1, y: -2, role: "minimum" },
    ]);
    expect(found({ functions: fns("abs(x - 2) - 3") }, { fn: 0, kind: "extrema" })).toEqual([[2, -3]]);
  });

  it("un extremo irracional se redondea con ≈ y no se toma por exacto", () => {
    const plane = spec({ functions: fns("x^3 - 6x"), notable: [{ fn: 0, kind: "extrema" }] });
    const [max, min] = findNotable(plane, plane.notable![0])!.points;
    expect(max.x).toBeCloseTo(-Math.SQRT2, 6);
    expect(min.y).toBeCloseTo(-4 * Math.SQRT2, 9);
    expect(describeNotable(plane, plane.notable![0])).toBe('Extremos de "x^3 - 6x": máximo en ≈ (-1,41; 5,66) y mínimo en ≈ (1,41; -5,66).');
  });

  it("una recta, una constante y una parte entera no tienen extremos", () => {
    expect(found({ functions: fns("2x + 1") }, { fn: 0, kind: "extrema" })).toEqual([]);
    expect(found({ functions: fns("3") }, { fn: 0, kind: "extrema" })).toEqual([]);
    expect(found({ functions: fns("floor(x)") }, { fn: 0, kind: "extrema" })).toEqual([]);
    expect(found({ functions: fns("x - floor(x)") }, { fn: 0, kind: "extrema" })).toEqual([]);
    expect(found({ functions: fns("1/x") }, { fn: 0, kind: "extrema" })).toEqual([]);
    expect(issuesOf({ functions: fns("2x + 1"), notable: [{ fn: 0, kind: "extrema" }] })[0]).toContain("no tiene máximos ni mínimos");
  });

  it("rechaza un extremo que cae fuera del plano, con sus coordenadas", () => {
    const issues = issuesOf({ functions: fns("x^2 - 9"), notable: [{ fn: 0, kind: "extrema" }] });
    expect(issues.some(issue => issue.includes("el mínimo (0, -9)") && issue.includes("fuera del plano"))).toBe(true);
  });
});

describe("cortes entre dos funciones", () => {
  it("halla los cortes de una recta con una parábola", () => {
    expect(found({ functions: fns("x^2 - 2", "x") }, { fn: 0, kind: "intersections", with: 1 })).toEqual([
      [-1, -1],
      [2, 2],
    ]);
    // La solución de un sistema de dos ecuaciones lineales
    expect(found({ functions: fns("2x - 1", "-x + 5") }, { fn: 0, kind: "intersections", with: 1 })).toEqual([[2, 3]]);
  });

  it("halla el punto donde una recta es tangente a la curva", () => {
    expect(found({ functions: fns("x^2", "2x - 1") }, { fn: 0, kind: "intersections", with: 1 })).toEqual([[1, 1]]);
  });

  it("solo busca donde las dos funciones existen", () => {
    expect(found({ functions: [{ expr: "x^2 - 2" }, { expr: "x", from: 0 }] }, { fn: 0, kind: "intersections", with: 1 })).toEqual([[2, 2]]);
  });

  it("rechaza rectas paralelas, funciones iguales y peticiones mal armadas", () => {
    expect(issuesOf({ functions: fns("x + 1", "x - 2"), notable: [{ fn: 0, kind: "intersections", with: 1 }] })[0]).toContain("no se cortan");
    expect(issuesOf({ functions: fns("x + 1", "x + 1"), notable: [{ fn: 0, kind: "intersections", with: 1 }] })[0]).toContain("coinciden en todo el tramo");
    expect(issuesOf({ functions: fns("x + 1", "x"), notable: [{ fn: 0, kind: "intersections" }] })[0]).toContain("indica cuál en with");
    expect(issuesOf({ functions: fns("x + 1", "x"), notable: [{ fn: 0, kind: "intersections", with: 0 }] })[0]).toContain("dos funciones distintas");
    expect(issuesOf({ functions: fns("x + 1"), notable: [{ fn: 0, kind: "intersections", with: 3 }] })[0]).toContain("la función 3, que no existe");
    expect(issuesOf({ functions: fns("x + 1", "x"), notable: [{ fn: 0, kind: "roots", with: 1 }] })[0]).toContain('with solo va con kind "intersections"');
    expect(issuesOf({ functions: fns("x + 1"), notable: [{ fn: 2, kind: "roots" }] })[0]).toContain("la función 2, que no existe");
  });

  it("rechaza un corte que cae fuera del plano", () => {
    const issues = issuesOf({ functions: fns("x^2", "x + 12"), notable: [{ fn: 0, kind: "intersections", with: 1 }] });
    expect(issues.some(issue => issue.includes("el corte (4, 16)") && issue.includes("fuera del plano"))).toBe(true);
  });
});

describe("coordenadas como se leen en la figura", () => {
  it("usa coma decimal, punto y coma cuando hace falta y ≈ para lo redondeado", () => {
    const plane = spec();
    expect(planePointText(plane, 2, -1)).toBe("(2, -1)");
    expect(planePointText(plane, 1.5, 0)).toBe("(1,5; 0)");
    expect(planePointText(plane, Math.SQRT2, 0)).toBe("≈ (1,41; 0)");
    expect(planePointLatex(plane, 2, -1)).toBe("(2,\\, -1)");
    expect(planePointLatex(plane, 1.5, 0)).toBe("(1{,}5;\\, 0)");
    expect(planePointLatex(plane, 1 / 3, 2)).toBe("\\approx (0{,}33;\\, 2)");
  });

  it("en un plano en múltiplos de π, la abscisa se escribe con π y es exacta", () => {
    const trig = spec({ xMin: -6.2832, xMax: 6.2832, yMin: -2, yMax: 2, xStep: 1.5708, xUnit: "pi", functions: fns("sin(x)"), notable: [{ fn: 0, kind: "roots" }, { fn: 0, kind: "extrema" }] });
    expect(describeNotable(trig, trig.notable![0])).toBe('Raíces de "sin(x)" (cortes con el eje x): (-2π, 0), (-π, 0), (0, 0), (π, 0) y (2π, 0).');
    expect(describeNotable(trig, trig.notable![1])).toBe('Extremos de "sin(x)": máximo en (-3π/2, 1), mínimo en (-π/2, -1), máximo en (π/2, 1) y mínimo en (3π/2, -1).');
    expect(planePointLatex(trig, Math.PI / 2, 1)).toBe("(\\frac{\\pi}{2},\\, 1)");
    // Sin xUnit, el mismo punto es un decimal redondeado
    expect(planePointText(spec(), Math.PI / 2, 1)).toBe("≈ (1,57; 1)");
    expect(validateBlock(block({ type: "graph", spec: trig }))).toEqual([]);
  });
});

describe("lo que se dibuja y lo que se devuelve a la IA", () => {
  const plane = spec({
    functions: fns("x^2 - 4", "x + 2"),
    notable: [
      { fn: 0, kind: "roots" },
      { fn: 0, kind: "yIntercept" },
      { fn: 0, kind: "extrema", labels: false },
      { fn: 0, kind: "intersections", with: 1 },
    ],
  });

  it("no repite el punto que sale por dos peticiones y respeta labels", () => {
    const shown = shownNotablePoints(plane);
    // (-2, 0) es raíz y corte; (0, -4) es corte con y y vértice
    expect(shown.map(point => [point.x, point.y])).toEqual([
      [-2, 0],
      [2, 0],
      [0, -4],
      [3, 5],
    ]);
    expect(shown.map(point => point.label)).toEqual(["(-2,\\, 0)", "(2,\\, 0)", "(0,\\, -4)", "(3,\\, 5)"]);
    expect(shown.every(point => point.fn === 0)).toBe(true);
  });

  it("un punto sin coordenadas se marca igual", () => {
    const bare = spec({ functions: fns("x^2 - 4"), notable: [{ fn: 0, kind: "roots", labels: false }] });
    expect(shownNotablePoints(bare).map(point => point.label)).toEqual([null, null]);
  });

  it("describeGraph devuelve los puntos escritos como en la figura", () => {
    expect(describeGraph(plane)).toBe(
      'Gráfica: Raíces de "x^2 - 4" (cortes con el eje x): (-2, 0) y (2, 0). Corte de "x^2 - 4" con el eje y: (0, -4). Extremos de "x^2 - 4": mínimo en (0, -4). Cortes entre "x^2 - 4" y "x + 2": (-2, 0) y (3, 5).',
    );
    expect(validateBlock(block({ type: "graph", spec: plane }))).toEqual([]);
  });

  it("rechaza más coordenadas escritas de las que caben", () => {
    const crowded = issuesOf({
      xMin: -6.2832,
      xMax: 6.2832,
      yMin: -2,
      yMax: 2,
      functions: fns("sin(2x)"),
      notable: [
        { fn: 0, kind: "roots" },
        { fn: 0, kind: "extrema" },
      ],
    });
    expect(crowded).toHaveLength(1);
    expect(crowded[0]).toContain("caben 12");
  });

  it("una función que no compila solo da su propio aviso", () => {
    const issues = issuesOf({ functions: fns("x +"), notable: [{ fn: 0, kind: "roots" }] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("no se puede evaluar");
  });
});

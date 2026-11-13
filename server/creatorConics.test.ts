import { describe, expect, it } from "vitest";
import { blockInputSchema, blockPreview, emptyDoc, type BlockInput, type GraphConic } from "@shared/creator";
import { asymptotesLatex, conicCurves, conicElements, conicEquation, describeConic, pointText, shownConicElements } from "@shared/creatorConics";
import { hasEqualUnits } from "@shared/creatorPlane";
import { describeComputed } from "@shared/creatorStats";
import { checkLatex, validateBlock } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const SQUARE = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 };
const graph = (conics: unknown[], spec: Record<string, unknown> = {}) => block({ type: "graph", spec: { ...SQUARE, ...spec, conics } });
const issuesOf = (conics: unknown[], spec: Record<string, unknown> = {}) => validateBlock(graph(conics, spec));
/** La cónica tal como queda tras pasar por el esquema (con axis por defecto). */
const conic = (input: Record<string, unknown>): GraphConic => {
  const parsed = graph([input]);
  if (parsed.type !== "graph") throw new Error("no es una gráfica");
  return parsed.spec.conics![0];
};
const named = (input: Record<string, unknown>) => Object.fromEntries(conicElements(conic(input)).points.map(point => [point.name, [point.x, point.y]]));

describe("elementos de las cónicas", () => {
  it("circunferencia: solo el centro", () => {
    expect(named({ kind: "circle", h: 2, k: -1, r: 3 })).toEqual({ C: [2, -1] });
  });

  it("elipse: vértices y focos sobre el eje mayor, sea horizontal o vertical", () => {
    expect(named({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3 })).toEqual({
      C: [0, 0],
      "V_{1}": [-5, 0],
      "V_{2}": [5, 0],
      "B_{1}": [0, -3],
      "B_{2}": [0, 3],
      "F_{1}": [-4, 0],
      "F_{2}": [4, 0],
    });
    const tall = named({ kind: "ellipse", h: 1, k: 2, rx: 3, ry: 5 });
    expect(tall["V_{1}"]).toEqual([1, -3]);
    expect(tall["V_{2}"]).toEqual([1, 7]);
    expect(tall["F_{1}"]).toEqual([1, -2]);
    expect(tall["F_{2}"]).toEqual([1, 6]);
    expect(tall["B_{2}"]).toEqual([4, 2]);
    expect(conicElements(conic({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3 })).focal).toBe(4);
  });

  it("parábola: foco a distancia p del vértice y directriz al otro lado", () => {
    const up = conicElements(conic({ kind: "parabola", h: 1, k: -2, p: 2 }));
    expect(up.points).toEqual([
      { x: 1, y: -2, name: "V", role: "vertex" },
      { x: 1, y: 0, name: "F", role: "focus" },
    ]);
    expect(up.lines).toEqual([{ role: "directrix", slope: 0, intercept: -4 }]);
    const left = conicElements(conic({ kind: "parabola", h: 0, k: 0, p: -1.5, axis: "horizontal" }));
    expect(left.points[1]).toMatchObject({ x: -1.5, y: 0 });
    expect(left.lines).toEqual([{ role: "directrix", vertical: 1.5 }]);
  });

  it("hipérbola: vértices a distancia a, focos a distancia c y asíntotas por el centro", () => {
    const horizontal = conic({ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4 });
    expect(named({ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4 })).toEqual({ C: [0, 0], "V_{1}": [-3, 0], "V_{2}": [3, 0], "F_{1}": [-5, 0], "F_{2}": [5, 0] });
    expect(conicElements(horizontal).lines.map(line => line.slope)).toEqual([4 / 3, -4 / 3]);
    const vertical = conicElements(conic({ kind: "hyperbola", h: 1, k: 1, a: 2, b: 1, axis: "vertical" }));
    expect(vertical.points.find(point => point.name === "V_{2}")).toMatchObject({ x: 1, y: 3 });
    // y − 1 = ±2(x − 1): pasan por el centro
    expect(vertical.lines).toEqual([
      { role: "asymptote", slope: 2, intercept: -1 },
      { role: "asymptote", slope: -2, intercept: 3 },
    ]);
  });

  it("solo dibuja lo que se pide en show", () => {
    const ellipse = conic({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3, show: ["foci"] });
    expect(shownConicElements(ellipse).points.map(point => point.name)).toEqual(["F_{1}", "F_{2}"]);
    const withVertices = conic({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3, show: ["vertices", "center"] });
    expect(shownConicElements(withVertices).points.map(point => point.name)).toEqual(["C", "V_{1}", "V_{2}", "B_{1}", "B_{2}"]);
    expect(shownConicElements(conic({ kind: "parabola", h: 0, k: 0, p: 1 })).points).toEqual([]);
    expect(shownConicElements(conic({ kind: "parabola", h: 0, k: 0, p: 1, show: ["directrix"] })).lines).toHaveLength(1);
    expect(shownConicElements(conic({ kind: "hyperbola", h: 0, k: 0, a: 1, b: 1, show: ["asymptotes"] })).lines).toHaveLength(2);
  });
});

describe("ecuación canónica", () => {
  const equation = (input: Record<string, unknown>) => conicEquation(conic(input));

  it("escribe cada cónica en su forma de clase", () => {
    expect(equation({ kind: "circle", h: 0, k: 0, r: 3 })).toBe("x^{2} + y^{2} = 9");
    expect(equation({ kind: "circle", h: 2, k: -1, r: 2.5 })).toBe("(x - 2)^{2} + (y + 1)^{2} = 6{,}25");
    expect(equation({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3 })).toBe("\\frac{x^{2}}{25} + \\frac{y^{2}}{9} = 1");
    expect(equation({ kind: "ellipse", h: -1, k: 2, rx: 1, ry: 2 })).toBe("(x + 1)^{2} + \\frac{(y - 2)^{2}}{4} = 1");
    expect(equation({ kind: "parabola", h: 0, k: 0, p: 2 })).toBe("x^{2} = 8y");
    expect(equation({ kind: "parabola", h: 1, k: -2, p: -0.5 })).toBe("(x - 1)^{2} = -2(y + 2)");
    expect(equation({ kind: "parabola", h: 1, k: 2, p: 0.25 })).toBe("(x - 1)^{2} = y - 2");
    expect(equation({ kind: "parabola", h: 0, k: 3, p: -0.25 })).toBe("x^{2} = -(y - 3)");
    expect(equation({ kind: "parabola", h: -2, k: 0, p: 1, axis: "horizontal" })).toBe("y^{2} = 4(x + 2)");
    expect(equation({ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4 })).toBe("\\frac{x^{2}}{9} - \\frac{y^{2}}{16} = 1");
    expect(equation({ kind: "hyperbola", h: 1, k: -1, a: 2, b: 1, axis: "vertical" })).toBe("\\frac{(y + 1)^{2}}{4} - (x - 1)^{2} = 1");
  });

  it("todas las ecuaciones que escribe son LaTeX válido", () => {
    for (const input of [
      { kind: "circle", h: 2.5, k: -1, r: 1.5 },
      { kind: "ellipse", h: -1, k: 2, rx: 2.5, ry: 4 },
      { kind: "parabola", h: 1, k: -2, p: -0.5 },
      { kind: "hyperbola", h: 1, k: -1, a: 2, b: 1.5, axis: "vertical" },
    ]) {
      expect(checkLatex(equation(input)!), JSON.stringify(input)).toBeNull();
    }
    expect(checkLatex(asymptotesLatex(conic({ kind: "hyperbola", h: 1, k: -1, a: 2, b: 3 }) as Extract<GraphConic, { kind: "hyperbola" }>))).toBeNull();
  });

  it("no inventa una ecuación exacta con números que no lo son", () => {
    // r = 2,236 no es √5: r² = 4,999696
    expect(equation({ kind: "circle", h: 0, k: 0, r: 2.236 })).toBeNull();
    expect(equation({ kind: "circle", h: 1 / 3, k: 0, r: 2 })).toBeNull();
    const issues = issuesOf([{ kind: "circle", h: 0, k: 0, r: 2.236, show: ["equation"] }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("no se puede escribir exacta");
    expect(issuesOf([{ kind: "circle", h: 0, k: 0, r: 2.236 }])).toEqual([]);
  });

  it("escribe las asíntotas con la pendiente como fracción simplificada", () => {
    const asymptotes = (input: Record<string, unknown>) => asymptotesLatex(conic(input) as Extract<GraphConic, { kind: "hyperbola" }>);
    expect(asymptotes({ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4 })).toBe("y = \\pm \\frac{4}{3}x");
    expect(asymptotes({ kind: "hyperbola", h: 0, k: 0, a: 2, b: 4 })).toBe("y = \\pm 2x");
    expect(asymptotes({ kind: "hyperbola", h: 0, k: 0, a: 2, b: 2 })).toBe("y = \\pm x");
    expect(asymptotes({ kind: "hyperbola", h: 1, k: -1, a: 4, b: 2, axis: "vertical" })).toBe("y + 1 = \\pm 2(x - 1)");
    expect(asymptotes({ kind: "hyperbola", h: 0, k: 2, a: 2, b: 1.5 })).toBe("y - 2 = \\pm 0{,}75x");
    // Semiejes con decimales cuya razón no es exacta: 2/1,5 = 4/3
    expect(asymptotes({ kind: "hyperbola", h: 3, k: 0, a: 2, b: 1.5, axis: "vertical" })).toBe("y = \\pm \\frac{4}{3}(x - 3)");
    expect(asymptotes({ kind: "hyperbola", h: 0, k: 0, a: 2.5, b: 1 })).toBe("y = \\pm 0{,}4x");
  });
});

describe("curva de una cónica", () => {
  it("todos los puntos cumplen la ecuación", () => {
    const circle = conicCurves(conic({ kind: "circle", h: 1, k: -2, r: 3 }), SQUARE);
    expect(circle).toHaveLength(1);
    for (const [x, y] of circle[0]) expect((x - 1) ** 2 + (y + 2) ** 2).toBeCloseTo(9, 9);
    // Cerrada: termina donde empieza
    expect(circle[0][circle[0].length - 1][0]).toBeCloseTo(circle[0][0][0], 9);

    for (const [x, y] of conicCurves(conic({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3 }), SQUARE)[0]) expect(x ** 2 / 25 + y ** 2 / 9).toBeCloseTo(1, 9);
    for (const [x, y] of conicCurves(conic({ kind: "parabola", h: 1, k: -2, p: 2 }), SQUARE)[0]) expect((x - 1) ** 2).toBeCloseTo(8 * (y + 2), 9);
    for (const [x, y] of conicCurves(conic({ kind: "parabola", h: 0, k: 0, p: -1, axis: "horizontal" }), SQUARE)[0]) expect(y ** 2).toBeCloseTo(-4 * x, 9);

    const hyperbola = conicCurves(conic({ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4 }), SQUARE);
    expect(hyperbola).toHaveLength(2);
    for (const branch of hyperbola) for (const [x, y] of branch) expect(x ** 2 / 9 - y ** 2 / 16).toBeCloseTo(1, 9);
    expect(hyperbola[0].every(([x]) => x <= -3)).toBe(true);
    expect(hyperbola[1].every(([x]) => x >= 3)).toBe(true);
    for (const branch of conicCurves(conic({ kind: "hyperbola", h: 0, k: 0, a: 2, b: 1, axis: "vertical" }), SQUARE)) for (const [x, y] of branch) expect(y ** 2 / 4 - x ** 2).toBeCloseTo(1, 9);
  });

  it("las ramas abiertas cruzan todo el plano", () => {
    const [parabola] = conicCurves(conic({ kind: "parabola", h: 0, k: 0, p: 1 }), SQUARE);
    expect(parabola[0][0]).toBeLessThan(SQUARE.xMin);
    expect(parabola[parabola.length - 1][0]).toBeGreaterThan(SQUARE.xMax);
  });
});

describe("validación de las cónicas", () => {
  it("acepta una cónica de cada tipo con sus elementos", () => {
    expect(
      issuesOf([
        { kind: "circle", h: -4, k: 4, r: 2, show: ["equation", "center"] },
        { kind: "ellipse", h: 3, k: 3, rx: 4, ry: 2, show: ["center", "foci", "vertices"] },
        { kind: "parabola", h: 0, k: -6, p: 1, show: ["foci", "vertices", "directrix", "equation"] },
      ]),
    ).toEqual([]);
    expect(issuesOf([{ kind: "hyperbola", h: 0, k: 0, a: 3, b: 4, show: ["center", "foci", "vertices", "asymptotes", "equation"] }])).toEqual([]);
  });

  it("rechaza una circunferencia o una elipse que no cabe entera", () => {
    const issues = issuesOf([{ kind: "circle", h: 5, k: 0, r: 4 }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("se sale del plano");
    expect(issues[0]).toContain("de x = 1 a 9");
    expect(issuesOf([{ kind: "ellipse", h: 0, k: 0, rx: 9, ry: 2 }])[0]).toContain("se sale del plano");
  });

  it("rechaza un plano que deformaría la cónica", () => {
    expect(hasEqualUnits(16, 16)).toBe(true);
    expect(hasEqualUnits(10, 20)).toBe(true);
    expect(hasEqualUnits(10, 40)).toBe(false);
    const issues = issuesOf([{ kind: "circle", h: 0, k: 0, r: 2 }], { xMin: -3, xMax: 3, yMin: -10, yMax: 10 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("la misma unidad en los dos ejes");
    expect(issues[0]).toContain("demasiado alto");
    // Sin cónicas, el mismo plano sigue valiendo
    expect(validateBlock(block({ type: "graph", spec: { xMin: -3, xMax: 3, yMin: -10, yMax: 10, yStep: 2, functions: [{ expr: "x^2" }] } }))).toEqual([]);
  });

  it("rechaza lo que una cónica no tiene y lo que queda fuera del plano", () => {
    expect(issuesOf([{ kind: "circle", h: 0, k: 0, r: 2, show: ["foci"] }])[0]).toContain('no tiene "foci"');
    expect(issuesOf([{ kind: "ellipse", h: 0, k: 0, rx: 3, ry: 2, show: ["asymptotes"] }])[0]).toContain('no tiene "asymptotes"');
    expect(issuesOf([{ kind: "ellipse", h: 0, k: 0, rx: 3, ry: 3 }])[0]).toContain("es una circunferencia");
    expect(issuesOf([{ kind: "parabola", h: 0, k: 0, p: 0 }])[0]).toContain("p no puede ser 0");
    expect(issuesOf([{ kind: "parabola", h: 0, k: 12, p: 1 }])[0]).toContain("vértice (0, 12)");
    expect(issuesOf([{ kind: "parabola", h: 0, k: 0, p: 9, show: ["foci"] }])[0]).toContain("el foco (0, 9)");
    expect(issuesOf([{ kind: "parabola", h: 0, k: 0, p: 9, show: ["directrix"] }])[0]).toContain("directriz y = -9");
    expect(issuesOf([{ kind: "hyperbola", h: 0, k: 0, a: 9, b: 1 }])).toHaveLength(2);
    expect(issuesOf([{ kind: "hyperbola", h: 0, k: 0, a: 6, b: 8, show: ["foci"] }])).toHaveLength(2);
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...SQUARE, conics: [{ kind: "circle", h: 0, k: 0, r: -1 }] } }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "graph", spec: { ...SQUARE, conics: [{ kind: "oval", h: 0, k: 0 }] } }).success).toBe(false);
  });
});

describe("lo que se le devuelve a la IA", () => {
  it("escribe los puntos con punto y coma cuando hay decimales", () => {
    expect(pointText(2, -1)).toBe("(2, -1)");
    expect(pointText(2.5, 0)).toBe("(2,5; 0)");
  });

  it("describe cada cónica con sus elementos calculados", () => {
    expect(describeConic(conic({ kind: "circle", h: 2, k: -1, r: 3 }))).toBe("Circunferencia: centro (2, -1), radio 3, ecuación $(x - 2)^{2} + (y + 1)^{2} = 9$.");
    expect(describeConic(conic({ kind: "ellipse", h: 0, k: 0, rx: 5, ry: 3 }))).toBe(
      "Elipse: centro (0, 0), eje mayor horizontal, vértices V_1(-5, 0) y V_2(5, 0), covértices B_1(0, -3) y B_2(0, 3), focos F_1(-4, 0) y F_2(4, 0) (c = 4), ecuación $\\frac{x^{2}}{25} + \\frac{y^{2}}{9} = 1$.",
    );
    expect(describeConic(conic({ kind: "parabola", h: 1, k: -2, p: 2 }))).toBe("Parábola: vértice (1, -2), foco (1, 0), directriz y = -4, abre hacia arriba, ecuación $(x - 1)^{2} = 8(y + 2)$.");
    expect(describeConic(conic({ kind: "parabola", h: 0, k: 0, p: -1.5, axis: "horizontal" }))).toContain("foco (-1,5; 0), directriz x = 1,5, abre hacia la izquierda");
  });

  it("da la distancia focal como raíz cuando no es exacta", () => {
    const text = describeConic(conic({ kind: "hyperbola", h: 0, k: 0, a: 2, b: 3 }));
    expect(text).toContain("focos F_1 ≈ (-3,61; 0) y F_2 ≈ (3,61; 0) (c = √13 ≈ 3,61)");
    expect(text).toContain("asíntotas $y = \\pm \\frac{3}{2}x$");
    expect(describeConic(conic({ kind: "ellipse", h: 0, k: 0, rx: 3, ry: 2 }))).toContain("(c = √5 ≈ 2,24)");
  });

  it("la herramienta devuelve los elementos al escribir la gráfica", () => {
    const circle = graph([{ kind: "circle", h: 2, k: -1, r: 3, show: ["center"] }]);
    expect(describeComputed(circle)).toBe("Gráfica: Circunferencia: centro (2, -1), radio 3, ecuación $(x - 2)^{2} + (y + 1)^{2} = 9$.");
    expect(describeComputed(block({ type: "graph", spec: { ...SQUARE, functions: [{ expr: "x" }] } }))).toBeNull();

    const outcome = executeCreatorTool(emptyDoc("Cónicas"), "write_section", { title: "Guía", role: "student", blocks: [circle] }, Math.random);
    expect(outcome.isError).toBe(false);
    expect(outcome.result).toContain("Valores calculados por el sistema");
    expect(outcome.result).toContain("$(x - 2)^{2} + (y + 1)^{2} = 9$");

    const rejected = executeCreatorTool(emptyDoc("Cónicas"), "write_section", { title: "Guía", role: "student", blocks: [{ type: "graph", spec: { ...SQUARE, conics: [{ kind: "circle", h: 7, k: 0, r: 3 }] } }] }, Math.random);
    expect(rejected.isError).toBe(true);
    expect(rejected.result).toContain("se sale del plano");
  });

  it("el esquema de las herramientas y las instrucciones conocen las cónicas", () => {
    const schema = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    for (const word of ["conics", "hyperbola", "directrix", "asymptotes"]) expect(schema, word).toContain(word);
    expect(CREATOR_SYSTEM_PROMPT).toContain("conics");
  });

  it("el índice del documento nombra las cónicas de un plano sin funciones", () => {
    expect(blockPreview(graph([{ kind: "circle", h: 0, k: 0, r: 2 }, { kind: "parabola", h: 0, k: 0, p: 1 }]))).toBe("Circunferencia, Parábola");
    expect(blockPreview(block({ type: "graph", spec: SQUARE }))).toBe("Plano en blanco");
  });
});

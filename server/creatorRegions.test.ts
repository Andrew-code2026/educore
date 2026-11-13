import { describe, expect, it } from "vitest";
import { blockInputSchema, blockPreview, graphSpecSchema, parseDoc, resourceDocSchema, type BlockInput, type GraphSpec } from "@shared/creator";
import { describeGraph } from "@shared/creatorGraphFacts";
import { planeLayout, planeXTicks } from "@shared/creatorPlaneAxes";
import { boundarySegment, commonRegion, describeInequalities, halfPlaneRegion, inequalityLatex, inequalityText, regionBounded, regionVertices } from "@shared/creatorRegions";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -2, xMax: 10, yMin: -2, yMax: 10 };
const spec = (extra: Record<string, unknown> = {}): GraphSpec => graphSpecSchema.parse({ ...PLANE, ...extra });
const issuesOf = (extra: Record<string, unknown>) => validateBlock(block({ type: "graph", spec: { ...PLANE, ...extra } }));
const le = (a: number, b: number, c: number) => ({ a, b, op: "<=", c });
const ge = (a: number, b: number, c: number) => ({ a, b, op: ">=", c });
const area = (polygon: Array<[number, number]>) => Math.abs(polygon.reduce((sum, [x, y], i) => sum + x * polygon[(i + 1) % polygon.length][1] - polygon[(i + 1) % polygon.length][0] * y, 0)) / 2;
const pairs = (vertices: Array<{ x: number; y: number }>) => vertices.map(vertex => [vertex.x, vertex.y]);

/** Un problema de programación lineal típico: 2x + y ≤ 10, x + 3y ≤ 15, x ≥ 0, y ≥ 0. */
const LP = [le(2, 1, 10), le(1, 3, 15), ge(1, 0, 0), ge(0, 1, 0)];

describe("escritura de una inecuación", () => {
  it("omite los unos y los términos que valen cero", () => {
    const write = (input: Record<string, unknown>) => inequalityText(graphSpecSchema.parse({ ...PLANE, inequalities: [input] }).inequalities![0]);
    expect(write(le(2, 3, 12))).toBe("2x + 3y ≤ 12");
    expect(write(ge(1, 0, 0))).toBe("x ≥ 0");
    expect(write(ge(0, 1, 0))).toBe("y ≥ 0");
    expect(write({ a: -1, b: 1, op: "<", c: 4 })).toBe("-x + y < 4");
    expect(write({ a: 1, b: -1, op: ">", c: -2.5 })).toBe("x - y > -2,5");
    expect(write({ a: 0, b: -2, op: "<=", c: 6 })).toBe("-2y ≤ 6");
    expect(write({ a: 0.5, b: 1.5, op: "<=", c: 3 })).toBe("0,5x + 1,5y ≤ 3");
  });

  it("en LaTeX usa \\le y \\ge y la coma entre llaves", () => {
    const plane = spec({ inequalities: [le(2, 3, 12), { a: 1, b: -1.5, op: ">=", c: 0.5 }, { a: 1, b: 1, op: "<", c: 4 }] });
    expect(plane.inequalities!.map(inequalityLatex)).toEqual(["2x + 3y \\le 12", "x - 1{,}5y \\ge 0{,}5", "x + y < 4"]);
  });
});

describe("semiplanos", () => {
  it("la parte del plano que cumple una inecuación", () => {
    const plane = spec({ xMin: 0, xMax: 4, yMin: 0, yMax: 4 });
    // x + y ≤ 4 corta el cuadrado por su diagonal
    expect(area(halfPlaneRegion(plane, { a: 1, b: 1, op: "<=", c: 4 }))).toBe(8);
    expect(area(halfPlaneRegion(plane, { a: 1, b: 1, op: ">=", c: 4 }))).toBe(8);
    expect(area(halfPlaneRegion(plane, { a: 1, b: 0, op: "<=", c: 1 }))).toBe(4);
    // Estricta o no, el semiplano es el mismo: cambia la frontera
    expect(area(halfPlaneRegion(plane, { a: 1, b: 0, op: "<", c: 1 }))).toBe(4);
  });

  it("la frontera cruza el plano de borde a borde", () => {
    const plane = spec({ xMin: 0, xMax: 4, yMin: 0, yMax: 4 });
    expect(boundarySegment(plane, { a: 1, b: 1, op: "<=", c: 4 })).toEqual([
      [0, 4],
      [4, 0],
    ]);
    expect(boundarySegment(plane, { a: 1, b: 0, op: ">=", c: 1 })).toEqual([
      [1, 0],
      [1, 4],
    ]);
    expect(boundarySegment(plane, { a: 0, b: 2, op: "<", c: 6 })).toEqual([
      [0, 3],
      [4, 3],
    ]);
    // Una recta que no toca el plano no tiene tramo
    expect(boundarySegment(plane, { a: 1, b: 1, op: "<=", c: 20 })).toBeNull();
  });

  it("describe un semiplano con su frontera y el punto de prueba", () => {
    expect(describeInequalities(spec({ inequalities: [le(2, 3, 12)] }))).toBe("Inecuación 2x + 3y ≤ 12: semiplano con frontera continua (la recta pertenece a la solución); el punto (0, 0) la cumple.");
    expect(describeInequalities(spec({ inequalities: [{ a: 1, b: 1, op: ">", c: 4 }] }))).toBe("Inecuación x + y > 4: semiplano con frontera punteada (la recta no pertenece a la solución); el punto (0, 0) no la cumple.");
    // Si la frontera pasa por el origen, no sirve de punto de prueba
    expect(describeInequalities(spec({ inequalities: [{ a: 1, b: -1, op: "<", c: 0 }] }))).toBe("Inecuación x - y < 0: semiplano con frontera punteada (la recta no pertenece a la solución).");
  });
});

describe("región factible", () => {
  it("halla los vértices exactos de la región común, en orden", () => {
    const plane = spec({ inequalities: LP });
    expect(pairs(regionVertices(plane))).toEqual([
      [0, 0],
      [5, 0],
      [3, 4],
      [0, 5],
    ]);
    expect(regionVertices(plane).every(vertex => !vertex.open)).toBe(true);
    expect(regionBounded(plane)).toBe(true);
    // El área del cuadrilátero (0,0) (5,0) (3,4) (0,5)
    expect(area(commonRegion(plane))).toBeCloseTo(17.5, 9);
  });

  it("no cuenta como vértice el corte de dos fronteras que queda fuera de la región", () => {
    // 2x + y = 10 y x + 3y = 15 cortan los ejes también en (15, 0) y (0, 10), que no cumplen la otra
    const all = pairs(regionVertices(spec({ inequalities: LP })));
    expect(all).not.toContainEqual([15, 0]);
    expect(all).not.toContainEqual([0, 10]);
  });

  it("un vértice con decimales se escribe con coma, y uno no exacto con ≈", () => {
    const plane = spec({ inequalities: [le(1, 1, 5), le(1, 3, 9), ge(1, 0, 0), ge(0, 1, 0)], inequalityVertices: true });
    expect(describeInequalities(plane)).toBe("Sistema de inecuaciones: fronteras x + y ≤ 5 continua, x + 3y ≤ 9 continua, x ≥ 0 continua y y ≥ 0 continua; región común acotada; vértices (0, 0), (5, 0), (3, 2) y (0, 3).");
    const thirds = spec({ inequalities: [le(3, 1, 7), le(1, 3, 7), ge(1, 0, 0), ge(0, 1, 0)] });
    expect(describeInequalities(thirds)).toContain("vértices (0, 0), ≈ (2,33; 0), (1,75; 1,75) y ≈ (0; 2,33)");
  });

  it("distingue una región no acotada", () => {
    const plane = spec({ inequalities: [ge(1, 1, 4), ge(1, 0, 0), ge(0, 1, 0)] });
    expect(regionBounded(plane)).toBe(false);
    expect(pairs(regionVertices(plane))).toEqual([
      [0, 4],
      [4, 0],
    ]);
    expect(describeInequalities(plane)).toContain("región común no acotada; vértices (0, 4) y (4, 0)");
  });

  it("un vértice sobre una frontera punteada no pertenece a la región", () => {
    const plane = spec({ inequalities: [{ a: 1, b: 1, op: "<", c: 6 }, ge(1, 0, 0), ge(0, 1, 0)] });
    const vertices = regionVertices(plane);
    expect(vertices.map(vertex => [vertex.x, vertex.y, vertex.open])).toEqual([
      [0, 0, false],
      [6, 0, true],
      [0, 6, true],
    ]);
    expect(describeInequalities(plane)).toContain("(6, 0) (sobre una frontera punteada: no pertenece)");
  });

  it("tres fronteras que pasan por el mismo punto dan un solo vértice", () => {
    const plane = spec({ inequalities: [le(1, 1, 4), le(1, -1, 0), le(1, 0, 2), ge(0, 1, 0)] });
    const corner = regionVertices(plane).filter(vertex => vertex.x === 2 && vertex.y === 2);
    expect(corner).toHaveLength(1);
  });

  it("describeGraph devuelve los vértices para la clave", () => {
    expect(describeGraph(spec({ inequalities: LP, inequalityVertices: true }))).toBe(
      "Gráfica: Sistema de inecuaciones: fronteras 2x + y ≤ 10 continua, x + 3y ≤ 15 continua, x ≥ 0 continua y y ≥ 0 continua; región común acotada; vértices (0, 0), (5, 0), (3, 4) y (0, 5).",
    );
  });
});

describe("validación de las inecuaciones", () => {
  it("acepta un semiplano, un sistema y un plano para sombrear", () => {
    expect(issuesOf({ inequalities: [le(2, 3, 12)] })).toEqual([]);
    expect(issuesOf({ inequalities: LP, inequalityVertices: true })).toEqual([]);
    expect(issuesOf({ inequalities: LP.map(item => ({ ...item, label: true })), inequalityShade: "each" })).toEqual([]);
    expect(issuesOf({ inequalities: LP, inequalityShade: "none" })).toEqual([]);
  });

  it("rechaza una inecuación sin variables o cuya frontera no se ve", () => {
    expect(issuesOf({ inequalities: [le(0, 0, 3)] })[0]).toContain("no tiene x ni y");
    const issues = issuesOf({ inequalities: [le(1, 1, 40)] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("la frontera de la inecuación 1 (x + y = 40) no pasa por el plano");
  });

  it("rechaza un sistema sin región común a la vista", () => {
    const issues = issuesOf({ inequalities: [le(1, 0, 2), ge(1, 0, 5)] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("no tienen región común dentro del plano");
    // Dos fronteras que solo se tocan en una recta no dejan región que sombrear
    expect(issuesOf({ inequalities: [le(1, 0, 2), ge(1, 0, 2)] })[0]).toContain("no tienen región común");
    // Sin sombrear, las fronteras solas sí se pueden dibujar
    expect(issuesOf({ inequalities: [le(1, 0, 2), ge(1, 0, 5)], inequalityShade: "none" })).toEqual([]);
  });

  it("rechaza una región cortada por el borde del plano, con el vértice que falta", () => {
    const issues = issuesOf({ xMax: 4, inequalities: LP });
    expect(issues).toEqual(["Gráfica: la región común tiene un vértice en (5, 0), fuera del plano; amplía el rango para que se vea entera."]);
  });

  it("rechaza pedir vértices donde no los hay", () => {
    expect(issuesOf({ inequalities: [le(2, 3, 12)], inequalityVertices: true })[0]).toContain("no tiene vértices");
    expect(issuesOf({ inequalities: [le(1, 1, 4), ge(1, 1, 1)], inequalityVertices: true })[0]).toContain("no tiene vértices");
  });

  it("rechaza escribir una inecuación con coeficientes que no son exactos", () => {
    expect(issuesOf({ inequalities: [{ a: 0.33333, b: 1, op: "<=", c: 4, label: true }] })[0]).toContain("no se puede escribir exacta");
    expect(issuesOf({ inequalities: [{ a: 0.33333, b: 1, op: "<=", c: 4 }] })).toEqual([]);
  });

  it("rechaza las opciones de región sin inecuaciones", () => {
    expect(issuesOf({ inequalityVertices: true })[0]).toContain("no tiene ninguna (inequalities)");
    expect(issuesOf({ inequalityShade: "each" })[0]).toContain("no tiene ninguna (inequalities)");
  });

  it("el esquema limita el número de inecuaciones y sus signos", () => {
    expect(graphSpecSchema.safeParse({ ...PLANE, inequalities: Array.from({ length: 7 }, () => le(1, 1, 4)) }).success).toBe(false);
    expect(graphSpecSchema.safeParse({ ...PLANE, inequalities: [{ a: 1, b: 1, op: "=", c: 4 }] }).success).toBe(false);
  });
});

describe("recursos guardados antes de la segunda ampliación del plano", () => {
  // Un documento con todo lo que el plano admitía tras la primera ampliación (cónicas, trozos, áreas, tangentes)
  const saved = {
    title: "Guía de funciones y cónicas",
    subtitle: "Grado 11",
    sections: [
      {
        id: "sold001",
        title: "Guía del estudiante",
        role: "student" as const,
        blocks: [
          {
            id: "bold001",
            type: "graph",
            caption: "Rectas y parábola",
            spec: {
              xMin: -2,
              xMax: 6,
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
                { x: 2, y: -1, on: 1 },
                { x: 4, y: 6, on: null },
              ],
            },
          },
          {
            id: "bold002",
            type: "graph",
            size: "large",
            spec: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              xStep: 1,
              yStep: 1,
              functions: [
                { expr: "x^2", to: 1, toEnd: "open" },
                { expr: "x + 2", from: 1, color: 0 },
                { expr: "floor(x)", style: "dashed" },
              ],
              points: [{ x: 1, y: 1, on: 0, open: true }],
              verticalLines: [{ x: 3, style: "dashed", label: "x = 3" }],
              conics: [{ kind: "circle", h: -3, k: 3, r: 2, show: ["center", "radius", "equation"] }],
              areas: [{ fn: 1, from: 1, to: 3, showValue: true }],
              tangents: [{ fn: 0, x: -1, show: "equation" }],
              secants: [{ fn: 0, x1: -2, x2: 0, show: "slope" }],
            },
          },
          { id: "bold003", type: "graph", spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [], points: [] } },
        ],
      },
    ],
  };

  it("se leen exactamente como se guardaron: los campos nuevos no añaden nada", () => {
    expect(resourceDocSchema.safeParse(saved).success).toBe(true);
    expect(parseDoc(JSON.stringify(saved))).toEqual(saved);
  });

  it("siguen pasando la validación y se describen igual", () => {
    const doc = parseDoc(saved);
    for (const item of doc.sections[0].blocks) {
      const { id: _id, ...content } = item;
      expect(validateBlock(content as BlockInput), item.id).toEqual([]);
    }
    expect(blockPreview(doc.sections[0].blocks[0])).toBe("Rectas y parábola");
    expect(blockPreview(doc.sections[0].blocks[1])).toBe("x^2, x + 2, floor(x), Circunferencia");
    expect(blockPreview(doc.sections[0].blocks[2])).toBe("Plano en blanco");
  });

  it("miden lo mismo y llevan las mismas marcas en los ejes", () => {
    const doc = parseDoc(saved);
    const specs = doc.sections[0].blocks.map(item => (item as { spec: GraphSpec }).spec);
    // Los márgenes fijos de antes (30, 24, 22, 28) y la cuadrícula de 320 px en su lado mayor
    expect(specs.map(item => planeLayout(item)).map(layout => [Number(layout!.w.toFixed(2)), layout!.h, layout!.pad, Number(layout!.width.toFixed(2)), layout!.height])).toEqual([
      [213.33, 320, { left: 30, right: 24, top: 22, bottom: 28 }, 267.33, 370],
      [320, 320, { left: 30, right: 24, top: 22, bottom: 28 }, 374, 370],
      [320, 320, { left: 30, right: 24, top: 22, bottom: 28 }, 374, 370],
    ]);
    expect(planeXTicks(specs[0], 213.33).map(tick => tick.text)).toEqual(["-2", "-1", "0", "1", "2", "3", "4", "5", "6"]);
    expect(planeXTicks(specs[1], 320).every(tick => tick.labeled)).toBe(true);
    // Sin los campos nuevos no hay nada nuevo que calcular
    expect(describeGraph(specs[0])).toBeNull();
    expect(describeGraph(specs[2])).toBeNull();
  });

  it("un plano con figuras o inecuaciones se nombra por lo que tiene", () => {
    const fresh = block({ type: "graph", spec: { ...PLANE, figures: [{ kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }] }], inequalities: [le(1, 1, 4)] } });
    expect(blockPreview(fresh)).toBe("Polígono, Región de inecuaciones");
  });
});

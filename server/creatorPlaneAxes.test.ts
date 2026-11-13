import { describe, expect, it } from "vitest";
import { blockInputSchema, graphSpecSchema, type BlockInput, type GraphSpec } from "@shared/creator";
import { PLANE_PAD, axisNameWidth, planeAxisIssues, planeLayout, planeTicks, plotSize } from "@shared/creatorPlaneAxes";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const spec = (extra: Record<string, unknown> = {}): GraphSpec => graphSpecSchema.parse({ ...PLANE, ...extra });
const issuesOf = (extra: Record<string, unknown>) => validateBlock(block({ type: "graph", spec: { ...PLANE, ...extra } }));

describe("medidas del plano", () => {
  it("sin nombres de eje, el plano mide lo de siempre", () => {
    const layout = planeLayout(spec())!;
    expect(layout.pad).toEqual(PLANE_PAD);
    expect([layout.w, layout.h]).toEqual([320, 320]);
    expect([layout.width, layout.height]).toEqual([374, 370]);
    expect(layout.xName).toBeNull();
    expect(layout.yName).toBeNull();
  });

  it("conserva la escala de cada tipo de rango", () => {
    expect(plotSize(10, 10)).toEqual({ w: 320, h: 320 });
    expect(plotSize(10, 5)).toEqual({ w: 320, h: 160 });
    expect(plotSize(10, 100)).toEqual({ w: 240, h: 320 });
    expect(plotSize(100, 10)).toEqual({ w: 320, h: 200 });
    expect(planeTicks(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it("un rango no válido no tiene medidas", () => {
    expect(planeLayout({ ...spec(), xMin: 3, xMax: 3 })).toBeNull();
  });
});

describe("ejes con nombre", () => {
  it("cada nombre añade su franja fuera de la cuadrícula y no cambia su tamaño", () => {
    const plain = planeLayout(spec())!;
    const named = planeLayout(spec({ xLabel: "Tiempo (h)", yLabel: "Distancia (km)" }))!;
    expect([named.w, named.h]).toEqual([plain.w, plain.h]);
    expect(named.pad.bottom).toBe(plain.pad.bottom + 16);
    expect(named.pad.left).toBe(plain.pad.left + 16);
    // El nombre de x queda bajo los números y las flechas; el de y, a la izquierda de todo
    expect(named.xName!.y).toBeGreaterThan(named.pad.top + named.h + PLANE_PAD.bottom);
    expect(named.xName!.x).toBe(named.pad.left + named.w / 2);
    expect(named.yName!.x).toBeLessThan(named.pad.left - PLANE_PAD.left + 16);
    expect(named.yName!.y).toBe(named.pad.top + named.h / 2);
  });

  it("solo el eje nombrado gana franja", () => {
    const onlyX = planeLayout(spec({ xLabel: "Meses" }))!;
    expect(onlyX.pad.left).toBe(PLANE_PAD.left);
    expect(onlyX.pad.bottom).toBe(PLANE_PAD.bottom + 16);
    expect(onlyX.yName).toBeNull();
  });

  it("con el eje y en el borde izquierdo, el nombre va más allá de sus números", () => {
    // Costos de 0 a 20.000: los números ocupan seis caracteres a la izquierda de la cuadrícula
    const money = planeLayout(spec({ xMin: 0, xMax: 10, yMin: 0, yMax: 20000, yStep: 5000, yLabel: "Costo ($)" }))!;
    expect(money.pad.left).toBe(6 * 6 + 13 + 16);
    // Con el eje y dentro del plano los números van dentro: basta la franja
    const centered = planeLayout(spec({ yMin: 0, yMax: 20000, yStep: 5000, yLabel: "Costo ($)" }))!;
    expect(centered.pad.left).toBe(PLANE_PAD.left + 16);
  });

  it("acepta nombres con unidades y con el signo de pesos", () => {
    expect(issuesOf({ xLabel: "Tiempo (h)", yLabel: "Costo ($)" })).toEqual([]);
    expect(issuesOf({ xLabel: "Número de fotocopias", yLabel: "Precio (miles de $)" })).toEqual([]);
  });

  it("rechaza un nombre que no cabe a lo largo de su eje, con los caracteres que admite", () => {
    // Plano ancho y bajo: 160 px de alto para el nombre del eje y
    const wide = { xMin: 0, xMax: 20, yMin: 0, yMax: 10 };
    const name = "Temperatura promedio del salón (°C)";
    const issues = issuesOf({ ...wide, yLabel: name });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("eje y");
    expect(issues[0]).toContain(name);
    const layout = planeLayout(spec({ ...wide, yLabel: name }))!;
    expect(issues[0]).toContain(`${Math.floor((layout.height - 8) / (axisNameWidth("a") / 1))} caracteres`);
    // El mismo nombre sí cabe a lo ancho
    expect(issuesOf({ ...wide, xLabel: name })).toEqual([]);
    expect(planeAxisIssues(spec({ ...wide, xLabel: name }))).toEqual([]);
  });

  it("el nombre de un eje es texto plano: no admite fórmulas", () => {
    const issues = issuesOf({ xLabel: "$t$ (s)" });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("texto plano");
    expect(issuesOf({ yLabel: "\\text{Costo}" })[0]).toContain("texto plano");
  });

  it("el esquema limita el largo y descarta el nombre vacío", () => {
    expect(graphSpecSchema.safeParse({ ...PLANE, xLabel: "a".repeat(41) }).success).toBe(false);
    expect(graphSpecSchema.safeParse({ ...PLANE, xLabel: "  " }).success).toBe(false);
    expect(spec({ xLabel: "  Tiempo (h) " }).xLabel).toBe("Tiempo (h)");
  });
});

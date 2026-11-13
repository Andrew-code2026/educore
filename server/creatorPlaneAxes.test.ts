import { describe, expect, it } from "vitest";
import { blockInputSchema, graphSpecSchema, type BlockInput, type GraphSpec } from "@shared/creator";
import { PLANE_PAD, axisNameWidth, piFraction, piLatex, piStep, piText, planeAxisIssues, planeLayout, planeTicks, planeXTicks, plotSize } from "@shared/creatorPlaneAxes";
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

describe("eje x en múltiplos de π", () => {
  const PI = Math.PI;
  const TRIG = { xMin: -6.2832, xMax: 6.2832, yMin: -2, yMax: 2, xStep: 1.5708, yStep: 1, xUnit: "pi" };

  it("reconoce las fracciones de π de los ángulos notables", () => {
    expect(piFraction(PI / 2)).toEqual({ n: 1, d: 2 });
    expect(piFraction((-3 * PI) / 2)).toEqual({ n: -3, d: 2 });
    expect(piFraction(2 * PI)).toEqual({ n: 2, d: 1 });
    expect(piFraction((5 * PI) / 6)).toEqual({ n: 5, d: 6 });
    expect(piFraction((7 * PI) / 12)).toEqual({ n: 7, d: 12 });
    expect(piFraction(0)).toEqual({ n: 0, d: 1 });
    // Un número cualquiera no es un múltiplo de π, y uno redondeado solo lo es con la tolerancia de lo escrito a mano
    expect(piFraction(1)).toBeNull();
    expect(piFraction(1.5708)).toBeNull();
    expect(piFraction(1.5708, 1e-3)).toEqual({ n: 1, d: 2 });
    expect(piFraction(1.5, 1e-3)).toBeNull();
    expect(piFraction(PI / 5, 1e-3)).toBeNull();
  });

  it("los escribe como en el tablero, en texto y en LaTeX", () => {
    expect([{ n: 0, d: 1 }, { n: 1, d: 1 }, { n: -1, d: 1 }, { n: 2, d: 1 }, { n: 1, d: 2 }, { n: -3, d: 2 }, { n: 5, d: 6 }].map(piText)).toEqual(["0", "π", "-π", "2π", "π/2", "-3π/2", "5π/6"]);
    expect(piLatex({ n: 1, d: 2 })).toBe("\\frac{\\pi}{2}");
    expect(piLatex({ n: -3, d: 2 })).toBe("-\\frac{3\\pi}{2}");
    expect(piLatex({ n: -1, d: 1 })).toBe("-\\pi");
    expect(piLatex({ n: 2, d: 1 })).toBe("2\\pi");
  });

  it("las marcas van en los múltiplos exactos de π/2, de −2π a 2π", () => {
    const ticks = planeXTicks(spec(TRIG), 320);
    expect(ticks.map(tick => tick.text)).toEqual(["-2π", "-3π/2", "-π", "-π/2", "0", "π/2", "π", "3π/2", "2π"]);
    expect(ticks.every(tick => tick.labeled)).toBe(true);
    // No en los múltiplos de 1,5708: la marca de π está en π
    expect(ticks[6].value).toBe(PI);
    expect(ticks[3].value).toBe(-PI / 2);
  });

  it("un rango escrito con dos decimales conserva la marca del borde", () => {
    const ticks = planeXTicks(spec({ ...TRIG, xMin: 0, xMax: 6.28 }), 320);
    expect(ticks.map(tick => tick.text)).toEqual(["0", "π/2", "π", "3π/2", "2π"]);
    // La marca de 2π cae 0,003 fuera del rango: se dibuja en el borde
    expect(ticks[4].value).toBe(6.28);
  });

  it("cuando los rótulos no caben se escribe uno de cada tantos, contando desde el cero", () => {
    const ticks = planeXTicks(spec({ ...TRIG, xStep: 0.5236 }), 320);
    expect(ticks).toHaveLength(25);
    const written = ticks.filter(tick => tick.labeled).map(tick => tick.text);
    expect(written).toContain("0");
    expect(written).toContain("π");
    expect(written).toContain("-π");
    // Con marcas cada π/6 en 320 px quedan los múltiplos de π/2, que es lo que se espera leer
    expect(written).toEqual(["-2π", "-3π/2", "-π", "-π/2", "0", "π/2", "π", "3π/2", "2π"]);
    // Con marcas cada π/4, también
    expect(planeXTicks(spec({ ...TRIG, xStep: 0.7854 }), 320).filter(tick => tick.labeled).map(tick => tick.text)).toEqual(written);
    // En un plano de un solo período, las marcas cada π/6 se escriben todas
    const period = planeXTicks(spec({ ...TRIG, xMin: 0, xMax: 3.1416, xStep: 0.5236 }), 320);
    expect(period.filter(tick => tick.labeled).map(tick => tick.text)).toEqual(["0", "π/6", "π/3", "π/2", "2π/3", "5π/6", "π"]);
  });

  it("sin xUnit, el eje se rotula con números como siempre", () => {
    const ticks = planeXTicks(spec({ xStep: 1 }), 320);
    expect(ticks.map(tick => tick.text)).toEqual(["-5", "-4", "-3", "-2", "-1", "0", "1", "2", "3", "4", "5"]);
    expect(ticks.map(tick => tick.value)).toEqual(planeTicks(-5, 5, 1));
    expect(piStep(spec({ xStep: 1.5708 }))).toBeNull();
    // Con más de catorce marcas se escribe una de cada dos, como antes
    const many = planeXTicks(spec({ xMin: -10, xMax: 10 }), 320);
    expect(many.filter(tick => tick.labeled)).toHaveLength(11);
  });

  it("acepta seno y tangente con sus asíntotas", () => {
    expect(issuesOf({ ...TRIG, functions: [{ expr: "sin(x)", label: "y = \\sin x" }] })).toEqual([]);
    expect(
      issuesOf({
        ...TRIG,
        yMin: -4,
        yMax: 4,
        functions: [{ expr: "tan(x)" }],
        verticalLines: [-4.7124, -1.5708, 1.5708, 4.7124].map(x => ({ x, style: "dashed" })),
      }),
    ).toEqual([]);
  });

  it("rechaza un paso que no es una fracción sencilla de π y dice cuáles sirven", () => {
    const issues = issuesOf({ ...TRIG, xStep: 1 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("1.5708 (π/2)");
    expect(issues[0]).toContain("Ahora vale 1.");
    expect(issuesOf({ ...TRIG, xStep: 1.5 })).toHaveLength(1);
    expect(issuesOf({ ...TRIG, xStep: 0.7854 })).toEqual([]);
    expect(issuesOf({ ...TRIG, xStep: 3.1416 })).toEqual([]);
  });

  it("rechaza un rango donde no cabe ninguna marca de π", () => {
    const issues = issuesOf({ ...TRIG, xMin: -1, xMax: 1, xStep: 3.1416 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("no cabe ninguna marca");
  });
});

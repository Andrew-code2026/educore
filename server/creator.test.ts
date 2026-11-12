import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPE_LABELS,
  blockInputSchema,
  blockPreview,
  blockTexts,
  CLARIFY_LIMITS,
  composeCreatorRequest,
  countBlocks,
  emptyDoc,
  escapeCurrency,
  extractMath,
  findBlock,
  parseDoc,
  plainText,
  resourceDocSchema,
  sanitizeClarifyQuestions,
  type BlockInput,
  type ResourceDoc,
} from "@shared/creator";
import { boxTouchesPolygon, fractionLatex, isMultipleOfFraction, niceMax, niceStep, pieAngles, placeSideLabels, polygonArea, roundPercents, tickValues, wholesNeeded, wrapLabel } from "@shared/creatorFigures";
import { buildSampleDoc, SAMPLE_IDS, SAMPLES } from "@shared/creatorSample";
import { compileExpression, formatNumber, formatNumberEs, MathSyntaxError, nearlyEqual, parseExpression, sampleCurve, tryCompile } from "@shared/creatorMath";
import { applyDocOp } from "@shared/creatorOps";
import { checkLatex, computeValueTable, findBareSubscript, validateBlock, validateBlockOrder, validateGraphSpec, validateText, valueTableVariable } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);

/** Generador determinista: los ids de las pruebas no dependen del azar. */
const seeded = () => {
  let state = 7;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

describe("creatorMath", () => {
  const at = (expr: string, x: number) => compileExpression(expr)(x);

  it("respeta la precedencia de operadores", () => {
    expect(at("2 + 3 * 4", 0)).toBe(14);
    expect(at("(2 + 3) * 4", 0)).toBe(20);
    expect(at("2 ^ 3 ^ 2", 0)).toBe(512);
    expect(at("10 / 4", 0)).toBe(2.5);
  });

  it("trata -x^2 como -(x^2)", () => {
    expect(at("-x^2", 3)).toBe(-9);
    expect(at("(-x)^2", 3)).toBe(9);
    expect(at("2^-1", 0)).toBe(0.5);
  });

  it("admite multiplicación implícita", () => {
    expect(at("2x - 3", 1.5)).toBe(0);
    expect(at("x^2 - 4x + 3", 2)).toBe(-1);
    expect(at("3(x + 1)", 2)).toBe(9);
    expect(at("(x + 1)(x - 1)", 3)).toBe(8);
    expect(at("2x^2", 3)).toBe(18);
  });

  it("evalúa funciones y constantes", () => {
    expect(at("sqrt(x)", 16)).toBe(4);
    expect(at("abs(x - 5)", 2)).toBe(3);
    expect(at("2pi", 0)).toBeCloseTo(2 * Math.PI);
    expect(at("ln(e)", 0)).toBeCloseTo(1);
    expect(at("log(1000)", 0)).toBeCloseTo(3);
    expect(at("sin(pi/2)", 0)).toBeCloseTo(1);
  });

  it("acepta la forma y = ... y signos tipográficos", () => {
    expect(at("y = 2x − 3", 4)).toBe(5);
    expect(at("f(x) = x² − 1", 3)).toBe(8);
    expect(at("3·x ÷ 2", 4)).toBe(6);
  });

  it("rechaza lo que no es una expresión", () => {
    for (const bad of ["", "2 +", "(x", "x)", "foo(x)", "2 $ 3", "sin x", "1..2", "x".repeat(200)]) {
      expect(() => parseExpression(bad), bad).toThrow(MathSyntaxError);
    }
    expect(tryCompile("alert(1)").ok).toBe(false);
    expect(tryCompile("constructor").ok).toBe(false);
  });

  it("formatea sin ruido binario", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(3)).toBe("3");
    expect(formatNumber(-0.001)).toBe("0");
    expect(formatNumber(1 / 3)).toBe("0.33");
    expect(formatNumber(Number.NaN)).toBe("—");
    // Lo que lee el estudiante va como en Colombia: punto de miles y coma decimal
    expect(formatNumberEs(20000)).toBe("20.000");
    expect(formatNumberEs(1000)).toBe("1.000");
    expect(formatNumberEs(999)).toBe("999");
    expect(formatNumberEs(1.5)).toBe("1,5");
    expect(formatNumberEs(-4000)).toBe("-4.000");
    expect(formatNumberEs(1234567.891)).toBe("1.234.567,89");
    expect(formatNumberEs(0.1 + 0.2)).toBe("0,3");
    expect(formatNumberEs(0.125, 3)).toBe("0,125");
    expect(formatNumberEs(-0.001)).toBe("0");
    expect(formatNumberEs(Number.NaN)).toBe("—");
  });

  it("compara con tolerancia relativa", () => {
    expect(nearlyEqual(-0.46, -0.4671)).toBe(true);
    expect(nearlyEqual(3, 4)).toBe(false);
    expect(nearlyEqual(Number.NaN, 1)).toBe(false);
  });

  it("corta la curva en las asíntotas", () => {
    const segments = sampleCurve(compileExpression("1/x"), { xMin: -4, xMax: 4, yMin: -5, yMax: 5 });
    expect(segments.length).toBe(2);
    expect(segments[0].points.every(([x]) => x < 0)).toBe(true);
    expect(segments[1].points.every(([x]) => x > 0)).toBe(true);
  });

  it("no dibuja donde la función no existe", () => {
    const segments = sampleCurve(compileExpression("sqrt(x)"), { xMin: -4, xMax: 4, yMin: -1, yMax: 3 });
    expect(segments.length).toBe(1);
    expect(segments[0].points[0][0]).toBeGreaterThanOrEqual(0);
  });
});

describe("texto con fórmulas", () => {
  it("escapa los pesos y deja las fórmulas", () => {
    expect(escapeCurrency("un banderazo de $2.900 y $100 por cada unidad")).toBe("un banderazo de \\$2.900 y \\$100 por cada unidad");
    expect(escapeCurrency("Cuesta $5.400.")).toBe("Cuesta \\$5.400.");
    expect(escapeCurrency("la función $y = 2x - 3$ corta en $x = 1.5$")).toBe("la función $y = 2x - 3$ corta en $x = 1.5$");
    expect(escapeCurrency("paga $2.900 y la función es $C(x) = 2900 + 100x$")).toBe("paga \\$2.900 y la función es $C(x) = 2900 + 100x$");
  });

  it("conserva fórmulas que empiezan por un número", () => {
    expect(escapeCurrency("resuelve $2x + 3 = 7$ y $100$ es el total")).toBe("resuelve $2x + 3 = 7$ y $100$ es el total");
    expect(escapeCurrency("$$2900 + 100x$$")).toBe("$$2900 + 100x$$");
  });

  it("no escapa dos veces", () => {
    const once = escapeCurrency("vale $3.000 hoy");
    expect(escapeCurrency(once)).toBe(once);
  });

  it("extrae las fórmulas en línea y en bloque", () => {
    expect(extractMath("sea $a = 1$ y $$x = \\frac{-b}{2a}$$ con \\$5")).toEqual(["a = 1", "x = \\frac{-b}{2a}"]);
    expect(extractMath("sin fórmulas")).toEqual([]);
  });

  it("resume a texto plano", () => {
    expect(plainText("**Ejercicio** con $y = 2x$ y \\$100")).toBe("Ejercicio con y = 2x y $100");
    expect(plainText("a".repeat(200), 10)).toHaveLength(10);
  });
});

describe("validación de bloques", () => {
  it("acepta LaTeX válido y explica el inválido", () => {
    expect(checkLatex("x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}")).toBeNull();
    expect(checkLatex("\\frac{1}{")).toBeTruthy();
    expect(validateText("la raíz $\\frac{1}{$ falla", "Texto")).toHaveLength(1);
  });

  it("detecta subíndices escritos sin guion bajo", () => {
    expect(findBareSubscript("(x1, y1)")).toBe("x1");
    expect(findBareSubscript("m = \\frac{y2 - y1}{x2 - x1}")).toBe("y2");
    expect(findBareSubscript("a10 + 3")).toBe("a10");
    for (const fine of ["(x_1, y_1)", "y = 2x - 1", "C(d) = 4500 + 1800d", "x^2 - 4x + 3", "\\log 2", "\\sqrt2", "\\text{paso 1}", "3 \\times 2", "m = \\frac{10 - 4}{3 - 1}", "\\text{CO}_2", "x_{12}"]) {
      expect(findBareSubscript(fine), fine).toBeNull();
    }
    const issues = validateText("Si conoces dos puntos $(x1, y1)$ y $(x_2, y_2)$", "Texto");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("x_1");
    expect(validateBlock(block({ type: "math", latex: "m = \\frac{y2 - y1}{x2 - x1}" }))).toHaveLength(1);
  });

  it("avisa cuando el espacio de respuesta queda antes de la figura", () => {
    const graph = { type: "graph", spec: { xMin: -2, xMax: 4, yMin: -4, yMax: 8, functions: [{ expr: "-2*x + 4" }], points: [] } };
    const exercise = (extra: Record<string, unknown> = {}) => ({ type: "exercise", label: "Ejercicio 4", md: "La gráfica muestra la recta.", ...extra });
    const order = (blocks: unknown[]) => validateBlockOrder([{ title: "Guía", blocks: blocks.map(block) }]);
    expect(order([exercise(), graph])).toHaveLength(1);
    expect(order([exercise(), graph])[0]).toContain("Ejercicio 4");
    expect(order([exercise({ answerSpace: "none" }), graph])).toEqual([]);
    expect(order([graph, exercise()])).toEqual([]);
    expect(order([exercise(), { type: "paragraph", md: "Observa la gráfica." }, graph])).toEqual([]);
    expect(order([exercise(), { type: "balance", left: { variables: 3, units: 2 }, right: { variables: 0, units: 11 } }])).toHaveLength(1);
  });

  it("no pide un párrafo de relleno cuando la figura es del ejercicio siguiente", () => {
    const graph = { type: "graph", spec: { xMin: -2, xMax: 4, yMin: -4, yMax: 8, functions: [{ expr: "-2*x + 4" }], points: [] } };
    const shape = { type: "shapes", figures: [{ kind: "rectangle", width: 6, height: 4, widthLabel: "6 m", heightLabel: "4 m" }] };
    const exercise = (label: string, md: string, extra: Record<string, unknown> = {}) => ({ type: "exercise", label, md, ...extra });
    const order = (blocks: unknown[]) => validateBlockOrder([{ title: "Taller", blocks: blocks.map(block) }]);

    // El taller real de 8°: cada figura va delante de su ejercicio, sin nada entre el ejercicio 1 y la figura del 2
    expect(
      order([
        { type: "heading", text: "Parte 1" },
        shape,
        exercise("Ejercicio 1", "Calcula el área de la figura en forma de T."),
        shape,
        exercise("Ejercicio 2", "La figura de arriba es un rectángulo con un triángulo encima. Calcula su área."),
      ]),
    ).toEqual([]);
    // Un ejercicio que no habla de ninguna figura, seguido de la figura del siguiente
    expect(order([exercise("Ejercicio 3", "Resuelve $2x + 3 = 11$."), graph, exercise("Ejercicio 4", "Según la gráfica, ¿dónde corta la recta al eje $y$?")])).toEqual([]);

    // El defecto original sigue detectado: el enunciado habla de una gráfica que queda bajo sus renglones
    const original = order([exercise("Ejercicio 4", "La gráfica muestra la recta. Halla su pendiente."), graph, exercise("Ejercicio 5", "Resuelve $3x = 12$.")]);
    expect(original).toHaveLength(1);
    expect(original[0]).toContain("Ejercicio 4");
    // …también cuando la mención está en un inciso
    expect(order([exercise("Ejercicio 4", "Responde.", { parts: [{ label: "a", md: "¿Qué pendiente tiene la recta del plano?" }] }), graph, exercise("Ejercicio 5", "Resuelve.")])).toHaveLength(1);
    // …y cuando la figura de delante no es suya, porque el ejercicio anterior se resuelve sobre ella
    expect(
      order([
        exercise("Ejercicio 1", "Sombrea la mitad de la figura.", { answerSpace: "none" }),
        shape,
        exercise("Ejercicio 2", "Observa el dibujo y calcula su perímetro."),
        shape,
        exercise("Ejercicio 3", "Resuelve."),
      ]),
    ).toHaveLength(1);
    // Una figura que no tiene ejercicio después solo puede ser del anterior
    expect(order([exercise("Ejercicio 6", "Resuelve $x + 1 = 2$."), graph])).toHaveLength(1);
    expect(order([exercise("Ejercicio 6", "Resuelve $x + 1 = 2$."), graph, { type: "heading", text: "Parte 2" }, exercise("Ejercicio 7", "Resuelve.")])).toHaveLength(1);
  });

  it("detecta LaTeX fuera de una fórmula", () => {
    expect(validateText("la pendiente es \\frac{1}{2}", "Texto")).toHaveLength(1);
    expect(validateText("la pendiente es $\\frac{1}{2}$ y cuesta \\$500", "Texto")).toEqual([]);
  });

  const graph = (points: unknown[]) =>
    block({
      type: "graph",
      spec: { xMin: -2, xMax: 4, yMin: -7, yMax: 5, functions: [{ expr: "2*x - 3", label: "y = 2x - 3" }], points },
    });

  it("acepta puntos que están sobre la curva", () => {
    expect(validateBlock(graph([{ x: 0, y: -3, label: "(0, -3)", on: 0 }, { x: 1.5, y: 0, on: 0 }]))).toEqual([]);
  });

  it("rechaza un punto mal calculado y dice el valor correcto", () => {
    const issues = validateBlock(graph([{ x: 1, y: 0, on: 0 }]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("-1");
  });

  it("deja pasar los puntos libres pero no los que salen del plano", () => {
    expect(validateBlock(graph([{ x: 1, y: 3, on: null }]))).toEqual([]);
    expect(validateBlock(graph([{ x: 9, y: 0, on: null }]))).toHaveLength(1);
  });

  it("revisa rangos, expresiones y visibilidad", () => {
    const base = { xStep: 1, yStep: 1, points: [] };
    expect(validateGraphSpec({ ...base, xMin: 4, xMax: -2, yMin: 0, yMax: 5, functions: [] })).toHaveLength(1);
    expect(validateGraphSpec({ ...base, xMin: 0, xMax: 5, yMin: 0, yMax: 5, functions: [{ expr: "2 +" }] })).toHaveLength(1);
    expect(validateGraphSpec({ ...base, xMin: 0, xMax: 5, yMin: 0, yMax: 5, functions: [{ expr: "x + 100" }] })).toHaveLength(1);
    expect(validateGraphSpec({ ...base, xMin: 0, xMax: 500, yMin: 0, yMax: 5, functions: [] })).toHaveLength(1);
    expect(validateGraphSpec({ ...base, xMin: -5, xMax: 5, yMin: -5, yMax: 5, functions: [] })).toEqual([]);
  });

  it("calcula la tabla de valores en vez de confiar en el modelo", () => {
    expect(computeValueTable("x^2 - 4x + 3", [-1, 0, 1, 2, 3])).toEqual([8, 3, 0, -1, 0]);
    expect(computeValueTable("1/x", [0, 2])).toEqual([null, 0.5]);
    const table = block({ type: "value_table", expr: "1/x", exprLatex: "y = \\frac{1}{x}", xs: [0, 1] });
    expect(validateBlock(table)).toHaveLength(1);
  });

  it("rotula la tabla de valores con la variable de la función", () => {
    // Sin declararla se lee del encabezado; así se corrigen también los recursos ya guardados
    expect(valueTableVariable({ exprLatex: "A(s) = 4000s + 20000" })).toBe("s");
    expect(valueTableVariable({ exprLatex: "V\\left(t\\right) = 400 - 25t" })).toBe("t");
    expect(valueTableVariable({ exprLatex: "C_{total}(n) = 2500n + 60000" })).toBe("n");
    expect(valueTableVariable({ exprLatex: "y = 2x + 1" })).toBe("x");
    expect(valueTableVariable({ exprLatex: "y = 2(x + 1)" })).toBe("x");
    expect(valueTableVariable({ exprLatex: "d = 80t", variable: "t" })).toBe("t");

    // La función se puede escribir con la variable de la tabla o con x
    expect(computeValueTable("4000*s + 20000", [0, 1, 2], "s")).toEqual([20000, 24000, 28000]);
    expect(computeValueTable("4000*x + 20000", [0, 1, 2], "s")).toEqual([20000, 24000, 28000]);
    expect(computeValueTable("400 - 25t", [0, 4], "t")).toEqual([400, 300]);

    const table = (extra: Record<string, unknown>) => block({ type: "value_table", exprLatex: "A(s) = 4000s + 20000", xs: [0, 1, 2], ...extra });
    expect(validateBlock(table({ expr: "4000*x + 20000" }))).toEqual([]);
    expect(validateBlock(table({ expr: "4000*s + 20000", variable: "s" }))).toEqual([]);
    expect(validateBlock(table({ expr: "4000*k + 20000", variable: "s" }))).toHaveLength(1);
    // La fila diría «x» y el encabezado «A(s)»
    const mismatch = validateBlock(table({ expr: "4000*x + 20000", variable: "x" }));
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0]).toContain("no coincide");
    expect(validateBlock(block({ type: "value_table", expr: "1/s", exprLatex: "f(s) = \\frac{1}{s}", xs: [0, 1] }))[0]).toContain("s = 0");
    expect(blockInputSchema.safeParse({ type: "value_table", expr: "x", exprLatex: "y = x", xs: [0, 1], variable: "st" }).success).toBe(false);
  });

  it("exige filas del ancho del encabezado", () => {
    const table = block({ type: "table", header: ["x", "y"], rows: [["1", "2"], ["3"]] });
    expect(validateBlock(table)).toHaveLength(1);
  });

  it("revisa los incisos y los pasos", () => {
    const exercise = block({ type: "exercise", label: "Ejercicio 1", md: "Calcula", parts: [{ label: "a", md: "$\\frac{$" }] });
    expect(validateBlock(exercise)).toHaveLength(1);
    const solution = block({ type: "solution", label: "Ejercicio 1", steps: ["$x = 3$"], answer: "$y = -4$" });
    expect(validateBlock(solution)).toEqual([]);
  });
});

describe("figuras: cálculos", () => {
  it("reparte los porcentajes para que sumen 100", () => {
    expect(roundPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundPercents([18, 12, 6, 4])).toEqual([45, 30, 15, 10]);
    expect(roundPercents([1, 1, 1, 1, 1, 1]).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(roundPercents([0, 0])).toEqual([0, 0]);
  });

  it("elige pasos redondos para los ejes", () => {
    expect(niceStep(18)).toBe(5);
    expect(niceStep(100)).toBe(20);
    expect(niceStep(0.9)).toBe(0.2);
    expect(niceStep(0)).toBe(1);
    expect(niceMax(18, 5)).toBe(20);
    expect(niceMax(20, 5)).toBe(20);
  });

  it("cuenta las marcas sin acumular error", () => {
    expect(tickValues(0, 1, 0.1)).toHaveLength(11);
    expect(tickValues(0, 1, 0.1)[3]).toBe(0.3);
    expect(tickValues(-2, 2, 0.5)).toEqual([-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]);
    expect(tickValues(0, 1, 0)).toEqual([]);
  });

  it("escribe las marcas como fracciones", () => {
    expect(fractionLatex(0.75, 4)).toBe("\\frac{3}{4}");
    expect(fractionLatex(1.5, 2)).toBe("\\frac{3}{2}");
    expect(fractionLatex(-0.5, 2)).toBe("-\\frac{1}{2}");
    expect(fractionLatex(1, 4)).toBe("1");
    expect(fractionLatex(0, 8)).toBe("0");
    expect(isMultipleOfFraction(0.125, 8)).toBe(true);
    expect(isMultipleOfFraction(0.1, 8)).toBe(false);
  });

  it("parte los rótulos largos en dos líneas", () => {
    expect(wrapLabel("Mango", 10)).toEqual(["Mango"]);
    expect(wrapLabel("Jugo de maracuyá", 10)).toEqual(["Jugo de", "maracuyá"]);
    expect(wrapLabel("Uno dos tres cuatro cinco seis siete", 8)).toHaveLength(2);
  });

  it("mide enteros, áreas y sectores", () => {
    expect(wholesNeeded(5, 4)).toBe(2);
    expect(wholesNeeded(4, 4)).toBe(1);
    expect(wholesNeeded(0, 4)).toBe(1);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }])).toBe(12);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(0);
    expect(pieAngles([1, 1, 2])).toEqual([{ start: 0, end: 90 }, { start: 90, end: 180 }, { start: 180, end: 360 }]);
  });
});

describe("figuras: rótulos de los lados de un polígono", () => {
  type Vertex = [number, number];
  /** Igual que el dibujo: el lado mayor mide 150 px y la y crece hacia abajo. */
  const toScreen = (vertices: Vertex[]) => {
    const xs = vertices.map(([x]) => x);
    const ys = vertices.map(([, y]) => y);
    const scale = 150 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return vertices.map(([x, y]) => ({ x: (x - Math.min(...xs)) * scale, y: (Math.max(...ys) - y) * scale }));
  };
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const expectClean = (points: Array<{ x: number; y: number }>, labels: string[]) => {
    const placed = placeSideLabels(points, labels);
    expect(placed.map(item => item.side)).toEqual(labels.flatMap((text, side) => (text ? [side] : [])));
    for (const item of placed) expect(boxTouchesPolygon(item.box, points), `el rótulo del lado ${item.side} pisa la figura`).toBe(false);
    placed.forEach((a, i) => placed.slice(i + 1).forEach(b => expect(overlap(a.box, b.box), `se enciman los rótulos de los lados ${a.side} y ${b.side}`).toBe(false)));
    return placed;
  };

  const L: Vertex[] = [[0, 0], [8, 0], [8, 3], [5, 3], [5, 6], [0, 6]];
  const L_LABELS = ["8 m", "3 m", "3 m", "3 m", "5 m", "6 m"];
  const T: Vertex[] = [[4, 0], [8, 0], [8, 6], [12, 6], [12, 9], [0, 9], [0, 6], [4, 6]];
  const T_LABELS = ["4 m", "6 m", "4 m", "3 m", "12 m", "3 m", "4 m", "6 m"];

  it("en una L no encima los dos rótulos de la muesca", () => {
    const points = toScreen(L);
    const placed = expectClean(points, L_LABELS);
    // Los dos lados de la muesca rotulan hacia ella: arriba del brazo y a la derecha del cuerpo
    expect(placed[2].anchor).toBe("bottom");
    expect(placed[2].box.y + placed[2].box.h).toBeLessThan(points[2].y);
    expect(placed[3].anchor).toBe("left");
    expect(placed[3].box.x).toBeGreaterThan(points[3].x);
  });

  it("en una muesca estrecha reubica los dos rótulos a la vez", () => {
    // Salió en un taller generado: muesca de 4 m × 3 m, donde mover un solo rótulo no alcanza
    expectClean(toScreen([[0, 0], [10, 0], [10, 4], [6, 4], [6, 7], [0, 7]]), ["10 m", "4 m", "4 m", "3 m", "6 m", "7 m"]);
    expectClean(toScreen([[0, 0], [7, 0], [7, 4], [3, 4], [3, 1], [0, 1]]), ["7 m", "4 m", "4 m", "3 m", "3 m", "1 m"]);
    expectClean(toScreen([[0, 0], [12, 0], [12, 2], [10, 2], [10, 8], [0, 8]]), ["12 m", "2 m", "2 m", "6 m", "10 m", "8 m"]);
  });

  it("en una T pone por fuera los rótulos de debajo de los brazos", () => {
    const points = toScreen(T);
    const placed = expectClean(points, T_LABELS);
    const armY = points[2].y;
    for (const side of [2, 6]) {
      expect(placed[side].anchor).toBe("top");
      expect(placed[side].box.y).toBeGreaterThan(armY);
    }
    // Los lados del tronco, hacia fuera del tronco
    expect(placed[1].box.x).toBeGreaterThan(points[1].x);
    expect(placed[7].box.x + placed[7].box.w).toBeLessThan(points[0].x);
  });

  it("da lo mismo recorrer los vértices en un sentido o en el otro", () => {
    for (const [vertices, labels] of [[L, L_LABELS], [T, T_LABELS]] as const) {
      // Al invertir el recorrido, el lado i pasa a ser el lado n - 2 - i
      const reversed = [...vertices].reverse();
      const count = vertices.length;
      const reversedLabels = reversed.map((_, side) => labels[(2 * count - 2 - side) % count]);
      expectClean(toScreen(reversed), reversedLabels);
    }
  });

  it("omite los lados sin rótulo y sirve para lados inclinados", () => {
    const house: Vertex[] = [[0, 0], [6, 0], [6, 4], [3, 7], [0, 4]];
    const placed = expectClean(toScreen(house), ["6 m", "4 m", "", "", "4 m"]);
    expect(placed).toHaveLength(3);
    expectClean(toScreen([[0, 0], [6, 0], [2, 5]]), ["6 cm", "$\\sqrt{41}$ cm", "5,4 cm"]);
  });
});

describe("figuras: validación", () => {
  it("revisa la recta numérica", () => {
    const line = (extra: Record<string, unknown>) => validateBlock(block({ type: "number_line", min: 0, max: 2, step: 0.25, ...extra }));
    expect(line({ fractionDenominator: 4, points: [{ value: 0.75, label: "\\frac{3}{4}" }], jumps: [{ from: 0, to: 0.75, label: "+\\frac{3}{4}" }] })).toEqual([]);
    expect(line({ points: [{ value: 3 }] })).toHaveLength(1);
    expect(line({ fractionDenominator: 3 })).toHaveLength(1);
    expect(line({ jumps: [{ from: 1, to: 1 }] })).toHaveLength(1);
    expect(line({ points: [{ value: 1, label: "\\frac{1}{" }] })).toHaveLength(1);
    expect(validateBlock(block({ type: "number_line", min: 5, max: 1, step: 1 }))).toHaveLength(1);
    expect(validateBlock(block({ type: "number_line", min: 0, max: 100, step: 0.5 })).length).toBeGreaterThan(0);
  });

  it("revisa los modelos de fracción", () => {
    const model = (extra: Record<string, unknown>) => validateBlock(block({ type: "fraction_model", models: [{ numerator: 3, denominator: 4 }], ...extra }));
    expect(model({})).toEqual([]);
    expect(model({ operator: "equals" })).toHaveLength(1);
    expect(model({ operator: "equals", models: [{ numerator: 3, denominator: 4 }, { numerator: 6, denominator: 8 }] })).toEqual([]);
    expect(model({ models: [{ numerator: 9, denominator: 2 }] })).toHaveLength(1);
  });

  it("revisa los diagramas de barras", () => {
    const bars = [{ label: "Mango", value: 18 }, { label: "Lulo", value: 12 }];
    const empty = [{ label: "Mango", value: 0 }, { label: "Lulo", value: 0 }];
    expect(validateBlock(block({ type: "bar_chart", bars }))).toEqual([]);
    expect(validateBlock(block({ type: "bar_chart", bars, yMax: 10 }))).toHaveLength(1);
    expect(validateBlock(block({ type: "bar_chart", bars, yStep: 0.5 }))).toHaveLength(1);
    expect(validateBlock(block({ type: "bar_chart", bars: empty }))).toHaveLength(1);
    expect(validateBlock(block({ type: "bar_chart", bars: empty, blank: true, yMax: 20 }))).toEqual([]);
  });

  it("no acepta sectores vacíos ni platillos vacíos", () => {
    expect(blockInputSchema.safeParse({ type: "pie_chart", slices: [{ label: "A", value: 0 }, { label: "B", value: 3 }] }).success).toBe(false);
    expect(validateBlock(block({ type: "pie_chart", slices: [{ label: "A", value: 2 }, { label: "B", value: 3 }] }))).toEqual([]);
    expect(validateBlock(block({ type: "balance", left: { variables: 2, units: 3 }, right: { variables: 0, units: 11 } }))).toEqual([]);
    expect(validateBlock(block({ type: "balance", left: { variables: 0, units: 0 }, right: { variables: 0, units: 4 } }))).toHaveLength(1);
  });

  it("revisa las figuras geométricas", () => {
    expect(validateBlock(block({ type: "shapes", figures: [{ kind: "rectangle", width: 6, height: 4, widthLabel: "6 m", heightLabel: "4 m" }] }))).toEqual([]);
    expect(validateBlock(block({ type: "shapes", figures: [{ kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }] }))).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "shapes", figures: [{ kind: "hexagono" }] }).success).toBe(false);
  });

  it("nombra y resume todos los tipos de bloque", () => {
    for (const type of ["number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance"] as const) {
      expect(BLOCK_TYPE_LABELS[type].length).toBeGreaterThan(3);
    }
    const chart = block({ type: "bar_chart", title: "Ventas de la semana", bars: [{ label: "Mango", value: 18 }, { label: "Lulo", value: 12 }] });
    expect(blockPreview(chart).length).toBeGreaterThan(0);
  });
});

describe("preguntas aclaratorias", () => {
  it("limpia lo que devuelve el modelo", () => {
    const questions = sanitizeClarifyQuestions([
      { question: "  ¿Qué  nivel de dificultad? ", options: ["Básico", "Básico", " Intermedio ", ""] },
      { question: "¿qué nivel de dificultad?", options: ["A", "B"] },
      { question: "¿Con contexto?", options: ["Sí"] },
      { question: "", options: ["A", "B"] },
      "basura",
      { question: "¿Cuántos ejercicios?", options: ["Seis", "Diez", "Doce", "Quince", "Veinte"] },
    ]);
    expect(questions).toEqual([
      { id: "q1", question: "¿Qué nivel de dificultad?", options: ["Básico", "Intermedio"] },
      { id: "q2", question: "¿Cuántos ejercicios?", options: ["Seis", "Diez", "Doce", "Quince"] },
    ]);
    expect(sanitizeClarifyQuestions(null)).toEqual([]);
    expect(sanitizeClarifyQuestions({ questions: [] })).toEqual([]);
  });

  it("no pasa del máximo de preguntas", () => {
    const many = Array.from({ length: 6 }, (_, index) => ({ question: `¿Pregunta ${index}?`, options: ["A", "B"] }));
    expect(sanitizeClarifyQuestions(many)).toHaveLength(CLARIFY_LIMITS.questionsMax);
  });

  it("añade las respuestas a la solicitud", () => {
    expect(composeCreatorRequest("  Guía de fracciones ", [])).toBe("Guía de fracciones");
    const request = composeCreatorRequest("Guía de fracciones", [
      { question: "¿Nivel?", answer: "Básico" },
      { question: "¿Contexto?", answer: " " },
    ]);
    expect(request).toBe("Guía de fracciones\n\nAclaraciones del docente:\n- ¿Nivel? → Básico");
  });
});

describe("recursos de ejemplo", () => {
  it.each(SAMPLE_IDS)("%s pasa todas las validaciones: es la referencia de calidad", id => {
    for (const section of SAMPLES[id].sections) {
      for (const sample of section.blocks) expect(validateBlock(sample), JSON.stringify(sample).slice(0, 80)).toEqual([]);
    }
  });

  it.each(SAMPLE_IDS)("%s no deja renglones entre un enunciado y su figura", id => {
    expect(validateBlockOrder(buildSampleDoc(id, seeded()).sections)).toEqual([]);
  });

  it.each(SAMPLE_IDS)("%s se construye como documento válido con clave de respuestas", id => {
    const doc = buildSampleDoc(id, seeded());
    expect(resourceDocSchema.safeParse(doc).success).toBe(true);
    expect(doc.title).toBe(SAMPLES[id].title);
    expect(doc.sections.map(section => section.role)).toEqual(["student", "answer_key"]);
    expect(countBlocks(doc)).toBeGreaterThan(20);
  });

  it.each(SAMPLE_IDS)("%s no deja signos de pesos sin escapar", id => {
    const doc = buildSampleDoc(id, seeded());
    const texts = doc.sections.flatMap(section => section.blocks.flatMap(blockTexts));
    for (const text of texts) expect(escapeCurrency(text)).toBe(text);
  });

  it("el ejemplo de primaria usa todas las figuras nuevas", () => {
    const types = new Set(buildSampleDoc("primaria", seeded()).sections.flatMap(section => section.blocks.map(item => item.type)));
    for (const type of ["number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance"]) expect(types.has(type as BlockInput["type"]), type).toBe(true);
  });
});

describe("operaciones sobre el documento", () => {
  const write = (doc: ResourceDoc, title: string, blocks: unknown[], sectionId?: string) =>
    applyDocOp(doc, { op: "write_section", sectionId, title, role: "student", blocks: blocks.map(block) }, seeded());

  const base = (): ResourceDoc => {
    const result = write(emptyDoc("Funciones"), "Guía", [
      { type: "paragraph", md: "Primero" },
      { type: "paragraph", md: "Segundo" },
      { type: "math", latex: "y = mx + b" },
    ]);
    if (!result.ok) throw new Error(result.error);
    return result.doc;
  };

  it("crea secciones con ids únicos", () => {
    const doc = base();
    expect(doc.sections).toHaveLength(1);
    const ids = [doc.sections[0].id, ...doc.sections[0].blocks.map(b => b.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.sections[0].id.startsWith("s")).toBe(true);
  });

  it("reescribe una sección existente sin duplicarla", () => {
    const doc = base();
    const result = write(doc, "Guía corregida", [{ type: "paragraph", md: "Nuevo" }], doc.sections[0].id);
    expect(result.ok && result.doc.sections).toHaveLength(1);
    expect(result.ok && result.doc.sections[0].title).toBe("Guía corregida");
    expect(result.ok && result.doc.sections[0].id).toBe(doc.sections[0].id);
  });

  it("explica cuando la sección no existe", () => {
    const result = write(base(), "X", [], "sxxxxxx");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("Secciones:");
  });

  it("inserta al inicio, al final y después de un bloque", () => {
    const doc = base();
    const [first, second] = doc.sections[0].blocks;
    const extra = [block({ type: "paragraph", md: "Extra" })];
    const sectionId = doc.sections[0].id;
    const order = (result: ReturnType<typeof applyDocOp>) => (result.ok ? result.doc.sections[0].blocks.map(b => (b.type === "paragraph" ? b.md : b.type)) : []);

    expect(order(applyDocOp(doc, { op: "insert_blocks", sectionId, at: "start", blocks: extra }))).toEqual(["Extra", "Primero", "Segundo", "math"]);
    expect(order(applyDocOp(doc, { op: "insert_blocks", sectionId, blocks: extra }))).toEqual(["Primero", "Segundo", "math", "Extra"]);
    expect(order(applyDocOp(doc, { op: "insert_blocks", sectionId, afterBlockId: first.id, blocks: extra }))).toEqual(["Primero", "Extra", "Segundo", "math"]);
    expect(applyDocOp(doc, { op: "insert_blocks", sectionId, afterBlockId: "bzzzzzz", blocks: extra }).ok).toBe(false);
    expect(second.id).not.toBe(first.id);
  });

  it("actualiza un bloque conservando su id y avisa si no cambió nada", () => {
    const doc = base();
    const target = doc.sections[0].blocks[0];
    const changed = applyDocOp(doc, { op: "update_block", blockId: target.id, block: block({ type: "paragraph", md: "Editado" }) });
    expect(changed.ok && changed.changed).toBe(true);
    expect(changed.ok && findBlock(changed.doc, target.id)?.block).toMatchObject({ id: target.id, md: "Editado" });

    const same = applyDocOp(doc, { op: "update_block", blockId: target.id, block: block({ type: "paragraph", md: "Primero" }) });
    expect(same.ok && same.changed).toBe(false);
    expect(same.ok && same.summary).toContain("Sin cambios");
  });

  it("escapa los pesos al guardar", () => {
    const doc = base();
    const target = doc.sections[0].blocks[0];
    const result = applyDocOp(doc, { op: "update_block", blockId: target.id, block: block({ type: "paragraph", md: "Cuesta $2.900 hoy" }) });
    expect(result.ok && findBlock(result.doc, target.id)?.block).toMatchObject({ md: "Cuesta \\$2.900 hoy" });
  });

  it("elimina bloques y rechaza ids desconocidos sin tocar el documento", () => {
    const doc = base();
    const [first] = doc.sections[0].blocks;
    const removed = applyDocOp(doc, { op: "delete_blocks", blockIds: [first.id] });
    expect(removed.ok && removed.doc.sections[0].blocks).toHaveLength(2);
    expect(applyDocOp(doc, { op: "delete_blocks", blockIds: [first.id, "bnope12"] }).ok).toBe(false);
    expect(doc.sections[0].blocks).toHaveLength(3);
  });

  it("mueve bloques y se detiene en los bordes", () => {
    const doc = base();
    const [first] = doc.sections[0].blocks;
    const down = applyDocOp(doc, { op: "move_block", blockId: first.id, direction: "down" });
    expect(down.ok && down.doc.sections[0].blocks[1].id).toBe(first.id);
    const up = applyDocOp(doc, { op: "move_block", blockId: first.id, direction: "up" });
    expect(up.ok && up.changed).toBe(false);
  });

  it("cambia el título y borra secciones", () => {
    const doc = base();
    const meta = applyDocOp(doc, { op: "set_meta", title: "Nuevo título", subtitle: "Grado 9" });
    expect(meta.ok && meta.doc).toMatchObject({ title: "Nuevo título", subtitle: "Grado 9" });
    const removed = applyDocOp(doc, { op: "delete_section", sectionId: doc.sections[0].id });
    expect(removed.ok && removed.doc.sections).toHaveLength(0);
  });

  it("recupera un documento vacío si lo guardado está dañado", () => {
    expect(parseDoc("{no es json")).toEqual(emptyDoc());
    expect(parseDoc({ title: 3 })).toEqual(emptyDoc());
    const doc = base();
    expect(parseDoc(JSON.stringify(doc))).toEqual(doc);
  });
});

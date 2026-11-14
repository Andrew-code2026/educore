import { describe, expect, it } from "vitest";
import { blockInputSchema, FIGURE_TYPES, findBlock, type Block, type BlockInput, type ResourceDoc } from "@shared/creator";
import { cellWidths, SHEET_WIDTH_PX } from "@shared/creatorContainers";
import {
  currentSizeChoice,
  FIGURE_SCALE_MAX,
  FIGURE_SCALE_MIN,
  figureSizeAllowed,
  figureSizeChoices,
  figureWidth,
  pxToCm,
  SCREEN_SHEET_WIDTH_PX,
  storedFigureSize,
} from "@shared/creatorFigureSize";
import { applyDocOp, keepFigureLayout, normalizeBlock } from "@shared/creatorOps";
import { validateBlock } from "@shared/creatorValidate";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const bars = (extra: Partial<Extract<BlockInput, { type: "bar_chart" }>> = {}): BlockInput => ({
  type: "bar_chart",
  bars: [
    { label: "A", value: 3 },
    { label: "B", value: 5 },
  ],
  showValues: true,
  blank: false,
  ...extra,
});

const clock = (extra: Partial<Extract<BlockInput, { type: "clock" }>> = {}): BlockInput => ({ type: "clock", clocks: [{ hour: 7, minute: 30 }], showHands: true, showTime: false, ...extra });
const plane = (extra: Partial<Extract<BlockInput, { type: "graph" }>> = {}): BlockInput => ({
  type: "graph",
  spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [], points: [] },
  ...extra,
});

describe("campo de tamaño", () => {
  it("lo tienen las figuras y el plano, no las tablas ni el texto", () => {
    expect(FIGURE_TYPES.has("graph")).toBe(true);
    expect(FIGURE_TYPES.has("bar_chart")).toBe(true);
    expect(FIGURE_TYPES.has("clock")).toBe(true);
    expect(FIGURE_TYPES.has("table")).toBe(false);
    expect(FIGURE_TYPES.has("value_table")).toBe(false);
    expect(FIGURE_TYPES.has("paragraph")).toBe(false);
    expect(FIGURE_TYPES.size).toBe(21);
  });

  it("es opcional: un bloque guardado antes se lee igual, y uno con tamaño lo conserva", () => {
    const old = blockInputSchema.parse(bars());
    expect("size" in old).toBe(false);
    expect(blockInputSchema.parse(bars({ size: "large" }))).toMatchObject({ size: "large" });
    expect(blockInputSchema.safeParse({ ...bars(), size: "huge" }).success).toBe(false);
    // Una tabla no tiene tamaño: zod lo descarta
    expect("size" in blockInputSchema.parse({ type: "table", header: ["a"], rows: [["1"]], size: "large" })).toBe(false);
  });

  it("el mediano no se guarda: es lo mismo que sin tamaño", () => {
    expect("size" in normalizeBlock(bars({ size: "medium" }))).toBe(false);
    expect(normalizeBlock(bars({ size: "small" }))).toMatchObject({ size: "small" });
    expect(storedFigureSize("medium")).toBeUndefined();
    expect(storedFigureSize("full")).toBe("full");
    // También dentro de un contenedor
    const columns = normalizeBlock({ type: "columns", columns: [{ width: 1, blocks: [bars({ size: "medium" })] as never }, { width: 1, blocks: [] }] });
    expect("size" in (columns as { columns: Array<{ blocks: object[] }> }).columns[0].blocks[0]).toBe(false);
  });

  it("el plano no admite el pequeño; las demás figuras sí", () => {
    expect(figureSizeAllowed("graph", "small")).toBe(false);
    expect(figureSizeAllowed("graph", "full")).toBe(true);
    expect(figureSizeAllowed("bar_chart", "small")).toBe(true);
    expect(validateBlock(plane({ size: "small" })).join(" ")).toMatch(/no va en tamaño small/);
    expect(validateBlock(plane({ size: "large" }))).toEqual([]);
    expect(validateBlock(bars({ size: "small" }))).toEqual([]);
  });
});

describe("ancho de una figura según su tamaño", () => {
  it("sin tamaño mide su diseño en pantalla, y en papel lo de siempre (0,86 las figuras y 0,8 el plano)", () => {
    expect(figureWidth(undefined, 520, SCREEN_SHEET_WIDTH_PX)).toBe(520);
    expect(figureWidth(undefined, 520, SHEET_WIDTH_PX, "figure")).toBeCloseTo(447.2);
    expect(figureWidth(undefined, 374, SHEET_WIDTH_PX, "plane")).toBeCloseTo(299.2);
  });

  it("pequeño, grande y completo escalan el diseño sin salirse del ancho disponible", () => {
    expect(figureWidth("small", 520, 712)).toBe(520 * FIGURE_SCALE_MIN);
    expect(figureWidth("large", 400, 712)).toBe(520);
    expect(figureWidth("large", 560, 712)).toBe(712);
    expect(figureWidth("full", 520, 712)).toBe(712);
  });

  it("nunca pasa del doble del diseño, ni con el ancho completo", () => {
    expect(figureWidth("full", 160, 712)).toBe(160 * FIGURE_SCALE_MAX);
  });

  it("en papel el pequeño no se reduce más: ya está en el mínimo legible", () => {
    expect(figureWidth("small", 520, SHEET_WIDTH_PX, "figure")).toBe(390);
    expect(figureWidth("large", 520, SHEET_WIDTH_PX, "figure")).toBeCloseTo(520 * 1.3 * 0.86);
    expect(figureWidth("full", 520, SHEET_WIDTH_PX, "figure")).toBe(SHEET_WIDTH_PX);
  });

  it("dentro de una celda manda el ancho de la celda", () => {
    const columns = { type: "columns" as const, columns: [{ width: 2, blocks: [] }, { width: 1, blocks: [] }] };
    const [wide] = cellWidths(columns);
    expect(figureWidth("full", 520, wide, "figure")).toBe(wide);
    expect(figureWidth("large", 520, wide, "figure")).toBe(wide);
    expect(figureWidth(undefined, 520, wide, "figure")).toBeLessThan(wide);
  });

  it("los centímetros en papel salen con coma decimal", () => {
    expect(pxToCm(SHEET_WIDTH_PX)).toBe("18,4");
  });
});

describe("tamaños que se ofrecen", () => {
  const sizes = (design: number, available: number, type?: string) => figureSizeChoices(design, available, type).map(choice => choice.sizes.join("+"));

  it("en la hoja, una gráfica de barras tiene los cuatro", () => {
    expect(sizes(520, SCREEN_SHEET_WIDTH_PX)).toEqual(["small", "medium", "large", "full"]);
  });

  it("los que dan el mismo ancho se reúnen: la recta numérica grande ya llena la hoja", () => {
    expect(sizes(560, SCREEN_SHEET_WIDTH_PX)).toEqual(["small", "medium", "large+full"]);
    const [, , last] = figureSizeChoices(560, SCREEN_SHEET_WIDTH_PX);
    expect(last.size).toBe("full");
  });

  it("una figura chica no se ofrece a todo lo ancho: pasaría del doble", () => {
    expect(sizes(160, SCREEN_SHEET_WIDTH_PX)).toEqual(["small", "medium", "large"]);
  });

  it("en una columna angosta, mediano, grande y completo son lo mismo, y se guarda el mediano", () => {
    const choices = figureSizeChoices(520, 420);
    expect(choices.map(choice => choice.sizes.join("+"))).toEqual(["small", "medium+large+full"]);
    expect(choices[1].size).toBe("medium");
    expect(currentSizeChoice(choices, undefined)).toBe(choices[1]);
    expect(currentSizeChoice(choices, "large")).toBe(choices[1]);
  });

  it("contados en papel: lo que en una pantalla angosta se ve igual sale distinto al imprimir", () => {
    const paper = (design: number, available: number, kind: "figure" | "plane" = "figure", type?: string) => figureSizeChoices(design, available, type, kind).map(choice => choice.sizes.join("+"));
    // La recta grande no llena la hoja carta: grande y completo son dos opciones
    expect(paper(560, SHEET_WIDTH_PX)).toEqual(["small", "medium", "large", "full"]);
    // En una columna 2:1 la circular mediana ya casi llena la celda
    const [wide] = cellWidths({ type: "columns", columns: [{ width: 2, blocks: [] }, { width: 1, blocks: [] }] });
    expect(paper(520, wide)).toEqual(["small", "medium+large+full"]);
    expect(paper(374, SHEET_WIDTH_PX, "plane", "graph")).toEqual(["medium", "large", "full"]);
  });

  it("el plano no ofrece el pequeño", () => {
    expect(sizes(374, SCREEN_SHEET_WIDTH_PX, "graph")).toEqual(["medium", "large", "full"]);
  });
});

describe("la IA conserva el tamaño que eligió el docente", () => {
  const docWith = (blocks: Block[]): ResourceDoc => ({ title: "Prueba", sections: [{ id: "s1", title: "Guía", role: "student", blocks }] });

  it("si reescribe la figura sin tamaño, se queda el que tenía", () => {
    expect(keepFigureLayout({ ...bars({ size: "large" }), id: "b1" } as Block, bars({ showValues: false }))).toMatchObject({ size: "large", showValues: false });
    // Si pide otro tamaño, manda el suyo
    expect(keepFigureLayout({ ...bars({ size: "large" }), id: "b1" } as Block, bars({ size: "small" }))).toMatchObject({ size: "small" });
    // Si la cambia por otra figura, el tamaño sigue; si la cambia por un texto, no
    expect(keepFigureLayout({ ...bars({ size: "large" }), id: "b1" } as Block, clock())).toMatchObject({ type: "clock", size: "large" });
    expect("size" in keepFigureLayout({ ...bars({ size: "large" }), id: "b1" } as Block, { type: "paragraph", md: "Hola" })).toBe(false);
  });

  it("en un contenedor reescrito, cada figura que sigue en su sitio lo conserva", () => {
    const before = { type: "columns", id: "c1", columns: [{ width: 2, blocks: [{ ...bars({ size: "small" }), id: "b1" }] }, { width: 1, blocks: [{ type: "paragraph", md: "x", id: "b2" }] }] } as Block;
    const next = { type: "columns", columns: [{ width: 2, blocks: [bars({ showValues: false })] }, { width: 1, blocks: [{ type: "paragraph", md: "y" }] }] } as BlockInput;
    expect((keepFigureLayout(before, next) as { columns: Array<{ blocks: object[] }> }).columns[0].blocks[0]).toMatchObject({ size: "small", showValues: false });
  });

  it("con la herramienta update_block", () => {
    const doc = docWith([{ ...bars({ size: "full" }), id: "b1" } as Block]);
    const outcome = executeCreatorTool(doc, "update_block", { block_id: "b1", block: bars({ bars: [{ label: "A", value: 4 }, { label: "B", value: 5 }] }) });
    expect(outcome.isError).toBe(false);
    expect(findBlock(outcome.doc, "b1")?.block).toMatchObject({ size: "full", bars: [{ value: 4 }, { value: 5 }] });
    // El mediano que pide la IA vuelve al tamaño normal
    const back = executeCreatorTool(outcome.doc, "update_block", { block_id: "b1", block: bars({ size: "medium" }) });
    expect("size" in (findBlock(back.doc, "b1")?.block ?? {})).toBe(false);
    // El plano pequeño se rechaza con un motivo que la IA puede corregir
    const small = executeCreatorTool(docWith([{ ...plane(), id: "g1" } as Block]), "update_block", { block_id: "g1", block: plane({ size: "small" }) });
    expect(small.isError).toBe(true);
    expect(small.result).toMatch(/no va en tamaño small/);
  });

  it("el docente sí puede quitar el tamaño: su edición no pasa por esa regla", () => {
    const doc = docWith([{ ...bars({ size: "full" }), id: "b1" } as Block]);
    const result = applyDocOp(doc, { op: "update_block", blockId: "b1", block: bars() });
    expect(result.ok && "size" in (findBlock(result.doc, "b1")?.block ?? {})).toBe(false);
  });

  it("el esquema de las herramientas define el tamaño una sola vez", () => {
    const schema = CREATOR_TOOLS.find(tool => tool.name === "update_block")!.input_schema as { $defs: Record<string, { properties?: Record<string, unknown> }> };
    expect(schema.$defs.figure_size).toMatchObject({ type: "string", enum: ["small", "medium", "large", "full"] });
    expect(schema.$defs.figure_size).not.toHaveProperty("id");
    expect(schema.$defs.bar_chart.properties?.size).toEqual({ $ref: "#/$defs/figure_size" });
  });
});

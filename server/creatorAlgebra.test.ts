import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { areaModelIssues, areaModelProduct, computeAreaModel, monomialText, multiplyMonomials, parseMonomial, polynomialText, splitTerms, sumMonomials } from "@shared/creatorAlgebra";
import { describeComputed } from "@shared/creatorStats";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const mono = (text: string) => parseMonomial(text)!;

describe("monomios", () => {
  it("lee números, letras, coeficientes y exponentes", () => {
    expect(parseMonomial("3")).toEqual({ coef: 3, exp: 0, variable: null });
    expect(parseMonomial("x")).toEqual({ coef: 1, exp: 1, variable: "x" });
    expect(parseMonomial("2x")).toEqual({ coef: 2, exp: 1, variable: "x" });
    expect(parseMonomial("-4")).toEqual({ coef: -4, exp: 0, variable: null });
    expect(parseMonomial("−x")).toEqual({ coef: -1, exp: 1, variable: "x" });
    expect(parseMonomial("x^2")).toEqual({ coef: 1, exp: 2, variable: "x" });
    expect(parseMonomial(" 3 * a^{2} ")).toEqual({ coef: 3, exp: 2, variable: "a" });
    expect(parseMonomial("0.5x")).toEqual({ coef: 0.5, exp: 1, variable: "x" });
    expect(parseMonomial("0,5x")).toEqual({ coef: 0.5, exp: 1, variable: "x" });
    expect(parseMonomial("x^0")).toEqual({ coef: 1, exp: 0, variable: null });
  });

  it("rechaza lo que no es un monomio de una letra", () => {
    for (const text of ["", "x + 2", "xy", "$x^2$", "\\frac{1}{2}", "2x^", "x^-1", "dos"]) expect(parseMonomial(text), text).toBeNull();
  });

  it("multiplica coeficientes y suma exponentes", () => {
    expect(multiplyMonomials(mono("x"), mono("x"))).toEqual({ coef: 1, exp: 2, variable: "x" });
    expect(multiplyMonomials(mono("3"), mono("2"))).toEqual({ coef: 6, exp: 0, variable: null });
    expect(multiplyMonomials(mono("3"), mono("x"))).toEqual({ coef: 3, exp: 1, variable: "x" });
    expect(multiplyMonomials(mono("-2x"), mono("3x^2"))).toEqual({ coef: -6, exp: 3, variable: "x" });
    // 0.1 · 3 no deja 0.30000000000000004
    expect(multiplyMonomials(mono("0.1"), mono("3x")).coef).toBe(0.3);
  });

  it("suma términos semejantes y ordena por grado", () => {
    expect(polynomialText(sumMonomials([mono("x^2"), mono("2x"), mono("3x"), mono("6")]))).toBe("x^2 + 5x + 6");
    expect(polynomialText(sumMonomials([mono("6"), mono("3x"), mono("x^2"), mono("2x")]))).toBe("x^2 + 5x + 6");
    // Diferencia de cuadrados: los términos lineales se anulan
    expect(polynomialText(sumMonomials([mono("x^2"), mono("3x"), mono("-3x"), mono("-9")]))).toBe("x^2 - 9");
    expect(polynomialText(sumMonomials([mono("2x"), mono("-2x")]))).toBe("0");
  });

  it("escribe los monomios en texto y en LaTeX, con coma decimal", () => {
    expect(monomialText(mono("x^2"), "latex")).toBe("x^{2}");
    expect(monomialText(mono("-x"))).toBe("-x");
    expect(monomialText(mono("1.5x"), "latex")).toBe("1{,}5x");
    expect(monomialText(mono("1.5x"))).toBe("1,5x");
    expect(polynomialText([mono("2x^2"), mono("-x"), mono("-10")], "latex")).toBe("2x^{2} - x - 10");
    expect(monomialText({ coef: 1200, exp: 0, variable: null })).toBe("1.200");
  });

  it("parte un lado escrito por el docente en términos", () => {
    expect(splitTerms("x + 3")).toEqual(["x", "3"]);
    expect(splitTerms("2x - 5")).toEqual(["2x", "-5"]);
    expect(splitTerms("x, 3")).toEqual(["x", "3"]);
    expect(splitTerms("−x + 4")).toEqual(["-x", "4"]);
    expect(splitTerms("x^2 + 0,5x; 20")).toEqual(["x^2", "0,5x", "20"]);
    expect(splitTerms("  ")).toEqual([]);
  });
});

describe("modelo de área: cálculo", () => {
  it("calcula cada celda y el área total de un producto de binomios", () => {
    // El caso que salió mal en otra herramienta: la celda de 3 por 2 es 6, no 12
    const model = computeAreaModel(["x", "3"], ["x", "2"])!;
    expect(model.cells.map(row => row.map(cell => monomialText(cell)))).toEqual([["x^2", "2x"], ["3x", "6"]]);
    expect(polynomialText(model.total)).toBe("x^2 + 5x + 6");
    expect(areaModelProduct(model)).toBe("(x + 3)(x + 2)");
    expect(areaModelProduct(model, "latex")).toBe("(x + 3)(x + 2)");
    expect(model.numeric).toBe(false);
  });

  it("maneja signos, coeficientes y tres términos", () => {
    const difference = computeAreaModel(["x", "-3"], ["x", "3"])!;
    expect(polynomialText(difference.total)).toBe("x^2 - 9");
    const leading = computeAreaModel(["2x", "-5"], ["x", "2"])!;
    expect(leading.cells.map(row => row.map(cell => monomialText(cell)))).toEqual([["2x^2", "4x"], ["-5x", "-10"]]);
    expect(polynomialText(leading.total)).toBe("2x^2 - x - 10");
    const trinomial = computeAreaModel(["x", "1"], ["x^2", "-x", "1"])!;
    expect(polynomialText(trinomial.total)).toBe("x^3 + 1");
    expect(areaModelProduct(computeAreaModel(["3"], ["x", "2"])!)).toBe("3(x + 2)");
    expect(areaModelProduct(computeAreaModel(["x", "2"], ["3"])!)).toBe("3(x + 2)");
  });

  it("sirve para multiplicar números por descomposición", () => {
    const model = computeAreaModel(["20", "3"], ["40", "5"])!;
    expect(model.cells.map(row => row.map(cell => cell.coef))).toEqual([[800, 100], [120, 15]]);
    expect(model.numeric).toBe(true);
    expect(areaModelProduct(model)).toBe("23 × 45");
    expect(polynomialText(model.total)).toBe("1.035");
  });

  it("no calcula nada si un término no se entiende", () => {
    expect(computeAreaModel(["x", "tres"], ["x", "2"])).toBeNull();
    expect(computeAreaModel([], ["x"])).toBeNull();
  });
});

describe("modelo de área: esquema, validación y lo que ve la IA", () => {
  it("valida los términos", () => {
    expect(validateBlock(block({ type: "area_model", rows: ["x", "3"], columns: ["x", "2"] }))).toEqual([]);
    expect(validateBlock(block({ type: "area_model", rows: ["20", "3"], columns: ["40", "5"], hide: "cells" }))).toEqual([]);
    expect(validateBlock(block({ type: "area_model", rows: ["x", "$3$"], columns: ["x", "2"] }))[0]).toContain("no se entiende");
    expect(validateBlock(block({ type: "area_model", rows: ["x", "3"], columns: ["y", "2"] }))[0]).toContain("una sola");
    expect(validateBlock(block({ type: "area_model", rows: ["x", "0"], columns: ["x", "2"] }))[0]).toContain("cero");
    expect(validateBlock(block({ type: "area_model", rows: ["x"], columns: ["3"] }))[0]).toContain("al menos dos");
    expect(areaModelIssues(["x", "3"], ["x", "2"])).toEqual([]);
    expect(blockInputSchema.safeParse({ type: "area_model", rows: ["x", "1", "2", "3"], columns: ["x"] }).success).toBe(false);
    expect(blockInputSchema.safeParse({ type: "area_model", rows: [], columns: ["x"] }).success).toBe(false);
  });

  it("tiene nombre y resumen, y cuenta como figura al revisar el orden", () => {
    const model = block({ type: "area_model", rows: ["x", "3"], columns: ["x", "2"] });
    expect(BLOCK_TYPE_LABELS.area_model).toBe("Modelo de área");
    expect(blockPreview(model)).toContain("x + 3");
    const exercise = block({ type: "exercise", label: "Ejercicio 1", md: "Completa el modelo de área." });
    expect(validateBlockOrder([{ title: "Guía", blocks: [exercise, model] }])).toHaveLength(1);
  });

  it("le devuelve a la IA el producto y las celdas calculadas", () => {
    expect(describeComputed(block({ type: "area_model", rows: ["x", "3"], columns: ["x", "2"] }))).toBe("Modelo de área: (x + 3)(x + 2) = x^2 + 5x + 6; celdas por filas: x^2, 2x | 3x, 6.");
    const outcome = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "area_model", rows: ["2x", "-5"], columns: ["x", "2"], hide: "dimensions", showTotal: true }] });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("2x^2 - x - 10");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "area_model", rows: ["x", "$3$"], columns: ["x", "2"] }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("texto plano");
  });

  it("está en el esquema de la herramienta y en las instrucciones", () => {
    const serialized = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    expect(serialized).toContain('"area_model"');
    expect(CREATOR_SYSTEM_PROMPT).toContain("area_model");
    expect(CREATOR_SYSTEM_PROMPT).toMatch(/factorizar[^.]*hide "dimensions"/);
  });
});

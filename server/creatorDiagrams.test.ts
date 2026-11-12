import { describe, expect, it } from "vitest";
import { blockInputSchema, parseDoc, type BlockInput } from "@shared/creator";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);

describe("recta numérica con intervalos y balanza con pesas", () => {
  const line = (intervals: unknown[]) => validateBlock(block({ type: "number_line", min: -5, max: 5, step: 1, intervals }));

  it("acepta intervalos y semirrectas", () => {
    expect(line([{ from: -2, to: 3, fromClosed: true }])).toEqual([]);
    expect(line([{ from: 2 }])).toEqual([]);
    expect(line([{ to: -1, toClosed: true }, { from: 3, to: null }])).toEqual([]);
  });

  it("rechaza intervalos sin extremos, invertidos o fuera de la recta", () => {
    expect(line([{}])).toHaveLength(1);
    expect(line([{ from: 3, to: 1 }])).toHaveLength(1);
    expect(line([{ from: 2, to: 9 }])).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "number_line", min: 0, max: 5, step: 1, intervals: [{ from: 1 }, { from: 2 }, { from: 3 }, { from: 4 }] }).success).toBe(false);
  });

  it("una pesa con número cuenta como contenido del platillo", () => {
    expect(validateBlock(block({ type: "balance", left: { variables: 2, units: 5 }, right: { weights: [15] } }))).toEqual([]);
    expect(validateBlock(block({ type: "balance", left: { variables: 2 }, right: {} }))).toHaveLength(1);
    expect(blockInputSchema.safeParse({ type: "balance", left: { variables: 1 }, right: { weights: [0] } }).success).toBe(false);
  });

  it("los recursos guardados antes de estos campos se siguen abriendo", () => {
    const old = { title: "Guía", sections: [{ id: "s1", title: "Guía", role: "student", blocks: [
      { id: "b1", type: "number_line", min: 0, max: 10, step: 1, labelEvery: 1, showNumbers: true, points: [], jumps: [] },
      { id: "b2", type: "balance", variable: "x", left: { variables: 2, units: 1 }, right: { variables: 0, units: 7 } },
    ] }] };
    const doc = parseDoc(old);
    expect(doc.sections[0].blocks).toHaveLength(2);
    expect(doc.sections[0].blocks[0]).toMatchObject({ intervals: [] });
    expect(doc.sections[0].blocks[1]).toMatchObject({ right: { weights: [] } });
  });
});

import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { exactText } from "@shared/creatorExact";
import { describeComputed } from "@shared/creatorStats";
import { angleText, coordinatesText, exactCosSin, exactTan, quadrant, referenceAngle, unitCircleAngles, unitCircleLayout, type UnitCircleSpec } from "@shared/creatorUnitCircle";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const circle = (input: Record<string, unknown> = {}) => blockInputSchema.parse({ type: "unit_circle", ...input }) as UnitCircleSpec;
const overlapping = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe("valores exactos de los ángulos notables", () => {
  it("coinciden con el seno y el coseno de cada ángulo", () => {
    for (const degrees of unitCircleAngles("all")) {
      const { cos, sin } = exactCosSin(degrees);
      const radians = (degrees * Math.PI) / 180;
      expect((cos.n / cos.d) * Math.sqrt(cos.r), `cos ${degrees}`).toBeCloseTo(Math.cos(radians), 12);
      expect((sin.n / sin.d) * Math.sqrt(sin.r), `sen ${degrees}`).toBeCloseTo(Math.sin(radians), 12);
    }
  });

  it("se escriben como en el tablero", () => {
    expect(coordinatesText(30)).toBe("(√3/2, 1/2)");
    expect(coordinatesText(135)).toBe("(-√2/2, √2/2)");
    expect(coordinatesText(270)).toBe("(0, -1)");
    expect(coordinatesText(240, "latex")).toBe("\\left(-\\tfrac{1}{2},\\ -\\tfrac{\\sqrt{3}}{2}\\right)");
    expect(exactText(exactTan(150)!, { fraction: true })).toBe("-√3/3");
    expect(exactText(exactTan(60)!, { fraction: true })).toBe("√3");
    expect(exactTan(90)).toBeNull();
  });

  it("pasa a radianes, halla el ángulo de referencia y el cuadrante", () => {
    expect(angleText(150, "radians")).toBe("5π/6");
    expect(angleText(180, "radians")).toBe("π");
    expect(angleText(-45, "radians")).toBe("-π/4");
    expect(angleText(360, "radians", "latex")).toBe("2\\pi");
    expect(referenceAngle(210)).toBe(30);
    expect(referenceAngle(-45)).toBe(45);
    expect(quadrant(300)).toBe(4);
    expect(quadrant(-30)).toBe(4);
    expect(quadrant(180)).toBe(0);
  });
});

describe("validación y dibujo", () => {
  it("acepta las versiones de aula", () => {
    for (const input of [
      {},
      { unit: "radians" },
      { showCoordinates: false },
      { showAngles: false, showCoordinates: false },
      { angles: "first_quadrant", highlight: { degrees: 60, label: "θ" } },
      { highlight: { degrees: 150, label: "θ" } },
      { unit: "radians", highlight: { degrees: 225, label: "α" } },
      { angles: "axes", highlight: { degrees: -45 } },
      { angles: "axes", highlight: { degrees: 300, values: false } },
      { angles: "axes", highlight: { degrees: 90, triangle: false } },
      { highlight: { degrees: 360, triangle: false } },
    ]) {
      expect(validateBlock(circle(input)), JSON.stringify(input)).toEqual([]);
    }
  });

  it("rechaza ángulos que no son notables, triángulos imposibles y rótulos con LaTeX", () => {
    expect(validateBlock(circle({ highlight: { degrees: 20 } }))[0]).toContain("no es notable");
    expect(validateBlock(circle({ highlight: { degrees: 180 } }))[0]).toContain("no tiene triángulo de referencia");
    expect(validateBlock(circle({ highlight: { degrees: 30, label: "$x$" } })).join(" ")).toContain("texto plano");
    expect(blockInputSchema.safeParse({ type: "unit_circle", highlight: { degrees: 400 } }).success).toBe(false);
  });

  it("ningún rótulo se monta sobre otro y todos quedan dentro de la figura", () => {
    for (const input of [{}, { unit: "radians" }, { highlight: { degrees: 150, label: "θ" } }, { unit: "radians", highlight: { degrees: 315 } }, { angles: "first_quadrant", highlight: { degrees: 30, label: "θ" } }]) {
      const layout = unitCircleLayout(circle(input));
      expect(layout.issues, JSON.stringify(input)).toEqual([]);
      layout.labels.forEach((label, i) => {
        for (const other of layout.labels.slice(i + 1)) expect(overlapping(label.box, other.box), `${label.plain} / ${other.plain}`).toBe(false);
        expect(label.box.x).toBeGreaterThanOrEqual(0);
        expect(label.box.y).toBeGreaterThanOrEqual(0);
        expect(label.box.x + label.box.w).toBeLessThanOrEqual(layout.width);
        expect(label.box.y + label.box.h).toBeLessThanOrEqual(layout.height);
      });
    }
  });

  it("escribe las 16 coordenadas exactas, o ninguna en la versión para completar", () => {
    const full = unitCircleLayout(circle());
    expect(full.labels.filter(label => label.kind === "coordinates")).toHaveLength(16);
    expect(full.labels.find(label => label.plain === "(-√3/2, -1/2)")).toBeDefined();
    const blank = unitCircleLayout(circle({ showCoordinates: false, showAngles: false }));
    expect(blank.labels.filter(label => label.kind === "coordinates" || label.kind === "angle")).toEqual([]);
    expect(blank.points).toHaveLength(16);
    // El ángulo resaltado lleva sus coordenadas aunque las demás no estén
    const one = unitCircleLayout(circle({ showCoordinates: false, highlight: { degrees: 120 } }));
    expect(one.labels.filter(label => label.kind === "coordinates").map(label => label.plain)).toEqual(["(-1/2, √3/2)"]);
  });

  it("resalta el ángulo con su triángulo y su ángulo de referencia", () => {
    const layout = unitCircleLayout(circle({ highlight: { degrees: 150, label: "θ" } }));
    expect(layout.highlight?.foot).not.toBeNull();
    expect(layout.highlight?.reference).not.toBeNull();
    expect(layout.labels.find(label => label.kind === "rotation")?.plain).toBe("θ = 150°");
    expect(layout.labels.find(label => label.kind === "reference")?.plain).toBe("30°");
    // En el primer cuadrante el ángulo de referencia es el mismo giro: no se repite
    expect(unitCircleLayout(circle({ highlight: { degrees: 60 } })).highlight?.reference).toBeNull();
    const hidden = unitCircleLayout(circle({ showCoordinates: false, highlight: { degrees: 210, values: false, label: "θ" } }));
    expect(hidden.labels.find(label => label.kind === "rotation")?.plain).toBe("θ");
    expect(hidden.labels.some(label => label.kind === "reference" || label.kind === "coordinates")).toBe(false);
  });

  it("tiene nombre y resumen, y cuenta como figura al revisar el orden", () => {
    expect(BLOCK_TYPE_LABELS.unit_circle).toBe("Círculo unitario");
    expect(blockPreview(circle({ highlight: { degrees: 150 } }))).toBe("Círculo unitario con 150° resaltado");
    const exercise = blockInputSchema.parse({ type: "exercise", label: "Ejercicio 1", md: "Completa las coordenadas en la figura." }) as BlockInput;
    expect(validateBlockOrder([{ title: "Guía", blocks: [exercise, circle({ showCoordinates: false })] }])).toHaveLength(1);
  });
});

describe("lo que ve la IA", () => {
  it("devuelve cuadrante, ángulo de referencia y razones exactas del ángulo resaltado", () => {
    const text = describeComputed(circle({ highlight: { degrees: 150, label: "θ" } }))!;
    expect(text).toContain("θ = 150° = 5π/6 rad, en el cuadrante II");
    expect(text).toContain("ángulo de referencia 30° = π/6");
    expect(text).toContain("cos θ = -√3/2, sen θ = 1/2, tan θ = -√3/3");
    expect(describeComputed(circle({ angles: "axes", highlight: { degrees: 270, triangle: false } }))).toContain("tan θ no está definida");
    expect(describeComputed(circle())).toBeNull();
  });

  it("en la versión para completar, devuelve los valores que faltan", () => {
    const text = describeComputed(circle({ angles: "first_quadrant", showCoordinates: false, unit: "radians" }))!;
    expect(text).toContain("faltan las coordenadas");
    expect(text).toContain("π/6 (√3/2, 1/2)");
  });

  it("la herramienta acepta el bloque y explica el error", () => {
    const outcome = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "unit_circle", highlight: { degrees: 225, label: "θ" } }] });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("cos θ = -√2/2");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "unit_circle", highlight: { degrees: 50 } }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("no es notable");
  });

  it("está en el esquema de la herramienta y en las instrucciones", () => {
    expect(JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema)).toContain('"unit_circle"');
    expect(CREATOR_SYSTEM_PROMPT).toContain("unit_circle");
  });
});

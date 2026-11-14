import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { minBlockWidth } from "@shared/creatorContainers";
import { quantityText, solidFacts, solidLayout, type Solid, type SolidSpec } from "@shared/creatorSolids";
import { describeComputed } from "@shared/creatorStats";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (solids: unknown[], extra: Record<string, unknown> = {}) => blockInputSchema.parse({ type: "solid", solids, unit: "cm", ...extra }) as SolidSpec;
const facts = (solid: unknown) => solidFacts(block([solid]).solids[0] as Solid);
const overlapping = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe("volumen y área", () => {
  it("los poliedros, exactos", () => {
    const cube = facts({ kind: "cube", edge: 4 });
    expect(quantityText(cube.volume)).toBe("= 64");
    expect(quantityText(cube.total)).toBe("= 96");
    expect(cube.elements).toEqual({ faces: 6, edges: 12, vertices: 8 });
    const box = facts({ kind: "rectangular_prism", length: 8, width: 3, height: 5 });
    expect(quantityText(box.volume)).toBe("= 120");
    expect(quantityText(box.total)).toBe("= 158");
    expect(quantityText(box.lateral!)).toBe("= 110");
    // Triángulo isósceles de base 6 y altura 4: lados de 5
    const prism = facts({ kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10 });
    expect(quantityText(prism.volume)).toBe("= 120");
    expect(quantityText(prism.lateral!)).toBe("= 160");
    expect(quantityText(prism.total)).toBe("= 184");
    expect(quantityText(facts({ kind: "triangular_prism", base: 3, triangleHeight: 4, length: 9, triangle: "right" }).total)).toBe("= 120");
    const pyramid = facts({ kind: "square_pyramid", base: 6, height: 4 });
    expect(quantityText(pyramid.volume)).toBe("= 48");
    expect(quantityText(pyramid.total)).toBe("= 96");
    expect(pyramid.extras.map(extra => `${extra.name} ${quantityText(extra.quantity)}`)).toEqual(["apotema de la pirámide (altura de cada cara) = 5", "arista lateral = √34 ≈ 5,83"]);
  });

  it("los cuerpos redondos, con π y raíces", () => {
    const cylinder = facts({ kind: "cylinder", radius: 3, height: 5 });
    expect(quantityText(cylinder.volume)).toBe("= 45π ≈ 141,37");
    expect(quantityText(cylinder.total)).toBe("= 48π ≈ 150,8");
    const cone = facts({ kind: "cone", radius: 3, height: 4 });
    expect(quantityText(cone.volume)).toBe("= 12π ≈ 37,7");
    expect(quantityText(cone.total)).toBe("= 24π ≈ 75,4");
    // Generatriz irracional: la suma queda en dos términos
    const steep = facts({ kind: "cone", radius: 3, height: 5 });
    expect(quantityText(steep.extras[0].quantity)).toBe("= √34 ≈ 5,83");
    expect(quantityText(steep.total)).toBe("= 9π + 3√34π ≈ 83,23");
    expect(steep.total.value).toBeCloseTo(Math.PI * 3 * (3 + Math.sqrt(34)), 10);
    const sphere = facts({ kind: "sphere", radius: 2 });
    expect(quantityText(sphere.volume)).toBe("= 32π/3 ≈ 33,51");
    expect(quantityText(sphere.total)).toBe("= 16π ≈ 50,27");
    expect(quantityText(facts({ kind: "cylinder", radius: 2.5, height: 4 }).volume)).toBe("= 25π ≈ 78,54");
  });

  it("los valores coinciden con las fórmulas", () => {
    const solids: Array<[unknown, number, number]> = [
      [{ kind: "cylinder", radius: 1.5, height: 7 }, Math.PI * 1.5 ** 2 * 7, 2 * Math.PI * 1.5 * (1.5 + 7)],
      [{ kind: "cone", radius: 2, height: 7 }, (Math.PI * 4 * 7) / 3, Math.PI * 2 * (2 + Math.hypot(2, 7))],
      [{ kind: "square_pyramid", base: 5, height: 7 }, (25 * 7) / 3, 25 + 2 * 5 * Math.hypot(7, 2.5)],
      [{ kind: "triangular_prism", base: 5, triangleHeight: 3, length: 8 }, 7.5 * 8, (5 + 2 * Math.hypot(3, 2.5)) * 8 + 15],
    ];
    for (const [solid, volume, total] of solids) {
      const result = facts(solid);
      expect(result.volume.value, JSON.stringify(solid)).toBeCloseTo(volume, 9);
      expect(result.total.value, JSON.stringify(solid)).toBeCloseTo(total, 9);
    }
  });
});

describe("validación y dibujo", () => {
  it("acepta los sólidos de aula", () => {
    expect(validateBlock(block([{ kind: "cube", edge: 4 }, { kind: "rectangular_prism", length: 8, width: 3, height: 5 }]))).toEqual([]);
    expect(validateBlock(block([{ kind: "cylinder", radius: 3, height: 5 }, { kind: "cone", radius: 3, height: 4, slant: true }, { kind: "sphere", radius: 3 }], { toScale: true }))).toEqual([]);
    expect(validateBlock(block([{ kind: "square_pyramid", base: 6, height: 4, slant: true, heightLabel: "h" }]))).toEqual([]);
    expect(validateBlock(block([{ kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10 }], { showValues: false }))).toEqual([]);
  });

  it("rechaza números largos, medidas escritas en el rótulo, LaTeX y sólidos que no se leerían", () => {
    expect(validateBlock(block([{ kind: "cube", edge: 3.14159 }])).join(" ")).toContain("más de 4 decimales");
    expect(validateBlock(block([{ kind: "cylinder", radius: 3, height: 5, heightLabel: "5 cm" }])).join(" ")).toContain("es una medida");
    expect(validateBlock(block([{ kind: "cylinder", radius: 3, height: 5, heightLabel: "$h$" }])).join(" ")).toContain("texto plano");
    expect(validateBlock(block([{ kind: "cone", radius: 3, height: 4, slantLabel: "g" }])).join(" ")).toContain("pon slant en true");
    expect(validateBlock(block([{ kind: "cylinder", radius: 1, height: 40 }])).join(" ")).toContain("demasiado alargado");
    expect(validateBlock(block([{ kind: "cube", edge: 20 }, { kind: "cube", edge: 1 }], { toScale: true })).join(" ")).toContain("quita toScale");
    expect(blockInputSchema.safeParse({ type: "solid", solids: [{ kind: "dodecahedron", edge: 2 }] }).success).toBe(false);
  });

  it("ningún rótulo se monta sobre otro ni sobre un trazo, y todos quedan dentro de la figura", () => {
    const all = block(
      [
        { kind: "square_pyramid", base: 6, height: 4, slant: true },
        { kind: "cone", radius: 3, height: 5, slant: true },
        { kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10 },
      ],
      { unit: "cm" },
    );
    const layout = solidLayout(all);
    expect(layout.issues).toEqual([]);
    expect(layout.labels).toHaveLength(9);
    layout.labels.forEach((label, i) => {
      for (const other of layout.labels.slice(i + 1)) expect(overlapping(label.box, other.box), `${label.plain} / ${other.plain}`).toBe(false);
      expect(label.box.x).toBeGreaterThanOrEqual(0);
      expect(label.box.x + label.box.w).toBeLessThanOrEqual(layout.width);
      expect(label.box.y).toBeGreaterThanOrEqual(0);
      expect(label.box.y + label.box.h).toBeLessThanOrEqual(layout.height);
    });
    // Los que no caben junto a su medida salen con una línea guía
    expect(layout.labels.some(label => label.leader)).toBe(true);
  });

  it("dibuja las aristas ocultas punteadas", () => {
    const cube = solidLayout(block([{ kind: "cube", edge: 4 }])).drawings[0];
    const lines = cube.strokes.filter(stroke => stroke.kind === "line");
    expect(lines).toHaveLength(12);
    expect(lines.filter(line => line.kind === "line" && line.hidden)).toHaveLength(3);
    // De la pirámide se ven dos caras laterales y la base no; quedan ocultas dos aristas de la base y una lateral, más la altura
    const pyramid = solidLayout(block([{ kind: "square_pyramid", base: 6, height: 4 }])).drawings[0];
    expect(pyramid.strokes.filter(stroke => stroke.kind === "line" && stroke.hidden)).toHaveLength(4);
  });

  it("con rótulo, la medida se reemplaza; sin medidas, solo quedan los rótulos", () => {
    const labelled = solidLayout(block([{ kind: "cylinder", radius: 3, height: 5, heightLabel: "h" }]));
    expect(labelled.labels.map(label => label.plain)).toEqual(["3 cm", "h"]);
    const bare = solidLayout(block([{ kind: "cylinder", radius: 3, height: 5, heightLabel: "h" }], { showValues: false }));
    expect(bare.labels.map(label => label.plain)).toEqual(["h"]);
    const hidden = solidLayout(block([{ kind: "cylinder", radius: 3, height: 5, radiusLabel: "" }]));
    expect(hidden.labels.map(label => label.plain)).toEqual(["5 cm"]);
  });

  it("tiene nombre y resumen, cuenta como figura y cabe en una columna por su ancho", () => {
    const solids = block([{ kind: "cylinder", radius: 3, height: 5 }, { kind: "cone", radius: 3, height: 4 }]);
    expect(BLOCK_TYPE_LABELS.solid).toBe("Sólidos");
    expect(blockPreview(solids)).toBe("Sólidos: cilindro, cono");
    const exercise = blockInputSchema.parse({ type: "exercise", label: "Ejercicio 1", md: "Halla el volumen de la figura." }) as BlockInput;
    expect(validateBlockOrder([{ title: "Guía", blocks: [exercise, solids] }])).toHaveLength(1);
    expect(minBlockWidth(solids)).toBeGreaterThan(minBlockWidth(block([{ kind: "cylinder", radius: 3, height: 5 }])));
  });
});

describe("lo que ve la IA", () => {
  it("devuelve medidas, volumen, áreas y elementos de cada sólido", () => {
    const text = describeComputed(block([{ kind: "cylinder", radius: 3, height: 5 }, { kind: "square_pyramid", base: 6, height: 4 }]))!;
    expect(text).toContain("1) Cilindro (radio 3 cm, altura 5 cm): volumen = 45π ≈ 141,37 cm³; área lateral = 30π ≈ 94,25 cm²; área total = 48π ≈ 150,8 cm².");
    expect(text).toContain("2) Pirámide de base cuadrada (arista de la base 6 cm, altura 4 cm): apotema de la pirámide (altura de cada cara) = 5 cm");
    expect(text).toContain("5 caras, 8 aristas y 5 vértices");
    expect(describeComputed(block([{ kind: "sphere", radius: 3 }]))).toContain("área de la superficie = 36π ≈ 113,1 cm²");
  });

  it("la herramienta acepta el bloque y explica el error", () => {
    const outcome = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cone", radius: 3, height: 4, slant: true }], unit: "cm" }] });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("generatriz = 5 cm; volumen = 12π ≈ 37,7 cm³");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cube", edge: 2, edgeLabel: "2 cm" }] }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("es una medida");
  });

  it("está en el esquema de la herramienta y en las instrucciones", () => {
    expect(JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema)).toContain('"solid"');
    expect(CREATOR_SYSTEM_PROMPT).toContain("solid:");
  });
});

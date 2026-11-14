import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { minBlockWidth } from "@shared/creatorContainers";
import { divide, exactText, recognize, sqrtOf, rational } from "@shared/creatorExact";
import { describeComputed } from "@shared/creatorStats";
import { boxesOverlap, describeTriangles, plainToLatex, solveTriangle, triangleLayout, type TriangleSpec } from "@shared/creatorTriangle";
import { validateBlock, validateBlockOrder } from "@shared/creatorValidate";
import { CREATOR_SYSTEM_PROMPT } from "./creatorAgent";
import { CREATOR_TOOLS, executeCreatorTool } from "./creatorTools";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const triangle = (data: unknown, extra: Record<string, unknown> = {}) => block({ type: "triangle", triangles: [data], ...extra }) as TriangleSpec;
const solve = (data: unknown) => solveTriangle(triangle(data).triangles[0]);
const solved = (data: unknown) => {
  const result = solve(data);
  if (!result.ok) throw new Error(result.issues.join(" "));
  return result.triangle;
};
const close = (values: number[], expected: number[]) => values.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));

describe("números exactos", () => {
  it("reconoce decimales, raíces y razones", () => {
    expect(exactText(recognize(5)!)).toBe("5");
    expect(exactText(recognize(2.5)!)).toBe("2,5");
    expect(exactText(recognize(Math.sqrt(19))!)).toBe("√19");
    expect(exactText(recognize(Math.sqrt(20))!)).toBe("2√5");
    expect(exactText(recognize(5 * Math.sqrt(3))!)).toBe("5√3");
    expect(exactText(recognize((5 * Math.sqrt(6)) / 2)!)).toBe("5√6/2");
    expect(recognize(Math.PI)).toBeNull();
    expect(exactText(divide(recognize(2)!, recognize(Math.sqrt(5))!)!, { fraction: true })).toBe("2√5/5");
    expect(exactText(divide(rational(3)!, rational(5)!)!, { fraction: true })).toBe("3/5");
    expect(exactText(divide(rational(3)!, rational(5)!)!)).toBe("0,6");
    expect(exactText(sqrtOf(rational(0.75)!)!, { format: "latex" })).toBe("\\frac{\\sqrt{3}}{2}");
  });
});

describe("resolver un triángulo", () => {
  it("con tres lados, por la ley del coseno", () => {
    const t = solved({ sides: { a: { length: 5 }, b: { length: 4 }, c: { length: 3 } } });
    close(t.angles, [90, 53.130102, 36.869898]);
    expect(t.angles[0]).toBe(90);
  });

  it("con dos lados y el ángulo entre ellos", () => {
    const t = solved({ sides: { a: { length: 3 }, b: { length: 5 } }, angles: { C: { degrees: 60 } } });
    expect(t.sides[2]).toBeCloseTo(Math.sqrt(19), 10);
    // Los catetos con el ángulo recto: Pitágoras
    expect(solved({ sides: { a: { length: 6 }, b: { length: 8 } }, angles: { C: { degrees: 90 } } }).sides[2]).toBeCloseTo(10, 12);
  });

  it("con un lado y dos ángulos, por la ley del seno", () => {
    const t = solved({ sides: { c: { length: 10 } }, angles: { A: { degrees: 30 }, B: { degrees: 60 } } });
    close(t.sides, [5, 5 * Math.sqrt(3), 10]);
    expect(t.angles).toEqual([30, 60, 90]);
    // El lado puede no estar entre los dos ángulos (LAA)
    close(solved({ sides: { a: { length: 7 } }, angles: { A: { degrees: 40 }, B: { degrees: 75 } } }).sides, [7, (7 * Math.sin((75 * Math.PI) / 180)) / Math.sin((40 * Math.PI) / 180), (7 * Math.sin((65 * Math.PI) / 180)) / Math.sin((40 * Math.PI) / 180)]);
  });

  it("con dos lados y un ángulo opuesto, solo si queda un triángulo", () => {
    // Hipotenusa y cateto: uno solo
    close(solved({ sides: { c: { length: 13 }, a: { length: 5 } }, angles: { C: { degrees: 90 } } }).sides, [5, 12, 13]);
    // El ángulo opuesto al lado mayor: uno solo
    expect(solve({ sides: { a: { length: 10 }, b: { length: 6 } }, angles: { A: { degrees: 50 } } }).ok).toBe(true);
    const two = solve({ sides: { a: { length: 6 }, b: { length: 9 } }, angles: { A: { degrees: 35 } } });
    expect(two.ok).toBe(false);
    expect(!two.ok && two.issues[0]).toContain("dos triángulos posibles");
    const none = solve({ sides: { a: { length: 2 }, b: { length: 9 } }, angles: { A: { degrees: 35 } } });
    expect(!none.ok && none.issues[0]).toContain("no hay triángulo");
  });

  it("rechaza lo que no es un triángulo", () => {
    const flat = solve({ sides: { a: { length: 2 }, b: { length: 3 }, c: { length: 6 } } });
    expect(!flat.ok && flat.issues[0]).toContain("desigualdad triangular");
    expect(solve({ sides: { a: { length: 2 }, b: { length: 3 }, c: { length: 5 } } }).ok).toBe(false);
    const angles = solve({ angles: { A: { degrees: 60 }, B: { degrees: 60 }, C: { degrees: 60 } } });
    expect(!angles.ok && angles.issues[0]).toContain("no tiene tamaño");
    const sum = solve({ sides: { a: { length: 3 } }, angles: { A: { degrees: 100 }, B: { degrees: 90 } } });
    expect(!sum.ok && sum.issues[0]).toContain("menos de 180°");
    const few = solve({ sides: { a: { length: 3 }, b: { length: 4 } } });
    expect(!few.ok && few.issues[0]).toContain("faltan datos");
  });

  it("comprueba los datos de más", () => {
    expect(solve({ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } }, angles: { C: { degrees: 90 }, A: { degrees: 36.87 } } }).ok).toBe(true);
    const wrong = solve({ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 6 } }, angles: { C: { degrees: 90 } } });
    expect(!wrong.ok && wrong.issues[0]).toContain("el ángulo C mide 117.28° con los demás datos, no 90°");
    const sum = solve({ sides: { a: { length: 3 } }, angles: { A: { degrees: 50 }, B: { degrees: 60 }, C: { degrees: 80 } } });
    expect(!sum.ok && sum.issues[0]).toContain("suman 190°");
  });
});

describe("validación del bloque", () => {
  const valid = { sides: { a: { length: 6 }, b: { length: 8 } }, angles: { C: { degrees: 90 } } };

  it("acepta los casos de aula", () => {
    expect(validateBlock(triangle(valid, { unit: "cm" }))).toEqual([]);
    expect(validateBlock(triangle({ sides: { a: { length: 5 }, b: { length: 7 }, c: { length: 8 } } }))).toEqual([]);
    expect(validateBlock(triangle({ sides: { c: { length: 12 } }, angles: { A: { degrees: 42 }, B: { degrees: 71 } } }))).toEqual([]);
    expect(validateBlock(triangle({ ...valid, sides: { ...valid.sides, c: { label: "x" } } }))).toEqual([]);
    expect(validateBlock(triangle({ sides: { a: { length: 3, show: "label", label: "a" }, b: { length: 4 } }, angles: { C: { degrees: 90 }, A: { label: "θ" } } }))).toEqual([]);
  });

  it("rechaza rótulos con LaTeX, medidas escritas a mano y rótulos que faltan", () => {
    expect(validateBlock(triangle({ ...valid, angles: { ...valid.angles, A: { label: "$\\theta$" } } })).join(" ")).toContain("texto plano");
    expect(validateBlock(triangle({ ...valid, sides: { ...valid.sides, c: { label: "10 cm" } } })).join(" ")).toContain('usa show "value"');
    expect(validateBlock(triangle({ ...valid, sides: { ...valid.sides, c: { show: "both" } } })).join(" ")).toContain("no lo tiene");
    expect(validateBlock(triangle({ ...valid, sides: { ...valid.sides, c: { label: "x^" } } })).join(" ")).toContain("no se puede escribir");
  });

  it("rechaza números que no se pueden escribir completos", () => {
    expect(validateBlock(triangle({ sides: { a: { length: 3.141592 }, b: { length: 4 } }, angles: { C: { degrees: 90 } } })).join(" ")).toContain("más de 4 decimales");
    expect(validateBlock(triangle({ sides: { a: { length: 3 }, b: { length: 4 } }, angles: { C: { degrees: 89.999 } } })).join(" ")).toContain("más de 2 decimales");
  });

  it("rechaza triángulos que no se pueden dibujar legibles", () => {
    expect(validateBlock(triangle({ sides: { a: { length: 1 }, b: { length: 1 }, c: { length: 1.99 } } })).join(" ")).toContain("aplanado");
    expect(validateBlock(triangle({ sides: { a: { length: 1 }, b: { length: 30 }, c: { length: 30 } } })).join(" ")).toContain("con lados tan desiguales");
    // Un ángulo muy cerrado o uno obtuso con el lado opuesto encima: el rótulo va por fuera, con una guía hasta el arco
    for (const data of [
      { sides: { a: { length: 3 }, b: { length: 14 } }, angles: { C: { degrees: 90 }, A: { label: "α" } } },
      { sides: { a: { length: 10 }, b: { length: 10 } }, angles: { C: { degrees: 150 } } },
    ]) {
      const layout = triangleLayout(triangle(data))!;
      expect(layout.issues).toEqual([]);
      expect(layout.labels.find(label => label.kind === "angle")?.leader).toBeDefined();
    }
    // Un rótulo largo en un triángulo chico no cabe ni dentro ni fuera
    const crowded = block({ type: "triangle", triangles: [{ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }, { sides: { a: { length: 1.2 }, b: { length: 1.6 }, c: { length: 2, label: "hipotenusa", show: "both" } }, angles: { A: { label: "α", show: "both" }, B: { label: "β", show: "both" } } }] });
    expect(validateBlock(crowded).join(" ")).toMatch(/no cabe/);
  });

  it("tiene nombre y resumen, y cuenta como figura al revisar el orden", () => {
    const figure = triangle(valid);
    expect(BLOCK_TYPE_LABELS.triangle).toBe("Triángulo");
    expect(blockPreview(figure)).toBe("Triángulo ABC con a = 6, b = 8, C = 90°");
    const exercise = block({ type: "exercise", label: "Ejercicio 1", md: "Halla la hipotenusa de la figura." });
    expect(validateBlockOrder([{ title: "Guía", blocks: [exercise, figure] }])).toHaveLength(1);
  });
});

describe("dibujo", () => {
  it("pone la base abajo y los rótulos sin montarse", () => {
    const layout = triangleLayout(triangle({ sides: { a: { length: 6 }, b: { length: 8 }, c: { show: "value" } }, angles: { C: { degrees: 90 }, A: { show: "value" }, B: { show: "value" } } }, { unit: "cm" }))!;
    expect(layout.issues).toEqual([]);
    const [a, b, c] = layout.drawings[0].points;
    // Rectángulo en C: el cateto mayor (b = CA = 8) es la base y B queda encima de C
    expect(c.y).toBeCloseTo(a.y, 6);
    expect(b.x).toBeCloseTo(c.x, 6);
    expect(b.y).toBeLessThan(c.y);
    expect(layout.drawings[0].marks.find(mark => mark.vertex === 2)?.right).toBe(true);
    for (const [i, first] of layout.labels.entries()) for (const second of layout.labels.slice(i + 1)) expect(boxesOverlap(first.box, second.box, 0), `${first.plain} / ${second.plain}`).toBe(false);
    for (const label of layout.labels) {
      expect(label.box.x).toBeGreaterThanOrEqual(0);
      expect(label.box.y).toBeGreaterThanOrEqual(0);
      expect(label.box.x + label.box.w).toBeLessThanOrEqual(layout.width);
      expect(label.box.y + label.box.h).toBeLessThanOrEqual(layout.height);
    }
    expect(layout.labels.map(label => label.plain)).toEqual(expect.arrayContaining(["A", "B", "C", "6 cm", "8 cm", "10 cm", "≈ 36,87°", "≈ 53,13°"]));
  });

  it("escribe raíces exactas y la medida aproximada con ≈", () => {
    const layout = triangleLayout(triangle({ sides: { a: { length: 3 }, b: { length: 5 }, c: { show: "value" } }, angles: { C: { degrees: 60 } } }))!;
    const third = layout.labels.find(label => label.kind === "side" && label.plain.includes("19"));
    expect(third?.latex).toBe("\\sqrt{19}");
    const both = triangleLayout(triangle({ sides: { a: { length: 3 }, b: { length: 4 }, c: { label: "x", show: "both" } }, angles: { C: { degrees: 50 } } }, { unit: "m" }))!;
    expect(both.labels.find(label => label.kind === "side" && label.plain.startsWith("x"))?.plain).toMatch(/^x ≈ 3,0\d m$/);
  });

  it("un ángulo recto dado lleva su cuadrito y no «90°»", () => {
    const layout = triangleLayout(triangle({ sides: { a: { length: 6 }, b: { length: 8 } }, angles: { C: { degrees: 90 } } }))!;
    expect(layout.labels.some(label => label.plain === "90°")).toBe(false);
    expect(triangleLayout(triangle({ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }, { markRight: false }))!.drawings[0].marks).toEqual([]);
  });

  it("dos triángulos comparten escala y línea de base", () => {
    const layout = triangleLayout(block({ type: "triangle", triangles: [{ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }, { vertices: ["D", "E", "F"], sides: { a: { length: 6 }, b: { length: 8 }, c: { length: 10 } } }] }) as TriangleSpec)!;
    expect(layout.issues).toEqual([]);
    const [first, second] = layout.drawings;
    const span = (points: Array<{ x: number }>) => Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
    expect(span(second.points) / span(first.points)).toBeCloseTo(2, 6);
    expect(Math.max(...first.points.map(p => p.y))).toBeCloseTo(Math.max(...second.points.map(p => p.y)), 6);
    const single = block({ type: "triangle", triangles: [{ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }] });
    const pair = block({ type: "triangle", triangles: [{ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }, { sides: { a: { length: 6 }, b: { length: 8 }, c: { length: 10 } } }] });
    expect(minBlockWidth(single)).toBeLessThan(minBlockWidth(pair));
  });

  it("escribe los rótulos de texto plano en LaTeX", () => {
    expect(plainToLatex("x")).toBe("x");
    expect(plainToLatex("2x + 1")).toBe("2x + 1");
    expect(plainToLatex("lado")).toBe("\\text{lado}");
    expect(plainToLatex("AB")).toBe("AB");
    expect(plainToLatex("2,5")).toBe("2{,}5");
  });
});

describe("lo que ve la IA", () => {
  it("devuelve lados, ángulos, perímetro, área y razones del triángulo rectángulo", () => {
    const text = describeTriangles(triangle({ sides: { a: { length: 6 }, b: { length: 8 } }, angles: { C: { degrees: 90 } } }, { unit: "cm" }))!;
    expect(text).toContain("c (AB) = 10 cm");
    expect(text).toContain("A ≈ 36,87°");
    expect(text).toContain("perímetro = 24 cm");
    expect(text).toContain("área = 24 cm²");
    expect(text).toContain("Es rectángulo en C");
    expect(text).toContain("sen A = 3/5");
    expect(text).toContain("tan B = 4/3");
    const roots = describeTriangles(triangle({ sides: { a: { length: 1 }, b: { length: 2 } }, angles: { C: { degrees: 90 } } }))!;
    expect(roots).toContain("c (AB) = √5 ≈ 2,24");
    expect(roots).toContain("sen A = √5/5");
  });

  it("dice si dos triángulos son semejantes", () => {
    const pair = block({ type: "triangle", triangles: [{ sides: { a: { length: 3 }, b: { length: 4 }, c: { length: 5 } } }, { vertices: ["D", "E", "F"], sides: { a: { length: 4.5 }, b: { length: 6 }, c: { length: 7.5 } } }] });
    expect(describeComputed(pair)).toContain("semejantes");
    expect(describeComputed(pair)).toContain("razón de semejanza 3/2");
  });

  it("el resultado de la herramienta trae los valores y el error se explica", () => {
    const outcome = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "triangle", triangles: [{ sides: { a: { length: 5 }, b: { length: 12 } }, angles: { C: { degrees: 90 } } }], unit: "cm" }] });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("c (AB) = 13 cm");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Guía", role: "student", blocks: [{ type: "triangle", triangles: [{ sides: { a: { length: 2 }, b: { length: 3 }, c: { length: 7 } } }] }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("desigualdad triangular");
  });

  it("está en el esquema de la herramienta y en las instrucciones", () => {
    const serialized = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    expect(serialized).toContain('"triangle"');
    expect(CREATOR_SYSTEM_PROMPT).toContain("triangle");
  });
});

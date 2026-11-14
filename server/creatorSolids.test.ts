import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_LABELS, blockInputSchema, blockPreview, emptyDoc, type BlockInput } from "@shared/creator";
import { estimateHeight, minBlockWidth, SHEET_WIDTH_PX } from "@shared/creatorContainers";
import { segmentTouchesBox, type Point } from "@shared/creatorFigureLabels";
import { quantityText, solidFacts, solidIssues, solidLayout, type Solid, type SolidDrawing, type SolidSpec, type SolidStroke } from "@shared/creatorSolids";
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

describe("desarrollo plano", () => {
  type Face = Extract<SolidStroke, { kind: "face" }>;
  /** El desarrollo de un sólido solo, sin el dibujo en perspectiva. */
  const net = (solid: Record<string, unknown>, extra: Record<string, unknown> = {}) => solidLayout(block([{ ...solid, net: "only" }], extra));
  const faces = (drawing: SolidDrawing) => drawing.strokes.filter((stroke): stroke is Face => stroke.kind === "face");
  const bbox = (points: Point[]) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const shoelace = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => sum + p.x * points[(i + 1) % points.length].y - points[(i + 1) % points.length].x * p.y, 0)) / 2;
  const lines = (drawing: SolidDrawing, fold: boolean) => drawing.strokes.filter(stroke => stroke.kind === "line" && stroke.hidden === fold);

  it("el cubo es una cruz de seis cuadrados iguales, con las cinco líneas de doblez punteadas", () => {
    const layout = net({ kind: "cube", edge: 4 });
    expect(layout.issues).toEqual([]);
    expect(layout.drawings).toHaveLength(1);
    const [drawing] = layout.drawings;
    expect(drawing.net).toBe(true);
    const squares = faces(drawing).map(face => bbox(face.points));
    expect(squares).toHaveLength(6);
    const side = squares[0].w;
    for (const square of squares) {
      expect(square.w).toBeCloseTo(side, 6);
      expect(square.h).toBeCloseTo(side, 6);
    }
    // Cuatro en fila y dos en la misma columna, arriba y abajo de la segunda
    const row = squares.filter(square => Math.abs(square.y - squares[0].y) < 1e-6).sort((a, b) => a.x - b.x);
    expect(row).toHaveLength(4);
    row.forEach((square, i) => expect(square.x - row[0].x).toBeCloseTo(i * side, 6));
    const arms = squares.filter(square => !row.includes(square));
    expect(arms.map(arm => arm.x - row[0].x)).toEqual([expect.closeTo(side, 6), expect.closeTo(side, 6)]);
    expect(arms.map(arm => Math.round((arm.y - row[0].y) / side)).sort()).toEqual([-1, 1]);
    expect(lines(drawing, true)).toHaveLength(5);
    expect(lines(drawing, false)).toHaveLength(14);
    expect(layout.labels.map(label => label.plain)).toEqual(["4 cm"]);
  });

  it("el prisma rectangular es una cruz con sus tres medidas y su área es el área total", () => {
    const solid = { kind: "rectangular_prism", length: 8, width: 3, height: 5 };
    const layout = net(solid);
    expect(layout.issues).toEqual([]);
    const rects = faces(layout.drawings[0]).map(face => bbox(face.points));
    expect(rects).toHaveLength(6);
    // La escala sale de la cara de 8 × 5, la segunda de la fila
    const k = rects[1].w / 8;
    const sizes = rects.map(rect => [rect.w / k, rect.h / k].map(value => Math.round(value * 1e6) / 1e6).sort((a, b) => a - b).join("×")).sort();
    expect(sizes).toEqual(["3×5", "3×5", "3×8", "3×8", "5×8", "5×8"]);
    expect(layout.labels.map(label => label.plain).sort()).toEqual(["3 cm", "5 cm", "8 cm"]);
    const area = faces(layout.drawings[0]).reduce((sum, face) => sum + shoelace(face.points), 0) / k ** 2;
    expect(area).toBeCloseTo(facts(solid).total.value, 6);
  });

  it("el prisma triangular tiene dos triángulos y tres rectángulos del ancho de los lados del triángulo", () => {
    for (const [solid, widths] of [
      [{ kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10 }, [5, 6, 5]],
      [{ kind: "triangular_prism", base: 3, triangleHeight: 4, length: 9, triangle: "right" }, [4, 3, 5]],
    ] as const) {
      const layout = net(solid);
      expect(layout.issues, JSON.stringify(solid)).toEqual([]);
      const all = faces(layout.drawings[0]);
      expect(all.filter(face => face.points.length === 3)).toHaveLength(2);
      const rects = all.filter(face => face.points.length === 4).map(face => bbox(face.points));
      expect(rects).toHaveLength(3);
      const k = rects[0].h / solid.length;
      expect(rects.map(rect => rect.w / k)).toEqual(widths.map(width => expect.closeTo(width, 6)));
      expect(all.reduce((sum, face) => sum + shoelace(face.points), 0) / k ** 2).toBeCloseTo(facts(solid).total.value, 6);
      expect(layout.labels.map(label => label.plain).sort()).toEqual([`${solid.base} cm`, `${solid.length} cm`, `${solid.triangleHeight} cm`].sort());
    }
  });

  it("el cilindro es un rectángulo de largo 2πr, rotulado exacto, con dos círculos", () => {
    const solid = { kind: "cylinder", radius: 3, height: 5 };
    const layout = net(solid);
    expect(layout.issues).toEqual([]);
    const [drawing] = layout.drawings;
    const [rect] = faces(drawing).map(face => bbox(face.points));
    const k = rect.h / 5;
    expect(rect.w / k).toBeCloseTo(6 * Math.PI, 9);
    const circles = drawing.strokes.filter(stroke => stroke.kind === "curve" && stroke.closed).map(stroke => bbox((stroke as Extract<SolidStroke, { kind: "curve" }>).points));
    expect(circles).toHaveLength(2);
    for (const circle of circles) expect(circle.w / 2 / k).toBeCloseTo(3, 6);
    expect(rect.w * rect.h / k ** 2 + 2 * Math.PI * 9).toBeCloseTo(facts(solid).total.value, 9);
    const long = layout.labels.find(label => label.plain.includes("π"))!;
    expect(long.plain).toBe("6π cm");
    expect(long.latex).toBe("6\\pi\\text{ cm}");
    expect(layout.labels.map(label => label.plain).sort()).toEqual(["3 cm", "5 cm", "6π cm"]);
    expect(net({ kind: "cylinder", radius: 2.5, height: 4 }).labels.map(label => label.plain)).toContain("5π cm");
  });

  it("el largo del cilindro sigue al rótulo del radio", () => {
    const lettered = net({ kind: "cylinder", radius: 3, height: 5, radiusLabel: "r" }).labels;
    expect(lettered.find(label => label.plain === "2πr")?.latex).toBe("2\\pi r");
    // Sin el radio, el largo lo delataría
    expect(net({ kind: "cylinder", radius: 3, height: 5, radiusLabel: "" }).labels.map(label => label.plain)).toEqual(["5 cm"]);
    expect(net({ kind: "cylinder", radius: 3, height: 5, radiusLabel: "?" }).labels.map(label => label.plain).sort()).toEqual(["5 cm", "?"]);
    expect(net({ kind: "cylinder", radius: 3, height: 5 }, { showValues: false }).labels).toEqual([]);
    // El largo no es una medida del formulario ni de los datos
    expect(validateBlock(block([{ kind: "cylinder", radius: 3, height: 5, radiusLabel: "r", net: "beside" }]))).toEqual([]);
  });

  it("junto al sólido, cada sólido va en su fila con su desarrollo y del mismo color", () => {
    const layout = solidLayout(block([{ kind: "cube", edge: 4, net: "beside" }, { kind: "cone", radius: 3, height: 4 }, { kind: "cylinder", radius: 3, height: 5, net: "beside" }]));
    expect(layout.issues).toEqual([]);
    expect(layout.drawings.map(drawing => [drawing.solid, drawing.net])).toEqual([[0, false], [0, true], [1, false], [2, false], [2, true]]);
    const rowOf = (index: number) => layout.drawings.filter(drawing => drawing.solid === index).map(drawing => bbox(drawing.strokes.flatMap(stroke => (stroke.kind === "line" ? [stroke.from, stroke.to] : stroke.points))));
    const [cube, cone, cylinder] = [rowOf(0), rowOf(1), rowOf(2)];
    // El desarrollo va a la derecha de su sólido, y cada fila debajo de la anterior
    expect(cube[1].x).toBeGreaterThan(cube[0].x + cube[0].w);
    expect(cone[0].y).toBeGreaterThan(Math.max(...cube.map(box => box.y + box.h)));
    expect(cylinder[0].y).toBeGreaterThan(cone[0].y + cone[0].h);
    // Sin ningún desarrollo al lado, todos en una fila, como antes
    const only = solidLayout(block([{ kind: "cube", edge: 4, net: "only" }, { kind: "cylinder", radius: 3, height: 5 }]));
    expect(only.drawings.map(drawing => [drawing.solid, drawing.net])).toEqual([[0, true], [1, false]]);
    expect(only.height).toBeLessThan(layout.height / 2);
  });

  it("ningún rótulo de los desarrollos se monta sobre otro ni sobre un trazo, y todos quedan dentro de la figura", () => {
    const solids = [
      [{ kind: "cube", edge: 4, net: "beside", edgeLabel: "a" }, { kind: "rectangular_prism", length: 8, width: 3, height: 5, net: "beside" }, { kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10, net: "beside" }],
      [{ kind: "triangular_prism", base: 3, triangleHeight: 4, length: 9, triangle: "right", net: "only" }, { kind: "cylinder", radius: 3, height: 5, net: "only" }, { kind: "cylinder", radius: 1.5, height: 8, net: "only", heightLabel: "h" }],
    ];
    for (const set of solids) {
      const layout = solidLayout(block(set));
      expect(layout.issues).toEqual([]);
      const segments = layout.drawings.flatMap(drawing => drawing.strokes.flatMap(stroke => {
        const points = stroke.kind === "line" ? [stroke.from, stroke.to] : stroke.points;
        const closed = stroke.kind === "face" || (stroke.kind === "curve" && stroke.closed);
        return points.flatMap((p, i) => (i + 1 < points.length ? [[p, points[i + 1]]] : closed ? [[p, points[0]]] : [])) as Array<[Point, Point]>;
      }));
      layout.labels.forEach((label, i) => {
        for (const other of layout.labels.slice(i + 1)) expect(overlapping(label.box, other.box), `${label.plain} / ${other.plain}`).toBe(false);
        expect(segments.some(([p, q]) => segmentTouchesBox(p, q, label.box)), label.plain).toBe(false);
        expect(label.box.x).toBeGreaterThanOrEqual(0);
        expect(label.box.x + label.box.w).toBeLessThanOrEqual(layout.width);
        expect(label.box.y).toBeGreaterThanOrEqual(0);
        expect(label.box.y + label.box.h).toBeLessThanOrEqual(layout.height);
      });
    }
  });

  it("rechaza lo que no cabe: un desarrollo alargado o una figura más ancha que la hoja", () => {
    // El cilindro chato se dibuja; su desarrollo sería una tira
    expect(validateBlock(block([{ kind: "cylinder", radius: 5, height: 1.5 }]))).toEqual([]);
    expect(validateBlock(block([{ kind: "cylinder", radius: 5, height: 1.5, net: "beside" }])).join(" ")).toContain("el desarrollo plano del cilindro es demasiado alargado");
    const three = block([{ kind: "cube", edge: 4, net: "only" }, { kind: "rectangular_prism", length: 8, width: 3, height: 5, net: "only" }, { kind: "cylinder", radius: 3, height: 5, net: "only" }]);
    expect(solidIssues(three, () => null, SHEET_WIDTH_PX)).toEqual([]);
    expect(solidIssues(three, () => null, 400).join(" ")).toContain("no caben a lo ancho de la hoja");
    // El desarrollo solo lo tienen el cubo, los prismas y el cilindro: en un cono no se pierde en silencio
    expect(blockInputSchema.safeParse({ type: "solid", solids: [{ kind: "cylinder", radius: 3, height: 5, net: true }] }).success).toBe(false);
    const cone = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cone", radius: 3, height: 4, net: "beside" }] }] });
    expect(cone.isError).toBe(true);
    expect(cone.result).toContain("net");
  });

  it("tiene nombre, y en la hoja ocupa el alto de sus filas", () => {
    expect(blockPreview(block([{ kind: "cube", edge: 4, net: "beside" }, { kind: "cylinder", radius: 3, height: 5, net: "only" }]))).toBe("Sólidos: cubo y su desarrollo plano, desarrollo plano del cilindro");
    const rows = block([{ kind: "cube", edge: 4, net: "beside" }, { kind: "cylinder", radius: 3, height: 5, net: "beside" }]);
    const flat = block([{ kind: "cube", edge: 4 }, { kind: "cylinder", radius: 3, height: 5 }]);
    expect(estimateHeight(rows, 695)).toBeGreaterThan(1.5 * estimateHeight(flat, 695));
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

  it("describe las caras del desarrollo plano junto al área total", () => {
    const text = describeComputed(block([{ kind: "cube", edge: 4, net: "beside" }, { kind: "triangular_prism", base: 5, triangleHeight: 3, length: 8, net: "only" }, { kind: "cylinder", radius: 3, height: 5, net: "beside" }]))!;
    expect(text).toContain("área total = 96 cm²; 6 caras, 12 aristas y 8 vértices; desarrollo plano: 6 cuadrados de 4 cm de lado.");
    expect(text).toContain("desarrollo plano (dibujado sin el sólido): 2 triángulos de base 5 cm y altura 3 cm, y 3 rectángulos de 8 cm de largo y 5 cm, √61/2 ≈ 3,91 cm y √61/2 ≈ 3,91 cm de ancho.");
    expect(text).toContain("área total = 48π ≈ 150,8 cm²; desarrollo plano: un rectángulo de 6π ≈ 18,85 cm (la longitud de la circunferencia de la base) por 5 cm y 2 círculos de 3 cm de radio.");
    expect(describeComputed(block([{ kind: "rectangular_prism", length: 8, width: 3, height: 5, net: "beside" }]))).toContain("6 rectángulos, 2 de 8 × 3 cm, 2 de 8 × 5 cm y 2 de 3 × 5 cm");
  });

  it("la herramienta acepta el bloque y explica el error", () => {
    const outcome = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cone", radius: 3, height: 4, slant: true }], unit: "cm" }] });
    expect(outcome.isError, outcome.result).toBe(false);
    expect(outcome.result).toContain("generatriz = 5 cm; volumen = 12π ≈ 37,7 cm³");
    const wrong = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cube", edge: 2, edgeLabel: "2 cm" }] }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.result).toContain("es una medida");
    const withNet = executeCreatorTool(emptyDoc(), "write_section", { title: "Taller", role: "student", blocks: [{ type: "solid", solids: [{ kind: "cylinder", radius: 3, height: 5, net: "beside" }], unit: "cm" }] });
    expect(withNet.isError, withNet.result).toBe(false);
    expect(withNet.result).toContain("desarrollo plano: un rectángulo de 6π");
  });

  it("está en el esquema de la herramienta y en las instrucciones", () => {
    const schema = JSON.stringify(CREATOR_TOOLS.find(tool => tool.name === "write_section")!.input_schema);
    expect(schema).toContain('"solid"');
    expect(schema).toContain('"beside"');
    expect(CREATOR_SYSTEM_PROMPT).toContain("solid:");
    expect(CREATOR_SYSTEM_PROMPT).toContain("desarrollo plano");
  });
});

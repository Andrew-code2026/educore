import { describe, expect, it } from "vitest";
import { blockInputSchema, graphFigureSchema, graphSpecSchema, type BlockInput, type GraphFigure, type GraphTransform } from "@shared/creator";
import { describeGraph } from "@shared/creatorGraphFacts";
import { describeFigure, midpointLabel, planeFigure, sideLabel, transformPoint, transformText, vertexLabel, vertexLatex } from "@shared/creatorPlaneGeometry";
import { validateBlock } from "@shared/creatorValidate";

const block = (input: unknown): BlockInput => blockInputSchema.parse(input);
const PLANE = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 };
const issuesOf = (figures: unknown[], extra: Record<string, unknown> = {}) => validateBlock(block({ type: "graph", spec: { ...PLANE, ...extra, figures } }));
const figure = (input: unknown): GraphFigure => graphFigureSchema.parse(input);
const move = (transform: GraphTransform, x: number, y: number) => transformPoint(transform, [x, y]);

const TRIANGLE = {
  kind: "polygon",
  vertices: [
    { x: 1, y: 1, name: "A" },
    { x: 5, y: 1, name: "B" },
    { x: 5, y: 4, name: "C" },
  ],
};
const coordinates = (shape: { vertices: Array<{ x: number; y: number }> }) => shape.vertices.map(vertex => [vertex.x, vertex.y]);

describe("segmentos: distancia y punto medio", () => {
  it("calcula la longitud exacta y el punto medio", () => {
    const { original } = planeFigure(figure({ kind: "segment", vertices: [{ x: 1, y: 2, name: "A" }, { x: 4, y: 6, name: "B" }] }));
    expect(original.sides).toHaveLength(1);
    expect(original.sides[0].length).toBe(5);
    expect(original.midpoint).toEqual([2.5, 4]);
    expect(sideLabel(original.sides[0])).toBe("5");
    expect(midpointLabel(original.midpoint!)).toBe("M(2{,}5;\\, 4)");
  });

  it("una distancia irracional se escribe con ≈ en la figura y como raíz para la clave", () => {
    const segment = figure({ kind: "segment", vertices: [{ x: 0, y: 0, name: "P" }, { x: 2, y: 4, name: "Q" }] });
    const { original } = planeFigure(segment);
    expect(original.sides[0].squared).toBe(20);
    expect(sideLabel(original.sides[0])).toBe("\\approx 4{,}47");
    expect(describeFigure(segment)).toBe("Segmento PQ: P(0, 0), Q(2, 4); longitud = √20 ≈ 4,47; punto medio (1, 2).");
  });

  it("con coordenadas decimales la raíz solo se escribe si su radicando es exacto", () => {
    expect(describeFigure(figure({ kind: "segment", vertices: [{ x: 0, y: 0 }, { x: 1.5, y: 1 }] }))).toBe("Segmento: (0, 0), (1,5; 1); longitud = √3,25 ≈ 1,8; punto medio (0,75; 0,5).");
    expect(describeFigure(figure({ kind: "segment", vertices: [{ x: 0, y: 0 }, { x: 1.234, y: 1 }] }))).toContain("longitud ≈ 1,59");
  });
});

describe("polígonos", () => {
  it("calcula lados, perímetro y área de un triángulo rectángulo", () => {
    const { original } = planeFigure(figure(TRIANGLE));
    expect(original.sides.map(side => side.length)).toEqual([4, 3, 5]);
    expect(original.perimeter).toBe(12);
    expect(original.area).toBe(6);
    expect(original.midpoint).toBeNull();
    expect(describeFigure(figure(TRIANGLE))).toBe("Triángulo ABC: A(1, 1), B(5, 1), C(5, 4); lados AB = 4, BC = 3, CA = 5; perímetro = 12; área = 6.");
  });

  it("el área no depende del sentido en que se den los vértices", () => {
    const reversed = { ...TRIANGLE, vertices: [...TRIANGLE.vertices].reverse() };
    expect(planeFigure(figure(reversed)).original.area).toBe(6);
  });

  it("nombra la figura por su número de lados", () => {
    const square = { kind: "polygon", vertices: [{ x: 0, y: 0, name: "P" }, { x: 2, y: 0, name: "Q" }, { x: 2, y: 2, name: "R" }, { x: 0, y: 2, name: "S" }] };
    expect(describeFigure(figure(square))).toContain("Cuadrilátero PQRS");
    expect(describeFigure(figure(square))).toContain("perímetro = 8; área = 4.");
    const unnamed = { kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }] };
    expect(describeFigure(figure(unnamed))).toBe("Triángulo: (0, 0), (3, 0), (0, 3); lados lado 1 = 3, lado 2 = √18 ≈ 4,24, lado 3 = 3; perímetro ≈ 10,24; área = 4,5.");
  });

  it("los puntos sueltos no tienen lados", () => {
    const { original } = planeFigure(figure({ kind: "points", vertices: [{ x: 1, y: 2, name: "A" }, { x: -3, y: 0.5, name: "B" }] }));
    expect(original.sides).toEqual([]);
    expect(describeFigure(figure({ kind: "points", vertices: [{ x: 1, y: 2, name: "A" }, { x: -3, y: 0.5, name: "B" }] }))).toBe("Puntos: A(1, 2), B(-3; 0,5).");
  });
});

describe("rótulos de los vértices", () => {
  it("compone el nombre y, si se piden, las coordenadas", () => {
    expect(vertexLatex("A")).toBe("A");
    expect(vertexLatex("P1")).toBe("P_{1}");
    expect(vertexLatex("A'")).toBe("A'");
    expect(vertexLabel({ x: 2, y: -1, name: "A" }, false)).toBe("A");
    expect(vertexLabel({ x: 2, y: -1, name: "A" }, true)).toBe("A(2,\\, -1)");
    expect(vertexLabel({ x: 2.5, y: -1, name: null }, true)).toBe("(2{,}5;\\, -1)");
    expect(vertexLabel({ x: 2, y: -1, name: null }, false)).toBeNull();
    expect(vertexLabel({ x: Math.SQRT2, y: 1, name: "A'" }, true)).toBe("A' \\approx (1{,}41;\\, 1)");
  });

  it("el esquema solo admite nombres que el sistema sabe componer", () => {
    const named = (name: string) => graphFigureSchema.safeParse({ kind: "points", vertices: [{ x: 0, y: 0, name }] }).success;
    expect(["A", "b", "P1", "A'", "A''"].every(named)).toBe(true);
    expect(["", "AB", "$A$", "A_1", "1", "A'''", "\\alpha"].some(named)).toBe(false);
  });
});

describe("transformaciones", () => {
  it("traslada por un vector", () => {
    expect(move({ kind: "translation", dx: 3, dy: -2 }, 1, 1)).toEqual([4, -1]);
    expect(move({ kind: "translation", dx: 0.1, dy: 0.2 }, 0.2, 0.1)).toEqual([0.3, 0.3]);
  });

  it("refleja respecto a los ejes, a una vertical y a una recta cualquiera", () => {
    expect(move({ kind: "reflection", over: "x" }, 2, 3)).toEqual([2, -3]);
    expect(move({ kind: "reflection", over: "y" }, 2, 3)).toEqual([-2, 3]);
    expect(move({ kind: "reflection", over: "vertical", at: 1 }, 4, 3)).toEqual([-2, 3]);
    expect(move({ kind: "reflection", over: "line", slope: 1, intercept: 0 }, 2, 5)).toEqual([5, 2]);
    expect(move({ kind: "reflection", over: "line", slope: -1, intercept: 0 }, 2, 5)).toEqual([-5, -2]);
    expect(move({ kind: "reflection", over: "line", slope: 0, intercept: 2 }, 3, 5)).toEqual([3, -1]);
    expect(move({ kind: "reflection", over: "line", slope: 2, intercept: 1 }, 3, 2)).toEqual([-1, 4]);
    // Un punto de la recta no se mueve
    expect(move({ kind: "reflection", over: "line", slope: 2, intercept: 1 }, 1, 3)).toEqual([1, 3]);
    // Sin los datos de la recta no hay imagen
    expect(move({ kind: "reflection", over: "line" }, 1, 3)).toBeNull();
    expect(move({ kind: "reflection", over: "vertical" }, 1, 3)).toBeNull();
  });

  it("rota con coordenadas exactas en los múltiplos de 90°", () => {
    expect(move({ kind: "rotation", cx: 0, cy: 0, angle: 90 }, 3, 1)).toEqual([-1, 3]);
    expect(move({ kind: "rotation", cx: 0, cy: 0, angle: 180 }, 3, 1)).toEqual([-3, -1]);
    expect(move({ kind: "rotation", cx: 0, cy: 0, angle: 270 }, 3, 1)).toEqual([1, -3]);
    expect(move({ kind: "rotation", cx: 0, cy: 0, angle: -90 }, 3, 1)).toEqual([1, -3]);
    expect(move({ kind: "rotation", cx: 1, cy: 2, angle: 90 }, 4, 2)).toEqual([1, 5]);
    expect(move({ kind: "rotation", cx: 0, cy: 0, angle: 360 }, 3, 1)).toEqual([3, 1]);
  });

  it("una rotación de 45° da coordenadas irracionales, que se escriben con ≈", () => {
    const [x, y] = move({ kind: "rotation", cx: 0, cy: 0, angle: 45 }, 2, 0)!;
    expect(x).toBeCloseTo(Math.SQRT2, 10);
    expect(y).toBeCloseTo(Math.SQRT2, 10);
    const rotated = figure({ kind: "points", vertices: [{ x: 2, y: 0, name: "A" }], transform: { kind: "rotation", cx: 0, cy: 0, angle: 45 } });
    expect(describeFigure(rotated)).toBe("Punto: A(2, 0). Su imagen por la rotación de 45° en sentido antihorario alrededor de (0, 0): Punto: A' ≈ (1,41; 1,41).");
  });

  it("la homotecia multiplica las distancias al centro", () => {
    expect(move({ kind: "dilation", cx: 0, cy: 0, factor: 2 }, 1, 3)).toEqual([2, 6]);
    expect(move({ kind: "dilation", cx: 1, cy: 1, factor: 0.5 }, 5, 3)).toEqual([3, 2]);
    expect(move({ kind: "dilation", cx: 0, cy: 0, factor: -1 }, 2, 3)).toEqual([-2, -3]);
  });

  it("la imagen de un triángulo lleva los nombres primados y sus propias medidas", () => {
    const reflected = figure({ ...TRIANGLE, transform: { kind: "reflection", over: "y" } });
    const { image } = planeFigure(reflected);
    expect(coordinates(image!)).toEqual([
      [-1, 1],
      [-5, 1],
      [-5, 4],
    ]);
    expect(image!.vertices.map(vertex => vertex.name)).toEqual(["A'", "B'", "C'"]);
    // Una reflexión conserva longitudes y área
    expect(image!.sides.map(side => side.length)).toEqual([4, 3, 5]);
    expect(image!.area).toBe(6);

    const scaled = planeFigure(figure({ ...TRIANGLE, transform: { kind: "dilation", cx: 1, cy: 1, factor: -0.5 } })).image!;
    expect(coordinates(scaled)).toEqual([
      [1, 1],
      [-1, 1],
      [-1, -0.5],
    ]);
    // Una homotecia de razón k multiplica el área por k²
    expect(scaled.area).toBe(1.5);
  });

  it("describe cada transformación en palabras", () => {
    expect(transformText({ kind: "translation", dx: 3, dy: -2 })).toBe("traslación de vector (3, -2)");
    expect(transformText({ kind: "reflection", over: "x" })).toBe("reflexión respecto al eje x");
    expect(transformText({ kind: "reflection", over: "vertical", at: 2 })).toBe("reflexión respecto a la recta x = 2");
    expect(transformText({ kind: "reflection", over: "line", slope: 1, intercept: 0 })).toBe("reflexión respecto a la recta $y = x$");
    expect(transformText({ kind: "reflection", over: "line", slope: -2, intercept: 1.5 })).toBe("reflexión respecto a la recta $y = -2x + 1{,}5$");
    expect(transformText({ kind: "rotation", cx: 0, cy: 0, angle: -90 })).toBe("rotación de 90° en sentido horario alrededor de (0, 0)");
    expect(transformText({ kind: "dilation", cx: 1, cy: 2, factor: 0.5 })).toBe("homotecia de centro (1, 2) y razón 0,5");
  });

  it("describeGraph devuelve la figura y su imagen para la clave", () => {
    const spec = graphSpecSchema.parse({ ...PLANE, figures: [{ ...TRIANGLE, transform: { kind: "rotation", cx: 0, cy: 0, angle: 90 } }] });
    expect(describeGraph(spec)).toBe(
      "Gráfica: Triángulo ABC: A(1, 1), B(5, 1), C(5, 4); lados AB = 4, BC = 3, CA = 5; perímetro = 12; área = 6. Su imagen por la rotación de 90° en sentido antihorario alrededor de (0, 0): Triángulo A'B'C': A'(-1, 1), B'(-1, 5), C'(-4, 5); lados A'B' = 4, B'C' = 3, C'A' = 5; perímetro = 12; área = 6.",
    );
  });
});

describe("validación de la geometría del plano", () => {
  it("acepta figuras bien formadas con y sin transformación", () => {
    expect(issuesOf([TRIANGLE])).toEqual([]);
    expect(issuesOf([{ ...TRIANGLE, show: ["coordinates", "lengths"], transform: { kind: "translation", dx: -6, dy: -5 } }])).toEqual([]);
    expect(issuesOf([{ kind: "segment", vertices: [{ x: -2, y: 1, name: "A" }, { x: 4, y: 5, name: "B" }], show: ["lengths", "midpoint"] }])).toEqual([]);
    expect(issuesOf([{ kind: "points", vertices: [{ x: 2, y: 3, name: "P" }], show: ["coordinates"], transform: { kind: "reflection", over: "line", slope: 1, intercept: 0 } }])).toEqual([]);
  });

  it("rechaza un segmento o un polígono con el número de vértices equivocado", () => {
    expect(issuesOf([{ kind: "segment", vertices: TRIANGLE.vertices }])[0]).toContain("un segmento lleva exactamente dos");
    expect(issuesOf([{ kind: "polygon", vertices: TRIANGLE.vertices.slice(0, 2) }])[0]).toContain("necesita al menos tres");
  });

  it("rechaza vértices fuera del plano, repetidos o alineados, y nombres duplicados", () => {
    expect(issuesOf([{ ...TRIANGLE, vertices: [{ x: 1, y: 1, name: "A" }, { x: 12, y: 1, name: "B" }, { x: 5, y: 4, name: "C" }] }])[0]).toContain("el vértice B(12, 1) de la figura 1 (triángulo ABC) queda fuera del plano");
    expect(issuesOf([{ kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }])[0]).toContain("están alineados");
    expect(issuesOf([{ kind: "segment", vertices: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }])[0]).toContain("dos vértices en el mismo punto (1, 1)");
    expect(issuesOf([{ kind: "points", vertices: [{ x: 1, y: 1, name: "A" }, { x: 2, y: 1, name: "A" }] }])[0]).toContain("dos vértices llamados A");
  });

  it("rechaza pedir lo que la figura no tiene", () => {
    expect(issuesOf([{ ...TRIANGLE, show: ["midpoint"] }])[0]).toContain('un polígono no tiene "midpoint"');
    expect(issuesOf([{ kind: "points", vertices: [{ x: 1, y: 1 }], show: ["lengths"] }])[0]).toContain('no tiene "lengths"');
  });

  it("rechaza una imagen que se sale del plano, con sus coordenadas", () => {
    const issues = issuesOf([{ ...TRIANGLE, transform: { kind: "dilation", cx: 0, cy: 0, factor: 2 } }]);
    expect(issues).toEqual([
      "Gráfica: la imagen B'(10, 2) de la figura 1 (triángulo ABC) queda fuera del plano; amplía el rango.",
      "Gráfica: la imagen C'(10, 8) de la figura 1 (triángulo ABC) queda fuera del plano; amplía el rango.",
    ]);
  });

  it("rechaza una transformación mal armada o que no mueve la figura", () => {
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "reflection", over: "line", slope: 1 } }])[0]).toContain("necesita su pendiente (slope) y su corte con el eje y (intercept)");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "reflection", over: "vertical" } }])[0]).toContain("necesita at");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "reflection", over: "x", at: 2 } }])[0]).toContain('at solo va con over "vertical"');
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "reflection", over: "y", slope: 1 } }])[0]).toContain('solo van con over "line"');
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "reflection", over: "vertical", at: 20 } }])[0]).toContain("no pasa por el plano");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "dilation", cx: 0, cy: 0, factor: 0 } }])[0]).toContain("no puede ser 0");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "rotation", cx: 20, cy: 0, angle: 90 } }])[0]).toContain("el centro (20, 0) de la rotación");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "translation", dx: 0, dy: 0 } }])[0]).toContain("la imagen coincide con la figura");
    expect(issuesOf([{ ...TRIANGLE, transform: { kind: "rotation", cx: 0, cy: 0, angle: 360 } }])[0]).toContain("la imagen coincide con la figura");
  });

  it("exige la misma unidad en los dos ejes, como con las cónicas", () => {
    const issues = issuesOf([TRIANGLE], { xMin: 0, xMax: 6, yMin: 0, yMax: 60, yStep: 10 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("con figuras geométricas el plano debe tener la misma unidad");
  });

  it("el esquema limita las figuras y los vértices", () => {
    const many = Array.from({ length: 5 }, () => TRIANGLE);
    expect(graphSpecSchema.safeParse({ ...PLANE, figures: many }).success).toBe(false);
    const vertices = Array.from({ length: 9 }, (_, i) => ({ x: i, y: i * i }));
    expect(graphFigureSchema.safeParse({ kind: "polygon", vertices }).success).toBe(false);
    expect(graphFigureSchema.safeParse({ kind: "polygon", vertices: [] }).success).toBe(false);
  });
});

describe("figuras en un plano en múltiplos de π", () => {
  const onAxis = { kind: "points", vertices: [{ x: Math.PI, y: 0, name: "P" }, { x: 1, y: 2, name: "Q" }] };

  it("las abscisas que son múltiplos de π se escriben con π, como los puntos notables del mismo plano", () => {
    expect(vertexLabel({ x: Math.PI / 2, y: 1, name: "A" }, true, true)).toBe("A(\\frac{\\pi}{2},\\, 1)");
    expect(vertexLabel({ x: Math.PI / 2, y: 1, name: "A" }, true)).toBe("A \\approx (1{,}57;\\, 1)");
    expect(midpointLabel([Math.PI, 0.5], true)).toBe("M(\\pi;\\, 0{,}5)");
    expect(describeFigure(figure(onAxis), true)).toBe("Puntos: P(π, 0), Q(1, 2).");
    expect(describeFigure(figure(onAxis))).toBe("Puntos: P ≈ (3,14; 0), Q(1, 2).");
  });

  it("describeGraph usa la unidad del eje del plano", () => {
    const spec = graphSpecSchema.parse({ xMin: -6.2832, xMax: 6.2832, yMin: -2, yMax: 2, xStep: 1.5708, xUnit: "pi", figures: [onAxis] });
    expect(describeGraph(spec)).toBe("Gráfica: Puntos: P(π, 0), Q(1, 2).");
  });
});

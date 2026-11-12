import { blockInputSchema, emptyDoc, type BlockInput, type ResourceDoc, type SectionRole } from "./creator";
import { applyDocOp } from "./creatorOps";

/**
 * Recurso de ejemplo escrito a mano. Sirve de referencia de calidad para la IA (es el
 * nivel que debe alcanzar), de demostración sin clave configurada y de documento fijo
 * para probar los renderizadores y la hoja de impresión.
 */
export const SAMPLE_TITLE = "Funciones lineales y cuadráticas";
export const SAMPLE_SUBTITLE = "Guía de práctica · Matemáticas · Grado 9";

const STUDENT: unknown[] = [
  { type: "header_fields", fields: ["Nombre", "Fecha", "Grado"] },
  {
    type: "paragraph",
    md: "En esta guía vas a trabajar con dos funciones que aparecen todo el tiempo en matemáticas y en la vida diaria: la **función lineal**, cuya gráfica es una recta, y la **función cuadrática**, cuya gráfica es una parábola. Primero revisa las dos gráficas de referencia con sus tablas de valores; después resuelve los seis ejercicios, que van de lo básico a lo avanzado.",
  },
  {
    type: "callout",
    title: "Conceptos clave",
    md: "- **Pendiente:** en $y = mx + b$, el número $m$ indica cuánto sube o baja la recta cada vez que $x$ aumenta una unidad.\n- **Intercepto con el eje y:** punto donde la gráfica cruza el eje $y$. En $y = mx + b$ es $(0, b)$.\n- **Vértice:** el punto más bajo (o más alto) de una parábola.\n- **Raíces:** los valores de $x$ donde la gráfica corta el eje $x$, es decir, donde $y = 0$.",
  },
  { type: "heading", text: "Referencia 1: función lineal" },
  {
    type: "paragraph",
    md: "La gráfica muestra la función $y = 2x - 3$ para $x$ entre $-2$ y $4$. Fíjate en los dos puntos marcados: el intercepto con el eje $y$, $(0, -3)$, y el intercepto con el eje $x$, $(1.5, 0)$.",
  },
  {
    type: "graph",
    caption: "Gráfica de $y = 2x - 3$",
    spec: {
      xMin: -2,
      xMax: 4,
      yMin: -7,
      yMax: 5,
      functions: [{ expr: "2*x - 3", label: "y = 2x - 3" }],
      points: [
        { x: 0, y: -3, label: "(0, -3)", on: 0 },
        { x: 1.5, y: 0, label: "(1.5, 0)", on: 0 },
      ],
    },
  },
  { type: "value_table", expr: "2*x - 3", exprLatex: "y = 2x - 3", xs: [-1, 0, 1, 2, 3] },
  { type: "heading", text: "Referencia 2: función cuadrática" },
  {
    type: "paragraph",
    md: "La gráfica muestra la función $y = x^{2} - 4x + 3$ para $x$ entre $-1$ y $5$. Observa el vértice, $(2, -1)$, y las dos raíces, $(1, 0)$ y $(3, 0)$. La parábola es simétrica respecto a la recta vertical que pasa por el vértice.",
  },
  {
    type: "graph",
    caption: "Gráfica de $y = x^{2} - 4x + 3$",
    spec: {
      xMin: -1,
      xMax: 5,
      yMin: -2,
      yMax: 8,
      functions: [{ expr: "x^2 - 4*x + 3", label: "y = x^{2} - 4x + 3" }],
      points: [
        { x: 2, y: -1, label: "(2, -1)", on: 0 },
        { x: 1, y: 0, label: "(1, 0)", on: 0 },
        { x: 3, y: 0, label: "(3, 0)", on: 0 },
      ],
    },
  },
  { type: "value_table", expr: "x^2 - 4*x + 3", exprLatex: "y = x^{2} - 4x + 3", xs: [0, 1, 2, 3, 4] },
  { type: "heading", text: "Ejercicios" },
  {
    type: "paragraph",
    md: "Resuelve cada ejercicio en el espacio indicado y **muestra todo tu procedimiento**: en matemáticas el camino cuenta tanto como la respuesta.",
  },
  {
    type: "exercise",
    label: "Ejercicio 1",
    md: "Para la función $y = -3x + 6$, identifica la pendiente y el intercepto con el eje $y$. Explica qué significa el signo de la pendiente.",
    lines: 3,
  },
  {
    type: "exercise",
    label: "Ejercicio 2",
    md: "Calcula el vértice de la parábola $y = x^{2} - 6x + 5$. Usa la fórmula $x = -\\frac{b}{2a}$ para hallar la coordenada $x$ y luego reemplaza para hallar $y$.",
    lines: 5,
  },
  {
    type: "exercise",
    label: "Ejercicio 3",
    md: "Grafica la función $y = \\frac{1}{2}x + 1$ en el plano de abajo. Ubica al menos dos puntos antes de trazar la recta.",
    answerSpace: "none",
  },
  {
    type: "graph",
    caption: "Plano para graficar el Ejercicio 3",
    spec: { xMin: -4, xMax: 4, yMin: -3, yMax: 5 },
  },
  {
    type: "exercise",
    label: "Ejercicio 4",
    md: "Encuentra las raíces de la función $y = x^{2} + 2x - 8$ usando la fórmula general $$x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}$$ Verifica tus resultados reemplazando cada raíz en la función.",
    lines: 6,
  },
  {
    type: "exercise",
    label: "Ejercicio 5",
    md: "Un parqueadero en Medellín cobra \\$3.000 por ingresar y \\$1.500 por cada hora que el carro permanece adentro.",
    parts: [
      { label: "a", md: "Escribe la función $C(x)$ que da el costo total en pesos si el carro permanece $x$ horas." },
      { label: "b", md: "¿Cuánto se paga por 4 horas?" },
      { label: "c", md: "Si alguien pagó \\$12.000, ¿cuántas horas estuvo el carro?" },
    ],
    lines: 6,
  },
  // La gráfica es un dato del reto: va antes del enunciado, presentada por un párrafo, y los renglones quedan al final
  {
    type: "paragraph",
    md: "**Reto opcional.** La gráfica muestra una recta y una parábola dibujadas en el mismo plano.",
  },
  {
    type: "graph",
    caption: "Gráfica de $y = x + 1$ y $y = x^{2} - 2x + 1$ en el mismo plano",
    spec: {
      xMin: -2,
      xMax: 5,
      yMin: -1,
      yMax: 7,
      functions: [
        { expr: "x + 1", label: "y = x + 1" },
        { expr: "x^2 - 2*x + 1", label: "y = x^{2} - 2x + 1" },
      ],
    },
  },
  {
    type: "exercise",
    label: "Ejercicio 6 (reto opcional)",
    md: "Determina los puntos donde se cortan la recta $y = x + 1$ y la parábola $y = x^{2} - 2x + 1$. Iguala las dos expresiones, resuelve la ecuación que resulta y comprueba tus respuestas en la gráfica de arriba.",
    lines: 6,
  },
];

const ANSWER_KEY: unknown[] = [
  {
    type: "paragraph",
    md: "Respuestas con el procedimiento paso a paso, para revisar en clase o calificar.",
  },
  {
    type: "solution",
    label: "Ejercicio 1",
    steps: [
      "La función $y = -3x + 6$ ya está en la forma $y = mx + b$, así que se lee directamente: $m = -3$ y $b = 6$.",
      "La pendiente es negativa: por cada unidad que aumenta $x$, $y$ baja 3 unidades. La recta desciende de izquierda a derecha.",
    ],
    answer: "Pendiente $m = -3$; intercepto con el eje $y$ en $(0, 6)$.",
  },
  {
    type: "solution",
    label: "Ejercicio 2",
    steps: [
      "Se identifican los coeficientes: $a = 1$, $b = -6$, $c = 5$.",
      "Coordenada $x$ del vértice: $$x = -\\frac{b}{2a} = -\\frac{-6}{2(1)} = 3$$",
      "Se reemplaza $x = 3$ en la función: $$y = (3)^{2} - 6(3) + 5 = 9 - 18 + 5 = -4$$",
    ],
    answer: "El vértice es $(3, -4)$. Como $a > 0$, la parábola abre hacia arriba y ese es su punto más bajo.",
  },
  {
    type: "solution",
    label: "Ejercicio 3",
    steps: [
      "Se eligen dos valores de $x$ fáciles de calcular. Para $x = 0$: $y = \\frac{1}{2}(0) + 1 = 1$. Para $x = 2$: $y = \\frac{1}{2}(2) + 1 = 2$.",
      "Se ubican los puntos $(0, 1)$ y $(2, 2)$ y se traza la recta que pasa por ambos. La pendiente $\\frac{1}{2}$ significa que sube 1 unidad por cada 2 que avanza.",
    ],
  },
  {
    type: "graph",
    caption: "Gráfica de $y = \\frac{1}{2}x + 1$",
    spec: {
      xMin: -4,
      xMax: 4,
      yMin: -3,
      yMax: 5,
      functions: [{ expr: "x/2 + 1", label: "y = \\frac{1}{2}x + 1" }],
      points: [
        { x: 0, y: 1, label: "(0, 1)", on: 0 },
        { x: 2, y: 2, label: "(2, 2)", on: 0 },
      ],
    },
  },
  {
    type: "solution",
    label: "Ejercicio 4",
    steps: [
      "Coeficientes: $a = 1$, $b = 2$, $c = -8$.",
      "Discriminante: $$b^{2} - 4ac = (2)^{2} - 4(1)(-8) = 4 + 32 = 36$$",
      "Fórmula general: $$x = \\frac{-2 \\pm \\sqrt{36}}{2(1)} = \\frac{-2 \\pm 6}{2}$$",
      "Las dos soluciones son $x = \\frac{-2 + 6}{2} = 2$ y $x = \\frac{-2 - 6}{2} = -4$.",
      "Verificación: $(2)^{2} + 2(2) - 8 = 0$ y $(-4)^{2} + 2(-4) - 8 = 0$.",
    ],
    answer: "Las raíces son $x = 2$ y $x = -4$.",
  },
  {
    type: "solution",
    label: "Ejercicio 5",
    steps: [
      "**a.** El ingreso es un cargo fijo y cada hora suma \\$1.500: $$C(x) = 3000 + 1500x$$",
      "**b.** Para 4 horas: $$C(4) = 3000 + 1500(4) = 3000 + 6000 = 9000$$",
      "**c.** Se iguala el costo a 12.000 y se despeja $x$: $$3000 + 1500x = 12000 \\quad\\Rightarrow\\quad 1500x = 9000 \\quad\\Rightarrow\\quad x = 6$$",
    ],
    answer: "a. $C(x) = 3000 + 1500x$ · b. \\$9.000 · c. 6 horas.",
  },
  {
    type: "solution",
    label: "Ejercicio 6",
    steps: [
      "Se igualan las dos funciones: $$x + 1 = x^{2} - 2x + 1$$",
      "Se pasa todo a un lado: $$0 = x^{2} - 3x \\quad\\Rightarrow\\quad x(x - 3) = 0$$",
      "El producto es cero cuando $x = 0$ o $x = 3$.",
      "Se reemplaza en la recta para hallar $y$: con $x = 0$, $y = 1$; con $x = 3$, $y = 4$.",
    ],
    answer: "Se cortan en $(0, 1)$ y $(3, 4)$.",
  },
  {
    type: "graph",
    caption: "Los dos puntos de corte",
    spec: {
      xMin: -2,
      xMax: 5,
      yMin: -1,
      yMax: 7,
      functions: [
        { expr: "x + 1", label: "y = x + 1" },
        { expr: "x^2 - 2*x + 1", label: "y = x^{2} - 2x + 1" },
      ],
      points: [
        { x: 0, y: 1, label: "(0, 1)", on: 0 },
        { x: 3, y: 4, label: "(3, 4)", on: 1 },
      ],
    },
  },
];

/* ── Segundo ejemplo: primaria, con las figuras que no son el plano cartesiano ── */

const FRUIT_SALES = [
  { label: "Mango", value: 12 },
  { label: "Banano", value: 9 },
  { label: "Guayaba", value: 6 },
  { label: "Mandarina", value: 3 },
];

const PRIMARY_STUDENT: unknown[] = [
  { type: "header_fields", fields: ["Nombre", "Fecha", "Grado"] },
  {
    type: "paragraph",
    md: "Este repaso reúne cuatro temas del periodo: **fracciones equivalentes**, **suma de fracciones en la recta numérica**, **lectura de datos** y **perímetro y área**. Cierra con un reto de balanzas. Trabaja con lápiz y deja escrito cómo llegaste a cada respuesta.",
  },
  {
    type: "callout",
    title: "Para recordar",
    md: "- Dos fracciones son **equivalentes** cuando representan la misma parte del entero: $\\frac{1}{2} = \\frac{2}{4}$.\n- Para sumar fracciones con **igual denominador** se suman los numeradores y el denominador se conserva.\n- El **perímetro** es la medida del borde de una figura; el **área** es la medida de su superficie.",
  },
  { type: "heading", text: "Parte 1: fracciones equivalentes" },
  {
    type: "paragraph",
    md: "Los tres círculos son del mismo tamaño, pero están partidos de forma distinta. Fíjate en que la parte sombreada es la misma en los tres.",
  },
  {
    type: "fraction_model",
    shape: "circle",
    operator: "equals",
    models: [
      { numerator: 1, denominator: 2 },
      { numerator: 2, denominator: 4 },
      { numerator: 4, denominator: 8 },
    ],
    caption: "Tres maneras de partir el círculo, la misma parte sombreada",
  },
  {
    type: "exercise",
    label: "Ejercicio 1",
    md: "Sombrea $\\frac{1}{3}$ en la primera barra. Luego sombrea en la segunda barra una fracción equivalente y escríbela al lado.",
    // Se resuelve sobre la figura que sigue: sin renglones entre el enunciado y las barras
    answerSpace: "none",
  },
  {
    type: "fraction_model",
    shape: "bar",
    operator: "equals",
    showLabels: false,
    models: [
      { numerator: 0, denominator: 3 },
      { numerator: 0, denominator: 6 },
    ],
  },
  { type: "heading", text: "Parte 2: sumar en la recta numérica" },
  {
    type: "paragraph",
    md: "Camila caminó $\\frac{3}{4}$ de kilómetro hasta la panadería y después $\\frac{2}{4}$ de kilómetro hasta el colegio. Cada salto de la recta muestra un tramo del recorrido.",
  },
  {
    type: "number_line",
    min: 0,
    max: 2,
    step: 0.25,
    fractionDenominator: 4,
    points: [{ value: 1.25, label: "\\frac{5}{4}" }],
    jumps: [
      { from: 0, to: 0.75, label: "+\\frac{3}{4}" },
      { from: 0.75, to: 1.25, label: "+\\frac{2}{4}" },
    ],
    caption: "$\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$ de kilómetro",
  },
  {
    type: "exercise",
    label: "Ejercicio 2",
    md: "Usa la recta para resolver $\\frac{3}{8} + \\frac{4}{8}$. Dibuja los dos saltos, marca el resultado y escríbelo encima del punto.",
    answerSpace: "none",
  },
  { type: "number_line", min: 0, max: 1, step: 0.125, fractionDenominator: 8 },
  { type: "heading", text: "Parte 3: las frutas de la tienda escolar" },
  {
    type: "paragraph",
    md: "La tienda escolar anotó cuántas frutas vendió el lunes. La tabla y el diagrama de barras muestran los mismos datos.",
  },
  {
    type: "table",
    header: ["Fruta", "Cantidad vendida"],
    rows: FRUIT_SALES.map(item => [item.label, String(item.value)]),
    firstColumnHeader: true,
  },
  {
    type: "bar_chart",
    title: "Frutas vendidas el lunes",
    xLabel: "Fruta",
    yLabel: "Cantidad",
    yStep: 3,
    bars: FRUIT_SALES,
  },
  {
    type: "exercise",
    label: "Ejercicio 3",
    md: "Responde a partir de la tabla y el diagrama.",
    parts: [
      { label: "a", md: "¿Cuántas frutas se vendieron en total?" },
      { label: "b", md: "¿Cuántos mangos más que mandarinas se vendieron?" },
      { label: "c", md: "¿Qué fracción del total fueron guayabas? Simplifícala." },
    ],
    lines: 4,
  },
  {
    type: "exercise",
    label: "Ejercicio 4",
    md: "Construye el diagrama circular de las ventas. Cada marca del borde vale $10^\\circ$: calcula primero el ángulo de cada fruta.",
    answerSpace: "none",
  },
  { type: "pie_chart", blank: true, slices: FRUIT_SALES },
  { type: "heading", text: "Parte 4: la huerta del colegio" },
  {
    type: "paragraph",
    md: "La huerta tiene tres zonas: una rectangular para las hortalizas, una triangular para las aromáticas y una circular para el compost.",
  },
  {
    type: "shapes",
    figures: [
      { kind: "rectangle", width: 6, height: 4, widthLabel: "6 m", heightLabel: "4 m" },
      { kind: "triangle", base: 6, height: 4, apex: 0, baseLabel: "6 m", heightLabel: "4 m" },
      { kind: "circle", radius: 2, show: "radius", label: "2 m" },
    ],
    caption: "Las tres zonas de la huerta, a la misma escala",
  },
  {
    type: "exercise",
    label: "Ejercicio 5",
    md: "Calcula el perímetro y el área de la zona rectangular, y el área de la zona triangular. Escribe las unidades.",
    lines: 5,
  },
  { type: "heading", text: "Parte 5: reto de la balanza" },
  // La figura es el dato del ejercicio: va antes del enunciado, y los renglones quedan al final
  { type: "balance", variable: "x", left: { variables: 2, units: 1 }, right: { variables: 0, units: 7 } },
  {
    type: "exercise",
    label: "Ejercicio 6 (reto)",
    md: "La balanza está en equilibrio. Cada caja pesa lo mismo y cada ficha pesa 1 kilo. ¿Cuánto pesa una caja? Explica cómo lo averiguaste.",
    lines: 3,
  },
];

const PRIMARY_ANSWER_KEY: unknown[] = [
  { type: "paragraph", md: "Respuestas con su procedimiento, para revisar en clase." },
  {
    type: "solution",
    label: "Ejercicio 1",
    steps: ["Se sombrea 1 de las 3 partes de la primera barra.", "En la segunda barra cada tercio quedó partido en dos, así que la misma porción son 2 de las 6 partes."],
    answer: "$\\frac{1}{3} = \\frac{2}{6}$",
  },
  {
    type: "fraction_model",
    shape: "bar",
    operator: "equals",
    models: [
      { numerator: 1, denominator: 3 },
      { numerator: 2, denominator: 6 },
    ],
  },
  {
    type: "solution",
    label: "Ejercicio 2",
    steps: ["El primer salto va de $0$ a $\\frac{3}{8}$.", "El segundo salto avanza $\\frac{4}{8}$ más: se suman los numeradores, $3 + 4 = 7$, y el denominador se conserva."],
    answer: "$\\frac{3}{8} + \\frac{4}{8} = \\frac{7}{8}$",
  },
  {
    type: "number_line",
    min: 0,
    max: 1,
    step: 0.125,
    fractionDenominator: 8,
    points: [{ value: 0.875, label: "\\frac{7}{8}" }],
    jumps: [
      { from: 0, to: 0.375, label: "+\\frac{3}{8}" },
      { from: 0.375, to: 0.875, label: "+\\frac{4}{8}" },
    ],
  },
  {
    type: "solution",
    label: "Ejercicio 3",
    steps: [
      "**a.** Se suman las cuatro cantidades: $12 + 9 + 6 + 3 = 30$ frutas.",
      "**b.** Mangos menos mandarinas: $12 - 3 = 9$.",
      "**c.** Guayabas sobre el total: $\\frac{6}{30}$. Al dividir arriba y abajo entre 6 queda $\\frac{1}{5}$.",
    ],
    answer: "a. 30 frutas · b. 9 mangos más · c. $\\frac{1}{5}$",
  },
  {
    type: "solution",
    label: "Ejercicio 4",
    steps: [
      "El círculo completo mide $360^\\circ$ y representa las 30 frutas, así que cada fruta vale $360^\\circ \\div 30 = 12^\\circ$.",
      "Mango: $12 \\times 12^\\circ = 144^\\circ$. Banano: $9 \\times 12^\\circ = 108^\\circ$. Guayaba: $6 \\times 12^\\circ = 72^\\circ$. Mandarina: $3 \\times 12^\\circ = 36^\\circ$.",
      "Comprobación: $144^\\circ + 108^\\circ + 72^\\circ + 36^\\circ = 360^\\circ$.",
    ],
  },
  { type: "pie_chart", title: "Frutas vendidas el lunes", slices: FRUIT_SALES },
  {
    type: "solution",
    label: "Ejercicio 5",
    steps: [
      "Perímetro del rectángulo: $2 \\times (6 + 4) = 20$ m.",
      "Área del rectángulo: $6 \\times 4 = 24$ m².",
      "Área del triángulo: $\\frac{6 \\times 4}{2} = 12$ m². Es la mitad del rectángulo porque tienen la misma base y la misma altura.",
    ],
    answer: "Rectángulo: perímetro 20 m y área 24 m². Triángulo: área 12 m².",
  },
  {
    type: "solution",
    label: "Ejercicio 6",
    steps: [
      "La balanza dice que dos cajas y una ficha pesan lo mismo que siete fichas: $2x + 1 = 7$.",
      "Se quita una ficha de cada lado y la balanza sigue en equilibrio: $2x = 6$.",
      "Si dos cajas pesan 6 kilos, una pesa la mitad: $x = 3$.",
    ],
    answer: "Cada caja pesa 3 kilos.",
  },
];

const parseBlocks = (blocks: unknown[]): BlockInput[] => blocks.map(block => blockInputSchema.parse(block));

export const SAMPLE_IDS = ["funciones", "primaria"] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export interface SampleDefinition {
  title: string;
  subtitle: string;
  subjectLabel: string;
  gradeLabel: string;
  /** Texto del botón que lo abre. */
  label: string;
  /** Secciones como las escribiría la IA: bloques sin identificador. */
  sections: Array<{ title: string; role: SectionRole; blocks: BlockInput[] }>;
}

export const SAMPLES: Record<SampleId, SampleDefinition> = {
  funciones: {
    title: SAMPLE_TITLE,
    subtitle: SAMPLE_SUBTITLE,
    subjectLabel: "Matemáticas",
    gradeLabel: "9°",
    label: "Funciones (9°)",
    sections: [
      { title: "Guía del estudiante", role: "student", blocks: parseBlocks(STUDENT) },
      { title: "Clave de respuestas", role: "answer_key", blocks: parseBlocks(ANSWER_KEY) },
    ],
  },
  primaria: {
    title: "Fracciones, datos y figuras",
    subtitle: "Repaso del periodo · Matemáticas · Grado 5",
    subjectLabel: "Matemáticas",
    gradeLabel: "5°",
    label: "Fracciones y datos (5°)",
    sections: [
      { title: "Guía del estudiante", role: "student", blocks: parseBlocks(PRIMARY_STUDENT) },
      { title: "Clave de respuestas", role: "answer_key", blocks: parseBlocks(PRIMARY_ANSWER_KEY) },
    ],
  },
};

/** Secciones del primer ejemplo (se conserva el nombre para quienes ya lo usan). */
export const SAMPLE_SECTIONS = SAMPLES.funciones.sections;

export function buildSampleDoc(id: SampleId = "funciones", random?: () => number): ResourceDoc {
  const sample = SAMPLES[id];
  let doc: ResourceDoc = { ...emptyDoc(sample.title), subtitle: sample.subtitle };
  for (const section of sample.sections) {
    const result = applyDocOp(doc, { op: "write_section", ...section }, random);
    if (!result.ok) throw new Error(result.error);
    doc = result.doc;
  }
  return doc;
}

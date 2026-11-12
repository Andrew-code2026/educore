import { z } from "zod";
import { VENN_REGIONS } from "./creatorDiagrams";
import { MATH_EXPR_MAX } from "./creatorMath";

/**
 * Creador de recursos: modelo del documento que genera la IA y edita el docente.
 *
 * Un recurso es una lista de secciones (la guía del estudiante, la clave de respuestas…)
 * y cada sección una lista de bloques tipados. El texto va en Markdown con fórmulas
 * `$...$` en LaTeX. Las gráficas y las tablas de valores guardan la función, no los
 * números: los valores se calculan al dibujar (ver creatorMath.ts).
 */

export const CREATOR_LIMITS = {
  titleMax: 160,
  subtitleMax: 240,
  textMax: 4000,
  partMax: 1500,
  cellMax: 300,
  latexMax: 600,
  promptMax: 4000,
  messageMax: 2000,
  sectionsMax: 12,
  blocksPerSectionMax: 60,
  tableRowsMax: 20,
  tableColsMax: 10,
  functionsMax: 4,
  pointsMax: 12,
  /** Marcas por eje: más que esto deja la cuadrícula ilegible al imprimir. */
  ticksMax: 40,
  /** Datos crudos de un histograma o de una caja y bigotes: hasta cinco cursos de 40 estudiantes. */
  statDataMax: 200,
  histogramClassesMax: 12,
  scatterPointsMax: 40,
  docBytesMax: 400_000,
  versionsKept: 20,
} as const;

export const RESOURCE_KINDS = ["guia", "taller", "evaluacion", "calentamiento", "contexto_real"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_KIND_LABELS: Record<ResourceKind, { label: string; hint: string }> = {
  guia: { label: "Guía de práctica", hint: "Conceptos clave, ejemplos de referencia y ejercicios graduados con clave de respuestas." },
  taller: { label: "Taller", hint: "Actividad para resolver en clase, individual o en grupo, con producto final." },
  evaluacion: { label: "Evaluación", hint: "Prueba con preguntas de distinto nivel y clave de respuestas para el docente." },
  calentamiento: { label: "Calentamiento", hint: "Actividad corta de 5 a 10 minutos para abrir la clase." },
  contexto_real: { label: "Contexto real", hint: "Situaciones cotidianas donde se aplica el tema." },
};

export const RESOURCE_STATUS = ["generating", "ready", "error"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUS)[number];

export const SECTION_ROLES = ["student", "answer_key"] as const;
export type SectionRole = (typeof SECTION_ROLES)[number];

const text = (max: number = CREATOR_LIMITS.textMax) => z.string().trim().min(1).max(max);
const latex = z.string().trim().min(1).max(CREATOR_LIMITS.latexMax);
const expression = z.string().trim().min(1).max(MATH_EXPR_MAX);
const caption = z.string().trim().max(200).optional();
const label = z.string().trim().min(1).max(60);

export const graphFunctionSchema = z.object({
  expr: expression.describe('Función de x en texto plano, p. ej. "2*x - 3" o "x^2 - 4*x + 3". Sin LaTeX.'),
  label: latex.optional().describe('Etiqueta en LaTeX que se dibuja junto a la curva, p. ej. "y = 2x - 3".'),
});

export const graphPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: latex.optional().describe('Etiqueta en LaTeX, p. ej. "(1.5, 0)".'),
  on: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Índice (desde 0) de la función sobre la que está el punto. null si es un punto libre."),
});

export const graphSpecSchema = z.object({
  xMin: z.number(),
  xMax: z.number(),
  yMin: z.number(),
  yMax: z.number(),
  xStep: z.number().positive().default(1).describe("Separación de la cuadrícula en x."),
  yStep: z.number().positive().default(1).describe("Separación de la cuadrícula en y."),
  functions: z
    .array(graphFunctionSchema)
    .max(CREATOR_LIMITS.functionsMax)
    .default([])
    .describe("Vacío para un plano en blanco donde el estudiante grafica."),
  points: z.array(graphPointSchema).max(CREATOR_LIMITS.pointsMax).default([]),
});

const headerFieldsBlock = z.object({
  type: z.literal("header_fields"),
  fields: z.array(z.string().trim().min(1).max(40)).min(1).max(5).describe('Campos para diligenciar, p. ej. ["Nombre", "Fecha", "Grado"].'),
});

const headingBlock = z.object({
  type: z.literal("heading"),
  text: z.string().trim().min(1).max(200),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
});

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  md: text(),
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  title: z.string().trim().max(120).optional(),
  md: text(),
  tone: z.enum(["info", "tip", "warning"]).default("info"),
});

const mathBlock = z.object({
  type: z.literal("math"),
  latex: latex.describe("Fórmula destacada en su propia línea. Solo LaTeX, sin signos $."),
});

const exerciseBlock = z.object({
  type: z.literal("exercise"),
  label: label.describe('Rótulo, p. ej. "Ejercicio 1" o "Reto (opcional)".'),
  md: text(),
  parts: z
    .array(z.object({ label: z.string().trim().min(1).max(8), md: text(CREATOR_LIMITS.partMax) }))
    .max(8)
    .default([])
    .describe('Incisos, p. ej. [{ "label": "a", "md": "..." }].'),
  answerSpace: z.enum(["none", "lines", "grid", "blank"]).default("lines").describe("Espacio para responder: renglones, cuadrícula, en blanco o ninguno."),
  lines: z.number().int().min(1).max(14).default(4).describe("Alto del espacio de respuesta, en renglones."),
});

const tableBlock = z.object({
  type: z.literal("table"),
  caption,
  header: z.array(z.string().trim().max(CREATOR_LIMITS.cellMax)).min(1).max(CREATOR_LIMITS.tableColsMax),
  rows: z
    .array(z.array(z.string().trim().max(CREATOR_LIMITS.cellMax)).min(1).max(CREATOR_LIMITS.tableColsMax))
    .min(1)
    .max(CREATOR_LIMITS.tableRowsMax)
    .describe("Celdas en Markdown; una cadena vacía deja la celda en blanco para el estudiante."),
  firstColumnHeader: z.boolean().default(false),
});

const valueTableBlock = z.object({
  type: z.literal("value_table"),
  caption,
  expr: expression.describe('Función de x en texto plano, p. ej. "x^2 - 4*x + 3". Los valores de y se calculan solos.'),
  exprLatex: latex.describe('La misma función en LaTeX para el encabezado, p. ej. "y = x^{2} - 4x + 3" o "A(s) = 4000s + 20000".'),
  variable: z
    .string()
    .trim()
    .regex(/^[A-Za-z]$/)
    .optional()
    .describe('Letra de la variable independiente tal como aparece en exprLatex: "s" para "A(s) = 4000s + 20000". Rotula la primera fila. Si se omite, se toma de exprLatex cuando tiene la forma f(t) = …, y si no es x.'),
  xs: z.array(z.number()).min(2).max(12).describe("Valores de la variable independiente."),
  blankY: z.boolean().default(false).describe("true deja la fila de resultados vacía para que el estudiante la complete."),
});

const graphBlock = z.object({
  type: z.literal("graph"),
  caption,
  spec: graphSpecSchema,
});

/* ── Figuras: se guardan los datos y la figura se dibuja a partir de ellos ── */

const shortLabel = z.string().trim().min(1).max(40);
const chartText = z.string().trim().max(120).optional();
const figureLabel = z.string().trim().max(40).optional().describe('Rótulo corto en Markdown, p. ej. "5 cm" o "$b = 6$ cm".');

const numberLineBlock = z.object({
  type: z.literal("number_line"),
  caption,
  min: z.number(),
  max: z.number(),
  step: z.number().positive().describe("Separación entre marcas, p. ej. 1 o 0.25."),
  labelEvery: z.number().int().min(1).max(20).default(1).describe("Cada cuántas marcas se escribe el número (1 = todas)."),
  fractionDenominator: z
    .number()
    .int()
    .min(2)
    .max(24)
    .optional()
    .describe("Rotula las marcas como fracciones con este denominador; step debe ser 1/denominador o un múltiplo. Omítelo para rótulos decimales."),
  showNumbers: z.boolean().default(true).describe("false deja las marcas sin número para que el estudiante las complete."),
  points: z
    .array(z.object({ value: z.number(), label: latex.optional().describe("Rótulo en LaTeX sobre el punto.") }))
    .max(8)
    .default([])
    .describe("Puntos marcados sobre la recta."),
  jumps: z
    .array(z.object({ from: z.number(), to: z.number(), label: latex.optional().describe('Rótulo en LaTeX sobre el arco, p. ej. "+\\frac{2}{4}".') }))
    .max(6)
    .default([])
    .describe("Saltos en arco de un valor a otro, para mostrar sumas y restas."),
  intervals: z
    .array(
      z.object({
        from: z.number().nullable().optional().describe("Extremo izquierdo. Omítelo (o null) para una semirrecta que sigue hacia la izquierda, como en x < 3."),
        to: z.number().nullable().optional().describe("Extremo derecho. Omítelo (o null) para una semirrecta que sigue hacia la derecha, como en x ≥ 2."),
        fromClosed: z.boolean().default(false).describe("true si el extremo izquierdo está incluido (≥ o corchete): círculo relleno. false: círculo vacío."),
        toClosed: z.boolean().default(false).describe("true si el extremo derecho está incluido (≤ o corchete)."),
      }),
    )
    .max(3)
    .default([])
    .describe("Intervalos o soluciones de inecuaciones, resaltados sobre la recta con sus extremos abiertos o cerrados."),
});

const fractionModelBlock = z.object({
  type: z.literal("fraction_model"),
  caption,
  shape: z.enum(["circle", "bar"]).default("circle").describe("Círculos partidos en sectores o barras partidas en casillas."),
  models: z
    .array(
      z.object({
        numerator: z.number().int().min(0).max(48),
        denominator: z.number().int().min(1).max(16),
        label: latex.optional().describe("Rótulo en LaTeX bajo el modelo. Si se omite se escribe la fracción."),
      }),
    )
    .min(1)
    .max(4),
  operator: z
    .enum(["none", "equals", "plus", "compare"])
    .default("none")
    .describe('Signo entre un modelo y el siguiente: "=", "+", o un círculo vacío para que el estudiante escriba <, > o =.'),
  showLabels: z.boolean().default(true).describe("false oculta las fracciones para que el estudiante las escriba."),
});

const barChartBlock = z.object({
  type: z.literal("bar_chart"),
  caption,
  title: chartText,
  xLabel: z.string().trim().max(60).optional(),
  yLabel: z.string().trim().max(60).optional(),
  bars: z.array(z.object({ label: shortLabel, value: z.number().min(0) })).min(2).max(12),
  yMax: z.number().positive().optional().describe("Tope del eje vertical. Si se omite se calcula a partir de los datos."),
  yStep: z.number().positive().optional().describe("Separación de las marcas del eje vertical. Si se omite se calcula."),
  showValues: z.boolean().default(true).describe("Escribe el valor sobre cada barra."),
  blank: z.boolean().default(false).describe("true dibuja los ejes y las categorías sin barras, para que el estudiante las trace."),
});

const pieChartBlock = z.object({
  type: z.literal("pie_chart"),
  caption,
  title: chartText,
  slices: z.array(z.object({ label: shortLabel, value: z.number().positive() })).min(2).max(8).describe("Cada sector con su valor (frecuencia o cantidad); los porcentajes se calculan solos."),
  showPercent: z.boolean().default(true),
  blank: z.boolean().default(false).describe("true dibuja el círculo con marcas cada 10° y sin sectores, para que el estudiante lo construya."),
});

/* ── Figuras estadísticas: lo que se dibuja (frecuencias, cuartiles, recta de tendencia) se calcula en creatorStats.ts ── */

const axisName = z.string().trim().max(60).optional();
const axisBound = z.number().optional();
const axisStep = z.number().positive().optional();

const histogramBlock = z.object({
  type: z.literal("histogram"),
  caption,
  title: chartText,
  xLabel: axisName.describe('Nombre de la variable, p. ej. "Estatura (cm)".'),
  yLabel: axisName.describe('Nombre del eje vertical, p. ej. "Número de estudiantes".'),
  classes: z
    .array(
      z.object({
        from: z.number().describe("Límite inferior de la clase (incluido)."),
        to: z.number().describe("Límite superior de la clase (excluido, salvo en la última clase)."),
        frequency: z.number().int().min(0).describe("Cuántos datos caen en la clase."),
      }),
    )
    .min(2)
    .max(CREATOR_LIMITS.histogramClassesMax)
    .describe("Clases en orden, contiguas y del mismo ancho: cada una empieza donde termina la anterior."),
  data: z
    .array(z.number())
    .max(CREATOR_LIMITS.statDataMax)
    .optional()
    .describe("Datos crudos, si el enunciado los da. El sistema cuenta cuántos caen en cada clase y rechaza las frecuencias que no coincidan."),
  yMax: axisStep.describe("Tope del eje vertical. Si se omite se calcula a partir de las frecuencias."),
  yStep: axisStep.describe("Separación de las marcas del eje vertical. Si se omite se calcula."),
  showValues: z.boolean().default(true).describe("Escribe la frecuencia sobre cada barra."),
  blank: z.boolean().default(false).describe("true dibuja los ejes y los límites de las clases sin barras, para que el estudiante las trace."),
});

const boxPlotBlock = z.object({
  type: z.literal("box_plot"),
  caption,
  title: chartText,
  xLabel: axisName.describe('Nombre de la variable bajo el eje, p. ej. "Nota (de 0 a 5)".'),
  series: z
    .array(
      z.object({
        label: shortLabel.optional().describe('Nombre del grupo, p. ej. "9A". Obligatorio cuando hay más de un grupo.'),
        data: z
          .array(z.number())
          .min(5)
          .max(CREATOR_LIMITS.statDataMax)
          .describe("Datos crudos, en cualquier orden. El mínimo, los cuartiles, la mediana y el máximo se calculan solos: no los escribas."),
      }),
    )
    .min(1)
    .max(3)
    .describe("Un diagrama por grupo, todos sobre el mismo eje para poder compararlos."),
  xMin: axisBound.describe("Inicio del eje. Si se omite se calcula a partir de los datos."),
  xMax: axisBound.describe("Fin del eje. Si se omite se calcula."),
  xStep: axisStep.describe("Separación de las marcas del eje. Si se omite se calcula."),
  showValues: z.boolean().default(true).describe("Escribe sobre el diagrama el mínimo, Q1, la mediana, Q3 y el máximo."),
  blank: z.boolean().default(false).describe("true dibuja solo el eje numerado, para que el estudiante construya el diagrama."),
});

const lineChartBlock = z.object({
  type: z.literal("line_chart"),
  caption,
  title: chartText,
  xLabel: axisName,
  yLabel: axisName,
  categories: z
    .array(shortLabel)
    .min(2)
    .max(12)
    .describe('Rótulos del eje horizontal en orden, p. ej. ["Ene", "Feb", "Mar"]. Quedan a la misma distancia uno de otro.'),
  series: z
    .array(
      z.object({
        label: shortLabel.optional().describe("Nombre de la serie para la leyenda. Obligatorio cuando hay más de una serie."),
        values: z.array(z.number()).min(2).max(12).describe("Un valor por cada rótulo de categories, en el mismo orden."),
      }),
    )
    .min(1)
    .max(4),
  yMin: axisBound.describe("Inicio del eje vertical. Si se omite se calcula: cero cuando los datos están cerca de él."),
  yMax: axisBound.describe("Tope del eje vertical. Si se omite se calcula."),
  yStep: axisStep.describe("Separación de las marcas del eje vertical. Si se omite se calcula."),
  showValues: z.boolean().default(false).describe("Escribe el valor junto a cada punto."),
  blank: z.boolean().default(false).describe("true dibuja los ejes y las categorías sin puntos ni líneas, para que el estudiante trace la gráfica."),
});

const scatterPlotBlock = z.object({
  type: z.literal("scatter_plot"),
  caption,
  title: chartText,
  xLabel: axisName,
  yLabel: axisName,
  points: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(3)
    .max(CREATOR_LIMITS.scatterPointsMax)
    .describe("Pares (x, y) observados. Se dibujan sueltos, sin unirlos con líneas."),
  xMin: axisBound,
  xMax: axisBound,
  xStep: axisStep,
  yMin: axisBound,
  yMax: axisBound,
  yStep: axisStep.describe("Los seis límites de los ejes son opcionales: si se omiten se calculan a partir de los puntos."),
  trendLine: z.boolean().default(false).describe("Dibuja la recta de mejor ajuste. El sistema la calcula por mínimos cuadrados a partir de los puntos: no la escribas tú."),
  showEquation: z.boolean().default(false).describe("Con trendLine, escribe la ecuación de la recta dentro de la figura."),
  blank: z.boolean().default(false).describe("true dibuja los ejes y la cuadrícula sin puntos, para que el estudiante los ubique."),
});

/* ── Figuras de aula: lo que se calcula (probabilidad de un camino, manecillas, número de dibujos) está en creatorDiagrams.ts ── */

const angleBlock = z.object({
  type: z.literal("angle"),
  caption,
  angles: z
    .array(
      z.object({
        degrees: z.number().min(1).max(359).describe("Medida en grados."),
        label: z.string().trim().max(24).optional().describe('Rótulo junto al arco en Markdown, p. ej. "$\\alpha$" o "x". Si se omite se escribe la medida.'),
      }),
    )
    .min(1)
    .max(3),
  showMeasures: z.boolean().default(true).describe("false oculta las medidas, para que el estudiante las mida o las calcule."),
  protractor: z.boolean().default(false).describe("Dibuja un transportador sobre cada ángulo, para medirlo. Solo para ángulos de hasta 180° y como máximo dos."),
});

const vennBlock = z.object({
  type: z.literal("venn"),
  caption,
  title: chartText,
  sets: z.array(shortLabel).min(2).max(3).describe('Nombre de cada conjunto: el primero es A, el segundo B y el tercero, si lo hay, C. P. ej. ["Fútbol", "Baloncesto"].'),
  regions: z
    .array(
      z.object({
        region: z
          .enum(VENN_REGIONS)
          .describe('Zona del diagrama: "a" = solo el primer conjunto; "ab" = los dos primeros a la vez (y no el tercero); "abc" = los tres; "outside" = fuera de todos.'),
        text: z.string().trim().max(28).optional().describe('Lo que se escribe en la zona: una cantidad ("12") o elementos ("2, 4, 6").'),
        shaded: z.boolean().default(false).describe("true sombrea la zona, para mostrar una unión, una intersección o una diferencia."),
      }),
    )
    .max(8)
    .default([])
    .describe("Zonas con contenido o sombreadas, cada una una sola vez. Las que no se mencionan quedan vacías para que el estudiante las complete."),
  universe: z.string().trim().max(24).optional().describe('Rótulo del conjunto universal, que se dibuja como un rectángulo: "U" o "Grado 6A".'),
});

const treeLabel = z.string().trim().min(1).max(24);
const treeProbability = z
  .string()
  .trim()
  .max(12)
  .optional()
  .describe('Probabilidad de la rama: fracción "1/2", decimal "0.25" o porcentaje "25%". Omítela si el árbol solo cuenta casos o si el estudiante debe escribirla.');
const treeLeaf = z.object({ label: treeLabel, probability: treeProbability });
const treeBranch = treeLeaf.extend({ children: z.array(treeLeaf).max(4).default([]) });

const treeDiagramBlock = z.object({
  type: z.literal("tree_diagram"),
  caption,
  root: z.string().trim().max(24).optional().describe('Rótulo del punto de partida, p. ej. "Inicio". Opcional.'),
  branches: z
    .array(treeLeaf.extend({ children: z.array(treeBranch).max(4).default([]) }))
    .min(2)
    .max(4)
    .describe("Primer nivel de ramas. Cada rama puede abrirse en hasta dos niveles más con children. Las probabilidades de las ramas que salen de un mismo punto deben sumar 1."),
  showResults: z.boolean().default(false).describe("Escribe al final de cada camino su probabilidad. El sistema la calcula multiplicando las de sus ramas: no la escribas tú."),
});

const barModelBlock = z.object({
  type: z.literal("bar_model"),
  caption,
  bars: z
    .array(
      z.object({
        label: z.string().trim().max(24).optional().describe('Nombre a la izquierda de la barra, p. ej. "Ana".'),
        parts: z
          .array(
            z.object({
              value: z.number().positive().describe("Tamaño de la parte: fija su ancho, a la misma escala en todas las barras."),
              label: z.string().trim().max(16).optional().describe('Texto dentro de la parte. Si se omite se escribe el valor; usa "?" para la incógnita.'),
            }),
          )
          .min(1)
          .max(10),
        total: z.string().trim().max(16).optional().describe('Rótulo de la llave que abarca toda la barra, p. ej. "36" o "?".'),
      }),
    )
    .min(1)
    .max(4),
});

export const PICTOGRAM_ICONS = ["circle", "star", "person", "heart", "square"] as const;

const pictogramBlock = z.object({
  type: z.literal("pictogram"),
  caption,
  title: chartText,
  icon: z.enum(PICTOGRAM_ICONS).default("circle").describe("Dibujo que se repite."),
  iconValue: z.number().positive().default(1).describe("Cuánto vale cada dibujo, p. ej. 2. Medio dibujo vale la mitad."),
  unit: z.string().trim().max(30).optional().describe('Qué cuenta cada dibujo, para la clave del pictograma: "estudiantes", "libros".'),
  rows: z
    .array(z.object({ label: shortLabel, value: z.number().min(0) }))
    .min(2)
    .max(8)
    .describe("Cada categoría con su cantidad real. El número de dibujos se calcula solo: la cantidad debe ser múltiplo de medio dibujo."),
  blank: z.boolean().default(false).describe("true deja las filas sin dibujos, para que el estudiante los dibuje."),
});

const clockBlock = z.object({
  type: z.literal("clock"),
  caption,
  clocks: z
    .array(
      z.object({
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59).default(0),
        label: z.string().trim().max(24).optional().describe('Texto bajo el reloj, p. ej. "a." o "Salida del bus".'),
      }),
    )
    .min(1)
    .max(4),
  showHands: z.boolean().default(true).describe("false dibuja los relojes sin manecillas, para que el estudiante las dibuje."),
  showTime: z.boolean().default(false).describe("Escribe la hora en números bajo cada reloj (7:30)."),
});

const baseTenBlock = z.object({
  type: z.literal("base_ten"),
  caption,
  hundreds: z.number().int().min(0).max(9).default(0).describe("Placas de 100."),
  tens: z.number().int().min(0).max(19).default(0).describe("Barras de 10. Más de 9 sirve para mostrar un reagrupamiento."),
  ones: z.number().int().min(0).max(19).default(0).describe("Cubos de 1."),
  showNumber: z.boolean().default(false).describe("Escribe cuántas centenas, decenas y unidades hay y el número que forman, calculado por el sistema."),
});

const shapeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rectangle"),
    width: z.number().positive(),
    height: z.number().positive(),
    widthLabel: figureLabel,
    heightLabel: figureLabel,
  }),
  z.object({
    kind: z.literal("triangle"),
    base: z.number().positive(),
    height: z.number().positive(),
    apex: z.number().min(0).max(1).default(0.5).describe("Posición horizontal del vértice superior sobre la base: 0 o 1 = triángulo rectángulo, 0.5 = isósceles."),
    baseLabel: figureLabel,
    heightLabel: figureLabel,
    showHeight: z.boolean().default(true).describe("Dibuja la altura con línea punteada."),
  }),
  z.object({
    kind: z.literal("circle"),
    radius: z.number().positive(),
    show: z.enum(["radius", "diameter", "none"]).default("radius").describe("Qué segmento se dibuja dentro del círculo."),
    label: figureLabel,
  }),
  z.object({
    kind: z.literal("polygon"),
    vertices: z.array(z.object({ x: z.number(), y: z.number() })).min(3).max(8).describe("Vértices en orden, con y hacia arriba."),
    sideLabels: z.array(z.string().trim().max(40)).max(8).default([]).describe("Rótulo de cada lado, en el orden de los vértices; cadena vacía para omitir uno."),
  }),
]);

const shapesBlock = z.object({
  type: z.literal("shapes"),
  caption,
  figures: z.array(shapeSchema).min(1).max(4),
  toScale: z.boolean().default(true).describe("true dibuja todas las figuras con la misma escala, para poder compararlas."),
});

const balanceSide = z.object({
  variables: z.number().int().min(0).max(6).default(0).describe("Cuántas incógnitas hay en este platillo."),
  units: z.number().int().min(0).max(15).default(0).describe("Cuántas unidades (fichas de valor 1) hay en este platillo."),
  weights: z
    .array(z.number().positive().max(9999))
    .max(3)
    .default([])
    .describe("Pesas rotuladas con su valor, p. ej. [15] o [20, 5]. Úsalas cuando el número es demasiado grande para dibujarlo ficha por ficha."),
});

const balanceBlock = z.object({
  type: z.literal("balance"),
  caption,
  variable: z
    .string()
    .regex(/^[a-zA-Z]$/)
    .default("x")
    .describe("Letra de la incógnita."),
  left: balanceSide,
  right: balanceSide,
});

const solutionBlock = z.object({
  type: z.literal("solution"),
  label: label.describe('A qué ejercicio responde, p. ej. "Ejercicio 1".'),
  steps: z.array(text(CREATOR_LIMITS.partMax)).max(12).default([]).describe("Procedimiento paso a paso."),
  answer: text(CREATOR_LIMITS.partMax).optional().describe("Respuesta final, destacada."),
});

const pageBreakBlock = z.object({
  type: z.literal("page_break"),
});

/** Bloque tal como lo escribe el modelo o un formulario: aún sin identificador. */
export const blockInputSchema = z.discriminatedUnion("type", [
  headerFieldsBlock,
  headingBlock,
  paragraphBlock,
  calloutBlock,
  mathBlock,
  exerciseBlock,
  tableBlock,
  valueTableBlock,
  graphBlock,
  numberLineBlock,
  fractionModelBlock,
  barChartBlock,
  pieChartBlock,
  histogramBlock,
  boxPlotBlock,
  lineChartBlock,
  scatterPlotBlock,
  angleBlock,
  vennBlock,
  treeDiagramBlock,
  barModelBlock,
  pictogramBlock,
  clockBlock,
  baseTenBlock,
  shapesBlock,
  balanceBlock,
  solutionBlock,
  pageBreakBlock,
]);

const id = z.string().min(1).max(24);

/** Bloque guardado: el servidor le asigna un `id` estable para poder editarlo desde el chat. */
export const blockSchema = z.discriminatedUnion("type", [
  headerFieldsBlock.extend({ id }),
  headingBlock.extend({ id }),
  paragraphBlock.extend({ id }),
  calloutBlock.extend({ id }),
  mathBlock.extend({ id }),
  exerciseBlock.extend({ id }),
  tableBlock.extend({ id }),
  valueTableBlock.extend({ id }),
  graphBlock.extend({ id }),
  numberLineBlock.extend({ id }),
  fractionModelBlock.extend({ id }),
  barChartBlock.extend({ id }),
  pieChartBlock.extend({ id }),
  histogramBlock.extend({ id }),
  boxPlotBlock.extend({ id }),
  lineChartBlock.extend({ id }),
  scatterPlotBlock.extend({ id }),
  angleBlock.extend({ id }),
  vennBlock.extend({ id }),
  treeDiagramBlock.extend({ id }),
  barModelBlock.extend({ id }),
  pictogramBlock.extend({ id }),
  clockBlock.extend({ id }),
  baseTenBlock.extend({ id }),
  shapesBlock.extend({ id }),
  balanceBlock.extend({ id }),
  solutionBlock.extend({ id }),
  pageBreakBlock.extend({ id }),
]);

export const sectionSchema = z.object({
  id,
  title: z.string().trim().min(1).max(CREATOR_LIMITS.titleMax),
  role: z.enum(SECTION_ROLES).default("student"),
  blocks: z.array(blockSchema).max(CREATOR_LIMITS.blocksPerSectionMax),
});

export const resourceDocSchema = z.object({
  title: z.string().trim().max(CREATOR_LIMITS.titleMax),
  subtitle: z.string().trim().max(CREATOR_LIMITS.subtitleMax).optional(),
  sections: z.array(sectionSchema).max(CREATOR_LIMITS.sectionsMax),
});

export type ShapeFigure = z.infer<typeof shapeSchema>;
export type GraphSpec = z.infer<typeof graphSpecSchema>;
export type GraphFunction = z.infer<typeof graphFunctionSchema>;
export type GraphPoint = z.infer<typeof graphPointSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
export type Section = z.infer<typeof sectionSchema>;
export type ResourceDoc = z.infer<typeof resourceDocSchema>;

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  header_fields: "Datos del estudiante",
  heading: "Título",
  paragraph: "Texto",
  callout: "Recuadro",
  math: "Fórmula",
  exercise: "Ejercicio",
  table: "Tabla",
  value_table: "Tabla de valores",
  graph: "Gráfica",
  number_line: "Recta numérica",
  fraction_model: "Modelo de fracciones",
  bar_chart: "Diagrama de barras",
  pie_chart: "Diagrama circular",
  histogram: "Histograma",
  box_plot: "Caja y bigotes",
  line_chart: "Gráfica de líneas",
  scatter_plot: "Diagrama de dispersión",
  angle: "Ángulos",
  venn: "Diagrama de Venn",
  tree_diagram: "Diagrama de árbol",
  bar_model: "Modelo de barras",
  pictogram: "Pictograma",
  clock: "Reloj",
  base_ten: "Bloques de base 10",
  shapes: "Figuras geométricas",
  balance: "Balanza",
  solution: "Solución",
  page_break: "Salto de página",
};

/* ───────────────────────── Preguntas aclaratorias ───────────────────────── */

export const CLARIFY_LIMITS = { questionsMax: 3, optionsMax: 4, questionMax: 180, optionMax: 110, answerMax: 240 } as const;

/** Pregunta de opción múltiple que la IA hace al docente antes de escribir el recurso. */
export interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
}

export const clarificationSchema = z.object({
  question: z.string().trim().min(1).max(CLARIFY_LIMITS.questionMax),
  answer: z.string().trim().min(1).max(CLARIFY_LIMITS.answerMax),
});
export type Clarification = z.infer<typeof clarificationSchema>;

/**
 * Deja las preguntas que devuelve el modelo en un estado seguro para mostrarlas: recorta,
 * quita duplicados y descarta las que no tienen al menos dos opciones distintas.
 */
export function sanitizeClarifyQuestions(raw: unknown): ClarifyQuestion[] {
  if (!Array.isArray(raw)) return [];
  const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const questions: ClarifyQuestion[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { question?: unknown; options?: unknown };
    const question = clean(candidate.question, CLARIFY_LIMITS.questionMax);
    if (!question || seen.has(question.toLowerCase())) continue;
    const options = Array.from(
      new Set((Array.isArray(candidate.options) ? candidate.options : []).map(option => clean(option, CLARIFY_LIMITS.optionMax)).filter(Boolean)),
    ).slice(0, CLARIFY_LIMITS.optionsMax);
    if (options.length < 2) continue;
    seen.add(question.toLowerCase());
    questions.push({ id: `q${questions.length + 1}`, question, options });
    if (questions.length === CLARIFY_LIMITS.questionsMax) break;
  }
  return questions;
}

/** La solicitud que recibe la IA: lo que escribió el docente más lo que respondió a las preguntas. */
export function composeCreatorRequest(prompt: string, clarifications: Clarification[]): string {
  const answered = clarifications.filter(item => item.question.trim() && item.answer.trim());
  if (answered.length === 0) return prompt.trim();
  const lines = answered.map(item => `- ${item.question.trim()} → ${item.answer.trim()}`);
  return `${prompt.trim()}\n\nAclaraciones del docente:\n${lines.join("\n")}`;
}

/** Lo que hizo una herramienta de la IA, para mostrarlo como una ficha en el chat. */
export interface CreatorActivity {
  label: string;
  ok: boolean;
  changed: boolean;
}

export interface CreatorChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  activity: CreatorActivity[];
  createdAt: Date | string;
}

/** Lo que el servidor va contando mientras la IA trabaja sobre un recurso. */
export type CreatorEvent =
  | { type: "status"; phase: "thinking" | "writing" }
  | { type: "text"; delta: string }
  /** Sección que la IA está escribiendo en este momento, con los bloques que ya terminó. */
  | { type: "preview"; sectionId: string | null; title: string; role: SectionRole; blocks: BlockInput[] }
  | { type: "activity"; activity: CreatorActivity }
  | { type: "doc"; doc: ResourceDoc }
  | { type: "done"; ok: boolean; error?: string };

export const SHAPE_KIND_LABELS: Record<ShapeFigure["kind"], string> = {
  rectangle: "Rectángulo",
  triangle: "Triángulo",
  circle: "Círculo",
  polygon: "Polígono",
};

export const emptyDoc = (title = ""): ResourceDoc => ({ title, sections: [] });

/** Lee un documento guardado; si está dañado devuelve uno vacío en vez de romper la pantalla. */
export function parseDoc(raw: unknown): ResourceDoc {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    const parsed = resourceDocSchema.safeParse(value);
    return parsed.success ? parsed.data : emptyDoc();
  } catch {
    return emptyDoc();
  }
}

export function countBlocks(doc: ResourceDoc): number {
  return doc.sections.reduce((total, section) => total + section.blocks.length, 0);
}

export function findBlock(doc: ResourceDoc, blockId: string): { section: Section; block: Block; index: number } | null {
  for (const section of doc.sections) {
    const index = section.blocks.findIndex(block => block.id === blockId);
    if (index !== -1) return { section, block: section.blocks[index], index };
  }
  return null;
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Identificador corto, único dentro del documento. Corto a propósito: el modelo lo copia al editar. */
export function createId(prefix: "s" | "b", taken: Set<string>, random: () => number = Math.random): string {
  for (;;) {
    let value = prefix;
    for (let i = 0; i < 6; i++) value += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
    if (!taken.has(value)) {
      taken.add(value);
      return value;
    }
  }
}

export function collectIds(doc: ResourceDoc): Set<string> {
  const ids = new Set<string>();
  for (const section of doc.sections) {
    ids.add(section.id);
    for (const block of section.blocks) ids.add(block.id);
  }
  return ids;
}

/* ───────────────────────── Texto con fórmulas ───────────────────────── */

const CURRENCY_BREAKERS = /[=+^\\_{}<>]/;

/**
 * Escapa los signos de pesos para que no se lean como fórmulas.
 *
 * En Markdown con LaTeX, "un banderazo de $2.900 y $100 por unidad" se interpreta
 * como la fórmula "2.900 y ". Un `$` seguido de un número y luego de palabras (y no
 * de operadores matemáticos) es dinero: se guarda como `\$`.
 */
export function escapeCurrency(md: string): string {
  let out = "";
  let i = 0;
  while (i < md.length) {
    const ch = md[i];
    if (ch === "\\" && i + 1 < md.length) {
      out += ch + md[i + 1];
      i += 2;
      continue;
    }
    if (ch !== "$") {
      out += ch;
      i++;
      continue;
    }
    // "$$" abre una fórmula en bloque: se copia hasta su cierre
    if (md[i + 1] === "$") {
      const end = md.indexOf("$$", i + 2);
      const stop = end === -1 ? md.length : end + 2;
      out += md.slice(i, stop);
      i = stop;
      continue;
    }
    const amount = /^\$(\d[\d.,]*)/.exec(md.slice(i));
    const close = findClosingDollar(md, i + 1);
    if (amount) {
      const after = md.slice(i + amount[0].length);
      const span = close === -1 ? after : md.slice(i + 1, close);
      const followedByWords = /^(\s+[\p{L}(]|\s*$|[;:!?)]|[.,](\s|$))/u.test(after);
      if (close === -1 || (followedByWords && !CURRENCY_BREAKERS.test(span))) {
        out += "\\$";
        i++;
        continue;
      }
    }
    if (close === -1) {
      // Un `$` suelto nunca es una fórmula
      out += "\\$";
      i++;
      continue;
    }
    out += md.slice(i, close + 1);
    i = close + 1;
  }
  return out;
}

function findClosingDollar(md: string, from: number): number {
  for (let i = from; i < md.length; i++) {
    if (md[i] === "\\") {
      i++;
      continue;
    }
    if (md[i] === "\n" && md[i + 1] === "\n") return -1;
    if (md[i] === "$") return i;
  }
  return -1;
}

/** Fórmulas LaTeX que contiene un texto Markdown (`$...$` y `$$...$$`), para validarlas. */
export function extractMath(md: string): string[] {
  const found: string[] = [];
  let i = 0;
  while (i < md.length) {
    if (md[i] === "\\") {
      i += 2;
      continue;
    }
    if (md[i] !== "$") {
      i++;
      continue;
    }
    if (md[i + 1] === "$") {
      const end = md.indexOf("$$", i + 2);
      if (end === -1) break;
      found.push(md.slice(i + 2, end).trim());
      i = end + 2;
      continue;
    }
    const close = findClosingDollar(md, i + 1);
    if (close === -1) {
      i++;
      continue;
    }
    found.push(md.slice(i + 1, close).trim());
    i = close + 1;
  }
  return found.filter(Boolean);
}

/** Texto plano de un Markdown con fórmulas: para vistas previas y títulos de lista. */
export function plainText(md: string, max = 140): string {
  const flat = md
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")
    .replace(/\\\$/g, "$")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Rótulos (Markdown) de una figura geométrica. */
function shapeLabels(figure: ShapeFigure): string[] {
  switch (figure.kind) {
    case "rectangle":
      return [figure.widthLabel ?? "", figure.heightLabel ?? ""];
    case "triangle":
      return [figure.baseLabel ?? "", figure.heightLabel ?? ""];
    case "circle":
      return [figure.label ?? ""];
    case "polygon":
      return figure.sideLabels;
  }
}

function mapShapeLabels(figure: ShapeFigure, fn: (md: string) => string): ShapeFigure {
  const map = (label: string | undefined) => (label ? fn(label) : label);
  switch (figure.kind) {
    case "rectangle":
      return { ...figure, widthLabel: map(figure.widthLabel), heightLabel: map(figure.heightLabel) };
    case "triangle":
      return { ...figure, baseLabel: map(figure.baseLabel), heightLabel: map(figure.heightLabel) };
    case "circle":
      return { ...figure, label: map(figure.label) };
    case "polygon":
      return { ...figure, sideLabels: figure.sideLabels.map(label => (label ? fn(label) : label)) };
  }
}

function ownTexts(block: BlockInput): string[] {
  switch (block.type) {
    case "paragraph":
    case "callout":
      return [block.md];
    case "exercise":
      return [block.md, ...block.parts.map(part => part.md)];
    case "table":
      return [...block.header, ...block.rows.flat()];
    case "solution":
      return [...block.steps, ...(block.answer ? [block.answer] : [])];
    case "heading":
      return [block.text];
    case "shapes":
      return block.figures.flatMap(shapeLabels);
    case "angle":
      return block.angles.map(angle => angle.label ?? "");
    default:
      return [];
  }
}

/** Los campos de texto Markdown de un bloque (incluido su pie), para recorrerlos al validar o normalizar. */
export function blockTexts(block: BlockInput): string[] {
  const caption = "caption" in block && block.caption ? [block.caption] : [];
  return [...ownTexts(block), ...caption].filter(Boolean);
}

function mapOwnTexts<T extends BlockInput>(block: T, fn: (md: string) => string): T {
  switch (block.type) {
    case "paragraph":
    case "callout":
      return { ...block, md: fn(block.md) };
    case "exercise":
      return { ...block, md: fn(block.md), parts: block.parts.map(part => ({ ...part, md: fn(part.md) })) };
    case "table":
      return { ...block, header: block.header.map(fn), rows: block.rows.map(row => row.map(fn)) };
    case "solution":
      return { ...block, steps: block.steps.map(fn), answer: block.answer ? fn(block.answer) : block.answer };
    case "shapes":
      return { ...block, figures: block.figures.map(figure => mapShapeLabels(figure, fn)) };
    case "angle":
      return { ...block, angles: block.angles.map(angle => (angle.label ? { ...angle, label: fn(angle.label) } : angle)) };
    default:
      return block;
  }
}

/** Aplica una transformación a todos los campos Markdown de un bloque, incluido su pie. */
export function mapBlockTexts<T extends BlockInput>(block: T, fn: (md: string) => string): T {
  const mapped = mapOwnTexts(block, fn);
  return "caption" in mapped && mapped.caption ? { ...mapped, caption: fn(mapped.caption) } : mapped;
}

/** Una línea que resume el bloque: para el índice del documento y el contexto del chat. */
export function blockPreview(block: BlockInput): string {
  switch (block.type) {
    case "header_fields":
      return block.fields.join(" · ");
    case "heading":
      return block.text;
    case "paragraph":
      return plainText(block.md);
    case "callout":
      return block.title ? `${block.title}: ${plainText(block.md, 100)}` : plainText(block.md);
    case "math":
      return block.latex;
    case "exercise":
      return `${block.label}. ${plainText(block.md, 110)}`;
    case "table":
      return block.caption || block.header.filter(Boolean).join(" | ");
    case "value_table":
      return block.caption || `Valores de ${block.expr}`;
    case "graph":
      return block.caption || block.spec.functions.map(fn => fn.expr).join(", ") || "Plano en blanco";
    case "number_line":
      return block.caption || `Recta numérica de ${block.min} a ${block.max}`;
    case "fraction_model":
      return block.caption || `Fracciones ${block.models.map(model => `${model.numerator}/${model.denominator}`).join(", ")}`;
    case "bar_chart":
      return block.caption || block.title || `Barras: ${block.bars.map(bar => bar.label).join(", ")}`;
    case "pie_chart":
      return block.caption || block.title || `Sectores: ${block.slices.map(slice => slice.label).join(", ")}`;
    case "histogram":
      return block.caption || block.title || `Histograma de ${block.classes[0].from} a ${block.classes[block.classes.length - 1].to}`;
    case "box_plot":
      return block.caption || block.title || `Caja y bigotes${block.series.some(series => series.label) ? `: ${block.series.map(series => series.label).filter(Boolean).join(", ")}` : ` de ${block.series[0].data.length} datos`}`;
    case "line_chart":
      return block.caption || block.title || `Líneas: ${block.categories.join(", ")}`;
    case "scatter_plot":
      return block.caption || block.title || `Dispersión de ${block.points.length} puntos${block.trendLine ? " con recta de tendencia" : ""}`;
    case "angle":
      return block.caption || `Ángulos de ${block.angles.map(angle => `${angle.degrees}°`).join(", ")}`;
    case "venn":
      return block.caption || block.title || `Venn: ${block.sets.join(", ")}`;
    case "tree_diagram":
      return block.caption || `Árbol: ${block.branches.map(branch => branch.label).join(", ")}`;
    case "bar_model":
      return block.caption || `Modelo de barras${block.bars.some(bar => bar.label) ? `: ${block.bars.map(bar => bar.label).filter(Boolean).join(", ")}` : ""}`;
    case "pictogram":
      return block.caption || block.title || `Pictograma: ${block.rows.map(row => row.label).join(", ")}`;
    case "clock":
      return block.caption || `Reloj: ${block.clocks.map(clock => `${clock.hour}:${String(clock.minute).padStart(2, "0")}`).join(", ")}`;
    case "base_ten":
      return block.caption || `Bloques de base 10: ${block.hundreds * 100 + block.tens * 10 + block.ones}`;
    case "shapes":
      return block.caption || `Figuras: ${block.figures.map(figure => SHAPE_KIND_LABELS[figure.kind]).join(", ")}`;
    case "balance":
      return block.caption || `Balanza con la incógnita ${block.variable}`;
    case "solution":
      return `${block.label}. ${plainText(block.answer ?? block.steps[0] ?? "", 110)}`;
    case "page_break":
      return "Salto de página";
  }
}

import katex from "katex";
import { blockTexts, CREATOR_LIMITS, extractMath, type BlockInput, type GraphSpec } from "./creator";
import { isMultipleOfFraction, polygonArea } from "./creatorFigures";
import { formatNumber, nearlyEqual, tryCompile, type CompileResult } from "./creatorMath";
import { histogramClassIssues, histogramCounts, linearRegression, resolveAxis, type AxisOverride } from "./creatorStats";

/**
 * Comprobaciones que un bloque debe pasar antes de entrar al documento.
 *
 * El modelo redacta bien pero puede equivocarse en un cálculo o dejar un LaTeX roto.
 * Aquí se verifica lo que se puede comprobar con certeza (que las fórmulas compilan,
 * que cada punto marcado está de verdad sobre su curva, que las tablas cuadran) y los
 * problemas se le devuelven para que los corrija antes de mostrar nada al docente.
 */

/** Devuelve el error de KaTeX, o null si la fórmula es válida. */
export function checkLatex(latex: string): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: "ignore" });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "LaTeX no válido";
    return message.replace(/^KaTeX parse error:\s*/i, "");
  }
}

const LATEX_OUTSIDE_MATH = /\\(frac|sqrt|cdot|times|div|pm|leq|geq|neq|approx|alpha|beta|theta|pi|Delta|left|right|text|quad|Rightarrow|infty)\b|[\^_]\{/;

/** Texto fuera de las fórmulas `$...$`, para detectar LaTeX que quedó sin delimitar. */
function outsideMath(md: string): string {
  return md.replace(/\\\$/g, "").replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$\n]*\$/g, " ");
}

/**
 * Subíndice escrito sin guion bajo: `x1` compila, pero se lee "x por 1" y no "x sub 1".
 * Devuelve el fragmento sospechoso, o null. No mira dentro de \text{...} ni los comandos.
 */
export function findBareSubscript(latex: string): string | null {
  const bare = latex.replace(/\\(text|mathrm|textbf|operatorname)\s*\{[^{}]*\}/g, " ").replace(/\\[a-zA-Z]+/g, " ");
  const match = /(?<![A-Za-z])([A-Za-z])(\d+)/.exec(bare);
  return match ? match[0] : null;
}

const bareSubscriptIssue = (latex: string, where: string): string | null => {
  const found = findBareSubscript(latex);
  if (!found) return null;
  const letter = found[0];
  const digits = found.slice(1);
  return `${where}: en la fórmula $${latex}$, «${found}» parece un subíndice sin guion bajo. Escribe ${letter}_${digits.length > 1 ? `{${digits}}` : digits}; si es una multiplicación, usa \\cdot.`;
};

export function validateText(md: string, where: string): string[] {
  const issues: string[] = [];
  for (const formula of extractMath(md)) {
    const error = checkLatex(formula);
    if (error) issues.push(`${where}: la fórmula $${formula}$ no es LaTeX válido (${error}).`);
    else {
      const subscript = bareSubscriptIssue(formula, where);
      if (subscript) issues.push(subscript);
    }
  }
  if (LATEX_OUTSIDE_MATH.test(outsideMath(md))) {
    issues.push(`${where}: hay notación LaTeX fuera de una fórmula. Envuélvela en $...$.`);
  }
  return issues;
}

export function validateGraphSpec(spec: GraphSpec): string[] {
  const issues: string[] = [];
  if (!(spec.xMin < spec.xMax)) issues.push("Gráfica: xMin debe ser menor que xMax.");
  if (!(spec.yMin < spec.yMax)) issues.push("Gráfica: yMin debe ser menor que yMax.");
  if (issues.length > 0) return issues;

  if ((spec.xMax - spec.xMin) / spec.xStep > CREATOR_LIMITS.ticksMax) issues.push("Gráfica: demasiadas divisiones en x; aumenta xStep.");
  if ((spec.yMax - spec.yMin) / spec.yStep > CREATOR_LIMITS.ticksMax) issues.push("Gráfica: demasiadas divisiones en y; aumenta yStep.");

  const compiled = spec.functions.map((fn, index) => {
    const result = tryCompile(fn.expr);
    if (!result.ok) {
      issues.push(`Gráfica: la función ${index} ("${fn.expr}") no se puede evaluar: ${result.error}`);
      return null;
    }
    if (fn.label) {
      const error = checkLatex(fn.label);
      if (error) issues.push(`Gráfica: la etiqueta de la función ${index} no es LaTeX válido (${error}).`);
    }
    // La curva debe verse: al menos un tramo dentro del plano
    let visible = false;
    for (let i = 0; i <= 60 && !visible; i++) {
      const y = result.fn(spec.xMin + ((spec.xMax - spec.xMin) * i) / 60);
      visible = Number.isFinite(y) && y >= spec.yMin && y <= spec.yMax;
    }
    if (!visible) issues.push(`Gráfica: la función ${index} ("${fn.expr}") no se ve en el rango elegido; ajusta yMin/yMax.`);
    return result.fn;
  });

  spec.points.forEach(point => {
    const name = `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
    if (point.x < spec.xMin || point.x > spec.xMax || point.y < spec.yMin || point.y > spec.yMax) {
      issues.push(`Gráfica: el punto ${name} queda fuera del plano.`);
    }
    if (point.label) {
      const error = checkLatex(point.label);
      if (error) issues.push(`Gráfica: la etiqueta del punto ${name} no es LaTeX válido (${error}).`);
    }
    if (point.on === null || point.on === undefined) return;
    const fn = compiled[point.on];
    if (point.on >= spec.functions.length) {
      issues.push(`Gráfica: el punto ${name} dice estar sobre la función ${point.on}, que no existe.`);
      return;
    }
    if (!fn) return;
    const expected = fn(point.x);
    if (!nearlyEqual(expected, point.y)) {
      issues.push(
        `Gráfica: el punto ${name} no está sobre "${spec.functions[point.on].expr}": en x = ${formatNumber(point.x, 4)} la función vale ${formatNumber(expected, 4)}. Corrige el punto.`,
      );
    }
  });

  return issues;
}

/** "A(s) = …", "f(t) = …", "g\left(u\right) = …": la letra entre paréntesis es la variable. */
const FUNCTION_NOTATION = /^\s*\\?[A-Za-z]+(?:_(?:\{[^{}]*\}|\w))?\s*\(\s*([A-Za-z])\s*\)\s*=/;

const notationVariable = (exprLatex: string): string | null => FUNCTION_NOTATION.exec(exprLatex.replace(/\\(left|right)\b/g, ""))?.[1] ?? null;

/**
 * Variable independiente de una tabla de valores, para rotular su primera fila: la que
 * declara el bloque, o la que se lee en "A(s) = 4000s + 20000"; x cuando no se sabe.
 */
export function valueTableVariable(block: { variable?: string; exprLatex: string }): string {
  return block.variable ?? notationVariable(block.exprLatex) ?? "x";
}

/** La función se puede escribir con la variable de la tabla o con x, que es como se guardaba antes. */
function compileValueTable(expr: string, variable: string): CompileResult {
  const own = tryCompile(expr, variable.toLowerCase());
  if (own.ok || variable.toLowerCase() === "x") return own;
  const withX = tryCompile(expr);
  return withX.ok ? withX : own;
}

/** Resultados de una tabla de valores; null donde la función no está definida. */
export function computeValueTable(expr: string, xs: number[], variable = "x"): Array<number | null> {
  const compiled = compileValueTable(expr, variable);
  if (!compiled.ok) return xs.map(() => null);
  return xs.map(x => {
    const y = compiled.fn(x);
    return Number.isFinite(y) ? y : null;
  });
}

/** Problemas de un bloque, redactados para quien deba corregirlos. Vacío si está bien. */
export function validateBlock(block: BlockInput): string[] {
  const issues: string[] = [];
  const name = block.type === "exercise" || block.type === "solution" ? block.label : block.type;

  for (const text of blockTexts(block)) issues.push(...validateText(text, name));

  switch (block.type) {
    case "math": {
      const error = checkLatex(block.latex);
      if (error) issues.push(`Fórmula: "${block.latex}" no es LaTeX válido (${error}).`);
      else {
        const subscript = bareSubscriptIssue(block.latex, "Fórmula");
        if (subscript) issues.push(subscript);
      }
      if (block.latex.includes("$")) issues.push("Fórmula: escribe solo LaTeX, sin signos $.");
      break;
    }
    case "table": {
      const columns = block.header.length;
      block.rows.forEach((row, index) => {
        if (row.length !== columns) issues.push(`Tabla: la fila ${index + 1} tiene ${row.length} celdas y el encabezado ${columns}.`);
      });
      break;
    }
    case "value_table": {
      const variable = valueTableVariable(block);
      const compiled = compileValueTable(block.expr, variable);
      if (!compiled.ok) {
        issues.push(`Tabla de valores: "${block.expr}" no se puede evaluar: ${compiled.error}`);
      } else {
        for (const x of block.xs) {
          if (!Number.isFinite(compiled.fn(x))) issues.push(`Tabla de valores: "${block.expr}" no está definida en ${variable} = ${formatNumber(x)}.`);
        }
      }
      const error = checkLatex(block.exprLatex);
      if (error) issues.push(`Tabla de valores: exprLatex no es LaTeX válido (${error}).`);
      // La primera fila se rotula con la variable: si contradice al encabezado, la tabla confunde
      const written = notationVariable(block.exprLatex);
      if (block.variable && written && written !== block.variable) {
        issues.push(`Tabla de valores: la variable (variable = "${block.variable}") no coincide con la del encabezado $${block.exprLatex}$, que usa ${written}. Deja la misma en los dos.`);
      }
      break;
    }
    case "graph":
      issues.push(...validateGraphSpec(block.spec));
      break;
    case "number_line":
      issues.push(...validateNumberLine(block));
      break;
    case "fraction_model": {
      if (block.operator !== "none" && block.models.length < 2) issues.push("Modelo de fracciones: un signo entre modelos necesita al menos dos modelos.");
      block.models.forEach((model, index) => {
        if (model.numerator > model.denominator * 3) {
          issues.push(`Modelo de fracciones: ${model.numerator}/${model.denominator} ocupa más de tres enteros; usa una recta numérica o divide el ejemplo.`);
        }
        if (model.label) {
          const error = checkLatex(model.label);
          if (error) issues.push(`Modelo de fracciones: el rótulo del modelo ${index + 1} no es LaTeX válido (${error}).`);
        }
      });
      break;
    }
    case "bar_chart": {
      const highest = Math.max(...block.bars.map(bar => bar.value));
      if (!block.blank && !(highest > 0)) issues.push("Diagrama de barras: todas las barras valen cero.");
      if (block.yMax !== undefined && block.yMax < highest) issues.push(`Diagrama de barras: el tope del eje (yMax = ${formatNumber(block.yMax)}) es menor que el valor más alto (${formatNumber(highest)}).`);
      const top = block.yMax ?? highest;
      if (block.yStep !== undefined && top / block.yStep > 20) issues.push("Diagrama de barras: demasiadas divisiones en el eje vertical; aumenta el paso del eje (yStep).");
      break;
    }
    case "pie_chart":
      // El esquema ya exige valores positivos: no hay nada más que pueda fallar al dibujar
      break;
    case "histogram":
      issues.push(...validateHistogram(block));
      break;
    case "box_plot": {
      const all = block.series.flatMap(series => series.data);
      if (block.series.length > 1 && block.series.some(series => !series.label)) issues.push("Caja y bigotes: con varios grupos, cada uno necesita su nombre (label).");
      block.series.forEach((series, index) => {
        if (Math.min(...series.data) === Math.max(...series.data)) issues.push(`Caja y bigotes: todos los datos del grupo ${index + 1} son iguales; no hay nada que resumir.`);
      });
      issues.push(...axisIssues("Caja y bigotes", "el eje", ["xMin", "xMax", "xStep"], all, { min: block.xMin, max: block.xMax, step: block.xStep }, 8));
      break;
    }
    case "line_chart": {
      block.series.forEach((series, index) => {
        if (series.values.length !== block.categories.length) {
          issues.push(`Gráfica de líneas: la serie ${series.label ? `«${series.label}»` : index + 1} tiene ${series.values.length} valores y hay ${block.categories.length} categorías. Debe haber un valor por categoría.`);
        }
      });
      if (block.series.length > 1 && block.series.some(series => !series.label)) issues.push("Gráfica de líneas: con varias series, cada una necesita su nombre (label) para la leyenda.");
      const values = block.series.flatMap(series => series.values);
      issues.push(...axisIssues("Gráfica de líneas", "el eje vertical", ["yMin", "yMax", "yStep"], values, { min: block.yMin, max: block.yMax, step: block.yStep }));
      break;
    }
    case "scatter_plot": {
      const xs = block.points.map(point => point.x);
      const ys = block.points.map(point => point.y);
      issues.push(...axisIssues("Dispersión", "el eje horizontal", ["xMin", "xMax", "xStep"], xs, { min: block.xMin, max: block.xMax, step: block.xStep }, 8));
      issues.push(...axisIssues("Dispersión", "el eje vertical", ["yMin", "yMax", "yStep"], ys, { min: block.yMin, max: block.yMax, step: block.yStep }));
      if (block.trendLine && !linearRegression(block.points)) issues.push("Dispersión: todos los puntos tienen la misma x, así que no hay recta de tendencia. Quita trendLine o corrige los puntos.");
      break;
    }
    case "shapes":
      block.figures.forEach((figure, index) => {
        if (figure.kind !== "polygon") return;
        if (Math.abs(polygonArea(figure.vertices)) < 1e-9) issues.push(`Figuras: los vértices del polígono ${index + 1} están alineados; no forman una figura.`);
        if (figure.sideLabels.length > figure.vertices.length) issues.push(`Figuras: el polígono ${index + 1} tiene más rótulos que lados.`);
      });
      break;
    case "balance":
      for (const [name, side] of [["izquierdo", block.left], ["derecho", block.right]] as const) {
        if (side.variables + side.units + side.weights.length === 0) issues.push(`Balanza: el platillo ${name} está vacío.`);
      }
      break;
    default:
      break;
  }

  return issues;
}

/** Divisiones que caben en un eje de estas figuras sin que los números se monten. */
const CHART_TICKS_MAX = 20;

/** Problemas de un eje fijado a mano: rango invertido, datos que se salen, o demasiadas marcas. */
function axisIssues(figure: string, axisName: string, fields: readonly [string, string, string], data: number[], override: AxisOverride, target = 6): string[] {
  const [minField, maxField, stepField] = fields;
  const lowest = Math.min(...data);
  const highest = Math.max(...data);
  if (override.min !== undefined && override.max !== undefined && !(override.min < override.max)) {
    return [`${figure}: en ${axisName}, el inicio (${minField}) debe ser menor que el final (${maxField}).`];
  }
  const issues: string[] = [];
  if (override.min !== undefined && lowest < override.min) issues.push(`${figure}: ${axisName} empieza en ${formatNumber(override.min, 4)} (${minField}) y hay un dato menor, ${formatNumber(lowest, 4)}.`);
  if (override.max !== undefined && highest > override.max) issues.push(`${figure}: ${axisName} termina en ${formatNumber(override.max, 4)} (${maxField}) y hay un dato mayor, ${formatNumber(highest, 4)}.`);
  const axis = resolveAxis(lowest, highest, override, target);
  if ((axis.max - axis.min) / axis.step > CHART_TICKS_MAX) issues.push(`${figure}: demasiadas divisiones en ${axisName}; aumenta el paso (${stepField}).`);
  return issues;
}

function validateHistogram(block: Extract<BlockInput, { type: "histogram" }>): string[] {
  const shape = histogramClassIssues(block.classes);
  if (shape.length > 0) return shape.map(issue => `Histograma: ${issue}`);

  const issues: string[] = [];
  const highest = Math.max(...block.classes.map(item => item.frequency));
  if (!block.blank && !(highest > 0)) issues.push("Histograma: todas las frecuencias valen cero.");
  if (block.yMax !== undefined && block.yMax < highest) issues.push(`Histograma: el tope del eje (yMax = ${formatNumber(block.yMax)}) es menor que la frecuencia más alta (${highest}).`);
  if (block.yStep !== undefined && (block.yMax ?? highest) / block.yStep > CHART_TICKS_MAX) issues.push("Histograma: demasiadas divisiones en el eje vertical; aumenta el paso del eje (yStep).");

  // Con los datos crudos a la vista, las frecuencias no se creen: se cuentan
  if (block.data && block.data.length > 0) {
    const { counts, outside } = histogramCounts(block.data, block.classes);
    const first = block.classes[0].from;
    const last = block.classes[block.classes.length - 1].to;
    if (outside.length > 0) {
      const shown = outside.slice(0, 5).map(value => formatNumber(value, 4)).join(", ");
      issues.push(`Histograma: ${outside.length === 1 ? "un dato queda" : `${outside.length} datos quedan`} fuera de las clases, que van de ${formatNumber(first, 4)} a ${formatNumber(last, 4)}: ${shown}${outside.length > 5 ? "…" : ""}.`);
    } else if (counts.some((count, index) => count !== block.classes[index].frequency)) {
      issues.push(
        `Histograma: las frecuencias no coinciden con los datos (data). Al contarlos, las clases tienen ${counts.join(", ")} y el bloque dice ${block.classes.map(item => item.frequency).join(", ")}. Una clase incluye su límite inferior y no el superior, salvo la última.`,
      );
    }
  }
  return issues;
}

function validateNumberLine(block: Extract<BlockInput, { type: "number_line" }>): string[] {
  const issues: string[] = [];
  // Los avisos los lee la IA y también el docente en el formulario: nombre legible y, entre paréntesis, el campo
  if (!(block.min < block.max)) return ["Recta numérica: el valor inicial (min) debe ser menor que el final (max)."];
  const marks = (block.max - block.min) / block.step;
  if (marks > CREATOR_LIMITS.ticksMax) issues.push("Recta numérica: demasiadas marcas; aumenta el paso (step).");
  if (block.showNumbers && marks / block.labelEvery > 21) issues.push("Recta numérica: demasiados números para leerlos; escribe el número cada más marcas (labelEvery).");
  if (block.fractionDenominator !== undefined && !isMultipleOfFraction(block.step, block.fractionDenominator)) {
    issues.push(`Recta numérica: con denominador ${block.fractionDenominator}, el paso (step) debe ser un múltiplo de 1/${block.fractionDenominator}.`);
  }
  const inside = (value: number) => value >= block.min - 1e-9 && value <= block.max + 1e-9;
  block.points.forEach(point => {
    if (!inside(point.value)) issues.push(`Recta numérica: el punto ${formatNumber(point.value, 4)} queda fuera de la recta.`);
    if (point.label) {
      const error = checkLatex(point.label);
      if (error) issues.push(`Recta numérica: el rótulo del punto ${formatNumber(point.value, 4)} no es LaTeX válido (${error}).`);
    }
  });
  block.jumps.forEach(jump => {
    if (!inside(jump.from) || !inside(jump.to)) issues.push(`Recta numérica: el salto de ${formatNumber(jump.from, 4)} a ${formatNumber(jump.to, 4)} se sale de la recta.`);
    if (jump.from === jump.to) issues.push(`Recta numérica: un salto empieza y termina en ${formatNumber(jump.from, 4)}.`);
    if (jump.label) {
      const error = checkLatex(jump.label);
      if (error) issues.push(`Recta numérica: el rótulo de un salto no es LaTeX válido (${error}).`);
    }
  });
  block.intervals.forEach((interval, index) => {
    const from = interval.from ?? null;
    const to = interval.to ?? null;
    const name = `el intervalo ${index + 1}`;
    if (from === null && to === null) issues.push(`Recta numérica: ${name} no tiene extremos; indica al menos uno (from o to).`);
    if (from !== null && to !== null && !(from < to)) issues.push(`Recta numérica: en ${name}, el extremo izquierdo (from) debe ser menor que el derecho (to).`);
    for (const end of [from, to]) if (end !== null && !inside(end)) issues.push(`Recta numérica: el extremo ${formatNumber(end, 4)} de ${name} queda fuera de la recta.`);
  });
  return issues;
}

const FIGURE_TYPES: ReadonlySet<string> = new Set(["graph", "number_line", "fraction_model", "bar_chart", "pie_chart", "histogram", "box_plot", "line_chart", "scatter_plot", "shapes", "balance"]);

/** Palabras con las que un enunciado se refiere a una figura. */
const FIGURE_MENTION = /\b(gr[aá]fic[ao]s?|figuras?|planos?|diagramas?|histogramas?|balanzas?|rectas?\s+num[eé]ricas?|dibujos?|modelos?)\b/i;

const isFigure = (block: BlockInput | undefined): boolean => block !== undefined && FIGURE_TYPES.has(block.type);
const solvedOnFigure = (block: BlockInput | undefined): boolean => block?.type === "exercise" && block.answerSpace === "none";

/**
 * Problemas de orden entre bloques vecinos. Un ejercicio dibuja su espacio de respuesta
 * justo debajo del enunciado; si la figura a la que se refiere viene después, los renglones
 * quedan en medio y los separan.
 *
 * Una figura que sigue a un ejercicio no siempre es suya: puede ser el dato del ejercicio
 * siguiente, y entonces está bien donde está, sin un párrafo que la presente. Se avisa solo
 * cuando la figura no puede ser del siguiente (no viene otro ejercicio después) o cuando el
 * enunciado habla de una figura y no tiene otra delante que sea la suya.
 *
 * Cada aviso identifica el ejercicio, de modo que se pueda comparar el documento antes y
 * después de un cambio.
 */
export function validateBlockOrder(sections: Array<{ title: string; blocks: BlockInput[] }>): string[] {
  const issues: string[] = [];
  for (const section of sections) {
    section.blocks.forEach((block, index) => {
      const next = section.blocks[index + 1];
      if (block.type !== "exercise" || block.answerSpace === "none" || !next || !isFigure(next)) return;

      const followedByExercise = section.blocks[index + 2]?.type === "exercise";
      if (followedByExercise) {
        const mentionsFigure = [block.md, ...block.parts.map(part => part.md)].some(md => FIGURE_MENTION.test(md));
        // La figura de delante es suya, salvo que el ejercicio anterior se resuelva sobre ella
        const hasOwnFigure = isFigure(section.blocks[index - 1]) && !solvedOnFigure(section.blocks[index - 2]);
        if (!mentionsFigure || hasOwnFigure) return;
      }

      issues.push(
        `Sección «${section.title}», ${block.label}: su espacio de respuesta queda entre el enunciado y la figura que sigue (${next.type}). ` +
          `Si el ejercicio se resuelve sobre esa figura, usa answerSpace "none". Si la figura es un dato que el estudiante debe leer, ponla antes del enunciado. ` +
          (followedByExercise
            ? `Si la figura es del ejercicio siguiente, este enunciado necesita la suya delante, porque habla de una figura.`
            : `Si la figura es de un ejercicio posterior, ponla justo antes de ese ejercicio.`),
      );
    });
  }
  return issues;
}

export function validateBlocks(blocks: BlockInput[]): string[] {
  return blocks.flatMap((block, index) => validateBlock(block).map(issue => `Bloque ${index + 1} — ${issue}`));
}

import katex from "katex";
import { blockTexts, CREATOR_LIMITS, extractMath, type BlockInput, type GraphSpec } from "./creator";
import { isMultipleOfFraction, polygonArea } from "./creatorFigures";
import { formatNumber, nearlyEqual, tryCompile } from "./creatorMath";

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

/** Valores de y de una tabla de valores; null donde la función no está definida. */
export function computeValueTable(expr: string, xs: number[]): Array<number | null> {
  const compiled = tryCompile(expr);
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
      const compiled = tryCompile(block.expr);
      if (!compiled.ok) {
        issues.push(`Tabla de valores: "${block.expr}" no se puede evaluar: ${compiled.error}`);
      } else {
        for (const x of block.xs) {
          if (!Number.isFinite(compiled.fn(x))) issues.push(`Tabla de valores: "${block.expr}" no está definida en x = ${formatNumber(x)}.`);
        }
      }
      const error = checkLatex(block.exprLatex);
      if (error) issues.push(`Tabla de valores: exprLatex no es LaTeX válido (${error}).`);
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
    case "shapes":
      block.figures.forEach((figure, index) => {
        if (figure.kind !== "polygon") return;
        if (Math.abs(polygonArea(figure.vertices)) < 1e-9) issues.push(`Figuras: los vértices del polígono ${index + 1} están alineados; no forman una figura.`);
        if (figure.sideLabels.length > figure.vertices.length) issues.push(`Figuras: el polígono ${index + 1} tiene más rótulos que lados.`);
      });
      break;
    case "balance":
      for (const [name, side] of [["izquierdo", block.left], ["derecho", block.right]] as const) {
        if (side.variables + side.units === 0) issues.push(`Balanza: el platillo ${name} está vacío.`);
      }
      break;
    default:
      break;
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
  return issues;
}

const FIGURE_TYPES: ReadonlySet<string> = new Set(["graph", "number_line", "fraction_model", "bar_chart", "pie_chart", "shapes", "balance"]);

/**
 * Problemas de orden entre bloques vecinos. Un ejercicio dibuja su espacio de respuesta
 * justo debajo del enunciado; si lo que sigue es una figura, los renglones quedan en medio
 * y separan el enunciado de la figura. Cada aviso identifica el ejercicio, de modo que se
 * pueda comparar el documento antes y después de un cambio.
 */
export function validateBlockOrder(sections: Array<{ title: string; blocks: BlockInput[] }>): string[] {
  const issues: string[] = [];
  for (const section of sections) {
    section.blocks.forEach((block, index) => {
      const next = section.blocks[index + 1];
      if (block.type !== "exercise" || block.answerSpace === "none" || !next || !FIGURE_TYPES.has(next.type)) return;
      issues.push(
        `Sección «${section.title}», ${block.label}: su espacio de respuesta queda entre el enunciado y la figura que sigue (${next.type}). ` +
          `Si el ejercicio se resuelve sobre esa figura, usa answerSpace "none". Si la figura es un dato que el estudiante debe leer, ponla antes del enunciado. ` +
          `Si la figura pertenece a lo que viene después, sepárala del ejercicio con un título o un párrafo que la presente.`,
      );
    });
  }
  return issues;
}

export function validateBlocks(blocks: BlockInput[]): string[] {
  return blocks.flatMap((block, index) => validateBlock(block).map(issue => `Bloque ${index + 1} — ${issue}`));
}

/**
 * Tamaño de presentación de una figura: cuánto ocupa en la hoja. Es un campo opcional del bloque
 * (`size`); sin él la figura mide su ancho de diseño, el que fija su componente en
 * client/src/creator/blocks, como siempre.
 *
 * Los tamaños son relativos a ese ancho: la figura se dibuja igual y se amplía o se reduce entera,
 * con sus rótulos. Por eso hay un piso y un techo:
 * - el pequeño es el ancho más angosto en que los rótulos todavía se leen en papel, el mismo umbral
 *   que decide qué cabe en una columna (creatorContainers.ts);
 * - nada pasa del doble del diseño: un reloj o un ángulo a todo lo ancho se vería con trazos y letras
 *   enormes, así que a esas figuras no se les ofrece el ancho completo.
 *
 * El ancho disponible es el de la hoja o, dentro de unas columnas o unas tarjetas, el de su celda:
 * ahí manda la celda y una figura nunca se sale de ella.
 */

export const FIGURE_SIZES = ["small", "medium", "large", "full"] as const;
export type FigureSize = (typeof FIGURE_SIZES)[number];

export const FIGURE_SIZE_LABELS: Record<FigureSize, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
  full: "Ancho completo",
};

/** Por debajo de esta fracción del ancho de diseño los rótulos bajan de unos 7 pt en papel. */
export const FIGURE_SCALE_MIN = 0.75;
/** Nunca más del doble del diseño: los trazos y las letras crecen con la figura. */
export const FIGURE_SCALE_MAX = 2;

/** Cuánto mide cada tamaño respecto del ancho de diseño, en pantalla. El ancho completo llena lo disponible. */
export const FIGURE_SIZE_SCALE: Record<Exclude<FigureSize, "full">, number> = {
  small: FIGURE_SCALE_MIN,
  medium: 1,
  large: 1.3,
};

/**
 * En papel las figuras van algo más pequeñas que en pantalla, para que quepan más cosas por hoja
 * (las mismas proporciones que aplica creator.css al imprimir). El plano se reduce un poco más.
 */
export const PRINT_SCALE = { figure: 0.86, plane: 0.8 } as const;
export type FigureKind = keyof typeof PRINT_SCALE;

/** Ancho útil de la hoja en pantalla: 816 px de hoja con 52 de margen a cada lado. En papel, SHEET_WIDTH_PX. */
export const SCREEN_SHEET_WIDTH_PX = 712;

/**
 * El plano no se ofrece pequeño: sus números (10,5 px en el diseño) ya van reducidos en papel y por
 * debajo de su ancho de diseño bajan de 6 pt. Las demás figuras aguantan el pequeño.
 */
const NO_SMALL: ReadonlySet<string> = new Set(["graph"]);

/** Si un tipo de figura admite este tamaño. */
export const figureSizeAllowed = (type: string, size: FigureSize) => size !== "small" || !NO_SMALL.has(type);

/** Lo mismo que «sin tamaño»: el mediano no se guarda, así una figura sin el campo y una mediana son iguales. */
export const storedFigureSize = (size: FigureSize | undefined): FigureSize | undefined => (size === "medium" ? undefined : size);

/**
 * Lo que mide la figura, en píxeles CSS, con este tamaño y este ancho disponible. Sin `print`, en
 * pantalla; con él, en papel (el pequeño no se reduce más: ya está en el mínimo legible).
 */
export function figureWidth(size: FigureSize | undefined, design: number, available: number, print?: FigureKind): number {
  const most = Math.min(available, design * FIGURE_SCALE_MAX);
  if (size === "full") return most;
  const scale = FIGURE_SIZE_SCALE[size ?? "medium"];
  const target = print ? Math.max(design * FIGURE_SCALE_MIN, design * scale * PRINT_SCALE[print]) : design * scale;
  return Math.min(target, most);
}

/** Una opción del selector de tamaño: puede reunir varios tamaños que ahí se ven igual. */
export interface FigureSizeChoice {
  /** El tamaño que se guarda al elegirla (el mediano, si está entre ellos: es el de siempre). */
  size: FigureSize;
  /** Todos los tamaños que dan este mismo ancho. */
  sizes: FigureSize[];
  /** Ancho en pantalla, en píxeles CSS. */
  width: number;
}

/** Dos anchos que difieren en menos de esto se ven iguales: no vale la pena ofrecerlos por separado. */
const SAME_WIDTH = 1.04;

/**
 * Los tamaños que tiene sentido ofrecer para una figura de este ancho de diseño en este ancho
 * disponible (el de la hoja o el de su celda, en pantalla). Los que dan el mismo ancho se reúnen
 * en una sola opción: en una columna angosta, mediano, grande y completo son lo mismo, y se ofrece
 * uno. El ancho completo no se ofrece si la figura no alcanza a llenar el ancho sin pasar del doble,
 * ni el pequeño a un tipo que no lo aguanta (`figureSizeAllowed`).
 */
export function figureSizeChoices(design: number, available: number, type?: string): FigureSizeChoice[] {
  const choices: FigureSizeChoice[] = [];
  for (const size of FIGURE_SIZES) {
    if (type !== undefined && !figureSizeAllowed(type, size)) continue;
    if (size === "full" && design * FIGURE_SCALE_MAX < available - 0.5) continue;
    const width = figureWidth(size, design, available);
    const last = choices[choices.length - 1];
    if (last && width <= last.width * SAME_WIDTH) {
      last.sizes.push(size);
      // La opción guarda el mediano si lo incluye; si no, el más grande de los que reúne
      if (last.size !== "medium") last.size = size;
      last.width = Math.max(last.width, width);
      continue;
    }
    choices.push({ size, sizes: [size], width });
  }
  return choices;
}

/** La opción que corresponde al tamaño actual (sin tamaño, el mediano). */
export const currentSizeChoice = (choices: readonly FigureSizeChoice[], size: FigureSize | undefined) => choices.find(choice => choice.sizes.includes(size ?? "medium")) ?? null;

/** Centímetros en papel de un ancho en píxeles CSS (96 por pulgada), con una cifra decimal y coma. */
export const pxToCm = (px: number) => ((px * 2.54) / 96).toFixed(1).replace(".", ",");

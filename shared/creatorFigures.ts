/**
 * Cálculos de las figuras del Creador de recursos (recta numérica, diagramas, modelos de
 * fracción). Son funciones puras, sin dibujo: las usan los componentes que pintan la
 * figura y los validadores, para que lo que se ve salga siempre de los datos.
 */

/** Múltiplos de `step` dentro de [min, max], contados con enteros para no acumular error. */
export function tickValues(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) return [];
  const values: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) values.push(Number((k * step).toFixed(10)));
  return values;
}

/** Paso "redondo" (1, 2, 2.5 o 5 por una potencia de 10) que deja unas `target` divisiones. */
export function niceStep(maxValue: number, target = 6): number {
  if (!(maxValue > 0)) return 1;
  const rough = maxValue / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const ratio = rough / magnitude;
  const factor = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return Number((factor * magnitude).toPrecision(12));
}

/** Tope del eje: el primer múltiplo del paso que queda por encima del valor más alto. */
export function niceMax(maxValue: number, step: number): number {
  if (!(maxValue > 0)) return step;
  return Number((Math.ceil(maxValue / step - 1e-9) * step).toPrecision(12));
}

/**
 * Porcentajes enteros que suman exactamente 100 (método del resto mayor). Redondear cada
 * sector por separado puede dar 99 o 101, y un diagrama circular así confunde.
 */
export function roundPercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
  if (!(total > 0)) return values.map(() => 0);
  const exact = values.map(value => ((value > 0 ? value : 0) / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (missing <= 0) break;
    floors[index]++;
    missing--;
  }
  return floors;
}

/** Un valor de la recta como fracción de denominador fijo, en LaTeX: 0.75 con 4 → \frac{3}{4}; 1 → 1. */
export function fractionLatex(value: number, denominator: number): string {
  const numerator = Math.round(value * denominator);
  if (numerator % denominator === 0) return String(numerator / denominator);
  const sign = numerator < 0 ? "-" : "";
  return `${sign}\\frac{${Math.abs(numerator)}}{${denominator}}`;
}

/** true si el valor cae en una marca exacta de denominador `denominator`. */
export function isMultipleOfFraction(value: number, denominator: number): boolean {
  const scaled = value * denominator;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Parte un rótulo en hasta dos líneas para que quepa bajo una barra. */
export function wrapLabel(text: string, maxChars: number): string[] {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/(?<=[\s/-])/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + word).trimEnd().length > maxChars && lines.length === 0) {
      lines.push(current.trimEnd());
      current = word;
    } else {
      current += word;
    }
  }
  lines.push(current.trimEnd());
  const second = lines[1];
  if (second && second.length > maxChars + 2) lines[1] = `${second.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return lines.slice(0, 2);
}

/** true si el texto cabe entero en los dos renglones de wrapLabel, sin recortarse. */
export function labelFits(text: string, maxChars: number): boolean {
  const compact = (value: string) => value.replace(/\s+/g, "");
  const lines = wrapLabel(text, maxChars);
  return lines.every(line => line.length <= maxChars + 2) && compact(lines.join("")) === compact(text);
}

/** Números de una lista escrita a mano en un formulario: separados por comas, punto y coma o espacios, con punto decimal. */
export function parseNumberList(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(value => Number(value.replace("−", "-")));
}

/** Enteros que ocupa un modelo de fracción: 5/4 necesita dos figuras. */
export function wholesNeeded(numerator: number, denominator: number): number {
  return Math.max(1, Math.ceil(numerator / denominator));
}

/** Área (con signo) de un polígono; cero si sus vértices están alineados. */
export function polygonArea(vertices: Array<{ x: number; y: number }>): number {
  let twice = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

/** Ángulos de inicio y fin (grados, desde las 12 en sentido horario) de cada sector. */
export function pieAngles(values: number[]): Array<{ start: number; end: number }> {
  const total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
  let cursor = 0;
  return values.map(value => {
    const sweep = total > 0 ? ((value > 0 ? value : 0) / total) * 360 : 0;
    const slice = { start: cursor, end: cursor + sweep };
    cursor += sweep;
    return slice;
  });
}

/* ── Rótulos de los lados de un polígono ── */

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SideLabelPlacement {
  /** Índice del lado: va del vértice `side` al siguiente. */
  side: number;
  /** Punto de anclaje, en las mismas unidades que los vértices (píxeles, con y hacia abajo). */
  x: number;
  y: number;
  /** Qué punto del rótulo cae en (x, y); "top" = el rótulo queda debajo del punto. */
  anchor: "center" | "top" | "bottom" | "left" | "right";
  /** Caja estimada del rótulo: para reservar margen y para las pruebas. */
  box: LabelBox;
}

type Point = { x: number; y: number };

/** Tamaño aproximado de un rótulo corto ("8 m", "$x + 2$ cm") a 14 px, sin medir el DOM. */
export function estimateLabelSize(md: string): { w: number; h: number } {
  const plain = md.replace(/\\[a-zA-Z]+/g, "x").replace(/[${}\\^_*]/g, "");
  return { w: Math.max(2, plain.trim().length) * 7.4 + 8, h: 18 };
}

const boxesOverlap = (a: LabelBox, b: LabelBox, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** true si la caja pisa el polígono: lo cruza un lado, o queda toda dentro. */
export function boxTouchesPolygon(box: LabelBox, polygon: Point[]): boolean {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  const within = (point: Point) => point.x > box.x && point.x < box.x + box.w && point.y > box.y && point.y < box.y + box.h;
  if (pointInPolygon({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (within(a) || within({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) return true;
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, corners[k], corners[(k + 1) % 4])) return true;
  }
  return false;
}

/** Posiciones a lo largo del lado (0.5 = el centro) y separaciones, de la preferida a la última. */
const SIDE_POSITIONS = [0.5, 0.38, 0.62, 0.28, 0.72, 0.18, 0.82, 0.1, 0.9];
const SIDE_OFFSETS = [7, 12, 18, 26, 36];
/** Costo de pisar la figura u otro rótulo: pesa más que cualquier distancia. */
const COLLISION = 1000;
/** Aire mínimo entre dos rótulos: pegados se leen como uno solo ("4 m 6 m"). */
const LABEL_CLEARANCE = 5;

/**
 * Ubica el rótulo de cada lado de un polígono, convexo o cóncavo.
 *
 * Cada rótulo va por fuera de su lado: la normal exterior sale de la orientación del polígono
 * (el signo de su área), no del centroide, que en una L o una T cae del lado equivocado de las
 * muescas. Entre varias posiciones posibles gana la que no pisa la figura ni otro rótulo y
 * queda más cerca del centro del lado. Los lados cortos se ubican primero: tienen menos sitio.
 */
export function placeSideLabels(points: Point[], labels: string[], sizeOf: (md: string) => { w: number; h: number } = estimateLabelSize): SideLabelPlacement[] {
  const outward = polygonArea(points) >= 0 ? 1 : -1;
  const sides = points
    .map((point, side) => {
      const next = points[(side + 1) % points.length];
      return { side, text: labels[side] ?? "", from: point, dx: next.x - point.x, dy: next.y - point.y, length: Math.hypot(next.x - point.x, next.y - point.y) };
    })
    .filter(item => item.text && item.length > 0)
    .sort((a, b) => a.length - b.length || a.side - b.side);

  // Sitios posibles de cada rótulo, con lo que cuesta cada uno sin contar a los demás rótulos
  const options = sides.map(({ side, text, from, dx, dy, length }) => {
    const normal = { x: (outward * dy) / length, y: (-outward * dx) / length };
    const size = sizeOf(text);
    // Distancia del centro de la caja a su borde en la dirección de la normal
    const reach = (Math.abs(normal.x) * size.w) / 2 + (Math.abs(normal.y) * size.h) / 2;
    return SIDE_POSITIONS.flatMap(t =>
      SIDE_OFFSETS.map(offset => {
        const cx = from.x + dx * t + normal.x * (offset + reach);
        const cy = from.y + dy * t + normal.y * (offset + reach);
        const box = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
        const inset = { x: box.x + 1.5, y: box.y + 1.5, w: box.w - 3, h: box.h - 3 };
        const cost = (boxTouchesPolygon(inset, points) ? COLLISION : 0) + Math.abs(t - 0.5) * length * 0.5 + (offset - SIDE_OFFSETS[0]) * 0.8;
        // En lados horizontales o verticales se ancla el borde cercano: la distancia al lado no depende del ancho estimado
        let placement: SideLabelPlacement = { side, x: cx, y: cy, anchor: "center", box };
        if (Math.abs(normal.x) > 0.92) placement = { side, x: normal.x > 0 ? box.x : box.x + box.w, y: cy, anchor: normal.x > 0 ? "left" : "right", box };
        else if (Math.abs(normal.y) > 0.92) placement = { side, x: cx, y: normal.y > 0 ? box.y : box.y + box.h, anchor: normal.y > 0 ? "top" : "bottom", box };
        return { placement, cost };
      }),
    );
  });

  const chosen: Array<SideLabelPlacement | undefined> = options.map(() => undefined);
  const clash = (a: SideLabelPlacement, b: SideLabelPlacement | undefined) => b !== undefined && boxesOverlap(a.box, b.box, LABEL_CLEARANCE);
  /** Costo de un sitio frente a los rótulos ya puestos, sin contar los de `skip`. */
  const costOf = (candidate: (typeof options)[number][number], skip: number[]) =>
    candidate.cost + chosen.filter((other, at) => !skip.includes(at) && clash(candidate.placement, other)).length * COLLISION;

  // Cada rótulo toma su mejor sitio frente a los ya puestos; después se repasa, porque el primero
  // en elegir no sabía dónde iban a quedar los demás. Así el resultado no depende del orden de los vértices.
  const settle = () => {
    for (let round = 0; round < 4; round++) {
      let moved = false;
      options.forEach((candidates, index) => {
        let best = candidates[0];
        let bestCost = Infinity;
        for (const candidate of candidates) {
          const cost = costOf(candidate, [index]);
          if (cost < bestCost) {
            best = candidate;
            bestCost = cost;
          }
        }
        if (chosen[index] !== best.placement) moved = true;
        chosen[index] = best.placement;
      });
      if (!moved) break;
    }
  };
  settle();

  // En una muesca estrecha, mover un solo rótulo no alcanza: los dos que chocan se reubican a la vez
  for (let round = 0; round < 3; round++) {
    let fixed = false;
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const a = chosen[i];
        if (!a || !clash(a, chosen[j])) continue;
        let bestCost = Infinity;
        let pair: [SideLabelPlacement, SideLabelPlacement] | null = null;
        for (const first of options[i]) {
          const firstCost = costOf(first, [i, j]);
          if (firstCost >= bestCost) continue;
          for (const second of options[j]) {
            const cost = firstCost + costOf(second, [i, j]) + (clash(first.placement, second.placement) ? COLLISION : 0);
            if (cost < bestCost) {
              bestCost = cost;
              pair = [first.placement, second.placement];
            }
          }
        }
        if (pair && (pair[0] !== chosen[i] || pair[1] !== chosen[j])) {
          [chosen[i], chosen[j]] = pair;
          fixed = true;
        }
      }
    }
    if (!fixed) break;
    settle();
  }
  return chosen.filter((item): item is SideLabelPlacement => item !== undefined).sort((a, b) => a.side - b.side);
}

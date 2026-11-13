/**
 * Anotaciones de una figura: notas de texto cortas que el docente pone sobre ella. Son comunes a todos
 * los tipos de figura: cada nota guarda su posición como fracción de la caja de la figura (0 a 1 en
 * cada eje), así sigue en su sitio a cualquier tamaño, en una columna y en papel. Una nota puede
 * señalar un punto con una línea.
 *
 * Las pone y las mueve el docente; la IA no las escribe y las conserva al editar la figura
 * (keepFigureLayout en creatorOps.ts).
 */

/** Notas por figura: más que esto tapa la figura que explican. */
export const FIGURE_NOTES_MAX = 6;
export const FIGURE_NOTE_TEXT_MAX = 80;

export interface NotePoint {
  x: number;
  y: number;
}

export interface FigureNote extends NotePoint {
  text: string;
  /** El punto que señala la nota, si lleva línea. */
  pointer?: NotePoint;
}

/** Una coordenada dentro de la caja, redondeada a milésimas: lo que se guarda no arrastra decimales de más. */
export const clampUnit = (value: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5)) * 1000) / 1000;

export const clampPoint = (point: NotePoint): NotePoint => ({ x: clampUnit(point.x), y: clampUnit(point.y) });

/** Dónde cae un punto de la pantalla dentro de la caja de la figura (lo que queda fuera se lleva al borde). */
export function pointInBox(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): NotePoint {
  if (!(box.width > 0) || !(box.height > 0)) return { x: 0.5, y: 0.5 };
  return clampPoint({ x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height });
}

/** Lo que mueve una flecha del teclado: un paso corto, o uno largo con Mayús. */
export const NOTE_STEP = 0.01;
export const NOTE_STEP_LONG = 0.05;

/** El desplazamiento de una tecla de flecha, o `null` si no es una. */
export function arrowStep(key: string, long: boolean): NotePoint | null {
  const step = long ? NOTE_STEP_LONG : NOTE_STEP;
  switch (key) {
    case "ArrowLeft":
      return { x: -step, y: 0 };
    case "ArrowRight":
      return { x: step, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -step };
    case "ArrowDown":
      return { x: 0, y: step };
    default:
      return null;
  }
}

export const movePoint = (point: NotePoint, by: NotePoint): NotePoint => clampPoint({ x: point.x + by.x, y: point.y + by.y });

/**
 * Dónde va una nota nueva: en una esquina (arriba al centro suele estar el título de la figura), en la
 * primera que no esté ocupada por otra nota (a menos de un décimo de la caja); si no, más adentro.
 */
export function newNotePosition(existing: readonly NotePoint[]): NotePoint {
  const spots: NotePoint[] = [
    { x: 0.82, y: 0.1 },
    { x: 0.18, y: 0.1 },
    { x: 0.82, y: 0.9 },
    { x: 0.18, y: 0.9 },
    { x: 0.5, y: 0.9 },
    { x: 0.5, y: 0.5 },
  ];
  const free = spots.find(spot => existing.every(note => Math.hypot(note.x - spot.x, note.y - spot.y) > 0.1));
  return free ?? { x: 0.5, y: 0.5 };
}

/** El punto que señala una nota cuando se le añade la línea: un poco hacia el centro de la figura. */
export function defaultPointer(note: NotePoint): NotePoint {
  return clampPoint({ x: note.x + (0.5 - note.x) * 0.5, y: note.y + (note.y < 0.5 ? 0.22 : -0.22) });
}

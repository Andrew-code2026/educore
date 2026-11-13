import type { InlineShortcutDefinitions, MathfieldElement, VirtualKeyboardInterface, VirtualKeyboardLayout } from "mathlive";

/**
 * El campo matemático (MathLive) solo se usa para escribir fórmulas, y pesa: se descarga la primera
 * vez que se abre un cuadro de fórmula, no con el editor. Si no llega, el cuadro sigue funcionando
 * con el campo de LaTeX.
 */

export interface MathKit {
  MathfieldElement: typeof MathfieldElement;
  keyboard: VirtualKeyboardInterface & EventTarget;
}

/** Media tecla en blanco entre el bloque de números y el de símbolos. */
const GAP = { label: "[separator]", width: 0.5 } as const;
const DEGREES = { label: "°", insert: "#@^{\\circ}", tooltip: "Grados" };
/** Del ancho de las demás: la de la librería es más ancha y descuadra la fila. */
const BACKSPACE = { label: "[backspace]", width: 1.0 } as const;

/**
 * Teclas de 1.º a 11.º: lo que no está aquí se escribe con el teclado físico o en LaTeX.
 * Las filas van a diez teclas porque la librería reparte el ancho entre diez.
 */
const KEYBOARD_LAYOUTS: (VirtualKeyboardLayout | "alphabetic")[] = [
  {
    id: "educore-numeros",
    label: "123",
    tooltip: "Números y operaciones",
    rows: [
      ["[7]", "[8]", "[9]", { latex: "\\div", tooltip: "Dividir" }, GAP, { latex: "\\frac{#@}{#?}", class: "small", tooltip: "Fracción" }, { latex: "#@^{2}", tooltip: "Al cuadrado" }, { latex: "#@^{#?}", tooltip: "Potencia" }, { latex: "\\sqrt{#0}", tooltip: "Raíz cuadrada" }, BACKSPACE],
      ["[4]", "[5]", "[6]", { latex: "\\times", tooltip: "Multiplicar" }, GAP, "[(]", "[)]", { latex: "#@_{#?}", tooltip: "Subíndice" }, { latex: "\\pi", tooltip: "Pi" }, { latex: "\\%", tooltip: "Por ciento" }],
      ["[1]", "[2]", "[3]", "[-]", GAP, { latex: "<", tooltip: "Menor que" }, { latex: ">", tooltip: "Mayor que" }, { latex: "\\le", tooltip: "Menor o igual" }, { latex: "\\ge", tooltip: "Mayor o igual" }, { latex: "\\ne", tooltip: "Distinto de" }],
      ["[0]", "[.]", "[=]", "[+]", GAP, "x", "y", DEGREES, "[left]", "[right]"],
    ],
  },
  {
    id: "educore-simbolos",
    label: "αβγ",
    tooltip: "Símbolos y letras griegas",
    rows: [
      ["\\alpha", "\\beta", "\\gamma", "\\delta", "\\theta", "\\lambda", "\\mu", "\\sigma", "\\Delta", BACKSPACE],
      [
        DEGREES,
        { latex: "\\angle", tooltip: "Ángulo" },
        { latex: "\\triangle", tooltip: "Triángulo" },
        { latex: "\\perp", tooltip: "Perpendicular" },
        { latex: "\\parallel", tooltip: "Paralela" },
        { latex: "\\approx", tooltip: "Aproximadamente" },
        { latex: "\\pm", tooltip: "Más o menos" },
        { latex: "\\infty", tooltip: "Infinito" },
        { latex: "\\cdot", tooltip: "Por" },
        { latex: ":", tooltip: "Razón" },
      ],
      [
        { latex: "\\sqrt[#?]{#0}", class: "small", tooltip: "Raíz de otro índice" },
        { label: "|x|", insert: "\\left|#0\\right|", class: "small", tooltip: "Valor absoluto" },
        { latex: "\\in", tooltip: "Pertenece a" },
        { latex: "\\notin", tooltip: "No pertenece a" },
        { latex: "\\cup", tooltip: "Unión" },
        { latex: "\\cap", tooltip: "Intersección" },
        { latex: "\\subset", tooltip: "Subconjunto" },
        { latex: "\\varnothing", tooltip: "Conjunto vacío" },
        { latex: "\\Rightarrow", tooltip: "Entonces" },
        { latex: "\\ldots", tooltip: "Puntos suspensivos" },
      ],
      ["x", "y", "n", "a", "b", "[(]", "[)]", "[=]", "[left]", "[right]"],
    ],
  },
  "alphabetic",
];

/** Los atajos por defecto convierten trozos de palabras («del», «int» de «interés», «sum» de «suma»). */
const AFTER_NO_LETTER = "nothing+digit+function+frac+surd+binop+relop+punct+array+openfence+closefence+space+text";
const greek = (name: string) => ({ after: AFTER_NO_LETTER, value: `\\${name}` });

/** Lo que se convierte al escribir con el teclado físico. Una lista corta y predecible. */
export const SHORTCUTS: InlineShortcutDefinitions = {
  "%": "\\%",
  $: "\\$",
  "&": "\\&",
  "<=": "\\le",
  ">=": "\\ge",
  "!=": "\\ne",
  "≤": "\\le",
  "≥": "\\ge",
  "≠": "\\ne",
  "≈": "\\approx",
  "±": "\\pm",
  "*": "\\cdot",
  "×": "\\times",
  "÷": "\\div",
  "=>": "\\Rightarrow",
  "...": "\\ldots",
  "∞": "\\infty",
  π: "\\pi",
  sqrt: "\\sqrt{#?}",
  raiz: "\\sqrt{#?}",
  sin: "\\sin",
  sen: "\\operatorname{sen}",
  cos: "\\cos",
  tan: "\\tan",
  log: "\\log",
  ln: "\\ln",
  mcd: "\\operatorname{mcd}",
  mcm: "\\operatorname{mcm}",
  pi: "\\pi",
  infinito: "\\infty",
  alpha: greek("alpha"),
  beta: greek("beta"),
  gamma: greek("gamma"),
  delta: greek("delta"),
  Delta: greek("Delta"),
  theta: greek("theta"),
  lambda: greek("lambda"),
  mu: greek("mu"),
  sigma: greek("sigma"),
  omega: greek("omega"),
};

/* Los nombres de clase del teclado son de la librería y no forman parte de su API: solo se nombran aquí. */

/** ¿El teclado en pantalla está dibujado dentro de `slot`? Vale aunque `slot` ya no esté en el documento. */
export const holdsKeyboard = (slot: Element | null): boolean => Boolean(slot?.querySelector(".ML__keyboard"));

/** ¿`target` es parte del teclado en pantalla? Las variantes de una tecla se dibujan fuera de su contenedor. */
export const isKeyboardSurface = (target: Element | null): boolean => Boolean(target?.closest?.(".ML__keyboard, .MLK__variant-panel"));

let kit: MathKit | null = null;
let pending: Promise<MathKit | null> | null = null;

/** El campo ya descargado, para abrir el cuadro sin un parpadeo de «cargando». */
export const loadedMathKit = (): MathKit | null => kit;

export function loadMathKit(): Promise<MathKit | null> {
  if (kit) return Promise.resolve(kit);
  pending ??= import("mathlive")
    .then(({ MathfieldElement }) => {
      // Las letras son las de KaTeX, que la hoja ya tiene cargadas; el teclado no suena
      MathfieldElement.fontsDirectory = null;
      MathfieldElement.soundsDirectory = null;
      MathfieldElement.locale = "es";
      MathfieldElement.decimalSeparator = ",";
      const keyboard = window.mathVirtualKeyboard;
      keyboard.layouts = KEYBOARD_LAYOUTS;
      keyboard.editToolbar = "none";
      kit = { MathfieldElement, keyboard };
      return kit;
    })
    .catch(error => {
      console.warn("[Creator] No se pudo cargar el campo matemático; se usa el de LaTeX.", error);
      // Un fallo de red no es definitivo: el siguiente cuadro lo vuelve a intentar
      pending = null;
      return null;
    });
  return pending;
}

/** Pone en `parent` un campo listo para escribir: sin menú propio, sin su botón de teclado y con los atajos de la casa. */
export function mountMathField({ MathfieldElement }: MathKit, parent: HTMLElement, label: string): MathfieldElement {
  const field = new MathfieldElement();
  field.mathVirtualKeyboardPolicy = "manual";
  field.popoverPolicy = "off";
  field.smartMode = false;
  field.setAttribute("aria-label", label);
  parent.append(field);
  // Los atajos y el menú solo se pueden cambiar con el campo ya en el documento
  field.inlineShortcuts = SHORTCUTS;
  field.menuItems = [];
  return field;
}

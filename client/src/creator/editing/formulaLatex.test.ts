import { describe, expect, it } from "vitest";
import { extractMath, blockTexts, type BlockInput } from "@shared/creator";
import { buildSampleDoc, SAMPLE_IDS } from "@shared/creatorSample";
import { checkLatex } from "@shared/creatorValidate";
import { REAL_FORMULAS, TYPED, UNFIT_FORMULAS, VARIED_FORMULAS } from "./formulaField.fixtures";
import { drawingSignature, fieldResult, fitsField, fromField, hasEmptySlot, sameDrawing, tokenize } from "./formulaLatex";

const typed = new Map(TYPED);
/** Lo que queda en la hoja tras teclear `keys` en el campo. */
const stored = (keys: string) => {
  const readBack = typed.get(keys);
  if (readBack === undefined) throw new Error(`Falta grabar las teclas ${keys}`);
  return fromField(readBack);
};

describe("lectura del LaTeX", () => {
  it("parte la fórmula en piezas sin perder nada", () => {
    for (const [original, readBack] of [...REAL_FORMULAS, ...VARIED_FORMULAS, ...UNFIT_FORMULAS]) {
      expect(tokenize(original).join("")).toBe(original);
      expect(tokenize(readBack).join("")).toBe(readBack);
    }
  });

  it("trata el texto como una sola pieza", () => {
    expect(tokenize("39 \\text{ m}^2")).toEqual(["3", "9", " ", "\\text{ m}", "^", "2"]);
    expect(tokenize("\\frac{1}{2}\\,x\\\\")).toEqual(["\\frac", "{", "1", "}", "{", "2", "}", "\\,", "x", "\\\\"]);
  });
});

describe("del campo a la hoja", () => {
  it("devuelve las llaves a fracciones y raíces", () => {
    expect(fromField("\\frac34")).toBe("\\frac{3}{4}");
    expect(fromField("\\frac1{x+1}")).toBe("\\frac{1}{x+1}");
    expect(fromField("\\frac\\pi2")).toBe("\\frac{\\pi}{2}");
    expect(fromField("\\sqrt2\\approx1{,}41")).toBe("\\sqrt{2}\\approx1{,}41");
    expect(fromField("\\sqrt[3]{27}")).toBe("\\sqrt[3]{27}");
    expect(fromField("\\frac{1}{2+\\frac13}")).toBe("\\frac{1}{2+\\frac{1}{3}}");
  });

  it("no deja un exponente o un subíndice de una cifra pegado a otra cifra", () => {
    expect(fromField("\\log_28")).toBe("\\log_{2}8");
    expect(fromField("2^10")).toBe("2^{1}0");
    expect(fromField("x^2y")).toBe("x^2y");
    expect(fromField("x^{10}")).toBe("x^{10}");
  });

  it("deja llanos los paréntesis que rodean algo bajo y conserva los que rodean algo alto", () => {
    expect(fromField("\\left(x+1\\right)\\left(x-2\\right)")).toBe("(x+1)(x-2)");
    expect(fromField("\\left(a+b\\right)^2")).toBe("(a+b)^2");
    expect(fromField("\\sin\\left(x\\right)")).toBe("\\sin(x)");
    expect(fromField("\\left|x\\right|")).toBe("|x|");
    expect(fromField("\\left\\lbrack0{,}1\\right)")).toBe("[0{,}1)");
    expect(fromField("\\left\\lbrace1{,}2{,}3\\right\\rbrace")).toBe("\\{1,2,3\\}");
    expect(fromField("\\left(\\frac12\\right)^2")).toBe("\\left(\\frac{1}{2}\\right)^2");
    expect(fromField("\\left(\\left(a+b\\right)c\\right)")).toBe("((a+b)c)");
    expect(fromField("\\left(\\left(\\frac{a}{b}\\right)c\\right)")).toBe("\\left(\\left(\\frac{a}{b}\\right)c\\right)");
    // Un par que no cierra con su pareja no se toca
    expect(fromField("\\left(x\\right.")).toBe("\\left(x\\right.");
    expect(fromField("\\left|x\\right)")).toBe("\\left|x\\right)");
  });

  it("separa las comas de una lista y respeta la coma decimal", () => {
    expect(fromField("3{,}75+1{,}25")).toBe("3{,}75+1{,}25");
    expect(fromField("1.250{,}5")).toBe("1.250{,}5");
    expect(fromField("1{,}2{,}3{,}\\ldots")).toBe("1,2,3,\\ldots");
    expect(fromField("\\left(1{,}5\\right)")).toBe("(1{,}5)");
    expect(fromField("0{,}\\overline{3}")).toBe("0{,}\\overline{3}");
  });

  it("limpia lo que es propio del campo", () => {
    expect(fromField("\\frac{1}{\\placeholder{}}")).toBe("\\frac{1}{{}}");
    expect(fromField("\\operatorname{\\mathrm{sen}}\\left(x\\right)")).toBe("\\operatorname{sen}(x)");
    expect(fromField("45\\degree")).toBe("45^{\\circ}");
    expect(fromField("  x + 1  ")).toBe("x + 1");
    expect(fromField("5\\ ")).toBe("5\\ ");
  });

  it("no toca lo que va dentro de un texto", () => {
    expect(fromField("\\text{90° (recto)}")).toBe("\\text{90° (recto)}");
    expect(fromField("\\text{si \\left( }x")).toBe("\\text{si \\left( }x");
  });

  it("aplicarla dos veces da lo mismo que una", () => {
    for (const [original, readBack] of [...REAL_FORMULAS, ...VARIED_FORMULAS]) {
      expect(fromField(fromField(readBack))).toBe(fromField(readBack));
      expect(fromField(fromField(original))).toBe(fromField(original));
    }
    for (const [, readBack] of TYPED) expect(fromField(fromField(readBack))).toBe(fromField(readBack));
  });
});

describe("lo que se escribe con el teclado", () => {
  it("convierte la escritura llana en LaTeX que la hoja dibuja", () => {
    expect(stored("3/4")).toBe("\\frac{3}{4}");
    expect(stored("x^2")).toBe("x^2");
    expect(stored("sqrt2")).toBe("\\sqrt{2}");
    expect(stored("raiz2")).toBe("\\sqrt{2}");
    expect(stored("a<=b")).toBe("a\\le b");
    expect(stored("a>=b")).toBe("a\\ge b");
    expect(stored("a!=b")).toBe("a\\ne b");
    expect(stored("pi")).toBe("\\pi");
    expect(stored("2*3")).toBe("2\\cdot3");
    expect(stored("x^2+2x+1")).toBe("x^2+2x+1");
    expect(stored("1/2→+1/3")).toBe("\\frac{1}{2}+\\frac{1}{3}");
    expect(stored("(1/2→)^2")).toBe("\\left(\\frac{1}{2}\\right)^2");
    expect(stored("(x+1)(x-2)")).toBe("(x+1)(x-2)");
    expect(stored("sen(x)")).toBe("\\operatorname{sen}(x)");
    expect(stored("|x|")).toBe("|x|");
    expect(stored("{1,2,3}")).toBe("\\{1,2,3\\}");
    expect(stored("45°")).toBe("45^{\\circ}");
    expect(stored("5%")).toBe("5\\%");
  });

  it("usa coma decimal", () => {
    expect(stored("1,5")).toBe("1{,}5");
    expect(stored("3,75+1,25")).toBe("3{,}75+1{,}25");
    expect(stored("1.250,5")).toBe("1.250{,}5");
  });

  it("no convierte trozos de palabras en símbolos", () => {
    for (const word of ["numero", "suma", "interes", "del"]) expect(stored(word)).toBe(word);
  });

  it("todo lo tecleado queda como LaTeX válido para KaTeX", () => {
    for (const [keys, readBack] of TYPED) {
      const latex = fromField(readBack);
      if (latex === "") continue;
      expect(checkLatex(latex), `${keys} → ${latex}`).toBeNull();
    }
  });

  it("avisa de las casillas vacías y las guarda en blanco", () => {
    const readBack = typed.get("1/") ?? "";
    expect(hasEmptySlot(readBack)).toBe(true);
    expect(checkLatex(fromField(readBack))).toBeNull();
    expect(hasEmptySlot(typed.get("3/4") ?? "")).toBe(false);
  });

  it("borrar todo deja la fórmula vacía", () => {
    expect(stored("3/4⌫⌫⌫")).toBe("");
  });
});

describe("mismo dibujo", () => {
  it("ignora espacios y llaves que no cambian nada", () => {
    expect(sameDrawing("y = x^{2} - 4x + 3", "y=x^2-4x+3")).toBe(true);
    expect(sameDrawing("\\frac{1}{2}", "\\frac12")).toBe(true);
    expect(sameDrawing("90^\\circ", "90^{\\circ}")).toBe(true);
    expect(sameDrawing("a{b}c", "abc")).toBe(true);
  });

  it("distingue lo que sí cambia el dibujo", () => {
    expect(sameDrawing("x^2", "x^3")).toBe(false);
    expect(sameDrawing("\\frac{1}{2}", "\\dfrac{1}{2}")).toBe(false);
    expect(sameDrawing("a+b", "a{+}b")).toBe(false);
    expect(sameDrawing("(x)", "\\left(x\\right)")).toBe(false);
    expect(sameDrawing("\\text{a b}", "\\text{ab}")).toBe(false);
    expect(sameDrawing("3{,}5", "3,5")).toBe(false);
  });

  it("una fórmula que no compila no se parece a ninguna", () => {
    expect(drawingSignature("\\frac{1}{2")).toBeNull();
    expect(sameDrawing("\\frac{1}{2", "\\frac{1}{2")).toBe(false);
  });
});

describe("ida y vuelta por el campo", () => {
  it("las fórmulas grabadas cubren los recursos de muestra", () => {
    const recorded = new Set(REAL_FORMULAS.map(([original]) => original));
    let seen = 0;
    for (const id of SAMPLE_IDS) {
      for (const section of buildSampleDoc(id).sections) {
        for (const block of section.blocks) {
          const { id: _id, ...content } = block;
          const formulas = blockTexts(content as BlockInput).flatMap(extractMath);
          if (block.type === "math") formulas.push(block.latex);
          for (const formula of formulas) expect(recorded.has(formula.trim()), formula).toBe(true);
          seen += formulas.length;
        }
      }
    }
    expect(seen).toBeGreaterThan(80);
    expect(REAL_FORMULAS.length).toBeGreaterThan(250);
  });

  it("toda fórmula real se puede editar en el campo", () => {
    const failed = REAL_FORMULAS.filter(([original, readBack, errors]) => !fitsField(original, readBack, errors)).map(([original]) => original);
    expect(failed).toEqual([]);
  });

  it("lo que el campo devuelve de una fórmula real compila y se dibuja igual", () => {
    for (const [original, readBack] of REAL_FORMULAS) {
      const latex = fromField(readBack);
      expect(checkLatex(latex), original).toBeNull();
      expect(sameDrawing(original, latex), `${original} → ${latex}`).toBe(true);
    }
  });

  it("también las otras formas de LaTeX que la IA puede escribir", () => {
    const failed = VARIED_FORMULAS.filter(([original, readBack, errors]) => !fitsField(original, readBack, errors)).map(([original]) => original);
    expect(failed).toEqual([]);
    for (const [original, readBack] of VARIED_FORMULAS) expect(checkLatex(fromField(readBack)), original).toBeNull();
  });

  it("lo que el campo no representa se abre en modo avanzado", () => {
    const accepted = UNFIT_FORMULAS.filter(([original, readBack, errors]) => fitsField(original, readBack, errors)).map(([original]) => original);
    expect(accepted).toEqual([]);
  });

  it("una fórmula vacía siempre cabe", () => {
    expect(fitsField("", "")).toBe(true);
    expect(fitsField("  ", "")).toBe(true);
  });
});

describe("lo que se guarda al salir del campo", () => {
  it("una fórmula que no se tocó queda exactamente como estaba", () => {
    for (const [original, readBack] of [...REAL_FORMULAS, ...VARIED_FORMULAS]) expect(fieldResult(original, readBack, readBack)).toBe(original);
  });

  it("una fórmula editada se guarda con el estilo de la hoja", () => {
    expect(fieldResult("y = x^{2}", "y=x^2", "y=x^2+\\frac12")).toBe("y=x^2+\\frac{1}{2}");
  });

  it("deshacer el cambio dentro del campo devuelve la original", () => {
    const [original, readBack] = REAL_FORMULAS[0];
    expect(fieldResult(original, readBack, readBack + "+1")).not.toBe(original);
    expect(fieldResult(original, readBack, readBack)).toBe(original);
  });
});

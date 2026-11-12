import { describe, expect, it } from "vitest";
import { blockTexts } from "@shared/creator";
import { buildSampleDoc } from "@shared/creatorSample";
import { parseInline, parseMd, serializeMd } from "./editing/mdModel";

const roundTrip = (md: string) => serializeMd(parseMd(md));

describe("modelo de texto del editor", () => {
  it("separa texto, negrita, cursiva y fórmulas", () => {
    expect(parseInline("La **pendiente** de $y = 2x$ es *positiva*.")).toEqual([
      { t: "text", text: "La " },
      { t: "text", text: "pendiente", bold: true },
      { t: "text", text: " de " },
      { t: "formula", latex: "y = 2x" },
      { t: "text", text: " es " },
      { t: "text", text: "positiva", italic: true },
      { t: "text", text: "." },
    ]);
  });

  it("muestra los pesos como texto y los vuelve a escapar al guardar", () => {
    const inlines = parseInline("Cobra \\$3.000 por ingresar y \\$1.500 por hora.");
    expect(inlines).toEqual([{ t: "text", text: "Cobra $3.000 por ingresar y $1.500 por hora." }]);
    expect(roundTrip("Cobra \\$3.000 por ingresar y \\$1.500 por hora.")).toBe("Cobra \\$3.000 por ingresar y \\$1.500 por hora.");
  });

  it("reconoce fórmulas en bloque", () => {
    expect(parseInline("Usa $$x = -\\frac{b}{2a}$$ ahora")).toEqual([
      { t: "text", text: "Usa " },
      { t: "formula", latex: "x = -\\frac{b}{2a}", display: true },
      { t: "text", text: " ahora" },
    ]);
  });

  it("no confunde un guion bajo dentro de una palabra con cursiva", () => {
    expect(parseInline("el archivo mi_guia_final")).toEqual([{ t: "text", text: "el archivo mi_guia_final" }]);
  });

  it("lee listas con viñetas y numeradas", () => {
    expect(parseMd("Intro\n\n- **Uno:** a\n- Dos\n\n1. Primero\n2. Segundo")).toMatchObject([
      { t: "p" },
      { t: "ul", items: [expect.any(Array), expect.any(Array)] },
      { t: "ol", items: [expect.any(Array), expect.any(Array)] },
    ]);
  });

  it("conserva los espacios fuera de la negrita", () => {
    expect(serializeMd([{ t: "p", inlines: [{ t: "text", text: "hola ", bold: true }, { t: "text", text: "mundo" }] }])).toBe("**hola** mundo");
  });

  it("devuelve intacto todo el texto del recurso de ejemplo", () => {
    const doc = buildSampleDoc();
    const texts = doc.sections.flatMap(section => section.blocks.flatMap(blockTexts));
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) expect(roundTrip(text), text).toBe(text);
  });

  it("es estable: guardar dos veces no cambia nada", () => {
    for (const md of ["Texto con * suelto y $ suelto", "a_b *c* **d** $e^{2}$", "- uno\n- dos"]) {
      const once = roundTrip(md);
      expect(roundTrip(once)).toBe(once);
    }
  });
});

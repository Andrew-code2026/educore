import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blockTexts } from "@shared/creator";
import { buildSampleDoc } from "@shared/creatorSample";
import { RichText } from "./blocks/RichText";
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

describe("fórmulas en el texto", () => {
  const html = (md: string, inline = false) => renderToStaticMarkup(createElement(RichText, { md, inline }));
  const css = readFileSync(createRequire(import.meta.url).resolve("katex/dist/katex.min.css"), "utf8");

  it("dibuja exponentes, subíndices y fracciones con clases que la hoja de estilos define", () => {
    const out = html("El área es $x^2 + 7x + 12$, con $x_1 = \\frac{1}{2}$.");
    // Cada cambio de tamaño (el exponente va a 0.7 del texto) debe tener su regla en el CSS que se carga
    const sizings = out.match(/class="[^"]*\breset-size\d+ size\d+[^"]*"/g) ?? [];
    expect(sizings.length).toBeGreaterThanOrEqual(3);
    for (const attr of sizings) {
      const classes = attr.slice(7, -1).split(" ");
      const sizing = classes.find(name => name.endsWith("sizing"));
      const reset = classes.find(name => name.startsWith("reset-size"));
      const size = classes.find(name => /^size\d+$/.test(name));
      expect(css, attr).toContain(`.katex .${sizing}.${reset}.${size}{`);
    }
  });

  it("reduce el exponente a 0.7 del tamaño de la base", () => {
    expect(html("$x^2$")).toMatch(/reset-size6 size3/);
    expect(css).toMatch(/\.katex \.katex-sizing\.reset-size6\.size3\{font-size:\.7em\}/);
  });

  it("separa la fórmula en bloque y deja en línea la de un rótulo", () => {
    expect(html("La fórmula $$A = b \\cdot h$$ da el área.")).toContain('class="katex-display"');
    const label = html("$r = 3$ cm", true);
    expect(label).toContain('class="katex"');
    expect(label).not.toContain("<p>");
    expect(label).not.toContain("katex-display");
  });

  it("muestra el texto de una fórmula que no compila en vez de romper la hoja", () => {
    expect(html("Mal: $\\frac{1}{$ fin")).toContain("<code");
  });

  /** El LaTeX de cada fórmula dibujada, en orden: KaTeX lo deja en su anotación. */
  const drawn = (out: string) => Array.from(out.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g), match => match[1]);

  it("dibuja pegadas y en el mismo renglón dos fórmulas en línea seguidas", () => {
    // Así las guarda el editor y así puede escribirlas el modelo; los recursos ya guardados no cambian
    const out = html("En $\\sqrt{2}$$x$ y $a$$b$$c$ fin.");
    expect(drawn(out)).toEqual(["\\sqrt{2}", "x", "a", "b", "c"]);
    expect(out).not.toContain("katex-display");
    expect(out).not.toContain("<code");
    expect(out).not.toContain("$");
    expect(out.match(/<p>/g)).toHaveLength(1);
    // Entre las dos solo queda un carácter invisible que no deja partir el renglón
    expect(out).toMatch(/<\/span>\u2060<span>/);
    expect(drawn(html("$a$$b$ cm", true))).toEqual(["a", "b"]);
  });

  it("aparta solo la fórmula destacada que va junto a una en línea", () => {
    const out = html("$\\frac{1}{2}$$$x = 1$$$y$");
    expect(drawn(out)).toEqual(["\\frac{1}{2}", "x = 1", "y"]);
    expect(out.match(/katex-display/g)).toHaveLength(1);
    expect(html("Sea $$A = b \\cdot h$$$$P = 2b + 2h$$ fin.").match(/katex-display/g)).toHaveLength(2);
  });
});

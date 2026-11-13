import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INNER_BLOCK_TYPES, type Block, type BlockType } from "@shared/creator";
import { minBlockWidth } from "@shared/creatorContainers";
import { BlockView } from "./blocks/BlockView";
import { BLOCK_TEMPLATES } from "./editing/BlockEditor";

/**
 * Qué cabe en una columna (shared/creatorContainers.ts) parte del ancho de diseño de cada figura, que
 * fija su componente. Esta prueba los ata: si una figura cambia de ancho, la tabla tiene que cambiar con
 * ella, o una gráfica más ancha entraría en una columna donde ya no se lee.
 */
const designWidth = (type: BlockType): number | null => {
  const html = renderToStaticMarkup(<BlockView block={{ ...BLOCK_TEMPLATES[type], id: "x" } as Block} />);
  const match = /--(?:fig|plane)-w:\s*([\d.]+)px/.exec(html);
  return match ? Number(match[1]) : null;
};

describe("anchos de diseño de las figuras", () => {
  const figures = (Object.keys(BLOCK_TEMPLATES) as BlockType[]).filter(type => INNER_BLOCK_TYPES.has(type) && designWidth(type) !== null);

  it("encuentra el ancho de diseño de las figuras", () => {
    expect(figures.length).toBeGreaterThan(15);
  });

  it.each(figures)("%s exige unas tres cuartas partes de su ancho de diseño", type => {
    const design = designWidth(type)!;
    const required = minBlockWidth(BLOCK_TEMPLATES[type]);
    // Nunca menos de lo legible (con un margen por las figuras que miden según sus datos) ni más que la figura entera
    expect(required, `${type}: diseño ${design} px, exige ${required} px`).toBeGreaterThanOrEqual(design * 0.7);
    expect(required, `${type}: diseño ${design} px, exige ${required} px`).toBeLessThanOrEqual(design);
  });
});

describe("tamaño de presentación", () => {
  const html = (block: Block) => renderToStaticMarkup(<BlockView block={block} />);

  it.each(["bar_chart", "graph", "clock"] as const)("%s lleva su ancho de diseño también sin unidades, para que los rótulos sigan a la figura", type => {
    const markup = html({ ...BLOCK_TEMPLATES[type], id: "x" } as Block);
    const withUnit = /--(?:fig|plane)-w:\s*([\d.]+)px/.exec(markup);
    const plain = /--(?:fig|plane)-wn:\s*([\d.]+)[;"]/.exec(markup);
    expect(plain?.[1]).toBe(withUnit?.[1]);
  });

  it("sin tamaño la figura se dibuja como siempre; con tamaño lleva su escala", () => {
    expect(html({ ...BLOCK_TEMPLATES.bar_chart, id: "x" } as Block)).not.toContain("data-size");
    const small = html({ ...BLOCK_TEMPLATES.bar_chart, size: "small", id: "x" } as Block);
    expect(small).toContain('data-size="small"');
    expect(small).toContain("--fig-scale:0.75");
    // El completo no lleva escala: llena el ancho disponible
    const full = html({ ...BLOCK_TEMPLATES.bar_chart, size: "full", id: "x" } as Block);
    expect(full).toContain('data-size="full"');
    expect(full).not.toContain("--fig-scale");
  });
});

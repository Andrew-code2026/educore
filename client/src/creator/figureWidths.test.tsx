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

import type { GraphSpec } from "./creator";
import { describeArea } from "./creatorCalculus";
import { describeConic } from "./creatorConics";

/**
 * Lo que el sistema calculó de un plano cartesiano, en una línea: los elementos de sus
 * cónicas y el área de sus regiones. La herramienta se lo devuelve a la IA para que la clave de respuestas use los
 * mismos valores que la figura. null cuando el plano no tiene nada calculado.
 */
export function describeGraph(spec: GraphSpec): string | null {
  const facts = [...(spec.conics ?? []).map(describeConic), ...(spec.areas ?? []).map(area => describeArea(spec, area))].filter(Boolean);
  return facts.length > 0 ? `Gráfica: ${facts.join(" ")}` : null;
}

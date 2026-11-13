import type { GraphSpec } from "./creator";
import { describeConic } from "./creatorConics";

/**
 * Lo que el sistema calculó de un plano cartesiano, en una línea: los elementos de sus
 * cónicas. La herramienta se lo devuelve a la IA para que la clave de respuestas use los
 * mismos valores que la figura. null cuando el plano no tiene nada calculado.
 */
export function describeGraph(spec: GraphSpec): string | null {
  const facts = (spec.conics ?? []).map(describeConic);
  return facts.length > 0 ? `Gráfica: ${facts.join(" ")}` : null;
}

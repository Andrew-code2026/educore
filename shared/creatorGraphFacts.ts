import type { GraphSpec } from "./creator";
import { describeArea, describeSecant, describeTangent } from "./creatorCalculus";
import { describeConic } from "./creatorConics";

/**
 * Lo que el sistema calculó de un plano cartesiano, en una línea: los elementos de sus
 * cónicas, el área de sus regiones y la pendiente de sus tangentes y secantes. La herramienta
 * se lo devuelve a la IA para que la clave de respuestas use los mismos valores que la figura.
 * null cuando el plano no tiene nada calculado.
 */
export function describeGraph(spec: GraphSpec): string | null {
  const facts = [
    ...(spec.conics ?? []).map(describeConic),
    ...(spec.areas ?? []).map(area => describeArea(spec, area)),
    ...(spec.tangents ?? []).map(tangent => describeTangent(spec, tangent)),
    ...(spec.secants ?? []).map(secant => describeSecant(spec, secant)),
  ].filter(Boolean);
  return facts.length > 0 ? `Gráfica: ${facts.join(" ")}` : null;
}

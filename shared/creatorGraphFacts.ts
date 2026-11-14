import type { GraphSpec } from "./creator";
import { describeArea, describeSecant, describeTangent } from "./creatorCalculus";
import { describeConic } from "./creatorConics";
import { describeNotable } from "./creatorNotable";
import { usesPi } from "./creatorPlaneAxes";
import { describeFigure } from "./creatorPlaneGeometry";
import { describeInequalities } from "./creatorRegions";

/**
 * Lo que el sistema calculó de un plano cartesiano, en una línea: los elementos de sus
 * cónicas, el área de sus regiones, la pendiente de sus tangentes y secantes, las coordenadas
 * de sus puntos notables, las medidas de sus figuras con sus imágenes y los vértices de la
 * región de sus inecuaciones. La herramienta se lo
 * devuelve a la IA para que la clave de respuestas use los mismos valores que la figura. null
 * cuando el plano no tiene nada calculado.
 */
export function describeGraph(spec: GraphSpec): string | null {
  const facts = [
    ...(spec.conics ?? []).map(describeConic),
    ...(spec.areas ?? []).map(area => describeArea(spec, area)),
    ...(spec.tangents ?? []).map(tangent => describeTangent(spec, tangent)),
    ...(spec.secants ?? []).map(secant => describeSecant(spec, secant)),
    ...(spec.notable ?? []).map(item => describeNotable(spec, item)),
    ...(spec.figures ?? []).map(figure => describeFigure(figure, usesPi(spec))),
    describeInequalities(spec),
  ].filter(Boolean);
  return facts.length > 0 ? `Gráfica: ${facts.join(" ")}` : null;
}

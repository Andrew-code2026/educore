import { ChevronRight } from "lucide-react";
import type { SummaryTile } from "./home";

interface ChildSummaryProps {
  childName: string;
  tiles: SummaryTile[];
  /** Qué abre cada dato; un dato sin acción no es un botón. */
  actions: Partial<Record<SummaryTile["id"], () => void>>;
}

/** "¿Cómo va?": tres datos en una franja, cada uno lleva a su detalle. */
export function ChildSummary({ childName, tiles, actions }: ChildSummaryProps) {
  return (
    <section aria-label={`Resumen de ${childName}`} className="edc-card gdn-summary">
      {tiles.map(tile => {
        const body = (
          <>
            <span className="gdn-summary__label">{tile.label}</span>
            {/* El número va siempre neutro (un 4.2 no es una alerta); la nota dice qué revisar */}
            <span className="gdn-summary__value" aria-busy={tile.value === null}>
              {tile.value ?? "—"}
              {tile.unit && <span className="gdn-summary__unit">{tile.unit}</span>}
            </span>
            <span className={`gdn-summary__note${tile.alert ? " gdn-summary__note--alert" : ""}`}>{tile.note}</span>
          </>
        );
        const action = actions[tile.id];
        return action ? (
          <button key={tile.id} type="button" className="gdn-summary__tile gdn-summary__tile--link" onClick={action}>
            {body}
            <ChevronRight className="gdn-summary__chevron" aria-hidden="true" strokeWidth={1.9} />
          </button>
        ) : (
          <div key={tile.id} className="gdn-summary__tile">
            {body}
          </div>
        );
      })}
    </section>
  );
}

import { ChevronRight } from "lucide-react";
import type { HomeSummaryTile } from "./types";

interface HomeSummaryProps {
  /** Nombre accesible de la franja ("Tu resumen", "Resumen de Sofía"). */
  label: string;
  tiles: HomeSummaryTile[];
  /** Qué abre cada dato; un dato sin acción no es un botón. */
  actions: Partial<Record<HomeSummaryTile["id"], () => void>>;
}

/** "¿Cómo voy?" / "¿Cómo va?": tres datos en una franja, cada uno lleva a su detalle. */
export function HomeSummary({ label, tiles, actions }: HomeSummaryProps) {
  return (
    <section aria-label={label} className="edc-card edc-summary">
      {tiles.map(tile => {
        const body = (
          <>
            <span className="edc-summary__label">{tile.label}</span>
            {/* El número va siempre neutro (un 4.2 no es una alerta); la nota dice qué revisar */}
            <span className="edc-summary__value" aria-busy={tile.value === null}>
              {tile.value ?? "—"}
              {tile.unit && <span className="edc-summary__unit">{tile.unit}</span>}
            </span>
            <span className={`edc-summary__note${tile.alert ? " edc-summary__note--alert" : ""}`}>{tile.note}</span>
          </>
        );
        const action = actions[tile.id];
        return action ? (
          <button key={tile.id} type="button" className="edc-summary__tile edc-summary__tile--link" onClick={action}>
            {body}
            <ChevronRight className="edc-summary__chevron" aria-hidden="true" strokeWidth={1.9} />
          </button>
        ) : (
          <div key={tile.id} className="edc-summary__tile">
            {body}
          </div>
        );
      })}
    </section>
  );
}

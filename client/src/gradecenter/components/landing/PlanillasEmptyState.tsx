import { BarChart3, Search } from "lucide-react";

export function NoResultsState({ onReset }: { onReset: () => void }) {
  return (
    <div className="gcl-surface gcl-empty">
      <span className="gcl-empty__icon" aria-hidden="true">
        <Search strokeWidth={1.9} />
      </span>
      <div className="gcl-empty__title">No hay planillas que coincidan</div>
      <div className="gcl-empty__text">Prueba con otro salón o materia, o quita el filtro de estado.</div>
      <button type="button" className="gcl-action" onClick={onReset}>
        Limpiar filtros
      </button>
    </div>
  );
}

export function NoAssignmentsState({ period }: { period: string }) {
  return (
    <div className="gcl-surface gcl-empty gcl-empty--roomy">
      <span className="gcl-empty__icon" aria-hidden="true">
        <BarChart3 strokeWidth={1.9} />
      </span>
      <div className="gcl-empty__title">Aún no tienes planillas asignadas</div>
      <div className="gcl-empty__text">
        Cuando coordinación académica te asigne salones y materias para el {period}, aparecerán aquí.
      </div>
    </div>
  );
}

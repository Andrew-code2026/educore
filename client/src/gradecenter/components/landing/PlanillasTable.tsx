import { AlertTriangle, ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  LOW_AVERAGE_THRESHOLD,
  SORT_COLUMNS,
  planillaCopy,
  type Planilla,
  type PlanillaSort,
  type PlanillaSortKey,
} from "./planillas";
import { PlanillaProgress, PlanillaStatus } from "./PlanillaStatus";

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

interface PlanillasTableProps {
  planillas: Planilla[];
  sort: PlanillaSort;
  onSort: (key: PlanillaSortKey) => void;
  onOpen: (planilla: Planilla) => void;
}

export function PlanillasTable({ planillas, sort, onSort, onOpen }: PlanillasTableProps) {
  return (
    <div className="gcl-surface gcl-table-wrap">
      <div role="table" aria-label="Planillas" aria-rowcount={planillas.length + 1} className="gcl-table">
        <div role="row" className="gcl-table__row gcl-table__row--head">
          {SORT_COLUMNS.map((column) => {
            const active = column.key === sort.key;
            return (
              <div
                key={column.key}
                role="columnheader"
                aria-sort={active ? ARIA_SORT[sort.dir] : "none"}
                className="gcl-table__head-cell"
                data-align={column.align}
              >
                <button
                  type="button"
                  className="gcl-sort-btn"
                  data-active={active}
                  data-dir={active ? sort.dir : undefined}
                  aria-label={`Ordenar por ${column.label.toLowerCase()}`}
                  onClick={() => onSort(column.key)}
                >
                  {column.label}
                  <ChevronDown aria-hidden="true" strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
          <div role="columnheader" className="sr-only">
            Acciones
          </div>
        </div>

        {planillas.map((planilla) => (
          <PlanillaRow key={planilla.id} planilla={planilla} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function PlanillaRow({ planilla, onOpen }: { planilla: Planilla; onOpen: (planilla: Planilla) => void }) {
  const copy = planillaCopy(planilla);
  const isNew = planilla.estado === "nueva";

  return (
    <div role="row" className="gcl-table__row gcl-table__row--body">
      <div role="cell" className="gcl-table__cell-name">
        <span className="gcl-group-badge gcl-group-badge--sm" aria-hidden="true">{planilla.grupo}</span>
        <div className="gcl-table__name">
          <button type="button" className="gcl-table__link" aria-label={copy.actionLabel} onClick={() => onOpen(planilla)}>
            {copy.name}
          </button>
          <span className="gcl-table__sub">{copy.meta}</span>
        </div>
      </div>

      <div role="cell" className="gcl-table__progress">
        <div className="gcl-table__progress-head">
          <span className="gcl-num">{planilla.progressPct}%</span>
          <PlanillaStatus estado={planilla.estado} variant="inline" />
        </div>
        <PlanillaProgress pct={planilla.progressPct} estado={planilla.estado} label={copy.progressLabel} variant="flat" />
      </div>

      <div role="cell" className="gcl-table__pending gcl-num" data-muted={!isNew && planilla.pending === 0}>
        {copy.pending}
      </div>

      <div role="cell" className="gcl-table__average gcl-num" data-low={planilla.isLow}>
        {planilla.isLow && (
          <AlertTriangle role="img" aria-label={`Por debajo de ${LOW_AVERAGE_THRESHOLD.toFixed(1)}`} strokeWidth={2} />
        )}
        {copy.average}
      </div>

      <div role="cell" className="gcl-table__actions">
        {isNew ? (
          <button type="button" className="gcl-create-btn" aria-label={copy.actionLabel} onClick={() => onOpen(planilla)}>
            <Plus aria-hidden="true" strokeWidth={2.2} />
            Crear evaluación
          </button>
        ) : (
          <span className="gcl-chevron" aria-hidden="true">
            <ChevronRight strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  );
}

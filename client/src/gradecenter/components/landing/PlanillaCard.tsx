import { ArrowRight } from "lucide-react";
import { formatLastActivity, planillaCopy, type Planilla } from "./planillas";
import { PlanillaProgress, PlanillaStatus } from "./PlanillaStatus";

export function PlanillaCard({ planilla, onOpen }: { planilla: Planilla; onOpen: (planilla: Planilla) => void }) {
  const copy = planillaCopy(planilla);

  return (
    <article className="gcl-surface gcl-card">
      <div className="gcl-card__head">
        <span className="gcl-group-badge" aria-hidden="true">{planilla.grupo}</span>
        <h2 className="gcl-card__title">{planilla.materia}</h2>
        <PlanillaStatus estado={planilla.estado} variant="pill" />
        <div className="gcl-card__sub">{copy.meta}</div>
      </div>

      <div className="gcl-card__progress">
        <div className="gcl-card__progress-head">
          <span className="gcl-eyebrow">Calificado</span>
          <span className="gcl-card__pct gcl-num">{planilla.progressPct}%</span>
        </div>
        <PlanillaProgress pct={planilla.progressPct} estado={planilla.estado} label={copy.progressLabel} variant="striped" />
      </div>

      <div className="gcl-card__tiles">
        <div className="gcl-tile">
          <span className="gcl-tile__label">Pendientes</span>
          <span className="gcl-tile__value gcl-num">{copy.pending}</span>
          <span className="gcl-tile__note">{copy.pendingNote}</span>
        </div>
        <div className="gcl-tile" data-low={planilla.isLow}>
          <span className="gcl-tile__label">Promedio</span>
          <span className="gcl-tile__value gcl-num">{copy.average}</span>
          <span className="gcl-tile__note">{copy.averageNote}</span>
        </div>
      </div>

      <div className="gcl-card__foot">
        <span className="gcl-card__edited">{formatLastActivity(planilla.lastActivityAt)}</span>
        <button type="button" className="gcl-action" aria-label={copy.actionLabel} onClick={() => onOpen(planilla)}>
          {copy.action}
          <ArrowRight aria-hidden="true" strokeWidth={2} />
        </button>
      </div>
    </article>
  );
}

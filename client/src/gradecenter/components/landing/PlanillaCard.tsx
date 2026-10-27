import { ArrowRight } from "lucide-react";
import { formatLastActivity, planillaCopy, type Planilla } from "./planillas";
import { PlanillaProgress, PlanillaStatus } from "./PlanillaStatus";

export function PlanillaCard({ planilla, onOpen }: { planilla: Planilla; onOpen: (planilla: Planilla) => void }) {
  const copy = planillaCopy(planilla);

  return (
    <article
      className="gcl-surface gcl-card cursor-pointer"
      onClick={() => onOpen(planilla)}
    >
      <div className="gcl-card__head">
        <span className="gcl-group-badge" aria-hidden="true">{planilla.grupo}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="gcl-card__title truncate">{planilla.materia}</h2>
            <PlanillaStatus estado={planilla.estado} variant="pill" />
          </div>
          <div className="gcl-card__sub">{copy.meta}</div>
        </div>
      </div>

      <div className="gcl-card__progress">
        <div className="gcl-card__progress-head">
          <span className="gcl-eyebrow">Progreso de calificación</span>
          <span className="gcl-card__pct gcl-num">{planilla.progressPct}%</span>
        </div>
        <PlanillaProgress pct={planilla.progressPct} estado={planilla.estado} label={copy.progressLabel} variant="flat" />
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
        <button
          type="button"
          className="gcl-action"
          aria-label={copy.actionLabel}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(planilla);
          }}
        >
          {copy.action}
          <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

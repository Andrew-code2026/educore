import { memo } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { REPORT_CARD_STATUS_LABEL, reportCardProgress, type ReportCardModel } from "./landing";

interface ReportCardListProps {
  reportCards: ReportCardModel[];
  canGenerate: boolean;
  /** Clave del curso cuya generación está en curso. */
  generatingKey: string | null;
  onGenerate: (card: ReportCardModel) => void;
}

export const ReportCardList = memo(function ReportCardList({
  reportCards,
  canGenerate,
  generatingKey,
  onGenerate,
}: ReportCardListProps) {
  return (
    <ul aria-label="Boletines por curso" className="rpt-surface rpt-list">
      {reportCards.map((card) => (
        <ReportCardRow
          key={card.key}
          card={card}
          canGenerate={canGenerate}
          isGenerating={generatingKey === card.key}
          isLocked={generatingKey !== null}
          onGenerate={onGenerate}
        />
      ))}
    </ul>
  );
});

interface ReportCardRowProps {
  card: ReportCardModel;
  canGenerate: boolean;
  isGenerating: boolean;
  /** Mientras se genera un curso no se lanza otro en paralelo. */
  isLocked: boolean;
  onGenerate: (card: ReportCardModel) => void;
}

function ReportCardRow({ card, canGenerate, isGenerating, isLocked, onGenerate }: ReportCardRowProps) {
  const pct = card.students > 0 ? Math.round((card.generated / card.students) * 100) : 0;
  const actionLabel = card.status === "complete" ? "Regenerar" : "Generar";

  return (
    <li className="rpt-card">
      <span aria-hidden="true" className={`rpt-card__icon rpt-card__icon--${card.status}`}>
        <FileText strokeWidth={1.9} />
      </span>

      <div className="rpt-card__body">
        <div className="rpt-course__title">
          <span className="rpt-group rpt-num">{card.group}</span>
          <span className="rpt-course__name">{card.period}</span>
          <span className={`rpt-status rpt-status--${card.status}`}>{REPORT_CARD_STATUS_LABEL[card.status]}</span>
        </div>
        <div className="rpt-course__meta">
          <span className="rpt-num">{reportCardProgress(card)}</span>
          <span>{card.lastGenerated ? `Última generación: ${card.lastGenerated}` : "Sin generar en este periodo"}</span>
        </div>
      </div>

      <div className="rpt-card__progress">
        <div
          role="progressbar"
          aria-label={`Boletines generados de ${card.group}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={reportCardProgress(card)}
          className="rpt-meter rpt-meter--thin"
        >
          <div className={`rpt-meter__bar rpt-meter__bar--${card.status}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {canGenerate && (
        <div className="rpt-row-action">
          <button
            type="button"
            className={card.status === "complete" ? "rpt-btn rpt-btn--outline" : "rpt-btn rpt-btn--primary"}
            aria-label={`${actionLabel} boletines de ${card.group}`}
            aria-busy={isGenerating}
            disabled={isLocked}
            onClick={() => onGenerate(card)}
          >
            {isGenerating && <LoaderCircle aria-hidden="true" className="rpt-spin" strokeWidth={1.9} />}
            {isGenerating ? "Generando…" : actionLabel}
          </button>
        </div>
      )}
    </li>
  );
}

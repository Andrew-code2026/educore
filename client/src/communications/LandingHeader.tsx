import { Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { plural } from "@/analytics/landing";
import type { CommunicationsSummary } from "./landing";

interface LandingHeaderProps {
  academicYear: string;
  period: string | null;
  lede: string;
  summary: CommunicationsSummary;
  /** Quien redacta ve sus borradores; quien solo lee, lo nuevo de la semana. */
  canCompose: boolean;
  onCompose: () => void;
}

export function LandingHeader({ academicYear, period, lede, summary, canCompose, onCompose }: LandingHeaderProps) {
  return (
    <header className="cmn-header">
      <div className="cmn-intro">
        <div className="cmn-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.9} />
          Año {academicYear}
          {period && (
            <>
              <span className="cmn-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="cmn-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="cmn-title">Comunicaciones</h1>
        <p className="cmn-lede">{lede}</p>
        {canCompose && (
          <button type="button" className="cmn-btn cmn-btn--primary cmn-intro__action" onClick={onCompose}>
            <Plus aria-hidden="true" strokeWidth={2.2} />
            Nuevo comunicado
          </button>
        )}
      </div>

      <section aria-label="Resumen de comunicados" className="cmn-surface cmn-summary">
        <SummaryItem
          label="Publicados"
          value={summary.published}
          note={summary.published > 0 ? "Visibles para su público" : "Aún no hay comunicados"}
        />
        {canCompose ? (
          <SummaryItem
            label="Borradores"
            value={summary.drafts}
            tone={summary.drafts > 0 ? "draft" : undefined}
            note={summary.drafts > 0 ? "Pendientes de publicar" : "Sin pendientes"}
          />
        ) : (
          <SummaryItem
            label="Esta semana"
            value={summary.recent}
            note={summary.recent > 0 ? plural(summary.recent, "nuevo", "nuevos") : "Sin novedades"}
          />
        )}
        <div className="cmn-summary__item">
          <span className="cmn-eyebrow">Último envío</span>
          <span
            className={cn(
              "cmn-summary__value cmn-summary__value--text",
              !summary.lastPublishedLabel && "cmn-summary__value--empty",
            )}
          >
            {summary.lastPublishedLabel ?? "—"}
          </span>
          <span className="cmn-summary__note">
            {summary.lastPublishedLabel ? "Comunicado más reciente" : "Nada publicado aún"}
          </span>
        </div>
      </section>
    </header>
  );
}

interface SummaryItemProps {
  label: string;
  value: number;
  note: string;
  tone?: "draft";
}

function SummaryItem({ label, value, note, tone }: SummaryItemProps) {
  return (
    <div className="cmn-summary__item">
      <span className="cmn-eyebrow">{label}</span>
      <span
        className={cn(
          "cmn-summary__value cmn-num",
          value === 0 && "cmn-summary__value--empty",
          tone && `cmn-summary__value--${tone}`,
        )}
      >
        {value}
      </span>
      <span className="cmn-summary__note">{note}</span>
    </div>
  );
}

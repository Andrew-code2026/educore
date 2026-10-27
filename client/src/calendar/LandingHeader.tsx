import { Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDays, plural, UPCOMING_WINDOW_DAYS, type UpcomingSummary } from "./calendar";

interface LandingHeaderProps {
  academicYear: string;
  period: string | null;
  lede: string;
  summary: UpcomingSummary;
  /** Solo se muestra "Nuevo evento" cuando el rol puede crear eventos. */
  onCreate?: () => void;
}

export function LandingHeader({ academicYear, period, lede, summary, onCreate }: LandingHeaderProps) {
  return (
    <header className="cal-header">
      <div className="cal-intro">
        <div className="cal-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.9} />
          Año {academicYear}
          {period && (
            <>
              <span className="cal-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="cal-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="cal-title">Calendario</h1>
        <p className="cal-lede">{lede}</p>
        {onCreate && (
          <button type="button" className="cal-btn cal-btn--primary cal-btn--create" onClick={onCreate}>
            <Plus aria-hidden="true" strokeWidth={2.2} />
            Nuevo evento
          </button>
        )}
      </div>

      <UpcomingSummaryCard summary={summary} />
    </header>
  );
}

function UpcomingSummaryCard({ summary }: { summary: UpcomingSummary }) {
  const { next, nextInDays } = summary;

  return (
    <section aria-label={`Resumen de los próximos ${UPCOMING_WINDOW_DAYS} días`} className="cal-surface cal-summary">
      <div className="cal-summary__item">
        <span className="cal-eyebrow">Próximos {UPCOMING_WINDOW_DAYS} días</span>
        <span className={cn("cal-summary__value cal-num", summary.total === 0 && "cal-summary__value--empty")}>
          {summary.total}
        </span>
        <span className="cal-summary__note">{summary.total === 1 ? "Evento programado" : "Eventos programados"}</span>
      </div>

      <div className="cal-summary__item">
        <span className="cal-eyebrow">Evaluaciones</span>
        <span
          className={cn(
            "cal-summary__value cal-num",
            summary.evaluations > 0 ? "cal-summary__value--evaluation" : "cal-summary__value--empty",
          )}
        >
          {summary.evaluations}
        </span>
        <span className="cal-summary__note">
          {summary.evaluations > 0 ? `De ${plural(summary.total, "evento", "eventos")}` : "Sin evaluaciones cerca"}
        </span>
      </div>

      <div className="cal-summary__item">
        <span className="cal-eyebrow">Próximo evento</span>
        <span className={cn("cal-summary__value", next ? "cal-summary__value--accent" : "cal-summary__value--empty")}>
          {nextInDays != null ? formatRelativeDays(nextInDays) : "—"}
        </span>
        <span className="cal-summary__note cal-summary__note--clamp" title={next?.title}>
          {next ? next.title : "Nada programado"}
        </span>
      </div>
    </section>
  );
}

import { Calendar } from "lucide-react";
import { formatNextSlot, plural, type LandingSummary } from "./landing";

interface LandingHeaderProps {
  todayLabel: string;
  period: string | null;
  summary: LandingSummary;
}

export function LandingHeader({ todayLabel, period, summary }: LandingHeaderProps) {
  return (
    <header className="atl-header">
      <div className="atl-intro">
        <div className="atl-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.9} />
          {todayLabel}
          {period && (
            <>
              <span className="atl-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="atl-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="atl-title">Asistencia</h1>
        <p className="atl-lede">
          Toma lista en tus clases del día y haz seguimiento a las ausencias de tus estudiantes.
        </p>
      </div>

      <AttendanceSummary summary={summary} />
    </header>
  );
}

function AttendanceSummary({ summary }: { summary: LandingSummary }) {
  const { today, toTake, next, alerts, periodRate } = summary;
  const hasToday = today > 0;

  return (
    <section aria-label="Resumen de asistencia" className="atl-surface atl-summary">
      <div className="atl-summary__item">
        <span className="atl-eyebrow">{hasToday ? "Clases hoy" : "Próxima clase"}</span>
        <span className="atl-summary__value atl-num">
          {hasToday ? today : next ? formatNextSlot(next) : "—"}
        </span>
        <span className="atl-summary__note">
          {hasToday
            ? toTake > 0
              ? plural(toTake, "lista por tomar", "listas por tomar")
              : "Listas al día"
            : next
              ? `${next.subject} ${next.group}`
              : "Sin clases programadas"}
        </span>
      </div>

      <div className="atl-summary__item">
        <span className="atl-eyebrow">Con alertas</span>
        <span className="atl-summary__value atl-summary__value--alert atl-num">{alerts}</span>
        <span className="atl-summary__note">Por inasistencias</span>
      </div>

      <div className="atl-summary__item">
        <span className="atl-eyebrow">Asistencia del periodo</span>
        {periodRate != null ? (
          <>
            <span className="atl-summary__value atl-num">{periodRate}%</span>
            <div
              role="progressbar"
              aria-label="Asistencia del periodo"
              aria-valuenow={periodRate}
              aria-valuemin={0}
              aria-valuemax={100}
              className="atl-meter"
            >
              <div className="atl-meter__bar" style={{ width: `${periodRate}%` }} />
            </div>
          </>
        ) : (
          <>
            <span className="atl-summary__value atl-summary__value--empty">—</span>
            <span className="atl-summary__note">Sin registros aún</span>
          </>
        )}
      </div>
    </section>
  );
}

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGrade, PASSING_GRADE, plural, type AnalyticsSummary } from "./landing";

interface LandingHeaderProps {
  academicYear: string;
  period: string | null;
  lede: string;
  /** `null` mientras cargan las planillas. */
  summary: AnalyticsSummary | null;
}

export function LandingHeader({ academicYear, period, lede, summary }: LandingHeaderProps) {
  return (
    <header className="anl-header">
      <div className="anl-intro">
        <div className="anl-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.9} />
          Año {academicYear}
          {period && (
            <>
              <span className="anl-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="anl-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="anl-title">Análisis &amp; Alertas</h1>
        <p className="anl-lede">{lede}</p>
      </div>

      <AnalyticsSummaryCard summary={summary} />
    </header>
  );
}

function AnalyticsSummaryCard({ summary }: { summary: AnalyticsSummary | null }) {
  const isLow = summary?.average != null && summary.average < PASSING_GRADE;

  return (
    <section aria-label="Resumen del periodo" aria-busy={!summary} className="anl-surface anl-summary">
      <div className="anl-summary__item">
        <span className="anl-eyebrow">Promedio general</span>
        <span
          className={cn(
            "anl-summary__value anl-num",
            summary?.average == null && "anl-summary__value--empty",
            isLow && "anl-summary__value--alert",
          )}
        >
          {summary?.average != null ? formatGrade(summary.average) : "—"}
        </span>
        <span className="anl-summary__note">
          {!summary
            ? "Cargando…"
            : summary.planillasWithGrades > 0
              ? `En ${plural(summary.planillasWithGrades, "planilla", "planillas")}`
              : "Sin notas registradas"}
        </span>
      </div>

      <div className="anl-summary__item">
        <span className="anl-eyebrow">Con alertas</span>
        <span
          className={cn(
            "anl-summary__value anl-num",
            summary && summary.flaggedStudents > 0 && "anl-summary__value--alert",
            !summary && "anl-summary__value--empty",
          )}
        >
          {summary ? summary.flaggedStudents : "—"}
        </span>
        <span className="anl-summary__note">
          {summary
            ? summary.flaggedStudents > 0
              ? "Estudiantes por acompañar"
              : "Sin estudiantes en riesgo"
            : "Cargando…"}
        </span>
      </div>

      <div className="anl-summary__item">
        <span className="anl-eyebrow">Notas registradas</span>
        {summary?.progressPct != null ? (
          <>
            <span className="anl-summary__value anl-num">{summary.progressPct}%</span>
            <div
              role="progressbar"
              aria-label="Notas registradas del periodo"
              aria-valuenow={summary.progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${summary.graded} de ${summary.total} notas`}
              className="anl-meter"
            >
              <div className="anl-meter__bar" style={{ width: `${summary.progressPct}%` }} />
            </div>
          </>
        ) : (
          <>
            <span className="anl-summary__value anl-summary__value--empty">—</span>
            <span className="anl-summary__note">{summary ? "Sin evaluaciones aún" : "Cargando…"}</span>
          </>
        )}
      </div>
    </section>
  );
}

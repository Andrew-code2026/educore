import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGrade, PASSING_GRADE, plural } from "@/analytics/landing";
import type { ReportsSummary } from "./landing";

interface LandingHeaderProps {
  academicYear: string;
  period: string | null;
  lede: string;
  /** `null` mientras cargan los datos. */
  summary: ReportsSummary | null;
  /** La carga falló: el resumen deja de anunciar "Cargando…". */
  error: boolean;
}

export function LandingHeader({ academicYear, period, lede, summary, error }: LandingHeaderProps) {
  return (
    <header className="rpt-header">
      <div className="rpt-intro">
        <div className="rpt-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.9} />
          Año {academicYear}
          {period && (
            <>
              <span className="rpt-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="rpt-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="rpt-title">Reportes y analítica</h1>
        <p className="rpt-lede">{lede}</p>
      </div>

      <ReportsSummaryCard summary={summary} error={error} />
    </header>
  );
}

function ReportsSummaryCard({ summary, error }: { summary: ReportsSummary | null; error: boolean }) {
  const pending = error ? "No disponible" : "Cargando…";
  const isLow = summary?.average != null && summary.average < PASSING_GRADE;
  const reportPct =
    summary && summary.reportCardsTotal > 0
      ? Math.round((summary.reportCardsGenerated / summary.reportCardsTotal) * 100)
      : null;

  return (
    <section aria-label="Resumen del periodo" aria-busy={!summary && !error} className="rpt-surface rpt-summary">
      <div className="rpt-summary__item">
        <span className="rpt-eyebrow">Promedio general</span>
        <span
          className={cn(
            "rpt-summary__value rpt-num",
            summary?.average == null && "rpt-summary__value--empty",
            isLow && "rpt-summary__value--alert",
          )}
        >
          {summary?.average != null ? formatGrade(summary.average) : "—"}
        </span>
        <span className="rpt-summary__note">
          {!summary
            ? pending
            : summary.coursesWithGrades > 0
              ? `En ${plural(summary.coursesWithGrades, "curso", "cursos")}`
              : "Sin notas registradas"}
        </span>
      </div>

      <div className="rpt-summary__item">
        <span className="rpt-eyebrow">Bajo {formatGrade(PASSING_GRADE)}</span>
        <span
          className={cn(
            "rpt-summary__value rpt-num",
            summary && summary.belowPassing > 0 && "rpt-summary__value--alert",
            !summary && "rpt-summary__value--empty",
          )}
        >
          {summary ? summary.belowPassing : "—"}
        </span>
        <span className="rpt-summary__note">
          {summary
            ? summary.belowPassing === 1
              ? "Estudiante por acompañar"
              : summary.belowPassing > 1
                ? "Estudiantes por acompañar"
                : "Nadie bajo la aprobatoria"
            : pending}
        </span>
      </div>

      <div className="rpt-summary__item">
        <span className="rpt-eyebrow">Boletines</span>
        {summary && reportPct != null ? (
          <>
            <span className="rpt-summary__value rpt-num">{reportPct}%</span>
            <div
              role="progressbar"
              aria-label="Boletines generados del periodo"
              aria-valuenow={reportPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${summary.reportCardsGenerated} de ${summary.reportCardsTotal} boletines`}
              className="rpt-meter"
            >
              <div className="rpt-meter__bar" style={{ width: `${reportPct}%` }} />
            </div>
          </>
        ) : (
          <>
            <span className="rpt-summary__value rpt-summary__value--empty">—</span>
            <span className="rpt-summary__note">{summary ? "Sin estudiantes matriculados" : pending}</span>
          </>
        )}
      </div>
    </section>
  );
}

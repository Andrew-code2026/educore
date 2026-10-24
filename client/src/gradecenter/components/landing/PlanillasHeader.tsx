import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralize } from "../../lib/format";
import { formatClosingDate, formatDaysLeft, type PeriodSummary } from "./planillas";

interface PlanillasHeaderProps {
  academicYear: string;
  period: string;
  summary: PeriodSummary | null;
}

export function PlanillasHeader({ academicYear, period, summary }: PlanillasHeaderProps) {
  return (
    <header className="gcl-header">
      <div className="gcl-intro">
        <div className="gcl-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.75} />
          Año {academicYear}
          <span className="gcl-date-chip__dot" aria-hidden="true">·</span>
          <span className="gcl-date-chip__period">{period}</span>
        </div>
        <h1 className="gcl-title">Mis planillas</h1>
        <p className="gcl-lede">Gestiona las calificaciones de los salones y materias asignados desde un solo espacio.</p>
      </div>

      {summary && <PeriodSummaryCard summary={summary} />}
    </header>
  );
}

function PeriodSummaryCard({ summary }: { summary: PeriodSummary }) {
  return (
    <section aria-label="Resumen del periodo" className="gcl-surface gcl-summary">
      <div className="gcl-summary__item">
        <span className="gcl-eyebrow">Avance general</span>
        <span className="gcl-summary__value gcl-num">{summary.progressPct}%</span>
        <div
          role="progressbar"
          aria-valuenow={summary.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance general"
          className="gcl-summary__bar"
        >
          <div style={{ width: `${summary.progressPct}%` }} />
        </div>
      </div>

      <div className="gcl-summary__item">
        <span className="gcl-eyebrow">Por calificar</span>
        <span className="gcl-summary__value gcl-num">{summary.pending}</span>
        <span className="gcl-summary__note">
          {pluralize(summary.pending, "nota", "notas")} en {summary.sheetsWithPending}{" "}
          {pluralize(summary.sheetsWithPending, "planilla", "planillas")}
        </span>
      </div>

      <div className="gcl-summary__item">
        <span className="gcl-eyebrow">Cierre de notas</span>
        {summary.closing ? (
          <>
            <span className={cn("gcl-summary__value", summary.closing.daysLeft >= 0 && "gcl-summary__value--accent")}>
              {formatDaysLeft(summary.closing.daysLeft)}
            </span>
            <span className="gcl-summary__note">{formatClosingDate(summary.closing.date)}</span>
          </>
        ) : (
          <>
            <span className="gcl-summary__value">—</span>
            <span className="gcl-summary__note">Sin fecha de cierre</span>
          </>
        )}
      </div>
    </section>
  );
}

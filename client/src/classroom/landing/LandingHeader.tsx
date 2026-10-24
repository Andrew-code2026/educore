import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  describeReviewScope,
  formatDaysShort,
  formatLongDay,
  plural,
  type ClassroomSummary,
} from './courses';

interface LandingHeaderProps {
  academicYear: string;
  period: string | null;
  summary: ClassroomSummary | null;
}

export function LandingHeader({ academicYear, period, summary }: LandingHeaderProps) {
  return (
    <header className="ccl-header">
      <div className="ccl-intro">
        <div className="ccl-date-chip">
          <Calendar aria-hidden="true" strokeWidth={1.75} />
          Año {academicYear}
          {period && (
            <>
              <span className="ccl-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="ccl-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="ccl-title">Mis cursos</h1>
        <p className="ccl-lede">
          Publica actividades y revisa las entregas digitales de tus cursos asignados.
        </p>
      </div>

      {summary && <PeriodSummary summary={summary} />}
    </header>
  );
}

function PeriodSummary({ summary }: { summary: ClassroomSummary }) {
  const { next } = summary;
  return (
    <section aria-label="Resumen del periodo" className="ccl-surface ccl-summary">
      <div className="ccl-summary__item">
        <span className="ccl-eyebrow">Cursos</span>
        <span className="ccl-summary__value ccl-num">{summary.courses}</span>
        <span className="ccl-summary__note">
          {plural(summary.students, 'estudiante', 'estudiantes')}
        </span>
      </div>
      <div className="ccl-summary__item">
        <span className="ccl-eyebrow">Por revisar</span>
        <span className="ccl-summary__value ccl-num">{summary.toReview}</span>
        <span className="ccl-summary__note">{describeReviewScope(summary)}</span>
      </div>
      <div className="ccl-summary__item">
        <span className="ccl-eyebrow">Próxima entrega</span>
        <span className={cn('ccl-summary__value', next && 'ccl-summary__value--accent')}>
          {next ? formatDaysShort(next.daysLeft) : '—'}
        </span>
        <span className="ccl-summary__note">
          {next ? formatLongDay(next.dueAt) : 'Sin entregas programadas'}
        </span>
      </div>
    </section>
  );
}

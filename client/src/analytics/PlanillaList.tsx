import { memo } from "react";
import { ArrowRight, Users } from "lucide-react";
import { formatGrade, GRADE_SCALE_MAX, PASSING_GRADE, plural, type PlanillaModel } from "./landing";

const PASSING_PCT = (PASSING_GRADE / GRADE_SCALE_MAX) * 100;

interface PlanillaListProps {
  planillas: PlanillaModel[];
  onOpen: (planilla: PlanillaModel) => void;
}

export const PlanillaList = memo(function PlanillaList({ planillas, onOpen }: PlanillaListProps) {
  return (
    <ul aria-label="Planillas del periodo" className="anl-surface anl-list">
      {planillas.map((planilla) => (
        <PlanillaRow key={planilla.key} planilla={planilla} onOpen={onOpen} />
      ))}
    </ul>
  );
});

function PlanillaRow({ planilla, onOpen }: { planilla: PlanillaModel; onOpen: (planilla: PlanillaModel) => void }) {
  const name = `${planilla.subject} ${planilla.group}`;
  const hasAverage = planilla.average != null;

  return (
    <li className="anl-planilla">
      <div className="anl-planilla__body">
        <div className="anl-planilla__title">
          <span className="anl-group anl-num">{planilla.group}</span>
          <span className="anl-planilla__subject">{planilla.subject}</span>
        </div>
        <div className="anl-planilla__meta">
          <span className="anl-meta">
            <Users aria-hidden="true" strokeWidth={1.9} />
            {plural(planilla.students, "estudiante", "estudiantes")}
          </span>
          <span>{plural(planilla.evaluations, "evaluación", "evaluaciones")}</span>
          {planilla.belowPassing > 0 && (
            <span className="anl-flag">
              {planilla.belowPassing} bajo {formatGrade(PASSING_GRADE)}
            </span>
          )}
        </div>
      </div>

      <div className="anl-planilla__stat">
        <span className="anl-eyebrow anl-eyebrow--sm">Promedio</span>
        <span className={`anl-planilla__avg anl-num anl-planilla__avg--${planilla.tone}`}>
          {hasAverage ? formatGrade(planilla.average as number) : "—"}
        </span>
        <div
          className="anl-scale"
          role="img"
          aria-label={
            hasAverage
              ? `Promedio ${formatGrade(planilla.average as number)} de ${GRADE_SCALE_MAX}; aprobatoria ${formatGrade(PASSING_GRADE)}`
              : "Sin notas registradas"
          }
        >
          {hasAverage && (
            <div
              className={`anl-scale__bar anl-scale__bar--${planilla.tone}`}
              style={{ width: `${((planilla.average as number) / GRADE_SCALE_MAX) * 100}%` }}
            />
          )}
          <span aria-hidden="true" className="anl-scale__tick" style={{ left: `${PASSING_PCT}%` }} />
        </div>
      </div>

      <div className="anl-planilla__stat">
        <span className="anl-eyebrow anl-eyebrow--sm">Notas</span>
        <span className="anl-planilla__progress anl-num">
          {planilla.total > 0 ? `${planilla.graded} de ${planilla.total}` : "Sin evaluaciones"}
        </span>
        <div
          role="progressbar"
          aria-label={`Notas registradas de ${name}`}
          aria-valuenow={planilla.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="anl-meter anl-meter--thin"
        >
          <div className="anl-meter__bar" style={{ width: `${planilla.progressPct}%` }} />
        </div>
      </div>

      <div className="anl-planilla__action">
        <button
          type="button"
          className="anl-btn anl-btn--outline"
          aria-label={`Abrir planilla de ${name} en Grade Center`}
          onClick={() => onOpen(planilla)}
        >
          Abrir
          <ArrowRight aria-hidden="true" strokeWidth={1.9} />
        </button>
      </div>
    </li>
  );
}

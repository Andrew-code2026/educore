import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import { needsAttention } from "@/gradecenter/domain/scale";
import { cn } from "@/lib/utils";
import { formatGrade, formatShortDate, plural } from "../format";
import { LevelPill, Pill } from "../ui";
import type { EvaluationModel, OutlookTone, SubjectModel } from "./grades";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;

const OUTLOOK_TONE: Record<OutlookTone, { className: string; icon: typeof Info }> = {
  good: { className: "stp-callout--ok", icon: CheckCircle2 },
  neutral: { className: "", icon: TrendingUp },
  warn: { className: "stp-callout--warn", icon: AlertTriangle },
  bad: { className: "stp-callout--alert", icon: AlertTriangle },
  empty: { className: "stp-callout--neutral", icon: Info },
};

/** Detalle de una materia: definitiva, proyección para aprobar y cada evaluación con su retroalimentación. */
export function SubjectDetail({ subject }: { subject: SubjectModel }) {
  const outlook = OUTLOOK_TONE[subject.outlook.tone];
  const OutlookIcon = outlook.icon;
  return (
    <>
      <div className="stp-stats">
        <div className="stp-stat">
          <span className="stp-stat__label">Definitiva</span>
          <span className={cn("stp-stat__value", subject.needsAttention && "stp-grade--alert")}>{subject.average != null ? formatGrade(subject.average) : "—"}</span>
          <span>
            <LevelPill score={subject.average} long />
          </span>
        </div>
        <div className="stp-stat">
          <span className="stp-stat__label">Evaluado del periodo</span>
          <span className="stp-stat__value">{subject.evaluatedPct} %</span>
          <span className="stp-stat__label">
            {subject.graded} de {plural(subject.total, "evaluación", "evaluaciones")}
          </span>
        </div>
      </div>

      <div className={cn("stp-callout", outlook.className)} role="note">
        <span className="stp-callout__icon">
          <OutlookIcon {...ICON} />
        </span>
        <span className="stp-callout__body">
          <span className="stp-callout__title">{subject.outlook.text}</span>
          {subject.provisional && <span className="stp-callout__text">Definitiva parcial: aún falta calificar más del 40 % del periodo.</span>}
        </span>
      </div>

      <div className="stp-block">
        <h3 className="stp-block__title">Evaluaciones</h3>
        {subject.evaluations.length ? (
          <ul className="stp-list stp-list--flush" aria-label={`Evaluaciones de ${subject.name}`}>
            {subject.evaluations.map(evaluation => (
              <li key={evaluation.id}>
                <EvaluationRow evaluation={evaluation} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="stp-note">Tu docente aún no ha publicado evaluaciones en esta materia.</p>
        )}
      </div>
    </>
  );
}

function EvaluationRow({ evaluation }: { evaluation: EvaluationModel }) {
  return (
    <div className="stp-row stp-row--compact stp-row--stacked">
      <span className="stp-row__body">
        <span className="stp-row__title">{evaluation.title}</span>
        <span className="stp-row__meta">
          {evaluation.typeLabel} · {evaluation.weight} % · {formatShortDate(evaluation.date)}
        </span>
        {evaluation.comment && <span className="stp-quote stp-quote--inline">{evaluation.comment}</span>}
      </span>
      <span className="stp-row__aside">
        {evaluation.state === "graded" ? (
          <span className={cn("stp-grade", needsAttention(evaluation.value) && "stp-grade--alert")}>{formatGrade(evaluation.value!)}</span>
        ) : (
          <Pill tone={evaluation.state === "upcoming" ? "info" : "neutral"}>{evaluation.state === "upcoming" ? "Programada" : "Sin nota"}</Pill>
        )}
      </span>
    </div>
  );
}

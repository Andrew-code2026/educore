import { memo } from "react";
import { ArrowRight, CalendarX2, TrendingDown } from "lucide-react";
import type { AlertKind, AlertModel } from "./landing";

const KIND_META: Record<AlertKind, { tag: string; action: string; Icon: typeof TrendingDown }> = {
  academic: { tag: "Académica", action: "Ver notas", Icon: TrendingDown },
  attendance: { tag: "Asistencia", action: "Ver asistencia", Icon: CalendarX2 },
};

interface AlertListProps {
  alerts: AlertModel[];
  onOpen: (alert: AlertModel) => void;
}

export const AlertList = memo(function AlertList({ alerts, onOpen }: AlertListProps) {
  return (
    <ul aria-label="Estudiantes con alertas" className="anl-surface anl-list">
      {alerts.map((alert) => (
        <AlertRow key={alert.key} alert={alert} onOpen={onOpen} />
      ))}
    </ul>
  );
});

function AlertRow({ alert, onOpen }: { alert: AlertModel; onOpen: (alert: AlertModel) => void }) {
  const { tag, action, Icon } = KIND_META[alert.kind];

  return (
    <li className="anl-alert">
      <span aria-hidden="true" className={`anl-avatar anl-avatar--${alert.kind}`}>
        {alert.initials}
      </span>

      <div className="anl-alert__body">
        <div className="anl-alert__title">
          <span className="anl-alert__name">{alert.studentName}</span>
          <span className={`anl-pill anl-pill--${alert.kind}`}>
            <Icon aria-hidden="true" strokeWidth={1.9} />
            {tag}
          </span>
        </div>
        <div className="anl-alert__meta">
          <span className="anl-group anl-num">{alert.group}</span>
          <span>{alert.subject}</span>
          <span aria-hidden="true" className="anl-sep">
            ·
          </span>
          <span className="anl-alert__reason">{alert.reason}</span>
          <span className="anl-alert__detail">{alert.detail}</span>
        </div>
      </div>

      <button
        type="button"
        className="anl-btn anl-btn--outline"
        aria-label={`${action} de ${alert.studentName}, ${alert.group} ${alert.subject}`}
        onClick={() => onOpen(alert)}
      >
        {action}
        <ArrowRight aria-hidden="true" strokeWidth={1.9} />
      </button>
    </li>
  );
}

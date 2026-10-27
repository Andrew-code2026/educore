/** Avance del pase de lista y la única acción masiva: completar los restantes. */
import { motion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_DOT } from "../statusMeta";
import type { AttendanceStatus, DayMetrics } from "../types";

interface DayProgressProps {
  metrics: DayMetrics;
  onCompletePending: () => void;
}

const LEGEND: Array<{ status: Exclude<AttendanceStatus, "pending">; one: string; many: string }> = [
  { status: "present", one: "Presente", many: "Presentes" },
  { status: "absent", one: "Ausente", many: "Ausentes" },
  { status: "late", one: "Tardanza", many: "Tardanzas" },
  { status: "excuse", one: "Excusa", many: "Excusas" },
];

export function DayProgress({ metrics, onCompletePending }: DayProgressProps) {
  const { total, pending } = metrics;
  const recorded = total - pending;
  const complete = total > 0 && pending === 0;
  const denominator = Math.max(1, total);

  return (
    <section className="att-progress glass" aria-label="Avance del pase de lista">
      <p className="att-progress-count">
        <span className="tabular att-progress-value">{recorded}</span>
        <span className="tabular text-muted-foreground">/{total}</span>
        <span className="att-progress-caption">registrados</span>
      </p>

      <div
        className="att-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={recorded}
        aria-label={`${recorded} de ${total} estudiantes registrados`}
      >
        {LEGEND.map(item => (
          <motion.span
            key={item.status}
            className="att-progress-segment"
            data-status={item.status}
            initial={false}
            animate={{ width: `${(metrics[item.status] / denominator) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>

      <ul className="att-progress-legend" aria-label="Resumen de la jornada">
        {LEGEND.map(item => {
          const value = metrics[item.status];
          return (
            <li key={item.status} className={cn("att-progress-legend-item", value === 0 && "is-empty")}>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[item.status])} aria-hidden="true" />
              <span className="tabular font-semibold text-foreground">{value}</span>
              {value === 1 ? item.one : item.many}
            </li>
          );
        })}
      </ul>

      {complete ? (
        <p className="att-progress-done" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          Pase de lista completo
        </p>
      ) : total > 0 ? (
        <button type="button" onClick={onCompletePending} className="att-primary-action">
          <CheckCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Marcar restantes presentes
          <span className="att-primary-action-count tabular">{pending}</span>
        </button>
      ) : null}
    </section>
  );
}

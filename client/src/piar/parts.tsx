import type { ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function EmptyCard({ icon, title, children, action }: EmptyCardProps) {
  return (
    <div className="pia-surface pia-empty" role="status">
      <span aria-hidden="true" className="pia-empty__icon">
        {icon}
      </span>
      <div className="pia-empty__body">
        <span className="pia-empty__title">{title}</span>
        <span className="pia-empty__text">{children}</span>
      </div>
      {action}
    </div>
  );
}

interface ErrorCardProps {
  title: string;
  detail?: string;
  onRetry: () => void;
}

export function ErrorCard({ title, detail = "Revisa tu conexión e inténtalo de nuevo.", onRetry }: ErrorCardProps) {
  return (
    <div className="pia-surface pia-empty" role="alert">
      <span aria-hidden="true" className="pia-empty__icon pia-empty__icon--error">
        <TriangleAlert strokeWidth={1.9} />
      </span>
      <div className="pia-empty__body">
        <span className="pia-empty__title">{title}</span>
        <span className="pia-empty__text">{detail}</span>
      </div>
      <button type="button" className="pia-btn pia-btn--outline" onClick={onRetry}>
        <RotateCcw aria-hidden="true" strokeWidth={1.9} />
        Reintentar
      </button>
    </div>
  );
}

interface MeterProps {
  pct: number;
  label: string;
  thin?: boolean;
}

export function Meter({ pct, label, thin }: MeterProps) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("pia-meter", thin && "pia-meter--thin")}
    >
      <div className={cn("pia-meter__bar", value === 100 && "pia-meter__bar--complete")} style={{ width: `${value}%` }} />
    </div>
  );
}

/** Avance de los tres anexos de un PIAR, en barras cortas. */
export function AnnexBars({ annexes, studentName }: { annexes: number[]; studentName: string }) {
  return (
    <div className="pia-annex-bars">
      {annexes.map((pct, index) => (
        <div key={index} className="pia-annex-bars__item">
          <span className="pia-annex-bars__label">
            <span>Anexo {index + 1}</span>
            <span className="pia-num">{pct}%</span>
          </span>
          <Meter pct={pct} thin label={`Anexo ${index + 1} de ${studentName}: ${pct}% diligenciado`} />
        </div>
      ))}
    </div>
  );
}

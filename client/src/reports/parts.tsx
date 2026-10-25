import type { ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

interface EmptyCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

export function EmptyCard({ icon, title, children }: EmptyCardProps) {
  return (
    <div className="rpt-surface rpt-empty" role="status">
      <span aria-hidden="true" className="rpt-empty__icon">
        {icon}
      </span>
      <div className="rpt-empty__body">
        <span className="rpt-empty__title">{title}</span>
        <span className="rpt-empty__text">{children}</span>
      </div>
    </div>
  );
}

interface ErrorCardProps {
  title: string;
  /** Detalle del error; por defecto sugiere revisar la conexión. */
  detail?: string;
  onRetry: () => void;
}

export function ErrorCard({ title, detail = "Revisa tu conexión e inténtalo de nuevo.", onRetry }: ErrorCardProps) {
  return (
    <div className="rpt-surface rpt-empty" role="alert">
      <span aria-hidden="true" className="rpt-empty__icon rpt-empty__icon--error">
        <TriangleAlert strokeWidth={1.9} />
      </span>
      <div className="rpt-empty__body">
        <span className="rpt-empty__title">{title}</span>
        <span className="rpt-empty__text">{detail}</span>
      </div>
      <button type="button" className="rpt-btn rpt-btn--outline rpt-empty__action" onClick={onRetry}>
        <RotateCcw aria-hidden="true" strokeWidth={1.9} />
        Reintentar
      </button>
    </div>
  );
}

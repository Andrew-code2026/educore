import type { ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

interface EmptyCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function EmptyCard({ icon, title, children, action }: EmptyCardProps) {
  return (
    <div className="crt-surface crt-empty" role="status">
      <span aria-hidden="true" className="crt-empty__icon">
        {icon}
      </span>
      <div className="crt-empty__body">
        <span className="crt-empty__title">{title}</span>
        <span className="crt-empty__text">{children}</span>
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
    <div className="crt-surface crt-empty" role="alert">
      <span aria-hidden="true" className="crt-empty__icon crt-empty__icon--error">
        <TriangleAlert strokeWidth={1.9} />
      </span>
      <div className="crt-empty__body">
        <span className="crt-empty__title">{title}</span>
        <span className="crt-empty__text">{detail}</span>
      </div>
      <button type="button" className="crt-btn crt-btn--outline" onClick={onRetry}>
        <RotateCcw aria-hidden="true" strokeWidth={1.9} />
        Reintentar
      </button>
    </div>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const formatWhen = (value: Date | string) => DATE_FORMAT.format(new Date(value));

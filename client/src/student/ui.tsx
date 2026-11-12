/**
 * Primitivas del portal estudiante. Una sola implementación de encabezado, franja resumen,
 * secciones, pastillas, vacíos y cajones para que todas las páginas compartan el mismo lenguaje.
 */
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Calendar, RotateCcw, X } from "lucide-react";
import { LEVELS, levelFromScore } from "@/gradecenter/domain/scale";
import { cn } from "@/lib/utils";
import { formatGrade, formatToday } from "./format";
import "./portal.css";

export type Tone = "neutral" | "info" | "ok" | "warn" | "alert";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;

/** Raíz de página: dueña de su scroll, padding y halos (las secciones son full-bleed en el shell). */
export function PageFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="stp" aria-label={label}>
      {/* Halos recortados en su propia capa: no ensanchan el área desplazable de la página */}
      <div aria-hidden="true" className="stp__glows">
        <div className="stp__glow stp__glow--a" />
        <div className="stp__glow stp__glow--b" />
      </div>
      <div className="stp__content">{children}</div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  lede: string;
  /** "Periodo 4" junto a la fecha de hoy. */
  period?: string | null;
  actions?: ReactNode;
  summary?: ReactNode;
}

export function PageHeader({ title, lede, period, actions, summary }: PageHeaderProps) {
  return (
    <header className="stp-header">
      <div className="stp-intro">
        <div className="stp-date-chip">
          <Calendar {...ICON} strokeWidth={1.75} />
          {formatToday()}
          {period && (
            <>
              <span className="stp-date-chip__dot" aria-hidden="true">
                ·
              </span>
              <span className="stp-date-chip__period">{period}</span>
            </>
          )}
        </div>
        <h1 className="stp-title">{title}</h1>
        <p className="stp-lede">{lede}</p>
        {actions && <div className="stp-intro__actions">{actions}</div>}
      </div>
      {summary}
    </header>
  );
}

export interface SummaryItem {
  label: string;
  value: ReactNode;
  unit?: string;
  note: ReactNode;
  tone?: "accent" | "alert";
}

/** Franja resumen: exactamente los datos que importan, separados por líneas finas. */
export function SummaryStrip({ items, label }: { items: SummaryItem[]; label: string }) {
  return (
    <section aria-label={label} className="stp-surface stp-summary">
      {items.map(item => (
        <div key={item.label} className="stp-summary__item">
          <span className="stp-eyebrow">{item.label}</span>
          <span className={cn("stp-summary__value stp-num", item.tone && `stp-summary__value--${item.tone}`)}>
            {item.value}
            {item.unit && <span className="stp-summary__unit">{item.unit}</span>}
          </span>
          <span className="stp-summary__note">{item.note}</span>
        </div>
      ))}
    </section>
  );
}

interface SectionProps {
  id: string;
  title: string;
  count?: number;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ id, title, count, aside, children, className }: SectionProps) {
  return (
    <section aria-labelledby={id} className={cn("stp-section", className)}>
      <div className="stp-section__head">
        <h2 id={id} className="stp-section__title">
          {title}
        </h2>
        {count !== undefined && count > 0 && <span className="stp-count stp-num">{count}</span>}
        {aside && <div className="stp-section__aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="stp-segment">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className="stp-segment__btn"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="stp-segment__count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pill({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("stp-pill", tone !== "neutral" && `stp-pill--${tone}`)}>
      {dot && <span className="stp-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Nivel de desempeño con la escala institucional del Grade Center. */
export function LevelPill({ score, long = false }: { score: number | null | undefined; long?: boolean }) {
  const level = levelFromScore(score);
  if (!level) return <span className="stp-pill">Sin notas</span>;
  return <span className={`stp-pill stp-level--${level}`}>{long ? LEVELS[level].label : LEVELS[level].short}</span>;
}

/** Nota con un decimal o "—"; en rojo cuando está por debajo del umbral. */
export function Grade({ value, alert = false, className }: { value: number | null | undefined; alert?: boolean; className?: string }) {
  if (value == null) return <span className={cn("stp-grade stp-grade--muted", className)}>—</span>;
  return <span className={cn("stp-grade", alert && "stp-grade--alert", className)}>{formatGrade(value)}</span>;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "ok" | "alert";
  page?: boolean;
}

export function EmptyState({ icon, title, note, action, tone = "default", page = false }: EmptyStateProps) {
  return (
    <div role="status" className={cn("stp-empty", page && "stp-empty--page")}>
      <span className={cn("stp-empty__icon", tone !== "default" && `stp-empty__icon--${tone}`)}>{icon}</span>
      <p className="stp-empty__title">{title}</p>
      {note && <p className="stp-empty__note">{note}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, title = "No pudimos cargar esta información", note = "Revisa tu conexión e inténtalo de nuevo." }: { onRetry: () => void; title?: string; note?: string }) {
  return (
    <div role="alert" className="stp-empty stp-empty--page">
      <span className="stp-empty__icon stp-empty__icon--alert">
        <AlertTriangle {...ICON} />
      </span>
      <p className="stp-empty__title">{title}</p>
      <p className="stp-empty__note">{note}</p>
      <button type="button" className="stp-btn stp-btn--outline" onClick={onRetry}>
        <RotateCcw {...ICON} />
        Reintentar
      </button>
    </div>
  );
}

/** Esqueleto de una página: encabezado, franja y filas con la forma final. */
export function PageSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="stp-section">
      <div className="stp-header">
        <div className="stp-intro">
          <span className="stp-skeleton stp-skeleton--title" />
          <span className="stp-skeleton stp-skeleton--lede" />
        </div>
        <span className="stp-skeleton stp-skeleton--summary" />
      </div>
      <div className="stp-surface stp-list">
        {Array.from({ length: rows }, (_, index) => (
          <span key={index} className="stp-skeleton stp-skeleton--row" />
        ))}
      </div>
    </div>
  );
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Elemento a la izquierda del título (burbuja de materia, insignia de fecha). */
  leading?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "drawer" | "dialog";
}

/** Cajón lateral o diálogo centrado (Radix: foco atrapado, Escape y lectores de pantalla). */
export function Sheet({ open, onOpenChange, title, subtitle, leading, children, footer, variant = "drawer" }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <div className="stp-layer">
          <DialogPrimitive.Overlay className="stp-overlay" />
          <DialogPrimitive.Content className={variant === "drawer" ? "stp-drawer" : "stp-dialog"} aria-describedby={undefined}>
            <div className="stp-sheet__head">
              {leading}
              <div className="stp-sheet__heading">
                <DialogPrimitive.Title className="stp-sheet__title">{title}</DialogPrimitive.Title>
                {subtitle && <div className="stp-sheet__sub">{subtitle}</div>}
              </div>
              <DialogPrimitive.Close className="stp-icon-btn" aria-label="Cerrar">
                <X {...ICON} />
              </DialogPrimitive.Close>
            </div>
            <div className="stp-sheet__body">{children}</div>
            {footer && <div className="stp-sheet__foot">{footer}</div>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

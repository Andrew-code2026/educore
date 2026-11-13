import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CalendarDays, Check, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalContainerProvider, isEscapeForNestedPopup, usePortalContainerHost } from "@/components/ui/portal-container";
import "./admin.css";

/* ── Formato ─────────────────────────────────────────────── */

export const initialsOf = (name: string | null | undefined) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "?";

export const formatShortDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const todayLabel = () =>
  capitalize(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));

/** Roles de identidad (servidor) con etiqueta y tono visual. */
export const IDENTITY_ROLE_META: Record<string, { label: string; plural: string; tone: Tone }> = {
  SUPER_ADMIN: { label: "Super administrador", plural: "Super administradores", tone: "dark" },
  SCHOOL_ADMIN: { label: "Administración", plural: "Administración", tone: "dark" },
  RECTOR: { label: "Rectoría", plural: "Rectoría", tone: "dark" },
  COORDINATOR: { label: "Coordinación", plural: "Coordinación", tone: "dark" },
  TEACHER: { label: "Docente", plural: "Docentes", tone: "blue" },
  STUDENT: { label: "Estudiante", plural: "Estudiantes", tone: "green" },
  GUARDIAN: { label: "Acudiente", plural: "Acudientes", tone: "violet" },
};

export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Activo", tone: "green" },
  INVITED: { label: "Invitado", tone: "blue" },
  PENDING: { label: "Pendiente", tone: "amber" },
  ACCEPTED: { label: "Aceptada", tone: "green" },
  EXPIRED: { label: "Vencida", tone: "neutral" },
  REVOKED: { label: "Revocada", tone: "neutral" },
  SUSPENDED: { label: "Suspendido", tone: "rose" },
  INACTIVE: { label: "Inactivo", tone: "neutral" },
};

export type Tone = "blue" | "violet" | "green" | "amber" | "rose" | "neutral" | "dark";

/* ── Piezas ─────────────────────────────────────────────── */

export function AdminPage({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="adm" aria-label={label}>
      <div aria-hidden="true" className="adm__glow adm__glow--a" />
      <div aria-hidden="true" className="adm__glow adm__glow--b" />
      <div className="adm__content">{children}</div>
    </div>
  );
}

interface AdminHeaderProps {
  chip?: ReactNode;
  title: string;
  lede: string;
  actions?: ReactNode;
}

export function AdminHeader({ chip, title, lede, actions }: AdminHeaderProps) {
  return (
    <header className="adm-header">
      <div className="adm-intro">
        <div className="adm-date-chip">
          <CalendarDays aria-hidden="true" strokeWidth={1.75} />
          {todayLabel()}
          {chip ? (
            <>
              <span className="adm-date-chip__dot" aria-hidden="true">·</span>
              <span className="adm-date-chip__accent">{chip}</span>
            </>
          ) : null}
        </div>
        <h1 className="adm-title">{title}</h1>
        <p className="adm-lede">{lede}</p>
      </div>
      {actions ? <div className="adm-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "alert" | "ok" | "empty";
  meter?: number | null;
}

export function SummaryStrip({ items }: { items: SummaryItem[] }) {
  return (
    <section className="adm-surface adm-summary" style={{ ["--adm-summary-cols" as string]: items.length }} aria-label="Resumen">
      {items.map(item => (
        <div key={item.key} className="adm-summary__item">
          <span className="adm-eyebrow">{item.label}</span>
          <span className={cn("adm-summary__value adm-num", item.tone && `adm-summary__value--${item.tone}`)}>{item.value}</span>
          {item.meter !== undefined && item.meter !== null ? (
            <div className="adm-meter" aria-hidden="true">
              <div className="adm-meter__bar" style={{ width: `${Math.max(0, Math.min(100, item.meter))}%` }} />
            </div>
          ) : null}
          {item.note ? <span className="adm-summary__note">{item.note}</span> : null}
        </div>
      ))}
    </section>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "filter",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "filter" | "tabs";
}) {
  return (
    <div className={cn("adm-segment", variant === "tabs" && "adm-segment--tabs")} role="tablist" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={cn("adm-segment__btn", value === option.value && "is-active")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className="adm-segment__count adm-num">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pill({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("adm-pill", tone !== "neutral" && tone !== "dark" && `adm-pill--${tone}`)}>
      {dot ? <span className="adm-pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name, tone = "blue", large = false }: { name: string | null | undefined; tone?: Tone; large?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("adm-avatar", tone !== "blue" && tone !== "neutral" && `adm-avatar--${tone}`, large && "adm-avatar--lg")}>
      {initialsOf(name)}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  tone = "info",
  action,
}: {
  title: string;
  text: string;
  tone?: "info" | "ok" | "error";
  action?: ReactNode;
}) {
  const Icon = tone === "ok" ? Check : tone === "error" ? AlertCircle : Inbox;
  return (
    <div className="adm-empty" role={tone === "error" ? "alert" : undefined}>
      <span className={cn("adm-empty__icon", tone !== "info" && `adm-empty__icon--${tone}`)}>
        <Icon aria-hidden="true" strokeWidth={1.9} />
      </span>
      <div className="adm-empty__body">
        <p className="adm-empty__title">{title}</p>
        <p className="adm-empty__text">{text}</p>
      </div>
      {action}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="adm-surface adm-list" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="adm-skeleton" style={{ height: 56, margin: 4 }} />
      ))}
    </div>
  );
}

/* ── Diálogo ────────────────────────────────────────────── */

interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  wide?: boolean;
  /** Bloquea el cierre mientras se guarda. */
  busy?: boolean;
  children: ReactNode;
}

/** Se monta dentro de `.edc-shell` para heredar los tokens de tema (claro/oscuro). */
export function AdminDialog({ open, onClose, eyebrow, title, description, wide = false, busy = false, children }: AdminDialogProps) {
  const [selectContainer, contentRef] = usePortalContainerHost<HTMLDivElement>();
  const container = typeof document !== "undefined" ? document.querySelector<HTMLElement>(".edc-shell") : null;
  return (
    <Dialog.Root open={open} onOpenChange={next => !next && !busy && onClose()}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="adm-dialog-overlay" />
        <Dialog.Content
          ref={contentRef}
          className={cn("adm-dialog", wide && "adm-dialog--wide")}
          onEscapeKeyDown={event => {
            if (isEscapeForNestedPopup(event)) event.preventDefault();
          }}
        >
          <div className="adm-dialog__head">
            <div>
              {eyebrow ? <p className="adm-dialog__eyebrow">{eyebrow}</p> : null}
              <Dialog.Title className="adm-dialog__title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="adm-dialog__desc">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="adm-icon-btn" aria-label="Cerrar" disabled={busy}>
              <X aria-hidden="true" strokeWidth={2} />
            </Dialog.Close>
          </div>
          <PortalContainerProvider container={selectContainer}>{open ? children : null}</PortalContainerProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="adm-field">
      <span className="adm-label">
        {label}
        {hint ? <span className="adm-label__hint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

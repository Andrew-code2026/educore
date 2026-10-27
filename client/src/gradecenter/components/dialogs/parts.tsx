import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Piezas compartidas por todos los modales de la planilla: mismo encabezado,
 * mismos campos y el mismo pie de acciones. Un solo lenguaje visual.
 */

export const DIALOG_CONTENT_CLASS =
  "gc-dialog glass-strong gap-0 rounded-2xl border-white/12 p-0 sm:max-w-lg";

export const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[var(--gc-cobalt)]/70 focus:bg-white/8 aria-[invalid=true]:border-[var(--gc-bajo)]/70";

export function DialogHeaderBar({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/8 px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--gc-cobalt)]/14 text-[var(--gc-cobalt)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle className="text-base leading-tight font-semibold">{title}</DialogTitle>
        {description && (
          <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        )}
      </div>
      <DialogClose
        className="-mt-1 -mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </DialogClose>
    </div>
  );
}

export function Field({
  label,
  hint,
  optional,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-foreground/85">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/8 px-3 py-2 text-xs text-[var(--gc-bajo)]"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function DialogFooterBar({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 px-5 py-3">
      {aside && <div className="mr-auto text-xs text-muted-foreground">{aside}</div>}
      {children}
    </div>
  );
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
};

export function ActionButton({ tone = "secondary", className, type = "button", ...props }: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
        tone === "primary" && "bg-[var(--gc-cobalt)] text-white hover:bg-[var(--gc-cobalt)]/90",
        tone === "secondary" && "border border-white/10 text-muted-foreground hover:bg-white/8 hover:text-foreground",
        tone === "danger" && "bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90",
        className,
      )}
      {...props}
    />
  );
}

/** Selector segmentado accesible (radiogroup) para opciones mutuamente excluyentes. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; hint?: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              active
                ? "border-[var(--gc-cobalt)]/70 bg-[var(--gc-cobalt)]/10"
                : "border-white/8 bg-white/3 hover:bg-white/6",
            )}
          >
            <span className="block text-xs font-semibold">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

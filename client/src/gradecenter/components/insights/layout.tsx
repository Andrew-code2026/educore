import { cn } from "@/lib/utils";

export function Section({
  title,
  hint,
  children,
  className,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="gc-label text-xs">{title}</span>
        {action ?? (hint && <span className="gc-num text-xs text-muted-foreground">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold">{title}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function InfoRow({
  icon,
  label,
  value,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-white/8 bg-white/3 px-2.5 py-1.5", className)}>
      <div className="flex items-center gap-1 text-xs tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium">{value}</div>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("glass rounded-2xl p-3", className)}>{children}</div>;
}
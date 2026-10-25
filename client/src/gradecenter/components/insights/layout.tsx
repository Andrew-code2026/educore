
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

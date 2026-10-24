import { cn } from "@/lib/utils";

/**
 * Marca GradeCenter Next.
 *
 * El glifo es una "G" construida como matriz de celdas: la letra nace del
 * propio lenguaje visual del producto y no del nombre escrito en una fuente.
 */
export function GradeCenterMark({ className }: { className?: string }) {
  const cells: { x: number; y: number; bar?: boolean }[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 1, bar: true },
  ];

  return (
    <svg viewBox="0 0 30 30" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gc-mark-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.13 250)" />
          <stop offset="55%" stopColor="oklch(0.64 0.19 266)" />
          <stop offset="100%" stopColor="oklch(0.62 0.17 300)" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="29" height="29" rx="8.5" fill="url(#gc-mark-a)" opacity="0.14" />
      <rect x="0.5" y="0.5" width="29" height="29" rx="8.5" fill="none" stroke="url(#gc-mark-a)" strokeOpacity="0.5" />
      {cells.map((cell) =>
        cell.bar ? (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={4 + cell.x * 8}
            y={4 + cell.y * 8 + 2.5}
            width={6}
            height={3.6}
            rx={1.6}
            fill="url(#gc-mark-a)"
          />
        ) : (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={4 + cell.x * 8}
            y={4 + cell.y * 8}
            width={6}
            height={6}
            rx={1.9}
            fill="url(#gc-mark-a)"
          />
        ),
      )}
    </svg>
  );
}

export function BrandWordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <GradeCenterMark className="size-9 shrink-0" />
      <div className="gc-brand-copy min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[15px] leading-none font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Grade
            <span className="bg-gradient-to-r from-[oklch(0.78_0.13_250)] via-[oklch(0.64_0.19_266)] to-[oklch(0.62_0.17_300)] bg-clip-text text-transparent">
              Center
            </span>
          </span>
          {!compact && (
            <span className="gc-brand-next rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Next
            </span>
          )}
        </div>
        {!compact && (
          <div className="gc-brand-meta mt-1 flex items-center gap-1.5 text-xs tracking-[0.14em] text-muted-foreground/70 uppercase">
            <span>EduCore</span>
            <span className="size-1 rounded-full bg-current opacity-50" />
            <span>Workspace académico</span>
          </div>
        )}
      </div>
    </div>
  );
}

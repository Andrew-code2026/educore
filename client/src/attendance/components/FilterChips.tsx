/** Filtros operativos primarios; los estados individuales viven en el Pulse Rail. */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AttendanceFilter } from "../types";

interface FilterChipsProps {
  active: AttendanceFilter;
  counts: Record<AttendanceFilter, number>;
  onChange: (filter: AttendanceFilter) => void;
  visible: number;
  total: number;
  query: string;
  onClearQuery: () => void;
  className?: string;
}

const PRIMARY_FILTERS: Array<{ key: AttendanceFilter; label: string; short?: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "attention", label: "Problemas", short: "En atención" },
];

export function FilterChips({
  active,
  counts,
  onChange,
  visible,
  total,
  query,
  onClearQuery,
  className,
}: FilterChipsProps) {
  return (
    <div className={cn("chrona-filters flex min-w-0 flex-1 flex-wrap items-center gap-1", className)} role="group" aria-label="Filtros del roster">
      <div className="chrona-filter-primary flex items-center gap-0.5 rounded-[11px] p-0.5">
        {PRIMARY_FILTERS.map(filter => {
          const isActive = active === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => onChange(filter.key)}
              aria-pressed={isActive}
              className={cn(
                "relative flex h-7 shrink-0 items-center gap-1.5 rounded-[9px] px-2 text-[10.5px] font-semibold transition-colors sm:px-2.5",
                isActive ? "text-brand" : "text-muted-foreground hover:text-foreground",
                filter.key === "pending" && counts.pending > 0 && !isActive && "text-foreground/80",
                filter.key === "attention" && counts.attention > 0 && !isActive && "text-attention",
              )}
            >
              {isActive ? <motion.span layoutId="chrona-filter-active" className="absolute inset-0 rounded-[9px] bg-brand-soft ring-1 ring-inset ring-brand/25" transition={{ type: "spring", stiffness: 460, damping: 34 }} /> : null}
              <span className="relative">{filter.label}</span>
              <span className={cn("tabular relative rounded-full px-1.5 py-px text-[9px] font-bold", isActive ? "bg-brand/15 text-brand" : "bg-foreground/[0.055] text-muted-foreground")}>{counts[filter.key]}</span>
            </button>
          );
        })}
      </div>

      {query ? (
        <button type="button" onClick={onClearQuery} className="ml-1 truncate rounded-full bg-brand-soft px-2 py-1 text-[9.5px] font-medium text-brand" title="Limpiar búsqueda" aria-label={`Limpiar búsqueda: ${query}`}>
          {query} <span aria-hidden="true">×</span>
        </button>
      ) : null}
      <span className="ml-auto hidden shrink-0 whitespace-nowrap pl-2 text-[9.5px] font-medium text-muted-foreground 2xl:inline">
        <span className="tabular font-semibold text-foreground/80">{visible}</span> / {total}
      </span>
    </div>
  );
}

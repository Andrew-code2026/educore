/** Vistas de la planilla: un único control segmentado para recortar el roster. */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ATTENTION_RULE_LABELS } from "../data/selectors";
import type { AttendanceFilter } from "../types";

interface FilterChipsProps {
  active: AttendanceFilter;
  counts: Record<AttendanceFilter, number>;
  onChange: (filter: AttendanceFilter) => void;
}

const FILTERS: Array<{ key: AttendanceFilter; label: string; hint?: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Por registrar" },
  { key: "absent", label: "Ausentes" },
  { key: "attention", label: "Con alertas", hint: `Señales: ${ATTENTION_RULE_LABELS.join(" · ")}` },
];

/** Filtros que solo aparecen cuando el host abre la planilla con ellos (`initialFilter`). */
const EXTRA_FILTER_LABELS: Partial<Record<AttendanceFilter, string>> = {
  late: "Tardanzas",
  excuse: "Excusas",
};

export function FilterChips({ active, counts, onChange }: FilterChipsProps) {
  const extraLabel = EXTRA_FILTER_LABELS[active];
  const filters = extraLabel ? [...FILTERS, { key: active, label: extraLabel }] : FILTERS;

  return (
    <div className="att-segmented" role="group" aria-label="Filtrar estudiantes">
      {filters.map(filter => {
        const isActive = active === filter.key;
        const count = counts[filter.key];
        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => onChange(filter.key)}
            aria-pressed={isActive}
            title={filter.hint}
            className={cn(
              "att-segmented-option",
              isActive && "is-active",
              filter.key === "attention" && count > 0 && "is-alert",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="att-segmented-active"
                className="att-segmented-thumb"
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              />
            ) : null}
            <span className="relative">{filter.label}</span>
            <span className="att-segmented-count tabular relative">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

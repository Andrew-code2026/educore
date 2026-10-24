import { cn } from "@/lib/utils";
import { ESTADO_META, type PlanillaEstado } from "./planillas";

export function PlanillaStatus({ estado, variant }: { estado: PlanillaEstado; variant: "pill" | "inline" }) {
  return (
    <span className={cn("gcl-status", `gcl-status--${variant}`)} data-estado={estado}>
      {ESTADO_META[estado].label}
    </span>
  );
}

export function PlanillaProgress({
  pct,
  estado,
  label,
  variant,
}: {
  pct: number;
  estado: PlanillaEstado;
  label: string;
  variant: "striped" | "flat";
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("gcl-progress", `gcl-progress--${variant}`)}
    >
      <div className="gcl-progress__fill" data-estado={estado} style={{ width: `${pct}%` }} />
    </div>
  );
}

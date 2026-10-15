import { Columns3, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { Density } from "../types";

const DENSITIES: { id: Density; label: string; hint: string }[] = [
  { id: "compact", label: "Densa", hint: "Máxima densidad: más evaluaciones en pantalla." },
  { id: "standard", label: "Estándar", hint: "Equilibrio entre densidad y legibilidad." },
  { id: "cozy", label: "Cómoda", hint: "Más aire para sesiones largas de calificación." },
];

export function DensitySwitcher({ className }: { className?: string }) {
  const { preferences, setDensity } = useGradeCenter();

  return (
    <div className={cn("glass flex items-center gap-0.5 rounded-2xl p-1", className)}>
      {DENSITIES.map((density) => {
        const active = preferences.density === density.id;
        return (
          <Tooltip key={density.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setDensity(density.id)}
                className={cn(
                  "rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150",
                  active
                    ? "border border-white/12 bg-white/10 text-foreground"
                    : "border border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {density.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{density.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function ColumnVisibilityMenu({ className }: { className?: string }) {
  const { dataset, preferences, toggleEvaluation, showAllEvaluations, resetAllPreferences } = useGradeCenter();
  const hidden = preferences.hiddenEvaluations.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 text-[11px] text-muted-foreground hover:bg-white/8 hover:text-foreground",
            className,
          )}
        >
          <Columns3 className="size-3.5" />
          <span className="hidden md:inline">Columnas</span>
          {hidden > 0 && (
            <span className="gc-num rounded-full bg-[var(--gc-cobalt)] px-1.5 py-px text-[10px] font-semibold text-white">
              {dataset.evaluations.length - hidden}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-strong w-72 rounded-2xl border-white/10 p-3">
        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="text-[12px] font-semibold">Columnas visibles</div>
            <div className="text-[10px] text-muted-foreground">
              {dataset.evaluations.length - hidden} de {dataset.evaluations.length} evaluaciones
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={showAllEvaluations}
          >
            Mostrar todas
          </Button>
        </div>
        <div className="gc-scroll max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {dataset.evaluations.map((evaluation) => {
            const visible = !preferences.hiddenEvaluations.includes(evaluation.id);
            return (
              <button
                key={evaluation.id}
                type="button"
                onClick={() => toggleEvaluation(evaluation.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/6"
              >
                <span className="gc-num w-8 shrink-0 text-[10px] text-muted-foreground">{evaluation.code}</span>
                <span className="min-w-0 flex-1 truncate text-[11px]">{evaluation.name}</span>
                <span className="gc-num shrink-0 text-[10px] text-muted-foreground">{evaluation.weight}%</span>
                {visible ? (
                  <Eye className="size-3.5 shrink-0 text-[var(--gc-cobalt)]" />
                ) : (
                  <EyeOff className="size-3.5 shrink-0 text-muted-foreground/60" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-white/8 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full rounded-lg text-[10px] text-muted-foreground hover:text-foreground"
            onClick={resetAllPreferences}
          >
            <RotateCcw className="size-3" />
            Restablecer preferencias
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

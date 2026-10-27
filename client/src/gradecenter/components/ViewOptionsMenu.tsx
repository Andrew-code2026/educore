import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { Density } from "../types";

const DENSITIES: { id: Density; label: string }[] = [
  { id: "compact", label: "Compacta" },
  { id: "standard", label: "Normal" },
  { id: "cozy", label: "Amplia" },
];

/**
 * Ajustes de presentación agrupados en un solo lugar: densidad, comportamiento
 * del clic y columnas visibles. Son decisiones de una vez, no de cada minuto,
 * por eso no ocupan espacio permanente en la barra.
 */
export function ViewOptionsMenu() {
  const {
    dataset,
    preferences,
    setDensity,
    setQuickEdit,
    toggleEvaluation,
    showAllEvaluations,
    resetAllPreferences,
    readOnly,
  } = useGradeCenter();
  const hidden = preferences.hiddenEvaluations.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-white/10 hover:text-foreground active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
            hidden > 0 &&
              "border-[var(--gc-cobalt)]/40 bg-[var(--gc-cobalt)]/12 text-foreground font-semibold"
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          <span>Ajustes</span>
          {hidden > 0 && (
            <span className="gc-num text-xs text-[var(--gc-cobalt)] font-semibold">
              {dataset.evaluations.length - hidden}/{dataset.evaluations.length}
            </span>
          )}
          <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="gc-popover w-72 rounded-2xl p-3">
        <Section title="Densidad">
          <div role="radiogroup" aria-label="Densidad de la planilla" className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
            {DENSITIES.map((density) => {
              const active = preferences.density === density.id;
              return (
                <button
                  key={density.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDensity(density.id)}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-medium transition-colors",
                    active ? "bg-white/12 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {density.label}
                </button>
              );
            })}
          </div>
        </Section>

        {!readOnly && (
          <Section title="Al hacer clic en una nota">
            <div role="radiogroup" aria-label="Comportamiento del clic" className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
              {[
                { id: false, label: "Abrir editor" },
                { id: true, label: "Editar en celda" },
              ].map((option) => {
                const active = preferences.quickEdit === option.id;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setQuickEdit(option.id)}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-medium transition-colors",
                      active ? "bg-white/12 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section
          title="Columnas"
          action={
            hidden > 0 ? (
              <button type="button" onClick={showAllEvaluations} className="text-xs text-[var(--gc-cobalt)] hover:underline">
                Mostrar todas
              </button>
            ) : undefined
          }
        >
          {dataset.evaluations.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay evaluaciones.</p>
          ) : (
            <ul className="gc-scroll max-h-56 space-y-0.5 overflow-y-auto">
              {dataset.evaluations.map((evaluation) => {
                const visible = !preferences.hiddenEvaluations.includes(evaluation.id);
                return (
                  <li key={evaluation.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/6">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleEvaluation(evaluation.id)}
                        className="size-3.5 accent-[var(--gc-cobalt)]"
                      />
                      <span className="gc-num w-7 shrink-0 text-xs text-muted-foreground">{evaluation.code}</span>
                      <span className="min-w-0 flex-1 truncate text-xs">{evaluation.name}</span>
                      <span className="gc-num shrink-0 text-xs text-muted-foreground">{evaluation.weight}%</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <button
          type="button"
          onClick={resetAllPreferences}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Restablecer vista
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

import { BarChart3, GraduationCap, LayoutGrid, Target, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { ViewId } from "../types";

interface ViewOption {
  id: ViewId;
  label: string;
  description: string;
  icon: typeof LayoutGrid;
}

export const VIEW_OPTIONS: ViewOption[] = [
  { id: "standard", label: "Estándar", description: "Registro de notas por estudiante y evaluación.", icon: LayoutGrid },
  { id: "student", label: "Estudiante", description: "Información individual y evolución del estudiante.", icon: User },
  { id: "evaluations", label: "Evaluac.", description: "Comparación entre actividades y evaluaciones.", icon: BarChart3 },
  { id: "performance", label: "Desemp.", description: "Resultados, niveles y tendencias del grupo.", icon: Target },
  { id: "dba", label: "DBA", description: "Evidencias y logro de los Derechos Básicos de Aprendizaje.", icon: GraduationCap },
];

/** Pestañas de vista con estética de cápsula líquida: mismas notas, distintas lecturas. */
export function ViewSwitcher({ className }: { className?: string }) {
  const { preferences, setView, dataset } = useGradeCenter();
  // DBA solo aparece cuando la planilla tiene DBA cargados.
  const hasDba = dataset.dba.length > 0;
  const options = hasDba ? VIEW_OPTIONS : VIEW_OPTIONS.filter((option) => option.id !== "dba");
  const current =
    preferences.view === "compact" || (preferences.view === "dba" && !hasDba) ? "standard" : preferences.view;

  // Patrón de pestañas: flechas para moverse, Inicio/Fin a los extremos.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((option) => option.id === current);
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" ? (index + 1) % options.length
      : event.key === "ArrowLeft" ? (index - 1 + options.length) % options.length
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    const list = event.currentTarget;
    setView(options[next].id);
    requestAnimationFrame(() => {
      list.querySelector<HTMLElement>(`[data-view="${options[next].id}"]`)?.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Vista de la planilla"
      onKeyDown={onKeyDown}
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      {options.map((option) => {
        const active = current === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            data-view={option.id}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={option.description}
            onClick={() => setView(option.id)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
              active
                ? "border border-white/12 bg-white/12 text-foreground font-semibold shadow-inner"
                : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

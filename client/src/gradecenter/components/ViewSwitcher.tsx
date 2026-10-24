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
  { id: "standard", label: "Planilla", description: "Registro de notas por estudiante y evaluación.", icon: LayoutGrid },
  { id: "student", label: "Estudiante", description: "Información individual y evolución del estudiante.", icon: User },
  { id: "evaluations", label: "Evaluaciones", description: "Comparación entre actividades y evaluaciones.", icon: BarChart3 },
  { id: "performance", label: "Desempeño", description: "Resultados, niveles y tendencias del grupo.", icon: Target },
  { id: "dba", label: "DBA", description: "Evidencias y logro de los Derechos Básicos de Aprendizaje.", icon: GraduationCap },
];

/** Pestañas de vista: mismas notas, distintas lecturas. */
export function ViewSwitcher({ className }: { className?: string }) {
  const { preferences, setView, dataset } = useGradeCenter();
  // DBA solo aparece cuando la planilla tiene DBA cargados; hoy no hay dónde crearlos.
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
    // React anula currentTarget al terminar el evento: se guarda antes del frame.
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
      className={cn("flex shrink-0 items-center gap-0.5 rounded-lg bg-foreground/[0.05] p-0.5", className)}
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
              "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
              active
                ? "bg-[var(--gc-ink)] text-foreground shadow-sm ring-1 ring-[var(--gc-hair)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className={cn(!active && "hidden @5xl:inline")}>{option.label}</span>
            {!active && <span className="sr-only @5xl:hidden">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

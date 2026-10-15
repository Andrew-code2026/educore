import { motion } from "framer-motion";
import { BarChart3, GraduationCap, LayoutGrid, Target, User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { ViewId } from "../types";

interface ViewOption {
  id: ViewId;
  label: string;
  short: string;
  description: string;
  icon: typeof LayoutGrid;
}

export const VIEW_OPTIONS: ViewOption[] = [
  {
    id: "standard",
    label: "Estándar",
    short: "Estándar",
    description: "Equilibrio entre información y legibilidad.",
    icon: LayoutGrid,
  },
  {
    id: "student",
    label: "Estudiante",
    short: "Estudiante",
    description: "Información individual y evolución del estudiante.",
    icon: User,
  },
  {
    id: "evaluations",
    label: "Evaluaciones",
    short: "Evaluac.",
    description: "Comparación entre actividades y evaluaciones.",
    icon: BarChart3,
  },
  {
    id: "performance",
    label: "Desempeño",
    short: "Desemp.",
    description: "Resultados, niveles y tendencias del grupo.",
    icon: Target,
  },
  {
    id: "dba",
    label: "DBA",
    short: "DBA",
    description: "Evidencias y logro de los Derechos Básicos de Aprendizaje.",
    icon: GraduationCap,
  },
];

export function ViewSwitcher({ className }: { className?: string }) {
  const { preferences, setView } = useGradeCenter();

  return (
    <div
      className={cn(
        "glass relative flex items-center gap-0.5 rounded-2xl p-1",
        className,
      )}
      role="tablist"
      aria-label="Formas de ver los mismos datos"
    >
      {VIEW_OPTIONS.map((option) => {
        const active = preferences.view === option.id;
        const Icon = option.icon;
        return (
          <Tooltip key={option.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(option.id)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="view-switcher-indicator"
                    className="absolute inset-0 rounded-xl border border-white/12 bg-white/10 shadow-[inset_0_1px_0_0_oklch(1_0_0/12%),0_10px_24px_-14px_oklch(0_0_0/90%)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative size-3.5" />
                <span className="relative hidden lg:inline">{option.short}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56">
              <div className="text-[11px] font-semibold">{option.label}</div>
              <div className="text-[10px] opacity-80">{option.description}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

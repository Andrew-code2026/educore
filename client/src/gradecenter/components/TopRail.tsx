import { useState } from "react";
import { Activity, ArrowLeft, ChevronDown, GraduationCap, HelpCircle, Maximize2, Menu, Minimize2, Moon, Search, Sparkles, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { SyncStatus } from "./SyncStatus";
import { useGradeCenter } from "../state/GradeCenterContext";

export function TopRail({
  onOpenHelp,
  onToggleSidebar,
  onOpenLanding,
  onBack,
}: {
  onOpenHelp: () => void;
  onToggleSidebar: () => void;
  onOpenLanding?: () => void;
  onBack?: () => void;
}) {
  const {
    dataset,
    preferences,
    analytics,
    students,
    setFilters,
    setFocusMode,
    setAnalysisOpen,
    availableAssignments,
    onSelectAssignment,
  } = useGradeCenter();

  const [searchOpen, setSearchOpen] = useState(false);
  const focus = preferences.focusMode;
  const { theme, toggleTheme } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (onOpenLanding) {
      onOpenLanding();
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <header
      className={cn(
        "glass-strong prism-sheen relative z-40 flex shrink-0 items-center gap-3 border-b border-white/8 px-3 transition-[height,padding] duration-300",
        focus ? "h-12" : "h-15 py-2",
      )}
    >
      {!focus && (
        <button
          type="button"
          aria-label="Abrir navegación de EduCore"
          onClick={onToggleSidebar}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground lg:hidden"
        >
          <Menu className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={handleBack}
        className="group flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-white/15 hover:bg-white/8 hover:text-foreground active:scale-95 shrink-0"
        title="Volver"
        aria-label="Volver"
      >
        <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
        <span>Volver</span>
      </button>

      <div className="hidden h-7 w-px shrink-0 bg-white/10 md:block" />

      {/* Grupo y experimentación con la cantidad de evaluaciones */}
      <div className="hidden shrink-0 md:block">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-white/4 text-left transition-colors hover:bg-white/8",
                focus ? "px-2 py-1" : "px-2.5 py-1.5",
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg bg-[var(--gc-cobalt)]/18 text-[var(--gc-cobalt)]",
                  focus ? "size-6" : "size-7",
                )}
              >
                <GraduationCap className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className={cn("truncate font-semibold", focus ? "text-[12px]" : "text-[12.5px]")}>
                    {dataset.course}
                  </span>
                  <span className="gc-num text-[10px] text-muted-foreground">{students.length} est.</span>
                </span>
                {!focus && (
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">{dataset.subject}</span>
                    <span className="opacity-50">·</span>
                    <span className="gc-num">{dataset.evaluations.length} evaluaciones</span>
                  </span>
                )}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="glass-strong w-72 rounded-2xl border-white/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold">{dataset.course}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {dataset.subject} · {students.length} estudiantes
                </div>
              </div>
              <span className="gc-num rounded-lg bg-[var(--gc-cobalt)]/12 px-1.5 py-1 text-[10px] text-[var(--gc-cobalt)]">
                {dataset.evaluations.length} eval.
              </span>
            </div>

            {availableAssignments && availableAssignments.length > 1 ? (
              <div className="mt-3 border-t border-white/8 pt-2">
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                  Planillas asignadas:
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableAssignments.map((a) => {
                    const isCurrent = a.id === dataset.key || a.sourceDatasetKey === dataset.key;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          if (!isCurrent && onSelectAssignment) {
                            onSelectAssignment(a.id);
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-lg px-2 py-1.5 text-[11px] transition-colors flex items-center justify-between",
                          isCurrent
                            ? "bg-[var(--gc-cobalt)]/20 text-white font-medium border border-[var(--gc-cobalt)]/30"
                            : "hover:bg-white/8 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium">{a.dataset.course} · {a.dataset.subject}</div>
                          <div className="text-[9.5px] opacity-70 truncate">{a.dataset.period}</div>
                        </div>
                        <span className="gc-num text-[9.5px] shrink-0 opacity-80">{a.dataset.students.length || ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-[var(--gc-cobalt)]/20 bg-[var(--gc-cobalt)]/8 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                Planilla académica activa de EduCore.
              </div>
            )}

            {onOpenLanding && (
              <button
                type="button"
                onClick={onOpenLanding}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-white/8 hover:text-foreground transition-colors"
              >
                Mis planillas
              </button>
            )}

            <details className="mt-3 border-t border-white/8 pt-2">
              <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                Ver estado del grupo
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                <Stat label="Promedio" value={analytics.group.average?.toFixed(1) ?? "—"} />
                <Stat label="Al día" value={`${analytics.group.completePct}%`} />
                <Stat label="Pendientes" value={String(analytics.group.totalPending)} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Activity className="size-3" />
                {analytics.group.approvalPct}% de aprobación
              </div>
            </details>
          </PopoverContent>
          </Popover>
        </div>

      {/* Búsqueda */}
      <div className={cn("relative min-w-[200px] flex-1", focus ? "max-w-[280px]" : "max-w-[540px] lg:max-w-[640px] xl:max-w-[760px]")}>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={preferences.filters.query}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          onChange={(event) => setFilters({ ...preferences.filters, query: event.target.value })}
          placeholder="Buscar estudiante…"
          aria-label="Buscar estudiante por nombre o código"
          className={cn(
            "w-full rounded-xl border border-white/8 bg-white/4 py-1.5 pr-2.5 pl-8 text-[12px] outline-none transition-all placeholder:text-muted-foreground/70",
            searchOpen && "border-[var(--gc-cobalt)]/60 bg-white/8",
          )}
        />
      </div>

      {/* Acciones pegadas a la derecha */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <SyncStatus />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toggleTheme?.()}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-all hover:bg-white/8 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAnalysisOpen(!preferences.analysisOpen)}
              aria-pressed={preferences.analysisOpen}
              className={cn(
                "hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all md:flex",
                preferences.analysisOpen
                  ? "border-[var(--gc-cobalt)]/50 bg-[var(--gc-cobalt)]/16 text-foreground"
                  : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
              )}
            >
              <Sparkles className="size-3.5" />
              <span className="hidden xl:inline">Análisis</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Análisis contextual del grupo, la evaluación o el estudiante</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setFocusMode(!focus)}
              aria-pressed={focus}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                focus
                  ? "border-[var(--gc-cobalt)]/60 bg-[var(--gc-cobalt)]/20 text-foreground font-semibold shadow-xs"
                  : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
              )}
            >
              {focus ? <Minimize2 className="size-3.5 text-[var(--gc-cobalt)]" /> : <Maximize2 className="size-3.5" />}
              <span className="hidden sm:inline">{focus ? "Salir de enfoque" : "Enfoque"}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {focus ? "Salir de modo enfoque" : "Modo enfoque: la matriz ocupa la pantalla"} (<span className="gc-num">Esc</span>)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenHelp}
              className="hidden size-8 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground md:flex"
              aria-label="Atajos de teclado"
            >
              <HelpCircle className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Atajos de teclado</TooltipContent>
        </Tooltip>

        {!focus && (
          <div className="ml-1 hidden items-center gap-2 rounded-xl border border-white/8 bg-white/4 py-1 pr-2.5 pl-1 md:flex">
            <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.72_0.15_266)] to-[oklch(0.62_0.17_300)] text-[10px] font-semibold text-white">
              {dataset.teacher.initials}
            </span>
            <span className="hidden leading-tight 2xl:block">
              <span className="block text-[11px] font-medium">{dataset.teacher.name}</span>
              <span className="block text-[9.5px] text-muted-foreground">{dataset.teacher.role}</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-2 py-1.5">
      <div className="text-[9px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="gc-num mt-0.5 text-[12px] font-semibold">{value}</div>
    </div>
  );
}

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Clock,
  Filter,
  SlidersHorizontal,
  Sparkles,
  PenLine,
  Zap,
  X,
  ClipboardPlus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ViewSwitcher } from "./ViewSwitcher";
import { ColumnVisibilityMenu, DensitySwitcher } from "./DensitySwitcher";
import { useGradeCenter } from "../state/GradeCenterContext";
import { activeFilterChips, hasActiveFilters } from "../domain/selectors";
import { LEVELS } from "../domain/scale";
import type { LevelId, SortKey } from "../types";
import { BulkGradeDialog } from "./BulkGradeDialog";
import { NewEvaluationDialog } from "./NewEvaluationDialog";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "definitiva", label: "Definitiva" },
  { key: "performance", label: "Desempeño" },
  { key: "pending", label: "Pendientes" },
  { key: "attention", label: "Atención" },
];

/**
 * Franja de control: vistas, densidad, columnas, orden y filtros.
 * Todo se pliega en modo enfoque para dejar la matriz a pantalla completa.
 */
export function ControlStrip() {
  const { preferences, students, dataset, setSort, setFilters, setDensity, setView, setQuickEdit, analytics, weightIntegrity, selectedRows, activeCell, evaluations } =
    useGradeCenter();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newEvaluationOpen, setNewEvaluationOpen] = useState(false);

  const focus = preferences.focusMode;
  const filters = preferences.filters;
  const chips = activeFilterChips(filters, dataset);
  const sortOption = SORT_OPTIONS.find((option) => option.key === preferences.sort.key) ?? SORT_OPTIONS[0];

  const toggleLevel = (level: LevelId) => {
    const next = filters.levels.includes(level)
      ? filters.levels.filter((item) => item !== level)
      : [...filters.levels, level];
    setFilters({ ...filters, levels: next });
  };

  return (
    <div
      className={cn(
        "relative z-30 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/6 px-3 transition-all duration-300",
        focus ? "py-1.5" : "py-2",
      )}
    >
      <ViewSwitcher />

      <DensitySwitcher />

      <WeightStatus integrity={weightIntegrity} />

      <button
        type="button"
        onClick={() => setNewEvaluationOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--gc-cobalt)]/45 bg-[var(--gc-cobalt)]/18 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--gc-cobalt)]/28"
      >
        <ClipboardPlus className="size-3.5 text-[var(--gc-cobalt)]" />
        <span className="hidden sm:inline">Nueva evaluación</span>
      </button>

      <button
        type="button"
        onClick={() => setBulkOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/12 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--gc-cobalt)]/20"
      >
        <PenLine className="size-3.5 text-[var(--gc-cobalt)]" />
        <span className="hidden sm:inline">Calificación masiva</span>
        {selectedRows.length > 0 && <span className="gc-num rounded-full bg-[var(--gc-cobalt)]/25 px-1.5 text-xs">{selectedRows.length}</span>}
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-pressed={preferences.quickEdit}
            onClick={() => setQuickEdit(!preferences.quickEdit)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              preferences.quickEdit
                ? "border-[var(--gc-cobalt)]/55 bg-[var(--gc-cobalt)]/18 text-foreground"
                : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
            )}
          >
            <Zap className={cn("size-3.5", preferences.quickEdit && "text-[var(--gc-cobalt)]")} />
            <span className="hidden sm:inline">Edición rápida</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64">
          {preferences.quickEdit
            ? "Activo: un clic en una celda abre la edición inline. Enter baja y Tab avanza."
            : "Activa el modo rápido para editar una celda con un solo clic."}
        </TooltipContent>
      </Tooltip>

      <ColumnVisibilityMenu />

      <div className="mx-0.5 hidden h-6 w-px bg-white/8 md:block" />

      {/* Ordenamiento */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          >
            <ArrowDownUp className="size-3.5" />
            <span className="hidden md:inline">Ordenar:</span>
            <span className="text-foreground">{sortOption.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="glass-strong w-52 rounded-2xl border-white/10 p-1.5">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort({ key: option.key, dir: option.key === "name" ? "asc" : "desc" })}
              className={cn(
                "flex w-full rounded-xl px-2.5 py-2 text-left text-[12px] transition-colors",
                preferences.sort.key === option.key ? "bg-[var(--gc-cobalt)]/16" : "hover:bg-white/6",
              )}
            >
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-white/8 px-1 pt-2">
            <span className="text-xs text-muted-foreground">Dirección</span>
            <button
              type="button"
              onClick={() =>
                setSort({ ...preferences.sort, dir: preferences.sort.dir === "asc" ? "desc" : "asc" })
              }
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium hover:bg-white/10"
            >
              {preferences.sort.dir === "asc" ? "Ascendente ↑" : "Descendente ↓"}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Filtros */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
              hasActiveFilters(filters)
                ? "border-[var(--gc-cobalt)]/50 bg-[var(--gc-cobalt)]/14 text-foreground"
                : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
            )}
          >
            <Filter className="size-3.5" />
            <span className="hidden md:inline">Filtros</span>
            {hasActiveFilters(filters) && (
              <span className="gc-num rounded-full bg-[var(--gc-cobalt)] px-1.5 text-xs text-white">
                {chips.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="glass-strong w-64 rounded-2xl border-white/10 p-2.5">
          <div className="gc-label mb-2 text-xs">Nivel académico</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["superior", "alto", "basico", "bajo"] as LevelId[]).map((level) => {
              const active = filters.levels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs transition-all",
                    active ? "border-transparent" : "border-white/8 bg-white/4 hover:bg-white/8",
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: `color-mix(in oklab, ${LEVELS[level].color} 18%, transparent)`,
                          borderColor: `color-mix(in oklab, ${LEVELS[level].color} 45%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: LEVELS[level].color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{LEVELS[level].label}</span>
                    <span className="gc-num block text-xs text-muted-foreground">
                      {LEVELS[level].range}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="gc-label mt-3 mb-2 text-xs">Situaciones del grupo</div>
          <div className="space-y-1">
            <FilterToggle
              icon={<Clock className="size-3.5" />}
              label="Con evaluaciones pendientes"
              count={analytics.group.pending.length}
              active={filters.onlyPending}
              onClick={() => setFilters({ ...filters, onlyPending: !filters.onlyPending })}
            />
            <FilterToggle
              icon={<AlertTriangle className="size-3.5" />}
              label="Requiere atención"
              count={analytics.group.attention.length}
              active={filters.onlyAttention}
              onClick={() => setFilters({ ...filters, onlyAttention: !filters.onlyAttention })}
              tone="var(--gc-bajo)"
            />
            <FilterToggle
              icon={<CheckCircle2 className="size-3.5" />}
              label="100 % evaluado"
              count={analytics.students.filter((s) => s.complete).length}
              active={filters.onlyComplete}
              onClick={() => setFilters({ ...filters, onlyComplete: !filters.onlyComplete })}
              tone="var(--gc-alto)"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters({
                query: "",
                levels: [],
                onlyPending: false,
                onlyAttention: false,
                onlyComplete: false,
                evaluationId: null,
                evaluationState: null,
              })
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          >
            Limpiar todos los filtros
          </button>
        </PopoverContent>
      </Popover>

      {/* Chips de filtros activos: siempre visibles y fáciles de quitar */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span key={chip.id} className="gc-chip gc-pop px-2 py-1 text-xs text-foreground/90">
              {chip.label}
              <button
                type="button"
                aria-label={`Quitar filtro ${chip.label}`}
                onClick={() => setFilters(chip.clear(filters))}
                className="flex size-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() =>
              setFilters({
                query: "",
                levels: [],
                onlyPending: false,
                onlyAttention: false,
                onlyComplete: false,
                evaluationId: null,
                evaluationState: null,
              })
            }
            className="text-xs text-muted-foreground underline decoration-dotted transition-colors hover:text-foreground"
          >
            Limpiar
          </button>
        </div>
      )}

      <div className="flex-1" />

      {!focus && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3" />
          <span className="gc-num">
            <span className="font-semibold text-foreground">{students.length}</span> de{" "}
            {analytics.students.length} estudiantes
          </span>
          <span className="opacity-40">·</span>
          <span className="gc-num">{dataset.evaluations.length} evaluaciones</span>
          {analytics.group.totalPending > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="gc-num text-[var(--gc-bajo)]">
                {analytics.group.totalPending} pendientes
              </span>
            </>
          )}
        </div>
      )}

      {focus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setView("standard")}
              className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <Sparkles className="size-3.5" />
              <span className="gc-num">{students.length}</span> estudiantes
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Volver a la vista estándar y salir del enfoque</TooltipContent>
        </Tooltip>
      )}

      <BulkGradeDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        initialEvaluationId={evaluations[activeCell.col]?.id}
      />
      <NewEvaluationDialog open={newEvaluationOpen} onOpenChange={setNewEvaluationOpen} />
    </div>
  );
}

function FilterToggle({
  icon,
  label,
  count,
  active,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-all",
        active ? "border-[var(--gc-cobalt)]/60 bg-[var(--gc-cobalt)]/16" : "border-white/8 bg-white/4 hover:bg-white/8",
      )}
      style={active && tone ? { borderColor: `color-mix(in oklab, ${tone} 55%, transparent)` } : undefined}
    >
      <span style={{ color: tone }}>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="gc-num text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function WeightStatus({ integrity }: { integrity: { used: number; remaining: number; status: "valid" | "incomplete" | "exceeded" } }) {
  const exceeded = integrity.status === "exceeded";
  const valid = integrity.status === "valid";
  const color = exceeded ? "var(--gc-bajo)" : valid ? "var(--gc-alto)" : "var(--gc-basico)";
  const label = exceeded ? "Excedida" : valid ? "Válida" : "Incompleta";
  return (
    <div className="hidden items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-xs md:flex" title={`Ponderación usada ${integrity.used}%. Restante ${integrity.remaining}%.`}>
      {exceeded ? <AlertTriangle className="size-3" style={{ color }} /> : valid ? <CheckCircle2 className="size-3" style={{ color }} /> : <Clock className="size-3" style={{ color }} />}
      <span className="text-muted-foreground">Peso</span>
      <span className="gc-num font-semibold" style={{ color }}>{integrity.used}%</span>
      <span className="text-muted-foreground">·</span>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

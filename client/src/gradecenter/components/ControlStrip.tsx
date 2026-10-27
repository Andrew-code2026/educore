import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardPlus,
  Columns3,
  Eye,
  EyeOff,
  Filter,
  PenLine,
  RotateCcw,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewSwitcher } from "./ViewSwitcher";
import { useGradeCenter } from "../state/GradeCenterContext";
import { activeFilterChips, EMPTY_FILTERS } from "../domain/selectors";
import { LEVELS } from "../domain/scale";
import type { Density, LevelId, SortKey } from "../types";
import { useGradeCenterDialogs } from "./dialogs/DialogsProvider";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "definitiva", label: "Definitiva" },
  { key: "pending", label: "Pendientes" },
  { key: "attention", label: "Atención" },
  { key: "performance", label: "Desempeño" },
];

const DENSITIES: { id: Density; label: string; hint: string }[] = [
  { id: "compact", label: "Densa", hint: "Máxima densidad: más evaluaciones en pantalla." },
  { id: "standard", label: "Estándar", hint: "Equilibrio entre densidad y legibilidad." },
  { id: "cozy", label: "Cómoda", hint: "Más aire para sesiones largas de calificación." },
];

const LEVEL_FILTERS: LevelId[] = ["superior", "alto", "basico", "bajo"];

/**
 * Franja de comando unificada en una sola fila minimalista y ultra-eficiente.
 *
 * - Izquierda: Pestañas de vista en su posición original, densidad y herramientas de tabla (Columnas, Ordenar, Filtros).
 * - Derecha: Estado de ponderación y botones de acción principales.
 *
 * Cero saltos de línea desordenados, mínima ocupación vertical (h-11).
 */
export function ControlStrip() {
  const {
    preferences,
    dataset,
    weightIntegrity,
    selectedRows,
    readOnly,
    setSort,
    setFilters,
    setDensity,
    toggleEvaluation,
    showAllEvaluations,
    resetAllPreferences,
  } = useGradeCenter();
  const dialogs = useGradeCenterDialogs();

  const filters = preferences.filters;
  const chips = activeFilterChips(filters, dataset).filter((chip) => chip.id !== "query");
  const isMatrix = preferences.view === "standard" || preferences.view === "compact";
  const listsStudents = isMatrix || preferences.view === "student";
  const sortLabel = SORT_OPTIONS.find((option) => option.key === preferences.sort.key)?.label ?? "Nombre";
  const hiddenCount = preferences.hiddenEvaluations.length;

  const toggleLevel = (level: LevelId) => {
    const levels = filters.levels.includes(level)
      ? filters.levels.filter((item) => item !== level)
      : [...filters.levels, level];
    setFilters({ ...filters, levels });
  };

  return (
    <div className="relative z-30 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--gc-hair)] bg-[var(--gc-chrome)] px-3 overflow-x-auto no-scrollbar">
      {/* ─── ZONA IZQUIERDA: Pestañas en su lugar + Herramientas de Visualización ─── */}
      <div className="flex items-center gap-2 shrink-0">
        <ViewSwitcher />

        <span className="h-4 w-px bg-[var(--gc-hair)] shrink-0" aria-hidden />

        {/* Selector de Densidad */}
        <div
          role="radiogroup"
          aria-label="Densidad de la planilla"
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5 shadow-sm"
        >
          {DENSITIES.map((density) => {
            const active = preferences.density === density.id;
            return (
              <button
                key={density.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={density.hint}
                onClick={() => setDensity(density.id)}
                className={cn(
                  "flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
                  active
                    ? "border border-white/12 bg-white/12 text-foreground font-semibold shadow-inner"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
                )}
              >
                {density.label}
              </button>
            );
          })}
        </div>

        {/* Columnas Visibles */}
        {isMatrix && dataset.evaluations.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
                  hiddenCount > 0
                    ? "border-[var(--gc-cobalt)]/40 bg-[var(--gc-cobalt)]/12 text-foreground font-semibold"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10",
                )}
              >
                <Columns3 className="size-3 opacity-70" aria-hidden />
                <span>Columnas</span>
                {hiddenCount > 0 && (
                  <span className="gc-num rounded-full bg-[var(--gc-cobalt)] text-white px-1.5 text-[9px] font-semibold">
                    {dataset.evaluations.length - hiddenCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="gc-popover w-72 rounded-2xl p-3 border-white/10 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--gc-hair)]">
                <div>
                  <div className="text-xs font-semibold">Columnas visibles</div>
                  <div className="text-[10px] text-muted-foreground">
                    {dataset.evaluations.length - hiddenCount} de {dataset.evaluations.length} evaluaciones
                  </div>
                </div>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={showAllEvaluations}
                    className="text-[11px] font-medium text-[var(--gc-cobalt)] hover:underline"
                  >
                    Mostrar todas
                  </button>
                )}
              </div>
              <div className="gc-scroll max-h-64 space-y-0.5 overflow-y-auto py-2">
                {dataset.evaluations.map((evaluation) => {
                  const visible = !preferences.hiddenEvaluations.includes(evaluation.id);
                  return (
                    <button
                      key={evaluation.id}
                      type="button"
                      onClick={() => toggleEvaluation(evaluation.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/6"
                    >
                      <span className="gc-num w-8 shrink-0 text-[10px] text-muted-foreground">{evaluation.code}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{evaluation.name}</span>
                      <span className="gc-num shrink-0 text-[10px] text-muted-foreground">{evaluation.weight}%</span>
                      {visible ? (
                        <Eye className="size-3.5 shrink-0 text-[var(--gc-cobalt)]" />
                      ) : (
                        <EyeOff className="size-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-[var(--gc-hair)] pt-2">
                <button
                  type="button"
                  onClick={resetAllPreferences}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  Restablecer columnas
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Menú Ordenar */}
        {listsStudents && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
              >
                <ArrowDownUp className="size-3 opacity-70" aria-hidden />
                <span>
                  Ordenar: <strong className="font-semibold text-foreground">{sortLabel}</strong>
                </span>
                <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="gc-popover w-52 rounded-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Ordenar por</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={preferences.sort.key}
                onValueChange={(key) =>
                  setSort({
                    key: key as SortKey,
                    dir: key === "name" ? "asc" : "desc",
                  })
                }
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.key} value={option.key} className="text-sm">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={preferences.sort.dir}
                onValueChange={(dir) => setSort({ ...preferences.sort, dir: dir as "asc" | "desc" })}
              >
                <DropdownMenuRadioItem value="asc" className="text-sm">
                  Ascendente
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc" className="text-sm">
                  Descendente
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Menú Filtros */}
        {listsStudents && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
                  chips.length > 0
                    ? "border-[var(--gc-cobalt)]/50 bg-[var(--gc-cobalt)]/18 text-foreground font-semibold shadow-sm"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10",
                )}
              >
                <Filter className="size-3 opacity-70" aria-hidden />
                <span>Filtros</span>
                {chips.length > 0 && (
                  <span className="gc-num rounded-full bg-[var(--gc-cobalt)] px-1.5 text-[9px] font-semibold text-white">
                    {chips.length}
                  </span>
                )}
                <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="gc-popover w-64 rounded-2xl p-3 border-white/10 shadow-2xl backdrop-blur-xl">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Nivel de la definitiva</div>
              <div className="grid grid-cols-2 gap-1">
                {LEVEL_FILTERS.map((level) => (
                  <FilterOption
                    key={level}
                    active={filters.levels.includes(level)}
                    onClick={() => toggleLevel(level)}
                    label={LEVELS[level].short}
                    detail={LEVELS[level].range}
                    dot={LEVELS[level].color}
                  />
                ))}
              </div>

              <div className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">Situación</div>
              <div className="space-y-1">
                <FilterOption
                  active={filters.onlyPending}
                  onClick={() => setFilters({ ...filters, onlyPending: !filters.onlyPending })}
                  label="Con notas pendientes"
                />
                <FilterOption
                  active={filters.onlyAttention}
                  onClick={() => setFilters({ ...filters, onlyAttention: !filters.onlyAttention })}
                  label="Requieren atención"
                />
                <FilterOption
                  active={filters.onlyComplete}
                  onClick={() => setFilters({ ...filters, onlyComplete: !filters.onlyComplete })}
                  label="Todo calificado"
                />
              </div>

              {chips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}
                  className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
                >
                  Quitar filtros
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Chips de filtros activos */}
        {listsStudents && chips.length > 0 && (
          <div className="flex min-w-0 items-center gap-1">
            {chips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/10 px-2 py-0.5 text-[11px] text-foreground/90 font-medium shrink-0"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Quitar filtro ${chip.label}`}
                  onClick={() => setFilters(chip.clear(filters))}
                  className="flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:bg-white/20 hover:text-foreground transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── ZONA DERECHA: Validación de Ponderación + Acciones Principales ─── */}
      <div className="flex items-center gap-2 shrink-0">
        {dataset.evaluations.length > 0 && <WeightBadge integrity={weightIntegrity} />}

        {!readOnly && (
          <>
            <button
              type="button"
              onClick={dialogs.openNewEvaluation}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[var(--gc-cobalt)]/40 bg-[var(--gc-cobalt)]/20 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--gc-cobalt)]/30 hover:border-[var(--gc-cobalt)]/60 shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
            >
              <ClipboardPlus className="size-3.5 text-[var(--gc-cobalt)]" aria-hidden />
              <span>Nueva evaluación</span>
            </button>

            {isMatrix && dataset.evaluations.length > 0 && (
              <button
                type="button"
                onClick={() => dialogs.openBulkGrade()}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-white/10 hover:border-white/20 shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
              >
                <PenLine className="size-3.5 opacity-80" aria-hidden />
                <span>Calificación masiva</span>
                {selectedRows.length > 0 && (
                  <span className="gc-num rounded-full bg-[var(--gc-cobalt)]/30 px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                    {selectedRows.length}
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Píldora de validación de ponderación */
function WeightBadge({
  integrity,
}: {
  integrity: { used: number; remaining: number; status: "valid" | "incomplete" | "exceeded" };
}) {
  if (integrity.status === "valid") {
    return (
      <div
        className="flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shadow-sm"
        title="La suma de ponderaciones de las evaluaciones es exactamente 100%."
      >
        <CheckCircle2 className="size-3 shrink-0" aria-hidden />
        <span>Peso 100% · Válida</span>
      </div>
    );
  }

  if (integrity.status === "exceeded") {
    return (
      <div
        className="flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 shadow-sm"
        title={`Ponderación ${integrity.used}% (supera 100%). Debe ajustar las evaluaciones para que sumen 100%.`}
      >
        <AlertTriangle className="size-3 shrink-0" aria-hidden />
        <span>Peso {integrity.used}% · Supera 100%</span>
      </div>
    );
  }

  return (
    <div
      className="flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 shadow-sm"
      title={`Ponderación ${integrity.used}%. Faltan ${integrity.remaining}% para completar el 100%.`}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      <span>Peso {integrity.used}% · Faltan {integrity.remaining}%</span>
    </div>
  );
}

function FilterOption({
  active,
  onClick,
  label,
  detail,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  detail?: string;
  dot?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
        active ? "border-[var(--gc-cobalt)]/50 bg-[var(--gc-cobalt)]/12" : "border-transparent hover:bg-white/6",
      )}
    >
      {dot ? (
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
      ) : (
        <span
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded border",
            active ? "border-[var(--gc-cobalt)] bg-[var(--gc-cobalt)] text-white" : "border-white/25",
          )}
          aria-hidden
        >
          {active && <Check className="size-2.5" />}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {detail && <span className="gc-num shrink-0 text-muted-foreground">{detail}</span>}
    </button>
  );
}

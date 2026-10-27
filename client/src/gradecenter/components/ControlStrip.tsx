import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  ChevronDown,
  ClipboardPlus,
  Filter,
  PenLine,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { ViewOptionsMenu } from "./ViewOptionsMenu";
import { useGradeCenter } from "../state/GradeCenterContext";
import { activeFilterChips, EMPTY_FILTERS } from "../domain/selectors";
import { LEVELS } from "../domain/scale";
import type { LevelId, SortKey } from "../types";
import { useGradeCenterDialogs } from "./dialogs/DialogsProvider";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "definitiva", label: "Definitiva" },
  { key: "pending", label: "Pendientes" },
  { key: "attention", label: "Atención" },
  { key: "performance", label: "Desempeño" },
];

const LEVEL_FILTERS: LevelId[] = ["superior", "alto", "basico", "bajo"];

/**
 * Franja de comando institucional y ultra-profesional.
 *
 * Basada en la arquitectura de Grade Center y GitHub:
 *  - Fila única sin scroll horizontal (usa container queries responsivas).
 *  - Pestañas de vista fijas en su posición natural a la izquierda.
 *  - Ajustes de mesa agrupados (Densidad, Clic y Columnas en ViewOptionsMenu).
 *  - Acciones principales ancladas a la derecha.
 */
export function ControlStrip() {
  const {
    preferences,
    students,
    dataset,
    analytics,
    weightIntegrity,
    selectedRows,
    readOnly,
    setSort,
    setFilters,
  } = useGradeCenter();
  const dialogs = useGradeCenterDialogs();

  const filters = preferences.filters;
  const chips = activeFilterChips(filters, dataset).filter(
    (chip) => chip.id !== "query"
  );
  const isMatrix =
    preferences.view === "standard" || preferences.view === "compact";
  const listsStudents = isMatrix || preferences.view === "student";
  const sortLabel =
    SORT_OPTIONS.find((option) => option.key === preferences.sort.key)?.label ??
    "Nombre";
  const filtered = students.length !== analytics.students.length;
  const weightLabel =
    weightIntegrity.status === "exceeded"
      ? `Ponderación ${weightIntegrity.used}% (supera 100%)`
      : `Ponderación ${weightIntegrity.used}% · faltan ${weightIntegrity.remaining}%`;

  const toggleLevel = (level: LevelId) => {
    const levels = filters.levels.includes(level)
      ? filters.levels.filter((item) => item !== level)
      : [...filters.levels, level];
    setFilters({ ...filters, levels });
  };

  return (
    <div className="@container relative z-30 flex h-10 shrink-0 items-center gap-1.5 border-b border-[var(--gc-hair)] bg-[var(--gc-chrome)] px-3">
      {/* ─── 1. Pestañas de Vista (a la izquierda en su lugar original) ─── */}
      <ViewSwitcher />

      {listsStudents && (
        <>
          <span
            className="mx-1 h-4 w-px shrink-0 bg-[var(--gc-hair)]"
            aria-hidden
          />

          {/* ─── 2. Ordenamiento ─── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={TOOL_BUTTON}>
                <ArrowDownUp className="size-3.5" aria-hidden />
                <span className="hidden @2xl:inline">
                  <span className="text-muted-foreground">Orden:</span>{" "}
                  <span className="text-foreground/90 font-medium">{sortLabel}</span>
                </span>
                <span className="sr-only @2xl:hidden">Ordenar por {sortLabel}</span>
                <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="gc-popover w-52 rounded-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Ordenar por
              </DropdownMenuLabel>
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
                onValueChange={(dir) =>
                  setSort({ ...preferences.sort, dir: dir as "asc" | "desc" })
                }
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

          {/* ─── 3. Filtros ─── */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  TOOL_BUTTON,
                  chips.length > 0 &&
                    "border-[var(--gc-cobalt)]/40 bg-[var(--gc-cobalt)]/12 text-foreground font-semibold"
                )}
              >
                <Filter className="size-3.5" aria-hidden />
                <span className="hidden @2xl:inline">Filtros</span>
                <span className="sr-only @2xl:hidden">Filtros</span>
                {chips.length > 0 && (
                  <span className="gc-num rounded-full bg-[var(--gc-cobalt)] px-1.5 text-[10px] leading-4 text-white font-semibold">
                    {chips.length}
                  </span>
                )}
                <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="gc-popover w-64 rounded-2xl p-3 border-white/10 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                Nivel de la definitiva
              </div>
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

              <div className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">
                Situación
              </div>
              <div className="space-y-1">
                <FilterOption
                  active={filters.onlyPending}
                  onClick={() =>
                    setFilters({ ...filters, onlyPending: !filters.onlyPending })
                  }
                  label="Con notas pendientes"
                  detail={String(analytics.group.pending.length)}
                />
                <FilterOption
                  active={filters.onlyAttention}
                  onClick={() =>
                    setFilters({ ...filters, onlyAttention: !filters.onlyAttention })
                  }
                  label="Requieren atención"
                  detail={String(analytics.group.attention.length)}
                />
                <FilterOption
                  active={filters.onlyComplete}
                  onClick={() =>
                    setFilters({ ...filters, onlyComplete: !filters.onlyComplete })
                  }
                  label="Todo calificado"
                  detail={String(
                    analytics.students.filter((item) => item.complete).length
                  )}
                />
              </div>

              {chips.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({ ...EMPTY_FILTERS, query: filters.query })
                  }
                  className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
                >
                  Quitar filtros
                </button>
              )}
            </PopoverContent>
          </Popover>
        </>
      )}

      {/* ─── 4. Ajustes (Densidad, Clic y Columnas agrupados profesionalmente) ─── */}
      {isMatrix && <ViewOptionsMenu />}

      {/* Chips de filtros activos */}
      {listsStudents && chips.length > 0 && (
        <div className="hidden @3xl:flex min-w-0 items-center gap-1">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="gc-chip shrink-0 py-0.5 pr-1 pl-2 text-[11px] text-foreground/90"
            >
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
        </div>
      )}

      {/* Conteo si hay filtro */}
      {listsStudents && filtered && (
        <span
          className="gc-num ml-1 shrink-0 text-xs text-muted-foreground hidden @4xl:inline"
          aria-live="polite"
        >
          {students.length} de {analytics.students.length}
        </span>
      )}

      {/* Espaciador flexible para empujar acciones al extremo derecho */}
      <div className="flex-1 min-w-[8px]" />

      {/* ─── 5. Ponderación (solo si no es 100% válida) ─── */}
      {weightIntegrity.status !== "valid" && dataset.evaluations.length > 0 && (
        <span
          className={cn(
            "hidden @3xl:flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap border shadow-sm",
            weightIntegrity.status === "exceeded"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
          title={`${weightLabel}. La suma de ponderaciones de las evaluaciones del periodo debe ser 100%.`}
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          <span className="gc-num font-medium">
            {weightIntegrity.used}%
          </span>
          <span className="hidden @6xl:inline text-[11px] opacity-80">
            · {weightIntegrity.status === "exceeded" ? "supera 100%" : `faltan ${weightIntegrity.remaining}%`}
          </span>
        </span>
      )}

      {/* ─── 6. Acciones Principales a la Derecha ─── */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 shrink-0">
          {isMatrix && dataset.evaluations.length > 0 && (
            <button
              type="button"
              onClick={() => dialogs.openBulkGrade()}
              className={TOOL_BUTTON}
            >
              <PenLine className="size-3.5" aria-hidden />
              <span className="hidden @4xl:inline">Calificar en bloque</span>
              <span className="sr-only @4xl:hidden">Calificar en bloque</span>
              {selectedRows.length > 0 && (
                <span className="gc-num rounded-full bg-[var(--gc-cobalt)]/25 px-1.5 text-[10px] font-semibold text-foreground">
                  {selectedRows.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={dialogs.openNewEvaluation}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[var(--gc-cobalt)]/40 bg-[var(--gc-cobalt)]/20 px-3 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-[var(--gc-cobalt)]/30 hover:border-[var(--gc-cobalt)]/60 shadow-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none"
          >
            <ClipboardPlus className="size-3.5 text-[var(--gc-cobalt)]" aria-hidden />
            <span className="hidden @sm:inline">Nueva evaluación</span>
            <span className="sr-only @sm:hidden">Nueva evaluación</span>
          </button>
        </div>
      )}
    </div>
  );
}

const TOOL_BUTTON =
  "flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-white/10 hover:text-foreground active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none";

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
        active
          ? "border-[var(--gc-cobalt)]/50 bg-[var(--gc-cobalt)]/12"
          : "border-transparent hover:bg-white/6"
      )}
    >
      {dot ? (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
          aria-hidden
        />
      ) : (
        <span
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded border",
            active
              ? "border-[var(--gc-cobalt)] bg-[var(--gc-cobalt)] text-white"
              : "border-white/25"
          )}
          aria-hidden
        >
          {active && <Check className="size-2.5" />}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {detail && (
        <span className="gc-num shrink-0 text-muted-foreground">{detail}</span>
      )}
    </button>
  );
}

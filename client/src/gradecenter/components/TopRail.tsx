import { ArrowLeft, Check, ChevronDown, HelpCircle, Maximize2, Minimize2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SyncStatus } from "./SyncStatus";
import { useGradeCenter } from "../state/GradeCenterContext";
import { formatGrade } from "../lib/format";

/**
 * Barra superior: dónde estoy (volver, planilla actual), buscar y el estado del
 * guardado. Dos acciones de sesión: enfoque y ayuda.
 */
export function TopRail({ onOpenHelp, onBack }: { onOpenHelp: () => void; onBack: () => void }) {
  const { preferences, setFilters, setFocusMode } = useGradeCenter();
  const focus = preferences.focusMode;
  const query = preferences.filters.query;

  return (
    <div
      role="toolbar"
      aria-label="Barra de la planilla"
      className="relative z-40 flex h-14 shrink-0 items-center gap-2 gc-chrome px-3"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
        aria-label="Volver a mis planillas"
      >
        <ArrowLeft className="size-4" aria-hidden />
        <span className="hidden lg:inline">Mis planillas</span>
      </button>

      <PlanillaSwitcher onBack={onBack} />

      <div className="relative ml-1 w-full max-w-xs min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setFilters({ ...preferences.filters, query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              setFilters({ ...preferences.filters, query: "" });
            }
          }}
          placeholder="Buscar estudiante"
          aria-label="Buscar estudiante por nombre o código"
          className="h-9 w-full rounded-lg border border-white/8 bg-white/4 pr-8 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[var(--gc-cobalt)]/60 focus:bg-white/6 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setFilters({ ...preferences.filters, query: "" })}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-white/8 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SyncStatus />

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />


        <button
          type="button"
          onClick={() => setFocusMode(!focus)}
          aria-pressed={focus}
          aria-label={focus ? "Salir del modo enfoque" : "Modo enfoque"}
          title={focus ? "Salir del modo enfoque (Esc)" : "Modo enfoque: la planilla ocupa toda la pantalla"}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors",
            focus ? "bg-[var(--gc-cobalt)]/14 text-foreground" : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
          )}
        >
          {focus ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
          {focus && <span className="hidden sm:inline">Salir de enfoque</span>}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="Atajos de teclado"
          title="Atajos de teclado (?)"
          className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground md:flex"
        >
          <HelpCircle className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Planilla actual con resumen del grupo y cambio rápido a otra planilla. */
function PlanillaSwitcher({ onBack }: { onBack: () => void }) {
  const { dataset, analytics, availableAssignments, onSelectAssignment } = useGradeCenter();
  const group = analytics.group;
  const canSwitch = Boolean(availableAssignments && availableAssignments.length > 1 && onSelectAssignment);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex h-10 min-w-0 shrink items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-white/6"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight font-semibold">
              {dataset.course} · {dataset.subject}
            </span>
            <span className="gc-num block truncate text-xs leading-tight text-muted-foreground">
              {dataset.students.length} estudiantes · {dataset.evaluations.length} evaluaciones
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="glass-strong w-80 rounded-2xl border-white/10 p-0">
        <div className="px-3.5 pt-3 pb-2">
          <div className="text-sm font-semibold">
            {dataset.course} · {dataset.subject}
          </div>
          <div className="text-xs text-muted-foreground">{dataset.period}</div>
          <dl className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
            <GroupStat label="Promedio" value={formatGrade(group.average)} />
            <GroupStat label="Aprobación" value={`${group.approvalPct}%`} />
            <GroupStat label="Pendientes" value={String(group.totalPending)} />
          </dl>
        </div>
        {canSwitch && (
          <div className="border-t border-white/8 p-1.5">
            <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Cambiar de planilla</div>
            <ul className="gc-scroll max-h-56 overflow-y-auto">
              {availableAssignments!.map((assignment) => {
                const isCurrent = assignment.id === dataset.key || assignment.sourceDatasetKey === dataset.key;
                const total = assignment.metrics?.studentsCount ?? assignment.dataset.students.length;
                return (
                  <li key={assignment.id}>
                    <button
                      type="button"
                      aria-current={isCurrent || undefined}
                      disabled={isCurrent}
                      onClick={() => onSelectAssignment!(assignment.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/6 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {assignment.dataset.course} · {assignment.dataset.subject}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {assignment.dataset.period}
                          {total > 0 ? ` · ${total} est.` : ""}
                        </span>
                      </span>
                      {isCurrent && <Check className="size-4 shrink-0 text-[var(--gc-cobalt)]" aria-label="Planilla actual" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="border-t border-white/8 p-1.5">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
          >
            Ver todas mis planillas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GroupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/4 px-1.5 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="gc-num text-sm font-semibold">{value}</dd>
    </div>
  );
}

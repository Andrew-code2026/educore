/** Búsqueda, acciones de jornada y controles secundarios, agrupados sin perder atajos. */
import { CheckCheck, Keyboard, ListChecks, Maximize2, Minimize2, Search, Undo2, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AttendanceToolbarProps {
  pendingCount: number;
  canUndo: boolean;
  undoDepth: number;
  lastActionLabel: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onAllPresent: () => void;
  onCompletePending: () => void;
  onUndo: () => void;
  onOpenShortcuts: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  filters: ReactNode;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  badge,
  hint,
  primary = false,
  iconOnly = false,
  alwaysLabel = false,
}: {
  icon: typeof CheckCheck;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  hint: string;
  primary?: boolean;
  iconOnly?: boolean;
  alwaysLabel?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "chrona-action flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[10.5px] font-semibold transition-all",
            primary ? "chrona-action-primary" : "chrona-action-secondary",
            disabled && "pointer-events-none opacity-40",
            iconOnly && "w-8 px-0",
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {!iconOnly ? <span className={alwaysLabel ? "whitespace-nowrap" : "hidden sm:inline"}>{label}</span> : null}
          {typeof badge === "number" && badge > 0 ? <span className="tabular rounded-full bg-foreground/[0.08] px-1.5 py-px text-[9px] font-bold">{badge}</span> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10.5px]">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function AttendanceToolbar({
  pendingCount,
  canUndo,
  undoDepth,
  lastActionLabel,
  query,
  onQueryChange,
  onAllPresent,
  onCompletePending,
  onUndo,
  onOpenShortcuts,
  focusMode,
  onToggleFocusMode,
  filters,
}: AttendanceToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const openLayer = document.querySelector(
        '[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], [data-radix-popper-content-wrapper] [data-state="open"]',
      );
      const targetInLayer = target?.closest('[role="dialog"], [role="menu"], [role="listbox"]');
      if (event.key !== "/" || event.defaultPrevented || typing || openLayer || targetInLayer) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="chrona-toolbar">
      <div className="chrona-toolbar-primary" role="group" aria-label="Acciones principales">
        <ActionButton
          icon={CheckCheck}
          label="Todos presentes"
          onClick={onAllPresent}
          primary
          alwaysLabel
          hint="Marca como presentes a los estudiantes visibles · pide confirmación si afecta a varios"
        />
        <ActionButton
          icon={ListChecks}
          label="Completar pendientes"
          onClick={onCompletePending}
          disabled={pendingCount === 0}
          badge={pendingCount}
          alwaysLabel
          hint={pendingCount === 0 ? "No quedan pendientes" : `Completa ${pendingCount} pendientes visibles`}
        />
      </div>

      <div className="chrona-toolbar-filters" role="group" aria-label="Búsqueda y filtros del roster">
        <label className="chrona-search flex h-8 min-w-[160px] flex-1 items-center gap-1.5 rounded-[10px] px-2.5 transition-all">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Buscar estudiante"
            aria-label="Buscar estudiante"
            className="min-w-0 flex-1 bg-transparent text-[10.5px] outline-none placeholder:text-muted-foreground/70"
          />
          {query ? (
            <button type="button" onClick={() => onQueryChange("")} aria-label="Limpiar búsqueda" className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.1] hover:text-foreground">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : <kbd className="kbd hidden sm:inline-flex">/</kbd>}
        </label>
        <div className="chrona-toolbar-filter-chips">{filters}</div>
      </div>

      <div className="chrona-toolbar-secondary" role="group" aria-label="Controles secundarios">
        <ActionButton
          icon={Undo2}
          label="Deshacer"
          onClick={onUndo}
          disabled={!canUndo}
          badge={undoDepth > 1 ? undoDepth : undefined}
          hint={canUndo ? `Deshacer ${lastActionLabel ?? "el último cambio"} · Ctrl/Cmd + Z` : "Nada que deshacer"}
          iconOnly
        />
        <ActionButton icon={Keyboard} label="Atajos" onClick={onOpenShortcuts} hint="Atajos de teclado · tecla ?" iconOnly />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={focusMode ? "Salir de concentración" : "Enfocar asistencia"}
              aria-pressed={focusMode}
              title={focusMode ? "Salir de concentración · Esc" : "Enfocar asistencia"}
              onClick={onToggleFocusMode}
              className={cn(
                "chrona-focus-toggle inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[10.5px] font-semibold transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chrona-cyan-strong)] focus-visible:ring-offset-2",
              )}
            >
              {focusMode ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="hidden sm:inline">{focusMode ? "Salir" : "Enfocar"}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10.5px]">
            {focusMode ? "Volver a EduCore · Esc" : "Ampliar la asistencia y apartar la navegación"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

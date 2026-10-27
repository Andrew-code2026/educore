/** Barra de la planilla: vistas, búsqueda y controles secundarios junto al roster que filtran. */
import { Keyboard, Maximize2, Minimize2, Search, Undo2, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AttendanceToolbarProps {
  filters: ReactNode;
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  canUndo: boolean;
  lastActionLabel: string | null;
  onUndo: () => void;
  onOpenShortcuts: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

function IconButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  pressed,
}: {
  icon: typeof Undo2;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* aria-disabled mantiene el tooltip accesible aunque la acción no esté disponible. */}
        <button
          type="button"
          onClick={disabled ? undefined : onClick}
          aria-disabled={disabled || undefined}
          aria-pressed={pressed}
          aria-label={label}
          className={cn("att-icon-button", pressed && "is-pressed")}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function AttendanceToolbar({
  filters,
  searchRef,
  query,
  onQueryChange,
  canUndo,
  lastActionLabel,
  onUndo,
  onOpenShortcuts,
  focusMode,
  onToggleFocusMode,
}: AttendanceToolbarProps) {
  return (
    <div className="att-toolbar">
      {filters}

      <div className="att-toolbar-end">
        <label className="att-search">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                onQueryChange("");
              }
            }}
            placeholder="Buscar estudiante"
            aria-label="Buscar estudiante"
            className="att-search-input"
          />
          {query ? (
            <button type="button" onClick={() => onQueryChange("")} aria-label="Limpiar búsqueda" className="att-search-clear">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="kbd hidden sm:inline-flex" aria-hidden="true">/</kbd>
          )}
        </label>

        <div className="att-toolbar-icons" role="group" aria-label="Controles de la planilla">
          <IconButton
            icon={Undo2}
            label="Deshacer"
            onClick={onUndo}
            disabled={!canUndo}
            hint={canUndo ? `Deshacer ${lastActionLabel ?? "el último cambio"} · Ctrl/⌘ Z` : "Nada que deshacer"}
          />
          <IconButton
            icon={focusMode ? Minimize2 : Maximize2}
            label={focusMode ? "Salir de Enfocar" : "Enfocar asistencia"}
            onClick={onToggleFocusMode}
            pressed={focusMode}
            hint={focusMode ? "Salir de Enfocar · Esc" : "Ampliar la planilla y ocultar la navegación"}
          />
          <IconButton icon={Keyboard} label="Atajos y ayuda" onClick={onOpenShortcuts} hint="Atajos de teclado · ?" />
        </div>
      </div>
    </div>
  );
}

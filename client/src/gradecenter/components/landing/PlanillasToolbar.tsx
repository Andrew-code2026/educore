import type { KeyboardEvent, RefObject } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { FILTERS, type PlanillaFilter, type PlanillasLayout } from "./planillas";

interface PlanillasToolbarProps {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  filter: PlanillaFilter;
  counts: Record<PlanillaFilter, number>;
  onFilterChange: (filter: PlanillaFilter) => void;
  layout: PlanillasLayout;
  onLayoutChange: (layout: PlanillasLayout) => void;
}

export function PlanillasToolbar({
  searchRef,
  query,
  onQueryChange,
  filter,
  counts,
  onFilterChange,
  layout,
  onLayoutChange,
}: PlanillasToolbarProps) {
  // Escape limpia la búsqueda; con la búsqueda vacía, devuelve el foco a la página.
  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    if (query) onQueryChange("");
    else event.currentTarget.blur();
  };

  return (
    <div className="gcl-toolbar">
      <label className="gcl-search">
        <Search aria-hidden="true" strokeWidth={1.9} />
        <input
          ref={searchRef}
          type="search"
          className="gcl-search__input"
          aria-label="Buscar planillas"
          aria-keyshortcuts="/"
          placeholder="Buscar por salón o materia"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKey}
        />
        {query ? (
          <button
            type="button"
            className="gcl-search__clear"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              onQueryChange("");
              searchRef.current?.focus();
            }}
          >
            <X aria-hidden="true" strokeWidth={2} />
          </button>
        ) : (
          <kbd className="gcl-search__kbd" aria-hidden="true">/</kbd>
        )}
      </label>

      <div role="group" aria-label="Filtrar por estado" className="gcl-segmented gcl-segmented--filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="gcl-segmented__btn"
            aria-pressed={item.id === filter}
            onClick={() => onFilterChange(item.id)}
          >
            {item.label}
            <span className="gcl-segmented__count">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      <div role="group" aria-label="Vista" className="gcl-segmented">
        <button
          type="button"
          className="gcl-segmented__btn gcl-segmented__btn--icon"
          aria-label="Vista en tarjetas"
          title="Tarjetas"
          aria-pressed={layout === "grid"}
          onClick={() => onLayoutChange("grid")}
        >
          <LayoutGrid aria-hidden="true" strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="gcl-segmented__btn gcl-segmented__btn--icon"
          aria-label="Vista en lista"
          title="Lista"
          aria-pressed={layout === "list"}
          onClick={() => onLayoutChange("list")}
        >
          <List aria-hidden="true" strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}

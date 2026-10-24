import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useGradeCenter } from "../state/GradeCenterContext";
import { EMPTY_FILTERS } from "../domain/selectors";
import { assignmentFromDataset, type GradebookAssignment } from "../domain/assignments";
import type { ViewId } from "../types";
import {
  DEFAULT_SORT,
  countByFilter,
  describeResults,
  matchesQuery,
  nextSort,
  sortPlanillas,
  summarizePeriod,
  toPlanilla,
  type Planilla,
  type PlanillaFilter,
  type PlanillaSort,
  type PlanillaSortKey,
  type PlanillasLayout,
} from "./landing/planillas";
import { PlanillasHeader } from "./landing/PlanillasHeader";
import { PlanillasToolbar } from "./landing/PlanillasToolbar";
import { PlanillaCard } from "./landing/PlanillaCard";
import { PlanillasTable } from "./landing/PlanillasTable";
import { NoAssignmentsState, NoResultsState } from "./landing/PlanillasEmptyState";
import "./landing/landing.css";

interface LandingViewProps {
  onOpenMatrix: (view?: ViewId) => void;
}

const LAYOUT_STORAGE_KEY = "educore.gc.view";

function readStoredLayout(): PlanillasLayout {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function usePlanillasLayout() {
  const [layout, setLayoutState] = useState<PlanillasLayout>(readStoredLayout);
  const setLayout = useCallback((next: PlanillasLayout) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* almacenamiento no disponible: la vista solo dura la sesión */
    }
  }, []);
  return [layout, setLayout] as const;
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** "/" enfoca la búsqueda desde cualquier punto de la página. */
function useSearchShortcut(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (!searchRef.current) return;
      event.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchRef]);
}

/** Portada de "/grades": planillas del docente con resumen del periodo, filtros y dos vistas. */
export function LandingView({ onOpenMatrix }: LandingViewProps) {
  const { dataset, setFilters, availableAssignments, onSelectAssignment } = useGradeCenter();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlanillaFilter>("todas");
  const [sort, setSort] = useState<PlanillaSort>(DEFAULT_SORT);
  const [layout, setLayout] = usePlanillasLayout();
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);

  const assignments = useMemo<GradebookAssignment[]>(() => {
    if (availableAssignments && availableAssignments.length > 0) return availableAssignments;
    return dataset.key === "gradecenter-empty" ? [] : [assignmentFromDataset(dataset)];
  }, [availableAssignments, dataset]);

  const allPlanillas = useMemo(() => assignments.map(toPlanilla), [assignments]);
  const summary = useMemo(() => summarizePeriod(allPlanillas), [allPlanillas]);
  const planillas = useMemo(() => sortPlanillas(allPlanillas, sort), [allPlanillas, sort]);
  const matched = useMemo(() => planillas.filter((planilla) => matchesQuery(planilla, query)), [planillas, query]);
  const counts = useMemo(() => countByFilter(matched), [matched]);
  const shown = filter === "todas" ? matched : matched.filter((planilla) => planilla.estado === filter);

  const hasAssignments = planillas.length > 0;
  const reference = assignments[0]?.dataset ?? dataset;

  const openPlanilla = (planilla: Planilla) => {
    setFilters(EMPTY_FILTERS);
    onSelectAssignment?.(planilla.id);
    onOpenMatrix("standard");
  };

  const resetFilters = () => {
    setQuery("");
    setFilter("todas");
  };

  return (
    <div className="gcl">
      <div aria-hidden="true" className="gcl__glows">
        <div className="gcl__glow gcl__glow--a" />
        <div className="gcl__glow gcl__glow--b" />
      </div>

      <div className="gcl__content">
        <PlanillasHeader
          academicYear={reference.academicYear}
          period={reference.period}
          summary={hasAssignments ? summary : null}
        />

        {hasAssignments ? (
          <>
            <PlanillasToolbar
              searchRef={searchRef}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              counts={counts}
              onFilterChange={setFilter}
              layout={layout}
              onLayoutChange={setLayout}
            />
            <div aria-live="polite" className="gcl-results">
              {describeResults(shown.length, planillas.length, sort)}
            </div>

            {shown.length === 0 ? (
              <NoResultsState onReset={resetFilters} />
            ) : layout === "grid" ? (
              <div className="gcl-grid">
                {shown.map((planilla) => (
                  <PlanillaCard key={planilla.id} planilla={planilla} onOpen={openPlanilla} />
                ))}
              </div>
            ) : (
              <PlanillasTable
                planillas={shown}
                sort={sort}
                onSort={(key: PlanillaSortKey) => setSort((current) => nextSort(current, key))}
                onOpen={openPlanilla}
              />
            )}
          </>
        ) : (
          <NoAssignmentsState period={reference.period} />
        )}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardList,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { EMPTY_FILTERS } from "../domain/selectors";
import {
  assignmentFromDataset,
  computeDatasetMetrics,
  filterAssignments,
  type GradebookAssignment,
} from "../domain/assignments";
import type { ViewId } from "../types";

interface LandingViewProps {
  onOpenMatrix: (view?: ViewId) => void;
  onOpenAnalysis?: () => void;
}

/**
 * Vista principal de "/grades": conserva la estética y las tarjetas originales
 * de "Mis planillas", con barra de búsqueda limpia y sin paneles inferiores redundantes.
 */
export function LandingView({ onOpenMatrix }: LandingViewProps) {
  const {
    dataset,
    setFilters,
    availableAssignments: ctxAssignments,
    onSelectAssignment,
  } = useGradeCenter();

  const [query, setQuery] = useState("");

  const availableAssignments = useMemo<GradebookAssignment[]>(
    () =>
      ctxAssignments && ctxAssignments.length > 0
        ? ctxAssignments
        : dataset.key === "gradecenter-empty"
          ? []
          : [assignmentFromDataset(dataset)],
    [ctxAssignments, dataset],
  );

  const visibleAssignments = useMemo(
    () => filterAssignments(availableAssignments, query, "all", "all"),
    [availableAssignments, query],
  );

  const clearGlobalFilters = () => {
    setQuery("");
  };

  const handleOpenAssignment = (assignment: GradebookAssignment) => {
    setFilters(EMPTY_FILTERS);
    if (onSelectAssignment) {
      onSelectAssignment(assignment.id);
    }
    onOpenMatrix("standard");
  };

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-9 lg:py-7">
        {/* Card Hero superior con el estilo original */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="gc-landing-hero relative overflow-hidden rounded-[28px] p-5 sm:p-7"
        >
          <div className="pointer-events-none absolute -top-28 right-[-5%] size-72 rounded-full bg-[var(--gc-cobalt)]/12 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="gc-label text-[var(--gc-cobalt)]">Workspace académico</span>
                <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-xs text-muted-foreground">
                  {availableAssignments.length} planilla{availableAssignments.length === 1 ? " disponible" : "s disponibles"}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Mis planillas
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Gestiona las calificaciones de los salones y materias asignados desde un solo espacio.
              </p>
            </div>
          </div>
        </motion.header>

        {/* Barra de búsqueda única */}
        <section aria-label="Buscar planillas" className="glass mt-4 rounded-2xl p-3 sm:p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por salón, materia o docente…"
                aria-label="Buscar planilla"
                className="w-full rounded-xl border border-white/8 bg-white/5 py-2 pr-3 pl-9 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-[var(--gc-cobalt)]/60"
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={clearGlobalFilters}
                className="rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--gc-cobalt)] hover:bg-white/6"
              >
                Limpiar
              </button>
            )}
          </div>
        </section>

        {/* Tarjetas de planillas con su diseño original */}
        <section className="mt-5" aria-labelledby="my-sheets-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="gc-label text-xs">Acceso rápido</div>
              <h2 id="my-sheets-title" className="mt-1 text-xl font-semibold">
                Mis planillas
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {visibleAssignments.length} de {availableAssignments.length} visibles
            </span>
          </div>

          {availableAssignments.length === 0 ? (
            <div className="glass rounded-2xl border border-dashed border-[var(--gc-cobalt)]/25 p-8 text-center">
              <ClipboardList className="mx-auto size-6 text-[var(--gc-cobalt)]" />
              <div className="mt-3 text-sm font-semibold">
                Aún no hay planillas académicas disponibles
              </div>
              <div className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                Cuando tengas salones y materias asignados en este periodo, aparecerán aquí listos para calificar.
              </div>
            </div>
          ) : visibleAssignments.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleAssignments.map((assignment) => (
                <PlanillaCard
                  key={assignment.id}
                  assignment={assignment}
                  onOpen={() => handleOpenAssignment(assignment)}
                />
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-7 text-center">
              <Search className="mx-auto size-5 text-muted-foreground" />
              <div className="mt-2 text-sm font-semibold">No encontramos planillas</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Ninguna planilla disponible coincide con la búsqueda actual.
              </div>
              <button
                type="button"
                onClick={clearGlobalFilters}
                className="mt-3 rounded-xl bg-[var(--gc-cobalt)]/15 px-3 py-2 text-xs font-semibold text-[var(--gc-cobalt)]"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PlanillaCard({
  assignment,
  onOpen,
  single = false,
}: {
  assignment: GradebookAssignment;
  onOpen: () => void;
  single?: boolean;
}) {
  const { dataset } = assignment;
  const metrics = useMemo(
    () => assignment.metrics ?? computeDatasetMetrics(dataset),
    [assignment.metrics, dataset],
  );

  const {
    studentsCount,
    evaluationsCount,
    pendingCells,
    progressPct,
  } = metrics;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      onClick={onOpen}
      className={cn(
        "gc-planilla-card group rounded-2xl p-4 text-left transition-colors",
        single && "p-5 sm:p-6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="gc-label text-xs">Planilla asignada</div>
          <h3 className={cn("mt-1 text-base font-semibold", single && "text-xl")}>
            {dataset.course} · {dataset.subject}
          </h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {dataset.period} · {dataset.academicYear} · {dataset.teacher.name}
          </div>
        </div>
        <span className="rounded-full border border-[var(--gc-alto)]/25 bg-[var(--gc-alto)]/10 px-2 py-1 text-xs font-semibold text-[var(--gc-alto)]">
          Disponible
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
            <div>
              <div className="gc-label text-xs">Progreso de calificación</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="gc-num text-3xl font-semibold text-[var(--gc-alto)]">
                  {progressPct}%
                </span>
                <span className="text-xs text-muted-foreground">calificado</span>
              </div>
            </div>
            <div>
              <div className="gc-label text-xs">Pendientes</div>
              <div className="gc-num mt-1 text-2xl font-semibold text-[var(--gc-superior)]">
                {pendingCells}
              </div>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gc-cobalt)] to-[var(--gc-alto)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            {studentsCount} estudiantes · {evaluationsCount} evaluaciones
          </div>
        </div>

        <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gc-cobalt)] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_24px_-12px_var(--gc-cobalt)]">
          Abrir planilla{" "}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </motion.button>
  );
}

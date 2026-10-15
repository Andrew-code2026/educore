import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Crosshair, Search, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelFromScore } from "../../domain/scale";
import { formatGrade, initials, studentDisplayName } from "../../lib/format";
import { StudentDetail } from "../insights/StudentDetail";
import { TrendStrip } from "../insights/primitives";

/**
 * Vista Estudiante.
 *
 * Prioriza la información individual y la evolución. Es la misma matriz mirada
 * de lado: la lista de la izquierda es el grupo completo y el detalle de la
 * derecha es la ficha académica de quien se está revisando.
 */
export function StudentView() {
  const {
    students,
    analytics,
    preferences,
    selectedStudentId,
    selectStudent,
    setFilters,
    jumpToStudent,
    setAnalysisOpen,
  } = useGradeCenter();

  // Si no hay estudiante seleccionado, se abre el primero de la lista visible.
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      selectStudent(students[0].student.id);
    }
  }, [selectedStudentId, students, selectStudent]);

  const index = useMemo(
    () => students.findIndex((item) => item.student.id === selectedStudentId),
    [students, selectedStudentId],
  );

  const current = index >= 0 ? students[index] : students[0] ?? null;

  const move = (delta: number) => {
    if (students.length === 0) return;
    const next = (index + delta + students.length) % students.length;
    selectStudent(students[next].student.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Lista del grupo */}
      <aside className="flex max-h-[38%] min-h-0 w-full shrink-0 flex-col border-b border-white/8 lg:max-h-none lg:w-[300px] lg:border-r lg:border-b-0">
        <div className="shrink-0 border-b border-white/8 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="gc-label text-[9px]">Grupo</span>
            <span className="gc-num text-[10px] text-muted-foreground">
              {students.length} de {analytics.students.length}
            </span>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={preferences.filters.query}
              onChange={(event) => setFilters({ ...preferences.filters, query: event.target.value })}
              placeholder="Buscar en el grupo…"
              aria-label="Buscar estudiante"
              className="w-full rounded-xl border border-white/8 bg-white/4 py-1.5 pr-2.5 pl-8 text-[11.5px] outline-none placeholder:text-muted-foreground/70 focus:border-[var(--gc-cobalt)]/60"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <QuickFilter label="Pendientes" active={preferences.filters.onlyPending} onClick={() => setFilters({ ...preferences.filters, onlyPending: !preferences.filters.onlyPending })} />
            <QuickFilter label="Atención" active={preferences.filters.onlyAttention} onClick={() => setFilters({ ...preferences.filters, onlyAttention: !preferences.filters.onlyAttention })} />
            <QuickFilter label="Al día" active={preferences.filters.onlyComplete} onClick={() => setFilters({ ...preferences.filters, onlyComplete: !preferences.filters.onlyComplete })} />
          </div>
        </div>

        <div className="gc-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
          {students.map((metrics) => {
            const level = metrics.level;
            const active = metrics.student.id === selectedStudentId;
            return (
              <button
                key={metrics.student.id}
                type="button"
                onClick={() => selectStudent(metrics.student.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                  active ? "bg-[var(--gc-cobalt)]/16 ring-1 ring-[var(--gc-cobalt)]/40 ring-inset" : "hover:bg-white/6",
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-semibold"
                  style={{
                    borderColor: level ? `${LEVELS[level].color}66` : "oklch(1 0 0 / 12%)",
                    backgroundColor: level ? `${LEVELS[level].color}22` : undefined,
                    color: level ? LEVELS[level].color : undefined,
                  }}
                >
                  {initials(metrics.student)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium">
                    {studentDisplayName(metrics.student, 22)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="gc-num text-[9.5px] text-muted-foreground">{metrics.student.code}</span>
                    {metrics.pendingCount > 0 && (
                      <span className="gc-num flex items-center gap-0.5 text-[9.5px] text-[var(--gc-bajo)]">
                        <Clock className="size-2.5" />
                        {metrics.pendingCount}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className="gc-num shrink-0 text-[12px] font-semibold"
                  style={{ color: level ? LEVELS[level].color : undefined }}
                >
                  {formatGrade(metrics.definitiva)}
                </span>
              </button>
            );
          })}
          {students.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              Sin estudiantes con los filtros activos.
            </div>
          )}
        </div>
      </aside>

      {/* Ficha individual */}
      <section className="gc-scroll min-h-0 flex-1 overflow-y-auto">
        {current ? (
          <div className="mx-auto w-full max-w-4xl p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Estudiante anterior"
                  className="flex size-8 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Siguiente estudiante"
                  className="flex size-8 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="gc-num ml-1 text-[10.5px] text-muted-foreground">
                  {(index >= 0 ? index : 0) + 1} / {students.length}
                </span>
                <TrendStrip trend={current.trend} className="ml-2" />
              </div>
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => jumpToStudent(current.student.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                    >
                      <Crosshair className="size-3.5" />
                      Ver en la matriz
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Abre la matriz estándar con la fila de {current.student.firstName} activa
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => setAnalysisOpen(!preferences.analysisOpen)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                >
                  <Users className="size-3.5" />
                  Análisis
                </button>
              </div>
            </div>

            <div className="glass gc-rise rounded-3xl p-4">
              <StudentDetail metrics={current} layout="wide" />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-10 text-center text-[12px] text-muted-foreground">
            Ningún estudiante coincide con los filtros activos.
          </div>
        )}
      </section>
    </div>
  );
}

function QuickFilter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
        active
          ? "border-[var(--gc-cobalt)]/60 bg-[var(--gc-cobalt)]/16 text-foreground"
          : "border-white/10 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export { levelFromScore };

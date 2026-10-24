import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelTint } from "../../domain/scale";
import { formatGrade, initials } from "../../lib/format";
import { StudentDetail } from "../insights/StudentDetail";

/**
 * Vista Estudiante: la lista del grupo a la izquierda y la ficha de quien se
 * revisa a la derecha. La búsqueda, los filtros y el orden son los mismos de la
 * barra superior, por eso no se repiten aquí.
 */
export function StudentView() {
  const { students, analytics, selectedStudentId, selectStudent, jumpToStudent } = useGradeCenter();
  const listRef = useRef<HTMLDivElement>(null);

  // Si no hay estudiante seleccionado (o quedó fuera del filtro), se abre el primero visible.
  useEffect(() => {
    if (students.length === 0) return;
    if (!selectedStudentId || !students.some((item) => item.student.id === selectedStudentId)) {
      selectStudent(students[0].student.id);
    }
  }, [selectedStudentId, students, selectStudent]);

  const index = useMemo(
    () => students.findIndex((item) => item.student.id === selectedStudentId),
    [students, selectedStudentId],
  );
  const current = index >= 0 ? students[index] : null;

  const select = (next: number) => {
    if (students.length === 0) return;
    const clamped = Math.max(0, Math.min(students.length - 1, next));
    const id = students[clamped].student.id;
    selectStudent(id);
    listRef.current?.querySelector<HTMLElement>(`[data-student="${id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  // Lista navegable con flechas (patrón listbox).
  const onListKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    select(index + delta);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex max-h-[38%] min-h-0 w-full shrink-0 flex-col border-b border-[var(--gc-hair)] bg-[var(--gc-chrome)] lg:max-h-none lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex shrink-0 items-baseline justify-between px-4 pt-3 pb-2">
          <span className="text-sm font-semibold">Estudiantes</span>
          <span className="gc-num text-xs text-muted-foreground">
            {students.length === analytics.students.length ? students.length : `${students.length} de ${analytics.students.length}`}
          </span>
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label="Estudiantes del grupo"
          onKeyDown={onListKeyDown}
          className="gc-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2"
        >
          {students.map((metrics, position) => {
            const level = metrics.level;
            const active = position === index;
            return (
              <button
                key={metrics.student.id}
                type="button"
                role="option"
                aria-selected={active}
                tabIndex={active || (index < 0 && position === 0) ? 0 : -1}
                data-student={metrics.student.id}
                onClick={() => selectStudent(metrics.student.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gc-cobalt)]/50 focus-visible:outline-none",
                  active ? "bg-[var(--gc-cobalt)]/10" : "hover:bg-foreground/4",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
                    color: level ? LEVELS[level].color : "var(--muted-foreground)",
                  }}
                >
                  {initials(metrics.student)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", active && "font-semibold")}>{metrics.student.fullName}</span>
                  {metrics.pendingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {metrics.pendingCount} {metrics.pendingCount === 1 ? "pendiente" : "pendientes"}
                    </span>
                  )}
                </span>
                <span
                  className="gc-num shrink-0 text-sm font-semibold"
                  style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
                >
                  {formatGrade(metrics.definitiva)}
                </span>
              </button>
            );
          })}
          {students.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Ningún estudiante coincide con la búsqueda.</p>
          )}
        </div>
      </aside>

      <section className="gc-scroll min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {current ? (
          <div className="mx-auto w-full max-w-2xl px-5 py-5">
            {/* div con role: el CSS global de la app estiliza `nav button` y anularía estos botones. */}
            <div role="navigation" aria-label="Navegación entre estudiantes" className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => select(index - 1)}
                  disabled={index <= 0}
                  aria-label="Estudiante anterior"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="gc-num min-w-14 text-center text-xs text-muted-foreground">
                  {index + 1} de {students.length}
                </span>
                <button
                  type="button"
                  onClick={() => select(index + 1)}
                  disabled={index >= students.length - 1}
                  aria-label="Estudiante siguiente"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => jumpToStudent(current.student.id)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                <Table2 className="size-3.5" aria-hidden />
                Ver en la planilla
              </button>
            </div>

            <StudentDetail metrics={current} layout="wide" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
            {students.length === 0 ? "Ningún estudiante coincide con la búsqueda." : "Selecciona un estudiante."}
          </div>
        )}
      </section>
    </div>
  );
}

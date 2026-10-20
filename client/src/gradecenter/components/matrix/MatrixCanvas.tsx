import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { ROW_HEIGHT } from "../../state/preferences";
import { DefinitivaCell, DefinitivaHeaderCell, StudentCell, StudentHeaderCell } from "./Cells";
import { EvaluationHeader } from "./EvaluationHeader";
import { GradeCell } from "./GradeCell";
import type { Density } from "../../types";
import type { StudentMetrics } from "../../domain/metrics";

const HEADER_HEIGHT: Record<Density, number> = { compact: 48, standard: 64, cozy: 76 };

/**
 * La matriz es el centro absoluto de la experiencia.
 *
 * Un solo contenedor de scroll gobierna los dos ejes: el estudiante queda fijo
 * a la izquierda, la definitiva fija a la derecha y los encabezados fijos
 * arriba, mientras las evaluaciones se desplazan horizontalmente.
 */
export function MatrixCanvas({
  densityOverride,
  className,
}: {
  densityOverride?: Density;
  className?: string;
}) {
  const {
    dataset,
    students,
    evaluations,
    preferences,
    analytics,
    activeCell,
    columnWidth,
    setAnalysisOpen,
    selectedStudentId,
    selectedEvaluationId,
  } = useGradeCenter();

  const density: Density = densityOverride ?? preferences.density;
  const rowHeight = ROW_HEIGHT[density];
  const headerHeight = HEADER_HEIGHT[density];
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolledX, setScrolledX] = useState(false);
  const [scrolledY, setScrolledY] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Al montar o cambiar de salón/curso, la planilla SIEMPRE arranca desde arriba a la izquierda
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    container.scrollLeft = 0;
    setScrolledX(false);
    setScrolledY(false);
  }, [dataset?.key]);

  // Medimos el contenedor para repartir el espacio libre entre las evaluaciones
  // cuando el grupo tiene pocas columnas.
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    containerRef.current = node;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
    setScrolledX(false);
    setScrolledY(false);
    setContainerWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setContainerWidth(node.clientWidth));
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  const studentWidth = preferences.studentColWidth;
  const definitivaWidth = preferences.definitivaColWidth;
  const baseEvaluationWidths = useMemo(
    () => evaluations.map((evaluation) => columnWidth(evaluation.id)),
    [evaluations, columnWidth, preferences.columnWidths, preferences.density],
  );

  const baseTotal =
    studentWidth + definitivaWidth + baseEvaluationWidths.reduce((acc, value) => acc + value, 0);
  const spare = Math.max(0, containerWidth - baseTotal - 1);
  const bonus = evaluations.length > 0 ? Math.min(180, spare / evaluations.length) : 0;
  const evaluationWidths = baseEvaluationWidths.map((value) => value + bonus);
  const totalWidth =
    studentWidth + definitivaWidth + evaluationWidths.reduce((acc, value) => acc + value, 0);

  /* ------------------------------------------------------------------ */
  /* Sombras de sincronía con el scroll                                  */
  /* ------------------------------------------------------------------ */

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setScrolledX(container.scrollLeft > 2);
    setScrolledY(container.scrollTop > 2);
  }, []);

  /* ------------------------------------------------------------------ */
  /* La celda activa siempre queda a la vista                            */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (activeCell.row === 0 && activeCell.col === 0) {
      container.scrollTop = 0;
      container.scrollLeft = 0;
      handleScroll();
      return;
    }

    const active = document.activeElement as HTMLElement | null;
    const insideContainer = active ? container.contains(active) : false;
    if (active && !insideContainer && active !== document.body) return;
    if (active?.tagName === "INPUT") return;

    const cell = container.querySelector<HTMLElement>(
      `[data-cell="${activeCell.row}:${activeCell.col}"]`,
    );
    if (!cell) return;

    if (active !== cell) cell.focus({ preventScroll: true });

    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const leftPad = studentWidth + 12;
    const rightPad = definitivaWidth + 12;
    const topPad = headerHeight + 8;

    let dx = 0;
    let dy = 0;
    if (cellRect.left < containerRect.left + leftPad) dx = cellRect.left - (containerRect.left + leftPad);
    else if (cellRect.right > containerRect.right - rightPad)
      dx = cellRect.right - (containerRect.right - rightPad);
    if (cellRect.top < containerRect.top + topPad) dy = cellRect.top - (containerRect.top + topPad);
    else if (cellRect.bottom > containerRect.bottom - 10)
      dy = cellRect.bottom - (containerRect.bottom - 10);

    if (dx !== 0 || dy !== 0) {
      container.scrollBy({ left: dx, top: dy, behavior: "auto" });
      handleScroll();
    }
  }, [activeCell, studentWidth, definitivaWidth, headerHeight, students.length, evaluations.length, handleScroll]);

  /* ------------------------------------------------------------------ */

  if (evaluations.length === 0 || students.length === 0) {
    return <EmptyMatrix students={students} hasStudents={students.length > 0} onOpenAnalysis={() => setAnalysisOpen(true)} />;
  }

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={attachContainer}
        onScroll={handleScroll}
        className="gc-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain"
      >
      <table
        role="grid"
        aria-label="Matriz de calificaciones del grupo"
        aria-rowcount={students.length + 1}
        aria-colcount={evaluations.length + 2}
        className="border-separate border-spacing-0"
        style={{ width: totalWidth, minWidth: totalWidth, tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: studentWidth }} />
          {evaluations.map((evaluation, index) => (
            <col
              key={evaluation.id}
              style={{ width: evaluationWidths[index] ?? columnWidth(evaluation.id) }}
            />
          ))}
          <col style={{ width: definitivaWidth }} />
        </colgroup>

        <thead>
          <tr>
            <StudentHeaderCell width={studentWidth} headerHeight={headerHeight} />
            {evaluations.map((evaluation, index) => (
              <EvaluationHeader
                key={evaluation.id}
                evaluation={evaluation}
                metric={analytics.byEvaluation.get(evaluation.id)!}
                width={evaluationWidths[index] ?? columnWidth(evaluation.id)}
                baseWidth={baseEvaluationWidths[index] ?? columnWidth(evaluation.id)}
                density={density}
                isSelected={selectedEvaluationId === evaluation.id}
                headerHeight={headerHeight}
              />
            ))}
            <DefinitivaHeaderCell width={definitivaWidth} headerHeight={headerHeight} />
          </tr>
        </thead>

        <tbody>
          {students.map((metrics, rowIndex) => (
            <tr key={metrics.student.id} className="group/row">
              <StudentCell
                metrics={metrics}
                width={studentWidth}
                height={rowHeight}
                density={density}
                isSelected={selectedStudentId === metrics.student.id}
              />
              {evaluations.map((evaluation, colIndex) => (
                <GradeCell
                  key={evaluation.id}
                  metrics={metrics}
                  evaluation={evaluation}
                  evaluationMetric={analytics.byEvaluation.get(evaluation.id)!}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  height={rowHeight}
                  compact={density === "compact"}
                />
              ))}
              <DefinitivaCell metrics={metrics} width={definitivaWidth} height={rowHeight} density={density} />
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Sombras que aparecen solo cuando hay contenido desplazado */}
      <div
        className={cn(
          "pointer-events-none absolute top-0 bottom-0 left-0 w-px transition-opacity duration-200",
          scrolledX ? "opacity-100 gc-shadow-x" : "opacity-0",
        )}
        style={{ width: studentWidth }}
      />
      <div
        className={cn(
          "pointer-events-none absolute top-0 right-0 bottom-0 transition-opacity duration-200",
          scrolledX ? "opacity-100 gc-shadow-xr" : "opacity-0",
        )}
        style={{ width: definitivaWidth }}
      />
      {scrolledY && (
        <div
          className="pointer-events-none absolute top-0 left-0 h-px"
          style={{ width: studentWidth, boxShadow: "0 12px 18px -14px oklch(0 0 0 / 90%)" }}
        />
      )}
    </div>
  );
}

function EmptyMatrix({ students, hasStudents, onOpenAnalysis }: { students: StudentMetrics[]; hasStudents: boolean; onOpenAnalysis: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gc-cobalt)]/20 bg-[var(--gc-cobalt)]/7 p-4">
        <div className="flex items-start gap-3 text-left">
          <div className="glass flex size-10 shrink-0 items-center justify-center rounded-2xl"><Info className="size-5 text-[var(--gc-cobalt)]" /></div>
          <div>
            <div className="text-sm font-semibold">{hasStudents ? "Planilla lista para comenzar" : "Ningún estudiante coincide con los filtros"}</div>
            <p className="mt-1 max-w-xl text-[11px] text-muted-foreground">{hasStudents ? "La lista de estudiantes está lista. Crea la primera evaluación para comenzar a registrar calificaciones." : "Quita algún filtro activo para volver a ver el grupo completo. Los filtros están siempre visibles en la barra superior."}</p>
          </div>
        </div>
        <button type="button" onClick={onOpenAnalysis} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/10">Ver el análisis del grupo</button>
      </div>
      {hasStudents && (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((metrics, index) => (
            <div key={metrics.student.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left">
              <span className="gc-num flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--gc-cobalt)]/12 text-[9px] text-[var(--gc-cobalt)]">{index + 1}</span>
              <span className="min-w-0"><span className="block truncate text-[11px] font-medium">{metrics.student.fullName}</span><span className="gc-num mt-0.5 block text-[9px] text-muted-foreground">{metrics.student.code}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

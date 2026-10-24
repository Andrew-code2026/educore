import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPlus, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter, useGradeCenterActions, useGradeCenterGrid } from "../../state/GradeCenterContext";
import { ROW_HEIGHT } from "../../state/preferences";
import { EMPTY_FILTERS, hasActiveFilters } from "../../domain/selectors";
import { DefinitivaCell, DefinitivaHeaderCell, StudentCell, StudentHeaderCell } from "./Cells";
import { EvaluationHeader } from "./EvaluationHeader";
import { GradeCell } from "./GradeCell";
import { useGradeCenterDialogs } from "../dialogs/DialogsProvider";
import type { Density, Evaluation, GradeValue } from "../../types";
import type { StudentMetrics } from "../../domain/metrics";

const HEADER_HEIGHT: Record<Density, number> = { compact: 44, standard: 62, cozy: 70 };

type EditorTarget = { studentId: string; evaluationId: string } | null;

/**
 * La matriz es el centro absoluto de la experiencia.
 *
 * Un solo contenedor de scroll gobierna los dos ejes: el estudiante queda fijo
 * a la izquierda, la definitiva fija a la derecha y los encabezados fijos
 * arriba. Filas y celdas están memorizadas y reciben solo valores primitivos:
 * navegar con el teclado repinta dos celdas, no la planilla entera.
 */
export function MatrixCanvas({ densityOverride, className }: { densityOverride?: Density; className?: string }) {
  const {
    dataset,
    students,
    evaluations,
    preferences,
    analytics,
    selectedStudentId,
    selectedEvaluationId,
    selectedRows,
    readOnly,
    columnWidth,
  } = useGradeCenter();
  const { activeCell, editing, selectedCells, pulse } = useGradeCenterGrid();
  const filtersActive = hasActiveFilters(preferences.filters);
  const actions = useGradeCenterActions();

  const density: Density = densityOverride ?? preferences.density;
  const rowHeight = ROW_HEIGHT[density];
  const headerHeight = HEADER_HEIGHT[density];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState({ x: false, y: false });
  const [containerWidth, setContainerWidth] = useState(0);
  const [editor, setEditor] = useState<EditorTarget>(null);

  /* Medición del contenedor para repartir el espacio libre ------------- */

  const observerRef = useRef<ResizeObserver | null>(null);
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    containerRef.current = node;
    if (!node) return;
    // Mientras la planilla está oculta (otra vista activa) mide 0: se ignora para no
    // recalcular todas las columnas al volver.
    const measure = () => {
      if (node.clientWidth > 0) setContainerWidth(node.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  // Al cambiar de planilla, se arranca siempre arriba a la izquierda.
  useEffect(() => {
    const node = containerRef.current;
    if (node) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
    setEditor(null);
  }, [dataset.key]);

  const studentWidth = preferences.studentColWidth;
  const definitivaWidth = preferences.definitivaColWidth;
  const baseEvaluationWidths = useMemo(
    () => evaluations.map((evaluation) => columnWidth(evaluation.id)),
    [evaluations, columnWidth],
  );
  const baseTotal = studentWidth + definitivaWidth + baseEvaluationWidths.reduce((acc, value) => acc + value, 0);
  const spare = Math.max(0, containerWidth - baseTotal - 1);
  const bonus = evaluations.length > 0 ? Math.min(160, spare / evaluations.length) : 0;
  const evaluationWidths = useMemo(
    () => baseEvaluationWidths.map((value) => Math.floor(value + bonus)),
    [baseEvaluationWidths, bonus],
  );
  const totalWidth = studentWidth + definitivaWidth + evaluationWidths.reduce((acc, value) => acc + value, 0);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft, scrollTop } = event.currentTarget;
    const x = scrollLeft > 2;
    const y = scrollTop > 2;
    setScrolled((current) => (current.x === x && current.y === y ? current : { x, y }));
  }, []);

  /* La celda activa siempre queda a la vista --------------------------- */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cell = container.querySelector<HTMLElement>(`[data-cell="${activeCell.row}:${activeCell.col}"]`);
    if (!cell) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const leftEdge = containerRect.left + studentWidth;
    const rightEdge = containerRect.right - definitivaWidth;
    const topEdge = containerRect.top + headerHeight;
    let dx = 0;
    let dy = 0;
    if (cellRect.left < leftEdge) dx = cellRect.left - leftEdge;
    else if (cellRect.right > rightEdge) dx = cellRect.right - rightEdge;
    if (cellRect.top < topEdge) dy = cellRect.top - topEdge;
    else if (cellRect.bottom > containerRect.bottom) dy = cellRect.bottom - containerRect.bottom;
    if (dx !== 0 || dy !== 0) container.scrollBy({ left: dx, top: dy });

    // El foco sigue a la celda activa, salvo que el docente esté escribiendo
    // en otro lugar (editor flotante, buscador, un diálogo…).
    const focused = document.activeElement as HTMLElement | null;
    const focusIsFree = !focused || focused === document.body || container.contains(focused);
    if (focusIsFree && focused !== cell && focused?.tagName !== "INPUT") cell.focus({ preventScroll: true });
  }, [activeCell, studentWidth, definitivaWidth, headerHeight]);

  /* Editor flotante: uno solo para toda la matriz ----------------------- */

  const layoutRef = useRef({ students, evaluations });
  layoutRef.current = { students, evaluations };

  const openEditor = useCallback((studentId: string, evaluationId: string) => setEditor({ studentId, evaluationId }), []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const moveEditor = useCallback(
    (row: number, col: number, deltaRow: number, deltaCol: number) => {
      const { students: rows, evaluations: cols } = layoutRef.current;
      const nextRow = row + deltaRow;
      const nextCol = col + deltaCol;
      if (nextRow < 0 || nextRow >= rows.length || nextCol < 0 || nextCol >= cols.length) {
        setEditor(null);
        actions.focusCell(row, col);
        return;
      }
      setEditor({ studentId: rows[nextRow].student.id, evaluationId: cols[nextCol].id });
      actions.focusCell(nextRow, nextCol);
    },
    [actions],
  );

  /* Selección agrupada por fila (valores primitivos para la memorización) */

  const selectedRowSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const selectedByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of selectedCells) {
      const [studentId, evaluationId] = key.split("::");
      map.set(studentId, `${map.get(studentId) ?? ""}|${evaluationId}`);
    }
    return map;
  }, [selectedCells]);

  const pulseTarget = useMemo(() => {
    if (!pulse) return null;
    const [studentId, evaluationId] = pulse.key.split("::");
    return { studentId, evaluationId, at: pulse.at };
  }, [pulse]);

  if (evaluations.length === 0 || students.length === 0) {
    return (
      <EmptyMatrix
        reason={students.length === 0 && filtersActive ? "filtered" : evaluations.length === 0 ? "no-evaluations" : "no-students"}
        readOnly={readOnly}
        hiddenEvaluations={preferences.hiddenEvaluations.length > 0 && dataset.evaluations.length > 0}
      />
    );
  }

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={attachContainer}
        onScroll={handleScroll}
        className="gc-scroll gc-matrix relative min-h-0 flex-1 overflow-auto overscroll-contain"
        data-scrolled-x={scrolled.x || undefined}
        data-scrolled-y={scrolled.y || undefined}
        data-selecting={selectedRows.length > 0 || undefined}
      >
        <table
          role="grid"
          aria-label="Planilla de calificaciones"
          aria-rowcount={students.length + 1}
          aria-colcount={evaluations.length + 2}
          aria-readonly={readOnly || undefined}
          className="border-separate border-spacing-0"
          style={{ width: totalWidth, minWidth: totalWidth, tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: studentWidth }} />
            {evaluations.map((evaluation, index) => (
              <col key={evaluation.id} style={{ width: evaluationWidths[index] }} />
            ))}
            <col style={{ width: definitivaWidth }} />
          </colgroup>

          <thead>
            <tr>
              <StudentHeaderCell
                width={studentWidth}
                headerHeight={headerHeight}
                visibleCount={students.length}
                selectedCount={selectedRows.length}
              />
              {evaluations.map((evaluation, index) => (
                <EvaluationHeader
                  key={evaluation.id}
                  evaluation={evaluation}
                  metric={analytics.byEvaluation.get(evaluation.id)!}
                  width={evaluationWidths[index]}
                  baseWidth={baseEvaluationWidths[index]}
                  density={density}
                  isSelected={selectedEvaluationId === evaluation.id}
                  headerHeight={headerHeight}
                  readOnly={readOnly}
                />
              ))}
              <DefinitivaHeaderCell width={definitivaWidth} headerHeight={headerHeight} />
            </tr>
          </thead>

          <tbody>
            {students.map((metrics, rowIndex) => {
              const studentId = metrics.student.id;
              const isActiveRow = activeCell.row === rowIndex;
              return (
                <MatrixRow
                  key={studentId}
                  metrics={metrics}
                  rowIndex={rowIndex}
                  evaluations={evaluations}
                  activeCol={isActiveRow ? activeCell.col : -1}
                  editing={isActiveRow && editing}
                  editorEvaluationId={editor?.studentId === studentId ? editor.evaluationId : null}
                  rowSelected={selectedRowSet.has(studentId)}
                  selectedEvaluations={selectedByStudent.get(studentId) ?? ""}
                  pulseEvaluationId={pulseTarget?.studentId === studentId ? pulseTarget.evaluationId : null}
                  pulseAt={pulseTarget?.studentId === studentId ? pulseTarget.at : 0}
                  isStudentSelected={selectedStudentId === studentId}
                  rowHeight={rowHeight}
                  studentWidth={studentWidth}
                  definitivaWidth={definitivaWidth}
                  density={density}
                  quickEdit={preferences.quickEdit}
                  readOnly={readOnly}
                  onOpenEditor={openEditor}
                  onCloseEditor={closeEditor}
                  onMoveEditor={moveEditor}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface MatrixRowProps {
  metrics: StudentMetrics;
  rowIndex: number;
  evaluations: Evaluation[];
  activeCol: number;
  editing: boolean;
  editorEvaluationId: string | null;
  rowSelected: boolean;
  selectedEvaluations: string;
  pulseEvaluationId: string | null;
  pulseAt: number;
  isStudentSelected: boolean;
  rowHeight: number;
  studentWidth: number;
  definitivaWidth: number;
  density: Density;
  quickEdit: boolean;
  readOnly: boolean;
  onOpenEditor: (studentId: string, evaluationId: string) => void;
  onCloseEditor: () => void;
  onMoveEditor: (row: number, col: number, deltaRow: number, deltaCol: number) => void;
}

const MatrixRow = memo(function MatrixRow({
  metrics,
  rowIndex,
  evaluations,
  activeCol,
  editing,
  editorEvaluationId,
  rowSelected,
  selectedEvaluations,
  pulseEvaluationId,
  pulseAt,
  isStudentSelected,
  rowHeight,
  studentWidth,
  definitivaWidth,
  density,
  quickEdit,
  readOnly,
  onOpenEditor,
  onCloseEditor,
  onMoveEditor,
}: MatrixRowProps) {
  const grades = useMemo(() => {
    const map = new Map<string, GradeValue>();
    for (const outcome of metrics.outcomes) map.set(outcome.evaluation.id, outcome.grade);
    return map;
  }, [metrics]);

  return (
    <tr className={cn("gc-row", activeCol >= 0 && "gc-row-active", rowSelected && "gc-row-selected")}>
      <StudentCell
        metrics={metrics}
        width={studentWidth}
        height={rowHeight}
        density={density}
        rowSelected={rowSelected}
        isSelected={isStudentSelected}
      />
      {evaluations.map((evaluation, colIndex) => (
        <GradeCell
          key={evaluation.id}
          student={metrics.student}
          evaluation={evaluation}
          grade={grades.get(evaluation.id) ?? null}
          rowIndex={rowIndex}
          colIndex={colIndex}
          height={rowHeight}
          compact={density === "compact"}
          isActive={activeCol === colIndex}
          isEditing={activeCol === colIndex && editing}
          isSelected={rowSelected || selectedEvaluations.includes(`|${evaluation.id}`)}
          pulseAt={pulseEvaluationId === evaluation.id ? pulseAt : 0}
          editorOpen={editorEvaluationId === evaluation.id}
          quickEdit={quickEdit}
          readOnly={readOnly}
          onOpenEditor={onOpenEditor}
          onCloseEditor={onCloseEditor}
          onMoveEditor={onMoveEditor}
        />
      ))}
      <DefinitivaCell metrics={metrics} width={definitivaWidth} height={rowHeight} density={density} />
    </tr>
  );
});

function EmptyMatrix({
  reason,
  readOnly,
  hiddenEvaluations,
}: {
  reason: "filtered" | "no-evaluations" | "no-students";
  readOnly: boolean;
  hiddenEvaluations: boolean;
}) {
  const { setFilters, showAllEvaluations } = useGradeCenter();
  const dialogs = useGradeCenterDialogs();

  const content =
    reason === "filtered"
      ? {
          title: "Ningún estudiante coincide",
          body: "Ajusta la búsqueda o quita los filtros para volver a ver el grupo completo.",
          action: { label: "Quitar filtros", icon: <FilterX className="size-4" />, run: () => setFilters(EMPTY_FILTERS) },
        }
      : reason === "no-evaluations" && hiddenEvaluations
        ? {
            title: "Todas las columnas están ocultas",
            body: "Vuelve a mostrar las evaluaciones para seguir calificando.",
            action: { label: "Mostrar evaluaciones", icon: null, run: showAllEvaluations },
          }
        : reason === "no-evaluations"
          ? {
              title: "Aún no hay evaluaciones",
              body: "Crea la primera evaluación para empezar a registrar calificaciones.",
              action: readOnly
                ? null
                : { label: "Nueva evaluación", icon: <ClipboardPlus className="size-4" />, run: dialogs.openNewEvaluation },
            }
          : { title: "Esta planilla no tiene estudiantes", body: "Cuando el grupo tenga estudiantes matriculados aparecerán aquí.", action: null };

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="text-base font-semibold">{content.title}</div>
        <p className="mt-1.5 text-sm text-muted-foreground">{content.body}</p>
        {content.action && (
          <button
            type="button"
            onClick={content.action.run}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--gc-cobalt)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--gc-cobalt)]/90"
          >
            {content.action.icon}
            {content.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

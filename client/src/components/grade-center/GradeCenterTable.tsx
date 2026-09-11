import * as React from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { GradeCellEditorPopoverContent } from "./GradeCellEditorPopover";
import { StudentSummaryPopover } from "./StudentSummaryPopover";
import { AssessmentStatisticsPopover } from "./AssessmentStatisticsPopover";
import {
  studentName,
  numberValue,
  calculateDefinitiva,
  getPerformanceTone,
  assessmentLabels,
  parseGradeInput,
  validateGradeAgainstScale,
  type GradeScaleConfig,
} from "./gradeCenterUtils";
import { calculateStudentProjection } from "./gradeIntelligenceUtils";

export interface GradeCenterTableRow {
  enrollment: {
    id: number;
    studentUserId: number;
    courseId: number;
    academicYearId: number;
  };
  student: any;
  values: Array<{
    assessment: {
      id: number;
      title: string;
      assessmentType: string;
      maxValue: number;
      weight: number;
      status: string;
    };
    grade: {
      id?: number;
      value: number | null;
      comment?: string | null;
      status?: string;
    } | null;
  }>;
  average: number | null;
}

export interface Assessment {
  id: number;
  title: string;
  assessmentType: string;
  maxValue: number;
  weight: number;
  status: string;
}

interface GradeCenterTableProps {
  assessments: Assessment[];
  rows: GradeCenterTableRow[];
  courseName?: string;
  subjectName?: string;
  scale?: GradeScaleConfig | null;
  pendingGrades: Record<string, number | null>;
  pendingComments: Record<string, string>;
  canWrite?: boolean;
  onSaveCellGrade: (
    assessmentId: number,
    studentId: number,
    value: number | null,
    comment?: string
  ) => Promise<void> | void;
  onCellPendingChange?: (
    assessmentId: number,
    studentId: number,
    value: number | null
  ) => void;
  onStudentClick?: (studentId: number) => void;
  onOpenSimulator?: (studentRow: GradeCenterTableRow) => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
  groupAverage?: number | null;
  externalTargetCell?: { studentUserId: number; assessmentId: number; ts: number } | null;
  isSaving?: boolean;
  selectedStudentIds?: number[];
  onToggleStudent?: (studentId: number) => void;
  onToggleAllVisible?: () => void;
}

export function GradeCenterTable({
  assessments,
  rows,
  courseName,
  subjectName,
  scale,
  pendingGrades,
  pendingComments,
  canWrite = true,
  onSaveCellGrade,
  onCellPendingChange,
  onStudentClick,
  onOpenSimulator,
  onOpenStudentStats,
  groupAverage,
  externalTargetCell,
  isSaving = false,
  selectedStudentIds = [],
  onToggleStudent,
  onToggleAllVisible,
}: GradeCenterTableProps) {
  // Celda activa con el popover de calificación abierto
  const [activeCell, setActiveCell] = React.useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // Caracter inicial para pre-llenar cuando se empieza a escribir con el teclado en la tabla
  const [initialDraft, setInitialDraft] = React.useState<string | undefined>(undefined);

  // Celda con foco de navegación en el grid
  const [focusedCell, setFocusedCell] = React.useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const clipboardRef = React.useRef<number | null>(null);

  // Navegación directa desde componentes externos (ej. lista de pendientes)
  React.useEffect(() => {
    if (!externalTargetCell) return;
    const rowIndex = rows.findIndex(
      r => r.enrollment.studentUserId === externalTargetCell.studentUserId
    );
    const colIndex = assessments.findIndex(a => a.id === externalTargetCell.assessmentId);
    if (rowIndex !== -1 && colIndex !== -1) {
      setActiveCell({ rowIndex, colIndex });
      setFocusedCell({ rowIndex, colIndex });
      setInitialDraft(undefined);
    }
  }, [externalTargetCell, rows, assessments]);

  // Obtener el valor actual de una celda teniendo en cuenta cambios locales pendientes
  const getCellValue = React.useCallback(
    (assessmentId: number, studentId: number, initialValue: number | null) => {
      const key = `${assessmentId}:${studentId}`;
      if (Object.prototype.hasOwnProperty.call(pendingGrades, key)) {
        return pendingGrades[key];
      }
      return initialValue;
    },
    [pendingGrades]
  );

  // Obtener el comentario actual de una celda
  const getCellComment = React.useCallback(
    (assessmentId: number, studentId: number, initialComment?: string | null) => {
      const key = `${assessmentId}:${studentId}`;
      if (Object.prototype.hasOwnProperty.call(pendingComments, key)) {
        return pendingComments[key];
      }
      return initialComment || "";
    },
    [pendingComments]
  );

  // Calcular la definitiva reactiva de una fila sumando notas originales + pendientes
  const getRowDefinitiva = React.useCallback(
    (row: GradeCenterTableRow) => {
      const liveValues = row.values.map(v => ({
        value: getCellValue(v.assessment.id, row.enrollment.studentUserId, v.grade?.value ?? null),
        maxValue: v.assessment.maxValue,
        weight: v.assessment.weight,
      }));
      return calculateDefinitiva(liveValues);
    },
    [getCellValue]
  );

  // Calcular la proyección estimada de una fila si faltan evaluaciones
  const getRowProjection = React.useCallback(
    (row: GradeCenterTableRow) => {
      const liveValues = row.values.map(v => ({
        value: getCellValue(v.assessment.id, row.enrollment.studentUserId, v.grade?.value ?? null),
        maxValue: v.assessment.maxValue,
        weight: v.assessment.weight,
      }));
      return calculateStudentProjection(liveValues, scale);
    },
    [getCellValue, scale]
  );

  // Copiar valor de una celda
  const handleCopy = (cellVal: number | null) => {
    clipboardRef.current = cellVal;
    const textToCopy = cellVal !== null && cellVal !== undefined ? String(cellVal) : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    toast.info(cellVal !== null ? `Nota ${cellVal} copiada` : "Celda vacía copiada");
  };

  // Pegar valor en una celda
  const handlePaste = async (assessmentId: number, studentId: number, maxVal: number) => {
    if (!canWrite) return;
    let pastedText = "";
    try {
      if (navigator.clipboard) {
        pastedText = await navigator.clipboard.readText();
      }
    } catch {
      pastedText = clipboardRef.current !== null ? String(clipboardRef.current) : "";
    }
    if (!pastedText && clipboardRef.current !== null) {
      pastedText = String(clipboardRef.current);
    }

    const parsed = parseGradeInput(pastedText);
    if (parsed === null) {
      onCellPendingChange?.(assessmentId, studentId, null);
      toast.success("Nota borrada (cambio pendiente)");
      return;
    }

    if (isNaN(parsed)) {
      toast.error("El contenido pegado no es un número válido");
      return;
    }

    const validation = validateGradeAgainstScale(parsed, scale, maxVal);
    if (!validation.valid) {
      toast.error(validation.error || "El valor pegado excede la escala institucional");
      return;
    }

    onCellPendingChange?.(assessmentId, studentId, parsed);
    toast.success(`Nota ${parsed} pegada`);
  };

  // Flujo único y centralizado para guardar y avanzar (handleSaveAndAdvance)
  const handleSaveAndAdvance = React.useCallback(
    (
      val: number | null,
      direction: "down" | "up" | "right" | "left" | "stay" = "down",
      comment?: string
    ) => {
      if (!activeCell) return;
      const { rowIndex, colIndex } = activeCell;
      const assessment = assessments[colIndex];
      const row = rows[rowIndex];
      if (!assessment || !row) return;

      const studentId = row.enrollment.studentUserId;

      // 1. Registrar cambio pendiente de la nota (actualiza reactivamente la definitiva)
      onCellPendingChange?.(assessment.id, studentId, val);

      // 2. Si hubo comentario, guardarlo
      if (comment !== undefined && onSaveCellGrade) {
        void onSaveCellGrade(assessment.id, studentId, val, comment);
      }

      setInitialDraft(undefined);

      // 3. Buscar siguiente estudiante según la dirección
      if (direction === "down") {
        const nextRow = rowIndex + 1;
        if (nextRow < rows.length) {
          setActiveCell({ rowIndex: nextRow, colIndex });
          setFocusedCell({ rowIndex: nextRow, colIndex });
        } else {
          // PRUEBA 5: En el último estudiante, no intentar acceder a fila inexistente ni romper el popover
          setActiveCell(null);
          setFocusedCell({ rowIndex, colIndex });
        }
      } else if (direction === "up") {
        const prevRow = rowIndex - 1;
        if (prevRow >= 0) {
          setActiveCell({ rowIndex: prevRow, colIndex });
          setFocusedCell({ rowIndex: prevRow, colIndex });
        } else {
          setActiveCell(null);
          setFocusedCell({ rowIndex, colIndex });
        }
      } else if (direction === "right") {
        const nextCol = colIndex + 1;
        if (nextCol < assessments.length) {
          setActiveCell({ rowIndex, colIndex: nextCol });
          setFocusedCell({ rowIndex, colIndex: nextCol });
        } else {
          setActiveCell(null);
        }
      } else if (direction === "left") {
        const prevCol = colIndex - 1;
        if (prevCol >= 0) {
          setActiveCell({ rowIndex, colIndex: prevCol });
          setFocusedCell({ rowIndex, colIndex: prevCol });
        } else {
          setActiveCell(null);
        }
      } else if (direction === "stay") {
        setActiveCell(null);
      }
    },
    [activeCell, assessments, rows, onCellPendingChange, onSaveCellGrade]
  );

  // Manejo de teclado cuando la celda está enfocada en modo tabla
  const handleCellKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    cellVal: number | null
  ) => {
    const assessment = assessments[colIndex];
    const row = rows[rowIndex];
    if (!assessment || !row) return;
    const studentId = row.enrollment.studentUserId;

    // Copiar / Pegar con teclado
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      handleCopy(cellVal);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      void handlePaste(assessment.id, studentId, assessment.maxValue);
      return;
    }

    // Iniciar edición abriendo el popover si el usuario presiona un número o separador decimal
    if ((e.key >= "0" && e.key <= "9") || e.key === "." || e.key === ",") {
      e.preventDefault();
      setInitialDraft(e.key);
      setActiveCell({ rowIndex, colIndex });
      setFocusedCell({ rowIndex, colIndex });
      return;
    }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setInitialDraft(undefined);
      setActiveCell({ rowIndex, colIndex });
      setFocusedCell({ rowIndex, colIndex });
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onCellPendingChange?.(assessment.id, studentId, null);
      return;
    }

    // Navegación con flechas entre celdas
    if (e.key === "ArrowDown" && rowIndex + 1 < rows.length) {
      e.preventDefault();
      setFocusedCell({ rowIndex: rowIndex + 1, colIndex });
    } else if (e.key === "ArrowUp" && rowIndex > 0) {
      e.preventDefault();
      setFocusedCell({ rowIndex: rowIndex - 1, colIndex });
    } else if (e.key === "ArrowRight" && colIndex + 1 < assessments.length) {
      e.preventDefault();
      setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
    } else if (e.key === "ArrowLeft" && colIndex > 0) {
      e.preventDefault();
      setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey && colIndex > 0) {
        setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
      } else if (!e.shiftKey && colIndex + 1 < assessments.length) {
        setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
      }
    }
  };

  const isAllSelected = rows.length > 0 && selectedStudentIds.length === rows.length;
  const isPartiallySelected =
    selectedStudentIds.length > 0 && selectedStudentIds.length < rows.length;

  const activeRow = activeCell ? rows[activeCell.rowIndex] : null;
  const activeAssessment = activeCell ? assessments[activeCell.colIndex] : null;

  return (
    <Popover
      open={Boolean(activeCell && activeRow && activeAssessment)}
      onOpenChange={open => {
        if (!open) {
          setActiveCell(null);
          setInitialDraft(undefined);
        }
      }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(29,78,137,0.04)] dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table
            className="w-full min-w-[800px] border-collapse text-left text-sm"
            role="grid"
            aria-label="Tabla del Grade Center"
          >
            {/* ENCABEZADOS DE LA TABLA */}
            <thead>
            <tr className="border-b border-slate-200/90 bg-slate-50/90 text-xs text-slate-500 uppercase tracking-wider backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
              {/* Columna Sticky de Checkbox de Selección */}
              <th
                scope="col"
                className="sticky left-0 z-30 w-11 min-w-[44px] max-w-[44px] bg-slate-50/95 px-2 py-3.5 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] backdrop-blur-md dark:bg-slate-900/95"
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
                    onCheckedChange={() => onToggleAllVisible?.()}
                    aria-label="Seleccionar todos los estudiantes visibles"
                  />
                </div>
              </th>

              {/* Columna Sticky de Estudiantes */}
              <th
                scope="col"
                className="sticky left-[44px] z-20 min-w-[210px] max-w-[260px] bg-slate-50/95 px-3 py-3.5 font-semibold text-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.03)] backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span>Estudiante</span>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {rows.length}
                  </span>
                </div>
              </th>

              {/* Columnas de Evaluaciones */}
              {assessments.map(assessment => {
                const typeLabel =
                  assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType;
                return (
                  <th
                    key={assessment.id}
                    scope="col"
                    className="min-w-[110px] max-w-[150px] p-1.5 text-center font-medium"
                  >
                    <AssessmentStatisticsPopover
                      assessment={assessment}
                      rows={rows}
                      pendingGrades={pendingGrades}
                      scale={scale}
                      groupAverage={groupAverage}
                    >
                      <button
                        type="button"
                        className="group flex flex-col items-center justify-center w-full rounded-xl px-2 py-2 transition hover:bg-slate-200/60 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                        title={`Click para ver estadísticas de ${assessment.title}`}
                      >
                        <span
                          className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[130px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                          title={assessment.title}
                        >
                          {assessment.title}
                        </span>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-normal normal-case text-slate-500 dark:text-slate-400">
                          <span className="truncate max-w-[70px]">{typeLabel}</span>
                          <span>·</span>
                          <span className="font-semibold text-[var(--edc-primary)]">
                            {assessment.weight}%
                          </span>
                        </div>
                      </button>
                    </AssessmentStatisticsPopover>
                  </th>
                );
              })}

              {/* Columna Definitiva */}
              <th
                scope="col"
                className="sticky right-0 z-20 min-w-[100px] border-l border-slate-200/80 bg-slate-100/80 px-4 py-3.5 text-center font-bold text-slate-800 shadow-[-2px_0_6px_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-850/80 dark:text-white"
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs font-bold tracking-tight">Definitiva</span>
                  <span className="mt-0.5 text-[10px] font-normal normal-case text-slate-500 dark:text-slate-400">
                    Ponderada
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          {/* CUERPO DE LA TABLA */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.map((row, rowIndex) => {
              const student = row.student;
              const sName = studentName(student);
              const studentId = row.enrollment.studentUserId;
              const definitiva = getRowDefinitiva(row);
              const definitivaTone = getPerformanceTone(definitiva);
              const projection = getRowProjection(row);
              const isSelected = selectedStudentIds.includes(studentId);

              return (
                <tr
                  key={row.enrollment.id}
                  className={`group transition-colors duration-150 ${
                    isSelected
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : "hover:bg-[var(--edc-secondary)]/15 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Columna Sticky de Checkbox */}
                  <td
                    className={`sticky left-0 z-20 w-11 min-w-[44px] max-w-[44px] px-2 py-3 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm ${
                      isSelected
                        ? "bg-blue-50/95 dark:bg-slate-900/95"
                        : "bg-white/95 group-hover:bg-slate-50/95 dark:bg-slate-900/95 dark:group-hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleStudent?.(studentId)}
                        aria-label={`Seleccionar a ${sName}`}
                      />
                    </div>
                  </td>

                  {/* Columna Sticky de Estudiante con StudentSummaryPopover */}
                  <td
                    className={`sticky left-[44px] z-10 px-3 py-3 shadow-[2px_0_6px_rgba(0,0,0,0.02)] backdrop-blur-sm ${
                      isSelected
                        ? "bg-blue-50/95 dark:bg-slate-900/95"
                        : "bg-white/95 group-hover:bg-slate-50/95 dark:bg-slate-900/95 dark:group-hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--edc-secondary)] text-xs font-bold text-[var(--edc-primary)]">
                        {sName
                          .split(" ")
                          .slice(0, 2)
                          .map(part => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <StudentSummaryPopover
                          studentRow={row}
                          courseName={courseName}
                          subjectName={subjectName}
                          scale={scale}
                          groupAverage={groupAverage}
                          rows={rows}
                          onViewDetail={() => onStudentClick?.(studentId)}
                          onOpenSimulator={onOpenSimulator}
                          onOpenStudentStats={onOpenStudentStats}
                        >
                          <button
                            type="button"
                            className="block truncate text-left text-xs font-semibold text-slate-800 hover:text-[var(--edc-primary)] focus:outline-none transition dark:text-slate-200 cursor-pointer"
                            title={`${sName} (Clic para resumen rápido)`}
                          >
                            {sName}
                          </button>
                        </StudentSummaryPopover>
                        <p className="truncate text-[11px] text-slate-400">ID · {studentId}</p>
                      </div>
                    </div>
                  </td>

                  {/* Celdas de Calificaciones */}
                  {assessments.map((assessment, colIndex) => {
                    const item = row.values.find(v => v.assessment.id === assessment.id);
                    const cellVal = getCellValue(assessment.id, studentId, item?.grade?.value ?? null);
                    const cellComment = getCellComment(assessment.id, studentId, item?.grade?.comment);
                    const isCellOpen =
                      activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
                    const isFocused =
                      focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === colIndex;
                    const hasPendingChange = Object.prototype.hasOwnProperty.call(
                      pendingGrades,
                      `${assessment.id}:${studentId}`
                    );

                    const cellButton = (
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => {
                          setActiveCell({ rowIndex, colIndex });
                          setInitialDraft(undefined);
                        }}
                        className={`relative flex h-9 w-16 items-center justify-center rounded-xl border text-sm font-semibold transition-all select-none cursor-pointer ${
                          isCellOpen
                            ? "border-[var(--edc-primary)] ring-2 ring-[var(--edc-secondary)] shadow-sm scale-105 z-10 font-bold bg-white dark:bg-slate-800 text-[var(--edc-primary)]"
                            : isFocused
                            ? "ring-2 ring-[var(--edc-primary)] shadow-sm z-10"
                            : ""
                        } ${
                          hasPendingChange
                            ? "border-amber-400 bg-amber-50/80 text-amber-900 shadow-xs font-bold"
                            : cellVal !== null && cellVal < 3.0
                            ? "border-rose-200/90 bg-rose-50/50 text-rose-600 hover:border-rose-300"
                            : cellVal !== null
                            ? "border-slate-200/80 bg-white hover:border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 hover:shadow-xs"
                            : "border-dashed border-slate-200 bg-slate-50/40 text-slate-300 hover:border-slate-300 hover:text-slate-400 hover:bg-slate-100/50"
                        }`}
                        title={`${assessment.title} · ${sName}: ${numberValue(cellVal)} (Clic para calificar)`}
                      >
                        <span>{numberValue(cellVal)}</span>

                        {/* Indicador de cambio sin guardar */}
                        {hasPendingChange && (
                          <span
                            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
                            title="Cambio pendiente por guardar"
                          />
                        )}

                        {/* Indicador de comentario existente */}
                        {cellComment ? (
                          <span
                            title={`Comentario: ${cellComment}`}
                            className="absolute bottom-1 right-1 flex items-center"
                          >
                            <MessageSquare className="h-2.5 w-2.5 text-blue-500 opacity-75" />
                          </span>
                        ) : null}
                      </button>
                    );

                    return (
                      <td
                        key={assessment.id}
                        className="px-2 py-1.5 text-center align-middle"
                        role="gridcell"
                      >
                        <div className="flex items-center justify-center">
                          <div
                            className="group/cell relative flex items-center justify-center"
                            tabIndex={0}
                            onFocus={() => setFocusedCell({ rowIndex, colIndex })}
                            onKeyDown={e => handleCellKeyDown(e, rowIndex, colIndex, cellVal)}
                          >
                            {isCellOpen ? (
                              <PopoverAnchor asChild>{cellButton}</PopoverAnchor>
                            ) : (
                              cellButton
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  {/* Columna Definitiva */}
                  <td
                    className="sticky right-0 z-10 border-l border-slate-200/80 bg-slate-50/90 px-4 py-3 text-center shadow-[-2px_0_6px_rgba(0,0,0,0.02)] backdrop-blur-sm group-hover:bg-slate-100/90 dark:border-slate-800 dark:bg-slate-850/90 dark:group-hover:bg-slate-800"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`text-base font-bold tracking-tight ${definitivaTone.textColor}`}
                      >
                        {numberValue(definitiva)}
                      </span>
                      {definitiva !== null && (
                        <span
                          className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none ${definitivaTone.badgeColor}`}
                        >
                          {definitivaTone.label}
                        </span>
                      )}
                      {projection.hasPending && projection.projectedDefinitiva !== null && (
                        <span
                          className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                          title={`Proyección estimada (${projection.pendingCount} pendiente/s): ${numberValue(projection.projectedDefinitiva)}`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          proy. {numberValue(projection.projectedDefinitiva)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Estado Vacío */}
        {!rows.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No hay estudiantes para mostrar
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Prueba cambiando los filtros o el término de búsqueda.
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Popover único para la tabla: se desplaza suavemente entre filas al calificar sin desmontarse */}
    {activeCell && activeRow && activeAssessment && (
      <GradeCellEditorPopoverContent
        studentName={studentName(activeRow.student)}
        studentId={activeRow.enrollment.studentUserId}
        assessmentId={activeAssessment.id}
        assessmentTitle={activeAssessment.title}
        assessmentType={activeAssessment.assessmentType}
        assessmentWeight={activeAssessment.weight}
        maxValue={activeAssessment.maxValue}
        scale={scale}
        currentValue={getCellValue(
          activeAssessment.id,
          activeRow.enrollment.studentUserId,
          activeRow.values.find(v => v.assessment.id === activeAssessment.id)?.grade?.value ?? null
        )}
        currentComment={getCellComment(
          activeAssessment.id,
          activeRow.enrollment.studentUserId,
          activeRow.values.find(v => v.assessment.id === activeAssessment.id)?.grade?.comment
        )}
        initialDraftValue={initialDraft}
        onSaveAndNavigate={handleSaveAndAdvance}
        onClose={() => {
          setActiveCell(null);
          setInitialDraft(undefined);
        }}
        isSaving={isSaving}
      />
    )}
  </Popover>
  );
}

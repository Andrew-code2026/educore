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
  type GradeGridDensity,
  getGridDensityConfig,
  formatAssessmentCode,
  splitAssessmentTitle,
} from "./gradeCenterUtils";
import { calculateStudentProjection } from "./gradeIntelligenceUtils";

import {
  type GradeFilterKey,
  type GradeViewMode,
} from "./GradeCenterToolbar";

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
      description?: string | null;
      date?: string | Date | null;
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
  description?: string | null;
  date?: string | Date | null;
}

export interface ActiveGradeCell {
  studentUserId: number;
  assessmentId: number;
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
  onClearExternalTargetCell?: () => void;
  isSaving?: boolean;
  selectedStudentIds?: number[];
  onToggleStudent?: (studentId: number) => void;
  onToggleAllVisible?: () => void;
  viewMode?: GradeViewMode;
  onEditAssessment?: (
    assessmentId: number,
    data: { title?: string; weight?: number; date?: Date; description?: string }
  ) => Promise<void> | void;
  onDeleteAssessment?: (assessmentId: number) => Promise<void> | void;
  onFilterPendingForAssessment?: (assessmentId: number) => void;
  density?: GradeGridDensity;
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
  onClearExternalTargetCell,
  isSaving = false,
  selectedStudentIds = [],
  onToggleStudent,
  onToggleAllVisible,
  viewMode = "NOTES",
  density = "standard",
  onEditAssessment,
  onDeleteAssessment,
  onFilterPendingForAssessment,
}: GradeCenterTableProps) {
  const densityConfig = React.useMemo(() => getGridDensityConfig(density), [density]);
  const isCompact = density === "compact";

  // Celda activa con el popover de calificación abierto (identidad lógica inmutable)
  const [activeCell, setActiveCell] = React.useState<ActiveGradeCell | null>(null);

  // Caracter inicial para pre-llenar cuando se empieza a escribir con el teclado en la tabla
  const [initialDraft, setInitialDraft] = React.useState<string | undefined>(undefined);

  // Celda con foco de navegación en el grid (identidad lógica inmutable)
  const [focusedCell, setFocusedCell] = React.useState<ActiveGradeCell | null>(null);

  // Control de popover de resumen de estudiante único y controlado
  const [openStudentSummaryId, setOpenStudentSummaryId] = React.useState<number | null>(null);

  const clipboardRef = React.useRef<number | null>(null);
  const lastConsumedTargetTs = React.useRef<number | null>(null);

  // Navegación directa desde componentes externos (consumo único garantizado sin re-disparo)
  React.useEffect(() => {
    if (!externalTargetCell) return;
    if (lastConsumedTargetTs.current === externalTargetCell.ts) return;
    lastConsumedTargetTs.current = externalTargetCell.ts;

    const targetStudent = rows.find(
      r => r.enrollment.studentUserId === externalTargetCell.studentUserId
    );
    const targetAssessment = assessments.find(a => a.id === externalTargetCell.assessmentId);

    if (targetStudent && targetAssessment) {
      setOpenStudentSummaryId(null);
      setActiveCell({
        studentUserId: externalTargetCell.studentUserId,
        assessmentId: externalTargetCell.assessmentId,
      });
      setFocusedCell({
        studentUserId: externalTargetCell.studentUserId,
        assessmentId: externalTargetCell.assessmentId,
      });
      setInitialDraft(undefined);
      onClearExternalTargetCell?.();
    }
  }, [externalTargetCell, rows, assessments, onClearExternalTargetCell]);

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

  const focusCellElement = React.useCallback((assessmentId: number, studentUserId: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-cell-id="${assessmentId}:${studentUserId}"]`);
      el?.focus();
    });
  }, []);

  // Flujo único y centralizado para guardar y avanzar (handleSaveAndAdvance)
  const handleSaveAndAdvance = React.useCallback(
    (
      val: number | null,
      direction: "down" | "up" | "right" | "left" | "stay" = "down",
      comment?: string
    ) => {
      setOpenStudentSummaryId(null);
      if (!activeCell) return;
      const { studentUserId, assessmentId } = activeCell;
      const rowIndex = rows.findIndex(r => r.enrollment.studentUserId === studentUserId);
      const colIndex = assessments.findIndex(a => a.id === assessmentId);
      if (rowIndex === -1 || colIndex === -1) return;

      // 1. Registrar cambio pendiente de la nota (actualiza reactivamente la definitiva)
      onCellPendingChange?.(assessmentId, studentUserId, val);

      // 2. Si hubo comentario, guardarlo
      if (comment !== undefined && onSaveCellGrade) {
        void onSaveCellGrade(assessmentId, studentUserId, val, comment);
      }

      setInitialDraft(undefined);

      // 3. Buscar siguiente celda según la dirección
      if (direction === "down") {
        const nextRow = rowIndex + 1;
        if (nextRow < rows.length) {
          const nextStudentId = rows[nextRow].enrollment.studentUserId;
          setActiveCell({ studentUserId: nextStudentId, assessmentId });
          setFocusedCell({ studentUserId: nextStudentId, assessmentId });
        } else {
          setActiveCell(null);
          setFocusedCell({ studentUserId, assessmentId });
          focusCellElement(assessmentId, studentUserId);
        }
      } else if (direction === "up") {
        const prevRow = rowIndex - 1;
        if (prevRow >= 0) {
          const prevStudentId = rows[prevRow].enrollment.studentUserId;
          setActiveCell({ studentUserId: prevStudentId, assessmentId });
          setFocusedCell({ studentUserId: prevStudentId, assessmentId });
        } else {
          setActiveCell(null);
          setFocusedCell({ studentUserId, assessmentId });
          focusCellElement(assessmentId, studentUserId);
        }
      } else if (direction === "right") {
        const nextCol = colIndex + 1;
        if (nextCol < assessments.length) {
          const nextAssessmentId = assessments[nextCol].id;
          setActiveCell({ studentUserId, assessmentId: nextAssessmentId });
          setFocusedCell({ studentUserId, assessmentId: nextAssessmentId });
        } else {
          setActiveCell(null);
          setFocusedCell({ studentUserId, assessmentId });
          focusCellElement(assessmentId, studentUserId);
        }
      } else if (direction === "left") {
        const prevCol = colIndex - 1;
        if (prevCol >= 0) {
          const prevAssessmentId = assessments[prevCol].id;
          setActiveCell({ studentUserId, assessmentId: prevAssessmentId });
          setFocusedCell({ studentUserId, assessmentId: prevAssessmentId });
        } else {
          setActiveCell(null);
          setFocusedCell({ studentUserId, assessmentId });
          focusCellElement(assessmentId, studentUserId);
        }
      } else if (direction === "stay") {
        setActiveCell(null);
        setFocusedCell({ studentUserId, assessmentId });
        focusCellElement(assessmentId, studentUserId);
      }
    },
    [activeCell, assessments, rows, onCellPendingChange, onSaveCellGrade, focusCellElement]
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
      setOpenStudentSummaryId(null);
      setInitialDraft(e.key);
      setActiveCell({ studentUserId: studentId, assessmentId: assessment.id });
      setFocusedCell({ studentUserId: studentId, assessmentId: assessment.id });
      return;
    }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setOpenStudentSummaryId(null);
      setInitialDraft(undefined);
      setActiveCell({ studentUserId: studentId, assessmentId: assessment.id });
      setFocusedCell({ studentUserId: studentId, assessmentId: assessment.id });
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
      const nextStudentId = rows[rowIndex + 1].enrollment.studentUserId;
      setFocusedCell({ studentUserId: nextStudentId, assessmentId: assessment.id });
      focusCellElement(assessment.id, nextStudentId);
    } else if (e.key === "ArrowUp" && rowIndex > 0) {
      e.preventDefault();
      const prevStudentId = rows[rowIndex - 1].enrollment.studentUserId;
      setFocusedCell({ studentUserId: prevStudentId, assessmentId: assessment.id });
      focusCellElement(assessment.id, prevStudentId);
    } else if (e.key === "ArrowRight" && colIndex + 1 < assessments.length) {
      e.preventDefault();
      const nextAssessmentId = assessments[colIndex + 1].id;
      setFocusedCell({ studentUserId: studentId, assessmentId: nextAssessmentId });
      focusCellElement(nextAssessmentId, studentId);
    } else if (e.key === "ArrowLeft" && colIndex > 0) {
      e.preventDefault();
      const prevAssessmentId = assessments[colIndex - 1].id;
      setFocusedCell({ studentUserId: studentId, assessmentId: prevAssessmentId });
      focusCellElement(prevAssessmentId, studentId);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey && colIndex > 0) {
        const prevAssessmentId = assessments[colIndex - 1].id;
        setFocusedCell({ studentUserId: studentId, assessmentId: prevAssessmentId });
        focusCellElement(prevAssessmentId, studentId);
      } else if (!e.shiftKey && colIndex + 1 < assessments.length) {
        const nextAssessmentId = assessments[colIndex + 1].id;
        setFocusedCell({ studentUserId: studentId, assessmentId: nextAssessmentId });
        focusCellElement(nextAssessmentId, studentId);
      }
    }
  };

  const isAllSelected = rows.length > 0 && selectedStudentIds.length === rows.length;
  const isPartiallySelected =
    selectedStudentIds.length > 0 && selectedStudentIds.length < rows.length;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(29,78,137,0.04)] dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-auto max-h-[calc(100vh-215px)] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 overscroll-contain">
        <table
          className="w-full border-separate border-spacing-0 text-left text-sm"
          role="grid"
          aria-label="Tabla del Grade Center"
        >
          {/* ENCABEZADOS DE LA TABLA (Sticky Top) */}
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-slate-200/90 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {/* Columna Sticky de Checkbox de Selección (Esquina Superior Izquierda) */}
              <th
                scope="col"
                className={`sticky top-0 left-0 z-40 bg-slate-50 px-1 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 ${densityConfig.headerHeightClass}`}
                style={{
                  width: `${densityConfig.checkboxWidth}px`,
                  minWidth: `${densityConfig.checkboxWidth}px`,
                  maxWidth: `${densityConfig.checkboxWidth}px`,
                }}
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
                    onCheckedChange={() => onToggleAllVisible?.()}
                    aria-label="Seleccionar todos los estudiantes visibles"
                    className="scale-90"
                  />
                </div>
              </th>

              {/* Columna Sticky de Estudiantes (Lateral Izquierda) */}
              <th
                scope="col"
                className={`sticky top-0 z-40 bg-slate-50 px-2 font-semibold text-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.03)] border-r border-b border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 ${densityConfig.headerHeightClass}`}
                style={{
                  left: `${densityConfig.checkboxWidth}px`,
                  width: `${densityConfig.studentWidth}px`,
                  minWidth: `${densityConfig.studentWidth}px`,
                  maxWidth: `${densityConfig.studentWidth}px`,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold">Estudiante</span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {rows.length}
                  </span>
                </div>
              </th>

              {/* Columnas de Evaluaciones (Centro con Scroll) */}
              {assessments.map((assessment, index) => {
                const typeLabel =
                  assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType;
                const assessmentCode = formatAssessmentCode(index, assessment.assessmentType);
                const titleParts = splitAssessmentTitle(assessment.title);

                return (
                  <th
                    key={assessment.id}
                    scope="col"
                    className={`p-0.5 text-center font-medium bg-slate-50 border-b border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 ${densityConfig.headerHeightClass}`}
                    style={{
                      width: `${densityConfig.assessmentWidth}px`,
                      minWidth: `${densityConfig.assessmentWidth}px`,
                      maxWidth: `${densityConfig.assessmentWidth}px`,
                    }}
                  >
                    <AssessmentStatisticsPopover
                      assessment={assessment}
                      rows={rows}
                      pendingGrades={pendingGrades}
                      scale={scale}
                      groupAverage={groupAverage}
                      onEditAssessment={onEditAssessment}
                      onDeleteAssessment={onDeleteAssessment}
                      onFilterPending={onFilterPendingForAssessment}
                      canEdit={canWrite}
                      otherTotalWeight={assessments
                        .filter(a => a.id !== assessment.id)
                        .reduce((sum, a) => sum + Number(a.weight), 0)}
                    >
                      <button
                        type="button"
                        className="group flex flex-col items-center justify-center w-full rounded-lg px-0.5 py-1 transition hover:bg-slate-200/70 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 cursor-pointer"
                        title={`${assessment.title} (${typeLabel} · ${assessment.weight}%). Clic para estadísticas y edición`}
                      >
                        {isCompact ? (
                          <div className="flex flex-col items-center w-full leading-tight">
                            <div className="flex items-center gap-0.5 justify-center leading-none">
                              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-[var(--edc-primary)] transition-colors">
                                {assessmentCode}
                              </span>
                              <span className="text-xs font-bold text-[var(--edc-primary)]">
                                {assessment.weight}%
                              </span>
                            </div>
                            <div className="mt-0.5 w-full text-center leading-[1.1] text-xs font-semibold text-slate-600 dark:text-slate-300">
                              <span className="block truncate" title={assessment.title}>
                                {titleParts.line1}
                              </span>
                              {titleParts.line2 && (
                                <span className="block truncate opacity-85" title={assessment.title}>
                                  {titleParts.line2}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center w-full px-1">
                            <div className="flex items-center gap-1 justify-center leading-none">
                              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-[var(--edc-primary)] transition-colors">
                                {assessmentCode}
                              </span>
                              <span className="text-xs font-bold text-[var(--edc-primary)]">
                                {assessment.weight}%
                              </span>
                            </div>
                            <div className="mt-0.5 w-full text-center leading-tight text-xs font-semibold text-slate-700 dark:text-slate-200">
                              <span className="block truncate" title={assessment.title}>
                                {titleParts.line1}
                              </span>
                              {titleParts.line2 && (
                                <span className="block truncate opacity-85" title={assessment.title}>
                                  {titleParts.line2}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 font-normal truncate mt-0.5">
                              {typeLabel}
                            </span>
                          </div>
                        )}
                      </button>
                    </AssessmentStatisticsPopover>
                  </th>
                );
              })}

              {/* Columna Definitiva (Sticky Derecha) */}
              <th
                scope="col"
                className={`sticky top-0 right-0 z-40 border-l border-b border-slate-200/80 bg-slate-100 px-1 text-center font-bold text-slate-800 shadow-[-2px_0_6px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-850 dark:text-white ${densityConfig.headerHeightClass}`}
                style={{
                  width: `${densityConfig.definitivaWidth}px`,
                  minWidth: `${densityConfig.definitivaWidth}px`,
                  maxWidth: `${densityConfig.definitivaWidth}px`,
                }}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs font-bold tracking-tight">
                    {isCompact ? "Def." : "Definitiva"}
                  </span>
                  {!isCompact && (
                    <span className="mt-0.5 text-xs font-normal normal-case text-slate-500 dark:text-slate-400">
                      Ponderada
                    </span>
                  )}
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

              // Indicadores según ViewMode (reactivo sin tocar celdas ni foco)
              const studentGrades = row.values
                .map(v => getCellValue(v.assessment.id, studentId, v.grade?.value ?? null))
                .filter((g): g is number => g !== null);
              const recordedCount = studentGrades.length;
              const totalAssessments = assessments.length;
              const isAllGraded = recordedCount === totalAssessments && totalAssessments > 0;
              const pendingCountForStudent = row.values.filter(
                v => getCellValue(v.assessment.id, studentId, v.grade?.value ?? null) === null
              ).length;
              let trend: "up" | "down" | "stable" | null = null;
              if (studentGrades.length >= 2) {
                const latest = studentGrades[studentGrades.length - 1];
                const prev = studentGrades[studentGrades.length - 2];
                if (latest - prev >= 0.3) trend = "up";
                else if (prev - latest >= 0.3) trend = "down";
                else trend = "stable";
              }

              return (
                <tr
                  key={row.enrollment.id}
                  className={`group transition-colors duration-150 ${
                    isSelected
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : viewMode === "RISK" && definitiva !== null && definitiva < 3.5
                      ? "bg-rose-50/25 hover:bg-rose-50/40 dark:bg-rose-950/20"
                      : viewMode === "PENDING" && pendingCountForStudent > 0
                      ? "bg-amber-50/15 hover:bg-amber-50/30 dark:bg-amber-950/15"
                      : "hover:bg-[var(--edc-secondary)]/15 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Columna Sticky de Checkbox */}
                  <td
                    className={`sticky left-0 z-20 px-1 py-1.5 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] border-b border-slate-100 dark:border-slate-800/60 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-slate-900"
                        : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-850"
                    }`}
                    style={{
                      width: `${densityConfig.checkboxWidth}px`,
                      minWidth: `${densityConfig.checkboxWidth}px`,
                      maxWidth: `${densityConfig.checkboxWidth}px`,
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleStudent?.(studentId)}
                        aria-label={`Seleccionar a ${sName}`}
                        className="scale-90"
                      />
                    </div>
                  </td>

                  {/* Columna Sticky de Estudiante con StudentSummaryPopover */}
                  <td
                    className={`sticky z-10 px-2 py-1.5 shadow-[2px_0_6px_rgba(0,0,0,0.02)] border-r border-b border-slate-200/80 dark:border-slate-800 dark:border-b-slate-800/60 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-slate-900"
                        : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-850"
                    }`}
                    style={{
                      left: `${densityConfig.checkboxWidth}px`,
                      width: `${densityConfig.studentWidth}px`,
                      minWidth: `${densityConfig.studentWidth}px`,
                      maxWidth: `${densityConfig.studentWidth}px`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`flex shrink-0 items-center justify-center rounded bg-slate-100 text-slate-700 font-bold dark:bg-slate-800 dark:text-slate-300 ${
                          isCompact ? "h-5 w-5 text-xs" : "h-7 w-7 text-xs rounded-lg"
                        }`}
                      >
                        {sName
                          .split(" ")
                          .slice(0, 2)
                          .map(part => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <StudentSummaryPopover
                            studentRow={row}
                            courseName={courseName}
                            subjectName={subjectName}
                            scale={scale}
                            groupAverage={groupAverage}
                            rows={rows}
                            pendingGrades={pendingGrades}
                            open={openStudentSummaryId === studentId}
                            onOpenChange={isOpen => {
                              setOpenStudentSummaryId(isOpen ? studentId : null);
                              if (isOpen) {
                                setActiveCell(null);
                                setInitialDraft(undefined);
                              }
                            }}
                            onOpenSimulator={onOpenSimulator}
                            onOpenStudentStats={onOpenStudentStats}
                          >
                            <button
                              type="button"
                              className="block truncate text-left font-bold text-slate-800 hover:text-[var(--edc-primary)] focus:outline-none transition dark:text-slate-100 cursor-pointer"
                              title={`${sName} (ID ${studentId} · ${courseName ?? "11-2"}). Clic para resumen rápido`}
                              style={{
                                maxWidth: isCompact ? "96px" : "135px",
                                fontSize: isCompact ? "11px" : "12px",
                              }}
                            >
                              {sName}
                            </button>
                          </StudentSummaryPopover>

                          {/* Microindicadores contextuales según ViewMode */}
                          {viewMode === "PERFORMANCE" && trend && (
                            <span
                              className={`inline-flex items-center text-xs font-bold px-0.5 rounded ${
                                trend === "up"
                                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                                  : trend === "down"
                                  ? "text-rose-700 bg-rose-50 dark:bg-rose-950/50"
                                  : "text-slate-600 bg-slate-100 dark:bg-slate-800"
                              }`}
                              title={
                                trend === "up"
                                  ? "Rendimiento mejorando"
                                  : trend === "down"
                                  ? "Rendimiento disminuyendo"
                                  : "Rendimiento estable"
                              }
                            >
                              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
                            </span>
                          )}

                          {viewMode === "RISK" && definitiva !== null && definitiva < 3.5 && (
                            <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                              {isCompact ? "Riesgo" : "Requiere atención"}
                            </span>
                          )}

                          {viewMode === "PENDING" && pendingCountForStudent > 0 && (
                            <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                              {pendingCountForStudent}p
                            </span>
                          )}
                        </div>
                        {!isCompact && (
                          <p className="truncate text-xs text-slate-400 font-normal mt-0.5">
                            ID {studentId} · {courseName ?? "11-2"}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Celdas de Calificaciones */}
                  {assessments.map((assessment, colIndex) => {
                    const item = row.values.find(v => v.assessment.id === assessment.id);
                    const cellVal = getCellValue(assessment.id, studentId, item?.grade?.value ?? null);
                    const cellComment = getCellComment(assessment.id, studentId, item?.grade?.comment);
                    const isCellOpen =
                      activeCell?.studentUserId === studentId && activeCell?.assessmentId === assessment.id;
                    const isFocused =
                      focusedCell?.studentUserId === studentId && focusedCell?.assessmentId === assessment.id;
                    const hasPendingChange = Object.prototype.hasOwnProperty.call(
                      pendingGrades,
                      `${assessment.id}:${studentId}`
                    );

                    const cellButton = (
                      <button
                        type="button"
                        data-cell-id={`${assessment.id}:${studentId}`}
                        disabled={!canWrite}
                        onClick={() => {
                          setOpenStudentSummaryId(null);
                          setActiveCell({ studentUserId: studentId, assessmentId: assessment.id });
                          setFocusedCell({ studentUserId: studentId, assessmentId: assessment.id });
                          setInitialDraft(undefined);
                        }}
                        onFocus={() => setFocusedCell({ studentUserId: studentId, assessmentId: assessment.id })}
                        onKeyDown={e => handleCellKeyDown(e, rowIndex, colIndex, cellVal)}
                        className={`relative flex items-center justify-center rounded border font-semibold transition-all select-none cursor-pointer ${densityConfig.cellButtonClass} ${
                          isCellOpen
                            ? "border-[var(--edc-primary)] ring-2 ring-[var(--edc-secondary)] shadow-sm scale-105 z-10 font-bold bg-white dark:bg-slate-800 text-[var(--edc-primary)]"
                            : isFocused
                            ? "ring-2 ring-[var(--edc-primary)] shadow-sm z-10"
                            : ""
                        } ${
                          hasPendingChange
                            ? "border-amber-400 bg-amber-50/80 text-amber-900 shadow-xs font-bold"
                            : cellVal !== null && cellVal < 3.5
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
                            className="absolute bottom-0.5 right-0.5 flex items-center"
                          >
                            <MessageSquare className="h-2 w-2 text-blue-500 opacity-75" />
                          </span>
                        ) : null}
                      </button>
                    );

                    return (
                      <td
                        key={assessment.id}
                        className={`${densityConfig.cellPaddingClass} text-center align-middle border-b border-slate-100 dark:border-slate-800/60`}
                        role="gridcell"
                        style={{
                          width: `${densityConfig.assessmentWidth}px`,
                          minWidth: `${densityConfig.assessmentWidth}px`,
                          maxWidth: `${densityConfig.assessmentWidth}px`,
                        }}
                      >
                        <div className="flex items-center justify-center">
                          {isCellOpen ? (
                            <Popover
                              open={true}
                              onOpenChange={open => {
                                if (!open) {
                                  setActiveCell(null);
                                  setInitialDraft(undefined);
                                  focusCellElement(assessment.id, studentId);
                                }
                              }}
                            >
                              <PopoverAnchor asChild>
                                {cellButton}
                              </PopoverAnchor>
                              <GradeCellEditorPopoverContent
                                key={`${assessment.id}:${studentId}`}
                                studentName={sName}
                                studentId={studentId}
                                assessmentId={assessment.id}
                                assessmentTitle={assessment.title}
                                assessmentType={assessment.assessmentType}
                                assessmentWeight={assessment.weight}
                                maxValue={assessment.maxValue}
                                scale={scale}
                                currentValue={cellVal}
                                currentComment={cellComment}
                                initialDraftValue={initialDraft}
                                onSaveAndNavigate={handleSaveAndAdvance}
                                onClose={() => {
                                  setActiveCell(null);
                                  setInitialDraft(undefined);
                                  focusCellElement(assessment.id, studentId);
                                }}
                                isSaving={isSaving}
                              />
                            </Popover>
                          ) : (
                            cellButton
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Columna Definitiva (Sticky Derecha) */}
                  <td
                    className="sticky right-0 z-10 border-l border-b border-slate-200/80 border-b-slate-100 bg-slate-50 px-1 py-1.5 text-center shadow-[-2px_0_6px_rgba(0,0,0,0.02)] group-hover:bg-slate-100 dark:border-slate-800 dark:border-b-slate-800/60 dark:bg-slate-850 dark:group-hover:bg-slate-800"
                    style={{
                      width: `${densityConfig.definitivaWidth}px`,
                      minWidth: `${densityConfig.definitivaWidth}px`,
                      maxWidth: `${densityConfig.definitivaWidth}px`,
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`font-black tracking-tight leading-none ${
                          isCompact ? "text-xs" : "text-sm"
                        } ${definitivaTone.textColor}`}
                        title={
                          definitiva !== null
                            ? `Definitiva: ${numberValue(definitiva)} (${definitivaTone.label}) · ${
                                isAllGraded
                                  ? "100% evaluado"
                                  : `Acumulado (${recordedCount}/${totalAssessments})`
                              }`
                            : "Sin calificaciones"
                        }
                      >
                        {numberValue(definitiva)}
                      </span>
                      {isCompact ? (
                        definitiva !== null ? (
                          <span
                            className={`mt-1 inline-block px-1 py-0.2 rounded text-xs font-bold uppercase leading-none tracking-wider ${
                              definitiva >= 4.7
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : definitiva >= 4.0
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                : definitiva >= 3.5
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                            }`}
                            title={
                              definitiva >= 4.7
                                ? "Superior (4.7–5.0)"
                                : definitiva >= 4.0
                                ? "Alto (4.0–4.6)"
                                : definitiva >= 3.5
                                ? "Básico (3.5–3.9)"
                                : "Bajo (< 3.5) · Requiere atención"
                            }
                          >
                            {definitiva >= 4.7
                              ? "Super."
                              : definitiva >= 4.0
                              ? "Alto"
                              : definitiva >= 3.5
                              ? "Básico"
                              : "Bajo"}
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block text-xs text-slate-400">—</span>
                        )
                      ) : (
                        <>
                          {definitiva !== null && (
                            <>
                              <span
                                className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none ${
                                  definitiva >= 4.7
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : definitiva >= 4.0
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                    : definitiva >= 3.5
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                }`}
                              >
                                {definitiva >= 4.7
                                  ? "Superior"
                                  : definitiva >= 4.0
                                  ? "Alto"
                                  : definitiva >= 3.5
                                  ? "Básico"
                                  : "Requiere atención"}
                              </span>
                              <span
                                className={`mt-1 text-xs font-medium leading-none ${
                                  isAllGraded
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-slate-400 dark:text-slate-500"
                                }`}
                                title={
                                  isAllGraded
                                    ? "Todas las evaluaciones del periodo han sido calificadas"
                                    : "Promedio ponderado acumulado sobre evaluaciones calificadas"
                                }
                              >
                                {isAllGraded
                                  ? "100% evaluado"
                                  : `Acumulado (${recordedCount}/${totalAssessments})`}
                              </span>
                            </>
                          )}
                          {definitiva === null && (
                            <span className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800">
                              Sin datos
                            </span>
                          )}
                          {projection.hasPending && projection.projectedDefinitiva !== null && (
                            <span
                              className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                              title={`Proyección estimada (${projection.pendingCount} pendiente/s con rendimiento constante): ${numberValue(projection.projectedDefinitiva)}`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              Proy. {numberValue(projection.projectedDefinitiva)}
                            </span>
                          )}
                        </>
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
  );
}

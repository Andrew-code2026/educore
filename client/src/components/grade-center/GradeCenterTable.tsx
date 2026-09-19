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
import { type GradeViewMode } from "./GradeCenterToolbar";

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
  onFilterPendingForAssessment?: (assessmentId: number) => void;
}

// =======================================================
// SUB-COMPONENTE 1: CELDA INDIVIDUAL DE CALIFICACIÓN (MEMOIZADA)
// =======================================================

interface GradeCenterTableCellProps {
  assessment: Assessment;
  studentId: number;
  studentName: string;
  cellVal: number | null;
  cellComment: string;
  hasPendingChange: boolean;
  isCellOpen: boolean;
  isFocused: boolean;
  initialDraft?: string;
  canWrite: boolean;
  scale?: GradeScaleConfig | null;
  isSaving: boolean;
  rowIndex: number;
  colIndex: number;
  onCellClick: (studentId: number, assessmentId: number) => void;
  onCellFocus: (studentId: number, assessmentId: number) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    cellVal: number | null
  ) => void;
  onSaveAndAdvance: (
    val: number | null,
    direction: "down" | "up" | "right" | "left" | "stay",
    comment?: string
  ) => void;
  onCloseCellEditor: (studentId: number, assessmentId: number) => void;
}

const GradeCenterTableCell = React.memo(function GradeCenterTableCell({
  assessment,
  studentId,
  studentName: sName,
  cellVal,
  cellComment,
  hasPendingChange,
  isCellOpen,
  isFocused,
  initialDraft,
  canWrite,
  scale,
  isSaving,
  rowIndex,
  colIndex,
  onCellClick,
  onCellFocus,
  onCellKeyDown,
  onSaveAndAdvance,
  onCloseCellEditor,
}: GradeCenterTableCellProps) {
  const cellButton = (
    <button
      type="button"
      data-cell-id={`${assessment.id}:${studentId}`}
      disabled={!canWrite}
      onClick={() => onCellClick(studentId, assessment.id)}
      onFocus={() => onCellFocus(studentId, assessment.id)}
      onKeyDown={e => onCellKeyDown(e, rowIndex, colIndex, cellVal)}
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
    <td className="px-2 py-1.5 text-center align-middle" role="gridcell">
      <div className="flex items-center justify-center">
        {isCellOpen ? (
          <Popover
            open={true}
            onOpenChange={open => {
              if (!open) {
                onCloseCellEditor(studentId, assessment.id);
              }
            }}
          >
            <PopoverAnchor asChild>{cellButton}</PopoverAnchor>
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
              onSaveAndNavigate={onSaveAndAdvance}
              onClose={() => onCloseCellEditor(studentId, assessment.id)}
              isSaving={isSaving}
            />
          </Popover>
        ) : (
          cellButton
        )}
      </div>
    </td>
  );
});

// =======================================================
// SUB-COMPONENTE 2: FILA COMPLETA DE ESTUDIANTE (MEMOIZADA)
// =======================================================

interface GradeCenterTableRowProps {
  row: GradeCenterTableRow;
  rowIndex: number;
  assessments: Assessment[];
  courseName?: string;
  subjectName?: string;
  scale?: GradeScaleConfig | null;
  groupAverage?: number | null;
  viewMode: GradeViewMode;
  isSelected: boolean;
  activeCellAssessmentId: number | null;
  focusedCellAssessmentId: number | null;
  initialDraft?: string;
  isOpenStudentSummary: boolean;
  canWrite: boolean;
  isSaving: boolean;
  pendingGrades: Record<string, number | null>;
  pendingComments: Record<string, string>;
  allRows: GradeCenterTableRow[];
  onToggleStudent?: (studentId: number) => void;
  onOpenStudentSummary: (studentId: number) => void;
  onCloseStudentSummary: () => void;
  onCellClick: (studentId: number, assessmentId: number) => void;
  onCellFocus: (studentId: number, assessmentId: number) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    cellVal: number | null
  ) => void;
  onSaveAndAdvance: (
    val: number | null,
    direction: "down" | "up" | "right" | "left" | "stay",
    comment?: string
  ) => void;
  onCloseCellEditor: (studentId: number, assessmentId: number) => void;
  onOpenSimulator?: (studentRow: GradeCenterTableRow) => void;
  onOpenStudentStats?: (studentRow: GradeCenterTableRow) => void;
}

// Comparador de alto rendimiento: omite el re-render de 34 de 35 filas en cada tecla
function areRowPropsEqual(
  prev: GradeCenterTableRowProps,
  next: GradeCenterTableRowProps
): boolean {
  if (prev.row !== next.row) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.courseName !== next.courseName || prev.subjectName !== next.subjectName) return false;
  if (prev.scale !== next.scale) return false;
  if (prev.groupAverage !== next.groupAverage) return false;
  if (prev.canWrite !== next.canWrite || prev.isSaving !== next.isSaving) return false;

  // Estado activo o de foco en esta fila
  if (prev.activeCellAssessmentId !== next.activeCellAssessmentId) return false;
  if (prev.focusedCellAssessmentId !== next.focusedCellAssessmentId) return false;
  if (prev.isOpenStudentSummary !== next.isOpenStudentSummary) return false;
  if (prev.initialDraft !== next.initialDraft) return false;

  // Estructura de evaluaciones
  if (prev.assessments !== next.assessments) return false;

  // Comprobar si cambió alguna calificación o comentario pendiente para ESTE estudiante
  const studentId = prev.row.enrollment.studentUserId;
  for (const a of prev.assessments) {
    const key = `${a.id}:${studentId}`;
    if (prev.pendingGrades[key] !== next.pendingGrades[key]) return false;
    if (prev.pendingComments[key] !== next.pendingComments[key]) return false;
  }

  return true;
}

const GradeCenterTableRowComponent = React.memo(function GradeCenterTableRowComponent({
  row,
  rowIndex,
  assessments,
  courseName,
  subjectName,
  scale,
  groupAverage,
  viewMode,
  isSelected,
  activeCellAssessmentId,
  focusedCellAssessmentId,
  initialDraft,
  isOpenStudentSummary,
  canWrite,
  isSaving,
  pendingGrades,
  pendingComments,
  allRows,
  onToggleStudent,
  onOpenStudentSummary,
  onCloseStudentSummary,
  onCellClick,
  onCellFocus,
  onCellKeyDown,
  onSaveAndAdvance,
  onCloseCellEditor,
  onOpenSimulator,
  onOpenStudentStats,
}: GradeCenterTableRowProps) {
  const student = row.student;
  const sName = studentName(student);
  const studentId = row.enrollment.studentUserId;

  // Mapa indexado O(1) de las calificaciones originales registradas para esta fila
  const rowValuesMap = React.useMemo(() => {
    const map = new Map<number, { value: number | null; comment?: string | null }>();
    for (const v of row.values ?? []) {
      map.set(v.assessment.id, {
        value: v.grade?.value ?? null,
        comment: v.grade?.comment ?? null,
      });
    }
    return map;
  }, [row.values]);

  // Lista viva combinada (originales + pendientes locales) para esta fila específica
  const liveValues = React.useMemo(() => {
    return assessments.map(a => {
      const key = `${a.id}:${studentId}`;
      const origItem = rowValuesMap.get(a.id);
      const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : origItem?.value ?? null;
      return {
        value: val,
        maxValue: a.maxValue,
        weight: a.weight,
      };
    });
  }, [assessments, rowValuesMap, studentId, pendingGrades]);

  // Cálculos pedagógicos de la fila
  const definitiva = React.useMemo(() => calculateDefinitiva(liveValues), [liveValues]);
  const definitivaTone = getPerformanceTone(definitiva);
  const projection = React.useMemo(
    () => calculateStudentProjection(liveValues, scale),
    [liveValues, scale]
  );

  // Indicadores de resumen y tendencias
  const studentGrades = React.useMemo(() => {
    return liveValues.map(v => v.value).filter((g): g is number => g !== null);
  }, [liveValues]);
  const recordedCount = studentGrades.length;
  const totalAssessments = assessments.length;
  const isAllGraded = recordedCount === totalAssessments && totalAssessments > 0;
  const pendingCountForStudent = totalAssessments - recordedCount;

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
      className={`group transition-colors duration-150 ${
        isSelected
          ? "bg-blue-50/40 dark:bg-blue-950/20"
          : viewMode === "RISK" && definitiva !== null && definitiva < 3.0
          ? "bg-rose-50/25 hover:bg-rose-50/40 dark:bg-rose-950/20"
          : viewMode === "PENDING" && pendingCountForStudent > 0
          ? "bg-amber-50/15 hover:bg-amber-50/30 dark:bg-amber-950/15"
          : "hover:bg-[var(--edc-secondary)]/15 dark:hover:bg-slate-800/40"
      }`}
    >
      {/* Columna Sticky de Checkbox */}
      <td
        className={`sticky left-0 z-20 w-11 min-w-[44px] max-w-[44px] px-2 py-2.5 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] ${
          isSelected
            ? "bg-blue-50 dark:bg-slate-900"
            : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-850"
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

      {/* Columna Sticky de Estudiante con StudentSummaryPopover perezoso */}
      <td
        className={`sticky left-[44px] z-10 min-w-[190px] max-w-[240px] px-3 py-2.5 shadow-[2px_0_6px_rgba(0,0,0,0.02)] ${
          isSelected
            ? "bg-blue-50 dark:bg-slate-900"
            : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-850"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold dark:bg-slate-800 dark:text-slate-300">
            {sName
              .split(" ")
              .slice(0, 2)
              .map(part => part[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StudentSummaryPopover
                studentRow={row}
                courseName={courseName}
                subjectName={subjectName}
                scale={scale}
                groupAverage={groupAverage}
                rows={allRows}
                pendingGrades={pendingGrades}
                open={isOpenStudentSummary}
                onOpenChange={isOpen => {
                  if (isOpen) {
                    onOpenStudentSummary(studentId);
                  } else {
                    onCloseStudentSummary();
                  }
                }}
                onOpenSimulator={onOpenSimulator}
                onOpenStudentStats={onOpenStudentStats}
              >
                <button
                  type="button"
                  className="block truncate text-left text-xs font-bold text-slate-800 hover:text-[var(--edc-primary)] focus:outline-none transition dark:text-slate-100 cursor-pointer"
                  title={`${sName} (Clic para resumen rápido)`}
                >
                  {sName}
                </button>
              </StudentSummaryPopover>

              {/* Microindicadores contextuales según ViewMode */}
              {viewMode === "PERFORMANCE" && trend && (
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-1 rounded ${
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

              {viewMode === "RISK" && definitiva !== null && definitiva < 3.0 && (
                <span className="inline-flex items-center text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  Riesgo
                </span>
              )}

              {viewMode === "PENDING" && pendingCountForStudent > 0 && (
                <span className="inline-flex items-center text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                  {pendingCountForStudent} pend.
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-slate-400 font-normal mt-0.5">
              ID {studentId} · {courseName ?? "11-2"}
            </p>
          </div>
        </div>
      </td>

      {/* Celdas de Calificaciones */}
      {assessments.map((assessment, colIndex) => {
        const origItem = rowValuesMap.get(assessment.id);
        const key = `${assessment.id}:${studentId}`;
        const cellVal = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : origItem?.value ?? null;
        const cellComment = Object.prototype.hasOwnProperty.call(pendingComments, key)
          ? pendingComments[key]
          : origItem?.comment || "";

        const isCellOpen = activeCellAssessmentId === assessment.id;
        const isFocused = focusedCellAssessmentId === assessment.id;
        const hasPendingChange = Object.prototype.hasOwnProperty.call(pendingGrades, key);

        return (
          <GradeCenterTableCell
            key={assessment.id}
            assessment={assessment}
            studentId={studentId}
            studentName={sName}
            cellVal={cellVal}
            cellComment={cellComment}
            hasPendingChange={hasPendingChange}
            isCellOpen={isCellOpen}
            isFocused={isFocused}
            initialDraft={isCellOpen ? initialDraft : undefined}
            canWrite={canWrite}
            scale={scale}
            isSaving={isSaving}
            rowIndex={rowIndex}
            colIndex={colIndex}
            onCellClick={onCellClick}
            onCellFocus={onCellFocus}
            onCellKeyDown={onCellKeyDown}
            onSaveAndAdvance={onSaveAndAdvance}
            onCloseCellEditor={onCloseCellEditor}
          />
        );
      })}

      {/* Columna Definitiva */}
      <td className="sticky right-0 z-10 min-w-[115px] border-l border-slate-200/80 bg-slate-50 px-3 py-2 text-center shadow-[-2px_0_6px_rgba(0,0,0,0.02)] group-hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-850 dark:group-hover:bg-slate-800">
        <div className="flex flex-col items-center justify-center">
          <span
            className={`text-base font-extrabold tracking-tight leading-tight ${definitivaTone.textColor}`}
          >
            {numberValue(definitiva)}
          </span>
          {definitiva !== null && (
            <>
              <span
                className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
                  definitiva >= 4.0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : definitiva >= 3.0
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                }`}
              >
                {definitiva >= 4.0
                  ? "En buen nivel"
                  : definitiva >= 3.0
                  ? "Cerca del límite"
                  : "Necesita atención"}
              </span>
              <span
                className={`mt-1 text-[9px] font-medium leading-none ${
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
            <span className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800">
              Sin datos
            </span>
          )}
          {projection.hasPending && projection.projectedDefinitiva !== null && (
            <span
              className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
              title={`Proyección estimada (${projection.pendingCount} pendiente/s con rendimiento constante): ${numberValue(projection.projectedDefinitiva)}`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              Proy. {numberValue(projection.projectedDefinitiva)}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}, areRowPropsEqual);

// =======================================================
// SUB-COMPONENTE 3: ENCABEZADO DE LA TABLA (MEMOIZADO)
// =======================================================

interface GradeCenterTableHeaderProps {
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  onToggleAllVisible?: () => void;
  studentCount: number;
  assessments: Assessment[];
  rows: GradeCenterTableRow[];
  pendingGrades: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  groupAverage?: number | null;
  canWrite: boolean;
  onEditAssessment?: (
    assessmentId: number,
    data: { title?: string; weight?: number; date?: Date; description?: string }
  ) => Promise<void> | void;
  onFilterPendingForAssessment?: (assessmentId: number) => void;
}

const GradeCenterTableHeader = React.memo(function GradeCenterTableHeader({
  isAllSelected,
  isPartiallySelected,
  onToggleAllVisible,
  studentCount,
  assessments,
  rows,
  pendingGrades,
  scale,
  groupAverage,
  canWrite,
  onEditAssessment,
  onFilterPendingForAssessment,
}: GradeCenterTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-slate-200/90 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {/* Columna Sticky de Checkbox de Selección */}
        <th
          scope="col"
          className="sticky left-0 z-30 w-11 min-w-[44px] max-w-[44px] bg-slate-50 px-2 py-3.5 text-center shadow-[1px_0_4px_rgba(0,0,0,0.02)] dark:bg-slate-900"
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
          className="sticky left-[44px] z-20 min-w-[190px] max-w-[240px] bg-slate-50 px-3 py-3.5 font-semibold text-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.03)] dark:bg-slate-900 dark:text-slate-200"
        >
          <div className="flex items-center gap-2">
            <span>Estudiante</span>
            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {studentCount}
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
              className="min-w-[115px] max-w-[155px] p-1 text-center font-medium"
            >
              <AssessmentStatisticsPopover
                assessment={assessment}
                rows={rows}
                pendingGrades={pendingGrades}
                scale={scale}
                groupAverage={groupAverage}
                onEditAssessment={onEditAssessment}
                onFilterPending={onFilterPendingForAssessment}
                canEdit={canWrite}
                otherTotalWeight={assessments
                  .filter(a => a.id !== assessment.id)
                  .reduce((sum, a) => sum + Number(a.weight), 0)}
              >
                <button
                  type="button"
                  className="group flex flex-col items-center justify-center w-full rounded-xl px-2 py-1.5 transition hover:bg-slate-200/60 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                  title={`Click para detalles y edición de ${assessment.title}`}
                >
                  <span
                    className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[130px] group-hover:text-[var(--edc-primary)] transition-colors"
                    title={assessment.title}
                  >
                    {assessment.title}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-[var(--edc-primary)]">{assessment.weight}%</span>
                    <span>·</span>
                    <span>{typeLabel}</span>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity">
                      ⋯
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
          className="sticky right-0 z-20 min-w-[115px] border-l border-slate-200/80 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 shadow-[-2px_0_6px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-850 dark:text-white"
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
  );
});

// =======================================================
// COMPONENTE PRINCIPAL: TABLA DE CALIFICACIONES (GRADE CENTER)
// =======================================================

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
  onEditAssessment,
  onFilterPendingForAssessment,
}: GradeCenterTableProps) {
  // Celda activa con el popover de calificación abierto
  const [activeCell, setActiveCell] = React.useState<ActiveGradeCell | null>(null);

  // Caracter inicial para pre-llenar cuando se empieza a escribir con el teclado en la tabla
  const [initialDraft, setInitialDraft] = React.useState<string | undefined>(undefined);

  // Celda con foco de navegación en el grid
  const [focusedCell, setFocusedCell] = React.useState<ActiveGradeCell | null>(null);

  // Control de popover de resumen de estudiante único y controlado
  const [openStudentSummaryId, setOpenStudentSummaryId] = React.useState<number | null>(null);

  const clipboardRef = React.useRef<number | null>(null);
  const lastConsumedTargetTs = React.useRef<number | null>(null);

  // Navegación directa desde componentes externos
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

  // Copiar valor de una celda
  const handleCopy = React.useCallback((cellVal: number | null) => {
    clipboardRef.current = cellVal;
    const textToCopy = cellVal !== null && cellVal !== undefined ? String(cellVal) : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    toast.info(cellVal !== null ? `Nota ${cellVal} copiada` : "Celda vacía copiada");
  }, []);

  // Pegar valor en una celda
  const handlePaste = React.useCallback(
    async (assessmentId: number, studentId: number, maxVal: number) => {
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
    },
    [canWrite, onCellPendingChange, scale]
  );

  const focusCellElement = React.useCallback((assessmentId: number, studentUserId: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-cell-id="${assessmentId}:${studentUserId}"]`
      );
      el?.focus();
    });
  }, []);

  // Flujo único y centralizado para guardar y avanzar
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

      // 1. Registrar cambio pendiente de la nota
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
  const handleCellKeyDown = React.useCallback(
    (
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
    },
    [assessments, rows, handleCopy, handlePaste, onCellPendingChange, focusCellElement]
  );

  const handleCellClick = React.useCallback((studentId: number, assessmentId: number) => {
    setOpenStudentSummaryId(null);
    setActiveCell({ studentUserId: studentId, assessmentId });
    setFocusedCell({ studentUserId: studentId, assessmentId });
    setInitialDraft(undefined);
  }, []);

  const handleCellFocus = React.useCallback((studentId: number, assessmentId: number) => {
    setFocusedCell({ studentUserId: studentId, assessmentId });
  }, []);

  const handleCloseCellEditor = React.useCallback((studentId: number, assessmentId: number) => {
    setActiveCell(null);
    setInitialDraft(undefined);
    focusCellElement(assessmentId, studentId);
  }, [focusCellElement]);

  const handleOpenStudentSummary = React.useCallback((studentId: number) => {
    setOpenStudentSummaryId(studentId);
    setActiveCell(null);
    setInitialDraft(undefined);
  }, []);

  const handleCloseStudentSummary = React.useCallback(() => {
    setOpenStudentSummaryId(null);
  }, []);

  const isAllSelected = rows.length > 0 && selectedStudentIds.length === rows.length;
  const isPartiallySelected =
    selectedStudentIds.length > 0 && selectedStudentIds.length < rows.length;

  // Set O(1) de estudiantes seleccionados
  const selectedStudentSet = React.useMemo(() => {
    return new Set(selectedStudentIds);
  }, [selectedStudentIds]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(29,78,137,0.04)] dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
        <table
          className="w-full min-w-[800px] border-collapse text-left text-sm"
          role="grid"
          aria-label="Tabla del Grade Center"
        >
          {/* ENCABEZADO MEMOIZADO */}
          <GradeCenterTableHeader
            isAllSelected={isAllSelected}
            isPartiallySelected={isPartiallySelected}
            onToggleAllVisible={onToggleAllVisible}
            studentCount={rows.length}
            assessments={assessments}
            rows={rows}
            pendingGrades={pendingGrades}
            scale={scale}
            groupAverage={groupAverage}
            canWrite={canWrite}
            onEditAssessment={onEditAssessment}
            onFilterPendingForAssessment={onFilterPendingForAssessment}
          />

          {/* CUERPO DE LA TABLA CON FILAS MEMOIZADAS */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.map((row, rowIndex) => {
              const studentId = row.enrollment.studentUserId;
              const isSelected = selectedStudentSet.has(studentId);
              const activeCellAssessmentId =
                activeCell?.studentUserId === studentId ? activeCell.assessmentId : null;
              const focusedCellAssessmentId =
                focusedCell?.studentUserId === studentId ? focusedCell.assessmentId : null;
              const isOpenStudentSummary = openStudentSummaryId === studentId;

              return (
                <GradeCenterTableRowComponent
                  key={row.enrollment.id}
                  row={row}
                  rowIndex={rowIndex}
                  assessments={assessments}
                  courseName={courseName}
                  subjectName={subjectName}
                  scale={scale}
                  groupAverage={groupAverage}
                  viewMode={viewMode}
                  isSelected={isSelected}
                  activeCellAssessmentId={activeCellAssessmentId}
                  focusedCellAssessmentId={focusedCellAssessmentId}
                  initialDraft={activeCellAssessmentId !== null ? initialDraft : undefined}
                  isOpenStudentSummary={isOpenStudentSummary}
                  canWrite={canWrite}
                  isSaving={isSaving}
                  pendingGrades={pendingGrades}
                  pendingComments={pendingComments}
                  allRows={rows}
                  onToggleStudent={onToggleStudent}
                  onOpenStudentSummary={handleOpenStudentSummary}
                  onCloseStudentSummary={handleCloseStudentSummary}
                  onCellClick={handleCellClick}
                  onCellFocus={handleCellFocus}
                  onCellKeyDown={handleCellKeyDown}
                  onSaveAndAdvance={handleSaveAndAdvance}
                  onCloseCellEditor={handleCloseCellEditor}
                  onOpenSimulator={onOpenSimulator}
                  onOpenStudentStats={onOpenStudentStats}
                />
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

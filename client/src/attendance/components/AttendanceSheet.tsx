/**
 * Roster de la planilla con estructura ARIA de grilla, encabezado sticky y columna
 * de estudiante congelada en pantallas estrechas. La barra de vistas vive en el panel.
 */
import { SearchX, Users } from "lucide-react";
import { memo, useMemo } from "react";
import { computeStudentStats } from "../data/selectors";
import type { AttendanceStatus, AttentionFlag, Course, SessionStatuses, Student, StudentStats } from "../types";
import { StudentRow } from "./StudentRow";

interface AttendanceSheetProps {
  course: Course;
  students: Student[];
  statuses: SessionStatuses;
  attentionByStudent: Map<string, AttentionFlag[]>;
  focusedId: string | null;
  openPopoverId: string | null;
  onOpenPopover: (studentId: string | null) => void;
  onFocusStudent: (studentId: string) => void;
  onStatus: (studentId: string, status: AttendanceStatus) => void;
  onPopoverStatus: (studentId: string, status: AttendanceStatus) => void;
  onResetView: () => void;
  onOpenExpediente?: (student: Student) => void;
  onOpenHistory?: (student: Student) => void;
  onOpenFollowUp?: (student: Student) => void;
  todayIso: string;
}

interface StudentRowHandlers {
  onOpenChange: (open: boolean) => void;
  onFocus: () => void;
  onStatus: (status: AttendanceStatus) => void;
  onPopoverStatus: (status: AttendanceStatus) => void;
}

const EMPTY_EXTRA_REASONS: string[] = [];
/** La última columna es la acción de expediente: su encabezado solo existe para lectores de pantalla. */
const COLUMNS = ["#", "Estudiante", "Hoy", "Historial", "Expediente"] as const;

export const AttendanceSheet = memo(function AttendanceSheet({
  course,
  students,
  statuses,
  attentionByStudent,
  focusedId,
  openPopoverId,
  onOpenPopover,
  onFocusStudent,
  onStatus,
  onPopoverStatus,
  onResetView,
  onOpenExpediente,
  onOpenHistory,
  onOpenFollowUp,
  todayIso,
}: AttendanceSheetProps) {
  const statsByStudentId = useMemo(() => {
    const map = new Map<string, StudentStats>();
    for (const student of students) {
      map.set(
        student.id,
        computeStudentStats(student, statuses[student.id] ?? "pending", todayIso),
      );
    }
    return map;
  }, [students, statuses, todayIso]);

  const extraReasonsByStudentId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [studentId, flags] of attentionByStudent) {
      map.set(studentId, flags.slice(1).map(item => item.label));
    }
    return map;
  }, [attentionByStudent]);

  const rowHandlersByStudentId = useMemo(() => {
    const map = new Map<string, StudentRowHandlers>();
    for (const student of students) {
      const studentId = student.id;
      map.set(studentId, {
        onOpenChange: open => onOpenPopover(open ? studentId : null),
        onFocus: () => onFocusStudent(studentId),
        onStatus: status => onStatus(studentId, status),
        onPopoverStatus: status => onPopoverStatus(studentId, status),
      });
    }
    return map;
  }, [students, onFocusStudent, onOpenPopover, onPopoverStatus, onStatus]);

  const noRoster = course.students.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto scroll-thin">
      {students.length === 0 ? (
        <div className="att-roster-empty" role="status" aria-live="polite">
          {noRoster ? (
            <Users className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
          ) : (
            <SearchX className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
          )}
          <p className="text-[13.5px] font-semibold">
            {noRoster ? "Sin estudiantes asignados" : "Ningún estudiante coincide"}
          </p>
          <p className="max-w-[300px] text-xs text-muted-foreground">
            {noRoster
              ? "Cuando EduCore cargue el roster de este curso, aparecerá aquí."
              : "Prueba otra vista o limpia la búsqueda."}
          </p>
          {noRoster ? null : (
            <button type="button" onClick={onResetView} className="att-link-button">
              Ver todos los estudiantes
            </button>
          )}
        </div>
      ) : (
        <div
          className="roster-grid roster-table"
          role="grid"
          data-attendance-roster
          aria-label={`Planilla de asistencia de ${course.name}`}
          aria-rowcount={students.length + 1}
          aria-colcount={COLUMNS.length}
        >
          <div className="roster-grid roster-header-row" role="row" aria-rowindex={1}>
            {COLUMNS.map((column, index) => (
              <div
                key={column}
                className={index === 1 ? "roster-heading roster-student-head" : "roster-heading"}
                role="columnheader"
                aria-colindex={index + 1}
              >
                {index === COLUMNS.length - 1 ? <span className="sr-only">{column}</span> : column}
              </div>
            ))}
          </div>

          {students.map((student, index) => {
            const flags = attentionByStudent.get(student.id) ?? [];
            const rowHandlers = rowHandlersByStudentId.get(student.id)!;
            return (
              <StudentRow
                key={student.id}
                index={index + 1}
                student={student}
                status={statuses[student.id] ?? "pending"}
                stats={statsByStudentId.get(student.id)!}
                todayIso={todayIso}
                flag={flags[0] ?? null}
                extraReasons={extraReasonsByStudentId.get(student.id) ?? EMPTY_EXTRA_REASONS}
                focused={focusedId === student.id}
                open={openPopoverId === student.id}
                onOpenChange={rowHandlers.onOpenChange}
                onFocus={rowHandlers.onFocus}
                onStatus={rowHandlers.onStatus}
                onPopoverStatus={rowHandlers.onPopoverStatus}
                onOpenExpediente={onOpenExpediente}
                onOpenHistory={onOpenHistory}
                onOpenFollowUp={onOpenFollowUp}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

AttendanceSheet.displayName = "AttendanceSheet";

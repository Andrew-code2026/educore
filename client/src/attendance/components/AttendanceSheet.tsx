/**
 * Roster Field: planilla de asistencia a todo el ancho. Incluye estructura ARIA
 * de grilla para lectores de pantalla, conservando scroll y encabezado sticky.
 */
import { SearchX, Users } from "lucide-react";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
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
      map.set(studentId, flags.slice(1).map(item => `${item.label} · ${item.detail}`));
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
    <section className="chrona-roster glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px]" aria-label={`Planilla de asistencia de ${course.name}`}>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        {students.length === 0 ? (
          <div
            className="flex min-h-[220px] min-w-0 w-full flex-col items-center justify-center gap-2 px-6 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-2">
              {noRoster ? <Users className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" /> : <SearchX className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />}
              <p className="text-[13px] font-medium">{noRoster ? "Sin estudiantes asignados" : "Ningún estudiante coincide con la vista actual"}</p>
              <p className="max-w-[300px] text-[11px] text-muted-foreground">
                {noRoster ? "Cuando EduCore cargue el roster de este curso, aparecerá aquí." : "Prueba otro filtro o limpia la búsqueda para volver al roster completo."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="roster-grid min-w-[900px]"
            role="grid"
            data-attendance-roster
            aria-label={`Planilla de asistencia de ${course.name}`}
            aria-rowcount={students.length + 1}
            aria-colcount={6}
          >
            <div className="roster-grid roster-header-grid" role="row" aria-rowindex={1}>
              <div className="roster-heading roster-index sticky top-0 z-40 flex h-9 items-center justify-center border-b border-hairline-strong bg-[var(--roster-head)] text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70" role="columnheader" aria-colindex={1}>
                #
              </div>
              <div className="roster-heading roster-student-head sticky top-0 z-40 flex h-9 items-center gap-2 border-b border-hairline-strong bg-[var(--roster-head)] px-3 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" role="columnheader" aria-colindex={2}>
                <span>Estudiante</span>
                <span className="rounded-full bg-foreground/[0.045] px-1.5 py-0.5 text-[8.5px] tracking-normal">{students.length} en lista</span>
              </div>
              <div className="roster-heading roster-col-attendance sticky top-0 z-30 flex h-9 items-center justify-center border-b border-hairline-strong bg-[var(--roster-head)] text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" role="columnheader" aria-colindex={3}>Asistencia</div>
              <div className="roster-heading roster-col-status sticky top-0 z-30 flex h-9 items-center justify-center border-b border-hairline-strong bg-[var(--roster-head)] text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" role="columnheader" aria-colindex={4}>
                Estado <span className="ml-1 hidden text-[var(--chrona-cyan-strong)] sm:inline">· hoy</span>
              </div>
              <div className="roster-heading roster-col-trace sticky top-0 z-30 flex h-9 items-center justify-center border-b border-hairline-strong bg-[var(--roster-head)] text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" role="columnheader" aria-colindex={5}>Últimas 8</div>
              <div className="roster-heading roster-col-signal sticky top-0 z-30 flex h-9 items-center justify-center border-b border-hairline-strong bg-[var(--roster-head)] text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" role="columnheader" aria-colindex={6}>Señal</div>
            </div>

            {students.map((student, index) => {
              const status = statuses[student.id] ?? "pending";
              const flags = attentionByStudent.get(student.id) ?? [];
              const rowHandlers = rowHandlersByStudentId.get(student.id)!;
              return (
                <StudentRow
                  key={student.id}
                  index={index + 1}
                  student={student}
                  course={course}
                  status={status}
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

      <footer className="chrona-shortcut-dock" aria-label="Atajos principales de la planilla">
        <div className="chrona-shortcut-group" role="group" aria-label="Estados de asistencia">
          <span className="chrona-shortcut-group-label">Marcar</span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">P</kbd><span>Presente</span></span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">A</kbd><span>Ausente</span></span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">T</kbd><span>Tardanza</span></span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">E</kbd><span>Excusa</span></span>
        </div>
        <div className="chrona-shortcut-group" role="group" aria-label="Navegación y controles">
          <span className="chrona-shortcut-group-label">Moverse</span>
          <span className="chrona-shortcut-pair"><span className="chrona-shortcut-keys"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd></span><span>Estudiante</span></span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">Supr</kbd><kbd className="kbd">⌫</kbd><span>Pendiente</span></span>
          <span className="chrona-shortcut-pair"><kbd className="kbd">Ctrl/⌘ Z</kbd><span>Deshacer</span></span>
        </div>
      </footer>
    </section>
  );
});

AttendanceSheet.displayName = "AttendanceSheet";

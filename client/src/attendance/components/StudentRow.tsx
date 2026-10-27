/** Fila del roster: quién es, qué pasó hoy y cómo viene su asistencia. */
import { AlertCircle, FolderOpen } from "lucide-react";
import { memo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ATTENTION_RULES } from "../data/selectors";
import { formatShortDate } from "../format";
import { SEVERITY_CLASS, STATUS_CONTROLS, STATUS_DOT, STATUS_META } from "../statusMeta";
import type { AttendanceStatus, AttentionFlag, AttentionKind, Student, StudentStats } from "../types";
import { Avatar } from "./Avatar";
import { StatusCell } from "./StatusCell";
import { StudentPopover } from "./StudentPopover";

interface StudentRowProps {
  /** Índice visual de 1 a N; la fila de encabezados ocupa el índice ARIA 1. */
  index: number;
  student: Student;
  status: AttendanceStatus;
  stats: StudentStats;
  todayIso: string;
  flag: AttentionFlag | null;
  extraReasons: string[];
  focused: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocus: () => void;
  onStatus: (status: AttendanceStatus) => void;
  onPopoverStatus: (status: AttendanceStatus) => void;
  onOpenExpediente?: (student: Student) => void;
  onOpenHistory?: (student: Student) => void;
  onOpenFollowUp?: (student: Student) => void;
}

/** Texto corto del chip de la fila; el detalle completo queda en el `title` y en el popover. */
const FLAG_SHORT_LABEL: Record<AttentionKind, string> = {
  consecutive_absences: "Ausencias seguidas",
  low_attendance: "Asistencia baja",
  late_pattern: "Tardanzas",
  pending_excuse: "Excusa por revisar",
};

const TRACE_LENGTH = 8;

function rateTone(rate: number): string {
  if (rate >= ATTENTION_RULES.minAttendanceRate) return "text-st-present";
  return rate >= 70 ? "text-st-late" : "text-st-absent";
}

export const StudentRow = memo(function StudentRow({
  index,
  student,
  status,
  stats,
  todayIso,
  flag,
  extraReasons,
  focused,
  open,
  onOpenChange,
  onFocus,
  onStatus,
  onPopoverStatus,
  onOpenExpediente,
  onOpenHistory,
  onOpenFollowUp,
}: StudentRowProps) {
  const attendanceRate = stats.attendanceRate === null ? null : Math.round(stats.attendanceRate);
  const trace = stats.recent.filter(record => record.date !== todayIso).slice(-TRACE_LENGTH);
  const traceLabel = trace.length === 0
    ? "Sin historial"
    : `Últimas ${trace.length} jornadas: ${trace.map(record => STATUS_META[record.status].label).join(", ")}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        data-student-id={student.id}
        role="row"
        aria-rowindex={index + 1}
        aria-selected={focused}
        tabIndex={-1}
        aria-label={`${student.fullName}, ${STATUS_META[status].label}`}
        onMouseDown={onFocus}
        className={cn(
          "roster-grid roster-row",
          focused && "is-focused",
          status === "pending" && "is-pending",
        )}
      >
        <span className="roster-index tabular" role="gridcell" aria-colindex={1}>
          {String(index).padStart(2, "0")}
        </span>

        <div className="roster-student-cell" role="gridcell" aria-colindex={2}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onFocus={onFocus}
              className="roster-student-button"
              aria-label={`Abrir detalle de ${student.fullName}${flag ? `. Alerta: ${flag.label}` : ""}`}
            >
              <Avatar name={student.fullName} initials={student.initials} size="md" />
              <span className="roster-student-name">{student.fullName}</span>
              {flag ? (
                <span
                  className={cn("roster-flag", SEVERITY_CLASS[flag.severity])}
                  title={`${flag.label} · ${flag.detail}`}
                >
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{FLAG_SHORT_LABEL[flag.kind]}</span>
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
        </div>

        <div className="roster-status-cell" role="gridcell" aria-colindex={3}>
          <div role="group" aria-label={`Estado de hoy · ${student.fullName}`} className="chrona-pate-group">
            {STATUS_CONTROLS.map(control => (
              <StatusCell
                key={control}
                status={control}
                active={status === control}
                onFocus={onFocus}
                onSelect={() => {
                  onFocus();
                  onStatus(control);
                }}
              />
            ))}
          </div>
        </div>

        <div className="roster-history-cell" role="gridcell" aria-colindex={4}>
          <span className="roster-trace" role="img" aria-label={traceLabel}>
            {trace.map(record => (
              <span
                key={record.date}
                title={`${formatShortDate(record.date)} · ${STATUS_META[record.status].label}`}
                className={cn(
                  "roster-trace-dot",
                  record.status === "pending" ? "bg-foreground/[0.13]" : STATUS_DOT[record.status],
                )}
              />
            ))}
            {trace.length === 0 ? <span className="text-xs text-muted-foreground/70">Sin historial</span> : null}
          </span>
          <span
            className={cn("roster-rate tabular", attendanceRate === null ? "text-muted-foreground/60" : rateTone(attendanceRate))}
            aria-label={attendanceRate === null ? "Sin asistencia calculable" : `Asistencia histórica ${attendanceRate}%`}
          >
            {attendanceRate === null ? "—" : `${attendanceRate}%`}
          </span>
        </div>

        <div className="roster-action-cell" role="gridcell" aria-colindex={5}>
          {onOpenExpediente ? (
            <button
              type="button"
              onFocus={onFocus}
              onClick={() => onOpenExpediente(student)}
              className="roster-open-record"
              aria-label={`Ver expediente de ${student.fullName}`}
            >
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="roster-open-record-label">Expediente</span>
            </button>
          ) : null}
        </div>
      </div>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="glass chrona-student-surface z-50 w-auto max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-[18px] p-2.5"
      >
        <StudentPopover
          student={student}
          status={status}
          stats={stats}
          flag={flag}
          extraReasons={extraReasons}
          onStatus={onPopoverStatus}
          onOpenExpediente={onOpenExpediente}
          onOpenHistory={onOpenHistory}
          onOpenFollowUp={onOpenFollowUp}
        />
      </PopoverContent>
    </Popover>
  );
});

StudentRow.displayName = "StudentRow";

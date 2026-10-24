/** Fila del Roster Field: quién es, cómo va, qué pasó hoy y qué muestra su rastro. */
import { motion } from "framer-motion";
import { AlertCircle, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { memo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatShortDate } from "../format";
import { SEVERITY_CLASS, SEVERITY_DOT, STATUS_DOT, STATUS_META, STATUS_CONTROLS } from "../statusMeta";
import type { AttendanceStatus, AttentionFlag, Course, Student, StudentStats } from "../types";
import { Avatar } from "./Avatar";
import { StatusCell } from "./StatusCell";
import { StudentPopover } from "./StudentPopover";

interface StudentRowProps {
  /** Índice visual de 1 a N; la fila de encabezados ocupa el índice ARIA 1. */
  index: number;
  student: Student;
  course: Course;
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

export const StudentRow = memo(function StudentRow({
  index,
  student,
  course,
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
  const pending = status === "pending";
  const attendanceRate = stats.attendanceRate === null ? null : Math.round(stats.attendanceRate);
  const trace = stats.recent.filter(record => record.date !== todayIso).slice(-8);
  const TrendIcon = stats.trend === "up" ? TrendingUp : stats.trend === "down" ? TrendingDown : Minus;
  const trendTone = stats.trend === "up" ? "text-st-present" : stats.trend === "down" ? "text-st-absent" : "text-muted-foreground/60";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        id={`student-row-${student.id}`}
        data-student-id={student.id}
        role="row"
        aria-rowindex={index + 1}
        aria-selected={focused}
        tabIndex={-1}
        aria-label={`${student.fullName}, ${STATUS_META[status].label}`}
        onMouseDown={onFocus}
        className={cn(
          "roster-grid roster-row group relative min-h-[50px] items-center outline-none transition-colors duration-150",
          focused && "roster-row-focused",
          pending && "roster-row-pending",
        )}
      >
        <span className="roster-index tabular flex h-full items-center justify-center text-xs font-medium text-muted-foreground/55" role="gridcell" aria-colindex={1}>
          {String(index).padStart(2, "0")}
        </span>

        <div className="roster-student-cell sticky z-20 h-full min-w-0 border-r border-hairline" role="gridcell" aria-colindex={2}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onFocus={onFocus}
              className="group/student relative flex h-full w-full min-w-0 items-center gap-2.5 bg-transparent px-3 text-left transition-colors"
              aria-label={`Abrir detalle de ${student.fullName}`}
            >
              <span className="roster-row-accent absolute inset-y-2 left-0 w-[2px] rounded-r-full" />
              <Avatar name={student.fullName} initials={student.initials} size="md" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-semibold leading-tight">{student.fullName}</span>
                  {student.pendingExcuses > 0 ? (
                    <span className="hidden shrink-0 rounded-full bg-st-excuse/10 px-1.5 py-0.5 text-xs font-semibold text-st-excuse ring-1 ring-inset ring-st-excuse/20 xl:inline-flex">
                      {student.pendingExcuses} excusa{student.pendingExcuses > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
                  {student.group} · {course.subject}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-0 bg-brand-soft opacity-0 transition-opacity group-hover/student:opacity-[0.45]" />
            </button>
          </PopoverTrigger>
        </div>

        <div className="roster-attendance flex h-full items-center justify-center px-2" role="gridcell" aria-colindex={3} aria-label={attendanceRate === null ? "Sin registros históricos de asistencia" : `Asistencia histórica: ${attendanceRate}%`}>
          <span className={cn(
            "flex min-w-[52px] flex-col items-center justify-center rounded-[9px] px-2 py-1",
            attendanceRate === null
              ? "bg-foreground/[0.035] text-muted-foreground/60"
              : attendanceRate >= 85 ? "chrona-rate-good" : attendanceRate >= 70 ? "chrona-rate-watch" : "chrona-rate-low",
          )}>
            <span className="tabular text-xs font-bold leading-none">{attendanceRate === null ? "—" : `${attendanceRate}%`}</span>
            {attendanceRate !== null ? (
              <span className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-foreground/[0.09]">
                <span className="block h-full rounded-full bg-current" style={{ width: `${attendanceRate}%` }} />
              </span>
            ) : null}
          </span>
        </div>

        <div className="roster-status-cell flex h-full items-center justify-center gap-1.5 px-1" role="gridcell" aria-colindex={4} aria-label={`Estado de hoy · ${student.fullName}`}>
          <div role="group" aria-label={`Seleccionar estado · ${student.fullName}`} className="chrona-pate-group flex items-center gap-0.5 rounded-[11px] p-0.5">
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
          {pending ? <span className="chrona-pending-label hidden whitespace-nowrap text-xs font-semibold uppercase tracking-[0.02em] sm:inline">Por pasar</span> : null}
        </div>

        <div className="roster-trace-cell flex h-full items-center justify-center px-1.5" role="gridcell" aria-colindex={5} aria-label={`Historial reciente de ${student.fullName}`}>
          <div className="flex items-center gap-[5px]" role="img" aria-label={`${student.fullName}: últimas ${trace.length} jornadas`}>
            {trace.map((record, dotIndex) => (
              <motion.span
                key={record.date}
                initial={false}
                whileHover={{ scale: 1.55, y: -1 }}
                transition={{ duration: 0.16 }}
                title={`${formatShortDate(record.date)} · ${STATUS_META[record.status].label}`}
                className={cn(
                  "chrona-trace-dot h-[6px] w-[6px] shrink-0 rounded-full",
                  record.status === "pending" ? "bg-foreground/[0.13]" : STATUS_DOT[record.status],
                  dotIndex === trace.length - 1 && "chrona-trace-latest",
                )}
              />
            ))}
            {trace.length === 0 ? <span className="text-xs text-muted-foreground/50">Sin historial</span> : null}
          </div>
        </div>

        <div className="roster-signal-cell flex h-full min-w-0 items-center justify-center px-2" role="gridcell" aria-colindex={6}>
          {/* Una sola referencia Radix por fila: la señal abre el mismo detalle anclado al nombre. */}
            <button
              type="button"
              onFocus={onFocus}
              onClick={() => onOpenChange(true)}
              disabled={!flag}
              className={cn(
                "flex h-full w-full min-w-0 items-center justify-center gap-1.5 rounded-lg text-left transition-colors",
                flag ? "cursor-pointer hover:bg-foreground/[0.035]" : "cursor-default",
              )}
              aria-label={flag ? `${flag.label} · ${flag.detail}. Ver estudiante` : "Sin señales de atención"}
              title={flag ? `${flag.label} · ${flag.detail}` : "Sin señales de atención"}
            >
              {flag ? (
                <>
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[flag.severity])} />
                  <span className={cn("max-w-full truncate rounded-full px-1.5 py-0.5 text-xs font-semibold", SEVERITY_CLASS[flag.severity])}>
                    <AlertCircle className="mr-1 inline h-2.5 w-2.5" aria-hidden="true" />{flag.label}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/55"><span className="h-1 w-1 rounded-full bg-st-present/75" />Estable</span>
              )}
            </button>
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
          courseSubject={course.subject}
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

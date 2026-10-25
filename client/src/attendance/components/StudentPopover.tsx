/**
 * Detalle rápido del estudiante: solo lo que la fila no muestra —motivo de la
 * alerta, acumulado del periodo— y el acceso a sus vistas completas.
 */
import { AlertCircle, ArrowDownRight, ArrowUpRight, ChevronRight, History, LifeBuoy, RotateCcw } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ATTENTION_RULES } from "../data/selectors";
import { SEVERITY_CLASS, STATUS_META } from "../statusMeta";
import type { AttendanceStatus, AttentionFlag, Student, StudentStats } from "../types";
import { Avatar } from "./Avatar";

interface StudentPopoverProps {
  student: Student;
  status: AttendanceStatus;
  stats: StudentStats;
  flag: AttentionFlag | null;
  extraReasons: string[];
  onStatus: (status: AttendanceStatus) => void;
  onOpenExpediente?: (student: Student) => void;
  onOpenHistory?: (student: Student) => void;
  onOpenFollowUp?: (student: Student) => void;
}

const COUNTS: Array<{ key: "absent" | "late" | "excuse"; one: string; many: string; tone: string }> = [
  { key: "absent", one: "ausencia", many: "ausencias", tone: "text-st-absent" },
  { key: "late", one: "tardanza", many: "tardanzas", tone: "text-st-late" },
  { key: "excuse", one: "excusa", many: "excusas", tone: "text-st-excuse" },
];

export const StudentPopover = memo(function StudentPopover({
  student,
  status,
  stats,
  flag,
  extraReasons,
  onStatus,
  onOpenExpediente,
  onOpenHistory,
  onOpenFollowUp,
}: StudentPopoverProps) {
  const rate = stats.attendanceRate === null ? null : Math.round(stats.attendanceRate);
  const attended = stats.present + stats.late;
  const TrendIcon = stats.trend === "up" ? ArrowUpRight : ArrowDownRight;
  // El % y los conteos ya están arriba y abajo; la alerta solo explica el motivo.
  const alertTitle = flag?.kind === "low_attendance"
    ? `Asistencia por debajo del ${ATTENTION_RULES.minAttendanceRate}%`
    : flag?.label;

  return (
    <div className="att-student-card font-sans text-popover-foreground">
      <header className="flex items-center gap-3">
        <Avatar name={student.fullName} initials={student.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight tracking-[-0.02em]">{student.fullName}</p>
          <p className="tabular mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {rate === null ? (
              "Sin registros históricos"
            ) : (
              <>
                <span className="font-semibold text-foreground">{rate}% asistencia</span>
                <span aria-hidden="true">·</span>
                {attended} de {stats.recorded} jornadas
                {stats.trend !== "stable" ? (
                  <span
                    className={cn("inline-flex items-center", stats.trend === "up" ? "text-st-present" : "text-st-absent")}
                    title={`${stats.trendDelta > 0 ? "+" : ""}${stats.trendDelta.toFixed(1)} pp frente al periodo anterior`}
                  >
                    <TrendIcon className="h-3.5 w-3.5" aria-label={stats.trend === "up" ? "Mejorando" : "Empeorando"} />
                  </span>
                ) : null}
              </>
            )}
          </p>
        </div>
      </header>

      {flag ? (
        <div className={cn("mt-3 rounded-xl px-3 py-2.5 text-[13px]", SEVERITY_CLASS[flag.severity])}>
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {alertTitle}
          </p>
          {extraReasons.length > 0 ? (
            <ul className="mt-1 space-y-0.5 pl-[22px] text-foreground/75">
              {extraReasons.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      {stats.recorded > 0 ? (
        <p className="tabular mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {COUNTS.map(item => {
            const value = stats[item.key];
            return (
              <span key={item.key} className={value === 0 ? "opacity-60" : undefined}>
                <span className={cn("font-semibold", value > 0 ? item.tone : "text-foreground")}>{value}</span>{" "}
                {value === 1 ? item.one : item.many}
              </span>
            );
          })}
        </p>
      ) : null}

      {status !== "pending" ? (
        <button type="button" onClick={() => onStatus("pending")} className="att-student-card-reset">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Hoy: {STATUS_META[status].label} · Volver a pendiente
        </button>
      ) : null}

      <div className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
        <button
          type="button"
          onClick={() => onOpenExpediente?.(student)}
          disabled={!onOpenExpediente}
          className="att-student-card-primary"
        >
          Ver expediente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onOpenHistory?.(student)}
            disabled={!onOpenHistory}
            className="att-student-card-secondary"
          >
            <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Historial
          </button>
          <button
            type="button"
            onClick={() => onOpenFollowUp?.(student)}
            disabled={!onOpenFollowUp}
            className="att-student-card-secondary"
          >
            <LifeBuoy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Seguimiento
          </button>
        </div>
      </div>
    </div>
  );
});

StudentPopover.displayName = "StudentPopover";

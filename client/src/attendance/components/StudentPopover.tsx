/**
 * Tarjeta contextual del estudiante: resumen operativo compacto y acciones directas.
 */
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, History, Minus } from "lucide-react";
import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "../format";
import {
  SEVERITY_CLASS,
  STATUS_CHIP,
  STATUS_CONTROL_LABELS,
  STATUS_CONTROLS,
  STATUS_DOT,
  STATUS_META,
} from "../statusMeta";
import type { AttendanceStatus, AttentionFlag, Student, StudentStats } from "../types";
import { Avatar } from "./Avatar";

/** Los cinco estados: Pendiente también es seleccionable y visible. */
const POPOVER_CONTROLS: AttendanceStatus[] = [...STATUS_CONTROLS, "pending"];

interface StudentPopoverProps {
  student: Student;
  courseSubject: string;
  status: AttendanceStatus;
  stats: StudentStats;
  flag: AttentionFlag | null;
  extraReasons: string[];
  onStatus: (status: AttendanceStatus) => void;
  onOpenExpediente?: (student: Student) => void;
  onOpenHistory?: (student: Student) => void;
  onOpenFollowUp?: (student: Student) => void;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-1.5 py-1.5">
      <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("font-display tabular mt-1 text-[13px] font-semibold leading-none", tone)}>{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-hairline bg-surface-1 px-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-brand/25 hover:bg-brand-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export const StudentPopover = memo(function StudentPopover({
  student,
  courseSubject,
  status,
  stats,
  flag,
  extraReasons,
  onStatus,
  onOpenExpediente,
  onOpenHistory,
  onOpenFollowUp,
}: StudentPopoverProps) {
  const TrendIcon = stats.trend === "up" ? ArrowUpRight : stats.trend === "down" ? ArrowDownRight : Minus;
  const trendTone =
    stats.trend === "up" ? "text-st-present" : stats.trend === "down" ? "text-st-absent" : "text-muted-foreground";
  const trendLabel = stats.recorded === 0
    ? "Sin historial"
    : stats.trend === "stable"
      ? "Estable"
      : `${stats.trendDelta > 0 ? "+" : ""}${stats.trendDelta.toFixed(1)} pp`;
  const attentionText = [flag?.detail, ...extraReasons]
    .filter((reason): reason is string => Boolean(reason))
    .join(" · ");

  return (
    <div className="w-[300px] max-w-[calc(100vw-48px)] font-sans text-popover-foreground">
      <header className="flex items-center gap-2.5">
        <Avatar name={student.fullName} initials={student.initials} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-[13px] font-semibold leading-tight tracking-[-0.02em]">{student.fullName}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {student.group} · {courseSubject}
          </p>
          <p className="tabular mt-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {stats.recorded === 0 ? "Sin registros históricos" : `${stats.present + stats.late} de ${stats.recorded} jornadas asistidas`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display tabular text-[18px] font-bold leading-none text-brand">
            {stats.attendanceRate === null ? "—" : `${Math.round(stats.attendanceRate)}%`}
          </p>
          <span className={cn("mt-1 inline-flex items-center gap-0.5 text-xs font-semibold", trendTone)}>
            <TrendIcon className="h-3 w-3" aria-hidden="true" />{trendLabel}
          </span>
        </div>
      </header>

      <div className="mt-2 flex min-w-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5">
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold",
            flag ? SEVERITY_CLASS[flag.severity] : "bg-st-present/10 text-st-present",
          )}
        >
          {flag?.label ?? "Sin señales"}
        </span>
        {attentionText ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground" title={attentionText}>
            {attentionText}
          </span>
        ) : (
          <span className="min-w-0 truncate text-xs text-muted-foreground">Sin alertas activas</span>
        )}
      </div>

      <section className="mt-2.5" aria-label="Estado de asistencia de hoy">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Estado de hoy
          </p>
          <span className="text-xs font-medium text-muted-foreground">
            Actual: {STATUS_CONTROL_LABELS[status]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {POPOVER_CONTROLS.map(control => {
            const meta = STATUS_META[control];
            const active = status === control;
            return (
              <button
                key={control}
                type="button"
                onClick={() => onStatus(control)}
                aria-pressed={active}
                aria-label={STATUS_CONTROL_LABELS[control]}
                title={STATUS_CONTROL_LABELS[control]}
                className={cn(
                  "flex h-7 flex-1 items-center justify-center rounded-[8px] text-xs font-semibold",
                  "transition-colors duration-150",
                  active
                    ? STATUS_CHIP[control]
                    : "bg-surface-2 text-muted-foreground ring-1 ring-inset ring-hairline hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="tabular">{meta.letter}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-hairline bg-surface-1 p-1">
        <Metric label="Registradas" value={`${stats.recorded}`} />
        <Metric label="Ausencias" value={`${stats.absent}`} tone={stats.absent ? "text-st-absent" : undefined} />
        <Metric label="Tardanzas" value={`${stats.late}`} tone={stats.late ? "text-st-late" : undefined} />
        <Metric label="Excusas" value={`${stats.excuse}`} tone={stats.excuse ? "text-st-excuse" : undefined} />
      </div>

      <div className="mt-2.5 flex items-center gap-2" aria-label={`Últimas ${stats.recent.length} jornadas de asistencia`}>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Últimas {stats.recent.length}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-[3px]">
          {stats.recent.map(record => (
            <span
              key={record.date}
              title={`${formatShortDate(record.date)} · ${STATUS_META[record.status].label}`}
              className={cn(
                "h-2 flex-1 rounded-full",
                record.status === "pending" ? "bg-foreground/[0.1]" : STATUS_DOT[record.status],
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-hairline pt-2">
        <ActionButton
          title="Ver historial del estudiante"
          icon={<History className="h-3 w-3 shrink-0" aria-hidden="true" />}
          disabled={!onOpenHistory}
          onClick={() => onOpenHistory?.(student)}
        >
          Historial
        </ActionButton>
        <ActionButton
          title="Abrir seguimiento del estudiante"
          icon={<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
          disabled={!onOpenFollowUp}
          onClick={() => onOpenFollowUp?.(student)}
        >
          Seguimiento
        </ActionButton>
        <ActionButton
          title={onOpenExpediente ? "Abrir Expediente 360° del estudiante" : "El expediente no está conectado en este contexto"}
          icon={<ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
          disabled={!onOpenExpediente}
          onClick={() => onOpenExpediente?.(student)}
        >
          Expediente
        </ActionButton>
      </div>
    </div>
  );
});

StudentPopover.displayName = "StudentPopover";

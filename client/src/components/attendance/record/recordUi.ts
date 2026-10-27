/**
 * Piezas compartidas del expediente del estudiante: estilos por estado con los
 * tokens del módulo de Asistencia (`--st-*`) y formateo de fechas es-CO.
 */
import type { AttendanceDay, AttendanceJustificationItem, AttendanceStatus } from "../types";

export type RecordedStatus = Exclude<AttendanceStatus, "pending">;

export const RECORD_STATUS: Record<AttendanceStatus, { label: string; letter: string; dot: string; chip: string; text: string }> = {
  present: {
    label: "Presente",
    letter: "P",
    dot: "bg-st-present",
    chip: "bg-st-present/12 text-st-present ring-st-present/25",
    text: "text-st-present",
  },
  absent: {
    label: "Ausente",
    letter: "A",
    dot: "bg-st-absent",
    chip: "bg-st-absent/12 text-st-absent ring-st-absent/25",
    text: "text-st-absent",
  },
  late: {
    label: "Tardanza",
    letter: "T",
    dot: "bg-st-late",
    chip: "bg-st-late/14 text-st-late ring-st-late/25",
    text: "text-st-late",
  },
  excused: {
    label: "Excusa",
    letter: "E",
    dot: "bg-st-excuse",
    chip: "bg-st-excuse/12 text-st-excuse ring-st-excuse/25",
    text: "text-st-excuse",
  },
  pending: {
    label: "Sin registro",
    letter: "—",
    dot: "bg-st-pending/50",
    chip: "bg-foreground/[0.05] text-muted-foreground ring-hairline",
    text: "text-muted-foreground",
  },
};

export const RECORDED_STATUSES: RecordedStatus[] = ["present", "absent", "late", "excused"];

export const SUBMITTER_ROLE_LABEL: Record<AttendanceJustificationItem["submittedByRole"], string> = {
  guardian: "Acudiente",
  student: "Estudiante",
  teacher: "Docente",
};

/** Excusas que todavía esperan una decisión del docente. */
export const OPEN_JUSTIFICATION_STATUSES: AttendanceJustificationItem["status"][] = [
  "submitted",
  "pending_physical_support",
  "in_review",
];

export interface RecordStats {
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Presentes + tardanzas sobre lo registrado; null sin registros (misma regla que la planilla). */
  rate: number | null;
}

export function computeRecordStats(
  studentId: string,
  days: AttendanceDay[],
  getStatus: (studentId: string, date: string) => AttendanceStatus,
): RecordStats {
  const stats = { recorded: 0, present: 0, absent: 0, late: 0, excused: 0 };
  for (const day of days) {
    const status = getStatus(studentId, day.iso);
    if (status === "pending") continue;
    stats.recorded += 1;
    stats[status] += 1;
  }
  const rate = stats.recorded === 0 ? null : Math.round(((stats.present + stats.late) / stats.recorded) * 100);
  return { ...stats, rate };
}

/** Mismos umbrales de color que la planilla. */
export function rateTone(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 85) return "text-st-present";
  return rate >= 70 ? "text-st-late" : "text-st-absent";
}

const parseIso = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("es-CO", { weekday: "short" });
const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", { month: "short" });
const LONG_DAY_FORMAT = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

const clean = (text: string) => text.replace(/\./g, "").replace(/,/g, "");

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Lun 14 sep" (sin el "de" que agrega es-CO). */
export function formatDay(iso: string): string {
  const date = parseIso(iso);
  return capitalize(`${clean(WEEKDAY_FORMAT.format(date))} ${date.getDate()} ${clean(MONTH_FORMAT.format(date))}`);
}

/** "Lunes, 14 de septiembre" */
export function formatLongDay(iso: string): string {
  return capitalize(LONG_DAY_FORMAT.format(parseIso(iso)));
}

/** "14 sep 2026" para fechas con hora (timestamps del servidor). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : clean(DATE_FORMAT.format(date));
}

/** "14 sep, 08:30" */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMAT.format(date).replace(".", "");
}

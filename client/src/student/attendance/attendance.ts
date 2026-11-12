/**
 * Modelo de "Mi asistencia": registro por día, totales y excusas del estudiante.
 * Las fechas de asistencia se guardan a medianoche UTC; se leen por su día UTC para que
 * en Colombia (UTC−5) no aparezcan un día antes.
 */
import { plural, toDate } from "../format";
import type { Tone } from "../ui";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface RawAttendanceRecord {
  id: number;
  courseId: string;
  studentId: string;
  attendanceDate: Date | string;
  status: AttendanceStatus;
  recordedByName?: string | null;
}

export type JustificationStatus =
  | "absence_registered"
  | "scheduled_absence"
  | "submitted"
  | "pending_physical_support"
  | "in_review"
  | "approved"
  | "unjustified"
  | "rejected";

export interface RawJustification {
  id: number;
  attendanceDate: Date | string;
  status: JustificationStatus;
  reasonCategory: string;
  description: string;
  submittedAt: Date | string;
  digitalEvidenceName?: string | null;
}

export interface JustificationModel {
  id: number;
  date: Date;
  status: JustificationStatus;
  statusLabel: string;
  tone: Tone;
  reasonLabel: string;
  description: string;
  submittedAt: Date;
  evidenceName: string | null;
}

export interface DayModel {
  id: number;
  /** Día local equivalente al día UTC registrado. */
  date: Date;
  status: AttendanceStatus;
  courseId: string;
  studentId: string;
  /** Docente que tomó la asistencia ese día. */
  recordedBy: string | null;
  justification: JustificationModel | null;
  /** Ausencia sin excusa vigente (sin radicar o no aprobada). */
  needsExcuse: boolean;
}

export interface AttendanceModel {
  days: DayModel[];
  registered: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Asistencia = días asistidos (a tiempo o tarde) / días registrados, en %. */
  rate: number | null;
  pendingExcuses: DayModel[];
  justifications: JustificationModel[];
}

/** Medianoche UTC → mismo día en hora local. */
export function utcDay(value: Date | string): Date {
  const date = toDate(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const dayKey = (value: Date | string) => toDate(value).toISOString().slice(0, 10);

export const STATUS_META: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  present: { label: "Presente", tone: "ok" },
  late: { label: "Tarde", tone: "warn" },
  absent: { label: "Ausente", tone: "alert" },
  excused: { label: "Excusa", tone: "info" },
};

export const REASON_LABELS: Record<string, string> = {
  medical: "Salud",
  family_emergency: "Calamidad familiar",
  external_appointment: "Cita o trámite",
  institutional: "Actividad institucional",
  force_majeure: "Fuerza mayor",
  other: "Otro motivo",
};

const JUSTIFICATION_META: Record<JustificationStatus, { label: string; tone: Tone }> = {
  absence_registered: { label: "Registrada", tone: "neutral" },
  scheduled_absence: { label: "Programada", tone: "info" },
  submitted: { label: "En revisión", tone: "warn" },
  pending_physical_support: { label: "Falta soporte físico", tone: "warn" },
  in_review: { label: "En revisión", tone: "warn" },
  approved: { label: "Aprobada", tone: "ok" },
  unjustified: { label: "No justificada", tone: "alert" },
  rejected: { label: "Rechazada", tone: "alert" },
};

/** Una excusa sigue vigente mientras no la rechacen. */
const isLiveExcuse = (status: JustificationStatus) => status !== "unjustified" && status !== "rejected";

function toJustification(row: RawJustification): JustificationModel {
  const meta = JUSTIFICATION_META[row.status] ?? JUSTIFICATION_META.submitted;
  return {
    id: row.id,
    date: utcDay(row.attendanceDate),
    status: row.status,
    statusLabel: meta.label,
    tone: meta.tone,
    reasonLabel: REASON_LABELS[row.reasonCategory] ?? REASON_LABELS.other,
    description: row.description,
    submittedAt: toDate(row.submittedAt),
    evidenceName: row.digitalEvidenceName ?? null,
  };
}

export function buildAttendanceModel(records: RawAttendanceRecord[], justificationRows: RawJustification[]): AttendanceModel {
  const justifications = justificationRows
    .map(toJustification)
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  // La excusa más reciente de cada día
  const byDay = new Map<string, { row: RawJustification; model: JustificationModel }>();
  for (const row of justificationRows) {
    const key = dayKey(row.attendanceDate);
    const current = byDay.get(key);
    if (!current || toDate(row.submittedAt) > toDate(current.row.submittedAt)) byDay.set(key, { row, model: toJustification(row) });
  }

  // Un registro por día (el más reciente si hubiera duplicados entre cursos)
  const seen = new Set<string>();
  const days = [...records]
    .sort((a, b) => toDate(b.attendanceDate).getTime() - toDate(a.attendanceDate).getTime())
    .filter(record => {
      const key = dayKey(record.attendanceDate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((record): DayModel => {
      const justification = byDay.get(dayKey(record.attendanceDate))?.model ?? null;
      return {
        id: record.id,
        date: utcDay(record.attendanceDate),
        status: record.status,
        courseId: record.courseId,
        studentId: record.studentId,
        recordedBy: record.recordedByName?.trim() || null,
        justification,
        needsExcuse: record.status === "absent" && !(justification && isLiveExcuse(justification.status)),
      };
    });

  const count = (status: AttendanceStatus) => days.filter(day => day.status === status).length;
  const present = count("present");
  const late = count("late");
  return {
    days,
    registered: days.length,
    present,
    late,
    absent: count("absent"),
    excused: count("excused"),
    rate: days.length ? Math.round(((present + late) / days.length) * 100) : null,
    pendingExcuses: days.filter(day => day.needsExcuse),
    justifications,
  };
}

/** Nota de la franja para ausencias: "1 sin excusa" o "Todas con excusa". */
export function absenceNote(model: AttendanceModel): string {
  if (!model.absent && !model.excused) return "Ninguna en el registro";
  if (model.pendingExcuses.length) return `${plural(model.pendingExcuses.length, "sin excusa", "sin excusa")}`;
  return model.excused ? `${plural(model.excused, "con excusa", "con excusa")}` : "Todas con excusa";
}

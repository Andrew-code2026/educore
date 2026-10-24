import { AlertCircle, CalendarClock, Check, Clock3, FileCheck2, FileText, Hourglass, ShieldAlert, XCircle } from "lucide-react";

export type AttendanceStatus = "pending" | "present" | "absent" | "late" | "excused";
export type FollowUpStatus = "open" | "in_review" | "resolved";
export type AttendancePriority = "low" | "medium" | "high";

export type AttendanceJustificationStatus =
  | "absence_registered"
  | "scheduled_absence"
  | "submitted"
  | "pending_physical_support"
  | "in_review"
  | "approved"
  | "unjustified"
  | "rejected";

export type AttendanceJustificationReasonCategory =
  | "medical"
  | "family_emergency"
  | "external_appointment"
  | "institutional"
  | "force_majeure"
  | "other";

export interface AttendanceDay {
  iso: string;
  label: string;
}

export interface AttendanceStudent {
  id: string;
  numericId?: number;
  name: string;
  code: string;
  course: string;
  gradeLevel?: string;
  academicStatus?: string;
  avatar?: string;
  avatarColor?: string;
  email?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  attendanceRate: number;
  absencesCount: number;
}

export interface AttendanceCourse {
  id: string;
  label: string;
  subject: string;
  room: string;
  time: string;
  color: string;
  students: AttendanceStudent[];
  teacherName?: string;
}

export interface AttendanceFollowUpCaseItem {
  id: number;
  courseId: string;
  studentId: string;
  reason: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_review" | "resolved";
  responsibleUserId: number | null;
  responsibleName: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt?: Date | string | null;
}

export interface AttendanceFollowUpNoteItem {
  id: number;
  caseId: number;
  note: string;
  authorUserId: number | null;
  authorName: string;
  createdAt: Date | string;
}

export interface AttendanceJustificationEventItem {
  id: number;
  justificationId: number;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorRole: string;
  actorName: string;
  actorUserId?: number | null;
  notes?: string | null;
  createdAt: Date | string;
}

export interface AttendanceJustificationItem {
  id: number;
  schoolId?: number;
  courseId: string;
  studentId: string;
  attendanceDate: string; // ISO date: YYYY-MM-DD
  reasonCategory: AttendanceJustificationReasonCategory;
  description: string;
  submittedByRole: "student" | "guardian" | "teacher";
  submittedByName: string;
  submittedByUserId?: number | null;
  submittedAt: Date | string;
  digitalEvidenceUrl?: string | null;
  digitalEvidenceName?: string | null;
  requiresPhysicalSupport: boolean;
  physicalSupportDeadline?: Date | string | null;
  physicalSupportReceivedAt?: Date | string | null;
  physicalSupportReceivedByName?: string | null;
  physicalSupportReceivedByUserId?: number | null;
  physicalSupportNotes?: string | null;
  status: AttendanceJustificationStatus;
  escalatedToCoordination: boolean;
  coordinationNotes?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: Date | string | null;
  resolvedByName?: string | null;
  resolvedByUserId?: number | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  events?: AttendanceJustificationEventItem[];
  currentAttendanceStatus?: string | null;
  attendancePostModified?: boolean;
  studentName?: string;
  studentCode?: string;
  studentAvatarColor?: string;
  guardianName?: string | null;
  canonicalStudentId?: string;
}

export const JUSTIFICATION_REASON_LABELS: Record<AttendanceJustificationReasonCategory, string> = {
  medical: "Incapacidad médica / Salud",
  family_emergency: "Calamidad o emergencia familiar",
  external_appointment: "Cita médica o procedimiento externo",
  institutional: "Representación institucional / Deportiva / Cultural",
  force_majeure: "Fuerza mayor / Clima / Transporte",
  other: "Otro motivo justificable",
};

export const JUSTIFICATION_STATUS_META: Record<
  AttendanceJustificationStatus,
  {
    label: string;
    description: string;
    tone: string;
    badge: string;
    soft: string;
    dotColor: string;
    icon: typeof Check;
  }
> = {
  absence_registered: {
    label: "Ausencia registrada",
    description: "Inasistencia asentada por el docente, en espera de soporte o radicación de excusa.",
    tone: "text-slate-600",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    soft: "bg-slate-50 text-slate-700 border-slate-200",
    dotColor: "bg-slate-400",
    icon: Clock3,
  },
  scheduled_absence: {
    label: "Inasistencia programada",
    description: "Aviso previo de inasistencia radicado con anticipación por el acudiente o estudiante. No genera falta en lista antes de la fecha.",
    tone: "text-purple-700",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    soft: "bg-purple-50 text-purple-800 border-purple-200",
    dotColor: "bg-purple-500",
    icon: CalendarClock,
  },
  submitted: {
    label: "Excusa enviada",
    description: "Radicada por acudiente o estudiante con constancia digital, pendiente de revisión.",
    tone: "text-blue-700",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    soft: "bg-blue-50 text-blue-800 border-blue-200",
    dotColor: "bg-blue-500",
    icon: FileText,
  },
  pending_physical_support: {
    label: "Pendiente soporte físico",
    description: "Radicada digitalmente con compromiso obligatorio de entregar documento original en el colegio.",
    tone: "text-amber-700",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    soft: "bg-amber-50 text-amber-900 border-amber-200",
    dotColor: "bg-amber-500",
    icon: Hourglass,
  },
  in_review: {
    label: "En revisión",
    description: "Documentación recibida y en proceso de verificación por el docente o coordinación.",
    tone: "text-indigo-700",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    soft: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dotColor: "bg-indigo-500",
    icon: Clock3,
  },
  approved: {
    label: "Justificada",
    description: "Inasistencia aprobada formalmente. La falta pasa a estado justificado en la planilla.",
    tone: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    soft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotColor: "bg-emerald-500",
    icon: Check,
  },
  unjustified: {
    label: "No justificada",
    description: "Plazo vencido o causal no contemplada en el reglamento. La inasistencia permanece como falta.",
    tone: "text-zinc-600",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-200",
    soft: "bg-zinc-50 text-zinc-700 border-zinc-200",
    dotColor: "bg-zinc-400",
    icon: AlertCircle,
  },
  rejected: {
    label: "Rechazada",
    description: "Soporte inválido, inconsistente o rechazado formalmente por la institución.",
    tone: "text-rose-700",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    soft: "bg-rose-50 text-rose-800 border-rose-200",
    dotColor: "bg-rose-500",
    icon: ShieldAlert,
  },
};

export const ACTIONABLE_STATUSES: Exclude<AttendanceStatus, "pending">[] = [
  "present",
  "absent",
  "late",
  "excused",
];

export const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    short: string;
    icon: typeof Check;
    tone: string;
    soft: string;
    badge: string;
    dotColor: string;
  }
> = {
  pending: {
    label: "Pendiente",
    short: "·",
    icon: Clock3,
    tone: "text-amber-700",
    soft: "bg-amber-50 text-amber-800 border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-400",
  },
  present: {
    label: "Presente",
    short: "P",
    icon: Check,
    tone: "text-emerald-700",
    soft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  absent: {
    label: "Ausente",
    short: "A",
    icon: XCircle,
    tone: "text-rose-700",
    soft: "bg-rose-50 text-rose-800 border-rose-200",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dotColor: "bg-rose-500",
  },
  late: {
    label: "Tardanza",
    short: "T",
    icon: Clock3,
    tone: "text-amber-700",
    soft: "bg-amber-50 text-amber-800 border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-400",
  },
  excused: {
    label: "Excusa",
    short: "E",
    icon: FileCheck2,
    tone: "text-blue-700",
    soft: "bg-blue-50 text-blue-800 border-blue-200",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
};

export type HistoryTimeframe = "last7" | "last4weeks" | "period";

export interface HistorySummaryStats {
  totalDays: number;
  recordedDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  pendingCount: number;
  attendanceRate: number;
  trend: "improving" | "stable" | "declining";
  trendLabel: string;
}

export type StudentRecordTab =
  | "summary"
  | "attendance"
  | "history"
  | "justifications"
  | "follow_up"
  | "timeline";

export interface StudentTimelineItem {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  timestamp: Date | string;
  type:
    | "absence"
    | "late"
    | "excuse_submitted"
    | "excuse_resolved"
    | "physical_received"
    | "case_opened"
    | "case_resolved"
    | "follow_up_note";
  title: string;
  description: string;
  actorRole: string;
  actorName: string;
  badgeLabel?: string;
  badgeTone?: "rose" | "amber" | "blue" | "emerald" | "slate" | "indigo";
  metadata?: Record<string, any>;
}

export const DEFAULT_ATTENDANCE_DAYS: AttendanceDay[] = [
  // Semana 1 (24–28 Ago)
  { iso: "2026-08-24", label: "Lun 24" },
  { iso: "2026-08-25", label: "Mar 25" },
  { iso: "2026-08-26", label: "Mié 26" },
  { iso: "2026-08-27", label: "Jue 27" },
  { iso: "2026-08-28", label: "Vie 28" },
  // Semana 2 (31 Ago – 04 Sep)
  { iso: "2026-08-31", label: "Lun 31" },
  { iso: "2026-09-01", label: "Mar 01" },
  { iso: "2026-09-02", label: "Mié 02" },
  { iso: "2026-09-03", label: "Jue 03" },
  { iso: "2026-09-04", label: "Vie 04" },
  // Semana 3 (07–11 Sep)
  { iso: "2026-09-07", label: "Lun 07" },
  { iso: "2026-09-08", label: "Mar 08" },
  { iso: "2026-09-09", label: "Mié 09" },
  { iso: "2026-09-10", label: "Jue 10" },
  { iso: "2026-09-11", label: "Vie 11" },
  // Semana 4 (14–19 Sep - Semana actual)
  { iso: "2026-09-14", label: "Lun 14" },
  { iso: "2026-09-15", label: "Mar 15" },
  { iso: "2026-09-16", label: "Mié 16" },
  { iso: "2026-09-17", label: "Jue 17" },
  { iso: "2026-09-18", label: "Vie 18" },
  { iso: "2026-09-19", label: "Sáb 19" },
];

/**
 * Normaliza cualquier formato de fecha (Date, ISO string, etc.) a formato canónico "YYYY-MM-DD"
 * utilizando valores UTC para evitar desfases por zonas horarias locales.
 */
export function normalizeDateIso(val: string | Date | undefined | null): string {
  if (!val) return "";
  if (typeof val === "string") {
    return val.split("T")[0];
  }
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}


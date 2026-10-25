/** Línea de tiempo unificada del estudiante (la usa la ficha imprimible). */
import {
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  normalizeDateIso,
  type AttendanceCourse,
  type AttendanceDay,
  type AttendanceFollowUpCaseItem,
  type AttendanceFollowUpNoteItem,
  type AttendanceJustificationItem,
  type AttendanceStatus,
  type StudentTimelineItem,
} from "../types";
import { SUBMITTER_ROLE_LABEL, formatDay } from "./recordUi";

export const PRIORITY_LABEL = { high: "Alta", medium: "Media", low: "Baja" } as const;

export function buildStudentTimeline({
  studentId,
  course,
  days,
  getStatus,
  justifications,
  cases,
  notes,
}: {
  studentId: string;
  course: AttendanceCourse;
  days: AttendanceDay[];
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  justifications: AttendanceJustificationItem[];
  cases: AttendanceFollowUpCaseItem[];
  notes: AttendanceFollowUpNoteItem[];
}): StudentTimelineItem[] {
  const items: StudentTimelineItem[] = [];
  const teacher = course.teacherName || "Docente del curso";

  for (const day of days) {
    const status = getStatus(studentId, day.iso);
    if (status !== "absent" && status !== "late") continue;
    const absent = status === "absent";
    items.push({
      id: `att-${status}-${day.iso}`,
      date: day.iso,
      timestamp: `${day.iso}T12:00:00`,
      type: absent ? "absence" : "late",
      title: `${absent ? "Inasistencia" : "Llegada tarde"} · ${formatDay(day.iso)}`,
      description: `${course.subject} · ${course.label}`,
      actorRole: "Docente",
      actorName: teacher,
      badgeLabel: absent ? "Falta" : "Tardanza",
      badgeTone: absent ? "rose" : "amber",
    });
  }

  for (const just of justifications) {
    items.push({
      id: `just-sub-${just.id}`,
      date: just.attendanceDate,
      timestamp: just.submittedAt || `${just.attendanceDate}T12:00:00`,
      type: "excuse_submitted",
      title: `Excusa radicada para el ${formatDay(just.attendanceDate)}`,
      description: `${JUSTIFICATION_REASON_LABELS[just.reasonCategory]}. ${just.description}`,
      actorRole: SUBMITTER_ROLE_LABEL[just.submittedByRole],
      actorName: just.submittedByName,
      badgeLabel: JUSTIFICATION_STATUS_META[just.status].label,
      badgeTone: just.status === "approved" ? "emerald" : "blue",
    });
    if (just.physicalSupportReceivedAt) {
      items.push({
        id: `just-phys-${just.id}`,
        date: normalizeDateIso(just.physicalSupportReceivedAt),
        timestamp: just.physicalSupportReceivedAt,
        type: "physical_received",
        title: "Soporte físico recibido",
        description: just.physicalSupportNotes || "Documento original entregado.",
        actorRole: "Institución",
        actorName: just.physicalSupportReceivedByName || "Coordinación",
        badgeLabel: "Físico entregado",
        badgeTone: "indigo",
      });
    }
    if (just.resolvedAt) {
      items.push({
        id: `just-res-${just.id}`,
        date: normalizeDateIso(just.resolvedAt),
        timestamp: just.resolvedAt,
        type: "excuse_resolved",
        title: `Excusa resuelta: ${JUSTIFICATION_STATUS_META[just.status].label}`,
        description: just.resolutionNotes || "Trámite concluido.",
        actorRole: "Docente / Coordinación",
        actorName: just.resolvedByName || teacher,
        badgeLabel: JUSTIFICATION_STATUS_META[just.status].label,
        badgeTone: just.status === "approved" ? "emerald" : just.status === "rejected" ? "rose" : "slate",
      });
    }
  }

  for (const item of cases) {
    items.push({
      id: `case-open-${item.id}`,
      date: normalizeDateIso(item.createdAt),
      timestamp: item.createdAt,
      type: "case_opened",
      title: "Caso de seguimiento abierto",
      description: `${item.reason} · Prioridad ${PRIORITY_LABEL[item.priority].toLowerCase()}`,
      actorRole: "Docente",
      actorName: item.responsibleName,
      badgeLabel: item.status === "resolved" ? "Caso resuelto" : "Caso abierto",
      badgeTone: item.status === "resolved" ? "emerald" : "indigo",
    });
    if (item.resolvedAt) {
      items.push({
        id: `case-res-${item.id}`,
        date: normalizeDateIso(item.resolvedAt),
        timestamp: item.resolvedAt,
        type: "case_resolved",
        title: "Caso de seguimiento resuelto",
        description: item.reason,
        actorRole: "Docente",
        actorName: item.responsibleName,
        badgeLabel: "Resuelto",
        badgeTone: "emerald",
      });
    }
  }

  for (const note of notes) {
    items.push({
      id: `note-${note.id}`,
      date: normalizeDateIso(note.createdAt),
      timestamp: note.createdAt,
      type: "follow_up_note",
      title: "Nota de seguimiento",
      description: note.note,
      actorRole: "Docente",
      actorName: note.authorName,
      badgeLabel: "Acuerdo",
      badgeTone: "slate",
    });
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}


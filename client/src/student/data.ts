import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { buildAttendanceModel, type RawAttendanceRecord, type RawJustification } from "./attendance/attendance";
import { buildTasks, type RawSubmission, type RawTask } from "./tasks/tasks";
import { STUDENT_VIEWER, belongsToViewer, viewerQuery, type Viewer } from "./viewer";

/**
 * Notas por periodo (`undefined` = periodo activo) del estudiante o del hijo del acudiente.
 * Al cambiar de periodo se conservan las notas en pantalla; al cambiar de hijo, no.
 */
export function useStudentGrades(academicPeriodId?: number, viewer: Viewer = STUDENT_VIEWER) {
  return trpc.student.grades.useQuery(
    { ...viewerQuery(viewer), academicPeriodId },
    { staleTime: 30_000, placeholderData: previous => (previous && belongsToViewer(viewer, previous.student.id) ? previous : undefined) },
  );
}

/** Registro de asistencia y excusas (el servidor limita al estudiante o a los hijos vinculados). */
export function useStudentAttendance(viewer: Viewer = STUDENT_VIEWER) {
  const input = viewer.kind === "guardian" ? { role: "guardian" as const, studentId: String(viewer.child.id) } : { role: "student" as const };
  const records = trpc.attendance.list.useQuery(input, { staleTime: 30_000 });
  const justifications = trpc.justification.list.useQuery(input, { staleTime: 30_000 });
  const model = useMemo(
    () => (records.data ? buildAttendanceModel(records.data as RawAttendanceRecord[], (justifications.data ?? []) as RawJustification[]) : null),
    [records.data, justifications.data],
  );
  return {
    model,
    isLoading: records.isLoading || justifications.isLoading,
    isError: records.isError || justifications.isError,
    refetch: () => Promise.all([records.refetch(), justifications.refetch()]),
  };
}

/** Tareas desde el snapshot: actividades del curso y entregas propias. */
export function useStudentTasks(data: any, now: Date) {
  return useMemo(() => buildTasks((data?.assignments ?? []) as RawTask[], (data?.submissions ?? []) as RawSubmission[], now), [data?.assignments, data?.submissions, now]);
}

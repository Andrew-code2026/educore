import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { buildAttendanceModel, type RawAttendanceRecord, type RawJustification } from "./attendance/attendance";
import { buildTasks, type RawSubmission, type RawTask } from "./tasks/tasks";

/** Notas del estudiante por periodo (`undefined` = periodo activo). */
export function useStudentGrades(academicPeriodId?: number) {
  return trpc.student.grades.useQuery({ role: "student", academicPeriodId }, { staleTime: 30_000, placeholderData: keepPreviousData });
}

/** Registro de asistencia y excusas del estudiante autenticado. */
export function useStudentAttendance() {
  const records = trpc.attendance.list.useQuery({ role: "student" }, { staleTime: 30_000 });
  const justifications = trpc.justification.list.useQuery({ role: "student" }, { staleTime: 30_000 });
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

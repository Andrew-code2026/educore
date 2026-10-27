import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { EduRole, Section } from "@/components/shell";
import { adaptEduCoreDataToManus } from "@/attendance/adapter";
import { attentionFlagsFor } from "@/attendance/data/selectors";
import { ABSENCE_ALERTS, resolveActivePeriod } from "@/attendance/landing/landing";
import { AnalyticsLanding } from "@/analytics/AnalyticsLanding";
import {
  buildAnalyticsLanding,
  type AlertModel,
  type AttendanceAlertInput,
} from "@/analytics/landing";

interface AnalyticsPageProps {
  data: any;
  role: EduRole;
  setSection: (section: Section) => void;
}

const LEDE: Partial<Record<EduRole, string>> = {
  teacher: "Detecta a tiempo a los estudiantes que necesitan acompañamiento y revisa el rendimiento de tus planillas.",
  admin: "Detecta a tiempo a los estudiantes que necesitan acompañamiento y revisa el rendimiento de las planillas del colegio.",
};

export function AnalyticsPage({ data, role, setSection }: AnalyticsPageProps) {
  const planillasQuery = trpc.gradeCenter.assignments.useQuery({ role }, { staleTime: 30_000, retry: 1 });
  // Mismos registros que usa Asistencia para que ambas vistas cuenten las mismas alertas
  const attendanceQuery = trpc.attendance.list.useQuery(undefined, { staleTime: 30_000, retry: 1 });

  const attendanceAlerts = useMemo<AttendanceAlertInput[]>(() => {
    const { courses, todayStatusesByCourse } = adaptEduCoreDataToManus({
      snapshotData: data,
      realAttendanceRecords: attendanceQuery.data,
    });
    return courses.flatMap((course) =>
      course.students.flatMap((student) => {
        const flag = attentionFlagsFor(student, todayStatusesByCourse[course.id]?.[student.id] ?? "pending").find(
          (item) => ABSENCE_ALERTS.has(item.kind),
        );
        return flag
          ? [
              {
                studentName: student.fullName,
                initials: student.initials,
                group: course.name,
                subject: course.subject,
                label: flag.label,
                detail: flag.detail,
                severity: flag.severity,
              },
            ]
          : [];
      }),
    );
  }, [data, attendanceQuery.data]);

  const model = useMemo(
    () =>
      planillasQuery.data
        ? buildAnalyticsLanding({ planillas: planillasQuery.data, attendanceAlerts })
        : null,
    [planillasQuery.data, attendanceAlerts],
  );

  const period = useMemo(() => resolveActivePeriod(data?.academicPeriods)?.name ?? null, [data?.academicPeriods]);

  const handleOpenAlert = useCallback(
    (alert: AlertModel) => setSection(alert.kind === "academic" ? "grades" : "attendance"),
    [setSection],
  );
  const handleOpenPlanilla = useCallback(() => setSection("grades"), [setSection]);
  const { refetch: refetchPlanillas } = planillasQuery;
  const handleRetry = useCallback(() => void refetchPlanillas(), [refetchPlanillas]);

  return (
    <AnalyticsLanding
      model={model}
      academicYear={String(new Date().getFullYear())}
      period={period}
      lede={LEDE[role] ?? LEDE.teacher!}
      error={planillasQuery.isError && !planillasQuery.data}
      onRetry={handleRetry}
      onOpenAlert={handleOpenAlert}
      onOpenPlanilla={handleOpenPlanilla}
    />
  );
}

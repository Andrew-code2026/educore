import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { EduRole, Section } from "@/components/shell";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { plural } from "@/analytics/landing";
import { ReportsLanding } from "@/reports/ReportsLanding";
import { CourseReportCards } from "@/reports/CourseReportCards";
import { buildReportsLanding, type ReportCardModel } from "@/reports/landing";
import { buildCourseReportCards, buildReportCardSchool } from "@/reports/reportCard";

interface ReportsPageProps {
  data: any;
  role: EduRole;
  setSection: (section: Section) => void;
}

const LEDE: Partial<Record<EduRole, string>> = {
  teacher: "Encuentra tendencias en tus cursos sin perder de vista a las personas detrás de los datos.",
  admin: "Encuentra tendencias del colegio y gestiona los boletines del periodo.",
};

export function ReportsPage({ data, role, setSection }: ReportsPageProps) {
  const utils = trpc.useUtils();
  const planillasQuery = trpc.gradeCenter.assignments.useQuery({ role }, { staleTime: 30_000, retry: 1 });
  const reportCardsQuery = trpc.gradeCenter.reportCards.useQuery({ role }, { staleTime: 30_000, retry: 1 });
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const generateMutation = trpc.gradeCenter.generateReportCards.useMutation();

  // Drill-down: boletines del curso abierto y, dentro, el estudiante elegido
  const [openCourse, setOpenCourse] = useState<ReportCardModel | null>(null);
  const [openStudentId, setOpenStudentId] = useState<number | null>(null);
  const courseReportCardsQuery = trpc.gradeCenter.courseReportCards.useQuery(
    { role, courseId: openCourse?.courseId ?? 0 },
    { enabled: openCourse !== null, staleTime: 30_000, retry: 1 },
  );
  const school = useMemo(() => buildReportCardSchool(data?.school), [data?.school]);
  const courseModel = useMemo(
    () => (courseReportCardsQuery.data ? buildCourseReportCards(courseReportCardsQuery.data) : null),
    [courseReportCardsQuery.data],
  );

  const model = useMemo(
    () =>
      planillasQuery.data && reportCardsQuery.data
        ? buildReportsLanding({
            planillas: planillasQuery.data,
            reportCards: reportCardsQuery.data.courses,
            canGenerate: reportCardsQuery.data.canGenerate,
          })
        : null,
    [planillasQuery.data, reportCardsQuery.data],
  );

  const period = useMemo(() => resolveActivePeriod(data?.academicPeriods)?.name ?? null, [data?.academicPeriods]);

  const { mutateAsync: generate } = generateMutation;
  const handleGenerate = useCallback(
    async (card: ReportCardModel) => {
      setGeneratingKey(card.key);
      try {
        const result = await generate({
          role,
          academicYearId: card.academicYearId,
          academicPeriodId: card.periodId,
          courseId: card.courseId,
        });
        if (result) {
          toast.success(`Boletines de ${card.group} generados: ${result.generated} de ${plural(result.total, "estudiante", "estudiantes")}.`);
        } else {
          toast.error("No hay conexión con la base de datos para generar boletines.");
        }
        await Promise.all([utils.gradeCenter.reportCards.invalidate(), utils.gradeCenter.courseReportCards.invalidate()]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `No pudimos generar los boletines de ${card.group}.`);
      } finally {
        setGeneratingKey(null);
      }
    },
    [generate, role, utils],
  );

  const handleOpenCourse = useCallback(() => setSection("grades"), [setSection]);
  const handleOpenAlerts = useCallback(() => setSection("analytics"), [setSection]);
  const { refetch: refetchPlanillas } = planillasQuery;
  const { refetch: refetchReportCards } = reportCardsQuery;
  const handleRetry = useCallback(() => {
    void refetchPlanillas();
    void refetchReportCards();
  }, [refetchPlanillas, refetchReportCards]);

  const handleOpenReportCards = useCallback((card: ReportCardModel) => {
    setOpenCourse(card);
    setOpenStudentId(null);
  }, []);
  const handleCloseReportCards = useCallback(() => setOpenCourse(null), []);
  const { refetch: refetchCourseReportCards } = courseReportCardsQuery;
  const handleRetryCourse = useCallback(() => void refetchCourseReportCards(), [refetchCourseReportCards]);

  const error =
    (planillasQuery.isError && !planillasQuery.data) || (reportCardsQuery.isError && !reportCardsQuery.data);

  if (openCourse) {
    return (
      <CourseReportCards
        group={openCourse.group}
        period={openCourse.period}
        model={courseModel}
        // `null` sin error: el servidor no tiene base de datos disponible
        error={(courseReportCardsQuery.isError && !courseReportCardsQuery.data) || courseReportCardsQuery.data === null}
        school={school}
        selectedStudentId={openStudentId}
        onSelectStudent={setOpenStudentId}
        onBack={handleCloseReportCards}
        onRetry={handleRetryCourse}
      />
    );
  }

  return (
    <ReportsLanding
      model={model}
      academicYear={String(new Date().getFullYear())}
      period={period}
      lede={LEDE[role] ?? LEDE.teacher!}
      error={error}
      generatingKey={generatingKey}
      onRetry={handleRetry}
      onOpenCourse={handleOpenCourse}
      onOpenAlerts={handleOpenAlerts}
      onGenerate={handleGenerate}
      onOpenReportCards={handleOpenReportCards}
    />
  );
}

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { EduRole, Section } from "@/components/shell";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { plural } from "@/analytics/landing";
import { ReportsLanding } from "@/reports/ReportsLanding";
import { buildReportsLanding, type ReportCardModel } from "@/reports/landing";

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
        await utils.gradeCenter.reportCards.invalidate();
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

  const error =
    (planillasQuery.isError && !planillasQuery.data) || (reportCardsQuery.isError && !reportCardsQuery.data);

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
    />
  );
}

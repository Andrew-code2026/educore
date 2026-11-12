import { useMemo } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StudentReportCard } from "@/reports/StudentReportCard";
import { EmptyCard, ErrorCard } from "@/reports/parts";
import { buildCourseReportCards, buildReportCardSchool } from "@/reports/reportCard";
import "@/reports/landing.css";
import "@/reports/report-card.css";

interface ReportCardViewProps {
  school: any;
  periodId: number | undefined;
  onBack: () => void;
}

/** Boletín del estudiante: la misma hoja imprimible que ve coordinación, solo con su información. */
export function ReportCardView({ school, periodId, onBack }: ReportCardViewProps) {
  const query = trpc.student.reportCard.useQuery({ role: "student", academicPeriodId: periodId }, { staleTime: 60_000 });
  const model = useMemo(() => (query.data ? buildCourseReportCards(query.data) : null), [query.data]);
  const reportSchool = useMemo(() => buildReportCardSchool(school), [school]);
  const student = model?.students[0] ?? null;

  return (
    <div className="rpt">
      <div aria-hidden="true" className="rpt__glow rpt__glow--a" />
      <div aria-hidden="true" className="rpt__glow rpt__glow--b" />
      <div className="rpt__content rcd">
        {model && student ? (
          <StudentReportCard course={model} student={student} school={reportSchool} onBack={onBack} backLabel="Mis calificaciones" />
        ) : (
          <>
            <div className="rcd-toolbar">
              <button type="button" className="rpt-btn rpt-btn--outline" onClick={onBack}>
                <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
                Mis calificaciones
              </button>
            </div>
            {query.isLoading ? (
              <div aria-busy="true" aria-label="Cargando boletín" className="rpt-surface rpt-list">
                {[0, 1, 2, 3].map(row => (
                  <span key={row} className="rpt-skeleton rpt-skeleton--row" />
                ))}
              </div>
            ) : query.isError ? (
              <ErrorCard title="No pudimos cargar tu boletín" detail={query.error.message} onRetry={() => void query.refetch()} />
            ) : (
              <EmptyCard icon={<FileText strokeWidth={1.9} />} title="Tu boletín aún no está disponible">
                Aparecerá cuando tengas materias evaluadas en el periodo.
              </EmptyCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

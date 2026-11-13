import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { LEVELS } from "@/gradecenter/domain/scale";
import { cn } from "@/lib/utils";
import { useStudentGrades } from "../data";
import { formatGrade, subjectInitials } from "../format";
import { useStudentParam } from "../links";
import { EmptyState, ErrorState, Grade, LevelPill, PageFrame, PageHeader, PageSkeleton, Section, Segmented, Sheet, SummaryStrip } from "../ui";
import { STUDENT_VIEWER, viewerCopy, type Viewer } from "../viewer";
import { attentionNote, buildGradesModel, visiblePeriods, type SubjectModel } from "./grades";
import { ReportCardView } from "./ReportCardView";
import { SubjectDetail } from "./SubjectDetail";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;
const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setMatches(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return matches;
}

interface StudentGradesPageProps {
  data: any;
  /** Estudiante (por defecto) o acudiente con el hijo elegido. */
  viewer?: Viewer;
  /** Selector de hijo del acudiente, junto a las acciones del encabezado. */
  switcher?: ReactNode;
}

export function StudentGradesPage({ data, viewer = STUDENT_VIEWER, switcher }: StudentGradesPageProps) {
  const [now] = useState(() => new Date());
  const [periodId, setPeriodId] = useState<number | undefined>(undefined);
  const [showReport, setShowReport] = useState(false);
  const [subjectParam, setSubjectParam] = useStudentParam("materia");
  const isDesktop = useIsDesktop();
  const copy = viewerCopy(viewer);
  const query = useStudentGrades(periodId, viewer);
  const model = useMemo(() => (query.data ? buildGradesModel(query.data, now, viewer.kind) : null), [query.data, now, viewer.kind]);
  const periods = useMemo(() => visiblePeriods(query.data?.periods ?? []), [query.data?.periods]);

  // Selección: la de la URL; en escritorio, si no hay, la que requiere atención (en móvil abre un cajón)
  const selectedId = subjectParam ?? (isDesktop ? model?.defaultSubjectId ?? null : null);
  const selected = model?.subjects.find(subject => subject.id === selectedId) ?? null;

  if (showReport) return <ReportCardView school={data?.school} periodId={query.data?.period?.id} viewer={viewer} onBack={() => setShowReport(false)} />;

  return (
    <PageFrame label={copy.grades.title}>
      {!model && query.isLoading && <PageSkeleton label={copy.grades.loading} rows={6} />}
      {!model && query.isError && <ErrorState onRetry={() => void query.refetch()} title={copy.grades.error} />}

      {model && (
        <>
          <PageHeader
            title={copy.grades.title}
            lede={copy.grades.lede}
            period={model.periodName}
            actions={
              <>
                {switcher}
                {periods.length > 1 && (
                  <Segmented
                    label="Periodo"
                    options={periods.map(period => ({ value: String(period.id), label: period.name }))}
                    value={String(query.data?.period?.id ?? "")}
                    onChange={value => setPeriodId(Number(value))}
                  />
                )}
                <button type="button" className="stp-btn stp-btn--primary" onClick={() => setShowReport(true)} disabled={!model.subjects.length}>
                  <FileText {...ICON} />
                  {model.reportCardOfficial ? "Ver boletín" : "Ver boletín preliminar"}
                </button>
              </>
            }
            summary={
              <SummaryStrip
                label="Resumen del periodo"
                items={[
                  {
                    label: "Promedio",
                    value: model.average != null ? formatGrade(model.average) : "—",
                    tone: model.average != null && model.attention === 0 ? "accent" : undefined,
                    note: [model.level ? LEVELS[model.level].short : "Sin notas", model.deltaLabel].filter(Boolean).join(" · "),
                  },
                  { label: "Materias", value: model.subjects.length, note: attentionNote(model) },
                  { label: "Evaluaciones", value: model.graded, unit: `de ${model.total}`, note: model.periodClosed ? "Periodo cerrado" : "Calificadas en el periodo" },
                ]}
              />
            }
          />

          {model.subjects.length === 0 ? (
            <EmptyState page icon={<BookOpen {...ICON} />} title="Aún no hay materias en este periodo" note={copy.grades.emptyNote} />
          ) : (
            <div className="stp-split">
              <Section id="stp-subjects-heading" title="Materias" count={model.subjects.length}>
                <ul className="stp-surface stp-list" aria-label="Materias del periodo">
                  {model.subjects.map(subject => (
                    <li key={subject.id}>
                      <SubjectRow subject={subject} selected={isDesktop && subject.id === selected?.id} onSelect={() => setSubjectParam(subject.id)} />
                    </li>
                  ))}
                </ul>
              </Section>

              {isDesktop && selected && (
                <aside className="stp-surface stp-panel" aria-label={`Detalle de ${selected.name}`}>
                  <div className="stp-panel__head">
                    <span className="stp-bubble stp-bubble--dark" aria-hidden="true">
                      {subjectInitials(selected.name)}
                    </span>
                    <div>
                      <h2 className="stp-panel__title">{selected.name}</h2>
                      {selected.teacherName && <p className="stp-panel__sub">{selected.teacherName}</p>}
                    </div>
                  </div>
                  <SubjectDetail subject={selected} emptyNote={copy.noEvaluations} />
                </aside>
              )}
            </div>
          )}

          {!isDesktop && (
            <Sheet
              open={selected !== null}
              onOpenChange={open => !open && setSubjectParam(null)}
              leading={
                selected && (
                  <span className="stp-bubble stp-bubble--dark" aria-hidden="true">
                    {subjectInitials(selected.name)}
                  </span>
                )
              }
              title={selected?.name ?? "Materia"}
              subtitle={selected?.teacherName}
            >
              {selected && <SubjectDetail subject={selected} emptyNote={copy.noEvaluations} />}
            </Sheet>
          )}
        </>
      )}
    </PageFrame>
  );
}

function SubjectRow({ subject, selected, onSelect }: { subject: SubjectModel; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="stp-row" aria-pressed={selected} onClick={onSelect}>
      <span className={cn("stp-bubble", subject.needsAttention && "stp-bubble--alert")} aria-hidden="true">
        {subjectInitials(subject.name)}
      </span>
      <span className="stp-row__body">
        <span className="stp-row__title">{subject.name}</span>
        <span className="stp-row__meta">
          {[subject.teacherName, subject.total ? `${subject.graded} de ${subject.total} notas` : "Sin evaluaciones"].filter(Boolean).join(" · ")}
        </span>
        <span className="stp-progress stp-progress--row" aria-hidden="true">
          <span className="stp-progress__bar" style={{ width: `${subject.evaluatedPct}%` }} />
        </span>
      </span>
      <span className="stp-row__aside">
        <LevelPill score={subject.average} />
        <Grade value={subject.average} alert={subject.needsAttention} className="stp-grade--row" />
        <ChevronRight className="stp-row__chevron stp-row__chevron--mobile" {...ICON} />
      </span>
    </button>
  );
}

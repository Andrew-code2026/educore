import type { ReactNode } from "react";
import { ArrowRight, BookOpen, ChartColumn, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatGrade, PASSING_GRADE } from "@/analytics/landing";
import type { CourseModel, ReportCardModel, ReportsLandingModel } from "./landing";
import { LandingHeader } from "./LandingHeader";
import { CourseAverageList } from "./CourseAverageList";
import { ReportCardList } from "./ReportCardList";
import { EmptyCard, ErrorCard } from "./parts";
import "./landing.css";

interface ReportsLandingProps {
  /** `null` mientras cargan planillas y boletines. */
  model: ReportsLandingModel | null;
  academicYear: string;
  period: string | null;
  lede: string;
  error: boolean;
  generatingKey: string | null;
  onRetry: () => void;
  onOpenCourse: (course: CourseModel) => void;
  onOpenAlerts: () => void;
  onGenerate: (card: ReportCardModel) => void;
  onOpenReportCards: (card: ReportCardModel) => void;
}

/** Portada de Reportes y analítica: boletines, lectura del periodo y promedio por curso. */
export function ReportsLanding({
  model,
  academicYear,
  period,
  lede,
  error,
  generatingKey,
  onRetry,
  onOpenCourse,
  onOpenAlerts,
  onGenerate,
  onOpenReportCards,
}: ReportsLandingProps) {
  return (
    <div className="rpt">
      <div aria-hidden="true" className="rpt__glow rpt__glow--a" />
      <div aria-hidden="true" className="rpt__glow rpt__glow--b" />

      <div className="rpt__content">
        <LandingHeader
          academicYear={model?.academicYear ?? academicYear}
          period={model?.period ?? period}
          lede={lede}
          summary={model?.summary ?? null}
          error={error}
        />

        {error ? (
          <ErrorCard title="No pudimos cargar los reportes" onRetry={onRetry} />
        ) : model ? (
          <>
            {/* Lo accionable primero: abrir, revisar e imprimir boletines */}
            <section aria-labelledby="rpt-cards-heading" className="rpt-section">
              <div className="rpt-section__head">
                <h2 id="rpt-cards-heading" className="rpt-section__title">
                  Boletines
                </h2>
                {!model.canGenerate && model.reportCards.length > 0 && (
                  <span className="rpt-section__hint">La generación la realiza coordinación o rectoría</span>
                )}
              </div>
              {model.reportCards.length > 0 ? (
                <ReportCardList
                  reportCards={model.reportCards}
                  canGenerate={model.canGenerate}
                  generatingKey={generatingKey}
                  onGenerate={onGenerate}
                  onOpen={onOpenReportCards}
                />
              ) : (
                <EmptyCard icon={<FileText strokeWidth={1.9} />} title="Sin boletines para mostrar">
                  Los boletines aparecerán cuando haya cursos con estudiantes matriculados y un periodo configurado.
                </EmptyCard>
              )}
              {model.withoutStudents.length > 0 && (
                <CourseChips
                  title="Sin estudiantes matriculados"
                  label="Cursos sin estudiantes"
                  items={model.withoutStudents}
                  getKey={(group) => group}
                >
                  {(group) => (
                    <span className="rpt-chip rpt-chip--static">
                      <span className="rpt-group rpt-num">{group}</span>
                    </span>
                  )}
                </CourseChips>
              )}
            </section>

            <ReadingCard model={model} onOpenAlerts={onOpenAlerts} />

            <section aria-labelledby="rpt-courses-heading" className="rpt-section">
              <div className="rpt-section__head">
                <h2 id="rpt-courses-heading" className="rpt-section__title">
                  Promedio por curso
                </h2>
                {model.courses.length > 1 && <span className="rpt-section__hint">De menor a mayor promedio</span>}
              </div>
              {model.courses.length > 0 && <CourseAverageList courses={model.courses} onOpen={onOpenCourse} />}
              {model.ungraded.length > 0 && (
                <CourseChips
                  title="Sin notas aún"
                  label="Cursos sin notas registradas"
                  items={model.ungraded}
                  getKey={(course) => course.key}
                >
                  {(course) => (
                    <button
                      type="button"
                      className="rpt-chip"
                      aria-label={`Registrar notas de ${course.group} en Grade Center`}
                      onClick={() => onOpenCourse(course)}
                    >
                      <span className="rpt-group rpt-num">{course.group}</span>
                      Registrar notas
                    </button>
                  )}
                </CourseChips>
              )}
              {model.courses.length === 0 && model.ungraded.length === 0 && (
                <EmptyCard icon={<BookOpen strokeWidth={1.9} />} title="Aún no tienes cursos asignados">
                  Cuando tengas cursos y materias asignados, verás aquí su promedio.
                </EmptyCard>
              )}
            </section>
          </>
        ) : (
          <LoadingSections />
        )}
      </div>
    </div>
  );
}

interface ReadingCardProps {
  model: ReportsLandingModel;
  onOpenAlerts: () => void;
}

/** Lectura calculada con las notas registradas; nunca texto fijo ni inferencias de IA. */
function ReadingCard({ model, onOpenAlerts }: ReadingCardProps) {
  const { reading, summary } = model;
  const below = summary.belowPassing;

  return (
    <section aria-labelledby="rpt-reading-heading" className="rpt-surface rpt-reading">
      <div className="rpt-reading__main">
        <span aria-hidden="true" className={`rpt-reading__icon rpt-reading__icon--${reading.kind}`}>
          <ChartColumn strokeWidth={1.9} />
        </span>
        <div className="rpt-reading__body">
          <span className="rpt-eyebrow">Lectura del periodo</span>
          <h2 id="rpt-reading-heading" className="rpt-reading__title">
            {reading.title}
          </h2>
          <p className="rpt-reading__text">{reading.detail}</p>
        </div>
      </div>

      <div className="rpt-reading__followup">
        <span aria-hidden="true" className={`rpt-reading__badge rpt-reading__badge--${below > 0 ? "alert" : "ok"}`}>
          {below > 0 ? <TriangleAlert strokeWidth={1.9} /> : <ShieldCheck strokeWidth={1.9} />}
        </span>
        <p className="rpt-reading__followup-text">
          {below > 0 ? (
            <>
              <strong className="rpt-num">{below}</strong>{" "}
              {below === 1 ? "estudiante tiene" : "estudiantes tienen"} alguna definitiva parcial bajo{" "}
              {formatGrade(PASSING_GRADE)}.
            </>
          ) : (
            <>Ningún estudiante tiene definitivas parciales bajo {formatGrade(PASSING_GRADE)}.</>
          )}
        </p>
        <button type="button" className="rpt-btn rpt-btn--outline" onClick={onOpenAlerts}>
          Ver en Análisis &amp; Alertas
          <ArrowRight aria-hidden="true" strokeWidth={1.9} />
        </button>
      </div>

      <p className="rpt-reading__note">
        Calculado con las notas registradas en Grade Center. Estas señales son informativas: la decisión pedagógica
        siempre permanece con el equipo autorizado.
      </p>
    </section>
  );
}

interface CourseChipsProps<T> {
  title: string;
  /** Nombre accesible de la lista. */
  label: string;
  items: T[];
  getKey: (item: T) => string;
  children: (item: T) => ReactNode;
}

/** Cursos sin métricas que comparar: se listan como accesos compactos bajo la lista principal. */
function CourseChips<T>({ title, label, items, getKey, children }: CourseChipsProps<T>) {
  return (
    <div className="rpt-aside">
      <h3 className="rpt-aside__title">
        {title}
        <span className="rpt-aside__count rpt-num">{items.length}</span>
      </h3>
      <ul aria-label={label} className="rpt-chips">
        {items.map((item) => (
          <li key={getKey(item)}>{children(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function LoadingSections() {
  return (
    <div aria-busy="true" aria-label="Cargando reportes" className="rpt-loading">
      <span className="rpt-skeleton rpt-skeleton--card" />
      {[0, 1].map((block) => (
        <div key={block} className="rpt-section">
          <span className="rpt-skeleton rpt-skeleton--title" />
          <div className="rpt-surface rpt-list">
            {[0, 1].map((row) => (
              <span key={row} className="rpt-skeleton rpt-skeleton--row" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

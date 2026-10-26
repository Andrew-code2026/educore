import { memo } from "react";
import { BookOpen, Calendar, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { plural } from "@/analytics/landing";
import type { PiarCourseModel, PiarLandingModel, PiarLandingSummary } from "./model";
import { EmptyCard, ErrorCard, Meter } from "./parts";
import "./piar.css";

interface PiarLandingProps {
  /** `null` mientras cargan los cursos. */
  model: PiarLandingModel | null;
  academicYear: string;
  lede: string;
  coursesTitle: string;
  error: boolean;
  onRetry: () => void;
  onOpenCourse: (course: PiarCourseModel) => void;
}

/** Portada del PIAR: resumen y cursos con sus estudiantes con PIAR. */
export function PiarLanding({ model, academicYear, lede, coursesTitle, error, onRetry, onOpenCourse }: PiarLandingProps) {
  return (
    <div className="pia">
      <div aria-hidden="true" className="pia__glow pia__glow--a" />
      <div aria-hidden="true" className="pia__glow pia__glow--b" />

      <div className="pia__content">
        <header className="pia-header">
          <div className="pia-intro">
            <div className="pia-chip">
              <Calendar aria-hidden="true" strokeWidth={1.9} />
              Año {academicYear}
              <span aria-hidden="true" className="pia-chip__dot">
                ·
              </span>
              <span className="pia-chip__accent">Decreto 1421 de 2017</span>
            </div>
            <h1 className="pia-title">PIAR</h1>
            <p className="pia-lede">{lede}</p>
          </div>
          <SummaryCard summary={model?.summary ?? null} error={error} />
        </header>

        {error ? (
          <ErrorCard title="No pudimos cargar los PIAR" onRetry={onRetry} />
        ) : model ? (
          <section aria-labelledby="pia-courses-heading" className="pia-section">
            <div className="pia-section__head">
              <h2 id="pia-courses-heading" className="pia-section__title">
                {coursesTitle}
              </h2>
              {model.courses.length > 1 && <span className="pia-section__hint">Entra a un curso para ver sus estudiantes con PIAR</span>}
            </div>
            {model.courses.length > 0 ? (
              <ul aria-label={coursesTitle} className="pia-surface pia-list">
                {model.courses.map(course => (
                  <CourseRow key={course.courseId} course={course} onOpen={onOpenCourse} />
                ))}
              </ul>
            ) : (
              <EmptyCard icon={<BookOpen strokeWidth={1.9} />} title="Aún no tienes cursos asignados">
                Cuando tengas cursos asignados, aquí podrás registrar y diligenciar los PIAR de sus estudiantes.
              </EmptyCard>
            )}
          </section>
        ) : (
          <div aria-busy="true" aria-label="Cargando cursos" className="pia-surface pia-list">
            {[0, 1, 2].map(row => (
              <span key={row} className="pia-skeleton pia-skeleton--row" />
            ))}
          </div>
        )}

        <p className="pia-privacy">
          <ShieldCheck aria-hidden="true" strokeWidth={1.9} />
          El PIAR reúne información sensible del estudiante. Solo lo consultan los docentes del curso y los directivos de la
          institución.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ summary, error }: { summary: PiarLandingSummary | null; error: boolean }) {
  const pending = error ? "No disponible" : "Cargando…";
  return (
    <section aria-label="Resumen de los PIAR" aria-busy={!summary && !error} className="pia-surface pia-summary">
      <div className="pia-summary__item">
        <span className="pia-eyebrow">Con PIAR</span>
        <span className={cn("pia-summary__value pia-num", !summary && "pia-summary__value--empty")}>{summary ? summary.withPiar : "—"}</span>
        <span className="pia-summary__note">{summary ? `En ${plural(summary.courses, "curso", "cursos")}` : pending}</span>
      </div>
      <div className="pia-summary__item">
        <span className="pia-eyebrow">Finalizados</span>
        <span className={cn("pia-summary__value pia-num", !summary && "pia-summary__value--empty")}>{summary ? summary.finalized : "—"}</span>
        <span className="pia-summary__note">
          {!summary ? pending : summary.withPiar ? `De ${plural(summary.withPiar, "PIAR", "PIAR")}` : "Sin PIAR registrados"}
        </span>
      </div>
      <div className="pia-summary__item">
        <span className="pia-eyebrow">Avance</span>
        {summary && summary.averagePct !== null ? (
          <>
            <span className="pia-summary__value pia-num">{summary.averagePct}%</span>
            <Meter pct={summary.averagePct} label="Avance promedio de los anexos" />
          </>
        ) : (
          <>
            <span className="pia-summary__value pia-summary__value--empty">—</span>
            <span className="pia-summary__note">{summary ? "Sin PIAR registrados" : pending}</span>
          </>
        )}
      </div>
    </section>
  );
}

const CourseRow = memo(function CourseRow({ course, onOpen }: { course: PiarCourseModel; onOpen: (course: PiarCourseModel) => void }) {
  const hasPiar = course.withPiar > 0;
  return (
    <li>
      <button type="button" className="pia-course" aria-label={`Abrir los PIAR de ${course.group}`} onClick={() => onOpen(course)}>
        <span className="pia-course__body">
          <span className="pia-course__title">
            <span className="pia-group pia-num">{course.group}</span>
            {hasPiar ? plural(course.withPiar, "estudiante con PIAR", "estudiantes con PIAR") : "Sin estudiantes con PIAR"}
          </span>
          <span className="pia-course__meta">
            <span className="pia-meta">
              <Users aria-hidden="true" strokeWidth={1.9} />
              {plural(course.students, "matriculado", "matriculados")}
            </span>
            {hasPiar && (
              <span>
                {course.finalized} {course.finalized === 1 ? "finalizado" : "finalizados"} · {course.inProgress} en diligenciamiento
              </span>
            )}
            {course.lastUpdated && <span>Actualizado {course.lastUpdated}</span>}
          </span>
        </span>
        <span className="pia-course__stat">
          {course.averagePct !== null ? (
            <>
              <span className="pia-course__stat-head">
                <span>Avance de los anexos</span>
                <strong className="pia-num">{course.averagePct}%</strong>
              </span>
              <Meter pct={course.averagePct} label={`Avance promedio de los PIAR de ${course.group}`} />
            </>
          ) : (
            <span className="pia-course__stat-head">
              <span>Registra el primer PIAR del curso</span>
            </span>
          )}
        </span>
        <span className="pia-course__go">
          {hasPiar ? "Ver estudiantes" : "Abrir curso"}
          <ChevronRight aria-hidden="true" strokeWidth={1.9} />
        </span>
      </button>
    </li>
  );
});

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Info, Printer } from "lucide-react";
import { initialsOf, plural } from "@/analytics/landing";
import { LEVEL_ORDER, LEVELS } from "@/gradecenter/domain/scale";
import {
  reportCardFileName,
  type CourseReportCardsModel,
  type ReportCardSchool,
  type StudentReportCardModel,
} from "./reportCard";

interface StudentReportCardProps {
  course: CourseReportCardsModel;
  student: StudentReportCardModel;
  school: ReportCardSchool;
  onBack: () => void;
}

/** Boletín de un estudiante: barra de acciones y la hoja imprimible. */
export function StudentReportCard({ course, student, school: rawSchool, onBack }: StudentReportCardProps) {
  const { printing, print } = usePrint(reportCardFileName(course, student));
  // Se resuelve una vez para la hoja en pantalla y la de impresión: la copia impresa
  // no alcanzaría a descartar un escudo roto antes de que se abra el diálogo
  const logoUrl = useUsableImage(rawSchool.logoUrl);
  const school = useMemo(() => ({ ...rawSchool, logoUrl }), [rawSchool, logoUrl]);

  return (
    <>
      <div className="rcd-toolbar">
        <button type="button" className="rpt-btn rpt-btn--outline" onClick={onBack}>
          <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
          Boletines de {course.group}
        </button>
        <button
          type="button"
          className="rpt-btn rpt-btn--primary"
          title="Abre la impresión; elige «Guardar como PDF» para descargarlo"
          onClick={print}
        >
          <Printer aria-hidden="true" strokeWidth={1.9} />
          Imprimir o guardar PDF
        </button>
      </div>

      {student.state === "preview" && (
        <p className="rcd-notice" role="note">
          <Info aria-hidden="true" strokeWidth={1.9} />
          Vista preliminar: las notas pueden cambiar hasta que coordinación genere el boletín oficial del periodo.
        </p>
      )}

      <ReportCardSheet course={course} student={student} school={school} />

      {printing &&
        createPortal(
          <div className="rcd-print">
            <ReportCardSheet course={course} student={student} school={school} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** Escudos más pequeños que esto son marcadores de posición, no un logo real. */
const MIN_LOGO_SIZE = 16;

/** URL de la imagen solo si carga y tiene tamaño de logo; `null` mientras carga o si falla. */
function useUsableImage(url: string | null): string | null {
  const [usable, setUsable] = useState<string | null>(null);

  useEffect(() => {
    setUsable(null);
    if (!url) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active && image.naturalWidth >= MIN_LOGO_SIZE && image.naturalHeight >= MIN_LOGO_SIZE) setUsable(url);
    };
    image.src = url;
    return () => {
      active = false;
    };
  }, [url]);

  return usable;
}

/**
 * Monta la copia de impresión solo mientras dura el diálogo del navegador: el
 * efecto corre tras el commit, así la hoja ya está en el DOM al llamar a print().
 * El título del documento es el nombre que el navegador propone al guardar el PDF.
 */
function usePrint(fileName: string) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const previousTitle = document.title;
    const done = () => setPrinting(false);
    document.title = fileName;
    window.addEventListener("afterprint", done);
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.title = previousTitle;
    };
  }, [printing, fileName]);

  const print = useCallback(() => setPrinting(true), []);
  return { printing, print };
}

interface ReportCardSheetProps {
  course: CourseReportCardsModel;
  student: StudentReportCardModel;
  school: ReportCardSchool;
}

function ReportCardSheet({ course, student, school }: ReportCardSheetProps) {
  // La copia de impresión convive con la de pantalla: ids únicos por instancia
  const id = useId();
  const isPreview = student.state === "preview";
  // En papel la fecha relativa ("hoy") pierde sentido: se acompaña de la emisión
  const status = isPreview ? "Vista preliminar · no oficial" : `Oficial · ${student.stateLabel.toLowerCase()}`;

  return (
    <article aria-labelledby={`${id}-student`} className="rcd-sheet">
      <header className="rcd-sheet__head">
        <div className="rcd-brand">
          {school.logoUrl ? (
            <span className="rcd-brand__mark">
              <img className="rcd-brand__logo" src={school.logoUrl} alt={`Escudo de ${school.name}`} />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="rcd-brand__mark rcd-brand__mark--initials"
              style={school.brandColor ? ({ "--rcd-brand": school.brandColor } as CSSProperties) : undefined}
            >
              {initialsOf(school.name)}
            </span>
          )}
          <div className="rcd-brand__text">
            <span className="rcd-brand__name">{school.name}</span>
            {school.location && <span className="rcd-brand__place">{school.location}</span>}
          </div>
        </div>
        <div className="rcd-sheet__heading">
          <h2 className="rcd-sheet__title">Boletín académico</h2>
          <span className="rcd-sheet__period">
            {course.period} · Año lectivo {course.academicYear}
          </span>
          <span className={`rcd-state rcd-state--${student.state}`}>{status}</span>
        </div>
      </header>

      <dl className="rcd-facts">
        <div className="rcd-facts__student">
          <dt>Estudiante</dt>
          <dd id={`${id}-student`}>{student.name}</dd>
        </div>
        <div>
          <dt>Curso</dt>
          <dd className="rpt-num">{course.group}</dd>
        </div>
        <div>
          <dt>Director(a) de grupo</dt>
          <dd>{course.directorName ?? "—"}</dd>
        </div>
        <div>
          <dt>Fecha de emisión</dt>
          <dd>{course.issuedOn}</dd>
        </div>
      </dl>

      {student.subjects.length > 0 ? (
        <table className="rcd-table">
          <caption className="rcd-sr">Definitivas por materia</caption>
          <thead>
            <tr>
              <th scope="col">Materia</th>
              <th scope="col" className="rcd-table__progress">
                Notas registradas
              </th>
              <th scope="col" className="rcd-table__num">
                Definitiva
              </th>
              <th scope="col" className="rcd-table__level">
                Desempeño
              </th>
            </tr>
          </thead>
          <tbody>
            {student.subjects.map((subject) => (
              <tr key={subject.key}>
                <th scope="row">{subject.name}</th>
                <td className="rcd-table__progress rpt-num">{subject.progress}</td>
                <td className={`rcd-table__num rcd-table__grade rpt-num${subject.average == null ? " rcd-table__grade--empty" : ""}`}>
                  {subject.grade}
                </td>
                <td className="rcd-table__level">
                  <LevelPill level={subject.level} label={subject.levelLabel} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Promedio general</th>
              <td className="rcd-table__progress" />
              <td className={`rcd-table__num rcd-table__grade rpt-num${student.average == null ? " rcd-table__grade--empty" : ""}`}>
                {student.grade}
              </td>
              <td className="rcd-table__level">
                <LevelPill level={student.level} label={student.levelLabel} />
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="rcd-sheet__empty">El curso aún no tiene materias asignadas.</p>
      )}

      <p className="rcd-summary">
        {student.attention > 0
          ? `${plural(student.attention, "materia", "materias")} en desempeño bajo.`
          : "Sin materias en desempeño bajo."}
      </p>

      <section aria-labelledby={`${id}-obs`} className="rcd-block">
        <h3 id={`${id}-obs`} className="rcd-block__title">
          Observaciones
        </h3>
        {student.observations.length > 0 ? (
          <ul className="rcd-observations">
            {student.observations.map((observation) => (
              <li key={observation.key}>
                <p>{observation.text}</p>
                <span className="rcd-observations__date">{observation.date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rcd-sheet__empty">Sin observaciones publicadas en este periodo.</p>
        )}
      </section>

      <section aria-label="Escala de desempeño" className="rcd-scale">
        <span className="rcd-scale__title">Escala institucional</span>
        <ul className="rcd-legend">
          {[...LEVEL_ORDER].reverse().map((level) => (
            <li key={level}>
              <LevelPill level={level} label={LEVELS[level].short} />
              <span className="rpt-num">{LEVELS[level].range}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Solo en papel o PDF: espacio para firmas y pie del documento */}
      <div className="rcd-print-only rcd-signatures">
        <div className="rcd-signature">
          <span className="rcd-signature__line" />
          <span className="rcd-signature__name">{course.directorName}</span>
          <span className="rcd-signature__role">Director(a) de grupo</span>
        </div>
        <div className="rcd-signature">
          <span className="rcd-signature__line" />
          <span className="rcd-signature__name" />
          <span className="rcd-signature__role">Coordinación académica</span>
        </div>
      </div>

      <footer className="rcd-print-only rcd-sheet__foot">
        <span>
          {school.name} · Boletín de {student.name} · {course.group} · {course.period}
        </span>
        <span>
          {isPreview ? "Vista preliminar sin validez oficial" : "Boletín oficial"} · Emitido el {course.issuedOn} con EduCore
        </span>
      </footer>
    </article>
  );
}

function LevelPill({ level, label }: { level: StudentReportCardModel["level"]; label: string }) {
  return <span className={`rcd-level rcd-level--${level ?? "none"}`}>{label}</span>;
}

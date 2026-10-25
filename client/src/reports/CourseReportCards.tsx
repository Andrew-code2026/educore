import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Search, Users } from "lucide-react";
import { formatGrade, initialsOf, plural } from "@/analytics/landing";
import {
  filterStudents,
  type CourseReportCardsModel,
  type ReportCardSchool,
  type StudentReportCardModel,
} from "./reportCard";
import { EmptyCard, ErrorCard } from "./parts";
import { StudentReportCard } from "./StudentReportCard";
import "./landing.css";
import "./report-card.css";

interface CourseReportCardsProps {
  /** Grupo y periodo conocidos desde la portada, para el encabezado mientras carga. */
  group: string;
  period: string;
  /** `null` mientras cargan los boletines. */
  model: CourseReportCardsModel | null;
  error: boolean;
  school: ReportCardSchool;
  selectedStudentId: number | null;
  onSelectStudent: (studentId: number | null) => void;
  onBack: () => void;
  onRetry: () => void;
}

/** Boletines de un curso: lista de estudiantes y, al elegir uno, su boletín. */
export function CourseReportCards({
  group,
  period,
  model,
  error,
  school,
  selectedStudentId,
  onSelectStudent,
  onBack,
  onRetry,
}: CourseReportCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const student = model?.students.find((row) => row.studentId === selectedStudentId) ?? null;

  // Cada cambio de vista arranca arriba, como una navegación
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedStudentId]);

  return (
    <div ref={scrollRef} className="rpt">
      <div aria-hidden="true" className="rpt__glow rpt__glow--a" />
      <div aria-hidden="true" className="rpt__glow rpt__glow--b" />

      <div className="rpt__content rcd">
        {model && student ? (
          <StudentReportCard course={model} student={student} school={school} onBack={() => onSelectStudent(null)} />
        ) : (
          <>
            <header className="rcd-header">
              <button type="button" className="rpt-btn rpt-btn--outline" onClick={onBack}>
                <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
                Reportes
              </button>
              <div className="rcd-header__intro">
                <span className="rpt-eyebrow">{model?.period ?? period}</span>
                <h1 className="rcd-header__title">
                  Boletines <span className="rpt-group rpt-num">{model?.group ?? group}</span>
                </h1>
                {model && <CourseSummary model={model} />}
              </div>
            </header>

            {error ? (
              <ErrorCard title="No pudimos cargar los boletines" onRetry={onRetry} />
            ) : model ? (
              <StudentList students={model.students} onSelect={onSelectStudent} />
            ) : (
              <div aria-busy="true" aria-label="Cargando boletines" className="rpt-surface rpt-list">
                {[0, 1, 2, 3].map((row) => (
                  <span key={row} className="rpt-skeleton rpt-skeleton--row" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CourseSummary({ model }: { model: CourseReportCardsModel }) {
  const { students, generated, average } = model.summary;
  return (
    <p className="rcd-header__meta">
      <span className="rpt-meta">
        <Users aria-hidden="true" strokeWidth={1.9} />
        {plural(students, "estudiante", "estudiantes")}
      </span>
      <span className="rpt-num">
        {generated} de {students} generados
      </span>
      {average != null && <span className="rpt-num">Promedio del curso {formatGrade(average)}</span>}
    </p>
  );
}

interface StudentListProps {
  students: StudentReportCardModel[];
  onSelect: (studentId: number) => void;
}

function StudentList({ students, onSelect }: StudentListProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterStudents(students, query), [students, query]);

  if (students.length === 0) {
    return (
      <EmptyCard icon={<Users strokeWidth={1.9} />} title="Sin estudiantes matriculados">
        Los boletines aparecerán cuando el curso tenga estudiantes activos.
      </EmptyCard>
    );
  }

  return (
    <section aria-label="Estudiantes del curso" className="rpt-section">
      <label className="rcd-search">
        <Search aria-hidden="true" strokeWidth={1.9} />
        <span className="rcd-sr">Buscar estudiante</span>
        <input
          type="search"
          value={query}
          placeholder="Buscar estudiante"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {visible.length > 0 ? (
        <ul aria-label="Boletines por estudiante" className="rpt-surface rpt-list">
          {visible.map((student) => (
            <StudentRow key={student.key} student={student} onSelect={onSelect} />
          ))}
        </ul>
      ) : (
        <p className="rcd-no-results" role="status">
          Ningún estudiante coincide con “{query.trim()}”.
        </p>
      )}
    </section>
  );
}

const StudentRow = memo(function StudentRow({
  student,
  onSelect,
}: {
  student: StudentReportCardModel;
  onSelect: (studentId: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="rcd-row"
        aria-label={`Abrir el boletín de ${student.name}`}
        onClick={() => onSelect(student.studentId)}
      >
        <span aria-hidden="true" className="rcd-avatar">
          {initialsOf(student.name)}
        </span>
        <span className="rcd-row__body">
          <span className="rcd-row__name">{student.name}</span>
          <span className="rpt-course__meta">
            <span className={`rcd-state rcd-state--${student.state}`}>{student.stateLabel}</span>
            {student.attention > 0 && (
              <span className="rpt-flag">{plural(student.attention, "materia baja", "materias bajas")}</span>
            )}
          </span>
        </span>
        <span className="rcd-row__stat">
          <span className="rcd-row__grade rpt-num">{student.grade}</span>
          <span className={`rcd-level rcd-level--${student.level ?? "none"}`}>{student.levelLabel}</span>
        </span>
        <ChevronRight aria-hidden="true" strokeWidth={1.9} className="rcd-row__chevron" />
      </button>
    </li>
  );
});

import { useMemo, useState } from "react";
import { ArrowLeftRight, BookOpen, Layers, Link2, Plus, Search, Upload, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Section } from "@/components/shell";
import { AdminHeader, AdminPage, Avatar, EmptyState, Pill, Segment, SkeletonList, SummaryStrip } from "../parts";
import { requestUsersImport, type UsersImportKind } from "../intents";
import {
  AssignTeacherDialog,
  AttachSubjectDialog,
  CourseDialog,
  EnrollDialog,
  GradeDialog,
  SubjectDialog,
  TransferDialog,
  type AcademicData,
} from "./AcademicDialogs";

const ROLE = "admin" as const;

type Tab = "courses" | "subjects" | "teachers" | "enrollments";
type DialogState =
  | { kind: "grade" }
  | { kind: "course" }
  | { kind: "subject" }
  | { kind: "attach"; courseId?: number; subjectId?: number }
  | { kind: "assign"; teacherId?: number; courseId?: number }
  | { kind: "enroll"; courseId?: number }
  | { kind: "transfer"; enrollmentId: number }
  | null;

interface AcademicPageProps {
  setSection: (section: Section) => void;
}

export function AcademicPage({ setSection }: AcademicPageProps) {
  const query = trpc.academic.snapshot.useQuery({ role: ROLE }, { staleTime: 15_000 });
  const [tab, setTab] = useState<Tab>("courses");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const raw = query.data as any;

  const data: AcademicData | null = useMemo(
    () =>
      raw
        ? {
            activeYear: raw.activeYear ?? null,
            grades: raw.grades ?? [],
            courses: (raw.courses ?? []).filter((course: any) => !raw.activeYear || !course.academicYearId || course.academicYearId === raw.activeYear.id),
            subjects: raw.subjects ?? [],
            courseSubjects: raw.courseSubjects ?? [],
            teachers: raw.teachers ?? [],
            students: raw.students ?? [],
            studentEnrollments: raw.studentEnrollments ?? [],
          }
        : null,
    [raw],
  );

  const view = useMemo(() => {
    if (!data || !raw) return null;
    const courseById = new Map(data.courses.map(course => [course.id, course]));
    const subjectById = new Map(data.subjects.map(subject => [subject.id, subject]));
    const assignments = (raw.teacherAssignments ?? []) as Array<{ id: number; teacherUserId: number; courseId: number; subjectId: number; isPrimary?: number }>;
    const enrolled = new Set(data.studentEnrollments.map(item => item.studentUserId));
    const unenrolled = data.students.filter(student => !enrolled.has(student.userId));
    const loadedTeachers = new Set(assignments.map(item => item.teacherUserId));
    const capacity = data.courses.reduce((sum, course) => sum + (course.capacity ?? 0), 0);
    const students = data.courses.reduce((sum, course) => sum + course.studentCount, 0);
    const activePeriod = (raw.periods ?? []).find((period: any) => period.status === "Activo");
    return { courseById, subjectById, assignments, unenrolled, loadedTeachers, capacity, students, activePeriod };
  }, [data, raw]);

  const loadUsers = (kind: UsersImportKind) => {
    requestUsersImport(kind);
    setSection("users");
  };

  const close = () => setDialog(null);

  if (query.isLoading) {
    return (
      <AdminPage label="Académico">
        <AdminHeader title="Estructura académica" lede="Cargando la estructura del año lectivo…" />
        <SkeletonList rows={5} />
      </AdminPage>
    );
  }

  if (!data || !view) {
    return (
      <AdminPage label="Académico">
        <AdminHeader title="Estructura académica" lede="La fuente de verdad para grados, cursos, materias, carga docente y matrículas." />
        <div className="adm-surface">
          <EmptyState tone="error" title="No pudimos cargar la estructura académica" text="Revisa la conexión con la base de datos e inténtalo de nuevo." action={<button type="button" className="adm-btn adm-btn--outline" onClick={() => void query.refetch()}>Reintentar</button>} />
        </div>
      </AdminPage>
    );
  }

  const idleTeachers = data.teachers.filter(teacher => !view.loadedTeachers.has(teacher.userId));
  const occupancy = view.capacity ? Math.round((view.students / view.capacity) * 100) : null;
  const filteredEnrollments = data.studentEnrollments
    .filter(item => courseFilter === "ALL" || String(item.courseId) === courseFilter)
    .filter(item => (item.student?.name ?? "").toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (a.student?.name ?? "").localeCompare(b.student?.name ?? "", "es"));

  return (
    <AdminPage label="Académico">
      <AdminHeader
        chip={`${data.activeYear ? `Año lectivo ${data.activeYear.year}` : "Sin año activo"}${view.activePeriod ? ` · ${view.activePeriod.name}` : ""}`}
        title="Estructura académica"
        lede="Grados, cursos, materias, carga docente y matrículas del año lectivo. Lo que cada docente ve en su portal nace aquí."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => setDialog({ kind: "course" })}>
              <Plus aria-hidden="true" strokeWidth={2} />
              Nuevo curso
            </button>
            <button type="button" className="adm-btn adm-btn--outline" onClick={() => setDialog({ kind: "subject" })}>
              <BookOpen aria-hidden="true" strokeWidth={2} />
              Nueva materia
            </button>
            <button type="button" className="adm-btn adm-btn--outline" onClick={() => setDialog({ kind: "assign" })}>
              <Link2 aria-hidden="true" strokeWidth={2} />
              Asignar docente
            </button>
          </>
        }
      />

      <SummaryStrip
        items={[
          {
            key: "courses",
            label: "Cursos",
            value: data.courses.length,
            note: occupancy !== null ? `${view.students} de ${view.capacity} cupos ocupados` : `${data.grades.length} grados`,
            meter: occupancy,
          },
          {
            key: "subjects",
            label: "Materias",
            value: data.subjects.length,
            note: `${data.courseSubjects.length} asociaciones curso–materia`,
          },
          {
            key: "load",
            label: "Carga docente",
            value: view.assignments.length,
            tone: idleTeachers.length ? "alert" : undefined,
            note: idleTeachers.length ? `${idleTeachers.length} ${idleTeachers.length === 1 ? "docente sin carga" : "docentes sin carga"}` : "Todos los docentes con carga",
          },
          {
            key: "enrollments",
            label: "Matrículas",
            value: data.studentEnrollments.length,
            tone: view.unenrolled.length ? "alert" : undefined,
            note: view.unenrolled.length ? `${view.unenrolled.length} sin curso asignado` : "Todos los estudiantes matriculados",
          },
        ]}
      />

      <Segment
        variant="tabs"
        label="Secciones académicas"
        value={tab}
        onChange={setTab}
        options={[
          { value: "courses", label: "Cursos", count: data.courses.length },
          { value: "subjects", label: "Materias", count: data.subjects.length },
          { value: "teachers", label: "Carga docente", count: data.teachers.length },
          { value: "enrollments", label: "Matrículas", count: data.studentEnrollments.length },
        ]}
      />

      {tab === "courses" ? (
        <section className="adm-section" aria-label="Cursos">
          <div className="adm-section__head">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span className="adm-eyebrow">Grados</span>
              <ul className="adm-chips">
                {data.grades.map(grade => (
                  <li key={grade.id} className="adm-chip">
                    <span className="adm-group">{grade.shortName}</span>
                    {grade.name} · {data.courses.filter(course => course.gradeLevelId === grade.id).length}
                  </li>
                ))}
              </ul>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDialog({ kind: "grade" })}>
                <Plus aria-hidden="true" strokeWidth={2} />
                Nuevo grado
              </button>
            </div>
          </div>

          {data.courses.length === 0 ? (
            <div className="adm-surface">
              <EmptyState title="Aún no hay cursos en el año activo" text="Crea el primer grupo y luego asócialo a materias y docentes." action={<button type="button" className="adm-btn adm-btn--primary" onClick={() => setDialog({ kind: "course" })}>Crear curso</button>} />
            </div>
          ) : (
            <div className="adm-grid">
              {data.courses.map(course => {
                const grade = data.grades.find(item => item.id === course.gradeLevelId);
                const links = data.courseSubjects.filter(link => link.courseId === course.id);
                const teachers = new Set(view.assignments.filter(item => item.courseId === course.id).map(item => item.teacherUserId));
                const pct = course.capacity ? Math.round((course.studentCount / course.capacity) * 100) : null;
                return (
                  <article key={course.id} className="adm-surface adm-card">
                    <div className="adm-card__head">
                      <span className="adm-card__group">{course.name}</span>
                      <h3 className="adm-card__title">{grade?.name ?? `Grado ${course.grade ?? ""}`} · {course.name}</h3>
                      <Pill tone="green" dot>Activo</Pill>
                      <span className="adm-card__sub">{course.code ?? "Sin código"} · {data.activeYear?.year ?? ""}</span>
                    </div>
                    <div className="adm-tiles">
                      <div className="adm-tile adm-tile--highlight">
                        <span className="adm-tile__label">Estudiantes</span>
                        <span className="adm-tile__value adm-num">
                          {course.studentCount}
                          {course.capacity ? <span className="adm-tile__note"> / {course.capacity}</span> : null}
                        </span>
                      </div>
                      <div className="adm-tile">
                        <span className="adm-tile__label">Materias</span>
                        <span className="adm-tile__value adm-num">{links.length}</span>
                      </div>
                      <div className="adm-tile">
                        <span className="adm-tile__label">Docentes</span>
                        <span className="adm-tile__value adm-num">{teachers.size}</span>
                      </div>
                    </div>
                    {pct !== null ? (
                      <div className="adm-meter" aria-label={`Ocupación ${pct}%`}>
                        <div className={`adm-meter__bar${pct > 100 ? " adm-meter__bar--warn" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    ) : null}
                    {links.length ? (
                      <ul className="adm-chips" aria-label="Materias del curso">
                        {links.map(link => (
                          <li key={link.subjectId} className="adm-chip adm-chip--plain">{view.subjectById.get(link.subjectId)?.name ?? "Materia"}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="adm-card__note">Sin materias asociadas todavía.</span>
                    )}
                    <div className="adm-card__foot">
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDialog({ kind: "attach", courseId: course.id })}>
                        <Layers aria-hidden="true" strokeWidth={2} />
                        Materias
                      </button>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDialog({ kind: "assign", courseId: course.id })}>
                          Docente
                        </button>
                        <button type="button" className="adm-btn adm-btn--dark adm-btn--sm" onClick={() => setDialog({ kind: "enroll", courseId: course.id })}>
                          Matricular
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {tab === "subjects" ? (
        <section className="adm-section" aria-label="Materias">
          <div className="adm-section__head">
            <div>
              <h2 className="adm-section__title">Plan de estudios</h2>
              <p className="adm-section__hint">Una materia se dicta en uno o varios cursos; cada curso–materia tiene su docente.</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDialog({ kind: "attach" })}>
                <Link2 aria-hidden="true" strokeWidth={2} />
                Asociar a curso
              </button>
              <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setDialog({ kind: "subject" })}>
                <Plus aria-hidden="true" strokeWidth={2} />
                Nueva materia
              </button>
            </div>
          </div>
          {data.subjects.length === 0 ? (
            <div className="adm-surface">
              <EmptyState title="Aún no hay materias" text="Crea las materias del plan de estudios y asócialas a los cursos." />
            </div>
          ) : (
            <ul className="adm-surface adm-list">
              {data.subjects.map(subject => {
                const links = data.courseSubjects.filter(link => link.subjectId === subject.id);
                const teacherNames = Array.from(
                  new Set(
                    view.assignments
                      .filter(item => item.subjectId === subject.id)
                      .map(item => data.teachers.find(teacher => teacher.userId === item.teacherUserId)?.user?.name ?? "Docente"),
                  ),
                );
                return (
                  <li key={subject.id} className="adm-row">
                    <span className="adm-avatar adm-avatar--amber" aria-hidden="true" style={{ fontSize: 11 }}>{(subject.code ?? subject.name).slice(0, 3).toUpperCase()}</span>
                    <div className="adm-row__body">
                      <div className="adm-row__title">
                        <span className="adm-row__name">{subject.name}</span>
                        {subject.code ? <Pill>{subject.code}</Pill> : null}
                      </div>
                      <div className="adm-row__meta">
                        {links.length ? (
                          links.map(link => (
                            <span key={link.courseId} className="adm-group">{view.courseById.get(link.courseId)?.name ?? "Curso"}</span>
                          ))
                        ) : (
                          <Pill tone="amber">Sin cursos</Pill>
                        )}
                        <span className="adm-sep" aria-hidden="true">·</span>
                        <span>{teacherNames.length ? teacherNames.join(", ") : "Sin docente asignado"}</span>
                      </div>
                    </div>
                    <div className="adm-row__actions">
                      <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDialog({ kind: "attach", subjectId: subject.id })}>
                        Asociar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "teachers" ? (
        <section className="adm-section" aria-label="Carga docente">
          <div className="adm-section__head">
            <div>
              <h2 className="adm-section__title">
                Carga docente
                {idleTeachers.length ? <span className="adm-count">{idleTeachers.length} sin carga</span> : null}
              </h2>
              <p className="adm-section__hint">Al asignar, el docente ve el curso en Grade Center, Classroom y Asistencia.</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => loadUsers("TEACHER")}>
                <Upload aria-hidden="true" strokeWidth={2} />
                Cargar docentes
              </button>
              <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setDialog({ kind: "assign" })}>
                <Plus aria-hidden="true" strokeWidth={2} />
                Asignar
              </button>
            </div>
          </div>
          {data.teachers.length === 0 ? (
            <div className="adm-surface">
              <EmptyState title="Aún no hay docentes" text="Cárgalos desde un archivo de Excel y luego asígnales cursos y materias." action={<button type="button" className="adm-btn adm-btn--primary" onClick={() => loadUsers("TEACHER")}>Cargar docentes</button>} />
            </div>
          ) : (
            <ul className="adm-surface adm-list">
              {data.teachers
                .slice()
                .sort((a, b) => (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "es"))
                .map(teacher => {
                  const load = view.assignments.filter(item => item.teacherUserId === teacher.userId);
                  return (
                    <li key={teacher.userId} className="adm-row">
                      <Avatar name={teacher.user?.name} tone="blue" />
                      <div className="adm-row__body">
                        <div className="adm-row__title">
                          <span className="adm-row__name">{teacher.user?.name ?? "Docente"}</span>
                          {teacher.specialties ? <Pill>{teacher.specialties}</Pill> : null}
                          {load.length ? null : <Pill tone="amber">Sin carga</Pill>}
                        </div>
                        {load.length ? (
                          <ul className="adm-chips">
                            {load.map(item => (
                              <li key={item.id} className="adm-chip">
                                <span className="adm-group">{view.courseById.get(item.courseId)?.name ?? "—"}</span>
                                {view.subjectById.get(item.subjectId)?.name ?? "Materia"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="adm-row__meta">
                            <span>Asígnale al menos un curso y materia para que pueda calificar y tomar asistencia.</span>
                          </div>
                        )}
                      </div>
                      <div className="adm-row__actions">
                        <button type="button" className={`adm-btn adm-btn--sm ${load.length ? "adm-btn--outline" : "adm-btn--dark"}`} onClick={() => setDialog({ kind: "assign", teacherId: teacher.userId })}>
                          Asignar
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "enrollments" ? (
        <section className="adm-section" aria-label="Matrículas">
          {view.unenrolled.length ? (
            <div className="adm-surface adm-panel">
              <div className="adm-panel__head">
                <div>
                  <p className="adm-panel__title">
                    {view.unenrolled.length} {view.unenrolled.length === 1 ? "estudiante sin matrícula" : "estudiantes sin matrícula"}
                  </p>
                  <p className="adm-panel__sub">
                    {view.unenrolled
                      .slice(0, 4)
                      .map(student => student.user?.name ?? "Estudiante")
                      .join(", ")}
                    {view.unenrolled.length > 4 ? ` y ${view.unenrolled.length - 4} más` : ""}
                  </p>
                </div>
                <button type="button" className="adm-btn adm-btn--primary" onClick={() => setDialog({ kind: "enroll" })}>
                  <UserPlus aria-hidden="true" strokeWidth={2} />
                  Matricular
                </button>
              </div>
            </div>
          ) : null}

          <div className="adm-section__head">
            <Segment
              label="Filtrar por curso"
              value={courseFilter}
              onChange={setCourseFilter}
              options={[
                { value: "ALL", label: "Todos", count: data.studentEnrollments.length },
                ...data.courses.map(course => ({ value: String(course.id), label: course.name, count: data.studentEnrollments.filter(item => item.courseId === course.id).length })),
              ]}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => loadUsers("STUDENT")}>
                <Upload aria-hidden="true" strokeWidth={2} />
                Cargar estudiantes
              </button>
            </div>
          </div>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar estudiante</span>
              <input className="adm-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar estudiante matriculado" />
            </label>
          </div>
          {filteredEnrollments.length === 0 ? (
            <div className="adm-surface">
              <EmptyState
                title={search ? "Sin resultados" : "Aún no hay matrículas"}
                text={search ? `Nadie coincide con “${search}”.` : "Carga estudiantes con su curso o matricula a los que ya existen."}
              />
            </div>
          ) : (
            <ul className="adm-surface adm-list">
              {filteredEnrollments.map(item => (
                <li key={item.id} className="adm-row">
                  <Avatar name={item.student?.name} tone="green" />
                  <div className="adm-row__body">
                    <div className="adm-row__title">
                      <span className="adm-row__name">{item.student?.name ?? "Estudiante"}</span>
                    </div>
                    <div className="adm-row__meta">
                      <span className="adm-group">{view.courseById.get(item.courseId)?.name ?? "—"}</span>
                      <span>{data.activeYear?.name}</span>
                    </div>
                  </div>
                  <div className="adm-row__actions">
                    <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDialog({ kind: "transfer", enrollmentId: item.id })}>
                      <ArrowLeftRight aria-hidden="true" strokeWidth={2} />
                      Cambiar de curso
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {dialog?.kind === "grade" ? <GradeDialog open onClose={close} existing={data.grades} /> : null}
      {dialog?.kind === "course" ? <CourseDialog open onClose={close} data={data} onCreateGrade={() => setDialog({ kind: "grade" })} /> : null}
      {dialog?.kind === "subject" ? <SubjectDialog open onClose={close} data={data} /> : null}
      {dialog?.kind === "attach" ? <AttachSubjectDialog open onClose={close} data={data} initialCourseId={dialog.courseId} initialSubjectId={dialog.subjectId} /> : null}
      {dialog?.kind === "assign" ? <AssignTeacherDialog open onClose={close} data={data} initialTeacherId={dialog.teacherId} initialCourseId={dialog.courseId} /> : null}
      {dialog?.kind === "enroll" ? <EnrollDialog open onClose={close} data={data} initialCourseId={dialog.courseId} onLoadStudents={() => loadUsers("STUDENT")} /> : null}
      {dialog?.kind === "transfer" ? <TransferDialog open onClose={close} data={data} enrollmentId={dialog.enrollmentId} /> : null}
    </AdminPage>
  );
}


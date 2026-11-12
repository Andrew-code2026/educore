import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AdminDialog, Avatar, Field } from "../parts";

const ROLE = "admin" as const;

export interface AcademicData {
  activeYear: { id: number; year: number; name: string } | null;
  grades: Array<{ id: number; name: string; shortName: string; levelOrder: number }>;
  courses: Array<{ id: number; name: string; code: string | null; grade: string | null; gradeLevelId: number | null; capacity: number | null; studentCount: number }>;
  subjects: Array<{ id: number; name: string; code: string | null; description: string | null }>;
  courseSubjects: Array<{ courseId: number; subjectId: number }>;
  teachers: Array<{ userId: number; specialties: string | null; user: { name: string | null } | null }>;
  students: Array<{ userId: number; user: { name: string | null; email: string | null } | null }>;
  studentEnrollments: Array<{ id: number; studentUserId: number; courseId: number; student: { name: string | null } | null }>;
}

/** Recarga todo lo que depende de la estructura académica (portal directivo y docente). */
export function useAcademicRefresh() {
  const utils = trpc.useUtils();
  return () =>
    Promise.all([
      utils.academic.snapshot.invalidate(),
      utils.educore.snapshot.invalidate(),
      utils.gradeCenter.invalidate(),
      utils.identity.summary.invalidate(),
    ]);
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

function DialogActions({ busy, onCancel, submitLabel, disabled }: { busy: boolean; onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <div className="adm-dialog__actions">
      <button type="button" className="adm-btn adm-btn--outline" onClick={onCancel} disabled={busy}>
        Cancelar
      </button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <p className="adm-note adm-note--error" role="alert">
      {message}
    </p>
  ) : null;
}

/* ── Grado ─────────────────────────────────────────────── */

const GRADE_NAMES: Record<number, string> = {
  1: "Primero",
  2: "Segundo",
  3: "Tercero",
  4: "Cuarto",
  5: "Quinto",
  6: "Sexto",
  7: "Séptimo",
  8: "Octavo",
  9: "Noveno",
  10: "Décimo",
  11: "Undécimo",
};

export function GradeDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: AcademicData["grades"] }) {
  const refresh = useAcademicRefresh();
  const mutation = trpc.academic.createGrade.useMutation();
  const suggested = useMemo(() => {
    const used = new Set(existing.map(grade => grade.levelOrder));
    for (let level = 11; level >= 1; level -= 1) if (!used.has(level)) return level;
    return 1;
  }, [existing]);
  const [level, setLevel] = useState(String(suggested));
  const [name, setName] = useState(GRADE_NAMES[suggested] ?? "");
  const [error, setError] = useState<string | null>(null);
  const levelNumber = Number(level);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ role: ROLE, name, shortName: `${levelNumber}°`, levelOrder: levelNumber });
      toast.success(`Grado ${name} creado.`);
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo crear el grado."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={mutation.isPending} eyebrow="Estructura" title="Nuevo grado" description="Los cursos (grupos) se crean dentro de un grado.">
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form__row">
          <Field label="Nivel">
            <select
              className="adm-select"
              value={level}
              onChange={event => {
                setLevel(event.target.value);
                setName(GRADE_NAMES[Number(event.target.value)] ?? name);
              }}
            >
              {Object.entries(GRADE_NAMES).map(([value, label]) => (
                <option key={value} value={value} disabled={existing.some(grade => grade.levelOrder === Number(value))}>
                  {value}° · {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nombre">
            <input className="adm-input" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={80} />
          </Field>
        </div>
        <ErrorNote message={error} />
        <DialogActions busy={mutation.isPending} onCancel={onClose} submitLabel="Crear grado" />
      </form>
    </AdminDialog>
  );
}

/* ── Curso ─────────────────────────────────────────────── */

export function CourseDialog({ open, onClose, data, onCreateGrade }: { open: boolean; onClose: () => void; data: AcademicData; onCreateGrade: () => void }) {
  const refresh = useAcademicRefresh();
  const mutation = trpc.academic.createCourse.useMutation();
  const [gradeId, setGradeId] = useState(data.grades.at(-1)?.id ? String(data.grades.at(-1)!.id) : "");
  const [group, setGroup] = useState("");
  const [capacity, setCapacity] = useState("32");
  const [error, setError] = useState<string | null>(null);
  const grade = data.grades.find(item => String(item.id) === gradeId);
  const level = grade ? grade.shortName.replace(/[^0-9]/g, "") || String(grade.levelOrder) : "";
  const name = level && group ? `${level}-${group}` : "";
  const code = name && data.activeYear ? `${name}-${data.activeYear.year}` : name;
  const duplicate = data.courses.some(course => course.name.toLowerCase() === name.toLowerCase());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data.activeYear || !grade) return;
    setError(null);
    try {
      await mutation.mutateAsync({ role: ROLE, academicYearId: data.activeYear.id, gradeLevelId: grade.id, name, code, capacity: Number(capacity) || null });
      toast.success(`Curso ${name} creado.`);
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo crear el curso."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={mutation.isPending} eyebrow="Estructura" title="Nuevo curso" description={`Grupo del ${data.activeYear?.name ?? "año activo"}. Luego le asocias materias y docentes.`}>
      {data.grades.length === 0 ? (
        <div className="adm-form">
          <p className="adm-note adm-note--warn">Primero crea un grado (por ejemplo, Décimo) para agrupar sus cursos.</p>
          <div className="adm-dialog__actions">
            <button type="button" className="adm-btn adm-btn--primary" onClick={onCreateGrade}>Crear grado</button>
          </div>
        </div>
      ) : (
        <form className="adm-form" onSubmit={submit}>
          <div className="adm-form__row" style={{ ["--adm-cols" as string]: 3 }}>
            <Field label="Grado">
              <select className="adm-select" value={gradeId} onChange={event => setGradeId(event.target.value)} required>
                {data.grades.map(item => (
                  <option key={item.id} value={item.id}>{item.shortName} · {item.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Grupo" hint="1, 2, A…">
              <input className="adm-input" value={group} onChange={event => setGroup(event.target.value.replace(/\s+/g, "").slice(0, 4))} required placeholder="3" />
            </Field>
            <Field label="Capacidad">
              <input className="adm-input" type="number" min={1} max={200} value={capacity} onChange={event => setCapacity(event.target.value)} />
            </Field>
          </div>
          {name ? (
            <p className={cn("adm-note", duplicate && "adm-note--warn")}>
              {duplicate ? `Ya existe un curso ${name}.` : `Se creará el curso ${name} con código ${code}.`}
            </p>
          ) : null}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" style={{ alignSelf: "flex-start" }} onClick={onCreateGrade}>
            ¿Falta el grado? Créalo aquí
          </button>
          <ErrorNote message={error} />
          <DialogActions busy={mutation.isPending} onCancel={onClose} submitLabel="Crear curso" disabled={!name || duplicate || !data.activeYear} />
        </form>
      )}
    </AdminDialog>
  );
}

/* ── Materia ───────────────────────────────────────────── */

export function SubjectDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: AcademicData }) {
  const refresh = useAcademicRefresh();
  const createMutation = trpc.academic.createSubject.useMutation();
  const attachMutation = trpc.academic.attachSubject.useMutation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = createMutation.isPending || attachMutation.isPending;
  const suggestedCode = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const finalCode = (code || suggestedCode).toUpperCase();
    try {
      const subject = await createMutation.mutateAsync({ role: ROLE, name, shortName: finalCode, code: finalCode, description: description || undefined });
      if (subject) {
        for (const courseId of courseIds) await attachMutation.mutateAsync({ role: ROLE, courseId, subjectId: subject.id });
      }
      toast.success(courseIds.length ? `${name} creada y asociada a ${courseIds.length} ${courseIds.length === 1 ? "curso" : "cursos"}.` : `Materia ${name} creada.`);
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo crear la materia."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={busy} eyebrow="Plan de estudios" title="Nueva materia" description="Una materia puede dictarse en varios cursos.">
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form__row">
          <Field label="Nombre">
            <input className="adm-input" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} placeholder="Ej. Química" />
          </Field>
          <Field label="Código" hint="único">
            <input className="adm-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().slice(0, 30))} placeholder={suggestedCode || "QUI"} />
          </Field>
        </div>
        <Field label="Descripción" hint="opcional">
          <textarea className="adm-textarea" value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={3} />
        </Field>
        {data.courses.length ? (
          <fieldset className="adm-field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="adm-label" style={{ marginBottom: 6 }}>
              Asociar a cursos <span className="adm-label__hint">opcional</span>
            </legend>
            <div className="adm-chips">
              {data.courses.map(course => {
                const checked = courseIds.includes(course.id);
                return (
                  <label key={course.id} className="adm-chip adm-chip--plain" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setCourseIds(current => (checked ? current.filter(id => id !== course.id) : [...current, course.id]))}
                    />
                    {course.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        <ErrorNote message={error} />
        <DialogActions busy={busy} onCancel={onClose} submitLabel="Crear materia" disabled={!name.trim() || !(code || suggestedCode)} />
      </form>
    </AdminDialog>
  );
}

/* ── Asociar materia a curso ───────────────────────────── */

export function AttachSubjectDialog({ open, onClose, data, initialCourseId, initialSubjectId }: { open: boolean; onClose: () => void; data: AcademicData; initialCourseId?: number; initialSubjectId?: number }) {
  const refresh = useAcademicRefresh();
  const mutation = trpc.academic.attachSubject.useMutation();
  const [courseId, setCourseId] = useState(initialCourseId ? String(initialCourseId) : "");
  const [subjectId, setSubjectId] = useState(initialSubjectId ? String(initialSubjectId) : "");
  const [error, setError] = useState<string | null>(null);
  const linked = data.courseSubjects.some(link => String(link.courseId) === courseId && String(link.subjectId) === subjectId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ role: ROLE, courseId: Number(courseId), subjectId: Number(subjectId) });
      toast.success("Materia asociada al curso.");
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo asociar la materia."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={mutation.isPending} eyebrow="Plan de estudios" title="Asociar materia a curso">
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form__row">
          <Field label="Curso">
            <select className="adm-select" value={courseId} onChange={event => setCourseId(event.target.value)} required>
              <option value="">Selecciona un curso</option>
              {data.courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Materia">
            <select className="adm-select" value={subjectId} onChange={event => setSubjectId(event.target.value)} required>
              <option value="">Selecciona una materia</option>
              {data.subjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </Field>
        </div>
        {linked ? <p className="adm-note">Esta materia ya está asociada a ese curso.</p> : null}
        <ErrorNote message={error} />
        <DialogActions busy={mutation.isPending} onCancel={onClose} submitLabel="Asociar" disabled={!courseId || !subjectId || linked} />
      </form>
    </AdminDialog>
  );
}

/* ── Asignar docente ───────────────────────────────────── */

export function AssignTeacherDialog({ open, onClose, data, initialTeacherId, initialCourseId }: { open: boolean; onClose: () => void; data: AcademicData; initialTeacherId?: number; initialCourseId?: number }) {
  const refresh = useAcademicRefresh();
  const attachMutation = trpc.academic.attachSubject.useMutation();
  const assignMutation = trpc.academic.assignTeacher.useMutation();
  const [teacherId, setTeacherId] = useState(initialTeacherId ? String(initialTeacherId) : "");
  const [courseId, setCourseId] = useState(initialCourseId ? String(initialCourseId) : "");
  const [subjectId, setSubjectId] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = attachMutation.isPending || assignMutation.isPending;
  const needsLink = Boolean(courseId && subjectId) && !data.courseSubjects.some(link => String(link.courseId) === courseId && String(link.subjectId) === subjectId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data.activeYear) return;
    setError(null);
    try {
      // El servidor exige que la materia esté asociada al curso: se asocia en el mismo paso
      if (needsLink) await attachMutation.mutateAsync({ role: ROLE, courseId: Number(courseId), subjectId: Number(subjectId) });
      await assignMutation.mutateAsync({ role: ROLE, teacherUserId: Number(teacherId), courseId: Number(courseId), subjectId: Number(subjectId), academicYearId: data.activeYear.id, isPrimary });
      toast.success("Carga docente asignada. El docente ya ve el curso en su portal.");
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo asignar la carga."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={busy} eyebrow="Carga docente" title="Asignar curso y materia" description="El docente verá el curso en Grade Center, Classroom y Asistencia.">
      <form className="adm-form" onSubmit={submit}>
        <Field label="Docente">
          <select className="adm-select" value={teacherId} onChange={event => setTeacherId(event.target.value)} required>
            <option value="">Selecciona un docente</option>
            {data.teachers.map(teacher => (
              <option key={teacher.userId} value={teacher.userId}>
                {teacher.user?.name ?? "Docente"}
                {teacher.specialties ? ` · ${teacher.specialties}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="adm-form__row">
          <Field label="Curso">
            <select className="adm-select" value={courseId} onChange={event => setCourseId(event.target.value)} required>
              <option value="">Selecciona un curso</option>
              {data.courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Materia">
            <select className="adm-select" value={subjectId} onChange={event => setSubjectId(event.target.value)} required>
              <option value="">Selecciona una materia</option>
              {data.subjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="adm-label" style={{ alignItems: "center", gap: 8, fontWeight: 500 }}>
          <input type="checkbox" checked={isPrimary} onChange={event => setIsPrimary(event.target.checked)} />
          Docente titular de la materia en el curso
        </label>
        {needsLink ? <p className="adm-note">La materia aún no está en ese curso: se asociará automáticamente.</p> : null}
        <ErrorNote message={error} />
        <DialogActions busy={busy} onCancel={onClose} submitLabel="Asignar" disabled={!teacherId || !courseId || !subjectId || !data.activeYear} />
      </form>
    </AdminDialog>
  );
}

/* ── Matricular en curso ───────────────────────────────── */

export function EnrollDialog({ open, onClose, data, initialCourseId, onLoadStudents }: { open: boolean; onClose: () => void; data: AcademicData; initialCourseId?: number; onLoadStudents: () => void }) {
  const refresh = useAcademicRefresh();
  const mutation = trpc.academic.bulkEnroll.useMutation();
  const [courseId, setCourseId] = useState(initialCourseId ? String(initialCourseId) : "");
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enrolled = new Set(data.studentEnrollments.map(item => item.studentUserId));
  const pending = data.students
    .filter(student => !enrolled.has(student.userId))
    .map(student => ({ userId: student.userId, name: student.user?.name ?? "Estudiante", email: student.user?.email ?? "" }))
    .filter(student => `${student.name} ${student.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const course = data.courses.find(item => String(item.id) === courseId);
  const free = course?.capacity ? course.capacity - course.studentCount : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data.activeYear || !course) return;
    setError(null);
    try {
      for (let index = 0; index < selected.length; index += 100) {
        await mutation.mutateAsync({ role: ROLE, studentUserIds: selected.slice(index, index + 100), academicYearId: data.activeYear.id, courseId: course.id });
      }
      toast.success(`${selected.length} ${selected.length === 1 ? "estudiante matriculado" : "estudiantes matriculados"} en ${course.name}.`);
      await refresh();
      setSelected([]);
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo completar la matrícula."));
      await refresh();
    }
  };

  const allVisibleSelected = pending.length > 0 && pending.every(student => selected.includes(student.userId));

  return (
    <AdminDialog open={open} onClose={onClose} busy={mutation.isPending} wide eyebrow="Matrícula" title="Matricular estudiantes" description="Quedan visibles de inmediato en asistencia y en las planillas de sus docentes.">
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form__row">
          <Field label="Curso">
            <select className="adm-select" value={courseId} onChange={event => setCourseId(event.target.value)} required>
              <option value="">Selecciona un curso</option>
              {data.courses.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.studentCount}
                  {item.capacity ? `/${item.capacity}` : ""} estudiantes
                </option>
              ))}
            </select>
          </Field>
          <label className="adm-field">
            <span className="adm-label">Buscar</span>
            <span style={{ position: "relative" }}>
              <Search aria-hidden="true" width={16} height={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--edc-muted)" }} />
              <input className="adm-input" style={{ paddingLeft: 36 }} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o correo" />
            </span>
          </label>
        </div>

        {pending.length === 0 && !search ? (
          <div className="adm-block">
            <p className="adm-block__title">Todos los estudiantes ya tienen matrícula</p>
            <p className="adm-block__text">Para agregar nuevos estudiantes, cárgalos desde Usuarios con su curso y quedarán matriculados.</p>
            <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" style={{ alignSelf: "flex-start" }} onClick={onLoadStudents}>
              Cargar estudiantes
            </button>
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={allVisibleSelected}
                      onChange={() =>
                        setSelected(current =>
                          allVisibleSelected
                            ? current.filter(id => !pending.some(student => student.userId === id))
                            : Array.from(new Set([...current, ...pending.map(student => student.userId)])),
                        )
                      }
                    />
                  </th>
                  <th scope="col">Estudiante sin matrícula</th>
                  <th scope="col">Correo</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(student => {
                  const checked = selected.includes(student.userId);
                  return (
                    <tr key={student.userId} onClick={() => setSelected(current => (checked ? current.filter(id => id !== student.userId) : [...current, student.userId]))} style={{ cursor: "pointer" }}>
                      <td>
                        <input type="checkbox" checked={checked} readOnly aria-label={`Seleccionar a ${student.name}`} />
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={student.name} tone="green" />
                          {student.name}
                        </span>
                      </td>
                      <td className="adm-table__muted">{student.email}</td>
                    </tr>
                  );
                })}
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="adm-table__muted" style={{ textAlign: "center", padding: 18 }}>
                      Nadie coincide con la búsqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {free !== null && selected.length > free ? (
          <p className="adm-note adm-note--warn">
            {course?.name} tiene {Math.max(0, free)} cupos libres y seleccionaste {selected.length}. Puedes continuar, pero superarás la capacidad.
          </p>
        ) : null}
        <ErrorNote message={error} />
        <DialogActions busy={mutation.isPending} onCancel={onClose} submitLabel={`Matricular ${selected.length || ""}`.trim()} disabled={!course || !selected.length || !data.activeYear} />
      </form>
    </AdminDialog>
  );
}

/* ── Cambio de curso ───────────────────────────────────── */

export function TransferDialog({ open, onClose, data, enrollmentId }: { open: boolean; onClose: () => void; data: AcademicData; enrollmentId: number | null }) {
  const refresh = useAcademicRefresh();
  const mutation = trpc.academic.transferStudent.useMutation();
  const enrollment = data.studentEnrollments.find(item => item.id === enrollmentId);
  const current = data.courses.find(course => course.id === enrollment?.courseId);
  const [courseId, setCourseId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollment) return;
    setError(null);
    try {
      await mutation.mutateAsync({ role: ROLE, enrollmentId: enrollment.id, newCourseId: Number(courseId), reason: reason || "Cambio administrativo de curso" });
      toast.success("Cambio de curso guardado con historial.");
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause, "No se pudo cambiar de curso."));
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={mutation.isPending} eyebrow="Matrícula" title={`Cambiar de curso a ${enrollment?.student?.name ?? "estudiante"}`} description={current ? `Curso actual: ${current.name}. El cambio queda en el historial de matrícula.` : undefined}>
      <form className="adm-form" onSubmit={submit}>
        <Field label="Nuevo curso">
          <select className="adm-select" value={courseId} onChange={event => setCourseId(event.target.value)} required>
            <option value="">Selecciona un curso</option>
            {data.courses
              .filter(course => course.id !== current?.id)
              .map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
          </select>
        </Field>
        <Field label="Motivo" hint="queda en el historial">
          <textarea className="adm-textarea" rows={3} value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Ej. Solicitud de la familia por horario" />
        </Field>
        <ErrorNote message={error} />
        <DialogActions busy={mutation.isPending} onCancel={onClose} submitLabel="Guardar cambio" disabled={!courseId} />
      </form>
    </AdminDialog>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="adm-section__hint">{children}</span>;
}

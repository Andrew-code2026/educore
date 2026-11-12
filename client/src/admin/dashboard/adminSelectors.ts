import type { Section } from "@/components/shell";

/**
 * Selectores puros del Inicio de Rectoría / Coordinación.
 * Toda la lectura institucional sale de aquí para poder probarla sin React ni servidor.
 */

const PASSING_GRADE = 3;
const ATTENDED = new Set(["presente", "tarde", "present", "late"]);

export interface AttendanceRow {
  course?: string | null;
  date?: string | Date | null;
  status?: string | null;
}

export interface PlanillaSummary {
  courseId: number;
  courseName: string;
  subjectName: string;
  students: number;
  average: number | null;
  graded: number;
  total: number;
  belowPassing: Array<{ studentId: number; name: string; average: number }>;
}

export interface AcademicCourse {
  id: number;
  name: string;
  grade?: string | null;
  capacity?: number | null;
  studentCount: number;
  subjectCount: number;
  teacherCount: number;
  academicYearId?: number | null;
}

export interface AcademicSnapshotLike {
  activeYear?: { id: number; year: number; name: string } | null;
  periods?: Array<{ id: number; academicYearId?: number | null; status?: string | null; name: string }>;
  courses: AcademicCourse[];
  courseSubjects: Array<{ courseId: number; subjectId: number }>;
  teacherAssignments: Array<{ teacherUserId: number; courseId: number }>;
  studentEnrollments: Array<{ studentUserId: number; courseId: number }>;
  teachers: Array<{ userId: number; user?: { name?: string | null } | null }>;
  students: Array<{ userId: number; user?: { name?: string | null } | null }>;
}

export interface ReportCardCourse {
  courseId: number;
  courseName: string;
  periodName: string;
  students: number;
  generated: number;
}

export interface IdentitySummaryLike {
  byRole: Record<string, number>;
  pendingInvitations: number;
}

const normalize = (value: string) => value.trim().toLowerCase();
const isAttended = (status: string | null | undefined) => ATTENDED.has(normalize(status ?? ""));
const toDate = (value: string | Date | null | undefined) => (value ? new Date(value) : null);

/** Asistencia de los últimos `days` días: (presentes + tardes) / registros. */
export function attendanceRate(rows: AttendanceRow[], now = new Date(), days = 30): { rate: number | null; total: number } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);
  const inRange = rows.filter(row => {
    const date = toDate(row.date);
    return date !== null && !Number.isNaN(date.getTime()) && date >= from && date <= now;
  });
  if (!inRange.length) return { rate: null, total: 0 };
  const attended = inRange.filter(row => isAttended(row.status)).length;
  return { rate: Math.round((attended / inRange.length) * 100), total: inRange.length };
}

/** Promedio institucional ponderado por estudiantes de cada planilla, y estudiantes únicos en riesgo. */
export function institutionalPerformance(planillas: PlanillaSummary[]) {
  let weighted = 0;
  let weight = 0;
  const atRisk = new Map<number, { studentId: number; name: string; average: number; courses: Set<string> }>();
  for (const planilla of planillas) {
    if (planilla.average !== null && planilla.students > 0) {
      weighted += planilla.average * planilla.students;
      weight += planilla.students;
    }
    for (const student of planilla.belowPassing) {
      const current = atRisk.get(student.studentId);
      if (current) {
        current.average = Math.min(current.average, student.average);
        current.courses.add(planilla.courseName);
      } else {
        atRisk.set(student.studentId, { ...student, courses: new Set([planilla.courseName]) });
      }
    }
  }
  return {
    average: weight ? Math.round((weighted / weight) * 10) / 10 : null,
    atRisk: Array.from(atRisk.values()).sort((a, b) => a.average - b.average),
    gradingProgress: (() => {
      const total = planillas.reduce((sum, planilla) => sum + planilla.total, 0);
      const graded = planillas.reduce((sum, planilla) => sum + planilla.graded, 0);
      return total ? Math.round((graded / total) * 100) : null;
    })(),
  };
}

export interface InstitutionKpis {
  enrolled: number;
  capacity: number;
  teachers: number;
  teachersWithLoad: number;
  attendance: number | null;
  attendanceRecords: number;
  average: number | null;
  atRisk: number;
}

export function buildInstitutionKpis(input: {
  academic: AcademicSnapshotLike | null | undefined;
  planillas: PlanillaSummary[];
  attendance: AttendanceRow[];
  now?: Date;
}): InstitutionKpis {
  const academic = input.academic;
  const loadedTeachers = new Set((academic?.teacherAssignments ?? []).map(item => item.teacherUserId));
  const performance = institutionalPerformance(input.planillas);
  const attendance = attendanceRate(input.attendance, input.now);
  return {
    enrolled: academic?.studentEnrollments.length ?? 0,
    capacity: (academic?.courses ?? []).reduce((sum, course) => sum + (course.capacity ?? 0), 0),
    teachers: academic?.teachers.length ?? 0,
    teachersWithLoad: (academic?.teachers ?? []).filter(teacher => loadedTeachers.has(teacher.userId)).length,
    attendance: attendance.rate,
    attendanceRecords: attendance.total,
    average: performance.average,
    atRisk: performance.atRisk.length,
  };
}

export interface CourseHealth {
  id: number;
  name: string;
  students: number;
  capacity: number | null;
  average: number | null;
  attendance: number | null;
  atRisk: number;
  subjects: number;
  teachers: number;
}

export function buildCourseHealth(input: {
  courses: AcademicCourse[];
  planillas: PlanillaSummary[];
  attendance: AttendanceRow[];
  now?: Date;
}): CourseHealth[] {
  return input.courses
    .map(course => {
      const ofCourse = input.planillas.filter(planilla => planilla.courseId === course.id);
      const performance = institutionalPerformance(ofCourse);
      const attendance = attendanceRate(
        input.attendance.filter(row => normalize(String(row.course ?? "")) === normalize(course.name)),
        input.now,
      );
      return {
        id: course.id,
        name: course.name,
        students: course.studentCount,
        capacity: course.capacity ?? null,
        average: performance.average,
        attendance: attendance.rate,
        atRisk: performance.atRisk.length,
        subjects: course.subjectCount,
        teachers: course.teacherCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
}

export type AdminPriorityKind = "risk" | "reports" | "drafts" | "teachers" | "students" | "invitations" | "piar";

export interface AdminPriority {
  id: AdminPriorityKind;
  severity: "high" | "medium" | "low";
  title: string;
  context: string;
  actionLabel: string;
  section: Section;
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const listNames = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} y ${names.length - max} más`;

/** "Por atender": señales institucionales accionables, de mayor a menor urgencia. */
export function buildAdminPriorities(input: {
  academic: AcademicSnapshotLike | null | undefined;
  planillas: PlanillaSummary[];
  reportCards: ReportCardCourse[];
  announcements: Array<{ status?: string | null }>;
  identity: IdentitySummaryLike | null | undefined;
  piar: Array<{ withPiar: number; finalized: number }>;
}): AdminPriority[] {
  const items: AdminPriority[] = [];
  const performance = institutionalPerformance(input.planillas);

  if (performance.atRisk.length) {
    const courses = Array.from(new Set(performance.atRisk.flatMap(student => Array.from(student.courses))));
    items.push({
      id: "risk",
      severity: "high",
      title: `${performance.atRisk.length} ${performance.atRisk.length === 1 ? "estudiante" : "estudiantes"} por debajo de ${PASSING_GRADE.toFixed(1)}`,
      context: `Seguimiento académico en ${listNames(courses)}`,
      actionLabel: "Ver alertas",
      section: "analytics",
    });
  }

  const pendingCards = input.reportCards.filter(card => card.students > 0 && card.generated < card.students);
  if (pendingCards.length) {
    items.push({
      id: "reports",
      severity: "medium",
      title: `Boletines pendientes en ${pendingCards.length} ${pendingCards.length === 1 ? "curso" : "cursos"}`,
      context: `${pendingCards[0].periodName} · ${listNames(pendingCards.map(card => card.courseName))}`,
      actionLabel: "Generar",
      section: "reports",
    });
  }

  const enrolled = new Set((input.academic?.studentEnrollments ?? []).map(item => item.studentUserId));
  const pendingStudents = (input.academic?.students ?? []).filter(student => !enrolled.has(student.userId));
  if (pendingStudents.length) {
    items.push({
      id: "students",
      severity: "medium",
      title: `${pendingStudents.length} ${pendingStudents.length === 1 ? "estudiante" : "estudiantes"} sin matrícula`,
      context: listNames(pendingStudents.map(student => student.user?.name ?? "Estudiante")),
      actionLabel: "Matricular",
      section: "academic",
    });
  }

  const loaded = new Set((input.academic?.teacherAssignments ?? []).map(item => item.teacherUserId));
  const idleTeachers = (input.academic?.teachers ?? []).filter(teacher => !loaded.has(teacher.userId));
  if (idleTeachers.length) {
    items.push({
      id: "teachers",
      severity: "medium",
      title: `${idleTeachers.length} ${idleTeachers.length === 1 ? "docente" : "docentes"} sin carga académica`,
      context: listNames(idleTeachers.map(teacher => teacher.user?.name ?? "Docente")),
      actionLabel: "Asignar",
      section: "academic",
    });
  }

  const drafts = input.announcements.filter(item => normalize(item.status ?? "") === "borrador").length;
  if (drafts) {
    items.push({
      id: "drafts",
      severity: "low",
      title: `${drafts} ${drafts === 1 ? "comunicado" : "comunicados"} en borrador`,
      context: "Revisa y publica para la comunidad",
      actionLabel: "Revisar",
      section: "communications",
    });
  }

  const piarDrafts = input.piar.reduce((sum, course) => sum + Math.max(0, course.withPiar - course.finalized), 0);
  if (piarDrafts) {
    items.push({
      id: "piar",
      severity: "low",
      title: `${piarDrafts} PIAR sin finalizar`,
      context: "Ajustes razonables en elaboración por los docentes",
      actionLabel: "Revisar",
      section: "piar",
    });
  }

  const invitations = input.identity?.pendingInvitations ?? 0;
  if (invitations) {
    items.push({
      id: "invitations",
      severity: "low",
      title: `${invitations} ${invitations === 1 ? "invitación pendiente" : "invitaciones pendientes"}`,
      context: "Personas que aún no han activado su acceso",
      actionLabel: "Ver",
      section: "users",
    });
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface AgendaEvent {
  id: number | string;
  title: string;
  type?: string | null;
  location?: string | null;
  eventDate?: string | Date | null;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Eventos de hoy y próximos (desde mañana), en orden cronológico. */
export function splitAgenda(events: AgendaEvent[], now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dated = events
    .map(event => ({ event, date: toDate(event.eventDate) }))
    .filter((item): item is { event: AgendaEvent; date: Date } => item.date !== null && !Number.isNaN(item.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    today: dated.filter(item => sameDay(item.date, now)),
    upcoming: dated.filter(item => item.date >= startOfToday && !sameDay(item.date, now)),
  };
}

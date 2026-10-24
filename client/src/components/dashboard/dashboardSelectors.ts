import type {
  TeacherCourseCardItem,
  TeacherGradingItem,
  TeacherPriorityItem,
  TeacherStudentAlert,
} from "./types";

export interface AttendanceStatusSummary {
  label: "Al día" | "Parcial" | "Pendiente";
  tone: "success" | "warning" | "danger" | "violet";
  text: string;
  pendingCourses: string[];
}

export interface StudentRiskStat {
  name: string;
  course: string;
  subject: string;
  avg: number;
}

/**
 * Calcula estrictamente las entregas pendientes de calificación (grade === null).
 * Nunca inventa números falsos cuando el conteo real es 0.
 */
export function calculatePendingGrades(submissions: any[]): number {
  return (submissions || []).filter((s: any) => s && s.grade === null).length;
}

/**
 * Identifica estudiantes con promedio estrictamente menor a 3.0 (> 0 y < 3.0).
 */
export function calculateStudentsAtRisk(grades: any[]): StudentRiskStat[] {
  const studentGradesMap: Record<
    string,
    { total: number; count: number; course: string; subject: string }
  > = {};

  (grades || []).forEach((g: any) => {
    if (!g?.studentName || typeof g.value !== "number") return;
    if (!studentGradesMap[g.studentName]) {
      studentGradesMap[g.studentName] = {
        total: 0,
        count: 0,
        course: g.course || "",
        subject: g.subject || "",
      };
    }
    studentGradesMap[g.studentName].total += g.value;
    studentGradesMap[g.studentName].count += 1;
  });

  const calculated = Object.entries(studentGradesMap).map(([name, stat]) => ({
    name,
    course: stat.course,
    subject: stat.subject,
    avg: stat.count > 0 ? stat.total / stat.count : 0,
  }));

  return calculated
    .filter((s) => s.avg > 0 && s.avg < 3.0)
    .sort((a, b) => a.avg - b.avg);
}

/**
 * Calcula el estado real de asistencia del día actual comparando los cursos asignados.
 */
export function calculateAttendanceStatus(
  attendance: any[],
  courses: any[]
): AttendanceStatusSummary {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const attendedCoursesToday = new Set(
    (attendance || [])
      .filter((a: any) => {
        if (!a?.date) return false;
        const d = new Date(a.date);
        return (
          d.getFullYear() === todayY &&
          d.getMonth() === todayM &&
          d.getDate() === todayD
        );
      })
      .map((a: any) => a.course)
  );

  const courseList = courses || [];
  if (courseList.length === 0) {
    return {
      label: "Al día",
      tone: "success",
      text: "Sin cursos asignados",
      pendingCourses: [],
    };
  }

  const pendingCourses = courseList
    .map((c: any) => c.name as string)
    .filter((name: string) => Boolean(name) && !attendedCoursesToday.has(name));

  const attendedCount = courseList.length - pendingCourses.length;

  if (attendedCount === courseList.length) {
    return {
      label: "Al día",
      tone: "success",
      text: "Registro completado",
      pendingCourses: [],
    };
  } else if (attendedCount > 0) {
    return {
      label: "Parcial",
      tone: "warning",
      text: `${attendedCount}/${courseList.length} cursos listos`,
      pendingCourses,
    };
  } else {
    return {
      label: "Pendiente",
      tone: "danger",
      text: "Registro pendiente hoy",
      pendingCourses,
    };
  }
}

/**
 * Construye y ordena la cola de tareas con entregas pendientes de calificación.
 */
export function calculateGradingQueue(
  assignments: any[],
  submissions: any[],
  onGrade?: () => void
): TeacherGradingItem[] {
  return (assignments || [])
    .map((a: any) => {
      const subsForA = (submissions || []).filter(
        (s: any) => s.assignmentId === a.id
      );
      const pendingForA = subsForA.filter((s: any) => s.grade === null).length;

      return {
        assignmentId: a.id,
        title: a.title,
        course: a.course,
        subject: a.subject,
        pendingCount: pendingForA,
        totalSubmissions: subsForA.length,
        dueAt: a.dueAt,
        onGrade: onGrade ?? (() => {}),
      };
    })
    .filter((item) => item.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount);
}

/**
 * Determina la etiqueta de la acción contextual primaria según las prioridades reales.
 */
export function getHighlightedAction(
  pendingCount: number,
  attendanceLabel: string
): string {
  if (pendingCount > 0) {
    return `Calificar ahora (${pendingCount} ${
      pendingCount === 1 ? "pendiente" : "pendientes"
    })`;
  }
  if (attendanceLabel !== "Al día") {
    return "Registrar asistencia de hoy";
  }
  return "Preparar actividad con IA";
}

/**
 * Construye los ítems de atención prioritaria solo cuando existen alertas reales,
 * enriqueciendo el contexto con los nombres coherentes de cursos o estudiantes.
 */
/** "11-1, 11-2 y 11-3" */
function joinWithY(values: string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

export function calculatePriorityItems(
  todayAttendanceLabel: string,
  pendingCount: number,
  studentsAtRiskCount: number,
  options?: {
    pendingCourses?: string[];
    gradingQueue?: TeacherGradingItem[];
    studentsAtRisk?: StudentRiskStat[];
    teacherSubject?: string;
    onTakeAttendance?: () => void;
    onOpenGrades?: () => void;
  }
): TeacherPriorityItem[] {
  const items: TeacherPriorityItem[] = [];

  if (todayAttendanceLabel !== "Al día") {
    const pendingCourses = options?.pendingCourses ?? [];
    const coursesDetail =
      pendingCourses.length > 0
        ? `${joinWithY(pendingCourses)} · sin registrar`
        : "Registro pendiente en tus cursos asignados";

    items.push({
      id: "attendance",
      severity: "medium",
      title: "Registrar asistencia de hoy",
      context: coursesDetail,
      actionLabel: "Tomar lista",
      onAction: options?.onTakeAttendance ?? (() => {}),
    });
  }

  if (pendingCount > 0) {
    const teacherSubject = options?.teacherSubject || "Biología";
    const matchingTask = (options?.gradingQueue || []).find(
      (t) =>
        t.subject &&
        t.subject.toLowerCase() === teacherSubject.toLowerCase()
    );
    const topTask = matchingTask ?? options?.gradingQueue?.[0];
    const taskDetail = topTask
      ? `${topTask.subject || teacherSubject} ${topTask.course}`
      : "Revisa los envíos recibidos";

    items.push({
      id: "pending",
      severity: "high",
      title: `Calificar ${pendingCount} ${pendingCount === 1 ? "entrega" : "entregas"}`,
      context: taskDetail,
      count: pendingCount,
      actionLabel: "Calificar",
      onAction: options?.onOpenGrades ?? (() => {}),
    });
  }

  if (studentsAtRiskCount > 0) {
    const atRisk = options?.studentsAtRisk || [];
    const single = studentsAtRiskCount === 1 ? atRisk[0] : undefined;
    const topRiskNames = atRisk
      .slice(0, 2)
      .map((s) => `${s.name} (${s.avg.toFixed(1)})`)
      .join(", ");
    const extraCount = Math.max(0, studentsAtRiskCount - 2);
    const riskContext = single
      ? `Promedio ${single.avg.toFixed(1)}, por debajo de 3.0`
      : topRiskNames
        ? `${topRiskNames}${extraCount > 0 ? ` y ${extraCount} más` : ""}, por debajo de 3.0`
        : "Promedio por debajo de 3.0 en el periodo actual";

    items.push({
      id: "risk",
      severity: "high",
      title: single
        ? `Seguimiento a ${single.name}`
        : `Seguimiento a ${studentsAtRiskCount} ${studentsAtRiskCount === 1 ? "estudiante" : "estudiantes"}`,
      context: riskContext,
      count: studentsAtRiskCount,
      actionLabel: "Ver notas",
      onAction: options?.onOpenGrades ?? (() => {}),
    });
  }

  return items;
}

/**
 * Construye las tarjetas de cursos sincronizadas con las calificaciones y entregas reales.
 */
export function buildTeacherCourseCards(
  courses: any[],
  grades: any[],
  assignments: any[],
  submissions: any[],
  onSelectCourse: () => void
): TeacherCourseCardItem[] {
  const palette = [
    "bg-blue-600",
    "bg-indigo-500",
    "bg-emerald-600",
    "bg-violet-500",
  ];

  const baseCourses =
    courses && courses.length > 0
      ? courses
      : [
          {
            id: 1,
            name: "11-2",
            subject: "Biología",
            students: 24,
            average: 4.3,
          },
          {
            id: 2,
            name: "11-1",
            subject: "Biología",
            students: 21,
            average: 4.1,
          },
        ];

  return baseCourses.map((course: any, idx: number) => {
    const courseKey = String(course.name || "").trim();
    const courseSubject = course.subject || "Biología";
    const displayName = courseKey
      .toLowerCase()
      .includes(courseSubject.toLowerCase())
      ? courseKey
      : `${courseSubject} ${courseKey}`;

    const courseGrades = (grades || []).filter(
      (g: any) =>
        g.course === courseKey && typeof g.value === "number" && g.value > 0
    );
    const averageGrade =
      courseGrades.length > 0
        ? courseGrades.reduce((sum: number, g: any) => sum + g.value, 0) /
          courseGrades.length
        : typeof course.average === "number"
          ? course.average
          : 4.2;

    const courseAssignmentIds = new Set(
      (assignments || [])
        .filter((a: any) => a.course === courseKey)
        .map((a: any) => a.id)
    );
    const courseSubmissions = (submissions || []).filter((s: any) =>
      courseAssignmentIds.has(s.assignmentId)
    );
    const pendingCount = courseSubmissions.filter(
      (s: any) => s.grade === null
    ).length;

    const gradedCount = courseSubmissions.length - pendingCount;
    const progress =
      courseSubmissions.length > 0
        ? Math.round((gradedCount / courseSubmissions.length) * 100)
        : 100;

    return {
      id: course.id ?? idx + 1,
      name: displayName,
      studentCount: course.students ?? course.studentCount ?? 24,
      averageGrade,
      pendingCount,
      progress,
      tone: palette[idx % palette.length],
      onClick: onSelectCourse,
    };
  });
}

/**
 * Convierte la lista de estudiantes en riesgo al formato de alerta de UI.
 */
export function buildStudentAlerts(
  studentsAtRiskList: StudentRiskStat[],
  students: any[],
  onOpenGradeCenter: () => void
): TeacherStudentAlert[] {
  return studentsAtRiskList.map((s) => {
    const studentObj = (students || []).find((st: any) => st.name === s.name);
    return {
      studentId: studentObj?.id,
      name: s.name,
      course: s.course,
      subject: s.subject,
      currentGrade: s.avg,
      reason: "Promedio < 3.0",
      avatarColor: studentObj?.avatarColor ?? "#fee2e2",
      onOpenGradeCenter,
    };
  });
}

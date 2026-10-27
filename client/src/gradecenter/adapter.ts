import type { Dba, Dataset, Evaluation, EvaluationTypeId, GradeCommentMap, GradeMap, Student } from "./types";
import { gradeKey } from "./types";
import { createEmptyDataset } from "./data/emptyDataset";
import { computeDatasetMetrics, type GradebookAssignment } from "./domain/assignments";
import { queryCatalog } from "./data/dbaCatalog";
import { generateDbaDescriptors } from "./lib/descriptorGenerator";

/**
 * Adaptador de datos reales de EduCore Main para el módulo Grade Center Next.
 *
 * Transforma el contexto retornado por `trpc.gradeCenter.context` en el
 * modelo de dominio canónico `Dataset` de Grade Center, garantizando fidelidad
 * visual y funcional sin inventar datos ni alterar calificaciones.
 */
export function adaptEduCoreContextToDataset(context: any, user?: any): Dataset {
  if (!context || !context.selected || !context.selected.course) {
    return createEmptyDataset();
  }

  const course = context.selected.course;
  const subject = context.selected.subject ?? { name: "Materia General", id: 0 };
  const period = context.selected.period ?? { name: "Periodo 1", id: 0 };

  const courseName = course.name || "11-2";
  const subjectName = subject.name || "Matemáticas";
  const periodName = period.name || "Periodo 1";
  const yearName = String(course.year || new Date().getFullYear());

  const teacherName = course.teacherName || user?.name || "Docente Titular";
  const teacherInitials = teacherName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase() || "DT";

  // Mapeo ordenado de estudiantes
  const students: Student[] = (context.rows ?? []).map((row: any, index: number) => {
    const studentUser = row.student ?? {};
    const id = String(row.enrollment?.studentUserId ?? studentUser.id ?? index + 1);
    const fullName = (
      studentUser.name ||
      `${studentUser.firstName ?? ""} ${studentUser.lastName ?? ""}`.trim() ||
      `Estudiante ${index + 1}`
    ).trim();

    const parts = fullName.split(/\s+/);
    const firstName = studentUser.firstName || parts[0] || fullName;
    const lastName = studentUser.lastName || parts.slice(1).join(" ") || "";
    const code = studentUser.studentCode || String(id).padStart(4, "0");

    return {
      id,
      code,
      firstName,
      lastName,
      fullName,
      hue: (index * 37) % 360,
    };
  });

  // Mapeo de evaluaciones
  const validTypes: EvaluationTypeId[] = [
    "proyecto",
    "taller",
    "quiz",
    "examen",
    "exposicion",
    "participacion",
    "autoevaluacion",
  ];

  // Detección de grado y materia para precargar los DBAs oficiales del MEN correspondientes
  const gradeMatch = courseName.match(/^(\d{1,2})/);
  const inferredGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : 11;
  const subLower = subjectName.toLowerCase();
  const inferredSubject = subLower.includes("matem")
    ? "matematicas"
    : subLower.includes("lengua") || subLower.includes("español")
    ? "lenguaje"
    : "ciencias";

  const defaultDbas: Dba[] = queryCatalog(inferredGrade, inferredSubject).slice(0, 3).map((item) => ({
    id: item.id,
    code: item.code,
    title: item.title,
    statement: item.statement,
    dimension: item.dimension,
    evidences: item.evidences,
    grade: item.grade,
    subjectCode: item.subjectCode,
    descriptors: generateDbaDescriptors({
      title: item.title,
      statement: item.statement,
      evidences: item.evidences,
      dimension: item.dimension,
    }),
  }));

  const evaluations: Evaluation[] = (context.assessments ?? []).map((a: any, index: number) => {
    const id = String(a.id);
    const rawType = (a.assessmentType || "taller").toLowerCase();
    let type: EvaluationTypeId = "taller";
    if (validTypes.includes(rawType as EvaluationTypeId)) {
      type = rawType as EvaluationTypeId;
    } else if (rawType === "actividad") {
      type = "taller";
    } else if (rawType === "recuperacion") {
      type = "examen";
    }

    const dateStr = a.date
      ? new Date(a.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const title = a.title || `Evaluación ${index + 1}`;
    const shortName = title.length > 20 ? title.slice(0, 18) + "…" : title;

    // Asignación de DBA correspondiente a la evaluación
    const assignedDbaIds = a.dbaIds && a.dbaIds.length > 0
      ? a.dbaIds
      : defaultDbas.length > 0
      ? [defaultDbas[index % defaultDbas.length].id]
      : [];

    return {
      id,
      code: `E${index + 1}`,
      order: index,
      name: title,
      shortName,
      description: a.description || undefined,
      abbrev: title.slice(0, 4),
      type,
      weight: Number(a.weight ?? 0),
      date: dateStr,
      period: periodName,
      dbaIds: assignedDbaIds,
      status: a.status === "CLOSED" ? "active" : a.status === "DRAFT" ? "preparing" : "active",
    };
  });

  // Mapeo de notas y comentarios
  const grades: GradeMap = {};
  const comments: GradeCommentMap = {};

  for (const row of context.rows ?? []) {
    const studentId = String(row.enrollment?.studentUserId ?? row.student?.id);
    for (const val of row.values ?? []) {
      if (!val.assessment) continue;
      const evalId = String(val.assessment.id);
      const key = gradeKey(studentId, evalId);

      if (val.grade && val.grade.value !== null && val.grade.value !== undefined) {
        grades[key] = Number(val.grade.value);
      } else {
        grades[key] = null;
      }

      if (val.grade?.comment) {
        comments[key] = String(val.grade.comment);
      }
    }
  }

  return {
    key: `gc-${course.id}-${subject.id}-${period.id}`,
    academicYear: yearName,
    course: courseName,
    subject: subjectName,
    group: course.groupName || courseName,
    period: periodName,
    evaluationCount: evaluations.length,
    teacher: {
      name: teacherName,
      role: "Docente Titular",
      initials: teacherInitials,
    },
    dba: defaultDbas,
    students,
    evaluations,
    grades,
    comments,
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface RawAssignmentSummary {
  courseId: number;
  courseName: string;
  subjectId: number;
  subjectName: string;
  academicYear: string;
  periodId: number | null;
  periodName: string | null;
  periodClosed: boolean;
  students: number;
  evaluations: number;
  graded: number;
  total: number;
  average?: number | null;
  lastActivityAt?: Date | string | null;
  periodEndsAt?: Date | string | null;
}

/**
 * Genera la lista de asignaciones para la pantalla "Mis planillas" (LandingView)
 * a partir del resumen real por (curso × materia) del backend o del contexto actual.
 */
export function getAssignmentsFromContext(
  context: any,
  currentDataset: Dataset,
  summaries?: RawAssignmentSummary[],
): GradebookAssignment[] {
  const currentCourseId = context?.selected?.course?.id;
  const currentSubjectId = context?.selected?.subject?.id;

  if (summaries && summaries.length > 0) {
    return summaries.map((item) => {
      const isCurrent =
        item.courseId === currentCourseId &&
        item.subjectId === currentSubjectId &&
        currentDataset.key !== "gradecenter-empty";

      const id = `assignment-${item.courseId}-${item.subjectId}`;
      const timeline = {
        lastActivityAt: toDate(item.lastActivityAt),
        periodEndsAt: toDate(item.periodEndsAt),
      };

      if (isCurrent) {
        return {
          id,
          sourceDatasetKey: currentDataset.key,
          courseId: item.courseId,
          subjectId: item.subjectId,
          periodId: item.periodId,
          dataset: currentDataset,
          access: item.periodClosed ? "read" : "owner",
          status: item.periodClosed ? "closed" : "available",
          metrics: computeDatasetMetrics(currentDataset),
          ...timeline,
        };
      }

      const totalCells = Math.max(0, item.total);
      const gradedCells = Math.min(totalCells, Math.max(0, item.graded));
      const pendingCells = Math.max(0, totalCells - gradedCells);
      const progressPct = totalCells > 0 ? Math.min(100, Math.max(0, Math.round((gradedCells / totalCells) * 100))) : 0;

      return {
        id,
        sourceDatasetKey: id,
        courseId: item.courseId,
        subjectId: item.subjectId,
        periodId: item.periodId,
        dataset: {
          key: id,
          academicYear: item.academicYear,
          course: item.courseName,
          subject: item.subjectName,
          group: item.courseName,
          period: item.periodName || context?.selected?.period?.name || "Periodo 1",
          evaluationCount: item.evaluations,
          teacher: currentDataset.teacher,
          dba: [],
          students: [],
          evaluations: [],
          grades: {},
          comments: {},
        },
        access: item.periodClosed ? "read" : "owner",
        status: item.periodClosed ? "closed" : "available",
        metrics: {
          studentsCount: item.students,
          evaluationsCount: item.evaluations,
          gradedCells,
          totalCells,
          pendingCells,
          progressPct,
          average: item.average ?? null,
        },
        ...timeline,
      };
    });
  }

  if (!context || !context.courses || context.courses.length === 0) {
    return currentDataset.key === "gradecenter-empty" ? [] : [
      {
        id: currentDataset.key,
        sourceDatasetKey: currentDataset.key,
        dataset: currentDataset,
        access: "owner",
        status: "available",
        metrics: computeDatasetMetrics(currentDataset),
      },
    ];
  }

  const assignments: GradebookAssignment[] = [];

  for (const c of context.courses) {
    const isCurrent = c.id === currentCourseId;
    if (isCurrent && currentDataset.key !== "gradecenter-empty") {
      assignments.push({
        id: `course-${c.id}`,
        sourceDatasetKey: currentDataset.key,
        courseId: c.id,
        subjectId: currentSubjectId,
        dataset: currentDataset,
        access: "owner",
        status: "available",
        metrics: computeDatasetMetrics(currentDataset),
      });
    } else {
      const subjectName = context.subjects?.[0]?.name || "Matemáticas";
      const year = String(c.year || new Date().getFullYear());
      const periodName = context.selected?.period?.name || "Periodo 1";
      assignments.push({
        id: `course-${c.id}`,
        sourceDatasetKey: `course-${c.id}`,
        courseId: c.id,
        dataset: {
          key: `course-${c.id}`,
          academicYear: year,
          course: c.name,
          subject: subjectName,
          group: c.groupName || c.name,
          period: periodName,
          evaluationCount: 0,
          teacher: currentDataset.teacher,
          dba: [],
          students: [],
          evaluations: [],
          grades: {},
          comments: {},
        },
        access: "owner",
        status: "available",
        metrics: {
          studentsCount: Number(c.studentsCount ?? 0),
          evaluationsCount: 0,
          gradedCells: 0,
          totalCells: 0,
          pendingCells: 0,
          progressPct: 0,
          average: null,
        },
      });
    }
  }

  return assignments;
}

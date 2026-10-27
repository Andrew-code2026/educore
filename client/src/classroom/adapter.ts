import type {
  Activity,
  CourseSummary,
  RubricCriterion,
  Student,
} from './types';

export const emptyActivity: Activity = {
  id: '',
  name: '',
  type: 'Entrega de archivo',
  date: '',
  dueDate: '',
  submissions: 0,
  graded: 0,
  status: 'Borrador',
  affectsGradeCenter: true,
  accent: 'cyan',
  icon: 'clipboard',
  description: '',
  resourceCount: 0,
  formats: ['PDF', 'DOCX'],
  maxFiles: 1,
  maxSize: '25 MB',
  allowReplacement: true,
  allowResubmission: true,
};

export const emptyStudent: Student = {
  id: '',
  name: '',
  initials: '',
  group: '',
  status: 'No entregó',
  color: '#567083',
};

export const defaultRubric: RubricCriterion[] = [
  {
    id: 'analysis',
    title: 'Profundidad de análisis',
    description: 'Capacidad para relacionar conceptos clave con situaciones reales y evidencia concreta.',
    max: 20,
    score: 18,
    expanded: true,
  },
  {
    id: 'evidence',
    title: 'Calidad de la evidencia',
    description: 'Presentación ordenada, legible y completa de los entregables requeridos.',
    max: 20,
    score: 17,
  },
  {
    id: 'argumentation',
    title: 'Argumentación y síntesis',
    description: 'Claridad en la exposición de conclusiones y manejo del vocabulario técnico.',
    max: 10,
    score: 9,
  },
];

const STUDENT_COLORS = ['#64e8ff', '#a78bfa', '#fbbf6b', '#70e0b2', '#f88fb2', '#38bdf8', '#c084fc'];

function getInitials(name: string): string {
  if (!name) return 'ES';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateShort(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '28 Oct';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '28 Oct';
  const day = d.getDate();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${day} ${months[d.getMonth()]}`;
}

function formatDueFull(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '28 Oct · 23:59';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '28 Oct · 23:59';
  const shortDate = formatDateShort(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${shortDate} · ${hours}:${minutes}`;
}

/** Id estable de un curso del snapshot; compartido con la portada para enlazar tarjetas y vistas. */
export function courseKey(course: { id?: number | string | null; name: string }): string {
  return String(course.id ?? `course-${course.name}`);
}

export function adaptEduCoreCourses(data: any, academic?: any): CourseSummary[] {
  const rawCourses = data?.courses ?? academic?.courses ?? [];
  const assignments = data?.assignments ?? [];
  const submissions = data?.submissions ?? [];
  const students: any[] = data?.students ?? [];
  // Matriculados reales del curso; mismo criterio que la portada "Mis cursos"
  const enrolledIn = (courseName: string) => students.filter((s) => s?.course === courseName).length;

  if (!rawCourses || rawCourses.length === 0) {
    // If no course objects, check if assignments have distinct courses
    const uniqueCourseNames = Array.from(new Set(assignments.map((a: any) => a.course).filter(Boolean))) as string[];
    if (uniqueCourseNames.length > 0) {
      return uniqueCourseNames.map((name, index) => {
        const courseAssignments = assignments.filter((a: any) => a.course === name);
        const courseSubmissions = submissions.filter((s: any) =>
          courseAssignments.some((a: any) => a.id === s.assignmentId)
        );
        const reviewCount = courseSubmissions.filter((s: any) => s.grade === null || s.grade === undefined).length;
        const tones = ['science', 'biology', 'chemistry'];
        const tone = tones[index % tones.length];
        return {
          id: courseKey({ name }),
          code: `${name}-2026`,
          name: `Curso ${name}`,
          students: enrolledIn(name),
          active: courseAssignments.length,
          review: reviewCount,
          next: courseAssignments[0] ? formatDateShort(courseAssignments[0].dueAt) : '28 Oct',
          icon: index === 0 ? 'book' : index === 1 ? 'layers' : 'grid',
          tone,
          subject: courseAssignments[0]?.subject ?? 'Asignatura institucional',
        };
      });
    }
    return [];
  }

  const tones = ['science', 'biology', 'chemistry'];
  return rawCourses.map((c: any, index: number) => {
    const courseName = c.name;
    const courseAssignments = assignments.filter((a: any) => a.course === courseName);
    const courseSubmissions = submissions.filter((s: any) =>
      courseAssignments.some((a: any) => a.id === s.assignmentId)
    );
    const reviewCount = courseSubmissions.filter((s: any) => s.grade === null || s.grade === undefined).length;
    const tone = tones[index % tones.length];

    return {
      id: courseKey(c),
      code: c.code ?? `${courseName}-2026`,
      name: courseName.startsWith('Curso') ? courseName : `Curso ${courseName}`,
      students: enrolledIn(courseName) || Number(c.studentCount ?? c.studentsCount ?? 0),
      active: courseAssignments.length,
      review: reviewCount,
      next: courseAssignments[0] ? formatDateShort(courseAssignments[0].dueAt) : '28 Oct',
      icon: index === 0 ? 'book' : index === 1 ? 'layers' : 'grid',
      tone,
      subject: c.subject ?? (courseAssignments[0]?.subject ?? 'Asignatura institucional'),
    };
  });
}

export function adaptEduCoreActivities(data: any, selectedCourseName?: string): Activity[] {
  const rawAssignments = data?.assignments ?? [];
  const submissions = data?.submissions ?? [];

  // Igualdad exacta de grupo: con `includes`, "11-1" también coincidía con "11-12"; y un curso
  // sin actividades nunca debe mostrar las de otro curso
  const group = selectedCourseName?.replace(/^Curso\s*/i, '');
  const filtered = group
    ? rawAssignments.filter((a: any) => !a.course || a.course === group)
    : rawAssignments;

  return filtered.map((a: any, index: number) => formatActivity(a, submissions, index));
}

function formatActivity(a: any, submissions: any[], index: number): Activity {
  const taskSubmissions = submissions.filter((s: any) => s.assignmentId === a.id);
  const graded = taskSubmissions.filter((s: any) => s.grade !== null && s.grade !== undefined).length;
  const subsCount = taskSubmissions.length;
  const due = a.dueAt ? new Date(a.dueAt) : null;
  const dueAt = due && !Number.isNaN(due.getTime()) ? due : null;
  const isPast = dueAt ? dueAt.getTime() < Date.now() : false;

  // Una actividad vencida sin entregas pendientes está cerrada, aunque nadie haya entregado
  let status: Activity['status'];
  if (a.status === 'Borrador') {
    status = 'Borrador';
  } else if (!isPast) {
    status = 'En curso';
  } else if (subsCount > graded) {
    status = 'Por revisar';
  } else {
    status = 'Cerrada';
  }

  const accents = ['cyan', 'violet', 'mint', 'amber'];
  const accent = accents[index % accents.length];
  const date = formatDateShort(a.dueAt);
  const dueDate = formatDueFull(a.dueAt);

  return {
    id: String(a.id),
    name: a.title,
    type: 'Entrega de archivo',
    date,
    dueDate,
    dueAt: dueAt?.toISOString(),
    submissions: subsCount,
    graded,
    status,
    weight: a.points ? `${Math.round(a.points / 5)}%` : '20%',
    affectsGradeCenter: true,
    accent,
    icon: index === 0 ? 'clipboard' : index === 1 ? 'layers' : 'chart',
    description: a.description || 'Actividad académica con entrega digital.',
    resourceCount: 1,
    formats: ['PDF', 'DOCX', 'ZIP'],
    maxFiles: 2,
    maxSize: '25 MB',
    allowReplacement: true,
    allowResubmission: true,
    subject: a.subject,
    course: a.course,
    points: a.points,
    teacherName: a.teacherName,
  };
}

export function adaptEduCoreStudents(
  data: any,
  activityId?: string,
  selectedCourseName?: string
): Student[] {
  const rawStudents = data?.students ?? [];
  const submissions = data?.submissions ?? [];
  const targetAssignmentId = activityId ? Number(activityId) : undefined;
  // El curso llega como "Curso 11-2" y los estudiantes traen solo "11-2"
  const group = selectedCourseName?.replace(/^Curso\s*/i, '');
  const roster = group ? rawStudents.filter((s: any) => s?.course === group) : rawStudents;

  // Filter submissions for this assignment
  const assignmentSubmissions = targetAssignmentId
    ? submissions.filter((s: any) => s.assignmentId === targetAssignmentId)
    : submissions;

  // Derive students from rawStudents or from submissions
  const studentsList: Student[] = [];
  const processedNames = new Set<string>();

  // 1. Process students who made submissions
  for (let i = 0; i < assignmentSubmissions.length; i++) {
    const sub = assignmentSubmissions[i];
    const name = sub.studentName;
    if (!name || processedNames.has(name)) continue;
    processedNames.add(name);

    const isGraded = sub.grade !== null && sub.grade !== undefined;
    const color = STUDENT_COLORS[studentsList.length % STUDENT_COLORS.length];
    const fileName = sub.fileName || 'entrega-actividad.pdf';
    const ext = fileName.split('.').pop()?.toUpperCase() ?? 'PDF';

    studentsList.push({
      id: `student-sub-${sub.id || i}`,
      name,
      initials: getInitials(name),
      group: selectedCourseName || sub.course || '11-2',
      status: isGraded ? 'Calificada' : 'Por revisar',
      score: isGraded ? Number(sub.grade) : undefined,
      time: sub.submittedAt ? formatDateShort(sub.submittedAt) : undefined,
      submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toISOString() : undefined,
      file: fileName,
      fileType: ext,
      color,
      submissionId: sub.id,
      comment: sub.comment,
    });
  }

  // 2. Matriculados del curso que aún no han entregado
  for (let i = 0; i < roster.length; i++) {
    const st = roster[i];
    const name = st.name || st.user?.name;
    if (!name || processedNames.has(name)) continue;
    processedNames.add(name);

    const color = STUDENT_COLORS[studentsList.length % STUDENT_COLORS.length];
    studentsList.push({
      id: `student-${st.id || st.userId || i}`,
      name,
      initials: getInitials(name),
      group: selectedCourseName || st.course || '11-2',
      status: 'No entregó',
      color,
    });
  }

  return studentsList;
}

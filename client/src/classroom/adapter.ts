import type {
  Activity,
  CourseSummary,
  Resource,
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

export const defaultResources: Resource[] = [
  {
    title: 'Guía de laboratorio y rúbrica de evaluación',
    type: 'Guía PDF',
    meta: '2.4 MB · Actualizado hace 3 días',
    used: 'Taller de derivadas',
    icon: '▤',
    color: 'cyan',
  },
  {
    title: 'Rúbrica institucional para entrega digital',
    type: 'Rúbrica PDF',
    meta: '1.1 MB · Vigente ciclo 2026',
    used: 'Todas las actividades',
    icon: '✦',
    color: 'violet',
  },
  {
    title: 'Plantilla de reporte experimental',
    type: 'Documento DOCX',
    meta: '850 KB · Formato estándar',
    used: 'Actividad de física',
    icon: '↗',
    color: 'mint',
  },
  {
    title: 'Formatos de entrega y citación APA 7',
    type: 'Guía de estilo',
    meta: '620 KB · Biblioteca institucional',
    used: 'Proyectos académicos',
    icon: '◇',
    color: 'amber',
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
          students: 32,
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
      students: c.studentCount ?? 32,
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

  const filtered = selectedCourseName
    ? rawAssignments.filter(
        (a: any) =>
          !a.course ||
          a.course === selectedCourseName ||
          selectedCourseName.includes(a.course) ||
          a.course.includes(selectedCourseName)
      )
    : rawAssignments;

  if (filtered.length === 0 && rawAssignments.length > 0) {
    // Fall back to all if course filter produced 0
    return rawAssignments.map((a: any, index: number) => formatActivity(a, submissions, index));
  }

  return filtered.map((a: any, index: number) => formatActivity(a, submissions, index));
}

function formatActivity(a: any, submissions: any[], index: number): Activity {
  const taskSubmissions = submissions.filter((s: any) => s.assignmentId === a.id);
  const graded = taskSubmissions.filter((s: any) => s.grade !== null && s.grade !== undefined).length;
  const subsCount = taskSubmissions.length;
  const isPast = a.dueAt ? new Date(a.dueAt).getTime() < Date.now() : false;

  let status: Activity['status'] = 'Publicada';
  if (a.status === 'Borrador') {
    status = 'Borrador';
  } else if (isPast && subsCount > graded) {
    status = 'Por revisar';
  } else if (isPast && graded >= subsCount && subsCount > 0) {
    status = 'Cerrada';
  } else if (!isPast) {
    status = 'En curso';
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
      time: sub.submittedAt ? formatDateShort(sub.submittedAt) : 'recientemente',
      file: fileName,
      fileType: ext,
      fileSize: '2.4 MB',
      color,
      submissionId: sub.id,
      comment: sub.comment,
    });
  }

  // 2. Process enrolled students who may not have submitted yet
  for (let i = 0; i < rawStudents.length; i++) {
    const st = rawStudents[i];
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

  // If we have fewer than 5 students in mock/preview, supply a few enrolled students so split-view is rich
  if (studentsList.length === 0) {
    const fallbackNames = [
      'Sofía Martínez',
      'Alejandro Torres',
      'Camila Morales',
      'Sebastián Restrepo',
      'Valentina Gómez',
    ];
    fallbackNames.forEach((name, idx) => {
      studentsList.push({
        id: `fallback-student-${idx}`,
        name,
        initials: getInitials(name),
        group: selectedCourseName || '11-2',
        status: idx === 0 ? 'Calificada' : idx < 3 ? 'Por revisar' : 'No entregó',
        score: idx === 0 ? 4.5 : undefined,
        file: idx < 3 ? `taller-derivadas-${idx + 1}.pdf` : undefined,
        fileType: 'PDF',
        fileSize: '2.1 MB',
        time: 'hace 2 horas',
        color: STUDENT_COLORS[idx % STUDENT_COLORS.length],
      });
    });
  }

  return studentsList;
}

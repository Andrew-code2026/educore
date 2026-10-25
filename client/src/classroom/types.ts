export type ActivityStatus = 'Borrador' | 'Publicada' | 'En curso' | 'Por revisar' | 'Cerrada' | 'Próxima';
export type ActivityType = 'Entrega de archivo' | 'Entrega de enlace' | 'Entrega multimedia';
export type SubmissionStatus = 'Entregada' | 'No entregó' | 'Por revisar' | 'Calificada';
export type ViewKey = 'home' | 'overview' | 'activities' | 'submissions' | 'resources';

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  date: string;
  dueDate: string;
  /** Fecha límite en ISO; base para ordenar y calcular días restantes. */
  dueAt?: string;
  submissions: number;
  graded: number;
  status: ActivityStatus;
  weight?: string;
  affectsGradeCenter: boolean;
  accent: string;
  icon: string;
  description: string;
  resourceCount: number;
  formats: string[];
  maxFiles: number;
  maxSize: string;
  allowReplacement: boolean;
  allowResubmission: boolean;
  subject?: string;
  course?: string;
  points?: number;
  teacherName?: string;
}

export interface Student {
  id: string;
  name: string;
  initials: string;
  group: string;
  status: SubmissionStatus;
  score?: number;
  time?: string;
  /** Momento de la entrega en ISO. */
  submittedAt?: string;
  file?: string;
  fileType?: string;
  fileSize?: string;
  color: string;
  submissionId?: number;
  comment?: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  max: number;
  score: number;
  expanded?: boolean;
}

export interface CourseSummary {
  id: string;
  code: string;
  name: string;
  students: number;
  active: number;
  review: number;
  next: string;
  icon: string;
  tone: string;
  subject?: string;
}

export interface Resource {
  id?: string;
  title: string;
  type: string;
  meta: string;
  used: string;
  icon: string;
  color: string;
  url?: string;
}

export interface ReviewRecord {
  score?: number;
  scoreMode: 'rubric' | 'manual';
  evaluationMode: 'rubric' | 'direct';
  criteria: RubricCriterion[];
  /** Retroalimentación del docente para el estudiante. */
  feedback: string;
  status: SubmissionStatus;
}

export interface Draft {
  name: string;
  description: string;
  due: string;
  publish: string;
  maxFiles: number;
  maxSize: string;
  formats: string[];
  graded: boolean;
  gradeCenter: boolean;
  weight: string;
  allowReplacement: boolean;
  allowResubmission: boolean;
  subject?: string;
  course?: string;
  scale?: string;
}

export interface Upload {
  name: string;
  format: string;
  size: string;
  progress: number;
}

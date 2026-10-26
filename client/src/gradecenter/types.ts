/**
 * Modelo de dominio del Grade Center Next.
 *
 * Una sola fuente de verdad alimenta la matriz, las seis vistas y todo el
 * análisis contextual. Ninguna vista posee datos propios.
 */

export type ViewId = "standard" | "compact" | "student" | "evaluations" | "performance" | "dba";

export type Density = "compact" | "standard" | "cozy";

export type LevelId = "bajo" | "basico" | "alto" | "superior";

export type EvaluationTypeId =
  | "proyecto"
  | "taller"
  | "quiz"
  | "examen"
  | "exposicion"
  | "participacion"
  | "autoevaluacion";

export type EvaluationStatus = "preparing" | "active";

export interface EvaluationTypeMeta {
  id: EvaluationTypeId;
  label: string;
  short: string;
  abbrev: string;
}

export interface DbaDescriptorSet {
  superior: string;
  alto: string;
  basico: string;
  bajo: string;
}

/** Derecho Básico de Aprendizaje: agrupa evidencias de varias evaluaciones. */
export interface Dba {
  id: string;
  code: string;
  title: string;
  statement: string;
  dimension?: "cognitivo" | "procedimental" | "actitudinal";
  descriptors?: DbaDescriptorSet;
  evidences?: string[];
  grade?: number;
  subjectCode?: string;
}

export interface Evaluation {
  id: string;
  /** Código corto visible: E1, E2, … */
  code: string;
  /** Posición dentro del periodo (0-based). */
  order: number;
  name: string;
  shortName: string;
  description?: string;
  abbrev: string;
  type: EvaluationTypeId;
  /** Peso porcentual sobre la definitiva. */
  weight: number;
  /** Fecha de aplicación (ISO yyyy-mm-dd). */
  date: string;
  period: string;
  dbaIds: string[];
  /** Estado operativo; los datasets anteriores se interpretan como activos. */
  status?: EvaluationStatus;
}

export interface Student {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Tono de avatar derivado del índice. */
  hue: number;
}

export type GradeValue = number | null;

/** Clave compuesta `studentId::evaluationId`. */
export type GradeMap = Record<string, GradeValue>;
export type GradeCommentMap = Record<string, string>;

export interface Dataset {
  key: string;
  academicYear: string;
  course: string;
  subject: string;
  group: string;
  period: string;
  evaluationCount: number;
  teacher: { name: string; role: string; initials: string };
  dba: Dba[];
  students: Student[];
  evaluations: Evaluation[];
  grades: GradeMap;
  comments: GradeCommentMap;
}

export const gradeKey = (studentId: string, evaluationId: string) => `${studentId}::${evaluationId}`;

/* -------------------------------------------------------------------------- */
/* Vistas, densidad y preferencias                                            */
/* -------------------------------------------------------------------------- */

export type SortKey = "name" | "definitiva" | "performance" | "pending" | "attention";

export interface SortSpec {
  key: SortKey;
  dir: "asc" | "desc";
}

export type EvaluationFilterState = "pending" | "graded";

export interface Filters {
  query: string;
  levels: LevelId[];
  onlyPending: boolean;
  onlyAttention: boolean;
  onlyComplete: boolean;
  /** Filtro por evaluación concreta. */
  evaluationId: string | null;
  evaluationState: EvaluationFilterState | null;
}

export interface Preferences {
  view: ViewId;
  density: Density;
  columnWidths: Record<string, number>;
  studentColWidth: number;
  definitivaColWidth: number;
  hiddenEvaluations: string[];
  sort: SortSpec;
  filters: Filters;
  focusMode: boolean;
  analysisOpen: boolean;
  showCodes: boolean;
  /** Un clic entra directamente al editor inline en lugar de abrir el popover. */
  quickEdit: boolean;
}

/* -------------------------------------------------------------------------- */
/* Autosave                                                                   */
/* -------------------------------------------------------------------------- */

export type SyncStatus = "idle" | "pending" | "saving" | "saved" | "synced" | "error";

export interface SyncState {
  status: SyncStatus;
  /** Cambios locales aún no confirmados por el snapshot persistente. */
  pending: number;
  lastSyncedAt: number | null;
  retries: number;
  lastError: string | null;
}

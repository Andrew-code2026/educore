/**
 * Tipos del módulo Panel de Asistencia.
 *
 * Este archivo no depende de nada del proyecto anfitrión (EduCore); los datos y
 * callbacks se inyectan desde el consumidor del módulo.
 */

/** Estados posibles de un registro de asistencia. */
export type AttendanceStatus = "present" | "absent" | "late" | "excuse" | "pending";

/** Un registro histórico de asistencia (una jornada). */
export interface AttendanceRecord {
  /** Fecha en formato ISO `YYYY-MM-DD`. */
  date: string;
  status: AttendanceStatus;
}

/** Estudiante dentro de un curso. */
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Iniciales usadas por el avatar (no se usan fotografías). */
  initials: string;
  /** Grupo visible: "9°A". */
  group: string;
  courseId: string;
  /** Jornadas anteriores a hoy, de más antigua a más reciente. */
  history: AttendanceRecord[];
  /** Excusas cargadas por el acudiente y aún no revisadas. */
  pendingExcuses: number;
  /** Solicitudes de justificación pendientes de respuesta. */
  pendingRequests: number;
  guardian?: string;
}

/** Curso / clase programada. */
export interface Course {
  id: string;
  /** Nombre corto del grupo: "9°A". */
  name: string;
  grade: string;
  subject: string;
  room: string;
  /** Días de clase: 0 = domingo … 6 = sábado. */
  classDays: number[];
  /** Hora de inicio `HH:mm`. */
  start: string;
  /** Hora de fin `HH:mm`. */
  end: string;
  students: Student[];
}

/** Mapa de estados de la jornada activa: id de estudiante → estado. */
export type SessionStatuses = Record<string, AttendanceStatus>;

/** Motivo por el que un estudiante entra en "Atención docente". */
export type AttentionKind =
  | "consecutive_absences"
  | "low_attendance"
  | "late_pattern"
  | "pending_excuse";

/** Señal de atención docente derivada del histórico. */
export interface AttentionFlag {
  studentId: string;
  kind: AttentionKind;
  /** Motivo corto y legible: "3 ausencias consecutivas". */
  label: string;
  /** Detalle secundario: "86% asistencia". */
  detail: string;
  /** Severidad para el color del indicador. */
  severity: "high" | "medium" | "low";
  /** Peso para ordenar el panel (mayor = más urgente). */
  weight: number;
}

/** Filtros disponibles en la planilla. */
export type AttendanceFilter =
  | "all"
  | "pending"
  | "absent"
  | "late"
  | "excuse"
  | "attention";

/** Métricas compactas de la jornada. */
export interface DayMetrics {
  present: number;
  absent: number;
  late: number;
  excuse: number;
  pending: number;
  total: number;
  /** % de asistencia sobre lo ya registrado (presentes + tardanzas). */
  attendanceRate: number;
}

/** Resumen individual usado por el popover y la vista de resumen docente. */
export interface StudentStats {
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excuse: number;
  /** % de asistencia del periodo; null cuando no hay registros calculables. */
  attendanceRate: number | null;
  /** Variación en puntos porcentuales frente al periodo anterior. */
  trendDelta: number;
  trend: "up" | "down" | "stable";
  /** Últimas jornadas (más antigua → más reciente), incluida la de hoy. */
  recent: AttendanceRecord[];
}

/** Estado del ciclo de autosave o de una sesión sin persistencia conectada. */
export type SyncState = "idle" | "local" | "saving" | "saved" | "error";

/** Acción reversible registrada en la pila de deshacer. */
export interface UndoAction {
  id: string;
  label: string;
  changes: Array<{ studentId: string; from: AttendanceStatus; to: AttendanceStatus }>;
  at: number;
}

/**
 * Código y canales de contacto que el host puede inyectar al Resumen.
 * No reemplaza ni extiende el contrato de persistencia del estudiante.
 */
export interface StudentSummaryFamilyProfile {
  studentCode?: string;
  guardianPhone?: string;
  guardianEmail?: string;
}

/** Props públicas del panel: así se conecta al proyecto principal. */
export interface AttendancePanelProps {
  courses: Course[];
  initialCourseId?: string;
  /** Fecha inicial en formato ISO `YYYY-MM-DD` (por defecto, hoy). */
  initialDate?: string;
  /** Registros ya guardados de la jornada abierta (id de estudiante → estado). */
  initialStatuses?: SessionStatuses;
  /** Filtro con el que abre la planilla (por defecto, todos). */
  initialFilter?: AttendanceFilter;
  /** Si se provee, delega al expediente completo del host; si se omite, muestra el resumen docente local. */
  onOpenExpediente?: (student: Student) => void;
  /** Abre el historial existente del host; sin callback, la acción queda deshabilitada. */
  onOpenHistory?: (student: Student) => void;
  /** Abre el seguimiento existente del host; sin callback, la acción queda deshabilitada. */
  onOpenFollowUp?: (student: Student) => void;
  /** Lectura opcional del perfil personal/familiar existente; es solo visual y síncrona. */
  getStudentSummaryProfile?: (student: Student) => StudentSummaryFamilyProfile | undefined;
  /** Punto de integración con la persistencia real (autosave). */
  onPersist?: (payload: {
    courseId: string;
    date: string;
    statuses: SessionStatuses;
  }) => Promise<void>;
  /** Cambia internamente de la planilla al selector de cursos. */
  onBackToCourses?: () => void;
  /** Notifica al host para apartar temporalmente su navegación durante la concentración. */
  onFocusModeChange?: (active: boolean) => void;
  className?: string;
}

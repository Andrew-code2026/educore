/**
 * Quién mira las páginas del portal: el propio estudiante o su acudiente (con el hijo elegido).
 * Las páginas de notas y asistencia son las mismas; cambian la consulta y los textos.
 */
import { firstName } from "./format";

export interface ViewerChild {
  id: number;
  name: string;
  courseName: string | null;
}

export type Viewer =
  | { kind: "student" }
  | { kind: "guardian"; child: ViewerChild; guardianName: string };

export type Audience = Viewer["kind"];

export const STUDENT_VIEWER: Viewer = { kind: "student" };

/** Entrada común de las consultas del portal: el servidor valida que el hijo esté vinculado. */
export function viewerQuery(viewer: Viewer): { role: Audience; studentUserId?: number } {
  return viewer.kind === "guardian" ? { role: "guardian", studentUserId: viewer.child.id } : { role: "student" };
}

/** Los datos en caché pertenecen a este lector (al cambiar de hijo no se muestran los del anterior). */
export function belongsToViewer(viewer: Viewer, studentId: number | undefined): boolean {
  return viewer.kind === "student" || studentId === viewer.child.id;
}

export interface PortalCopy {
  grades: { title: string; lede: string; loading: string; error: string; emptyNote: string; reportBack: string; reportError: string; reportEmpty: string };
  attendance: {
    title: string;
    lede: string;
    loading: string;
    error: string;
    daysEmptyNote: string;
    pendingOne: (date: string) => string;
    pendingMany: (count: number) => string;
    pendingNote: string;
    excusesTitle: string;
    excusesEmpty: string;
    excusesEmptyNote: string;
  };
  justify: { describeLabel: string; placeholder: string; tooShort: string; sent: string };
  noEvaluations: string;
}

const STUDENT_COPY: PortalCopy = {
  grades: {
    title: "Mis calificaciones",
    lede: "Tu desempeño por materia, cada evaluación y lo que necesitas para aprobar.",
    loading: "Cargando tus calificaciones",
    error: "No pudimos cargar tus calificaciones",
    emptyNote: "Cuando tus docentes registren evaluaciones, verás aquí tus notas por materia.",
    reportBack: "Mis calificaciones",
    reportError: "No pudimos cargar tu boletín",
    reportEmpty: "Tu boletín aún no está disponible",
  },
  attendance: {
    title: "Mi asistencia",
    lede: "Tu registro diario y las excusas que has enviado. Justifica cada ausencia lo antes posible.",
    loading: "Cargando tu asistencia",
    error: "No pudimos cargar tu asistencia",
    daysEmptyNote: "Tus docentes registran la asistencia en cada clase; aquí verás cada día.",
    pendingOne: date => `Tienes una ausencia sin justificar: ${date}`,
    pendingMany: count => `Tienes ${count} ausencias sin justificar`,
    pendingNote: "Envía la excusa con un soporte para que coordinación la revise.",
    excusesTitle: "Mis excusas",
    excusesEmpty: "No has enviado excusas",
    excusesEmptyNote: "Cuando justifiques una ausencia, verás aquí su estado.",
  },
  justify: {
    describeLabel: "Cuéntanos qué pasó",
    placeholder: "Por ejemplo: tuve cita médica en la mañana; adjunto la constancia.",
    tooShort: "Cuéntanos el motivo en al menos 10 caracteres.",
    sent: "Enviaste la excusa. Coordinación la revisará.",
  },
  noEvaluations: "Tu docente aún no ha publicado evaluaciones en esta materia.",
};

/** Al acudiente se le habla de usted y en tercera persona sobre el estudiante. */
function guardianCopy(child: ViewerChild): PortalCopy {
  const name = firstName(child.name) || "el estudiante";
  return {
    grades: {
      title: "Calificaciones",
      lede: `El desempeño de ${name} por materia, cada evaluación y lo que necesita para aprobar.`,
      loading: `Cargando las calificaciones de ${name}`,
      error: `No pudimos cargar las calificaciones de ${name}`,
      emptyNote: `Cuando los docentes registren evaluaciones, verá aquí las notas de ${name} por materia.`,
      reportBack: "Calificaciones",
      reportError: `No pudimos cargar el boletín de ${name}`,
      reportEmpty: `El boletín de ${name} aún no está disponible`,
    },
    attendance: {
      title: "Asistencia",
      lede: `El registro diario de ${name} y las excusas enviadas. Justifique cada ausencia lo antes posible.`,
      loading: `Cargando la asistencia de ${name}`,
      error: `No pudimos cargar la asistencia de ${name}`,
      daysEmptyNote: `Los docentes registran la asistencia en cada clase; aquí verá cada día de ${name}.`,
      pendingOne: date => `${name} tiene una ausencia sin justificar: ${date}`,
      pendingMany: count => `${name} tiene ${count} ausencias sin justificar`,
      pendingNote: "Envíe la excusa con un soporte para que coordinación la revise.",
      excusesTitle: "Excusas",
      excusesEmpty: "No hay excusas enviadas",
      excusesEmptyNote: "Cuando justifique una ausencia, verá aquí su estado.",
    },
    justify: {
      describeLabel: "Describa el motivo",
      placeholder: `Por ejemplo: ${name} tuvo cita médica en la mañana; adjunto la constancia.`,
      tooShort: "Describa el motivo en al menos 10 caracteres.",
      sent: `Envió la excusa de ${name}. Coordinación la revisará.`,
    },
    noEvaluations: "El docente aún no ha publicado evaluaciones en esta materia.",
  };
}

export function viewerCopy(viewer: Viewer): PortalCopy {
  return viewer.kind === "guardian" ? guardianCopy(viewer.child) : STUDENT_COPY;
}

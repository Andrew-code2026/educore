/**
 * Dataset demo del MVP estudiante: completa el plan de estudios de 11° alrededor de Biología.
 *
 * - 5 materias más (con su docente) en 11-1 y 11-2, tres evaluaciones por periodo y notas
 *   para los 40 estudiantes en los periodos cerrados y en el activo.
 * - Biología recibe su historial de los periodos cerrados; su periodo activo sigue saliendo de
 *   `demoSeed.ts` para no tocar el MVP docente.
 * - Sofía Martínez (11-2, login demo del estudiante) tiene una historia diseñada: sube de 3.9 a 4.2,
 *   Lengua en Superior, Química por debajo del umbral con un informe vencido, un taller de
 *   Matemáticas que vence mañana y un writing de Inglés entregado sin calificar.
 *
 * Todo es determinista (sin Math.random) para que el seed sea reproducible.
 */
import { DEMO_STUDENTS, type DemoCourseName, type DemoStudent, demoStudentAverage, demoStudentName } from "./demoSeed";

export type PortalAssessmentType = "QUIZ" | "TALLER" | "EXAMEN" | "PROYECTO";

export interface PortalTeacher {
  openId: string;
  firstName: string;
  lastName: string;
  email: string;
  specialty: string;
}

export interface PortalActivity {
  title: string;
  type: PortalAssessmentType;
  weight: number;
  description: string;
  /** Solo periodo activo: días desde hoy hasta la fecha de entrega. */
  dueInDays: number;
}

export interface PortalSubject {
  key: "MAT" | "LEN" | "ING" | "QUI" | "SOC";
  name: string;
  code: string;
  description: string;
  teacher: PortalTeacher;
  /** Desfase sobre el nivel base del estudiante: unas materias le cuestan más que otras. */
  offset: number;
  /** Títulos de las tres evaluaciones de cada periodo cerrado (Periodo 1–3). */
  history: [string, PortalAssessmentType][][];
  /** Las tres actividades del periodo activo, que también son las actividades del aula. */
  current: PortalActivity[];
}

/** Docente de Lengua: ya existe en el seed de identidad (educore-demo-teacher-2). */
const ANDRES_MOLINA: PortalTeacher = {
  openId: "educore-demo-teacher-2",
  firstName: "Andrés",
  lastName: "Molina",
  email: "andres.molina@demo.educore.co",
  specialty: "Lengua Castellana",
};

export const PORTAL_SUBJECTS: PortalSubject[] = [
  {
    key: "MAT",
    name: "Matemáticas",
    code: "MAT",
    description: "Cálculo diferencial, funciones y razonamiento cuantitativo.",
    teacher: { openId: "educore-demo-teacher-3", firstName: "Ricardo", lastName: "Salamanca", email: "ricardo.salamanca@demo.educore.co", specialty: "Matemáticas" },
    offset: -0.3,
    history: [
      [["Quiz: funciones y dominio", "QUIZ"], ["Taller: funciones exponenciales", "TALLER"], ["Examen: funciones y gráficas", "EXAMEN"]],
      [["Quiz: sucesiones", "QUIZ"], ["Taller: trigonometría aplicada", "TALLER"], ["Examen: identidades trigonométricas", "EXAMEN"]],
      [["Quiz: noción de límite", "QUIZ"], ["Taller: límites al infinito", "TALLER"], ["Examen: límites y asíntotas", "EXAMEN"]],
    ],
    current: [
      { title: "Quiz: límites y continuidad", type: "QUIZ", weight: 30, dueInDays: -15, description: "Quiz individual sobre límites laterales, continuidad y tipos de discontinuidad." },
      { title: "Taller: reglas de derivación", type: "TALLER", weight: 30, dueInDays: -6, description: "Resuelve los 15 ejercicios de derivadas con regla de la cadena, producto y cociente. Muestra el procedimiento." },
      { title: "Taller: problemas de optimización", type: "PROYECTO", weight: 40, dueInDays: 1, description: "Plantea y resuelve los cuatro problemas de optimización de la guía. Entrega en PDF con el modelo, la derivada y la verificación de cada máximo o mínimo." },
    ],
  },
  {
    key: "LEN",
    name: "Lengua Castellana",
    code: "LEN",
    description: "Lectura crítica, producción textual y literatura latinoamericana.",
    teacher: ANDRES_MOLINA,
    offset: 0.25,
    history: [
      [["Quiz: tipologías textuales", "QUIZ"], ["Taller: el texto argumentativo", "TALLER"], ["Ensayo: la ciudad que habito", "PROYECTO"]],
      [["Quiz: figuras literarias", "QUIZ"], ["Taller: poesía de vanguardia", "TALLER"], ["Reseña crítica: Cien años de soledad", "PROYECTO"]],
      [["Quiz: falacias argumentativas", "QUIZ"], ["Taller: lectura inferencial", "TALLER"], ["Foro: medios y verdad", "PROYECTO"]],
    ],
    current: [
      { title: "Ensayo argumentativo: el poder de la palabra", type: "PROYECTO", weight: 30, dueInDays: -17, description: "Ensayo de dos páginas con tesis, tres argumentos y contraargumento. Cita al menos dos fuentes." },
      { title: "Exposición: el realismo mágico", type: "TALLER", weight: 30, dueInDays: -9, description: "Exposición grupal de 10 minutos sobre un autor del realismo mágico y una de sus obras." },
      { title: "Control de lectura crítica: Crónica de una muerte anunciada", type: "EXAMEN", weight: 40, dueInDays: 5, description: "Control escrito en clase sobre la novela completa: narrador, tiempo y responsabilidad colectiva. Trae la obra leída." },
    ],
  },
  {
    key: "ING",
    name: "Inglés",
    code: "ING",
    description: "Comprensión, producción oral y escrita en nivel B1.",
    teacher: { openId: "educore-demo-teacher-4", firstName: "Catherine", lastName: "Bello", email: "catherine.bello@demo.educore.co", specialty: "Inglés" },
    offset: 0.05,
    history: [
      [["Quiz: present perfect", "QUIZ"], ["Reading workshop: unit 1", "TALLER"], ["Speaking test: my community", "EXAMEN"]],
      [["Quiz: conditionals", "QUIZ"], ["Writing: formal email", "TALLER"], ["Listening test: units 2–3", "EXAMEN"]],
      [["Quiz: passive voice", "QUIZ"], ["Reading workshop: unit 4", "TALLER"], ["Project: podcast episode", "PROYECTO"]],
    ],
    current: [
      { title: "Listening quiz: unit 5", type: "QUIZ", weight: 30, dueInDays: -14, description: "Listening comprehension quiz based on the unit 5 audio tracks." },
      { title: "Writing: opinion essay", type: "TALLER", weight: 30, dueInDays: -2, description: "Write a 250-word opinion essay about social media and teenagers. Use linking words and a clear conclusion." },
      { title: "Oral presentation: future plans", type: "PROYECTO", weight: 40, dueInDays: 9, description: "Five-minute presentation about your plans after school. Upload your slides before class." },
    ],
  },
  {
    key: "QUI",
    name: "Química",
    code: "QUI",
    description: "Estequiometría, soluciones y química orgánica básica.",
    teacher: { openId: "educore-demo-teacher-5", firstName: "Hernando", lastName: "Vélez", email: "hernando.velez@demo.educore.co", specialty: "Química" },
    offset: -0.45,
    history: [
      [["Quiz: tabla periódica", "QUIZ"], ["Taller: enlaces químicos", "TALLER"], ["Examen: nomenclatura inorgánica", "EXAMEN"]],
      [["Quiz: reacciones químicas", "QUIZ"], ["Laboratorio: tipos de reacción", "TALLER"], ["Examen: balanceo de ecuaciones", "EXAMEN"]],
      [["Quiz: mol y masa molar", "QUIZ"], ["Taller: gases ideales", "TALLER"], ["Examen: leyes de los gases", "EXAMEN"]],
    ],
    current: [
      { title: "Quiz: estequiometría", type: "QUIZ", weight: 30, dueInDays: -16, description: "Quiz sobre reactivo límite, rendimiento y relaciones molares." },
      { title: "Laboratorio: preparación de soluciones", type: "TALLER", weight: 30, dueInDays: -10, description: "Práctica de laboratorio: prepara soluciones de concentración conocida y registra los datos en la bitácora." },
      { title: "Informe de laboratorio: concentración de soluciones", type: "PROYECTO", weight: 40, dueInDays: -1, description: "Informe con los cálculos de molaridad y porcentaje, el análisis de error y las conclusiones de la práctica. Entrega en PDF." },
    ],
  },
  {
    key: "SOC",
    name: "Ciencias Sociales",
    code: "SOC",
    description: "Historia de Colombia, economía y participación ciudadana.",
    teacher: { openId: "educore-demo-teacher-6", firstName: "Lucía", lastName: "Ferrer", email: "lucia.ferrer@demo.educore.co", specialty: "Ciencias Sociales" },
    offset: 0.1,
    history: [
      [["Quiz: independencia de Colombia", "QUIZ"], ["Taller: la Constitución de 1886", "TALLER"], ["Ensayo: siglo XIX en Colombia", "PROYECTO"]],
      [["Quiz: la Violencia", "QUIZ"], ["Taller: el bogotazo", "TALLER"], ["Examen: Colombia 1930–1958", "EXAMEN"]],
      [["Quiz: Constitución de 1991", "QUIZ"], ["Taller: mecanismos de participación", "TALLER"], ["Proyecto: derechos fundamentales", "PROYECTO"]],
    ],
    current: [
      { title: "Debate: modelos económicos en Colombia", type: "TALLER", weight: 30, dueInDays: -13, description: "Debate por equipos sobre apertura económica y proteccionismo. Prepara tres argumentos con datos." },
      { title: "Mapa conceptual: el Frente Nacional", type: "TALLER", weight: 30, dueInDays: -5, description: "Mapa conceptual sobre causas, acuerdos y consecuencias del Frente Nacional." },
      { title: "Proyecto final: memoria histórica", type: "PROYECTO", weight: 40, dueInDays: 12, description: "Investigación en parejas sobre un hecho de memoria histórica de tu región. Entrega el documento y sustenta en clase." },
    ],
  },
];

/** Historial de Biología en los periodos cerrados (el periodo activo vive en demoSeed.ts). */
export const BIOLOGY_HISTORY: [string, PortalAssessmentType][][] = [
  [["Quiz: niveles de organización", "QUIZ"], ["Taller: biomoléculas", "TALLER"], ["Examen: la célula como sistema", "EXAMEN"]],
  [["Quiz: genética mendeliana", "QUIZ"], ["Taller: cruces dihíbridos", "TALLER"], ["Examen: herencia y ADN", "EXAMEN"]],
  [["Quiz: evolución", "QUIZ"], ["Taller: selección natural", "TALLER"], ["Proyecto: ecosistemas locales", "PROYECTO"]],
];

/** Pesos de las tres evaluaciones de cada periodo cerrado. */
export const HISTORY_WEIGHTS = [30, 30, 40] as const;

const SOFIA = "Sofía Martínez";
type SubjectKey = PortalSubject["key"] | "BIO";

/**
 * Definitivas de Sofía por periodo cerrado (P1, P2, P3). Promedios: 3.9 → 4.0 → 4.1;
 * el periodo activo cierra en 4.2 con las notas de `SOFIA_CURRENT`.
 */
const SOFIA_HISTORY: Record<SubjectKey, [number, number, number]> = {
  BIO: [4.2, 4.3, 4.4],
  MAT: [3.5, 3.6, 3.8],
  LEN: [4.5, 4.6, 4.7],
  ING: [4.0, 4.1, 4.2],
  QUI: [3.4, 3.6, 3.5],
  SOC: [3.9, 4.0, 4.1],
};

/** Resultado en una actividad: nota, "R" = entregada sin calificar, null = sin entregar. */
export type PortalResult = number | "R" | null;

/** Notas de Sofía en el periodo activo con la retroalimentación de cada docente. */
const SOFIA_CURRENT: Record<PortalSubject["key"], Array<{ result: PortalResult; feedback?: string }>> = {
  MAT: [
    { result: 4.0, feedback: "Buen manejo de límites laterales. Revisa la justificación de la continuidad en el punto 4." },
    { result: 3.6, feedback: "Aplicas bien la regla del producto; en la regla de la cadena se te pierde la derivada interna." },
    { result: null },
  ],
  LEN: [
    { result: 4.8, feedback: "Tesis clara y contraargumento sólido. Excelente uso de las fuentes." },
    { result: 4.9, feedback: "Exposición muy bien preparada y con dominio del tema." },
    { result: null },
  ],
  ING: [
    { result: 4.3, feedback: "Good work. Pay attention to numbers and dates in the second track." },
    { result: "R" },
    { result: null },
  ],
  QUI: [
    { result: 3.1, feedback: "Identificas el reactivo límite, pero hay errores al convertir gramos a moles. Repasa el taller 2." },
    { result: 3.4, feedback: "La bitácora está incompleta: faltan las masas medidas en la segunda solución." },
    { result: null },
  ],
  SOC: [
    { result: 4.2, feedback: "Argumentos bien sustentados. Te faltó citar las cifras que mencionaste." },
    { result: 4.4, feedback: "Mapa claro y bien jerarquizado." },
    { result: null },
  ],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Número estable en [0, 1) a partir de un texto (FNV-1a). */
export function stableUnit(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

const isSofia = (student: DemoStudent) => demoStudentName(student) === SOFIA;

/** Nivel base del estudiante: su definitiva actual de Biología o, si no tiene, 3.8. */
const baseLevel = (student: DemoStudent) => demoStudentAverage(student) ?? 3.8;

/** Tendencia suave: los periodos anteriores quedan un poco por debajo del actual. */
const PERIOD_TREND = [-0.2, -0.12, -0.05];

/** Definitiva de un estudiante en una materia y periodo cerrado (índice 0–2). */
export function historyDefinitive(student: DemoStudent, subject: SubjectKey, periodIndex: number): number {
  if (isSofia(student)) return SOFIA_HISTORY[subject][periodIndex];
  const offset = subject === "BIO" ? 0 : PORTAL_SUBJECTS.find(item => item.key === subject)!.offset;
  const jitter = (stableUnit(`${student.code}:${subject}:${periodIndex}`) - 0.5) * 0.6;
  return round1(clamp(baseLevel(student) + offset + PERIOD_TREND[periodIndex] + jitter, 2.2, 5));
}

/**
 * Tres notas que con pesos 30/30/40 promedian exactamente la definitiva (+0.2, −0.2, 0),
 * con un pequeño jitter que se compensa entre las dos primeras.
 */
export function historyGrades(student: DemoStudent, subject: SubjectKey, periodIndex: number): [number, number, number] {
  const definitive = historyDefinitive(student, subject, periodIndex);
  const spread = isSofia(student) ? 0.2 : round1(0.1 + stableUnit(`${student.code}:${subject}:${periodIndex}:s`) * 0.3);
  const first = clamp(definitive + spread, 0, 5);
  const second = clamp(definitive - spread, 0, 5);
  return [round1(first), round1(second), round1(definitive)];
}

/** Resultado y retroalimentación de un estudiante en una actividad del periodo activo. */
export function currentResult(student: DemoStudent, subject: PortalSubject, index: number): { result: PortalResult; feedback: string | null } {
  if (isSofia(student)) {
    const item = SOFIA_CURRENT[subject.key][index];
    return { result: item.result, feedback: item.feedback ?? null };
  }
  const activity = subject.current[index];
  const roll = stableUnit(`${student.code}:${subject.key}:current:${index}`);
  // Actividades futuras: algunos ya entregaron (sin calificar); las vencidas ayer están por revisar
  if (activity.dueInDays >= 0) return { result: roll < 0.3 ? "R" : null, feedback: null };
  if (activity.dueInDays === -1) return { result: roll < 0.75 ? "R" : null, feedback: null };
  // Las ya calificadas: alrededor de su nivel en la materia, con algún faltante ocasional
  if (roll < 0.05) return { result: null, feedback: null };
  const value = baseLevel(student) + subject.offset + (roll - 0.5) * 0.9;
  return { result: round1(clamp(value, 1.8, 5)), feedback: null };
}

/** Días antes de hoy en que el estudiante entregó (determinista y anterior a la fecha límite si ya pasó). */
export function currentSubmissionDaysAgo(student: DemoStudent, activity: PortalActivity): number {
  const early = 1 + (student.number % 3);
  if (activity.dueInDays < 0) return -activity.dueInDays + (student.number % 2);
  return Math.max(0, early - 1);
}

export const portalStudentsIn = (course: DemoCourseName) => DEMO_STUDENTS.filter(student => student.course === course);

/** Eventos para estudiantes; las fechas son relativas al día del seed. */
export const PORTAL_EVENTS = [
  { title: "Simulacro Saber 11", type: "Actividad institucional", inDays: 8, hour: 7, location: "Aulas de 11°", audience: "Estudiantes de 11°" },
  { title: "Control de lectura crítica", type: "Examen", inDays: 5, hour: 9, location: "Aula 11-2", audience: "11-2" },
  { title: "Sustentación: proyecto de memoria histórica", type: "Examen", inDays: 12, hour: 10, location: "Aula 11-2", audience: "11-2" },
] as const;

export const PORTAL_ANNOUNCEMENT = {
  title: "Simulacro Saber 11: indicaciones",
  message: "Estudiantes de 11°: el simulacro será presencial en sus aulas. Lleguen a las 6:45 a. m. con lápiz n.° 2, borrador y documento de identidad. Duración aproximada: cuatro horas y media.",
  audience: "Estudiantes de 11°",
  status: "Publicado",
  daysAgo: 0,
} as const;

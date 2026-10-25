/**
 * Dataset demo del MVP docente: una sola fuente para todas las vistas.
 * El docente demo dicta Biología en 11-1 y 11-2; cada curso tiene 20 estudiantes y 3 evaluaciones,
 * que son a la vez las actividades del aula. Los mismos nombres y notas se siembran en el modelo
 * legacy (snapshot) y en el normalizado (Grade Center).
 */

export const DEMO_TEACHER = {
  openId: "educore-demo-teacher-1",
  name: "Juan Diego Loaiza",
  email: "juan.loaiza@demo.educore.co",
  subject: "Biología",
} as const;

export const DEMO_SUBJECT = { name: "Biología", code: "BIO", description: "Ciencias naturales, ecosistemas y procesos celulares." } as const;

export const DEMO_COURSES = [
  { name: "11-1", grade: "11", groupName: "1" },
  { name: "11-2", grade: "11", groupName: "2" },
] as const;

export type DemoCourseName = (typeof DEMO_COURSES)[number]["name"];

/** Evaluaciones de cada curso, en el orden de los resultados de `DemoStudent.results`. Los pesos suman 100. */
export const DEMO_ACTIVITIES: Array<{ course: DemoCourseName; index: number; title: string; assessmentType: string; weight: number; description: string; dueInDays: number; status: string }> = [
  { course: "11-2", index: 0, title: "Quiz: estructura celular", assessmentType: "QUIZ", weight: 30, description: "Quiz sobre organelos, membrana y diferencias entre células procariotas y eucariotas.", dueInDays: -18, status: "Cerrada" },
  { course: "11-2", index: 1, title: "Taller: transporte de membrana", assessmentType: "TALLER", weight: 30, description: "Resuelve los casos de difusión, ósmosis y transporte activo y explica cada mecanismo con un esquema.", dueInDays: -8, status: "Cerrada" },
  { course: "11-2", index: 2, title: "Informe de laboratorio: división celular", assessmentType: "PROYECTO", weight: 40, description: "Registra las fases de la mitosis observadas en el laboratorio y entrega el informe en PDF con esquemas y conclusiones.", dueInDays: 3, status: "Publicado" },
  { course: "11-1", index: 0, title: "Quiz: tejidos vegetales", assessmentType: "QUIZ", weight: 30, description: "Quiz sobre tejidos meristemáticos, de protección, conducción y sostén.", dueInDays: -16, status: "Cerrada" },
  { course: "11-1", index: 1, title: "Práctica de microscopía: tejidos vegetales", assessmentType: "TALLER", weight: 30, description: "Identifica los tejidos vegetales observados al microscopio y entrega el análisis de las muestras.", dueInDays: -4, status: "Cerrada" },
  { course: "11-1", index: 2, title: "Ensayo: fotosíntesis y respiración celular", assessmentType: "PROYECTO", weight: 40, description: "Escribe un ensayo de dos páginas que relacione la fotosíntesis con la respiración celular, con al menos dos fuentes.", dueInDays: 6, status: "Publicado" },
];

/** Resultado en una evaluación: nota (0–5), "R" = entregada sin calificar, null = sin entregar. */
export type DemoResult = number | "R" | null;

/** Índices sobre los últimos días hábiles: 0 = el día hábil más reciente antes de hoy. */
type AttendancePattern = { absent?: number[]; late?: number[]; excused?: number[] };

export type DemoStudent = {
  openId: string;
  firstName: string;
  lastName: string;
  email: string;
  course: DemoCourseName;
  /** Posición dentro del curso (1–20); define el código EST-<curso>-NN. */
  number: number;
  code: string;
  guardianName: string;
  avatarColor: string;
  results: [DemoResult, DemoResult, DemoResult];
  attendance?: AttendancePattern;
};

type StudentRow = [firstName: string, lastName: string, guardianFirstName: string, results: DemoStudent["results"], attendance?: AttendancePattern];

const COURSE_ROSTERS: Record<DemoCourseName, StudentRow[]> = {
  "11-2": [
    ["Sofía", "Martínez", "Mariana", [4.5, 4.7, 4.1]],
    ["Laura", "Gómez", "Paola", [4.0, 4.3, 3.8], { late: [1, 4, 7] }],
    ["Carlos", "Rojas", "Andrés", [3.6, 3.9, "R"]],
    ["Valentina", "Ruiz", "Felipe", [4.2, 4.0, "R"], { excused: [3] }],
    ["Mateo", "Silva", "Diana", [2.8, 3.0, null]],
    ["Tomás", "Rincón", "Gloria", [3.4, 3.2, null], { absent: [2, 5] }],
    ["Mariana", "Ospina", "Beatriz", [4.6, 4.4, 4.0]],
    ["Santiago", "Restrepo", "Hernán", [3.8, 4.1, 3.5]],
    ["Gabriela", "Vargas", "Claudia", [4.9, 4.8, 4.5]],
    ["Nicolás", "Cárdenas", "Óscar", [3.5, 3.7, "R"]],
    ["Antonella", "Mejía", "Liliana", [4.1, 3.9, null]],
    ["Sebastián", "Díaz", "Mauricio", [3.3, 3.6, null], { late: [6] }],
    ["Luciana", "Pineda", "Adriana", [4.4, 4.5, null]],
    ["Miguel Ángel", "Suárez", "Rodrigo", [3.7, 3.4, null]],
    ["Sara", "Londoño", "Patricia", [4.2, 4.1, 3.6]],
    ["Emilio", "Quintero", "Germán", [3.9, 3.5, null], { absent: [7] }],
    ["Daniela", "Arango", "Marcela", [4.0, 4.2, "R"]],
    ["Felipe", "Montoya", "Jaime", [3.6, 3.8, null]],
    ["Valeria", "Cifuentes", "Sandra", [4.3, 4.6, null]],
    ["Jerónimo", "Salazar", "Fabio", [3.2, 3.5, null], { excused: [8] }],
  ],
  "11-1": [
    ["Daniel", "Torres", "Camilo", [2.9, 2.6, null], { absent: [0, 1, 4] }],
    ["Isabella", "Castro", "Ricardo", [4.7, 4.8, "R"]],
    ["Camila", "Herrera", "Lucía", [4.0, 4.1, "R"]],
    ["Juan", "Pérez", "Mónica", [3.8, 3.9, null]],
    ["Samuel", "Ortiz", "Jorge", [3.2, 2.5, null]],
    ["Manuela", "Zapata", "Ángela", [4.5, 4.3, "R"]],
    ["Andrés Felipe", "Gil", "Ramiro", [3.6, 3.4, null], { late: [2, 9] }],
    ["María José", "Bedoya", "Cristina", [4.2, 4.4, null]],
    ["Alejandro", "Muñoz", "Luis", [3.4, 3.7, null]],
    ["Paula Andrea", "Correa", "Silvia", [4.8, 4.6, null]],
    ["Juan Esteban", "Castaño", "Álvaro", [3.9, 3.6, null], { absent: [6] }],
    ["Antonia", "Giraldo", "Elena", [4.1, 4.0, null]],
    ["David", "Franco", "Ernesto", [3.5, 3.3, null]],
    ["Natalia", "Ocampo", "Rosa", [4.4, 4.7, null]],
    ["Martín", "Henao", "Gustavo", [3.7, 3.9, null], { excused: [5] }],
    ["Catalina", "Valencia", "Teresa", [4.6, 4.2, null]],
    ["Simón", "Echeverri", "Fernando", [3.3, 3.5, null]],
    ["Mariangel", "Patiño", "Yolanda", [4.0, 4.3, null]],
    ["Esteban", "Marín", "Héctor", [3.6, 3.8, null]],
    ["Juliana", "Toro", "Carolina", [4.3, 4.5, null]],
  ],
};

/** Estudiantes con usuario demo de login (estudiante y acudiente); conservan su openId histórico. */
const LOGIN_OPEN_IDS: Record<string, string> = {
  "Sofía Martínez": "educore-demo-student-1",
  "Carlos Rojas": "educore-demo-student-2",
  "Daniel Torres": "educore-demo-student-3",
};

const AVATAR_COLORS = ["#dbeafe", "#fef3c7", "#dcfce7", "#cffafe", "#ffedd5", "#fce7f3", "#ede9fe", "#f1f5f9"];

const slug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, ".");

export const demoStudentName = (student: Pick<DemoStudent, "firstName" | "lastName">) => `${student.firstName} ${student.lastName}`;

export const DEMO_STUDENTS: DemoStudent[] = (() => {
  let nextOpenId = 4;
  return (["11-2", "11-1"] as const).flatMap(course => COURSE_ROSTERS[course].map(([firstName, lastName, guardianFirstName, results, attendance], index) => {
    const name = `${firstName} ${lastName}`;
    return {
      openId: LOGIN_OPEN_IDS[name] ?? `educore-demo-student-${nextOpenId++}`,
      firstName,
      lastName,
      email: `${slug(firstName)}.${slug(lastName)}@demo.educore.co`,
      course,
      number: index + 1,
      code: `EST-${course}-${String(index + 1).padStart(2, "0")}`,
      guardianName: `${guardianFirstName} ${lastName}`,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      results,
      attendance,
    };
  }));
})();

export const demoStudentsIn = (course: DemoCourseName) => DEMO_STUDENTS.filter(student => student.course === course);

export const demoActivitiesFor = (course: DemoCourseName) => DEMO_ACTIVITIES.filter(activity => activity.course === course);

/** Definitiva parcial ponderada sobre las evaluaciones calificadas (misma regla del Grade Center). */
export function demoStudentAverage(student: DemoStudent) {
  let sum = 0;
  let weight = 0;
  for (const activity of demoActivitiesFor(student.course)) {
    const result = student.results[activity.index];
    if (typeof result !== "number") continue;
    sum += result * activity.weight;
    weight += activity.weight;
  }
  return weight ? Number((sum / weight).toFixed(2)) : null;
}

/** Promedio de todas las notas registradas del curso (como el promedio de la planilla). */
export function demoCourseAverage(course: DemoCourseName) {
  const values = demoStudentsIn(course).flatMap(student => student.results.filter((result): result is number => typeof result === "number"));
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

/** Días antes de hoy en que el estudiante entregó la actividad (determinista para que las fechas sean estables). */
export function demoSubmissionDaysAgo(student: DemoStudent, activity: (typeof DEMO_ACTIVITIES)[number], result: Exclude<DemoResult, null>) {
  if (activity.dueInDays < 0) return -activity.dueInDays + (student.number % 3);
  return result === "R" ? student.number % 2 : 2 + (student.number % 2);
}

export const DEMO_PERIOD_TERMS = [
  { name: "Periodo 1", start: "01-13", end: "03-27" },
  { name: "Periodo 2", start: "04-06", end: "06-19" },
  { name: "Periodo 3", start: "07-06", end: "09-18" },
  { name: "Periodo 4", start: "09-28", end: "11-27" },
] as const;

/** Periodos del año con el estado calculado según la fecha actual (el vigente queda "Activo"). */
export function demoPeriods(year: number, now = new Date()) {
  const rows = DEMO_PERIOD_TERMS.map(term => ({
    name: term.name,
    startDate: new Date(`${year}-${term.start}T00:00:00Z`),
    endDate: new Date(`${year}-${term.end}T23:59:59Z`),
  }));
  // Entre periodos (vacaciones) se toma como activo el último que ya empezó
  const started = rows.filter(row => row.startDate <= now);
  const active = started[started.length - 1] ?? rows[0];
  return rows.map(row => ({
    ...row,
    status: row === active ? "Activo" : row.endDate < now ? "Cerrado" : "Programado",
  }));
}

/** Últimos `count` días hábiles anteriores a hoy, a medianoche UTC (como guarda `upsertAttendance`). */
export function lastSchoolDays(count: number, now = new Date()) {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  while (days.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(new Date(cursor));
  }
  return days;
}

export const DEMO_ATTENDANCE_DAYS = 10;

export function demoAttendanceStatus(student: DemoStudent, dayIndex: number): "present" | "absent" | "late" | "excused" {
  if (student.attendance?.absent?.includes(dayIndex)) return "absent";
  if (student.attendance?.late?.includes(dayIndex)) return "late";
  if (student.attendance?.excused?.includes(dayIndex)) return "excused";
  return "present";
}

/** Justificación pendiente de revisión: la ausencia más reciente de Daniel Torres. */
export const DEMO_JUSTIFICATION = {
  openId: "educore-demo-student-3",
  dayIndex: 0,
  reasonCategory: "medical" as const,
  description: "Daniel estuvo con fiebre y asistió a consulta médica. Entregaremos la incapacidad en físico.",
  submittedByName: "Camilo Torres",
};

export const DEMO_EVENTS = [
  { title: "Entrega: informe de división celular", type: "Examen", inDays: 3, hour: 23, location: "Aula virtual 11-2", audience: "11-2" },
  { title: "Reunión de acudientes de 11°", type: "Reunión", inDays: 6, hour: 17, location: "Auditorio principal", audience: "Acudientes de 11°" },
  { title: "Entrega: ensayo de fotosíntesis", type: "Examen", inDays: 6, hour: 23, location: "Aula virtual 11-1", audience: "11-1" },
  { title: "Feria de ciencias", type: "Actividad institucional", inDays: 12, hour: 9, location: "Patio central", audience: "Todo el colegio" },
] as const;

export const DEMO_ANNOUNCEMENTS = [
  { title: "Reunión de acudientes de 11°", message: "Invitamos a los acudientes de 11-1 y 11-2 a la reunión de seguimiento académico en el auditorio principal. Revisaremos el avance en Biología del periodo.", audience: "Acudientes de 11°", status: "Publicado", daysAgo: 2 },
  { title: "Recordatorio: entregas de Biología", message: "Estudiantes de 11-2: el informe de división celular cierra esta semana. Estudiantes de 11-1: el ensayo de fotosíntesis cierra la próxima. Entreguen por el aula virtual.", audience: "Estudiantes", status: "Publicado", daysAgo: 1 },
  { title: "Salida pedagógica al Jardín Botánico", message: "Estamos organizando una salida pedagógica al Jardín Botánico para 11-1 y 11-2. Pronto compartiremos la autorización.", audience: "Acudientes de 11°", status: "Borrador", daysAgo: 0 },
] as const;

export const DEMO_OTHER_TEACHER = { name: "Andrés Molina", email: "andres.molina@demo.educore.co", subjectFocus: "Lengua Castellana" } as const;

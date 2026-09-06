import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiConversations,
  announcements,
  assignments,
  attendance,
  auditLogs,
  courses,
  events,
  grades,
  InsertUser,
  notifications,
  planning,
  reportCards,
  schools,
  students,
  subjects,
  submissions,
  teachers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
export const DEMO_SCHOOL_ID = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const d = (daysFromNow: number, hour = 9) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export async function ensureEduCoreSeeded() {
  const db = await getDb();
  if (!db) return null;
  let school = (await db.select().from(schools).where(eq(schools.name, "Gimnasio Moderno del Valle")).limit(1))[0];
  if (!school) {
    await db.insert(schools).values({
      name: "Gimnasio Moderno del Valle",
      city: "Bogotá, Colombia",
      academicYear: "2026",
      tagline: "Menos administración. Más educación.",
      primaryColor: "#4b9bf4",
      secondaryColor: "#eaf4ff",
      logoUrl: null,
    });
    school = (await db.select().from(schools).where(eq(schools.name, "Gimnasio Moderno del Valle")).limit(1))[0];
  }
  if (!school) return null;
  const schoolId = school.id;

  if ((await db.select({ id: students.id }).from(students).where(eq(students.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(students).values([
      { schoolId, name: "Sofía Martínez", email: "sofia.demo@educore.co", course: "11-2", gradeLevel: "11", guardianName: "Mariana Martínez", status: "Activo", avatarColor: "#dbeafe" },
      { schoolId, name: "Carlos Rojas", email: "carlos.demo@educore.co", course: "11-2", gradeLevel: "11", guardianName: "Andrés Rojas", status: "Activo", avatarColor: "#dcfce7" },
      { schoolId, name: "Laura Gómez", email: "laura.demo@educore.co", course: "11-2", gradeLevel: "11", guardianName: "Paola Gómez", status: "Activo", avatarColor: "#fef3c7" },
      { schoolId, name: "Daniel Torres", email: "daniel.demo@educore.co", course: "11-1", gradeLevel: "11", guardianName: "Camilo Torres", status: "Activo", avatarColor: "#fce7f3" },
      { schoolId, name: "Juan Pérez", email: "juan.demo@educore.co", course: "10-1", gradeLevel: "10", guardianName: "Mónica Pérez", status: "Activo", avatarColor: "#ede9fe" },
      { schoolId, name: "Valentina Ruiz", email: "valentina.demo@educore.co", course: "10-2", gradeLevel: "10", guardianName: "Felipe Ruiz", status: "Activo", avatarColor: "#cffafe" },
      { schoolId, name: "Mateo Silva", email: "mateo.demo@educore.co", course: "9-1", gradeLevel: "9", guardianName: "Diana Silva", status: "Activo", avatarColor: "#ffedd5" },
      { schoolId, name: "Isabella Castro", email: "isabella.demo@educore.co", course: "9-2", gradeLevel: "9", guardianName: "Ricardo Castro", status: "Activo", avatarColor: "#f1f5f9" },
    ]);
  }

  if ((await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(teachers).values([
      { schoolId, name: "Laura Gómez", email: "laura.gomez@educore.co", subjectFocus: "Matemáticas y Física" },
      { schoolId, name: "Andrés Molina", email: "andres.molina@educore.co", subjectFocus: "Lengua Castellana" },
      { schoolId, name: "Natalia Cárdenas", email: "natalia.cardenas@educore.co", subjectFocus: "Ciencias Naturales" },
      { schoolId, name: "Santiago Pérez", email: "santiago.perez@educore.co", subjectFocus: "Inglés" },
    ]);
  }

  if ((await db.select({ id: courses.id }).from(courses).where(eq(courses.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(courses).values([
      { schoolId, name: "9-1", grade: "9", groupName: "1", year: "2026", teacherName: "Natalia Cárdenas", studentsCount: 28, average: 4.1 },
      { schoolId, name: "9-2", grade: "9", groupName: "2", year: "2026", teacherName: "Andrés Molina", studentsCount: 29, average: 4.0 },
      { schoolId, name: "10-1", grade: "10", groupName: "1", year: "2026", teacherName: "Santiago Pérez", studentsCount: 31, average: 3.8 },
      { schoolId, name: "10-2", grade: "10", groupName: "2", year: "2026", teacherName: "Natalia Cárdenas", studentsCount: 30, average: 4.2 },
      { schoolId, name: "11-1", grade: "11", groupName: "1", year: "2026", teacherName: "Laura Gómez", studentsCount: 30, average: 4.0 },
      { schoolId, name: "11-2", grade: "11", groupName: "2", year: "2026", teacherName: "Laura Gómez", studentsCount: 32, average: 3.9 },
    ]);
  }

  if ((await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(subjects).values([
      { schoolId, name: "Matemáticas", course: "11-2", teacherName: "Laura Gómez" },
      { schoolId, name: "Física", course: "11-2", teacherName: "Laura Gómez" },
      { schoolId, name: "Química", course: "11-2", teacherName: "Natalia Cárdenas" },
      { schoolId, name: "Inglés", course: "11-2", teacherName: "Santiago Pérez" },
      { schoolId, name: "Lengua Castellana", course: "11-2", teacherName: "Andrés Molina" },
      { schoolId, name: "Ciencias Sociales", course: "11-1", teacherName: "Andrés Molina" },
      { schoolId, name: "Filosofía", course: "11-1", teacherName: "Andrés Molina" },
      { schoolId, name: "Tecnología", course: "10-1", teacherName: "Santiago Pérez" },
      { schoolId, name: "Educación Física", course: "9-1", teacherName: "Natalia Cárdenas" },
    ]);
  }

  if ((await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(assignments).values([
      { schoolId, title: "Taller de derivadas", subject: "Matemáticas", course: "11-2", teacherName: "Laura Gómez", description: "Resuelve los ejercicios 1 al 8 y explica el procedimiento usado en los problemas 5 y 8.", dueAt: d(2, 23), points: 100, status: "Publicado" },
      { schoolId, title: "Ensayo: ética y tecnología", subject: "Filosofía", course: "11-2", teacherName: "Andrés Molina", description: "Escribe un ensayo argumentativo de 800 palabras con al menos dos fuentes.", dueAt: d(5, 23), points: 100, status: "Publicado" },
      { schoolId, title: "Laboratorio de movimiento", subject: "Física", course: "11-2", teacherName: "Laura Gómez", description: "Registra las mediciones del laboratorio y entrega el análisis en PDF.", dueAt: d(-2, 23), points: 100, status: "Vencida" },
      { schoolId, title: "Presentación oral B2", subject: "Inglés", course: "10-1", teacherName: "Santiago Pérez", description: "Prepara una presentación de cinco minutos sobre una innovación colombiana.", dueAt: d(8, 23), points: 80, status: "Publicado" },
    ]);
  }

  if ((await db.select({ id: grades.id }).from(grades).where(eq(grades.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(grades).values([
      { schoolId, studentName: "Sofía Martínez", course: "11-2", subject: "Matemáticas", period: "Periodo 2", value: 4.5 },
      { schoolId, studentName: "Sofía Martínez", course: "11-2", subject: "Física", period: "Periodo 2", value: 4.2 },
      { schoolId, studentName: "Sofía Martínez", course: "11-2", subject: "Química", period: "Periodo 2", value: 4.7 },
      { schoolId, studentName: "Carlos Rojas", course: "11-2", subject: "Matemáticas", period: "Periodo 2", value: 3.8 },
      { schoolId, studentName: "Carlos Rojas", course: "11-2", subject: "Física", period: "Periodo 2", value: 3.6 },
      { schoolId, studentName: "Laura Gómez", course: "11-2", subject: "Matemáticas", period: "Periodo 2", value: 4.7 },
      { schoolId, studentName: "Daniel Torres", course: "11-1", subject: "Matemáticas", period: "Periodo 2", value: 2.9 },
      { schoolId, studentName: "Juan Pérez", course: "10-1", subject: "Inglés", period: "Periodo 2", value: 4.0 },
    ]);
  }

  if ((await db.select({ id: attendance.id }).from(attendance).where(eq(attendance.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(attendance).values([
      { schoolId, studentName: "Sofía Martínez", course: "11-2", date: d(-1, 7), status: "Presente", note: null },
      { schoolId, studentName: "Carlos Rojas", course: "11-2", date: d(-1, 7), status: "Presente", note: null },
      { schoolId, studentName: "Laura Gómez", course: "11-2", date: d(-1, 7), status: "Tardanza", note: "Llegó 8 minutos después del inicio." },
      { schoolId, studentName: "Daniel Torres", course: "11-1", date: d(-1, 7), status: "Ausente", note: null },
      { schoolId, studentName: "Juan Pérez", course: "10-1", date: d(-1, 7), status: "Presente", note: null },
      { schoolId, studentName: "Valentina Ruiz", course: "10-2", date: d(-1, 7), status: "Excusa", note: "Excusa médica registrada." },
    ]);
  }

  if ((await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.schoolId, schoolId)).limit(1)).length === 0) {
    const task = (await db.select().from(assignments).where(and(eq(assignments.schoolId, schoolId), eq(assignments.title, "Taller de derivadas"))).limit(1))[0];
    if (task) {
      await db.insert(submissions).values([
        { schoolId, assignmentId: task.id, studentName: "Sofía Martínez", submittedAt: d(-1, 18), status: "Entregada", fileName: "taller-derivadas-sofia.pdf", comment: "Incluí el procedimiento completo.", grade: null },
        { schoolId, assignmentId: task.id, studentName: "Carlos Rojas", submittedAt: d(0, 16), status: "Entregada", fileName: "taller-derivadas-carlos.pdf", comment: null, grade: 4.3 },
      ]);
    }
  }

  if ((await db.select({ id: events.id }).from(events).where(eq(events.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(events).values([
      { schoolId, title: "Evaluación de Matemáticas", type: "Examen", eventDate: d(3, 8), location: "Aula 11-2", audience: "11-2" },
      { schoolId, title: "Reunión de padres de 11°", type: "Reunión", eventDate: d(6, 17), location: "Auditorio principal", audience: "Acudientes" },
      { schoolId, title: "Feria de ciencia y tecnología", type: "Actividad institucional", eventDate: d(12, 9), location: "Patio central", audience: "Todo el colegio" },
      { schoolId, title: "Cierre de periodo 2", type: "Institucional", eventDate: d(18, 17), location: "Virtual", audience: "Todo el colegio" },
    ]);
  }

  if ((await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(announcements).values([
      { schoolId, title: "Actualización del calendario académico", message: "El cierre de periodo 2 se realizará el 23 de septiembre. Consulta las fechas en tu calendario.", audience: "Todo el colegio", status: "Publicado", publishedAt: d(-2, 10) },
      { schoolId, title: "Reunión de padres de 11°", message: "Invitamos a los acudientes de grado 11 a la reunión del próximo viernes en el auditorio principal.", audience: "Acudientes de 11°", status: "Publicado", publishedAt: d(-4, 8) },
      { schoolId, title: "Borrador: jornada pedagógica", message: "Estamos preparando una jornada pedagógica para el equipo docente.", audience: "Docentes", status: "Borrador", publishedAt: d(-1, 14) },
    ]);
  }

  if ((await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(notifications).values([
      { schoolId, title: "Nueva entrega recibida", detail: "Sofía Martínez entregó Taller de derivadas.", type: "Entrega", read: 0 },
      { schoolId, title: "Evento próximo", detail: "Evaluación de Matemáticas en 3 días.", type: "Evento", read: 0 },
      { schoolId, title: "Asistencia pendiente", detail: "Falta registrar la asistencia de 11-2.", type: "Recordatorio", read: 0 },
    ]);
  }

  if ((await db.select({ id: reportCards.id }).from(reportCards).where(eq(reportCards.schoolId, schoolId)).limit(1)).length === 0) {
    await db.insert(reportCards).values([
      { schoolId, studentName: "Sofía Martínez", course: "11-2", period: "Periodo 2", average: 4.5, attendancePercent: 96, status: "Listo" },
      { schoolId, studentName: "Carlos Rojas", course: "11-2", period: "Periodo 2", average: 3.8, attendancePercent: 92, status: "Listo" },
    ]);
  }
  return school;
}

export type EduRole = "admin" | "teacher" | "student" | "guardian";
export const ROLE_NAMES: Record<EduRole, string> = {
  admin: "Administrador",
  teacher: "Docente",
  student: "Estudiante",
  guardian: "Acudiente",
};

export async function getEduCoreSnapshot(role: EduRole) {
  const school = await ensureEduCoreSeeded();
  const db = await getDb();
  if (!db || !school) return null;
  const schoolId = school.id;
  const [courseRows, studentRows, teacherRows, subjectRows, gradeRows, attendanceRows, assignmentRows, submissionRows, eventRows, announcementRows, notificationRows, reportCardRows, planningRows] = await Promise.all([
    db.select().from(courses).where(eq(courses.schoolId, schoolId)),
    db.select().from(students).where(eq(students.schoolId, schoolId)),
    db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
    db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
    db.select().from(grades).where(eq(grades.schoolId, schoolId)).orderBy(desc(grades.updatedAt)),
    db.select().from(attendance).where(eq(attendance.schoolId, schoolId)).orderBy(desc(attendance.date)),
    db.select().from(assignments).where(eq(assignments.schoolId, schoolId)).orderBy(desc(assignments.createdAt)),
    db.select().from(submissions).where(eq(submissions.schoolId, schoolId)).orderBy(desc(submissions.submittedAt)),
    db.select().from(events).where(eq(events.schoolId, schoolId)).orderBy(events.eventDate),
    db.select().from(announcements).where(eq(announcements.schoolId, schoolId)).orderBy(desc(announcements.publishedAt)),
    db.select().from(notifications).where(eq(notifications.schoolId, schoolId)).orderBy(desc(notifications.createdAt)),
    db.select().from(reportCards).where(eq(reportCards.schoolId, schoolId)),
    db.select().from(planning).where(eq(planning.schoolId, schoolId)).orderBy(desc(planning.createdAt)),
  ]);
  const demoStudent = "Sofía Martínez";
  const scopedCourseNames = role === "teacher" ? ["11-1", "11-2"] : role === "student" || role === "guardian" ? ["11-2"] : courseRows.map(row => row.name);
  const scopedStudents = role === "student" || role === "guardian" ? studentRows.filter(row => row.name === demoStudent) : role === "teacher" ? studentRows.filter(row => scopedCourseNames.includes(row.course)) : studentRows;
  const scopedAssignments = role === "student" || role === "guardian" ? assignmentRows.filter(row => row.course === "11-2") : role === "teacher" ? assignmentRows.filter(row => row.teacherName === "Laura Gómez" || row.course === "11-2") : assignmentRows;
  const scopedGrades = role === "student" || role === "guardian" ? gradeRows.filter(row => row.studentName === demoStudent) : role === "teacher" ? gradeRows.filter(row => scopedCourseNames.includes(row.course)) : gradeRows;
  const scopedAttendance = role === "student" || role === "guardian" ? attendanceRows.filter(row => row.studentName === demoStudent) : role === "teacher" ? attendanceRows.filter(row => scopedCourseNames.includes(row.course)) : attendanceRows;
  const scopedSubmissions = role === "student" || role === "guardian" ? submissionRows.filter(row => row.studentName === demoStudent) : role === "teacher" ? submissionRows.filter(row => scopedCourseNames.includes(assignmentRows.find(a => a.id === row.assignmentId)?.course ?? "")) : submissionRows;
  return {
    school,
    courses: courseRows.filter(row => scopedCourseNames.includes(row.name)),
    students: scopedStudents,
    teachers: teacherRows,
    subjects: role === "teacher" ? subjectRows.filter(row => scopedCourseNames.includes(row.course)) : subjectRows,
    grades: scopedGrades,
    attendance: scopedAttendance,
    assignments: scopedAssignments,
    submissions: scopedSubmissions,
    events: eventRows,
    announcements: role === "student" ? announcementRows.filter(row => row.audience === "Todo el colegio" || row.audience.includes("Estudiantes")) : announcementRows,
    notifications: notificationRows,
    reportCards: role === "student" || role === "guardian" ? reportCardRows.filter(row => row.studentName === demoStudent) : reportCardRows,
    planning: planningRows,
    role,
    roleName: ROLE_NAMES[role],
  };
}

export async function writeAuditLog(actorRole: EduRole, action: string, detail: string) {
  const db = await getDb();
  if (!db) return;
  const school = await ensureEduCoreSeeded();
  if (!school) return;
  await db.insert(auditLogs).values({ schoolId: school.id, actorRole, action, detail });
}

export async function updateSchoolSettings(input: { name: string; city: string; academicYear: string; primaryColor: string; secondaryColor: string }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  await db.update(schools).set(input).where(eq(schools.id, school.id));
  return (await db.select().from(schools).where(eq(schools.id, school.id)).limit(1))[0];
}

export async function createDemoAssignment(input: { title: string; subject: string; course: string; description: string; dueAt: Date; points: number; teacherName: string }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  await db.insert(assignments).values({ schoolId: school.id, ...input, status: "Publicado" });
  return (await db.select().from(assignments).where(eq(assignments.schoolId, school.id)).orderBy(desc(assignments.id)).limit(1))[0];
}

export async function submitDemoAssignment(input: { assignmentId: number; studentName: string; fileName: string; comment: string }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  await db.insert(submissions).values({ schoolId: school.id, ...input, status: "Entregada", submittedAt: new Date(), grade: null });
  return (await db.select().from(submissions).where(eq(submissions.schoolId, school.id)).orderBy(desc(submissions.id)).limit(1))[0];
}

export async function gradeDemoSubmission(input: { submissionId: number; grade: number; comment: string }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  await db.update(submissions).set({ grade: input.grade, comment: input.comment, status: "Calificada" }).where(and(eq(submissions.id, input.submissionId), eq(submissions.schoolId, school.id)));
  return (await db.select().from(submissions).where(and(eq(submissions.id, input.submissionId), eq(submissions.schoolId, school.id))).limit(1))[0];
}

export async function updateDemoGrade(input: { studentName: string; course: string; subject: string; period: string; value: number }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  const existing = (await db.select().from(grades).where(and(eq(grades.schoolId, school.id), eq(grades.studentName, input.studentName), eq(grades.course, input.course), eq(grades.subject, input.subject), eq(grades.period, input.period))).limit(1))[0];
  if (existing) await db.update(grades).set({ value: input.value }).where(eq(grades.id, existing.id));
  else await db.insert(grades).values({ schoolId: school.id, ...input });
  return (await db.select().from(grades).where(and(eq(grades.schoolId, school.id), eq(grades.studentName, input.studentName), eq(grades.course, input.course), eq(grades.subject, input.subject), eq(grades.period, input.period))).limit(1))[0];
}

export async function recordDemoAttendance(input: { course: string; date: Date; records: Array<{ studentName: string; status: string; note?: string }> }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return [];
  await db.insert(attendance).values(input.records.map(record => ({ schoolId: school.id, course: input.course, date: input.date, studentName: record.studentName, status: record.status, note: record.note ?? null })));
  return input.records;
}

export async function saveAiConversation(role: EduRole, prompt: string, response: string) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return;
  await db.insert(aiConversations).values({ schoolId: school.id, userRole: role, prompt, response });
}

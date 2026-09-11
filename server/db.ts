import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiConversations,
  academicYears,
  academicPeriods,
  academicObservations,
  announcements,
  assignments,
  attendance,
  auditLogs,
  courses,
  courseSubjects,
  enrollmentHistory,
  events,
  grades,
  guardianProfiles,
  guardianStudentRelationships,
  gradeLevels,
  invitations,
  InsertUser,
  notifications,
  permissions,
  planning,
  reportCards,
  reportCardRuns,
  assessments,
  assessmentGrades,
  gradingScales,
  rolePermissions,
  roles,
  schools,
  schoolMemberships,
  studentProfiles,
  studentEnrollments,
  students,
  subjects,
  submissions,
  teacherProfiles,
  teacherAssignments,
  teachers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEMO_ROLE_MAP, IDENTITY_ROLES, PERMISSIONS, PERMISSION_METADATA, ROLE_DESCRIPTIONS, ROLE_HIERARCHY, ROLE_LABELS, type DemoRole, type IdentityRole, hasPermission, permissionsForRole } from "./identityModel";
import { ensureDatabaseRunning } from "./_core/ensureDatabase";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitPromise: Promise<void> | null = null;
export const DEMO_SCHOOL_ID = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    if (!_dbInitPromise) {
      _dbInitPromise = (async () => {
        try {
          await ensureDatabaseRunning();
          _db = drizzle(process.env.DATABASE_URL!);
        } catch (error) {
          console.warn("[Database] Failed to connect:", error);
          _db = null;
        } finally {
          _dbInitPromise = null;
        }
      })();
    }
    await _dbInitPromise;
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "firstName", "lastName", "avatarUrl", "phone", "email", "loginMethod", "status"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = (user[field] ?? null) as never;
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
  if (user.schoolId !== undefined) {
    values.schoolId = user.schoolId;
    updateSet.schoolId = user.schoolId;
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
  let school = (await db.select().from(schools).where(eq(schools.id, DEMO_SCHOOL_ID)).limit(1))[0];
  if (!school) {
    school = (await db.select().from(schools).where(eq(schools.name, "Gimnasio Moderno del Valle")).limit(1))[0];
  }
  if (!school) {
    await db.insert(schools).values({
      id: DEMO_SCHOOL_ID,
      name: "Gimnasio Moderno del Valle",
      city: "Bogotá, Colombia",
      academicYear: "2026",
      tagline: "Menos administración. Más educación.",
      primaryColor: "#4b9bf4",
      secondaryColor: "#eaf4ff",
      logoUrl: null,
    });
    school = (await db.select().from(schools).where(eq(schools.id, DEMO_SCHOOL_ID)).limit(1))[0];
  } else if (school.name !== "Gimnasio Moderno del Valle") {
    await db.update(schools).set({
      name: "Gimnasio Moderno del Valle",
      tagline: "Menos administración. Más educación.",
    }).where(eq(schools.id, school.id));
    school.name = "Gimnasio Moderno del Valle";
  }
  if (!school) return null;
  const schoolId = school.id;

  if ((await db.select({ id: academicPeriods.id }).from(academicPeriods).where(eq(academicPeriods.schoolId, schoolId)).limit(1)).length === 0) {
    const year = Number(school.academicYear) || 2026;
    await db.insert(academicPeriods).values([
      { schoolId, name: "Periodo 1", startDate: new Date(`${year}-01-13T00:00:00Z`), endDate: new Date(`${year}-03-27T23:59:59Z`), status: "Cerrado" },
      { schoolId, name: "Periodo 2", startDate: new Date(`${year}-04-06T00:00:00Z`), endDate: new Date(`${year}-06-19T23:59:59Z`), status: "Activo" },
      { schoolId, name: "Periodo 3", startDate: new Date(`${year}-07-06T00:00:00Z`), endDate: new Date(`${year}-09-18T23:59:59Z`), status: "Programado" },
      { schoolId, name: "Periodo 4", startDate: new Date(`${year}-09-28T00:00:00Z`), endDate: new Date(`${year}-11-27T23:59:59Z`), status: "Programado" },
    ]);
  }

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
  await ensureIdentitySeeded(schoolId);
  await ensureAcademicSeeded(schoolId);
  return school;
}

async function ensureAcademicSeeded(schoolId: number) {
  const db = await getDb();
  if (!db) return;
  const year2026 = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.year, 2026))).limit(1))[0] ?? (await db.insert(academicYears).values({ schoolId, name: "Año académico 2026", year: 2026, startDate: new Date("2026-01-12T00:00:00Z"), endDate: new Date("2026-11-27T23:59:59Z"), status: "ACTIVE" }).$returningId())[0];
  if (!year2026) return;
  const year2025 = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.year, 2025))).limit(1))[0] ?? (await db.insert(academicYears).values({ schoolId, name: "Año académico 2025", year: 2025, startDate: new Date("2025-01-13T00:00:00Z"), endDate: new Date("2025-11-28T23:59:59Z"), status: "CLOSED" }).$returningId())[0];
  const periodRows = await db.select().from(academicPeriods).where(eq(academicPeriods.schoolId, schoolId));
  for (const period of periodRows) {
    if (!period.academicYearId) await db.update(academicPeriods).set({ academicYearId: year2026.id, orderIndex: Number(period.name.match(/\d+/)?.[0] ?? 1) }).where(eq(academicPeriods.id, period.id));
  }
  const gradeSeeds = [
    ["Sexto", "6°", 6], ["Séptimo", "7°", 7], ["Octavo", "8°", 8], ["Noveno", "9°", 9], ["Décimo", "10°", 10], ["Undécimo", "11°", 11],
  ] as const;
  const gradeMap = new Map<string, number>();
  for (const [name, shortName, levelOrder] of gradeSeeds) {
    const existing = (await db.select().from(gradeLevels).where(and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.shortName, shortName))).limit(1))[0];
    const row = existing ?? (await db.insert(gradeLevels).values({ schoolId, name, shortName, levelOrder, status: "ACTIVE" }).$returningId())[0];
    if (row) gradeMap.set(String(levelOrder), row.id);
  }
  const courseSeeds = [
    ["6-1", "6", "1", 6, 28], ["6-2", "6", "2", 6, 28], ["7-1", "7", "1", 7, 30], ["8-1", "8", "1", 8, 30],
    ["9-1", "9", "1", 9, 28], ["9-2", "9", "2", 9, 29], ["10-1", "10", "1", 10, 31], ["10-2", "10", "2", 10, 30], ["11-1", "11", "1", 11, 30], ["11-2", "11", "2", 11, 32],
  ] as const;
  const courseMap = new Map<string, number>();
  for (const [name, grade, groupName, levelOrder, capacity] of courseSeeds) {
    let course = (await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, name))).limit(1))[0];
    if (!course) {
      await db.insert(courses).values({ schoolId, academicYearId: year2026.id, gradeLevelId: gradeMap.get(String(levelOrder)) ?? null, name, code: name, grade, groupName, year: "2026", capacity, status: "ACTIVE", teacherName: "Equipo académico", studentsCount: 0, average: 0 });
      course = (await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, name))).limit(1))[0];
    } else {
      await db.update(courses).set({ academicYearId: course.academicYearId ?? year2026.id, gradeLevelId: course.gradeLevelId ?? gradeMap.get(String(levelOrder)) ?? null, code: course.code ?? name, capacity: course.capacity ?? capacity, status: course.status || "ACTIVE" }).where(eq(courses.id, course.id));
    }
    if (course) courseMap.set(name, course.id);
  }
  const subjectSeeds = [
    ["Matemáticas", "MAT", "Pensamiento numérico, algebraico y variacional."], ["Física", "FIS", "Comprensión de fenómenos y movimiento."], ["Química", "QUI", "Materia, transformaciones y laboratorio."], ["Inglés", "ING", "Comunicación en lengua extranjera."], ["Lengua Castellana", "LEN", "Lectura, escritura y comunicación."], ["Ciencias Sociales", "SOC", "Sociedad, territorio y ciudadanía."], ["Filosofía", "FIL", "Pensamiento crítico y reflexión."], ["Tecnología", "TEC", "Diseño, tecnología y pensamiento computacional."], ["Educación Física", "EDF", "Movimiento, salud y bienestar."],
  ] as const;
  const subjectMap = new Map<string, number>();
  for (const [name, code, description] of subjectSeeds) {
    let subject = (await db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, name))).limit(1))[0];
    if (!subject) {
      await db.insert(subjects).values({ schoolId, name, shortName: name.slice(0, 3).toUpperCase(), code, description, status: "ACTIVE", course: "11-2", teacherName: "Equipo académico" });
      subject = (await db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.name, name))).limit(1))[0];
    } else {
      await db.update(subjects).set({ code: subject.code ?? code, description: subject.description ?? description, status: subject.status || "ACTIVE" }).where(eq(subjects.id, subject.id));
    }
    if (subject) subjectMap.set(name, subject.id);
  }
  const standardSubjects = ["Matemáticas", "Física", "Química", "Inglés", "Lengua Castellana"];
  for (const courseSeed of courseSeeds) {
    const courseName = courseSeed[0];
    const courseId = courseMap.get(courseName);
    if (!courseId) continue;
    for (const subjectName of standardSubjects) {
      const subjectId = subjectMap.get(subjectName);
      if (!subjectId) continue;
      const exists = (await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, schoolId), eq(courseSubjects.courseId, courseId), eq(courseSubjects.subjectId, subjectId))).limit(1)).length > 0;
      if (!exists) await db.insert(courseSubjects).values({ schoolId, courseId, subjectId, status: "ACTIVE" });
    }
  }
  const teachersForAcademic = await db.select({ userId: teacherProfiles.userId }).from(teacherProfiles).where(eq(teacherProfiles.schoolId, schoolId)).limit(3);
  const subjectAssignments = [["11-2", "Matemáticas"], ["11-2", "Física"], ["10-1", "Matemáticas"], ["9-2", "Física"]] as const;
  for (const [courseName, subjectName] of subjectAssignments) {
    const teacherUserId = teachersForAcademic[(courseName === "11-2" && subjectName === "Física") ? 1 : 0]?.userId;
    const courseId = courseMap.get(courseName);
    const subjectId = subjectMap.get(subjectName);
    if (!teacherUserId || !courseId || !subjectId) continue;
    const exists = (await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, teacherUserId), eq(teacherAssignments.courseId, courseId), eq(teacherAssignments.subjectId, subjectId), eq(teacherAssignments.academicYearId, year2026.id))).limit(1)).length > 0;
    if (!exists) await db.insert(teacherAssignments).values({ schoolId, teacherUserId, courseId, subjectId, academicYearId: year2026.id, isPrimary: 1, status: "ACTIVE" });
  }
  const studentUserRows = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.schoolId, schoolId)).limit(3);
  const studentCourseNames = ["11-2", "11-2", "11-1"] as const;
  for (let index = 0; index < studentUserRows.length; index += 1) {
    const studentUserId = studentUserRows[index]?.userId;
    const courseId = courseMap.get(studentCourseNames[index] ?? "11-2");
    if (!studentUserId || !courseId) continue;
    const exists = (await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.studentUserId, studentUserId), eq(studentEnrollments.academicYearId, year2026.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).limit(1)).length > 0;
    if (!exists) await db.insert(studentEnrollments).values({ schoolId, studentUserId, academicYearId: year2026.id, courseId, enrollmentStatus: "ACTIVE" });
  }
  return { year2026, year2025, courseMap, subjectMap };
}

export type EduRole = "admin" | "teacher" | "student" | "guardian";
export const ROLE_NAMES: Record<EduRole, string> = {
  admin: "Administrador",
  teacher: "Docente",
  student: "Estudiante",
  guardian: "Acudiente",
};

export async function getEduCoreSnapshot(
  role: EduRole,
  selectedStudentId?: number,
  actor?: { schoolId: number; userId: number; roleKey: IdentityRole; permissions: string[] }
) {
  const school = await ensureEduCoreSeeded();
  const db = await getDb();
  if (!db || !school) return null;
  const schoolId = actor?.schoolId ?? school.id;
  const currentSchool = (await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1))[0] ?? school;
  const [courseRows, studentRows, teacherRows, subjectRows, gradeRows, attendanceRows, assignmentRows, submissionRows, eventRows, announcementRows, notificationRows, reportCardRows, planningRows, periodRows] = await Promise.all([
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
    db.select().from(academicPeriods).where(eq(academicPeriods.schoolId, schoolId)).orderBy(academicPeriods.startDate),
  ]);

  const effectiveRoleKey = actor?.roleKey ?? ({ admin: "SCHOOL_ADMIN", teacher: "TEACHER", student: "STUDENT", guardian: "GUARDIAN" } as const)[role];

  let targetStudentName = "Sofía Martínez";

  if (effectiveRoleKey === "STUDENT" && actor?.userId) {
    const studentUser = (await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, actor.userId))).limit(1))[0];
    if (studentUser?.name) {
      targetStudentName = studentUser.name;
    }
  } else if (effectiveRoleKey === "GUARDIAN") {
    const guardianUserId = actor?.userId ?? (await getDemoIdentityContext("guardian", schoolId))?.user.id;
    if (guardianUserId) {
      const linkedRelationships = await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, schoolId), eq(guardianStudentRelationships.guardianUserId, guardianUserId)));
      const linkedStudentIds = new Set(linkedRelationships.map(r => r.studentUserId));
      const chosenStudentId = (selectedStudentId && linkedStudentIds.has(selectedStudentId))
        ? selectedStudentId
        : linkedRelationships[0]?.studentUserId;
      if (chosenStudentId) {
        const studentUser = (await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, chosenStudentId))).limit(1))[0];
        if (studentUser?.name) {
          targetStudentName = studentUser.name;
        }
      }
    }
  } else if (selectedStudentId) {
    const studentUser = (await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, selectedStudentId))).limit(1))[0];
    if (studentUser?.name) {
      targetStudentName = studentUser.name;
    }
  }

  const isStudentOrGuardian = effectiveRoleKey === "STUDENT" || effectiveRoleKey === "GUARDIAN";
  const isTeacher = effectiveRoleKey === "TEACHER";

  const scopedCourseNames = isTeacher ? ["11-1", "11-2"] : isStudentOrGuardian ? ["11-2"] : courseRows.map(row => row.name);
  const scopedStudents = isStudentOrGuardian ? studentRows.filter(row => row.name === targetStudentName) : isTeacher ? studentRows.filter(row => scopedCourseNames.includes(row.course)) : studentRows;
  const scopedAssignments = isStudentOrGuardian ? assignmentRows.filter(row => row.course === "11-2") : isTeacher ? assignmentRows.filter(row => row.teacherName === "Laura Gómez" || row.course === "11-2") : assignmentRows;
  const scopedGrades = isStudentOrGuardian ? gradeRows.filter(row => row.studentName === targetStudentName) : isTeacher ? gradeRows.filter(row => scopedCourseNames.includes(row.course)) : gradeRows;
  const scopedAttendance = isStudentOrGuardian ? attendanceRows.filter(row => row.studentName === targetStudentName) : isTeacher ? attendanceRows.filter(row => scopedCourseNames.includes(row.course)) : attendanceRows;
  const scopedSubmissions = isStudentOrGuardian ? submissionRows.filter(row => row.studentName === targetStudentName) : isTeacher ? submissionRows.filter(row => scopedCourseNames.includes(assignmentRows.find(a => a.id === row.assignmentId)?.course ?? "")) : submissionRows;

  return {
    school: currentSchool,
    courses: courseRows.filter(row => scopedCourseNames.includes(row.name)),
    students: scopedStudents,
    teachers: teacherRows,
    subjects: isTeacher ? subjectRows.filter(row => scopedCourseNames.includes(row.course)) : subjectRows,
    grades: scopedGrades,
    attendance: scopedAttendance,
    assignments: scopedAssignments,
    submissions: scopedSubmissions,
    events: eventRows,
    announcements: effectiveRoleKey === "STUDENT" ? announcementRows.filter(row => row.audience === "Todo el colegio" || row.audience.includes("Estudiantes")) : announcementRows,
    notifications: notificationRows,
    reportCards: isStudentOrGuardian ? reportCardRows.filter(row => row.studentName === targetStudentName) : reportCardRows,
    planning: planningRows,
    academicPeriods: periodRows,
    role,
    roleName: ROLE_NAMES[role],
  };
}

export async function writeAuditLog(actorRole: EduRole, action: string, detail: string, targetSchoolId?: number) {
  const db = await getDb();
  if (!db) return;
  const school = await ensureEduCoreSeeded();
  if (!school) return;
  const schoolId = targetSchoolId ?? school.id;
  await db.insert(auditLogs).values({ schoolId, actorRole, action, detail });
}

export async function updateSchoolSettings(input: Partial<typeof schools.$inferInsert> & { id?: number; role?: string; schoolId?: number }) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  const targetId = input.schoolId ?? input.id ?? school.id;
  const { id: _id, role: _role, schoolId: _schoolId, ...changes } = input;
  await db.update(schools).set(changes).where(eq(schools.id, targetId));
  return (await db.select().from(schools).where(eq(schools.id, targetId)).limit(1))[0];
}

export async function createAcademicPeriod(input: { name: string; startDate: Date; endDate: Date; status: string }, targetSchoolId?: number) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  const schoolId = targetSchoolId ?? school.id;
  await db.insert(academicPeriods).values({ schoolId, ...input });
  return (await db.select().from(academicPeriods).where(eq(academicPeriods.schoolId, schoolId)).orderBy(desc(academicPeriods.id)).limit(1))[0];
}

export async function updateAcademicPeriod(input: { id: number; name: string; startDate: Date; endDate: Date; status: string }, targetSchoolId?: number) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school) return null;
  const schoolId = targetSchoolId ?? school.id;
  const { id, ...changes } = input;
  await db.update(academicPeriods).set(changes).where(and(eq(academicPeriods.id, id), eq(academicPeriods.schoolId, schoolId)));
  return (await db.select().from(academicPeriods).where(and(eq(academicPeriods.id, id), eq(academicPeriods.schoolId, schoolId))).limit(1))[0];
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


export type IdentityUserRecord = typeof users.$inferSelect & {
  membershipRole?: IdentityRole;
  membershipStatus?: string;
  permissions?: string[];
};

const identityRoleRows = IDENTITY_ROLES.map(key => ({
  key,
  name: ROLE_LABELS[key],
  description: ROLE_DESCRIPTIONS[key],
  hierarchyLevel: ROLE_HIERARCHY[key],
}));

export async function ensureIdentitySeeded(schoolId = DEMO_SCHOOL_ID) {
  const db = await getDb();
  if (!db) return;
  const existingRoles = await db.select().from(roles);
  if (existingRoles.length === 0) await db.insert(roles).values(identityRoleRows);
  const existingPermissions = await db.select().from(permissions);
  if (existingPermissions.length === 0) {
    await db.insert(permissions).values(PERMISSIONS.map(key => ({ key, ...PERMISSION_METADATA[key] })));
  }
  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permissions);
  const assignments = roleRows.flatMap(role => permissionsForRole(role.key as IdentityRole).map(permissionKey => {
    const permission = permissionRows.find(row => row.key === permissionKey);
    return permission ? { roleId: role.id, permissionId: permission.id } : null;
  }).filter((row): row is { roleId: number; permissionId: number } => Boolean(row)));
  if (assignments.length > 0) {
    const existingLinks = await db.select().from(rolePermissions);
    const existingKeys = new Set(existingLinks.map(row => `${row.roleId}:${row.permissionId}`));
    const missing = assignments.filter(row => !existingKeys.has(`${row.roleId}:${row.permissionId}`));
    if (missing.length > 0) await db.insert(rolePermissions).values(missing);
  }
  const school = (await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1))[0];
  if (!school) return;
  const demoUsers = [
    { openId: "educore-demo-admin", firstName: "Valentina", lastName: "Ríos", name: "Valentina Ríos", email: "valentina.admin@demo.educore.co", roleKey: "SCHOOL_ADMIN" as IdentityRole, status: "ACTIVE", profile: "none" },
    { openId: "educore-demo-rector", firstName: "Ana", lastName: "Torres", name: "Ana Torres", email: "ana.rector@demo.educore.co", roleKey: "RECTOR" as IdentityRole, status: "ACTIVE", profile: "none" },
    { openId: "educore-demo-coordinator", firstName: "Carlos", lastName: "Mendoza", name: "Carlos Mendoza", email: "carlos.coordinador@demo.educore.co", roleKey: "COORDINATOR" as IdentityRole, status: "ACTIVE", profile: "none" },
    { openId: "educore-demo-teacher-1", firstName: "Laura", lastName: "Pérez", name: "Laura Pérez", email: "laura.perez@demo.educore.co", roleKey: "TEACHER" as IdentityRole, status: "ACTIVE", profile: "teacher" },
    { openId: "educore-demo-teacher-2", firstName: "Andrés", lastName: "Molina", name: "Andrés Molina", email: "andres.molina@demo.educore.co", roleKey: "TEACHER" as IdentityRole, status: "ACTIVE", profile: "teacher" },
    { openId: "educore-demo-student-1", firstName: "Sofía", lastName: "Martínez", name: "Sofía Martínez", email: "sofia.martinez@demo.educore.co", roleKey: "STUDENT" as IdentityRole, status: "ACTIVE", profile: "student" },
    { openId: "educore-demo-student-2", firstName: "Carlos", lastName: "Rojas", name: "Carlos Rojas", email: "carlos.rojas@demo.educore.co", roleKey: "STUDENT" as IdentityRole, status: "ACTIVE", profile: "student" },
    { openId: "educore-demo-student-3", firstName: "Daniel", lastName: "Torres", name: "Daniel Torres", email: "daniel.torres@demo.educore.co", roleKey: "STUDENT" as IdentityRole, status: "ACTIVE", profile: "student" },
    { openId: "educore-demo-guardian-1", firstName: "Mariana", lastName: "Martínez", name: "Mariana Martínez", email: "mariana.martinez@demo.educore.co", roleKey: "GUARDIAN" as IdentityRole, status: "ACTIVE", profile: "guardian" },
    { openId: "educore-demo-guardian-2", firstName: "Andrés", lastName: "Rojas", name: "Andrés Rojas", email: "andres.rojas@demo.educore.co", roleKey: "GUARDIAN" as IdentityRole, status: "ACTIVE", profile: "guardian" },
  ];
  for (const demo of demoUsers) {
    let user = (await db.select().from(users).where(eq(users.openId, demo.openId)).limit(1))[0];
    if (!user) {
      await db.insert(users).values({ openId: demo.openId, schoolId, name: demo.name, firstName: demo.firstName, lastName: demo.lastName, email: demo.email, loginMethod: "demo", role: demo.roleKey === "SCHOOL_ADMIN" ? "admin" : "user", status: demo.status });
      user = (await db.select().from(users).where(eq(users.openId, demo.openId)).limit(1))[0];
    }
    if (!user) continue;
    const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, user.id))).limit(1))[0];
    if (!membership) await db.insert(schoolMemberships).values({ schoolId, userId: user.id, roleKey: demo.roleKey, status: demo.status });
    if (demo.profile === "teacher") {
      const profile = (await db.select().from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, user.id))).limit(1))[0];
      if (!profile) await db.insert(teacherProfiles).values({ schoolId, userId: user.id, employeeCode: `DOC-${user.id}`, specialties: "Acompañamiento académico", subjects: "Matemáticas, Ciencias" });
    }
    if (demo.profile === "student") {
      const profile = (await db.select().from(studentProfiles).where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.userId, user.id))).limit(1))[0];
      if (!profile) await db.insert(studentProfiles).values({ schoolId, userId: user.id, studentCode: `EST-${user.id}`, gradeLevel: "11", course: "11-2", status: demo.status });
    }
    if (demo.profile === "guardian") {
      const profile = (await db.select().from(guardianProfiles).where(and(eq(guardianProfiles.schoolId, schoolId), eq(guardianProfiles.userId, user.id))).limit(1))[0];
      if (!profile) await db.insert(guardianProfiles).values({ schoolId, userId: user.id });
    }
  }
  const guardian = (await db.select().from(users).where(eq(users.openId, "educore-demo-guardian-1")).limit(1))[0];
  const student = (await db.select().from(users).where(eq(users.openId, "educore-demo-student-1")).limit(1))[0];
  if (guardian && student) {
    const relationship = (await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, schoolId), eq(guardianStudentRelationships.guardianUserId, guardian.id), eq(guardianStudentRelationships.studentUserId, student.id))).limit(1))[0];
    if (!relationship) await db.insert(guardianStudentRelationships).values({ schoolId, guardianUserId: guardian.id, studentUserId: student.id, relationshipType: "PARENT", isPrimary: 1 });
    const secondStudent = (await db.select().from(users).where(eq(users.openId, "educore-demo-student-2")).limit(1))[0];
    if (secondStudent) {
      const secondRelationship = (await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, schoolId), eq(guardianStudentRelationships.guardianUserId, guardian.id), eq(guardianStudentRelationships.studentUserId, secondStudent.id))).limit(1))[0];
      if (!secondRelationship) await db.insert(guardianStudentRelationships).values({ schoolId, guardianUserId: guardian.id, studentUserId: secondStudent.id, relationshipType: "PARENT", isPrimary: 0 });
    }
  }
  return { schoolId };
}

export async function getMembershipContext(userId: number, schoolId: number): Promise<{ user: typeof users.$inferSelect; membership: typeof schoolMemberships.$inferSelect; permissions: string[] } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureIdentitySeeded(schoolId);
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.userId, userId), eq(schoolMemberships.schoolId, schoolId))).limit(1))[0];
  if (!user || !membership || membership.status !== "ACTIVE" || user.status !== "ACTIVE") return null;
  return { user, membership, permissions: permissionsForRole(membership.roleKey as IdentityRole) };
}

export async function getDemoIdentityContext(role: DemoRole, schoolId = DEMO_SCHOOL_ID) {
  const db = await getDb();
  if (!db) return null;
  await ensureIdentitySeeded(schoolId);
  const roleKey = DEMO_ROLE_MAP[role];
  const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.roleKey, roleKey), eq(schoolMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!membership) return null;
  return getMembershipContext(membership.userId, schoolId);
}

export async function listSchoolUsers(input: { schoolId: number; search?: string; roleKey?: IdentityRole | "ALL"; status?: string | "ALL"; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  await ensureIdentitySeeded(input.schoolId);
  const memberships = await db.select().from(schoolMemberships).where(eq(schoolMemberships.schoolId, input.schoolId));
  const memberIds = new Set(memberships.map(row => row.userId));
  let rows = (await db.select().from(users)).filter(user => memberIds.has(user.id));
  if (input.search) {
    const needle = input.search.toLowerCase();
    rows = rows.filter(user => `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(needle));
  }
  if (input.roleKey && input.roleKey !== "ALL") rows = rows.filter(user => memberships.find(m => m.userId === user.id)?.roleKey === input.roleKey);
  if (input.status && input.status !== "ALL") rows = rows.filter(user => user.status === input.status && memberships.find(m => m.userId === user.id)?.status === input.status);
  const total = rows.length;
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;
  const sliced = rows.slice(offset, offset + limit).map(user => {
    const membership = memberships.find(m => m.userId === user.id);
    return { ...user, membershipRole: membership?.roleKey ?? "STUDENT", membershipStatus: membership?.status ?? "INACTIVE", permissions: permissionsForRole((membership?.roleKey ?? "STUDENT") as IdentityRole) };
  });
  return { rows: sliced, total, limit, offset };
}

export async function getSchoolUserProfile(schoolId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId))).limit(1))[0];
  if (!user || !membership) return null;
  const permissions = permissionsForRole(membership.roleKey as IdentityRole);
  const teacher = (await db.select().from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, userId))).limit(1))[0] ?? null;
  const student = (await db.select().from(studentProfiles).where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.userId, userId))).limit(1))[0] ?? null;
  const guardian = (await db.select().from(guardianProfiles).where(and(eq(guardianProfiles.schoolId, schoolId), eq(guardianProfiles.userId, userId))).limit(1))[0] ?? null;
  const relationships = await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, schoolId), eq(guardianStudentRelationships.guardianUserId, userId)));
  const linkedStudents = relationships.length ? (await db.select().from(users)).filter(user => relationships.some(row => row.studentUserId === user.id)) : [];
  const school = (await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1))[0] ?? null;
  return { ...user, school, membership, permissions, teacherProfile: teacher, studentProfile: student, guardianProfile: guardian, linkedStudents };
}

export async function createSchoolUser(input: { schoolId: number; firstName: string; lastName: string; email: string; roleKey: IdentityRole; status: string; phone?: string; studentCode?: string; gradeLevel?: string; course?: string; actorUserId?: number }) {
  const db = await getDb();
  if (!db) return null;
  await ensureIdentitySeeded(input.schoolId);
  const existing = (await db.select().from(users).where(eq(users.email, input.email)).limit(1))[0];
  if (existing) throw new Error("Ya existe un usuario con ese correo.");
  const name = `${input.firstName} ${input.lastName}`.trim();
  const manualOpenId = `manual:${createHash("sha256").update(`${input.email}:${Date.now()}`).digest("hex").slice(0, 52)}`;
  await db.insert(users).values({ openId: manualOpenId, schoolId: input.schoolId, name, firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone ?? null, status: input.status, role: "user", loginMethod: "manual" });
  const user = (await db.select().from(users).where(eq(users.email, input.email)).limit(1))[0];
  if (!user) return null;
  await db.insert(schoolMemberships).values({ schoolId: input.schoolId, userId: user.id, roleKey: input.roleKey, status: input.status });
  if (input.roleKey === "TEACHER") await db.insert(teacherProfiles).values({ schoolId: input.schoolId, userId: user.id, employeeCode: null, specialties: null, subjects: null });
  if (input.roleKey === "STUDENT") await db.insert(studentProfiles).values({ schoolId: input.schoolId, userId: user.id, studentCode: input.studentCode ?? null, gradeLevel: input.gradeLevel ?? null, course: input.course ?? null, status: input.status });
  if (input.roleKey === "GUARDIAN") await db.insert(guardianProfiles).values({ schoolId: input.schoolId, userId: user.id });
  await writeIdentityAudit({ schoolId: input.schoolId, actorUserId: input.actorUserId, targetUserId: user.id, action: "user.created", detail: `Usuario ${emailSafe(user.email)}` });
  return getSchoolUserProfile(input.schoolId, user.id);
}

const emailSafe = (email: string | null) => email ? email.replace(/(.{2}).+(@.*)/, "$1•••$2") : "correo protegido";

export async function updateMembershipRole(input: { schoolId: number; userId: number; roleKey: IdentityRole; actorUserId?: number }) {
  const db = await getDb();
  if (!db) return null;
  const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, input.schoolId), eq(schoolMemberships.userId, input.userId))).limit(1))[0];
  if (!membership) throw new Error("El usuario no pertenece a esta institución.");
  await db.update(schoolMemberships).set({ roleKey: input.roleKey }).where(eq(schoolMemberships.id, membership.id));
  await writeIdentityAudit({ schoolId: input.schoolId, actorUserId: input.actorUserId, targetUserId: input.userId, action: "user.role_changed", detail: input.roleKey });
  return getSchoolUserProfile(input.schoolId, input.userId);
}

export async function setUserStatus(input: { schoolId: number; userId: number; status: "ACTIVE" | "SUSPENDED" | "INACTIVE"; actorUserId?: number }) {
  const db = await getDb();
  if (!db) return null;
  const membership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, input.schoolId), eq(schoolMemberships.userId, input.userId))).limit(1))[0];
  if (!membership) throw new Error("El usuario no pertenece a esta institución.");
  if (input.status !== "ACTIVE" && membership.roleKey === "SCHOOL_ADMIN") {
    const admins = await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, input.schoolId), eq(schoolMemberships.roleKey, "SCHOOL_ADMIN"), eq(schoolMemberships.status, "ACTIVE")));
    if (admins.length <= 1) throw new Error("No puedes desactivar al último administrador de esta institución.");
  }
  await db.update(users).set({ status: input.status }).where(eq(users.id, input.userId));
  await db.update(schoolMemberships).set({ status: input.status }).where(eq(schoolMemberships.id, membership.id));
  await writeIdentityAudit({ schoolId: input.schoolId, actorUserId: input.actorUserId, targetUserId: input.userId, action: input.status === "ACTIVE" ? "user.reactivated" : "user.suspended", detail: input.status });
  return getSchoolUserProfile(input.schoolId, input.userId);
}

export async function createInvitation(input: { schoolId: number; email: string; roleKey: IdentityRole; actorUserId: number }) {
  const db = await getDb();
  if (!db) return null;
  await ensureIdentitySeeded(input.schoolId);
  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(invitations).values({ schoolId: input.schoolId, email: input.email, roleKey: input.roleKey, tokenHash, status: "PENDING", expiresAt, invitedBy: input.actorUserId });
  const invitation = (await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1))[0];
  await writeIdentityAudit({ schoolId: input.schoolId, actorUserId: input.actorUserId, action: "invitation.created", detail: `${emailSafe(input.email)} · ${input.roleKey}` });
  return { invitation, rawToken };
}

export async function listInvitations(schoolId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: invitations.id, email: invitations.email, roleKey: invitations.roleKey, status: invitations.status, expiresAt: invitations.expiresAt, invitedBy: invitations.invitedBy, createdAt: invitations.createdAt }).from(invitations).where(eq(invitations.schoolId, schoolId)).orderBy(desc(invitations.createdAt));
}

export async function acceptInvitation(input: { token: string; firstName: string; lastName: string }) {
  const db = await getDb();
  if (!db) return null;
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const invitation = (await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1))[0];
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) throw new Error("Esta invitación ya no está disponible.");
  let user = (await db.select().from(users).where(eq(users.email, invitation.email)).limit(1))[0];
  if (!user) {
    const invitedOpenId = `invited:${createHash("sha256").update(invitation.email).digest("hex").slice(0, 56)}`;
    await db.insert(users).values({ openId: invitedOpenId, schoolId: invitation.schoolId, name: `${input.firstName} ${input.lastName}`, firstName: input.firstName, lastName: input.lastName, email: invitation.email, loginMethod: "invitation", status: "ACTIVE", role: "user" });
    user = (await db.select().from(users).where(eq(users.email, invitation.email)).limit(1))[0];
  }
  if (!user) return null;
  const existingMembership = (await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, invitation.schoolId), eq(schoolMemberships.userId, user.id))).limit(1))[0];
  if (!existingMembership) await db.insert(schoolMemberships).values({ schoolId: invitation.schoolId, userId: user.id, roleKey: invitation.roleKey, status: "ACTIVE" });
  await db.update(invitations).set({ status: "ACCEPTED" }).where(eq(invitations.id, invitation.id));
  await writeIdentityAudit({ schoolId: invitation.schoolId, targetUserId: user.id, action: "invitation.accepted", detail: "Invitación aceptada" });
  return getSchoolUserProfile(invitation.schoolId, user.id);
}

export async function createGuardianRelationship(input: { schoolId: number; guardianUserId: number; studentUserId: number; relationshipType: string; isPrimary: boolean; actorUserId?: number }) {
  const db = await getDb();
  if (!db) return null;
  const [guardianMembership, studentMembership] = await Promise.all([
    db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, input.schoolId), eq(schoolMemberships.userId, input.guardianUserId))).limit(1),
    db.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, input.schoolId), eq(schoolMemberships.userId, input.studentUserId))).limit(1),
  ]);
  if (guardianMembership[0]?.roleKey !== "GUARDIAN" || studentMembership[0]?.roleKey !== "STUDENT") throw new Error("La relación requiere un acudiente y un estudiante de la misma institución.");
  const existing = (await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, input.schoolId), eq(guardianStudentRelationships.guardianUserId, input.guardianUserId), eq(guardianStudentRelationships.studentUserId, input.studentUserId))).limit(1))[0];
  if (existing) return existing;
  await db.insert(guardianStudentRelationships).values({ schoolId: input.schoolId, guardianUserId: input.guardianUserId, studentUserId: input.studentUserId, relationshipType: input.relationshipType, isPrimary: input.isPrimary ? 1 : 0 });
  const relationship = (await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, input.schoolId), eq(guardianStudentRelationships.guardianUserId, input.guardianUserId), eq(guardianStudentRelationships.studentUserId, input.studentUserId))).limit(1))[0];
  await writeIdentityAudit({ schoolId: input.schoolId, actorUserId: input.actorUserId, targetUserId: input.studentUserId, action: "guardian.relationship_created", detail: `${input.guardianUserId}:${input.relationshipType}` });
  return relationship;
}

export async function listGuardianStudents(schoolId: number, guardianUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const relationships = await db.select().from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, schoolId), eq(guardianStudentRelationships.guardianUserId, guardianUserId)));
  const studentIds = new Set(relationships.map(row => row.studentUserId));
  return (await db.select().from(users)).filter(user => studentIds.has(user.id)).map(user => ({ ...user, relationship: relationships.find(row => row.studentUserId === user.id) }));
}

export async function getRolePermissionCatalog() {
  const db = await getDb();
  if (!db) return { roles: identityRoleRows, permissions: PERMISSIONS.map(key => ({ key, ...PERMISSION_METADATA[key] })) };
  await ensureIdentitySeeded();
  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permissions);
  const links = await db.select().from(rolePermissions);
  return { roles: roleRows.map(role => ({ ...role, permissions: links.filter(link => link.roleId === role.id).map(link => permissionRows.find(permission => permission.id === link.permissionId)?.key).filter(Boolean) })), permissions: permissionRows };
}

export async function writeIdentityAudit(input: { schoolId: number; actorUserId?: number; targetUserId?: number; action: string; detail?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ schoolId: input.schoolId, actorUserId: input.actorUserId ?? null, targetUserId: input.targetUserId ?? null, targetType: "identity", actorRole: input.actorUserId ? "institution_user" : "system", action: input.action, detail: input.detail ?? null });
}

export { hasPermission };


export type AcademicActor = { schoolId: number; userId: number; roleKey: IdentityRole };

async function academicCourseAccess(actor: AcademicActor, courseId: number) {
  const db = await getDb();
  if (!db) return false;
  const course = (await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0];
  if (!course) return false;
  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR"].includes(actor.roleKey)) return true;
  if (actor.roleKey === "TEACHER") {
    const rows = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, actor.userId), eq(teacherAssignments.courseId, courseId), eq(teacherAssignments.status, "ACTIVE"))).limit(1);
    return rows.length > 0;
  }
  if (actor.roleKey === "STUDENT") {
    const rows = await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, actor.userId), eq(studentEnrollments.courseId, courseId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).limit(1);
    return rows.length > 0;
  }
  const linked = await db.select({ studentUserId: guardianStudentRelationships.studentUserId }).from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, actor.schoolId), eq(guardianStudentRelationships.guardianUserId, actor.userId)));
  if (!linked.length) return false;
  const rows = await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.courseId, courseId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"), or(...linked.map(item => eq(studentEnrollments.studentUserId, item.studentUserId))))).limit(1);
  return rows.length > 0;
}

export async function getAcademicSnapshot(actor: AcademicActor) {
  const db = await getDb();
  const school = await ensureEduCoreSeeded();
  if (!db || !school || school.id !== actor.schoolId) return null;
  const [years, periods, grades, allCourses, allSubjects, links, assignmentsRows, enrollments, teacherRows, studentRows] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.schoolId, actor.schoolId)).orderBy(desc(academicYears.year)),
    db.select().from(academicPeriods).where(eq(academicPeriods.schoolId, actor.schoolId)).orderBy(academicPeriods.orderIndex),
    db.select().from(gradeLevels).where(eq(gradeLevels.schoolId, actor.schoolId)).orderBy(gradeLevels.levelOrder),
    db.select().from(courses).where(eq(courses.schoolId, actor.schoolId)).orderBy(courses.name),
    db.select().from(subjects).where(eq(subjects.schoolId, actor.schoolId)).orderBy(subjects.name),
    db.select().from(courseSubjects).where(eq(courseSubjects.schoolId, actor.schoolId)),
    db.select().from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.status, "ACTIVE"))),
    db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))),
    db.select({ userId: teacherProfiles.userId, employeeCode: teacherProfiles.employeeCode, specialties: teacherProfiles.specialties }).from(teacherProfiles).where(eq(teacherProfiles.schoolId, actor.schoolId)),
    db.select({ userId: studentProfiles.userId, studentCode: studentProfiles.studentCode, gradeLevel: studentProfiles.gradeLevel, course: studentProfiles.course, status: studentProfiles.status }).from(studentProfiles).where(eq(studentProfiles.schoolId, actor.schoolId)),
  ]);
  let visibleCourseIds = new Set(allCourses.map(course => course.id));
  if (actor.roleKey === "TEACHER") visibleCourseIds = new Set(assignmentsRows.filter(item => item.teacherUserId === actor.userId).map(item => item.courseId));
  if (actor.roleKey === "STUDENT") visibleCourseIds = new Set(enrollments.filter(item => item.studentUserId === actor.userId).map(item => item.courseId));
  if (actor.roleKey === "GUARDIAN") {
    const linked = await db.select({ studentUserId: guardianStudentRelationships.studentUserId }).from(guardianStudentRelationships).where(and(eq(guardianStudentRelationships.schoolId, actor.schoolId), eq(guardianStudentRelationships.guardianUserId, actor.userId)));
    visibleCourseIds = new Set(enrollments.filter(item => linked.some(link => link.studentUserId === item.studentUserId)).map(item => item.courseId));
  }
  const visibleCourses = allCourses.filter(course => visibleCourseIds.has(course.id));
  const visibleLinks = links.filter(link => visibleCourseIds.has(link.courseId));
  const visibleAssignments = assignmentsRows.filter(item => visibleCourseIds.has(item.courseId));
  const visibleEnrollments = enrollments.filter(item => visibleCourseIds.has(item.courseId) && (actor.roleKey !== "STUDENT" || item.studentUserId === actor.userId));
  const userIds = Array.from(new Set([...visibleAssignments.map(item => item.teacherUserId), ...visibleEnrollments.map(item => item.studentUserId)]));
  const people = userIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.schoolId, actor.schoolId), or(...userIds.map(id => eq(users.id, id))))) : [];
  const peopleById = new Map(people.map(person => [person.id, person]));
  return {
    years,
    activeYear: years.find(year => year.status === "ACTIVE") ?? years[0] ?? null,
    periods: periods.filter(period => !period.academicYearId || years.some(year => year.id === period.academicYearId && visibleCourses.some(course => !course.academicYearId || course.academicYearId === year.id))),
    grades,
    courses: visibleCourses.map(course => ({ ...course, studentCount: visibleEnrollments.filter(item => item.courseId === course.id).length, subjectCount: visibleLinks.filter(item => item.courseId === course.id).length, teacherCount: visibleAssignments.filter(item => item.courseId === course.id).length })),
    subjects: allSubjects.filter(subject => visibleLinks.some(link => link.subjectId === subject.id)),
    courseSubjects: visibleLinks,
    teacherAssignments: visibleAssignments.map(item => ({ ...item, teacher: peopleById.get(item.teacherUserId) ?? null })),
    studentEnrollments: visibleEnrollments.map(item => ({ ...item, student: peopleById.get(item.studentUserId) ?? null })),
    teachers: teacherRows.map(teacher => ({ ...teacher, user: peopleById.get(teacher.userId) ?? null })).filter(teacher => actor.roleKey !== "TEACHER" || visibleAssignments.some(item => item.teacherUserId === teacher.userId)),
    students: studentRows.map(student => ({ ...student, user: peopleById.get(student.userId) ?? null })).filter(student => actor.roleKey !== "STUDENT" || student.userId === actor.userId).filter(student => actor.roleKey !== "GUARDIAN" || visibleEnrollments.some(item => item.studentUserId === student.userId)),
    actor,
  };
}

async function ensureAcademicRecordBelongsToSchool(table: typeof courses | typeof subjects | typeof academicYears | typeof gradeLevels, id: number, schoolId: number) {
  const db = await getDb();
  if (!db) return false;
  const row = (await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.schoolId, schoolId))).limit(1))[0];
  return Boolean(row);
}

export async function createAcademicYear(actor: AcademicActor, input: { name: string; year: number; startDate: Date; endDate: Date; status: string }) {
  const db = await getDb();
  if (!db) return null;
  if (input.endDate <= input.startDate) throw new Error("La fecha final debe ser posterior a la fecha inicial.");
  if ((await db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.schoolId, actor.schoolId), eq(academicYears.year, input.year))).limit(1)).length) throw new Error("Ya existe un año académico con ese año en la institución.");
  if (input.status === "ACTIVE") await db.update(academicYears).set({ status: "CLOSED" }).where(eq(academicYears.schoolId, actor.schoolId));
  await db.insert(academicYears).values({ schoolId: actor.schoolId, ...input });
  const row = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, actor.schoolId), eq(academicYears.year, input.year))).limit(1))[0];
  return row;
}

export async function createAcademicGrade(actor: AcademicActor, input: { name: string; shortName: string; levelOrder: number }) {
  const db = await getDb();
  if (!db) return null;
  if ((await db.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.schoolId, actor.schoolId), eq(gradeLevels.shortName, input.shortName))).limit(1)).length) throw new Error("Ya existe ese grado en la institución.");
  await db.insert(gradeLevels).values({ schoolId: actor.schoolId, ...input, status: "ACTIVE" });
  return (await db.select().from(gradeLevels).where(and(eq(gradeLevels.schoolId, actor.schoolId), eq(gradeLevels.shortName, input.shortName))).limit(1))[0];
}

export async function createAcademicCourse(actor: AcademicActor, input: { academicYearId: number; gradeLevelId: number; name: string; code: string; capacity?: number | null }) {
  const db = await getDb();
  if (!db) return null;
  if (!(await ensureAcademicRecordBelongsToSchool(academicYears, input.academicYearId, actor.schoolId)) || !(await ensureAcademicRecordBelongsToSchool(gradeLevels, input.gradeLevelId, actor.schoolId))) throw new Error("El año o grado no pertenece a esta institución.");
  if ((await db.select({ id: courses.id }).from(courses).where(and(eq(courses.schoolId, actor.schoolId), eq(courses.academicYearId, input.academicYearId), eq(courses.code, input.code))).limit(1)).length) throw new Error("Ya existe un curso con ese código en el año académico.");
  const grade = (await db.select().from(gradeLevels).where(eq(gradeLevels.id, input.gradeLevelId)).limit(1))[0];
  await db.insert(courses).values({ schoolId: actor.schoolId, academicYearId: input.academicYearId, gradeLevelId: input.gradeLevelId, name: input.name, code: input.code, grade: grade?.shortName ?? "", groupName: (input.name.split("-")[1] ?? "1").slice(0, 10), year: String((await db.select().from(academicYears).where(eq(academicYears.id, input.academicYearId)).limit(1))[0]?.year ?? ""), capacity: input.capacity ?? null, status: "ACTIVE", teacherName: "Equipo académico", studentsCount: 0, average: 0 });
  return (await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), eq(courses.code, input.code))).orderBy(desc(courses.id)).limit(1))[0];
}

export async function createAcademicSubject(actor: AcademicActor, input: { name: string; shortName: string; code: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;
  if ((await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), eq(subjects.code, input.code))).limit(1)).length) throw new Error("Ya existe una materia con ese código en la institución.");
  await db.insert(subjects).values({ schoolId: actor.schoolId, ...input, description: input.description ?? null, status: "ACTIVE", course: "", teacherName: "Equipo académico" });
  return (await db.select().from(subjects).where(and(eq(subjects.schoolId, actor.schoolId), eq(subjects.code, input.code))).orderBy(desc(subjects.id)).limit(1))[0];
}

export async function attachSubjectToCourse(actor: AcademicActor, input: { courseId: number; subjectId: number }) {
  const db = await getDb();
  if (!db || !(await ensureAcademicRecordBelongsToSchool(courses, input.courseId, actor.schoolId)) || !(await ensureAcademicRecordBelongsToSchool(subjects, input.subjectId, actor.schoolId))) throw new Error("Curso o materia inválidos para esta institución.");
  if ((await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, input.courseId), eq(courseSubjects.subjectId, input.subjectId))).limit(1)).length) return { alreadyExists: true };
  await db.insert(courseSubjects).values({ schoolId: actor.schoolId, courseId: input.courseId, subjectId: input.subjectId, status: "ACTIVE" });
  return { alreadyExists: false };
}

export async function assignAcademicTeacher(actor: AcademicActor, input: { teacherUserId: number; courseId: number; subjectId: number; academicYearId: number; isPrimary: boolean }) {
  const db = await getDb();
  if (!db) return null;
  const teacher = (await db.select({ userId: teacherProfiles.userId }).from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, actor.schoolId), eq(teacherProfiles.userId, input.teacherUserId))).limit(1))[0];
  const course = (await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), eq(courses.id, input.courseId))).limit(1))[0];
  const subject = await ensureAcademicRecordBelongsToSchool(subjects, input.subjectId, actor.schoolId);
  const link = (await db.select({ id: courseSubjects.id }).from(courseSubjects).where(and(eq(courseSubjects.schoolId, actor.schoolId), eq(courseSubjects.courseId, input.courseId), eq(courseSubjects.subjectId, input.subjectId))).limit(1))[0];
  if (!teacher || !course || !subject || !link || course.academicYearId !== input.academicYearId) throw new Error("La asignación requiere docente, curso, materia y año del mismo contexto institucional.");
  await db.insert(teacherAssignments).values({ schoolId: actor.schoolId, ...input, isPrimary: input.isPrimary ? 1 : 0, status: "ACTIVE" });
  return (await db.select().from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, actor.schoolId), eq(teacherAssignments.teacherUserId, input.teacherUserId), eq(teacherAssignments.courseId, input.courseId), eq(teacherAssignments.subjectId, input.subjectId), eq(teacherAssignments.academicYearId, input.academicYearId))).limit(1))[0];
}

export async function enrollAcademicStudent(actor: AcademicActor, input: { studentUserId: number; academicYearId: number; courseId: number }) {
  const db = await getDb();
  if (!db) return null;
  const [student, course, year] = await Promise.all([
    db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(and(eq(studentProfiles.schoolId, actor.schoolId), eq(studentProfiles.userId, input.studentUserId))).limit(1),
    db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), eq(courses.id, input.courseId))).limit(1),
    db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.schoolId, actor.schoolId), eq(academicYears.id, input.academicYearId))).limit(1),
  ]);
  if (!student[0] || !course[0] || !year[0] || course[0].academicYearId !== input.academicYearId) throw new Error("La matrícula requiere estudiante, curso y año del mismo contexto institucional.");
  if ((await db.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, input.studentUserId), eq(studentEnrollments.academicYearId, input.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).limit(1)).length) throw new Error("El estudiante ya tiene una matrícula activa en ese año.");
  await db.insert(studentEnrollments).values({ schoolId: actor.schoolId, ...input, enrollmentStatus: "ACTIVE" });
  return (await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, input.studentUserId), eq(studentEnrollments.academicYearId, input.academicYearId), eq(studentEnrollments.courseId, input.courseId))).orderBy(desc(studentEnrollments.id)).limit(1))[0];
}

export async function transferAcademicStudent(actor: AcademicActor, input: { enrollmentId: number; newCourseId: number; reason?: string }) {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(studentEnrollments).where(and(eq(studentEnrollments.id, input.enrollmentId), eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.enrollmentStatus, "ACTIVE"))).limit(1))[0];
  const newCourse = (await db.select().from(courses).where(and(eq(courses.id, input.newCourseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0];
  if (!current || !newCourse || newCourse.academicYearId !== current.academicYearId || newCourse.id === current.courseId) throw new Error("El cambio requiere una matrícula activa y un curso válido del mismo año.");
  const now = new Date();
  await db.update(studentEnrollments).set({ enrollmentStatus: "TRANSFERRED", withdrawalDate: now }).where(eq(studentEnrollments.id, current.id));
  await db.insert(studentEnrollments).values({ schoolId: actor.schoolId, studentUserId: current.studentUserId, academicYearId: current.academicYearId, courseId: input.newCourseId, enrollmentStatus: "ACTIVE", enrollmentDate: now });
  await db.insert(enrollmentHistory).values({ schoolId: actor.schoolId, enrollmentId: current.id, studentUserId: current.studentUserId, fromCourseId: current.courseId, toCourseId: input.newCourseId, changedByUserId: actor.userId, changedAt: now, reason: input.reason ?? null });
  return { previous: current, newCourseId: input.newCourseId };
}

export async function writeAcademicAudit(actor: AcademicActor, action: string, targetType: string, detail: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ schoolId: actor.schoolId, actorUserId: actor.userId, targetType, actorRole: actor.roleKey, action, detail });
}

import { and, eq, inArray, sql } from "drizzle-orm";
import { courses, piarRecords, schools, studentEnrollments, studentProfiles, users } from "../drizzle/schema";
import { PIAR_GRADES, piarProgress, sanitizePiarValues, type PiarProgress, type PiarStatus, type PiarValues } from "@shared/piar";
import { DEMO_SCHOOL_ID, getDb, type AcademicActor, writeAcademicAudit } from "./db";
import { visibleCourseIds } from "./gradeCenterDb";
import { DEMO_STUDENTS, demoStudentName } from "./demoSeed";

/**
 * PIAR por curso: el docente ve los cursos donde tiene asignación y, en cada uno,
 * los estudiantes matriculados que tienen PIAR. Directivos ven todos los cursos.
 * Estudiantes y acudientes no tienen acceso: el PIAR contiene información sensible.
 */
const PIAR_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR", "TEACHER"];

export const canUsePiar = (actor: AcademicActor) => PIAR_ROLES.includes(actor.roleKey);

function assertPiarActor(actor: AcademicActor) {
  if (!canUsePiar(actor)) throw new Error("No tienes permisos para consultar los PIAR.");
}

let _piarTableEnsured = false;

/** Igual que los recursos del curso: la tabla se crea al primer uso; al crearla se siembra el PIAR demo. */
export async function ensurePiarTable() {
  if (_piarTableEnsured) return;
  const db = await getDb();
  if (!db) return;
  const [existing] = (await db.execute(sql`SHOW TABLES LIKE 'piar_records'`)) as unknown as [unknown[]];
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`piar_records\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`schoolId\` int NOT NULL,
      \`studentUserId\` int NOT NULL,
      \`courseId\` int NOT NULL,
      \`academicYearId\` int NOT NULL,
      \`data\` mediumtext NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'DRAFT',
      \`createdByUserId\` int DEFAULT NULL,
      \`updatedByUserId\` int DEFAULT NULL,
      \`updatedByName\` varchar(160) DEFAULT NULL,
      \`finalizedAt\` timestamp NULL DEFAULT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`piar_records_school_student_year_unique\` (\`schoolId\`,\`studentUserId\`,\`academicYearId\`),
      KEY \`piar_records_course_idx\` (\`schoolId\`,\`courseId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  _piarTableEnsured = true;
  if (Array.isArray(existing) && existing.length === 0) await seedDemoPiar(DEMO_SCHOOL_ID);
}

const parseValues = (data: string): PiarValues => {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? sanitizePiarValues(parsed) : {};
  } catch {
    return {};
  }
};

/** Fecha de hoy `AAAA-MM-DD` en hora de Colombia. */
const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });

const gradeLabel = (grade: string) => {
  const label = `${grade.trim()}°`;
  return (PIAR_GRADES as readonly string[]).includes(label) ? label : "";
};

async function actorName(actor: AcademicActor) {
  const db = await getDb();
  if (!db || !actor.userId) return null;
  const row = (await db.select({ name: users.name }).from(users).where(eq(users.id, actor.userId)).limit(1))[0];
  return row?.name?.trim() || null;
}

/** Datos que el colegio ya conoce: el docente no tiene que volver a escribirlos. */
function prefillValues(input: {
  student: { firstName: string | null; lastName: string | null; name: string | null };
  course: { grade: string };
  school: { name: string; city: string; department: string } | undefined;
  filledBy: string | null;
}): PiarValues {
  const [first, ...rest] = (input.student.name ?? "").trim().split(/\s+/);
  const values: PiarValues = {
    fecha: todayIso(),
    a2_fecha: todayIso(),
    nombres: input.student.firstName?.trim() || first || "",
    apellidos: input.student.lastName?.trim() || rest.join(" "),
    grado: gradeLabel(input.course.grade),
  };
  if (input.school) {
    // Si la ciudad ya trae su región ("Bogotá, Colombia") se respeta tal cual, como en los boletines
    values.lugar = input.school.city.includes(",") ? input.school.city : [input.school.city, input.school.department].filter(Boolean).join(", ");
    values.a2_inst = input.school.name;
  }
  if (input.filledBy) values.dil_nombre = input.filledBy;
  return sanitizePiarValues(values);
}

type ActiveEnrollment = { studentUserId: number; courseId: number; academicYearId: number };

async function activeEnrollments(schoolId: number, courseIds: number[]): Promise<ActiveEnrollment[]> {
  const db = await getDb();
  if (!db || !courseIds.length) return [];
  return db
    .select({ studentUserId: studentEnrollments.studentUserId, courseId: studentEnrollments.courseId, academicYearId: studentEnrollments.academicYearId })
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.schoolId, schoolId), inArray(studentEnrollments.courseId, courseIds), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
}

export type PiarCourseSummary = {
  courseId: number;
  courseName: string;
  grade: string;
  year: string;
  /** Estudiantes matriculados activos. */
  students: number;
  /** Estudiantes del curso con PIAR en el año. */
  withPiar: number;
  finalized: number;
  /** Avance promedio de los PIAR del curso (0–100); `null` sin PIAR. */
  averagePct: number | null;
  lastUpdatedAt: Date | null;
};

/** Cursos visibles para el actor, con el estado de sus PIAR. */
export async function listPiarCourses(actor: AcademicActor): Promise<PiarCourseSummary[]> {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) return [];
  const courseIds = await visibleCourseIds(actor);
  if (!courseIds.length) return [];
  const courseRows = await db.select().from(courses).where(and(eq(courses.schoolId, actor.schoolId), inArray(courses.id, courseIds)));
  const enrollments = await activeEnrollments(actor.schoolId, courseIds);
  const studentIds = Array.from(new Set(enrollments.map(row => row.studentUserId)));
  const records = studentIds.length
    ? await db.select().from(piarRecords).where(and(eq(piarRecords.schoolId, actor.schoolId), inArray(piarRecords.studentUserId, studentIds)))
    : [];
  const recordByStudentYear = new Map(records.map(row => [`${row.studentUserId}:${row.academicYearId}`, row]));

  const summaries = courseRows
    .filter(course => course.academicYearId !== null)
    .map((course): PiarCourseSummary => {
      const enrolled = enrollments.filter(row => row.courseId === course.id && row.academicYearId === course.academicYearId);
      const ofCourse = enrolled.map(row => recordByStudentYear.get(`${row.studentUserId}:${row.academicYearId}`)).filter(row => row !== undefined);
      const pcts = ofCourse.map(row => piarProgress(parseValues(row.data)).pct);
      const lastUpdated = ofCourse.reduce((max, row) => Math.max(max, row.updatedAt.getTime()), 0);
      return {
        courseId: course.id,
        courseName: course.name,
        grade: course.grade,
        year: course.year,
        students: new Set(enrolled.map(row => row.studentUserId)).size,
        withPiar: ofCourse.length,
        finalized: ofCourse.filter(row => row.status === "FINALIZED").length,
        averagePct: pcts.length ? Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length) : null,
        lastUpdatedAt: lastUpdated ? new Date(lastUpdated) : null,
      };
    });
  return summaries.sort((a, b) => a.courseName.localeCompare(b.courseName, "es", { numeric: true }));
}

export type PiarStudentRow = { studentId: number; name: string; code: string | null };

export type PiarRecordSummary = {
  id: number;
  studentId: number;
  status: PiarStatus;
  progress: PiarProgress;
  updatedAt: Date;
  updatedByName: string | null;
};

export type PiarCourseDetail = {
  course: { id: number; name: string; grade: string; year: string };
  /** Todos los matriculados activos: los que no tienen PIAR se pueden agregar. */
  students: PiarStudentRow[];
  records: PiarRecordSummary[];
};

async function loadCourse(actor: AcademicActor, courseId: number) {
  const db = await getDb();
  if (!db) return null;
  if (!(await visibleCourseIds(actor)).includes(courseId)) throw new Error("No tienes acceso a los PIAR de este curso.");
  const course = (await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.schoolId, actor.schoolId))).limit(1))[0];
  if (!course || course.academicYearId === null) throw new Error("El curso no tiene un año académico configurado.");
  return { ...course, academicYearId: course.academicYearId };
}

async function courseStudents(schoolId: number, course: { id: number; academicYearId: number }): Promise<PiarStudentRow[]> {
  const db = await getDb();
  if (!db) return [];
  const enrolled = (await activeEnrollments(schoolId, [course.id])).filter(row => row.academicYearId === course.academicYearId);
  const ids = Array.from(new Set(enrolled.map(row => row.studentUserId)));
  if (!ids.length) return [];
  const [nameRows, profileRows] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.schoolId, schoolId), inArray(users.id, ids))),
    db.select({ userId: studentProfiles.userId, studentCode: studentProfiles.studentCode }).from(studentProfiles).where(and(eq(studentProfiles.schoolId, schoolId), inArray(studentProfiles.userId, ids))),
  ]);
  const nameById = new Map(nameRows.map(row => [row.id, row.name?.trim() ?? ""]));
  const codeById = new Map(profileRows.map(row => [row.userId, row.studentCode]));
  return ids
    .map(id => ({ studentId: id, name: nameById.get(id) || `Estudiante #${id}`, code: codeById.get(id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const summarize = (row: typeof piarRecords.$inferSelect): PiarRecordSummary => ({
  id: row.id,
  studentId: row.studentUserId,
  status: row.status === "FINALIZED" ? "FINALIZED" : "DRAFT",
  progress: piarProgress(parseValues(row.data)),
  updatedAt: row.updatedAt,
  updatedByName: row.updatedByName,
});

/** Estudiantes del curso y los PIAR de quienes lo tienen en el año del curso. */
export async function getPiarCourse(actor: AcademicActor, input: { courseId: number }): Promise<PiarCourseDetail | null> {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) return null;
  const course = await loadCourse(actor, input.courseId);
  if (!course) return null;
  const students = await courseStudents(actor.schoolId, course);
  const ids = students.map(student => student.studentId);
  const records = ids.length
    ? await db.select().from(piarRecords).where(and(eq(piarRecords.schoolId, actor.schoolId), eq(piarRecords.academicYearId, course.academicYearId), inArray(piarRecords.studentUserId, ids)))
    : [];
  return {
    course: { id: course.id, name: course.name, grade: course.grade, year: course.year },
    students,
    records: records.map(summarize),
  };
}

export type PiarRecordDetail = PiarRecordSummary & {
  values: PiarValues;
  finalizedAt: Date | null;
  course: { id: number; name: string };
  student: PiarStudentRow;
};

/** Un PIAR es visible si el actor ve el curso donde el estudiante está matriculado (o el del registro). */
async function loadRecord(actor: AcademicActor, recordId: number) {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(piarRecords).where(and(eq(piarRecords.id, recordId), eq(piarRecords.schoolId, actor.schoolId))).limit(1))[0];
  if (!record) throw new Error("El PIAR no existe.");
  const enrollment = (
    await db
      .select({ courseId: studentEnrollments.courseId })
      .from(studentEnrollments)
      .where(and(eq(studentEnrollments.schoolId, actor.schoolId), eq(studentEnrollments.studentUserId, record.studentUserId), eq(studentEnrollments.academicYearId, record.academicYearId), eq(studentEnrollments.enrollmentStatus, "ACTIVE")))
      .limit(1)
  )[0];
  const courseId = enrollment?.courseId ?? record.courseId;
  const visible = await visibleCourseIds(actor);
  if (!visible.includes(courseId) && !visible.includes(record.courseId)) throw new Error("No tienes acceso a este PIAR.");
  return { record, courseId };
}

export async function getPiarRecord(actor: AcademicActor, input: { recordId: number }): Promise<PiarRecordDetail | null> {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) return null;
  const loaded = await loadRecord(actor, input.recordId);
  if (!loaded) return null;
  const { record, courseId } = loaded;
  const [course, student, profile] = await Promise.all([
    db.select({ id: courses.id, name: courses.name }).from(courses).where(and(eq(courses.id, courseId), eq(courses.schoolId, actor.schoolId))).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, record.studentUserId)).limit(1),
    db.select({ studentCode: studentProfiles.studentCode }).from(studentProfiles).where(and(eq(studentProfiles.schoolId, actor.schoolId), eq(studentProfiles.userId, record.studentUserId))).limit(1),
  ]);
  return {
    ...summarize(record),
    values: parseValues(record.data),
    finalizedAt: record.finalizedAt,
    course: { id: courseId, name: course[0]?.name ?? "" },
    student: { studentId: record.studentUserId, name: student[0]?.name?.trim() || `Estudiante #${record.studentUserId}`, code: profile[0]?.studentCode ?? null },
  };
}

/** Abre el PIAR de un estudiante matriculado en el curso, con los datos que ya conoce el colegio. */
export async function createPiarRecord(actor: AcademicActor, input: { courseId: number; studentId: number }) {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  const course = await loadCourse(actor, input.courseId);
  if (!course) throw new Error("Base de datos no disponible.");
  const enrolled = (await activeEnrollments(actor.schoolId, [course.id])).some(row => row.studentUserId === input.studentId && row.academicYearId === course.academicYearId);
  if (!enrolled) throw new Error("El estudiante no tiene una matrícula activa en este curso.");
  const existing = (await db.select({ id: piarRecords.id }).from(piarRecords).where(and(eq(piarRecords.schoolId, actor.schoolId), eq(piarRecords.studentUserId, input.studentId), eq(piarRecords.academicYearId, course.academicYearId))).limit(1))[0];
  if (existing) throw new Error("El estudiante ya tiene un PIAR en este año académico.");

  const [student, school, filledBy] = await Promise.all([
    db.select({ name: users.name, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, input.studentId)).limit(1),
    db.select({ name: schools.name, city: schools.city, department: schools.department }).from(schools).where(eq(schools.id, actor.schoolId)).limit(1),
    actorName(actor),
  ]);
  const values = prefillValues({ student: student[0] ?? { name: null, firstName: null, lastName: null }, course, school: school[0], filledBy });
  const inserted = await db
    .insert(piarRecords)
    .values({ schoolId: actor.schoolId, studentUserId: input.studentId, courseId: course.id, academicYearId: course.academicYearId, data: JSON.stringify(values), status: "DRAFT", createdByUserId: actor.userId || null, updatedByUserId: actor.userId || null, updatedByName: filledBy })
    .$returningId();
  const id = inserted[0].id;
  await writeAcademicAudit(actor, "piar_created", "piar_record", `${id}:${input.studentId}:${course.id}`);
  return { id };
}

/** Guarda los anexos completos. Editar un PIAR finalizado lo devuelve a borrador. */
export async function savePiarRecord(actor: AcademicActor, input: { recordId: number; values: Record<string, unknown>; finalize?: boolean }) {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  const loaded = await loadRecord(actor, input.recordId);
  if (!loaded) throw new Error("Base de datos no disponible.");
  const values = sanitizePiarValues(input.values);
  const status: PiarStatus = input.finalize ? "FINALIZED" : "DRAFT";
  const updatedByName = await actorName(actor);
  await db
    .update(piarRecords)
    .set({ data: JSON.stringify(values), status, courseId: loaded.courseId, updatedByUserId: actor.userId || null, updatedByName, finalizedAt: input.finalize ? new Date() : null })
    .where(eq(piarRecords.id, loaded.record.id));
  if (input.finalize) await writeAcademicAudit(actor, "piar_finalized", "piar_record", String(loaded.record.id));
  const saved = (await db.select().from(piarRecords).where(eq(piarRecords.id, loaded.record.id)).limit(1))[0];
  return { ...summarize(saved), finalizedAt: saved.finalizedAt };
}

/** Retira el PIAR (p. ej. si se abrió para el estudiante equivocado). */
export async function deletePiarRecord(actor: AcademicActor, input: { recordId: number }) {
  assertPiarActor(actor);
  await ensurePiarTable();
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  const loaded = await loadRecord(actor, input.recordId);
  if (!loaded) throw new Error("Base de datos no disponible.");
  await db.delete(piarRecords).where(eq(piarRecords.id, loaded.record.id));
  await writeAcademicAudit(actor, "piar_deleted", "piar_record", `${loaded.record.id}:${loaded.record.studentUserId}`);
  return { id: loaded.record.id };
}

// ── PIAR demo ───────────────────────────────────────────────────────────────

/** PIAR ficticios en distintos momentos del diligenciamiento, para que el módulo no arranque vacío. */
const DEMO_PIAR: Array<{ student: string; values: PiarValues }> = [
  {
    student: "Samuel Ortiz",
    values: {
      lugar_nac: "Bogotá", fecha_nac: "2009-03-22", tipo_doc: "TI", num_doc: "1.107.845.312",
      depto: "Cundinamarca", municipio: "Bogotá", direccion: "Calle 53 # 21-40", barrio: "Galerías",
      correo: "familia.ortiz@demo.educore.co", centro_prot: "No", etnico: "No", victima: "No",
      dil_rol: "Docente de aula", madre_nombre: "Luz Adriana Ortiz", madre_ocup: "Auxiliar contable", madre_vive: "Sí",
      madre_contacto: "315 402 7781", madre_nivel: "Técnico / Tecnológico", padre_nombre: "Jorge Ortiz", padre_ocup: "Conductor",
      padre_vive: "Sí", padre_contacto: "316 220 1934", padre_nivel: "Bachillerato", hermanos: "1", lugar_ocupa: "Mayor",
      bajo_prot: "No", apoyan: "Madre, padre y abuela materna", vive_con: "Madre, padre y hermana menor", subsidio: "No",
      dim_familia: "Samuel vive con sus padres y su hermana menor en un entorno familiar afectuoso. La madre acompaña las tareas en la tarde y la abuela apoya los días en que ambos padres trabajan.",
      afiliacion: "Sí", eps: "EPS Sanitas", regimen: "Contributivo", emergencia: "Hospital Universitario San Ignacio",
      atendido: "Sí", atendido_frec: "Control con otorrinolaringología cada seis meses", diagnostico: "Sí",
      diagnostico_cual: "Hipoacusia neurosensorial bilateral moderada", terapias: "Sí", ter1: "Fonoaudiología", ter1_f: "Semanal",
      tratamiento: "No", farmaco: "No", productos: "Sí", productos_cual: "Audífonos bilaterales",
      dim_salud: "Usa audífonos bilaterales durante toda la jornada. Requiere ubicarse en las primeras filas y que el docente hable de frente para apoyarse en la lectura labial.",
      normas_edu: "Sí", normas_fam: "Sí", animo: "Estable", pares: "Buena",
      a2_sede: "Sede principal", a2_jornada: "Mañana",
      a2_c1: "Le interesan la biología y el dibujo científico. Disfruta el trabajo en laboratorio y las actividades prácticas. La familia espera que continúe estudios en ciencias de la salud.",
    },
  },
  {
    student: "Tomás Rincón",
    values: {
      lugar_nac: "Tunja", fecha_nac: "2009-08-09", tipo_doc: "TI", num_doc: "1.113.692.405",
      depto: "Cundinamarca", municipio: "Bogotá", direccion: "Carrera 19 # 39-12", barrio: "Teusaquillo",
      centro_prot: "No", etnico: "No", victima: "No", dil_rol: "Docente de aula",
      madre_nombre: "Gloria Rincón", madre_ocup: "Docente", madre_vive: "Sí", madre_contacto: "300 781 5520", madre_nivel: "Universitario",
    },
  },
  { student: "Daniel Torres", values: {} },
];

export async function seedDemoPiar(schoolId: number) {
  const db = await getDb();
  if (!db) return;
  const school = (await db.select({ name: schools.name, city: schools.city, department: schools.department }).from(schools).where(eq(schools.id, schoolId)).limit(1))[0];
  const teacher = (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.openId, "educore-demo-teacher-1")).limit(1))[0];
  for (const demo of DEMO_PIAR) {
    const seed = DEMO_STUDENTS.find(student => demoStudentName(student) === demo.student);
    if (!seed) continue;
    const student = (await db.select({ id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName }).from(users).where(and(eq(users.openId, seed.openId), eq(users.schoolId, schoolId))).limit(1))[0];
    const course = (await db.select().from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.name, seed.course))).limit(1))[0];
    if (!student || !course || course.academicYearId === null) continue;
    const exists = (await db.select({ id: piarRecords.id }).from(piarRecords).where(and(eq(piarRecords.schoolId, schoolId), eq(piarRecords.studentUserId, student.id), eq(piarRecords.academicYearId, course.academicYearId))).limit(1))[0];
    if (exists) continue;
    const values = { ...prefillValues({ student, course, school, filledBy: teacher?.name ?? null }), ...demo.values };
    await db.insert(piarRecords).values({
      schoolId,
      studentUserId: student.id,
      courseId: course.id,
      academicYearId: course.academicYearId,
      data: JSON.stringify(sanitizePiarValues(values)),
      status: "DRAFT",
      createdByUserId: teacher?.id ?? null,
      updatedByUserId: teacher?.id ?? null,
      updatedByName: teacher?.name ?? null,
    });
  }
}

/** Para el reset del dataset demo: vacía los PIAR del colegio y vuelve a sembrar los de ejemplo. */
export async function resetDemoPiar(schoolId: number) {
  await ensurePiarTable();
  const db = await getDb();
  if (!db) return;
  await db.delete(piarRecords).where(eq(piarRecords.schoolId, schoolId));
  await seedDemoPiar(schoolId);
}

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { academicYears, courses, studentEnrollments, students, users } from "../drizzle/schema";
import { DEMO_SCHOOL_ID, getDb, syncStudentCourseArtifacts } from "../server/db";

/**
 * Re-sincroniza el roster heredado (`students`) con las matrículas activas del año en curso.
 * Útil si una base de desarrollo quedó con estudiantes en cursos de prueba.
 * Idempotente: `pnpm exec tsx scripts/repairLegacyRoster.ts`.
 */
async function main(schoolId = DEMO_SCHOOL_ID) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  const [activeYear] = await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.status, "ACTIVE"))).limit(1);
  if (!activeYear) throw new Error("No hay año académico activo.");
  const activeCourses = await db.select({ id: courses.id, name: courses.name }).from(courses).where(and(eq(courses.schoolId, schoolId), eq(courses.academicYearId, activeYear.id)));
  const activeNames = new Set(activeCourses.map(course => course.name));
  const enrollments = await db
    .select({ id: studentEnrollments.id, studentUserId: studentEnrollments.studentUserId, courseId: studentEnrollments.courseId, email: users.email })
    .from(studentEnrollments)
    .innerJoin(users, eq(users.id, studentEnrollments.studentUserId))
    .where(and(eq(studentEnrollments.schoolId, schoolId), eq(studentEnrollments.academicYearId, activeYear.id), eq(studentEnrollments.enrollmentStatus, "ACTIVE")));
  const roster = await db.select({ email: students.email, course: students.course }).from(students).where(eq(students.schoolId, schoolId));
  const courseByEmail = new Map(roster.map(row => [row.email, row.course]));
  let repaired = 0;
  for (const enrollment of enrollments) {
    const current = enrollment.email ? courseByEmail.get(enrollment.email) : undefined;
    const expected = activeCourses.find(course => course.id === enrollment.courseId)?.name;
    if (current === expected && current && activeNames.has(current)) continue;
    await syncStudentCourseArtifacts(schoolId, { studentUserId: enrollment.studentUserId, courseId: enrollment.courseId, enrollmentId: enrollment.id });
    repaired += 1;
    console.log(`Reparado: ${enrollment.email} → ${expected} (antes: ${current ?? "sin fila"})`);
  }
  console.log(`Roster revisado: ${enrollments.length} matrículas activas, ${repaired} reparadas.`);
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

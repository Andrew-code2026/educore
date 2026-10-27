import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  academicObservations,
  academicPeriods,
  academicYears,
  aiConversations,
  announcements,
  assessmentGrades,
  assessments,
  assignments,
  attendance,
  attendanceFollowUpCases,
  attendanceFollowUpNotes,
  attendanceJustificationEvents,
  attendanceJustifications,
  attendanceRecords,
  auditLogs,
  courseResources,
  courseSubjects,
  courses,
  enrollmentHistory,
  events,
  gradeLevels,
  grades,
  gradingScales,
  guardianProfiles,
  guardianStudentRelationships,
  invitations,
  notifications,
  planning,
  reportCardRuns,
  reportCards,
  schoolMemberships,
  studentEnrollments,
  studentProfiles,
  students,
  subjects,
  submissions,
  teacherAssignments,
  teacherProfiles,
  teachers,
  users,
} from "../drizzle/schema";
import { DEMO_SCHOOL_ID, ensureAttendanceTables, ensureCourseResourcesTable, ensureEduCoreSeeded, getDb } from "./db";
import { ensureGradeCenterSeeded } from "./gradeCenterDb";
import { DEMO_ACTIVITIES, DEMO_COURSES, DEMO_STUDENTS } from "./demoSeed";

/** Tablas con datos del colegio demo; roles y permisos se conservan porque son catálogo. */
const SCHOOL_TABLES = [
  attendanceJustificationEvents, attendanceJustifications, attendanceFollowUpNotes, attendanceFollowUpCases, attendanceRecords,
  assessmentGrades, assessments, academicObservations, reportCardRuns, gradingScales,
  submissions, assignments, courseResources, grades, attendance, reportCards, planning,
  events, announcements, notifications, aiConversations, auditLogs,
  enrollmentHistory, studentEnrollments, teacherAssignments, courseSubjects, subjects, courses, gradeLevels, academicPeriods, academicYears,
  students, teachers,
  guardianStudentRelationships, guardianProfiles, studentProfiles, teacherProfiles, invitations, schoolMemberships, users,
] as const;

/** Vacía los datos del colegio demo y vuelve a sembrar el dataset del MVP docente. */
export async function resetDemoData(schoolId = DEMO_SCHOOL_ID) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible. Revisa DATABASE_URL y que MariaDB esté corriendo.");
  await ensureAttendanceTables();
  await ensureCourseResourcesTable();
  for (const table of SCHOOL_TABLES) {
    await db.delete(table).where(eq(table.schoolId, schoolId));
  }
  await ensureEduCoreSeeded();
  await ensureGradeCenterSeeded(schoolId);
}

async function runCli() {
  try {
    console.log("Reseteando datos demo del colegio y sembrando el MVP docente...");
    await resetDemoData();
    console.log(`Listo: ${DEMO_COURSES.length} cursos, ${DEMO_STUDENTS.length} estudiantes y ${DEMO_ACTIVITIES.length} evaluaciones de Biología.`);
    process.exit(0);
  } catch (error) {
    console.error("Error durante el reset:", error);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("seedMvp")) {
  runCli();
}

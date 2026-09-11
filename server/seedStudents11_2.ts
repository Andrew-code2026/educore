import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import {
  academicYears,
  assessmentGrades,
  assessments,
  courses,
  studentEnrollments,
  studentProfiles,
  students,
  users,
} from "../drizzle/schema";
import {
  type AcademicActor,
  createSchoolUser,
  DEMO_SCHOOL_ID,
  enrollAcademicStudent,
  getDb,
} from "./db";

export interface TestStudentDef {
  lastName: string;
  firstName: string;
  email: string;
  studentCode: string;
  guardianName?: string;
}

export const TEST_STUDENTS_11_2: TestStudentDef[] = [
  { lastName: "Alvarez Giraldo", firstName: "Juliana", email: "juliana.alvarez@demo.educore.co", studentCode: "EST-11-2-01" },
  { lastName: "Angarita Cachaya", firstName: "María Camila", email: "maria.angarita@demo.educore.co", studentCode: "EST-11-2-02" },
  { lastName: "Aponza Viveros", firstName: "Yonis Mario", email: "yonis.aponza@demo.educore.co", studentCode: "EST-11-2-03" },
  { lastName: "Barrera Zapata", firstName: "Nicolas", email: "nicolas.barrera@demo.educore.co", studentCode: "EST-11-2-04" },
  { lastName: "Caicedo Cortes", firstName: "Laura Sofia", email: "laura.caicedo@demo.educore.co", studentCode: "EST-11-2-05" },
  { lastName: "Caicedo Puerto", firstName: "Ana Sofia", email: "ana.caicedo@demo.educore.co", studentCode: "EST-11-2-06" },
  { lastName: "Castro Sanchez", firstName: "Sofia", email: "sofia.castro@demo.educore.co", studentCode: "EST-11-2-07" },
  { lastName: "Certuche Paz", firstName: "Salome Sofia", email: "salome.certuche@demo.educore.co", studentCode: "EST-11-2-08" },
  { lastName: "Cespedes Duarte", firstName: "Santiago", email: "santiago.cespedes@demo.educore.co", studentCode: "EST-11-2-09" },
  { lastName: "Cisneros Garcia", firstName: "Emanuel", email: "emanuel.cisneros@demo.educore.co", studentCode: "EST-11-2-10" },
  { lastName: "Diaz Camacho", firstName: "Juan Esteban", email: "juan.diaz@demo.educore.co", studentCode: "EST-11-2-11" },
  { lastName: "Dorado Varon", firstName: "Carlos Andres", email: "carlos.dorado@demo.educore.co", studentCode: "EST-11-2-12" },
  { lastName: "Garces Murillo", firstName: "Isabella", email: "isabella.garces@demo.educore.co", studentCode: "EST-11-2-13" },
  { lastName: "Garces Murillo", firstName: "Santiago", email: "santiago.garces@demo.educore.co", studentCode: "EST-11-2-14" },
  { lastName: "Henao Lozano", firstName: "Sara Catalina", email: "sara.henao@demo.educore.co", studentCode: "EST-11-2-15" },
  { lastName: "Hernandez Cujar", firstName: "Juan Jose", email: "juan.hernandez@demo.educore.co", studentCode: "EST-11-2-16" },
  { lastName: "Ladino Maldonado", firstName: "Andres", email: "andres.ladino@demo.educore.co", studentCode: "EST-11-2-17" },
  { lastName: "Londoño Perdomo", firstName: "Geico Stil", email: "geico.londono@demo.educore.co", studentCode: "EST-11-2-18" },
  { lastName: "Marquinez Sevillano", firstName: "Adriana Lucia", email: "adriana.marquinez@demo.educore.co", studentCode: "EST-11-2-19" },
  { lastName: "Montilla Castaño", firstName: "Ashley Jihana", email: "ashley.montilla@demo.educore.co", studentCode: "EST-11-2-20" },
  { lastName: "Montoya Zorrilla", firstName: "Valeria", email: "valeria.montoya@demo.educore.co", studentCode: "EST-11-2-21" },
  { lastName: "Nazcan Castaño", firstName: "Valeria", email: "valeria.nazcan@demo.educore.co", studentCode: "EST-11-2-22" },
  { lastName: "Nieto Vivas", firstName: "Gabriela", email: "gabriela.nieto@demo.educore.co", studentCode: "EST-11-2-23" },
  { lastName: "Noguera Rojas", firstName: "Natalia", email: "natalia.noguera@demo.educore.co", studentCode: "EST-11-2-24" },
  { lastName: "Pazmin Gonzalez", firstName: "Catalina", email: "catalina.pazmin@demo.educore.co", studentCode: "EST-11-2-25" },
  { lastName: "Puerta Montenegro", firstName: "Gleiner Santiago", email: "gleiner.puerta@demo.educore.co", studentCode: "EST-11-2-26" },
  { lastName: "Rojas Arenas", firstName: "Juan Jose", email: "juan.rojas.arenas@demo.educore.co", studentCode: "EST-11-2-27" },
  { lastName: "Rojas Salazar", firstName: "Maria Del Mar", email: "maria.rojas.salazar@demo.educore.co", studentCode: "EST-11-2-28" },
  { lastName: "Salinas Medina", firstName: "Juan", email: "juan.salinas@demo.educore.co", studentCode: "EST-11-2-29" },
  { lastName: "Tovar Paz", firstName: "Danna", email: "danna.tovar@demo.educore.co", studentCode: "EST-11-2-30" },
  { lastName: "Toro Acosta", firstName: "Mariangel", email: "mariangel.toro@demo.educore.co", studentCode: "EST-11-2-31" },
  { lastName: "Valencia Martinez", firstName: "Julian", email: "julian.valencia@demo.educore.co", studentCode: "EST-11-2-32" },
  { lastName: "Vasquez Lopez", firstName: "Santiago", email: "santiago.vasquez@demo.educore.co", studentCode: "EST-11-2-33" },
];

const PASTEL_AVATARS = [
  "#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe", "#cffafe", "#ffedd5", "#f1f5f9"
];

export async function seedStudents11_2(schoolId = DEMO_SCHOOL_ID) {
  const db = await getDb();
  if (!db) {
    throw new Error("Base de datos no disponible para seeding.");
  }

  // 1. Identificar el curso 11-2 y su año académico
  const course = (
    await db
      .select()
      .from(courses)
      .where(and(eq(courses.schoolId, schoolId), eq(courses.name, "11-2")))
      .limit(1)
  )[0];

  if (!course) {
    throw new Error(`Curso '11-2' no encontrado en la institución ${schoolId}.`);
  }

  const academicYearId = course.academicYearId;
  if (!academicYearId) {
    throw new Error(`El curso '11-2' no tiene un año académico asignado.`);
  }

  const academicYear = (
    await db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, academicYearId)))
      .limit(1)
  )[0];

  if (!academicYear) {
    throw new Error(`Año académico id ${academicYearId} no encontrado.`);
  }

  // 2. Evaluaciones existentes en 11-2 (para asegurar calificaciones listas en Grade Center)
  const courseAssessments = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.schoolId, schoolId), eq(assessments.courseId, course.id)));

  const actor: AcademicActor = {
    schoolId,
    userId: 1,
    roleKey: "SCHOOL_ADMIN",
  };

  const addedStudents: Array<{ id: number; name: string; email: string }> = [];
  const existingStudents: Array<{ id: number; name: string; email: string }> = [];

  for (let i = 0; i < TEST_STUDENTS_11_2.length; i++) {
    const studentDef = TEST_STUDENTS_11_2[i];
    const expectedName = `${studentDef.firstName} ${studentDef.lastName}`.trim();

    // Comprobar si el usuario ya existe por email
    let user = (
      await db
        .select()
        .from(users)
        .where(eq(users.email, studentDef.email))
        .limit(1)
    )[0];

    let isNewlyCreated = false;

    if (!user) {
      // Crear estudiante usando la función canónica de dominio createSchoolUser
      const profileResult = await createSchoolUser({
        schoolId,
        firstName: studentDef.firstName,
        lastName: studentDef.lastName,
        email: studentDef.email,
        roleKey: "STUDENT",
        status: "ACTIVE",
        studentCode: studentDef.studentCode,
        gradeLevel: "11",
        course: "11-2",
        actorUserId: actor.userId,
      });

      user = (
        await db
          .select()
          .from(users)
          .where(eq(users.email, studentDef.email))
          .limit(1)
      )[0];

      if (!user) {
        throw new Error(`Error al persistir el usuario para ${studentDef.email}`);
      }

      isNewlyCreated = true;
    }

    // Comprobar matrícula activa en 11-2
    const existingEnrollment = (
      await db
        .select()
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.schoolId, schoolId),
            eq(studentEnrollments.studentUserId, user.id),
            eq(studentEnrollments.academicYearId, academicYearId),
            eq(studentEnrollments.enrollmentStatus, "ACTIVE")
          )
        )
        .limit(1)
    )[0];

    let enrollment: typeof existingEnrollment | null | undefined = existingEnrollment;

    if (!existingEnrollment) {
      // Matricular al estudiante en el curso 11-2 usando enrollAcademicStudent
      enrollment = (
        await enrollAcademicStudent(actor, {
          studentUserId: user.id,
          academicYearId,
          courseId: course.id,
        })
      ) ?? undefined;
    }

    if (enrollment) {
      // Asegurar filas en assessmentGrades para que las evaluaciones existentes en 11-2
      // queden listas para calificar normalmente en el Grade Center
      for (const assessment of courseAssessments) {
        const existingGrade = (
          await db
            .select()
            .from(assessmentGrades)
            .where(
              and(
                eq(assessmentGrades.schoolId, schoolId),
                eq(assessmentGrades.assessmentId, assessment.id),
                eq(assessmentGrades.studentId, user.id)
              )
            )
            .limit(1)
        )[0];

        if (!existingGrade) {
          await db.insert(assessmentGrades).values({
            schoolId,
            assessmentId: assessment.id,
            studentId: user.id,
            studentEnrollmentId: enrollment.id,
            courseId: course.id,
            subjectId: assessment.subjectId,
            academicYearId,
            academicPeriodId: assessment.academicPeriodId,
            value: null,
            comment: null,
            status: "PENDING",
          });
        }
      }
    }

    // Asegurar presencia en la tabla heredada 'students' para vistas secundarias/snapshot
    const existingLegacy = (
      await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.course, "11-2"),
            eq(students.email, studentDef.email)
          )
        )
        .limit(1)
    )[0];

    if (!existingLegacy) {
      await db.insert(students).values({
        schoolId,
        name: expectedName,
        email: studentDef.email,
        course: "11-2",
        gradeLevel: "11",
        guardianName: studentDef.guardianName || `Acudiente de ${studentDef.firstName}`,
        status: "Activo",
        avatarColor: PASTEL_AVATARS[i % PASTEL_AVATARS.length],
      });
    }

    if (isNewlyCreated) {
      addedStudents.push({ id: user.id, name: expectedName, email: user.email ?? "" });
    } else {
      existingStudents.push({ id: user.id, name: expectedName, email: user.email ?? "" });
    }
  }

  // Actualizar conteo de estudiantes en la tabla courses
  const totalActiveEnrollments = (
    await db
      .select({ id: studentEnrollments.id })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.schoolId, schoolId),
          eq(studentEnrollments.courseId, course.id),
          eq(studentEnrollments.academicYearId, academicYearId),
          eq(studentEnrollments.enrollmentStatus, "ACTIVE")
        )
      )
  ).length;

  await db
    .update(courses)
    .set({ studentsCount: totalActiveEnrollments })
    .where(eq(courses.id, course.id));

  return {
    course: {
      id: course.id,
      name: course.name,
      academicYear: academicYear.name,
      totalEnrolled: totalActiveEnrollments,
    },
    totalProcessed: TEST_STUDENTS_11_2.length,
    addedCount: addedStudents.length,
    existingCount: existingStudents.length,
    addedStudents,
    existingStudents,
  };
}

async function runCli() {
  console.log("==================================================");
  console.log("EDUCORE: POBLAR ESTUDIANTES DE PRUEBA EN CURSO 11-2");
  console.log("==================================================");

  try {
    const result = await seedStudents11_2();
    console.log(`\nCurso modificado: ${result.course.name} (ID: ${result.course.id}, ${result.course.academicYear})`);
    console.log(`Total estudiantes procesados: ${result.totalProcessed}`);
    console.log(`Nuevos estudiantes agregados: ${result.addedCount}`);
    console.log(`Estudiantes ya existentes: ${result.existingCount}`);
    console.log(`Capacidad/Matrícula actual del curso: ${result.course.totalEnrolled} estudiantes`);

    if (result.addedCount > 0) {
      console.log("\nEstudiantes agregados:");
      result.addedStudents.forEach((s, idx) => {
        console.log(`  ${idx + 1}. [ID: ${s.id}] ${s.name} (${s.email})`);
      });
    }

    if (result.existingCount > 0) {
      console.log("\nEstudiantes que ya existían previamente:");
      result.existingStudents.forEach((s, idx) => {
        console.log(`  ${idx + 1}. [ID: ${s.id}] ${s.name} (${s.email})`);
      });
    }

    console.log("\nOperación completada con éxito.");
    process.exit(0);
  } catch (error) {
    console.error("\nError durante el seeding:", error);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("seedStudents11_2")) {
  runCli();
}

import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";
import {
  createDemoAssignment,
  DEMO_SCHOOL_ID,
  EduRole,
  getEduCoreSnapshot,
  gradeDemoSubmission,
  recordDemoAttendance,
  saveAiConversation,
  submitDemoAssignment,
  updateDemoGrade,
  updateSchoolSettings,
  createAcademicPeriod,
  updateAcademicPeriod,
  writeAuditLog,
  acceptInvitation,
  createGuardianRelationship,
  createInvitation,
  createSchoolUser,
  getDemoIdentityContext,
  getMembershipContext,
  getRolePermissionCatalog,
  getSchoolUserProfile,
  listGuardianStudents,
  listInvitations,
  listSchoolUsers,
  setUserStatus,
  updateMembershipRole,
  getAcademicSnapshot,
  createAcademicYear,
  createAcademicGrade,
  createAcademicCourse,
  createAcademicSubject,
  attachSubjectToCourse,
  assignAcademicTeacher,
  enrollAcademicStudent,
  transferAcademicStudent,
  writeAcademicAudit,
} from "./db";
import {
  createGradeCenterAssessment,
  generateGradeCenterReportCards,
  getGradeCenterContext,
  saveAcademicObservation,
  saveGradeCenterGrades,
  updateGradeCenterAssessment,
} from "./gradeCenterDb";
import { hasPermission, IDENTITY_ROLES, type IdentityRole } from "./identityModel";
import type { TrpcContext } from "./_core/context";

const roleSchema = z.enum(["admin", "teacher", "student", "guardian"]);
const roleGuard = (role: EduRole, allowed: EduRole[]) => {
  if (!allowed.includes(role)) throw new Error("No tienes permisos para realizar esta acción.");
};

async function resolveDemoActor(role: EduRole) {
  const context = await getDemoIdentityContext(role);
  const roleKey = ({ admin: "SCHOOL_ADMIN", teacher: "TEACHER", student: "STUDENT", guardian: "GUARDIAN" } as const)[role] as IdentityRole;
  return { schoolId: DEMO_SCHOOL_ID, userId: context?.user.id ?? 0, roleKey, permissions: context?.permissions ?? [] };
}

async function resolveActor(ctx: TrpcContext, demoRole: EduRole) {
  if (ctx.user) {
    const schoolId = ctx.user.schoolId ?? DEMO_SCHOOL_ID;
    const context = await getMembershipContext(ctx.user.id, schoolId);
    if (!context) throw new TRPCError({ code: "FORBIDDEN", message: "Tu usuario no tiene una membresía activa en esta institución." });
    return { schoolId, userId: context.user.id, roleKey: context.membership.roleKey as IdentityRole, permissions: context.permissions };
  }
  return resolveDemoActor(demoRole);
}

async function requirePermission(ctx: TrpcContext, role: EduRole, permission: string, isMutation = false) {
  if (isMutation && !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tienes permisos para realizar esta acción. Se requiere autenticación." });
  }
  const actor = await resolveActor(ctx, role);
  if (!hasPermission(actor.roleKey, permission) || (actor.userId === 0 && process.env.DATABASE_URL)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." });
  }
  return actor;
}

async function requireAcademicActor(ctx: TrpcContext, role: EduRole, permission?: string, isMutation = false) {
  if (isMutation && !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tienes permisos para realizar esta acción. Se requiere autenticación." });
  }
  const actor = await resolveActor(ctx, role);
  if (permission && !hasPermission(actor.roleKey, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para gestionar la estructura académica." });
  return actor;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginDemo: publicProcedure.input(z.object({ role: roleSchema })).mutation(async ({ input, ctx }) => {
      const demoContext = await getDemoIdentityContext(input.role, DEMO_SCHOOL_ID);
      if (!demoContext) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Identidad demo no disponible en el sistema." });
      }
      const sessionToken = await sdk.createSessionToken(demoContext.user.openId, {
        name: demoContext.user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return {
        success: true as const,
        user: demoContext.user,
        roleKey: demoContext.membership.roleKey,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  identity: router({
    users: publicProcedure.input(z.object({ role: roleSchema, search: z.string().max(120).optional(), roleKey: z.enum(["ALL", ...IDENTITY_ROLES]).default("ALL"), status: z.enum(["ALL", "ACTIVE", "INVITED", "SUSPENDED", "INACTIVE"]).default("ALL"), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) })).query(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.view");
      return listSchoolUsers({ schoolId: actor.schoolId, search: input.search, roleKey: input.roleKey, status: input.status, limit: input.limit, offset: input.offset });
    }),
    profile: publicProcedure.input(z.object({ role: roleSchema, userId: z.number().int() })).query(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.view");
      if (actor.roleKey === "GUARDIAN") {
        if (actor.userId !== input.userId) {
          const linked = await listGuardianStudents(actor.schoolId, actor.userId);
          if (!linked.some(s => s.id === input.userId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para consultar este perfil." });
          }
        }
      } else if (actor.roleKey === "STUDENT") {
        if (actor.userId !== input.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para consultar este perfil." });
        }
      }
      return getSchoolUserProfile(actor.schoolId, input.userId);
    }),
    createUser: publicProcedure.input(z.object({ role: roleSchema, firstName: z.string().min(2).max(100), lastName: z.string().min(2).max(100), email: z.string().email().max(320), roleKey: z.enum(IDENTITY_ROLES), status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "INACTIVE"]), phone: z.string().max(40).optional(), studentCode: z.string().max(60).optional(), gradeLevel: z.string().max(20).optional(), course: z.string().max(60).optional() })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.create", true);
      return createSchoolUser({ ...input, schoolId: actor.schoolId, actorUserId: actor.userId || undefined });
    }),
    changeRole: publicProcedure.input(z.object({ role: roleSchema, userId: z.number().int(), roleKey: z.enum(IDENTITY_ROLES) })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.update", true);
      if (input.userId === actor.userId && input.roleKey !== "SCHOOL_ADMIN") throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes retirar tu propio rol administrativo desde esta vista." });
      return updateMembershipRole({ schoolId: actor.schoolId, userId: input.userId, roleKey: input.roleKey, actorUserId: actor.userId || undefined });
    }),
    setStatus: publicProcedure.input(z.object({ role: roleSchema, userId: z.number().int(), status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]) })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.disable", true);
      if (input.userId === actor.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes suspender tu propio acceso." });
      return setUserStatus({ schoolId: actor.schoolId, userId: input.userId, status: input.status, actorUserId: actor.userId || undefined });
    }),
    invitations: publicProcedure.input(z.object({ role: roleSchema })).query(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.view");
      return listInvitations(actor.schoolId);
    }),
    createInvitation: publicProcedure.input(z.object({ role: roleSchema, email: z.string().email().max(320), roleKey: z.enum(IDENTITY_ROLES) })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.create", true);
      const result = await createInvitation({ schoolId: actor.schoolId, email: input.email, roleKey: input.roleKey, actorUserId: actor.userId });
      return result?.invitation ? { id: result.invitation.id, email: result.invitation.email, roleKey: result.invitation.roleKey, status: result.invitation.status, expiresAt: result.invitation.expiresAt, delivery: "development_fallback" as const } : null;
    }),
    acceptInvitation: publicProcedure.input(z.object({ token: z.string().min(20), firstName: z.string().min(2).max(100), lastName: z.string().min(2).max(100) })).mutation(({ input }) => acceptInvitation(input)),
    relationships: publicProcedure.input(z.object({ role: roleSchema, guardianUserId: z.number().int().optional() })).query(async ({ input, ctx }) => {
      const actor = await resolveActor(ctx, input.role);
      let guardianId = input.guardianUserId;
      if (actor.roleKey === "GUARDIAN") {
        guardianId = actor.userId;
      } else {
        if (!hasPermission(actor.roleKey, "students.view")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para consultar relaciones familiares." });
        }
      }
      if (!guardianId) throw new TRPCError({ code: "BAD_REQUEST", message: "No se pudo determinar el acudiente." });
      return listGuardianStudents(actor.schoolId, guardianId);
    }),
    createRelationship: publicProcedure.input(z.object({ role: roleSchema, guardianUserId: z.number().int(), studentUserId: z.number().int(), relationshipType: z.enum(["PARENT", "LEGAL_GUARDIAN", "OTHER"]), isPrimary: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "users.update", true);
      return createGuardianRelationship({ ...input, schoolId: actor.schoolId, actorUserId: actor.userId || undefined });
    }),
    roles: publicProcedure.input(z.object({ role: roleSchema })).query(async ({ input, ctx }) => {
      await requirePermission(ctx, input.role, "settings.view");
      return getRolePermissionCatalog();
    }),
  }),
  academic: router({
    snapshot: publicProcedure.input(z.object({ role: roleSchema })).query(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role);
      if (!hasPermission(actor.roleKey, "courses.view") && !hasPermission(actor.roleKey, "students.view")) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso al contexto académico." });
      return getAcademicSnapshot(actor);
    }),
    createYear: publicProcedure.input(z.object({ role: roleSchema, name: z.string().min(4).max(80), year: z.number().int().min(2000).max(2100), startDate: z.coerce.date(), endDate: z.coerce.date(), status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]) })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "settings.update", true);
      const result = await createAcademicYear(actor, input);
      await writeAcademicAudit(actor, "academic_year_created", "academic_year", String(input.year));
      return result;
    }),
    createGrade: publicProcedure.input(z.object({ role: roleSchema, name: z.string().min(2).max(80), shortName: z.string().min(1).max(20), levelOrder: z.number().int().min(1).max(20) })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "courses.create", true);
      const result = await createAcademicGrade(actor, input);
      await writeAcademicAudit(actor, "grade_created", "grade_level", input.shortName);
      return result;
    }),
    createCourse: publicProcedure.input(z.object({ role: roleSchema, academicYearId: z.number().int(), gradeLevelId: z.number().int(), name: z.string().min(2).max(60), code: z.string().min(1).max(30), capacity: z.number().int().min(1).max(200).nullable().optional() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "courses.create", true);
      const result = await createAcademicCourse(actor, input);
      await writeAcademicAudit(actor, "course_created", "course", input.code);
      return result;
    }),
    createSubject: publicProcedure.input(z.object({ role: roleSchema, name: z.string().min(2).max(120), shortName: z.string().min(1).max(40), code: z.string().min(1).max(30), description: z.string().max(500).optional() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "courses.create", true);
      const result = await createAcademicSubject(actor, input);
      await writeAcademicAudit(actor, "subject_created", "subject", input.code);
      return result;
    }),
    attachSubject: publicProcedure.input(z.object({ role: roleSchema, courseId: z.number().int(), subjectId: z.number().int() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "courses.update", true);
      const result = await attachSubjectToCourse(actor, input);
      await writeAcademicAudit(actor, "subject_attached_to_course", "course_subject", `${input.courseId}:${input.subjectId}`);
      return result;
    }),
    assignTeacher: publicProcedure.input(z.object({ role: roleSchema, teacherUserId: z.number().int(), courseId: z.number().int(), subjectId: z.number().int(), academicYearId: z.number().int(), isPrimary: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "courses.update", true);
      const result = await assignAcademicTeacher(actor, input);
      await writeAcademicAudit(actor, "teacher_assigned", "teacher_assignment", `${input.teacherUserId}:${input.courseId}:${input.subjectId}`);
      return result;
    }),
    enrollStudent: publicProcedure.input(z.object({ role: roleSchema, studentUserId: z.number().int(), academicYearId: z.number().int(), courseId: z.number().int() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "students.update", true);
      const result = await enrollAcademicStudent(actor, input);
      await writeAcademicAudit(actor, "student_enrolled", "student_enrollment", `${input.studentUserId}:${input.courseId}`);
      return result;
    }),
    bulkEnroll: publicProcedure.input(z.object({ role: roleSchema, studentUserIds: z.array(z.number().int()).min(1).max(100), academicYearId: z.number().int(), courseId: z.number().int() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "students.update", true);
      const results = [];
      for (const studentUserId of input.studentUserIds) results.push(await enrollAcademicStudent(actor, { studentUserId, academicYearId: input.academicYearId, courseId: input.courseId }));
      await writeAcademicAudit(actor, "students_bulk_enrolled", "student_enrollment", `${input.studentUserIds.length}:${input.courseId}`);
      return results;
    }),
    transferStudent: publicProcedure.input(z.object({ role: roleSchema, enrollmentId: z.number().int(), newCourseId: z.number().int(), reason: z.string().max(300).optional() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "students.update", true);
      const result = await transferAcademicStudent(actor, input);
      await writeAcademicAudit(actor, "student_course_changed", "student_enrollment", `${input.enrollmentId}:${input.newCourseId}`);
      return result;
    }),
  }),
  gradeCenter: router({
    context: publicProcedure.input(z.object({ role: roleSchema, courseId: z.number().int().optional(), subjectId: z.number().int().optional(), academicPeriodId: z.number().int().optional() })).query(async ({ input, ctx }) => {
      const actor = await resolveActor(ctx, input.role);
      if (!hasPermission(actor.roleKey, "grades.view") && !hasPermission(actor.roleKey, "courses.view")) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a las calificaciones." });
      return getGradeCenterContext(actor, input);
    }),
    createAssessment: publicProcedure.input(z.object({ role: roleSchema, academicYearId: z.number().int(), academicPeriodId: z.number().int(), courseId: z.number().int(), subjectId: z.number().int(), title: z.string().min(3).max(180), description: z.string().max(1000).optional(), assessmentType: z.enum(["QUIZ", "TALLER", "EXAMEN", "PROYECTO", "ACTIVIDAD", "PARTICIPACION", "RECUPERACION", "OTRO"]), date: z.coerce.date(), maxValue: z.number().positive().max(100), weight: z.number().min(0).max(100), status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).default("DRAFT") })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "grades.update", true);
      return createGradeCenterAssessment(actor, input);
    }),
    updateAssessment: publicProcedure.input(z.object({ role: roleSchema, id: z.number().int(), title: z.string().min(3).max(180).optional(), description: z.string().max(1000).optional(), date: z.coerce.date().optional(), weight: z.number().min(0).max(100).optional(), status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "grades.update", true);
      return updateGradeCenterAssessment(actor, input);
    }),
    saveGrades: publicProcedure.input(z.object({ role: roleSchema, assessmentId: z.number().int(), grades: z.array(z.object({ studentId: z.number().int(), value: z.number().min(0).nullable(), comment: z.string().max(500).optional() })).min(1) })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "grades.update", true);
      return saveGradeCenterGrades(actor, input);
    }),
    saveObservation: publicProcedure.input(z.object({ role: roleSchema, studentId: z.number().int(), academicYearId: z.number().int(), academicPeriodId: z.number().int(), assessmentId: z.number().int().optional(), text: z.string().min(3).max(1200), status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT") })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "grades.update", true);
      return saveAcademicObservation(actor, input);
    }),
    generateReportCards: publicProcedure.input(z.object({ role: roleSchema, academicYearId: z.number().int(), academicPeriodId: z.number().int(), courseId: z.number().int() })).mutation(async ({ input, ctx }) => {
      const actor = await requireAcademicActor(ctx, input.role, "reports.export", true);
      return generateGradeCenterReportCards(actor, input);
    }),
    generateObservationDraft: publicProcedure.input(z.object({ role: roleSchema, studentName: z.string().min(2), context: z.string().min(10).max(3000) })).mutation(async ({ input, ctx }) => {
      await requirePermission(ctx, input.role, "ai.use", true);
      let text = "";
      try {
        const response = await invokeLLM({ messages: [{ role: "system", content: "Eres EduCore AI. Genera solo un borrador de observación académica neutral, cálida y editable en español. No diagnostiques, no etiquetes y no tomes decisiones." }, { role: "user", content: `Estudiante: ${input.studentName}\nDatos autorizados:\n${input.context}` }] });
        const content = response.choices?.[0]?.message?.content;
        text = typeof content === "string" ? content : "";
      } catch { /* fallback below */ }
      return { text: text || `Borrador: ${input.studentName} ha mostrado avances observables en las actividades revisadas. Se recomienda continuar acompañando su proceso y revisar las próximas evidencias de aprendizaje.`, reviewed: false };
    }),
  }),
  educore: router({
    snapshot: publicProcedure.input(z.object({ role: roleSchema, selectedStudentId: z.number().int().optional() })).query(async ({ input, ctx }) => {
      const actor = await resolveActor(ctx, input.role);
      return getEduCoreSnapshot(input.role, input.selectedStudentId, actor);
    }),
    createAssignment: publicProcedure.input(z.object({
      role: roleSchema,
      title: z.string().min(3).max(180),
      subject: z.string().min(2),
      course: z.string().min(2),
      description: z.string().min(5),
      dueAt: z.coerce.date(),
      points: z.number().int().min(1).max(1000),
      teacherName: z.string().min(2),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "assignments.create", true);
      const result = await createDemoAssignment(input);
      await writeAuditLog(input.role, "create_assignment", input.title, actor.schoolId);
      return result;
    }),
    submitAssignment: publicProcedure.input(z.object({
      role: roleSchema,
      assignmentId: z.number().int(),
      studentName: z.string().min(2),
      fileName: z.string().min(1),
      comment: z.string().max(500).default(""),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "assignments.create", true);
      const result = await submitDemoAssignment(input);
      await writeAuditLog(input.role, "submit_assignment", `${input.assignmentId}:${input.studentName}`, actor.schoolId);
      return result;
    }),
    gradeSubmission: publicProcedure.input(z.object({
      role: roleSchema,
      submissionId: z.number().int(),
      grade: z.number().min(0).max(5),
      comment: z.string().max(500).default(""),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "grades.update", true);
      const result = await gradeDemoSubmission(input);
      await writeAuditLog(input.role, "grade_submission", `${input.submissionId}:${input.grade}`, actor.schoolId);
      return result;
    }),
    updateGrade: publicProcedure.input(z.object({
      role: roleSchema,
      studentName: z.string().min(2),
      course: z.string().min(2),
      subject: z.string().min(2),
      period: z.string().min(2),
      value: z.number().min(0).max(5),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "grades.update", true);
      const result = await updateDemoGrade(input);
      await writeAuditLog(input.role, "update_grade", `${input.studentName}:${input.subject}:${input.value}`, actor.schoolId);
      return result;
    }),
    recordAttendance: publicProcedure.input(z.object({
      role: roleSchema,
      course: z.string().min(2),
      date: z.coerce.date(),
      records: z.array(z.object({ studentName: z.string().min(2), status: z.enum(["Presente", "Ausente", "Tardanza", "Excusa"]), note: z.string().optional() })).min(1),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "attendance.update", true);
      const result = await recordDemoAttendance(input);
      await writeAuditLog(input.role, "record_attendance", `${input.course}:${input.records.length}`, actor.schoolId);
      return result;
    }),
    updateSchool: publicProcedure.input(z.object({
      role: roleSchema,
      name: z.string().min(3).max(180),
      shortName: z.string().min(2).max(80),
      city: z.string().min(2).max(80),
      department: z.string().min(2).max(100),
      country: z.string().min(2).max(80),
      description: z.string().min(10).max(1000),
      website: z.string().url().max(180),
      email: z.string().email().max(180),
      phone: z.string().min(5).max(40),
      address: z.string().min(3).max(180),
      academicYear: z.string().min(4).max(20),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      surfaceColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      mutedTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      themeMode: z.enum(["light", "dark"]),
      borderRadius: z.string().regex(/^\d+(px|rem)$/),
      logoUrl: z.string().max(500).nullable().default(null),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "institution.update", true);
      const result = await updateSchoolSettings({ ...input, schoolId: actor.schoolId });
      await writeAuditLog(input.role, "update_school_settings", input.name, actor.schoolId);
      return result;
    }),
    uploadSchoolLogo: publicProcedure.input(z.object({
      role: roleSchema,
      fileName: z.string().regex(/\.(png|jpe?g|svg)$/i),
      contentType: z.enum(["image/png", "image/jpeg", "image/svg+xml"]),
      dataBase64: z.string().min(20).max(4_000_000),
    })).mutation(async ({ input, ctx }) => {
      const actor = await requirePermission(ctx, input.role, "institution.update", true);
      const buffer = Buffer.from(input.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
      if (buffer.length > 2_500_000) throw new Error("El logo debe pesar menos de 2.5 MB.");
      const uploaded = await storagePut(`schools/${actor.schoolId}/branding/${input.fileName}`, buffer, input.contentType);
      const result = await updateSchoolSettings({ logoUrl: uploaded.url, schoolId: actor.schoolId });
      await writeAuditLog(input.role, "update_school_logo", input.fileName, actor.schoolId);
      return { ...result, logoUrl: uploaded.url };
    }),
    createAcademicPeriod: publicProcedure.input(z.object({
      role: roleSchema,
      name: z.string().min(2).max(80),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      status: z.enum(["Activo", "Programado", "Cerrado"]),
    })).mutation(async ({ input, ctx }) => {
      if (input.endDate <= input.startDate) throw new Error("La fecha final debe ser posterior a la fecha inicial.");
      const actor = await requirePermission(ctx, input.role, "settings.update", true);
      const result = await createAcademicPeriod(input, actor.schoolId);
      await writeAuditLog(input.role, "create_academic_period", input.name, actor.schoolId);
      return result;
    }),
    updateAcademicPeriod: publicProcedure.input(z.object({
      role: roleSchema,
      id: z.number().int(),
      name: z.string().min(2).max(80),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      status: z.enum(["Activo", "Programado", "Cerrado"]),
    })).mutation(async ({ input, ctx }) => {
      if (input.endDate <= input.startDate) throw new Error("La fecha final debe ser posterior a la fecha inicial.");
      const actor = await requirePermission(ctx, input.role, "settings.update", true);
      const result = await updateAcademicPeriod(input, actor.schoolId);
      await writeAuditLog(input.role, "update_academic_period", input.name, actor.schoolId);
      return result;
    }),
    generateDraft: publicProcedure.input(z.object({
      role: roleSchema,
      kind: z.enum(["activity", "communication", "planning", "insight"]),
      prompt: z.string().min(4).max(1000),
      context: z.string().max(1500).default(""),
    })).mutation(async ({ input, ctx }) => {
      await requirePermission(ctx, input.role, "ai.use", true);
      const system = input.kind === "activity"
        ? "Eres EduCore AI. Genera un borrador de actividad educativa en español, claro y editable. Incluye objetivo, instrucciones, preguntas, actividad y criterios de evaluación. Nunca publiques automáticamente."
        : input.kind === "communication"
          ? "Eres EduCore AI. Redacta un comunicado institucional profesional en español. Entrega un borrador breve, cálido y editable con asunto y mensaje. Nunca publiques automáticamente."
          : input.kind === "planning"
            ? "Eres EduCore AI. Genera una planeación docente editable en español, con objetivos, temas, actividades, evaluación y recursos para el contexto escolar."
            : "Eres EduCore AI. Analiza la información académica entregada y devuelve una síntesis accionable, prudente y basada en datos. No hagas diagnósticos ni tomes decisiones disciplinarias.";
      let responseText = "";
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: system },
            { role: "user", content: `${input.prompt}\n\nContexto autorizado:\n${input.context}` },
          ],
        });
        const content = response.choices?.[0]?.message?.content;
        responseText = typeof content === "string" ? content : JSON.stringify(content);
      } catch (error) {
        console.warn("[EduCore AI] Falling back to local draft:", error);
      }
      if (!responseText) {
        responseText = input.kind === "activity"
          ? `## Borrador de actividad\n\n**Tema:** ${input.prompt}\n\n**Objetivo**\nAplicar el concepto a una situación cercana al estudiante.\n\n**Instrucciones**\n1. Revisa el material base.\n2. Resuelve los ejercicios propuestos explicando tu razonamiento.\n3. Comparte una conclusión de tres líneas.\n\n**Criterios de evaluación**\n- Comprensión conceptual (40%).\n- Procedimiento y argumentación (40%).\n- Presentación y entrega (20%).`
          : input.kind === "communication"
            ? `**Asunto:** Información importante: ${input.prompt}\n\nEstimada comunidad educativa,\n\nQueremos compartir la siguiente información: ${input.prompt}. Agradecemos revisar las fechas y participar según corresponda.\n\nCordialmente,\nGimnasio Moderno del Valle`
            : input.kind === "planning"
              ? `## Planeación: ${input.prompt}\n\n**Objetivos:** Comprender los conceptos clave y aplicarlos en ejercicios guiados.\n\n**Secuencia:** Activación de saberes previos · explicación breve · práctica colaborativa · cierre reflexivo.\n\n**Evaluación:** Evidencia de proceso, participación y producto final.\n\n**Recursos:** Guía docente, tablero y material digital.`
              : "La información disponible sugiere priorizar seguimiento a los estudiantes con desempeño inferior a 3.5 y revisar la asistencia de los cursos con tendencia descendente. Estas son recomendaciones para revisión humana, no decisiones automáticas.";
      }
      await saveAiConversation(input.role, input.prompt, responseText);
      return { text: responseText, schoolId: DEMO_SCHOOL_ID, reviewed: false };
    }),
  }),
});

export type AppRouter = typeof appRouter;

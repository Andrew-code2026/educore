import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
  writeAuditLog,
} from "./db";

const roleSchema = z.enum(["admin", "teacher", "student", "guardian"]);
const roleGuard = (role: EduRole, allowed: EduRole[]) => {
  if (!allowed.includes(role)) throw new Error("No tienes permisos para realizar esta acción.");
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  educore: router({
    snapshot: publicProcedure.input(z.object({ role: roleSchema })).query(({ input }) => getEduCoreSnapshot(input.role)),
    createAssignment: publicProcedure.input(z.object({
      role: roleSchema,
      title: z.string().min(3).max(180),
      subject: z.string().min(2),
      course: z.string().min(2),
      description: z.string().min(5),
      dueAt: z.coerce.date(),
      points: z.number().int().min(1).max(1000),
      teacherName: z.string().min(2),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin", "teacher"]);
      const result = await createDemoAssignment(input);
      await writeAuditLog(input.role, "create_assignment", input.title);
      return result;
    }),
    submitAssignment: publicProcedure.input(z.object({
      role: roleSchema,
      assignmentId: z.number().int(),
      studentName: z.string().min(2),
      fileName: z.string().min(1),
      comment: z.string().max(500).default(""),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["student", "guardian"]);
      const result = await submitDemoAssignment(input);
      await writeAuditLog(input.role, "submit_assignment", `${input.assignmentId}:${input.studentName}`);
      return result;
    }),
    gradeSubmission: publicProcedure.input(z.object({
      role: roleSchema,
      submissionId: z.number().int(),
      grade: z.number().min(0).max(5),
      comment: z.string().max(500).default(""),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin", "teacher"]);
      const result = await gradeDemoSubmission(input);
      await writeAuditLog(input.role, "grade_submission", `${input.submissionId}:${input.grade}`);
      return result;
    }),
    updateGrade: publicProcedure.input(z.object({
      role: roleSchema,
      studentName: z.string().min(2),
      course: z.string().min(2),
      subject: z.string().min(2),
      period: z.string().min(2),
      value: z.number().min(0).max(5),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin", "teacher"]);
      const result = await updateDemoGrade(input);
      await writeAuditLog(input.role, "update_grade", `${input.studentName}:${input.subject}:${input.value}`);
      return result;
    }),
    recordAttendance: publicProcedure.input(z.object({
      role: roleSchema,
      course: z.string().min(2),
      date: z.coerce.date(),
      records: z.array(z.object({ studentName: z.string().min(2), status: z.enum(["Presente", "Ausente", "Tardanza", "Excusa"]), note: z.string().optional() })).min(1),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin", "teacher"]);
      const result = await recordDemoAttendance(input);
      await writeAuditLog(input.role, "record_attendance", `${input.course}:${input.records.length}`);
      return result;
    }),
    updateSchool: publicProcedure.input(z.object({
      role: roleSchema,
      name: z.string().min(3).max(180),
      city: z.string().min(2).max(80),
      academicYear: z.string().min(4).max(20),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin"]);
      const result = await updateSchoolSettings(input);
      await writeAuditLog(input.role, "update_school_settings", input.name);
      return result;
    }),
    generateDraft: publicProcedure.input(z.object({
      role: roleSchema,
      kind: z.enum(["activity", "communication", "planning", "insight"]),
      prompt: z.string().min(4).max(1000),
      context: z.string().max(1500).default(""),
    })).mutation(async ({ input }) => {
      roleGuard(input.role, ["admin", "teacher", "student", "guardian"]);
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

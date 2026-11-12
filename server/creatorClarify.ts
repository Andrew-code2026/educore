import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { RESOURCE_KIND_LABELS, sanitizeClarifyQuestions, type ClarifyQuestion, type ResourceKind } from "@shared/creator";
import { describeAnthropicError, getAnthropic } from "./_core/anthropic";
import { ENV } from "./_core/env";

/**
 * Preguntas aclaratorias: antes de escribir un recurso, la IA puede hacer hasta tres
 * preguntas de opción múltiple para afinar el resultado. Es un paso opcional y barato:
 * si falla o no hay nada que preguntar, la creación sigue sin él.
 */
export const CLARIFY_SYSTEM_PROMPT = `Eres el asistente de creación de recursos de EduCore, una plataforma escolar colombiana. Un docente acaba de pedir un recurso para su clase (una guía, un taller, una evaluación…). Antes de escribirlo puedes hacerle hasta tres preguntas de opción múltiple para afinar el resultado.

Pregunta solo lo que cambiaría de verdad el recurso y que el docente no haya dicho ya: el enfoque dentro del tema, el nivel de dificultad, el tipo de ejercicios, el contexto de los problemas o los apoyos que necesitan sus estudiantes. No preguntes el grado, la asignatura ni el tipo de recurso cuando ya vienen en la solicitud o en su contexto, ni detalles que puedas decidir tú con buen criterio.

Si la solicitud ya es lo bastante concreta, devuelve una lista vacía. Es mejor no preguntar que preguntar por preguntar: cada pregunta le cuesta tiempo al docente.

Cada pregunta es corta y directa, en español, y trae tres opciones concretas, distintas entre sí y redactadas como las diría un docente. No incluyas una opción del tipo "otra": la interfaz ya la ofrece.`;

/** El esquema de salida no lleva límites de longitud: las salidas estructuradas no los admiten todos, y se aplican al sanear. */
const clarifyOutputSchema = z.object({
  questions: z.array(z.object({ question: z.string(), options: z.array(z.string()) })),
});

export interface ClarifyInput {
  kind: ResourceKind;
  prompt: string;
  subjectLabel?: string | null;
  gradeLabel?: string | null;
  courseLabel?: string | null;
}

export function buildClarifyMessage(input: ClarifyInput): string {
  const context = [`Tipo de recurso: ${RESOURCE_KIND_LABELS[input.kind].label}`];
  if (input.subjectLabel) context.push(`Asignatura: ${input.subjectLabel}`);
  if (input.gradeLabel) context.push(`Grado: ${input.gradeLabel}`);
  if (input.courseLabel) context.push(`Curso: ${input.courseLabel}`);
  return `<contexto_del_recurso>\n${context.join("\n")}\n</contexto_del_recurso>\n\n<solicitud_del_docente>\n${input.prompt.trim()}\n</solicitud_del_docente>`;
}

export async function generateClarifyQuestions(input: ClarifyInput): Promise<ClarifyQuestion[]> {
  try {
    const response = await getAnthropic().messages.parse({
      model: ENV.creatorModel,
      max_tokens: 4000,
      // Paso rápido: poca deliberación basta para decidir si hace falta preguntar
      output_config: { effort: "low", format: zodOutputFormat(clarifyOutputSchema) },
      system: CLARIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildClarifyMessage(input) }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return [];
    return sanitizeClarifyQuestions(response.parsed_output?.questions);
  } catch (error) {
    // Las preguntas son un extra: un fallo aquí no debe impedir crear el recurso
    console.warn("[Creator] No se pudieron generar preguntas aclaratorias:", describeAnthropicError(error));
    return [];
  }
}

import type { DbaDescriptorSet } from "../types";

/**
 * Motor de Generación Pedagógica de Descriptores para Boletín
 * Conforme al Decreto 1290 de 2009 (MEN Colombia).
 *
 * Traduce el enunciado estructurante de un DBA y sus evidencias de aprendizaje
 * a los 4 juicios valorativos institucionales con vocabulario pedagógico riguroso.
 */

interface DbaInput {
  title: string;
  statement: string;
  evidences?: string[];
  dimension?: "cognitivo" | "procedimental" | "actitudinal";
}

/**
 * Limpia y normaliza el texto del enunciado para insertarlo armónicamente.
 */
function cleanCoreTheme(statement: string, title: string): string {
  if (title && title.length > 8) {
    return title.toLowerCase().replace(/^(comprende|explica|analiza|utiliza|evalúa|reconoce|identifica)\s+/i, "");
  }
  const match = statement.match(/^(comprende|explica|analiza|utiliza|evalúa|reconoce|identifica)\s+(?:que|cómo|la|el|los|las)?\s*(.+)/i);
  if (match && match[2]) {
    const trimmed = match[2].trim();
    return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  }
  return statement.endsWith(".") ? statement.slice(0, -1) : statement;
}

/**
 * Genera el juego oficial de 4 descriptores (Superior, Alto, Básico, Bajo).
 */
export function generateDbaDescriptors(input: DbaInput): DbaDescriptorSet {
  const theme = cleanCoreTheme(input.statement, input.title);
  const primaryEvidence = input.evidences?.[0]
    ? input.evidences[0].replace(/\.$/, "").toLowerCase()
    : "";

  const dimension = input.dimension || "cognitivo";

  if (dimension === "actitudinal") {
    return {
      superior: `Demuestra compromiso ejemplar, rigurosidad ética y autonomía constante frente a ${theme}. Aporta constructivamente al trabajo en equipo y lidera iniciativas institucionales.`,
      alto: `Asume con responsabilidad y constancia las pautas de convivencia, puntualidad y trabajo colaborativo vinculadas a ${theme}.`,
      basico: `Cumple de manera elemental con los compromisos y normas establecidas para ${theme}, requiriendo en ocasiones motivación externa para sostener la proactividad.`,
      bajo: `Presenta dificultades recurrentes en el seguimiento de acuerdos formativos y entrega oportuna frente a ${theme}. Requiere plan de acompañamiento y compromiso convivencial.`,
    };
  }

  if (dimension === "procedimental") {
    return {
      superior: `Aplica con destreza superior técnicas, métodos experimentales y modelos prácticos relacionados con ${theme}. ${
        primaryEvidence ? `Ejecuta con maestría procesos donde ${primaryEvidence}.` : "Sustenta resultados con alto rigor técnico."
      }`,
      alto: `Desarrolla eficazmente procedimientos, talleres y ejercicios prácticos asociados a ${theme}, siguiendo metodologías sistemáticas.`,
      basico: `Ejecuta las actividades procedimentales mínimas sobre ${theme}, mostrando vacíos ocasionales en la precisión técnica que logra corregir con orientación.`,
      bajo: `Evidencia dificultad en la ejecución práctica de procedimientos sobre ${theme}. Requiere taller de nivelación y refuerzo en la aplicación de métodos.`,
    };
  }

  // Cognitivo (por defecto)
  return {
    superior: `Demuestra dominio conceptual profundo y pensamiento crítico al interpretar ${theme}. Sustenta hipótesis, argumenta con rigor y transfiere el conocimiento a situaciones complejas y novedosas.`,
    alto: `Comprende con claridad y solidez los conceptos fundamentales de ${theme}. ${
      primaryEvidence ? `Evidencia apropiación conceptual al ${primaryEvidence}.` : "Resuelve situaciones problemáticas de forma solvente."
    }`,
    basico: `Reconoce los principios esenciales de ${theme}, logrando el nivel de suficiencia requerido, aunque manifiesta dudas al relacionarlos con contextos de mayor complejidad.`,
    bajo: `No alcanza los desempeños cognitivos básicos en ${theme}. Presenta debilidades en la apropiación conceptual y requiere plan de mejoramiento académico inmediato.`,
  };
}

/**
 * Plantillas rápidas para regenerar una variante con tono alternativo.
 */
export function regenerateSingleDescriptor(
  level: "superior" | "alto" | "basico" | "bajo",
  input: DbaInput,
  variant: 1 | 2 = 1
): string {
  const theme = cleanCoreTheme(input.statement, input.title);

  switch (level) {
    case "superior":
      return variant === 1
        ? `Modela, analiza y transfiere con autonomía y excelencia los saberes relativos a ${theme}, superando con creces las metas previstas para el periodo.`
        : `Domina con rigor académico y solvencia metodológica los conceptos de ${theme}, sustentando soluciones innovadoras con amplio espíritu reflexivo.`;

    case "alto":
      return variant === 1
        ? `Alcanza satisfactoriamente las competencias previstas en torno a ${theme}, participando con interés y aplicando lo aprendido de forma correcta.`
        : `Comprende y aplica con regularidad y efectividad los temas correspondientes a ${theme}, cumpliendo oportunamente con los criterios de evaluación.`;

    case "basico":
      return variant === 1
        ? `Evidencia comprensión de los aprendizajes mínimos indispensables sobre ${theme}, requiriendo consolidar hábitos de profundización para asegurar su continuidad.`
        : `Supera el umbral mínimo exigido en ${theme}, demostrando esfuerzo personal para subsanar dificultades parciales durante el periodo.`;

    case "bajo":
      return variant === 1
        ? `No logra consolidar los aprendizajes estructurantes de ${theme}. Debe acogerse a los planes de apoyo y actividades de nivelación según el SIEE institucional.`
        : `Presenta rezago conceptual en los contenidos asociados a ${theme}. Requiere refuerzo pedagógico prioritario y acompañamiento desde el hogar.`;
  }
}

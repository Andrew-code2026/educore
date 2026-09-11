/**
 * Re-export canónico desde @/lib/gradeStatisticsUtils para compatibilidad
 * de importaciones existentes en componentes del Grade Center.
 */
export * from "@/lib/gradeStatisticsUtils";

export {
  getInstitutionalPassingGrade,
  determineRiskLevel,
  getPendingGradesBreakdown,
  type RiskAssessmentResult,
} from "./gradeIntelligenceUtils";

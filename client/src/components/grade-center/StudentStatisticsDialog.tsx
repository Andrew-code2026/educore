import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  type GradeScaleConfig,
  studentName,
  numberValue,
  getPerformanceTone,
} from "./gradeCenterUtils";
import {
  calculateStudentEvolution,
  type StudentEvolutionStats,
  type StudentEvolutionPoint,
} from "./gradeStatisticsUtils";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface StudentStatisticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRow: GradeCenterTableRow | null;
  assessments: Assessment[];
  pendingGrades: Record<string, number | null>;
  groupAverages?: Record<number, number | null>;
  groupAverage?: number | null;
  scale?: GradeScaleConfig | null;
  courseName?: string;
  subjectName?: string;
}

export function StudentStatisticsDialog({
  open,
  onOpenChange,
  studentRow,
  assessments,
  pendingGrades,
  groupAverages = {},
  groupAverage,
  scale,
  courseName,
  subjectName,
}: StudentStatisticsDialogProps) {
  if (!studentRow) return null;

  const sName = studentName(studentRow.student);
  const studentId = studentRow.enrollment.studentUserId;

  // Cálculo individual de estadísticas de rendimiento y evolución
  const stats: StudentEvolutionStats = React.useMemo(() => {
    return calculateStudentEvolution(studentRow, assessments, pendingGrades, groupAverages, groupAverage);
  }, [studentRow, assessments, pendingGrades, groupAverages, groupAverage]);

  const avgTone = getPerformanceTone(stats.currentAverage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Encabezado */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Rendimiento y Evolución Individual
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Estadísticas
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200">{sName}</strong> (ID: {studentId}) · {courseName ?? "Curso"} · {subjectName ?? "Materia"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Métricas Clave: Estudiante vs Grupo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Promedio Estudiante */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-850/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Promedio
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-black tracking-tight ${avgTone.textColor}`}>
                  {numberValue(stats.currentAverage)}
                </span>
                <span className="text-[10px] text-slate-400">/ {scale?.maxValue ?? 5}</span>
              </div>
            </div>

            {/* Comparación vs Grupo */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-850/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Vs Grupo
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                {stats.deltaVsGroup !== null ? (
                  <span className={`text-sm font-extrabold ${
                    stats.deltaVsGroup > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : stats.deltaVsGroup < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-600"
                  }`}>
                    {stats.deltaVsGroup > 0 ? `+${stats.deltaVsGroup}` : stats.deltaVsGroup} pts
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">N/A</span>
                )}
                {stats.groupAverage !== null && (
                  <span className="text-[10px] text-slate-400 block truncate">
                    (med. {stats.groupAverage.toFixed(1)})
                  </span>
                )}
              </div>
            </div>

            {/* Mejor Calificación */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-850/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Award className="h-3 w-3 text-emerald-500" /> Mejor Nota
              </span>
              <div className="mt-1">
                {stats.bestAssessment ? (
                  <div>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {stats.bestAssessment.grade.toFixed(1)}
                    </span>
                    <p className="text-[9px] text-slate-400 truncate" title={stats.bestAssessment.title}>
                      {stats.bestAssessment.title}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Sin notas</span>
                )}
              </div>
            </div>

            {/* Menor Calificación */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-850/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-rose-500" /> Menor Nota
              </span>
              <div className="mt-1">
                {stats.lowestAssessment ? (
                  <div>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {stats.lowestAssessment.grade.toFixed(1)}
                    </span>
                    <p className="text-[9px] text-slate-400 truncate" title={stats.lowestAssessment.title}>
                      {stats.lowestAssessment.title}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Sin notas</span>
                )}
              </div>
            </div>
          </div>

          {/* Indicador de Tendencia General */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/40">
            <div className="flex items-center gap-2">
              {stats.trend === "ASCENDENTE" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {stats.trend === "DESCENDENTE" && <TrendingDown className="h-4 w-4 text-rose-500" />}
              {stats.trend === "ESTABLE" && <ArrowRight className="h-4 w-4 text-indigo-500" />}
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {stats.trendLabel}
                </span>
                <span className="text-[10px] text-slate-400">
                  {stats.evaluatedCount} de {assessments.length} evaluaciones calificadas ({stats.pendingCount} pendientes)
                </span>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-[10px] font-bold py-0.5 px-2 ${
                stats.trend === "ASCENDENTE"
                  ? "border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : stats.trend === "DESCENDENTE"
                  ? "border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-slate-200 text-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {stats.trend}
            </Badge>
          </div>

          {/* Tabla de Evolución Cronológica */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Evolución Evaluación por Evaluación
            </span>
            <div className="rounded-xl border border-slate-100 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-850/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="py-2 pl-3">Evaluación</th>
                    <th className="py-2 text-center">Peso</th>
                    <th className="py-2 text-center">Nota Estudiante</th>
                    <th className="py-2 text-center">Prom. Grupo</th>
                    <th className="py-2 text-right pr-3">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.timeline.map(point => {
                    const tone = getPerformanceTone(point.studentGrade);
                    return (
                      <tr key={point.assessmentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pl-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={point.assessmentTitle}>
                            {point.assessmentTitle}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-slate-500 font-medium">
                          {point.weight}%
                        </td>
                        <td className="py-2.5 text-center">
                          {point.isPending ? (
                            <span className="text-[10px] italic text-slate-400 font-medium">Pendiente</span>
                          ) : (
                            <span className={`font-bold ${tone.textColor}`}>
                              {numberValue(point.studentGrade)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-center font-medium text-slate-500">
                          {point.groupAverage !== null ? numberValue(point.groupAverage) : "—"}
                        </td>
                        <td className="py-2.5 text-right pr-3">
                          {point.deltaVsGroup !== null ? (
                            <span className={`text-[11px] font-bold ${
                              point.deltaVsGroup > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : point.deltaVsGroup < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-500"
                            }`}>
                              {point.deltaVsGroup > 0 ? `+${point.deltaVsGroup}` : point.deltaVsGroup}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs font-semibold rounded-xl bg-[var(--edc-primary)] hover:bg-[var(--edc-primary)]/90 text-white"
          >
            Cerrar estadísticas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

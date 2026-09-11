import * as React from "react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronDown,
  CheckCircle2,
  Calculator,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type GradeScaleConfig,
  studentName,
  numberValue,
  getPerformanceTone,
  POPOVER_GLASS_PANEL_CLASS,
} from "./gradeCenterUtils";
import {
  type GroupIntelligenceSummary,
  type PendingGradeItem,
  type RiskAnalysisResult,
  getGroupIntelligenceSummary,
} from "./gradeIntelligenceUtils";
import type { GradeCenterTableRow, Assessment } from "./GradeCenterTable";

interface GroupIntelligenceBarProps {
  rows: GradeCenterTableRow[];
  assessments: Assessment[];
  pendingGrades: Record<string, number | null>;
  scale?: GradeScaleConfig | null;
  courseName?: string;
  subjectName?: string;
  onNavigateToCell?: (studentUserId: number, assessmentId: number) => void;
  onOpenSimulator?: (studentRow: GradeCenterTableRow) => void;
}

export function GroupIntelligenceBar({
  rows,
  assessments,
  pendingGrades,
  scale,
  courseName,
  subjectName,
  onNavigateToCell,
  onOpenSimulator,
}: GroupIntelligenceBarProps) {
  const [riskPopoverOpen, setRiskPopoverOpen] = React.useState(false);
  const [pendingPopoverOpen, setPendingPopoverOpen] = React.useState(false);

  // Resumen inteligente calculado reactivamente
  const summary: GroupIntelligenceSummary = React.useMemo(() => {
    return getGroupIntelligenceSummary(rows, assessments, pendingGrades, scale);
  }, [rows, assessments, pendingGrades, scale]);

  const {
    totalStudents,
    groupAverage,
    passingCount,
    failingCount,
    passingPercentage,
    highRiskStudents,
    mediumRiskStudents,
    totalAtRisk,
    pendingItems,
    totalPendingGrades,
    passingGrade,
  } = summary;

  const avgTone = getPerformanceTone(groupAverage);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-2.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Contexto del Curso / Materia y Estudiantes */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                {courseName || "Curso"} {subjectName ? `· ${subjectName}` : ""}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Users className="h-3 w-3" />
                {totalStudents} {totalStudents === 1 ? "estudiante" : "estudiantes"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              {/* Promedio General */}
              <span className="flex items-center gap-1">
                Promedio:{" "}
                <strong className={`font-bold ${avgTone.textColor}`}>
                  {numberValue(groupAverage)}
                </strong>
              </span>
              <span>·</span>
              {/* Aprobando */}
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>
                  <strong className="text-slate-700 dark:text-slate-200">{passingCount}</strong>/{totalStudents} aprobando ({passingPercentage}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Métricas Inteligentes Interactivas: Riesgo & Pendientes */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Popover de Riesgo Académico */}
          <Popover open={riskPopoverOpen} onOpenChange={setRiskPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-8 rounded-xl px-2.5 text-xs font-semibold transition-all border ${
                  totalAtRisk > 0
                    ? highRiskStudents.length > 0
                      ? "border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      : "border-amber-300 bg-amber-50/70 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                }`}
              >
                <AlertTriangle className={`h-3.5 w-3.5 mr-1.5 ${
                  totalAtRisk > 0
                    ? highRiskStudents.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                    : "text-slate-400"
                }`} />
                <span>
                  {totalAtRisk === 0 ? "Sin riesgo detectado" : `${totalAtRisk} en riesgo`}
                </span>
                {totalAtRisk > 0 && (
                  <span className="ml-1.5 flex items-center gap-1">
                    {highRiskStudents.length > 0 && (
                      <Badge variant="destructive" className="h-4 px-1 text-[9px] font-bold">
                        {highRiskStudents.length} Alto
                      </Badge>
                    )}
                    {mediumRiskStudents.length > 0 && (
                      <Badge className="h-4 px-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white">
                        {mediumRiskStudents.length} Medio
                      </Badge>
                    )}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={8}
              className={`${POPOVER_GLASS_PANEL_CLASS} w-88 p-3 shadow-xl`}
            >
              <div className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Estudiantes en Riesgo Académico
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Aprobación institucional mínima: {passingGrade.toFixed(1)}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold py-0">
                  {totalAtRisk} caso(s)
                </Badge>
              </div>

              {totalAtRisk === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    ¡Excelente panorama académico!
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Todos los estudiantes del grupo se encuentran en proyección aprobatoria.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {/* Riesgo Alto */}
                  {highRiskStudents.map(st => (
                    <RiskStudentItem
                      key={st.studentId}
                      student={st}
                      onOpenSimulator={() => {
                        setRiskPopoverOpen(false);
                        const r = rows.find(x => x.enrollment.studentUserId === st.studentId);
                        if (r) onOpenSimulator?.(r);
                      }}
                    />
                  ))}

                  {/* Riesgo Medio */}
                  {mediumRiskStudents.map(st => (
                    <RiskStudentItem
                      key={st.studentId}
                      student={st}
                      onOpenSimulator={() => {
                        setRiskPopoverOpen(false);
                        const r = rows.find(x => x.enrollment.studentUserId === st.studentId);
                        if (r) onOpenSimulator?.(r);
                      }}
                    />
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Popover de Calificaciones Pendientes y Navegación Rápida */}
          <Popover open={pendingPopoverOpen} onOpenChange={setPendingPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-8 rounded-xl px-2.5 text-xs font-semibold transition-all border ${
                  totalPendingGrades > 0
                    ? "border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100/80 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                }`}
              >
                <Clock className={`h-3.5 w-3.5 mr-1.5 ${totalPendingGrades > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                <span>
                  {totalPendingGrades === 0 ? "Al día (0 pendientes)" : `${totalPendingGrades} por calificar`}
                </span>
                <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={8}
              className={`${POPOVER_GLASS_PANEL_CLASS} w-88 p-3 shadow-xl`}
            >
              <div className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    Notas Pendientes por Calificar
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Haz clic en cualquier ítem para saltar directamente a la celda
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold py-0 border-indigo-200 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {totalPendingGrades}
                </Badge>
              </div>

              {totalPendingGrades === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    ¡Planilla al día!
                  </p>
                  <p className="text-[10px] text-slate-400">
                    No hay celdas vacías en las evaluaciones creadas.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {pendingItems.map(item => (
                    <button
                      key={`${item.studentId}-${item.assessmentId}`}
                      type="button"
                      onClick={() => {
                        setPendingPopoverOpen(false);
                        onNavigateToCell?.(item.studentId, item.assessmentId);
                      }}
                      className="w-full text-left flex items-center justify-between p-2 rounded-xl border border-slate-100/90 bg-white/70 hover:bg-indigo-50/70 hover:border-indigo-200 transition-all dark:border-slate-800 dark:bg-slate-850/50 dark:hover:bg-slate-800"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.studentName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.assessmentTitle} · {item.assessmentWeight}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        <span>Calificar</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

interface RiskStudentItemProps {
  student: RiskAnalysisResult;
  onOpenSimulator: () => void;
}

function RiskStudentItem({ student, onOpenSimulator }: RiskStudentItemProps) {
  const isHigh = student.riskLevel === "ALTO";

  return (
    <div
      className={`p-2.5 rounded-xl border transition-all ${
        isHigh
          ? "border-rose-200/80 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
          : "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {student.studentName}
            </span>
            <Badge
              variant={isHigh ? "destructive" : "secondary"}
              className={`text-[9px] py-0 px-1 font-bold ${
                !isHigh ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : ""
              }`}
            >
              Riesgo {student.riskLevel === "ALTO" ? "Alto" : "Medio"}
            </Badge>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {student.reason}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Def. Actual</span>
          <p className="text-xs font-black text-slate-700 dark:text-slate-300">
            {numberValue(student.currentDefinitiva)}
          </p>
        </div>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[10px]">
        <span className="text-slate-500 font-medium">
          {student.whatIsNeeded.message}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenSimulator}
          className="h-5 px-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          <Calculator className="h-3 w-3 mr-1" />
          Simular
        </Button>
      </div>
    </div>
  );
}

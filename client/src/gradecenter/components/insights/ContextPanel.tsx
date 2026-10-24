import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { GroupDetail } from "./GroupDetail";
import { StudentDetail } from "./StudentDetail";
import { EvaluationDetail } from "./EvaluationDetail";

/**
 * Análisis contextual.
 *
 * Nunca invade la pantalla principal: se abre como capa lateral sobre la misma
 * matriz y siempre habla del grupo, de un estudiante o de una evaluación.
 * Reutiliza exactamente los mismos componentes que las vistas a pantalla
 * completa, porque miran el mismo conjunto de datos.
 */
export function ContextPanel() {
  const {
    preferences,
    analytics,
    students,
    dataset,
    selectedStudentId,
    selectedEvaluationId,
    selectStudent,
    selectEvaluation,
    setAnalysisOpen,
  } = useGradeCenter();

  const student = selectedStudentId ? analytics.byStudent.get(selectedStudentId) ?? null : null;
  const evaluationMetric = selectedEvaluationId
    ? analytics.byEvaluation.get(selectedEvaluationId) ?? null
    : null;

  const mode = student ? "student" : evaluationMetric ? "evaluation" : "group";

  return (
    <AnimatePresence>
      {preferences.analysisOpen && (
        <motion.aside
          key="context-panel"
          initial={{ x: 26, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 26, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="glass-strong absolute top-0 right-0 bottom-0 z-[60] flex w-full max-w-[400px] flex-col border-l border-white/10"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2.5">
            <div className="flex flex-1 items-center gap-0.5 rounded-xl border border-white/8 bg-white/4 p-0.5">
              <ModeTab
                label="Grupo"
                active={mode === "group"}
                onClick={() => {
                  selectStudent(null);
                  selectEvaluation(null);
                }}
              />
              <ModeTab
                label="Estudiante"
                active={mode === "student"}
                disabled={!student}
                onClick={() => selectEvaluation(null)}
              />
              <ModeTab
                label="Evaluación"
                active={mode === "evaluation"}
                disabled={!evaluationMetric}
                onClick={() => selectStudent(null)}
              />
            </div>
            <button
              type="button"
              onClick={() => setAnalysisOpen(false)}
              aria-label="Cerrar análisis"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="gc-scroll flex-1 overflow-y-auto p-3">
            <div key={mode} className="gc-fade">
              {mode === "group" && <GroupDetail />}
              {mode === "student" && student && <StudentDetail metrics={student} />}
              {mode === "evaluation" && evaluationMetric && (
                <EvaluationDetail evaluationId={evaluationMetric.evaluation.id} />
              )}
            </div>
          </div>

          {mode === "group" && (
            <div className="shrink-0 border-t border-white/8 px-3 py-2 text-xs text-muted-foreground">
              {students.length} de {analytics.students.length} estudiantes visibles ·{" "}
              {dataset.evaluations.length} evaluaciones del periodo
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ModeTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
        active ? "bg-white/10 text-foreground" : "text-muted-foreground",
        disabled ? "opacity-40" : "hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

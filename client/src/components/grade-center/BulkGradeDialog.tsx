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
import { Input } from "@/components/ui/input";
import { Sparkles, AlertCircle, Check, Users, UserCheck, Inbox } from "lucide-react";
import {
  validateGradeAgainstScale,
  parseGradeInput,
  type GradeScaleConfig,
} from "./gradeCenterUtils";
import { type GradeCenterTableRow } from "./GradeCenterTable";

export type BulkGradeTarget = "ALL" | "SELECTED" | "EMPTY_ONLY";

interface BulkGradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: Array<{
    id: number;
    title: string;
    assessmentType: string;
    maxValue: number;
    weight: number;
  }>;
  selectedAssessmentId?: number;
  rows: GradeCenterTableRow[];
  selectedStudentIds: number[];
  scale?: GradeScaleConfig | null;
  pendingGrades: Record<string, number | null>;
  onApply: (assessmentId: number, value: number, target: BulkGradeTarget) => void;
}

export function BulkGradeDialog({
  open,
  onOpenChange,
  assessments,
  selectedAssessmentId,
  rows,
  selectedStudentIds,
  scale,
  pendingGrades,
  onApply,
}: BulkGradeDialogProps) {
  const [assessmentId, setAssessmentId] = React.useState<number>(
    selectedAssessmentId ?? assessments[0]?.id ?? 0
  );
  const [gradeText, setGradeText] = React.useState<string>("4.5");
  const [target, setTarget] = React.useState<BulkGradeTarget>("ALL");
  const [confirmStep, setConfirmStep] = React.useState<boolean>(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Sincronizar cuando cambia la evaluación seleccionada o se abre el diálogo
  React.useEffect(() => {
    if (open) {
      if (selectedAssessmentId && assessments.some(a => a.id === selectedAssessmentId)) {
        setAssessmentId(selectedAssessmentId);
      } else if (assessments.length && !assessments.some(a => a.id === assessmentId)) {
        setAssessmentId(assessments[0].id);
      }
      setConfirmStep(false);
      setValidationError(null);
    }
  }, [open, selectedAssessmentId, assessments]);

  const activeAssessment = assessments.find(a => a.id === assessmentId) ?? assessments[0];
  const maxVal = activeAssessment?.maxValue ?? 5;
  const minVal = scale?.minValue ?? 0;

  // Validación de la nota ingresada
  const validateCurrentInput = (valText: string) => {
    const parsed = parseGradeInput(valText);
    if (parsed === null || isNaN(parsed)) {
      return "Ingresa una calificación válida (ej. 4.5)";
    }
    const validation = validateGradeAgainstScale(parsed, scale, maxVal);
    if (!validation.valid) {
      return validation.error || `La nota debe estar entre ${minVal} y ${maxVal}`;
    }
    return null;
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setGradeText(raw);
    const err = validateCurrentInput(raw);
    setValidationError(err);
  };

  // Determinar cuántos estudiantes y cuáles celdas se verán afectadas
  const affectedStudentIds = React.useMemo(() => {
    if (!activeAssessment) return [];
    const aId = activeAssessment.id;

    // Obtener el conjunto base de filas según el target seleccionado
    let baseRows = rows;
    if (target === "SELECTED") {
      baseRows = rows.filter(r => selectedStudentIds.includes(r.enrollment.studentUserId));
    }

    if (target === "EMPTY_ONLY") {
      // Filtrar solo filas donde la celda de esta evaluación esté actualmente vacía (sin nota)
      return baseRows
        .filter(r => {
          const sId = r.enrollment.studentUserId;
          const key = `${aId}:${sId}`;
          const currentVal = Object.prototype.hasOwnProperty.call(pendingGrades, key)
            ? pendingGrades[key]
            : r.values.find((v: any) => v.assessment.id === aId)?.grade?.value ?? null;
          return currentVal === null || currentVal === undefined;
        })
        .map(r => r.enrollment.studentUserId);
    }

    return baseRows.map(r => r.enrollment.studentUserId);
  }, [activeAssessment, rows, selectedStudentIds, target, pendingGrades]);

  const affectedCount = affectedStudentIds.length;

  const handleProceedToConfirm = () => {
    const err = validateCurrentInput(gradeText);
    if (err) {
      setValidationError(err);
      return;
    }
    if (affectedCount === 0) {
      setValidationError(
        target === "EMPTY_ONLY"
          ? "No hay celdas vacías en esta evaluación para aplicar la nota."
          : target === "SELECTED"
          ? "No hay estudiantes seleccionados."
          : "No hay estudiantes en la lista actual."
      );
      return;
    }
    setConfirmStep(true);
  };

  const handleConfirmAndApply = () => {
    const parsed = parseGradeInput(gradeText);
    if (parsed === null || isNaN(parsed) || !activeAssessment) return;
    onApply(activeAssessment.id, parsed, target);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-white/80 bg-white/95 p-6 shadow-[0_24px_54px_rgba(29,78,137,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[var(--edc-primary)]">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Calificación Masiva
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Aplica una calificación a múltiples estudiantes de forma controlada y segura.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-2">
            {/* 1. Selección de Evaluación */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Evaluación destino
              </label>
              <select
                value={assessmentId}
                onChange={e => setAssessmentId(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs focus:border-[var(--edc-accent)] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.weight}% · Máx {a.maxValue})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Nota a aplicar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nota a registrar
                </label>
                <span className="text-[11px] text-slate-400">
                  Escala: {minVal.toFixed(1)} a {maxVal.toFixed(1)}
                </span>
              </div>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  value={gradeText}
                  onChange={handleGradeChange}
                  placeholder="ej. 4.5"
                  className="h-11 rounded-xl bg-white text-center text-xl font-bold tracking-tight text-slate-900 shadow-inner dark:bg-slate-800 dark:text-white"
                />
                <span className="pointer-events-none absolute right-3 text-xs font-medium text-slate-400">
                  / {maxVal.toFixed(1)}
                </span>
              </div>
              {validationError && (
                <p className="text-[11px] font-medium text-rose-500 animate-in fade-in">
                  {validationError}
                </p>
              )}
            </div>

            {/* 3. Modo de aplicación (Radio buttons visuales) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ¿A quiénes aplicar?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {/* Opción A: Todos los visibles */}
                <button
                  type="button"
                  onClick={() => setTarget("ALL")}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    target === "ALL"
                      ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/20 ring-1 ring-[var(--edc-primary)]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"
                  }`}
                >
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--edc-primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Todos los estudiantes visibles ({rows.length})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Aplica la nota a todos los alumnos mostrados según los filtros actuales.
                    </p>
                  </div>
                </button>

                {/* Opción B: Solo seleccionados */}
                <button
                  type="button"
                  disabled={selectedStudentIds.length === 0}
                  onClick={() => setTarget("SELECTED")}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    selectedStudentIds.length === 0
                      ? "opacity-50 cursor-not-allowed border-slate-100 bg-slate-50"
                      : target === "SELECTED"
                      ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/20 ring-1 ring-[var(--edc-primary)]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"
                  }`}
                >
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--edc-primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Solo seleccionados ({selectedStudentIds.length})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedStudentIds.length > 0
                        ? "Aplica la nota exclusivamente a los estudiantes marcados con checkbox."
                        : "Marca estudiantes con checkbox en la tabla para habilitar esta opción."}
                    </p>
                  </div>
                </button>

                {/* Opción C: Solo celdas vacías */}
                <button
                  type="button"
                  onClick={() => setTarget("EMPTY_ONLY")}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    target === "EMPTY_ONLY"
                      ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/20 ring-1 ring-[var(--edc-primary)]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"
                  }`}
                >
                  <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Solo celdas vacías
                      </p>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                        Protege notas existentes
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Califica únicamente a quienes no tengan nota registrada en esta evaluación.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Resumen previo */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <span className="font-semibold">Estudiantes a calificar: </span>
              <strong className="text-[var(--edc-primary)] font-bold text-sm">
                {affectedCount}
              </strong>{" "}
              de {rows.length} visibles
            </div>
          </div>
        ) : (
          /* PASO DE CONFIRMACIÓN OBLIGATORIO */
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Confirmar Calificación Masiva
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Vas a aplicar la nota{" "}
                    <strong className="font-extrabold underline">{gradeText}</strong> a{" "}
                    <strong className="font-extrabold underline">{affectedCount}</strong> estudiante
                    {affectedCount === 1 ? "" : "s"} en la evaluación{" "}
                    <strong className="font-semibold">"{activeAssessment?.title}"</strong>.
                  </p>
                  {target === "EMPTY_ONLY" && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      ✓ Se omitirán los estudiantes que ya cuenten con calificación en esta evaluación.
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-amber-700/80">
                    Los cambios quedarán como <em>pendientes</em> para que puedas revisarlos antes de guardar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {!confirmStep ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-xl text-xs text-slate-500"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(validationError) || affectedCount === 0}
                onClick={handleProceedToConfirm}
                className="h-9 rounded-xl bg-[var(--edc-primary)] px-4 text-xs font-semibold text-white shadow-sm"
              >
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmStep(false)}
                className="h-9 rounded-xl text-xs"
              >
                Volver
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmAndApply}
                className="h-9 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(217,119,6,0.3)] hover:bg-amber-700"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Aplicar {gradeText} a {affectedCount} estudiantes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

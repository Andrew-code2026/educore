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
      <DialogContent className="max-w-lg sm:max-w-xl rounded-3xl p-0 overflow-hidden border border-slate-200/90 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Calificación Masiva
                </DialogTitle>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Planilla rápida
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aplica una misma calificación a múltiples estudiantes de forma controlada y segura.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!confirmStep ? (
          <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 1. Selección de Evaluación */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Evaluación destino
              </label>
              <select
                value={assessmentId}
                onChange={e => setAssessmentId(Number(e.target.value))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-[var(--edc-primary)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.title} · {a.weight}% peso · Máx {a.maxValue}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Nota a aplicar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  2. Nota a registrar
                </label>
                <span className="text-[11px] font-medium text-slate-400">
                  Escala: {minVal.toFixed(1)} a {maxVal.toFixed(1)}
                </span>
              </div>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  value={gradeText}
                  onChange={handleGradeChange}
                  placeholder="ej. 4.5"
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50/40 text-center text-2xl font-black tracking-tight text-slate-900 shadow-inner focus:border-[var(--edc-primary)] focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span className="pointer-events-none absolute right-4 text-xs font-bold text-slate-400">
                  / {maxVal.toFixed(1)}
                </span>
              </div>
              {validationError && (
                <p className="text-[11px] font-medium text-rose-500 animate-in fade-in flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {validationError}
                </p>
              )}
            </div>

            {/* 3. Modo de aplicación (Radio buttons visuales) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. ¿A quiénes aplicar?
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Opción A: Todos los visibles */}
                <button
                  type="button"
                  onClick={() => setTarget("ALL")}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                    target === "ALL"
                      ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/20 ring-2 ring-[var(--edc-primary)]/20 shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-850/40"
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                    target === "ALL" ? "bg-[var(--edc-primary)] text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  }`}>
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Todos los estudiantes visibles
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {rows.length} alumnos
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Aplica la nota a la totalidad de alumnos mostrados según los filtros actuales.
                    </p>
                  </div>
                </button>

                {/* Opción B: Solo seleccionados */}
                <button
                  type="button"
                  disabled={selectedStudentIds.length === 0}
                  onClick={() => setTarget("SELECTED")}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    selectedStudentIds.length === 0
                      ? "opacity-50 cursor-not-allowed border-slate-100 bg-slate-50/50 dark:border-slate-800"
                      : target === "SELECTED"
                      ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/20 ring-2 ring-[var(--edc-primary)]/20 shadow-xs cursor-pointer"
                      : "border-slate-200 bg-white hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-850/40 cursor-pointer"
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                    target === "SELECTED" ? "bg-[var(--edc-primary)] text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  }`}>
                    <UserCheck className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Solo seleccionados
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {selectedStudentIds.length} marcados
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedStudentIds.length > 0
                        ? "Aplica la nota exclusivamente a los estudiantes marcados con casilla de verificación."
                        : "Marca estudiantes con checkbox en la planilla para habilitar esta opción."}
                    </p>
                  </div>
                </button>

                {/* Opción C: Solo celdas vacías */}
                <button
                  type="button"
                  onClick={() => setTarget("EMPTY_ONLY")}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                    target === "EMPTY_ONLY"
                      ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20 shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-850/40"
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                    target === "EMPTY_ONLY" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  }`}>
                    <Inbox className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Solo celdas vacías
                        </p>
                        <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[9px] font-extrabold text-amber-800">
                          Protege notas existentes
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Califica únicamente a quienes aún no tengan calificación registrada en esta evaluación.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Resumen previo */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 flex items-center justify-between">
              <span className="font-semibold">Resumen de estudiantes afectados:</span>
              <span className="rounded-xl bg-blue-100/80 px-2.5 py-1 text-xs font-black text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                {affectedCount} de {rows.length} estudiantes
              </span>
            </div>
          </div>
        ) : (
          /* PASO DE CONFIRMACIÓN OBLIGATORIO */
          <div className="p-5 sm:p-6 space-y-4">
            <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    Confirmar Calificación Masiva
                  </h4>
                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                    Vas a aplicar la nota{" "}
                    <strong className="font-extrabold underline">{gradeText}</strong> a{" "}
                    <strong className="font-extrabold underline">{affectedCount}</strong> estudiante
                    {affectedCount === 1 ? "" : "s"} en la evaluación{" "}
                    <strong className="font-semibold">"{activeAssessment?.title}"</strong>.
                  </p>
                  {target === "EMPTY_ONLY" && (
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Se omitirán los estudiantes que ya cuenten con calificación en esta evaluación.
                    </p>
                  )}
                  <p className="text-[11px] text-amber-800/80 pt-1">
                    Los cambios quedarán como <em>pendientes</em> para que puedas revisarlos y confirmarlos antes de guardar en la planilla.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50 flex items-center justify-between sm:justify-end gap-2.5">
          {!confirmStep ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-2xl px-4 text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(validationError) || affectedCount === 0}
                onClick={handleProceedToConfirm}
                className="h-10 rounded-2xl bg-[var(--edc-primary)] px-5 text-xs font-bold text-white shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
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
                className="h-10 rounded-2xl px-4 text-xs font-semibold border-slate-200 cursor-pointer"
              >
                Volver
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmAndApply}
                className="h-10 rounded-2xl bg-amber-600 px-5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(217,119,6,0.3)] hover:bg-amber-700 cursor-pointer"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Aplicar {gradeText} a {affectedCount} estudiantes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

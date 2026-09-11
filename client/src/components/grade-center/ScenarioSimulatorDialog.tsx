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
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from "lucide-react";
import {
  type GradeScaleConfig,
  studentName,
  numberValue,
  getPerformanceTone,
  calculateDefinitiva,
} from "./gradeCenterUtils";
import {
  getInstitutionalPassingGrade,
  calculateWhatIsNeededToPass,
} from "./gradeIntelligenceUtils";
import type { GradeCenterTableRow } from "./GradeCenterTable";

interface ScenarioSimulatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRow: GradeCenterTableRow | null;
  scale?: GradeScaleConfig | null;
  pendingGrades?: Record<string, number | null>;
}

export function ScenarioSimulatorDialog({
  open,
  onOpenChange,
  studentRow,
  scale,
  pendingGrades,
}: ScenarioSimulatorDialogProps) {
  const passingGrade = getInstitutionalPassingGrade(scale);
  const minVal = scale?.minValue ?? 0;
  const maxVal = scale?.maxValue ?? 5;
  const decimals = scale?.decimalPlaces ?? 1;

  // Estado local exclusivo de notas simuladas (100% en memoria, jamás toca la BD ni pendingGrades)
  const [simulatedGrades, setSimulatedGrades] = React.useState<Record<number, number | null>>({});

  // Resetear simulación cuando cambia el estudiante o se abre/cierra el diálogo
  React.useEffect(() => {
    setSimulatedGrades({});
  }, [open, studentRow?.enrollment.studentUserId]);

  const handleClose = React.useCallback(() => {
    setSimulatedGrades({});
    onOpenChange(false);
  }, [onOpenChange]);

  if (!studentRow) return null;

  const sName = studentName(studentRow.student);
  const studentId = studentRow.enrollment.studentUserId;

  // Extraer valores base del estudiante (incorporando cambios pendientes de la planilla)
  const baseValues = (studentRow.values ?? []).map(v => {
    const key = `${v.assessment.id}:${studentId}`;
    const liveVal =
      pendingGrades && Object.prototype.hasOwnProperty.call(pendingGrades, key)
        ? pendingGrades[key]
        : v.grade?.value !== null && v.grade?.value !== undefined && !isNaN(Number(v.grade?.value))
        ? Number(v.grade?.value)
        : null;

    return {
      assessmentId: v.assessment.id,
      title: v.assessment.title,
      assessmentType: v.assessment.assessmentType,
      weight: Number(v.assessment.weight) || 0,
      maxValue: Number(v.assessment.maxValue) || maxVal,
      originalValue: liveVal,
    };
  });

  const pendingAssessments = baseValues.filter(v => v.originalValue === null);

  // Cálculo "¿Qué necesito para aprobar?" sobre notas reales
  const neededToPass = calculateWhatIsNeededToPass(
    baseValues.map(v => ({
      value: v.originalValue,
      maxValue: v.maxValue,
      weight: v.weight,
    })),
    scale
  );

  // Definitiva Real basada únicamente en las notas reales del estudiante
  const actualDefinitiva = calculateDefinitiva(
    baseValues.map(v => ({
      value: v.originalValue,
      maxValue: v.maxValue,
      weight: v.weight,
    }))
  );
  const actualTone = getPerformanceTone(actualDefinitiva);

  // Definitiva Simulada aplicando los overrides en memoria (aplica a CUALQUIER evaluación)
  const simulatedDefinitiva = calculateDefinitiva(
    baseValues.map(v => ({
      value:
        simulatedGrades[v.assessmentId] !== undefined
          ? simulatedGrades[v.assessmentId]
          : v.originalValue,
      maxValue: v.maxValue,
      weight: v.weight,
    }))
  );
  const simulatedTone = getPerformanceTone(simulatedDefinitiva);
  const isPassingSimulated =
    simulatedDefinitiva !== null && simulatedDefinitiva >= passingGrade;

  // Diferencia calculada respecto a la real
  const delta =
    simulatedDefinitiva !== null && actualDefinitiva !== null
      ? Number((simulatedDefinitiva - actualDefinitiva).toFixed(decimals))
      : null;

  const overriddenCount = Object.keys(simulatedGrades).length;

  // Modificar nota simulada de cualquier evaluación (calificada o pendiente)
  const handleSetGrade = (assessmentId: number, val: number | null) => {
    setSimulatedGrades(prev => {
      const copy = { ...prev };
      if (val === null || isNaN(val)) {
        delete copy[assessmentId];
      } else {
        copy[assessmentId] = Math.max(minVal, Math.min(maxVal, val));
      }
      return copy;
    });
  };

  const handleResetSingleGrade = (assessmentId: number) => {
    setSimulatedGrades(prev => {
      const copy = { ...prev };
      delete copy[assessmentId];
      return copy;
    });
  };

  const handleApplyPresetToPending = (targetGrade: number) => {
    const next: Record<number, number | null> = { ...simulatedGrades };
    for (const p of pendingAssessments) {
      next[p.assessmentId] = targetGrade;
    }
    setSimulatedGrades(next);
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => (!isOpen ? handleClose() : onOpenChange(true))}>
      <DialogContent
        className="max-w-xl rounded-2xl p-0 overflow-hidden border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onKeyDownCapture={e => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }
        }}
      >
        {/* Encabezado */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Simulador de Escenarios
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    100% en memoria
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Proyecta y simula la definitiva de{" "}
                  <strong className="text-slate-800 dark:text-slate-200">{sName}</strong> sin
                  modificar la base de datos ni los cambios de la planilla.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Cerrar simulador"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tarjeta de Comparación: Real vs Simulada */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-850">
            {/* Definitiva Real */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Definitiva Real
                </span>
                {actualDefinitiva !== null && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold leading-none ${actualTone.badgeColor}`}
                  >
                    {actualTone.label}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-700 dark:text-slate-300">
                  {numberValue(actualDefinitiva)}
                </span>
                <span className="text-xs text-slate-400">/ {maxVal.toFixed(1)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Basada en {baseValues.length - pendingAssessments.length} de {baseValues.length}{" "}
                notas oficiales
              </p>
            </div>

            {/* Definitiva Simulada */}
            <div className="space-y-1 border-l border-slate-200/80 pl-3.5 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Simulación
                </span>
                {delta !== null && delta !== 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      delta > 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta} pts
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black tracking-tight ${simulatedTone.textColor}`}>
                  {numberValue(simulatedDefinitiva)}
                </span>
                {simulatedDefinitiva !== null && (
                  <Badge
                    className={`text-[10px] font-bold py-0 px-1.5 ${
                      isPassingSimulated
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : "bg-rose-500 hover:bg-rose-600 text-white"
                    }`}
                  >
                    {isPassingSimulated ? "Aprobaría" : "Reprobaría"}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {overriddenCount === 0
                  ? "Sin cambios simulados"
                  : `${overriddenCount} evaluación${overriddenCount === 1 ? "" : "es"} simulada${
                      overriddenCount === 1 ? "" : "s"
                    }`}
              </p>
            </div>
          </div>

          {/* Información "¿Qué necesita para aprobar?" sobre notas pendientes reales */}
          {neededToPass.hasPending && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                neededToPass.isGuaranteed
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : neededToPass.isImpossible
                  ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200"
                  : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
              }`}
            >
              {neededToPass.isGuaranteed ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : neededToPass.isImpossible ? (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="flex-1 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{neededToPass.message}</span>
                  {neededToPass.requiredGrade !== null &&
                    !neededToPass.isImpossible &&
                    !neededToPass.isGuaranteed && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyPresetToPending(neededToPass.requiredGrade!)}
                        className="h-6 text-[10px] px-2 border-amber-300 bg-white/80 hover:bg-amber-100 text-amber-900 font-semibold dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200 cursor-pointer"
                      >
                        Probar nota mínima ({neededToPass.requiredGrade})
                      </Button>
                    )}
                </div>
                <p className="text-[11px] opacity-90">
                  Nota mínima aprobatoria institucional:{" "}
                  <strong>{passingGrade.toFixed(1)}</strong> ({maxVal.toFixed(1)} máx).
                </p>
              </div>
            </div>
          )}

          {/* Atajos Rápidos de Escenarios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {pendingAssessments.length > 0
                  ? "Atajos rápidos (simular evaluaciones pendientes):"
                  : "Atajos de simulación:"}
              </span>
              {overriddenCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSimulatedGrades({})}
                  className="h-6 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restablecer a notas reales
                </Button>
              )}
            </div>

            {pendingAssessments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[3.0, 3.5, 4.0, 4.5, 5.0].map(val => (
                  <Button
                    key={val}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPresetToPending(val)}
                    className="h-7 px-2.5 text-xs font-semibold rounded-lg border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Si saca {val.toFixed(1)} en pendientes
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de TODAS las Evaluaciones (tanto calificadas como pendientes) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Evaluaciones ({baseValues.length})</span>
              <span>Nota Real vs Simulada</span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {baseValues.map(item => {
                const isOriginallyPending = item.originalValue === null;
                const isOverridden = simulatedGrades[item.assessmentId] !== undefined;
                const simVal = simulatedGrades[item.assessmentId];

                return (
                  <div
                    key={item.assessmentId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      isOverridden
                        ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/30"
                        : "border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-850/40"
                    }`}
                  >
                    {/* Detalles de la evaluación y nota original */}
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                          {item.title}
                        </span>
                        {isOriginallyPending ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] py-0 px-1 font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            Pendiente
                          </Badge>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500">
                            (Real: <strong>{item.originalValue?.toFixed(decimals)}</strong>)
                          </span>
                        )}
                        {isOverridden && (
                          <Badge className="text-[9px] py-0 px-1 font-bold bg-indigo-600 text-white">
                            Simulada
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Peso: {item.weight}% · Escala máx: {item.maxValue.toFixed(1)}
                      </span>
                    </div>

                    {/* Controles de Simulación para esta evaluación */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative flex items-center">
                        <Input
                          type="number"
                          step="0.1"
                          min={minVal}
                          max={item.maxValue}
                          value={simVal !== undefined && simVal !== null ? simVal : ""}
                          placeholder={
                            item.originalValue !== null
                              ? String(item.originalValue.toFixed(decimals))
                              : "0.0"
                          }
                          onChange={e => {
                            const raw = e.target.value;
                            const v = raw === "" ? null : parseFloat(raw);
                            handleSetGrade(item.assessmentId, v);
                          }}
                          className={`h-8 w-20 text-center font-bold text-xs rounded-lg transition-colors ${
                            isOverridden
                              ? "border-indigo-400 bg-white text-indigo-700 ring-2 ring-indigo-100 dark:bg-slate-800 dark:text-indigo-300 dark:ring-indigo-950"
                              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        />
                      </div>

                      {/* Botón para restablecer esta evaluación si está simulada */}
                      {isOverridden && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetSingleGrade(item.assessmentId)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Restablecer a nota real"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recordatorio de aislamiento y seguridad */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.2" />
            <span>
              Este simulador opera exclusivamente en memoria temporal del navegador. Ningún valor
              ingresado aquí modifica la planilla oficial, las notas pendientes ni genera registros
              o auditorías en la base de datos.
            </span>
          </div>
        </div>

        {/* Footer con botones Cancelar y Cerrar */}
        <DialogFooter className="p-3 border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100 dark:border-slate-700"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleClose}
            className="text-xs font-semibold rounded-xl bg-[var(--edc-primary)] hover:bg-[var(--edc-primary)]/90 text-white shadow-xs"
          >
            Cerrar simulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

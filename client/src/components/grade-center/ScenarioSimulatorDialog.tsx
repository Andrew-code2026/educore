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
import { Calculator, RotateCcw, Sparkles, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import {
  type GradeScaleConfig,
  studentName,
  numberValue,
  getPerformanceTone,
} from "./gradeCenterUtils";
import {
  getInstitutionalPassingGrade,
  calculateWhatIsNeededToPass,
  simulateDefinitiva,
} from "./gradeIntelligenceUtils";
import type { GradeCenterTableRow } from "./GradeCenterTable";

interface ScenarioSimulatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRow: GradeCenterTableRow | null;
  scale?: GradeScaleConfig | null;
}

export function ScenarioSimulatorDialog({
  open,
  onOpenChange,
  studentRow,
  scale,
}: ScenarioSimulatorDialogProps) {
  if (!studentRow) return null;

  const sName = studentName(studentRow.student);
  const passingGrade = getInstitutionalPassingGrade(scale);
  const minVal = scale?.minValue ?? 0;
  const maxVal = scale?.maxValue ?? 5;
  const decimals = scale?.decimalPlaces ?? 1;

  // Extraer valores base del estudiante
  const baseValues = React.useMemo(() => {
    return (studentRow.values ?? []).map(v => ({
      assessmentId: v.assessment.id,
      title: v.assessment.title,
      weight: Number(v.assessment.weight) || 0,
      maxValue: Number(v.assessment.maxValue) || maxVal,
      originalValue: v.grade?.value !== null && v.grade?.value !== undefined && !isNaN(Number(v.grade?.value))
        ? Number(v.grade?.value)
        : null,
    }));
  }, [studentRow, maxVal]);

  // Identificar evaluaciones pendientes vs calificadas
  const pendingAssessments = React.useMemo(() => {
    return baseValues.filter(v => v.originalValue === null);
  }, [baseValues]);

  // Estado local de notas simuladas para las pendientes
  const [simulatedGrades, setSimulatedGrades] = React.useState<Record<number, number>>({});

  // Resetear simulación cuando cambia el estudiante o se abre el diálogo
  React.useEffect(() => {
    if (open) {
      setSimulatedGrades({});
    }
  }, [open, studentRow?.enrollment.id]);

  // Cálculo "¿Qué necesito para aprobar?"
  const neededToPass = React.useMemo(() => {
    return calculateWhatIsNeededToPass(
      baseValues.map(v => ({
        value: v.originalValue,
        maxValue: v.maxValue,
        weight: v.weight,
      })),
      scale
    );
  }, [baseValues, scale]);

  // Establecer notas rápidas uniformes en todas las pendientes
  const handleApplyPreset = (targetGrade: number) => {
    const next: Record<number, number> = {};
    for (const p of pendingAssessments) {
      next[p.assessmentId] = targetGrade;
    }
    setSimulatedGrades(next);
  };

  // Establecer nota específica para una evaluación
  const handleSetPendingGrade = (assessmentId: number, val: number | null) => {
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

  // Calcular definitiva actual y definitiva simulada
  const actualDefinitiva = studentRow.average;

  const simulationResult = React.useMemo(() => {
    const valuesForSim = baseValues.map(v => ({
      value: v.originalValue,
      maxValue: v.maxValue,
      weight: v.weight,
    }));

    // Reemplazar pendientes con las que estén en simulatedGrades
    const pendingOverrides = pendingAssessments.map(p => ({
      value: simulatedGrades[p.assessmentId] !== undefined ? simulatedGrades[p.assessmentId] : null,
      maxValue: p.maxValue,
      weight: p.weight,
    }));

    return simulateDefinitiva(valuesForSim, pendingOverrides);
  }, [baseValues, pendingAssessments, simulatedGrades]);

  const simulatedDefinitiva = simulationResult.simulatedDefinitiva;
  const simulatedTone = getPerformanceTone(simulatedDefinitiva);
  const isPassingSimulated = simulatedDefinitiva !== null && simulatedDefinitiva >= passingGrade;

  // Diferencia respecto a la actual
  const delta = (simulatedDefinitiva !== null && actualDefinitiva !== null)
    ? Number((simulatedDefinitiva - actualDefinitiva).toFixed(decimals))
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Encabezado */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Simulador de Escenarios
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  En memoria
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Proyecta y simula la definitiva de <strong className="text-slate-800 dark:text-slate-200">{sName}</strong> sin modificar la base de datos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tarjeta de Comparación: Actual vs Simulada */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-850">
            {/* Definitiva Actual */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Definitiva Actual
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-700 dark:text-slate-300">
                  {numberValue(actualDefinitiva)}
                </span>
                <span className="text-xs text-slate-400">/ {maxVal.toFixed(1)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Basada en {baseValues.length - pendingAssessments.length} de {baseValues.length} notas
              </p>
            </div>

            {/* Definitiva Simulada */}
            <div className="space-y-1 border-l border-slate-200/80 pl-3.5 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Simulación
                </span>
                {delta !== null && delta !== 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${delta > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black tracking-tight ${simulatedTone.textColor}`}>
                  {numberValue(simulatedDefinitiva)}
                </span>
                {simulatedDefinitiva !== null && (
                  <Badge className={`text-[10px] font-bold py-0 px-1.5 ${isPassingSimulated ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-rose-500 hover:bg-rose-600 text-white"}`}>
                    {isPassingSimulated ? "Aprobaría" : "Reprobaría"}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {Object.keys(simulatedGrades).length} pendiente(s) simulada(s)
              </p>
            </div>
          </div>

          {/* Información "¿Qué necesita para aprobar?" */}
          {neededToPass.hasPending && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              neededToPass.isGuaranteed
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                : neededToPass.isImpossible
                ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200"
                : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
            }`}>
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
                  {neededToPass.requiredGrade !== null && !neededToPass.isImpossible && !neededToPass.isGuaranteed && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyPreset(neededToPass.requiredGrade!)}
                      className="h-6 text-[10px] px-2 border-amber-300 bg-white/80 hover:bg-amber-100 text-amber-900 font-semibold dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200"
                    >
                      Probar nota mínima ({neededToPass.requiredGrade})
                    </Button>
                  )}
                </div>
                <p className="text-[11px] opacity-90">
                  Nota mínima aprobatoria institucional: <strong>{passingGrade.toFixed(1)}</strong> ({maxVal.toFixed(1)} máx).
                </p>
              </div>
            </div>
          )}

          {/* Atajos Rápidos de Escenarios */}
          {pendingAssessments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Atajos rápidos (aplicar a todas las pendientes):
                </span>
                {Object.keys(simulatedGrades).length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSimulatedGrades({})}
                    className="h-6 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[3.0, 3.5, 4.0, 4.5, 5.0].map(val => (
                  <Button
                    key={val}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset(val)}
                    className="h-7 px-2.5 text-xs font-semibold rounded-lg border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Si saca {val.toFixed(1)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Evaluaciones: Control individual */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Evaluaciones ({baseValues.length})
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {baseValues.map(item => {
                const isPending = item.originalValue === null;
                const simVal = simulatedGrades[item.assessmentId];
                const activeVal = isPending ? simVal : item.originalValue;

                return (
                  <div
                    key={item.assessmentId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      isPending
                        ? "border-indigo-100 bg-indigo-50/30 dark:border-indigo-950/60 dark:bg-indigo-950/20"
                        : "border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-850/40 opacity-75"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </span>
                        {isPending && (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1 font-semibold text-indigo-700 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Pendiente
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Peso: {item.weight}% · Escala: {minVal.toFixed(1)} - {item.maxValue.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            min={minVal}
                            max={item.maxValue}
                            value={simVal !== undefined ? simVal : ""}
                            placeholder="Simular"
                            onChange={e => {
                              const v = e.target.value === "" ? null : parseFloat(e.target.value);
                              handleSetPendingGrade(item.assessmentId, v);
                            }}
                            className="h-8 w-20 text-center font-bold text-xs rounded-lg border-indigo-200 focus:border-indigo-500 dark:border-indigo-800"
                          />
                          <span className="text-[10px] font-semibold text-slate-400">
                            / {item.maxValue.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                            {item.originalValue?.toFixed(decimals)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (Calificada)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advertencia / Recordatorio institucional */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.2" />
            <span>
              Este simulador opera exclusivamente en memoria del navegador. Ningún valor ingresado aquí afecta las notas oficiales ni genera auditorías o cambios en la base de datos.
            </span>
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
            Cerrar simulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

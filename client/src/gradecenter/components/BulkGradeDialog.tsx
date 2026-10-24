import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, PenLine, UserCheck, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { formatGrade } from "../lib/format";
import { MAX_GRADE, MIN_GRADE } from "../domain/scale";

export type BulkScope = "visible" | "selected" | "empty";

interface BulkGradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvaluationId?: string;
}

const scopeOptions: Array<{
  id: BulkScope;
  title: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "visible",
    title: "Todos los estudiantes visibles",
    description: "Aplica la nota a la totalidad de alumnos mostrados según los filtros actuales.",
    icon: Users,
  },
  {
    id: "selected",
    title: "Solo seleccionados",
    description: "Aplica la nota únicamente a las filas marcadas con checkbox en la planilla.",
    icon: UserCheck,
  },
  {
    id: "empty",
    title: "Solo celdas vacías",
    description: "Califica únicamente a quienes aún no tengan calificación registrada en esta evaluación.",
    icon: Inbox,
  },
];

export function BulkGradeDialog({ open, onOpenChange, initialEvaluationId }: BulkGradeDialogProps) {
  const { students, evaluations, selectedRows, gradeAt, bulkGrade, activeCell } = useGradeCenter();
  const [evaluationId, setEvaluationId] = useState(initialEvaluationId ?? evaluations[activeCell.col]?.id ?? evaluations[0]?.id ?? "");
  const [scope, setScope] = useState<BulkScope>("visible");
  const [protectExisting, setProtectExisting] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEvaluationId(initialEvaluationId ?? evaluations[activeCell.col]?.id ?? evaluations[0]?.id ?? "");
    setScope(selectedRows.length > 0 ? "selected" : "visible");
    setProtectExisting(true);
    setValue("");
    setError(null);
  }, [open, initialEvaluationId, evaluations, activeCell.col, selectedRows.length]);

  const evaluation = evaluations.find((item) => item.id === evaluationId) ?? evaluations[0];
  const candidates = useMemo(() => {
    const base = scope === "selected" ? students.filter((item) => selectedRows.includes(item.student.id)) : students;
    if (scope === "empty" || protectExisting) return base.filter((item) => gradeAt(item.student.id, evaluation?.id ?? "") == null);
    return base;
  }, [scope, protectExisting, students, selectedRows, gradeAt, evaluation?.id]);

  const existingCount = useMemo(() => {
    const base = scope === "selected" ? students.filter((item) => selectedRows.includes(item.student.id)) : students;
    return base.filter((item) => gradeAt(item.student.id, evaluation?.id ?? "") != null).length;
  }, [scope, students, selectedRows, gradeAt, evaluation?.id]);

  const save = () => {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (!evaluation || !Number.isFinite(parsed) || parsed < MIN_GRADE || parsed > MAX_GRADE) {
      setError(`Escribe una nota entre ${MIN_GRADE.toFixed(1)} y ${MAX_GRADE.toFixed(1)}.`);
      return;
    }
    if (candidates.length === 0) {
      setError("No hay celdas que cumplan este alcance.");
      return;
    }
    bulkGrade(evaluation.id, candidates.map((item) => item.student.id), parsed, protectExisting || scope === "empty");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[min(760px,calc(100vh-2rem))] max-w-2xl overflow-y-auto rounded-3xl border-white/12 p-5">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/14 text-[var(--gc-cobalt)]">
              <PenLine className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Calificación masiva</DialogTitle>
              <DialogDescription className="mt-1 text-xs">Asigna una misma nota a una evaluación específica sin salir de la matriz.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-1 space-y-4">
          <label className="block">
            <span className="gc-label mb-1.5 block text-xs">1. ¿QUÉ EVALUACIÓN?</span>
            <select
              value={evaluation?.id ?? ""}
              onChange={(event) => setEvaluationId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] outline-none focus:border-[var(--gc-cobalt)]/60"
            >
              {evaluations.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.weight}%</option>)}
            </select>
          </label>

          <div>
            <div className="gc-label mb-2 text-xs">2. ¿QUÉ NOTA APLICAR?</div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              <input
                value={value}
                onChange={(event) => { setValue(event.target.value.replace(/[^0-9.,]/g, "")); setError(null); }}
                inputMode="decimal"
                placeholder="Ej. 4.0"
                aria-label="Nota masiva"
                autoFocus
                className="gc-input gc-num min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center text-xl font-semibold outline-none"
              />
              <span className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-xs text-muted-foreground">Escala /5.0</span>
              <button type="button" onClick={() => setValue("5.0")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/9">5.0</button>
            </div>
            {error && <div role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--gc-bajo)]"><AlertTriangle className="size-3" />{error}</div>}
          </div>

          <div>
            <div className="gc-label mb-2 text-xs">3. ¿A QUIÉNES APLICAR?</div>
            <div className="space-y-2">
              {scopeOptions.map((option) => {
                const Icon = option.icon;
                const active = scope === option.id;
                const disabled = option.id === "selected" && selectedRows.length === 0;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScope(option.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                      active ? "border-[var(--gc-cobalt)]/80 bg-[var(--gc-cobalt)]/10 shadow-[0_0_0_1px_color-mix(in_oklab,var(--gc-cobalt)_35%,transparent)]" : "border-white/8 bg-white/3 hover:bg-white/6",
                      disabled && "cursor-not-allowed opacity-45",
                    )}
                  >
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border", active ? "border-[var(--gc-cobalt)]/45 bg-[var(--gc-cobalt)]/25 text-[var(--gc-cobalt)]" : "border-white/10 bg-white/5 text-muted-foreground")}><Icon className="size-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold"><span>{option.title}</span><span className="gc-num text-xs text-muted-foreground">{option.id === "selected" ? `${selectedRows.length} marcados` : `${option.id === "empty" ? candidates.length : students.length} alumnos`}</span></span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={protectExisting || scope === "empty"} disabled={scope === "empty"} onChange={(event) => setProtectExisting(event.target.checked)} className="size-3 accent-[var(--gc-cobalt)]" />
              Proteger notas existentes
              {scope === "empty" && <span className="ml-auto rounded-full bg-[var(--gc-basico)]/20 px-2 py-0.5 text-xs text-[var(--gc-basico)]">Protege notas existentes</span>}
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--gc-cobalt)]/20 bg-[var(--gc-cobalt)]/7 px-3 py-2.5">
            <span className="text-xs font-semibold">Resumen de estudiantes afectados:</span>
            <span className="gc-num rounded-full bg-[var(--gc-cobalt)]/18 px-2.5 py-1 text-xs font-semibold text-[var(--gc-cobalt)]">{candidates.length} de {scope === "selected" ? selectedRows.length : students.length} estudiantes</span>
          </div>

          {existingCount > 0 && !protectExisting && scope !== "empty" && <div className="flex items-start gap-2 text-xs text-[var(--gc-basico)]"><AlertTriangle className="mt-0.5 size-3 shrink-0" />Se reemplazarán {existingCount} notas existentes en esta evaluación.</div>}

          <div className="flex justify-end gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:bg-white/8">Cancelar</button>
            <button type="button" onClick={save} disabled={!evaluation || candidates.length === 0} className="flex items-center gap-1.5 rounded-xl bg-[var(--gc-cobalt)]/25 px-3.5 py-2 text-xs font-semibold hover:bg-[var(--gc-cobalt)]/35 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="size-3.5" />Aplicar a {candidates.length}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

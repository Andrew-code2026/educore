import { useId, useMemo, useState, type FormEvent } from "react";
import { PenLine } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { parseGradeInput } from "../../domain/grading";
import { gradeKey } from "../../types";
import {
  ActionButton,
  DIALOG_CONTENT_CLASS,
  DialogFooterBar,
  DialogHeaderBar,
  FIELD_CLASS,
  Field,
  Segmented,
} from "./parts";

type Scope = "visible" | "selected";

const QUICK_VALUES = ["5.0", "4.5", "4.0", "3.5", "3.0"];

/**
 * Asigna la misma nota a varios estudiantes en una evaluación. El estado se
 * fija al abrir: los datos que llegan en segundo plano no reinician el formulario.
 */
export function BulkGradeDialog({
  open,
  onOpenChange,
  initialEvaluationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvaluationId?: string;
}) {
  const { students, evaluations, selectedRows, dataset, bulkGrade } = useGradeCenter();
  const [evaluationId, setEvaluationId] = useState(() =>
    evaluations.some((item) => item.id === initialEvaluationId) ? initialEvaluationId! : evaluations[0]?.id ?? "",
  );
  const [scope, setScope] = useState<Scope>(() => (selectedRows.length > 0 ? "selected" : "visible"));
  const [keepExisting, setKeepExisting] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = { evaluation: useId(), value: useId(), keep: useId() };

  const { targets, overwriteCount } = useMemo(() => {
    const selected = new Set(selectedRows);
    const base = scope === "selected" ? students.filter((item) => selected.has(item.student.id)) : students;
    const graded = base.filter((item) => dataset.grades[gradeKey(item.student.id, evaluationId)] != null);
    return {
      targets: keepExisting ? base.filter((item) => dataset.grades[gradeKey(item.student.id, evaluationId)] == null) : base,
      overwriteCount: keepExisting ? 0 : graded.length,
    };
  }, [scope, keepExisting, students, selectedRows, dataset.grades, evaluationId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseGradeInput(value);
    if (!parsed.ok || parsed.value == null) {
      setError(parsed.ok ? "Escribe la nota que quieres aplicar." : parsed.error);
      return;
    }
    if (targets.length === 0) {
      setError("No hay estudiantes a los que aplicar la nota con esta configuración.");
      return;
    }
    bulkGrade(evaluationId, targets.map((item) => item.student.id), parsed.value, keepExisting);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT_CLASS}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeaderBar
            icon={<PenLine className="size-4" />}
            title="Calificar en bloque"
            description="Aplica la misma nota a varios estudiantes en una evaluación."
          />

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Evaluación" htmlFor={ids.evaluation}>
              <select
                id={ids.evaluation}
                value={evaluationId}
                onChange={(event) => setEvaluationId(event.target.value)}
                className={FIELD_CLASS}
              >
                {evaluations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name} ({item.weight}%)
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nota" htmlFor={ids.value}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={ids.value}
                  autoFocus
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value.replace(/[^0-9.,]/g, ""));
                    setError(null);
                  }}
                  inputMode="decimal"
                  placeholder="0.0 – 5.0"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${ids.value}-error` : undefined}
                  className={cn(FIELD_CLASS, "gc-num w-28 text-center text-base font-semibold")}
                />
                <div className="flex gap-1" role="group" aria-label="Notas frecuentes">
                  {QUICK_VALUES.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => {
                        setValue(quick);
                        setError(null);
                      }}
                      aria-pressed={value === quick}
                      className="gc-num rounded-lg border border-white/8 bg-white/4 px-2 py-1.5 text-xs transition-colors hover:bg-white/8 aria-pressed:border-[var(--gc-cobalt)]/60 aria-pressed:bg-[var(--gc-cobalt)]/12"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <p id={`${ids.value}-error`} role="alert" className="mt-1 text-xs text-[var(--gc-bajo)]">
                  {error}
                </p>
              )}
            </Field>

            <Field label="Aplicar a">
              <Segmented
                label="Estudiantes a calificar"
                value={scope}
                onChange={setScope}
                options={[
                  { id: "visible", label: `Visibles (${students.length})`, hint: "Según búsqueda y filtros." },
                  {
                    id: "selected",
                    label: `Seleccionados (${selectedRows.length})`,
                    hint: selectedRows.length ? "Filas marcadas en la planilla." : "Marca filas en la planilla.",
                    disabled: selectedRows.length === 0,
                  },
                ]}
              />
            </Field>

            <label htmlFor={ids.keep} className="flex items-center gap-2 text-sm">
              <input
                id={ids.keep}
                type="checkbox"
                checked={keepExisting}
                onChange={(event) => setKeepExisting(event.target.checked)}
                className="size-4 accent-[var(--gc-cobalt)]"
              />
              Conservar las notas ya registradas
            </label>
            {overwriteCount > 0 && (
              <p className="text-xs text-[var(--gc-basico)]">
                Se reemplazarán {overwriteCount} {overwriteCount === 1 ? "nota existente" : "notas existentes"}.
              </p>
            )}
          </div>

          <DialogFooterBar aside={`${targets.length} ${targets.length === 1 ? "estudiante" : "estudiantes"}`}>
            <ActionButton onClick={() => onOpenChange(false)}>Cancelar</ActionButton>
            <ActionButton type="submit" tone="primary" disabled={!evaluationId || targets.length === 0}>
              Aplicar a {targets.length}
            </ActionButton>
          </DialogFooterBar>
        </form>
      </DialogContent>
    </Dialog>
  );
}

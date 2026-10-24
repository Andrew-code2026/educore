import { useId, useState, type FormEvent } from "react";
import { ClipboardPenLine, ClipboardPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TYPE_META } from "../../data/curriculum";
import { useGradeCenter } from "../../state/GradeCenterContext";
import type { Evaluation, EvaluationStatus, EvaluationTypeId } from "../../types";
import {
  ActionButton,
  DIALOG_CONTENT_CLASS,
  DialogFooterBar,
  DialogHeaderBar,
  FIELD_CLASS,
  Field,
  FormError,
  Segmented,
} from "./parts";

const TYPE_OPTIONS = Object.values(TYPE_META);

const STATUS_OPTIONS: { id: EvaluationStatus; label: string; hint: string }[] = [
  { id: "active", label: "Activa", hint: "Cuenta en la definitiva." },
  { id: "preparing", label: "En preparación", hint: "Visible, pero no cuenta en la definitiva." },
];

type FieldErrors = Partial<Record<"name" | "weight" | "form", string>>;

/**
 * Formulario único para crear o editar una evaluación. El estado se inicializa
 * al montar (el host lo remonta en cada apertura), así una recarga de datos en
 * segundo plano nunca borra lo que el docente está escribiendo.
 */
export function EvaluationFormDialog({
  open,
  onOpenChange,
  evaluation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sin evaluación se crea una nueva. */
  evaluation?: Evaluation;
}) {
  const { createEvaluation, updateEvaluation, weightIntegrity, dataset } = useGradeCenter();
  const isEdit = Boolean(evaluation);
  const available = Math.max(0, weightIntegrity.remaining + (evaluation?.weight ?? 0));

  const [initial] = useState(() => ({
    name: evaluation?.name ?? "",
    type: evaluation?.type ?? ("taller" as EvaluationTypeId),
    date: evaluation?.date ?? "",
    weight: evaluation ? String(evaluation.weight) : String(available),
    description: evaluation?.description ?? "",
    // Sin ponderación libre, una nueva evaluación solo puede nacer en preparación.
    status: evaluation?.status ?? ((available > 0 ? "active" : "preparing") as EvaluationStatus),
  }));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const ids = { name: useId(), type: useId(), weight: useId(), date: useId(), description: useId() };

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setConfirmDiscard(false);
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const name = form.name.trim();
    const weight = Number(form.weight.replace(",", "."));
    if (name.length < 3) next.name = "Escribe un nombre de al menos 3 caracteres.";
    if (form.weight.trim() === "" || !Number.isFinite(weight) || weight < 0) next.weight = "Escribe una ponderación válida.";
    else if (weight > available) next.weight = `Solo hay ${available}% disponible.`;
    else if (form.status === "active" && weight === 0) next.weight = "Una evaluación activa necesita más de 0%.";
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const name = form.name.trim();
    const weight = Number(form.weight.replace(",", "."));
    setBusy(true);
    const result = evaluation
      ? await updateEvaluation(evaluation.id, {
          name,
          shortName: name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name,
          abbrev: name.length > 12 ? `${name.slice(0, 11).trimEnd()}…` : name,
          type: form.type,
          date: form.date,
          status: form.status,
          weight,
          description: form.description.trim() || undefined,
        })
      : await createEvaluation({
          name,
          type: form.type,
          date: form.date || undefined,
          weight,
          description: form.description,
          status: form.status,
        });
    setBusy(false);
    if (!result.ok) {
      setErrors({ form: result.error ?? "No se pudo guardar la evaluación." });
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT_CLASS}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeaderBar
            icon={isEdit ? <ClipboardPenLine className="size-4" /> : <ClipboardPlus className="size-4" />}
            title={isEdit ? `Editar ${evaluation?.code}` : "Nueva evaluación"}
            description={
              isEdit
                ? "Las calificaciones ya registradas se conservan."
                : `Se agrega como una columna nueva en ${dataset.course} · ${dataset.subject}.`
            }
          />

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Nombre" htmlFor={ids.name}>
              <input
                id={ids.name}
                autoFocus
                value={form.name}
                maxLength={80}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Ej. Taller de laboratorio"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${ids.name}-error` : undefined}
                className={FIELD_CLASS}
              />
              {errors.name && <p id={`${ids.name}-error`} className="mt-1 text-xs text-[var(--gc-bajo)]">{errors.name}</p>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" htmlFor={ids.type}>
                <select
                  id={ids.type}
                  value={form.type}
                  onChange={(event) => update("type", event.target.value as EvaluationTypeId)}
                  className={FIELD_CLASS}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha" optional htmlFor={ids.date}>
                <input
                  id={ids.date}
                  type="date"
                  value={form.date}
                  onChange={(event) => update("date", event.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
            </div>

            <Field label="Ponderación" htmlFor={ids.weight}>
              <div className="relative sm:w-1/2 sm:pr-2">
                <input
                  id={ids.weight}
                  value={form.weight}
                  onChange={(event) => update("weight", event.target.value.replace(/[^0-9.,]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={Boolean(errors.weight)}
                  aria-describedby={`${ids.weight}-hint`}
                  className={cn(FIELD_CLASS, "gc-num pr-8")}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground sm:right-5">%</span>
              </div>
              <p id={`${ids.weight}-hint`} className={errors.weight ? "mt-1 text-xs text-[var(--gc-bajo)]" : "mt-1 text-xs text-muted-foreground"}>
                {errors.weight ?? `Quedan ${available}% disponibles en el periodo.`}
              </p>
            </Field>

            <Field label="Estado">
              <Segmented label="Estado de la evaluación" value={form.status} options={STATUS_OPTIONS} onChange={(value) => update("status", value)} />
            </Field>

            <Field label="Descripción" optional htmlFor={ids.description}>
              <textarea
                id={ids.description}
                value={form.description}
                maxLength={500}
                rows={2}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Qué deben entregar o demostrar los estudiantes…"
                className={cn(FIELD_CLASS, "resize-none")}
              />
            </Field>

            {errors.form && <FormError>{errors.form}</FormError>}
          </div>

          {confirmDiscard ? (
            <DialogFooterBar aside={<span className="text-[var(--gc-basico)]">¿Descartar los cambios sin guardar?</span>}>
              <ActionButton onClick={() => setConfirmDiscard(false)}>Seguir editando</ActionButton>
              <ActionButton tone="danger" onClick={() => onOpenChange(false)}>
                Descartar
              </ActionButton>
            </DialogFooterBar>
          ) : (
            <DialogFooterBar>
              <ActionButton onClick={requestClose} disabled={busy}>
                Cancelar
              </ActionButton>
              <ActionButton type="submit" tone="primary" disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                {isEdit ? "Guardar cambios" : "Crear evaluación"}
              </ActionButton>
            </DialogFooterBar>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

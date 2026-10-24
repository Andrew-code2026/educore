import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardPenLine, Percent, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TYPE_META } from "../data/curriculum";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { Evaluation, EvaluationStatus, EvaluationTypeId } from "../types";

const TYPE_OPTIONS = Object.values(TYPE_META);

export function EditEvaluationDialog({ evaluation, open, onOpenChange }: { evaluation: Evaluation; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { updateEvaluation, weightIntegrity, dataset } = useGradeCenter();
  const [name, setName] = useState(evaluation.name);
  const [type, setType] = useState<EvaluationTypeId>(evaluation.type);
  const [date, setDate] = useState(evaluation.date);
  const [weight, setWeight] = useState(String(evaluation.weight));
  const [description, setDescription] = useState(evaluation.description ?? "");
  const [status, setStatus] = useState<EvaluationStatus>(evaluation.status ?? "active");
  const [error, setError] = useState<string | null>(null);

  const availableWeight = Math.min(100, Math.max(0, weightIntegrity.remaining + evaluation.weight));
  const parsedWeight = Number(weight.replace(",", "."));
  const statusLabel = useMemo(() => status === "preparing" ? "En preparación" : "Activa para cálculo", [status]);

  useEffect(() => {
    if (!open) return;
    setName(evaluation.name);
    setType(evaluation.type);
    setDate(evaluation.date);
    setWeight(String(evaluation.weight));
    setDescription(evaluation.description ?? "");
    setStatus(evaluation.status ?? "active");
    setError(null);
  }, [evaluation, open]);

  const close = () => {
    onOpenChange(false);
  };

  const submit = async () => {
    const result = await updateEvaluation(evaluation.id, {
      name: name.trim() || evaluation.name,
      shortName: (name.trim() || evaluation.name).slice(0, 16),
      abbrev: (name.trim() || evaluation.name).slice(0, 12),
      type,
      date,
      status,
      weight: Number.isFinite(parsedWeight) ? parsedWeight : Number.NaN,
      description: description.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar la evaluación.");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[min(780px,calc(100dvh-24px))] max-w-2xl overflow-y-auto rounded-[28px] border-white/12 p-0 shadow-[0_30px_90px_-28px_color-mix(in_oklab,var(--gc-cobalt)_55%,transparent)]">
        <div className="border-b border-white/8 bg-[var(--gc-cobalt)]/7 px-5 pt-5 pb-4 sm:px-6">
          <DialogHeader>
            <div className="flex items-start gap-3 pr-7">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/14 text-[var(--gc-cobalt)]"><ClipboardPenLine className="size-5" /></div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2"><span className="gc-num rounded-lg bg-[var(--gc-cobalt)]/15 px-2 py-1 text-xs font-bold text-[var(--gc-cobalt)]">{evaluation.code}</span><span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Configuración de evaluación</span></div>
                <DialogTitle className="truncate text-lg">Editar evaluación</DialogTitle>
                <DialogDescription className="mt-1 text-xs">Actualiza esta columna de {dataset.course} · {dataset.subject} sin modificar las calificaciones existentes.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <label className="block"><span className="gc-label mb-1.5 block text-xs">NOMBRE <span className="text-[var(--gc-bajo)]">*</span></span><input autoFocus value={name} maxLength={80} onChange={(event) => { setName(event.target.value); setError(null); }} aria-label="Nombre de la evaluación" className="gc-input w-full rounded-2xl px-3 py-3 text-[12px] outline-none" /></label>

          <div className="grid gap-3 sm:grid-cols-[1.15fr_.85fr]">
            <label className="block"><span className="gc-label mb-1.5 block text-xs">TIPO</span><select value={type} onChange={(event) => setType(event.target.value as EvaluationTypeId)} aria-label="Tipo de evaluación" className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs outline-none focus:border-[var(--gc-cobalt)]/60">{TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="block"><span className="gc-label mb-1.5 block text-xs">FECHA <span className="text-muted-foreground">(opcional)</span></span><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3"><CalendarDays className="size-3.5 text-muted-foreground" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Fecha de la evaluación" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none" /></div></label>
          </div>

          <label className="block"><span className="gc-label mb-1.5 block text-xs">PONDERACIÓN (%) <span className="text-[var(--gc-bajo)]">*</span></span><div className={cn("flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3", error?.toLowerCase().includes("ponder") && "border-[var(--gc-bajo)]/60")}><Percent className="size-3.5 text-muted-foreground" /><input value={weight} onChange={(event) => { setWeight(event.target.value.replace(/[^0-9.,]/g, "")); setError(null); }} inputMode="decimal" aria-label="Ponderación de la evaluación" className="gc-num min-w-0 flex-1 bg-transparent py-3 text-[12px] outline-none" /><span className="text-xs text-muted-foreground">{availableWeight}% disponible</span></div><span className="mt-1 block text-xs text-muted-foreground">El peso actual ya está incluido en el margen disponible.</span></label>

          <label className="block"><span className="gc-label mb-1.5 block text-xs">DESCRIPCIÓN O INSTRUCCIONES <span className="text-muted-foreground">(opcional)</span></span><textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={3} aria-label="Descripción de la evaluación" placeholder="Qué deben entregar o demostrar los estudiantes…" className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs outline-none focus:border-[var(--gc-cobalt)]/60" /></label>

          <div><span className="gc-label mb-1.5 block text-xs">ESTADO DE LA EVALUACIÓN</span><div className="grid gap-2 sm:grid-cols-2">{(["active", "preparing"] as EvaluationStatus[]).map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={cn("rounded-2xl border p-3 text-left transition-all", status === item ? "border-[var(--gc-cobalt)]/70 bg-[var(--gc-cobalt)]/10 shadow-[0_10px_24px_-18px_var(--gc-cobalt)]" : "border-white/8 bg-white/3 hover:bg-white/6")}><div className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{item === "active" ? "Activa para cálculo" : "En preparación"}</span>{status === item && <span className="size-1.5 rounded-full bg-[var(--gc-cobalt)]" />}</div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">{item === "active" ? "Aparece en promedios y permite registrar notas." : "Visible en la matriz, pero fuera del cálculo definitivo."}</div></button>)}</div></div>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--gc-cobalt)]/20 bg-[var(--gc-cobalt)]/7 px-3 py-2.5 text-xs"><span><span className="font-semibold">Estado al guardar:</span> se conserva la información de las notas.</span><span className="gc-num rounded-full bg-[var(--gc-cobalt)]/18 px-2 py-1 text-[var(--gc-cobalt)]">{statusLabel}</span></div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/8 px-3 py-2 text-xs text-[var(--gc-bajo)]"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{error}</div>}

          <div className="flex justify-end gap-2 border-t border-white/8 pt-4"><button type="button" onClick={close} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:bg-white/8">Cancelar</button><button type="button" onClick={submit} className="flex items-center gap-1.5 rounded-xl bg-[var(--gc-cobalt)]/25 px-4 py-2 text-xs font-semibold hover:bg-[var(--gc-cobalt)]/35"><Save className="size-3.5" />Guardar cambios</button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

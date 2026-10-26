import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardPlus, Percent, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TYPE_META } from "../data/curriculum";
import { useGradeCenter } from "../state/GradeCenterContext";
import type { EvaluationStatus, EvaluationTypeId } from "../types";

const TYPE_OPTIONS = Object.values(TYPE_META);

export function NewEvaluationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createEvaluation, weightIntegrity, dataset } = useGradeCenter();
  const [name, setName] = useState("");
  const [type, setType] = useState<EvaluationTypeId>("taller");
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDbaId, setSelectedDbaId] = useState<string>("");
  const [status, setStatus] = useState<EvaluationStatus>("active");
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, weightIntegrity.remaining);
  const parsedWeight = Number(weight.replace(",", "."));
  const previewStatus = useMemo(() => status === "preparing" ? "En preparación" : "Activa para cálculo", [status]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("taller");
    setDate("");
    setWeight(remaining > 0 ? String(remaining) : "");
    setDescription("");
    setSelectedDbaId(dataset.dba[0]?.id ?? "");
    setStatus("active");
    setError(null);
  }, [open, remaining, dataset.dba]);

  const close = () => {
    if (name.trim() || weight || description.trim()) {
      if (!window.confirm("Hay cambios sin guardar. ¿Quieres cancelar la creación?")) return;
    }
    onOpenChange(false);
  };

  const submit = async () => {
    const result = await createEvaluation({
      name,
      type,
      date: date || undefined,
      weight: Number.isFinite(parsedWeight) ? parsedWeight : Number.NaN,
      description,
      status,
      dbaIds: selectedDbaId ? [selectedDbaId] : [],
    });
    if (!result.ok) {
      setError(result.error ?? "Revisa los datos de la evaluación.");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
      <DialogContent className="glass-strong max-h-[min(780px,calc(100vh-2rem))] max-w-2xl overflow-y-auto rounded-3xl border-white/12 p-5">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--gc-cobalt)]/35 bg-[var(--gc-cobalt)]/14 text-[var(--gc-cobalt)]">
              <ClipboardPlus className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Nueva evaluación</DialogTitle>
              <DialogDescription className="mt-1 text-[11px]">Añádela a {dataset.course} · {dataset.subject} sin reconstruir la planilla ni modificar notas existentes.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-1 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1.35fr_.65fr]">
            <label className="block">
              <span className="gc-label mb-1.5 block text-[9px]">NOMBRE <span className="text-[var(--gc-bajo)]">*</span></span>
              <input autoFocus value={name} maxLength={80} onChange={(event) => { setName(event.target.value); setError(null); }} placeholder="Ej. Taller de laboratorio" aria-label="Nombre de la evaluación" className="gc-input w-full rounded-2xl px-3 py-2.5 text-[12px] outline-none" />
              <span className="mt-1 block text-[9px] text-muted-foreground">Obligatorio · hasta 80 caracteres</span>
            </label>
            <label className="block">
              <span className="gc-label mb-1.5 block text-[9px]">TIPO</span>
              <select value={type} onChange={(event) => setType(event.target.value as EvaluationTypeId)} aria-label="Tipo de evaluación" className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] outline-none focus:border-[var(--gc-cobalt)]/60">
                {TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="gc-label mb-1.5 block text-[9px]">PONDERACIÓN (%) <span className="text-[var(--gc-bajo)]">*</span></span>
              <div className={cn("flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3", error?.includes("ponder") && "border-[var(--gc-bajo)]/60")}>
                <Percent className="size-3.5 text-muted-foreground" />
                <input value={weight} onChange={(event) => { setWeight(event.target.value.replace(/[^0-9.,]/g, "")); setError(null); }} inputMode="decimal" placeholder="Ej. 10" aria-label="Ponderación de la evaluación" className="gc-num min-w-0 flex-1 bg-transparent py-2.5 text-[12px] outline-none" />
                <span className="text-[10px] text-muted-foreground">{remaining}% libre</span>
              </div>
              <span className="mt-1 block text-[9px] text-muted-foreground">Se suma al total del periodo; nunca se redistribuyen otros pesos.</span>
            </label>
            <label className="block">
              <span className="gc-label mb-1.5 block text-[9px]">FECHA <span className="text-muted-foreground">(opcional)</span></span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3"><CalendarDays className="size-3.5 text-muted-foreground" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Fecha de la evaluación" className="min-w-0 flex-1 bg-transparent py-2.5 text-[11px] outline-none" /></div>
            </label>
          </div>

          <label className="block">
            <span className="gc-label mb-1.5 block text-[9px]">DESCRIPCIÓN O INSTRUCCIONES <span className="text-muted-foreground">(opcional)</span></span>
            <textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Qué deben entregar o demostrar los estudiantes…" aria-label="Descripción de la evaluación" className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] outline-none focus:border-[var(--gc-cobalt)]/60" />
          </label>

          {dataset.dba && dataset.dba.length > 0 && (
            <label className="block">
              <span className="gc-label mb-1.5 block text-[9px]">DERECHO BÁSICO DE APRENDIZAJE (DBA VINCULADO)</span>
              <select
                value={selectedDbaId}
                onChange={(e) => setSelectedDbaId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] outline-none focus:border-[var(--gc-cobalt)]/60 text-slate-200"
              >
                <option value="" className="bg-slate-900 text-slate-300">Sin vincular a un DBA específico</option>
                {dataset.dba.map((dba) => (
                  <option key={dba.id} value={dba.id} className="bg-slate-900 text-white">
                    {dba.code} · {dba.title} ({dba.dimension || "cognitivo"})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[9px] text-muted-foreground">
                Las notas de esta actividad aportarán evidencia al dominio de este DBA en el boletín (Decreto 1290).
              </span>
            </label>
          )}

          <div>
            <span className="gc-label mb-1.5 block text-[9px]">ESTADO INICIAL</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["active", "preparing"] as EvaluationStatus[]).map((item) => (
                <button key={item} type="button" onClick={() => setStatus(item)} className={cn("rounded-2xl border p-3 text-left transition-all", status === item ? "border-[var(--gc-cobalt)]/70 bg-[var(--gc-cobalt)]/10" : "border-white/8 bg-white/3 hover:bg-white/6")}>
                  <div className="text-[11px] font-semibold">{item === "active" ? "Activa para cálculo" : "En preparación"}</div>
                  <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item === "active" ? "Aparece en promedios y permite registrar notas inmediatamente." : "Aparece en la matriz, pero queda identificada como pendiente de configuración."}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--gc-cobalt)]/20 bg-[var(--gc-cobalt)]/7 px-3 py-2.5 text-[10px]">
            <span><span className="font-semibold">Al guardar:</span> se añadirá una columna con calificaciones pendientes.</span>
            <span className="gc-num rounded-full bg-[var(--gc-cobalt)]/18 px-2 py-1 text-[var(--gc-cobalt)]">{previewStatus}</span>
          </div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/8 px-3 py-2 text-[10px] text-[var(--gc-bajo)]"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{error}</div>}

          <div className="flex justify-end gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={close} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-muted-foreground hover:bg-white/8">Cancelar</button>
            <button type="button" onClick={submit} className="flex items-center gap-1.5 rounded-xl bg-[var(--gc-cobalt)]/25 px-3.5 py-2 text-[11px] font-semibold hover:bg-[var(--gc-cobalt)]/35"><Save className="size-3.5" />Crear evaluación</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, MessageSquareText, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatGrade } from "../../lib/format";
import type { Evaluation, GradeValue, Student } from "../../types";
import type { EvaluationMetric } from "../../domain/metrics";
import { MAX_GRADE, MIN_GRADE } from "../../domain/scale";
import { useExclusivePopover } from "./exclusivePopover";

const QUICK_GRADES = [5, 4.5, 4, 3.5, 3, 2.5];

export function GradePopover({ student, evaluation, metric, grade, comment = "", open, onOpenChange, onSave, onMoveStudent, onMoveEvaluation, children }: {
  student: Student; evaluation: Evaluation; metric: EvaluationMetric; grade: GradeValue; comment?: string; open: boolean; onOpenChange: (open: boolean) => void;
  onSave: (value: number | null, note: string) => void; onMoveStudent: (delta: number) => void; onMoveEvaluation: (delta: number) => void; children: React.ReactNode;
}) {
  const [value, setValue] = useState(grade == null ? "" : formatGrade(grade));
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useExclusivePopover(() => onOpenChange(false));
  useEffect(() => { if (open) { setValue(grade == null ? "" : formatGrade(grade)); setNote(comment); setNoteOpen(Boolean(comment)); setError(null); } }, [open, grade, comment]);
  const normalize = (raw: string) => raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const save = (direction: "stay" | "next" | "prev" = "stay") => {
    const normalized = normalize(value);
    if (normalized === "") { onSave(null, note); onOpenChange(false); return; }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < MIN_GRADE || parsed > MAX_GRADE) { setError(`Usa una nota entre ${MIN_GRADE.toFixed(1)} y ${MAX_GRADE.toFixed(1)}`); inputRef.current?.focus(); return; }
    onSave(Math.round(parsed * 10) / 10, note);
    if (direction === "next") onMoveStudent(1); else if (direction === "prev") onMoveStudent(-1); else onOpenChange(false);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); save(event.shiftKey ? "prev" : "next"); }
    else if (event.key === "Tab") { event.preventDefault(); save("stay"); onMoveEvaluation(event.shiftKey ? -1 : 1); }
    else if (event.key === "Escape") { event.preventDefault(); onOpenChange(false); }
  };
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>{children}</PopoverTrigger>
    <PopoverContent side="bottom" align="center" sideOffset={6} className="glass-strong w-[min(270px,calc(100vw-20px))] rounded-2xl border-white/12 p-2.5 shadow-2xl">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-semibold">{student.fullName}</div><div className="truncate text-xs text-muted-foreground">{evaluation.code} · {evaluation.name} · escala /5.0</div></div><button type="button" aria-label="Cerrar editor" onClick={() => onOpenChange(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-white/8 hover:text-foreground"><X className="size-3" /></button></div>
      <div className="mt-2 flex gap-1.5"><input ref={inputRef} autoFocus value={value} onChange={(event) => { const next = normalize(event.target.value); setValue(next); if (error) setError(null); }} onKeyDown={handleKeyDown} inputMode="decimal" aria-label={`Editar nota de ${student.fullName} en ${evaluation.name}`} placeholder="Nota" className={cn("gc-input gc-num min-w-0 flex-1 rounded-xl px-3 py-2 text-center text-lg font-semibold outline-none", error && "border-[var(--gc-bajo)]/70")} /><button type="button" onClick={() => save()} className="rounded-xl bg-[var(--gc-cobalt)]/20 px-3 text-xs font-semibold text-foreground hover:bg-[var(--gc-cobalt)]/30"><Check className="mr-1 inline size-3" />Guardar</button></div>
      {error && <div role="alert" className="mt-1 text-xs text-[var(--gc-bajo)]">{error}</div>}
      <div className="mt-2 grid grid-cols-6 gap-1">{QUICK_GRADES.map((quick) => <button type="button" key={quick} onClick={() => { setValue(quick.toFixed(1)); setError(null); }} className="rounded-lg border border-white/8 bg-white/4 py-1 text-xs hover:border-[var(--gc-cobalt)]/50 hover:bg-[var(--gc-cobalt)]/10">{quick.toFixed(1)}</button>)}</div>
      <button type="button" onClick={() => setNoteOpen((open) => !open)} className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left text-xs text-muted-foreground hover:text-foreground"><MessageSquareText className="size-3" />Observación pedagógica<ChevronDown className={cn("ml-auto size-3 transition-transform", noteOpen && "rotate-180")} /></button>
      {noteOpen && <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Añadir una observación opcional…" rows={2} className="mt-1 w-full resize-none rounded-xl border border-white/8 bg-white/4 px-2.5 py-2 text-xs outline-none focus:border-[var(--gc-cobalt)]/60" />}
      <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2"><button type="button" onClick={() => onMoveStudent(-1)} className="text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="mr-0.5 inline size-3" />Anterior</button><span className="gc-num text-xs text-muted-foreground">Enter guarda · Shift+Enter anterior · Tab cambia evaluación</span><button type="button" onClick={() => onMoveStudent(1)} className="text-xs text-muted-foreground hover:text-foreground">Siguiente<ChevronRight className="ml-0.5 inline size-3" /></button></div>
    </PopoverContent>
  </Popover>;
}

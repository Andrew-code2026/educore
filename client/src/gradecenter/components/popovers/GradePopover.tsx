import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatGrade } from "../../lib/format";
import { parseGradeInput } from "../../domain/grading";
import type { Evaluation, GradeValue, Student } from "../../types";

const QUICK_GRADES = [5, 4.5, 4, 3.5, 3, 2.5];

/**
 * Editor de nota en ventana flotante. Solo se monta para la celda que se está
 * editando (no hay un popover por celda), y al confirmar con Enter salta al
 * siguiente estudiante sin cerrarse: calificar una columna entera es fluido.
 */
export function GradePopover({
  student,
  evaluation,
  grade,
  comment,
  anchor,
  onClose,
  onSave,
  onMove,
  onCloseAutoFocus,
}: {
  student: Student;
  evaluation: Evaluation;
  grade: GradeValue;
  comment: string;
  anchor: ReactNode;
  onClose: () => void;
  onSave: (value: GradeValue, note: string) => void;
  onMove: (deltaRow: number, deltaCol: number) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [value, setValue] = useState(grade == null ? "" : formatGrade(grade));
  const [note, setNote] = useState(comment);
  const [noteOpen, setNoteOpen] = useState(Boolean(comment));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = (move?: [number, number]) => {
    const parsed = parseGradeInput(value);
    if (!parsed.ok) {
      setError(parsed.error);
      inputRef.current?.focus();
      return;
    }
    onSave(parsed.value, note);
    if (move) onMove(move[0], move[1]);
    else onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save([event.shiftKey ? -1 : 1, 0]);
    } else if (event.key === "Tab") {
      event.preventDefault();
      save([0, event.shiftKey ? -1 : 1]);
    }
  };

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        onCloseAutoFocus={onCloseAutoFocus}
        className="gc-popover w-[min(280px,calc(100vw-24px))] rounded-2xl p-3"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{student.fullName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {evaluation.code} · {evaluation.name}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMove(-1, 0)}
              aria-label="Estudiante anterior"
              className="rounded-lg p-1 text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1, 0)}
              aria-label="Estudiante siguiente"
              className="rounded-lg p-1 text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setValue(event.target.value.replace(/[^0-9.,]/g, ""));
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            inputMode="decimal"
            aria-label={`Nota de ${student.fullName} en ${evaluation.name}`}
            aria-invalid={Boolean(error)}
            placeholder="0.0 – 5.0"
            className={cn(
              "gc-input gc-num min-w-0 flex-1 rounded-xl px-3 py-1.5 text-center text-lg font-semibold outline-none",
              error && "border-[var(--gc-bajo)]",
            )}
          />
          <button
            type="button"
            onClick={() => save()}
            className="rounded-xl bg-[var(--gc-cobalt)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--gc-cobalt)]/90"
          >
            Guardar
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-[var(--gc-bajo)]">
            {error}
          </p>
        )}

        <div className="mt-2 grid grid-cols-6 gap-1" role="group" aria-label="Notas frecuentes">
          {QUICK_GRADES.map((quick) => (
            <button
              type="button"
              key={quick}
              onClick={() => {
                setValue(quick.toFixed(1));
                setError(null);
                inputRef.current?.focus();
              }}
              className="gc-num rounded-lg border border-white/8 bg-white/4 py-1 text-xs transition-colors hover:border-[var(--gc-cobalt)]/50 hover:bg-[var(--gc-cobalt)]/10"
            >
              {quick.toFixed(1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setNoteOpen((open) => !open)}
          aria-expanded={noteOpen}
          className="mt-2 flex w-full items-center gap-1.5 rounded-lg py-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageSquareText className="size-3.5" />
          Observación{note.trim() && !noteOpen ? " · 1" : ""}
          <ChevronDown className={cn("ml-auto size-3.5 transition-transform", noteOpen && "rotate-180")} />
        </button>
        {noteOpen && (
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Observación opcional para el estudiante…"
            rows={2}
            aria-label="Observación"
            className="mt-1 w-full resize-none rounded-xl border border-white/8 bg-white/4 px-2.5 py-2 text-xs outline-none focus:border-[var(--gc-cobalt)]/60"
          />
        )}

        <p className="mt-2 border-t border-white/8 pt-2 text-xs text-muted-foreground">
          <kbd className="gc-num">Enter</kbd> guarda y baja · <kbd className="gc-num">Tab</kbd> siguiente evaluación
        </p>
      </PopoverContent>
    </Popover>
  );
}

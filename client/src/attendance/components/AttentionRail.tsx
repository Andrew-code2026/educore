/** Bandeja contextual de Atención docente; se abre sobre el roster, nunca le quita ancho. */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ShieldCheck, Signal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ATTENTION_RULE_LABELS } from "../data/selectors";
import { SEVERITY_CLASS, SEVERITY_DOT } from "../statusMeta";
import type { AttentionFlag, Student } from "../types";
import { Avatar } from "./Avatar";

interface AttentionRailProps {
  flags: AttentionFlag[];
  studentsById: Map<string, Student>;
  onSelect: (studentId: string) => void;
  activeStudentId: string | null;
}

export function AttentionRail({ flags, studentsById, onSelect, activeStudentId }: AttentionRailProps) {
  const count = flags.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Atención docente: ${count} ${count === 1 ? "estudiante" : "estudiantes"}`}
          title={`Atención docente: ${count} ${count === 1 ? "estudiante" : "estudiantes"}`}
          className={cn(
            "chrona-attention-trigger flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold transition-all",
            count > 0 ? "chrona-attention-hot" : "chrona-attention-clear",
          )}
        >
          <Signal className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="chrona-attention-label hidden sm:inline">Atención docente</span>
          <span className="tabular grid min-w-[17px] place-items-center rounded-full px-1 py-px text-xs font-bold">
            {count}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={9} className="glass-strong z-50 w-[360px] max-w-[calc(100vw-28px)] rounded-[18px] p-2">
        <header className="flex items-center gap-2 border-b border-hairline px-2 pb-2.5 pt-1">
          <span className="grid h-7 w-7 place-items-center rounded-[10px] bg-attention/12 text-attention">
            <Signal className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">Atención docente</p>
            <p className="tabular text-xs text-muted-foreground">
              {count === 0 ? "Sin casos pendientes" : `${count} casos ordenados por prioridad`}
            </p>
          </div>
          {count === 0 ? <ShieldCheck className="h-4 w-4 text-st-present" aria-hidden="true" /> : null}
        </header>

        <div className="max-h-[min(390px,55vh)] overflow-y-auto scroll-thin py-1">
          {count === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Los patrones de atención se evalúan con el histórico de asistencia existente.
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {flags.map((flag, index) => {
                const student = studentsById.get(flag.studentId);
                if (!student) return null;
                const active = activeStudentId === flag.studentId;
                return (
                  <motion.button
                    key={flag.studentId}
                    type="button"
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => onSelect(flag.studentId)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                      active ? "bg-brand-soft ring-1 ring-inset ring-brand/25" : "hover:bg-foreground/[0.05]",
                    )}
                  >
                    <span className="tabular w-5 shrink-0 text-right text-xs text-muted-foreground/65">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Avatar name={student.fullName} initials={student.initials} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{student.fullName}</span>
                      <span className={cn("mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium", SEVERITY_CLASS[flag.severity])}>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[flag.severity])} />
                        <span className="truncate">{flag.label}</span>
                      </span>
                    </span>
                    <span className="hidden max-w-[92px] truncate text-xs text-muted-foreground md:block">{flag.detail}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <footer className="border-t border-hairline px-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Patrones activos</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ATTENTION_RULE_LABELS.map(label => (
              <span key={label} className="rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-xs text-muted-foreground">{label}</span>
            ))}
          </div>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

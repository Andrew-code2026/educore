/**
 * Selector de fecha compacto de la jornada.
 * Resalta las jornadas lectivas del curso y permite saltar a hoy o a la anterior.
 */
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatLongDate, formatShortDate } from "../format";
import { fromISODate, toISODate } from "../data/dateUtils";

interface DatePickerPopoverProps {
  date: string;
  onChange: (iso: string) => void;
  /** Días de clase del curso activo (0 = domingo). */
  classDays: number[];
  todayIso: string;
}

const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];
const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const ACCESSIBLE_DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DatePickerPopover({ date, onChange, classDays, todayIso }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const selected = fromISODate(date);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const leading = first.getDay();
    const list: Array<{ iso: string; day: number; isClassDay: boolean } | null> = [];
    for (let i = 0; i < leading; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      list.push({ iso: toISODate(current), day, isClassDay: classDays.includes(current.getDay()) });
    }
    return list;
  }, [classDays, cursor]);

  const shiftMonth = (delta: number) => {
    setCursor(previous => new Date(previous.getFullYear(), previous.getMonth() + delta, 1));
  };

  const select = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="attendance-date-trigger"
          aria-label={`Fecha de la jornada: ${formatLongDate(date)}`}
          title={formatLongDate(date)}
        >
          <span className="attendance-date-trigger-icon" aria-hidden="true">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="attendance-date-trigger-value tabular">{formatShortDate(date)}</span>
          <ChevronDown className="attendance-date-trigger-chevron h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="attendance-date-popover glass-strong w-[248px] rounded-2xl p-3"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[12.5px] font-semibold capitalize">
            {MONTH_FORMAT.format(cursor)}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <span key={`${initial}-${index}`} className="text-xs font-medium text-muted-foreground/70">
              {initial}
            </span>
          ))}
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={cell.iso}
                type="button"
                onClick={() => select(cell.iso)}
                className={cn(
                  "relative mx-auto grid h-7 w-7 place-items-center rounded-lg text-xs tabular transition-colors duration-120",
                  cell.iso === date
                    ? "bg-brand text-brand-foreground font-semibold"
                    : cell.isClassDay
                      ? "text-foreground hover:bg-foreground/[0.07]"
                      : "text-muted-foreground/45 hover:bg-foreground/[0.04]",
                )}
                aria-label={ACCESSIBLE_DATE_FORMAT.format(fromISODate(cell.iso))}
                aria-current={cell.iso === todayIso ? "date" : undefined}
                aria-pressed={cell.iso === date}
                title={ACCESSIBLE_DATE_FORMAT.format(fromISODate(cell.iso))}
              >
                {cell.day}
                {cell.iso === todayIso && cell.iso !== date ? (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand" />
                ) : null}
              </button>
            ) : (
              <span key={`empty-${index}`} />
            ),
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-2.5">
          <button
            type="button"
            onClick={() => select(todayIso)}
            className="flex-1 rounded-lg bg-foreground/[0.04] px-2 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.08]"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => {
              const previous = fromISODate(date);
              previous.setDate(previous.getDate() - 1);
              select(toISODate(previous));
            }}
            className="flex-1 rounded-lg bg-foreground/[0.04] px-2 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.08]"
          >
            Día anterior
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Chip de estado de la clase (activa / programada / cerrada). */
export function ClassStateChip({
  state,
  label,
  hint,
}: {
  state: "active" | "upcoming" | "finished" | "closed" | "none";
  label: string;
  hint: string;
}) {
  const active = state === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        active
          ? "bg-brand-soft text-brand ring-brand/25"
          : "bg-foreground/[0.035] text-muted-foreground ring-hairline",
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {active ? (
          <motion.span
            initial={{ scale: 0.45, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 rounded-full bg-brand"
            transition={{ duration: 0.24, ease: "easeOut" }}
          />
        ) : null}
        <span
          className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-brand" : "bg-muted-foreground/60")}
        />
      </span>
      <span className="tabular">
        {label}
        {hint ? <span className="ml-1.5 text-muted-foreground/80">{hint}</span> : null}
      </span>
    </span>
  );
}

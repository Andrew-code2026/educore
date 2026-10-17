/**
 * Control P | A | T | E de un estudiante.
 *
 * Microanimación de confirmación: cuando la celda pasa a ser la activa (por
 * ejemplo Pendiente → Presente) emite un halo breve y la letra hace un pequeño
 * asentimiento. Nada exagerado, ~400 ms.
 */
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { STATUS_CELL_ACTIVE, STATUS_CELL_IDLE, STATUS_META, STATUS_RING } from "../statusMeta";
import type { AttendanceStatus } from "../types";

interface StatusCellProps {
  status: AttendanceStatus;
  active: boolean;
  onSelect: () => void;
  /** Índice de tabulación para navegar con Tab / Shift+Tab. */
  tabIndex?: number;
  onFocus?: () => void;
}

export function StatusCell({ status, active, onSelect, tabIndex = -1, onFocus }: StatusCellProps) {
  const meta = STATUS_META[status];
  const [pulse, setPulse] = useState(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) setPulse(value => value + 1);
    wasActive.current = active;
  }, [active]);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      tabIndex={tabIndex}
      onFocus={onFocus}
      aria-pressed={active}
      data-status={status}
      aria-label={meta.label}
      title={`${meta.label} · tecla ${meta.key}`}
      onClick={onSelect}
      className={cn(
        "relative grid h-7 w-[30px] place-items-center rounded-[9px] text-[11px] font-semibold",
        "transition-colors duration-150 ease-out",
        active && "chrona-pate-active",
        active ? STATUS_CELL_ACTIVE[status] : STATUS_CELL_IDLE,
      )}
    >
      <motion.span
        key={`${status}-${active}`}
        initial={{ scale: active ? 0.72 : 1, opacity: active ? 0.35 : 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 26 }}
        className="tabular leading-none"
      >
        {meta.letter}
      </motion.span>

      {pulse > 0 ? (
        <motion.span
          key={pulse}
          aria-hidden="true"
          initial={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className={cn("pointer-events-none absolute inset-0 rounded-[9px] ring-2", STATUS_RING[status])}
        />
      ) : null}
    </motion.button>
  );
}

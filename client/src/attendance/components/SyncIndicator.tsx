/**
 * Indicador discreto de autosave: Guardando… → Guardado.
 * Solo llama la atención cuando existe realmente un problema.
 */
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { relativeFromNow } from "../format";
import type { SyncState } from "../types";

interface SyncIndicatorProps {
  state: SyncState;
  lastSavedAt: number | null;
  onRetry?: () => void;
}

export function SyncIndicator({ state, lastSavedAt, onRetry }: SyncIndicatorProps) {
  const [, forceTick] = useState(0);

  // Mantiene fresco el "hace N s" sin banners ni notificaciones.
  useEffect(() => {
    if (state !== "saved") return undefined;
    const timer = window.setInterval(() => forceTick(value => value + 1), 20000);
    return () => window.clearInterval(timer);
  }, [state]);

  const content =
    state === "saving"
      ? { icon: Loader2, text: "Guardando…", spin: true }
      : state === "error"
        ? { icon: AlertTriangle, text: "No se guardó", spin: false }
        : state === "local"
          ? { icon: CloudOff, text: "Solo en esta sesión", spin: false }
          : state === "saved"
            ? { icon: Check, text: `Guardado${lastSavedAt ? ` ${relativeFromNow(lastSavedAt)}` : ""}`, spin: false }
            : { icon: Cloud, text: "Al día", spin: false };

  const Icon = content.icon;

  return (
    <div className={cn("att-sync", state === "error" && "att-sync--error")} role="status" aria-live="polite">
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", content.spin && "animate-spin motion-reduce:animate-none")}
        aria-hidden="true"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={content.text}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.16 }}
          className="tabular truncate"
        >
          {content.text}
        </motion.span>
      </AnimatePresence>
      {state === "error" && onRetry ? (
        <button type="button" onClick={onRetry} className="att-sync-retry">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

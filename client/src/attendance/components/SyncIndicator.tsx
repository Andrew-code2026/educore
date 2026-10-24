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
      ? { icon: Loader2, text: "Guardando…", tone: "text-muted-foreground", spin: true }
      : state === "error"
        ? { icon: AlertTriangle, text: "Sin conexión", tone: "text-st-absent", spin: false }
        : state === "local"
          ? { icon: CloudOff, text: "Solo en esta sesión", tone: "text-muted-foreground", spin: false }
          : state === "saved"
          ? {
              icon: Check,
              text: `Guardado${lastSavedAt ? ` · ${relativeFromNow(lastSavedAt)}` : ""}`,
              tone: "text-muted-foreground",
              spin: false,
            }
          : { icon: Cloud, text: "Al día", tone: "text-muted-foreground", spin: false };

  const Icon = content.icon;

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        "ring-1 ring-inset transition-colors duration-200",
        state === "error"
          ? "bg-st-absent/10 text-st-absent ring-st-absent/25"
          : "bg-foreground/[0.035] ring-hairline",
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={cn("h-3.5 w-3.5", content.spin && "animate-spin motion-reduce:animate-none", content.tone)}
        aria-hidden="true"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={content.text}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.16 }}
          className={cn("tabular", content.tone)}
        >
          {content.text}
        </motion.span>
      </AnimatePresence>
      {state === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-0.5 rounded-full bg-st-absent/15 px-1.5 py-0.5 text-xs font-semibold text-st-absent transition-colors hover:bg-st-absent/25"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

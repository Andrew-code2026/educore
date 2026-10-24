import { useEffect, useState } from "react";
import { Check, CloudOff, Eye, Loader2, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { describeSyncAge, SYNC_LABEL } from "../state/autosave";

/**
 * Autosave discreto: un indicador pequeño junto a la búsqueda. Solo reclama
 * atención cuando hay un error real; el detalle vive en el popover.
 */
export function SyncStatus() {
  const { sync, retrySync, readOnly, readOnlyReason } = useGradeCenter();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  // El reloj relativo solo se actualiza mientras el detalle está visible.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [open]);

  if (readOnly) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
          >
            <Eye className="size-4" aria-hidden />
            <span className="hidden sm:inline">Solo lectura</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="glass-strong w-72 rounded-2xl border-white/10 p-3.5">
          <div className="text-sm font-semibold">Planilla en solo lectura</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {readOnlyReason ?? "No tienes permisos para modificar esta planilla."}
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  const isError = sync.status === "error";
  const busy = sync.status === "saving" || sync.status === "pending";
  const label = SYNC_LABEL[sync.status];

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-live="polite"
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors",
              isError
                ? "bg-[var(--gc-bajo)]/12 text-[var(--gc-bajo)]"
                : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
            )}
          >
            {isError ? (
              <CloudOff className="size-4" aria-hidden />
            ) : busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4 text-[var(--gc-alto)]" aria-hidden />
            )}
            <span className={cn(!isError && "hidden lg:inline")}>{label}</span>
            {!isError && <span className="sr-only lg:hidden">{label}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="glass-strong w-72 rounded-2xl border-white/10 p-3.5">
          <div className="text-sm font-semibold">{label}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isError
              ? sync.lastError ?? "No se pudieron guardar algunos cambios."
              : busy
                ? `${sync.pending} ${sync.pending === 1 ? "cambio" : "cambios"} guardándose.`
                : "Cada nota se guarda automáticamente al confirmarla."}
          </p>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Último guardado</dt>
              <dd>{describeSyncAge(sync.lastSyncedAt, now)}</dd>
            </div>
            {sync.pending > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cambios sin guardar</dt>
                <dd className="gc-num">{sync.pending}</dd>
              </div>
            )}
          </dl>
        </PopoverContent>
      </Popover>
      {isError && (
        <button
          type="button"
          onClick={retrySync}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--gc-bajo)] transition-colors hover:bg-[var(--gc-bajo)]/12"
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { describeSyncAge, SYNC_LABEL } from "../state/autosave";

const DOT_COLOR: Record<string, string> = {
  idle: "var(--gc-alto)",
  pending: "var(--gc-basico)",
  saving: "var(--gc-basico)",
  saved: "var(--gc-basico)",
  synced: "var(--gc-alto)",
  error: "var(--gc-bajo)",
};

/**
 * Autosave invisible: un latido discreto en el rail. Solo interrumpe si hay un
 * error real al conservar el borrador local.
 */
export function SyncStatus() {
  const { sync, retrySync, readOnly, readOnlyReason } = useGradeCenter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  if (readOnly) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-2 rounded-full border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--gc-cobalt)] transition-all hover:bg-[var(--gc-cobalt)]/15"
            aria-live="polite"
          >
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute size-2 rounded-full bg-[var(--gc-cobalt)]" />
            </span>
            <span className="hidden sm:inline">Modo lectura</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="glass-strong w-80 rounded-2xl border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/15 text-[var(--gc-cobalt)]"
            >
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Modo lectura (EduCore)</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {readOnlyReason || "Los datos académicos se consultan en tiempo real desde el backend de EduCore con diseño 1:1 de Manus. La edición está protegida."}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/3 p-3 text-xs">
            <Row label="Origen" value="EduCore Main (tRPC)" />
            <Row label="Estado" value="Lectura autorizada" />
            <Row label="Diseño" value="Fiel 1:1 Manus Next" />
            <Row label="Persistencia" value="Protegida (Solo lectura)" />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const isError = sync.status === "error";
  const busy = sync.status === "saving" || sync.status === "pending";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
            isError
              ? "border-[color-mix(in_oklab,var(--gc-bajo)_45%,transparent)] bg-[color-mix(in_oklab,var(--gc-bajo)_14%,transparent)] text-[var(--gc-bajo)]"
              : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
          )}
          aria-live="polite"
        >
          <span className="relative flex size-2 items-center justify-center">
            <span
              className={cn("absolute size-2 rounded-full", busy && "gc-pulse")}
              style={{ backgroundColor: DOT_COLOR[sync.status] }}
            />
            {busy && (
              <span
                className="absolute size-3.5 rounded-full opacity-40"
                style={{ backgroundColor: DOT_COLOR[sync.status] }}
              />
            )}
          </span>
          <span className="hidden sm:inline">{SYNC_LABEL[sync.status]}</span>
          {isError && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                retrySync();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") retrySync();
              }}
              className="ml-0.5 rounded-full border border-current/40 px-1.5 py-px text-xs font-semibold hover:bg-current/10"
            >
              Reintentar
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-strong w-80 rounded-2xl border-white/10 p-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: `${DOT_COLOR[sync.status]}55`,
              backgroundColor: `${DOT_COLOR[sync.status]}1a`,
              color: DOT_COLOR[sync.status],
            }}
          >
            {isError ? <CloudOff className="size-4" /> : <ShieldCheck className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{SYNC_LABEL[sync.status]}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isError
                ? `${sync.pending} cambio${sync.pending === 1 ? "" : "s"} pendiente${sync.pending === 1 ? "" : "s"}. ${sync.lastError ?? "Reintenta para sincronizar con el servidor."}`
                : sync.status === "pending"
                  ? `${sync.pending} cambio${sync.pending === 1 ? "" : "s"} en espera de sincronización con el servidor.`
                  : sync.status === "saving"
                    ? "Sincronizando calificaciones con el servidor de EduCore…"
                    : "Cada nota y evaluación se guarda y sincroniza automáticamente con el servidor de EduCore en tiempo real."}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/3 p-3 text-xs">
          <Row label="Última sincronización" value={describeSyncAge(sync.lastSyncedAt, now)} />
          <Row label="Cambios en cola" value={String(sync.pending)} />
          <Row label="Destino" value="Servidor EduCore (tRPC)" />
          {sync.lastError && <Row label="Detalle" value={sync.lastError} />}
        </div>

        {isError && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 w-full rounded-xl"
            onClick={() => retrySync()}
          >
            <RefreshCw className="size-3.5" />
            Reintentar sincronización
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="gc-num font-medium">{value}</span>
    </div>
  );
}

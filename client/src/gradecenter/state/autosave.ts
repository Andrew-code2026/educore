import type { SyncState } from "../types";

/**
 * Autosave prácticamente invisible.
 *
 * El docente nunca ve un botón de guardar: al confirmar una nota la interfaz
 * pasa por Guardando → Guardado local. La escritura se agrupa
 * (debounce) para que calificar rápido con el teclado no genere ruido visual.
 */

export const SYNC_TIMINGS = {
  /** Agrupación de escrituras antes de empezar a guardar. */
  debounceMs: 280,
  /** Duración mínima del estado "Guardando" para feedback claro. */
  savingMs: 250,
  /** Duración del estado "Guardado" antes de confirmar la sincronización. */
  savedMs: 400,
  /** Duración del estado "Sincronizado" antes de volver al reposo. */
  syncedMs: 1800,
  retryMs: 1500,
} as const;

export const INITIAL_SYNC_STATE: SyncState = {
  status: "idle",
  pending: 0,
  lastSyncedAt: null,
  retries: 0,
  lastError: null,
};

export const SYNC_LABEL: Record<SyncState["status"], string> = {
  idle: "Guardado",
  pending: "Guardando…",
  saving: "Guardando…",
  saved: "Guardado",
  synced: "Guardado",
  error: "No se pudo guardar",
};

export function describeSyncAge(lastSyncedAt: number | null, now: number): string {
  if (lastSyncedAt == null) return "Sin cambios en esta sesión";
  const seconds = Math.max(0, Math.round((now - lastSyncedAt) / 1000));
  if (seconds < 5) return "hace un momento";
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

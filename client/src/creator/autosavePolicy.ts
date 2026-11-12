/**
 * Qué hacer cuando un guardado falla. Cada causa pide algo distinto:
 * - `conflict`: el recurso cambió en otra ventana. Reintentar fallaría siempre; decide el docente.
 * - `busy`: la IA está generando en el recurso. No es un error; se espera a que termine.
 * - `offline`: no hubo respuesta útil del servidor (red caída o servidor fuera de servicio). Se reintenta con espera creciente.
 * - `rejected`: el servidor rechazó el guardado por otra razón. Se reintenta con la próxima edición.
 */
export type SaveFailure = "conflict" | "busy" | "offline" | "rejected";

/** Códigos con los que el servidor rechaza `creator.saveDoc` (ver `CreatorSaveRejected` en `server/creatorDb.ts`). */
export const SAVE_CONFLICT_CODE = "CONFLICT";
export const SAVE_BUSY_CODE = "PRECONDITION_FAILED";

export function classifySaveError(error: unknown): SaveFailure {
  const data = typeof error === "object" && error !== null ? (error as { data?: { code?: unknown; httpStatus?: unknown } | null }).data : undefined;
  const code = data?.code;
  if (code === SAVE_CONFLICT_CODE) return "conflict";
  if (code === SAVE_BUSY_CODE) return "busy";
  // Sin código de tRPC no hubo respuesta del servidor: la petición no salió o se cortó
  if (typeof code !== "string") return "offline";
  const status = typeof data?.httpStatus === "number" ? data.httpStatus : 0;
  if (status >= 500 || code === "TIMEOUT" || code === "TOO_MANY_REQUESTS") return "offline";
  return "rejected";
}

/** Espera antes de cada reintento automático: se duplica en cada intento fallido hasta el tope. */
export const RETRY_DELAYS: Record<"offline" | "busy", { first: number; max: number }> = {
  offline: { first: 2_000, max: 30_000 },
  busy: { first: 2_500, max: 10_000 },
};

/** `null`: no se reintenta solo. `attempt` cuenta desde 0 los fallos seguidos por la misma causa. */
export function retryDelay(failure: SaveFailure, attempt: number): number | null {
  if (failure === "conflict" || failure === "rejected") return null;
  const { first, max } = RETRY_DELAYS[failure];
  return Math.min(max, first * 2 ** Math.max(0, attempt));
}

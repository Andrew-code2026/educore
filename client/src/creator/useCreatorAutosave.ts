import { useEffect, useMemo, useRef, useState } from "react";
import type { ResourceDoc } from "@shared/creator";
import { classifySaveError, retryDelay, type SaveFailure } from "./autosavePolicy";

/**
 * - `offline`: no se pudo llegar al servidor; se reintenta solo.
 * - `waiting`: la IA está generando en el recurso; se guarda cuando termine.
 * - `conflict`: el recurso cambió en otra ventana; no se reintenta hasta que el docente elija.
 * - `error`: el servidor rechazó el guardado; se reintenta con la próxima edición.
 */
export type SaveState = "saved" | "pending" | "saving" | "offline" | "waiting" | "conflict" | "error";

/** Espera tras la última edición antes de guardar. */
export const AUTOSAVE_DELAY_MS = 900;

export type SaveFn = (doc: ResourceDoc, baseVersion: number, options: { overwrite: boolean }) => Promise<{ version: number }>;

const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : null);

/**
 * Guardado automático del recurso, con el mismo criterio que el PIAR: una sola petición
 * en vuelo, la última versión gana y lo pendiente se guarda al salir. Cada guardado
 * envía la versión sobre la que se editó para no pisar cambios de la IA o de otra pestaña.
 *
 * Si un guardado falla, la causa decide (ver `autosavePolicy.ts`): sin conexión se reintenta
 * con espera creciente y de inmediato al volver la red; si la IA está generando se espera;
 * ante un conflicto de versión se detiene hasta que el docente elija con `keepMine` o `reset`.
 * Lo editado mientras se guardaba sale en la siguiente petición.
 *
 * Vive fuera de React para poder probarlo con relojes falsos; `useCreatorAutosave` lo envuelve.
 */
export function createAutosaveController(options: { save: () => SaveFn; onState: (state: SaveState) => void }) {
  let latest: ResourceDoc | null = null;
  let version = 0;
  let dirty = false;
  let inFlight: Promise<unknown> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: SaveFailure | null = null;
  let rejection: string | null = null;
  let attempt = 0;
  /** El docente eligió guardar su versión encima de la que llegó de otra ventana. */
  let overwrite = false;
  /** Desmontado: termina lo que tenga en curso, pero ya no programa reintentos ni avisa. */
  let active = true;

  let shown: SaveState = "saved";
  /** Solo se avisa cuando el estado cambia: los reintentos de una misma caída no cuentan como avisos nuevos. */
  const show = (state: SaveState) => {
    if (!active || state === shown) return;
    shown = state;
    options.onState(state);
  };
  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (active) timer = setTimeout(() => void flush(), delay);
  };

  async function flush(): Promise<boolean> {
    clearTimeout(timer);
    if (inFlight) await inFlight.catch(() => undefined);
    if (failure === "conflict") return false;
    if (!dirty || !latest) return true;
    dirty = false;
    // Durante una caída el indicador sigue en «Sin conexión» mientras se reintenta
    if (failure !== "offline" && failure !== "busy") show("saving");
    const request = options.save()(latest, version, { overwrite });
    inFlight = request;
    try {
      const result = await request;
      version = result.version;
      overwrite = false;
      failure = null;
      attempt = 0;
      rejection = null;
      show(dirty ? "pending" : "saved");
      if (dirty) schedule(AUTOSAVE_DELAY_MS);
      return true;
    } catch (error) {
      dirty = true;
      const kind = classifySaveError(error);
      if (kind !== failure) attempt = 0;
      failure = kind;
      if (kind === "conflict") {
        show("conflict");
        return false;
      }
      if (kind === "rejected") {
        rejection = errorText(error);
        show("error");
        return false;
      }
      show(kind === "busy" ? "waiting" : "offline");
      const delay = retryDelay(kind, attempt++);
      if (delay !== null) schedule(delay);
      return false;
    } finally {
      inFlight = null;
    }
  }

  return {
    flush,

    /** El docente cambió el documento. */
    update(doc: ResourceDoc) {
      latest = doc;
      dirty = true;
      // En conflicto se espera la decisión; sin conexión o con la IA trabajando ya hay un reintento programado
      if (failure === "conflict" || failure === "offline" || failure === "busy") return;
      show("pending");
      schedule(AUTOSAVE_DELAY_MS);
    },

    /** El servidor trajo una versión nueva (carga inicial, turno de IA, restauración, «cargar la más reciente»): se parte de ahí. */
    reset(doc: ResourceDoc, serverVersion: number) {
      clearTimeout(timer);
      latest = doc;
      version = serverVersion;
      dirty = false;
      failure = null;
      attempt = 0;
      overwrite = false;
      rejection = null;
      show("saved");
    },

    /** Ante un conflicto, el docente conserva su versión: se guarda encima de `serverVersion` sin fundirse con ella. */
    keepMine(serverVersion: number) {
      if (failure === "conflict") {
        version = serverVersion;
        failure = null;
        attempt = 0;
        overwrite = true;
        dirty = latest !== null;
      }
      return flush();
    },

    /** Reintenta ya lo que espera por red o por la IA (volvió la conexión, terminó el turno). */
    retry() {
      if (failure !== "offline" && failure !== "busy") return;
      attempt = 0;
      void flush();
    },

    isDirty: () => dirty || inFlight !== null,
    lastFailure: () => failure,
    /** El motivo del último rechazo del servidor, leído al momento (el estado de React puede ir un render atrás). */
    lastRejection: () => rejection,

    setActive(next: boolean) {
      active = next;
      if (!next) clearTimeout(timer);
      // Al volver a montarse, el estado de React parte de nuevo: se vuelve a avisar lo actual
      else options.onState(shown);
    },
  };
}

export type AutosaveController = ReturnType<typeof createAutosaveController>;

/**
 * El controlador de guardado de un recurso. Todo lo que devuelve es estable salvo `saveState`.
 * `onExitUnsaved` avisa si al salir del editor quedó algo sin guardar (conflicto sin resolver, sin conexión):
 * sin él, eso se perdería en silencio.
 */
export function useCreatorAutosave(save: SaveFn, options: { onExitUnsaved?: (failure: SaveFailure | null) => void } = {}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveRef = useRef(save);
  saveRef.current = save;
  const exitRef = useRef(options.onExitUnsaved);
  exitRef.current = options.onExitUnsaved;
  const [controller] = useState(() => createAutosaveController({ save: () => saveRef.current, onState: setSaveState }));

  useEffect(() => {
    controller.setActive(true);
    return () => {
      controller.setActive(false);
      // Lo pendiente se guarda al salir del editor; si no se puede, se avisa
      if (controller.isDirty()) {
        void controller.flush().then(saved => {
          if (!saved) exitRef.current?.(controller.lastFailure());
        });
      }
    };
  }, [controller]);

  useEffect(() => {
    window.addEventListener("online", controller.retry);
    return () => window.removeEventListener("online", controller.retry);
  }, [controller]);

  // Cerrar la pestaña con cambios sin guardar pide confirmación al navegador
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!controller.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [controller]);

  return useMemo(() => ({ ...controller, saveState }), [controller, saveState]);
}

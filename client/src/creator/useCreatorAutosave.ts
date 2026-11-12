import { useCallback, useEffect, useRef, useState } from "react";
import type { ResourceDoc } from "@shared/creator";

export type SaveState = "saved" | "pending" | "saving" | "error";

/** Espera tras la última edición antes de guardar. */
const AUTOSAVE_DELAY_MS = 900;

/**
 * Guardado automático del recurso, con el mismo criterio que el PIAR: una sola petición
 * en vuelo, la última versión gana y lo pendiente se guarda al salir. Cada guardado
 * envía la versión sobre la que se editó para no pisar cambios de la IA o de otra pestaña.
 */
export function useCreatorAutosave(save: (doc: ResourceDoc, baseVersion: number) => Promise<{ version: number }>) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef<ResourceDoc | null>(null);
  const version = useRef(0);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current.catch(() => undefined);
    if (!dirty.current || !latest.current) return true;
    dirty.current = false;
    if (mounted.current) setSaveState("saving");
    const request = saveRef.current(latest.current, version.current);
    inFlight.current = request;
    try {
      const result = await request;
      version.current = result.version;
      if (mounted.current) setSaveState(dirty.current ? "pending" : "saved");
      return true;
    } catch {
      dirty.current = true;
      if (mounted.current) setSaveState("error");
      return false;
    } finally {
      inFlight.current = null;
      // Lo editado mientras se guardaba sale en la siguiente petición; tras un error se espera a la próxima edición
      if (dirty.current && mounted.current && version.current > 0) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS * 4);
      }
    }
  }, []);

  /** El docente cambió el documento. */
  const update = useCallback(
    (doc: ResourceDoc) => {
      latest.current = doc;
      dirty.current = true;
      setSaveState("pending");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  /** El servidor trajo una versión nueva (carga inicial, turno de IA, restauración): se parte de ahí. */
  const reset = useCallback((doc: ResourceDoc, serverVersion: number) => {
    window.clearTimeout(timer.current);
    latest.current = doc;
    version.current = serverVersion;
    dirty.current = false;
    setSaveState("saved");
  }, []);

  const isDirty = useCallback(() => dirty.current || inFlight.current !== null, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      if (dirty.current) void flush();
    };
  }, [flush]);

  // Cerrar la pestaña con cambios sin guardar pide confirmación al navegador
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current && !inFlight.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { saveState, update, reset, flush, isDirty };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { PiarStatus, PiarValues } from "@shared/piar";

export type SaveState = "saved" | "pending" | "saving" | "error";

export interface PiarSaveResult {
  status: PiarStatus;
  updatedAt: Date | string;
  finalizedAt: Date | string | null;
}

/** Espera tras la última edición antes de guardar. */
const AUTOSAVE_DELAY_MS = 900;

/**
 * Guardado automático de los anexos: una sola petición en vuelo, la última versión
 * siempre gana y lo pendiente se guarda al salir del editor. Si falla, los cambios
 * quedan marcados para reintentar.
 */
export function usePiarAutosave(input: {
  initialValues: PiarValues;
  initialStatus: PiarStatus;
  initialSavedAt: Date | string;
  initialFinalizedAt: Date | string | null;
  save: (values: PiarValues, finalize: boolean) => Promise<PiarSaveResult>;
}) {
  const [values, setValues] = useState<PiarValues>(input.initialValues);
  const [status, setStatus] = useState<PiarStatus>(input.initialStatus);
  const [savedAt, setSavedAt] = useState(() => new Date(input.initialSavedAt));
  const [finalizedAt, setFinalizedAt] = useState(() => (input.initialFinalizedAt ? new Date(input.initialFinalizedAt) : null));
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const latest = useRef(values);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const saveRef = useRef(input.save);
  saveRef.current = input.save;

  const flush = useCallback(async (finalize = false): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current.catch(() => undefined);
    if (!dirty.current && !finalize) return true;
    dirty.current = false;
    if (mounted.current) setSaveState("saving");
    const request = saveRef.current(latest.current, finalize);
    inFlight.current = request;
    try {
      const result = await request;
      if (mounted.current) {
        setStatus(result.status);
        setSavedAt(new Date(result.updatedAt));
        setFinalizedAt(result.finalizedAt ? new Date(result.finalizedAt) : null);
        setSaveState(dirty.current ? "pending" : "saved");
      }
      return true;
    } catch {
      dirty.current = true;
      if (mounted.current) setSaveState("error");
      return false;
    } finally {
      inFlight.current = null;
      // Lo que se editó mientras se guardaba sale en la siguiente petición
      if (dirty.current && mounted.current) timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    }
  }, []);

  const update = useCallback(
    (patch: PiarValues) => {
      const next = { ...latest.current };
      for (const [key, value] of Object.entries(patch)) {
        if (value === "") delete next[key];
        else next[key] = value;
      }
      latest.current = next;
      dirty.current = true;
      setValues(next);
      // Editar un PIAR finalizado lo devuelve a borrador (también en el servidor)
      setStatus("DRAFT");
      setSaveState("pending");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Al salir del editor se guarda lo pendiente
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

  return { values, status, savedAt, finalizedAt, saveState, update, flush };
}

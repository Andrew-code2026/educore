import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import type { ResourceDoc } from "@shared/creator";
import { buildSampleDoc } from "@shared/creatorSample";
import { classifySaveError, retryDelay } from "./autosavePolicy";
import { AUTOSAVE_DELAY_MS, createAutosaveController, type SaveFn, type SaveState } from "./useCreatorAutosave";

/** Un error de tRPC como el que llega al cliente cuando el servidor responde. */
const serverError = (code: string, httpStatus: number, message = "rechazado") => Object.assign(new Error(message), { data: { code, httpStatus } });

describe("causa de un guardado fallido", () => {
  it("distingue conflicto, IA trabajando, red y rechazo", () => {
    expect(classifySaveError(serverError("CONFLICT", 409))).toBe("conflict");
    expect(classifySaveError(serverError("PRECONDITION_FAILED", 412))).toBe("busy");
    expect(classifySaveError(new TRPCClientError("Failed to fetch"))).toBe("offline");
    expect(classifySaveError(new TypeError("Failed to fetch"))).toBe("offline");
    expect(classifySaveError(serverError("INTERNAL_SERVER_ERROR", 500))).toBe("offline");
    expect(classifySaveError(serverError("BAD_REQUEST", 400))).toBe("rejected");
    expect(classifySaveError(serverError("FORBIDDEN", 403))).toBe("rejected");
  });

  it("espera cada vez más sin red, con tope, y no reintenta solo un conflicto ni un rechazo", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(attempt => retryDelay("offline", attempt))).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect([0, 1, 2, 3].map(attempt => retryDelay("busy", attempt))).toEqual([2500, 5000, 10000, 10000]);
    expect(retryDelay("conflict", 0)).toBeNull();
    expect(retryDelay("rejected", 3)).toBeNull();
  });
});

describe("guardado automático", () => {
  let doc: ResourceDoc;
  let states: SaveState[];
  let calls: Array<{ title: string; baseVersion: number; overwrite: boolean }>;
  let respond: (call: number) => Promise<{ version: number }>;

  const controller = () =>
    createAutosaveController({
      save: (): SaveFn => (next, baseVersion, { overwrite }) => {
        calls.push({ title: next.title, baseVersion, overwrite });
        return respond(calls.length);
      },
      onState: state => states.push(state),
      onRejection: () => undefined,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    doc = buildSampleDoc("funciones");
    states = [];
    calls = [];
    respond = () => Promise.resolve({ version: 0 });
  });
  afterEach(() => vi.useRealTimers());

  it("guarda tras la pausa y envía la versión sobre la que se editó", async () => {
    let version = 4;
    respond = () => Promise.resolve({ version: ++version });
    const autosave = controller();
    autosave.reset(doc, 4);
    autosave.update({ ...doc, title: "a" });
    autosave.update({ ...doc, title: "ab" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toEqual([{ title: "ab", baseVersion: 4, overwrite: false }]);
    autosave.update({ ...doc, title: "abc" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[1]).toEqual({ title: "abc", baseVersion: 5, overwrite: false });
    expect(states.at(-1)).toBe("saved");
  });

  it("ante un conflicto no reintenta y espera la decisión del docente", async () => {
    respond = () => Promise.reject(serverError("CONFLICT", 409));
    const autosave = controller();
    autosave.reset(doc, 3);
    autosave.update({ ...doc, title: "mía" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(calls).toHaveLength(1);
    expect(states.filter(state => state === "conflict")).toHaveLength(1);
    // Seguir editando no dispara más peticiones ni avisos
    autosave.update({ ...doc, title: "mía 2" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(calls).toHaveLength(1);
    expect(await autosave.flush()).toBe(false);

    // «Conservar la mía»: se guarda encima de la versión más reciente, sin fundirse con ella
    respond = () => Promise.resolve({ version: 8 });
    expect(await autosave.keepMine(7)).toBe(true);
    expect(calls[1]).toEqual({ title: "mía 2", baseVersion: 7, overwrite: true });
    expect(states.at(-1)).toBe("saved");
    autosave.update({ ...doc, title: "después" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[2]).toEqual({ title: "después", baseVersion: 8, overwrite: false });
  });

  it("«Cargar la más reciente» descarta lo local y sigue desde el servidor", async () => {
    respond = () => Promise.reject(serverError("CONFLICT", 409));
    const autosave = controller();
    autosave.reset(doc, 3);
    autosave.update({ ...doc, title: "mía" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.reset(doc, 9);
    expect(autosave.isDirty()).toBe(false);
    respond = () => Promise.resolve({ version: 10 });
    autosave.update({ ...doc, title: "nueva" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[1]).toEqual({ title: "nueva", baseVersion: 9, overwrite: false });
  });

  it("sin red reintenta con espera creciente, avisa una sola vez y se recupera al volver", async () => {
    let online = false;
    respond = () => (online ? Promise.resolve({ version: 2 }) : Promise.reject(new TypeError("Failed to fetch")));
    const autosave = controller();
    autosave.reset(doc, 1);
    autosave.update({ ...doc, title: "sin red" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    // Reintentos a los 2, 4 y 8 s: 3 más en 15 s, no uno cada 3,6 s
    await vi.advanceTimersByTimeAsync(15_000);
    expect(calls).toHaveLength(4);
    // Editar durante la caída no adelanta los reintentos
    autosave.update({ ...doc, title: "sin red 2" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(4);
    expect(states.filter(state => state === "offline")).toHaveLength(1);
    expect(states).not.toContain("error");

    // Al volver la conexión se reintenta de inmediato con lo último
    online = true;
    autosave.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(5);
    expect(calls[4]).toEqual({ title: "sin red 2", baseVersion: 1, overwrite: false });
    expect(states.at(-1)).toBe("saved");
  });

  it("si la IA está generando espera sin dar error y guarda cuando termina", async () => {
    let busy = true;
    respond = () => (busy ? Promise.reject(serverError("PRECONDITION_FAILED", 412)) : Promise.resolve({ version: 6 }));
    const autosave = controller();
    autosave.reset(doc, 5);
    autosave.update({ ...doc, title: "espera" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(states.at(-1)).toBe("waiting");
    expect(states).not.toContain("error");
    expect(states).not.toContain("offline");
    busy = false;
    await vi.advanceTimersByTimeAsync(2_500);
    expect(calls).toHaveLength(2);
    expect(states.at(-1)).toBe("saved");
  });

  it("un rechazo del servidor no se reintenta solo, sino con la próxima edición", async () => {
    respond = () => Promise.reject(serverError("BAD_REQUEST", 400));
    const autosave = controller();
    autosave.reset(doc, 1);
    autosave.update({ ...doc, title: "x" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(calls).toHaveLength(1);
    expect(states.at(-1)).toBe("error");
    autosave.update({ ...doc, title: "xy" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(2);
  });

  it("lo editado mientras se guardaba sale en la siguiente petición", async () => {
    let release: (value: { version: number }) => void = () => undefined;
    respond = call => (call === 1 ? new Promise(resolve => (release = resolve)) : Promise.resolve({ version: 3 }));
    const autosave = controller();
    autosave.reset(doc, 1);
    autosave.update({ ...doc, title: "uno" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.update({ ...doc, title: "dos" });
    release({ version: 2 });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls.map(call => [call.title, call.baseVersion])).toEqual([
      ["uno", 1],
      ["dos", 2],
    ]);
  });
});

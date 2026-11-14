import { afterEach, describe, expect, it, vi } from "vitest";
import { computeFrozenContentWidth, parseCssDuration } from "./useRailTransition";

const KEY = "educore-sidebar-collapsed";

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

async function loadStore(initial: Record<string, string> = {}) {
  vi.resetModules();
  const storage = createStorage(initial);
  const win = new EventTarget();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", win);
  const store = await import("./sidebarStore");
  return { store, storage, win };
}

function storageEvent(key: string, newValue: string | null) {
  const event = new Event("storage") as Event & { key: string; newValue: string | null };
  event.key = key;
  event.newValue = newValue;
  return event;
}

describe("sidebarStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arranca con el valor persistido", async () => {
    expect((await loadStore()).store.getSidebarCollapsed()).toBe(false);
    expect((await loadStore({ [KEY]: "true" })).store.getSidebarCollapsed()).toBe(true);
  });

  it("alterna, persiste y avisa a los suscriptores una vez por cambio", async () => {
    const { store, storage } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeSidebar(listener);

    store.toggleSidebar();
    expect(store.getSidebarCollapsed()).toBe(true);
    expect(storage.getItem(KEY)).toBe("true");
    expect(listener).toHaveBeenCalledTimes(1);

    store.setSidebarCollapsed(true);
    expect(listener).toHaveBeenCalledTimes(1);

    store.setSidebarCollapsed(prev => !prev);
    expect(store.getSidebarCollapsed()).toBe(false);
    expect(storage.getItem(KEY)).toBe("false");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.toggleSidebar();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("sigue funcionando en memoria si el storage falla", async () => {
    const { store } = await loadStore();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => store.toggleSidebar()).not.toThrow();
    expect(store.getSidebarCollapsed()).toBe(true);
  });

  it("se sincroniza con otras pestañas por el evento storage", async () => {
    const { store, win } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeSidebar(listener);

    win.dispatchEvent(storageEvent("otra-clave", "true"));
    expect(listener).not.toHaveBeenCalled();

    win.dispatchEvent(storageEvent(KEY, "true"));
    expect(store.getSidebarCollapsed()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    win.dispatchEvent(storageEvent(KEY, "false"));
    expect(store.getSidebarCollapsed()).toBe(true);
  });
});

describe("computeFrozenContentWidth", () => {
  const base = { frameInnerWidth: 1420, gap: 10, mainChromeX: 64 };

  it("calcula el ancho final del contenido para cada destino", () => {
    expect(computeFrozenContentWidth({ ...base, railTarget: 256 })).toBe(1090);
    expect(computeFrozenContentWidth({ ...base, railTarget: 76 })).toBe(1270);
  });

  it("la diferencia entre destinos es exactamente lo que cambia el riel", () => {
    const expanded = computeFrozenContentWidth({ ...base, railTarget: 256 });
    const collapsed = computeFrozenContentWidth({ ...base, railTarget: 76 });
    expect(collapsed - expanded).toBe(180);
  });

  it("nunca devuelve un ancho negativo", () => {
    expect(computeFrozenContentWidth({ frameInnerWidth: 100, gap: 10, railTarget: 256, mainChromeX: 64 })).toBe(0);
  });
});

describe("parseCssDuration", () => {
  it("entiende ms y s", () => {
    expect(parseCssDuration("280ms")).toBe(280);
    expect(parseCssDuration(" .28s")).toBe(280);
  });

  it("usa el respaldo si no hay valor", () => {
    expect(parseCssDuration("", 300)).toBe(300);
    expect(parseCssDuration("auto", 300)).toBe(300);
  });
});

import { EMPTY_FILTERS } from "../domain/selectors";
import { type Density, type Preferences, type ViewId } from "../types";

export const STORAGE_KEY = "educore.gradecenter.next.v3";

export const COLUMN_WIDTH: Record<Density, number> = {
  compact: 62,
  standard: 92,
  cozy: 118,
};

export const STUDENT_COLUMN_WIDTH: Record<Density, number> = {
  compact: 168,
  standard: 226,
  cozy: 268,
};

export const DEFINITIVA_COLUMN_WIDTH: Record<Density, number> = {
  compact: 96,
  standard: 122,
  cozy: 144,
};

export const ROW_HEIGHT: Record<Density, number> = {
  compact: 30,
  standard: 38,
  cozy: 46,
};

export const DEFAULT_PREFERENCES: Preferences = {
  view: "standard",
  density: "standard",
  columnWidths: {},
  studentColWidth: STUDENT_COLUMN_WIDTH.standard,
  definitivaColWidth: DEFINITIVA_COLUMN_WIDTH.standard,
  hiddenEvaluations: [],
  sort: { key: "name", dir: "asc" },
  filters: EMPTY_FILTERS,
  focusMode: false,
  quickEdit: false,
};

/** Aplica la densidad a los anchos de columna, respetando ajustes manuales. */
export function applyDensityDefaults(preferences: Preferences, density: Density): Preferences {
  return {
    ...preferences,
    density,
    columnWidths: {},
    studentColWidth: STUDENT_COLUMN_WIDTH[density],
    definitivaColWidth: DEFINITIVA_COLUMN_WIDTH[density],
  };
}

export function columnWidthOf(preferences: Pick<Preferences, "columnWidths" | "density">, evaluationId: string): number {
  return preferences.columnWidths[evaluationId] ?? COLUMN_WIDTH[preferences.density];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_PREFERENCES;

    const merged: Preferences = {
      ...DEFAULT_PREFERENCES,
      ...(parsed as Partial<Preferences>),
      sort: { ...DEFAULT_PREFERENCES.sort, ...((parsed.sort as object) ?? {}) },
      filters: { ...DEFAULT_PREFERENCES.filters, ...((parsed.filters as object) ?? {}) },
      columnWidths: { ...((parsed.columnWidths as Record<string, number>) ?? {}) },
      hiddenEvaluations: Array.isArray(parsed.hiddenEvaluations)
        ? (parsed.hiddenEvaluations as string[])
        : [],
    };

    // El modo enfoque no sobrevive a la recarga: es una decisión de sesión.
    merged.focusMode = false;
    // Compacta dejó de ser una vista independiente; Densa es ahora la única compactación.
    if (merged.view === "compact") merged.view = "standard";
    return applyUrlOverrides(merged);
  } catch {
    return applyUrlOverrides(DEFAULT_PREFERENCES);
  }
}

const VIEW_IDS: ViewId[] = ["standard", "student", "evaluations", "performance", "dba"];

/**
 * Permite abrir el prototipo directamente en una combinación concreta, por
 * ejemplo `/?view=performance&evaluations=30`. Se aplica al cargar y, a partir
 * de ahí, pasa a comportarse como cualquier otra preferencia del docente.
 */
export function applyUrlOverrides(preferences: Preferences): Preferences {
  if (typeof window === "undefined") return preferences;

  const params = new URLSearchParams(window.location.search);
  const next: Preferences = { ...preferences };

  const view = params.get("view");
  if (view && (VIEW_IDS as string[]).includes(view)) next.view = view as ViewId;

  const density = params.get("density");
  if (density === "compact" || density === "standard" || density === "cozy") {
    return applyDensityDefaults(next, density as Density);
  }

  if (params.get("focus") === "1") next.focusMode = true;

  return next;
}

export function savePreferences(preferences: Preferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* almacenamiento no disponible: las preferencias siguen vivas en memoria */
  }
}

export function resetPreferences(preferences: Preferences): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    view: preferences.view,
  };
}

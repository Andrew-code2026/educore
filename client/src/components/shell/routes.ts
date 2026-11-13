import type { Section } from "./shell.types";

/**
 * Mapa canónico Sección → ruta URL.
 *
 * Es la ÚNICA fuente de verdad para las rutas del shell. Al tiparlo como
 * `Record<Section, string>`, TypeScript obliga a declarar la ruta de cualquier
 * sección nueva que se agregue a `Section`, por lo que no puede quedar un
 * módulo sin URL.
 */
export const SECTION_PATHS = {
  overview: "/",
  academic: "/academic",
  grades: "/grades",
  classroom: "/classroom",
  attendance: "/attendance",
  calendar: "/calendar",
  communications: "/communications",
  reports: "/reports",
  users: "/users",
  settings: "/settings",
  analytics: "/analytics",
  piar: "/piar",
  creator: "/creator",
} as const satisfies Record<Section, string>;

export const DEFAULT_SECTION: Section = "overview";

/** Normaliza una ruta: minúsculas y sin slash final (excepto la raíz). */
function normalizePath(path: string): string {
  const trimmed = path.toLowerCase().replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

const PATH_TO_SECTION: ReadonlyMap<string, Section> = new Map(
  (Object.entries(SECTION_PATHS) as Array<[Section, string]>).map(([section, path]) => [
    normalizePath(path),
    section,
  ])
);

/**
 * Parámetros de la URL que sobreviven al cambiar de sección: `estudiante` es el hijo que
 * consulta el acudiente, y debe seguir elegido en Inicio, Calificaciones o Asistencia.
 */
export const PERSISTENT_QUERY_PARAMS = ["estudiante"] as const;

/** Solo los parámetros persistentes de una búsqueda ("?estudiante=7&materia=2" → "estudiante=7"). */
export function persistentQuery(search: string): URLSearchParams {
  const current = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of PERSISTENT_QUERY_PARAMS) {
    const value = current.get(key);
    if (value) kept.set(key, value);
  }
  return kept;
}

export function sectionToPath(section: Section): string {
  return SECTION_PATHS[section] ?? SECTION_PATHS[DEFAULT_SECTION];
}

/** Devuelve la sección asociada a una ruta, o `null` si la ruta no pertenece al shell. */
export function pathToSection(path: string): Section | null {
  return PATH_TO_SECTION.get(normalizePath(path)) ?? null;
}

export function isSectionPath(path: string): boolean {
  return pathToSection(path) !== null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Patrón único que coincide con cualquier ruta del shell (con o sin slash final).
 *
 * Se usa un solo `<Route>` para todas las secciones para que la página `Home`
 * NO se desmonte al navegar entre módulos (se conserva su estado: rol, sesión
 * demo, caché de queries, etc.).
 */
export const SECTION_ROUTE_PATTERN = new RegExp(
  `^(?:${Object.values(SECTION_PATHS)
    .map(path => escapeRegExp(normalizePath(path) === "/" ? "" : normalizePath(path)))
    .join("|")})/?$`,
  "i"
);

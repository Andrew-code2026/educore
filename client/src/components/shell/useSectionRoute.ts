import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { DEFAULT_SECTION, pathToSection, persistentQuery, sectionToPath } from "./routes";
import type { Section } from "./shell.types";

export interface NavigateToSectionOptions {
  /** Reemplaza la entrada actual del historial en lugar de crear una nueva. */
  replace?: boolean;
}

export type NavigateToSection = (section: Section, options?: NavigateToSectionOptions) => void;

/**
 * Sincroniza la sección activa del shell con la URL.
 *
 * - La sección se DERIVA de la URL (no hay estado duplicado), por lo que
 *   recargar la página, compartir el enlace o usar atrás/adelante del
 *   navegador funcionan de forma natural.
 * - `navigateToSection` mantiene la misma firma `(section) => void` que el
 *   antiguo `setSection`, así que los componentes existentes no cambian.
 */
export function useSectionRoute(): [Section, NavigateToSection] {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const section = pathToSection(location) ?? DEFAULT_SECTION;

  const navigateToSection = useCallback<NavigateToSection>(
    (nextSection, options) => {
      // Conserva los parámetros persistentes (p. ej. el hijo que mira el acudiente)
      const query = persistentQuery(search).toString();
      const target = query ? `${sectionToPath(nextSection)}?${query}` : sectionToPath(nextSection);
      // Evita entradas duplicadas en el historial al re-seleccionar la misma sección.
      if (pathToSection(location) === nextSection) return;
      navigate(target, { replace: options?.replace });
    },
    [location, navigate, search]
  );

  return [section, navigateToSection];
}

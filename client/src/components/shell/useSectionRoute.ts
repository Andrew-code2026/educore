import { useCallback } from "react";
import { useLocation } from "wouter";
import { DEFAULT_SECTION, pathToSection, sectionToPath } from "./routes";
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
  const section = pathToSection(location) ?? DEFAULT_SECTION;

  const navigateToSection = useCallback<NavigateToSection>(
    (nextSection, options) => {
      const target = sectionToPath(nextSection);
      // Evita entradas duplicadas en el historial al re-seleccionar la misma sección.
      if (pathToSection(location) === nextSection) return;
      navigate(target, { replace: options?.replace });
    },
    [location, navigate]
  );

  return [section, navigateToSection];
}

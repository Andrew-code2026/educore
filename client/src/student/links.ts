import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { persistentQuery, sectionToPath } from "@/components/shell/routes";
import type { Section } from "@/components/shell/shell.types";

/**
 * Parámetros de enlace profundo del portal: /classroom?tarea=12, /grades?materia=9.
 * `estudiante` es el hijo que mira el acudiente (/grades?estudiante=7) y viaja entre secciones.
 */
export type StudentParam = "tarea" | "materia" | "estudiante";

const parseId = (raw: string | null) => (raw && /^\d+$/.test(raw) ? Number(raw) : null);

/** Lee y escribe un id numérico en la URL (recargar o compartir conserva la selección). */
export function useStudentParam(key: StudentParam): [number | null, (value: number | null) => void] {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const value = parseId(new URLSearchParams(search).get(key));
  const setValue = useCallback(
    (next: number | null) => {
      const params = new URLSearchParams(search);
      if (next === null) params.delete(key);
      else params.set(key, String(next));
      const query = params.toString();
      navigate(query ? `${location}?${query}` : location, { replace: true });
    },
    [key, location, navigate, search],
  );
  return [value, setValue];
}

/** Ruta de una sección con sus parámetros, conservando los persistentes de la URL actual. */
export function sectionHref(section: Section, search: string, params?: Partial<Record<StudentParam, number>>): string {
  const next = persistentQuery(search);
  for (const [key, value] of Object.entries(params ?? {})) next.set(key, String(value));
  const query = next.toString();
  return query ? `${sectionToPath(section)}?${query}` : sectionToPath(section);
}

/** Abre una sección con un parámetro: openSection("classroom", { tarea: 12 }). */
export function useOpenSection() {
  const search = useSearch();
  const [, navigate] = useLocation();
  return useCallback((section: Section, params?: Partial<Record<StudentParam, number>>) => navigate(sectionHref(section, search, params)), [navigate, search]);
}

import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { sectionToPath } from "@/components/shell/routes";
import type { Section } from "@/components/shell/shell.types";

/** Parámetros de enlace profundo del portal: /classroom?tarea=12, /grades?materia=9 */
export type StudentParam = "tarea" | "materia";

/** Lee y escribe un id numérico en la URL (recargar o compartir conserva la selección). */
export function useStudentParam(key: StudentParam): [number | null, (value: number | null) => void] {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const raw = new URLSearchParams(search).get(key);
  const value = raw && /^\d+$/.test(raw) ? Number(raw) : null;
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

/** Abre una sección con un parámetro: openSection("classroom", { tarea: 12 }). */
export function useOpenSection() {
  const [, navigate] = useLocation();
  return useCallback(
    (section: Section, params?: Partial<Record<StudentParam, number>>) => {
      const query = new URLSearchParams(Object.entries(params ?? {}).map(([key, value]) => [key, String(value)])).toString();
      navigate(query ? `${sectionToPath(section)}?${query}` : sectionToPath(section));
    },
    [navigate],
  );
}

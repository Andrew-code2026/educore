/**
 * Hijos del acudiente y el que está mirando. La selección vive en la URL (`?estudiante=7`):
 * recargar o compartir el enlace conserva al mismo hijo, y viaja entre secciones.
 */
import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";

export interface GuardianChild {
  id: number;
  name: string;
  courseName: string | null;
  relationshipType: string | null;
  isPrimary: boolean;
}

/** Id del hijo en la URL, o `null` si no hay uno válido. */
export function childIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("estudiante");
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** El hijo pedido si está vinculado; si no, el primero (el servidor ordena el vínculo primario primero). */
export function pickChild(children: GuardianChild[], requestedId: number | null): GuardianChild | null {
  return children.find(child => child.id === requestedId) ?? children[0] ?? null;
}

/**
 * URL al cambiar de hijo: misma sección, sin la materia o tarea abierta (son del hijo anterior).
 */
export function childHref(location: string, search: string, childId: number): string {
  const params = new URLSearchParams(search);
  params.delete("materia");
  params.delete("tarea");
  params.set("estudiante", String(childId));
  return `${location}?${params.toString()}`;
}

export function useGuardianChildren() {
  const query = trpc.guardian.children.useQuery({ role: "guardian" }, { staleTime: 5 * 60_000 });
  const search = useSearch();
  const [location, navigate] = useLocation();
  const children = query.data ?? [];
  const setChild = useCallback((id: number) => navigate(childHref(location, search, id)), [location, navigate, search]);
  return {
    children,
    child: pickChild(children, childIdFromSearch(search)),
    setChild,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

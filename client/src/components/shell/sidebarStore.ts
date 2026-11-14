import { useSyncExternalStore } from "react";

/**
 * Estado plegado/desplegado del riel lateral.
 *
 * Vive fuera de ShellContext a propósito: alternarlo solo re-renderiza a quien se suscribe
 * (el marco y el riel), no a cada página que consume el contexto del shell. Se persiste en
 * localStorage y se sincroniza entre pestañas con el evento `storage`.
 */

export const SIDEBAR_STORAGE_KEY = "educore-sidebar-collapsed";

type Listener = () => void;

const listeners = new Set<Listener>();
let collapsed = readStored();
let storageBound = false;

function readStored(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStored(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    // Storage bloqueado o lleno: el estado sigue funcionando en memoria.
  }
}

function emit() {
  listeners.forEach(listener => listener());
}

function handleStorage(event: StorageEvent) {
  if (event.key !== SIDEBAR_STORAGE_KEY) return;
  const next = event.newValue === "true";
  if (next === collapsed) return;
  collapsed = next;
  emit();
}

export function subscribeSidebar(listener: Listener) {
  listeners.add(listener);
  if (!storageBound && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && storageBound) {
      window.removeEventListener("storage", handleStorage);
      storageBound = false;
    }
  };
}

export function getSidebarCollapsed(): boolean {
  return collapsed;
}

export function setSidebarCollapsed(next: boolean | ((prev: boolean) => boolean)) {
  const value = typeof next === "function" ? next(collapsed) : next;
  if (value === collapsed) return;
  collapsed = value;
  writeStored(value);
  emit();
}

export function toggleSidebar() {
  setSidebarCollapsed(prev => !prev);
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribeSidebar, getSidebarCollapsed, () => false);
}

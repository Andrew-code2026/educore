import type { Dataset } from "../types";

/**
 * Adaptador de persistencia de la iteración 1.
 *
 * Hoy usa localStorage porque el proyecto aún no tiene servidor/base de datos
 * conectados. La interfaz es deliberadamente pequeña para sustituirla por una
 * API real sin cambiar el estado ni la experiencia del Grade Center.
 */
// v3 inicia el módulo sin importar snapshots demo v2; las claves antiguas no se borran.
export const CONFIRMED_DATASET_KEY = "educore.gradecenter.confirmed.v3";
export const LOCAL_DRAFT_KEY = "educore.gradecenter.drafts.v3";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDataset(value: unknown): value is Dataset {
  if (!isRecord(value) || !Array.isArray(value.students) || !Array.isArray(value.evaluations) || !isRecord(value.grades) || !isRecord(value.comments)) return false;
  const studentIds = new Set<string>();
  for (const student of value.students) {
    if (!isRecord(student) || typeof student.id !== "string" || studentIds.has(student.id)) return false;
    studentIds.add(student.id);
  }
  const evaluationIds = new Set<string>();
  let totalWeight = 0;
  for (const evaluation of value.evaluations) {
    if (!isRecord(evaluation) || typeof evaluation.id !== "string" || evaluationIds.has(evaluation.id) || typeof evaluation.weight !== "number" || !Number.isFinite(evaluation.weight) || evaluation.weight < 0 || evaluation.weight > 100) return false;
    evaluationIds.add(evaluation.id);
    totalWeight += evaluation.weight;
  }
  if (totalWeight > 100) return false;
  for (const grade of Object.values(value.grades)) {
    if (grade !== null && (typeof grade !== "number" || !Number.isFinite(grade) || grade < 0 || grade > 5)) return false;
  }
  return Object.values(value.comments).every((comment) => typeof comment === "string");
}

export function loadConfirmedDataset(fallback: Dataset): Dataset {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(CONFIRMED_DATASET_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDataset(parsed) || (fallback.key !== "gradecenter-empty" && parsed.key !== fallback.key)) {
      return fallback;
    }
    return { ...fallback, ...parsed, comments: parsed.comments ?? {} };
  } catch {
    return fallback;
  }
}

export function persistConfirmedDataset(dataset: Dataset): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIRMED_DATASET_KEY, JSON.stringify(dataset));
}

export function loadDraftSnapshot(fallback: Dataset): { dataset: Dataset; changes: Record<string, unknown> } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dataset?: unknown; changes?: unknown };
    if (!isValidDataset(parsed.dataset) || !isRecord(parsed.changes)) {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
      return null;
    }
    // Si el borrador pertenece a otro curso o conjunto de datos, no debe restaurarse
    if (parsed.dataset.key !== fallback.key) {
      return null;
    }
    return { dataset: { ...fallback, ...parsed.dataset, comments: parsed.dataset.comments ?? {} }, changes: parsed.changes };
  } catch {
    return null;
  }
}

export function persistDraftChanges(changes: Record<string, unknown>, dataset: Dataset): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (Object.keys(changes).length === 0) window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    else window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ changes, dataset }));
    return true;
  } catch {
    return false;
  }
}

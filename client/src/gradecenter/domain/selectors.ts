import { gradeKey, type Dataset, type Evaluation, type Filters, type Preferences, type SortSpec } from "../types";
import type { Analytics, StudentMetrics } from "./metrics";
import { normalizeText } from "../lib/format";

export interface FilterChip {
  id: string;
  label: string;
  clear: (filters: Filters) => Filters;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  levels: [],
  onlyPending: false,
  onlyAttention: false,
  onlyComplete: false,
  evaluationId: null,
  evaluationState: null,
};

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.levels.length > 0 ||
    filters.onlyPending ||
    filters.onlyAttention ||
    filters.onlyComplete ||
    (filters.evaluationId != null && filters.evaluationState != null)
  );
}

export function filterStudents(
  dataset: Dataset,
  analytics: Analytics,
  filters: Filters,
): StudentMetrics[] {
  const query = normalizeText(filters.query.trim());

  return analytics.students.filter((metrics) => {
    const student = metrics.student;

    if (query) {
      const haystack = normalizeText(`${student.fullName} ${student.code}`);
      if (!haystack.includes(query)) return false;
    }

    if (filters.levels.length > 0) {
      if (!metrics.level || !filters.levels.includes(metrics.level)) return false;
    }

    if (filters.onlyPending && metrics.pendingCount === 0) return false;
    if (filters.onlyAttention && !metrics.attention) return false;
    if (filters.onlyComplete && !metrics.complete) return false;

    if (filters.evaluationId && filters.evaluationState) {
      const grade = dataset.grades[gradeKey(student.id, filters.evaluationId)] ?? null;
      if (filters.evaluationState === "pending" && grade != null) return false;
      if (filters.evaluationState === "graded" && grade == null) return false;
    }

    return true;
  });
}

export function sortStudents(items: StudentMetrics[], sort: SortSpec): StudentMetrics[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sort.key) {
      case "name":
        return factor * a.student.fullName.localeCompare(b.student.fullName, "es");
      case "definitiva": {
        if (a.definitiva == null && b.definitiva == null) return 0;
        if (a.definitiva == null) return 1;
        if (b.definitiva == null) return -1;
        return factor * (a.definitiva - b.definitiva);
      }
      case "performance":
        return factor * (a.performanceIndex - b.performanceIndex);
      case "pending":
        return factor * (a.pendingCount - b.pendingCount);
      case "attention": {
        const scoreOf = (m: StudentMetrics) => (m.attention ? 1 : 0) * 10 + (5 - (m.definitiva ?? 5));
        return factor * (scoreOf(a) - scoreOf(b));
      }
      default:
        return 0;
    }
  });

  return sorted;
}

export function visibleEvaluations(preferences: Preferences, dataset: Dataset): Evaluation[] {
  return dataset.evaluations.filter((evaluation) => !preferences.hiddenEvaluations.includes(evaluation.id));
}

export function activeFilterChips(
  filters: Filters,
  dataset: Dataset,
): { id: string; label: string; clear: (filters: Filters) => Filters }[] {
  const chips: { id: string; label: string; clear: (filters: Filters) => Filters }[] = [];
  const evaluation = filters.evaluationId
    ? dataset.evaluations.find((e) => e.id === filters.evaluationId) ?? null
    : null;

  if (filters.query.trim()) {
    chips.push({
      id: "query",
      label: `«${filters.query.trim()}»`,
      clear: (f) => ({ ...f, query: "" }),
    });
  }

  filters.levels.forEach((level) => {
    chips.push({
      id: `level-${level}`,
      label: `Nivel: ${level}`,
      clear: (f) => ({ ...f, levels: f.levels.filter((l) => l !== level) }),
    });
  });

  if (filters.onlyPending) {
    chips.push({
      id: "pending",
      label: "Con pendientes",
      clear: (f) => ({ ...f, onlyPending: false, evaluationId: null, evaluationState: null }),
    });
  }

  if (filters.onlyAttention) {
    chips.push({
      id: "attention",
      label: "Requiere atención",
      clear: (f) => ({ ...f, onlyAttention: false }),
    });
  }

  if (filters.onlyComplete) {
    chips.push({
      id: "complete",
      label: "100% evaluado",
      clear: (f) => ({ ...f, onlyComplete: false }),
    });
  }

  if (evaluation && filters.evaluationState) {
    chips.push({
      id: "evaluation",
      label: `${evaluation.code} · ${filters.evaluationState === "pending" ? "pendientes" : "calificados"}`,
      clear: (f) => ({ ...f, evaluationId: null, evaluationState: null }),
    });
  }

  return chips;
}
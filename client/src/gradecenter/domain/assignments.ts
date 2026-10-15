import type { Dataset } from "../types";

export type AssignmentAccess = "owner" | "read";
export type AssignmentStatus = "available" | "preparing" | "closed";

/** Identidad estable de una planilla asignada a un docente. */
export interface GradebookAssignment {
  id: string;
  sourceDatasetKey: string;
  dataset: Dataset;
  access: AssignmentAccess;
  status: AssignmentStatus;
}

export function assignmentFromDataset(dataset: Dataset): GradebookAssignment {
  return {
    id: dataset.key,
    sourceDatasetKey: dataset.key,
    dataset,
    access: "owner",
    status: "available",
  };
}

export function filterAssignments(
  assignments: GradebookAssignment[],
  query: string,
  year: string,
  period: string,
): GradebookAssignment[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return assignments.filter(({ dataset }) => {
    const haystack = `${dataset.course} ${dataset.group} ${dataset.subject} ${dataset.teacher.name}`.toLocaleLowerCase();
    return (!normalizedQuery || haystack.includes(normalizedQuery))
      && (year === "all" || dataset.academicYear === year)
      && (period === "all" || dataset.period === period);
  });
}

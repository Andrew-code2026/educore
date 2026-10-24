import type { Dataset } from "../types";
import { gradeKey } from "../types";

export type AssignmentAccess = "owner" | "read";
export type AssignmentStatus = "available" | "preparing" | "closed";

export interface AssignmentMetrics {
  studentsCount: number;
  evaluationsCount: number;
  gradedCells: number;
  totalCells: number;
  pendingCells: number;
  progressPct: number;
}

/** Identidad estable de una planilla asignada a un docente con métricas propias. */
export interface GradebookAssignment {
  id: string;
  sourceDatasetKey: string;
  courseId?: number;
  subjectId?: number;
  periodId?: number | null;
  dataset: Dataset;
  access: AssignmentAccess;
  status: AssignmentStatus;
  metrics?: AssignmentMetrics;
}

export function computeDatasetMetrics(dataset: Dataset): AssignmentMetrics {
  const studentsCount = dataset.students.length;
  const evaluationsCount = dataset.evaluations.length;
  const totalCells = studentsCount * evaluationsCount;

  let gradedCells = 0;
  for (const student of dataset.students) {
    for (const evaluation of dataset.evaluations) {
      const value = dataset.grades[gradeKey(student.id, evaluation.id)];
      if (value !== null && value !== undefined) {
        gradedCells += 1;
      }
    }
  }

  const boundedGraded = Math.min(totalCells, Math.max(0, gradedCells));
  const pendingCells = Math.max(0, totalCells - boundedGraded);
  const progressPct = totalCells > 0 ? Math.min(100, Math.max(0, Math.round((boundedGraded / totalCells) * 100))) : 0;

  return {
    studentsCount,
    evaluationsCount,
    gradedCells: boundedGraded,
    totalCells,
    pendingCells,
    progressPct,
  };
}

export function assignmentFromDataset(dataset: Dataset): GradebookAssignment {
  return {
    id: dataset.key,
    sourceDatasetKey: dataset.key,
    dataset,
    access: "owner",
    status: "available",
    metrics: computeDatasetMetrics(dataset),
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

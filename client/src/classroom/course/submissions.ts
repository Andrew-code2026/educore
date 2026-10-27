import type { Student } from '../types';

/**
 * Modelo de la pestaña "Entregas" de una actividad: filtros, orden de trabajo y
 * resumen. Sin dependencias de React para poder probarse aislado.
 */

export const SUBMISSION_FILTERS = ['Todos', 'Por revisar', 'Calificadas', 'Sin entrega'] as const;
export type SubmissionFilter = (typeof SUBMISSION_FILTERS)[number];

/** Lo que el docente hace con cada estudiante; ordena la lista y elige la acción de la fila. */
export type SubmissionPhase = 'review' | 'graded' | 'missing';

export function phaseOfSubmission(student: Student): SubmissionPhase {
  if (student.status === 'Calificada') return 'graded';
  if (student.status === 'No entregó') return 'missing';
  return 'review';
}

const PHASE_ORDER: Record<SubmissionPhase, number> = { review: 0, graded: 1, missing: 2 };

const FILTER_PHASE: Record<Exclude<SubmissionFilter, 'Todos'>, SubmissionPhase> = {
  'Por revisar': 'review',
  Calificadas: 'graded',
  'Sin entrega': 'missing',
};

export interface SubmissionSummary {
  total: number;
  delivered: number;
  review: number;
  graded: number;
  missing: number;
}

export function summarizeSubmissions(students: Student[]): SubmissionSummary {
  const summary = { total: students.length, delivered: 0, review: 0, graded: 0, missing: 0 };
  for (const student of students) {
    const phase = phaseOfSubmission(student);
    summary[phase] += 1;
    if (phase !== 'missing') summary.delivered += 1;
  }
  return summary;
}

export function countBySubmissionFilter(students: Student[]): Record<SubmissionFilter, number> {
  const summary = summarizeSubmissions(students);
  return {
    Todos: summary.total,
    'Por revisar': summary.review,
    Calificadas: summary.graded,
    'Sin entrega': summary.missing,
  };
}

/** Lista de trabajo: primero lo pendiente de calificar, luego lo calificado y al final quien no entregó. */
export function selectSubmissions(students: Student[], filter: SubmissionFilter, query: string): Student[] {
  const q = query.trim().toLocaleLowerCase('es');
  return students
    .filter((s) => filter === 'Todos' || phaseOfSubmission(s) === FILTER_PHASE[filter])
    .filter((s) => !q || `${s.name} ${s.file ?? ''}`.toLocaleLowerCase('es').includes(q))
    .sort(
      (a, b) =>
        PHASE_ORDER[phaseOfSubmission(a)] - PHASE_ORDER[phaseOfSubmission(b)] ||
        a.name.localeCompare(b.name, 'es')
    );
}

/** Índice (en la lista original) de la entrega con la que abrir el calificador, o -1 si no hay ninguna. */
export function firstToGrade(students: Student[]): number {
  const pending = students.findIndex((s) => phaseOfSubmission(s) === 'review');
  if (pending >= 0) return pending;
  return students.findIndex((s) => phaseOfSubmission(s) === 'graded');
}

const csvCell = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** CSV con BOM para que Excel respete tildes y eñes. */
export function submissionsCsv(students: Student[]): string {
  const rows = [
    ['Estudiante', 'Estado', 'Archivo', 'Fecha de entrega', 'Calificación'],
    ...students.map((s) => [
      s.name,
      s.status,
      s.file ?? 'Sin entrega',
      s.submittedAt ? new Date(s.submittedAt).toLocaleString('es-CO') : '',
      s.score !== undefined ? s.score.toFixed(1) : '',
    ]),
  ];
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

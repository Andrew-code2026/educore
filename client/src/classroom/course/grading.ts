import type { RubricCriterion, Student } from '../types';
import { phaseOfSubmission, selectSubmissions } from './submissions';

/**
 * Modelo del calificador: lectura de la nota, nota por rúbrica y orden de
 * navegación entre entregas. Sin dependencias de React para poder probarse aislado.
 */

export const MAX_GRADE = 5;

/** Acepta coma o punto decimal ("4,3" o "4.3"); devuelve null si no es una nota válida de 0 a 5. */
export function parseGrade(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (value < 0 || value > MAX_GRADE) return null;
  return Math.round(value * 10) / 10;
}

export function rubricTotals(criteria: RubricCriterion[]) {
  const earned = criteria.reduce((sum, c) => sum + (c.score || 0), 0);
  const max = criteria.reduce((sum, c) => sum + (c.max || 0), 0);
  return { earned, max, grade: max > 0 ? Math.round((earned / max) * MAX_GRADE * 10) / 10 : 0 };
}

/**
 * Entregas en el mismo orden que la lista de la pestaña Entregas (por revisar,
 * luego calificadas), como índices de la lista original. Quien no entregó queda fuera.
 */
export function gradingQueue(students: Student[]): number[] {
  const indexById = new Map(students.map((s, i) => [s.id, i]));
  return selectSubmissions(students, 'Todos', '')
    .filter((s) => phaseOfSubmission(s) !== 'missing')
    .map((s) => indexById.get(s.id) ?? -1)
    .filter((i) => i >= 0);
}

/** Siguiente entrega por revisar después de `current`, dando la vuelta; -1 si no queda ninguna. */
export function nextPending(students: Student[], current: number): number {
  const queue = gradingQueue(students).filter(
    (i) => i !== current && phaseOfSubmission(students[i]) === 'review'
  );
  if (!queue.length) return -1;
  const order = gradingQueue(students);
  const position = order.indexOf(current);
  return queue.find((i) => order.indexOf(i) > position) ?? queue[0];
}

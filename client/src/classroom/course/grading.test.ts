import { describe, expect, it } from 'vitest';
import { emptyStudent } from '../adapter';
import type { Student } from '../types';
import { gradingQueue, nextPending, parseGrade, rubricTotals } from './grading';

const student = (name: string, status: Student['status']): Student => ({ ...emptyStudent, id: name, name, status });

// Orden original como llega del adaptador; la cola sigue el orden de la pestaña Entregas
const students = [
  student('Carlos', 'Calificada'), // 0
  student('Sofía', 'Por revisar'), // 1
  student('Andrés', 'No entregó'), // 2
  student('Beatriz', 'Por revisar'), // 3
];

describe('parseGrade', () => {
  it('acepta coma o punto y redondea a un decimal', () => {
    expect(parseGrade('4,3')).toBe(4.3);
    expect(parseGrade(' 4.25 ')).toBe(4.3);
    expect(parseGrade('5')).toBe(5);
    expect(parseGrade('0')).toBe(0);
  });

  it('rechaza valores fuera de escala o no numéricos', () => {
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('5.1')).toBeNull();
    expect(parseGrade('-1')).toBeNull();
    expect(parseGrade('4..2')).toBeNull();
    expect(parseGrade('abc')).toBeNull();
  });
});

describe('rubricTotals', () => {
  it('convierte los puntos a la escala de 5', () => {
    const criteria = [
      { id: 'a', title: 'A', description: '', max: 20, score: 18 },
      { id: 'b', title: 'B', description: '', max: 20, score: 17 },
      { id: 'c', title: 'C', description: '', max: 10, score: 9 },
    ];
    expect(rubricTotals(criteria)).toEqual({ earned: 44, max: 50, grade: 4.4 });
  });
});

describe('navegación', () => {
  it('recorre las entregas como la lista: por revisar y luego calificadas, sin quien no entregó', () => {
    expect(gradingQueue(students)).toEqual([3, 1, 0]);
  });

  it('salta a la siguiente pendiente y da la vuelta', () => {
    expect(nextPending(students, 3)).toBe(1);
    expect(nextPending(students, 1)).toBe(3);
    expect(nextPending(students, 0)).toBe(3);
    expect(nextPending([student('Solo', 'Por revisar')], 0)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { adaptEduCoreActivities, adaptEduCoreStudents, emptyStudent } from '../adapter';
import type { Student } from '../types';
import {
  countBySubmissionFilter,
  firstToGrade,
  selectSubmissions,
  submissionsCsv,
  summarizeSubmissions,
} from './submissions';

const student = (name: string, patch: Partial<Student>): Student => ({
  ...emptyStudent,
  id: name,
  name,
  ...patch,
});

const students = [
  student('Valentina Ríos', { status: 'No entregó' }),
  student('Carlos Rojas', { status: 'Calificada', score: 4.3, file: 'taller-carlos.pdf' }),
  student('Andrés Peña', { status: 'No entregó' }),
  student('Sofía Martínez', { status: 'Por revisar', file: 'taller-sofia.pdf' }),
];

describe('entregas', () => {
  it('resume y cuenta con el mismo criterio', () => {
    expect(summarizeSubmissions(students)).toEqual({ total: 4, delivered: 2, review: 1, graded: 1, missing: 2 });
    expect(countBySubmissionFilter(students)).toEqual({
      Todos: 4,
      'Por revisar': 1,
      Calificadas: 1,
      'Sin entrega': 2,
    });
  });

  it('ordena la lista de trabajo: por revisar, calificadas y sin entrega', () => {
    expect(selectSubmissions(students, 'Todos', '').map((s) => s.name)).toEqual([
      'Sofía Martínez',
      'Carlos Rojas',
      'Andrés Peña',
      'Valentina Ríos',
    ]);
    expect(selectSubmissions(students, 'Todos', 'carlos.pdf').map((s) => s.name)).toEqual(['Carlos Rojas']);
  });

  it('abre el calificador en la primera entrega pendiente, o en una calificada, nunca en quien no entregó', () => {
    expect(firstToGrade(students)).toBe(3);
    expect(firstToGrade(students.filter((s) => s.status !== 'Por revisar'))).toBe(1);
    expect(firstToGrade([student('Solo', { status: 'No entregó' })])).toBe(-1);
  });

  it('exporta CSV con BOM y comillas escapadas', () => {
    const csv = submissionsCsv([student('Ana "la" Díaz', { status: 'Calificada', score: 4 })]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Ana ""la"" Díaz","Calificada","Sin entrega","","4.0"');
  });
});

describe('adaptador del curso', () => {
  const data = {
    students: [
      { id: 1, name: 'Sofía Martínez', course: '11-2' },
      { id: 2, name: 'Andrés Peña', course: '11-2' },
      { id: 3, name: 'Otra Estudiante', course: '11-1' },
    ],
    assignments: [
      { id: 1, title: 'Taller', course: '11-2', dueAt: '2026-09-17T04:00:00.000Z' },
      { id: 2, title: 'Guía', course: '11-12', dueAt: '2026-09-17T04:00:00.000Z' },
    ],
    submissions: [{ id: 9, assignmentId: 1, studentName: 'Sofía Martínez', grade: null }],
  };

  it('solo lista estudiantes del curso', () => {
    expect(adaptEduCoreStudents(data, '1', 'Curso 11-2').map((s) => s.name)).toEqual([
      'Sofía Martínez',
      'Andrés Peña',
    ]);
  });

  it('no mezcla actividades de otros cursos ni rellena con las de otro grupo', () => {
    expect(adaptEduCoreActivities(data, 'Curso 11-2').map((a) => a.name)).toEqual(['Taller']);
    expect(adaptEduCoreActivities(data, 'Curso 11-1')).toEqual([]);
  });
});

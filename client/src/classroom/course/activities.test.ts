import { describe, expect, it } from 'vitest';
import { emptyActivity } from '../adapter';
import type { Activity } from '../types';
import { countByFilter, phaseOf, selectActivities } from './activities';

// Sábado 24 de octubre de 2026, 15:00 hora local
const NOW = new Date(2026, 9, 24, 15, 0);
const at = (days: number) => new Date(2026, 9, 24 + days, 23, 59).toISOString();

const activity = (id: string, patch: Partial<Activity>): Activity => ({
  ...emptyActivity,
  id,
  name: id,
  status: 'En curso',
  ...patch,
});

const activities = [
  activity('Laboratorio', { dueAt: at(-40), status: 'Cerrada' }),
  activity('Taller', { dueAt: at(-8), submissions: 2, graded: 1, status: 'Por revisar' }),
  activity('Ensayo', { dueAt: at(-5), status: 'Cerrada' }),
  activity('Guía lejana', { dueAt: at(9) }),
  activity('Guía cercana', { dueAt: at(1), submissions: 3, graded: 1 }),
  activity('Borrador', { status: 'Borrador' }),
];

const names = (list: Activity[]) => list.map((a) => a.name);

describe('selectActivities', () => {
  it('por fecha: abiertas por vencimiento, luego vencidas de la más reciente a la más antigua', () => {
    expect(names(selectActivities(activities, { filter: 'Todas', query: '', sort: 'fecha' }, NOW))).toEqual([
      'Guía cercana',
      'Guía lejana',
      'Ensayo',
      'Taller',
      'Laboratorio',
      'Borrador',
    ]);
  });

  it('"Por revisar" incluye abiertas con entregas sin calificar', () => {
    expect(
      names(selectActivities(activities, { filter: 'Por revisar', query: '', sort: 'pendientes' }, NOW))
    ).toEqual(['Guía cercana', 'Taller']);
  });

  it('busca por nombre sin distinguir mayúsculas', () => {
    expect(names(selectActivities(activities, { filter: 'Todas', query: 'guía', sort: 'nombre' }, NOW))).toEqual([
      'Guía cercana',
      'Guía lejana',
    ]);
  });
});

describe('countByFilter', () => {
  it('cuenta cada filtro con el mismo criterio que la lista', () => {
    expect(countByFilter(activities)).toEqual({
      Todas: 6,
      Abiertas: 2,
      'Por revisar': 2,
      Cerradas: 2,
      Borradores: 1,
    });
  });

  it('agrupa los estados internos en las fases que ve el docente', () => {
    expect(phaseOf(activity('a', { status: 'Publicada' }))).toBe('open');
    expect(phaseOf(activity('b', { status: 'Próxima' }))).toBe('open');
  });
});

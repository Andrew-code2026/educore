import { describe, expect, it } from 'vitest';
import { emptyActivity } from '../adapter';
import type { Activity } from '../types';
import { buildCourseOverview, describeDue, formatMonthShort, formatWeekdayTime } from './overview';

// Sábado 24 de octubre de 2026, 15:00 hora local
const NOW = new Date(2026, 9, 24, 15, 0);
const at = (days: number, hour = 23, minute = 59) => new Date(2026, 9, 24 + days, hour, minute);

const activity = (id: string, patch: Partial<Activity>): Activity => ({
  ...emptyActivity,
  id,
  name: `Actividad ${id}`,
  status: 'En curso',
  ...patch,
});

describe('buildCourseOverview', () => {
  const activities = [
    activity('vencida-sin-entregas', { dueAt: at(-30).toISOString(), status: 'Cerrada' }),
    activity('por-revisar', { dueAt: at(-8).toISOString(), submissions: 2, graded: 1, status: 'Por revisar' }),
    activity('mas-pendientes', { dueAt: at(-2).toISOString(), submissions: 5, graded: 1, status: 'Por revisar' }),
    activity('lejana', { dueAt: at(9).toISOString(), submissions: 3, graded: 3 }),
    activity('cercana', { dueAt: at(1).toISOString() }),
    activity('borrador', { dueAt: at(2).toISOString(), submissions: 1, status: 'Borrador' }),
    activity('sin-fecha', {}),
  ];
  const model = buildCourseOverview(activities, NOW);

  it('lista lo que espera calificación, con más pendientes primero', () => {
    expect(model.toReview.map((item) => item.activity.id)).toEqual(['mas-pendientes', 'por-revisar']);
    expect(model.toReview.map((item) => item.pending)).toEqual([4, 1]);
    expect(model.pendingTotal).toBe(5);
  });

  it('solo muestra como próximas las entregas con fecha por delante, en orden', () => {
    expect(model.upcoming.map((item) => item.activity.id)).toEqual(['cercana', 'lejana']);
    expect(model.upcoming.map((item) => item.daysLeft)).toEqual([1, 9]);
  });

  it('ignora borradores', () => {
    expect(model.toReview.some((item) => item.activity.id === 'borrador')).toBe(false);
    expect(model.upcoming.some((item) => item.activity.id === 'borrador')).toBe(false);
  });
});

describe('formato', () => {
  it('describe el vencimiento en relación con hoy', () => {
    expect(describeDue(null, NOW)).toBeNull();
    expect(describeDue(at(0, 8, 0), NOW)).toBe('Venció hoy');
    expect(describeDue(at(-1), NOW)).toBe('Venció ayer');
    expect(describeDue(new Date(2026, 8, 16, 23, 59), NOW)).toBe('Venció el 16 sep');
    expect(describeDue(at(0), NOW)).toBe('Cierra hoy');
    expect(describeDue(at(1), NOW)).toBe('Cierra mañana');
    expect(describeDue(at(4), NOW)).toBe('Cierra en 4 días');
  });

  it('formatea mes, día de la semana y hora', () => {
    expect(formatMonthShort(at(6))).toBe('oct');
    expect(formatWeekdayTime(at(6))).toBe('Viernes · 23:59');
  });
});

import { describe, expect, it } from 'vitest';
import { dueDateOf, emptyDraft, isDraftDirty, validateDraft } from './activityDraft';

// Sábado 24 de octubre de 2026, 15:00 hora local
const NOW = new Date(2026, 9, 24, 15, 0);

describe('borrador de actividad', () => {
  it('arranca con fecha límite en una semana a las 23:59, en hora local', () => {
    const draft = emptyDraft(NOW);
    expect(draft).toMatchObject({ name: '', due: '2026-10-31', dueTime: '23:59', graded: true });
    const due = dueDateOf(draft);
    expect([due.getDate(), due.getHours(), due.getMinutes()]).toEqual([31, 23, 59]);
  });

  it('usa la hora elegida', () => {
    const due = dueDateOf({ ...emptyDraft(NOW), dueTime: '07:30' });
    expect([due.getHours(), due.getMinutes()]).toEqual([7, 30]);
  });

  it('valida título y fecha futura', () => {
    expect(validateDraft({ ...emptyDraft(NOW), name: 'Ta' }, NOW)).toEqual({
      name: 'Escribe un título de al menos 3 caracteres.',
    });
    expect(validateDraft({ ...emptyDraft(NOW), name: 'Taller', due: '2026-10-24', dueTime: '08:00' }, NOW)).toEqual({
      due: 'La fecha límite debe ser posterior a este momento.',
    });
    expect(validateDraft({ ...emptyDraft(NOW), name: 'Taller', due: '' }, NOW)).toEqual({ due: 'Elige una fecha límite.' });
    expect(validateDraft({ ...emptyDraft(NOW), name: 'Taller de derivadas' }, NOW)).toEqual({});
  });

  it('detecta cambios que se perderían al cerrar', () => {
    const initial = emptyDraft(NOW);
    expect(isDraftDirty({ ...initial, graded: false }, initial)).toBe(false);
    expect(isDraftDirty({ ...initial, name: 'Taller' }, initial)).toBe(true);
  });
});

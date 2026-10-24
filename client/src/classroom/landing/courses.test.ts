import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUBJECT,
  buildClassroomLanding,
  calendarDaysBetween,
  describeReviewScope,
  formatAgo,
  formatDaysIn,
  formatDaysShort,
  formatLastSubmission,
  formatLongDay,
  formatShortDay,
  initialsOf,
  plural,
} from './courses';

// Sábado 24 de octubre de 2026, 15:00 hora local
const NOW = new Date(2026, 9, 24, 15, 0);
const at = (days: number, hour = 12) => new Date(2026, 9, 24 + days, hour, 0);

const snapshot = () => ({
  school: { academicYear: '2026' },
  academicPeriods: [
    { name: 'Periodo 1', status: 'Cerrado', startDate: '2026-01-13T00:00:00Z', endDate: '2026-03-27T23:59:59Z' },
    { name: 'Periodo 2', status: 'Activo', startDate: '2026-04-06T00:00:00Z', endDate: '2026-06-19T23:59:59Z' },
  ],
  courses: [
    { id: 5, name: '11-1', studentsCount: 30, teacherName: 'Juan Diego Loaiza' },
    { id: 6, name: '11-2', studentsCount: 32, teacherName: 'Juan Diego Loaiza' },
  ],
  subjects: [{ name: 'Biología', course: '11-2', teacherName: 'Juan Diego Loaiza' }],
  students: [],
  assignments: [
    { id: 1, title: 'Taller · Funciones cuadráticas', subject: 'Matemáticas', course: '11-2', dueAt: at(4, 23), status: 'Publicado' },
    { id: 2, title: 'Guía de límites', subject: 'Matemáticas', course: '11-2', dueAt: at(9, 23), status: 'Publicado' },
    { id: 3, title: 'Laboratorio de movimiento', subject: 'Física', course: '11-2', dueAt: at(-2, 23), status: 'Vencida' },
    { id: 4, title: 'Borrador sin publicar', subject: 'Matemáticas', course: '11-2', dueAt: at(1), status: 'Borrador' },
  ],
  submissions: [
    { id: 10, assignmentId: 1, studentName: 'Valentina Ríos', submittedAt: at(0, 12), grade: null },
    { id: 11, assignmentId: 1, studentName: 'Carlos Rojas', submittedAt: at(-1, 9), grade: 4.3 },
    { id: 12, assignmentId: 3, studentName: 'Sofía Martínez', submittedAt: at(-3, 18), grade: null },
  ],
});

describe('formato', () => {
  it('formatea fechas cortas y largas en español', () => {
    expect(formatShortDay(new Date(2026, 9, 28))).toBe('Mié 28 oct');
    expect(formatLongDay(new Date(2026, 9, 28))).toBe('Miércoles 28 de octubre');
  });

  it('cuenta días de calendario, no horas', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 24, 23, 0), new Date(2026, 9, 25, 1, 0))).toBe(1);
    expect(formatDaysShort(0)).toBe('Hoy');
    expect(formatDaysShort(1)).toBe('Mañana');
    expect(formatDaysShort(4)).toBe('4 días');
    expect(formatDaysIn(4)).toBe('En 4 días');
  });

  it('describe el tiempo transcurrido', () => {
    expect(formatAgo(new Date(NOW.getTime() - 30_000), NOW)).toBe('hace un momento');
    expect(formatAgo(new Date(NOW.getTime() - 12 * 60_000), NOW)).toBe('hace 12 min');
    expect(formatAgo(at(0, 12), NOW)).toBe('hace 3 h');
    expect(formatAgo(at(-1, 9), NOW)).toBe('ayer');
    expect(formatAgo(at(-3, 9), NOW)).toBe('hace 3 días');
    expect(formatAgo(at(-12, 9), NOW)).toBe('el 12 oct');
    expect(formatLastSubmission(null, NOW)).toBe('Sin actividad reciente');
  });

  it('pluraliza e infiere iniciales', () => {
    expect(plural(1, 'estudiante', 'estudiantes')).toBe('1 estudiante');
    expect(plural(32, 'estudiante', 'estudiantes')).toBe('32 estudiantes');
    expect(initialsOf('Valentina Ríos Gómez')).toBe('VG');
    expect(initialsOf('Ana')).toBe('AN');
  });
});

describe('buildClassroomLanding', () => {
  it('toma el periodo activo y su año', () => {
    const model = buildClassroomLanding(snapshot(), NOW);
    expect(model.academicYear).toBe('2026');
    expect(model.period).toBe('Periodo 2');
  });

  it('sin periodos usa el año del colegio y omite el periodo', () => {
    const model = buildClassroomLanding({ ...snapshot(), academicPeriods: [] }, NOW);
    expect(model.academicYear).toBe('2026');
    expect(model.period).toBeNull();
  });

  it('resume un curso con entregas abiertas', () => {
    const course = buildClassroomLanding(snapshot(), NOW).courses.find((c) => c.group === '11-2')!;
    expect(course).toMatchObject({ id: '6', subject: 'Matemáticas', students: 32, state: 'active', open: 2, toReview: 2 });
    expect(course.next).toMatchObject({ assignmentId: 1, daysLeft: 4, submitted: 2 });
    expect(course.lastSubmissionAt).toEqual(at(0, 12));
  });

  it('marca como vacío un curso sin actividades publicadas', () => {
    const course = buildClassroomLanding(snapshot(), NOW).courses.find((c) => c.group === '11-1')!;
    expect(course).toMatchObject({ state: 'empty', open: 0, toReview: 0, next: null, subject: DEFAULT_SUBJECT, students: 30 });
  });

  it('marca como inactivo un curso con actividades pero ninguna abierta', () => {
    const data = snapshot();
    data.assignments = data.assignments.filter((a) => a.id === 3);
    const course = buildClassroomLanding(data, NOW).courses.find((c) => c.group === '11-2')!;
    expect(course).toMatchObject({ state: 'idle', open: 0, next: null, subject: 'Física' });
  });

  it('usa la asignatura del docente del curso cuando no hay actividades', () => {
    const data = snapshot();
    data.assignments = [];
    const course = buildClassroomLanding(data, NOW).courses.find((c) => c.group === '11-2')!;
    expect(course.subject).toBe('Biología');
  });

  it('prefiere el conteo real de matriculados', () => {
    const data = { ...snapshot(), students: [{ course: '11-2' }, { course: '11-2' }, { course: '10-1' }] };
    const course = buildClassroomLanding(data, NOW).courses.find((c) => c.group === '11-2')!;
    expect(course.students).toBe(2);
  });

  it('lista las entregas sin nota de la más reciente a la más antigua', () => {
    const { pending } = buildClassroomLanding(snapshot(), NOW);
    expect(pending.map((p) => p.studentName)).toEqual(['Valentina Ríos', 'Sofía Martínez']);
    expect(pending[0]).toMatchObject({
      courseId: '6',
      assignmentId: 1,
      initials: 'VR',
      activity: 'Taller · Funciones cuadráticas',
      courseLabel: 'Matemáticas 11-2',
    });
    expect(pending[1].courseLabel).toBe('Física 11-2');
  });

  it('calcula el resumen del periodo', () => {
    const { summary } = buildClassroomLanding(snapshot(), NOW);
    expect(summary).toMatchObject({ courses: 2, students: 62, toReview: 2 });
    expect(summary.next?.assignmentId).toBe(1);
    expect(describeReviewScope(summary)).toBe('en Matemáticas 11-2');
  });

  it('describe pendientes repartidos o inexistentes', () => {
    const data = snapshot();
    data.assignments.push({ id: 5, title: 'Ensayo', subject: 'Filosofía', course: '11-1', dueAt: at(3), status: 'Publicado' });
    data.submissions.push({ id: 13, assignmentId: 5, studentName: 'Ana Pérez', submittedAt: at(0, 8), grade: null });
    expect(describeReviewScope(buildClassroomLanding(data, NOW).summary)).toBe('en 2 cursos');

    data.submissions = [];
    expect(describeReviewScope(buildClassroomLanding(data, NOW).summary)).toBe('Todo al día');
  });

  it('deriva cursos de las actividades cuando no hay cursos', () => {
    const model = buildClassroomLanding({ ...snapshot(), courses: [] }, NOW);
    expect(model.courses.map((c) => c.id)).toEqual(['course-11-2']);
  });

  it('tolera un snapshot vacío', () => {
    const model = buildClassroomLanding(undefined, NOW);
    expect(model.courses).toEqual([]);
    expect(model.summary).toMatchObject({ courses: 0, students: 0, toReview: 0, next: null });
  });
});

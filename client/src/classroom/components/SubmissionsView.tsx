import { useState } from 'react';
import type { Activity, Student } from '../types';
import { Icon } from './SharedUI';

const SUBMISSION_FILTERS = ['Todos', 'Por revisar', 'Entregaron', 'No entregaron', 'Calificados'];

interface SubmissionsViewProps {
  activity: Activity;
  students: Student[];
  filter: string;
  setFilter: (f: string) => void;
  onOpenGrader: (studentIndex: number) => void;
  onBack: () => void;
  onPreview: () => void;
}

export function SubmissionsView({
  activity,
  students,
  filter,
  setFilter,
  onOpenGrader,
  onBack,
  onPreview,
}: SubmissionsViewProps) {
  const [search, setSearch] = useState('');
  const [exported, setExported] = useState(false);

  const delivered = students.filter((s) => s.status !== 'No entregó').length;
  const pending = students.filter((s) => s.status === 'Por revisar').length;
  const missing = students.filter((s) => s.status === 'No entregó').length;
  const graded = students.filter((s) => s.status === 'Calificada').length;

  const counts: Record<string, number> = {
    Todos: students.length,
    'Por revisar': pending,
    Entregaron: delivered,
    'No entregaron': missing,
    Calificados: graded,
  };

  const normalizedSearch = search.trim().toLowerCase();
  const visibleStudents = students.filter((student) => {
    const filterMatch =
      filter === 'Todos' ||
      (filter === 'Por revisar' && student.status === 'Por revisar') ||
      (filter === 'Entregaron' && student.status !== 'No entregó') ||
      (filter === 'No entregaron' && student.status === 'No entregó') ||
      (filter === 'Calificados' && student.status === 'Calificada');

    const searchMatch =
      !normalizedSearch ||
      `${student.name} ${student.group} ${student.file ?? ''}`
        .toLowerCase()
        .includes(normalizedSearch);

    return filterMatch && searchMatch;
  });

  const progress = students.length ? Math.round((delivered / students.length) * 100) : 0;

  const exportList = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Estudiante,Grupo,Estado,Archivo,Calificación']
        .concat(
          students.map(
            (s) =>
              `"${s.name}","${s.group}","${s.status}","${s.file || 'Sin entrega'}","${
                s.score !== undefined ? s.score : ''
              }"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `entregas-${activity.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExported(true);
    window.setTimeout(() => setExported(false), 2400);
  };

  return (
    <section className="view-section submissions-view">
      <button type="button" className="backline" onClick={onBack}>
        <Icon name="back" size={14} /> Actividades con entrega
      </button>

      <div className="detail-heading submission-heading">
        <div className="submission-header-copy">
          <span className="eyebrow">ACTIVIDAD · {activity.status.toUpperCase()}</span>
          <h2>{activity.name}</h2>
          <p>{activity.description}</p>

          <div className="submission-summary">
            <strong>
              {delivered}
              <small>/ {students.length}</small>
              <span>entregaron</span>
            </strong>
            <strong className="review-priority">
              {pending}
              <span>por revisar</span>
            </strong>
            <strong className="missing-count">
              {missing}
              <span>no entregaron</span>
            </strong>
          </div>

          <div className="submission-progress" aria-label={`${progress}% de entregas recibidas`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="submission-progress-meta">
            <span>{progress}% recibido</span>
            <span>{graded} calificadas</span>
          </div>
        </div>

        <div className="submission-header-side">
          <div>
            <small>Fecha límite</small>
            <strong>{activity.dueDate}</strong>
          </div>
          <div>
            <small>Tipo de entrega</small>
            <strong>{activity.type}</strong>
          </div>
          <div>
            <small>Formatos</small>
            <strong>{activity.formats.join(' · ')}</strong>
          </div>
          <div>
            <small>Grade Center</small>
            <strong className={activity.affectsGradeCenter ? 'violet' : 'muted'}>
              {activity.affectsGradeCenter ? `Sí · ${activity.weight ?? '20%'}` : 'No impacta'}
            </strong>
          </div>
        </div>
      </div>

      <div className="submission-tools submission-workspace-tools">
        <div className="submission-search">
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar estudiante, grupo o archivo…"
          />
        </div>

        <div className="submission-filter-pills">
          {SUBMISSION_FILTERS.map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? 'selected' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
              <b>{counts[item]}</b>
            </button>
          ))}
        </div>

        <div className="submission-actions">
          <button
            type="button"
            className="primary-button open-grader-action"
            onClick={() => {
              const firstPending = students.findIndex((s) => s.status === 'Por revisar');
              onOpenGrader(firstPending >= 0 ? firstPending : 0);
            }}
            disabled={!students.length}
          >
            <Icon name="check" size={14} /> Abrir calificador
          </button>

          <button type="button" className="ghost-button export-action" onClick={exportList}>
            <Icon name="download" size={14} /> Exportar
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={onPreview}
            title="Ver cómo experimenta el estudiante la entrega"
          >
            <Icon name="eye" size={14} /> Vista estudiante
          </button>

          {exported && (
            <span className="export-feedback">
              <Icon name="check" size={12} /> CSV descargado
            </span>
          )}
        </div>
      </div>

      <div className="submission-list workspace-submission-list">
        <div className="submission-list-head">
          <span>Entrega digital</span>
          <span>
            {visibleStudents.length} de {students.length} visibles
          </span>
        </div>

        <div className="submission-cards">
          {visibleStudents.map((student) => {
            const originalIndex = students.findIndex((item) => item.id === student.id);
            const statusTone =
              student.status === 'Por revisar'
                ? 'review'
                : student.status === 'Calificada'
                ? 'done'
                : student.status === 'No entregó'
                ? 'absent'
                : 'delivered';

            return (
              <button
                type="button"
                className={`submission-row-card ${
                  student.status === 'Por revisar'
                    ? 'needs-review'
                    : student.status === 'No entregó'
                    ? 'not-submitted'
                    : 'graded'
                }`}
                key={student.id}
                onClick={() => onOpenGrader(originalIndex)}
              >
                <span className="submission-student">
                  <i style={{ background: student.color }}>{student.initials}</i>
                  <span>
                    <strong>{student.name}</strong>
                    <small>
                      {student.group} ·{' '}
                      {student.status === 'No entregó'
                        ? 'Pendiente de entrega'
                        : `entregó ${student.time ?? 'recientemente'}`}
                    </small>
                  </span>
                </span>

                <span className="submission-file">
                  <Icon name={student.file ? 'file' : 'clock'} size={17} />
                  <span>
                    {student.file ? (
                      <>
                        <strong>{student.file}</strong>
                        <small>
                          {student.fileSize} · {student.fileType ?? activity.formats[0]}
                        </small>
                      </>
                    ) : (
                      <>
                        <strong>Sin entrega</strong>
                        <small>La fecha límite sigue pendiente</small>
                      </>
                    )}
                  </span>
                </span>

                <span className={`status-text ${statusTone}`}>
                  <i />
                  {student.status}
                </span>

                <span className="submission-grade">
                  {student.score !== undefined ? (
                    <>
                      <b>{Number(student.score).toFixed(1)}</b>
                      <small>/ 5.0</small>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </span>

                <span className="submission-review-action">
                  Revisar <Icon name="arrow" size={14} />
                </span>
              </button>
            );
          })}
        </div>

        {!visibleStudents.length && (
          <div className="submission-empty">
            <Icon name="search" size={24} />
            <strong>No encontramos entregas</strong>
            <span>Prueba con otro estudiante, grupo o filtro.</span>
          </div>
        )}
      </div>
    </section>
  );
}

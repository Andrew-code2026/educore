import { useEffect, useMemo, useState } from 'react';
import type { Activity, ReviewRecord, RubricCriterion, Student } from '../types';
import { emptyStudent } from '../adapter';
import { Icon, SectionLabel } from './SharedUI';

interface ReviewSplitViewProps {
  activity: Activity;
  students: Student[];
  index: number;
  setIndex: (idx: number | null) => void;
  record: ReviewRecord;
  onRecordChange: (patch: Partial<ReviewRecord>) => void;
  onSaveGrade?: (student: Student, grade: number, comment?: string) => Promise<boolean | void> | boolean | void;
  onBack: () => void;
  isShellFocusMode?: boolean;
  onToggleShellFocus?: (focus: boolean) => void;
}

const QUICK_COMMENTS = [
  'Conecta la evidencia con la conclusión.',
  'Justifica mejor tu conclusión con datos del texto.',
  'Incluye datos concretos del experimento o ejercicio.',
  'Excelente manejo conceptual y fundamentación teórica.',
  'Revisa la presentación, orden y formato del entregable.',
];

export function ReviewSplitView({
  activity,
  students,
  index,
  setIndex,
  record,
  onRecordChange,
  onSaveGrade,
  onBack,
  isShellFocusMode = false,
  onToggleShellFocus,
}: ReviewSplitViewProps) {
  const student = students[index] ?? emptyStudent;

  const [studentQuery, setStudentQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState('Todos');
  const [zoom, setZoom] = useState(87);
  const [page, setPage] = useState(1);
  const [focusMode, setFocusMode] = useState(isShellFocusMode);
  const [mobilePanel, setMobilePanel] = useState<'students' | 'evidence' | 'review'>('evidence');
  const [gradeText, setGradeText] = useState(
    record.score === undefined ? '' : String(record.score)
  );
  const [gradeError, setGradeError] = useState('');
  const [comment, setComment] = useState('');
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [showQuickComments, setShowQuickComments] = useState(false);
  const [syncState, setSyncState] = useState(
    record.status === 'Calificada' ? 'Sincronizado' : 'Sin cambios'
  );

  // Toggle local and optional shell focus mode
  const handleToggleFocus = () => {
    const next = !focusMode;
    setFocusMode(next);
    onToggleShellFocus?.(next);
  };

  const totalCriteriaEarned = record.criteria.reduce((sum, item) => sum + (item.score || 0), 0);
  const maxCriteria = record.criteria.reduce((sum, item) => sum + (item.max || 1), 0);
  const rubricScore = Number(((totalCriteriaEarned / (maxCriteria || 1)) * 5).toFixed(1));

  const pendingIndexes = useMemo(
    () =>
      students
        .map((item, itemIndex) => (item.status === 'Por revisar' ? itemIndex : -1))
        .filter((itemIndex) => itemIndex >= 0),
    [students]
  );
  const pendingPosition = pendingIndexes.indexOf(index);

  const filteredStudents = useMemo(() => {
    return students.filter((item) => {
      const filterMatch =
        studentFilter === 'Todos' ||
        (studentFilter === 'Pendientes' && item.status === 'Por revisar') ||
        (studentFilter === 'Calificados' && item.status === 'Calificada') ||
        (studentFilter === 'No entregaron' && item.status === 'No entregó');
      const queryMatch =
        !studentQuery.trim() ||
        `${item.name} ${item.group} ${item.file ?? ''}`
          .toLowerCase()
          .includes(studentQuery.trim().toLowerCase());
      return filterMatch && queryMatch;
    });
  }, [students, studentFilter, studentQuery]);

  const getNextPendingIndex = (direction: 1 | -1 = 1) => {
    if (!pendingIndexes.length) return index;
    const current = pendingIndexes.indexOf(index);
    if (current < 0) {
      return direction === 1 ? pendingIndexes[0] : pendingIndexes[pendingIndexes.length - 1];
    }
    const target = pendingIndexes[current + direction];
    return target !== undefined ? target : index;
  };

  const markChanged = (patch: Partial<ReviewRecord>) => {
    onRecordChange({ ...patch, status: 'Por revisar' });
    setSyncState('Cambios sin guardar');
  };

  const updateCriterionScore = (criterionIndex: number, value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const nextCriteria = record.criteria.map((item, idx) =>
      idx === criterionIndex
        ? { ...item, score: Math.max(0, Math.min(item.max, parsed)), expanded: true }
        : item
    );
    const nextTotal = nextCriteria.reduce((sum, item) => sum + item.score, 0);
    const nextCalculatedScore = Number(((nextTotal / (maxCriteria || 1)) * 5).toFixed(1));

    onRecordChange({
      criteria: nextCriteria,
      score: nextCalculatedScore,
      scoreMode: 'rubric',
      evaluationMode: 'rubric',
      status: 'Por revisar',
    });
    setGradeText(String(nextCalculatedScore));
    setGradeError('');
    setSyncState('Cambios sin guardar');
  };

  const changeGrade = (value: string) => {
    setGradeText(value);
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed < 0 || parsed > 5) {
      setGradeError('Usa un valor entre 0.0 y 5.0');
      setSyncState('Cambios sin guardar');
      return;
    }
    setGradeError('');
    markChanged({ score: parsed, scoreMode: 'manual' });
  };

  const setEvaluationMode = (mode: 'rubric' | 'direct') => {
    if (mode === 'rubric') {
      const nextScore = totalCriteriaEarned > 0 ? rubricScore : undefined;
      onRecordChange({
        evaluationMode: 'rubric',
        scoreMode: 'rubric',
        score: nextScore,
        status: 'Por revisar',
      });
      setGradeText(nextScore === undefined ? '' : String(nextScore));
    } else {
      onRecordChange({ evaluationMode: 'direct', scoreMode: 'manual', status: 'Por revisar' });
    }
    setGradeError('');
    setSyncState('Cambios sin guardar');
  };

  const saveReview = async () => {
    if (!student.file && student.status === 'No entregó') {
      setGradeError('No hay evidencia digital registrada para calificar.');
      return false;
    }
    const parsed = Number(gradeText);
    if (record.evaluationMode === 'rubric' && totalCriteriaEarned === 0) {
      setGradeError('Evalúa al menos un criterio de la rúbrica antes de guardar.');
      return false;
    }
    if (
      record.evaluationMode === 'direct' &&
      (!gradeText || Number.isNaN(parsed) || parsed < 0 || parsed > 5)
    ) {
      setGradeError('Asigna una calificación válida entre 0.0 y 5.0.');
      return false;
    }
    const finalScore = record.evaluationMode === 'rubric' ? rubricScore : parsed;

    onRecordChange({
      score: finalScore,
      scoreMode: record.evaluationMode === 'rubric' ? 'rubric' : 'manual',
      status: 'Calificada',
    });
    setGradeText(String(finalScore));
    setGradeError('');
    setSyncState('Guardado · Sincronizado');

    if (onSaveGrade) {
      await onSaveGrade(student, finalScore, record.comments[record.comments.length - 1]);
    }
    return true;
  };

  const saveAndNext = async () => {
    const saved = await saveReview();
    if (!saved) return;
    const next = getNextPendingIndex(1);
    if (next === index) {
      setSyncState('Guardado · Todo revisado');
      return;
    }
    setIndex(next);
  };

  const publishComment = () => {
    const text = comment.trim();
    if (!text) return;
    onRecordChange({ comments: [...record.comments, text], status: record.status });
    setComment('');
    setShowCommentComposer(false);
    setShowQuickComments(false);
    setSyncState('Cambios sin guardar');
  };

  const chooseQuickComment = (text: string) => {
    setComment((current) => (current ? `${current} ${text}` : text));
    setShowCommentComposer(true);
    setShowQuickComments(false);
  };

  useEffect(() => {
    setGradeText(record.score === undefined ? '' : String(record.score));
    setGradeError('');
    setSyncState(record.status === 'Calificada' ? 'Sincronizado' : 'Sin cambios');
    setZoom(87);
    setPage(1);
    setComment('');
    setShowCommentComposer(false);
    setShowQuickComments(false);
  }, [student.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveReview();
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex(getNextPendingIndex(1));
      }
      if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex(getNextPendingIndex(-1));
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        saveAndNext();
      }
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        setIndex(getNextPendingIndex(-1));
      }
      if (event.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, gradeText, record, gradeError, students, pendingIndexes]);

  const scorePct = Math.max(0, Math.min(100, ((record.score ?? 0) / 5) * 100));

  return (
    <section
      className={`review-view ${focusMode ? 'review-classroom-focus' : ''}`}
      data-panel={mobilePanel}
    >
      <div className="review-toolbar">
        <button type="button" className="backline" onClick={onBack}>
          <Icon name="back" size={14} /> Entregas
        </button>

        <button
          type="button"
          className={`focus-toggle classroom-focus-button ${focusMode ? 'active' : ''}`}
          onClick={handleToggleFocus}
          aria-label={focusMode ? 'Cerrar enfoque del classroom' : 'Expandir classroom'}
        >
          <Icon name="expand" size={14} /> {focusMode ? 'Cerrar enfoque' : 'Expandir classroom'}
        </button>

        <span className="key-hint">
          <kbd>J</kbd>/<kbd>K</kbd> navegar · <kbd>Ctrl/Cmd S</kbd> guardar · <kbd>Enter</kbd> siguiente
        </span>
      </div>

      <div className="review-context-bar">
        <div className="context-identity">
          <i className="context-avatar" style={{ background: student.color }}>
            {student.initials}
          </i>
          <div>
            <strong>
              {student.name} · {student.group}
            </strong>
            <span>{activity.name}</span>
            <small
              className={`context-status ${
                student.status === 'Por revisar'
                  ? 'needs'
                  : student.status === 'Calificada'
                  ? 'done'
                  : 'missing'
              }`}
            >
              <i />
              {student.status === 'No entregó'
                ? 'No entregó'
                : `${student.status} · ${student.time ?? 'entrega registrada'}`}
            </small>
          </div>
        </div>

        <div className="review-context-progress">
          <b>
            {pendingPosition >= 0 ? pendingPosition + 1 : '—'}{' '}
            <small>de {pendingIndexes.length} pendientes</small>
          </b>
          <button
            type="button"
            onClick={() => setIndex(getNextPendingIndex(-1))}
            disabled={!pendingIndexes.length}
          >
            <Icon name="chevron" size={14} /> Anterior
          </button>
          <button
            type="button"
            onClick={() => setIndex(getNextPendingIndex(1))}
            disabled={!pendingIndexes.length}
          >
            Siguiente <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>

      <nav className="review-mobile-tabs" aria-label="Panel del calificador">
        <button
          type="button"
          className={mobilePanel === 'students' ? 'active' : ''}
          onClick={() => setMobilePanel('students')}
        >
          <Icon name="users" size={15} /> Estudiantes · {students.length}
        </button>
        <button
          type="button"
          className={mobilePanel === 'evidence' ? 'active' : ''}
          onClick={() => setMobilePanel('evidence')}
        >
          <Icon name="file" size={15} /> Evidencia
        </button>
        <button
          type="button"
          className={mobilePanel === 'review' ? 'active' : ''}
          onClick={() => setMobilePanel('review')}
        >
          <Icon name="check" size={15} /> Revisión ·{' '}
          {record.score === undefined ? '—' : Number(record.score).toFixed(1)}
        </button>
      </nav>

      <div className="review-grid">
        {/* Panel 1: Estudiantes */}
        <aside className="review-students glass-card">
          <div className="panel-heading">
            <div>
              <strong>Estudiantes</strong>
              <span>
                {students.filter((s) => s.status !== 'No entregó').length} con entrega ·{' '}
                {pendingIndexes.length} pendientes
              </span>
            </div>
          </div>

          <div className="grader-search">
            <Icon name="search" size={14} />
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Buscar estudiante, grupo…"
            />
          </div>

          <div className="grader-filters">
            {['Todos', 'Pendientes', 'Calificados', 'No entregaron'].map((item) => (
              <button
                type="button"
                key={item}
                className={studentFilter === item ? 'active' : ''}
                onClick={() => setStudentFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="student-scroll">
            {filteredStudents.map((item) => {
              const itemIndex = students.findIndex((entry) => entry.id === item.id);
              const isSelected = itemIndex === index;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`grader-student ${isSelected ? 'active' : ''} ${
                    item.status === 'Por revisar'
                      ? 'student-needs-review'
                      : item.status === 'No entregó'
                      ? 'student-missing'
                      : 'student-graded'
                  }`}
                  onClick={() => {
                    setIndex(itemIndex);
                    setMobilePanel('evidence');
                  }}
                >
                  <i style={{ background: item.color }}>{item.initials}</i>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.group} ·{' '}
                      {item.status === 'No entregó'
                        ? 'Sin entrega'
                        : item.file ?? 'Entrega recibida'}
                    </small>
                  </span>
                  <em>
                    {item.status === 'Por revisar'
                      ? 'Pendiente'
                      : item.status === 'No entregó'
                      ? 'No entregó'
                      : item.score !== undefined
                      ? Number(item.score).toFixed(1)
                      : 'Lista'}
                  </em>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Panel 2: Visor de Evidencia */}
        <main className="file-viewer glass-card">
          <div className="viewer-top">
            <div>
              <span className="file-icon">
                <Icon name={student.file ? 'file' : 'clock'} size={17} />
              </span>
              <span>
                <strong>{student.file ?? 'Sin entrega recibida'}</strong>
                <small>
                  {student.file
                    ? `${student.fileType ?? activity.formats[0]} · ${
                        student.fileSize ?? '2.4 MB'
                      } · ${student.time ?? 'Entrega registrada'}`
                    : 'Este estudiante no registra un archivo cargado.'}
                </small>
              </span>
            </div>
            <div className="viewer-actions" aria-label="Herramientas de evidencia">
              <span className="viewer-mode-label">Evidencia vinculada</span>
            </div>
          </div>

          <div className={`document-canvas ${student.file ? '' : 'empty-evidence'}`}>
            <div
              className="document-sheet"
              style={{ transform: `rotate(-0.8deg) scale(${zoom / 87})` }}
            >
              {student.file ? (
                <>
                  <div className="doc-brand">
                    <span>{student.group || 'CURSO 11-2'}</span>
                    <span>{activity.subject || 'ASIGNATURA INSTITUCIONAL'}</span>
                  </div>
                  <div className="doc-line short" />
                  <h2>{activity.name}</h2>
                  <p className="doc-lead">
                    Vista previa de la evidencia enviada por <b>{student.name}</b>. Los contenidos
                    y archivos adjuntos quedan respaldados en el servidor institucional.
                  </p>
                  <div className="doc-placeholder">
                    <Icon name="file" size={28} />
                    <strong>{student.file}</strong>
                    <small>
                      Visor digital de evidencias · página {page} de 3
                    </small>
                  </div>
                  <div className="doc-highlight">
                    La evidencia digital queda vinculada a las instrucciones pedagógicas y a la
                    revisión docente en EduCore Main.
                  </div>
                </>
              ) : (
                <div className="evidence-empty-content">
                  <Icon name="clock" size={34} />
                  <strong>No entregó esta actividad</strong>
                  <span>No hay evidencia digital disponible para calificar.</span>
                  <small>La fecha límite establecida es {activity.dueDate}.</small>
                </div>
              )}
            </div>

            <div className="viewer-zoom">
              <button
                type="button"
                onClick={() => setZoom(Math.max(60, zoom - 10))}
                aria-label="Reducir zoom"
              >
                −
              </button>
              <span>{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom(Math.min(130, zoom + 10))}
                aria-label="Aumentar zoom"
              >
                +
              </button>
            </div>
          </div>

          <div className="viewer-footer">
            <span>
              <i className="online-dot" /> Visor de evidencia
            </span>
            <span>
              {student.file ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>{' '}
                  Página {page} de 3{' '}
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(3, page + 1))}
                    disabled={page === 3}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                </>
              ) : (
                'Sin páginas disponibles'
              )}
            </span>
          </div>
        </main>

        {/* Panel 3: Revisión y Calificación */}
        <aside className="review-panel glass-card">
          <div className="score-header">
            <div>
              <strong>Revisión</strong>
              <span>{activity.name}</span>
            </div>
            <span
              className={`score-state ${activity.affectsGradeCenter ? 'grade-linked' : ''}`}
            >
              {activity.affectsGradeCenter
                ? `Grade Center · ${activity.weight ?? '20%'}`
                : 'Solo ClassCORE'}
            </span>
          </div>

          <div className="evaluation-mode">
            <span>Método de evaluación</span>
            <div>
              <button
                type="button"
                className={record.evaluationMode === 'rubric' ? 'active' : ''}
                onClick={() => setEvaluationMode('rubric')}
                disabled={!student.file}
              >
                Rúbrica
              </button>
              <button
                type="button"
                className={record.evaluationMode === 'direct' ? 'active' : ''}
                onClick={() => setEvaluationMode('direct')}
                disabled={!student.file}
              >
                Nota directa
              </button>
            </div>
          </div>

          <div className="score-input-wrap">
            <input
              aria-label="Calificación de 0.0 a 5.0"
              value={gradeText}
              disabled={!student.file || record.evaluationMode === 'rubric'}
              onChange={(e) => changeGrade(e.target.value)}
              placeholder="—"
            />
            <span>/ 5.0</span>
          </div>

          {gradeError && (
            <div className="grade-error">
              <Icon name="alert" size={13} /> {gradeError}
            </div>
          )}

          <div className="score-bar">
            <span style={{ width: `${scorePct}%` }} />
          </div>

          <div className="score-meta">
            <span>
              {record.evaluationMode === 'rubric'
                ? 'Nota calculada por criterios de rúbrica'
                : 'Nota directa · rúbrica no aplicada'}
            </span>
            <small>
              {record.evaluationMode === 'rubric'
                ? 'Edita los puntos de cada criterio para actualizar la nota.'
                : 'La nota se registra directamente sin ponderar criterios.'}
            </small>
          </div>

          {record.evaluationMode === 'rubric' ? (
            <>
              <div className="rubric-heading">
                <SectionLabel
                  action={
                    <span className="tiny-label">
                      {totalCriteriaEarned}/{maxCriteria}
                    </span>
                  }
                >
                  Rúbrica
                </SectionLabel>
              </div>

              <div className="rubric-list">
                {record.criteria.map((criterion, i) => (
                  <div
                    className={`rubric-item ${criterion.expanded ? 'expanded' : ''}`}
                    key={criterion.id}
                  >
                    <button
                      type="button"
                      className="rubric-trigger"
                      disabled={!student.file}
                      onClick={() =>
                        onRecordChange({
                          criteria: record.criteria.map((item, idx) =>
                            idx === i ? { ...item, expanded: !item.expanded } : item
                          ),
                        })
                      }
                    >
                      <span>
                        <i className="rubric-dot" />
                        {criterion.title}
                      </span>
                      <b>
                        {criterion.score}/{criterion.max}
                        <Icon name={criterion.expanded ? 'down' : 'chevron'} size={12} />
                      </b>
                    </button>

                    {criterion.expanded && (
                      <div className="rubric-detail">
                        <p>{criterion.description}</p>
                        <label>
                          <span>Puntos obtenidos</span>
                          <input
                            type="number"
                            min={0}
                            max={criterion.max}
                            step={1}
                            value={criterion.score}
                            disabled={!student.file}
                            aria-label={`Puntos de ${criterion.title}`}
                            onChange={(e) => updateCriterionScore(i, e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    <div className="rubric-progress">
                      <span
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, (criterion.score / (criterion.max || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rubric-disabled-note">
              <span>
                <Icon name="layers" size={15} />
                <strong>Rúbrica no aplicada</strong>
                <small>La evaluación se realizará mediante nota directa.</small>
              </span>
              <button
                type="button"
                onClick={() => setEvaluationMode('rubric')}
                disabled={!student.file}
              >
                Integrar rúbrica
              </button>
            </div>
          )}

          {/* Sección de Comentarios */}
          <div className="comment-section comment-only">
            <div className="comment-section-head">
              <strong>
                <Icon name="message" size={15} /> Comentarios
              </strong>
              <span>{record.comments.length}</span>
              <button
                type="button"
                className="comment-add-toggle"
                disabled={!student.file}
                onClick={() => setShowCommentComposer((open) => !open)}
              >
                {showCommentComposer ? 'Cerrar editor' : 'Agregar comentario'}{' '}
                <Icon name={showCommentComposer ? 'close' : 'plus'} size={13} />
              </button>
            </div>

            {showCommentComposer && (
              <div className="comment-composer-shell">
                <p className="comment-helper">
                  Agrega una observación breve para dejar contexto de la revisión.
                </p>

                <div className="quick-comments-toggle-row">
                  <span>¿Necesitas una sugerencia rápida?</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickComments((open) => !open)}
                  >
                    <Icon name="layers" size={13} />{' '}
                    {showQuickComments ? 'Ocultar sugerencias' : 'Ver sugerencias'}{' '}
                    <Icon name={showQuickComments ? 'down' : 'chevron'} size={11} />
                  </button>
                </div>

                {showQuickComments && (
                  <div className="quick-comments">
                    <span>Selecciona una opción para insertarla</span>
                    <div>
                      {QUICK_COMMENTS.map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => chooseQuickComment(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="comment-compose">
                  <textarea
                    value={comment}
                    disabled={!student.file}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escribe una retroalimentación para el estudiante…"
                  />
                  <button
                    type="button"
                    aria-label="Agregar comentario"
                    disabled={!comment.trim() || !student.file}
                    onClick={publishComment}
                  >
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="comment-list">
              {record.comments.length ? (
                record.comments.map((item, commentIndex) => (
                  <div className="comment-item new-comment" key={`${item}-${commentIndex}`}>
                    <i>DC</i>
                    <div>
                      <strong>
                        Docente <small>Ahora</small>
                      </strong>
                      <p>{item}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="comment-empty">
                  <Icon name="message" size={16} />
                  <span>Aún no hay comentarios. Agrega una observación para dejar contexto.</span>
                </div>
              )}
            </div>
          </div>

          <div className="panel-footer">
            <span
              className={`saved ${
                syncState.includes('Sincronizado') || syncState.includes('Todo revisado')
                  ? 'is-synced'
                  : syncState.includes('Cambios')
                  ? 'is-dirty'
                  : ''
              }`}
            >
              <Icon
                name={
                  syncState.includes('Sincronizado') || syncState.includes('Todo revisado')
                    ? 'check'
                    : syncState.includes('Cambios')
                    ? 'alert'
                    : 'clock'
                }
                size={13}
              />{' '}
              {syncState}
            </span>

            <button
              type="button"
              className="primary-button"
              onClick={saveAndNext}
              disabled={!student.file || !!gradeError}
            >
              Guardar y siguiente <Icon name="arrow" size={14} />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

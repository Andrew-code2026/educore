import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, ReviewRecord, RubricCriterion, Student } from '../types';
import { Icon, SectionLabel } from './SharedUI';

export interface ReviewSplitViewProps {
  activity: Activity;
  students: Student[];
  index: number;
  setIndex: (value: number | null) => void;
  record: ReviewRecord;
  onRecordChange: (patch: Partial<ReviewRecord>) => void;
  /** Persistencia real con el backend de EduCore */
  onSaveGrade?: (student: Student, grade: number, comment: string) => Promise<boolean>;
  onBack: () => void;
  isShellFocusMode?: boolean;
  onToggleShellFocus?: (focus: boolean) => void;
}

export function ReviewSplitView({
  activity,
  students,
  index,
  setIndex,
  record,
  onRecordChange,
  onSaveGrade,
  onBack,
  isShellFocusMode,
  onToggleShellFocus,
}: ReviewSplitViewProps) {
  const student = students[index] ?? {
    id: '',
    name: 'Estudiante',
    initials: '--',
    group: '',
    status: 'No entregó' as const,
    color: '#567083',
  };

  const [studentQuery, setStudentQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<'Todos' | 'Pendientes' | 'Calificados' | 'No entregaron'>('Todos');
  const [zoom, setZoom] = useState(87);
  const [page, setPage] = useState(1);
  const [focusMode, setFocusMode] = useState(Boolean(isShellFocusMode));
  const [mobilePanel, setMobilePanel] = useState<'students' | 'evidence' | 'review'>('evidence');
  const [gradeText, setGradeText] = useState(record.score === undefined ? '' : String(record.score));
  const [gradeError, setGradeError] = useState('');
  const [comment, setComment] = useState('');
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [showQuickComments, setShowQuickComments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncState, setSyncState] = useState(record.status === 'Calificada' ? 'Sincronizado' : 'Sin cambios');

  const quickComments = [
    'Conecta la evidencia con la conclusión.',
    'Justifica mejor tu conclusión.',
    'Incluye datos concretos del experimento.',
    'Revisa la presentación y el orden de la evidencia.',
  ];

  // Cálculo de rúbrica
  const total = (record.criteria || []).reduce((sum, item) => sum + item.score, 0);
  const max = (record.criteria || []).reduce((sum, item) => sum + item.max, 0);
  const rubricScore = max > 0 ? Number(((total / max) * 5).toFixed(1)) : 0;

  // Índices de estudiantes pendientes
  const pendingIndexes = useMemo(
    () =>
      students
        .map((item, itemIndex) => (item.status === 'Por revisar' ? itemIndex : -1))
        .filter((itemIndex) => itemIndex >= 0),
    [students]
  );
  const pendingPosition = pendingIndexes.indexOf(index);

  // Lista filtrada de estudiantes para el panel izquierdo
  const filteredStudents = useMemo(() => {
    return students.filter((item) => {
      const filterMatch =
        studentFilter === 'Todos' ||
        (studentFilter === 'Pendientes' && item.status === 'Por revisar') ||
        (studentFilter === 'Calificados' && item.status === 'Calificada') ||
        (studentFilter === 'No entregaron' && item.status === 'No entregó');
      const queryMatch =
        !studentQuery.trim() ||
        `${item.name} ${item.group} ${item.file ?? ''}`.toLowerCase().includes(studentQuery.trim().toLowerCase());
      return filterMatch && queryMatch;
    });
  }, [students, studentFilter, studentQuery]);

  // Siguiente / anterior pendiente
  const nextPending = (direction: 1 | -1 = 1) => {
    if (!pendingIndexes.length) return index;
    const current = pendingIndexes.indexOf(index);
    if (current < 0) {
      return direction === 1 ? pendingIndexes[0] : pendingIndexes[pendingIndexes.length - 1];
    }
    const target = current + direction;
    if (target < 0) return pendingIndexes[pendingIndexes.length - 1];
    if (target >= pendingIndexes.length) return pendingIndexes[0];
    return pendingIndexes[target];
  };

  // Buscar el siguiente pendiente después de guardar la entrega actual
  const getNextPendingAfterSave = () => {
    const otherPending = students
      .map((item, i) => (item.status === 'Por revisar' && i !== index ? i : -1))
      .filter((i) => i >= 0);
    if (!otherPending.length) return null;
    const after = otherPending.find((i) => i > index);
    return after !== undefined ? after : otherPending[0];
  };

  const markChanged = (patch: Partial<ReviewRecord>) => {
    onRecordChange({ ...patch, status: 'Por revisar' });
    setSyncState('Cambios sin guardar');
  };

  const updateCriterionScore = (criterionIndex: number, value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const nextCriteria = (record.criteria || []).map((item, idx) =>
      idx === criterionIndex ? { ...item, score: Math.max(0, Math.min(item.max, parsed)), expanded: true } : item
    );
    const nextTotal = nextCriteria.reduce((sum, item) => sum + item.score, 0);
    const nextCalculatedScore = max > 0 ? Number(((nextTotal / max) * 5).toFixed(1)) : 0;
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
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    if (!value.trim() || Number.isNaN(parsed) || parsed < 0 || parsed > 5) {
      setGradeError('Usa un valor entre 0.0 y 5.0');
      setSyncState('Cambios sin guardar');
      return;
    }
    setGradeError('');
    markChanged({ score: parsed, scoreMode: 'manual' });
  };

  const setEvaluationMode = (mode: 'rubric' | 'direct') => {
    if (mode === 'rubric') {
      const nextScore = total > 0 ? rubricScore : undefined;
      onRecordChange({ evaluationMode: 'rubric', scoreMode: 'rubric', score: nextScore, status: 'Por revisar' });
      setGradeText(nextScore === undefined ? '' : String(nextScore));
    } else {
      onRecordChange({ evaluationMode: 'direct', scoreMode: 'manual', status: 'Por revisar' });
    }
    setGradeError('');
    setSyncState('Cambios sin guardar');
  };

  const saveReview = async (): Promise<boolean> => {
    if (!student.file && student.status === 'No entregó') {
      setGradeError('No hay evidencia digital para calificar.');
      return false;
    }
    const normalized = gradeText.trim().replace(',', '.');
    const parsed = Number(normalized);
    if (record.evaluationMode === 'rubric' && total === 0) {
      setGradeError('Evalúa al menos un criterio de la rúbrica antes de continuar.');
      return false;
    }
    if (
      record.evaluationMode === 'direct' &&
      (!gradeText.trim() || Number.isNaN(parsed) || parsed < 0 || parsed > 5)
    ) {
      setGradeError('Asigna una calificación entre 0.0 y 5.0 antes de continuar.');
      return false;
    }
    const finalScore = record.evaluationMode === 'rubric' ? rubricScore : parsed;

    setIsSaving(true);
    setSyncState('Guardando…');

    const allComments = record.comments || [];
    const feedbackText = allComments.join('\n\n') || record.feedback || '';

    let ok = true;
    if (onSaveGrade) {
      ok = await onSaveGrade(student, finalScore, feedbackText);
    }

    setIsSaving(false);

    if (ok) {
      onRecordChange({
        score: finalScore,
        scoreMode: record.evaluationMode === 'rubric' ? 'rubric' : 'manual',
        status: 'Calificada',
        feedback: feedbackText,
      });
      setGradeText(String(finalScore));
      setGradeError('');
      setSyncState('Guardado · Sincronizado');
      return true;
    } else {
      setSyncState('Error al sincronizar');
      setGradeError('No se pudo guardar la nota en el servidor. Intenta de nuevo.');
      return false;
    }
  };

  const saveAndNext = async () => {
    if (isSaving) return;
    const ok = await saveReview();
    if (!ok) return;
    const next = getNextPendingAfterSave();
    if (next === null || next === index) {
      setSyncState('Guardado · todo revisado');
      return;
    }
    setIndex(next);
  };

  const publishComment = () => {
    const text = comment.trim();
    if (!text) return;
    const nextComments = [...(record.comments || []), text];
    onRecordChange({
      comments: nextComments,
      feedback: nextComments.join('\n\n'),
      status: record.status,
    });
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

  const handleToggleFocus = () => {
    const nextFocus = !focusMode;
    setFocusMode(nextFocus);
    onToggleShellFocus?.(nextFocus);
  };

  // Revertir el enfoque de shell al desmontar
  const toggleShellFocusRef = useRef(onToggleShellFocus);
  toggleShellFocusRef.current = onToggleShellFocus;
  useEffect(() => () => toggleShellFocusRef.current?.(false), []);

  // Reiniciar estado local al cambiar de estudiante
  useEffect(() => {
    setGradeText(record.score === undefined ? '' : String(record.score));
    setGradeError('');
    setSyncState(record.status === 'Calificada' ? 'Sincronizado' : 'Sin cambios');
    setZoom(87);
    setPage(1);
    setComment('');
    setShowCommentComposer(false);
    setShowQuickComments(false);
  }, [student.id, record.score, record.status]);

  // Atajos de teclado
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + S guarda en cualquier momento
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveReview();
        return;
      }

      // No interceptar J/K si el usuario está escribiendo
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        if (event.key === 'Enter' && !event.shiftKey && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void saveAndNext();
        }
        return;
      }

      if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex(nextPending(1));
      } else if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex(nextPending(-1));
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void saveAndNext();
      } else if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        setIndex(nextPending(-1));
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, gradeText, record, gradeError, students, pendingIndexes, isSaving]);

  const deliveredCount = students.filter((s) => s.status !== 'No entregó').length;

  return (
    <section
      className={`review-view ${focusMode ? 'review-classroom-focus' : ''}`}
      data-panel={mobilePanel}
      aria-label="Calificador de entregas"
    >
      {/* ── Toolbar Superior ────────────────────────────────────── */}
      <div className="review-toolbar">
        <button type="button" className="backline" onClick={onBack}>
          <Icon name="chevron" size={14} /> Entregas
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

      {/* ── Barra de Contexto del Estudiante ────────────────────── */}
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
                student.status === 'Por revisar' ? 'needs' : student.status === 'Calificada' ? 'done' : 'missing'
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
            onClick={() => setIndex(nextPending(-1))}
            disabled={!pendingIndexes.length}
            aria-label="Pendiente anterior"
          >
            <Icon name="chevron" size={14} /> Anterior
          </button>
          <button
            type="button"
            onClick={() => setIndex(nextPending(1))}
            disabled={!pendingIndexes.length}
            aria-label="Siguiente pendiente"
          >
            Siguiente <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>

      {/* ── Pestañas Mobile / Tablet ────────────────────────────── */}
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

      {/* ── Grid Principal de 3 Zonas ───────────────────────────── */}
      <div className="review-grid">
        {/* ── Zona 1: Lista de Estudiantes ──────────────────────── */}
        <aside className="review-students glass-card" aria-label="Lista de estudiantes">
          <div className="panel-heading">
            <div>
              <strong>Estudiantes</strong>
              <span>
                {deliveredCount} con entrega · {pendingIndexes.length} pendientes
              </span>
            </div>
          </div>

          <div className="grader-search">
            <Icon name="search" size={14} />
            <input
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Buscar estudiante, grupo…"
              aria-label="Buscar estudiante o grupo"
            />
          </div>

          <div className="grader-filters" role="group" aria-label="Filtrar estudiantes">
            {(['Todos', 'Pendientes', 'Calificados', 'No entregaron'] as const).map((item) => (
              <button
                key={item}
                type="button"
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
                  key={item.id}
                  type="button"
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
                      {item.group} · {item.status === 'No entregó' ? 'Sin entrega' : item.file ?? 'Entrega recibida'}
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

        {/* ── Zona 2: Visor de Evidencia ────────────────────────── */}
        <main className="file-viewer glass-card" aria-label="Evidencia entregada">
          <div className="viewer-top">
            <div>
              <span className="file-icon">
                <Icon name={student.file ? 'file' : 'clock'} size={17} />
              </span>
              <span>
                <strong>{student.file ?? 'Sin entrega recibida'}</strong>
                <small>
                  {student.file
                    ? `${student.fileType ?? (activity.formats?.[0] || 'PDF')} · ${
                        student.fileSize ?? '2.4 MB'
                      } · ${student.time ?? 'Entrega registrada'}`
                    : 'Este estudiante no registra un archivo'}
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
              style={{ transform: `rotate(-.8deg) scale(${zoom / 87})` }}
            >
              {student.file ? (
                <>
                  <div className="doc-brand">
                    <span>{activity.course ?? 'CURSO'}</span>
                    <span>{activity.subject ?? 'ASIGNATURA'}</span>
                  </div>
                  <div className="doc-line short" />
                  <h2>{activity.name}</h2>
                  <p className="doc-lead">
                    Vista previa del archivo enviado por {student.name}. El contenido se mostrará aquí según el formato recibido.
                  </p>
                  {student.comment && (
                    <div className="doc-highlight" style={{ margin: '12px 0', borderLeftColor: 'var(--cyan)' }}>
                      <strong>Nota del estudiante:</strong> {student.comment}
                    </div>
                  )}
                  <div className="doc-placeholder">
                    <Icon name="file" size={28} />
                    <strong>{student.file}</strong>
                    <small>Visor conceptual · página {page} de 3</small>
                  </div>
                  <div className="doc-highlight">
                    La evidencia digital queda vinculada a las instrucciones y a la revisión docente.
                  </div>
                </>
              ) : (
                <div className="evidence-empty-content">
                  <Icon name="clock" size={34} />
                  <strong>No entregó esta actividad</strong>
                  <span>No hay evidencia digital para revisar.</span>
                  <small>La fecha límite es {activity.dueDate || 'la indicada en el curso'}.</small>
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

        {/* ── Zona 3: Panel de Revisión y Calificación ──────────── */}
        <aside className="review-panel glass-card" aria-label="Panel de calificación">
          <div className="score-header">
            <div>
              <strong>Revisión</strong>
              <span>{activity.name}</span>
            </div>
            <span className={`score-state ${activity.affectsGradeCenter ? 'grade-linked' : ''}`}>
              {activity.affectsGradeCenter ? `Grade Center · ${activity.weight ?? '20%'}` : 'Solo ClassCORE'}
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
              onChange={(event) => changeGrade(event.target.value)}
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
            <span
              style={{
                width: `${Math.max(0, Math.min(100, ((record.score ?? 0) / 5) * 100))}%`,
              }}
            />
          </div>

          <div className="score-meta">
            <span>
              {record.evaluationMode === 'rubric'
                ? 'Nota calculada por criterios'
                : 'Nota directa · rúbrica no aplicada'}
            </span>
            <small>
              {record.evaluationMode === 'rubric'
                ? 'Edita los puntos de cada criterio para actualizar la nota.'
                : 'La nota se registra sin utilizar la rúbrica.'}
            </small>
          </div>

          {record.evaluationMode === 'rubric' ? (
            <>
              <div className="rubric-heading">
                <SectionLabel action={<span className="tiny-label">{total}/{max}</span>}>
                  Rúbrica
                </SectionLabel>
              </div>
              <div className="rubric-list">
                {(record.criteria || []).map((criterion, i) => (
                  <div className={`rubric-item ${criterion.expanded ? 'expanded' : ''}`} key={criterion.id}>
                    <button
                      type="button"
                      className="rubric-trigger"
                      disabled={!student.file}
                      onClick={() =>
                        onRecordChange({
                          criteria: (record.criteria || []).map((item, idx) =>
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
                            onChange={(event) => updateCriterionScore(i, event.target.value)}
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
                <small>La evaluación se realizará con una nota directa.</small>
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

          {/* ── Sección de Comentarios ────────────────────────────── */}
          <div className="comment-section comment-only">
            <div className="comment-section-head">
              <strong>
                <Icon name="message" size={15} /> Comentarios
              </strong>
              <span>{record.comments?.length ?? 0}</span>
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
                  <span>¿Necesitas una frase?</span>
                  <button type="button" onClick={() => setShowQuickComments((open) => !open)}>
                    <Icon name="layers" size={13} />{' '}
                    {showQuickComments ? 'Ocultar comentarios rápidos' : 'Ver comentarios rápidos'}{' '}
                    <Icon name={showQuickComments ? 'down' : 'chevron'} size={11} />
                  </button>
                </div>
                {showQuickComments && (
                  <div className="quick-comments">
                    <span>Selecciona una opción para editarla</span>
                    <div>
                      {quickComments.map((item) => (
                        <button type="button" key={item} onClick={() => chooseQuickComment(item)}>
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
                    placeholder="Escribe un comentario…"
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
              {record.comments?.length ? (
                record.comments.map((item, commentIndex) => (
                  <div className="comment-item new-comment" key={`${item}-${commentIndex}`}>
                    <i>JD</i>
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

          {/* ── Pie de Panel de Revisión ──────────────────────────── */}
          <div className="panel-footer">
            <span
              className={`saved ${
                syncState.includes('Sincronizado') || syncState.includes('revisado')
                  ? 'is-synced'
                  : syncState.includes('Cambios') || syncState.includes('Guardando')
                  ? 'is-dirty'
                  : ''
              }`}
            >
              <Icon
                name={
                  syncState.includes('Sincronizado') || syncState.includes('revisado')
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
              disabled={!student.file || !!gradeError || isSaving}
            >
              {isSaving ? 'Guardando…' : 'Guardar y siguiente pendiente'}{' '}
              <Icon name="arrow" size={14} />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

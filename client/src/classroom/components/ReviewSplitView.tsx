import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Search,
  UserX,
} from 'lucide-react';
import type { Activity, ReviewRecord, RubricCriterion, Student } from '../types';
import { emptyStudent } from '../adapter';
import { describeDue, formatDayMonth, formatTime } from '../course/overview';
import { phaseOfSubmission, selectSubmissions, type SubmissionPhase } from '../course/submissions';
import { MAX_GRADE, gradingQueue, nextPending, parseGrade, rubricTotals } from '../course/grading';
import '../course/grader.css';

interface ReviewSplitViewProps {
  activity: Activity;
  students: Student[];
  index: number;
  setIndex: (idx: number | null) => void;
  record: ReviewRecord;
  onRecordChange: (patch: Partial<ReviewRecord>) => void;
  /** Devuelve true si la nota quedó guardada en el servidor. */
  onSaveGrade?: (student: Student, grade: number, comment: string) => Promise<boolean>;
  onBack: () => void;
  isShellFocusMode?: boolean;
  onToggleShellFocus?: (focus: boolean) => void;
}

/** Lo que el docente lleva escrito para un estudiante y aún no guardó. */
interface Draft {
  mode: ReviewRecord['evaluationMode'];
  gradeText: string;
  criteria: RubricCriterion[];
  feedback: string;
  dirty: boolean;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Sin cambios',
  dirty: 'Cambios sin guardar',
  saving: 'Guardando…',
  saved: 'Nota guardada',
  error: 'No se pudo guardar. Intenta de nuevo.',
};

const PHASE_LABEL: Record<SubmissionPhase, string> = {
  review: 'Por revisar',
  graded: 'Calificada',
  missing: 'Sin entrega',
};

const PHASE_PILL: Record<SubmissionPhase, string> = { review: 'review', graded: 'open', missing: 'closed' };

const GROUP_LABEL: Record<SubmissionPhase, string> = {
  review: 'Por revisar',
  graded: 'Calificadas',
  missing: 'Sin entrega',
};

const QUICK_FEEDBACK = [
  'Excelente trabajo, bien fundamentado.',
  'Justifica mejor tus conclusiones.',
  'Incluye el procedimiento completo.',
  'Revisa el orden y la presentación.',
];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const draftFrom = (record: ReviewRecord): Draft => ({
  mode: record.evaluationMode,
  gradeText: record.score === undefined ? '' : record.score.toFixed(1),
  criteria: record.criteria,
  feedback: record.feedback,
  dirty: false,
});

/** Calificador: la entrega con su nota a la izquierda y la lista de estudiantes a la derecha. */
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
  const queue = useMemo(() => gradingQueue(students), [students]);
  const position = queue.indexOf(index);
  // Borradores por estudiante mientras el calificador está abierto: escribir no re-renderiza el curso
  const drafts = useRef(new Map<string, Draft>());

  // Al salir del calificador el shell vuelve a mostrar su navegación
  const toggleFocusRef = useRef(onToggleShellFocus);
  toggleFocusRef.current = onToggleShellFocus;
  useEffect(() => () => toggleFocusRef.current?.(false), []);

  const goTo = (offset: 1 | -1) => {
    if (!queue.length) return;
    const from = position >= 0 ? position : offset === 1 ? -1 : 0;
    setIndex(queue[(from + offset + queue.length) % queue.length]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      // Sin esto la letra se escribe en la nota del siguiente estudiante, que recibe el foco
      event.preventDefault();
      goTo(key === 'j' ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="ccw ccw-grader">
      <div className="ccw-grader__bar">
        <button type="button" className="ccw-back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" strokeWidth={2} />
          Entregas
        </button>
        <span className="ccw-grader__activity">{activity.name}</span>

        <div className="ccw-grader__nav">
          <span className="ccw-grader__position ccw-num">
            {queue.length ? `${position >= 0 ? position + 1 : '—'} de ${queue.length}` : 'Sin entregas'}
          </span>
          <button
            type="button"
            className="ccw-icon-btn"
            onClick={() => goTo(-1)}
            disabled={queue.length < 2 && position >= 0}
            aria-label="Entrega anterior (K)"
            title="Entrega anterior (K)"
          >
            <ChevronLeft aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ccw-icon-btn"
            onClick={() => goTo(1)}
            disabled={queue.length < 2 && position >= 0}
            aria-label="Siguiente entrega (J)"
            title="Siguiente entrega (J)"
          >
            <ChevronRight aria-hidden="true" strokeWidth={2} />
          </button>
          {onToggleShellFocus && (
            <button
              type="button"
              className="ccw-icon-btn ccw-grader__focus"
              onClick={() => onToggleShellFocus(!isShellFocusMode)}
              aria-pressed={isShellFocusMode}
              aria-label={isShellFocusMode ? 'Salir de pantalla amplia' : 'Pantalla amplia'}
              title={isShellFocusMode ? 'Salir de pantalla amplia' : 'Pantalla amplia'}
            >
              {isShellFocusMode ? (
                <Minimize2 aria-hidden="true" strokeWidth={2} />
              ) : (
                <Maximize2 aria-hidden="true" strokeWidth={2} />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="ccw-grader__grid">
        {/* La key reinicia el panel por estudiante: arranca de su borrador o de lo guardado */}
        <ReviewPanel
          key={student.id}
          activity={activity}
          student={student}
          students={students}
          index={index}
          initialDraft={drafts.current.get(student.id) ?? draftFrom(record)}
          onDraftChange={(draft) => drafts.current.set(student.id, draft)}
          onCommit={(patch) => {
            drafts.current.delete(student.id);
            onRecordChange(patch);
          }}
          onSaveGrade={onSaveGrade}
          onGoTo={setIndex}
        />

        <Roster students={students} current={index} onSelect={setIndex} />
      </div>
    </div>
  );
}

function ReviewPanel({
  activity,
  student,
  students,
  index,
  initialDraft,
  onDraftChange,
  onCommit,
  onSaveGrade,
  onGoTo,
}: {
  activity: Activity;
  student: Student;
  students: Student[];
  index: number;
  initialDraft: Draft;
  onDraftChange: (draft: Draft) => void;
  onCommit: (patch: Partial<ReviewRecord>) => void;
  onSaveGrade?: ReviewSplitViewProps['onSaveGrade'];
  onGoTo: (index: number) => void;
}) {
  const phase = phaseOfSubmission(student);
  const now = useMemo(() => new Date(), []);
  const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;

  const [draft, setDraft] = useState(initialDraft);
  const [saveState, setSaveState] = useState<SaveState>(initialDraft.dirty ? 'dirty' : 'idle');
  const [showError, setShowError] = useState(false);
  const gradeInput = useRef<HTMLInputElement>(null);

  const pendingCount = students.filter((s) => phaseOfSubmission(s) === 'review').length;
  const usingRubric = draft.mode === 'rubric';
  const rubric = rubricTotals(draft.criteria);
  const grade = usingRubric ? (rubric.earned > 0 ? rubric.grade : null) : parseGrade(draft.gradeText);

  // Solo con puntero fino: en táctil el foco abriría el teclado en cada cambio de estudiante
  useEffect(() => {
    if (phase === 'review' && window.matchMedia('(pointer: fine)').matches) {
      gradeInput.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch, dirty: true };
    setDraft(next);
    onDraftChange(next);
    setSaveState('dirty');
    setShowError(false);
  };

  const changeCriterion = (criterionIndex: number, text: string) =>
    update({
      criteria: draft.criteria.map((c, i) =>
        i === criterionIndex ? { ...c, score: Math.max(0, Math.min(c.max, Math.round(Number(text) || 0))) } : c
      ),
    });

  const addQuickFeedback = (text: string) =>
    update({ feedback: draft.feedback.trim() ? `${draft.feedback.trim()} ${text}` : text });

  /** Guarda en el servidor; el estado local solo pasa a "Calificada" si el guardado funcionó. */
  const save = async (): Promise<boolean> => {
    if (phase === 'missing' || saveState === 'saving') return false;
    if (grade === null) {
      setShowError(true);
      if (!usingRubric) gradeInput.current?.focus();
      return false;
    }
    const feedback = draft.feedback.trim();
    // El campo de comentario guarda la nota del estudiante hasta que hay retroalimentación del docente
    const comment = feedback || (phase === 'review' ? student.comment ?? '' : '');
    setSaveState('saving');
    const ok = onSaveGrade ? await onSaveGrade(student, grade, comment) : true;
    if (!ok) {
      setSaveState('error');
      return false;
    }
    onCommit({
      score: grade,
      feedback,
      criteria: draft.criteria,
      evaluationMode: draft.mode,
      scoreMode: usingRubric ? 'rubric' : 'manual',
      status: 'Calificada',
    });
    setDraft({ ...draft, gradeText: grade.toFixed(1), feedback, dirty: false });
    setSaveState('saved');
    return true;
  };

  const saveAndNext = async (event?: FormEvent) => {
    event?.preventDefault();
    const next = nextPending(students, index);
    if ((await save()) && next >= 0) onGoTo(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const submittedAt = student.submittedAt ? new Date(student.submittedAt) : null;
  const late = Boolean(submittedAt && dueAt && submittedAt > dueAt);
  const studentNote = phase === 'review' ? student.comment : undefined;

  return (
    <section aria-label={`Entrega de ${student.name}`} className="ccw-surface ccw-review">
      <header className="ccw-review__head">
        <span aria-hidden="true" className="ccw-avatar">
          {student.initials}
        </span>
        <div className="ccw-review__who">
          <h2 className="ccw-review__name">{student.name}</h2>
          <span className={`ccw-pill ccw-pill--${PHASE_PILL[phase]}`}>
            <span aria-hidden="true" className="ccw-pill__dot" />
            {PHASE_LABEL[phase]}
          </span>
        </div>
      </header>

      {phase === 'missing' ? (
        <div className="ccw-empty">
          <span aria-hidden="true" className="ccw-empty__icon">
            <UserX strokeWidth={1.75} />
          </span>
          <p className="ccw-empty__title">{student.name} no entregó esta actividad</p>
          <p className="ccw-empty__note">
            {dueAt
              ? dueAt < now
                ? `${describeDue(dueAt, now)} a las ${formatTime(dueAt)}. No hay nada que calificar.`
                : `${describeDue(dueAt, now)}. Podrás calificar cuando envíe su archivo.`
              : 'Podrás calificar cuando envíe su archivo.'}
          </p>
          {pendingCount > 0 && (
            <button type="button" className="ccw-btn ccw-btn--outline" onClick={() => onGoTo(nextPending(students, index))}>
              Ir a la siguiente por revisar
            </button>
          )}
        </div>
      ) : (
        <form className="ccw-review__body" onSubmit={saveAndNext} noValidate>
          <div className="ccw-evidence">
            <span aria-hidden="true" className="ccw-row__icon">
              <FileText strokeWidth={1.75} />
            </span>
            <div className="ccw-row__body">
              <span className="ccw-row__title">{student.file ?? 'Entrega registrada'}</span>
              <span className="ccw-row__detail">
                {student.fileType ? `${student.fileType} · ` : ''}
                {submittedAt
                  ? `Entregó el ${formatDayMonth(submittedAt)} a las ${formatTime(submittedAt)}`
                  : 'Fecha de entrega no registrada'}
                {late && <span className="ccw-row__late"> · Tarde</span>}
              </span>
            </div>
          </div>

          {studentNote && (
            <figure className="ccw-note">
              <figcaption>Comentario del estudiante</figcaption>
              <blockquote>{studentNote}</blockquote>
            </figure>
          )}

          <fieldset className="ccw-field">
            <legend className="ccw-field__label">Calificación</legend>
            <div role="group" aria-label="Forma de calificar" className="ccw-segmented" data-index={draft.mode === 'rubric' ? 1 : 0}>
              <span aria-hidden="true" className="ccw-segmented__thumb" />
              <button type="button" aria-pressed={!usingRubric} onClick={() => usingRubric && update({ mode: 'direct' })}>
                Nota directa
              </button>
              <button type="button" aria-pressed={usingRubric} onClick={() => !usingRubric && update({ mode: 'rubric' })}>
                Rúbrica
              </button>
            </div>

            {usingRubric ? (
              <RubricEditor criteria={draft.criteria} onChange={changeCriterion} />
            ) : (
              <div className="ccw-grade-input">
                <input
                  ref={gradeInput}
                  id="ccw-grade"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.gradeText}
                  onChange={(e) => update({ gradeText: e.target.value })}
                  placeholder="—"
                  aria-label={`Nota de ${student.name}, de 0 a ${MAX_GRADE}`}
                  aria-invalid={showError && grade === null}
                  aria-describedby="ccw-grade-help"
                />
                <span className="ccw-grade-input__scale">/ {MAX_GRADE.toFixed(1)}</span>
              </div>
            )}
            <p id="ccw-grade-help" className={showError && grade === null ? 'ccw-help ccw-help--error' : 'ccw-help'}>
              {showError && grade === null
                ? usingRubric
                  ? 'Asigna puntos a al menos un criterio.'
                  : `Escribe una nota entre 0.0 y ${MAX_GRADE.toFixed(1)}.`
                : usingRubric
                  ? 'La nota se calcula con los puntos de cada criterio.'
                  : 'Usa punto o coma para los decimales. Enter guarda y pasa a la siguiente.'}
            </p>
          </fieldset>

          <div className="ccw-field">
            <label htmlFor="ccw-feedback" className="ccw-field__label">
              Retroalimentación <span className="ccw-field__optional">opcional</span>
            </label>
            <textarea
              id="ccw-feedback"
              className="ccw-textarea"
              rows={3}
              value={draft.feedback}
              onChange={(e) => update({ feedback: e.target.value })}
              placeholder={`Escribe un comentario para ${student.name.split(' ')[0]}`}
            />
            <div className="ccw-suggestions" role="group" aria-label="Comentarios sugeridos">
              {QUICK_FEEDBACK.map((text) => (
                <button key={text} type="button" className="ccw-suggestion" onClick={() => addQuickFeedback(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>

          <footer className="ccw-review__foot">
            <span className={`ccw-save ccw-save--${saveState}`} role="status" aria-live="polite">
              {saveState === 'saving' ? (
                <LoaderCircle aria-hidden="true" strokeWidth={2} className="ccw-spin" />
              ) : saveState === 'saved' ? (
                <Check aria-hidden="true" strokeWidth={2.25} />
              ) : saveState === 'error' ? (
                <AlertCircle aria-hidden="true" strokeWidth={2} />
              ) : null}
              {saveState === 'saved' && pendingCount === 0 ? 'Nota guardada · todo calificado' : SAVE_LABEL[saveState]}
            </span>
            <div className="ccw-review__actions">
              <button
                type="button"
                className="ccw-btn ccw-btn--outline"
                onClick={() => void save()}
                disabled={saveState === 'saving'}
                title="Guardar (Ctrl + S)"
              >
                Guardar
              </button>
              <button type="submit" className="ccw-btn ccw-btn--primary" disabled={saveState === 'saving'}>
                Guardar y siguiente
                <ChevronRight aria-hidden="true" strokeWidth={2} />
              </button>
            </div>
          </footer>
        </form>
      )}
    </section>
  );
}

function RubricEditor({
  criteria,
  onChange,
}: {
  criteria: RubricCriterion[];
  onChange: (index: number, value: string) => void;
}) {
  const { earned, max, grade } = rubricTotals(criteria);
  return (
    <div className="ccw-rubric">
      <ul className="ccw-rubric__list">
        {criteria.map((criterion, i) => (
          <li key={criterion.id} className="ccw-rubric__item">
            <div className="ccw-rubric__copy">
              <label htmlFor={`ccw-crit-${criterion.id}`} className="ccw-rubric__title">
                {criterion.title}
              </label>
              <span className="ccw-rubric__desc">{criterion.description}</span>
            </div>
            <span className="ccw-rubric__score">
              <input
                id={`ccw-crit-${criterion.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={criterion.max}
                step={1}
                value={criterion.score}
                onChange={(e) => onChange(i, e.target.value)}
              />
              <span className="ccw-num">/ {criterion.max}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="ccw-rubric__total">
        <span className="ccw-num">
          {earned} de {max} puntos
        </span>
        <strong className="ccw-num">
          {earned > 0 ? grade.toFixed(1) : '—'}
          <span> / {MAX_GRADE.toFixed(1)}</span>
        </strong>
      </div>
    </div>
  );
}

/** Memoizada: solo cambia al guardar una nota o al moverse de estudiante, no al escribir. */
const Roster = memo(function Roster({
  students,
  current,
  onSelect,
}: {
  students: Student[];
  current: number;
  onSelect: (index: number) => void;
}) {
  const [query, setQuery] = useState('');
  const indexById = useMemo(() => new Map(students.map((s, i) => [s.id, i])), [students]);
  const visible = useMemo(() => selectSubmissions(students, 'Todos', query), [students, query]);
  const groups = (['review', 'graded', 'missing'] as const).map((phase) => ({
    phase,
    items: visible.filter((s) => phaseOfSubmission(s) === phase),
  }));
  const currentId = students[current]?.id;

  return (
    <aside aria-label="Estudiantes" className="ccw-surface ccw-roster">
      <label className="ccw-search ccw-roster__search">
        <Search aria-hidden="true" strokeWidth={2} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar estudiante"
          aria-label="Buscar estudiante"
        />
      </label>

      <div className="ccw-roster__scroll">
        {groups.map(({ phase, items }) =>
          items.length === 0 ? null : (
            <RosterGroup
              key={phase}
              title={GROUP_LABEL[phase]}
              count={items.length}
              // Quien no entregó se pliega para no tapar el trabajo pendiente
              collapsible={phase === 'missing' && !query && !items.some((s) => s.id === currentId)}
            >
              {items.map((s) => {
                const active = s.id === currentId;
                const itemPhase = phaseOfSubmission(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="ccw-roster__item"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => onSelect(indexById.get(s.id) ?? 0)}
                    >
                      <span aria-hidden="true" className={`ccw-avatar ccw-avatar--sm ccw-avatar--${itemPhase}`}>
                        {s.initials}
                      </span>
                      <span className="ccw-roster__name">{s.name}</span>
                      {itemPhase === 'graded' && s.score !== undefined && (
                        <span className="ccw-roster__score ccw-num">{s.score.toFixed(1)}</span>
                      )}
                      {itemPhase === 'review' && <span aria-hidden="true" className="ccw-roster__dot" />}
                    </button>
                  </li>
                );
              })}
            </RosterGroup>
          )
        )}
        {visible.length === 0 && <p className="ccw-roster__empty">Ningún estudiante coincide.</p>}
      </div>
    </aside>
  );
});

function RosterGroup({
  title,
  count,
  collapsible,
  children,
}: {
  title: string;
  count: number;
  collapsible: boolean;
  children: ReactNode;
}) {
  const list = <ul className="ccw-roster__list">{children}</ul>;
  const heading = (
    <span className="ccw-roster__heading">
      {title}
      <span className="ccw-num">{count}</span>
    </span>
  );
  if (!collapsible) {
    return (
      <div className="ccw-roster__group">
        {heading}
        {list}
      </div>
    );
  }
  return (
    <details className="ccw-roster__group">
      <summary>
        {heading}
        <ChevronRight aria-hidden="true" strokeWidth={2} className="ccw-roster__chev" />
      </summary>
      {list}
    </details>
  );
}

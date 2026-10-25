import { useEffect, useId, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, LoaderCircle, X } from 'lucide-react';
import type { Draft } from '../types';
import { emptyDraft, isDraftDirty, toDateInput, validateDraft, type DraftErrors } from '../course/activityDraft';
import '../course/course.css';

interface ActivityDrawerProps {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  /** Contexto del curso al que se agrega: "Matemáticas · Curso 11-2". */
  courseLabel: string;
  onClose: () => void;
  /** Devuelve true si la actividad quedó guardada; el modal se cierra desde el padre. */
  onSubmit: (publish: boolean) => Promise<boolean>;
  isPending?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]';

/**
 * Creador de actividades. Se monta en la raíz del shell: dentro del contenido quedaría por
 * debajo de la barra superior (la animación de página crea su propio contexto de apilamiento).
 */
export function ActivityDrawer({ draft, setDraft, courseLabel, onClose, onSubmit, isPending = false }: ActivityDrawerProps) {
  const ids = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const initial = useRef(draft);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const errors: DraftErrors = submitted ? validateDraft(draft) : {};
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  // Foco al título al abrir y de vuelta al botón que abrió el modal al cerrar
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    titleInput.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // La pregunta de descartar recibe el foco para responderla con el teclado
  useEffect(() => {
    if (confirmDiscard) keepEditing.current?.focus();
  }, [confirmDiscard]);

  const requestClose = () => {
    if (isPending) return;
    if (isDraftDirty(draft, initial.current)) setConfirmDiscard(true);
    else onClose();
  };

  const discard = () => {
    setDraft(emptyDraft());
    onClose();
  };

  const submit = async (publish: boolean, event?: FormEvent) => {
    event?.preventDefault();
    setSubmitted(true);
    const found = validateDraft(draft);
    if (found.name) return titleInput.current?.focus();
    if (found.due) return dialog.current?.querySelector<HTMLInputElement>('#' + CSS.escape(`${ids}-due`))?.focus();
    await onSubmit(publish);
  };

  // Escape pide confirmación si hay cambios; Tab no sale del modal
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (confirmDiscard) {
        setConfirmDiscard(false);
        titleInput.current?.focus();
      } else requestClose();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const modal = (
    <div
      className="ccw ccw-modal-layer"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-context`}
        className="ccw-modal"
        onKeyDown={onKeyDown}
      >
        <header className="ccw-modal__head">
          <div>
            <h2 id={`${ids}-title`} className="ccw-modal__title">
              Nueva actividad
            </h2>
            <p id={`${ids}-context`} className="ccw-modal__context">
              {courseLabel}
            </p>
          </div>
          <button type="button" className="ccw-icon-btn" onClick={requestClose} aria-label="Cerrar" disabled={isPending}>
            <X aria-hidden="true" strokeWidth={2} />
          </button>
        </header>

        <form id={`${ids}-form`} className="ccw-modal__body" onSubmit={(e) => submit(true, e)} noValidate>
          <div className="ccw-field">
            <label htmlFor={`${ids}-name`} className="ccw-field__label">
              Título
            </label>
            <input
              ref={titleInput}
              id={`${ids}-name`}
              className="ccw-input"
              value={draft.name}
              maxLength={180}
              autoComplete="off"
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Ej. Taller de derivadas"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids}-name-error` : undefined}
            />
            {errors.name && (
              <p id={`${ids}-name-error`} className="ccw-help ccw-help--error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="ccw-field">
            <label htmlFor={`${ids}-desc`} className="ccw-field__label">
              Instrucciones <span className="ccw-field__optional">opcional</span>
            </label>
            <textarea
              id={`${ids}-desc`}
              className="ccw-textarea"
              rows={4}
              maxLength={5000}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Qué deben hacer y entregar"
            />
          </div>

          <div className="ccw-modal__row">
            <div className="ccw-field">
              <label htmlFor={`${ids}-due`} className="ccw-field__label">
                Fecha límite
              </label>
              <input
                id={`${ids}-due`}
                type="date"
                className="ccw-input"
                min={toDateInput(new Date())}
                value={draft.due}
                onChange={(e) => update({ due: e.target.value })}
                aria-invalid={Boolean(errors.due)}
                aria-describedby={errors.due ? `${ids}-due-error` : undefined}
              />
            </div>
            <div className="ccw-field">
              <label htmlFor={`${ids}-time`} className="ccw-field__label">
                Hora de cierre
              </label>
              <input
                id={`${ids}-time`}
                type="time"
                className="ccw-input"
                value={draft.dueTime}
                onChange={(e) => update({ dueTime: e.target.value })}
              />
            </div>
          </div>
          {errors.due && (
            <p id={`${ids}-due-error`} className="ccw-help ccw-help--error ccw-modal__row-error">
              {errors.due}
            </p>
          )}

          <fieldset className="ccw-field">
            <legend className="ccw-field__label">Calificación</legend>
            <div role="group" aria-label="Calificación" className="ccw-segmented" data-index={draft.graded ? 0 : 1}>
              <span aria-hidden="true" className="ccw-segmented__thumb" />
              <button type="button" aria-pressed={draft.graded} onClick={() => update({ graded: true })}>
                Con nota
              </button>
              <button type="button" aria-pressed={!draft.graded} onClick={() => update({ graded: false })}>
                Sin nota
              </button>
            </div>
            <p className="ccw-help">
              {draft.graded
                ? 'Calificarás de 0.0 a 5.0 y la nota pasa al Grade Center.'
                : 'Los estudiantes entregan, pero no se registra nota.'}
            </p>
          </fieldset>

          <p className="ccw-modal__hint">
            <FileUp aria-hidden="true" strokeWidth={1.75} />
            Los estudiantes entregarán un archivo desde su portal. Las guías o plantillas se suben en Recursos.
          </p>
        </form>

        <footer className="ccw-modal__foot">
          {confirmDiscard ? (
            <>
              <span className="ccw-modal__ask" role="alert">
                ¿Descartar lo que escribiste?
              </span>
              <div className="ccw-modal__actions">
                <button
                  ref={keepEditing}
                  type="button"
                  className="ccw-btn ccw-btn--outline"
                  onClick={() => {
                    setConfirmDiscard(false);
                    titleInput.current?.focus();
                  }}
                >
                  Seguir editando
                </button>
                <button type="button" className="ccw-btn ccw-btn--danger" onClick={discard}>
                  Descartar
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="ccw-btn ccw-btn--ghost" onClick={requestClose} disabled={isPending}>
                Cancelar
              </button>
              <div className="ccw-modal__actions">
                <button
                  type="button"
                  className="ccw-btn ccw-btn--outline"
                  onClick={() => submit(false)}
                  disabled={isPending}
                >
                  Guardar borrador
                </button>
                <button type="submit" form={`${ids}-form`} className="ccw-btn ccw-btn--primary" disabled={isPending}>
                  {isPending && <LoaderCircle aria-hidden="true" strokeWidth={2} className="ccw-spin" />}
                  {isPending ? 'Guardando…' : 'Publicar'}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.querySelector('.edc-shell') ?? document.body);
}

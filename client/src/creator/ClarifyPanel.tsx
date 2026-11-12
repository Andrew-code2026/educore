import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { CLARIFY_LIMITS, type Clarification, type ClarifyQuestion } from "@shared/creator";

interface ClarifyPanelProps {
  /** Lo que pidió el docente, para que no pierda de vista a qué está respondiendo. */
  request: string;
  questions: ClarifyQuestion[];
  busy: boolean;
  onSubmit: (clarifications: Clarification[]) => void;
  onBack: () => void;
}

/** Una respuesta es una de las opciones o un texto propio, nunca las dos. */
interface Answer {
  choice: string | null;
  other: string;
}

const NO_ANSWER: Answer = { choice: null, other: "" };
const HEADINGS = ["", "Una pregunta antes de escribir", "Dos preguntas antes de escribir", "Tres preguntas antes de escribir"];

/**
 * Preguntas que la IA hace antes de escribir el recurso. Todas son opcionales: lo que el
 * docente deje sin responder lo decide la IA.
 */
export function ClarifyPanel({ request, questions, busy, onSubmit, onBack }: ClarifyPanelProps) {
  const baseId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  // El panel reemplaza al redactor: el foco pasa a su título para que el cambio se anuncie
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const answerOf = (id: string) => answers[id] ?? NO_ANSWER;
  const setAnswer = (id: string, answer: Answer) => setAnswers(current => ({ ...current, [id]: answer }));

  const clarifications = questions
    .map(item => ({ question: item.question, answer: answerOf(item.id).other.trim() || answerOf(item.id).choice || "" }))
    .filter(item => item.answer);

  return (
    <form
      className="crt-surface crt-clarify"
      aria-labelledby={`${baseId}-title`}
      onSubmit={event => {
        event.preventDefault();
        if (!busy) onSubmit(clarifications);
      }}
    >
      <header className="crt-clarify__head">
        <h2 id={`${baseId}-title`} ref={headingRef} tabIndex={-1} className="crt-clarify__title">
          {HEADINGS[questions.length] ?? "Unas preguntas antes de escribir"}
        </h2>
        <p className="crt-clarify__request">Tu solicitud: «{request}»</p>
      </header>

      <ol className="crt-clarify__list">
        {questions.map((item, index) => {
          const answer = answerOf(item.id);
          const promptId = `${baseId}-${item.id}`;
          return (
            <li key={item.id} className="crt-clarify__question">
              <span className="crt-clarify__num" aria-hidden="true">
                {index + 1}
              </span>
              <p id={promptId} className="crt-clarify__text">
                {item.question}
              </p>
              <div className="crt-clarify__options" role="radiogroup" aria-labelledby={promptId}>
                {item.options.map(option => (
                  <label key={option} className="crt-option">
                    <input
                      type="radio"
                      name={promptId}
                      checked={answer.choice === option}
                      disabled={busy}
                      onChange={() => setAnswer(item.id, { choice: option, other: "" })}
                      // Volver a pulsar la opción elegida la quita: ninguna pregunta es obligatoria
                      onClick={() => {
                        if (answer.choice === option) setAnswer(item.id, NO_ANSWER);
                      }}
                    />
                    <span className="crt-option__dot" aria-hidden="true" />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <input
                className="crt-input crt-clarify__other"
                aria-label={`Otra respuesta a: ${item.question}`}
                placeholder="O escribe otra respuesta"
                maxLength={CLARIFY_LIMITS.answerMax}
                value={answer.other}
                disabled={busy}
                onChange={event => setAnswer(item.id, { choice: event.target.value ? null : answer.choice, other: event.target.value })}
              />
            </li>
          );
        })}
      </ol>

      <footer className="crt-clarify__foot">
        <button type="button" className="crt-btn crt-btn--ghost" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Cambiar la solicitud
        </button>
        <p className="crt-muted crt-clarify__hint">Lo que dejes sin responder lo decide la IA.</p>
        <button type="submit" className="crt-btn crt-btn--primary crt-btn--lg" disabled={busy}>
          {busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {busy ? "Creando…" : "Crear recurso"}
        </button>
      </footer>
    </form>
  );
}

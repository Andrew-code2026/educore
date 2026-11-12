import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Minus, Sparkles, TriangleAlert } from "lucide-react";
import { CREATOR_LIMITS, type CreatorActivity, type CreatorChatMessage } from "@shared/creator";
import { RichText } from "./blocks/RichText";

export interface LiveTurn {
  phase: "thinking" | "writing";
  text: string;
  activities: CreatorActivity[];
}

interface CreatorChatProps {
  messages: CreatorChatMessage[];
  /** Turno de IA en curso; null cuando la IA no está trabajando. */
  live: LiveTurn | null;
  /** Por qué no se puede escribir a la IA (sin clave, límite diario…); null si se puede. */
  blocked: string | null;
  suggestions: string[];
  onSend: (message: string) => Promise<void>;
}

function ActivityList({ activities }: { activities: CreatorActivity[] }) {
  if (activities.length === 0) return null;
  return (
    <ul className="crt-chat__activity">
      {activities.map((activity, index) => (
        <li key={index} className={activity.ok ? (activity.changed ? "is-changed" : "is-same") : "is-error"}>
          {activity.ok ? activity.changed ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <span>{activity.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Conversación con la IA sobre el recurso abierto. Cada respuesta dice exactamente qué cambió en el documento. */
export function CreatorChat({ messages, live, blocked, suggestions, onSend }: CreatorChatProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = sending || live !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, live?.text, live?.activities.length, live?.phase]);

  const send = async (text: string) => {
    const message = text.trim();
    if (message.length < 2 || busy || blocked) return;
    setSending(true);
    try {
      await onSend(message);
      setDraft("");
    } catch {
      // El aviso lo muestra quien envía; el texto se conserva para reintentar
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="crt-chat" aria-label="Asistente de IA">
      <header className="crt-chat__head">
        <Sparkles aria-hidden="true" />
        <span>Asistente</span>
      </header>

      <div className="crt-chat__list" role="log" aria-live="polite">
        {messages.length === 0 && !live && (
          <p className="crt-chat__empty">Pídele cambios al asistente: «añade dos ejercicios de contexto», «haz más fácil el ejercicio 3», «agrega la gráfica al ejercicio 6».</p>
        )}
        {messages.map(message => (
          <div key={message.id} className={`crt-chat__msg crt-chat__msg--${message.role}`}>
            {message.role === "assistant" && <ActivityList activities={message.activity} />}
            {message.role === "assistant" ? <RichText md={message.content} /> : <p>{message.content}</p>}
          </div>
        ))}
        {live && (
          <div className="crt-chat__msg crt-chat__msg--assistant" aria-busy="true">
            <ActivityList activities={live.activities} />
            {live.text && <RichText md={live.text} />}
            <span className="crt-chat__working">
              <Loader2 className="crt-spin" aria-hidden="true" />
              {live.phase === "writing" ? "Escribiendo en el recurso…" : "Pensando…"}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!busy && !blocked && suggestions.length > 0 && (
        <div className="crt-chat__suggestions">
          {suggestions.map(suggestion => (
            <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="crt-chat__composer"
        onSubmit={event => {
          event.preventDefault();
          void send(draft);
        }}
      >
        {blocked && <p className="crt-chat__blocked">{blocked}</p>}
        <div className="crt-chat__input">
          <textarea
            aria-label="Mensaje para el asistente"
            rows={2}
            maxLength={CREATOR_LIMITS.messageMax}
            placeholder={blocked ? "El asistente no está disponible" : "Pide un cambio…"}
            value={draft}
            disabled={Boolean(blocked)}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <button type="submit" className="crt-chat__send" aria-label="Enviar mensaje" disabled={busy || Boolean(blocked) || draft.trim().length < 2}>
            {busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
          </button>
        </div>
      </form>
    </aside>
  );
}

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, Loader2, Minus, Sparkles, TriangleAlert, Undo2, X } from "lucide-react";
import { BLOCK_TYPE_LABELS, CREATOR_LIMITS, type CreatorActivity, type CreatorAttachment, type CreatorChatMessage } from "@shared/creator";
import { RichText } from "./blocks/RichText";

export interface LiveTurn {
  phase: "thinking" | "writing";
  text: string;
  activities: CreatorActivity[];
}

/** A dónde llevar la hoja: unos bloques o, si ya no hay ninguno, su sección. */
export interface RevealTarget {
  blockIds?: string[];
  sectionId?: string;
}

interface CreatorChatProps {
  messages: CreatorChatMessage[];
  /** Turno de IA en curso; null cuando la IA no está trabajando. */
  live: LiveTurn | null;
  /** Por qué no se puede escribir a la IA (sin clave, límite diario…); null si se puede. */
  blocked: string | null;
  suggestions: string[];
  /** Bloques que el docente señaló en la hoja para su próximo mensaje. */
  attachments: CreatorAttachment[];
  onDetach: (blockId: string) => void;
  onReveal: (target: RevealTarget) => void;
  /** La respuesta de la IA que se puede deshacer desde aquí, y si ya se deshizo. */
  undoable: { messageId: number; undone: boolean; busy: boolean } | null;
  onUndoTurn: (messageId: number) => void;
  onSend: (message: string) => Promise<void>;
}

function ActivityList({ activities, onReveal }: { activities: CreatorActivity[]; onReveal: (target: RevealTarget) => void }) {
  if (activities.length === 0) return null;
  return (
    <ul className="crt-chat__activity">
      {activities.map((activity, index) => {
        const tone = activity.ok ? (activity.changed ? "is-changed" : "is-same") : "is-error";
        const icon = activity.ok ? activity.changed ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />;
        // La ficha de algo que quedó en la hoja lleva hasta allí
        const linked = activity.changed && Boolean(activity.blockIds?.length || activity.sectionId);
        return linked ? (
          <li key={index} className={`${tone} is-link`}>
            <button type="button" title="Ver en la hoja" onClick={() => onReveal(activity)}>
              {icon}
              <span>{activity.label}</span>
              <ArrowUpRight className="crt-chat__go" aria-hidden="true" />
            </button>
          </li>
        ) : (
          <li key={index} className={tone}>
            {icon}
            <span>{activity.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Un bloque señalado: su tipo y un fragmento. Lleva a él en la hoja; en el cuadro de escritura además se puede quitar. */
function BlockRef({ attachment, onReveal, onRemove }: { attachment: CreatorAttachment; onReveal: (target: RevealTarget) => void; onRemove?: () => void }) {
  const type = BLOCK_TYPE_LABELS[attachment.type];
  // Un ejercicio ya empieza por su rótulo («Ejercicio 2. …»): ese rótulo hace de tipo, sin repetirlo
  const own = attachment.preview.startsWith(type) ? /^([^.:]{1,28})[.:]\s+(.+)$/.exec(attachment.preview) : null;
  const head = own ? own[1] : type;
  const text = own ? own[2] : attachment.preview === type ? "" : attachment.preview;
  return (
    <span className="crt-ref">
      <button type="button" className="crt-ref__main" title="Ver en la hoja" onClick={() => onReveal({ blockIds: [attachment.id] })}>
        <span className="crt-ref__type">{head}</span>
        {text && <span className="crt-ref__text">{text}</span>}
      </button>
      {onRemove && (
        <button type="button" className="crt-ref__remove" aria-label={`Quitar del mensaje: ${type}`} title="Quitar" onClick={onRemove}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Conversación con la IA sobre el recurso abierto. Cada respuesta dice qué cambió en el documento, lleva hasta el cambio y lo deja deshacer. */
export function CreatorChat({ messages, live, blocked, suggestions, attachments, onDetach, onReveal, undoable, onUndoTurn, onSend }: CreatorChatProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = sending || live !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, live?.text, live?.activities.length, live?.phase]);

  // Señalar un bloque es empezar a escribirle al asistente: el cursor pasa al cuadro
  const attachedCount = useRef(attachments.length);
  useEffect(() => {
    if (attachments.length > attachedCount.current) inputRef.current?.focus({ preventScroll: true });
    attachedCount.current = attachments.length;
  }, [attachments.length]);

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
          <p className="crt-chat__empty">
            Pídele cambios al asistente: «añade dos ejercicios de contexto», «agrega la gráfica al ejercicio 6». Para que trabaje sobre un bloque concreto, señálalo en la hoja con «Llevar al chat».
          </p>
        )}
        {messages.map(message => (
          <Fragment key={message.id}>
            {message.role === "user" && message.attachments && message.attachments.length > 0 && (
              <div className="crt-chat__refs" aria-label="Bloques señalados en este mensaje">
                {message.attachments.map(attachment => (
                  <BlockRef key={attachment.id} attachment={attachment} onReveal={onReveal} />
                ))}
              </div>
            )}
            <div className={`crt-chat__msg crt-chat__msg--${message.role}`}>
              {message.role === "assistant" && <ActivityList activities={message.activity} onReveal={onReveal} />}
              {message.role === "assistant" ? <RichText md={message.content} /> : <p>{message.content}</p>}
              {undoable?.messageId === message.id &&
                (undoable.undone ? (
                  <span className="crt-chat__undone">
                    <Undo2 aria-hidden="true" />
                    Cambios deshechos
                  </span>
                ) : (
                  <button type="button" className="crt-chat__undo" disabled={undoable.busy} title="El recurso vuelve a como estaba antes de esta respuesta" onClick={() => onUndoTurn(message.id)}>
                    {undoable.busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
                    Deshacer estos cambios
                  </button>
                ))}
            </div>
          </Fragment>
        ))}
        {live && (
          <div className="crt-chat__msg crt-chat__msg--assistant" aria-busy="true">
            <ActivityList activities={live.activities} onReveal={onReveal} />
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
          {attachments.length > 0 && (
            <div className="crt-chat__attached" role="group" aria-label="Bloques señalados para este mensaje">
              {attachments.map(attachment => (
                <BlockRef key={attachment.id} attachment={attachment} onReveal={onReveal} onRemove={() => onDetach(attachment.id)} />
              ))}
            </div>
          )}
          <div className="crt-chat__entry">
            <textarea
              ref={inputRef}
              aria-label="Mensaje para el asistente"
              rows={2}
              maxLength={CREATOR_LIMITS.messageMax}
              placeholder={blocked ? "El asistente no está disponible" : attachments.length > 0 ? (attachments.length === 1 ? "¿Qué quieres cambiar en este bloque?" : "¿Qué quieres cambiar en estos bloques?") : "Pide un cambio…"}
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
        </div>
      </form>
    </aside>
  );
}

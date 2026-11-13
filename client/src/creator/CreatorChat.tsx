import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  CornerDownRight,
  Equal,
  Heading,
  LayoutList,
  Loader2,
  PencilLine,
  Plus,
  RotateCw,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { BLOCK_TYPE_LABELS, CREATOR_LIMITS, type CreatorActivity, type CreatorAttachment, type CreatorChatMessage, type ResourceDoc } from "@shared/creator";
import { ACTIVITY_OPEN_MAX, countLabel, describeActivity, type ActivityKind, type ActivityView } from "@shared/creatorActivity";
import { BotAvatar } from "./BotAvatar";
import { RichText } from "./blocks/RichText";
import type { RevealTarget } from "./reveal";

export interface LiveTurn {
  phase: "thinking" | "writing";
  text: string;
  activities: CreatorActivity[];
}

type Undoable = { messageId: number; undone: boolean; busy: boolean };

interface CreatorChatProps {
  messages: CreatorChatMessage[];
  /** El documento tal como está: las acciones de la IA se nombran con lo que hay ahora en la hoja. */
  doc: ResourceDoc;
  /** Turno de IA en curso; null cuando la IA no está trabajando. */
  live: LiveTurn | null;
  /** Por qué no se puede escribir a la IA (sin clave, límite diario…); null si se puede. */
  blocked: string | null;
  suggestions: string[];
  /** Bloques que el docente señaló en la hoja para su próximo mensaje. */
  attachments: CreatorAttachment[];
  /** Cambia cada vez que el docente señala un bloque: el cursor pasa al cuadro de escritura. */
  focusSignal: number;
  onDetach: (blockId: string) => void;
  onReveal: (target: RevealTarget) => void;
  /** La respuesta de la IA que se puede deshacer desde aquí, y si ya se deshizo. */
  undoable: Undoable | null;
  onUndoTurn: (messageId: number) => void;
  onSend: (message: string) => Promise<void>;
}

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  title: Heading,
  section: LayoutList,
  add: Plus,
  edit: PencilLine,
  delete: Trash2,
  move: ArrowUpDown,
  same: Equal,
  retry: RotateCw,
};

/** Lo que dice el lector de pantalla antes de cada ficha: el icono solo no basta. */
const KIND_NAMES: Record<ActivityKind, string> = {
  title: "Título",
  section: "Sección",
  add: "Añadido",
  edit: "Editado",
  delete: "Eliminado",
  move: "Movido",
  same: "Sin cambios",
  retry: "Reintento",
};

/** Lejos del final más que esto, la conversación ya no baja sola y aparece «Ir al final». */
const END_SLACK = 80;

function ActivityRow({ activity, view, onReveal }: { activity: CreatorActivity; view: ActivityView; onReveal: (target: RevealTarget) => void }) {
  const Icon = KIND_ICONS[view.kind];
  const body = (
    <>
      <span className="crt-act__icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="crt-act__text">
        <span className="crt-sr">{KIND_NAMES[view.kind]}: </span>
        <span className="crt-act__subject">{view.subject}</span>
        {view.detail && <span className="crt-act__detail"> {view.detail}</span>}
      </span>
    </>
  );
  return (
    <li className={`crt-act crt-act--${view.kind}`}>
      {view.linked ? (
        <button type="button" className="crt-act__row" title="Ver en la hoja" onClick={() => onReveal(activity)}>
          {body}
          <ArrowRight className="crt-act__go" aria-hidden="true" />
        </button>
      ) : (
        <div className="crt-act__row">{body}</div>
      )}
    </li>
  );
}

/**
 * Lo que hizo la IA en una respuesta: una línea con el recuento y «Deshacer», y debajo una ficha por
 * acción. Con muchas acciones, o en respuestas viejas, arranca plegado para no llenar el panel.
 */
function TurnSummary({
  activities,
  doc,
  live = false,
  latest,
  undo,
  onUndo,
  onReveal,
}: {
  activities: CreatorActivity[];
  doc: ResourceDoc;
  live?: boolean;
  latest: boolean;
  undo: Undoable | null;
  onUndo?: () => void;
  onReveal: (target: RevealTarget) => void;
}) {
  const views = useMemo(() => activities.map(activity => describeActivity(activity, doc)), [activities, doc]);
  const [choice, setChoice] = useState<boolean | null>(null);
  const listId = useId();
  if (views.length === 0) return null;

  const open = live || (choice ?? (latest && views.length <= ACTIVITY_OPEN_MAX));
  // Los tipos de acción, en el orden en que aparecen: dicen de un vistazo qué hubo aunque esté plegado
  const kinds = Array.from(new Set(views.filter(view => view.counts).map(view => view.kind)));
  // Mientras trabaja, un intento que el sistema le devolvió no es «sin cambios»: aún está en ello
  const label = live && !views.some(view => view.counts) ? "Preparando los cambios…" : countLabel(views);

  return (
    <section className={`crt-turn${open ? " is-open" : ""}${live ? " is-live" : ""}`} aria-label="Cambios de esta respuesta">
      <div className="crt-turn__head">
        {live ? (
          <span className="crt-turn__label">{label}</span>
        ) : (
          <button type="button" className="crt-turn__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setChoice(!open)}>
            <ChevronRight className="crt-turn__chev" aria-hidden="true" />
            <span className="crt-turn__label">{label}</span>
            {!open && kinds.length > 0 && (
              <span className="crt-turn__kinds" aria-hidden="true">
                {kinds.slice(0, 4).map(kind => {
                  const Icon = KIND_ICONS[kind];
                  return (
                    <span key={kind} className={`crt-act__icon crt-act--${kind}`}>
                      <Icon aria-hidden="true" />
                    </span>
                  );
                })}
              </span>
            )}
          </button>
        )}
        {undo &&
          (undo.undone ? (
            <span className="crt-turn__undone">
              <Check aria-hidden="true" />
              Deshecho
            </span>
          ) : (
            <button type="button" className="crt-turn__undo" disabled={undo.busy} title="El recurso vuelve a como estaba antes de esta respuesta" onClick={onUndo}>
              {undo.busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
              Deshacer
              <span className="crt-sr"> estos cambios</span>
            </button>
          ))}
      </div>
      {open && (
        <ul id={listId} className="crt-turn__list">
          {views.map((view, index) => (
            <ActivityRow key={index} activity={activities[index]} view={view} onReveal={onReveal} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Un mensaje largo del docente (el pedido inicial con sus aclaraciones) se muestra recortado hasta que lo despliega. */
const LONG_MESSAGE_CHARS = 280;
const LONG_MESSAGE_LINES = 6;

function UserMessage({ content }: { content: string }) {
  const long = content.length > LONG_MESSAGE_CHARS || content.split("\n").length > LONG_MESSAGE_LINES;
  const [open, setOpen] = useState(false);
  const textId = useId();
  return (
    <>
      <div className={`crt-chat__msg crt-chat__msg--user${long && !open ? " is-clamped" : ""}`}>
        <p id={textId}>{content}</p>
      </div>
      {long && (
        <button type="button" className="crt-chat__more" aria-expanded={open} aria-controls={textId} onClick={() => setOpen(!open)}>
          {open ? "Ver menos" : "Ver mensaje completo"}
        </button>
      )}
    </>
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
        <button type="button" className="crt-ref__remove" aria-label={`Quitar del mensaje: ${head}`} title="Quitar" onClick={onRemove}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** El copiloto: conversación con la IA sobre el recurso abierto. Cada respuesta dice qué cambió, lleva hasta el cambio y lo deja deshacer. */
export function CreatorChat({ messages, doc, live, blocked, suggestions, attachments, focusSignal, onDetach, onReveal, undoable, onUndoTurn, onSend }: CreatorChatProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = sending || live !== null;
  /** Mientras el docente esté al final, lo nuevo se trae a la vista; si subió a leer, no se le mueve. */
  const stick = useRef(true);
  const [away, setAway] = useState(false);

  const scrollToEnd = (smooth = false) => {
    const list = scrollRef.current;
    if (!list) return;
    stick.current = true;
    setAway(false);
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const lastAssistant = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) if (messages[index].role === "assistant") return messages[index].id;
    return null;
  }, [messages]);

  const showSuggestions = !busy && !blocked && suggestions.length > 0 && draft.trim().length === 0;

  useLayoutEffect(() => {
    if (stick.current) scrollToEnd();
  }, [messages.length, live?.text, live?.activities.length, live?.phase, showSuggestions]);

  // Señalar un bloque es empezar a escribirle al copiloto: el cursor pasa al cuadro. Solo entonces:
  // una ficha que reaparece al deshacer un borrado no se lleva el foco de la hoja.
  const seenSignal = useRef(focusSignal);
  useEffect(() => {
    if (focusSignal !== seenSignal.current) inputRef.current?.focus({ preventScroll: true });
    seenSignal.current = focusSignal;
  }, [focusSignal]);

  const send = async (text: string) => {
    const message = text.trim();
    if (message.length < 2 || busy || blocked) return;
    setSending(true);
    // Lo que el docente acaba de pedir se ve siempre, aunque estuviera leyendo más arriba
    stick.current = true;
    try {
      await onSend(message);
      setDraft("");
    } catch {
      // El aviso lo muestra quien envía; el texto se conserva para reintentar
    } finally {
      setSending(false);
    }
  };

  const onScroll = () => {
    const list = scrollRef.current;
    if (!list) return;
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight <= END_SLACK;
    stick.current = atEnd;
    setAway(!atEnd);
  };

  const empty = messages.length === 0 && !live;

  return (
    <aside id="crt-copilot" className="crt-chat" aria-label="Copiloto de IA">
      <div className="crt-chat__scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="crt-chat__list" role="log" aria-live="polite" aria-label="Conversación con el copiloto">
          {empty && (
            <div className="crt-chat__intro">
              <BotAvatar className="crt-bot--md" />
              <p className="crt-chat__intro-title">¿Qué quieres cambiar?</p>
              <p className="crt-chat__intro-text">
                Pídeselo al copiloto con tus palabras: «añade dos ejercicios de contexto», «agrega la gráfica al ejercicio 6». Para trabajar sobre un bloque concreto, señálalo en la hoja con «Al chat».
              </p>
            </div>
          )}
          {messages.map(message => (
            <Fragment key={message.id}>
              {message.role === "user" ? (
                <div className="crt-chat__turn">
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="crt-chat__refs" aria-label="Bloques señalados en este mensaje">
                      {message.attachments.map(attachment => (
                        <BlockRef key={attachment.id} attachment={attachment} onReveal={onReveal} />
                      ))}
                    </div>
                  )}
                  <UserMessage content={message.content} />
                </div>
              ) : (
                <div className="crt-chat__msg crt-chat__msg--assistant">
                  <TurnSummary
                    activities={message.activity}
                    doc={doc}
                    latest={message.id === lastAssistant}
                    undo={undoable?.messageId === message.id ? undoable : null}
                    onUndo={() => onUndoTurn(message.id)}
                    onReveal={onReveal}
                  />
                  <RichText md={message.content} />
                  {/* Un turno con cambios siempre trae fichas; por si no, «Deshacer» no se pierde */}
                  {undoable?.messageId === message.id && message.activity.length === 0 && !undoable.undone && (
                    <button type="button" className="crt-turn__undo crt-turn__undo--alone" disabled={undoable.busy} onClick={() => onUndoTurn(message.id)}>
                      {undoable.busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
                      Deshacer estos cambios
                    </button>
                  )}
                </div>
              )}
            </Fragment>
          ))}
          {live && (
            <div className="crt-chat__msg crt-chat__msg--assistant" aria-busy="true">
              <TurnSummary activities={live.activities} doc={doc} live latest undo={null} onReveal={onReveal} />
              {live.text && <RichText md={live.text} />}
              <span className="crt-chat__working" role="status">
                <BotAvatar thinking className="crt-bot--xs" />
                <span className="crt-chat__working-text">{live.phase === "writing" ? "Escribiendo en el recurso…" : "Pensando…"}</span>
              </span>
            </div>
          )}
        </div>

        {/* Al final de la conversación, no encima del cuadro: se desplazan con ella y no le quitan sitio */}
        {showSuggestions && (
          <div className="crt-chat__next" role="group" aria-label="Sugerencias del copiloto">
            <p className="crt-chat__next-label">{empty ? "Para empezar" : "Puedes pedir"}</p>
            {suggestions.map(suggestion => (
              <button key={suggestion} type="button" className="crt-chat__idea" onClick={() => void send(suggestion)}>
                <CornerDownRight aria-hidden="true" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="crt-chat__composer"
        onSubmit={event => {
          event.preventDefault();
          void send(draft);
        }}
      >
        {/* Flota sobre el cuadro de escritura, por alto que este llegue a ser */}
        {away && (
          <button type="button" className="crt-chat__to-end" aria-label="Ir al final de la conversación" title="Ir al final" onClick={() => scrollToEnd(true)}>
            <ArrowDown aria-hidden="true" />
          </button>
        )}
        {blocked && (
          <p className="crt-chat__blocked">
            <TriangleAlert aria-hidden="true" />
            <span>{blocked}</span>
          </p>
        )}
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
              aria-label="Mensaje para el copiloto"
              rows={2}
              maxLength={CREATOR_LIMITS.messageMax}
              placeholder={blocked ? "El copiloto no está disponible" : attachments.length > 0 ? (attachments.length === 1 ? "¿Qué quieres cambiar en este bloque?" : "¿Qué quieres cambiar en estos bloques?") : "Pide un cambio…"}
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
            <button type="submit" className="crt-chat__send" aria-label="Enviar mensaje" title="Enviar (Enter)" disabled={busy || Boolean(blocked) || draft.trim().length < 2}>
              {busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

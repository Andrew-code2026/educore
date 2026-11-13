import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ArrowUpLeft, BookOpen, ClipboardCheck, Copy, FileText, Globe, Loader2, Puzzle, Sparkles, Timer, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { CREATOR_LIMITS, RESOURCE_KIND_LABELS, RESOURCE_KINDS, type Clarification, type ClarifyQuestion, type ResourceKind, type ResourceStatus } from "@shared/creator";
import { BotAvatar } from "./BotAvatar";
import { ClarifyPanel } from "./ClarifyPanel";
import { EmptyCard, ErrorCard, formatWhen } from "./parts";
import { SheetPreview, type SheetKind } from "./SheetPreview";
import "./creator.css";

export interface ResourceCard {
  id: number;
  title: string;
  kind: ResourceKind;
  subjectLabel: string | null;
  gradeLabel: string | null;
  courseLabel: string | null;
  status: ResourceStatus;
  updatedAt: Date | string;
}

export interface CreateRequest {
  kind: ResourceKind;
  prompt: string;
  subjectLabel?: string;
  gradeLabel?: string;
  courseLabel?: string;
}

interface CreatorLandingProps {
  lede: string;
  subjects: string[];
  courses: string[];
  /** null mientras carga. */
  resources: ResourceCard[] | null;
  error: boolean;
  aiReady: boolean;
  /** Turnos de IA que le quedan hoy al usuario. */
  remaining: number | null;
  creating: boolean;
  /** La IA está decidiendo si necesita preguntar algo antes de escribir. */
  clarifying: boolean;
  /** Preguntas que esperan respuesta, con la solicitud a la que pertenecen; null cuando no hay. */
  pending: { prompt: string; questions: ClarifyQuestion[] } | null;
  onRetry: () => void;
  /** Antes de escribir, la IA pregunta lo que le haga falta; si la solicitud ya es clara, no pregunta. */
  onCreate: (request: CreateRequest) => void;
  onAnswer: (clarifications: Clarification[]) => void;
  onCancelQuestions: () => void;
  onOpen: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (resource: ResourceCard) => void;
}

const GRADES = ["Transición", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°"];

interface Idea {
  kind: ResourceKind;
  subject: string;
  grade: string;
  /** El tema, en pocas palabras: es lo que se lee primero en la tarjeta. */
  title: string;
  prompt: string;
  /** Hoja en miniatura que acompaña a la idea cuando su tarjeta es ancha. */
  sheet?: SheetKind;
}

const IDEAS: Idea[] = [
  { kind: "guia", subject: "Matemáticas", grade: "9°", title: "Funciones lineales y cuadráticas", sheet: "plot", prompt: "Guía de práctica de funciones lineales y cuadráticas con gráficas de referencia, tablas de valores y seis ejercicios que vayan de lo básico a lo avanzado." },
  { kind: "taller", subject: "Ciencias Naturales", grade: "7°", title: "La célula animal y vegetal", prompt: "Taller sobre la célula animal y vegetal: comparación en una tabla, preguntas de análisis y una actividad de cierre." },
  { kind: "evaluacion", subject: "Matemáticas", grade: "5°", title: "Fracciones equivalentes", prompt: "Evaluación de fracciones equivalentes y suma de fracciones con igual denominador, con problemas de la vida cotidiana." },
  { kind: "calentamiento", subject: "Física", grade: "10°", title: "Movimiento rectilíneo uniforme", prompt: "Calentamiento de diez minutos sobre movimiento rectilíneo uniforme con una gráfica de posición contra tiempo para interpretar." },
  { kind: "contexto_real", subject: "Matemáticas", grade: "8°", title: "Porcentajes en la vida diaria", prompt: "Problemas de porcentajes con situaciones reales: descuentos en una tienda, el IVA de una factura y la propina en un restaurante." },
  { kind: "guia", subject: "Lenguaje", grade: "6°", title: "Comprensión lectora", sheet: "reading", prompt: "Guía de comprensión lectora con un texto narrativo corto ambientado en Colombia y preguntas literales, inferenciales y críticas." },
];

/** Cada tipo de recurso tiene su icono, en la ficha que lo elige y en las ideas. */
const KIND_ICONS: Record<ResourceKind, LucideIcon> = {
  guia: BookOpen,
  taller: Puzzle,
  evaluacion: ClipboardCheck,
  calentamiento: Timer,
  contexto_real: Globe,
};

/** El ejemplo del campo acompaña al tipo elegido. */
const KIND_EXAMPLES: Record<ResourceKind, string> = {
  guia: "guía de práctica de funciones lineales con gráficas y seis ejercicios graduados.",
  taller: "taller en grupos sobre la célula animal y vegetal, con una tabla comparativa y una actividad de cierre.",
  evaluacion: "evaluación de fracciones equivalentes con diez preguntas de distinto nivel.",
  calentamiento: "calentamiento de diez minutos sobre porcentajes para abrir la clase.",
  contexto_real: "problemas de porcentajes con descuentos, IVA y propinas de la vida diaria.",
};

/** Mínimo de caracteres para que una solicitud diga algo. */
const PROMPT_MIN = 8;

const MODIFIER_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

/** Portada del Creador: describir el recurso que se necesita y volver a los ya creados. */
export function CreatorLanding(props: CreatorLandingProps) {
  const { lede, subjects, courses, resources, error, aiReady, remaining, creating, clarifying, pending } = props;
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ResourceKind>("guia");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [course, setCourse] = useState("");

  const subjectOptions = useMemo(() => Array.from(new Set([...subjects, "Matemáticas", "Lenguaje", "Ciencias Naturales", "Ciencias Sociales", "Inglés", "Física", "Química"])), [subjects]);
  const outOfTurns = remaining !== null && remaining <= 0;
  const busy = creating || clarifying;
  const length = prompt.trim().length;
  const canCreate = aiReady && !outOfTurns && !busy && length >= PROMPT_MIN;
  const available = aiReady && !outOfTurns && !busy;

  // Al usar una idea, el redactor se trae a la vista y avisa con un destello
  const cardRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const useIdea = (idea: Idea) => {
    setPrompt(idea.prompt);
    setKind(idea.kind);
    setSubject(idea.subject);
    setGrade(idea.grade);
    document.getElementById("crt-prompt")?.focus({ preventScroll: true });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    setFlash(true);
  };

  // Tipos de recurso: el indicador se coloca detrás del elegido y se desliza al cambiar
  const kindsRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const track = kindsRef.current;
    if (!track) return;
    const place = () => {
      const chosen = track.querySelector<HTMLElement>('[aria-checked="true"]');
      // Con el redactor oculto no hay medidas: se conserva la última posición
      if (chosen && chosen.offsetWidth > 0) setThumb({ x: chosen.offsetLeft, y: chosen.offsetTop, width: chosen.offsetWidth, height: chosen.offsetHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(track);
    return () => observer.disconnect();
  }, [kind]);

  /** Como en cualquier grupo de opciones, las flechas cambian la elegida y el foco la sigue. */
  const moveKind = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = RESOURCE_KINDS.length - 1;
    const current = RESOURCE_KINDS.indexOf(kind);
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (current + 1) % (last + 1)
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (current + last) % (last + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setKind(RESOURCE_KINDS[next]);
    kindsRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  const submit = () => {
    if (!canCreate) return;
    props.onCreate({ kind, prompt: prompt.trim(), subjectLabel: subject || undefined, gradeLabel: grade || undefined, courseLabel: course || undefined });
  };

  return (
    <div className="crt crt--home">
      <div aria-hidden="true" className="crt__backdrop">
        <span className="crt__grid crt__grid--a" />
        <span className="crt__grid crt__grid--b" />
      </div>
      <div className="crt__content">
        <div className="crt-hero">
          <header className="crt-header">
            <h1 className="crt-title">Crea recursos para tu clase</h1>
            <p className="crt-lede">{lede}</p>
          </header>

          {pending && <ClarifyPanel request={pending.prompt} questions={pending.questions} busy={creating} onSubmit={props.onAnswer} onBack={props.onCancelQuestions} />}

          <form
            className="crt-composer"
            // Mientras hay preguntas pendientes el redactor se oculta, pero conserva lo escrito
            hidden={pending !== null}
            onSubmit={event => {
              event.preventDefault();
              submit();
            }}
          >
            <div ref={cardRef} className="crt-surface crt-composer__card" data-flash={flash ? "" : undefined}>
              <div className="crt-composer__field">
                <BotAvatar thinking={busy} />
                <label className="crt-sr" htmlFor="crt-prompt">
                  Describe el recurso que necesitas
                </label>
                <textarea
                  id="crt-prompt"
                  className="crt-composer__prompt"
                  rows={2}
                  maxLength={CREATOR_LIMITS.promptMax}
                  placeholder={`¿Qué necesitas? Por ejemplo: ${KIND_EXAMPLES[kind]}`}
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
                  }}
                />
              </div>

              <div className="crt-composer__foot">
                <div className="crt-composer__context">
                  <select className="crt-input" aria-label="Asignatura" data-set={subject ? "" : undefined} value={subject} onChange={event => setSubject(event.target.value)}>
                    <option value="">Asignatura</option>
                    {subjectOptions.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <select className="crt-input" aria-label="Grado" data-set={grade ? "" : undefined} value={grade} onChange={event => setGrade(event.target.value)}>
                    <option value="">Grado</option>
                    {GRADES.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  {courses.length > 0 && (
                    <select className="crt-input" aria-label="Curso" data-set={course ? "" : undefined} value={course} onChange={event => setCourse(event.target.value)}>
                      <option value="">Curso (opcional)</option>
                      {courses.map(option => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="crt-composer__submit">
                  <span id="crt-hint" className="crt-composer__hint">
                    {!available || length === 0 ? null : length < PROMPT_MIN ? (
                      "Cuéntame un poco más para empezar"
                    ) : (
                      <span className="crt-composer__keys">
                        <kbd>{MODIFIER_KEY}</kbd>
                        <kbd>Enter</kbd>
                      </span>
                    )}
                  </span>
                  <button
                    type="submit"
                    className="crt-btn crt-btn--primary crt-btn--lg"
                    aria-describedby="crt-hint"
                    title="Antes de escribir, la IA te hace hasta tres preguntas de opción múltiple para afinar el recurso. Si tu solicitud ya es clara, empieza de una vez."
                    disabled={!canCreate}
                  >
                    {busy ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                    {clarifying ? "Preparando preguntas…" : creating ? "Creando…" : "Crear recurso"}
                  </button>
                </div>
              </div>

              {!aiReady && (
                <p className="crt-notice" role="status">
                  <TriangleAlert aria-hidden="true" />
                  <span>
                    La IA todavía no está configurada en este servidor (falta la clave <code>ANTHROPIC_API_KEY</code>).
                  </span>
                </p>
              )}
              {aiReady && outOfTurns && (
                <p className="crt-notice" role="status">
                  <TriangleAlert aria-hidden="true" />
                  <span>Alcanzaste el límite de solicitudes a la IA por hoy. Mañana puedes crear más; tus recursos siguen disponibles para editar.</span>
                </p>
              )}
            </div>

            <div className="crt-composer__kinds">
              <span id="crt-kinds" className="crt-composer__kinds-label">
                Tipo de recurso
              </span>
              <div ref={kindsRef} className="crt-kinds" role="radiogroup" aria-labelledby="crt-kinds" onKeyDown={moveKind}>
                {thumb && <span aria-hidden="true" className="crt-kinds__thumb" data-kind={kind} style={{ translate: `${thumb.x}px ${thumb.y}px`, width: thumb.width, height: thumb.height }} />}
                {RESOURCE_KINDS.map(option => {
                  const KindIcon = KIND_ICONS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={kind === option}
                      // Un solo alto en el recorrido con Tab: dentro del grupo se navega con las flechas
                      tabIndex={kind === option ? 0 : -1}
                      title={RESOURCE_KIND_LABELS[option].hint}
                      className="crt-kind"
                      data-kind={option}
                      onClick={() => setKind(option)}
                    >
                      <KindIcon aria-hidden="true" />
                      {RESOURCE_KIND_LABELS[option].label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* La clave reinicia la entrada del texto cada vez que cambia el tipo */}
            <p key={kind} className="crt-composer__kind-hint">
              {RESOURCE_KIND_LABELS[kind].hint}
            </p>
          </form>
        </div>

        <section aria-labelledby="crt-ideas" hidden={pending !== null}>
          <div className="crt-rule">
            <h2 id="crt-ideas" className="crt-rule__label">
              Ideas para empezar
            </h2>
          </div>
          <div className="crt-ideas">
            {IDEAS.map(idea => {
              const KindIcon = KIND_ICONS[idea.kind];
              return (
                <button
                  key={idea.prompt}
                  type="button"
                  className="crt-idea"
                  data-kind={idea.kind}
                  onClick={() => useIdea(idea)}
                >
                  <span className="crt-idea__head">
                    <span aria-hidden="true" className="crt-idea__icon">
                      <KindIcon />
                    </span>
                    <span className="crt-idea__kind">{RESOURCE_KIND_LABELS[idea.kind].label}</span>
                  </span>
                  <span className="crt-idea__title">{idea.title}</span>
                  <span className="crt-idea__text">{idea.prompt}</span>
                  <span className="crt-idea__foot">
                    <span className="crt-idea__context">
                      {idea.subject} · {idea.grade}
                    </span>
                    <span aria-hidden="true" className="crt-idea__use">
                      <ArrowUpLeft />
                      Usar idea
                    </span>
                  </span>
                  {idea.sheet && <SheetPreview kind={idea.sheet} />}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="crt-mine">
          <div className="crt-rule">
            <h2 id="crt-mine" className="crt-rule__label">
              Mis recursos
            </h2>
            {resources && resources.length > 0 && <span className="crt-rule__count">{resources.length === 1 ? "1 recurso" : `${resources.length} recursos`}</span>}
          </div>

          {error ? (
            <ErrorCard title="No pudimos cargar tus recursos" onRetry={props.onRetry} />
          ) : resources === null ? (
            <div className="crt-cards" aria-hidden="true">
              {[0, 1, 2].map(index => (
                <span key={index} className="crt-skeleton crt-skeleton--card" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <EmptyCard icon={<FileText strokeWidth={1.9} />} title="Aún no has creado recursos">
              Describe arriba lo que necesitas y en un minuto tendrás una guía lista para revisar, ajustar e imprimir.
            </EmptyCard>
          ) : (
            <ul className="crt-cards">
              {resources.map(resource => {
                const KindIcon = KIND_ICONS[resource.kind];
                return (
                  <li key={resource.id} className="crt-card" data-kind={resource.kind}>
                    <button type="button" className="crt-card__open" onClick={() => props.onOpen(resource.id)}>
                      <span aria-hidden="true" className="crt-card__icon">
                        <KindIcon />
                      </span>
                      <span className="crt-card__title">{resource.title || "Recurso sin título"}</span>
                      <span className="crt-card__meta">
                        {[resource.subjectLabel, resource.gradeLabel, RESOURCE_KIND_LABELS[resource.kind].label].filter(Boolean).join(" · ")}
                      </span>
                      <span className="crt-card__foot">
                        {resource.status === "generating" ? (
                          <span className="crt-status crt-status--working">
                            <Loader2 className="crt-spin" aria-hidden="true" />
                            La IA está escribiendo
                          </span>
                        ) : resource.status === "error" ? (
                          <span className="crt-status crt-status--error">Requiere revisión</span>
                        ) : (
                          <span className="crt-muted">Editado {formatWhen(resource.updatedAt)}</span>
                        )}
                        <ArrowRight aria-hidden="true" />
                      </span>
                    </button>
                    <div className="crt-card__actions">
                      <button type="button" className="crt-icon-btn" title="Duplicar" aria-label={`Duplicar ${resource.title}`} onClick={() => props.onDuplicate(resource.id)}>
                        <Copy aria-hidden="true" />
                      </button>
                      <button type="button" className="crt-icon-btn crt-icon-btn--danger" title="Eliminar" aria-label={`Eliminar ${resource.title}`} onClick={() => props.onDelete(resource)}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

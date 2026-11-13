import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ClipboardCheck, Copy, FileText, Globe, Loader2, Puzzle, Sparkles, Timer, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { CREATOR_LIMITS, RESOURCE_KIND_LABELS, RESOURCE_KINDS, type Clarification, type ClarifyQuestion, type ResourceKind, type ResourceStatus } from "@shared/creator";
import { ClarifyPanel } from "./ClarifyPanel";
import { EmptyCard, ErrorCard, formatWhen } from "./parts";
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

export interface SampleOption<Id extends string = string> {
  id: Id;
  label: string;
}

interface CreatorLandingProps<SampleId extends string> {
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
  /** Recursos de ejemplo que se pueden abrir sin IA. */
  samples: SampleOption<SampleId>[];
  onRetry: () => void;
  /** Antes de escribir, la IA pregunta lo que le haga falta; si la solicitud ya es clara, no pregunta. */
  onCreate: (request: CreateRequest) => void;
  onAnswer: (clarifications: Clarification[]) => void;
  onCancelQuestions: () => void;
  onOpen: (id: number) => void;
  onOpenSample: (sample: SampleId) => void;
  onDuplicate: (id: number) => void;
  onDelete: (resource: ResourceCard) => void;
}

const GRADES = ["Transición", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°"];

const IDEAS: Array<{ kind: ResourceKind; subject: string; grade: string; prompt: string }> = [
  { kind: "guia", subject: "Matemáticas", grade: "9°", prompt: "Guía de práctica de funciones lineales y cuadráticas con gráficas de referencia, tablas de valores y seis ejercicios que vayan de lo básico a lo avanzado." },
  { kind: "taller", subject: "Ciencias Naturales", grade: "7°", prompt: "Taller sobre la célula animal y vegetal: comparación en una tabla, preguntas de análisis y una actividad de cierre." },
  { kind: "evaluacion", subject: "Matemáticas", grade: "5°", prompt: "Evaluación de fracciones equivalentes y suma de fracciones con igual denominador, con problemas de la vida cotidiana." },
  { kind: "calentamiento", subject: "Física", grade: "10°", prompt: "Calentamiento de diez minutos sobre movimiento rectilíneo uniforme con una gráfica de posición contra tiempo para interpretar." },
  { kind: "contexto_real", subject: "Matemáticas", grade: "8°", prompt: "Problemas de porcentajes con situaciones reales: descuentos en una tienda, el IVA de una factura y la propina en un restaurante." },
  { kind: "guia", subject: "Lenguaje", grade: "6°", prompt: "Guía de comprensión lectora con un texto narrativo corto ambientado en Colombia y preguntas literales, inferenciales y críticas." },
];

/** Cada tipo de recurso tiene su icono, en la ficha que lo elige y en las ideas. */
const KIND_ICONS: Record<ResourceKind, LucideIcon> = {
  guia: BookOpen,
  taller: Puzzle,
  evaluacion: ClipboardCheck,
  calentamiento: Timer,
  contexto_real: Globe,
};

/** Portada del Creador: describir el recurso que se necesita y volver a los ya creados. */
export function CreatorLanding<SampleId extends string>(props: CreatorLandingProps<SampleId>) {
  const { lede, subjects, courses, resources, error, aiReady, remaining, creating, clarifying, pending, samples } = props;
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ResourceKind>("guia");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [course, setCourse] = useState("");

  const subjectOptions = useMemo(() => Array.from(new Set([...subjects, "Matemáticas", "Lenguaje", "Ciencias Naturales", "Ciencias Sociales", "Inglés", "Física", "Química"])), [subjects]);
  const outOfTurns = remaining !== null && remaining <= 0;
  const busy = creating || clarifying;
  const canCreate = aiReady && !outOfTurns && !busy && prompt.trim().length >= 8;
  // Los ejemplos se apartan mientras se responden las preguntas, igual que las ideas
  const showSamples = samples.length > 0 && pending === null;

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
            <div className="crt-surface crt-composer__card">
              <div className="crt-composer__field">
                <span aria-hidden="true" className="crt-composer__mark">
                  <Sparkles />
                </span>
                <label className="crt-sr" htmlFor="crt-prompt">
                  Describe el recurso que necesitas
                </label>
                <textarea
                  id="crt-prompt"
                  className="crt-composer__prompt"
                  rows={2}
                  maxLength={CREATOR_LIMITS.promptMax}
                  placeholder="¿Qué necesitas? Por ejemplo: guía de práctica de funciones lineales con gráficas y seis ejercicios graduados."
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
                  }}
                />
              </div>

              <div className="crt-composer__foot">
                <div className="crt-composer__context">
                  <select className="crt-input" aria-label="Asignatura" value={subject} onChange={event => setSubject(event.target.value)}>
                    <option value="">Asignatura</option>
                    {subjectOptions.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <select className="crt-input" aria-label="Grado" value={grade} onChange={event => setGrade(event.target.value)}>
                    <option value="">Grado</option>
                    {GRADES.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  {courses.length > 0 && (
                    <select className="crt-input" aria-label="Curso" value={course} onChange={event => setCourse(event.target.value)}>
                      <option value="">Curso (opcional)</option>
                      {courses.map(option => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="crt-composer__submit">
                  <button
                    type="submit"
                    className="crt-btn crt-btn--primary crt-btn--lg"
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
                    {samples.length > 0 && " Mientras tanto puedes abrir un recurso de ejemplo, más abajo, para conocer el editor."}
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

            <div className="crt-composer__kinds" role="radiogroup" aria-labelledby="crt-kinds">
              <span id="crt-kinds" className="crt-composer__kinds-label">
                Tipo de recurso
              </span>
              {RESOURCE_KINDS.map(option => {
                const KindIcon = KIND_ICONS[option];
                return (
                  <button key={option} type="button" role="radio" aria-checked={kind === option} title={RESOURCE_KIND_LABELS[option].hint} className="crt-kind" onClick={() => setKind(option)}>
                    <KindIcon aria-hidden="true" />
                    {RESOURCE_KIND_LABELS[option].label}
                  </button>
                );
              })}
            </div>
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
                  onClick={() => {
                    setPrompt(idea.prompt);
                    setKind(idea.kind);
                    setSubject(idea.subject);
                    setGrade(idea.grade);
                    document.getElementById("crt-prompt")?.focus();
                  }}
                >
                  <span className="crt-idea__head">
                    <span aria-hidden="true" className="crt-idea__icon">
                      <KindIcon />
                    </span>
                    <span className="crt-idea__meta">
                      {idea.subject} · {idea.grade}
                    </span>
                  </span>
                  <span className="crt-idea__title">{RESOURCE_KIND_LABELS[idea.kind].label}</span>
                  <span className="crt-idea__text">{idea.prompt}</span>
                  <KindIcon aria-hidden="true" className="crt-idea__motif" strokeWidth={1.25} />
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="crt-shelf">
          <div className="crt-rule">
            <h2 id="crt-shelf" className="crt-rule__label">
              Tu biblioteca
            </h2>
          </div>
          <div className={showSamples ? "crt-shelf crt-shelf--split" : "crt-shelf"}>
            <section className="crt-panel" aria-labelledby="crt-mine">
              <div className="crt-panel__head">
                <h3 id="crt-mine" className="crt-panel__title">
                  Mis recursos
                </h3>
                {resources && resources.length > 0 && <span className="crt-muted">{resources.length === 1 ? "1 recurso" : `${resources.length} recursos`}</span>}
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
                  {resources.map(resource => (
                    <li key={resource.id} className="crt-card">
                      <button type="button" className="crt-card__open" onClick={() => props.onOpen(resource.id)}>
                        <span className="crt-card__meta">
                          {[RESOURCE_KIND_LABELS[resource.kind].label, resource.subjectLabel, resource.gradeLabel].filter(Boolean).join(" · ")}
                        </span>
                        <span className="crt-card__title">{resource.title || "Recurso sin título"}</span>
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
                  ))}
                </ul>
              )}
            </section>

            {showSamples && (
              <section className="crt-panel" aria-labelledby="crt-samples">
                <div className="crt-panel__head">
                  <h3 id="crt-samples" className="crt-panel__title">
                    Ejemplos ya hechos
                  </h3>
                </div>
                <p className="crt-panel__note">Ábrelos para conocer el editor sin gastar solicitudes a la IA.</p>
                <ul className="crt-samples">
                  {samples.map(sample => (
                    <li key={sample.id}>
                      <button type="button" className="crt-sample" disabled={busy} onClick={() => props.onOpenSample(sample.id)}>
                        <span aria-hidden="true" className="crt-sample__icon">
                          <FileText />
                        </span>
                        <span className="crt-sample__label">{sample.label}</span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

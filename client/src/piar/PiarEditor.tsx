import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Printer, Trash2 } from "lucide-react";
import { initialsOf } from "@/analytics/landing";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PIAR_ACTIVITIES_KEY,
  PIAR_MAX_ACTIVITIES,
  isPiarFieldVisible,
  piarActivityCount,
  piarFieldStats,
  piarPercent,
  piarSchema,
  piarSectionFields,
  type PiarSource,
  type PiarStatus,
  type PiarValues,
} from "@shared/piar";
import { PiarFieldView } from "./PiarFields";
import { ErrorCard } from "./parts";
import { PiarPrintSheet } from "./PiarPrintSheet";
import { usePiarAutosave, type PiarSaveResult, type SaveState } from "./usePiarAutosave";
import "./piar.css";

export interface PiarEditorRecord {
  id: number;
  status: PiarStatus;
  values: PiarValues;
  updatedAt: Date | string;
  finalizedAt: Date | string | null;
  student: { name: string; code: string | null };
}

interface PiarEditorProps {
  record: PiarEditorRecord;
  group: string;
  schoolName: string;
  onBack: () => void;
  onSave: (values: PiarValues, finalize: boolean) => Promise<PiarSaveResult>;
  /** Rechaza si el servidor no lo retiró. */
  onRemove: () => Promise<void>;
}

type Position = { annex: number; section: number; sub: number };

const NO_VALUES: PiarValues = {};


const timeLabel = (date: Date) => {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

/** Diligenciamiento de los tres anexos del PIAR de un estudiante, con guardado automático. */
export function PiarEditor({ record, group, schoolName, onBack, onSave, onRemove }: PiarEditorProps) {
  const uid = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fullBarHeight = useRef(0);
  const [compactBar, setCompactBar] = useState(false);
  const { values, status, savedAt, finalizedAt, saveState, update, flush } = usePiarAutosave({
    initialValues: record.values,
    initialStatus: record.status,
    initialSavedAt: record.updatedAt,
    initialFinalizedAt: record.finalizedAt,
    save: onSave,
  });
  const [pos, setPos] = useState<Position>({ annex: 0, section: 0, sub: 0 });
  const [guides, setGuides] = useState<Record<string, boolean>>({});
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const { printing, print } = usePrint(`PIAR ${record.student.name} ${group}`);

  // La estructura solo depende del número de actividades en casa: los campos se conservan entre teclas
  const activities = piarActivityCount(values);
  const annexes = useMemo(() => piarSchema({ [PIAR_ACTIVITIES_KEY]: String(activities) }), [activities]);
  const annex = annexes[pos.annex];
  const section = annex.sections[pos.section] ?? annex.sections[0];
  const subIndex = section.subs ? Math.min(pos.sub, section.subs.length - 1) : 0;
  const fields = (section.subs ? section.subs[subIndex].fields : section.fields ?? []).filter(field => isPiarFieldVisible(field, values));

  const annexStats = annexes.map(item => piarFieldStats(item.sections.flatMap(piarSectionFields), values));
  const totals = annexStats.reduce((sum, stats) => ({ done: sum.done + stats.done, total: sum.total + stats.total }), { done: 0, total: 0 });
  const sectionStats = piarFieldStats(piarSectionFields(section), values);

  // Cada cambio de sección arranca arriba, como una navegación
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pos.annex, pos.section, subIndex]);

  // Al bajar, la barra de anexos queda fija arriba en versión compacta
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    // Los eventos de scroll ya llegan uno por cuadro; la medición es barata
    const check = () => {
      const bar = barRef.current;
      if (!bar) return;
      if (!bar.classList.contains("pia-annex-bar--compact")) fullBarHeight.current = bar.offsetHeight;
      // Fija = está a la altura de su `top` sticky, medida desde el borde del área con scroll
      const stuckAt = parseFloat(getComputedStyle(root).paddingTop) + parseFloat(getComputedStyle(bar).top);
      const offset = bar.getBoundingClientRect().top - root.getBoundingClientRect().top;
      setCompactBar(root.scrollTop > 0 && offset <= stuckAt + 1);
    };
    root.addEventListener("scroll", check, { passive: true });
    check();
    return () => root.removeEventListener("scroll", check);
  }, []);

  // La barra compacta conserva el espacio de la grande: el formulario no salta al encogerla
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.marginBottom = compactBar ? `${Math.max(0, fullBarHeight.current - bar.offsetHeight)}px` : "";
  }, [compactBar]);

  // En pantallas angostas las secciones son un carrusel: la actual siempre a la vista
  useEffect(() => {
    const list = stepsRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollTo({ left: list.scrollLeft + offset - 12, behavior: "smooth" });
  }, [pos.annex, pos.section]);

  const go = useCallback((next: Position) => setPos(next), []);
  const onChange = useCallback((key: string, value: string) => update({ [key]: value }), [update]);
  const onToggleGuide = useCallback((key: string) => setGuides(current => ({ ...current, [key]: !current[key] })), []);
  const onGoToSource = useCallback((source: PiarSource) => go({ annex: source.annex, section: source.section, sub: 0 }), [go]);
  const onAddActivity = useCallback(() => update({ [PIAR_ACTIVITIES_KEY]: String(Math.min(PIAR_MAX_ACTIVITIES, activities + 1)) }), [update, activities]);
  const onRemoveActivity = useCallback(() => update({ [PIAR_ACTIVITIES_KEY]: String(Math.max(1, activities - 1)) }), [update, activities]);

  const back = () => {
    void flush();
    onBack();
  };

  const finalize = async () => {
    setConfirmFinalize(false);
    setFinalizing(true);
    await flush(true);
    setFinalizing(false);
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await onRemove();
    } catch {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  // Pie: siguiente área, sección o anexo; al final, finalizar
  const isLastAnnex = pos.annex === annexes.length - 1;
  const isLastSection = pos.section === annex.sections.length - 1;
  let next: { label: string; hint?: string; run: () => void };
  if (section.subs && subIndex < section.subs.length - 1) {
    next = { label: `Siguiente: ${section.subs[subIndex + 1].label}`, run: () => go({ ...pos, sub: subIndex + 1 }) };
  } else if (!isLastSection) {
    next = { label: "Continuar", hint: `Siguiente: ${annex.sections[pos.section + 1].title}`, run: () => go({ annex: pos.annex, section: pos.section + 1, sub: 0 }) };
  } else if (!isLastAnnex) {
    next = { label: `Continuar al ${annexes[pos.annex + 1].title}`, run: () => go({ annex: pos.annex + 1, section: 0, sub: 0 }) };
  } else {
    next = { label: "Finalizar PIAR", run: () => (totals.done < totals.total ? setConfirmFinalize(true) : void finalize()) };
  }
  const hasPrev = pos.annex > 0 || pos.section > 0 || subIndex > 0;
  const prev = () => {
    if (subIndex > 0) return go({ ...pos, sub: subIndex - 1 });
    if (pos.section > 0) {
      const target = annex.sections[pos.section - 1];
      return go({ annex: pos.annex, section: pos.section - 1, sub: target.subs ? target.subs.length - 1 : 0 });
    }
    if (pos.annex > 0) {
      const target = annexes[pos.annex - 1];
      const lastSection = target.sections[target.sections.length - 1];
      go({ annex: pos.annex - 1, section: target.sections.length - 1, sub: lastSection.subs ? lastSection.subs.length - 1 : 0 });
    }
  };

  const pending = totals.total - totals.done;
  const finalized = status === "FINALIZED";

  return (
    <div ref={scrollRef} className="pia pia--editor">
      <div aria-hidden="true" className="pia__glow pia__glow--a" />
      <div aria-hidden="true" className="pia__glow pia__glow--b" />

      <div className="pia__content pia-editor">
        <div className="pia-ed-top">
          <button type="button" className="pia-btn pia-btn--outline" onClick={back}>
            <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
            PIAR de {group}
          </button>
          <div className="pia-ed-student">
            <span aria-hidden="true" className="pia-avatar">
              {initialsOf(record.student.name)}
            </span>
            <div className="pia-ed-student__body">
              <h1 className="pia-ed-student__name">{record.student.name}</h1>
              <p className="pia-ed-student__meta">
                <span className="pia-group pia-num">{group}</span>
                {record.student.code && <span className="pia-num">{record.student.code}</span>}
                <span className="pia-num">
                  {totals.done} de {totals.total} campos · {piarPercent(totals)}%
                </span>
              </p>
            </div>
          </div>
          <SaveIndicator state={saveState} savedAt={savedAt} onRetry={() => void flush()} />
          <button type="button" className="pia-btn pia-btn--outline" title="Abre la impresión; elige «Guardar como PDF» para descargarlo" onClick={print}>
            <Printer aria-hidden="true" strokeWidth={1.9} />
            Imprimir o PDF
          </button>
        </div>

        {finalized && finalizedAt && (
          <p className="pia-readonly" role="status">
            <CheckCircle2 aria-hidden="true" strokeWidth={1.9} />
            PIAR finalizado el {finalizedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}. Si editas un campo,
            vuelve a quedar en diligenciamiento.
          </p>
        )}

        <div ref={barRef} className={cn("pia-annex-bar", compactBar && "pia-annex-bar--compact")}>
          <ol aria-label="Anexos del PIAR" className="pia-annexes">
            {annexes.map((item, index) => {
              const stats = annexStats[index];
              const pct = piarPercent(stats);
              const current = index === pos.annex;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    className="pia-annex"
                    aria-current={current ? "step" : undefined}
                    onClick={() => go({ annex: index, section: 0, sub: 0 })}
                  >
                    <span className="pia-annex__head">
                      <span aria-hidden="true" className={cn("pia-annex__num", pct === 100 && !current && "pia-annex__num--done")}>
                        {pct === 100 && !current ? <Check strokeWidth={2.4} /> : index + 1}
                      </span>
                      <span className="pia-annex__text">
                        <span className="pia-annex__title">{item.title}</span>
                        <span className="pia-annex__sub">{item.subtitle}</span>
                      </span>
                      <span className="pia-annex__pct pia-num">{pct}%</span>
                    </span>
                    <span aria-hidden="true" className="pia-meter pia-meter--thin">
                      <span className={cn("pia-meter__bar", pct === 100 && "pia-meter__bar--complete")} style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="pia-ed-body">
          <aside className="pia-ed-aside">
            <nav aria-label={`Secciones del ${annex.title}`} className="pia-surface">
              <p aria-hidden="true" className="pia-steps__label pia-eyebrow">
                {annex.title} · Secciones
              </p>
              <ol ref={stepsRef} className="pia-steps">
                {annex.sections.map((item, index) => {
                  const stats = piarFieldStats(piarSectionFields(item), values);
                  const full = stats.total > 0 && stats.done === stats.total;
                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        className="pia-step"
                        aria-current={index === pos.section ? "true" : undefined}
                        onClick={() => go({ annex: pos.annex, section: index, sub: 0 })}
                      >
                        <span aria-hidden="true" className={cn("pia-step__mark", full ? "pia-step__mark--done" : stats.done > 0 && "pia-step__mark--partial")}>
                          {full ? <Check strokeWidth={2.6} /> : index + 1}
                        </span>
                        <span className="pia-step__title">{item.title}</span>
                        <span className="pia-step__count pia-num">
                          {stats.done}/{stats.total}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            {pos.annex > 0 && (
              <p className="pia-aside-note">
                Los datos del estudiante se toman automáticamente de los anexos anteriores. Para corregirlos, edítalos en su sección de origen.
              </p>
            )}
          </aside>

          <div className="pia-ed-main">
            <div className="pia-ed-section-head">
              <span className="pia-eyebrow">
                {annex.title} · {section.eyebrow}
              </span>
              <h2 className="pia-ed-section-title">{section.title}</h2>
              <p className="pia-ed-section-count pia-num">
                {sectionStats.done} de {sectionStats.total} campos diligenciados
              </p>
            </div>

            {section.subs && (
              <div role="group" aria-label="Áreas" className="pia-subs">
                {section.subs.map((sub, index) => {
                  const stats = piarFieldStats(sub.fields, values);
                  return (
                    <button key={sub.label} type="button" className="pia-sub" aria-pressed={index === subIndex} onClick={() => go({ ...pos, sub: index })}>
                      {sub.label}
                      <span className="pia-sub__count pia-num">
                        {stats.done}/{stats.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pia-surface pia-form">
              {fields.map((field, index) => (
                <div key={`${field.key ?? field.label}-${index}`} className="pia-field" style={{ gridColumn: `span ${field.span}` }}>
                  <PiarFieldView
                    field={field}
                    value={field.key ? values[field.key] ?? "" : ""}
                    values={field.type === "linked" ? values : NO_VALUES}
                    idPrefix={uid}
                    first={index === 0}
                    guideOpen={field.key ? Boolean(guides[field.key]) : false}
                    onChange={onChange}
                    onToggleGuide={onToggleGuide}
                    onGoToSource={onGoToSource}
                    onAddActivity={onAddActivity}
                    onRemoveActivity={onRemoveActivity}
                  />
                </div>
              ))}
            </div>

            <div className="pia-ed-nav">
              <div>
                {hasPrev && (
                  <button type="button" className="pia-btn pia-btn--outline pia-btn--lg" onClick={prev}>
                    <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
                    Anterior
                  </button>
                )}
              </div>
              <div className="pia-ed-nav__next">
                {next.hint && <span className="pia-ed-nav__msg">{next.hint}</span>}
                {isLastAnnex && isLastSection && finalized && <span className="pia-ed-nav__msg pia-ed-nav__msg--ok">PIAR finalizado · listo para imprimir</span>}
                <button type="button" className="pia-btn pia-btn--primary pia-btn--lg" disabled={finalizing} onClick={next.run}>
                  {finalizing && <Loader2 aria-hidden="true" className="pia-spin" strokeWidth={2} />}
                  {next.label}
                  {!(isLastAnnex && isLastSection) && <ArrowRight aria-hidden="true" strokeWidth={1.9} />}
                </button>
              </div>
            </div>

            <div className="pia-ed-remove">
              <span>¿{record.student.name.split(" ")[0]} no requiere PIAR o lo abriste por error?</span>
              <button type="button" className="pia-btn pia-btn--ghost pia-btn--danger" onClick={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden="true" strokeWidth={1.9} />
                Retirar PIAR
              </button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar el PIAR con campos pendientes?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedan {pending} {pending === 1 ? "campo" : "campos"} sin diligenciar en los anexos de {record.student.name}. Puedes finalizarlo así y
              completarlos después; al editarlo volverá a quedar en diligenciamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir diligenciando</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finalize()}>Finalizar de todas formas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemove} onOpenChange={open => !removing && setConfirmRemove(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar el PIAR de {record.student.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los tres anexos diligenciados y el estudiante saldrá de la lista de PIAR de {group}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={event => {
                event.preventDefault();
                void remove();
              }}
            >
              {removing && <Loader2 aria-hidden="true" className="animate-spin" />}
              Retirar PIAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printing &&
        createPortal(
          <div className="pia-print">
            <PiarPrintSheet values={values} schoolName={schoolName} group={group} finalizedAt={finalized ? finalizedAt : null} />
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Mientras se lee el PIAR (o si falla): misma estructura del editor, sin datos. */
export function PiarEditorLoading({ group, error, onBack, onRetry }: { group: string; error: boolean; onBack: () => void; onRetry: () => void }) {
  return (
    <div className="pia">
      <div aria-hidden="true" className="pia__glow pia__glow--a" />
      <div aria-hidden="true" className="pia__glow pia__glow--b" />
      <div className="pia__content pia-editor">
        <div className="pia-ed-top">
          <button type="button" className="pia-btn pia-btn--outline" onClick={onBack}>
            <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
            PIAR de {group}
          </button>
        </div>
        {error ? (
          <ErrorCard title="No pudimos abrir el PIAR" onRetry={onRetry} />
        ) : (
          <div aria-busy="true" aria-label="Cargando el PIAR" className="pia-section">
            <div className="pia-annexes">
              {[0, 1, 2].map(item => (
                <span key={item} className="pia-skeleton pia-skeleton--card" />
              ))}
            </div>
            <span className="pia-skeleton pia-skeleton--form" />
          </div>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ state, savedAt, onRetry }: { state: SaveState; savedAt: Date; onRetry: () => void }) {
  return (
    <span role="status" aria-live="polite" className={cn("pia-save", (state === "saving" || state === "pending") && "pia-save--saving", state === "error" && "pia-save--error")}>
      <span aria-hidden="true" className="pia-save__dot" />
      {state === "saving" ? (
        "Guardando…"
      ) : state === "pending" ? (
        "Cambios sin guardar"
      ) : state === "error" ? (
        <>
          No se pudo guardar
          <button type="button" onClick={onRetry}>
            Reintentar
          </button>
        </>
      ) : (
        `Guardado · ${timeLabel(savedAt)}`
      )}
    </span>
  );
}

/**
 * Monta la copia de impresión solo mientras dura el diálogo del navegador: el
 * efecto corre tras el commit, así el documento ya está en el DOM al llamar a print().
 * El título del documento es el nombre que el navegador propone al guardar el PDF.
 */
function usePrint(fileName: string) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const previousTitle = document.title;
    const done = () => setPrinting(false);
    document.title = fileName;
    window.addEventListener("afterprint", done);
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.title = previousTitle;
    };
  }, [printing, fileName]);

  const print = useCallback(() => setPrinting(true), []);
  return { printing, print };
}

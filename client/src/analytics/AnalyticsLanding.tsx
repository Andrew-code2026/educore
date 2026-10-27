import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALERTS_PREVIEW_LIMIT,
  filterAlerts,
  type AlertFilter,
  type AlertModel,
  type AnalyticsLandingModel,
  type PlanillaModel,
} from "./landing";
import { LandingHeader } from "./LandingHeader";
import { AlertList } from "./AlertList";
import { PlanillaList } from "./PlanillaList";
import "./landing.css";

interface AnalyticsLandingProps {
  /** `null` mientras cargan las planillas. */
  model: AnalyticsLandingModel | null;
  academicYear: string;
  period: string | null;
  lede: string;
  error: boolean;
  onRetry: () => void;
  onOpenAlert: (alert: AlertModel) => void;
  onOpenPlanilla: (planilla: PlanillaModel) => void;
}

const FILTERS: ReadonlyArray<{ id: AlertFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "academic", label: "Académicas" },
  { id: "attendance", label: "Asistencia" },
];

/** Portada de Análisis & Alertas: resumen, alertas tempranas y rendimiento por planilla. */
export function AnalyticsLanding({
  model,
  academicYear,
  period,
  lede,
  error,
  onRetry,
  onOpenAlert,
  onOpenPlanilla,
}: AnalyticsLandingProps) {
  return (
    <div className="anl">
      <div aria-hidden="true" className="anl__glow anl__glow--a" />
      <div aria-hidden="true" className="anl__glow anl__glow--b" />

      <div className="anl__content">
        <LandingHeader
          academicYear={model?.academicYear ?? academicYear}
          period={period}
          lede={lede}
          summary={model?.summary ?? null}
        />

        {error ? (
          <ErrorCard onRetry={onRetry} />
        ) : model ? (
          <>
            <AlertsSection alerts={model.alerts} summary={model.summary} onOpen={onOpenAlert} />
            <section aria-labelledby="anl-planillas-heading" className="anl-section">
              <div className="anl-section__head">
                <h2 id="anl-planillas-heading" className="anl-section__title">
                  Rendimiento por planilla
                </h2>
                {model.planillas.length > 1 && (
                  <span className="anl-section__hint">De menor a mayor promedio</span>
                )}
              </div>
              {model.planillas.length > 0 && (
                <PlanillaList planillas={model.planillas} onOpen={onOpenPlanilla} />
              )}
              {model.unstarted.length > 0 && (
                <UnstartedPlanillas planillas={model.unstarted} onOpen={onOpenPlanilla} />
              )}
              {model.planillas.length === 0 && model.unstarted.length === 0 && (
                <EmptyCard icon={<BookOpen strokeWidth={1.9} />} title="Aún no tienes planillas asignadas">
                  Cuando tengas cursos y materias asignados, verás aquí su rendimiento.
                </EmptyCard>
              )}
            </section>
          </>
        ) : (
          <LoadingSections />
        )}
      </div>
    </div>
  );
}

interface AlertsSectionProps {
  alerts: AlertModel[];
  summary: AnalyticsLandingModel["summary"];
  onOpen: (alert: AlertModel) => void;
}

function AlertsSection({ alerts, summary, onOpen }: AlertsSectionProps) {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [expanded, setExpanded] = useState(false);

  const counts: Record<AlertFilter, number> = {
    all: alerts.length,
    academic: summary.academic,
    attendance: summary.attendance,
  };
  const filtered = useMemo(() => filterAlerts(alerts, filter), [alerts, filter]);
  const visible = expanded ? filtered : filtered.slice(0, ALERTS_PREVIEW_LIMIT);

  const selectFilter = (next: AlertFilter) => {
    setFilter(next);
    setExpanded(false);
  };

  return (
    <section aria-labelledby="anl-alerts-heading" className="anl-section">
      <div className="anl-section__head">
        <h2 id="anl-alerts-heading" className="anl-section__title">
          Alertas tempranas
          {alerts.length > 0 && <span className="anl-count anl-num">{alerts.length}</span>}
        </h2>
        {alerts.length > 0 && (
          <div role="group" aria-label="Filtrar alertas" className="anl-segment">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                disabled={id !== "all" && counts[id] === 0}
                className={cn("anl-segment__btn", filter === id && "is-active")}
                onClick={() => selectFilter(id)}
              >
                {label}
                <span className="anl-segment__count anl-num">{counts[id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyCard icon={<ShieldCheck strokeWidth={1.9} />} title="Sin alertas por ahora" tone="ok">
          Ningún estudiante está por debajo de 3.0 ni tiene alertas por inasistencias.
        </EmptyCard>
      ) : (
        <>
          <AlertList alerts={visible} onOpen={onOpen} />
          {filtered.length > ALERTS_PREVIEW_LIMIT && (
            <button
              type="button"
              className="anl-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Mostrar menos" : `Ver todas (${filtered.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

interface UnstartedPlanillasProps {
  planillas: PlanillaModel[];
  onOpen: (planilla: PlanillaModel) => void;
}

/** Planillas sin evaluaciones: sin métricas que comparar, se listan como accesos compactos. */
function UnstartedPlanillas({ planillas, onOpen }: UnstartedPlanillasProps) {
  return (
    <div className="anl-unstarted">
      <h3 className="anl-unstarted__title">
        Sin evaluaciones aún
        <span className="anl-unstarted__count anl-num">{planillas.length}</span>
      </h3>
      <ul aria-label="Planillas sin evaluaciones" className="anl-chips">
        {planillas.map((planilla) => (
          <li key={planilla.key}>
            <button
              type="button"
              className="anl-chip"
              aria-label={`Abrir planilla de ${planilla.subject} ${planilla.group} en Grade Center`}
              onClick={() => onOpen(planilla)}
            >
              <span className="anl-group anl-num">{planilla.group}</span>
              {planilla.subject}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EmptyCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "info" | "ok";
}

function EmptyCard({ icon, title, children, tone = "info" }: EmptyCardProps) {
  return (
    <div className="anl-surface anl-empty" role="status">
      <span aria-hidden="true" className={`anl-empty__icon anl-empty__icon--${tone}`}>
        {icon}
      </span>
      <div className="anl-empty__body">
        <span className="anl-empty__title">{title}</span>
        <span className="anl-empty__text">{children}</span>
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="anl-surface anl-empty" role="alert">
      <span aria-hidden="true" className="anl-empty__icon anl-empty__icon--error">
        <TriangleAlert strokeWidth={1.9} />
      </span>
      <div className="anl-empty__body">
        <span className="anl-empty__title">No pudimos cargar el análisis</span>
        <span className="anl-empty__text">Revisa tu conexión e inténtalo de nuevo.</span>
      </div>
      <button type="button" className="anl-btn anl-btn--outline anl-empty__action" onClick={onRetry}>
        <RotateCcw aria-hidden="true" strokeWidth={1.9} />
        Reintentar
      </button>
    </div>
  );
}

function LoadingSections() {
  return (
    <div aria-busy="true" aria-label="Cargando análisis" className="anl-loading">
      {[0, 1].map((block) => (
        <div key={block} className="anl-section">
          <span className="anl-skeleton anl-skeleton--title" />
          <div className="anl-surface anl-list">
            {[0, 1, 2].map((row) => (
              <span key={row} className="anl-skeleton anl-skeleton--row" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

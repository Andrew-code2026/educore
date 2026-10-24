import { useState } from "react";
import { ChevronRight, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { APPROVAL_GRADE, LEVELS, levelFromScore, levelTint, PROVISIONAL_THRESHOLD } from "../../domain/scale";
import { EMPTY_FILTERS } from "../../domain/selectors";
import type { StudentMetrics } from "../../domain/metrics";
import { formatGrade, initials } from "../../lib/format";
import { LevelLegend, LevelStack } from "../insights/LevelStack";

const ATTENTION_LIMIT = 6;

/**
 * Vista Desempeño: cómo va el grupo y a quién hay que acompañar.
 *
 * Las cifras oficiales (promedio, aprobación, niveles) solo cuentan a los
 * estudiantes con definitiva no provisional; la vista lo dice explícitamente
 * para que nunca parezca que un promedio de 4 estudiantes es el de todo el grupo.
 */
export function PerformanceView() {
  const { analytics, dataset, students: visibleStudents, setView, setFilters, selectStudent } = useGradeCenter();
  const [showAll, setShowAll] = useState(false);
  const { group, students } = analytics;
  const total = students.length;
  const official = students.filter((item) => item.definitiva != null && !item.provisional);
  const approved = official.filter((item) => (item.definitiva as number) >= APPROVAL_GRADE).length;
  const inProgress = total - official.length;
  const groupLevel = levelFromScore(group.average);

  // Atención: por debajo del mínimo o con notas en descenso; primero las definitivas más bajas.
  const attention = students
    .filter((item) => item.attention || item.trend.direction === "down")
    .sort((a, b) => (a.definitiva ?? Number.POSITIVE_INFINITY) - (b.definitiva ?? Number.POSITIVE_INFINITY));

  const openStudent = (id: string) => {
    // Si un filtro lo oculta, la vista Estudiante saltaría a otro: se limpian los filtros.
    if (!visibleStudents.some((item) => item.student.id === id)) setFilters(EMPTY_FILTERS);
    selectStudent(id);
    setView("student");
  };
  const gradePending = () => {
    setFilters({ ...EMPTY_FILTERS, onlyPending: true });
    setView("standard");
  };

  if (dataset.evaluations.length === 0 || total === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-base font-semibold">Aún no hay datos de desempeño</div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total === 0 ? "Esta planilla no tiene estudiantes." : "Crea evaluaciones y registra notas para ver cómo va el grupo."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-5">
        <header>
          <h2 className="text-base font-semibold">Desempeño del grupo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {official.length === 0
              ? `Ningún estudiante tiene aún definitiva oficial (se necesita al menos ${PROVISIONAL_THRESHOLD}% de la ponderación evaluada).`
              : `Promedio, aprobación y niveles se calculan con ${official.length} de ${total} estudiantes: los que ya tienen al menos ${PROVISIONAL_THRESHOLD}% de la ponderación evaluada.`}
          </p>
        </header>

        {/* Tres cifras clave */}
        <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Promedio del grupo"
            value={formatGrade(group.average)}
            color={groupLevel ? LEVELS[groupLevel].color : undefined}
            detail={groupLevel ? LEVELS[groupLevel].short : "Sin definitivas oficiales"}
          />
          <Kpi
            label="Aprobación"
            value={official.length ? `${group.approvalPct}%` : "—"}
            color={official.length ? (group.approvalPct >= 80 ? LEVELS.alto.color : group.approvalPct >= 60 ? LEVELS.basico.color : LEVELS.bajo.color) : undefined}
            detail={official.length ? `${approved} de ${official.length} con ${formatGrade(APPROVAL_GRADE)} o más` : "Sin definitivas oficiales"}
          />
          <Kpi
            label="Notas por registrar"
            value={String(group.totalPending)}
            detail={group.totalPending > 0 ? `${group.pending.length} estudiantes con pendientes` : "Todo calificado"}
            action={group.totalPending > 0 ? { label: "Calificar pendientes", onClick: gradePending } : undefined}
          />
        </section>

        {/* Niveles del grupo completo */}
        <section aria-labelledby="niveles">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 id="niveles" className="text-sm font-semibold">
              Niveles
            </h3>
            <span className="gc-num text-xs text-muted-foreground">{total} estudiantes</span>
          </div>
          <LevelStack
            counts={group.distribution}
            total={total}
            label={`Niveles del grupo: ${official.length} con definitiva oficial, ${inProgress} en proceso`}
            size="md"
          />
          <div className="mt-2">
            <LevelLegend counts={group.distribution} restLabel="En proceso" rest={inProgress} />
          </div>
        </section>

        {/* A quién acompañar */}
        <section aria-labelledby="atencion">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 id="atencion" className="text-sm font-semibold">
              Requieren atención
            </h3>
            <span className="gc-num text-xs text-muted-foreground">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <p className="rounded-xl bg-[var(--gc-alto)]/10 px-3 py-2.5 text-sm text-[var(--gc-alto)]">
              Ningún estudiante está por debajo de {formatGrade(APPROVAL_GRADE)} ni con notas en descenso.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--gc-hair)] overflow-hidden rounded-xl border border-[var(--gc-hair)] bg-[var(--gc-ink)]">
              {(showAll ? attention : attention.slice(0, ATTENTION_LIMIT)).map((item) => (
                <AttentionRow key={item.student.id} metrics={item} onOpen={() => openStudent(item.student.id)} />
              ))}
            </ul>
          )}
          {attention.length > ATTENTION_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
              className="mt-2 text-xs font-medium text-[var(--gc-cobalt)] hover:underline"
            >
              {showAll ? "Mostrar menos" : `Mostrar los ${attention.length}`}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  color,
  action,
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--gc-hair)] bg-[var(--gc-ink)] px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="gc-num mt-1 text-2xl leading-none font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{detail}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 self-start text-xs font-medium text-[var(--gc-cobalt)] hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function AttentionRow({ metrics, onOpen }: { metrics: StudentMetrics; onOpen: () => void }) {
  const level = metrics.level;
  const reasons = [
    metrics.attention ? `Por debajo de ${formatGrade(APPROVAL_GRADE)}` : null,
    metrics.trend.direction === "down" ? "En descenso" : null,
    metrics.provisional && metrics.definitiva != null ? "Definitiva provisional" : null,
  ].filter(Boolean) as string[];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.03] focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            backgroundColor: level ? levelTint(level, 0.16) : "color-mix(in oklab, var(--foreground) 7%, transparent)",
            color: level ? LEVELS[level].color : "var(--muted-foreground)",
          }}
        >
          {initials(metrics.student)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{metrics.student.fullName}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {metrics.trend.direction === "down" && <TrendingDown className="size-3 text-[var(--gc-bajo)]" aria-hidden />}
            {reasons.join(" · ")}
          </span>
        </span>
        <span
          className={cn("gc-num shrink-0 text-sm font-semibold")}
          style={{ color: level ? LEVELS[level].color : "var(--muted-foreground)" }}
        >
          {formatGrade(metrics.definitiva)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" aria-hidden />
      </button>
    </li>
  );
}

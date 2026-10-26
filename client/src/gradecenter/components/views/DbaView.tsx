import { useMemo, useState } from "react";
import {
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Plus,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, levelFromScore, levelTint } from "../../domain/scale";
import type { LevelId } from "../../types";
import { formatGrade, initials } from "../../lib/format";
import { DistributionBars, LevelBadge, LevelBar, MetricTile, ScoreChip } from "../insights/primitives";
import { Section } from "../insights/layout";
import { DbaPeriodManagerModal } from "../dba/DbaPeriodManagerModal";

/**
 * Vista DBA y Gestión de Descriptores (Decreto 1290).
 *
 * Los Derechos Básicos de Aprendizaje son los referentes de calidad nacional
 * del MEN. Cada evaluación de clase aporta evidencia a uno o más DBAs, y a partir
 * del nivel de logro (Superior, Alto, Básico, Bajo), se genera el juicio valorativo
 * oficial que se imprime en los boletines escolares.
 */
export function DbaView() {
  const { dataset, analytics, students } = useGradeCenter();
  const [selectedDba, setSelectedDba] = useState<string>(() => dataset.dba[0]?.id ?? "");
  const [managerOpen, setManagerOpen] = useState(false);

  // Sincronizar selección si cambia la lista
  const activeSelectedDba = useMemo(() => {
    if (dataset.dba.some((d) => d.id === selectedDba)) return selectedDba;
    return dataset.dba[0]?.id ?? "";
  }, [dataset.dba, selectedDba]);

  const stats = useMemo(
    () =>
      dataset.dba.map((dba) => {
        const evaluations = dataset.evaluations.filter((item) => item.dbaIds.includes(dba.id));
        const outcomes = students
          .map((metrics) => metrics.dba.find((item) => item.id === dba.id))
          .filter((item): item is NonNullable<typeof item> => item != null && item.evidenceCount > 0);

        const averages = outcomes.map((item) => item.avg).filter((value): value is number => value != null);
        const avg = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

        const distribution: Record<LevelId, number> = { bajo: 0, basico: 0, alto: 0, superior: 0 };
        outcomes.forEach((item) => {
          if (item.level) distribution[item.level] += 1;
        });

        return {
          dba,
          evaluations,
          outcomes,
          avg: avg == null ? null : Math.round(avg * 10) / 10,
          level: levelFromScore(avg),
          distribution,
          evidenceCount: evaluations.length,
        };
      }),
    [dataset, students],
  );

  const current = stats.find((item) => item.dba.id === activeSelectedDba) ?? stats[0];

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
        {/* Cabecera Principal de la Vista DBA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="glass flex size-12 items-center justify-center rounded-2xl text-[var(--gc-cobalt)] shadow-sm">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <div className="text-[17px] font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                Derechos Básicos de Aprendizaje (DBA)
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{dataset.course} · {dataset.subject} · {dataset.period}</span>
                <span>•</span>
                <span>{dataset.dba.length} {dataset.dba.length === 1 ? "DBA vinculado" : "DBAs vinculados"}</span>
                <span>•</span>
                <span>{dataset.evaluations.length} evaluaciones en planilla</span>
              </div>
            </div>
          </div>

          {/* Botón Gestión de DBAs */}
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>Gestionar DBAs y Descriptores</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* CASO A: EMPTY STATE CUANDO NO HAY DBAS CONFIGURADOS      */}
        {/* ========================================================= */}
        {dataset.dba.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center border border-white/8 space-y-4 max-w-2xl mx-auto my-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BookOpen className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">
                No hay DBAs vinculados para {dataset.course} en este periodo
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Según el <strong>Decreto 1290 de 2009</strong> y las directrices del MEN, las calificaciones del boletín
                deben fundamentarse en los Derechos Básicos de Aprendizaje. Vincula los DBAs oficiales para habilitar
                la analítica por competencias y redactar los juicios valorativos automáticos.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Explorar Catálogo Oficial MEN y Vincular DBAs</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CASO B: SELECTOR Y DETALLE PROFUNDO DEL DBA SELECCIONADO  */
          /* ========================================================= */
          <>
            {/* Carrusel / Grid de Píldoras de DBAs del Periodo */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((item) => {
                const active = item.dba.id === current?.dba.id;
                return (
                  <button
                    key={item.dba.id}
                    type="button"
                    onClick={() => setSelectedDba(item.dba.id)}
                    className={cn(
                      "rounded-2xl border p-3.5 text-left transition-all cursor-pointer",
                      active
                        ? "border-[var(--gc-cobalt)]/60 bg-[var(--gc-cobalt)]/12 shadow-sm"
                        : "border-white/8 bg-white/3 hover:bg-white/6",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="gc-num text-[11px] font-bold text-[var(--gc-cobalt)]">
                          {item.dba.code}
                        </span>
                        {item.dba.dimension && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded bg-white/6 text-muted-foreground">
                            {item.dba.dimension}
                          </span>
                        )}
                      </div>
                      <LevelBadge level={item.level} score={item.avg} size="xs" />
                    </div>
                    <div className="mt-1.5 truncate text-[12.5px] font-semibold text-foreground">
                      {item.dba.title}
                    </div>
                    <div className="mt-2.5">
                      <LevelBar score={item.avg} showTicks={false} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="gc-num">{item.evidenceCount} evaluaciones asociadas</span>
                      <span className="gc-num font-medium">{item.outcomes.length} con registro</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Panel Principal del DBA Activo */}
            {current && (
              <div className="glass gc-rise space-y-6 rounded-3xl p-5 sm:p-6 border border-white/8">
                {/* Cabecera del DBA Activo con Métricas Clave */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="gc-num text-xs font-bold text-[var(--gc-cobalt)]">
                        {current.dba.code}
                      </span>
                      <LevelBadge level={current.level} />
                      {current.dba.dimension && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Dimensión {current.dba.dimension}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-base font-bold text-foreground">
                      {current.dba.title}
                    </div>
                    <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                      {current.dba.statement}
                    </p>
                  </div>

                  <div className="grid w-full sm:w-auto grid-cols-3 gap-2.5 shrink-0">
                    <MetricTile
                      label="Nivel promedio"
                      value={current.level ? LEVELS[current.level].short : "—"}
                      hint={formatGrade(current.avg)}
                      accent={current.level ? LEVELS[current.level].color : undefined}
                    />
                    <MetricTile label="Evidencias" value={current.evidenceCount} hint="evaluaciones" />
                    <MetricTile
                      label="En riesgo"
                      value={current.distribution.bajo}
                      hint="nivel bajo"
                      accent={current.distribution.bajo > 0 ? LEVELS.bajo.color : undefined}
                    />
                  </div>
                </div>

                {/* ========================================================= */}
                {/* SECCIÓN NUEVA: DESCRIPTORES PARA BOLETÍN (DECRETO 1290)   */}
                {/* ========================================================= */}
                <div className="space-y-3 pt-3 border-t border-white/8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-blue-500" />
                        <span>Descriptores Oficiales para Boletín (Decreto 1290)</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Texto pedagógico que se imprimirá en el boletín del estudiante según su calificación definitiva en este DBA.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManagerOpen(true)}
                      className="text-xs font-semibold text-[var(--gc-cobalt)] hover:underline inline-flex items-center gap-1"
                    >
                      <Edit3 className="size-3" />
                      <span>Modificar en editor</span>
                    </button>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {/* Superior */}
                    <div className="p-3.5 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                          Desempeño Superior (4.6 – 5.0)
                        </span>
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {current.dba.descriptors?.superior ||
                          "Demuestra dominio conceptual profundo y pensamiento crítico al aplicar los saberes de este DBA en situaciones complejas con alta solvencia y autonomía."}
                      </p>
                    </div>

                    {/* Alto */}
                    <div className="p-3.5 rounded-2xl bg-blue-500/8 border border-blue-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                          Desempeño Alto (4.0 – 4.5)
                        </span>
                        <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {current.dba.descriptors?.alto ||
                          "Alcanza satisfactoriamente las competencias previstas en este DBA, comprendiendo los conceptos esenciales y aplicándolos correctamente en las actividades de clase."}
                      </p>
                    </div>

                    {/* Básico */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                          Desempeño Básico (3.0 – 3.9)
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Umbral Aprobatorio</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {current.dba.descriptors?.basico ||
                          "Reconoce los aprendizajes mínimos indispensables del DBA, logrando el nivel de suficiencia requerido pero manifestando dudas que supera con acompañamiento."}
                      </p>
                    </div>

                    {/* Bajo */}
                    <div className="p-3.5 rounded-2xl bg-rose-500/8 border border-rose-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                          Desempeño Bajo (1.0 – 2.9)
                        </span>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Plan de Mejoramiento</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {current.dba.descriptors?.bajo ||
                          "Presenta dificultades significativas para comprender y aplicar las competencias estructurantes de este DBA. Requiere taller de nivelación y plan de apoyo pedagógico."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Distribución y Evaluaciones Asociadas */}
                <div className="grid gap-4 lg:grid-cols-2 pt-2 border-t border-white/8">
                  <Section title="Distribución de Niveles del Grupo" hint={`${current.outcomes.length} estudiantes calificados`}>
                    <DistributionBars distribution={current.distribution} total={current.outcomes.length} />
                  </Section>

                  <Section title="Evaluaciones que aportan evidencia" hint="desde la planilla de notas">
                    <div className="space-y-1.5">
                      {current.evaluations.map((evaluation) => {
                        const metric = analytics.byEvaluation.get(evaluation.id);
                        if (!metric) return null;
                        return (
                          <div
                            key={evaluation.id}
                            className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2"
                          >
                            <BookOpenCheck className="size-3.5 shrink-0 text-[var(--gc-cobalt)]" />
                            <span className="gc-num w-7 shrink-0 text-[10.5px] font-bold text-muted-foreground">
                              {evaluation.code}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{evaluation.name}</span>
                            <span className="gc-num shrink-0 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-white/5">
                              {evaluation.weight}%
                            </span>
                            <ScoreChip score={metric.avg} size="xs" />
                          </div>
                        );
                      })}
                      {current.evaluations.length === 0 && (
                        <div className="p-3 text-center rounded-xl border border-dashed border-white/10 text-xs text-muted-foreground">
                          Ninguna evaluación de la planilla tiene asignado este DBA todavía.
                        </div>
                      )}
                    </div>
                  </Section>
                </div>

                {/* Desglose por Estudiante */}
                <Section title="Evidencias y nivel individual por estudiante" hint="cálculo dinámico basado en las notas de clase">
                  <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3 max-h-80 overflow-y-auto pr-1 gc-scroll">
                    {current.outcomes
                      .slice()
                      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
                      .map((outcome) => {
                        const metrics = students.find((item) =>
                          item.dba.some((dba) => dba.id === current.dba.id && dba === outcome),
                        );
                        const student = metrics?.student;
                        if (!student) return null;
                        return (
                          <Tooltip key={student.id}>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-2.5 py-2 hover:bg-white/6 transition-colors">
                                <span
                                  className="flex size-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold"
                                  style={{
                                    borderColor: outcome.level
                                      ? levelTint(outcome.level, 0.45)
                                      : "oklch(1 0 0 / 12%)",
                                    backgroundColor: outcome.level ? levelTint(outcome.level, 0.16) : undefined,
                                    color: outcome.level ? LEVELS[outcome.level].color : undefined,
                                  }}
                                >
                                  {initials(student)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium text-foreground">
                                    {student.fullName}
                                  </span>
                                  <span className="gc-num block text-[9.5px] text-muted-foreground">
                                    {outcome.evaluations
                                      .filter((e) => e.grade != null)
                                      .map((e) => e.evaluation.code)
                                      .join(", ") || "Sin notas"}
                                  </span>
                                </span>
                                <span
                                  className="gc-num shrink-0 text-xs font-bold"
                                  style={{ color: outcome.level ? LEVELS[outcome.level].color : undefined }}
                                >
                                  {formatGrade(outcome.avg)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-72">
                              <div className="text-xs font-bold">
                                {student.fullName} · {outcome.code}
                              </div>
                              <p className="mt-1 text-[10.5px] opacity-85 leading-relaxed">
                                {outcome.level
                                  ? (current.dba.descriptors?.[outcome.level] ?? outcome.statement)
                                  : outcome.statement}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Liquid Glass de Gestión de DBAs */}
      <DbaPeriodManagerModal open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}

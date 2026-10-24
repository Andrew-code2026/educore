import { useState } from "react";
import { CalendarDays, LayoutList, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { TYPE_META } from "../../data/curriculum";
import { LEVELS, levelFromScore, levelTint } from "../../domain/scale";
import { formatGrade, formatShortDate, studentDisplayName } from "../../lib/format";
import { LevelBadge, MicroBars } from "../insights/primitives";
import { ScaleLegend } from "./MatrixViews";

type Mode = "comparison" | "heatmap";

/**
 * Vista Evaluaciones.
 *
 * Prioriza la comparación entre actividades. La tabla compara evaluaciones
 * entre sí y el mapa transpuesto muestra la misma información al revés:
 * evaluaciones en las filas, estudiantes en las columnas.
 */
export function EvaluationsView() {
  const { analytics, dataset, selectEvaluation, jumpToCell, selectStudent } = useGradeCenter();
  const [mode, setMode] = useState<Mode>("comparison");
  const group = analytics.group;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/6 px-3 py-2">
        <div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-white/4 p-0.5">
          <ModeButton
            active={mode === "comparison"}
            onClick={() => setMode("comparison")}
            icon={<LayoutList className="size-3.5" />}
            label="Comparación"
          />
          <ModeButton
            active={mode === "heatmap"}
            onClick={() => setMode("heatmap")}
            icon={<Grid3x3 className="size-3.5" />}
            label="Mapa transpuesto"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {mode === "comparison"
            ? "Cada fila es una evaluación del periodo, con su peso, avance y promedio."
            : "Las mismas notas al revés: evaluaciones por fila, estudiantes por columna."}
        </span>
      </div>

      <div className="gc-scroll min-h-0 flex-1 overflow-auto p-3">
        {mode === "comparison" ? (
          <div className="space-y-3">
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                    <Th className="w-12">Código</Th>
                    <Th>Evaluación</Th>
                    <Th className="w-20">Fecha</Th>
                    <Th className="w-14 text-right">Peso</Th>
                    <Th className="w-56">Promedio</Th>
                    <Th className="w-24 text-right">Avance</Th>
                    <Th className="w-20 text-right">Pend.</Th>
                    <Th className="w-28">Nivel</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.evaluations.map((metric) => {
                    const level = metric.level;
                    return (
                      <tr
                        key={metric.evaluation.id}
                        onClick={() => selectEvaluation(metric.evaluation.id)}
                        className="group cursor-pointer transition-colors hover:bg-white/6"
                      >
                        <Td>
                          <span className="gc-num text-xs font-semibold text-[var(--gc-cobalt)]">
                            {metric.evaluation.code}
                          </span>
                        </Td>
                        <Td>
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium">
                              {metric.evaluation.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{TYPE_META[metric.evaluation.type].label}</span>
                              <span className="opacity-40">·</span>
                              <span className="gc-num">{metric.evaluation.period}</span>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <span className="gc-num flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="size-3" />
                            {formatShortDate(metric.evaluation.date)}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <span className="gc-num text-xs">{metric.evaluation.weight}%</span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                              <span
                                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                                style={{
                                  width: `${metric.avg != null ? ((metric.avg - 1) / 4) * 100 : 0}%`,
                                  background: level ? levelTint(level, 0.85) : "transparent",
                                }}
                              />
                            </span>
                            <span className="gc-num w-8 shrink-0 text-right text-[12px] font-semibold">
                              {formatGrade(metric.avg)}
                            </span>
                          </div>
                        </Td>
                        <Td className="text-right">
                          <span className="gc-num text-xs text-muted-foreground">
                            {metric.evaluatedPct}%
                          </span>
                        </Td>
                        <Td className="text-right">
                          <span
                            className="gc-num text-xs"
                            style={{ color: metric.pending > 0 ? "var(--gc-bajo)" : "var(--muted-foreground)" }}
                          >
                            {metric.pending}
                          </span>
                        </Td>
                        <Td>
                          <LevelBadge level={level} size="xs" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.evaluations.map((metric) => (
                <button
                  key={metric.evaluation.id}
                  type="button"
                  onClick={() => selectEvaluation(metric.evaluation.id)}
                  className="glass-soft rounded-2xl p-3 text-left transition-colors hover:bg-white/8"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="gc-num text-xs font-semibold text-[var(--gc-cobalt)]">
                      {metric.evaluation.code}
                    </span>
                    <LevelBadge level={metric.level} score={metric.avg} size="xs" />
                  </div>
                  <div className="mt-1 truncate text-xs font-medium">{metric.evaluation.name}</div>
                  <MicroBars
                    className="mt-2"
                    values={dataset.students.map(
                      (student) => analytics.byStudent.get(student.id)?.grades[metric.evaluation.order] ?? null,
                    )}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Peso {metric.evaluation.weight}%</span>
                    <span className="gc-num">{metric.evaluatedPct}% evaluado</span>
                  </div>
                </button>
              ))}
            </div>

            <ScaleLegend className="glass-soft rounded-2xl p-2.5" />
          </div>
        ) : (
          <Heatmap />
        )}
      </div>
    </div>
  );
}

/** Mapa transpuesto: filas = evaluaciones, columnas = estudiantes. */
function Heatmap() {
  const { dataset, analytics, selectEvaluation, jumpToCell, selectStudent } = useGradeCenter();

  return (
    <div className="space-y-3">
      <div className="glass gc-scroll overflow-auto rounded-2xl">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="gc-solid-deep sticky top-0 left-0 z-30 border-b border-white/8 px-3 py-2 text-left">
                <span className="gc-label text-xs">Evaluación</span>
              </th>
              {dataset.students.map((student) => (
                <th
                  key={student.id}
                  className="gc-solid-deep sticky top-0 z-20 border-b border-white/8 px-0.5 py-2 align-bottom"
                >
                  <span
                    className="mx-auto block w-[13px] truncate text-xs text-muted-foreground"
                    style={{ writingMode: "vertical-rl", height: 74 }}
                    title={student.fullName}
                  >
                    {studentDisplayName(student, 16)}
                  </span>
                </th>
              ))}
              <th className="gc-solid-deep sticky top-0 right-0 z-30 border-b border-white/8 px-2 py-2 text-right">
                <span className="gc-label text-xs">Prom.</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dataset.evaluations.map((evaluation) => {
              const metric = analytics.byEvaluation.get(evaluation.id)!;
              return (
                <tr key={evaluation.id} className="group">
                  <th
                    className="gc-solid sticky left-0 z-20 border-b border-white/6 px-3 py-0.5 text-left font-normal"
                    style={{ height: 24 }}
                  >
                    <button
                      type="button"
                      onClick={() => selectEvaluation(evaluation.id)}
                      className="flex min-w-[188px] items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/8"
                    >
                      <span className="gc-num w-7 shrink-0 text-xs font-semibold text-[var(--gc-cobalt)]">
                        {evaluation.code}
                      </span>
                      <span className="w-11 shrink-0 truncate text-xs">{evaluation.shortName}</span>
                      <span className="gc-num w-8 shrink-0 text-xs text-muted-foreground">
                        {evaluation.weight}%
                      </span>
                    </button>
                  </th>

                  {dataset.students.map((student) => {
                    const grade = analytics.byStudent.get(student.id)?.grades[evaluation.order] ?? null;
                    const level = levelFromScore(grade);
                    return (
                      <td key={student.id} className="border-b border-white/6 p-[2px]">
                        <Tooltip key={student.id} label={`${student.fullName} · ${evaluation.code}`} grade={grade}>
                          <button
                            type="button"
                            onClick={() => {
                              selectStudent(student.id);
                              jumpToCell(student.id, evaluation.id);
                            }}
                            className="mx-auto block size-[13px] rounded-[3px] transition-transform hover:scale-[1.35]"
                            style={{
                              backgroundColor: level
                                ? levelTint(level, 0.85)
                                : "oklch(1 0 0 / 7%)",
                              boxShadow:
                                grade == null ? "inset 0 0 0 1px oklch(1 0 0 / 10%)" : undefined,
                            }}
                          />
                        </Tooltip>
                      </td>
                    );
                  })}

                  <td className="gc-solid sticky right-0 z-20 border-b border-white/6 px-2 text-right">
                    <span
                      className="gc-num text-xs font-semibold"
                      style={{ color: metric.level ? LEVELS[metric.level].color : undefined }}
                    >
                      {formatGrade(metric.avg)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ScaleLegend className="glass-soft rounded-2xl p-2.5" />
    </div>
  );
}

function Tooltip({
  children,
  label,
  grade,
}: {
  children: React.ReactNode;
  label: string;
  grade: number | null;
}) {
  return (
    <span
      className="block"
      title={`${label} — ${grade == null ? "pendiente" : formatGrade(grade)}`}
    >
      {children}
    </span>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
        active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-white/8 px-3 py-2 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-white/6 px-3 py-1.5", className)}>{children}</td>;
}
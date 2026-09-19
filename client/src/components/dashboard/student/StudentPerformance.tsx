import React, { useState, useMemo } from "react";
import {
  BarChart3,
  ChevronRight,
  Award,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MenPerformanceLevel } from "./types";

interface GradeItem {
  id: number | string;
  subject: string;
  period: string;
  value: number;
  studentName?: string;
  course?: string;
}

interface StudentPerformanceProps {
  grades: GradeItem[];
  availablePeriods: string[];
  activePeriod?: string;
  onOpenReports: () => void;
}

const getMenLevel = (val: number): MenPerformanceLevel => {
  if (val >= 4.6) return "Superior";
  if (val >= 4.0) return "Alto";
  if (val >= 3.0) return "Básico";
  return "Bajo";
};

const LEVEL_COLORS: Record<
  MenPerformanceLevel,
  { label: string; badge: string; text: string; bg: string }
> = {
  Superior: {
    label: "Superior",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  Alto: {
    label: "Alto",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  Básico: {
    label: "Básico",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  Bajo: {
    label: "Bajo",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    text: "text-rose-700",
    bg: "bg-rose-50",
  },
};

export function StudentPerformance({
  grades,
  availablePeriods,
  activePeriod = "Periodo 2",
  onOpenReports,
}: StudentPerformanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const filteredGrades = useMemo(() => {
    if (selectedPeriod === "all") return grades;
    return grades.filter((g) => g.period === selectedPeriod);
  }, [grades, selectedPeriod]);

  const periodAverage = useMemo(() => {
    if (!filteredGrades.length) return 0;
    const sum = filteredGrades.reduce((acc, g) => acc + g.value, 0);
    return Math.round((sum / filteredGrades.length) * 10) / 10;
  }, [filteredGrades]);

  const menLevel = getMenLevel(periodAverage);
  const levelStyle = LEVEL_COLORS[menLevel];

  return (
    <section
      aria-label="Mi rendimiento"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Mi rendimiento
              </h2>
              {periodAverage > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold py-0 px-2"
                >
                  Prom. {periodAverage.toFixed(1)}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Calificaciones publicadas y escala oficial MEN Colombia.
            </p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setSelectedPeriod("all")}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                selectedPeriod === "all"
                  ? "bg-white font-semibold text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos
            </button>
            {availablePeriods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  selectedPeriod === p
                    ? "bg-white font-semibold text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenReports}
            className="hidden md:inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition ml-1"
          >
            <span>Ver boletín</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Summary KPI banner */}
      {filteredGrades.length > 0 && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {selectedPeriod === "all" ? "Promedio acumulado" : `Promedio ${selectedPeriod}`}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">
                  {periodAverage.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ 5.0</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Nivel MEN
              </span>
              <div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelStyle.badge}`}
                >
                  {levelStyle.label}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Registros
            </span>
            <p className="text-xs font-semibold text-slate-700">
              {filteredGrades.length} nota{filteredGrades.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}

      {/* Grades List */}
      {filteredGrades.length > 0 ? (
        <div className="space-y-2">
          {filteredGrades.map((item) => {
            const itemLevel = getMenLevel(item.value);
            const isApproved = item.value >= 3.0;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:bg-slate-50/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-800">
                      {item.subject}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-medium text-slate-500 border-slate-200 py-0 px-1.5"
                    >
                      {item.period}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Aprobado</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        <span>En refuerzo</span>
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Nivel {itemLevel}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-base sm:text-lg font-bold tracking-tight ${
                      item.value >= 4.0
                        ? "text-emerald-600"
                        : item.value >= 3.0
                          ? "text-slate-900"
                          : "text-rose-600"
                    }`}
                  >
                    {item.value.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500">
            No se encontraron calificaciones registradas para este filtro.
          </p>
        </div>
      )}

      {/* Footer link to official report */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          ¿Deseas descargar tu informe académico acumulado?
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenReports}
          className="h-7 text-xs font-semibold text-slate-700 hover:text-blue-700 border-slate-200 shadow-2xs"
        >
          <span>Boletín oficial</span>
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </section>
  );
}

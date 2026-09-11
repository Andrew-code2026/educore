import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Check, Save, Sparkles, X, BarChart3 } from "lucide-react";
import { numberValue } from "./gradeCenterUtils";

export type GradeFilterKey = "ALL" | "PENDING" | "LOW" | "PASSING" | "COMMENT";

interface GradeCenterToolbarProps {
  courses: Array<{ id: number; name: string }>;
  subjects: Array<{ id: number; name: string }>;
  periods: Array<{ id: number; name: string }>;
  selectedCourseId?: number;
  selectedSubjectId?: number;
  selectedPeriodId?: number;
  onCourseChange: (id: number) => void;
  onSubjectChange: (id: number) => void;
  onPeriodChange: (id: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentFilter: GradeFilterKey;
  onFilterChange: (filter: GradeFilterKey) => void;
  pendingCount: number;
  isSavingAll: boolean;
  onSaveAll: () => void;
  onNewAssessment: () => void;
  stats: {
    average: number | null;
    students: number;
    assessments: number;
    completion: number;
  };
  weightTotal: number;
  selectedCount?: number;
  onClearSelection?: () => void;
  onOpenBulkGrade?: () => void;
  canWrite?: boolean;
  showStats?: boolean;
  onToggleStats?: () => void;
}

export function GradeCenterToolbar({
  courses,
  subjects,
  periods,
  selectedCourseId,
  selectedSubjectId,
  selectedPeriodId,
  onCourseChange,
  onSubjectChange,
  onPeriodChange,
  searchQuery,
  onSearchChange,
  currentFilter,
  onFilterChange,
  pendingCount,
  isSavingAll,
  onSaveAll,
  onNewAssessment,
  stats,
  weightTotal,
  selectedCount = 0,
  onClearSelection,
  onOpenBulkGrade,
  canWrite = true,
  showStats = false,
  onToggleStats,
}: GradeCenterToolbarProps) {
  const filterOptions: Array<{ key: GradeFilterKey; label: string }> = [
    { key: "ALL", label: "Todos" },
    { key: "PENDING", label: "Sin calificar" },
    { key: "LOW", label: "Bajo desempeño (< 3.0)" },
    { key: "PASSING", label: "Aprobados (≥ 3.0)" },
    { key: "COMMENT", label: "Con comentario" },
  ];

  return (
    <div className="space-y-3.5">
      {/* BARRA DE CONTEXTO Y ACCIONES PRINCIPALES (Liquid Glass sutil) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/75 p-3.5 shadow-[0_8px_30px_rgba(29,78,137,0.05),0_0_0_1px_rgba(255,255,255,0.7)_inset] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 sm:flex-row sm:items-center sm:justify-between">
        {/* Selectores de Curso, Materia y Periodo */}
        <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:max-w-2xl">
          {/* Selector de Curso */}
          <div className="relative">
            <select
              value={selectedCourseId ?? ""}
              onChange={e => onCourseChange(Number(e.target.value))}
              aria-label="Seleccionar curso"
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="" disabled>Seleccionar curso</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  Curso: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Materia */}
          <div className="relative">
            <select
              value={selectedSubjectId ?? ""}
              onChange={e => onSubjectChange(Number(e.target.value))}
              aria-label="Seleccionar materia"
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="" disabled>Seleccionar materia</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  Materia: {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Periodo */}
          <div className="relative">
            <select
              value={selectedPeriodId ?? ""}
              onChange={e => onPeriodChange(Number(e.target.value))}
              aria-label="Seleccionar periodo académico"
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="" disabled>Seleccionar periodo</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Botón de Estadísticas */}
          {onToggleStats && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleStats}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition-all ${
                showStats
                  ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/40 text-[var(--edc-primary)] shadow-xs dark:bg-blue-950/60 dark:text-blue-300"
                  : "border-slate-200/80 bg-white/80 text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-[var(--edc-primary)]" />
              {showStats ? "Ocultar estadísticas" : "Estadísticas"}
            </Button>
          )}

          {/* Botón de Calificación Masiva */}
          {canWrite && onOpenBulkGrade && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenBulkGrade}
              className="h-9 rounded-xl border-[var(--edc-primary)]/40 bg-[var(--edc-secondary)]/30 px-3 text-xs font-semibold text-[var(--edc-primary)] shadow-xs hover:bg-[var(--edc-secondary)]/50 transition-all dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[var(--edc-primary)]" />
              Calificación masiva
            </Button>
          )}

          {canWrite && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewAssessment}
              className="h-9 rounded-xl border-slate-200/80 bg-white/80 px-3 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5 text-[var(--edc-primary)]" />
              Nueva evaluación
            </Button>
          )}

          {/* Botón de Guardar Todo si hay cambios pendientes */}
          {canWrite && (
            <Button
              type="button"
              size="sm"
              disabled={isSavingAll || pendingCount === 0}
              onClick={onSaveAll}
              className={`h-9 rounded-xl px-4 text-xs font-semibold transition-all ${
                pendingCount > 0
                  ? "bg-[var(--edc-primary)] text-white shadow-[0_4px_14px_rgba(36,117,207,0.3)] animate-pulse"
                  : "bg-slate-100 text-slate-400 border border-slate-200/60 shadow-none dark:bg-slate-800"
              }`}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {isSavingAll
                ? "Guardando..."
                : pendingCount > 0
                ? `Guardar cambios (${pendingCount})`
                : "Sin cambios"}
            </Button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS, BÚSQUEDA Y SELECCIÓN */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Buscador de Estudiante */}
          <div className="relative min-w-[220px] sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="h-9 rounded-xl border-slate-200/80 bg-white/90 pl-8.5 pr-3 text-xs placeholder:text-slate-400 focus-visible:border-[var(--edc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--edc-secondary)] dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          {/* Indicador de Selección Activa */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-800 backdrop-blur-xs animate-in fade-in dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-200">
              <span>
                <strong>{selectedCount}</strong> seleccionado{selectedCount === 1 ? "" : "s"}
              </span>
              {onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  title="Deseleccionar todos"
                  className="rounded-md p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Píldoras de Filtro (Glass sutil) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {filterOptions.map(opt => {
            const isActive = currentFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onFilterChange(opt.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--edc-primary)] text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LÍNEA DE ESTADO / RESUMEN ACADÉMICO SUTIL */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50/70 px-3.5 py-2 text-xs text-slate-500 dark:bg-slate-900/40">
        <span>
          Promedio del curso:{" "}
          <strong className="font-semibold text-slate-800 dark:text-slate-200">
            {numberValue(stats.average)}
          </strong>
        </span>
        <span className="text-slate-300 dark:text-slate-700">·</span>
        <span>
          <strong className="font-semibold text-slate-800 dark:text-slate-200">{stats.students}</strong> estudiantes
        </span>
        <span className="text-slate-300 dark:text-slate-700">·</span>
        <span>
          <strong className="font-semibold text-slate-800 dark:text-slate-200">{stats.assessments}</strong> evaluaciones
        </span>
        <span className="text-slate-300 dark:text-slate-700">·</span>
        <span>
          Completitud:{" "}
          <strong className="font-semibold text-slate-800 dark:text-slate-200">{stats.completion}%</strong>
        </span>
        {weightTotal !== 100 && (
          <>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-semibold text-amber-600">
              Ponderación acumulada: {weightTotal}% {weightTotal < 100 ? `(Falta ${100 - weightTotal}%)` : `(Excede en ${weightTotal - 100}%)`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Plus,
  Filter,
  Check,
  Save,
  Sparkles,
  X,
  BarChart3,
  ChevronDown,
  Eye,
  Activity,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import { numberValue } from "./gradeCenterUtils";

export type GradeFilterKey = "ALL" | "PENDING" | "LOW" | "PASSING" | "COMMENT";
export type GradeViewMode = "NOTES" | "PERFORMANCE" | "RISK" | "PENDING";

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
  viewMode?: GradeViewMode;
  onViewModeChange?: (mode: GradeViewMode) => void;
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
  viewMode = "NOTES",
  onViewModeChange,
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
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);

  const filterOptions: Array<{ key: GradeFilterKey; label: string }> = [
    { key: "ALL", label: "Todos los estudiantes" },
    { key: "PENDING", label: "Sin calificar (pendientes)" },
    { key: "LOW", label: "Bajo desempeño (< 3.0)" },
    { key: "PASSING", label: "Aprobados (≥ 3.0)" },
    { key: "COMMENT", label: "Con comentarios registrados" },
  ];

  const viewOptions: Array<{ key: GradeViewMode; label: string; icon: any; desc: string }> = [
    {
      key: "NOTES",
      label: "Notas",
      icon: FileSpreadsheet,
      desc: "Grilla estándar de calificación rápida",
    },
    {
      key: "PERFORMANCE",
      label: "Rendimiento",
      icon: Activity,
      desc: "Indicadores de tendencia ↑ → ↓",
    },
    {
      key: "RISK",
      label: "Riesgo",
      icon: AlertTriangle,
      desc: "Prioriza alertas de atención académica",
    },
    {
      key: "PENDING",
      label: "Pendientes",
      icon: Clock,
      desc: "Resalta estudiantes con notas faltantes",
    },
  ];

  const activeFilterLabel =
    filterOptions.find(f => f.key === currentFilter)?.label || "Todos";
  const activeViewLabel =
    viewOptions.find(v => v.key === viewMode)?.label || "Notas";

  return (
    <div className="space-y-3">
      {/* BARRA DE CONTEXTO ACADÉMICO Y ACCIONES */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
        {/* Selectores de Curso, Materia y Periodo */}
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:max-w-xl">
          {/* Selector de Curso */}
          <div className="relative">
            <select
              value={selectedCourseId ?? ""}
              onChange={e => onCourseChange(Number(e.target.value))}
              aria-label="Seleccionar curso"
              className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-[var(--edc-accent)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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

        {/* Acciones Rápidas Primarias */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Botón de Estadísticas */}
          {onToggleStats && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleStats}
              className={`h-8.5 rounded-xl px-3 text-xs font-semibold transition-all ${
                showStats
                  ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/40 text-[var(--edc-primary)] shadow-xs dark:bg-blue-950/60 dark:text-blue-300"
                  : "border-slate-200/80 bg-white text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              className="h-8.5 rounded-xl border-[var(--edc-primary)]/40 bg-[var(--edc-secondary)]/30 px-3 text-xs font-semibold text-[var(--edc-primary)] shadow-xs hover:bg-[var(--edc-secondary)]/50 transition-all dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[var(--edc-primary)]" />
              Calificación masiva
            </Button>
          )}

          {/* Botón Nueva Evaluación */}
          {canWrite && (
            <Button
              type="button"
              size="sm"
              onClick={onNewAssessment}
              className="h-8.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva evaluación
            </Button>
          )}

          {/* Botón Guardar Cambios Pendientes */}
          {canWrite && (
            <Button
              type="button"
              size="sm"
              disabled={isSavingAll || pendingCount === 0}
              onClick={onSaveAll}
              className={`h-8.5 rounded-xl px-3.5 text-xs font-semibold transition-all ${
                pendingCount > 0
                  ? "bg-[var(--edc-primary)] text-white shadow-[0_4px_14px_rgba(36,117,207,0.35)] animate-pulse"
                  : "bg-slate-100 text-slate-400 border border-slate-200/60 shadow-none dark:bg-slate-800 dark:border-slate-700"
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

      {/* BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTROS Y MODO DE VISTA */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Buscador de Estudiante */}
          <div className="relative min-w-[200px] sm:w-60">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="h-8.5 rounded-xl border-slate-200/80 bg-white pl-8.5 pr-3 text-xs placeholder:text-slate-400 focus-visible:border-[var(--edc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--edc-secondary)] dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          {/* DESPLEGABLE COMPACTO DE FILTROS */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-8.5 rounded-xl px-3 text-xs font-semibold transition-all ${
                  currentFilter !== "ALL"
                    ? "border-[var(--edc-primary)] bg-[var(--edc-primary)]/10 text-[var(--edc-primary)]"
                    : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                <span>Filtros</span>
                {currentFilter !== "ALL" && (
                  <span className="ml-1.5 rounded-full bg-[var(--edc-primary)] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    1
                  </span>
                )}
                <ChevronDown className="ml-1.5 h-3 w-3 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-64 p-2 rounded-2xl border border-slate-200/90 shadow-xl bg-white dark:border-slate-800 dark:bg-slate-900 text-xs"
            >
              <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Filtrar estudiantes
                </p>
              </div>
              <div className="space-y-1 pt-1.5">
                {filterOptions.map(opt => {
                  const isSelected = currentFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        onFilterChange(opt.key);
                        setFilterOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-[var(--edc-primary)]/10 font-bold text-[var(--edc-primary)]"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[var(--edc-primary)]" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* DESPLEGABLE DE MODO DE VISTA */}
          {onViewModeChange && (
            <Popover open={viewOpen} onOpenChange={setViewOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-8.5 rounded-xl px-3 text-xs font-semibold transition-all ${
                    viewMode !== "NOTES"
                      ? "border-indigo-400 bg-indigo-50/60 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                  <span>Vista: {activeViewLabel}</span>
                  <ChevronDown className="ml-1.5 h-3 w-3 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-60 p-2 rounded-2xl border border-slate-200/90 shadow-xl bg-white dark:border-slate-800 dark:bg-slate-900 text-xs"
              >
                <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Modo de visualización
                  </p>
                </div>
                <div className="space-y-1 pt-1.5">
                  {viewOptions.map(v => {
                    const isSelected = viewMode === v.key;
                    const IconComp = v.icon;
                    return (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => {
                          onViewModeChange(v.key);
                          setViewOpen(false);
                        }}
                        className={`flex w-full items-start gap-2 rounded-xl p-2 text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/80 dark:bg-indigo-950/50"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <IconComp
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs ${
                                isSelected
                                  ? "font-bold text-indigo-950 dark:text-indigo-200"
                                  : "font-semibold text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {v.label}
                            </span>
                            {isSelected && (
                              <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{v.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

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
                  className="rounded-md p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Indicador sutil de filtro activo */}
        {currentFilter !== "ALL" && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Filtro activo:</span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {activeFilterLabel}
              <button
                type="button"
                onClick={() => onFilterChange("ALL")}
                className="hover:text-rose-600 cursor-pointer"
                title="Quitar filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

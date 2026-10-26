import React, { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Filter,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { OFFICIAL_DBA_CATALOG, queryCatalog, type CatalogDba } from "../../data/dbaCatalog";
import { generateDbaDescriptors, regenerateSingleDescriptor } from "../../lib/descriptorGenerator";
import type { Dba, DbaDescriptorSet } from "../../types";

interface DbaPeriodManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DbaPeriodManagerModal({ open, onOpenChange }: DbaPeriodManagerModalProps) {
  const { dataset, setDbaList } = useGradeCenter();

  // Active view tab inside modal
  const [activeTab, setActiveTab] = useState<"period" | "catalog">("period");

  // Local working copy of DBAs
  const [workingDbas, setWorkingDbas] = useState<Dba[]>([]);

  // Catalog search & filters
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(undefined);
  const [selectedSubject, setSelectedSubject] = useState<string>("ciencias");

  // Auto-detect grade & subject from dataset on open
  useEffect(() => {
    if (!open) return;

    // Detect grade number from course name (e.g. "11-2" -> 11, "6-1" -> 6)
    const gradeMatch = dataset.course.match(/^(\d{1,2})/);
    const inferredGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : 11;
    setSelectedGrade(inferredGrade);

    // Detect subject keyword
    const subLower = dataset.subject.toLowerCase();
    if (subLower.includes("matem")) setSelectedSubject("matematicas");
    else if (subLower.includes("lengua") || subLower.includes("español")) setSelectedSubject("lenguaje");
    else if (subLower.includes("social")) setSelectedSubject("sociales");
    else setSelectedSubject("ciencias");

    // Initialize working copy from dataset.dba, ensuring descriptors exist
    if (dataset.dba && dataset.dba.length > 0) {
      const enriched = dataset.dba.map((dba) => {
        if (!dba.descriptors) {
          const generated = generateDbaDescriptors({
            title: dba.title,
            statement: dba.statement,
            dimension: dba.dimension || "cognitivo",
          });
          return { ...dba, descriptors: generated };
        }
        return dba;
      });
      setWorkingDbas(enriched);
      setActiveTab("period");
    } else {
      // If none, prompt catalog view
      setWorkingDbas([]);
      setActiveTab("catalog");
    }
  }, [open, dataset.course, dataset.subject, dataset.dba]);

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    const list = queryCatalog(selectedGrade, selectedSubject);
    if (!catalogSearch.trim()) return list;
    const kw = catalogSearch.toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(kw) ||
        item.statement.toLowerCase().includes(kw) ||
        item.code.toLowerCase().includes(kw)
    );
  }, [selectedGrade, selectedSubject, catalogSearch]);

  // Check if a catalog DBA is already linked
  const isLinked = (catalogId: string) => workingDbas.some((d) => d.id === catalogId);

  // Link a catalog DBA
  const handleLinkDba = (catalogDba: CatalogDba) => {
    if (isLinked(catalogDba.id)) return;

    const generatedDescriptors = generateDbaDescriptors({
      title: catalogDba.title,
      statement: catalogDba.statement,
      evidences: catalogDba.evidences,
      dimension: catalogDba.dimension,
    });

    const newDba: Dba = {
      id: catalogDba.id,
      code: catalogDba.code,
      title: catalogDba.title,
      statement: catalogDba.statement,
      dimension: catalogDba.dimension,
      evidences: catalogDba.evidences,
      grade: catalogDba.grade,
      subjectCode: catalogDba.subjectCode,
      descriptors: generatedDescriptors,
    };

    setWorkingDbas((prev) => [...prev, newDba]);
    toast.success(`${newDba.code} vinculado al periodo.`);
  };

  // Remove a DBA
  const handleRemoveDba = (id: string) => {
    setWorkingDbas((prev) => prev.filter((d) => d.id !== id));
  };

  // Update descriptor text inline
  const handleUpdateDescriptor = (
    dbaId: string,
    level: keyof DbaDescriptorSet,
    newText: string
  ) => {
    setWorkingDbas((prev) =>
      prev.map((d) => {
        if (d.id !== dbaId || !d.descriptors) return d;
        return {
          ...d,
          descriptors: {
            ...d.descriptors,
            [level]: newText,
          },
        };
      })
    );
  };

  // Regenerate descriptor with AI
  const handleRegenerateDescriptor = (
    dbaId: string,
    level: keyof DbaDescriptorSet
  ) => {
    const target = workingDbas.find((d) => d.id === dbaId);
    if (!target) return;

    const newDescriptor = regenerateSingleDescriptor(level, {
      title: target.title,
      statement: target.statement,
      evidences: target.evidences,
      dimension: target.dimension,
    });

    handleUpdateDescriptor(dbaId, level, newDescriptor);
    toast.info(`Juicio ${level.toUpperCase()} regenerado con lenguaje pedagógico.`);
  };

  // Change dimension
  const handleChangeDimension = (
    dbaId: string,
    dimension: "cognitivo" | "procedimental" | "actitudinal"
  ) => {
    setWorkingDbas((prev) =>
      prev.map((d) => {
        if (d.id !== dbaId) return d;
        const recomputed = generateDbaDescriptors({
          title: d.title,
          statement: d.statement,
          evidences: d.evidences,
          dimension,
        });
        return {
          ...d,
          dimension,
          descriptors: recomputed,
        };
      })
    );
    toast.info(`Dimensión cambiada a ${dimension}. Descriptores actualizados.`);
  };

  // Save changes to GradeCenterContext
  const handleSave = () => {
    setDbaList(workingDbas);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[28px] border border-white/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Gestión de DBAs y Descriptores (Decreto 1290)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {dataset.course} · {dataset.subject} · {dataset.period} — Catálogo Nacional MEN
                </DialogDescription>
              </div>
            </div>

            {/* Selector de Pestañas de la Modal */}
            <div className="flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("period")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                  activeTab === "period"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                DBAs del Periodo ({workingDbas.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5",
                  activeTab === "catalog"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                <span>Catálogo MEN</span>
                <span className="h-4 w-4 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                  +
                </span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido Principal con Scroll */}
        <div className="max-h-[68vh] overflow-y-auto p-6 space-y-6">
          {activeTab === "catalog" ? (
            /* ==================================================== */
            /* PESTAÑA 1: EXPLORADOR DEL CATÁLOGO OFICIAL MEN       */
            /* ==================================================== */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Buscador */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar por tema, palabra clave o enunciado..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filtro Grado */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Grado:</span>
                  {[6, 7, 8, 9, 10, 11].map((gr) => (
                    <button
                      key={gr}
                      type="button"
                      onClick={() => setSelectedGrade(gr)}
                      className={cn(
                        "h-7 w-7 rounded-lg text-xs font-semibold transition-all",
                        selectedGrade === gr
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      )}
                    >
                      {gr}°
                    </button>
                  ))}
                </div>

                {/* Filtro Materia */}
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="h-8 px-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium focus:outline-none"
                >
                  <option value="ciencias">Ciencias Naturales</option>
                  <option value="matematicas">Matemáticas</option>
                  <option value="lenguaje">Lenguaje / Español</option>
                </select>
              </div>

              {/* Lista de DBAs disponibles en el catálogo */}
              <div className="grid gap-3">
                {filteredCatalog.map((dba) => {
                  const linked = isLinked(dba.id);
                  return (
                    <div
                      key={dba.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3",
                        linked
                          ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10"
                          : "border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                              {dba.code}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {dba.subjectName} · Grado {dba.grade}°
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold uppercase">
                              {dba.dimension}
                            </span>
                          </div>
                          <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                            {dba.title}
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {dba.statement}
                          </p>
                        </div>

                        {/* Botón Vincular */}
                        <button
                          type="button"
                          onClick={() => handleLinkDba(dba)}
                          disabled={linked}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5",
                            linked
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                          )}
                        >
                          {linked ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Vinculado</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              <span>Vincular al Periodo</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Evidencias de aprendizaje */}
                      {dba.evidences && dba.evidences.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Evidencias de Aprendizaje MEN:
                          </p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dba.evidences.map((ev, i) => (
                              <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                                {ev}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredCatalog.length === 0 && (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No encontramos DBAs para este filtro
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Prueba seleccionando otro grado o ajustando el término de búsqueda.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ==================================================== */
            /* PESTAÑA 2: DBAS DEL PERIODO Y DESCRIPTORES BOLETÍN   */
            /* ==================================================== */
            <div className="space-y-6">
              {workingDbas.length === 0 ? (
                <div className="p-10 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10 space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    No has vinculado DBAs para este periodo
                  </h3>
                  <p className="max-w-md mx-auto text-xs text-slate-500 leading-relaxed">
                    Los Derechos Básicos de Aprendizaje fundamentan las notas y generan los juicios valorativos automáticos del boletín oficial (Decreto 1290).
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("catalog")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-md shadow-blue-500/25"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Explorar y Vincular del Catálogo Oficial</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {workingDbas.map((dba, index) => (
                    <div
                      key={dba.id}
                      className="p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-sm space-y-4"
                    >
                      {/* Cabecera del DBA vinculado */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {dba.code}
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {dba.title}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {dba.statement}
                            </p>
                          </div>
                        </div>

                        {/* Controles: Dimensión y Eliminar */}
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={dba.dimension || "cognitivo"}
                            onChange={(e) =>
                              handleChangeDimension(
                                dba.id,
                                e.target.value as "cognitivo" | "procedimental" | "actitudinal"
                              )
                            }
                            className="h-8 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="cognitivo">Dimensión: Cognitiva (Saber)</option>
                            <option value="procedimental">Dimensión: Procedimental (Hacer)</option>
                            <option value="actitudinal">Dimensión: Actitudinal (Ser)</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveDba(dba.id)}
                            title="Desvincular DBA de este periodo"
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Los 4 Descriptores del Boletín (Decreto 1290) */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                            <span>Descriptores Automáticos para el Boletín (Escala MEN):</span>
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Editables en línea para personalizar
                          </span>
                        </div>

                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {/* 1. SUPERIOR */}
                          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                SUPERIOR (4.6 – 5.0)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRegenerateDescriptor(dba.id, "superior")}
                                title="Regenerar con IA variante pedagógica"
                                className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Alternar IA</span>
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={dba.descriptors?.superior ?? ""}
                              onChange={(e) => handleUpdateDescriptor(dba.id, "superior", e.target.value)}
                              className="w-full text-[11px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-white/10 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          {/* 2. ALTO */}
                          <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-500/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                                ALTO (4.0 – 4.5)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRegenerateDescriptor(dba.id, "alto")}
                                title="Regenerar con IA variante pedagógica"
                                className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Alternar IA</span>
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={dba.descriptors?.alto ?? ""}
                              onChange={(e) => handleUpdateDescriptor(dba.id, "alto", e.target.value)}
                              className="w-full text-[11px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-white/10 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* 3. BÁSICO */}
                          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-500/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                                BÁSICO (3.0 – 3.9)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRegenerateDescriptor(dba.id, "basico")}
                                title="Regenerar con IA variante pedagógica"
                                className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 hover:underline"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Alternar IA</span>
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={dba.descriptors?.basico ?? ""}
                              onChange={(e) => handleUpdateDescriptor(dba.id, "basico", e.target.value)}
                              className="w-full text-[11px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-white/10 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          {/* 4. BAJO */}
                          <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-500/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                                BAJO (1.0 – 2.9)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRegenerateDescriptor(dba.id, "bajo")}
                                title="Regenerar con IA variante pedagógica"
                                className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Alternar IA</span>
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={dba.descriptors?.bajo ?? ""}
                              onChange={(e) => handleUpdateDescriptor(dba.id, "bajo", e.target.value)}
                              className="w-full text-[11px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-white/10 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer de Acciones de la Modal */}
        <div className="p-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <strong>{workingDbas.length}</strong> {workingDbas.length === 1 ? "DBA configurado" : "DBAs configurados"} para este periodo
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Guardar y Aplicar en Periodo</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

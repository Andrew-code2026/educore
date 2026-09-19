import React from "react";
import { Sparkles, ArrowRight, BrainCircuit, BookOpen } from "lucide-react";

interface StudentAiCalloutProps {
  onOpenAi: () => void;
  suggestionText?: string;
}

export function StudentAiCallout({
  onOpenAi,
  suggestionText,
}: StudentAiCalloutProps) {
  return (
    <section
      aria-label="EduCore AI Tutor"
      className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50/50 p-4 sm:p-5 shadow-2xs"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Tutor y acompañamiento
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
            EduCore AI para Estudiantes
          </h3>
        </div>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
        {suggestionText ??
          "¿Tienes dudas sobre un tema o quieres preparar tu próxima entrega? Pide resúmenes, explicaciones paso a paso o ejercicios prácticos adaptados a tu nivel."}
      </p>

      {/* Suggested prompts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200/60 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700">
          <BookOpen className="h-3 w-3 text-blue-600" />
          "Explícame derivadas paso a paso"
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200/60 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700">
          <BrainCircuit className="h-3 w-3 text-indigo-600" />
          "Ideas clave para mi taller pendiente"
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-blue-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <span className="text-[11px] font-medium text-slate-500">
          Acompañamiento didáctico siempre a tu alcance
        </span>
        <button
          type="button"
          onClick={onOpenAi}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
        >
          <span>Abrir EduCore AI</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

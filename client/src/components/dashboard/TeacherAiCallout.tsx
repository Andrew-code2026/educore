import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

interface TeacherAiCalloutProps {
  onOpenAi: () => void;
  insightText?: string;
}

export function TeacherAiCallout({
  onOpenAi,
  insightText,
}: TeacherAiCalloutProps) {
  return (
    <section
      aria-label="EduCore AI"
      className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 p-4 shadow-2xs"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Productividad Docente
          </span>
          <h3 className="text-sm font-bold text-slate-900 leading-none">
            EduCore AI
          </h3>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-600">
        {insightText ??
          "Ahorra tiempo en tu gestión docente. Prepara rúbricas, retroalimentación o talleres adaptados en minutos."}
      </p>

      <div className="mt-3 pt-2.5 border-t border-blue-100/80 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-blue-800">
          Tú revisas, editas y decides
        </span>
        <button
          type="button"
          onClick={onOpenAi}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
        >
          <span>Abrir asistente</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

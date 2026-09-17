import React from "react";
import { Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeacherAiCalloutProps {
  onOpenAi: () => void;
  insightText?: string;
}

export function TeacherAiCallout({
  onOpenAi,
  insightText,
}: TeacherAiCalloutProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-blue-200/70 bg-gradient-to-br from-[#f2f7ff] via-[#e8f1fd] to-[#deebfb] p-5 sm:p-6 shadow-[0_4px_20px_rgba(36,117,207,0.05)]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/70 blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                Asistente Didáctico
              </span>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                EduCore AI
              </h3>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {insightText ??
            "Diseña rúbricas, redacta consignas de evaluación o genera borradores de actividades en segundos. Tú revisas y decides."}
        </p>

        <div className="mt-4 pt-3 border-t border-blue-200/50 flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-blue-800">
            Ahorra tiempo en planeación
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onOpenAi}
            className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <span>Abrir asistente</span>
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

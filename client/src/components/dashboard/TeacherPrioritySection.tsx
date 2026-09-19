import React from "react";
import { ArrowRight } from "lucide-react";
import type { TeacherPriorityItem } from "./types";

interface TeacherPrioritySectionProps {
  items: TeacherPriorityItem[];
  onViewAll?: () => void;
}

export function TeacherPrioritySection({
  items,
}: TeacherPrioritySectionProps) {
  return (
    <section
      aria-label="Atención prioritaria"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Atención prioritaria</h2>
          <p className="text-[10px] text-slate-400">Intervenciones sugeridas para hoy</p>
        </div>
        <span className="rounded-full border-0 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600">
          {items.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onAction}
            className="flex w-full items-center gap-2 py-2 text-left hover:bg-slate-50/60 rounded-lg px-1 transition-colors group"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                item.severity === "high" ? "bg-rose-500" : "bg-amber-400"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-slate-700">
                {item.title}
              </span>
              <span className="block truncate text-[9px] text-slate-400">
                {item.context}
              </span>
            </span>
            <span className="whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-[8px] font-bold text-slate-500 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors shrink-0">
              {item.actionLabel} <ArrowRight className="ml-1 inline h-2.5 w-2.5" />
            </span>
          </button>
        ))}

        {items.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-400">
              Sin intervenciones urgentes requeridas hoy.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

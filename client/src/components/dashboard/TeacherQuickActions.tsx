import React from "react";
import { Zap, ArrowRight } from "lucide-react";
import type { TeacherQuickActionItem } from "./types";

interface TeacherQuickActionsProps {
  actions: TeacherQuickActionItem[];
  highlightedAction?: TeacherQuickActionItem;
}

export function TeacherQuickActions({
  actions,
  highlightedAction,
}: TeacherQuickActionsProps) {
  return (
    <section
      aria-label="Acciones rápidas"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600 shrink-0">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Acciones rápidas</h2>
          <p className="text-[10px] text-slate-400">Atajos para tu gestión diaria</p>
        </div>
      </div>

      {highlightedAction && (
        <button
          type="button"
          onClick={highlightedAction.onClick}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-2.5 text-left text-[10px] font-bold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.99]"
        >
          <span>
            <span className="block text-[8px] uppercase tracking-[0.12em] text-indigo-100 font-semibold">
              Acción sugerida
            </span>
            {highlightedAction.label}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      )}

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {actions.slice(0, 3).map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="flex min-h-[64px] flex-col items-start justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-left hover:border-blue-200 hover:bg-blue-50/50 transition-all hover:shadow-2xs active:scale-[0.98]"
            >
              <span className="rounded-lg bg-white p-1.5 text-indigo-600 shadow-xs">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[9px] font-bold text-slate-600 leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

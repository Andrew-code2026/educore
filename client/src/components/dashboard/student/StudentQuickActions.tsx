import React from "react";
import {
  BarChart3,
  ClipboardList,
  Calendar,
  BookOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import type { StudentQuickActionItem } from "./types";

interface StudentQuickActionsProps {
  actions: StudentQuickActionItem[];
}

export function StudentQuickActions({ actions }: StudentQuickActionsProps) {
  return (
    <section
      aria-label="Acciones rápidas"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
          Acciones rápidas
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              className="group relative flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/25 hover:shadow-2xs"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                  {act.label}
                </span>
                {act.badge !== undefined && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    {act.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

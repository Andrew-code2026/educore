import React from "react";
import {
  Plus,
  ClipboardCheck,
  CalendarDays,
  Sparkles,
  BookOpen,
  ArrowRight,
  FileText,
} from "lucide-react";
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
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Acciones rápidas
          </h2>
          <p className="text-xs text-slate-500">
            Atajos directos para tu gestión diaria.
          </p>
        </div>
      </div>

      {/* Primary Highlighted Action (if any) */}
      {highlightedAction && (
        <div className="mb-4">
          <button
            type="button"
            onClick={highlightedAction.onClick}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                <highlightedAction.icon className="h-4 w-4" />
              </span>
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold leading-none truncate">
                  Acción sugerida
                </p>
                <p className="text-sm font-bold mt-1 truncate">
                  {highlightedAction.label}
                </p>
              </div>
            </div>

            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      {/* Grid of Standard Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={[
                "group flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition",
                "hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-2xs",
              ].join(" ")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200/80 text-slate-700 shadow-2xs group-hover:text-blue-700 group-hover:border-blue-200">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                  {action.label}
                </p>
                {action.badge && (
                  <span className="inline-block truncate text-[10px] font-bold text-amber-600">
                    {action.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React from "react";
import { ClipboardList, ChevronRight, CheckCircle2 } from "lucide-react";
import type { TeacherGradingItem } from "./types";

interface TeacherGradingQueueProps {
  items: TeacherGradingItem[];
  onViewAll: () => void;
}

export function TeacherGradingQueue({
  items,
  onViewAll,
}: TeacherGradingQueueProps) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Por calificar
              </h3>
              <p className="text-[11px] text-slate-400">
                Entregas esperando revisión
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {items.reduce((sum, item) => sum + item.pendingCount, 0)}
            </span>
          )}
        </div>

        {/* List */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.slice(0, 4).map((item) => (
              <button
                key={item.assignmentId}
                type="button"
                onClick={item.onGrade}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-left transition hover:border-amber-200 hover:bg-amber-50/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-amber-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {item.course} · {item.subject}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-700 shadow-2xs">
                    {item.pendingCount}
                    {item.totalSubmissions > 0 && (
                      <span className="text-slate-400 font-normal"> / {item.totalSubmissions}</span>
                    )}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-amber-600" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500 mb-1" />
            <p className="text-xs font-semibold text-slate-700">
              Todo calificado
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              No tienes entregas pendientes de revisión.
            </p>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition inline-flex items-center gap-1"
        >
          <span>Ver todas las actividades</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

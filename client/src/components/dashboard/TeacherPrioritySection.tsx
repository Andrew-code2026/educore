import React from "react";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  ShieldAlert,
} from "lucide-react";
import type { TeacherPriorityItem } from "./types";

interface TeacherPrioritySectionProps {
  items: TeacherPriorityItem[];
}

export function TeacherPrioritySection({
  items,
}: TeacherPrioritySectionProps) {
  const getPriorityIcon = (
    id: string,
    severity: TeacherPriorityItem["severity"]
  ) => {
    if (id.includes("attendance")) return ClipboardCheck;
    if (id.includes("pending")) return FileCheck;
    if (severity === "high") return AlertCircle;
    return ShieldAlert;
  };

  return (
    <section
      aria-label="Atención prioritaria"
      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131f30] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] dark:shadow-none sm:p-4"
    >
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Atención prioritaria
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-400">
                Intervenciones sugeridas para hoy
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <span className="rounded-full bg-rose-50 dark:bg-rose-950/70 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-300">
              {items.length}
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {items.map((item) => {
            const Icon = getPriorityIcon(item.id, item.severity);
            const isHigh = item.severity === "high";

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onAction}
                className="group flex w-full items-center gap-3 py-2.5 px-1.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-lg"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isHigh
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.context}
                  </span>
                </span>

                <span className="whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:border-blue-300 dark:group-hover:border-blue-700 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors shrink-0">
                  {item.actionLabel}{" "}
                  <ArrowRight className="ml-1 inline h-2.5 w-2.5" />
                </span>
              </button>
            );
          })}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 py-6 px-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1" />
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Todo al día en tus cursos
              </p>
              <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                Sin entregas ni alertas urgentes pendientes por resolver hoy.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

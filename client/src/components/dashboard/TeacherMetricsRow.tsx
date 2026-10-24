import React from "react";
import { ArrowRight } from "lucide-react";
import type { TeacherMetricItem } from "./types";

interface TeacherMetricsRowProps {
  metrics: TeacherMetricItem[];
}

const TONE_STYLES = {
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
  warning:
    "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  danger: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
  success:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
};

export function TeacherMetricsRow({ metrics }: TeacherMetricsRowProps) {
  return (
    <section
      aria-label="Métricas del docente"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {metrics.map((metric) => {
        const toneClass =
          TONE_STYLES[metric.tone as keyof typeof TONE_STYLES] ||
          TONE_STYLES.info;
        const Icon = metric.icon;

        return (
          <button
            key={metric.id || metric.label}
            type="button"
            onClick={metric.onClick}
            disabled={!metric.onClick}
            aria-label={`${metric.label}: ${metric.value}. ${metric.detail ?? ""}`}
            className={[
              "group rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131f30] p-3 text-left",
              "shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:shadow-none transition-all sm:px-4 sm:py-3.5",
              metric.onClick
                ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-900/70 hover:shadow-md active:translate-y-0"
                : "cursor-default",
            ].join(" ")}
          >
            <div className="flex items-start justify-between">
              <span className={`rounded-lg p-2 ${toneClass}`}>
                <Icon className="h-4 w-4" />
              </span>
              {metric.onClick && (
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              )}
            </div>
            <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-400">
              {metric.label}
            </p>
            <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              {metric.value}
            </p>
            {metric.detail && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {metric.detail}
              </p>
            )}
          </button>
        );
      })}
    </section>
  );
}

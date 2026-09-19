import React from "react";
import { ArrowRight } from "lucide-react";
import type { TeacherMetricItem } from "./types";

interface TeacherMetricsRowProps {
  metrics: TeacherMetricItem[];
}

const TONE_STYLES = {
  neutral: "bg-slate-50 text-slate-600",
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  success: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
};

export function TeacherMetricsRow({ metrics }: TeacherMetricsRowProps) {
  return (
    <section
      aria-label="Métricas del docente"
      className="grid grid-cols-2 gap-2.5 md:grid-cols-4"
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
              "group rounded-2xl border border-slate-200/80 bg-white p-3 text-left",
              "shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all sm:p-4",
              metric.onClick
                ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                : "cursor-default",
            ].join(" ")}
          >
            <div className="flex items-start justify-between">
              <span className={`rounded-xl p-2 ${toneClass}`}>
                <Icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-3 w-3 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </div>
            <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
              {metric.label}
            </p>
            <p className="mt-1 truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              {metric.value}
            </p>
            {metric.detail && (
              <p className="mt-0.5 truncate text-[9px] text-slate-500">
                {metric.detail}
              </p>
            )}
          </button>
        );
      })}
    </section>
  );
}

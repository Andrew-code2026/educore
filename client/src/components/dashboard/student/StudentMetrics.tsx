import React from "react";
import { ArrowUpRight } from "lucide-react";
import type { StudentMetricItem } from "./types";

interface StudentMetricsProps {
  metrics: StudentMetricItem[];
}

const TONE_STYLES = {
  neutral: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200/80",
    iconBg: "bg-slate-100 text-slate-600",
  },
  info: {
    bg: "bg-blue-50/50",
    text: "text-blue-700",
    border: "border-blue-100",
    iconBg: "bg-blue-50 text-blue-600",
  },
  warning: {
    bg: "bg-amber-50/40",
    text: "text-amber-700",
    border: "border-amber-100",
    iconBg: "bg-amber-50 text-amber-600",
  },
  danger: {
    bg: "bg-rose-50/40",
    text: "text-rose-700",
    border: "border-rose-100",
    iconBg: "bg-rose-50 text-rose-600",
  },
  success: {
    bg: "bg-emerald-50/40",
    text: "text-emerald-700",
    border: "border-emerald-100",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
};

export function StudentMetrics({ metrics }: StudentMetricsProps) {
  return (
    <section aria-label="Resumen académico" className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
      {metrics.map((metric) => {
        const toneStyle = TONE_STYLES[metric.tone ?? "neutral"];
        const Icon = metric.icon;

        return (
          <button
            key={metric.id}
            type="button"
            onClick={metric.onClick}
            disabled={!metric.onClick}
            aria-label={`${metric.label}: ${metric.value}. ${metric.detail ?? ""}`}
            className={[
              "group relative flex flex-col justify-between overflow-hidden text-left",
              "rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-4.5",
              "shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200",
              metric.onClick
                ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                : "cursor-default",
            ].join(" ")}
          >
            {/* Top row: Label + Icon */}
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {metric.label}
              </span>
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl transition ${toneStyle.iconBg}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            {/* Middle row: Big Value + Arrow */}
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {metric.value}
              </span>

              {metric.onClick && (
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </div>

            {/* Bottom detail */}
            {metric.detail && (
              <p className="mt-1 truncate text-xs text-slate-500 font-medium">
                {metric.detail}
              </p>
            )}
          </button>
        );
      })}
    </section>
  );
}

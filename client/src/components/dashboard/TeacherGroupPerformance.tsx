import React from "react";
import { TrendingUp, ArrowRight } from "lucide-react";

interface TeacherGroupPerformanceProps {
  period1Average?: number;
  period2Average?: number;
  period1Label?: string;
  period2Label?: string;
  onViewAnalysis?: () => void;
}

export function TeacherGroupPerformance({
  period1Average = 3.42,
  period2Average = 3.9,
  period1Label = "Periodo 1",
  period2Label = "Periodo 2",
  onViewAnalysis,
}: TeacherGroupPerformanceProps) {
  const delta = Number((period2Average - period1Average).toFixed(2));
  const isPositive = delta >= 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Rendimiento del grupo</h2>
            <p className="text-[10px] text-slate-400">Evolución del promedio por periodo</p>
          </div>
        </div>
        {onViewAnalysis && (
          <button
            type="button"
            onClick={onViewAnalysis}
            className="text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>Ver análisis</span>
            <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>

      <div className="h-36 rounded-xl bg-gradient-to-t from-blue-50/80 via-white to-white p-2">
        <svg
          viewBox="0 0 560 130"
          className="h-full w-full"
          role="img"
          aria-label="Evolución del rendimiento del grupo"
        >
          <defs>
            <linearGradient id="teacherArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d="M8 112 L8 92 C70 88, 76 76, 96 82 S150 67, 176 74 S228 48, 258 61 S308 42, 340 49 S390 28, 420 38 S478 18, 552 24 L552 112 Z"
            fill="url(#teacherArea)"
          />
          <path
            d="M8 92 C70 88, 76 76, 96 82 S150 67, 176 74 S228 48, 258 61 S308 42, 340 49 S390 28, 420 38 S478 18, 552 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line x1="8" y1="112" x2="552" y2="112" stroke="#dbeafe" />
          <g fill="#2563eb">
            <circle cx="8" cy="92" r="4" />
            <circle cx="98" cy="81" r="4" />
            <circle cx="188" cy="70" r="4" />
            <circle cx="278" cy="59" r="4" />
            <circle cx="368" cy="48" r="4" />
            <circle cx="458" cy="37" r="4" />
            <circle cx="548" cy="26" r="4" />
          </g>
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
        <span>{period1Label} ({period1Average.toFixed(2)})</span>
        <span
          className={`font-bold ${
            isPositive ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {isPositive ? `+${delta}` : `${delta}`} puntos
        </span>
        <span>{period2Label} ({period2Average.toFixed(2)})</span>
      </div>
    </div>
  );
}

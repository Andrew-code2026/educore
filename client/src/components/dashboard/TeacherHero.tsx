import React from "react";
import {
  CalendarDays,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TeacherHeroProps {
  teacherName: string;
  schoolName: string;
  activePeriodName?: string;
  summaryText: string;
  aiSuggestion?: {
    text: string;
    onAction: () => void;
  };
  pendingGradesCount: number;
  onOpenGradeCenter: () => void;
  onOpenCalendar: () => void;
}

export function TeacherHero({
  teacherName,
  schoolName,
  activePeriodName = "Periodo 2",
  summaryText,
  aiSuggestion,
  pendingGradesCount,
  onOpenGradeCenter,
  onOpenCalendar,
}: TeacherHeroProps) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Buenos días"
      : currentHour < 19
        ? "Buenas tardes"
        : "Buenas noches";

  const GreetingIcon =
    currentHour < 12 ? Sun : currentHour < 19 ? Sunset : Moon;

  const todayFormatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // Capitalize first letter of weekday
  const capitalizedDate =
    todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-blue-100/80 bg-gradient-to-br from-[#f0f6ff] via-[#e9f1fd] to-[#deebff] p-5 sm:p-7 shadow-[0_12px_36px_rgba(36,117,207,0.07)]">
      {/* Decorative ambient blurs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 -bottom-16 h-48 w-48 rounded-full bg-blue-300/20 blur-2xl" />

      <div className="relative z-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            {/* Context Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/75 px-3 py-1 text-[11px] font-semibold text-blue-800 shadow-xs backdrop-blur-xs">
              <GreetingIcon className="h-3.5 w-3.5 text-amber-500" />
              <span>{greeting}, {capitalizedDate}</span>
              <span className="text-slate-300">·</span>
              <span className="font-normal text-slate-600">{schoolName}</span>
              <span className="text-slate-300">·</span>
              <span className="font-medium text-blue-700">{activePeriodName}</span>
            </div>

            {/* Main Greeting */}
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Hola, Prof. {teacherName}
            </h1>

            {/* Dynamic Summary */}
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {summaryText}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
            <Button
              type="button"
              onClick={onOpenGradeCenter}
              className="relative rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              <ClipboardCheck className="mr-2 h-4 w-4 text-emerald-400" />
              Grade Center
              {pendingGradesCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full bg-amber-400/20 px-1.5 py-0 text-[10px] font-bold text-amber-300"
                >
                  {pendingGradesCount}
                </Badge>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onOpenCalendar}
              className="rounded-xl border-slate-200/90 bg-white/90 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-white hover:text-blue-700"
            >
              <CalendarDays className="mr-2 h-4 w-4 text-blue-600" />
              Ver calendario
            </Button>
          </div>
        </div>

        {/* EduCore AI Contextual Suggestion Banner */}
        {aiSuggestion && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/60 px-4 py-2.5 backdrop-blur-xs transition hover:bg-white/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="truncate text-xs text-slate-700">
                <span className="font-semibold text-blue-900">EduCore AI sugiere:</span>{" "}
                <span className="text-slate-600">"{aiSuggestion.text}"</span>
              </p>
            </div>

            <button
              type="button"
              onClick={aiSuggestion.onAction}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition ml-auto"
            >
              <span>Explorar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

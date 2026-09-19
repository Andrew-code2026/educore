import React from "react";
import {
  BarChart3,
  ClipboardList,
  Sparkles,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StudentHeroProps {
  studentName: string;
  schoolName: string;
  courseName?: string;
  activePeriodName?: string;
  summaryText: string;
  pendingActivitiesCount: number;
  averageGrade: number;
  onOpenGrades: () => void;
  onOpenClassroom: () => void;
  aiSuggestion?: {
    text: string;
    onAction: () => void;
  };
}

export function StudentHero({
  studentName,
  schoolName,
  courseName = "11-2",
  activePeriodName = "Periodo 2",
  summaryText,
  pendingActivitiesCount,
  averageGrade,
  onOpenGrades,
  onOpenClassroom,
  aiSuggestion,
}: StudentHeroProps) {
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

  const capitalizedDate =
    todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <section
      data-testid="student-hero"
      className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-r from-[#f0f6ff] via-[#e8f1fc] to-[#f4f8fe] px-5 py-4 sm:px-6 sm:py-5 shadow-xs"
    >
      <div className="relative z-10">
        {/* Top Header Row: Context Pill + Action Buttons */}
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Context Pill */}
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-blue-200/60 bg-white/85 px-3 py-0.5 text-[11px] font-semibold text-blue-900 shadow-2xs">
            <GreetingIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>{greeting}, {capitalizedDate}</span>
            <span className="text-slate-300">·</span>
            <span className="font-normal text-slate-600">{schoolName}</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-blue-700">{courseName}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-600">{activePeriodName}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={onOpenGrades}
              className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800"
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              Ver calificaciones
              {averageGrade > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-4 min-w-4 rounded-full bg-emerald-400/20 px-1.5 text-[10px] font-bold text-emerald-300"
                >
                  {averageGrade.toFixed(1)}
                </Badge>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenClassroom}
              className="h-8 rounded-lg border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-700"
            >
              <ClipboardList className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Ver actividades
              {pendingActivitiesCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-4 min-w-4 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800"
                >
                  {pendingActivitiesCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Greeting & Summary */}
        <div className="mt-2.5 max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Hola, {studentName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm leading-normal text-slate-600">
            {summaryText}
          </p>
        </div>

        {/* Discrete EduCore AI Ribbon */}
        {aiSuggestion && (
          <div className="mt-3 flex items-center justify-between gap-2.5 rounded-xl border border-blue-100 bg-white/70 px-3 py-1.5 text-xs shadow-2xs transition hover:bg-white/90">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
                <Sparkles className="h-3 w-3" />
              </span>
              <p className="truncate text-[11px] text-slate-700">
                <span className="font-semibold text-blue-900">EduCore AI:</span>{" "}
                <span className="text-slate-600">"{aiSuggestion.text}"</span>
              </p>
            </div>

            <button
              type="button"
              onClick={aiSuggestion.onAction}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition ml-2"
            >
              <span>Explorar</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

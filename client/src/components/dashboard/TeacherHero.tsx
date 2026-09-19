import {
  Calendar,
  FileCheck,
  Sparkles,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";

interface TeacherHeroProps {
  teacherName: string;
  schoolName: string;
  activePeriodName?: string;
  summaryText: string;
  pendingGradesCount: number;
  onOpenGradeCenter: () => void;
  onOpenCalendar: () => void;
  onOpenClassroom?: () => void;
}

export function TeacherHero({
  teacherName,
  schoolName,
  activePeriodName = "Periodo 2",
  summaryText,
  pendingGradesCount,
  onOpenGradeCenter,
  onOpenCalendar,
  onOpenClassroom,
}: TeacherHeroProps) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Buenos días"
      : currentHour < 19
        ? "Buenas tardes"
        : "Buenas noches";

  const todayFormatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const capitalizedDate =
    todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <section
      data-testid="teacher-hero"
      className="teacher-hero relative overflow-hidden rounded-[24px] border border-blue-100/80 bg-gradient-to-br from-[#eef5ff] via-[#e5efff] to-[#dbe8ff] p-4 shadow-[0_16px_42px_rgba(69,105,180,0.12)] sm:p-5"
    >
      <div className="teacher-glow pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="relative z-10">
        {/* Top Header Row: Pill + Quick Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>
              {greeting}, {capitalizedDate}
            </span>
            <span className="text-slate-300">·</span>
            <span>{schoolName}</span>
            <span className="text-blue-700 font-bold">· {activePeriodName}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenGradeCenter}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <FileCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span>Grade Center</span>
              {pendingGradesCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[9px] text-slate-950 font-bold">
                  {pendingGradesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenCalendar}
              className="inline-flex items-center gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm hover:bg-white transition active:translate-y-0"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span>Ver calendario</span>
            </button>
          </div>
        </div>

        {/* Greeting & Summary */}
        <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-[#172554] sm:text-3xl">
          Hola, {teacherName}
        </h1>
        <div
          className="mt-1 text-xs text-[#52668f] leading-normal"
          dangerouslySetInnerHTML={{ __html: summaryText }}
        />

        {/* Suggestion Banner */}
        {pendingGradesCount > 0 && onOpenClassroom && (
          <button
            type="button"
            onClick={onOpenClassroom}
            className="mt-4 flex w-full items-center gap-2 rounded-xl border border-white bg-white/75 px-3 py-2.5 text-left text-[10px] font-semibold text-blue-700 shadow-sm transition-all hover:bg-white group"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="truncate min-w-0 flex-1">
              Sugerencia de jornada:{" "}
              <span className="font-medium text-slate-600">
                Revisar {pendingGradesCount} entrega(s) y registrar retroalimentación constructiva.
              </span>
            </span>
            <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-600 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </section>
  );
}

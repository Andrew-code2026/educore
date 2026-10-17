import { format } from "date-fns";
import { MotionConfig, motion } from "framer-motion";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileClock,
  MapPin,
  Repeat2,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { classStateFor, computeDayMetrics, primaryAttentionFlags } from "./data/selectors";
import type { Course, SessionStatuses } from "./types";

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const SHORT_DATE = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const CLOCK = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface AttendanceCourseSelectProps {
  courses: Course[];
  /** Registros de asistencia ya disponibles, indexados por estudiante. */
  statuses: SessionStatuses;
  /** Instante local de la jornada; por defecto, ahora. */
  now?: Date;
  /** Conteo del sistema existente de excusas; si se omite, se deriva de los cursos. */
  pendingExcusesCount?: number;
  /** Entra a la planilla existente con el curso y día elegidos. */
  onSelectCourse: (courseId: string, date: string) => void;
  /** Delegación al flujo existente de revisión, sin crear un sistema documental. */
  onReviewExcuses?: (courseId: string, date: string) => void;
}

interface CourseSummary {
  course: Course;
  date: string;
  isToday: boolean;
  isUpcomingToday: boolean;
  students: number;
  registered: number;
  pending: number;
  attendanceRate: number;
  attentionCount: number;
  attendanceLabel: string;
  classLabel: string;
  nextDate: Date | null;
}

type AgendaFilter = "today" | "upcoming" | "all";

const AGENDA_FILTERS: Array<{ id: AgendaFilter; label: string }> = [
  { id: "today", label: "Hoy" },
  { id: "upcoming", label: "Próximos" },
  { id: "all", label: "Todos" },
];

interface CourseDateGroup {
  date: Date;
  dateKey: string;
  courses: CourseSummary[];
}

function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function minuteOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

function nextScheduledDate(course: Course, now: Date): Date | null {
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!course.classDays.includes(date.getDay())) continue;
    // Una clase que ya empezó o terminó no puede ser la próxima sesión.
    if (offset === 0 && minuteOfDay(course.start) <= currentMinute) continue;
    return date;
  }
  return null;
}

function formatNextDate(date: Date): string {
  return capitalized(SHORT_DATE.format(date).replaceAll(".", ""));
}

function normalizeCourseQuery(value: string): string {
  return value.trim().toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesCourseQuery(course: Course, query: string): boolean {
  const needle = normalizeCourseQuery(query);
  if (!needle) return true;
  const searchable = normalizeCourseQuery(`${course.name} ${course.grade} ${course.subject} ${course.room}`);
  return searchable.includes(needle);
}

function CourseSelectHeader({
  now,
  todayIso,
  context,
}: {
  now: Date;
  todayIso: string;
  context: string;
}) {
  return (
    <header className="attendance-course-hero glass-strong relative overflow-hidden rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4">
      <span className="attendance-course-hero-glow pointer-events-none absolute right-[-50px] top-[-90px] h-[230px] w-[230px] rounded-full" aria-hidden="true" />
      <span className="attendance-course-hero-orbit pointer-events-none absolute" aria-hidden="true" />
      <div className="attendance-course-hero-content relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="attendance-course-eyebrow">
            <span className="attendance-course-eyebrow-mark" aria-hidden="true" />
            EduCore <span className="attendance-course-eyebrow-divider">/</span> control académico
          </p>
          <h1 className="attendance-course-title mt-1 font-display font-bold tracking-[-0.055em]">Asistencia</h1>
          <p className="attendance-course-subtitle mt-1.5 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{context}</span>
          </p>
        </div>

        <div className="attendance-course-date glass flex min-w-0 items-center gap-3 rounded-[16px] px-3 py-2.5 sm:px-3.5">
          <span className="attendance-course-date-icon grid h-9 w-9 shrink-0 place-items-center rounded-[11px]">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="attendance-course-date-copy min-w-0">
            <span className="attendance-course-date-kicker">Jornada actual</span>
            <time dateTime={todayIso} className="attendance-course-date-value block truncate">
              {capitalized(LONG_DATE.format(now))}
            </time>
            <span className="attendance-course-date-time mt-1 inline-flex items-center gap-1.5">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              {CLOCK.format(now)}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

function summarizeCourse(course: Course, statuses: SessionStatuses, now: Date): CourseSummary {
  const today = isoDate(now);
  const isToday = course.classDays.includes(now.getDay());
  const metrics = computeDayMetrics(course.students, statuses);
  const registered = metrics.total - metrics.pending;
  const attendanceLabel = course.students.length === 0
    ? "Sin estudiantes asignados"
    : metrics.pending === 0
    ? "Asistencia completa"
    : registered === 0
      ? "Sin iniciar"
      : "En curso";
  const todayClass = isToday ? classStateFor(course, today, now) : null;

  return {
    course,
    date: isToday ? today : isoDate(nextScheduledDate(course, now) ?? now),
    isToday,
    isUpcomingToday: todayClass?.state === "upcoming",
    students: course.students.length,
    registered,
    pending: metrics.pending,
    attendanceRate: metrics.attendanceRate,
    attentionCount: primaryAttentionFlags(course.students, statuses, today).length,
    attendanceLabel,
    classLabel: todayClass?.label ?? "Próxima sesión",
    nextDate: nextScheduledDate(course, now),
  };
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "violet" | "turquoise" | "amber";
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] }}
      className={cn("attendance-select-kpi glass relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-[18px] px-3.5 py-3 sm:min-h-[112px] sm:px-4", `attendance-select-kpi-${tone}`)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="attendance-select-kpi-label">
          {label}
        </span>
        <span className="attendance-select-kpi-icon grid h-8 w-8 shrink-0 place-items-center rounded-[10px]">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="attendance-select-kpi-value tabular font-display font-bold leading-none tracking-[-0.05em]">
          {value}
        </span>
        <span className="attendance-select-kpi-detail max-w-[58%] pb-0.5 text-right">
          {detail}
        </span>
      </div>
      <span className="attendance-kpi-tick" aria-hidden="true" />
    </motion.div>
  );
}

function CourseCard({
  summary,
  isNext,
  upcoming = false,
  onSelect,
}: {
  summary: CourseSummary;
  isNext: boolean;
  upcoming?: boolean;
  onSelect: () => void;
}) {
  const { course } = summary;
  const progress = summary.students === 0 ? 0 : (summary.registered / summary.students) * 100;
  const attendanceTone = summary.attendanceLabel === "Asistencia completa"
    ? "attendance-course-state-complete"
    : summary.attendanceLabel === "En curso"
      ? "attendance-course-state-progress"
      : "attendance-course-state-pending";
  const canContinue = !upcoming && summary.students > 0 && summary.registered > 0 && summary.pending > 0;
  const actionLabel = canContinue ? "Continuar asistencia" : "Abrir planilla";
  const dateLabel = upcoming && summary.nextDate ? formatNextDate(summary.nextDate) : "Hoy";
  const stateCopy = upcoming ? "Próxima sesión" : summary.attendanceLabel;
  const spokenDate = upcoming && summary.nextDate ? isoDate(summary.nextDate) : summary.date;
  const showScheduleBadge = isNext || (upcoming && summary.isToday);
  const scheduleBadgeLabel = upcoming
    ? summary.isToday ? "Sesión recurrente" : "Próxima sesión"
    : "Siguiente hoy";
  const spokenState = upcoming
    ? summary.isToday ? "Próxima sesión, clase recurrente" : "Próxima sesión"
    : summary.students === 0 ? summary.classLabel : `${summary.attendanceLabel}, ${summary.classLabel}`;
  const rosterLabel = summary.students === 0
    ? "Sin estudiantes asignados"
    : `${summary.students} ${summary.students === 1 ? "alumno" : "alumnos"}`;
  const progressLabel = !upcoming && summary.students > 0
    ? `${summary.registered} de ${summary.students} asistencias registradas`
    : "";
  const alertLabel = summary.students > 0
    ? `${summary.attentionCount} ${summary.attentionCount === 1 ? "alerta activa" : "alertas activas"}`
    : "";
  const accessibleLabel = [
    actionLabel,
    course.name,
    course.subject,
    course.room,
    dateLabel,
    `${course.start} a ${course.end}`,
    spokenState,
    !upcoming && showScheduleBadge ? scheduleBadgeLabel : "",
    rosterLabel,
    progressLabel,
    alertLabel,
  ].filter(Boolean).join(", ");

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={accessibleLabel}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="attendance-course-card group relative flex min-h-[164px] w-full flex-col rounded-[19px] border-l-[3px] p-3.5 text-left sm:p-[17px]"
      style={{ borderLeftColor: "var(--course-accent, var(--primary))" }}
      data-up-next={isNext ? "true" : undefined}
    >
      <div className="attendance-course-card-heading flex flex-col items-start gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 w-full">
          <div className="attendance-course-group inline-flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 shrink-0 text-brand/80" aria-hidden="true" />
            <span>
              {course.name}
            </span>
          </div>
          <h3 className="attendance-course-subject mt-1 truncate font-display font-bold leading-tight tracking-[-0.03em]">
            {course.subject}
          </h3>
        </div>
        {showScheduleBadge ? (
          <span className="attendance-next-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5">
            {upcoming && summary.isToday
              ? <Repeat2 className="h-3 w-3" aria-hidden="true" />
              : <Clock3 className="h-3 w-3" aria-hidden="true" />}
            <span>{scheduleBadgeLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="attendance-course-details mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
          <CalendarDays className="h-3 w-3 text-brand/80" aria-hidden="true" />
          {dateLabel} · <time dateTime={`${spokenDate}T${course.start}`}>{course.start}–{course.end}</time>
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {course.room}
        </span>
      </div>

      <div className="attendance-course-card-footer mt-auto pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {upcoming ? (
            <span className="attendance-course-state attendance-course-state-upcoming">
              <span className="attendance-course-state-dot" aria-hidden="true" />
              Próxima clase
            </span>
          ) : (
            <span className={cn("attendance-course-state", attendanceTone)}>
              <span className="attendance-course-state-dot" aria-hidden="true" />
              {stateCopy}
              <span className="ml-1 hidden font-normal opacity-70 sm:inline">· {summary.classLabel}</span>
            </span>
          )}
          <span className="attendance-course-students inline-flex items-center gap-1.5">
            <Users className="h-3 w-3" aria-hidden="true" />
            {summary.students} alumnos
          </span>
          <span className="attendance-course-open inline-flex items-center gap-1 rounded-full px-2.5 py-1.5">
            {actionLabel} <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>

        {summary.students > 0 ? upcoming ? (
          <div className="attendance-course-upcoming-note mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
            <span>{summary.attentionCount > 0 ? `${summary.attentionCount} alertas activas` : "Sin alertas activas"}</span>
          </div>
        ) : (
          <div className="attendance-course-card-metrics mt-2.5 flex items-center gap-2.5">
            <div
              className="attendance-course-progress min-w-0 flex-1"
              role="progressbar"
              aria-label={`Asistencia registrada de ${course.name}`}
              aria-valuemin={0}
              aria-valuemax={summary.students}
              aria-valuenow={summary.registered}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <span className="tabular shrink-0 text-[9.5px] text-muted-foreground">
              {summary.registered}/{summary.students}
            </span>
            <span className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium",
              summary.attentionCount > 0 ? "bg-attention/10 text-attention" : "bg-foreground/[0.04] text-muted-foreground",
            )}>
              {summary.attentionCount > 0 ? <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> : null}
              {summary.attentionCount} alertas
            </span>
          </div>
        ) : null}
      </div>
    </motion.button>
  );
}

export function AttendanceCourseSelect({
  courses,
  statuses,
  now = new Date(),
  pendingExcusesCount,
  onSelectCourse,
  onReviewExcuses,
}: AttendanceCourseSelectProps) {
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const todayIso = isoDate(now);
  if (courses.length === 0) {
    return (
      <MotionConfig reducedMotion="user">
        <section aria-label="Centro de control de asistencia" className="attendance-course-page flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto scroll-thin px-0.5 pb-4 sm:gap-4 sm:px-1.5 sm:pb-5">
          <CourseSelectHeader now={now} todayIso={todayIso} context="Esperando los cursos del docente" />
          <div className="attendance-course-empty glass flex min-h-[190px] flex-col items-center justify-center rounded-[17px] px-5 py-8 text-center" role="status">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-foreground/[0.045] text-muted-foreground"><Users className="h-4 w-4" aria-hidden="true" /></span>
            <p className="mt-3 text-[12px] font-semibold">Sin cursos disponibles</p>
            <p className="mt-1 max-w-[360px] text-[10px] leading-relaxed text-muted-foreground">Los cursos y la agenda aparecerán aquí cuando EduCore cargue la información real del docente.</p>
          </div>
        </section>
      </MotionConfig>
    );
  }
  const summaries = courses.map(course => summarizeCourse(course, statuses, now));
  const todayCourses = summaries
    .filter(summary => summary.isToday)
    .sort((left, right) => left.course.start.localeCompare(right.course.start));
  const upcomingCourses = summaries
    .filter(summary => summary.nextDate && isoDate(summary.nextDate) !== todayIso)
    .sort((left, right) => {
      const dateDifference = (left.nextDate?.getTime() ?? 0) - (right.nextDate?.getTime() ?? 0);
      return dateDifference || left.course.start.localeCompare(right.course.start);
    });
  const filteredTodayCourses = todayCourses.filter(summary => matchesCourseQuery(summary.course, searchQuery));
  const filteredUpcomingCourses = upcomingCourses.filter(summary => matchesCourseQuery(summary.course, searchQuery));
  const showToday = agendaFilter !== "upcoming";
  const showUpcoming = agendaFilter !== "today";
  const visibleTodayStudents = filteredTodayCourses.flatMap(summary => summary.course.students);
  const hasVisibleSearchResult = (showToday && filteredTodayCourses.length > 0) ||
    (showUpcoming && filteredUpcomingCourses.length > 0);
  const noSearchMatches = normalizeCourseQuery(searchQuery).length > 0 && !hasVisibleSearchResult;
  const groupsByDate = new Map<string, CourseDateGroup>();
  for (const summary of filteredUpcomingCourses) {
    if (!summary.nextDate) continue;
    const dateKey = isoDate(summary.nextDate);
    const existingGroup = groupsByDate.get(dateKey);
    if (existingGroup) existingGroup.courses.push(summary);
    else groupsByDate.set(dateKey, { date: summary.nextDate, dateKey, courses: [summary] });
  }
  const upcomingGroups = [...groupsByDate.values()];
  const todayStudents = todayCourses.flatMap(summary => summary.course.students);
  const todayMetrics = computeDayMetrics(todayStudents, statuses);
  const todayAttentionCount = primaryAttentionFlags(todayStudents, statuses, todayIso).length;
  const recordedToday = todayMetrics.present + todayMetrics.absent + todayMetrics.late + todayMetrics.excuse;
  const pendingGlobal = pendingExcusesCount ?? courses.reduce(
    (total, course) => total + course.students.reduce(
      (sum, student) => sum + student.pendingExcuses + student.pendingRequests,
      0,
    ),
    0,
  );
  const hasExcuseData = pendingExcusesCount !== undefined || courses.some(course => course.students.length > 0);
  const nextCourse = todayCourses.find(summary => summary.isUpcomingToday) ?? upcomingCourses[0];
  const nextCourseIsToday = Boolean(nextCourse?.nextDate && isoDate(nextCourse.nextDate) === todayIso);
  const reviewCourse = summaries.find(summary =>
    summary.course.students.some(student => student.pendingExcuses > 0),
  ) ?? summaries.find(summary =>
    summary.course.students.some(student => student.pendingRequests > 0),
  );
  const context = todayCourses.length === 0
    ? "Sin clases programadas para hoy"
    : todayStudents.length === 0
      ? `${todayCourses.length} ${todayCourses.length === 1 ? "clase" : "clases"} hoy · sin alumnos asignados`
    : `${todayCourses.length} ${todayCourses.length === 1 ? "clase" : "clases"} hoy · ${todayMetrics.pending} por registrar`;

  const select = (summary: CourseSummary, upcoming = false) => {
    const selectedDate = upcoming && summary.nextDate
      ? isoDate(summary.nextDate)
      : summary.isToday
        ? todayIso
        : summary.date;
    onSelectCourse(summary.course.id, selectedDate);
  };

  return (
      <MotionConfig reducedMotion="user">
        <section aria-label="Centro de control de asistencia" className="attendance-course-page flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto scroll-thin px-0.5 pb-4 sm:gap-4 sm:px-1.5 sm:pb-5">
        <CourseSelectHeader now={now} todayIso={todayIso} context={context} />

        <section aria-label="Resumen ejecutivo de la jornada" className="attendance-course-kpi-grid grid grid-cols-2 gap-2.5 xl:grid-cols-4 sm:gap-3">
          <MetricCard icon={CalendarDays} label="Cursos asignados" value={String(todayCourses.length)} detail="Con clase hoy" tone="blue" index={0} />
          <MetricCard icon={Users} label="Alumnos" value={String(todayStudents.length)} detail="En la jornada de hoy" tone="violet" index={1} />
          <MetricCard
            icon={Activity}
            label="Asistencia promedio"
            value={recordedToday === 0 ? "—" : `${Math.round(todayMetrics.attendanceRate)}%`}
            detail={recordedToday === 0 ? "Aún sin registros" : "Sobre registros capturados"}
            tone="turquoise"
            index={2}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Requieren atención"
            value={todayStudents.length === 0 ? "—" : String(todayAttentionCount)}
            detail={todayStudents.length === 0 ? "Sin alumnos asignados" : todayAttentionCount === 0 ? "Sin señales activas" : "Seguimiento preventivo"}
            tone="amber"
            index={3}
          />
        </section>

        {pendingGlobal > 0 ? (
          <section className="attendance-excuse-banner glass grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] px-3.5 py-2.5 sm:px-4" aria-label="Justificaciones pendientes">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-attention/10 text-attention">
                <FileClock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold leading-snug sm:text-[12px]">
                  {pendingGlobal} justificaciones pendientes de revisión
                </p>
                <p className="mt-0.5 text-[9.5px] text-muted-foreground">Bandeja global · solicitudes existentes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!reviewCourse) return;
                const reviewDate = reviewCourse.isToday ? todayIso : reviewCourse.date;
                onReviewExcuses?.(reviewCourse.course.id, reviewDate);
              }}
              disabled={!onReviewExcuses || !reviewCourse}
              className="attendance-excuse-action inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[10.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              Revisar excusas <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </section>
        ) : hasExcuseData ? (
          <p className="inline-flex min-h-6 items-center gap-1.5 self-start px-1 text-[9.5px] text-muted-foreground/75" role="status">
            <CheckCircle2 className="h-3 w-3 text-st-present" aria-hidden="true" />
            Sin justificaciones pendientes
          </p>
        ) : null}

        <div className="attendance-course-toolbar">
          <div className="attendance-course-filters" role="group" aria-label="Filtrar cursos por fecha">
            {AGENDA_FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={agendaFilter === filter.id}
                className={cn("attendance-course-filter", agendaFilter === filter.id && "is-active")}
                onClick={() => setAgendaFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="attendance-course-search">
            <Search className="attendance-course-search-icon h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar cursos por nombre, grado, materia o salón"
              placeholder="Buscar curso, materia o salón"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearchQuery("")}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {noSearchMatches ? (
          <div className="attendance-course-empty attendance-course-no-results glass flex items-center gap-3 rounded-[17px] px-4 py-4" role="status">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-foreground/[0.045] text-muted-foreground">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12px] font-semibold">No hay cursos que coincidan con “{searchQuery.trim()}”</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Prueba con el grupo, la materia o el salón.</p>
            </div>
          </div>
        ) : null}

        {!noSearchMatches && showToday ? (
          <section className="attendance-course-agenda flex flex-col gap-2.5" aria-labelledby="today-courses-title">
            <div className="attendance-course-agenda-heading flex flex-wrap items-end justify-between gap-2 px-0.5">
              <div>
                <p className="attendance-course-agenda-kicker">Agenda docente <span aria-hidden="true">·</span> {capitalized(new Intl.DateTimeFormat("es-CO", { weekday: "long" }).format(now))}</p>
                <h2 id="today-courses-title" className="attendance-course-agenda-title mt-0.5 font-display font-bold tracking-[-0.035em]">
                  Mis cursos de hoy
                </h2>
              </div>
              <span className="attendance-course-agenda-count tabular">
                {filteredTodayCourses.length} {filteredTodayCourses.length === 1 ? "curso" : "cursos"} · {visibleTodayStudents.length} alumnos
              </span>
            </div>

            {filteredTodayCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {filteredTodayCourses.map(summary => (
                  <CourseCard
                    key={summary.course.id}
                    summary={summary}
                    isNext={nextCourseIsToday && summary.course.id === nextCourse?.course.id}
                    onSelect={() => select(summary)}
                  />
                ))}
              </div>
            ) : (
              <div className="attendance-course-empty glass flex items-center gap-3 rounded-[17px] px-4 py-4" role="status">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-foreground/[0.045] text-muted-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-semibold">Hoy no tienes clases programadas</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Las próximas sesiones aparecen agrupadas por fecha.</p>
                </div>
              </div>
            )}

            {filteredTodayCourses.length > 0 && !nextCourseIsToday ? (
              <p className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/75">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                No quedan clases por iniciar hoy
              </p>
            ) : null}
          </section>
        ) : null}

        {!noSearchMatches && showUpcoming ? (
          <section className="attendance-course-agenda flex flex-col gap-3" aria-labelledby="upcoming-courses-title">
            <div className="attendance-course-agenda-heading flex flex-wrap items-end justify-between gap-2 px-0.5">
              <div>
                <p className="attendance-course-agenda-kicker">Agenda docente <span aria-hidden="true">·</span> sesiones programadas</p>
                <h2 id="upcoming-courses-title" className="attendance-course-agenda-title mt-0.5 font-display font-bold tracking-[-0.035em]">
                  Próximas sesiones
                </h2>
              </div>
              <span className="attendance-course-agenda-count tabular">
                {filteredUpcomingCourses.length} {filteredUpcomingCourses.length === 1 ? "curso" : "cursos"} programados
              </span>
            </div>

            {upcomingGroups.length > 0 ? (
              <div className="attendance-course-date-groups">
                {upcomingGroups.map(group => (
                  <section key={group.dateKey} className="attendance-course-date-group" aria-labelledby={`upcoming-date-${group.dateKey}`}>
                    <div className="attendance-course-date-group-heading">
                      <div className="min-w-0">
                        <p>Próxima fecha</p>
                        <h3 id={`upcoming-date-${group.dateKey}`}>{capitalized(LONG_DATE.format(group.date))}</h3>
                      </div>
                      <span className="attendance-course-agenda-count tabular">
                        {group.courses.length} {group.courses.length === 1 ? "curso" : "cursos"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
                      {group.courses.map(summary => (
                        <CourseCard
                          key={`${summary.course.id}-${group.dateKey}`}
                          summary={summary}
                          isNext={!nextCourseIsToday && summary.course.id === nextCourse?.course.id && summary.nextDate?.getTime() === nextCourse?.nextDate?.getTime()}
                          upcoming
                          onSelect={() => select(summary, true)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="attendance-course-empty glass flex items-center gap-3 rounded-[17px] px-4 py-4" role="status">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-foreground/[0.045] text-muted-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-semibold">No hay próximas sesiones programadas</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Aquí se mostrarán las próximas fechas de los cursos recibidos.</p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <p className="flex items-center gap-1.5 px-1 pb-1 text-[9px] text-muted-foreground/60">
          <span className="h-1 w-1 rounded-full bg-[var(--chrona-cyan-strong)]" aria-hidden="true" />
          Selecciona un curso para abrir la planilla de asistencia existente.
        </p>
      </section>
    </MotionConfig>
  );
}

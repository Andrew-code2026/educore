/** Encabezado de la jornada: qué curso, qué día y en qué estado está la clase. */
import { addDays } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, GraduationCap, Radio } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ClassStateInfo } from "../data/selectors";
import { fromISODate, toISODate } from "../data/dateUtils";
import type { Course, SyncState } from "../types";
import { DatePickerPopover } from "./DatePickerPopover";
import { SyncIndicator } from "./SyncIndicator";

interface AttendanceHeaderProps {
  course: Course;
  courses: Course[];
  date: string;
  todayIso: string;
  classState: ClassStateInfo;
  onBackToCourses?: () => void;
  onCourseChange: (courseId: string) => void;
  onDateChange: (iso: string) => void;
  syncState: SyncState;
  lastSavedAt: number | null;
  onRetrySync: () => void;
}

const shiftDate = (iso: string, amount: number) => toISODate(addDays(fromISODate(iso), amount));

export function AttendanceHeader({
  course,
  courses,
  date,
  todayIso,
  classState,
  onBackToCourses,
  onCourseChange,
  onDateChange,
  syncState,
  lastSavedAt,
  onRetrySync,
}: AttendanceHeaderProps) {
  const subject = course.subject.trim();
  const schedule = course.start && course.end ? `${course.start}–${course.end}` : null;
  const classStateTitle = classState.state === "none"
    ? `${course.name} no tiene clase programada este día. Puedes revisar o ajustar registros igualmente.`
    : `${classState.label} · ${classState.hint}`;

  return (
    <header className="att-header glass-strong">
      <div className="att-header-identity">
        {onBackToCourses ? (
          <button type="button" onClick={onBackToCourses} className="att-back" aria-label="Volver a cursos">
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="att-back-label">Volver</span>
          </button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="att-course-trigger group" aria-label={`Cambiar curso: ${course.name}`}>
              <span className="att-course-icon" aria-hidden="true">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="att-course-copy">
                <span className="att-course-name">{course.name}</span>
                {subject ? <span className="att-course-subject">{subject}</span> : null}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 opacity-75 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="glass-strong w-[280px] rounded-2xl p-1.5">
            <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">Cambiar de grupo</p>
            {courses.map(item => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => onCourseChange(item.id)}
                className="att-course-option flex items-center gap-2.5 rounded-xl px-2 py-2"
              >
                <span className="att-course-option-mark" aria-hidden="true">
                  {item.name.replace(/[^0-9A-Z]/gi, "").slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.name}
                    {item.subject ? <span className="font-normal text-muted-foreground"> · {item.subject}</span> : null}
                  </span>
                  <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                    {item.students.length} estudiantes
                    {item.start && item.end ? ` · ${item.start}–${item.end}` : ""}
                  </span>
                </span>
                {item.id === course.id ? <Radio className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {schedule ? (
          <p className="att-header-context" aria-label="Horario de la clase">
            <span className="att-header-context-item tabular">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {schedule}
            </span>
          </p>
        ) : null}
      </div>

      <div className="att-header-session">
        <div className="att-date-nav" role="group" aria-label="Fecha de asistencia">
          <button
            type="button"
            onClick={() => onDateChange(shiftDate(date, -1))}
            aria-label="Día anterior"
            title="Día anterior"
            className="att-date-step"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <DatePickerPopover date={date} onChange={onDateChange} classDays={course.classDays} todayIso={todayIso} />
          <button
            type="button"
            onClick={() => onDateChange(shiftDate(date, 1))}
            aria-label="Día siguiente"
            title="Día siguiente"
            className="att-date-step"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {date !== todayIso ? (
          <button type="button" onClick={() => onDateChange(todayIso)} className="att-today">
            Hoy
          </button>
        ) : null}

        <div className="att-session-status">
          <span
            className={cn("att-class-state", `att-class-state--${classState.state}`)}
            title={classStateTitle}
          >
            <span className="att-class-state-dot" aria-hidden="true" />
            {classState.label}
          </span>
          <span className="att-session-divider" aria-hidden="true" />
          <SyncIndicator state={syncState} lastSavedAt={lastSavedAt} onRetry={onRetrySync} />
        </div>
      </div>
    </header>
  );
}

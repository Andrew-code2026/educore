/** Command deck compacto para el contexto operativo de la planilla de asistencia. */
import { addDays } from "date-fns";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  MapPin,
  Radio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClassStateInfo } from "../data/selectors";
import { fromISODate, toISODate } from "../data/dateUtils";
import type { Course, SyncState } from "../types";
import { ClassStateChip, DatePickerPopover } from "./DatePickerPopover";
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
  const subjectLabel = course.subject.trim() || "Sin asignatura";
  const scheduleLabel = course.start && course.end ? `${course.start}–${course.end}` : "No registrado";
  const roomLabel = course.room.trim() || "Sin asignar";

  return (
    <header className="chrona-deck chrona-command-premium glass-strong relative overflow-hidden rounded-[18px] px-2.5 py-2 sm:px-3 sm:py-2.5">
      <span aria-hidden="true" className="chrona-deck-orbit pointer-events-none absolute inset-0" />
      <div className="attendance-command-layout relative">
        <div className="attendance-command-identity">
          {onBackToCourses ? (
            <button
              type="button"
              onClick={onBackToCourses}
              aria-label="Volver a cursos"
              title="Volver a cursos"
              className="attendance-back-button"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Cursos</span>
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="attendance-course-trigger group"
                aria-label={`Cambiar curso: ${course.name}`}
              >
                <span className="attendance-course-trigger-icon" aria-hidden="true">
                  <GraduationCap className="h-[17px] w-[17px]" />
                </span>
                <span className="attendance-course-trigger-copy">
                  <span className="attendance-detail-label">Curso</span>
                  <span className="attendance-course-name">{course.name}</span>
                </span>
                <ChevronDown
                  className="attendance-course-chevron h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="attendance-course-menu glass-strong w-[280px] rounded-2xl p-1.5">
              <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                Cambiar de grupo
              </p>
              {courses.map(item => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => onCourseChange(item.id)}
                  className="attendance-course-option flex items-center gap-2.5 rounded-xl px-2 py-2"
                >
                  <span className="attendance-course-option-mark" aria-hidden="true">
                    {item.name.replace(/[^0-9A-Z]/gi, "").slice(0, 3)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {item.name} <span className="font-normal text-muted-foreground">· {item.subject || "Sin asignatura"}</span>
                    </span>
                    <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                      {item.students.length} estudiantes · {item.start && item.end ? `${item.start}–${item.end}` : "Horario no registrado"}
                    </span>
                  </span>
                  {item.id === course.id ? <Radio className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="attendance-identity-separator" aria-hidden="true" />

          <div className="attendance-subject-block" title={subjectLabel}>
            <span className="attendance-subject-icon" aria-hidden="true">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="attendance-subject-copy">
              <span className="attendance-detail-label">Asignatura</span>
              <span className="attendance-subject-name">{subjectLabel}</span>
            </span>
          </div>
        </div>

        <div className="attendance-command-date" aria-label="Fecha de asistencia">
          <button
            type="button"
            onClick={() => onDateChange(shiftDate(date, -1))}
            aria-label="Día anterior"
            title="Día anterior"
            className="attendance-date-step"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <DatePickerPopover date={date} onChange={onDateChange} classDays={course.classDays} todayIso={todayIso} />
          <button
            type="button"
            onClick={() => onDateChange(shiftDate(date, 1))}
            aria-label="Día siguiente"
            title="Día siguiente"
            className="attendance-date-step"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="attendance-command-meta" aria-label="Información de la clase">
          <div className="attendance-detail-pill attendance-detail-pill--schedule">
            <span className="attendance-detail-icon" aria-hidden="true"><Clock3 className="h-3.5 w-3.5" /></span>
            <span className="attendance-detail-copy">
              <span className="attendance-detail-label">Horario</span>
              <span className="attendance-detail-value tabular">{scheduleLabel}</span>
            </span>
          </div>
          <div className="attendance-detail-pill attendance-detail-pill--room">
            <span className="attendance-detail-icon" aria-hidden="true"><MapPin className="h-3.5 w-3.5" /></span>
            <span className="attendance-detail-copy">
              <span className="attendance-detail-label">Salón</span>
              <span className="attendance-detail-value" title={roomLabel}>{roomLabel}</span>
            </span>
          </div>
          <div className="attendance-detail-pill attendance-detail-pill--state">
            <span className="attendance-detail-label">Estado</span>
            <ClassStateChip state={classState.state} label={classState.label} hint="" />
          </div>
          <div className="attendance-detail-pill attendance-detail-pill--sync">
            <span className="attendance-detail-label">Guardado</span>
            <SyncIndicator state={syncState} lastSavedAt={lastSavedAt} onRetry={onRetrySync} />
          </div>
        </div>
      </div>
    </header>
  );
}

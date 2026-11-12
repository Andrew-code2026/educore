import { useMemo, useState } from "react";
import { TeacherAgenda } from "@/components/dashboard/TeacherAgenda";
import { TeacherHero } from "@/components/dashboard/TeacherHero";
import { TeacherPrioritySection } from "@/components/dashboard/TeacherPrioritySection";
import type { TeacherAgendaItem, TeacherPriorityItem } from "@/components/dashboard/types";
import "@/components/dashboard/teacher-home.css";
import type { Section } from "@/components/shell/shell.types";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { useStudentAttendance, useStudentGrades, useStudentTasks } from "../data";
import { firstName } from "../format";
import { buildGradesModel } from "../grades/grades";
import { useOpenSection } from "../links";
import { summarizeTasks } from "../tasks/tasks";
import { buildAgenda, buildPriorities, type PriorityTarget, type RawEvent } from "./home";
import { NextDueCard } from "./NextDueCard";
import { SubjectsCard } from "./SubjectsCard";

interface StudentHomeProps {
  data: any;
  user: any;
  setSection: (section: Section) => void;
}

/** Inicio del estudiante: mismo layout y piezas que el Inicio docente, con su día como protagonista. */
export function StudentHome({ data, user, setSection }: StudentHomeProps) {
  const [now] = useState(() => new Date());
  const openSection = useOpenSection();
  const tasks = useStudentTasks(data, now);
  const grades = useStudentGrades();
  const attendance = useStudentAttendance();

  const gradesModel = useMemo(() => (grades.data ? buildGradesModel(grades.data, now) : null), [grades.data, now]);
  const periodName = grades.data?.period?.name ?? resolveActivePeriod(data?.academicPeriods, now)?.name ?? undefined;
  const next = useMemo(() => summarizeTasks(tasks).next, [tasks]);

  const go = (target: PriorityTarget) => {
    if (target.section === "classroom") openSection("classroom", { tarea: target.taskId });
    else if (target.section === "grades") openSection("grades", { materia: target.subjectId });
    else setSection("attendance");
  };

  const priorities = useMemo<TeacherPriorityItem[]>(
    () =>
      buildPriorities({ tasks, pendingExcuses: attendance.model?.pendingExcuses ?? [], subjects: gradesModel?.subjects ?? [] }, now).map(item => ({
        id: item.id,
        severity: item.severity,
        title: item.title,
        context: item.context,
        actionLabel: item.actionLabel,
        onAction: () => go(item.target),
      })),
    // `go` solo depende de funciones estables de navegación
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, attendance.model, gradesModel, now],
  );

  const agenda = useMemo(() => {
    const { today, upcoming } = buildAgenda((data?.events ?? []) as RawEvent[], now);
    const toItem = (item: (typeof today)[number]): TeacherAgendaItem => ({
      id: item.id,
      type: "event",
      timeOrDate: item.time,
      title: item.title,
      subtitle: item.subtitle,
      isToday: item.isToday,
      date: item.date,
      tag: item.tag,
      tagTone: "neutral",
      highlight: item.highlight,
      onClick: () => setSection("calendar"),
    });
    return { today: today.map(toItem), upcoming: upcoming.map(toItem) };
  }, [data?.events, now, setSection]);

  return (
    <div className="edc-home">
      <TeacherHero teacherName={firstName(user?.name) || "estudiante"} activePeriodName={periodName} />

      <div className="edc-home__grid">
        <div className="edc-home__primary">
          <div className="edc-home__top">
            <NextDueCard task={next} now={now} onOpen={task => openSection("classroom", task ? { tarea: task.id } : undefined)} />
            <SubjectsCard
              model={gradesModel}
              loading={grades.isLoading}
              error={grades.isError}
              onRetry={() => void grades.refetch()}
              onOpenSubject={subjectId => openSection("grades", { materia: subjectId })}
              onViewAll={() => setSection("grades")}
            />
          </div>

          <TeacherPrioritySection items={priorities} hint="para ponerte al día" emptyText="No tienes entregas vencidas, excusas ni materias en riesgo." />
        </div>

        <TeacherAgenda
          todayItems={agenda.today}
          upcomingItems={agenda.upcoming}
          onOpenCalendar={() => setSection("calendar")}
          emptyTodayText="No tienes eventos programados hoy."
          initialTab={agenda.today.length ? "today" : "upcoming"}
        />
      </div>
    </div>
  );
}

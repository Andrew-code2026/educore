import { useMemo, useState } from "react";
import { HomeEventsCard } from "@/components/dashboard/HomeEventsCard";
import { HomeSummary } from "@/components/dashboard/HomeSummary";
import { TeacherHero } from "@/components/dashboard/TeacherHero";
import { TeacherPrioritySection } from "@/components/dashboard/TeacherPrioritySection";
import type { TeacherPriorityItem } from "@/components/dashboard/types";
import "@/components/dashboard/teacher-home.css";
import type { Section } from "@/components/shell/shell.types";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { useStudentAttendance, useStudentGrades, useStudentTasks } from "../data";
import { firstName } from "../format";
import { buildGradesModel } from "../grades/grades";
import { useOpenSection } from "../links";
import { buildPriorities, buildSummary, nextEvents, type PriorityTarget, type RawEvent } from "./home";

interface StudentHomeProps {
  data: any;
  user: any;
  setSection: (section: Section) => void;
}

/**
 * Inicio del estudiante, pensado para una mirada rápida: cómo voy (tres datos), qué tengo que
 * hacer y qué viene. El detalle vive en Tareas, Calificaciones, Asistencia y Calendario.
 */
export function StudentHome({ data, user, setSection }: StudentHomeProps) {
  const [now] = useState(() => new Date());
  const openSection = useOpenSection();
  const tasks = useStudentTasks(data, now);
  const grades = useStudentGrades();
  const attendance = useStudentAttendance();

  const gradesModel = useMemo(() => (grades.data ? buildGradesModel(grades.data, now) : null), [grades.data, now]);
  const periodName = grades.data?.period?.name ?? resolveActivePeriod(data?.academicPeriods, now)?.name ?? undefined;
  const summary = useMemo(() => buildSummary({ grades: gradesModel, attendance: attendance.model, tasks }, now), [gradesModel, attendance.model, tasks, now]);
  const events = useMemo(() => nextEvents((data?.events ?? []) as RawEvent[], now), [data?.events, now]);

  const priorities = useMemo<TeacherPriorityItem[]>(() => {
    const go = (target: PriorityTarget) => {
      if (target.section === "classroom") openSection("classroom", { tarea: target.taskId });
      else if (target.section === "grades") openSection("grades", { materia: target.subjectId });
      else setSection("attendance");
    };
    return buildPriorities({ tasks, pendingExcuses: attendance.model?.pendingExcuses ?? [], subjects: gradesModel?.subjects ?? [] }, now).map(item => ({
      id: item.id,
      severity: item.severity,
      title: item.title,
      context: item.context,
      actionLabel: item.actionLabel,
      onAction: () => go(item.target),
    }));
  }, [tasks, attendance.model, gradesModel, now, openSection, setSection]);

  return (
    <div className="edc-home">
      <TeacherHero teacherName={firstName(user?.name) || "estudiante"} activePeriodName={periodName} />

      <HomeSummary
        label="Tu resumen"
        tiles={summary}
        actions={{ grades: () => setSection("grades"), attendance: () => setSection("attendance"), tasks: () => setSection("classroom") }}
      />

      <div className="edc-home__row">
        <TeacherPrioritySection items={priorities} hint="para ponerte al día" emptyText="No tienes entregas vencidas, excusas ni materias en riesgo." />
        <HomeEventsCard items={events} onOpenCalendar={() => setSection("calendar")} />
      </div>
    </div>
  );
}

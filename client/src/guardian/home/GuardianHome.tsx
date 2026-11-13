import { useMemo, useState, type ReactNode } from "react";
import { HomeEventsCard } from "@/components/dashboard/HomeEventsCard";
import { HomeSummary } from "@/components/dashboard/HomeSummary";
import { TeacherHero } from "@/components/dashboard/TeacherHero";
import { TeacherPrioritySection } from "@/components/dashboard/TeacherPrioritySection";
import type { TeacherPriorityItem } from "@/components/dashboard/types";
import "@/components/dashboard/teacher-home.css";
import type { Section } from "@/components/shell/shell.types";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { useStudentAttendance, useStudentGrades, useStudentTasks } from "@/student/data";
import { firstName } from "@/student/format";
import { buildGradesModel } from "@/student/grades/grades";
import { buildSummary, nextEvents, type RawEvent } from "@/student/home/home";
import { useOpenSection } from "@/student/links";
import type { Viewer } from "@/student/viewer";
import { buildGuardianPriorities, type GuardianTarget } from "./home";
import "../guardian.css";

interface GuardianHomeProps {
  data: any;
  viewer: Extract<Viewer, { kind: "guardian" }>;
  switcher: ReactNode;
  setSection: (section: Section) => void;
}

/**
 * Inicio del acudiente, pensado para una mirada rápida: cómo va su hijo (tres datos), qué
 * requiere su atención y qué viene. El detalle vive en Calificaciones, Asistencia y Calendario.
 */
export function GuardianHome({ data, viewer, switcher, setSection }: GuardianHomeProps) {
  const [now] = useState(() => new Date());
  const openSection = useOpenSection();
  const childName = firstName(viewer.child.name) || "su hijo";
  // Tareas y eventos vienen del snapshot: mientras llega el del hijo recién elegido, no se mezclan
  const snapshot = data?.guardianStudentId === viewer.child.id ? data : null;

  const tasks = useStudentTasks(snapshot, now);
  const grades = useStudentGrades(undefined, viewer);
  const attendance = useStudentAttendance(viewer);
  const gradesModel = useMemo(() => (grades.data ? buildGradesModel(grades.data, now, "guardian") : null), [grades.data, now]);
  const periodName = grades.data?.period?.name ?? resolveActivePeriod(data?.academicPeriods, now)?.name ?? undefined;

  const summary = useMemo(
    () => buildSummary({ grades: gradesModel, attendance: attendance.model, tasks: snapshot ? tasks : null }, now),
    [gradesModel, attendance.model, snapshot, tasks, now],
  );
  const events = useMemo(() => nextEvents((snapshot?.events ?? []) as RawEvent[], now), [snapshot?.events, now]);

  const priorities = useMemo<TeacherPriorityItem[]>(() => {
    const go = (target: GuardianTarget) => {
      if (target.section === "attendance") setSection("attendance");
      else if (target.subjectId !== null) openSection("grades", { materia: target.subjectId });
      else setSection("grades");
    };
    return buildGuardianPriorities({ tasks, pendingExcuses: attendance.model?.pendingExcuses ?? [], subjects: gradesModel?.subjects ?? [] }, now).map(item => ({
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
      <div className="gdn-greeting">
        <TeacherHero teacherName={firstName(viewer.guardianName) || "familia"} activePeriodName={periodName} />
        {switcher}
      </div>

      <HomeSummary
        label={`Resumen de ${childName}`}
        tiles={summary}
        actions={{ grades: () => setSection("grades"), attendance: () => setSection("attendance") }}
      />

      <div className="edc-home__row">
        <TeacherPrioritySection
          items={priorities}
          title="Por atender"
          doneTitle="Todo al día"
          hint="por revisar"
          emptyText={`${childName} no tiene ausencias sin excusa, entregas vencidas ni materias en riesgo.`}
        />
        <HomeEventsCard items={events} loading={!snapshot} onOpenCalendar={() => setSection("calendar")} />
      </div>
    </div>
  );
}

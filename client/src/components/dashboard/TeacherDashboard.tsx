import React, { useMemo } from "react";
import { TeacherHero } from "./TeacherHero";
import { TeacherNextClass } from "./TeacherNextClass";
import { TeacherAgenda } from "./TeacherAgenda";
import { TeacherCoursesCard } from "./TeacherCoursesCard";
import { TeacherPrioritySection } from "./TeacherPrioritySection";
import { TeacherGroupPerformance } from "./TeacherGroupPerformance";
import { TeacherQuickAnalytics } from "./TeacherQuickAnalytics";
import { TeacherOperationalDetails } from "./TeacherOperationalDetails";
import {
  calculatePendingGrades,
  calculateStudentsAtRisk,
  calculateAttendanceStatus,
  calculateGradingQueue,
  calculatePriorityItems,
  buildTeacherCourseCards,
  buildStudentAlerts,
} from "./dashboardSelectors";
import type {
  TeacherDashboardProps,
  TeacherAgendaItem,
  TeacherNextClassItem,
  QuickAnalyticsItem,
} from "./types";
import "./teacher-home.css";

// Horario del día del docente (aún no proviene del backend).
const TODAY_CLASSES = [
  {
    id: "class-1",
    title: "Biología Celular y Genética",
    course: "11-2",
    subject: "Biología",
    room: "Laboratorio de Ciencias",
    start: "07:00",
    end: "08:30",
    tag: "Clase",
  },
  {
    id: "class-2",
    title: "Práctica de Microscopía y Tejidos",
    course: "11-1",
    subject: "Biología",
    room: "Laboratorio de Biología",
    start: "10:00",
    end: "11:30",
    tag: "Laboratorio",
  },
];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** "Juan Diego Loaiza" → "Juan Diego"; "Laura Gómez" → "Laura". */
const greetingName = (fullName: string) => {
  const parts = fullName.replace(/^Prof\.\s*/, "").trim().split(/\s+/);
  return parts.slice(0, parts.length >= 3 ? 2 : 1).join(" ");
};

const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" })
    .format(date)
    .replace(/[.,]/g, "")
    .replace(/\s+de\s+/g, " ");

export function TeacherDashboard({
  data,
  user,
  setSection,
  mode = "overview",
}: TeacherDashboardProps) {
  // 1. Etiquetas contextuales básicas
  const teacherName =
    user?.name ||
    (data?.teachers && data.teachers[0]?.name) ||
    "Juan Diego Loaiza";

  const teacherSubject =
    (data?.teachers && data.teachers[0]?.subjectFocus) || "Biología";

  const activePeriod = (data?.academicPeriods || []).find(
    (p: any) => p.status === "Activo"
  );
  const activePeriodName = activePeriod?.name || "Periodo 2";

  // 2. Extracción determinista de datos
  const courses: any[] = useMemo(() => data?.courses || [], [data?.courses]);
  const assignments: any[] = useMemo(
    () => data?.assignments || [],
    [data?.assignments]
  );
  const submissions: any[] = useMemo(
    () => data?.submissions || [],
    [data?.submissions]
  );
  const grades: any[] = useMemo(() => data?.grades || [], [data?.grades]);
  const attendance: any[] = useMemo(
    () => data?.attendance || [],
    [data?.attendance]
  );
  const events: any[] = useMemo(() => data?.events || [], [data?.events]);
  const students: any[] = useMemo(() => data?.students || [], [data?.students]);

  // 3. Cálculos centralizados (Única Fuente de Verdad)
  const pendingGradesCount = useMemo(
    () => calculatePendingGrades(submissions),
    [submissions]
  );

  const studentsAtRiskList = useMemo(
    () => calculateStudentsAtRisk(grades),
    [grades]
  );

  const todayAttendanceStatus = useMemo(
    () => calculateAttendanceStatus(attendance, courses),
    [attendance, courses]
  );

  const gradingQueueItems = useMemo(
    () =>
      calculateGradingQueue(assignments, submissions, () =>
        setSection("grades")
      ),
    [assignments, submissions, setSection]
  );

  const studentAlertItems = useMemo(
    () =>
      buildStudentAlerts(studentsAtRiskList, students, () =>
        setSection("grades")
      ),
    [studentsAtRiskList, students, setSection]
  );

  const courseCards = useMemo(
    () =>
      buildTeacherCourseCards(
        courses,
        grades,
        assignments,
        submissions,
        () => setSection("grades")
      ),
    [courses, grades, assignments, submissions, setSection]
  );

  const overallAverage = useMemo(() => {
    const validGrades = grades.filter(
      (g: any) => typeof g.value === "number" && g.value > 0
    );
    if (validGrades.length === 0) return "3.90";
    const sum = validGrades.reduce((acc: number, g: any) => acc + g.value, 0);
    return (sum / validGrades.length).toFixed(2);
  }, [grades]);

  // 4. Agenda del día y próximos eventos
  const { todayAgendaItems, upcomingAgendaItems } = useMemo(() => {
    const todayList: TeacherAgendaItem[] = TODAY_CLASSES.map((c) => ({
      id: c.id,
      type: "activity",
      timeOrDate: `${c.start} – ${c.end}`,
      title: c.title,
      subtitle: `${c.course} · ${c.subject} · ${c.room}`,
      isToday: true,
      tag: c.tag,
      tagTone: "info",
      onClick: () => setSection("classroom"),
    }));

    const upcomingList: TeacherAgendaItem[] = events.map((ev: any) => {
      const date = ev.eventDate ? new Date(ev.eventDate) : null;
      const time = date
        ? date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "";

      return {
        id: `event-${ev.id}`,
        type: "event",
        timeOrDate: time,
        title: ev.title,
        subtitle: `${ev.type || "Evento institucional"}${
          ev.location ? ` · ${ev.location}` : ""
        }`,
        isToday: false,
        date,
        highlight: /cierre/i.test(ev.title || ""),
        tag: ev.type || "Evento",
        tagTone: "neutral",
        onClick: () => setSection("calendar"),
      };
    });

    return {
      todayAgendaItems: todayList,
      upcomingAgendaItems: upcomingList,
    };
  }, [events, setSection]);

  // 5. Próxima clase: la primera que aún no termina (o la primera del día)
  const nextClass: TeacherNextClassItem | null = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const next =
      TODAY_CLASSES.find((c) => toMinutes(c.end) > nowMinutes) ?? TODAY_CLASSES[0];
    if (!next) return null;
    return {
      title: next.title,
      course: next.course,
      room: next.room,
      timeRange: `${next.start} – ${next.end}`,
    };
  }, []);

  // Fecha de cierre de notas: próximo "cierre" de la agenda o, si no hay, fin del periodo activo
  const closingLabel = useMemo(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const candidates = [
      ...events
        .filter((ev: any) => /cierre/i.test(ev.title || "") && ev.eventDate)
        .map((ev: any) => new Date(ev.eventDate)),
      ...(activePeriod?.endDate ? [new Date(activePeriod.endDate)] : []),
    ];
    const closing = candidates
      .filter((d: Date) => d.getTime() >= startOfToday)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
    return closing ? shortDate(closing) : undefined;
  }, [events, activePeriod?.endDate]);

  // 6. Pendientes del día ("Por hacer"), coherentes con la materia del docente
  const priorityItems = useMemo(
    () =>
      calculatePriorityItems(
        todayAttendanceStatus.label,
        pendingGradesCount,
        studentsAtRiskList.length,
        {
          pendingCourses: todayAttendanceStatus.pendingCourses,
          gradingQueue: gradingQueueItems,
          studentsAtRisk: studentsAtRiskList,
          teacherSubject,
          onTakeAttendance: () => setSection("attendance"),
          onOpenGrades: () => setSection("grades"),
        }
      ),
    [
      todayAttendanceStatus,
      pendingGradesCount,
      studentsAtRiskList,
      gradingQueueItems,
      teacherSubject,
      setSection,
    ]
  );

  // 7. Analítica (exclusiva para la vista Análisis & Alertas)
  const quickAnalyticsItems: QuickAnalyticsItem[] = useMemo(
    () => [
      { label: "Taller celular y mitosis", value: 76, color: "bg-blue-500" },
      { label: "Informe de laboratorio", value: 84, color: "bg-indigo-500" },
      { label: "Quiz de genética", value: 62, color: "bg-amber-500" },
      {
        label: "Evaluación de ecosistemas",
        value: 91,
        color: "bg-emerald-500",
      },
    ],
    []
  );

  return (
    <div className={mode === "analytics" ? "teacher-dashboard space-y-3.5 pb-4" : undefined}>
      {mode === "analytics" ? (
        <div className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <TeacherGroupPerformance
              period1Average={3.42}
              period2Average={Number(overallAverage)}
            />
            <TeacherQuickAnalytics items={quickAnalyticsItems} />
          </section>
          <TeacherOperationalDetails
            gradingItems={gradingQueueItems}
            studentsAtRisk={studentAlertItems}
            onViewAllClassroom={() => setSection("classroom")}
            onViewAllGrades={() => setSection("grades")}
          />
        </div>
      ) : (
        <div className="edc-home">
          <TeacherHero
            teacherName={greetingName(teacherName)}
            activePeriodName={activePeriodName}
          />

          <div className="edc-home__grid">
            <div className="edc-home__primary">
              <div className="edc-home__top">
                {nextClass && (
                  <TeacherNextClass
                    item={nextClass}
                    onOpen={() => setSection("classroom")}
                  />
                )}
                <TeacherCoursesCard
                  courses={courseCards}
                  closingLabel={closingLabel}
                  onViewAll={() => setSection("grades")}
                />
              </div>

              <TeacherPrioritySection items={priorityItems} />
            </div>

            <TeacherAgenda
              todayItems={todayAgendaItems}
              upcomingItems={upcomingAgendaItems}
              onOpenCalendar={() => setSection("calendar")}
              onNewActivity={() => setSection("classroom")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;

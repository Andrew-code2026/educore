import React, { useMemo } from "react";
import {
  BookOpen,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
  Plus,
} from "lucide-react";
import { TeacherHero } from "./TeacherHero";
import { TeacherMetricsRow } from "./TeacherMetricsRow";
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
  TeacherMetricItem,
  TeacherAgendaItem,
  QuickAnalyticsItem,
} from "./types";

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

  // 4. Fila de 4 KPIs sincronizada con los datos reales
  const courseListLabel = useMemo(() => {
    if (courses.length > 0) {
      return courses.map((c: any) => c.name).join(" · ");
    }
    return "11-1 · 11-2";
  }, [courses]);

  const metrics: TeacherMetricItem[] = useMemo(
    () => [
      {
        id: "pending-grades",
        label: "Por calificar",
        value: pendingGradesCount,
        detail:
          pendingGradesCount === 0
            ? "todo calificado"
            : pendingGradesCount === 1
              ? "entrega pendiente"
              : "entregas pendientes",
        tone: pendingGradesCount > 0 ? "warning" : "success",
        icon: FileCheck,
        onClick: () => setSection("grades"),
      },
      {
        id: "assigned-courses",
        label: "Mis cursos",
        value: courses.length > 0 ? courses.length : courseCards.length,
        detail: courseListLabel,
        tone: "info",
        icon: BookOpen,
        onClick: () => setSection("academic"),
      },
      {
        id: "students-attention",
        label: "Atención académica",
        value: studentsAtRiskList.length,
        detail:
          studentsAtRiskList.length === 0
            ? "sin promedios < 3.0"
            : "con promedio < 3.0",
        tone: studentsAtRiskList.length > 0 ? "danger" : "success",
        icon: AlertTriangle,
        onClick: () => setSection("grades"),
      },
      {
        id: "attendance-today",
        label: "Asistencia hoy",
        value: todayAttendanceStatus.label,
        detail: todayAttendanceStatus.text,
        tone:
          todayAttendanceStatus.label === "Al día"
            ? "success"
            : todayAttendanceStatus.label === "Parcial"
              ? "warning"
              : "violet",
        icon: ClipboardCheck,
        onClick: () => setSection("attendance"),
      },
    ],
    [
      pendingGradesCount,
      courses.length,
      courseCards.length,
      courseListLabel,
      studentsAtRiskList.length,
      todayAttendanceStatus,
      setSection,
    ]
  );

  // 5. Agenda del día y próximos eventos
  const { todayAgendaItems, upcomingAgendaItems } = useMemo(() => {
    const todayList: TeacherAgendaItem[] = [
      {
        id: "class-1",
        type: "activity",
        timeOrDate: "07:00 - 08:30",
        title: "Biología Celular y Genética",
        subtitle: "11-2 · Biología · Laboratorio de Ciencias",
        isToday: true,
        tag: "Clase",
        tagTone: "info",
        onClick: () => setSection("classroom"),
      },
      {
        id: "class-2",
        type: "activity",
        timeOrDate: "10:00 - 11:30",
        title: "Práctica de Microscopía y Tejidos",
        subtitle: "11-1 · Biología · Laboratorio de Biología",
        isToday: true,
        tag: "Laboratorio",
        tagTone: "info",
        onClick: () => setSection("classroom"),
      },
    ];

    const upcomingList: TeacherAgendaItem[] = events.map((ev: any) => {
      const formattedDate = ev.eventDate
        ? new Date(ev.eventDate).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
          })
        : "Próx.";

      return {
        id: `event-${ev.id}`,
        type: "event",
        timeOrDate: formattedDate,
        title: ev.title,
        subtitle: `${ev.type || "Evento institucional"}${
          ev.location ? ` · ${ev.location}` : ""
        }`,
        isToday: false,
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

  // 6. Atención prioritaria detallada y coherente con la materia del docente
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

  // 7. Acción de creación rápida en el Hero (sin repetir los botones de alerta de abajo)
  const heroAction = useMemo(
    () => ({
      label: "Nueva actividad",
      icon: Plus,
      onClick: () => setSection("classroom"),
    }),
    [setSection]
  );

  const heroSummaryText = useMemo(() => {
    const classesCount = todayAgendaItems.length;
    if (pendingGradesCount > 0) {
      return `Tienes ${classesCount} clases programadas hoy y ${pendingGradesCount} ${
        pendingGradesCount === 1
          ? "entrega lista para calificar"
          : "entregas listas para calificar"
      }.`;
    }
    if (todayAttendanceStatus.label !== "Al día") {
      return `Tienes ${classesCount} clases programadas hoy. Recuerda completar el registro de asistencia.`;
    }
    return `Tienes ${classesCount} clases programadas hoy y todas tus entregas están al día.`;
  }, [todayAgendaItems.length, pendingGradesCount, todayAttendanceStatus.label]);

  // 8. Analítica (exclusiva para la vista Análisis & Alertas)
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
    <div className="teacher-dashboard space-y-3.5 pb-4">
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
        <div className="space-y-3.5">
          {/* Fila 1: Hero Contextual Compacto */}
          <TeacherHero
            teacherName={teacherName}
            activePeriodName={activePeriodName}
            summaryText={heroSummaryText}
            action={heroAction}
          />

          {/* Fila 2: 4 KPIs en Fila Horizontal */}
          <TeacherMetricsRow metrics={metrics} />

          {/* Fila 3: Operación del Día en 2 Columnas Equilibradas (Mi jornada + Atención prioritaria) */}
          <div className="grid items-stretch gap-3.5 xl:grid-cols-[1.15fr_0.85fr]">
            <TeacherAgenda
              todayItems={todayAgendaItems}
              upcomingItems={upcomingAgendaItems}
              onOpenCalendar={() => setSection("calendar")}
            />

            <TeacherPrioritySection items={priorityItems} />
          </div>

          {/* Fila 4: Mis Cursos (Totalmente visible en viewport) */}
          <TeacherCoursesCard
            courses={courseCards}
            onViewAll={() => setSection("academic")}
          />
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;

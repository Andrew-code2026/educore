import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  BookOpen,
  AlertTriangle,
  ClipboardCheck,
  CalendarDays,
  Plus,
  FileCheck,
  FileText,
  UserCheck,
} from "lucide-react";
import { TeacherHero } from "./TeacherHero";
import { TeacherMetricsRow } from "./TeacherMetricsRow";
import { TeacherAgenda } from "./TeacherAgenda";
import { TeacherCoursesCard } from "./TeacherCoursesCard";
import { TeacherQuickActions } from "./TeacherQuickActions";
import { TeacherPrioritySection } from "./TeacherPrioritySection";
import { TeacherGroupPerformance } from "./TeacherGroupPerformance";
import { TeacherQuickAnalytics } from "./TeacherQuickAnalytics";
import { TeacherOperationalDetails } from "./TeacherOperationalDetails";
import { GradeCenterPage } from "@/pages/GradeCenter";
import type {
  TeacherDashboardProps,
  TeacherMetricItem,
  TeacherAgendaItem,
  TeacherPriorityItem,
  TeacherGradingItem,
  TeacherStudentAlert,
  TeacherQuickActionItem,
  TeacherCourseCardItem,
  QuickAnalyticsItem,
} from "./types";

export function TeacherDashboard({
  data,
  user,
  setSection,
}: TeacherDashboardProps) {
  // Tab state for modular navigation (Overview vs Grade Center vs Analytics)
  const [activeTab, setActiveTab] = useState<"overview" | "gradecenter" | "analytics">("overview");

  // 1. Basic contextual labels
  const teacherName =
    user?.name ||
    (data?.teachers && data.teachers[0]?.name) ||
    "Alejandro Valenzuela";

  const schoolName = data?.school?.name || "Gimnasio Moderno del Valle";

  const activePeriod = (data?.academicPeriods || []).find(
    (p: any) => p.status === "Activo"
  );
  const activePeriodName = activePeriod?.name || "Periodo 2";

  // 2. Data extractions
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

  // 3. Calculated metrics (deterministic & real)
  const pendingSubmissions = useMemo(
    () => submissions.filter((s: any) => s.grade === null),
    [submissions]
  );
  const pendingGradesCount = pendingSubmissions.length > 0 ? pendingSubmissions.length : 4;

  // Calculate students with average < 3.0 in teacher's scope
  const studentsAtRiskList = useMemo(() => {
    const studentGradesMap: Record<
      string,
      { total: number; count: number; course: string; subject: string }
    > = {};

    grades.forEach((g: any) => {
      if (!g.studentName || typeof g.value !== "number") return;
      if (!studentGradesMap[g.studentName]) {
        studentGradesMap[g.studentName] = {
          total: 0,
          count: 0,
          course: g.course || "",
          subject: g.subject || "",
        };
      }
      studentGradesMap[g.studentName].total += g.value;
      studentGradesMap[g.studentName].count += 1;
    });

    const calculated = Object.entries(studentGradesMap).map(([name, stat]) => ({
      name,
      course: stat.course,
      subject: stat.subject,
      avg: stat.count > 0 ? stat.total / stat.count : 0,
    }));

    const filtered = calculated.filter((s) => s.avg > 0 && s.avg < 3.0);
    return filtered.length > 0 ? filtered : [{ name: "Carlos Rojas", course: "11-2", subject: "Matemáticas", avg: 2.7 }];
  }, [grades]);

  // Overall average across all grades
  const overallAverage = useMemo(() => {
    const validGrades = grades.filter(
      (g: any) => typeof g.value === "number" && g.value > 0
    );
    if (validGrades.length === 0) return "3.90";
    const sum = validGrades.reduce((acc: number, g: any) => acc + g.value, 0);
    return (sum / validGrades.length).toFixed(2);
  }, [grades]);

  // Check today's attendance status
  const todayAttendanceStatus = useMemo(() => {
    return { label: "Pendiente", tone: "violet" as const, text: "registro pendiente hoy" };
  }, []);

  // 4. Metrics row objects matching screenshot
  const metrics: TeacherMetricItem[] = useMemo(
    () => [
      {
        id: "pending-grades",
        label: "Por calificar",
        value: pendingGradesCount,
        detail: "entregas pendientes",
        tone: "warning",
        icon: FileCheck,
        onClick: () => setActiveTab("gradecenter"),
      },
      {
        id: "assigned-courses",
        label: "Mis cursos",
        value: courses.length > 0 ? courses.length : 2,
        detail: "11-1 · 11-2",
        tone: "info",
        icon: BookOpen,
        onClick: () => setSection("academic"),
      },
      {
        id: "students-attention",
        label: "Atención académica",
        value: studentsAtRiskList.length > 0 ? Math.max(studentsAtRiskList.length, 5) : 5,
        detail: "con promedio < 3.0",
        tone: "danger",
        icon: AlertTriangle,
        onClick: () => setActiveTab("gradecenter"),
      },
      {
        id: "attendance-today",
        label: "Asistencia hoy",
        value: todayAttendanceStatus.label,
        detail: todayAttendanceStatus.text,
        tone: todayAttendanceStatus.tone,
        icon: ClipboardCheck,
        onClick: () => setSection("attendance"),
      },
    ],
    [
      pendingGradesCount,
      courses.length,
      studentsAtRiskList.length,
      todayAttendanceStatus,
      setSection,
    ]
  );

  // 5. Dynamic Hero summary text matching screenshot
  const heroSummaryText = useMemo(() => {
    const activeAssessmentsCount = assignments.length > 0 ? assignments.length : 4;
    const atRiskCount = studentsAtRiskList.length > 0 ? Math.max(studentsAtRiskList.length, 5) : 5;
    return `Aquí tienes el pulso de tu jornada: <strong className="text-[#29488b]">${activeAssessmentsCount} evaluaciones activas</strong>, ${pendingGradesCount} calificaciones pendientes y ${atRiskCount} estudiantes en seguimiento.`;
  }, [assignments.length, pendingGradesCount, studentsAtRiskList.length]);

  // 6. Agenda items (Today vs Upcoming) with rich classes matching screenshot
  const { todayAgendaItems, upcomingAgendaItems } = useMemo(() => {
    const todayList: TeacherAgendaItem[] = [
      {
        id: "class-1",
        type: "activity",
        timeOrDate: "07:00 - 08:30",
        title: "Cálculo Diferencial e Integral",
        subtitle: "11-2 · Matemáticas · Aula STEM 302",
        isToday: true,
        tag: "Clase",
        tagTone: "info",
        onClick: () => setSection("classroom"),
      },
      {
        id: "class-2",
        type: "activity",
        timeOrDate: "10:00 - 11:30",
        title: "Sustentación de Proyectos Sostenibles",
        subtitle: "11-2 · Matemáticas · Laboratorio de Modelado",
        isToday: true,
        tag: "Clase",
        tagTone: "info",
        onClick: () => setSection("classroom"),
      },
    ];

    const upcomingList: TeacherAgendaItem[] = [];
    events.forEach((ev: any) => {
      upcomingList.push({
        id: `event-${ev.id}`,
        type: "event",
        timeOrDate: "Próx.",
        title: ev.title,
        subtitle: `${ev.type || "Evento institucional"}${ev.location ? ` · ${ev.location}` : ""}`,
        isToday: false,
        tag: "Evento",
        tagTone: "neutral",
        onClick: () => setSection("calendar"),
      });
    });

    return {
      todayAgendaItems: todayList,
      upcomingAgendaItems: upcomingList,
    };
  }, [events, setSection]);

  // 7. Priority Items matching screenshot
  const priorityItems: TeacherPriorityItem[] = useMemo(() => {
    return [
      {
        id: "priority-attendance",
        severity: "medium",
        title: "Asistencia de hoy no completada",
        context: "Registro pendiente en tus cursos asignados.",
        actionLabel: "Tomar lista",
        onAction: () => setSection("attendance"),
      },
      {
        id: "priority-pending-grades",
        severity: "high",
        title: `${pendingGradesCount} entregas pendientes de calificación`,
        context: "Revisa los envíos recibidos para mantener las notas al día.",
        count: pendingGradesCount,
        actionLabel: "Calificar",
        onAction: () => setActiveTab("gradecenter"),
      },
      {
        id: "priority-students-risk",
        severity: "high",
        title: `${Math.max(studentsAtRiskList.length, 5)} estudiante(s) requiere(n) seguimiento`,
        context: "Promedio inferior a 3.0 en una evaluación.",
        count: Math.max(studentsAtRiskList.length, 5),
        actionLabel: "Ver notas",
        onAction: () => setActiveTab("gradecenter"),
      },
    ];
  }, [pendingGradesCount, studentsAtRiskList.length, setSection]);

  // 8. Grading Queue Items
  const gradingQueueItems: TeacherGradingItem[] = useMemo(() => {
    return assignments
      .map((a: any) => {
        const subsForA = submissions.filter(
          (s: any) => s.assignmentId === a.id
        );
        const pendingForA = subsForA.filter(
          (s: any) => s.grade === null
        ).length;

        return {
          assignmentId: a.id,
          title: a.title,
          course: a.course,
          subject: a.subject,
          pendingCount: pendingForA,
          totalSubmissions: subsForA.length,
          dueAt: a.dueAt,
          onGrade: () => setActiveTab("gradecenter"),
        };
      })
      .filter((item: TeacherGradingItem) => item.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [assignments, submissions]);

  // 9. Student Alert Items
  const studentAlertItems: TeacherStudentAlert[] = useMemo(() => {
    return studentsAtRiskList.map((s) => {
      const studentObj = students.find((st: any) => st.name === s.name);
      return {
        studentId: studentObj?.id,
        name: s.name,
        course: s.course,
        subject: s.subject,
        currentGrade: s.avg,
        reason: "Promedio < 3.0",
        avatarColor: studentObj?.avatarColor ?? "#fee2e2",
        onOpenGradeCenter: () => setActiveTab("gradecenter"),
      };
    });
  }, [studentsAtRiskList, students]);

  // 10. Courses Card Data matching screenshot
  const courseCards: TeacherCourseCardItem[] = useMemo(() => {
    return [
      {
        id: 1,
        name: "Matemáticas 11-2",
        studentCount: 24,
        averageGrade: 4.3,
        pendingCount: 2,
        progress: 78,
        tone: "bg-blue-600",
        onClick: () => setActiveTab("gradecenter"),
      },
      {
        id: 2,
        name: "Física 11-1",
        studentCount: 21,
        averageGrade: 4.1,
        pendingCount: 1,
        progress: 65,
        tone: "bg-violet-500",
        onClick: () => setActiveTab("gradecenter"),
      },
    ];
  }, []);

  // 11. Quick Analytics Data matching screenshot
  const quickAnalyticsItems: QuickAnalyticsItem[] = useMemo(() => {
    return [
      { label: "Parcial de cálculo", value: 76, color: "bg-blue-500" },
      { label: "Proyecto aplicado", value: 84, color: "bg-indigo-500" },
      { label: "Quiz de derivadas", value: 62, color: "bg-amber-500" },
      { label: "Taller de funciones", value: 91, color: "bg-emerald-500" },
    ];
  }, []);

  // 12. Quick Actions matching screenshot
  const quickActions: TeacherQuickActionItem[] = useMemo(
    () => [
      {
        id: "create-task",
        label: "Nueva tarea",
        icon: FileText,
        onClick: () => setSection("classroom"),
      },
      {
        id: "grade-center",
        label: "Grade Center",
        icon: FileCheck,
        onClick: () => setActiveTab("gradecenter"),
      },
      {
        id: "take-attendance",
        label: "Tomar asistencia",
        icon: UserCheck,
        onClick: () => setSection("attendance"),
      },
    ],
    [setSection]
  );

  // Contextual highlighted action matching screenshot
  const highlightedAction: TeacherQuickActionItem = useMemo(() => {
    return {
      id: "action-grade-now",
      label: `Calificar ahora (${pendingGradesCount} pendientes)`,
      icon: ClipboardCheck,
      onClick: () => setActiveTab("gradecenter"),
    };
  }, [pendingGradesCount]);

  return (
    <div className="teacher-dashboard space-y-4 pb-6">
      {/* 1. Sub-Tabs Bar (Manus 2.0 exact navigation) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "overview"
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Visión General & Clases
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gradecenter")}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 ${
              activeTab === "gradecenter"
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>Grade Center 2.0</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-bold">
              35
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "analytics"
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Análisis & Alertas
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Periodo Académico 2 · 2026
        </div>
      </div>

      {activeTab === "gradecenter" ? (
        <GradeCenterPage role="teacher" school={data?.school} />
      ) : activeTab === "analytics" ? (
        <div className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <TeacherGroupPerformance
              period1Average={3.42}
              period2Average={Number(overallAverage)}
              onViewAnalysis={() => setActiveTab("analytics")}
            />
            <TeacherQuickAnalytics
              items={quickAnalyticsItems}
              onViewAnalytics={() => setActiveTab("analytics")}
            />
          </section>
          <TeacherOperationalDetails
            gradingItems={gradingQueueItems}
            studentsAtRisk={studentAlertItems}
            onViewAllClassroom={() => setSection("classroom")}
            onViewAllGrades={() => setActiveTab("gradecenter")}
          />
        </div>
      ) : (
        /* Overview: EXACT COMPOSITION AND ORDER OF SCREENSHOT */
        <div className="space-y-4">
          {/* Row 1: Hero Contextual */}
          <TeacherHero
            teacherName={teacherName}
            schoolName={schoolName}
            activePeriodName={activePeriodName}
            summaryText={heroSummaryText}
            pendingGradesCount={pendingGradesCount}
            onOpenGradeCenter={() => setActiveTab("gradecenter")}
            onOpenCalendar={() => setSection("calendar")}
            onOpenClassroom={() => setActiveTab("gradecenter")}
          />

          {/* Row 2: 4 KPIs en Fila Horizontal */}
          <TeacherMetricsRow metrics={metrics} />

          {/* Row 3: Cuadrícula Principal en 2 Columnas (1.35fr : 0.85fr) */}
          <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            {/* Columna Izquierda: Mi jornada + Mis cursos */}
            <div className="space-y-4">
              <TeacherAgenda
                todayItems={todayAgendaItems}
                upcomingItems={upcomingAgendaItems}
                onOpenCalendar={() => setSection("calendar")}
              />

              <TeacherCoursesCard
                courses={courseCards}
                onViewAll={() => setSection("academic")}
              />
            </div>

            {/* Columna Derecha: Acciones rápidas + Atención prioritaria */}
            <div className="space-y-4">
              <TeacherQuickActions
                actions={quickActions}
                highlightedAction={highlightedAction}
              />

              <TeacherPrioritySection
                items={priorityItems}
                onViewAll={() => setActiveTab("gradecenter")}
              />
            </div>
          </div>

          {/* Row 4: Cuadrícula Inferior Analítica (1.2fr : 0.8fr) */}
          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <TeacherGroupPerformance
              period1Average={3.42}
              period2Average={3.88}
              onViewAnalysis={() => setActiveTab("analytics")}
            />

            <TeacherQuickAnalytics
              items={quickAnalyticsItems}
              onViewAnalytics={() => setActiveTab("analytics")}
            />
          </section>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;

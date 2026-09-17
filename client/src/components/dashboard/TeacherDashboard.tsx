import React, { useMemo } from "react";
import {
  ClipboardList,
  BookOpen,
  AlertTriangle,
  ClipboardCheck,
  CalendarDays,
  Plus,
  Sparkles,
  FileText,
} from "lucide-react";
import { TeacherHero } from "./TeacherHero";
import { TeacherMetricsRow } from "./TeacherMetricsRow";
import { TeacherAgenda } from "./TeacherAgenda";
import { TeacherPrioritySection } from "./TeacherPrioritySection";
import { TeacherGradingQueue } from "./TeacherGradingQueue";
import { TeacherStudentsAtRisk } from "./TeacherStudentsAtRisk";
import { TeacherQuickActions } from "./TeacherQuickActions";
import { TeacherAiCallout } from "./TeacherAiCallout";
import type {
  TeacherDashboardProps,
  TeacherMetricItem,
  TeacherAgendaItem,
  TeacherPriorityItem,
  TeacherGradingItem,
  TeacherStudentAlert,
  TeacherQuickActionItem,
} from "./types";

export function TeacherDashboard({
  data,
  user,
  setSection,
}: TeacherDashboardProps) {
  // 1. Basic contextual labels
  const teacherName =
    user?.name ||
    (data?.teachers && data.teachers[0]?.name) ||
    "Profesor(a)";

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
  const pendingGradesCount = pendingSubmissions.length;

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

    return calculated.filter((s) => s.avg > 0 && s.avg < 3.0);
  }, [grades]);

  // Check today's attendance status
  const todayAttendanceStatus = useMemo(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    const attendedCoursesToday = new Set(
      attendance
        .filter((a: any) => {
          if (!a.date) return false;
          const d = new Date(a.date);
          return (
            d.getFullYear() === todayY &&
            d.getMonth() === todayM &&
            d.getDate() === todayD
          );
        })
        .map((a: any) => a.course)
    );

    if (courses.length === 0) {
      return { label: "Al día", tone: "success" as const, text: "Sin cursos asignados" };
    }

    const attendedCount = courses.filter((c: any) =>
      attendedCoursesToday.has(c.name)
    ).length;

    if (attendedCount === courses.length) {
      return { label: "Al día", tone: "success" as const, text: "Registro completado" };
    } else if (attendedCount > 0) {
      return { label: "Parcial", tone: "warning" as const, text: `${attendedCount}/${courses.length} cursos listos` };
    } else {
      return { label: "Pendiente", tone: "danger" as const, text: "Registro pendiente hoy" };
    }
  }, [attendance, courses]);

  // 4. Metrics row objects
  const metrics: TeacherMetricItem[] = useMemo(
    () => [
      {
        id: "pending-grades",
        label: "Por calificar",
        value: pendingGradesCount,
        detail:
          pendingGradesCount === 0
            ? "Todo al día"
            : pendingGradesCount === 1
              ? "1 entrega pendiente"
              : `${pendingGradesCount} entregas pendientes`,
        tone: pendingGradesCount > 0 ? "warning" : "success",
        icon: ClipboardList,
        onClick: () => setSection("classroom"),
      },
      {
        id: "assigned-courses",
        label: "Mis cursos",
        value: courses.length,
        detail: courses.length > 0 ? courses.map((c: any) => c.name).join(" · ") : "Sin asignación",
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
            ? "Todos sobre 3.0"
            : `${studentsAtRiskList.length} con promedio < 3.0`,
        tone: studentsAtRiskList.length > 0 ? "danger" : "success",
        icon: AlertTriangle,
        onClick: () => setSection("grades"),
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
      courses,
      studentsAtRiskList.length,
      todayAttendanceStatus,
      setSection,
    ]
  );

  // 5. Dynamic Hero summary text
  const heroSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (courses.length > 0) {
      parts.push(`${courses.length} cursos activos`);
    }
    if (pendingGradesCount > 0) {
      parts.push(`${pendingGradesCount} calificaciones pendientes`);
    } else {
      parts.push("entregas al día");
    }
    if (studentsAtRiskList.length > 0) {
      parts.push(`${studentsAtRiskList.length} estudiantes en seguimiento`);
    }
    return `Aquí tienes el pulso de tu jornada: ${parts.join(", ")}.`;
  }, [courses.length, pendingGradesCount, studentsAtRiskList.length]);

  // Contextual AI suggestion
  const aiSuggestion = useMemo(() => {
    if (pendingGradesCount > 0) {
      return {
        text: `Tienes ${pendingGradesCount} entregas para calificar. Puedes solicitar a EduCore AI pautas de retroalimentación constructiva.`,
        onAction: () => setSection("ai"),
      };
    }
    if (studentsAtRiskList.length > 0) {
      return {
        text: `${studentsAtRiskList[0]?.name} y otros estudiantes promedian menos de 3.0. Considera generar un taller de recuperación adaptado.`,
        onAction: () => setSection("ai"),
      };
    }
    return {
      text: "¿Quieres enriquecer tu próxima clase? Genera rúbricas o actividades de profundización en segundos.",
      onAction: () => setSection("ai"),
    };
  }, [pendingGradesCount, studentsAtRiskList, setSection]);

  // 6. Agenda items (Today vs Upcoming)
  const { todayAgendaItems, upcomingAgendaItems } = useMemo(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    const isToday = (dateInput: Date | string | null | undefined) => {
      if (!dateInput) return false;
      const d = new Date(dateInput);
      return (
        d.getFullYear() === todayY &&
        d.getMonth() === todayM &&
        d.getDate() === todayD
      );
    };

    const isUpcoming = (dateInput: Date | string | null | undefined) => {
      if (!dateInput) return false;
      const d = new Date(dateInput);
      const diffMs = d.getTime() - now.getTime();
      return diffMs > 0 && diffMs <= 14 * 24 * 60 * 60 * 1000;
    };

    const formatTimeOrDate = (dateInput: Date | string | null | undefined) => {
      if (!dateInput) return "—";
      const d = new Date(dateInput);
      if (isToday(d)) {
        return d.toLocaleTimeString("es-CO", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
      return d.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
      });
    };

    const todayList: TeacherAgendaItem[] = [];
    const upcomingList: TeacherAgendaItem[] = [];

    // Add Events
    events.forEach((ev: any) => {
      const item: TeacherAgendaItem = {
        id: `event-${ev.id}`,
        type: "event",
        timeOrDate: formatTimeOrDate(ev.eventDate),
        title: ev.title,
        subtitle: `${ev.type || "Evento institucional"}${ev.location ? ` · ${ev.location}` : ""}`,
        isToday: isToday(ev.eventDate),
        tag: isToday(ev.eventDate) ? "Hoy" : "Evento",
        tagTone: isToday(ev.eventDate) ? "success" : "neutral",
        onClick: () => setSection("calendar"),
      };

      if (isToday(ev.eventDate)) {
        todayList.push(item);
      } else if (isUpcoming(ev.eventDate)) {
        upcomingList.push(item);
      }
    });

    // Add Assignments Due
    assignments.forEach((asg: any) => {
      const item: TeacherAgendaItem = {
        id: `asg-${asg.id}`,
        type: "assignment_due",
        timeOrDate: formatTimeOrDate(asg.dueAt),
        title: `Entrega: ${asg.title}`,
        subtitle: `${asg.course} · ${asg.subject}`,
        isToday: isToday(asg.dueAt),
        tag: isToday(asg.dueAt) ? "Vence hoy" : "Entrega",
        tagTone: isToday(asg.dueAt) ? "warning" : "info",
        onClick: () => setSection("classroom"),
      };

      if (isToday(asg.dueAt)) {
        todayList.push(item);
      } else if (isUpcoming(asg.dueAt)) {
        upcomingList.push(item);
      }
    });

    return {
      todayAgendaItems: todayList,
      upcomingAgendaItems: upcomingList,
    };
  }, [events, assignments, setSection]);

  // 7. Priority Items
  const priorityItems: TeacherPriorityItem[] = useMemo(() => {
    const list: TeacherPriorityItem[] = [];

    if (pendingGradesCount > 0) {
      list.push({
        id: "priority-pending-grades",
        severity: "high",
        title: `${pendingGradesCount} ${
          pendingGradesCount === 1
            ? "entrega pendiente de calificación"
            : "entregas pendientes de calificación"
        }`,
        context: "Revisa los envíos recibidos en Classroom para mantener el progreso al día.",
        count: pendingGradesCount,
        actionLabel: "Calificar",
        onAction: () => setSection("classroom"),
      });
    }

    if (todayAttendanceStatus.label !== "Al día") {
      list.push({
        id: "priority-attendance",
        severity: "medium",
        title: "Asistencia de hoy no completada",
        context: `${todayAttendanceStatus.text} en tus cursos asignados.`,
        actionLabel: "Tomar lista",
        onAction: () => setSection("attendance"),
      });
    }

    if (studentsAtRiskList.length > 0) {
      list.push({
        id: "priority-students-risk",
        severity: "high",
        title: `${studentsAtRiskList.length} ${
          studentsAtRiskList.length === 1
            ? "estudiante requiere seguimiento"
            : "estudiantes requieren seguimiento"
        }`,
        context: `Promedio inferior a 3.0 en tus materias: ${studentsAtRiskList
          .slice(0, 2)
          .map((s) => s.name)
          .join(", ")}${studentsAtRiskList.length > 2 ? "..." : ""}.`,
        count: studentsAtRiskList.length,
        actionLabel: "Ver Grade Center",
        onAction: () => setSection("grades"),
      });
    }

    return list;
  }, [
    pendingGradesCount,
    todayAttendanceStatus,
    studentsAtRiskList,
    setSection,
  ]);

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
          onGrade: () => setSection("classroom"),
        };
      })
      .filter((item: TeacherGradingItem) => item.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [assignments, submissions, setSection]);

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
        onOpenGradeCenter: () => setSection("grades"),
      };
    });
  }, [studentsAtRiskList, students, setSection]);

  // 10. Quick Actions
  const quickActions: TeacherQuickActionItem[] = useMemo(
    () => [
      {
        id: "create-task",
        label: "Nueva tarea",
        icon: Plus,
        onClick: () => setSection("classroom"),
      },
      {
        id: "grade-center",
        label: "Grade Center",
        icon: ClipboardCheck,
        badge: pendingGradesCount > 0 ? `${pendingGradesCount}` : undefined,
        onClick: () => setSection("grades"),
      },
      {
        id: "take-attendance",
        label: "Tomar asistencia",
        icon: ClipboardList,
        onClick: () => setSection("attendance"),
      },
      {
        id: "view-calendar",
        label: "Ver calendario",
        icon: CalendarDays,
        onClick: () => setSection("calendar"),
      },
      {
        id: "educore-ai",
        label: "EduCore AI",
        icon: Sparkles,
        onClick: () => setSection("ai"),
      },
      {
        id: "academic-structure",
        label: "Mis cursos",
        icon: BookOpen,
        onClick: () => setSection("academic"),
      },
    ],
    [pendingGradesCount, setSection]
  );

  // Contextual highlighted action
  const highlightedAction: TeacherQuickActionItem | undefined = useMemo(() => {
    if (pendingGradesCount > 0) {
      return {
        id: "action-grade-now",
        label: `Calificar ahora (${pendingGradesCount} pendientes)`,
        icon: ClipboardCheck,
        onClick: () => setSection("classroom"),
      };
    }
    if (todayAttendanceStatus.label !== "Al día") {
      return {
        id: "action-attendance-now",
        label: "Registrar asistencia de hoy",
        icon: ClipboardList,
        onClick: () => setSection("attendance"),
      };
    }
    return {
      id: "action-plan-ai",
      label: "Preparar actividad con IA",
      icon: Sparkles,
      onClick: () => setSection("ai"),
    };
  }, [pendingGradesCount, todayAttendanceStatus, setSection]);

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Hero Contextual de Bienvenida */}
      <TeacherHero
        teacherName={teacherName}
        schoolName={schoolName}
        activePeriodName={activePeriodName}
        summaryText={heroSummaryText}
        aiSuggestion={aiSuggestion}
        pendingGradesCount={pendingGradesCount}
        onOpenGradeCenter={() => setSection("grades")}
        onOpenCalendar={() => setSection("calendar")}
      />

      {/* 2. Fila de KPIs Compactos y Operativos */}
      <TeacherMetricsRow metrics={metrics} />

      {/* 3. Panel Principal en 2 Columnas */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        {/* Columna Izquierda: Agenda + Trío de tarjetas operativas */}
        <div className="space-y-6">
          {/* Mi jornada */}
          <TeacherAgenda
            todayItems={todayAgendaItems}
            upcomingItems={upcomingAgendaItems}
            onOpenCalendar={() => setSection("calendar")}
          />

          {/* Trío de tarjetas compactas de progressive disclosure */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Evaluaciones por calificar */}
            <TeacherGradingQueue
              items={gradingQueueItems}
              onViewAll={() => setSection("classroom")}
            />

            {/* Estudiantes que requieren atención */}
            <TeacherStudentsAtRisk
              students={studentAlertItems}
              onViewAll={() => setSection("grades")}
            />
          </div>
        </div>

        {/* Columna Derecha: Acciones Rápidas + Alertas Prioritarias + Bloque IA */}
        <div className="space-y-6">
          {/* Acciones Rápidas */}
          <TeacherQuickActions
            actions={quickActions}
            highlightedAction={highlightedAction}
          />

          {/* Atención Prioritaria */}
          <TeacherPrioritySection
            items={priorityItems}
            onViewAll={() => setSection("classroom")}
          />

          {/* Bloque Contextual de EduCore AI */}
          <TeacherAiCallout
            onOpenAi={() => setSection("ai")}
            insightText={aiSuggestion?.text}
          />
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;

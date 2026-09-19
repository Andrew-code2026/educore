import React, { useMemo } from "react";
import {
  BarChart3,
  ClipboardList,
  ClipboardCheck,
  BookOpen,
  Calendar,
  Sparkles,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Section, EduRole } from "@/components/shell/shell.types";
import { StudentHero } from "./StudentHero";
import { StudentMetrics } from "./StudentMetrics";
import { StudentAgenda } from "./StudentAgenda";
import { StudentPendingWork } from "./StudentPendingWork";
import { StudentSubjects } from "./StudentSubjects";
import { StudentPerformance } from "./StudentPerformance";
import { StudentPrioritySection } from "./StudentPrioritySection";
import { StudentQuickActions } from "./StudentQuickActions";
import { StudentAiCallout } from "./StudentAiCallout";
import type {
  StudentDashboardProps,
  StudentMetricItem,
  StudentPendingAssignment,
  StudentSubjectSummary,
  StudentAgendaItem,
  StudentAlertItem,
  StudentQuickActionItem,
  MenPerformanceLevel,
} from "./types";

const getMenLevel = (val: number): MenPerformanceLevel => {
  if (val >= 4.6) return "Superior";
  if (val >= 4.0) return "Alto";
  if (val >= 3.0) return "Básico";
  return "Bajo";
};

export function StudentDashboard({
  data,
  user,
  role = "student",
  setSection,
  selectedStudentId,
  onSelectStudent,
}: StudentDashboardProps) {
  // Guardian mode support: fetch guardian linked students
  const guardianStudentsQuery = trpc.identity.relationships.useQuery(
    { role },
    { enabled: role === "guardian" }
  );
  const guardianStudents = guardianStudentsQuery.data ?? [];

  // Active student resolution
  const currentStudent = useMemo(() => {
    if (role === "guardian") {
      if (selectedStudentId) {
        const found = guardianStudents.find((s: any) => s.id === selectedStudentId);
        if (found) return found;
      }
      if (guardianStudents.length > 0) return guardianStudents[0];
    }
    // Student role resolution: match user or first student
    if (user?.name) {
      const match = data.students?.find(
        (s: any) => s.name?.toLowerCase() === user.name.toLowerCase()
      );
      if (match) return match;
    }
    return data.students?.[0] ?? { name: "Sofía Martínez", course: "11-2" };
  }, [role, selectedStudentId, guardianStudents, user, data.students]);

  const studentName = currentStudent?.name ?? "Sofía Martínez";
  const courseName = currentStudent?.course ?? "11-2";
  const schoolName = data.school?.name ?? "Gimnasio Moderno del Valle";

  // Academic period active
  const activePeriod = useMemo(() => {
    const active = data.academicPeriods?.find((p: any) => p.status === "Activo");
    return active?.name ?? "Periodo 2";
  }, [data.academicPeriods]);

  const availablePeriods = useMemo(() => {
    if (data.academicPeriods && data.academicPeriods.length > 0) {
      return data.academicPeriods.map((p: any) => p.name);
    }
    return ["Periodo 1", "Periodo 2"];
  }, [data.academicPeriods]);

  // Real grades filtered for this student
  const studentGrades = useMemo(() => {
    const allGrades = data.grades ?? [];
    const directMatch = allGrades.filter(
      (g: any) => g.studentName?.toLowerCase() === studentName.toLowerCase()
    );
    return directMatch.length > 0 ? directMatch : allGrades;
  }, [data.grades, studentName]);

  // General GPA calculation
  const averageGrade = useMemo(() => {
    if (!studentGrades.length) return 0;
    const sum = studentGrades.reduce((acc: number, g: any) => acc + (Number(g.value) || 0), 0);
    return Math.round((sum / studentGrades.length) * 10) / 10;
  }, [studentGrades]);

  const overallMenLevel = getMenLevel(averageGrade);

  // Real pending assignments calculation
  const pendingAssignments = useMemo<StudentPendingAssignment[]>(() => {
    const allAssignments = data.assignments ?? [];
    const allSubmissions = data.submissions ?? [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const pending: StudentPendingAssignment[] = [];

    for (const a of allAssignments) {
      // Look for submission by student
      const sub = allSubmissions.find(
        (s: any) =>
          s.assignmentId === a.id &&
          (s.studentName?.toLowerCase() === studentName.toLowerCase() ||
            s.studentId === currentStudent?.id)
      );

      // If already submitted and graded, or marked delivered, skip
      if (sub && sub.status === "Entregada" && sub.grade !== null) {
        continue;
      }

      const due = a.dueAt ? new Date(a.dueAt) : new Date();
      const dueStr = due.toISOString().slice(0, 10);
      const diffMs = due.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let urgency: "overdue" | "today" | "soon" | "later" = "later";
      let urgencyLabel = "Próxima";

      if (diffMs < 0 && dueStr !== todayStr) {
        urgency = "overdue";
        urgencyLabel = "Vencida";
      } else if (dueStr === todayStr) {
        urgency = "today";
        urgencyLabel = "Vence hoy";
      } else if (diffDays <= 3) {
        urgency = "soon";
        urgencyLabel = `En ${diffDays} días`;
      } else {
        urgency = "later";
        urgencyLabel = "Próxima";
      }

      const formattedDue = new Intl.DateTimeFormat("es-CO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(due);

      pending.push({
        id: a.id,
        title: a.title,
        subject: a.subject,
        course: a.course ?? courseName,
        dueAt: a.dueAt,
        formattedDue,
        urgency,
        urgencyLabel,
        points: a.points,
        description: a.description,
        teacherName: a.teacherName,
        hasSubmission: Boolean(sub),
        submissionStatus: sub?.status,
        grade: sub?.grade,
        onAction: () => setSection("classroom"),
      });
    }

    // Sort order: overdue -> today -> soon -> later
    const orderScore = { overdue: 0, today: 1, soon: 2, later: 3 };
    return pending.sort((a, b) => orderScore[a.urgency] - orderScore[b.urgency]);
  }, [data.assignments, data.submissions, studentName, currentStudent, courseName, setSection]);

  // Attendance calculation
  const attendanceMetrics = useMemo(() => {
    const allAttendance = data.attendance ?? [];
    const studentRecords = allAttendance.filter(
      (att: any) =>
        att.studentName?.toLowerCase() === studentName.toLowerCase() ||
        att.studentId === currentStudent?.id
    );

    if (!studentRecords.length) {
      return { percent: 96, absences: 0, detail: "Excelente asistencia" };
    }

    const present = studentRecords.filter(
      (att: any) =>
        att.status?.toLowerCase().includes("pres") ||
        att.status?.toLowerCase().includes("asist")
    ).length;

    const absences = studentRecords.length - present;
    const percent = Math.round((present / studentRecords.length) * 100);

    return {
      percent,
      absences,
      detail: absences > 0 ? `${absences} novedad(es) este mes` : "100% de asistencia",
    };
  }, [data.attendance, studentName, currentStudent]);

  // Subjects summary
  const subjectSummaries = useMemo<StudentSubjectSummary[]>(() => {
    const subjectsMap = new Map<
      string,
      {
        grades: number[];
        teacherName?: string;
      }
    >();

    for (const g of studentGrades) {
      if (!g.subject) continue;
      if (!subjectsMap.has(g.subject)) {
        subjectsMap.set(g.subject, { grades: [] });
      }
      subjectsMap.get(g.subject)!.grades.push(Number(g.value) || 0);
    }

    // Also collect subjects from assignments
    for (const a of data.assignments ?? []) {
      if (!a.subject) continue;
      if (!subjectsMap.has(a.subject)) {
        subjectsMap.set(a.subject, { grades: [], teacherName: a.teacherName });
      } else if (a.teacherName && !subjectsMap.get(a.subject)!.teacherName) {
        subjectsMap.get(a.subject)!.teacherName = a.teacherName;
      }
    }

    const tones: Array<"blue" | "violet" | "rose" | "amber" | "emerald"> = [
      "blue",
      "violet",
      "amber",
      "emerald",
      "rose",
    ];

    const result: StudentSubjectSummary[] = [];
    let idx = 0;

    subjectsMap.forEach((val, subjectName) => {
      const avg =
        val.grades.length > 0
          ? Math.round((val.grades.reduce((s, v) => s + v, 0) / val.grades.length) * 10) / 10
          : 0;
      const perfLevel = getMenLevel(avg);
      const subjectPending = pendingAssignments.filter((p) => p.subject === subjectName).length;

      result.push({
        name: subjectName,
        teacherName: val.teacherName,
        average: avg,
        performanceLevel: perfLevel,
        pendingCount: subjectPending,
        evaluatedCount: val.grades.length,
        totalAssessments: val.grades.length,
        tone: tones[idx % tones.length],
        onOpenDetails: () => setSection("grades"),
      });
      idx++;
    });

    return result;
  }, [studentGrades, data.assignments, pendingAssignments, setSection]);

  // Agenda items (events + assignments)
  const { todayAgenda, upcomingAgenda } = useMemo(() => {
    const todayItems: StudentAgendaItem[] = [];
    const upcomingItems: StudentAgendaItem[] = [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Institutional events
    for (const ev of data.events ?? []) {
      const evDate = ev.date ? new Date(ev.date) : null;
      const isToday = evDate ? evDate.toISOString().slice(0, 10) === todayStr : false;

      const item: StudentAgendaItem = {
        id: `event-${ev.id}`,
        type: "event",
        timeOrDate: ev.time ?? (evDate ? evDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "Hoy"),
        title: ev.title,
        subtitle: ev.description ?? "Evento institucional",
        isToday,
        tag: ev.type ?? "Colegio",
        tagTone: "info",
        onClick: () => setSection("calendar"),
      };

      if (isToday) todayItems.push(item);
      else upcomingItems.push(item);
    }

    // Pending assignments due dates
    for (const pa of pendingAssignments.slice(0, 4)) {
      const isToday = pa.urgency === "today";
      const item: StudentAgendaItem = {
        id: `assignment-${pa.id}`,
        type: "assignment_due",
        timeOrDate: pa.urgency === "today" ? "23:59" : pa.formattedDue.split(",")[0],
        title: pa.title,
        subtitle: `${pa.subject} · Entrega programada`,
        isToday,
        tag: pa.urgencyLabel,
        tagTone: pa.urgency === "overdue" ? "danger" : pa.urgency === "today" ? "warning" : "info",
        onClick: () => setSection("classroom"),
      };

      if (isToday) todayItems.push(item);
      else upcomingItems.push(item);
    }

    return { todayAgenda: todayItems, upcomingAgenda: upcomingItems };
  }, [data.events, pendingAssignments, setSection]);

  // Priorities and attention alerts
  const priorityAlerts = useMemo<StudentAlertItem[]>(() => {
    const alerts: StudentAlertItem[] = [];

    // Overdue or today tasks
    const urgentTasks = pendingAssignments.filter(
      (a) => a.urgency === "overdue" || a.urgency === "today"
    );
    if (urgentTasks.length > 0) {
      const first = urgentTasks[0];
      alerts.push({
        id: `alert-task-${first.id}`,
        severity: first.urgency === "overdue" ? "high" : "medium",
        title: `Entrega prioritaria: ${first.title}`,
        context: `${first.subject} · ${first.urgencyLabel}. Asegúrate de cargar tu evidencia a tiempo.`,
        actionLabel: "Entregar ahora",
        onAction: () => setSection("classroom"),
      });
    }

    // Subjects in need of reinforcement (< 3.5)
    const lowSubjects = subjectSummaries.filter((s) => s.average > 0 && s.average < 3.5);
    if (lowSubjects.length > 0) {
      const subj = lowSubjects[0];
      alerts.push({
        id: `alert-subject-${subj.name}`,
        severity: subj.average < 3.0 ? "high" : "medium",
        title: `Refuerzo sugerido en ${subj.name}`,
        context: `Promedio actual: ${subj.average.toFixed(1)} (Nivel ${subj.performanceLevel}). Consulta talleres de apoyo.`,
        actionLabel: "Ver notas",
        onAction: () => setSection("grades"),
      });
    }

    return alerts;
  }, [pendingAssignments, subjectSummaries, setSection]);

  // Quick actions items
  const quickActions = useMemo<StudentQuickActionItem[]>(
    () => [
      {
        id: "grades",
        label: "Calificaciones",
        icon: BarChart3,
        badge: averageGrade > 0 ? `${averageGrade.toFixed(1)}` : undefined,
        onClick: () => setSection("grades"),
      },
      {
        id: "classroom",
        label: "Tareas y actividades",
        icon: ClipboardList,
        badge: pendingAssignments.length > 0 ? `${pendingAssignments.length} pendientes` : "Al día",
        onClick: () => setSection("classroom"),
      },
      {
        id: "calendar",
        label: "Calendario escolar",
        icon: Calendar,
        onClick: () => setSection("calendar"),
      },
      {
        id: "academic",
        label: "Mis materias",
        icon: BookOpen,
        badge: `${subjectSummaries.length}`,
        onClick: () => setSection("academic"),
      },
      {
        id: "ai",
        label: "EduCore AI Tutor",
        icon: Sparkles,
        onClick: () => setSection("ai"),
      },
    ],
    [averageGrade, pendingAssignments.length, subjectSummaries.length, setSection]
  );

  // 4 Top Metrics Items
  const metricsItems = useMemo<StudentMetricItem[]>(
    () => [
      {
        id: "metric-average",
        label: "Promedio actual",
        value: averageGrade > 0 ? averageGrade.toFixed(1) : "—",
        detail: `Nivel ${overallMenLevel} · ${activePeriod}`,
        tone: averageGrade >= 4.0 ? "success" : averageGrade >= 3.0 ? "info" : "danger",
        icon: BarChart3,
        onClick: () => setSection("grades"),
      },
      {
        id: "metric-pending",
        label: "Actividades pendientes",
        value: pendingAssignments.length,
        detail:
          pendingAssignments.length > 0
            ? `${pendingAssignments[0].urgencyLabel}: ${pendingAssignments[0].title.slice(0, 18)}...`
            : "Todas tus entregas al día",
        tone: pendingAssignments.length > 0 ? "warning" : "success",
        icon: ClipboardList,
        onClick: () => setSection("classroom"),
      },
      {
        id: "metric-attendance",
        label: "Asistencia general",
        value: `${attendanceMetrics.percent}%`,
        detail: attendanceMetrics.detail,
        tone: attendanceMetrics.percent >= 90 ? "success" : "warning",
        icon: ClipboardCheck,
        onClick: () => setSection("attendance"),
      },
      {
        id: "metric-subjects",
        label: "Materias activas",
        value: subjectSummaries.length,
        detail: `${activePeriod} · 2026`,
        tone: "info",
        icon: BookOpen,
        onClick: () => setSection("academic"),
      },
    ],
    [
      averageGrade,
      overallMenLevel,
      activePeriod,
      pendingAssignments,
      attendanceMetrics,
      subjectSummaries.length,
      setSection,
    ]
  );

  return (
    <div
      data-testid="student-dashboard"
      className="student-dashboard space-y-4 sm:space-y-5 pb-8"
    >
      {/* Guardian Mode Banner & Selector */}
      {role === "guardian" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Acompañamiento Familiar
              </p>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Viendo a: <span className="text-blue-700">{studentName}</span>
              </h2>
            </div>
          </div>

          {guardianStudents.length > 1 && onSelectStudent && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <label htmlFor="guardian-student-select" className="text-xs font-semibold text-slate-500">
                Cambiar estudiante:
              </label>
              <select
                id="guardian-student-select"
                value={selectedStudentId ?? currentStudent?.id ?? ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val) onSelectStudent(val);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 shadow-2xs outline-none focus:border-blue-500"
              >
                {guardianStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.course ?? "Estudiante"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Hero Header */}
      <StudentHero
        studentName={studentName}
        schoolName={schoolName}
        courseName={courseName}
        activePeriodName={activePeriod}
        summaryText={
          pendingAssignments.length > 0
            ? `Tienes ${pendingAssignments.length} actividad${pendingAssignments.length === 1 ? "" : "es"} pendiente${pendingAssignments.length === 1 ? "" : "s"} y un promedio general de ${averageGrade.toFixed(1)} (${overallMenLevel}).`
            : `Tienes todas tus actividades al día y un promedio general de ${averageGrade.toFixed(1)} (${overallMenLevel}).`
        }
        pendingActivitiesCount={pendingAssignments.length}
        averageGrade={averageGrade}
        onOpenGrades={() => setSection("grades")}
        onOpenClassroom={() => setSection("classroom")}
        aiSuggestion={{
          text:
            pendingAssignments.length > 0
              ? `¿Quieres preparar tu entrega de "${pendingAssignments[0].title}" con IA?`
              : "¿Deseas un resumen de conceptos clave para tus materias?",
          onAction: () => setSection("ai"),
        }}
      />

      {/* 4 Essential KPIs */}
      <StudentMetrics metrics={metricsItems} />

      {/* Priority Section: What needs attention today? */}
      {priorityAlerts.length > 0 && (
        <StudentPrioritySection
          alerts={priorityAlerts}
          onOpenClassroom={() => setSection("classroom")}
          onOpenGrades={() => setSection("grades")}
        />
      )}

      {/* 2-Column Responsive Main Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        {/* Left Column (Main Focus: Lo que tienes pendiente + Mis materias) */}
        <div className="space-y-4 sm:space-y-5 lg:col-span-7">
          {/* Lo que tienes pendiente */}
          <StudentPendingWork
            assignments={pendingAssignments}
            onOpenClassroom={() => setSection("classroom")}
          />

          {/* Mis materias */}
          <StudentSubjects
            subjects={subjectSummaries}
            onOpenAcademic={() => setSection("academic")}
          />
        </div>

        {/* Right Column (Mi jornada + Mi rendimiento + AI Callout) */}
        <div className="space-y-4 sm:space-y-5 lg:col-span-5">
          {/* Mi jornada (Hoy / Próximamente) */}
          <StudentAgenda
            todayItems={todayAgenda}
            upcomingItems={upcomingAgenda}
            onOpenCalendar={() => setSection("calendar")}
          />

          {/* Mi rendimiento (Boletín en tiempo real) */}
          <StudentPerformance
            grades={studentGrades}
            availablePeriods={availablePeriods}
            activePeriod={activePeriod}
            onOpenReports={() => setSection("reports")}
          />

          {/* EduCore AI Callout */}
          <StudentAiCallout
            onOpenAi={() => setSection("ai")}
            suggestionText={
              pendingAssignments.length > 0
                ? `Tienes un taller pendiente en ${pendingAssignments[0].subject}. Pídele a EduCore AI que te explique los conceptos clave.`
                : undefined
            }
          />
        </div>
      </div>

      {/* 1-Click Quick Actions */}
      <StudentQuickActions actions={quickActions} />
    </div>
  );
}

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  BookOpen,
  History,
  Moon,
  PanelLeft,
  Sliders,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useShellContext } from "@/components/shell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AttendanceCourseSelect } from "@/attendance/AttendanceCourseSelect";
import { AttendancePanel } from "@/attendance/AttendancePanel";
import { adaptEduCoreDataToManus, getStudentSummaryFamilyProfile } from "@/attendance/adapter";
import { AttendanceModule as AttendanceLegacyModule } from "@/components/attendance/AttendanceModule";
import { StudentAttendancePortal } from "@/components/attendance/StudentAttendancePortal";
import { StudentFullRecordModal } from "@/components/attendance/StudentFullRecordModal";
import { JustificationModal } from "@/components/attendance/JustificationModal";
import {
  DEFAULT_ATTENDANCE_DAYS,
  type AttendanceCourse,
  type AttendanceFollowUpCaseItem,
  type AttendanceFollowUpNoteItem,
  type AttendanceJustificationItem,
  type AttendanceStatus,
  type AttendanceStudent,
  type StudentRecordTab,
} from "@/components/attendance/types";
import type { Course, SessionStatuses, Student } from "@/attendance/types";

export interface AttendancePageProps {
  data: any;
  role: "admin" | "teacher" | "student" | "guardian";
  user?: any;
  selectedStudentId?: number;
  onSelectStudent?: (studentId: number) => void;
  onNavigate?: (section: any) => void;
}

type AccentId = "aurora" | "emerald" | "indigo";

const ACCENTS: Array<{ id: AccentId; label: string; swatch: string }> = [
  { id: "aurora", label: "Aurora", swatch: "linear-gradient(140deg, oklch(0.72 0.13 205), oklch(0.55 0.14 235))" },
  { id: "emerald", label: "Esmeralda", swatch: "linear-gradient(140deg, oklch(0.72 0.14 168), oklch(0.5 0.12 172))" },
  { id: "indigo", label: "Índigo", swatch: "linear-gradient(140deg, oklch(0.62 0.16 285), oklch(0.45 0.17 280))" },
];

export function AttendancePage({
  data,
  role,
  user,
  selectedStudentId,
  onSelectStudent,
  onNavigate,
}: AttendancePageProps) {
  // 1. Roles estudiante o acudiente: portal dedicado de asistencia y justificaciones
  if (role === "student" || role === "guardian") {
    return (
      <StudentAttendancePortal
        data={data}
        role={role}
        user={user}
        selectedStudentId={selectedStudentId}
        onSelectStudent={onSelectStudent}
        onNavigate={onNavigate}
      />
    );
  }

  // 2. Mecanismo de reversibilidad instantánea hacia la versión previa de Asistencia
  const [useLegacy, setUseLegacy] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("educore_attendance_version") === "legacy";
    } catch {
      return false;
    }
  });

  const toggleLegacy = React.useCallback((legacy: boolean) => {
    setUseLegacy(legacy);
    try {
      localStorage.setItem("educore_attendance_version", legacy ? "legacy" : "next");
    } catch {}
  }, []);

  // Si el usuario eligió la versión legacy, renderizar el módulo previo con un acceso flotante para volver a Next
  if (useLegacy) {
    return (
      <div className="relative">
        <AttendanceLegacyModule
          data={data}
          role={role}
          user={user}
          selectedStudentId={selectedStudentId}
          onSelectStudent={onSelectStudent}
          onNavigate={onNavigate}
        />
        {/* Botón flotante para regresar a la experiencia Next */}
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => toggleLegacy(false)}
            className="flex items-center gap-2 rounded-full border border-sky-300 bg-sky-600/95 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-sky-500"
            title="Volver a la nueva experiencia de Asistencia Next (Manus)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Volver a Asistencia Next</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <AttendanceNextContainer
      data={data}
      role={role}
      user={user}
      onNavigate={onNavigate}
      onSwitchToLegacy={() => toggleLegacy(true)}
    />
  );
}

interface AttendanceNextContainerProps {
  data: any;
  role: "admin" | "teacher" | "student" | "guardian";
  user?: any;
  onNavigate?: (section: any) => void;
  onSwitchToLegacy: () => void;
}

function AttendanceNextContainer({
  data,
  role,
  user,
  onNavigate,
  onSwitchToLegacy,
}: AttendanceNextContainerProps) {
  const { theme, toggleTheme } = useTheme();
  const { sidebarCollapsed, setSidebarCollapsed, isFocusMode, setIsFocusMode } = useShellContext();

  const [accent, setAccentState] = React.useState<AccentId>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("edu-accent") : null;
    return (stored as AccentId) ?? "aurora";
  });

  React.useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    try {
      localStorage.setItem("edu-accent", accent);
    } catch {}
  }, [accent]);

  const [viewMode, setViewMode] = React.useState<"course-select" | "panel">("course-select");
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("11-2");
  const [selectedDate, setSelectedDate] = React.useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Estado para el Expediente 360° Integral
  const [isRecordModalOpen, setIsRecordModalOpen] = React.useState(false);
  const [recordStudent, setRecordStudent] = React.useState<AttendanceStudent | null>(null);
  const [recordTab, setRecordTab] = React.useState<StudentRecordTab>("summary");
  const [activeCaseId, setActiveCaseId] = React.useState<number | null>(null);

  // Estado para el modal administrativo de justificaciones
  const [isJustificationModalOpen, setIsJustificationModalOpen] = React.useState(false);

  // Consultas de datos reales desde tRPC
  const utils = trpc.useUtils();

  const attendanceQuery = trpc.attendance.list.useQuery(
    { courseId: selectedCourseId },
    { staleTime: 30_000, retry: 1 }
  );

  const justificationsQuery = trpc.justification.list.useQuery(
    { courseId: selectedCourseId },
    { enabled: Boolean(selectedCourseId), staleTime: 30_000, retry: 1 }
  );

  const followUpQuery = trpc.followUp.list.useQuery(
    { courseId: selectedCourseId },
    { staleTime: 30_000, retry: 1 }
  );

  const activeCaseHistoryQuery = trpc.followUp.history.useQuery(
    { caseId: activeCaseId ?? 0 },
    { enabled: Boolean(activeCaseId) }
  );

  // Mutaciones para operaciones del Expediente y Justificaciones
  const openFollowUpMutation = trpc.followUp.open.useMutation({
    onSuccess: async (created) => {
      await utils.followUp.list.invalidate({ courseId: selectedCourseId });
      if (created?.id) setActiveCaseId(created.id);
      toast.success("Caso de seguimiento abierto y asignado al docente.");
    },
    onError: (err) => {
      toast.error(`Error al abrir caso: ${err.message}`);
    },
  });

  const updateFollowUpMutation = trpc.followUp.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.followUp.list.invalidate({ courseId: selectedCourseId }),
        activeCaseId ? utils.followUp.history.invalidate({ caseId: activeCaseId }) : Promise.resolve(),
      ]);
      toast.success("Estado del caso de seguimiento actualizado.");
    },
    onError: (err) => {
      toast.error(`Error al actualizar estado: ${err.message}`);
    },
  });

  const addNoteMutation = trpc.followUp.addNote.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.followUp.list.invalidate({ courseId: selectedCourseId }),
        activeCaseId ? utils.followUp.history.invalidate({ caseId: activeCaseId }) : Promise.resolve(),
      ]);
      toast.success("Nota registrada en el historial del caso.");
    },
    onError: (err) => {
      toast.error(`Error al agregar nota: ${err.message}`);
    },
  });

  const submitJustificationMutation = trpc.justification.submit.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
      toast.success("Justificación radicada exitosamente.");
    },
    onError: (err) => {
      toast.error(`Error al radicar justificación: ${err.message}`);
    },
  });

  const recordPhysicalReceiptMutation = trpc.justification.recordPhysicalReceipt.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
      toast.success("Recepción de soporte físico registrada exitosamente");
    },
    onError: (err) => {
      toast.error(`Error al registrar soporte: ${err.message}`);
    },
  });

  const escalateJustificationMutation = trpc.justification.escalate.useMutation({
    onSuccess: async () => {
      await utils.justification.list.invalidate();
      toast.success("Trámite derivado a coordinación académica");
    },
    onError: (err) => {
      toast.error(`Error al escalar: ${err.message}`);
    },
  });

  const resolveJustificationMutation = trpc.justification.resolve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(`Error al resolver: ${err.message}`);
    },
  });

  const saveAttendanceMutation = trpc.attendance.save.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.list.invalidate(),
        utils.educore.snapshot.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(`Error al guardar asistencia: ${err.message}`);
    },
  });

  const handlePersist = React.useCallback(
    async ({
      courseId,
      date,
      statuses,
    }: {
      courseId: string;
      date: string;
      statuses: SessionStatuses;
    }) => {
      const recordsToSave: Array<{
        courseId: string;
        studentId: string;
        attendanceDate: Date;
        status: "present" | "absent" | "late" | "excused";
      }> = [];

      for (const [studentId, status] of Object.entries(statuses)) {
        if (!status || status === "pending") continue;
        const normalizedStatus = status === "excuse" ? "excused" : status;
        recordsToSave.push({
          courseId,
          studentId,
          attendanceDate: new Date(`${date}T00:00:00.000Z`),
          status: normalizedStatus as "present" | "absent" | "late" | "excused",
        });
      }

      if (recordsToSave.length > 0) {
        await saveAttendanceMutation.mutateAsync({
          records: recordsToSave,
          role: "teacher",
        });
      }
    },
    [saveAttendanceMutation]
  );

  // Adaptación de datos de EduCore a modelos de Manus
  const { courses, todayStatuses, eduStudentMap, eduCourseMap, recordsByStudentDate } = React.useMemo(() => {
    return adaptEduCoreDataToManus({
      snapshotData: data,
      realAttendanceRecords: attendanceQuery.data,
      justifications: justificationsQuery.data,
      followUpCases: followUpQuery.data,
    });
  }, [data, attendanceQuery.data, justificationsQuery.data, followUpQuery.data]);

  // Selección de curso por defecto si el actual no existe
  React.useEffect(() => {
    if (courses.length > 0 && !courses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Conteo de justificaciones pendientes
  const pendingJustificationsCount = React.useMemo(() => {
    const list = justificationsQuery.data ?? [];
    return list.filter((j: any) =>
      ["submitted", "pending_physical_support", "in_review", "absence_registered"].includes(j.status)
    ).length;
  }, [justificationsQuery.data]);

  // Lista de justificaciones tipadas para el Expediente y Modal
  const justificationsList = React.useMemo<AttendanceJustificationItem[]>(() => {
    return (justificationsQuery.data ?? []).map((j: any) => ({
      id: j.id,
      schoolId: j.schoolId,
      courseId: j.courseId,
      studentId: String(j.studentId),
      attendanceDate: new Date(j.attendanceDate).toISOString().slice(0, 10),
      reasonCategory: j.reasonCategory,
      description: j.description,
      submittedByRole: j.submittedByRole,
      submittedByName: j.submittedByName,
      submittedByUserId: j.submittedByUserId,
      submittedAt: j.submittedAt,
      digitalEvidenceUrl: j.digitalEvidenceUrl,
      digitalEvidenceName: j.digitalEvidenceName,
      requiresPhysicalSupport: Boolean(j.requiresPhysicalSupport),
      physicalSupportDeadline: j.physicalSupportDeadline,
      physicalSupportReceivedAt: j.physicalSupportReceivedAt,
      physicalSupportReceivedByName: j.physicalSupportReceivedByName,
      physicalSupportReceivedByUserId: j.physicalSupportReceivedByUserId,
      physicalSupportNotes: j.physicalSupportNotes,
      status: j.status,
      escalatedToCoordination: Boolean(j.escalatedToCoordination),
      coordinationNotes: j.coordinationNotes,
      resolutionNotes: j.resolutionNotes,
      resolvedAt: j.resolvedAt,
      resolvedByName: j.resolvedByName,
      resolvedByUserId: j.resolvedByUserId,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      events: j.events ?? [],
      currentAttendanceStatus: j.currentAttendanceStatus,
      studentName: j.student?.name,
      studentCode: j.student?.studentCode,
    }));
  }, [justificationsQuery.data]);

  // Lista de casos de seguimiento tipados
  const followUpCasesList = React.useMemo<AttendanceFollowUpCaseItem[]>(() => {
    return (followUpQuery.data ?? []).map((c: any) => ({
      id: c.id,
      courseId: c.courseId,
      studentId: String(c.studentId),
      reason: c.reason,
      priority: c.priority,
      status: c.status,
      responsibleUserId: c.responsibleUserId,
      responsibleName: c.responsibleName,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      resolvedAt: c.resolvedAt,
    }));
  }, [followUpQuery.data]);

  // Notas de historial del caso activo
  const activeCaseNotesList = React.useMemo<AttendanceFollowUpNoteItem[]>(() => {
    const rawNotes = (activeCaseHistoryQuery.data as any)?.notes ?? (Array.isArray(activeCaseHistoryQuery.data) ? activeCaseHistoryQuery.data : []);
    return rawNotes.map((n: any) => ({
      id: n.id,
      caseId: n.caseId,
      note: n.note,
      authorUserId: n.authorUserId,
      authorName: n.authorName,
      createdAt: n.createdAt,
    }));
  }, [activeCaseHistoryQuery.data]);

  // Curso seleccionado en formato EduAttendanceCourse
  const currentEduCourse = React.useMemo<AttendanceCourse>(() => {
    const course = eduCourseMap.get(selectedCourseId);
    if (course) return course;
    const first = eduCourseMap.values().next().value;
    if (first) return first;
    return {
      id: selectedCourseId,
      label: selectedCourseId,
      subject: "Biología",
      room: "Aula General",
      time: "07:00 – 08:30",
      color: "from-blue-600 to-indigo-600",
      students: [],
      teacherName: user?.name || "Juan Diego Loaiza",
    };
  }, [eduCourseMap, selectedCourseId, user?.name]);

  // Handlers para abrir el Expediente 360° desde el panel de asistencia
  const handleOpenExpediente = React.useCallback(
    (student: Student) => {
      const eduSt = eduStudentMap.get(student.id);
      if (eduSt) {
        setRecordStudent(eduSt);
        setRecordTab("summary");
        setIsRecordModalOpen(true);
      }
    },
    [eduStudentMap]
  );

  const handleOpenHistory = React.useCallback(
    (student: Student) => {
      const eduSt = eduStudentMap.get(student.id);
      if (eduSt) {
        setRecordStudent(eduSt);
        setRecordTab("history");
        setIsRecordModalOpen(true);
      }
    },
    [eduStudentMap]
  );

  const handleOpenFollowUp = React.useCallback(
    (student: Student) => {
      const eduSt = eduStudentMap.get(student.id);
      if (eduSt) {
        setRecordStudent(eduSt);
        setRecordTab("follow_up");
        setIsRecordModalOpen(true);
      }
    },
    [eduStudentMap]
  );

  // Navegación secuencial entre estudiantes dentro del Expediente 360°
  const currentStudentList = currentEduCourse.students;
  const currentStudentIndex = recordStudent
    ? currentStudentList.findIndex((s) => s.id === recordStudent.id)
    : -1;

  const handleNextStudent = React.useCallback(() => {
    if (currentStudentIndex >= 0 && currentStudentIndex < currentStudentList.length - 1) {
      setRecordStudent(currentStudentList[currentStudentIndex + 1]);
    }
  }, [currentStudentIndex, currentStudentList]);

  const handlePrevStudent = React.useCallback(() => {
    if (currentStudentIndex > 0) {
      setRecordStudent(currentStudentList[currentStudentIndex - 1]);
    }
  }, [currentStudentIndex, currentStudentList]);

  // Consulta de estado de celda para el Expediente 360°
  const getRecordCellStatus = React.useCallback(
    (studentId: string, date: string): AttendanceStatus => {
      const studentDateKey = `${studentId}:${date}`;
      if (recordsByStudentDate.has(studentDateKey)) {
        const raw = recordsByStudentDate.get(studentDateKey)!;
        if (raw === "excuse") return "excused";
        return raw as AttendanceStatus;
      }
      if (date === selectedDate && todayStatuses[studentId]) {
        const raw = todayStatuses[studentId];
        if (raw === "excuse") return "excused";
        return raw as AttendanceStatus;
      }
      return "pending";
    },
    [recordsByStudentDate, selectedDate, todayStatuses]
  );

  const handleModalSetStatus = React.useCallback(
    async (studentId: string, date: string, status: AttendanceStatus) => {
      if (!status || status === "pending") return;
      const normalizedStatus = (status as string) === "excuse" ? "excused" : status;
      try {
        await saveAttendanceMutation.mutateAsync({
          records: [
            {
              courseId: selectedCourseId,
              studentId,
              attendanceDate: new Date(`${date}T00:00:00.000Z`),
              status: normalizedStatus as "present" | "absent" | "late" | "excused",
            },
          ],
          role: "teacher",
        });
        toast.success("Asistencia registrada.");
      } catch (err: any) {
        toast.error(`Error al registrar asistencia: ${err.message}`);
      }
    },
    [saveAttendanceMutation, selectedCourseId]
  );

  // Handlers para resolución y trámites de justificaciones
  const handleRecordPhysicalReceipt = React.useCallback(
    (id: number, receptor: string, notes?: string) => {
      recordPhysicalReceiptMutation.mutate({
        justificationId: id,
        receivedByName: receptor,
        notes,
      });
    },
    [recordPhysicalReceiptMutation]
  );

  const handleEscalateJustification = React.useCallback(
    (id: number, notes: string) => {
      escalateJustificationMutation.mutate({
        justificationId: id,
        coordinationNotes: notes,
      });
    },
    [escalateJustificationMutation]
  );

  const handleResolveJustification = React.useCallback(
    (id: number, status: "approved" | "unjustified" | "rejected", notes: string) => {
      resolveJustificationMutation.mutate(
        {
          justificationId: id,
          status,
          resolutionNotes: notes,
        },
        {
          onSuccess: () => {
            if (status === "approved") {
              toast.success("Justificación aprobada: Asistencia actualizada a 'Excusa'");
            } else if (status === "rejected") {
              toast.info("Excusa rechazada formalmente");
            } else {
              toast.info("Excusa declarada no justificada");
            }
          },
        }
      );
    },
    [resolveJustificationMutation]
  );

  const handleSubmitJustification = React.useCallback(
    (data: any) => {
      submitJustificationMutation.mutate(data);
    },
    [submitJustificationMutation]
  );

  return (
    <div className="attendance-workspace font-sans relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Aurora ambiental de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-[18%] h-[520px] w-[520px] rounded-full bg-brand/10 blur-[130px]" />
        <div className="absolute -bottom-56 right-[-6%] h-[460px] w-[460px] rounded-full bg-st-excuse/10 blur-[140px]" />
      </div>



      {/* 2. Área principal de contenido */}
      {viewMode === "course-select" ? (
        <main id="educore-attendance-content" className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden w-full">
          <div className="page-transition mx-auto w-full max-w-[1440px] px-4 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-5 lg:px-8 flex-1 flex flex-col">
            <AttendanceCourseSelect
              courses={courses}
              statuses={todayStatuses}
              pendingExcusesCount={pendingJustificationsCount}
              onSelectCourse={(courseId, date) => {
                setSelectedCourseId(courseId);
                setSelectedDate(date);
                setViewMode("panel");
              }}
              onReviewExcuses={(courseId) => {
                setSelectedCourseId(courseId);
                setIsJustificationModalOpen(true);
              }}
            />
          </div>
        </main>
      ) : (
        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden w-full px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          <AttendancePanel
            courses={courses}
            initialCourseId={selectedCourseId}
            initialDate={selectedDate}
            initialStatuses={todayStatuses}
            onBackToCourses={() => setViewMode("course-select")}
            onOpenExpediente={handleOpenExpediente}
            onOpenHistory={handleOpenHistory}
            onOpenFollowUp={handleOpenFollowUp}
            getStudentSummaryProfile={(student) => getStudentSummaryFamilyProfile(student, eduStudentMap)}
            onPersist={handlePersist}
            onFocusModeChange={setIsFocusMode}
          />
        </main>
      )}

      {/* 3. Expediente Integral 360° (Modal con 5 pestañas, ficha técnica, visor de adjuntos e impresión dossier) */}
      {recordStudent && isRecordModalOpen && (
        <StudentFullRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => {
            setIsRecordModalOpen(false);
            setRecordStudent(null);
          }}
          student={recordStudent}
          course={currentEduCourse}
          days={DEFAULT_ATTENDANCE_DAYS}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          getStatus={getRecordCellStatus}
          onSetStatus={handleModalSetStatus}
          onNextStudent={handleNextStudent}
          onPrevStudent={handlePrevStudent}
          currentIndex={currentStudentIndex >= 0 ? currentStudentIndex : 0}
          totalStudents={currentStudentList.length}
          initialTab={recordTab}
          followUpCases={followUpCasesList}
          onOpenCase={(st, reason, priority) => {
            openFollowUpMutation.mutate({
              courseId: selectedCourseId,
              studentId: st.id,
              reason,
              priority,
            });
          }}
          onUpdateCaseStatus={(caseId, status) => {
            updateFollowUpMutation.mutate({ caseId, status });
          }}
          onAddCaseNote={(caseId, note) => {
            addNoteMutation.mutate({ caseId, note });
          }}
          caseHistoryNotes={activeCaseNotesList}
          isOpeningCase={openFollowUpMutation.isPending}
          isUpdatingCase={updateFollowUpMutation.isPending}
          isAddingNote={addNoteMutation.isPending}
          justifications={justificationsList}
          onRecordPhysicalReceipt={handleRecordPhysicalReceipt}
          onEscalateJustification={handleEscalateJustification}
          onResolveJustification={handleResolveJustification}
          onNavigateToGradeCenter={(cId) => onNavigate?.("grades")}
          schoolLogoUrl={data?.school?.logoUrl}
          schoolName={data?.school?.name}
        />
      )}

      {/* 4. Modal Administrativo de Excusas y Justificaciones */}
      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => setIsJustificationModalOpen(false)}
        courseLabel={currentEduCourse.label}
        students={currentEduCourse.students}
        justifications={justificationsList}
        getStatus={getRecordCellStatus}
        onRecordPhysicalReceipt={handleRecordPhysicalReceipt}
        onEscalateToCoordination={handleEscalateJustification}
        onResolveJustification={handleResolveJustification}
        onSubmitJustification={handleSubmitJustification}
      />

      {/* 5. Botón flotante para alternar a la versión anterior (Contingencia sin riesgo) */}
      {!isFocusMode && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={onSwitchToLegacy}
            className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-md backdrop-blur-md transition-all hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-900"
            title="Cambiar a la versión anterior de Asistencia"
          >
            <History className="h-3.5 w-3.5 text-slate-400" />
            <span>Versión anterior</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default AttendancePage;

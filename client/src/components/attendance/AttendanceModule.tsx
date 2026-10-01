import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ACTIONABLE_STATUSES,
  AttendanceCourse,
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  DEFAULT_ATTENDANCE_DAYS,
  normalizeDateIso,
} from "./types";
import { AttendanceCourseSelect } from "./AttendanceCourseSelect";
import { AttendanceGradebook } from "./AttendanceGradebook";
import { StudentAttendancePortal } from "./StudentAttendancePortal";
import { JustificationModal } from "./JustificationModal";

interface AttendanceModuleProps {
  data: any;
  role: string;
  user?: any;
  selectedStudentId?: number;
  onSelectStudent?: (studentId: number) => void;
  onNavigate?: (section: any) => void;
  initialCourseId?: string;
  initialViewMode?: "course-select" | "gradebook" | "quick";
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  data,
  role,
  user,
  selectedStudentId,
  onSelectStudent,
  onNavigate,
  initialCourseId = "11-2",
  initialViewMode = "course-select",
}) => {
  // If role is student or guardian, render the dedicated Student & Family Attendance Portal
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

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [viewMode, setViewMode] = useState<"course-select" | "gradebook">(
    initialViewMode === "quick" ? "gradebook" : initialViewMode
  );
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(
    DEFAULT_ATTENDANCE_DAYS.length - 1
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    DEFAULT_ATTENDANCE_DAYS[DEFAULT_ATTENDANCE_DAYS.length - 1].iso
  );
  const [activeCaseId, setActiveCaseId] = useState<number | null>(null);
  const [isDirectJustificationsModalOpen, setIsDirectJustificationsModalOpen] = useState(false);

  // Transform snapshot courses and students into AttendanceCourse[]
  const courses = useMemo<AttendanceCourse[]>(() => {
    const rawCourses = data?.courses ?? [];
    const rawStudents = data?.students ?? [];

    // Pre-calculate absences and rates from raw data if available
    const getStudentStats = (studentId: number, studentName: string) => {
      const studentAttendance = (data?.attendance ?? []).filter(
        (a: any) => a.studentName === studentName
      );
      const absentCount = studentAttendance.filter(
        (a: any) => a.status === "Ausente" || a.status === "absent"
      ).length;
      const total = studentAttendance.length || 1;
      const rate = Math.round(((total - absentCount) / total) * 100);
      return { absentCount, rate: Math.max(70, Math.min(100, rate || 94)) };
    };

    // Course definition templates
    const courseTemplates: Record<
      string,
      { subject: string; room: string; time: string; color: string }
    > = {
      "11-2": {
        subject: "Biología",
        room: "Laboratorio de Ciencias",
        time: "07:00 – 08:30",
        color: "from-blue-600 to-indigo-600",
      },
      "11-1": {
        subject: "Biología",
        room: "Laboratorio de Biología",
        time: "10:00 – 11:30",
        color: "from-emerald-600 to-teal-600",
      },
      "10-1": {
        subject: "Biología",
        room: "Laboratorio de Ciencias 204",
        time: "12:00 – 13:00",
        color: "from-cyan-600 to-blue-600",
      },
    };

    const courseNames = ["11-2", "11-1", "10-1"];
    // Also include any other course from rawCourses
    rawCourses.forEach((c: any) => {
      if (c.name && !courseNames.includes(c.name)) {
        courseNames.push(c.name);
      }
    });

    return courseNames.map((name, index) => {
      const template =
        courseTemplates[name] ?? {
          subject: "Biología",
          room: `Aula ${100 + index}`,
          time: "08:00 – 09:30",
          color: "from-slate-600 to-indigo-600",
        };

      // Filter students belonging to this course
      let matched = rawStudents.filter((s: any) => s.course === name);

      // If no students matched (e.g. demo environment with only 11-2), distribute or fallback
      if (!matched.length) {
        if (name === "11-1") matched = rawStudents.slice(0, 18);
        else if (name === "10-1") matched = rawStudents.slice(8, 24);
        else matched = rawStudents;
      }

      const students: AttendanceStudent[] = matched.map((s: any, sIdx: number) => {
        const stats = getStudentStats(s.id, s.name);
        return {
          id: String(s.id),
          numericId: s.id,
          name: s.name,
          code: s.studentCode || `EST-${name}-${String(sIdx + 1).padStart(2, "0")}`,
          course: name,
          gradeLevel: s.gradeLevel || "11°",
          academicStatus: s.status || "Activo",
          avatar: s.avatarUrl || undefined,
          avatarColor: s.avatarColor || (sIdx % 2 === 0 ? "#dbeafe" : "#fef3c7"),
          email: s.email,
          guardianName: s.guardianName,
          guardianPhone: s.guardianPhone || s.phone || "+57 301 555 0101",
          guardianEmail: s.guardianEmail,
          attendanceRate: stats.rate,
          absencesCount: stats.absentCount,
        };
      });

      return {
        id: name,
        label: name,
        subject: template.subject,
        room: template.room,
        time: template.time,
        color: template.color,
        students,
        teacherName: user?.name || "Juan Diego Loaiza",
      };
    });
  }, [data, user?.name]);

  // Persistent tRPC queries
  const attendanceQuery = trpc.attendance.list.useQuery(
    { courseId: selectedCourseId },
    { staleTime: 30_000 }
  );

  const followUpQuery = trpc.followUp.list.useQuery(
    { courseId: selectedCourseId },
    { staleTime: 30_000 }
  );

  const activeCaseHistoryQuery = trpc.followUp.history.useQuery(
    { caseId: activeCaseId ?? 0 },
    { enabled: Boolean(activeCaseId) }
  );

  // Local cell statuses: key = `${studentId}:${date}`
  const keyFor = (studentId: string, date: string) => `${studentId}:${date}`;

  const [cellStatuses, setCellStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    courses.forEach((c) => {
      c.students.forEach((s, sIdx) => {
        DEFAULT_ATTENDANCE_DAYS.forEach((d, dIdx) => {
          const isLatest = dIdx === DEFAULT_ATTENDANCE_DAYS.length - 1;
          const status: AttendanceStatus =
            isLatest && sIdx < 3
              ? "pending"
              : s.absencesCount >= 5 && dIdx % 3 === 0
              ? "absent"
              : sIdx % 11 === dIdx
              ? "late"
              : "present";
          initial[keyFor(s.id, d.iso)] = status;
        });
      });
    });
    return initial;
  });

  // Sync cell statuses when DB records are loaded
  useEffect(() => {
    if (!attendanceQuery.data?.length) return;
    setCellStatuses((prev) => {
      const next = { ...prev };
      attendanceQuery.data.forEach((rec) => {
        const iso = new Date(rec.attendanceDate).toISOString().slice(0, 10);
        next[keyFor(rec.studentId, iso)] = rec.status as AttendanceStatus;
      });
      return next;
    });
  }, [attendanceQuery.data]);

  // Mutations
  const utils = trpc.useUtils();

  const saveAttendanceMutation = trpc.attendance.save.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.list.invalidate(),
        utils.justification.list.invalidate(),
      ]);
      toast.success("Asistencia guardada correctamente en el servidor.");
    },
    onError: (err) => {
      toast.error(`No se pudo guardar la asistencia: ${err.message}`);
    },
  });

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

  // Justificaciones: estado local + integración tRPC
  const [localJustifications, setLocalJustifications] = useState<AttendanceJustificationItem[]>([]);

  const justificationsQuery = trpc.justification.list.useQuery(
    { courseId: selectedCourseId },
    { enabled: !!selectedCourseId }
  );

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
    },
  });

  const escalateJustificationMutation = trpc.justification.escalate.useMutation({
    onSuccess: async () => {
      await utils.justification.list.invalidate();
    },
  });

  const resolveJustificationMutation = trpc.justification.resolve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
  });

  const handleSubmitJustification = (input: {
    studentId: string;
    attendanceDate: string;
    reasonCategory: "medical" | "family_emergency" | "external_appointment" | "institutional" | "force_majeure" | "other";
    description: string;
    submittedByRole: "student" | "guardian" | "teacher";
    submittedByName: string;
    digitalEvidenceUrl?: string | null;
    digitalEvidenceName?: string | null;
    requiresPhysicalSupport?: boolean;
    physicalSupportDeadline?: string | null;
  }) => {
    const tempId = Date.now();
    const initialStatus = input.requiresPhysicalSupport ? "pending_physical_support" : "submitted";
    const newItem: AttendanceJustificationItem = {
      id: tempId,
      courseId: selectedCourseId,
      studentId: input.studentId,
      attendanceDate: input.attendanceDate,
      reasonCategory: input.reasonCategory,
      description: input.description,
      submittedByRole: input.submittedByRole,
      submittedByName: input.submittedByName,
      submittedAt: new Date().toISOString(),
      digitalEvidenceUrl: input.digitalEvidenceUrl ?? null,
      digitalEvidenceName: input.digitalEvidenceName ?? null,
      requiresPhysicalSupport: Boolean(input.requiresPhysicalSupport),
      physicalSupportDeadline: input.physicalSupportDeadline ?? null,
      status: initialStatus,
      escalatedToCoordination: false,
      createdAt: new Date().toISOString(),
      events: [
        {
          id: Date.now() + 1,
          justificationId: tempId,
          eventType: "submitted",
          actorRole: input.submittedByRole,
          actorName: input.submittedByName,
          notes: "Justificación radicada en el sistema.",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setLocalJustifications((prev) => [newItem, ...prev]);

    submitJustificationMutation.mutate({
      courseId: selectedCourseId,
      studentId: input.studentId,
      attendanceDate: new Date(`${input.attendanceDate}T00:00:00.000Z`),
      reasonCategory: input.reasonCategory,
      description: input.description,
      submittedByRole: input.submittedByRole,
      submittedByName: input.submittedByName,
      digitalEvidenceUrl: input.digitalEvidenceUrl,
      digitalEvidenceName: input.digitalEvidenceName,
      requiresPhysicalSupport: input.requiresPhysicalSupport,
      physicalSupportDeadline: input.physicalSupportDeadline ? new Date(`${input.physicalSupportDeadline}T00:00:00.000Z`) : null,
    });
  };

  const justificationsList: AttendanceJustificationItem[] = useMemo(() => {
    const fromServer = (justificationsQuery.data ?? []).map((j: any) => ({
      id: j.id,
      schoolId: j.schoolId,
      courseId: j.courseId,
      studentId: j.studentId,
      attendanceDate:
        typeof j.attendanceDate === "string"
          ? j.attendanceDate.split("T")[0]
          : new Date(j.attendanceDate).toISOString().split("T")[0],
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
    }));

    const serverIds = new Set(fromServer.map((x: any) => x.id));
    const pendingLocal = localJustifications.filter((j) => j.courseId === selectedCourseId && !serverIds.has(j.id));
    return [...pendingLocal, ...fromServer];
  }, [justificationsQuery.data, localJustifications, selectedCourseId]);

  const handleRecordPhysicalReceipt = (justificationId: number, receivedByName: string, notes?: string) => {
    setLocalJustifications((prev) =>
      prev.map((j) => {
        if (j.id !== justificationId) return j;
        const newStatus = j.status === "pending_physical_support" ? "in_review" : j.status;
        const newEvent = {
          id: Date.now(),
          justificationId,
          eventType: "physical_received",
          actorRole: "teacher",
          actorName: receivedByName,
          notes: notes || "Soporte físico recibido en el colegio.",
          createdAt: new Date().toISOString(),
        };
        return {
          ...j,
          status: newStatus,
          physicalSupportReceivedAt: new Date().toISOString(),
          physicalSupportReceivedByName: receivedByName,
          physicalSupportNotes: notes,
          events: [newEvent, ...(j.events || [])],
        };
      })
    );
    recordPhysicalReceiptMutation.mutate({ justificationId, receivedByName, notes });
  };

  const handleEscalateJustification = (justificationId: number, coordinationNotes: string) => {
    setLocalJustifications((prev) =>
      prev.map((j) => {
        if (j.id !== justificationId) return j;
        const newStatus = ["submitted", "pending_physical_support"].includes(j.status) ? "in_review" : j.status;
        const newEvent = {
          id: Date.now(),
          justificationId,
          eventType: "escalated",
          actorRole: "teacher",
          actorName: user?.name || "Juan Diego Loaiza",
          notes: coordinationNotes,
          createdAt: new Date().toISOString(),
        };
        return {
          ...j,
          status: newStatus,
          escalatedToCoordination: true,
          coordinationNotes,
          events: [newEvent, ...(j.events || [])],
        };
      })
    );
    escalateJustificationMutation.mutate({ justificationId, coordinationNotes });
  };

  const handleResolveJustification = (
    justificationId: number,
    status: "approved" | "unjustified" | "rejected",
    resolutionNotes: string
  ) => {
    setLocalJustifications((prev) =>
      prev.map((j) => {
        if (j.id !== justificationId) return j;
        const newEvent = {
          id: Date.now(),
          justificationId,
          eventType: status,
          actorRole: "teacher",
          actorName: user?.name || "Juan Diego Loaiza",
          notes: resolutionNotes,
          createdAt: new Date().toISOString(),
        };
        return {
          ...j,
          status,
          resolutionNotes,
          resolvedAt: new Date().toISOString(),
          resolvedByName: user?.name || "Juan Diego Loaiza",
          events: [newEvent, ...(j.events || [])],
        };
      })
    );

    // Sincronización inmediata de asistencia en memoria cuando la excusa es aprobada
    if (status === "approved") {
      const targetJust = justificationsList.find((j) => j.id === justificationId);
      if (targetJust) {
        const dateIso = normalizeDateIso(targetJust.attendanceDate);
        setCellStatuses((prev) => ({
          ...prev,
          [keyFor(targetJust.studentId, dateIso)]: "excused",
        }));
      }
    }

    resolveJustificationMutation.mutate({ justificationId, status, resolutionNotes });
  };

  // Status accessors & mutators
  const getStatus = (studentId: string, date: string): AttendanceStatus => {
    return cellStatuses[keyFor(studentId, date)] ?? "pending";
  };

  const setStatus = (studentId: string, date: string, status: AttendanceStatus) => {
    setCellStatuses((prev) => ({ ...prev, [keyFor(studentId, date)]: status }));
    if (status !== "pending") {
      saveAttendanceMutation.mutate({
        records: [
          {
            courseId: selectedCourseId,
            studentId,
            attendanceDate: new Date(`${date}T00:00:00.000Z`),
            status,
            reason: status === "excused" ? "Excusa registrada desde el panel de asistencia" : null,
          },
        ],
      });
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? courses[0];
  const currentDate = DEFAULT_ATTENDANCE_DAYS[selectedDateIndex] ?? DEFAULT_ATTENDANCE_DAYS[DEFAULT_ATTENDANCE_DAYS.length - 1];

  const markAll = (status: AttendanceStatus) => {
    const targetDate = currentDate.iso;
    setCellStatuses((prev) => {
      const next = { ...prev };
      selectedCourse.students.forEach((s) => {
        next[keyFor(s.id, targetDate)] = status;
      });
      return next;
    });

    if (status !== "pending") {
      saveAttendanceMutation.mutate({
        records: selectedCourse.students.map((s) => ({
          courseId: selectedCourseId,
          studentId: s.id,
          attendanceDate: new Date(`${targetDate}T00:00:00.000Z`),
          status: status as Exclude<AttendanceStatus, "pending">,
          reason: status === "excused" ? "Excusa registrada en lote" : null,
        })),
      });
      toast.success(
        `${selectedCourse.label}: todos marcados como ${status === "present" ? "presentes" : status} el ${currentDate.label}.`
      );
    }
  };

  const completePending = () => {
    const targetDate = currentDate.iso;
    const pendingStudents = selectedCourse.students.filter(
      (s) => getStatus(s.id, targetDate) === "pending"
    );

    if (!pendingStudents.length) {
      toast.info("No hay estudiantes pendientes en esta fecha.");
      return;
    }

    setCellStatuses((prev) => {
      const next = { ...prev };
      pendingStudents.forEach((s) => {
        next[keyFor(s.id, targetDate)] = "present";
      });
      return next;
    });

    saveAttendanceMutation.mutate({
      records: pendingStudents.map((s) => ({
        courseId: selectedCourseId,
        studentId: s.id,
        attendanceDate: new Date(`${targetDate}T00:00:00.000Z`),
        status: "present" as const,
        reason: null,
      })),
    });
    toast.success(`${pendingStudents.length} pendientes completados como presentes.`);
  };

  const handleSaveSession = () => {
    saveAttendanceMutation.mutate({
      records: selectedCourse.students.map((student) => {
        const status = getStatus(student.id, selectedDate);
        return {
          courseId: selectedCourse.id,
          studentId: student.id,
          attendanceDate: new Date(`${selectedDate}T00:00:00.000Z`),
          status: status === "pending" ? "present" : status,
          reason: status === "excused" ? "Excusa registrada desde el registro docente" : null,
        };
      }),
    });
  };

  const handleNavigateToGradeCenter = (courseId: string, _studentId: string) => {
    if (onNavigate) {
      onNavigate("grades");
      toast.info(`Navegando a Grade Center para el curso ${courseId}`);
    }
  };

  // Follow-up cases mapping
  const followUpCasesList: AttendanceFollowUpCaseItem[] = useMemo(() => {
    return (followUpQuery.data ?? []).map((item) => ({
      id: item.id,
      courseId: item.courseId,
      studentId: item.studentId,
      reason: item.reason,
      priority: item.priority as "low" | "medium" | "high",
      status: item.status as "open" | "in_review" | "resolved",
      responsibleUserId: item.responsibleUserId,
      responsibleName: item.responsibleName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      resolvedAt: item.resolvedAt,
    }));
  }, [followUpQuery.data]);

  const activeCaseNotesList: AttendanceFollowUpNoteItem[] = useMemo(() => {
    return (activeCaseHistoryQuery.data?.notes ?? []).map((n) => ({
      id: n.id,
      caseId: n.caseId,
      note: n.note,
      authorUserId: n.authorUserId,
      authorName: n.authorName,
      createdAt: n.createdAt,
    }));
  }, [activeCaseHistoryQuery.data]);

  const pendingJustificationsCount = useMemo(() => {
    return justificationsList.filter((j) =>
      ["submitted", "pending_physical_support", "in_review", "absence_registered"].includes(j.status)
    ).length;
  }, [justificationsList]);

  // View: Course Select
  if (viewMode === "course-select") {
    return (
      <>
        <AttendanceCourseSelect
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={(id) => {
            setSelectedCourseId(id);
            setViewMode("gradebook");
          }}
          onQuickRegister={(id) => {
            setSelectedCourseId(id);
            setViewMode("gradebook");
          }}
          periodName={data?.school?.academicYear ? `Periodo 2 · ${data.school.academicYear}` : "Periodo 2 · 2026"}
          onOpenJustifications={() => setIsDirectJustificationsModalOpen(true)}
          pendingJustificationsCount={pendingJustificationsCount}
        />
        <JustificationModal
          isOpen={isDirectJustificationsModalOpen}
          onClose={() => setIsDirectJustificationsModalOpen(false)}
          courseLabel={courses.find((c) => c.id === selectedCourseId)?.label || selectedCourseId}
          students={courses.find((c) => c.id === selectedCourseId)?.students || courses[0]?.students || []}
          justifications={justificationsList}
          onRecordPhysicalReceipt={handleRecordPhysicalReceipt}
          onEscalateToCoordination={handleEscalateJustification}
          onResolveJustification={handleResolveJustification}
          onSubmitJustification={handleSubmitJustification}
          getStatus={getStatus}
        />
      </>
    );
  }

  // View: Unified Attendance Sheet (Planilla de asistencia del docente)
  return (
    <AttendanceGradebook
      courses={courses}
      selectedCourseId={selectedCourseId}
      onSelectCourseId={setSelectedCourseId}
      days={DEFAULT_ATTENDANCE_DAYS}
      selectedDateIndex={selectedDateIndex}
      onSelectDateIndex={(idx) => {
        setSelectedDateIndex(idx);
        setSelectedDate(DEFAULT_ATTENDANCE_DAYS[idx].iso);
      }}
      getStatus={getStatus}
      onSetStatus={setStatus}
      onMarkAll={markAll}
      onCompletePending={completePending}
      onBackToCourses={() => setViewMode("course-select")}
      onNavigateToGradeCenter={handleNavigateToGradeCenter}
      followUpCases={followUpCasesList}
      onOpenCase={(student, reason, priority) => {
        openFollowUpMutation.mutate({
          courseId: selectedCourseId,
          studentId: student.id,
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
      activeCaseHistoryNotes={activeCaseNotesList}
      isOpeningCase={openFollowUpMutation.isPending}
      isUpdatingCase={updateFollowUpMutation.isPending}
      isAddingNote={addNoteMutation.isPending}
      onSelectActiveCaseId={(caseId) => setActiveCaseId(caseId)}
      isSaving={saveAttendanceMutation.isPending}
      justifications={justificationsList}
      onRecordPhysicalReceipt={handleRecordPhysicalReceipt}
      onEscalateJustification={handleEscalateJustification}
      onResolveJustification={handleResolveJustification}
      onSubmitJustification={handleSubmitJustification}
      schoolLogoUrl={data?.school?.logoUrl}
      schoolName={data?.school?.name}
    />
  );
};

export default AttendanceModule;

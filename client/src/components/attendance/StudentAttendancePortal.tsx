import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Hourglass,
  Inbox,
  Paperclip,
  Plus,
  ShieldCheck,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  AttendanceJustificationItem,
  AttendanceJustificationReasonCategory,
  AttendanceStatus,
  AttendanceStudent,
  DEFAULT_ATTENDANCE_DAYS,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  STATUS_META,
  normalizeDateIso,
} from "./types";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

interface StudentAttendancePortalProps {
  data: any;
  role: "student" | "guardian";
  user: any;
  selectedStudentId?: number;
  onSelectStudent?: (studentId: number) => void;
  onNavigate?: (section: any) => void;
}

interface AbsenceRecordItem {
  date: string; // ISO: YYYY-MM-DD
  courseId: string;
  courseLabel: string;
  subject: string;
  teacherName: string;
  status: AttendanceStatus;
  existingJustification?: AttendanceJustificationItem;
}

export const StudentAttendancePortal: React.FC<StudentAttendancePortalProps> = ({
  data,
  role,
  user,
  selectedStudentId,
  onSelectStudent,
  onNavigate,
}) => {
  const utils = trpc.useUtils();

  // 1. Resolve Guardian Linked Students (if role === 'guardian')
  const guardianRelationshipsQuery = trpc.identity.relationships.useQuery(
    { role },
    { enabled: role === "guardian" }
  );
  const guardianLinkedStudents = guardianRelationshipsQuery.data ?? [];

  // Available real students list for guardian
  const availableStudents: AttendanceStudent[] = useMemo(() => {
    const rawStudents = data?.students ?? [];
    if (role === "guardian" && guardianLinkedStudents.length > 0) {
      return guardianLinkedStudents.map((rel: any, idx: number) => {
        const matchedRaw = rawStudents.find((s: any) =>
          s.name?.toLowerCase() === rel.name?.toLowerCase() ||
          s.email?.toLowerCase() === rel.email?.toLowerCase()
        );
        const resolvedId = matchedRaw ? String(matchedRaw.id) : String(rel.id);
        const resolvedNumericId = matchedRaw ? matchedRaw.id : rel.id;
        return {
          id: resolvedId,
          numericId: resolvedNumericId,
          name: rel.name,
          code: rel.studentCode || (matchedRaw ? matchedRaw.studentCode : undefined) || `EST-REL-${String(idx + 1).padStart(2, "0")}`,
          course: rel.courseName || rel.course || matchedRaw?.course || "11-2",
          guardianName: user?.name || "Acudiente",
          attendanceRate: 94,
          absencesCount: 1,
        };
      });
    }

    // Default student list from snapshot
    return rawStudents.map((s: any, idx: number) => ({
      id: String(s.id),
      numericId: s.id,
      name: s.name,
      code: s.studentCode || `EST-${s.course || "11-2"}-${String(idx + 1).padStart(2, "0")}`,
      course: s.course || "11-2",
      guardianName: s.guardianName,
      attendanceRate: 95,
      absencesCount: 1,
    }));
  }, [data?.students, role, guardianLinkedStudents, user?.name]);

  // Active student resolution
  const activeStudent: AttendanceStudent = useMemo(() => {
    if (role === "guardian" && selectedStudentId) {
      const found = availableStudents.find(
        (s) => s.numericId === selectedStudentId || s.id === String(selectedStudentId)
      );
      if (found) return found;
    }

    if (role === "student" && user?.name) {
      const match = availableStudents.find(
        (s) => s.name?.toLowerCase() === user.name.toLowerCase()
      );
      if (match) return match;
    }

    return (
      availableStudents[0] ?? {
        id: "1",
        numericId: 1,
        name: "Sofía Martínez",
        code: "EST-11-2-01",
        course: "11-2",
        guardianName: "María Martínez",
        attendanceRate: 96,
        absencesCount: 1,
      }
    );
  }, [availableStudents, role, selectedStudentId, user?.name]);

  const activeCourseId = activeStudent.course || "11-2";

  // 2. Fetch Real Attendance Records & Real Justifications from DB
  const attendanceQuery = trpc.attendance.list.useQuery(
    { studentId: activeStudent.id, role },
    { staleTime: 15_000 }
  );

  const justificationsQuery = trpc.justification.list.useQuery(
    { studentId: activeStudent.id, role },
    { staleTime: 15_000 }
  );

  // Submit Justification Mutation
  const submitJustificationMutation = trpc.justification.submit.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
      toast.success("Justificación radicada con éxito ante la institución.");
    },
    onError: (err) => {
      toast.error(`No se pudo radicar la justificación: ${err.message}`);
    },
  });

  // Upload Document Mutation for local storage
  const uploadDocumentMutation = trpc.justification.uploadDocument.useMutation();

  // Schedule Absence Mutation
  const scheduleAbsenceMutation = trpc.justification.schedule.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.justification.list.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
      toast.success("Inasistencia programada con éxito ante la institución.");
    },
    onError: (err) => {
      toast.error(`No se pudo programar la inasistencia: ${err.message}`);
    },
  });

  // Map server justifications list
  const justificationsList: AttendanceJustificationItem[] = useMemo(() => {
    return (justificationsQuery.data ?? []).map((j: any) => ({
      id: j.id,
      schoolId: j.schoolId,
      courseId: j.courseId,
      studentId: j.studentId,
      attendanceDate: normalizeDateIso(j.attendanceDate),
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
  }, [justificationsQuery.data]);

  // Justifications by date map
  const justificationByDate = useMemo(() => {
    const map = new Map<string, AttendanceJustificationItem>();
    justificationsList.forEach((j) => {
      map.set(j.attendanceDate, j);
    });
    return map;
  }, [justificationsList]);

  // Attendance records map for this student (Single persistent Source of Truth)
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();

    // Overlay with persistent DB records
    (attendanceQuery.data ?? []).forEach((rec: any) => {
      const iso = normalizeDateIso(rec.attendanceDate);
      map.set(iso, rec.status as AttendanceStatus);
    });

    return map;
  }, [attendanceQuery.data]);

  // Summary Metrics calculation
  const summaryMetrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    (attendanceQuery.data ?? []).forEach((rec: any) => {
      const st = rec.status as AttendanceStatus;
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "late") late++;
      else if (st === "excused") excused++;
    });

    const totalDays = present + absent + late + excused || DEFAULT_ATTENDANCE_DAYS.length;
    const rate =
      present + excused + absent + late > 0
        ? Math.round(((present + excused) / (present + excused + absent + late)) * 100)
        : 100;
    const inReviewCount = justificationsList.filter((j) =>
      ["scheduled_absence", "submitted", "pending_physical_support", "in_review"].includes(j.status)
    ).length;

    return {
      rate,
      present,
      absent,
      late,
      excused,
      inReviewCount,
      totalDays,
    };
  }, [attendanceQuery.data, justificationsList]);

  // List of absences (derived directly from persistent DB attendance records + scheduled absences)
  const absenceRecords: AbsenceRecordItem[] = useMemo(() => {
    const mapByDate = new Map<string, AbsenceRecordItem>();

    // 1. Process all real DB attendance records
    (attendanceQuery.data ?? []).forEach((rec: any) => {
      const iso = normalizeDateIso(rec.attendanceDate);
      if (rec.status === "absent" || rec.status === "excused") {
        mapByDate.set(iso, {
          date: iso,
          courseId: rec.courseId || activeCourseId,
          courseLabel: rec.courseId || activeCourseId,
          subject: rec.courseId === "11-2" ? "Biología" : "Ciencias Naturales",
          teacherName: rec.recordedByName || "Juan Diego Loaiza",
          status: rec.status as AttendanceStatus,
          existingJustification: justificationByDate.get(iso),
        });
      }
    });

    // 2. Also ensure any justified or scheduled absences in justificationsList are represented
    justificationsList.forEach((j) => {
      if (!mapByDate.has(j.attendanceDate)) {
        mapByDate.set(j.attendanceDate, {
          date: j.attendanceDate,
          courseId: j.courseId || activeCourseId,
          courseLabel: j.courseId || activeCourseId,
          subject: "Biología",
          teacherName: "Juan Diego Loaiza",
          status: j.status === "approved" ? "excused" : "absent",
          existingJustification: j,
        });
      }
    });

    // Sort descending (most recent date first)
    return Array.from(mapByDate.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [attendanceQuery.data, justificationsList, activeCourseId, justificationByDate]);

  // Absences that do NOT yet have any justification filed (Point 11 action banner)
  const unjustifiedAbsences = useMemo(() => {
    return absenceRecords.filter(
      (a) => !a.existingJustification || a.existingJustification.status === "absence_registered"
    );
  }, [absenceRecords]);

  // Modal states
  const [activeTab, setActiveTab] = useState<"absences" | "justifications">("absences");

  // Radication Flow Modal
  const [justifyingAbsence, setJustifyingAbsence] = useState<AbsenceRecordItem | null>(null);
  const [formStep, setFormStep] = useState<"form" | "summary" | "success">("form");
  const [reasonCategory, setReasonCategory] =
    useState<AttendanceJustificationReasonCategory>("medical");
  const [otherReasonText, setOtherReasonText] = useState("");
  const [description, setDescription] = useState("");
  const [digitalFileName, setDigitalFileName] = useState<string | null>(null);
  const [digitalFileSize, setDigitalFileSize] = useState<string | null>(null);
  const [digitalFileBase64, setDigitalFileBase64] = useState<string | null>(null);
  const [acceptedPhysicalCommitment, setAcceptedPhysicalCommitment] = useState(false);
  const [createdRadicadoId, setCreatedRadicadoId] = useState<number | null>(null);

  // Detail Modal (Family Dossier Consultation)
  const [inspectingJustification, setInspectingJustification] =
    useState<AttendanceJustificationItem | null>(null);

  // Schedule Absence Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [scheduleReason, setScheduleReason] =
    useState<AttendanceJustificationReasonCategory>("medical");
  const [scheduleOtherReason, setScheduleOtherReason] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [scheduleDigitalFileName, setScheduleDigitalFileName] = useState<string | null>(null);
  const [scheduleDigitalFileSize, setScheduleDigitalFileSize] = useState<string | null>(null);
  const [scheduleDigitalFileBase64, setScheduleDigitalFileBase64] = useState<string | null>(null);
  const [schedulePhysicalCommitment, setSchedulePhysicalCommitment] = useState(false);

  // Interactive Document Previewer
  const [previewDoc, setPreviewDoc] = useState<{ url?: string | null; name?: string | null } | null>(
    null
  );

  // Scroll refs for modals
  const radicationModalRef = useRef<HTMLDivElement>(null);
  const detailModalRef = useRef<HTMLDivElement>(null);
  const scheduleModalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(justifyingAbsence || inspectingJustification || showScheduleModal);
    if (!isAnyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [justifyingAbsence, inspectingJustification, showScheduleModal]);

  useEffect(() => {
    if (justifyingAbsence) {
      radicationModalRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [justifyingAbsence, formStep]);

  useEffect(() => {
    if (inspectingJustification) {
      detailModalRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [inspectingJustification]);

  useEffect(() => {
    if (showScheduleModal) {
      scheduleModalRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [showScheduleModal]);

  // Schedule modal file handling
  const handleScheduleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".csv",
      ".txt",
      ".rtf",
      ".ppt",
      ".pptx",
      ".odt",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".svg",
      ".gif",
      ".bmp",
    ];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error(
        "Formato no admitido. Puedes adjuntar archivos PDF, Word (.docx), Excel (.xlsx), texto (.txt) o imágenes (JPG, PNG)."
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("El archivo supera el tamaño máximo permitido de 25 MB.");
      return;
    }

    const sizeKb = (file.size / 1024).toFixed(0);
    setScheduleDigitalFileName(file.name);
    setScheduleDigitalFileSize(`${sizeKb} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      setScheduleDigitalFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast.success(`Constancia adjunta: ${file.name} (${sizeKb} KB)`);
  };

  const handleCloseScheduleModal = () => {
    const hasUnsaved =
      scheduleDescription.trim().length > 0 ||
      scheduleDigitalFileName !== null ||
      scheduleOtherReason.trim().length > 0;
    if (hasUnsaved) {
      const confirmed = window.confirm(
        "¿Deseas descartar los datos que has ingresado para la inasistencia programada?"
      );
      if (!confirmed) return;
    }
    setShowScheduleModal(false);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleDescription.trim()) {
      toast.error("Por favor ingresa la descripción del motivo de la ausencia programada.");
      return;
    }

    const finalDescription =
      scheduleReason === "other" && scheduleOtherReason.trim()
        ? `[${scheduleOtherReason.trim()}] ${scheduleDescription.trim()}`
        : scheduleDescription.trim();

    const submitterName =
      role === "guardian"
        ? user?.name || activeStudent.guardianName || "Acudiente Titular"
        : activeStudent.name;

    const targetDateObj = new Date(`${scheduleDate}T12:00:00.000Z`);

    let finalEvidenceUrl: string | null = null;
    if (scheduleDigitalFileName && scheduleDigitalFileBase64) {
      try {
        const uploadRes = await uploadDocumentMutation.mutateAsync({
          fileName: scheduleDigitalFileName,
          fileBase64: scheduleDigitalFileBase64,
        });
        finalEvidenceUrl = uploadRes.url;
      } catch (uploadErr: any) {
        console.error("Upload error:", uploadErr);
        toast.error("No se pudo subir el archivo adjunto: " + (uploadErr?.message || "Error al subir"));
        return;
      }
    } else if (scheduleDigitalFileName) {
      finalEvidenceUrl = `/uploads/documents/${encodeURIComponent(scheduleDigitalFileName)}`;
    }

    try {
      await scheduleAbsenceMutation.mutateAsync({
        courseId: activeCourseId,
        studentId: activeStudent.id,
        attendanceDate: targetDateObj,
        reasonCategory: scheduleReason,
        description: finalDescription,
        submittedByRole: role === "guardian" ? "guardian" : "student",
        submittedByName: submitterName,
        digitalEvidenceName: scheduleDigitalFileName,
        digitalEvidenceUrl: finalEvidenceUrl,
        requiresPhysicalSupport: schedulePhysicalCommitment,
      });

      setShowScheduleModal(false);
      setScheduleDescription("");
      setScheduleOtherReason("");
      setScheduleDigitalFileName(null);
      setScheduleDigitalFileSize(null);
      setScheduleDigitalFileBase64(null);
      setSchedulePhysicalCommitment(false);
      setActiveTab("justifications");
    } catch {
      // Handled by mutation onError
    }
  };

  const formatDate = (isoOrDate: string | Date | undefined | null) => {
    if (!isoOrDate) return "—";
    try {
      return new Intl.DateTimeFormat("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(isoOrDate));
    } catch {
      return String(isoOrDate);
    }
  };

  const formatShortDate = (isoOrDate: string | Date | undefined | null) => {
    if (!isoOrDate) return "—";
    try {
      return new Intl.DateTimeFormat("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(isoOrDate));
    } catch {
      return String(isoOrDate);
    }
  };

  // Safe close radication modal with draft discard confirmation (Point 8)
  const handleCloseRadicationModal = () => {
    if (formStep === "success") {
      setJustifyingAbsence(null);
      return;
    }
    const hasUnsavedDraft =
      description.trim().length > 0 ||
      digitalFileName !== null ||
      otherReasonText.trim().length > 0;
    if (hasUnsavedDraft) {
      const confirmed = window.confirm(
        "¿Deseas descartar los datos que has ingresado en el formulario de justificación?"
      );
      if (!confirmed) return;
    }
    setJustifyingAbsence(null);
  };

  // Open radication modal for an absence
  const handleOpenJustify = (absence: AbsenceRecordItem) => {
    if (absence.existingJustification) {
      // If already has justification, open inspection modal instead of creating duplicate
      setInspectingJustification(absence.existingJustification);
      return;
    }
    setJustifyingAbsence(absence);
    setFormStep("form");
    setReasonCategory("medical");
    setOtherReasonText("");
    setDescription("");
    setDigitalFileName(null);
    setDigitalFileSize(null);
    setDigitalFileBase64(null);
    setAcceptedPhysicalCommitment(false);
  };

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".csv",
      ".txt",
      ".rtf",
      ".ppt",
      ".pptx",
      ".odt",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".svg",
      ".gif",
      ".bmp",
    ];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error(
        "Formato no admitido. Puedes adjuntar archivos PDF, Word (.docx), Excel (.xlsx), texto (.txt) o imágenes (JPG, PNG)."
      );
      return;
    }

    // Validate size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error("El archivo supera el tamaño máximo permitido de 25 MB.");
      return;
    }

    const sizeKb = (file.size / 1024).toFixed(0);
    setDigitalFileName(file.name);
    setDigitalFileSize(`${sizeKb} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      setDigitalFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast.success(`Constancia adjunta: ${file.name} (${sizeKb} KB)`);
  };

  // Submit action
  const handleConfirmSubmit = async () => {
    if (!justifyingAbsence) return;
    if (!acceptedPhysicalCommitment) {
      toast.error("Debes aceptar el compromiso de entrega de soporte físico para continuar.");
      return;
    }

    const finalDescription =
      reasonCategory === "other" && otherReasonText.trim()
        ? `[${otherReasonText.trim()}] ${description.trim()}`
        : description.trim();

    const submitterName =
      role === "guardian"
        ? user?.name || activeStudent.guardianName || "Acudiente Titular"
        : activeStudent.name;

    // Calculate deadline: 3 business days from absence date
    const absenceDateObj = new Date(`${justifyingAbsence.date}T12:00:00.000Z`);
    const deadlineObj = new Date(absenceDateObj);
    deadlineObj.setDate(deadlineObj.getDate() + 3);

    let finalEvidenceUrl: string | null = null;
    if (digitalFileName && digitalFileBase64) {
      try {
        const uploadRes = await uploadDocumentMutation.mutateAsync({
          fileName: digitalFileName,
          fileBase64: digitalFileBase64,
        });
        finalEvidenceUrl = uploadRes.url;
      } catch (uploadErr: any) {
        console.error("Upload error:", uploadErr);
        toast.error("No se pudo subir el archivo adjunto: " + (uploadErr?.message || "Error al subir"));
        return;
      }
    } else if (digitalFileName) {
      finalEvidenceUrl = `/uploads/documents/${encodeURIComponent(digitalFileName)}`;
    }

    try {
      const result = await submitJustificationMutation.mutateAsync({
        courseId: activeCourseId,
        studentId: activeStudent.id,
        attendanceDate: absenceDateObj,
        reasonCategory,
        description: finalDescription,
        submittedByRole: role === "guardian" ? "guardian" : "student",
        submittedByName: submitterName,
        digitalEvidenceName: digitalFileName,
        digitalEvidenceUrl: finalEvidenceUrl,
        requiresPhysicalSupport: true,
        physicalSupportDeadline: deadlineObj,
      });

      const newId = result?.justification?.id ?? Date.now();
      setCreatedRadicadoId(newId);
      setDigitalFileBase64(null);
      setFormStep("success");
    } catch {
      // Error handled by mutation onError
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* 1. HEADER DEL PORTAL */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {role === "guardian" ? "Portal del Acudiente" : "Portal del Estudiante"}
            </span>
            <span className="text-xs font-medium text-slate-500 font-mono">
              Año Lectivo 2026
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {role === "guardian"
              ? `Asistencia Escolar de ${activeStudent.name}`
              : "Mis Asistencias y Excusas"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consulta de registro de asistencia diaria, trazabilidad y radicación formal de justificaciones.
          </p>
        </div>

        {/* Actions & Multi-student selector for guardians */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {role === "guardian" && availableStudents.length > 1 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 pl-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                Estudiante:
              </span>
              <div className="flex items-center gap-1">
                {availableStudents.map((s) => {
                  const isSelected = s.id === activeStudent.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectStudent?.(s.numericId || Number(s.id))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                      }`}
                    >
                      {s.name} ({s.course})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowScheduleModal(true);
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setScheduleDate(tomorrow.toISOString().slice(0, 10));
              setScheduleReason("medical");
              setScheduleOtherReason("");
              setScheduleDescription("");
              setScheduleDigitalFileName(null);
              setScheduleDigitalFileSize(null);
              setSchedulePhysicalCommitment(false);
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 shadow-2xs transition-all cursor-pointer"
          >
            <CalendarClock className="w-4 h-4 text-purple-600" />
            <span>Programar inasistencia prevista</span>
          </button>
        </div>
      </div>

      {/* Top Banner de Acción Inmediata (Audit Point 11: Arriba por defecto sin scroll) */}
      {unjustifiedAbsences.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-amber-950">
                  {unjustifiedAbsences.length === 1
                    ? "Tienes 1 inasistencia pendiente por justificar"
                    : `Tienes ${unjustifiedAbsences.length} inasistencias pendientes por justificar`}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-200 text-amber-900">
                  Atención requerida
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-1">
                Falta del {formatDate(unjustifiedAbsences[0].date)}. Radica tu justificación con constancia digital o confirma el compromiso de entrega de soporte físico.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenJustify(unjustifiedAbsences[0])}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Radicar Excusa Ahora</span>
          </button>
        </div>
      )}

      {/* 2. RESUMEN REAL DEL ESTUDIANTE (STAT CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Asistencia general */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Asistencia
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-extrabold ${
                summaryMetrics.rate >= 90 ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {summaryMetrics.rate}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total del periodo</p>
        </div>

        {/* Presentes */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Presentes
          </span>
          <span className="text-2xl font-extrabold text-slate-800">
            {summaryMetrics.present}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Días asistidos</p>
        </div>

        {/* Ausencias */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Ausencias
          </span>
          <span
            className={`text-2xl font-extrabold ${
              summaryMetrics.absent > 0 ? "text-rose-600" : "text-slate-800"
            }`}
          >
            {summaryMetrics.absent}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Faltas registradas</p>
        </div>

        {/* Tardanzas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Tardanzas
          </span>
          <span
            className={`text-2xl font-extrabold ${
              summaryMetrics.late > 0 ? "text-amber-600" : "text-slate-800"
            }`}
          >
            {summaryMetrics.late}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Llegadas tarde</p>
        </div>

        {/* Excusas Justificadas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Justificadas
          </span>
          <span className="text-2xl font-extrabold text-emerald-600">
            {summaryMetrics.excused}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Excusas aprobadas</p>
        </div>

        {/* En trámite */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            En Revisión
          </span>
          <span className="text-2xl font-extrabold text-blue-600">
            {summaryMetrics.inReviewCount}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Trámites activos</p>
        </div>
      </div>

      {/* 3. TABS DE NAVEGACIÓN LOCAL */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("absences")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "absences"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>Inasistencias y Justificaciones</span>
            {absenceRecords.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                {absenceRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("justifications")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "justifications"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            <span>Mis Trámites Radicados</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
              {justificationsList.length}
            </span>
          </button>
        </div>
      </div>

      {/* 4. CONTENIDO SEGÚN TAB */}
      {activeTab === "absences" ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Inasistencias Registradas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Faltas asentadas por el docente. Puedes radicar una justificación formal con su soporte.
                </p>
              </div>
            </div>

            {absenceRecords.length === 0 ? (
              <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  No tienes inasistencias pendientes de justificar
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Tus registros de asistencia están al día. Todas las sesiones cuentan con presencia o están debidamente atendidas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {absenceRecords.map((item) => {
                  const hasJustification = Boolean(item.existingJustification);
                  const just = item.existingJustification;
                  const isResolved =
                    just && ["approved", "unjustified", "rejected"].includes(just.status);

                  return (
                    <div
                      key={item.date}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 capitalize">
                              {formatDate(item.date)}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              Ausente
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>{item.subject}</span>
                            <span>·</span>
                            <span>Curso {item.courseLabel}</span>
                            <span>·</span>
                            <span>Docente: {item.teacherName}</span>
                          </div>

                          {/* Justification state tag if already submitted */}
                          {hasJustification && just && (
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                  JUSTIFICATION_STATUS_META[just.status].badge
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    JUSTIFICATION_STATUS_META[just.status].dotColor
                                  }`}
                                />
                                Trámite: {JUSTIFICATION_STATUS_META[just.status].label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ({JUSTIFICATION_REASON_LABELS[just.reasonCategory]})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        {hasJustification ? (
                          <button
                            type="button"
                            onClick={() => setInspectingJustification(just!)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {isResolved ? "Ver resolución" : "Ver solicitud"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenJustify(item)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {role === "guardian"
                              ? `Justificar inasistencia de ${activeStudent.name.split(" ")[0]}`
                              : "Justificar inasistencia"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 5. HISTORIAL DE JUSTIFICACIONES RADICADAS */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Justificaciones
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento del estado de revisión de excusas radicadas ante el colegio.
              </p>
            </div>
          </div>

          {justificationsList.length === 0 ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Inbox className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                No tienes justificaciones radicadas
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Cuando radicas una excusa médica o calamidad familiar para una inasistencia, podrás consultar aquí su estado de revisión.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {justificationsList.map((j) => {
                const meta = JUSTIFICATION_STATUS_META[j.status];
                const StatusIcon = meta.icon;

                return (
                  <div
                    key={j.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <FileCheck2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-slate-900">
                            Radicado #JUST-{j.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                            <StatusIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-0.5">
                          <p>
                            Inasistencia: <strong>{formatDate(j.attendanceDate)}</strong> · Motivo:{" "}
                            <strong>{JUSTIFICATION_REASON_LABELS[j.reasonCategory]}</strong>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Radicado el {formatShortDate(j.submittedAt || j.createdAt)} por {j.submittedByName} ({j.submittedByRole === "guardian" ? "Acudiente" : "Estudiante"})
                          </p>
                        </div>

                        {/* Physical support state */}
                        {j.requiresPhysicalSupport && (
                          <div className="mt-1.5 text-[11px]">
                            {j.physicalSupportReceivedAt ? (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Soporte físico recibido por el colegio
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                                <Hourglass className="w-3 h-3" /> Soporte físico pendiente de entrega en secretaría
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectingJustification(j)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver expediente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL DE RADICACIÓN DE JUSTIFICACIÓN (PASO A PASO) */}
      {justifyingAbsence && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 pt-4 sm:pt-8 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {role === "guardian"
                      ? `Justificar la inasistencia de ${activeStudent.name}`
                      : "Justificar mi inasistencia"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Expediente oficial de justificación · Colegio Gimnasio Moderno del Valle
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRadicationModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inattendance Context Card */}
            <div className="px-6 py-3 bg-blue-50/60 border-b border-blue-100/80 text-xs shrink-0 grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Estudiante y Curso
                </span>
                <span className="font-semibold text-slate-900">
                  {activeStudent.name} ({activeStudent.code}) · {justifyingAbsence.courseLabel}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Fecha de inasistencia
                </span>
                <span className="font-semibold text-slate-900 capitalize">
                  {formatDate(justifyingAbsence.date)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Asignatura / Docente
                </span>
                <span>
                  {justifyingAbsence.subject} · {justifyingAbsence.teacherName}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Estado actual
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Ausente
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div ref={radicationModalRef} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-800">
              {formStep === "form" && (
                <>
                  {/* Motivo */}
                  <div>
                    <label className="font-bold text-slate-900 block mb-1.5">
                      1. Motivo de la inasistencia <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={reasonCategory}
                      onChange={(e) =>
                        setReasonCategory(
                          e.target.value as AttendanceJustificationReasonCategory
                        )
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                    >
                      <option value="medical">Enfermedad / Incapacidad médica</option>
                      <option value="external_appointment">
                        Cita médica o procedimiento de salud
                      </option>
                      <option value="family_emergency">
                        Calamidad doméstica o emergencia familiar
                      </option>
                      <option value="force_majeure">
                        Situación familiar o personal / Fuerza mayor
                      </option>
                      <option value="institutional">
                        Compromiso institucional / Deportivo / Cultural
                      </option>
                      <option value="other">Otra razón justificable</option>
                    </select>

                    {reasonCategory === "other" && (
                      <input
                        type="text"
                        value={otherReasonText}
                        onChange={(e) => setOtherReasonText(e.target.value)}
                        placeholder="Especifica brevemente el motivo..."
                        className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                      />
                    )}
                  </div>

                  {/* Explicación */}
                  <div>
                    <label className="font-bold text-slate-900 block mb-1">
                      2. Cuéntanos brevemente qué ocurrió <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Esta información será revisada por la institución y podrá formar parte del expediente de la justificación.
                    </p>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe los hechos que motivaron la inasistencia para que el docente y directivos conozcan la situación..."
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 leading-relaxed"
                    />
                  </div>

                  {/* Soporte Digital */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                    <label className="font-bold text-slate-900 block">
                      3. Soporte de la justificación
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Puedes adjuntar la constancia que respalda esta justificación (PDF, Word, Excel, texto o imagen hasta 25 MB). No es obligatorio si entregarás el documento en físico en secretaría.
                    </p>

                    {digitalFileName ? (
                      <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 truncate block">
                              {digitalFileName}
                            </span>
                            <span className="text-[10px] text-slate-400">{digitalFileSize}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDigitalFileName(null);
                            setDigitalFileSize(null);
                            setDigitalFileBase64(null);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs shadow-2xs transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          Adjuntar constancia
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.svg"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[11px] text-slate-400 italic">
                          No se adjuntó soporte digital. Podrá ser entregado físicamente.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Compromiso de Entrega Física */}
                  <div className="border-2 border-amber-200 bg-amber-50/60 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                      <Hourglass className="w-4 h-4 text-amber-700" />
                      Compromiso de entrega del soporte físico
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      La radicación de esta solicitud no significa que la inasistencia haya sido justificada. Si la institución requiere el soporte físico, me comprometo a entregarlo en la secretaría del colegio dentro del plazo establecido.
                    </p>

                    <label className="flex items-start gap-2.5 pt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedPhysicalCommitment}
                        onChange={(e) => setAcceptedPhysicalCommitment(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="font-bold text-xs text-amber-950">
                        Acepto el compromiso de entregar el soporte físico cuando sea requerido por la institución.
                      </span>
                    </label>
                  </div>

                  {/* Advertencia institucional */}
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Importante:</strong> Esta solicitud será revisada por la institución. Mientras no sea aprobada, la inasistencia continuará registrada como <strong>Ausente</strong>.
                    </span>
                  </div>
                </>
              )}

              {/* STEP 2: SUMMARY CONFIRMATION */}
              {formStep === "summary" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Resumen de la Solicitud
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Fecha de inasistencia:</span>
                        <span className="font-semibold text-slate-900 capitalize">
                          {formatDate(justifyingAbsence.date)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Asignatura:</span>
                        <span className="font-semibold text-slate-900">
                          {justifyingAbsence.subject}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Motivo:</span>
                        <span className="font-semibold text-slate-900">
                          {JUSTIFICATION_REASON_LABELS[reasonCategory]}
                          {reasonCategory === "other" && otherReasonText
                            ? ` (${otherReasonText})`
                            : ""}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Soporte adjunto:</span>
                        <span className="font-semibold text-slate-900">
                          {digitalFileName ? `Sí (${digitalFileName})` : "No (Entrega física)"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Compromiso físico:</span>
                        <span className="font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Aceptado
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Radicado por:</span>
                        <span className="font-semibold text-slate-900">
                          {role === "guardian"
                            ? `${user?.name || "Acudiente"} (Acudiente)`
                            : `${activeStudent.name} (Estudiante)`}
                        </span>
                      </div>
                      <div className="pt-1">
                        <span className="text-slate-500 block mb-1">Descripción:</span>
                        <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 italic">
                          "{description}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    Al radicar, la solicitud ingresará a la bandeja administrativa en estado{" "}
                    <strong>En revisión</strong>. La falta en la planilla solo se modificará a{" "}
                    <strong>Excusa</strong> cuando el docente o directivo apruebe formalmente la solicitud.
                  </div>
                </div>
              )}

              {/* STEP 3: SUCCESS CONFIRMATION */}
              {formStep === "success" && (
                <div className="py-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Justificación radicada exitosamente
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Tu solicitud fue enviada correctamente a la institución y registrada en el sistema.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto text-left text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Número de radicado:</span>
                      <strong className="text-blue-700 font-mono">#JUST-{createdRadicadoId}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha de radicación:</span>
                      <span>Hoy, {new Date().toLocaleDateString("es-CO")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha de inasistencia:</span>
                      <span className="capitalize">{formatDate(justifyingAbsence.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estado inicial:</span>
                      <span className="font-semibold text-blue-700">En revisión</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Soporte físico:</span>
                      <span className="font-semibold text-amber-700">Pendiente de entrega</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 max-w-md mx-auto">
                    <strong>Recordatorio:</strong> La inasistencia continúa registrada como{" "}
                    <strong>Ausente</strong> hasta que la institución revise los soportes y resuelva la solicitud.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              {formStep === "form" && (
                <>
                  <button
                    type="button"
                    onClick={handleCloseRadicationModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!description.trim() || !acceptedPhysicalCommitment}
                    onClick={() => setFormStep("summary")}
                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
                  >
                    Continuar a revisión
                  </button>
                </>
              )}

              {formStep === "summary" && (
                <>
                  <button
                    type="button"
                    onClick={() => setFormStep("form")}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                  >
                    Volver a editar
                  </button>
                  <button
                    type="button"
                    disabled={submitJustificationMutation.isPending}
                    onClick={handleConfirmSubmit}
                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
                  >
                    {submitJustificationMutation.isPending
                      ? "Radicando..."
                      : "Radicar justificación"}
                  </button>
                </>
              )}

              {formStep === "success" && (
                <div className="w-full flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setJustifyingAbsence(null);
                      setActiveTab("justifications");
                    }}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
                  >
                    Volver a mis asistencias
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 7. MODAL DE EXPEDIENTE FAMILIAR (DETALLE Y CONSULTA) */}
      {inspectingJustification && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 pt-4 sm:pt-8 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Expediente #JUST-{inspectingJustification.id}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Seguimiento familiar de justificación de inasistencia
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingJustification(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={detailModalRef} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  JUSTIFICATION_STATUS_META[inspectingJustification.status].badge
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      JUSTIFICATION_STATUS_META[inspectingJustification.status].dotColor
                    }`}
                  />
                  <span className="font-bold text-sm">
                    {JUSTIFICATION_STATUS_META[inspectingJustification.status].label}
                  </span>
                </div>
                <span className="text-[11px] text-slate-600">
                  {JUSTIFICATION_REASON_LABELS[inspectingJustification.reasonCategory]}
                </span>
              </div>

              {/* Warning when original attendance was modified post-radication */}
              {inspectingJustification.attendancePostModified && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5 text-xs shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      Aviso institucional: Registro de asistencia modificado
                    </strong>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      El registro de asistencia para esta fecha figura actualmente como{" "}
                      <strong className="uppercase">{inspectingJustification.currentAttendanceStatus || "modificado"}</strong>{" "}
                      en el sistema escolar del colegio.
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance & Class Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Información de la Inasistencia
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 text-[11px] block">
                      {inspectingJustification.status === "scheduled_absence"
                        ? "Fecha programada:"
                        : "Fecha de falta:"}
                    </span>
                    <strong className="text-slate-900 capitalize">
                      {formatDate(inspectingJustification.attendanceDate)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Curso / Grado:</span>
                    <strong className="text-slate-900">
                      Curso {inspectingJustification.courseId}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Estado en planilla:</span>
                    <strong
                      className={
                        inspectingJustification.status === "approved"
                          ? "text-emerald-700"
                          : inspectingJustification.status === "scheduled_absence"
                          ? "text-purple-700"
                          : "text-rose-700"
                      }
                    >
                      {inspectingJustification.status === "approved"
                        ? "Excusa (Justificada)"
                        : inspectingJustification.status === "scheduled_absence"
                        ? "Programada (Sin falta)"
                        : "Ausente"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Radicado por:</span>
                    <span className="text-slate-800 font-medium">
                      {inspectingJustification.submittedByName} (
                      {inspectingJustification.submittedByRole === "guardian"
                        ? "Acudiente"
                        : "Estudiante"}
                      )
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Descripción de los Hechos
                </span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {inspectingJustification.description}
                </p>
              </div>

              {/* Digital Evidence Previsualization (Point 2) */}
              {(inspectingJustification.digitalEvidenceName ||
                inspectingJustification.digitalEvidenceUrl) && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                    Constancia Digital Adjunta
                  </span>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-slate-800 truncate text-xs">
                          {inspectingJustification.digitalEvidenceName || "Documento de soporte"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Soporte digital adjunto al radicado
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          url: inspectingJustification.digitalEvidenceUrl,
                          name: inspectingJustification.digitalEvidenceName,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Previsualizar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Physical Support Status */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Soporte Físico
                </span>
                {inspectingJustification.requiresPhysicalSupport ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-600">
                      Compromiso de entrega física adquirido en la radicación.
                      {inspectingJustification.physicalSupportDeadline && (
                        <span>
                          {" "}
                          Plazo límite:{" "}
                          <strong>
                            {formatShortDate(inspectingJustification.physicalSupportDeadline)}
                          </strong>
                        </span>
                      )}
                    </p>

                    {inspectingJustification.physicalSupportReceivedAt ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Soporte físico recibido en el colegio</strong>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Recibido por {inspectingJustification.physicalSupportReceivedByName} el{" "}
                            {formatShortDate(inspectingJustification.physicalSupportReceivedAt)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-xs">
                        <Hourglass className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Pendiente de entrega física</strong>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Recuerda entregar la constancia original en secretaría académica.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Este trámite no requirió entrega de soporte físico original.
                  </p>
                )}
              </div>

              {/* Institutional Resolution */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Resolución Institucional
                </span>

                {inspectingJustification.status === "approved" ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 space-y-1">
                    <strong className="block text-sm">Justificación Aprobada</strong>
                    <p className="text-[11px] text-emerald-800">
                      Resuelta por <strong>{inspectingJustification.resolvedByName}</strong> el{" "}
                      {formatShortDate(inspectingJustification.resolvedAt)}. La inasistencia fue justificada formalmente en la planilla del colegio.
                    </p>
                    {inspectingJustification.resolutionNotes && (
                      <p className="text-[11px] text-emerald-900 italic pt-1">
                        Observaciones: "{inspectingJustification.resolutionNotes}"
                      </p>
                    )}
                  </div>
                ) : ["rejected", "unjustified"].includes(inspectingJustification.status) ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-950 space-y-1">
                    <strong className="block text-sm">
                      {inspectingJustification.status === "rejected"
                        ? "Excusa Rechazada"
                        : "No Justificada"}
                    </strong>
                    <p className="text-[11px] text-rose-800">
                      Resuelta por <strong>{inspectingJustification.resolvedByName}</strong> el{" "}
                      {formatShortDate(inspectingJustification.resolvedAt)}. La falta se mantiene sin justificar.
                    </p>
                    {inspectingJustification.resolutionNotes && (
                      <p className="text-[11px] text-rose-900 italic pt-1">
                        Fundamento: "{inspectingJustification.resolutionNotes}"
                      </p>
                    )}
                  </div>
                ) : inspectingJustification.status === "scheduled_absence" ? (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-950 space-y-1">
                    <strong className="block text-sm">Inasistencia Programada (Aviso Previo)</strong>
                    <p className="text-[11px] text-purple-800">
                      Este aviso fue notificado formalmente a los docentes. Cuando llegue la fecha de la sesión, el docente verá la observación preventiva en su planilla.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 space-y-1">
                    <strong className="block">La institución aún está revisando esta solicitud</strong>
                    <p className="text-[11px] text-blue-800">
                      El equipo docente y administrativo está validando la constancia. La inasistencia continuará registrada como Ausente hasta que se emita la resolución final.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingJustification(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar expediente
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 8. MODAL DE PROGRAMACIÓN DE INASISTENCIA PREVISTA (PUNTO 4) */}
      {showScheduleModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 pt-4 sm:pt-8 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-purple-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Programar inasistencia prevista
                  </h3>
                  <p className="text-[11px] text-purple-700 font-medium">
                    Aviso preventivo escolar · {activeStudent.name} ({activeStudent.course})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseScheduleModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanatory Banner */}
            <div className="px-6 py-3 bg-purple-50/40 border-b border-purple-100 text-xs text-purple-950 flex items-start gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span>
                  Este registro informa anticipadamente al docente sobre una ausencia futura autorizada.{" "}
                  <strong>No marca una falta en la planilla escolar antes de que ocurra la sesión de clase</strong>.
                </span>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div ref={scheduleModalRef} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-800">
              {/* Fecha prevista */}
              <div>
                <label className="font-bold text-slate-900 block mb-1.5">
                  1. Fecha de la inasistencia programada <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Selecciona la fecha futura en que el estudiante no podrá asistir.
                </span>
              </div>

              {/* Motivo */}
              <div>
                <label className="font-bold text-slate-900 block mb-1.5">
                  2. Causal de la inasistencia <span className="text-rose-500">*</span>
                </label>
                <select
                  value={scheduleReason}
                  onChange={(e) =>
                    setScheduleReason(
                      e.target.value as AttendanceJustificationReasonCategory
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 bg-white"
                >
                  <option value="external_appointment">
                    Cita médica especializada / Procedimiento de salud
                  </option>
                  <option value="medical">
                    Incapacidad médica / Reposo preventivo
                  </option>
                  <option value="institutional">
                    Compromiso institucional / Deportivo / Certamen académico
                  </option>
                  <option value="force_majeure">
                    Calamidad doméstica / Situación familiar inaplazable
                  </option>
                  <option value="other">Otra razón justificada</option>
                </select>

                {scheduleReason === "other" && (
                  <input
                    type="text"
                    value={scheduleOtherReason}
                    onChange={(e) => setScheduleOtherReason(e.target.value)}
                    placeholder="Especifica el motivo puntual..."
                    className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  3. Detalle o justificación de la ausencia <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={scheduleDescription}
                  onChange={(e) => setScheduleDescription(e.target.value)}
                  placeholder="Explica las razones del permiso o aviso preventivo para conocimiento del docente y coordinación..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 leading-relaxed"
                />
              </div>

              {/* Soporte digital anticipado */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                <label className="font-bold text-slate-900 block">
                  4. Constancia digital previa (opcional)
                </label>
                <p className="text-[11px] text-slate-500">
                  Si ya cuentas con la cita, volante o constancia oficial (PDF o imagen), puedes adjuntarla anticipadamente.
                </p>

                {scheduleDigitalFileName ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 truncate block">
                          {scheduleDigitalFileName}
                        </span>
                        <span className="text-[10px] text-slate-400">{scheduleDigitalFileSize}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleDigitalFileName(null);
                        setScheduleDigitalFileSize(null);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs shadow-2xs transition-colors">
                      <Upload className="w-3.5 h-3.5 text-purple-600" />
                      Adjuntar documento
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.svg"
                        onChange={handleScheduleFileChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 italic">
                      PDF, Word, Excel, imagen o texto hasta 25 MB
                    </span>
                  </div>
                )}
              </div>

              {/* Compromiso de entrega física */}
              <div className="p-3.5 border border-purple-200 rounded-xl bg-purple-50/40 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedulePhysicalCommitment}
                    onChange={(e) => setSchedulePhysicalCommitment(e.target.checked)}
                    className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="text-purple-950 block font-bold">
                      Compromiso de entrega de soporte físico original
                    </strong>
                    <span className="text-purple-900/80">
                      Entregaré el documento original o comprobante en secretaría académica o al docente en un plazo de hasta 3 días hábiles posteriores a la fecha programada.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleCloseScheduleModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!scheduleDate || !scheduleDescription.trim() || scheduleAbsenceMutation.isPending}
                onClick={handleConfirmSchedule}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>
                  {scheduleAbsenceMutation.isPending
                    ? "Programando..."
                    : "Programar inasistencia"}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 9. VISOR INTERACTIVO DE DOCUMENTOS (PUNTO 2) */}
      <DocumentPreviewModal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        documentUrl={previewDoc?.url}
        documentName={previewDoc?.name}
      />
    </div>
  );
};

export default StudentAttendancePortal;

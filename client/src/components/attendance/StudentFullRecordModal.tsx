import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Hourglass,
  Info,
  Mail,
  Maximize2,
  MessageCircle,
  Minus,
  Phone,
  Printer,
  RotateCcw,
  RotateCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  ACTIONABLE_STATUSES,
  AttendanceCourse,
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  STATUS_META,
  StudentRecordTab,
  StudentTimelineItem,
  normalizeDateIso,
} from "./types";
import { analyzeStudentPattern, calculateHistoryStats } from "./intelligence";
import {
  DocumentPreviewModal,
  getDocumentType,
  normalizeDocumentUrl,
} from "./DocumentPreviewModal";
import { StudentDossierPrintView } from "./StudentDossierPrintView";

interface StudentFullRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: AttendanceStudent;
  course: AttendanceCourse;
  days: AttendanceDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  onSetStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  // Navegación entre estudiantes
  onNextStudent?: () => void;
  onPrevStudent?: () => void;
  currentIndex?: number;
  totalStudents?: number;
  // Pestaña inicial
  initialTab?: StudentRecordTab;
  // Casos de seguimiento
  followUpCases?: AttendanceFollowUpCaseItem[];
  onOpenCase?: (student: AttendanceStudent, reason: string, priority: "low" | "medium" | "high") => void;
  onUpdateCaseStatus?: (caseId: number, status: "open" | "in_review" | "resolved") => void;
  onAddCaseNote?: (caseId: number, note: string) => void;
  caseHistoryNotes?: AttendanceFollowUpNoteItem[];
  isOpeningCase?: boolean;
  isUpdatingCase?: boolean;
  isAddingNote?: boolean;
  // Excusas
  justifications?: AttendanceJustificationItem[];
  onRecordPhysicalReceipt?: (justificationId: number, receivedByName: string, notes?: string) => void;
  onEscalateJustification?: (justificationId: number, coordinationNotes: string) => void;
  onResolveJustification?: (justificationId: number, status: "approved" | "unjustified" | "rejected", resolutionNotes: string) => void;
  // Navegación a Grade Center
  onNavigateToGradeCenter?: (courseId: string, studentId: string) => void;
  // Identidad institucional
  schoolLogoUrl?: string;
  schoolName?: string;
}

export const StudentFullRecordModal: React.FC<StudentFullRecordModalProps> = ({
  isOpen,
  onClose,
  student,
  course,
  days,
  selectedDate,
  onSelectDate,
  getStatus,
  onSetStatus,
  onNextStudent,
  onPrevStudent,
  currentIndex = 0,
  totalStudents = 1,
  initialTab = "summary",
  followUpCases = [],
  onOpenCase,
  onUpdateCaseStatus,
  onAddCaseNote,
  caseHistoryNotes = [],
  isOpeningCase = false,
  isUpdatingCase = false,
  isAddingNote = false,
  justifications = [],
  onRecordPhysicalReceipt,
  onEscalateJustification,
  onResolveJustification,
  onNavigateToGradeCenter,
  schoolLogoUrl,
  schoolName,
}) => {
  const [activeTab, setActiveTab] = useState<StudentRecordTab>(initialTab);
  const [selectedJustificationId, setSelectedJustificationId] = useState<number | null>(null);
  const [newCaseReason, setNewCaseReason] = useState("");
  const [newCasePriority, setNewCasePriority] = useState<"low" | "medium" | "high">("medium");
  const [noteDraft, setNoteDraft] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | AttendanceStatus>("all");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "attendance" | "justification" | "follow_up">("all");
  const [resolutionNotesDraft, setResolutionNotesDraft] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [docRotation, setDocRotation] = useState(0);
  const [isExpandedDocPreviewOpen, setIsExpandedDocPreviewOpen] = useState(false);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [docLoadError, setDocLoadError] = useState(false);

  // Sincronizar pestaña inicial si cambia desde afuera
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Manejo de teclado (Escape cierra, flechas navegan estudiantes)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && (e.altKey || e.ctrlKey)) {
        e.preventDefault();
        onPrevStudent?.();
      } else if (e.key === "ArrowRight" && (e.altKey || e.ctrlKey)) {
        e.preventDefault();
        onNextStudent?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onPrevStudent, onNextStudent]);

  // Lock de scroll en el body y clase para estilos de impresión A4
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("student-dossier-modal-open");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("student-dossier-modal-open");
    };
  }, [isOpen]);

  // Limpieza y reinicio estricto de todos los estados locales al cambiar de estudiante o al abrir el modal
  useEffect(() => {
    // 1. Borradores de texto de acuerdos docentes y resoluciones
    setNoteDraft("");
    setResolutionNotesDraft("");
    setNewCaseReason("");
    setNewCasePriority("medium");

    // 2. Filtros de historial y línea de tiempo
    setHistoryFilter("all");
    setTimelineFilter("all");

    // 3. Selección de justificación: resetear a la primera del nuevo estudiante o null si no tiene
    const currentStudentJusts = justifications
      .filter((j) => String(j.studentId) === String(student.id))
      .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime());
    setSelectedJustificationId(currentStudentJusts[0]?.id || null);

    // 4. Visor documental: restablecer zoom, rotación, errores y cerrar vista ampliada
    setZoomLevel(100);
    setDocRotation(0);
    setIsExpandedDocPreviewOpen(false);
    setDocLoadError(false);

    const firstDocUrl = currentStudentJusts[0]?.digitalEvidenceUrl;
    if (firstDocUrl) {
      const docType = getDocumentType(firstDocUrl, currentStudentJusts[0]?.digitalEvidenceName);
      setIsDocLoading(docType.isPdf || docType.isImage);
    } else {
      setIsDocLoading(false);
    }
  }, [student.id, isOpen]);

  // Análisis factual de patrones y métricas globales del estudiante
  const studentActiveCase = useMemo(() => {
    return followUpCases.find((c) => String(c.studentId) === String(student.id) && c.status !== "resolved");
  }, [followUpCases, student.id]);

  const resolvedCases = useMemo(() => {
    return followUpCases.filter((c) => String(c.studentId) === String(student.id) && c.status === "resolved");
  }, [followUpCases, student.id]);

  // Notas del caso activo pertenecientes exclusivamente al estudiante actual (previene condiciones de carrera por red)
  const currentCaseNotes = useMemo(() => {
    if (!studentActiveCase) return [];
    return caseHistoryNotes.filter((n) => n.caseId === studentActiveCase.id);
  }, [studentActiveCase, caseHistoryNotes]);

  const patternAnalysis = useMemo(() => {
    return analyzeStudentPattern(
      student,
      days,
      getStatus,
      studentActiveCase ? [studentActiveCase] : []
    );
  }, [student, days, getStatus, studentActiveCase]);

  const periodStats = useMemo(() => {
    return calculateHistoryStats(student.id, days, getStatus);
  }, [student.id, days, getStatus]);

  // Justificaciones pertenecientes estrictamente a este estudiante
  const studentJustifications = useMemo(() => {
    return justifications
      .filter((j) => String(j.studentId) === String(student.id))
      .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime());
  }, [justifications, student.id]);

  // Garantizar reactivamente que selectedJustificationId pertenezca siempre a studentJustifications
  useEffect(() => {
    if (!studentJustifications.length) {
      if (selectedJustificationId !== null) setSelectedJustificationId(null);
    } else if (
      selectedJustificationId === null ||
      !studentJustifications.some((j) => j.id === selectedJustificationId)
    ) {
      setSelectedJustificationId(studentJustifications[0].id);
    }
  }, [studentJustifications, selectedJustificationId]);

  // Justificación seleccionada en la pestaña de excusas
  const currentJustification = useMemo(() => {
    if (!studentJustifications.length) return null;
    if (selectedJustificationId) {
      return studentJustifications.find((j) => j.id === selectedJustificationId) || studentJustifications[0];
    }
    return studentJustifications[0];
  }, [studentJustifications, selectedJustificationId]);

  // Documento clasificado y normalizado de la justificación activa
  const currentDocInfo = useMemo(() => {
    if (!currentJustification?.digitalEvidenceUrl) return null;
    return getDocumentType(
      currentJustification.digitalEvidenceUrl,
      currentJustification.digitalEvidenceName
    );
  }, [currentJustification?.digitalEvidenceUrl, currentJustification?.digitalEvidenceName]);

  // Reset de estados de visualización documental al cambiar la justificación o el archivo
  useEffect(() => {
    if (currentDocInfo?.effectiveUrl) {
      setIsDocLoading(currentDocInfo.isPdf || currentDocInfo.isImage);
    } else {
      setIsDocLoading(false);
    }
    setDocLoadError(false);
    setZoomLevel(100);
    setDocRotation(0);
  }, [currentJustification?.id, currentDocInfo?.effectiveUrl, currentDocInfo?.isPdf, currentDocInfo?.isImage]);

  // Iniciales y color del estudiante
  const initials = student.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // Matriz de asistencia por semanas
  const weeks = useMemo(() => {
    const w: AttendanceDay[][] = [];
    for (let i = 0; i < days.length; i += 5) {
      w.push(days.slice(i, i + 5));
    }
    return w;
  }, [days]);

  // Análisis por día de la semana (Lunes a Viernes)
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie"];
    const stats: Record<string, { total: number; present: number; absent: number; late: number; excused: number }> = {
      Lun: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      Mar: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      Mié: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      Jue: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      Vie: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
    };

    days.forEach((day) => {
      const labelPrefix = day.label.slice(0, 3);
      if (stats[labelPrefix]) {
        const st = getStatus(student.id, day.iso);
        if (st !== "pending") {
          stats[labelPrefix].total++;
          if (st === "present") stats[labelPrefix].present++;
          else if (st === "absent") stats[labelPrefix].absent++;
          else if (st === "late") stats[labelPrefix].late++;
          else if (st === "excused") stats[labelPrefix].excused++;
        }
      }
    });

    return dayNames.map((name) => ({
      name,
      ...stats[name],
    }));
  }, [days, student.id, getStatus]);

  // Historial ordenado con filtro
  const filteredHistoryDays = useMemo(() => {
    const rev = [...days].reverse();
    if (historyFilter === "all") return rev;
    return rev.filter((d) => getStatus(student.id, d.iso) === historyFilter);
  }, [days, student.id, getStatus, historyFilter]);

  // Línea de tiempo unificada (Asistencia + Excusas + Casos + Notas)
  const unifiedTimeline = useMemo<StudentTimelineItem[]>(() => {
    const items: StudentTimelineItem[] = [];

    // 1. Inasistencias y tardanzas
    days.forEach((day) => {
      const st = getStatus(student.id, day.iso);
      if (st === "absent") {
        items.push({
          id: `att-absent-${day.iso}`,
          date: day.iso,
          timestamp: `${day.iso}T08:00:00.000Z`,
          type: "absence",
          title: `Inasistencia registrada · ${day.label}`,
          description: `Sesión de clase en ${course.label} (${course.subject}).`,
          actorRole: "Docente",
          actorName: course.teacherName || "Juan Diego Loaiza",
          badgeLabel: "Falta",
          badgeTone: "rose",
        });
      } else if (st === "late") {
        items.push({
          id: `att-late-${day.iso}`,
          date: day.iso,
          timestamp: `${day.iso}T08:15:00.000Z`,
          type: "late",
          title: `Llegada tarde · ${day.label}`,
          description: `Ingreso tardío a la sesión de ${course.subject}.`,
          actorRole: "Docente",
          actorName: course.teacherName || "Juan Diego Loaiza",
          badgeLabel: "Tardanza",
          badgeTone: "amber",
        });
      }
    });

    // 2. Excusas y sus eventos
    studentJustifications.forEach((just) => {
      items.push({
        id: `just-sub-${just.id}`,
        date: just.attendanceDate,
        timestamp: just.submittedAt || `${just.attendanceDate}T09:00:00.000Z`,
        type: "excuse_submitted",
        title: `Excusa radicada (#JUST-${just.id})`,
        description: `Motivo: ${JUSTIFICATION_REASON_LABELS[just.reasonCategory]}. ${just.description}`,
        actorRole: just.submittedByRole === "guardian" ? "Acudiente" : "Estudiante",
        actorName: just.submittedByName,
        badgeLabel: JUSTIFICATION_STATUS_META[just.status].label,
        badgeTone: just.status === "approved" ? "emerald" : "blue",
      });

      if (just.physicalSupportReceivedAt) {
        items.push({
          id: `just-phys-${just.id}`,
          date: normalizeDateIso(just.physicalSupportReceivedAt),
          timestamp: just.physicalSupportReceivedAt,
          type: "physical_received",
          title: `Soporte físico recibido (#JUST-${just.id})`,
          description: `Documento original entregado y verificado en secretaría/docencia. ${just.physicalSupportNotes || ""}`,
          actorRole: "Personal institucional",
          actorName: just.physicalSupportReceivedByName || "Coordinación",
          badgeLabel: "Físico entregado",
          badgeTone: "indigo",
        });
      }

      if (just.resolvedAt) {
        items.push({
          id: `just-res-${just.id}`,
          date: normalizeDateIso(just.resolvedAt),
          timestamp: just.resolvedAt,
          type: "excuse_resolved",
          title: `Excusa resuelta: ${JUSTIFICATION_STATUS_META[just.status].label}`,
          description: just.resolutionNotes || "Trámite de inasistencia formalmente concluido.",
          actorRole: "Docente / Coordinación",
          actorName: just.resolvedByName || course.teacherName || "Juan Diego Loaiza",
          badgeLabel: JUSTIFICATION_STATUS_META[just.status].label,
          badgeTone: just.status === "approved" ? "emerald" : just.status === "rejected" ? "rose" : "slate",
        });
      }
    });

    // 3. Casos de seguimiento pedagógico
    followUpCases
      .filter((c) => c.studentId === student.id)
      .forEach((c) => {
        items.push({
          id: `case-open-${c.id}`,
          date: normalizeDateIso(c.createdAt),
          timestamp: c.createdAt,
          type: "case_opened",
          title: `Caso de seguimiento abierto (#CASO-${c.id})`,
          description: `${c.reason} · Prioridad: ${c.priority === "high" ? "Alta" : c.priority === "medium" ? "Media" : "Baja"}`,
          actorRole: "Docente",
          actorName: c.responsibleName,
          badgeLabel: c.status === "resolved" ? "Caso resuelto" : "Caso abierto",
          badgeTone: c.status === "resolved" ? "emerald" : "indigo",
        });

        if (c.resolvedAt) {
          items.push({
            id: `case-res-${c.id}`,
            date: normalizeDateIso(c.resolvedAt),
            timestamp: c.resolvedAt,
            type: "case_resolved",
            title: `Caso de seguimiento resuelto (#CASO-${c.id})`,
            description: "Compromisos pedagógicos completados y caso archivado satisfactoriamente.",
            actorRole: "Docente",
            actorName: c.responsibleName,
            badgeLabel: "Resuelto",
            badgeTone: "emerald",
          });
        }
      });

    // 4. Notas docentes en casos pertenecientes al estudiante actual
    currentCaseNotes.forEach((n) => {
      items.push({
        id: `note-${n.id}`,
        date: normalizeDateIso(n.createdAt),
        timestamp: n.createdAt,
        type: "follow_up_note",
        title: `Nota docente en Caso #${n.caseId}`,
        description: n.note,
        actorRole: "Docente",
        actorName: n.authorName,
        badgeLabel: "Acuerdo pedagógico",
        badgeTone: "slate",
      });
    });

    // Ordenar por fecha cronológica descendente (más reciente arriba)
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [days, student.id, getStatus, course, studentJustifications, followUpCases, currentCaseNotes]);

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "all") return unifiedTimeline;
    if (timelineFilter === "attendance") {
      return unifiedTimeline.filter((i) => i.type === "absence" || i.type === "late");
    }
    if (timelineFilter === "justification") {
      return unifiedTimeline.filter((i) => i.type.startsWith("excuse_") || i.type === "physical_received");
    }
    if (timelineFilter === "follow_up") {
      return unifiedTimeline.filter((i) => i.type.startsWith("case_") || i.type === "follow_up_note");
    }
    return unifiedTimeline;
  }, [unifiedTimeline, timelineFilter]);

  // Manejadores de acciones con protección estricta de contexto de estudiante
  const handleOpenNewCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseReason.trim() || !onOpenCase) return;
    onOpenCase(student, newCaseReason.trim(), newCasePriority);
    setNewCaseReason("");
    setNewCasePriority("medium");
    toast.success("Nuevo caso de seguimiento iniciado correctamente.");
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteDraft.trim() || !studentActiveCase || !onAddCaseNote) return;
    if (String(studentActiveCase.studentId) !== String(student.id)) return;
    onAddCaseNote(studentActiveCase.id, noteDraft.trim());
    setNoteDraft("");
    toast.success("Nota pedagógica registrada exitosamente.");
  };

  const handleResolveActiveCase = () => {
    if (!studentActiveCase || !onUpdateCaseStatus) return;
    if (String(studentActiveCase.studentId) !== String(student.id)) return;
    onUpdateCaseStatus(studentActiveCase.id, "resolved");
    toast.success(`Caso #${studentActiveCase.id} archivado como resuelto.`);
  };

  const handleResolveJustificationAction = (status: "approved" | "unjustified" | "rejected") => {
    if (!currentJustification || !onResolveJustification) return;
    if (String(currentJustification.studentId) !== String(student.id)) return;
    onResolveJustification(
      currentJustification.id,
      status,
      resolutionNotesDraft.trim() || "Trámite resuelto desde el expediente integral."
    );
    setResolutionNotesDraft("");
    toast.success(`Justificación #${currentJustification.id} marcada como ${JUSTIFICATION_STATUS_META[status].label}.`);
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Expediente integral de ${student.name}`}
      className="student-record-portal-dialog fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Contenedor principal del Expediente interactivo (oculto en impresión) */}
      <div className="flex h-[90vh] max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl print:hidden">
        {/* ========================================================================= */}
        {/* CABECERA INSTITUCIONAL: Identidad, Acudientes, Navegación secuencial y Cierre */}
        {/* ========================================================================= */}
        <header className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 gap-3">
          {/* Identidad del Estudiante */}
          <div className="flex items-center gap-3.5 min-w-0">
            {student.avatar ? (
              <img
                src={student.avatar}
                alt={student.name}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-indigo-200 shadow-xs"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold text-slate-800 shadow-xs ring-1 ring-slate-300"
                style={{ backgroundColor: student.avatarColor || "#dbeafe" }}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {student.name}
                </h1>
                <span className="hidden sm:inline-flex rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {student.code}
                </span>
                <span className="inline-flex rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {student.academicStatus || "Activo"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {course.label} ({course.subject}) · {student.gradeLevel || "Grado 11°"} · Acudiente:{" "}
                <strong className="text-slate-700 font-semibold">{student.guardianName || "Sin acudiente registrado"}</strong>
                {student.guardianPhone && ` (${student.guardianPhone})`}
              </p>
            </div>
          </div>

          {/* Navegación secuencial entre estudiantes + Botón de Cerrar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Tasa global del periodo pill */}
            <div
              title="Asistencia acumulada en las sesiones del periodo"
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-2xs ${
                periodStats.attendanceRate >= 90
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : periodStats.attendanceRate >= 80
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <span>{periodStats.attendanceRate}% Asistencia</span>
              <span className="text-[10px] text-slate-400 font-normal">({periodStats.recordedDays} d)</span>
            </div>

            {/* Controles de anterior y siguiente */}
            <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onPrevStudent}
                title="Estudiante anterior (Ctrl + ←)"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <span className="px-2 text-[11px] font-mono font-bold text-slate-400">
                {currentIndex + 1}/{totalStudents}
              </span>

              <button
                type="button"
                onClick={onNextStudent}
                title="Siguiente estudiante (Ctrl + →)"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              title="Cerrar expediente (Esc)"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition shadow-2xs ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* BARRA DE NAVEGACIÓN POR PESTAÑAS (6 PESTAÑAS TEMÁTICAS)                  */}
        {/* ========================================================================= */}
        <nav className="flex items-center border-b border-slate-200 bg-slate-100/70 px-6 overflow-x-auto">
          {[
            { id: "summary", label: "Resumen", icon: UserCheck, count: null },
            { id: "attendance", label: "Asistencia", icon: CalendarDays, count: null },
            { id: "history", label: "Historial", icon: History, count: days.length },
            {
              id: "justifications",
              label: "Excusas",
              icon: FileCheck2,
              count: studentJustifications.length,
            },
            {
              id: "follow_up",
              label: "Seguimiento",
              icon: MessageCircle,
              count: studentActiveCase ? "Activo" : resolvedCases.length ? `${resolvedCases.length} ant.` : null,
            },
            { id: "timeline", label: "Línea de tiempo", icon: Clock, count: unifiedTimeline.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as StudentRecordTab)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "border-indigo-600 bg-white text-indigo-700 font-extrabold shadow-2xs"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ========================================================================= */}
        {/* CUERPO DEL EXPEDIENTE: Renderizado de la pestaña activa                   */}
        {/* ========================================================================= */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {/* ======================================================================= */}
          {/* PESTAÑA 1: RESUMEN                                                      */}
          {/* ======================================================================= */}
          {activeTab === "summary" && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
              {/* Tarjetas Superiores: 3 Columnas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Columna 1: Ficha Personal y Familiar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Ficha familiar y personal
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Matrícula activa
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Nombre completo</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{student.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Código ID</span>
                        <p className="font-mono font-bold text-slate-800 mt-0.5">{student.code}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Curso</span>
                        <p className="font-bold text-slate-800 mt-0.5">{course.label}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <span className="text-slate-400 text-[11px] block font-bold uppercase tracking-wider">
                        Acudiente principal
                      </span>
                      <p className="font-bold text-slate-800">
                        {student.guardianName || "No especificado"}
                      </p>
                      {student.guardianPhone && (
                        <p className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Phone className="h-3.5 w-3.5 text-indigo-600" />
                          <span>{student.guardianPhone}</span>
                        </p>
                      )}
                      {student.email && (
                        <p className="flex items-center gap-1.5 text-slate-600 font-medium truncate">
                          <Mail className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="truncate">{student.email}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna 2: Balance Factual de Asistencia */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Balance de asistencia ({days.length} sesiones)
                    </h2>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Periodo 2
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-black tracking-tight text-slate-900">
                        {periodStats.attendanceRate}%
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Tasa efectiva del periodo
                      </p>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200/80">
                      {periodStats.trend === "improving" ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <TrendingUp className="h-4 w-4" /> Mejora
                        </span>
                      ) : periodStats.trend === "declining" ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-700">
                          <TrendingDown className="h-4 w-4" /> Descenso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                          <Minus className="h-4 w-4 text-slate-400" /> Estable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de desglose */}
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded-full bg-slate-100 flex overflow-hidden">
                      <div
                        title={`Presentes: ${periodStats.presentCount}`}
                        style={{ width: `${(periodStats.presentCount / (periodStats.recordedDays || 1)) * 100}%` }}
                        className="bg-emerald-500 transition-all"
                      />
                      <div
                        title={`Excusas: ${periodStats.excusedCount}`}
                        style={{ width: `${(periodStats.excusedCount / (periodStats.recordedDays || 1)) * 100}%` }}
                        className="bg-blue-500 transition-all"
                      />
                      <div
                        title={`Tardanzas: ${periodStats.lateCount}`}
                        style={{ width: `${(periodStats.lateCount / (periodStats.recordedDays || 1)) * 100}%` }}
                        className="bg-amber-500 transition-all"
                      />
                      <div
                        title={`Ausencias: ${periodStats.absentCount}`}
                        style={{ width: `${(periodStats.absentCount / (periodStats.recordedDays || 1)) * 100}%` }}
                        className="bg-rose-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center pt-2">
                      <div className="rounded-lg bg-emerald-50/60 p-1.5 border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-800">Presente</p>
                        <p className="text-sm font-black text-emerald-900">{periodStats.presentCount}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50/60 p-1.5 border border-rose-100">
                        <p className="text-[10px] font-bold text-rose-800">Ausente</p>
                        <p className="text-sm font-black text-rose-900">{periodStats.absentCount}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50/60 p-1.5 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-800">Tardanza</p>
                        <p className="text-sm font-black text-amber-900">{periodStats.lateCount}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50/60 p-1.5 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-800">Excusa</p>
                        <p className="text-sm font-black text-blue-900">{periodStats.excusedCount}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna 3: Diagnóstico Factual & Alertas */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Diagnóstico pedagógico
                      </h2>
                      <span className="text-[10px] font-bold text-slate-500">
                        Intelligence AI
                      </span>
                    </div>

                    {patternAnalysis.hasNegativePattern ? (
                      <div
                        className={`rounded-xl border p-3.5 space-y-2 ${
                          patternAnalysis.severity === "critical"
                            ? "border-rose-200 bg-rose-50/60"
                            : "border-amber-200 bg-amber-50/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className={`h-4 w-4 shrink-0 ${
                              patternAnalysis.severity === "critical" ? "text-rose-600" : "text-amber-600"
                            }`}
                          />
                          <p
                            className={`text-xs font-extrabold capitalize ${
                              patternAnalysis.severity === "critical" ? "text-rose-900" : "text-amber-900"
                            }`}
                          >
                            {patternAnalysis.headline}
                          </p>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {patternAnalysis.explanation}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-1 text-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                        <p className="text-xs font-extrabold text-emerald-900 mt-1">
                          Asistencia regular y al día
                        </p>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Cumplimiento consistente sin patrones negativos ni alertas de deserción escolar.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Estado de caso de seguimiento */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {studentActiveCase ? (
                        <span className="font-bold text-indigo-700">
                          Caso activo #{studentActiveCase.id}
                        </span>
                      ) : (
                        "Sin caso de seguimiento activo"
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("follow_up")}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      {studentActiveCase ? "Gestionar caso →" : "Abrir caso →"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fila Inferior: Vista Rápida de Últimas 5 Sesiones + Acciones directas */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800">
                    Últimas 5 sesiones de clase registradas
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("attendance")}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Ver calendario completo ({days.length} sesiones) →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {days.slice(-5).map((day) => {
                    const st = getStatus(student.id, day.iso);
                    const meta = STATUS_META[st];
                    const hasJust = studentJustifications.some((j) => j.attendanceDate === day.iso);
                    return (
                      <div
                        key={day.iso}
                        className={`rounded-xl border p-3 flex flex-col justify-between space-y-2 ${meta.soft}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{day.label}</span>
                          <span className="text-[10px] font-mono text-slate-500">{day.iso.slice(5)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold">
                            <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                            {meta.label}
                          </span>
                          {hasJust && (
                            <span className="rounded bg-blue-100 text-blue-800 px-1 py-0.2 text-[9px] font-bold">
                              Excusa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* PESTAÑA 2: ASISTENCIA (Matriz y Calendario)                             */}
          {/* ======================================================================= */}
          {activeTab === "attendance" && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
              {/* Desglose por semanas */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Matriz de asistencia por semanas ({days.length} sesiones)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Seguimiento visual de la asistencia a lo largo de las 4 semanas del periodo.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Presente
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> Ausente
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> Tardanza
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Excusa
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-slate-700">
                          Semana {wIdx + 1}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {week[0]?.label} – {week[week.length - 1]?.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {week.map((day) => {
                          const st = getStatus(student.id, day.iso);
                          const meta = STATUS_META[st];
                          const just = studentJustifications.find((j) => j.attendanceDate === day.iso);
                          return (
                            <div
                              key={day.iso}
                              className={`rounded-lg border p-2.5 bg-white transition hover:shadow-2xs ${
                                st === "absent"
                                  ? "border-rose-200 bg-rose-50/40"
                                  : st === "late"
                                  ? "border-amber-200 bg-amber-50/40"
                                  : st === "excused"
                                  ? "border-blue-200 bg-blue-50/40"
                                  : "border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                                <span>{day.label}</span>
                                <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className={`text-[11px] font-extrabold ${meta.tone}`}>
                                  {meta.label}
                                </span>
                                {just && (
                                  <span
                                    title={`Excusa ${JUSTIFICATION_STATUS_META[just.status].label}`}
                                    className="rounded bg-blue-100 text-blue-800 px-1 py-0.2 text-[9px] font-bold"
                                  >
                                    Doc
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Análisis por día de la semana */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Análisis de asistencia por día de la semana
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permite identificar patrones de inasistencia o impuntualidad concentrados en días específicos (ej. lunes o viernes).
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {dayOfWeekStats.map((dow) => {
                    const presencePct = dow.total > 0 ? Math.round((dow.present / dow.total) * 100) : 100;
                    return (
                      <div key={dow.name} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{dow.name}</p>
                        <p
                          className={`text-xl font-black mt-1 ${
                            presencePct >= 90
                              ? "text-emerald-700"
                              : presencePct >= 80
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {presencePct}%
                        </p>
                        <div className="mt-2 space-y-0.5 text-[10px] text-slate-500 text-left">
                          <p>Faltas: <strong className={dow.absent > 0 ? "text-rose-700" : "text-slate-700"}>{dow.absent}</strong></p>
                          <p>Tardanzas: <strong className={dow.late > 0 ? "text-amber-700" : "text-slate-700"}>{dow.late}</strong></p>
                          <p>Excusas: <strong className="text-blue-700">{dow.excused}</strong></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* PESTAÑA 3: HISTORIAL AUDITABLE                                          */}
          {/* ======================================================================= */}
          {activeTab === "history" && (
            <div className="space-y-4 max-w-6xl mx-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Bitácora de sesiones ({filteredHistoryDays.length} de {days.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registro auditable con opción de corrección directa en línea.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as any)}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs outline-none"
                  >
                    <option value="all">Todas las sesiones ({days.length})</option>
                    <option value="absent">Solo Ausencias ({periodStats.absentCount})</option>
                    <option value="late">Solo Tardanzas ({periodStats.lateCount})</option>
                    <option value="excused">Solo Excusas ({periodStats.excusedCount})</option>
                    <option value="present">Solo Presentes ({periodStats.presentCount})</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Fecha y sesión</th>
                      <th className="px-4 py-3">Estado registrado</th>
                      <th className="px-4 py-3">Docente responsable</th>
                      <th className="px-4 py-3">Justificación / Motivo</th>
                      <th className="px-4 py-3 text-right">Modificar estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistoryDays.map((day) => {
                      const st = getStatus(student.id, day.iso);
                      const meta = STATUS_META[st];
                      const just = studentJustifications.find((j) => j.attendanceDate === day.iso);

                      return (
                        <tr key={day.iso} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            <div>{day.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{day.iso}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold ${meta.soft}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                              {meta.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600 font-medium">
                            {course.teacherName || "Juan Diego Loaiza"}
                          </td>

                          <td className="px-4 py-3">
                            {just ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedJustificationId(just.id);
                                  setActiveTab("justifications");
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 hover:underline"
                              >
                                <FileText className="h-3 w-3 text-blue-600" />
                                <span>{JUSTIFICATION_STATUS_META[just.status].label} (#{just.id})</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                              {ACTIONABLE_STATUSES.map((targetStatus) => {
                                const targetMeta = STATUS_META[targetStatus];
                                const isCurrent = st === targetStatus;
                                return (
                                  <button
                                    key={targetStatus}
                                    type="button"
                                    onClick={() => {
                                      onSetStatus(student.id, day.iso, targetStatus);
                                      toast.success(`Fecha ${day.label} actualizada a ${targetMeta.label}`);
                                    }}
                                    title={`Marcar como ${targetMeta.label}`}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${
                                      isCurrent
                                        ? `${targetMeta.badge} shadow-xs font-black`
                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                    }`}
                                  >
                                    {targetMeta.short}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* PESTAÑA 4: EXCUSAS Y JUSTIFICACIONES (Master-Detail con Visor Embebido) */}
          {/* ======================================================================= */}
          {activeTab === "justifications" && (
            <div className="max-w-6xl mx-auto h-[620px] flex gap-5 animate-in fade-in duration-200">
              {/* Panel Izquierdo: Lista de Excusas */}
              <div className="w-80 shrink-0 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Trámites radicados ({studentJustifications.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Historial de excusas de {student.name}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {studentJustifications.map((just) => {
                    const isSelected = currentJustification?.id === just.id;
                    const meta = JUSTIFICATION_STATUS_META[just.status];
                    return (
                      <button
                        key={just.id}
                        type="button"
                        onClick={() => setSelectedJustificationId(just.id)}
                        className={`w-full text-left p-3 rounded-xl border transition ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-300"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">
                            {just.attendanceDate}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium truncate mt-1">
                          {JUSTIFICATION_REASON_LABELS[just.reasonCategory]}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Radicado por: {just.submittedByName} ({just.submittedByRole})
                        </p>
                      </button>
                    );
                  })}

                  {!studentJustifications.length && (
                    <div className="py-12 text-center text-slate-400 text-xs px-4">
                      No hay justificaciones registradas para este estudiante.
                    </div>
                  )}
                </div>
              </div>

              {/* Panel Derecho: Detalle del Expediente de Justificación + Visor Embebido */}
              <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                {currentJustification ? (
                  <div className="flex-1 flex flex-col overflow-y-auto p-5 space-y-4">
                    {/* Cabecera del Trámite */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">
                            Expediente #{currentJustification.id} · {currentJustification.attendanceDate}
                          </h3>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                              JUSTIFICATION_STATUS_META[currentJustification.status].badge
                            }`}
                          >
                            {JUSTIFICATION_STATUS_META[currentJustification.status].label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Motivo: <strong className="text-slate-800">{JUSTIFICATION_REASON_LABELS[currentJustification.reasonCategory]}</strong>
                        </p>
                      </div>

                      {currentDocInfo?.effectiveUrl && (
                        <a
                          href={currentDocInfo.effectiveUrl}
                          download={currentDocInfo.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                        >
                          <Download className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Descargar archivo</span>
                        </a>
                      )}
                    </div>

                    {/* Descripción declarada */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Declaración del acudiente / solicitante:
                      </span>
                      <p className="text-slate-800 leading-relaxed font-medium">
                        "{currentJustification.description}"
                      </p>
                      <p className="text-[10px] text-slate-400 pt-1">
                        Radicado el {new Date(currentJustification.submittedAt).toLocaleString("es-CO")} por{" "}
                        {currentJustification.submittedByName} ({currentJustification.submittedByRole})
                      </p>
                    </div>

                    {/* Visor integrado de soporte documental */}
                    <div className="flex-1 min-h-[360px] rounded-xl border border-slate-200 bg-slate-900/5 p-3 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">Documento adjunto: {currentDocInfo?.fileName || "Constancia_Digital.pdf"}</span>
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {currentDocInfo?.isImage && (
                            <>
                              <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                                className="rounded p-1 text-slate-500 hover:bg-slate-200"
                                title="Reducir zoom"
                              >
                                <ZoomOut className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[10px] font-mono text-slate-600 px-1">{zoomLevel}%</span>
                              <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                                className="rounded p-1 text-slate-500 hover:bg-slate-200"
                                title="Aumentar zoom"
                              >
                                <ZoomIn className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocRotation((r) => (r + 90) % 360)}
                                className="rounded p-1 text-slate-500 hover:bg-slate-200 ml-1"
                                title="Rotar documento"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}

                          {currentDocInfo?.effectiveUrl && (
                            <button
                              type="button"
                              onClick={() => setIsExpandedDocPreviewOpen(true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition shadow-2xs ml-1"
                              title="Abrir en pantalla completa / visor interactivo"
                            >
                              <Maximize2 className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Ampliar</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Renderizado de documento con soporte interactivo, carga y fallback */}
                      <div className="flex-1 min-h-[320px] bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center relative">
                        {currentDocInfo?.effectiveUrl ? (
                          docLoadError ? (
                            /* Fallback cuando no es posible renderizar */
                            <div className="p-6 text-center max-w-md space-y-3">
                              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                <AlertCircle className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">
                                  No fue posible previsualizar el documento directamente
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                  El archivo puede tener restricciones del servidor o el navegador impide embeberlo en esta vista.
                                </p>
                              </div>
                              <div className="flex items-center justify-center gap-2 pt-1">
                                <a
                                  href={currentDocInfo.effectiveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Abrir documento</span>
                                </a>
                                <a
                                  href={currentDocInfo.effectiveUrl}
                                  download={currentDocInfo.fileName}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Descargar documento</span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Spinner de estado de carga */}
                              {isDocLoading && (
                                <div className="absolute inset-0 bg-white/85 backdrop-blur-2xs z-10 flex flex-col items-center justify-center gap-2 text-slate-500">
                                  <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                  <span className="text-xs font-medium">Cargando documento...</span>
                                </div>
                              )}

                              {currentDocInfo.isPdf ? (
                                <div className="w-full h-full min-h-[340px] flex flex-col relative">
                                  <iframe
                                    src={currentDocInfo.effectiveUrl}
                                    title={currentDocInfo.fileName}
                                    onLoad={() => setIsDocLoading(false)}
                                    onError={() => {
                                      setIsDocLoading(false);
                                      setDocLoadError(true);
                                    }}
                                    className="w-full h-full min-h-[340px] border-0 rounded-lg bg-white"
                                  />
                                </div>
                              ) : currentDocInfo.isImage ? (
                                <div className="w-full h-full flex items-center justify-center overflow-auto p-3">
                                  <img
                                    src={currentDocInfo.effectiveUrl}
                                    alt={currentDocInfo.fileName}
                                    onLoad={() => setIsDocLoading(false)}
                                    onError={() => {
                                      setIsDocLoading(false);
                                      setDocLoadError(true);
                                    }}
                                    style={{
                                      transform: `scale(${zoomLevel / 100}) rotate(${docRotation}deg)`,
                                      transition: "transform 0.15s ease",
                                    }}
                                    className="max-h-72 object-contain rounded-lg shadow-xs mx-auto select-none"
                                  />
                                </div>
                              ) : (
                                /* Otros formatos (Office / Texto / etc.) */
                                <div className="p-6 text-center max-w-md space-y-3">
                                  <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 break-all">
                                      {currentDocInfo.fileName}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      {currentDocInfo.isOffice
                                        ? "Documento de Microsoft Office adjuntado"
                                        : "Archivo de soporte digital adjuntado"}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-center gap-2 pt-1">
                                    <a
                                      href={currentDocInfo.effectiveUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Abrir documento</span>
                                    </a>
                                    <a
                                      href={currentDocInfo.effectiveUrl}
                                      download={currentDocInfo.fileName}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs"
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-600" />
                                      <span>Descargar documento</span>
                                    </a>
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        ) : (
                          <div className="text-center text-slate-400 text-xs py-8">
                            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-1.5" />
                            No se adjuntó soporte digital en este trámite.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones del Docente (Aprobar, Rechazar, Justificar) */}
                    {["submitted", "pending_physical_support", "in_review"].includes(currentJustification.status) ? (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                            Resolución institucional de la inasistencia
                          </span>
                          <span className="text-[10px] text-indigo-600 font-medium">
                            La aprobación justificará automáticamente la falta en la planilla
                          </span>
                        </div>

                        <input
                          value={resolutionNotesDraft}
                          onChange={(e) => setResolutionNotesDraft(e.target.value)}
                          placeholder="Nota o motivo de la resolución (opcional)..."
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveJustificationAction("rejected")}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                          >
                            Rechazar soporte
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveJustificationAction("unjustified")}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Marcar no justificada
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveJustificationAction("approved")}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
                          >
                            Aprobar y justificar inasistencia
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center justify-between">
                        <div>
                          <span>Trámite cerrado como: </span>
                          <strong className="text-slate-900 font-extrabold">
                            {JUSTIFICATION_STATUS_META[currentJustification.status].label}
                          </strong>
                          {currentJustification.resolutionNotes && (
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              Nota: {currentJustification.resolutionNotes}
                            </span>
                          )}
                        </div>
                        {currentJustification.resolvedByName && (
                          <span className="text-[10px] text-slate-400">
                            Por {currentJustification.resolvedByName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-400 text-xs">
                    Selecciona una excusa de la lista para inspeccionar sus documentos.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* PESTAÑA 5: SEGUIMIENTO PEDAGÓGICO (Activos + Resueltos)                  */}
          {/* ======================================================================= */}
          {activeTab === "follow_up" && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              {/* 1. Caso Activo de Seguimiento */}
              {studentActiveCase ? (
                <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 text-xs">
                        Caso #{studentActiveCase.id}
                      </span>
                      <h3 className="text-sm font-black text-slate-900">{studentActiveCase.reason}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Estado del caso"
                        value={studentActiveCase.status}
                        onChange={(e) =>
                          onUpdateCaseStatus?.(
                            studentActiveCase.id,
                            e.target.value as "open" | "in_review" | "resolved"
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-800"
                      >
                        <option value="open">Abierto</option>
                        <option value="in_review">En revisión</option>
                        <option value="resolved">Resuelto</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleResolveActiveCase}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        Archivar resuelto
                      </button>
                    </div>
                  </div>

                  {/* Notas y acuerdos docentes */}
                  <div className="space-y-2">
                    <span className="text-xs font-extrabold text-slate-700 block">
                      Bitácora de notas y acuerdos pedagógicos ({currentCaseNotes.length})
                    </span>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {currentCaseNotes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1">
                          <p className="text-slate-800 leading-relaxed font-medium">{note.note}</p>
                          <p className="text-[10px] text-slate-400">
                            {note.authorName} · {new Date(note.createdAt).toLocaleString("es-CO")}
                          </p>
                        </div>
                      ))}

                      {!currentCaseNotes.length && (
                        <p className="text-center text-slate-400 text-xs py-4">
                          No hay notas registradas en este caso aún.
                        </p>
                      )}
                    </div>

                    {/* Formulario de nueva nota */}
                    <form onSubmit={handleAddNoteSubmit} className="flex gap-2 pt-2">
                      <input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Escribir acuerdo docente, citación o compromiso..."
                        className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                      />
                      <button
                        type="submit"
                        disabled={!noteDraft.trim() || isAddingNote}
                        className="rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                      >
                        {isAddingNote ? "Guardando..." : "Agregar nota"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* Iniciar nuevo caso */
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Sin caso de seguimiento activo para este estudiante
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Puedes iniciar un caso pedagógico formal para concertar compromisos y dar seguimiento a inasistencias.
                    </p>
                  </div>

                  <form onSubmit={handleOpenNewCase} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Motivo del seguimiento
                      </label>
                      <input
                        value={newCaseReason}
                        onChange={(e) => setNewCaseReason(e.target.value)}
                        placeholder={
                          patternAnalysis.hasNegativePattern
                            ? `Ej. ${patternAnalysis.headline}`
                            : "Ej. Compromiso preventivo de asistencia y puntualidad"
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Prioridad:</span>
                        {(["low", "medium", "high"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewCasePriority(p)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                              newCasePriority === p
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {p === "high" ? "Alta" : p === "medium" ? "Media" : "Baja"}
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={!newCaseReason.trim() || isOpeningCase}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                      >
                        {isOpeningCase ? "Iniciando..." : "Abrir caso formal"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 2. Historial de Casos Resueltos (Antecedentes) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Casos pedagógicos resueltos y archivados ({resolvedCases.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Antecedentes institucionales</span>
                </div>

                <div className="space-y-2">
                  {resolvedCases.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Caso #{c.id} · {c.reason}</span>
                        <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          Resuelto el {c.resolvedAt ? new Date(c.resolvedAt).toLocaleDateString("es-CO") : "—"}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Asignado a: {c.responsibleName} · Creado el {new Date(c.createdAt).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  ))}

                  {!resolvedCases.length && (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No hay casos resueltos anteriores para este alumno.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* PESTAÑA 6: LÍNEA DE TIEMPO UNIFICADA                                    */}
          {/* ======================================================================= */}
          {activeTab === "timeline" && (
            <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Línea de tiempo cronológica ({filteredTimeline.length} eventos)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trazabilidad unificada: inasistencias, excusas, soportes físicos y acuerdos docentes.
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {(["all", "attendance", "justification", "follow_up"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTimelineFilter(filter)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        timelineFilter === filter
                          ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {filter === "all"
                        ? "Todos"
                        : filter === "attendance"
                        ? "Asistencia"
                        : filter === "justification"
                        ? "Excusas"
                        : "Seguimiento"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed vertical */}
              <div className="relative pl-6 border-l-2 border-slate-200 ml-4 space-y-5 py-2">
                {filteredTimeline.map((item) => {
                  return (
                    <div key={item.id} className="relative group">
                      {/* Punto de la línea */}
                      <span
                        className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-xs ${
                          item.badgeTone === "rose"
                            ? "bg-rose-500"
                            : item.badgeTone === "amber"
                            ? "bg-amber-500"
                            : item.badgeTone === "emerald"
                            ? "bg-emerald-500"
                            : item.badgeTone === "indigo"
                            ? "bg-indigo-500"
                            : "bg-blue-500"
                        }`}
                      />

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-1.5 transition hover:border-slate-300">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-900">{item.title}</h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(item.timestamp).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
                          <span>
                            {item.actorRole}: <strong className="text-slate-600">{item.actorName}</strong>
                          </span>
                          {item.badgeLabel && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 font-bold text-slate-600">
                              {item.badgeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!filteredTimeline.length && (
                  <p className="text-center text-slate-400 text-xs py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                    No hay eventos registrados en la línea de tiempo para este filtro.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ========================================================================= */}
        {/* PIE DE PÁGINA: Acciones de Retorno e Impresión                            */}
        {/* ========================================================================= */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToGradeCenter?.(course.id, student.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-700 hover:border-indigo-200 transition shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
              <span>Ver en Grade Center</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Imprimir ficha</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
          >
            Volver a la planilla
          </button>
        </footer>

        {/* Modal de visualización ampliada a pantalla completa */}
        {isExpandedDocPreviewOpen && currentDocInfo?.effectiveUrl && (
          <DocumentPreviewModal
            isOpen={isExpandedDocPreviewOpen}
            onClose={() => setIsExpandedDocPreviewOpen(false)}
            documentUrl={currentDocInfo.effectiveUrl}
            documentName={currentDocInfo.fileName}
            title={`Soporte Digital · ${student.name} · Folio #${currentJustification?.id || ""}`}
            submittedByName={currentJustification?.submittedByName}
            attendanceDate={currentJustification?.attendanceDate}
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* FICHA INTEGRAL DE ASISTENCIA (EXCLUSIVA PARA IMPRESIÓN A4 INSTITUCIONAL) */}
      {/* Independiente de activeTab, se renderiza únicamente al imprimir           */}
      {/* ========================================================================= */}
      <div className="hidden print:block w-full">
        <StudentDossierPrintView
          student={student}
          course={course}
          periodStats={periodStats}
          patternAnalysis={patternAnalysis}
          studentJustifications={studentJustifications}
          studentActiveCase={studentActiveCase}
          resolvedCases={resolvedCases}
          currentCaseNotes={currentCaseNotes}
          unifiedTimeline={unifiedTimeline}
          days={days}
          getStatus={getStatus}
          academicPeriod="Año Lectivo 2026 · Período 2"
          schoolLogoUrl={schoolLogoUrl}
          schoolName={schoolName}
        />
      </div>
    </div>,
    document.body
  );
};

export default StudentFullRecordModal;

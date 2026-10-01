import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
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
  Search,
  Send,
  ShieldAlert,
  Upload,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  AttendanceJustificationItem,
  AttendanceJustificationReasonCategory,
  AttendanceStatus,
  AttendanceStudent,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  STATUS_META,
} from "./types";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseLabel: string;
  students: AttendanceStudent[];
  justifications: AttendanceJustificationItem[];
  selectedJustificationId?: number | null;
  onSelectJustificationId?: (id: number | null) => void;
  getStatus?: (studentId: string, date: string) => AttendanceStatus;
  onRecordPhysicalReceipt: (
    justificationId: number,
    receivedByName: string,
    notes?: string
  ) => void;
  onEscalateToCoordination: (
    justificationId: number,
    coordinationNotes: string
  ) => void;
  onResolveJustification: (
    justificationId: number,
    status: "approved" | "unjustified" | "rejected",
    resolutionNotes: string
  ) => void;
  onSubmitJustification?: (data: {
    studentId: string;
    attendanceDate: string;
    reasonCategory: AttendanceJustificationReasonCategory;
    description: string;
    submittedByRole: "student" | "guardian" | "teacher";
    submittedByName: string;
    digitalEvidenceUrl?: string | null;
    digitalEvidenceName?: string | null;
    requiresPhysicalSupport?: boolean;
    physicalSupportDeadline?: string | null;
  }) => void;
  isProcessing?: boolean;
}

type FilterTab = "pending" | "scheduled" | "in_review" | "pending_support" | "resolved" | "all";

export const JustificationModal: React.FC<JustificationModalProps> = ({
  isOpen,
  onClose,
  courseLabel,
  students,
  justifications,
  selectedJustificationId,
  onSelectJustificationId,
  getStatus,
  onRecordPhysicalReceipt,
  onEscalateToCoordination,
  onResolveJustification,
  onSubmitJustification,
  isProcessing = false,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelectedId, setLocalSelectedId] = useState<number | null>(
    selectedJustificationId ?? null
  );

  const detailScrollRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  // Sub-modals
  const [showPhysicalModal, setShowPhysicalModal] = useState(false);
  const [physicalReceptor, setPhysicalReceptor] = useState("Docente Titular");
  const [physicalNotes, setPhysicalNotes] = useState("");

  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [coordinationDraftNotes, setCoordinationDraftNotes] = useState("");

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTargetStatus, setResolveTargetStatus] = useState<"approved" | "unjustified" | "rejected">("approved");
  const [resolutionDraftNotes, setResolutionDraftNotes] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newAttendanceDate, setNewAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newReasonCategory, setNewReasonCategory] =
    useState<AttendanceJustificationReasonCategory>("medical");
  const [newDescription, setNewDescription] = useState("");
  const [newSubmittedByRole, setNewSubmittedByRole] = useState<
    "student" | "guardian" | "teacher"
  >("teacher");
  const [newSubmittedByName, setNewSubmittedByName] = useState("Docente Titular");
  const [newRequiresPhysical, setNewRequiresPhysical] = useState(false);
  const [newPhysicalDeadline, setNewPhysicalDeadline] = useState("");
  const [newDigitalEvidenceUrl, setNewDigitalEvidenceUrl] = useState("");
  const [newDigitalEvidenceName, setNewDigitalEvidenceName] = useState("");
  const [newDigitalFileBase64, setNewDigitalFileBase64] = useState<string | null>(null);
  const [newDigitalFileSize, setNewDigitalFileSize] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const uploadDocumentMutation = trpc.justification.uploadDocument.useMutation();

  const handleCreateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        "Formato no admitido. Puedes adjuntar archivos PDF, Word (.docx), Excel (.xlsx), texto (.txt) o imágenes."
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("El archivo supera el tamaño máximo permitido de 25 MB.");
      return;
    }

    const sizeKb = (file.size / 1024).toFixed(0);
    setNewDigitalEvidenceName(file.name);
    setNewDigitalFileSize(`${sizeKb} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      setNewDigitalFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast.success(`Constancia adjunta: ${file.name} (${sizeKb} KB)`);
  };

  const [showDigitalPreview, setShowDigitalPreview] = useState(false);

  // Sync prop selection
  useEffect(() => {
    if (selectedJustificationId !== undefined) {
      setLocalSelectedId(selectedJustificationId);
    }
  }, [selectedJustificationId]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Reset scroll to top upon opening modal or switching selected justification
  useEffect(() => {
    if (isOpen) {
      detailScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
      listScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [isOpen, localSelectedId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (showDigitalPreview) setShowDigitalPreview(false);
        else if (showCreateModal) setShowCreateModal(false);
        else if (showPhysicalModal) setShowPhysicalModal(false);
        else if (showEscalateModal) setShowEscalateModal(false);
        else if (showResolveModal) setShowResolveModal(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    showDigitalPreview,
    showCreateModal,
    showPhysicalModal,
    showEscalateModal,
    showResolveModal,
    onClose,
  ]);

  // Normalize text removing diacritics / tildes, case, and extra spaces
  const normalizeSearchText = (text?: string | null): string => {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Students lookup map indexed by id, numericId, and normalized name
  const studentsMap = useMemo(() => {
    const map = new Map<string, AttendanceStudent>();
    for (const s of students) {
      map.set(String(s.id), s);
      if (s.numericId) map.set(String(s.numericId), s);
      map.set(normalizeSearchText(s.name), s);
    }
    return map;
  }, [students]);

  // Helper to resolve student object for a justification
  const getStudentForJustification = (j?: AttendanceJustificationItem | null): AttendanceStudent | null => {
    if (!j) return null;
    const byId = studentsMap.get(String(j.studentId));
    if (byId) return byId;
    if (j.canonicalStudentId) {
      const byCanonical = studentsMap.get(String(j.canonicalStudentId));
      if (byCanonical) return byCanonical;
    }
    if (j.studentName) {
      const byName = studentsMap.get(normalizeSearchText(j.studentName));
      if (byName) return byName;
    }
    return null;
  };

  // Helper to get real student display name (ensures "Estudiante #" is avoided whenever possible)
  const getStudentDisplayName = (j?: AttendanceJustificationItem | null): string => {
    if (!j) return "Estudiante";
    const st = getStudentForJustification(j);
    if (st?.name) return st.name;
    if (j.studentName && !j.studentName.startsWith("Estudiante #")) return j.studentName;
    return `Estudiante #${j.studentId}`;
  };

  const getStudentDisplayCode = (j?: AttendanceJustificationItem | null): string => {
    if (!j) return "";
    const st = getStudentForJustification(j);
    if (st?.code) return st.code;
    if (j.studentCode) return j.studentCode;
    return `EST-${j.courseId || "11-2"}-${String(j.studentId).padStart(2, "0")}`;
  };

  const getStudentAvatarColor = (j?: AttendanceJustificationItem | null): string => {
    if (!j) return "#e2e8f0";
    const st = getStudentForJustification(j);
    if (st?.avatarColor) return st.avatarColor;
    if (j.studentAvatarColor) return j.studentAvatarColor;
    return "#e2e8f0";
  };

  // Filter tabs counts
  const tabCounts = useMemo(() => {
    const pending = justifications.filter((j) =>
      ["submitted", "pending_physical_support", "in_review", "absence_registered"].includes(j.status)
    ).length;
    const scheduled = justifications.filter((j) => j.status === "scheduled_absence").length;
    const inReview = justifications.filter((j) => j.status === "in_review").length;
    const pendingSupport = justifications.filter(
      (j) => j.status === "pending_physical_support"
    ).length;
    const resolved = justifications.filter((j) =>
      ["approved", "unjustified", "rejected"].includes(j.status)
    ).length;
    return {
      pending,
      scheduled,
      in_review: inReview,
      pending_support: pendingSupport,
      resolved,
      all: justifications.length,
    };
  }, [justifications]);

  // Filtered list with diacritics-insensitive search (e.g. "sofia" finds "Sofía Martínez")
  const filteredJustifications = useMemo(() => {
    return justifications.filter((j) => {
      // Tab filter
      if (activeTab === "pending") {
        if (!["submitted", "pending_physical_support", "in_review", "absence_registered"].includes(j.status)) {
          return false;
        }
      } else if (activeTab === "scheduled") {
        if (j.status !== "scheduled_absence") return false;
      } else if (activeTab === "in_review") {
        if (j.status !== "in_review") return false;
      } else if (activeTab === "pending_support") {
        if (j.status !== "pending_physical_support") return false;
      } else if (activeTab === "resolved") {
        if (!["approved", "unjustified", "rejected"].includes(j.status)) {
          return false;
        }
      }

      // Search filter: diacritics & accent insensitive
      if (searchTerm.trim()) {
        const queryNorm = normalizeSearchText(searchTerm);
        const student = getStudentForJustification(j);

        const studentNameNorm = normalizeSearchText(student?.name || j.studentName);
        const studentCodeNorm = normalizeSearchText(student?.code || j.studentCode);
        const descNorm = normalizeSearchText(j.description);
        const submitterNorm = normalizeSearchText(j.submittedByName);
        const reasonNorm = normalizeSearchText(JUSTIFICATION_REASON_LABELS[j.reasonCategory]);
        const courseNorm = normalizeSearchText(j.courseId);

        const isMatch =
          studentNameNorm.includes(queryNorm) ||
          studentCodeNorm.includes(queryNorm) ||
          descNorm.includes(queryNorm) ||
          submitterNorm.includes(queryNorm) ||
          reasonNorm.includes(queryNorm) ||
          courseNorm.includes(queryNorm);

        if (!isMatch) return false;
      }

      return true;
    });
  }, [justifications, activeTab, searchTerm, studentsMap]);

  // Active item
  const activeJustification = useMemo(() => {
    if (!justifications.length) return null;
    if (localSelectedId) {
      const found = justifications.find((j) => j.id === localSelectedId);
      if (found) return found;
    }
    return filteredJustifications[0] || justifications[0] || null;
  }, [justifications, localSelectedId, filteredJustifications]);

  const activeStudent = useMemo(() => {
    return getStudentForJustification(activeJustification);
  }, [activeJustification, studentsMap]);

  const formatDate = (isoOrDate: string | Date | undefined | null) => {
    if (!isoOrDate) return "—";
    try {
      return new Intl.DateTimeFormat("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(isoOrDate));
    } catch {
      return String(isoOrDate);
    }
  };

  const formatDateTime = (isoOrDate: string | Date | undefined | null) => {
    if (!isoOrDate) return "—";
    try {
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(isoOrDate));
    } catch {
      return String(isoOrDate);
    }
  };

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 md:p-6 pt-3 sm:pt-5 md:pt-6 animate-in fade-in duration-150">
      <div className="w-[96vw] max-w-6xl h-[92vh] max-h-[900px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden text-slate-800 my-auto sm:my-0">
        {/* MODAL TOP HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  Bandeja de Justificaciones y Excusas
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  Curso {courseLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Expedientes reales de inasistencias, soportes médicos y trazabilidad administrativa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onSubmitJustification && (
              <button
                type="button"
                onClick={() => {
                  setNewStudentId(students[0]?.id || "");
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Radicar nueva excusa
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUBHEADER: FILTERS & SEARCH */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "pending"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>Pendientes</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tabCounts.pending > 0
                    ? "bg-amber-100 text-amber-800 font-bold"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {tabCounts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scheduled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "scheduled"
                  ? "bg-white text-purple-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>Programadas</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tabCounts.scheduled > 0
                    ? "bg-purple-100 text-purple-800 font-bold"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {tabCounts.scheduled}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("in_review")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "in_review"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>En revisión</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 text-[10px]">
                {tabCounts.in_review}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending_support")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "pending_support"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>Pendientes de soporte</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 text-[10px]">
                {tabCounts.pending_support}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("resolved")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "resolved"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>Resueltas</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 text-[10px]">
                {tabCounts.resolved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "all"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>Todas</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 text-[10px]">
                {tabCounts.all}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-64 max-w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por estudiante o motivo..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-700"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 2-COLUMN MAIN BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT COLUMN: LIST OF REQUESTS */}
          <div className="w-80 sm:w-96 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
              <span>Solicitudes ({filteredJustifications.length})</span>
              {searchTerm && <span className="text-blue-600">Filtradas</span>}
            </div>

            <div ref={listScrollRef} className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {filteredJustifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1">
                    {justifications.length === 0
                      ? "No hay solicitudes registradas"
                      : "No hay trámites en este filtro"}
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-[220px]">
                    {justifications.length === 0
                      ? "Las excusas radicadas por acudientes o docentes aparecerán en esta bandeja."
                      : "Prueba seleccionando otra pestaña o limpiando el texto del buscador."}
                  </p>
                  {justifications.length === 0 && onSubmitJustification && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewStudentId(students[0]?.id || "");
                        setShowCreateModal(true);
                      }}
                      className="mt-4 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Radicar primera justificación
                    </button>
                  )}
                </div>
              ) : (
                filteredJustifications.map((item) => {
                  const displayName = getStudentDisplayName(item);
                  const displayCode = getStudentDisplayCode(item);
                  const avatarColor = getStudentAvatarColor(item);
                  const isSelected = activeJustification?.id === item.id;
                  const meta = JUSTIFICATION_STATUS_META[item.status];
                  const StatusIcon = meta.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLocalSelectedId(item.id);
                        onSelectJustificationId?.(item.id);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border ${
                        isSelected
                          ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                          : "bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-slate-700 border border-slate-200"
                            style={{
                              backgroundColor: avatarColor,
                            }}
                          >
                            {displayName.charAt(0) || "E"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">
                              {displayName}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {displayCode}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                          {formatDate(item.attendanceDate)}
                        </span>
                      </div>

                      {/* Status pill & Reason */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${meta.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                          <StatusIcon className="w-2.5 h-2.5" />
                          {meta.label}
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/70">
                          {JUSTIFICATION_REASON_LABELS[item.reasonCategory]}
                        </span>
                      </div>

                      {/* Preview Description */}
                      <p className="text-[11px] text-slate-600 line-clamp-1 mb-1.5">
                        {item.description}
                      </p>

                      {/* Footer tags */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Por: {item.submittedByName}</span>
                        {item.requiresPhysicalSupport && !item.physicalSupportReceivedAt && (
                          <span className="text-amber-600 font-medium flex items-center gap-0.5 ml-auto">
                            <Hourglass className="w-2.5 h-2.5" /> Físico pendiente
                          </span>
                        )}
                        {item.physicalSupportReceivedAt && (
                          <span className="text-emerald-600 font-medium flex items-center gap-0.5 ml-auto">
                            <Check className="w-2.5 h-2.5" /> Físico validado
                          </span>
                        )}
                        {item.escalatedToCoordination && (
                          <span className="text-blue-600 font-medium ml-auto">
                            En Coordinación
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: COMPLETE DOSSIER / DETAIL */}
          <div ref={detailScrollRef} className="flex-1 flex flex-col bg-white overflow-y-auto">
            {!activeJustification ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-600">
                  Ningún expediente seleccionado
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Selecciona una justificación de la lista de la izquierda para revisar la
                  documentación, validar soportes y emitir resolución.
                </p>
              </div>
            ) : (
              <div className="p-5 sm:p-6 space-y-5 max-w-3xl">
                {/* 1. Header Banner of Selected Dossier */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-slate-700 border border-slate-200 shadow-xs shrink-0"
                      style={{
                        backgroundColor: getStudentAvatarColor(activeJustification),
                      }}
                    >
                      {getStudentDisplayName(activeJustification).charAt(0) || "E"}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {getStudentDisplayName(activeJustification)}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className="font-mono font-semibold">{getStudentDisplayCode(activeJustification)}</span>
                        <span>·</span>
                        <span>Curso {courseLabel}</span>
                        {(activeStudent?.guardianName || activeJustification.guardianName) && (
                          <>
                            <span>·</span>
                            <span>Acudiente: {activeStudent?.guardianName || activeJustification.guardianName}</span>
                          </>
                        )}
                      </div>

                      {/* Attendance Date and Real Attendance Status Badge */}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          {activeJustification.status === "scheduled_absence" ? (
                            <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          {activeJustification.status === "scheduled_absence"
                            ? `Inasistencia prevista para: ${formatDate(activeJustification.attendanceDate)}`
                            : `Fecha de inasistencia: ${formatDate(activeJustification.attendanceDate)}`}
                        </span>

                        {getStatus && activeJustification.status !== "scheduled_absence" && (
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const st = getStatus(
                                activeJustification.studentId,
                                activeJustification.attendanceDate
                              );
                              const stMeta = STATUS_META[st];
                              const isExcused = st === "excused";
                              const isAbsent = st === "absent";
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                    isExcused
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : isAbsent
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  <span>Estado en planilla:</span>
                                  <strong>{stMeta.label}</strong>
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overall Status Badge */}
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        JUSTIFICATION_STATUS_META[activeJustification.status].badge
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          JUSTIFICATION_STATUS_META[activeJustification.status].dotColor
                        }`}
                      />
                      {JUSTIFICATION_STATUS_META[activeJustification.status].label}
                    </span>
                  </div>
                </div>

                {/* SCHEDULED ABSENCE NOTICE (if scheduled) */}
                {activeJustification.status === "scheduled_absence" && (
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-950 flex items-start justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <CalendarClock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-purple-900">
                          Aviso de Inasistencia Programada
                        </h4>
                        <p className="text-purple-800 text-[11px] mt-0.5">
                          Radicada anticipadamente por {activeJustification.submittedByName} ({activeJustification.submittedByRole === "guardian" ? "Acudiente" : "Estudiante"}). 
                          <strong> No genera falta en lista antes de la fecha de la sesión.</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResolveTargetStatus("approved");
                        setResolutionDraftNotes(
                          "Inasistencia programada verificada y justificada anticipadamente conforme a la constancia aportada."
                        );
                        setShowResolveModal(true);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprobar anticipadamente
                    </button>
                  </div>
                )}

                {/* EXECUTIVE QUICK ACTIONS & RESOLUTION BAR */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Resolución del Trámite
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {["approved", "unjustified", "rejected"].includes(activeJustification.status)
                          ? `Expediente resuelto por ${activeJustification.resolvedByName || "Docente"} el ${formatDateTime(activeJustification.resolvedAt)}`
                          : "Acción inmediata de evaluación y resolución institucional"}
                      </span>
                    </div>

                    {/* Botones de acción ejecutiva única */}
                    {!["approved", "unjustified", "rejected"].includes(activeJustification.status) ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeJustification.status === "scheduled_absence" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setResolveTargetStatus("approved");
                              setResolutionDraftNotes(
                                "Inasistencia programada verificada y justificada anticipadamente conforme a la constancia aportada."
                              );
                              setShowResolveModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprobar anticipadamente
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setResolveTargetStatus("approved");
                              setResolutionDraftNotes(
                                "Constancia médica verificada. Inasistencia justificada conforme al reglamento institucional."
                              );
                              setShowResolveModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprobar y Justificar Falta
                          </button>
                        )}

                        {activeJustification.requiresPhysicalSupport && !activeJustification.physicalSupportReceivedAt && (
                          <button
                            type="button"
                            onClick={() => setShowPhysicalModal(true)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Hourglass className="w-3.5 h-3.5" />
                            Registrar Físico
                          </button>
                        )}

                        {!activeJustification.escalatedToCoordination && (
                          <button
                            type="button"
                            onClick={() => setShowEscalateModal(true)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            A Coordinación
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setResolveTargetStatus("unjustified");
                            setResolutionDraftNotes("No se aportaron soportes válidos dentro del plazo establecido.");
                            setShowResolveModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          No Justificada
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResolveTargetStatus("rejected");
                            setResolutionDraftNotes("Solicitud rechazada por inconsistencias en la constancia aportada.");
                            setShowResolveModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${
                          activeJustification.status === "approved"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : activeJustification.status === "rejected"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolución: {JUSTIFICATION_STATUS_META[activeJustification.status].label}</span>
                      </div>
                    )}
                  </div>

                  {/* Observaciones de resolución en caso de trámite resuelto */}
                  {["approved", "unjustified", "rejected"].includes(activeJustification.status) && activeJustification.resolutionNotes && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs text-slate-700">
                      <strong>Observaciones de la resolución:</strong> {activeJustification.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* Avisos normativos y de asistencia modificada */}
                {activeJustification.status !== "scheduled_absence" && (
                  <div className="text-[11px] text-slate-500 bg-blue-50/40 border border-blue-100 rounded-lg p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      La falta registrada por el docente se mantiene como registro original en la planilla. La ausencia solo pasa formalmente a <strong>Excusa</strong> cuando este trámite sea aprobado tras la verificación de los soportes.
                    </span>
                  </div>
                )}

                {activeJustification.attendancePostModified && (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        Atención: Registro de asistencia modificado post-radicación
                      </span>
                      <span className="text-[11px] text-amber-800">
                        El registro de esta fecha figura actualmente como{" "}
                        <strong className="uppercase">{activeJustification.currentAttendanceStatus || "modificado"}</strong>{" "}
                        en la planilla docente. Revisa si la falta fue corregida antes de emitir una resolución.
                      </span>
                    </div>
                  </div>
                )}

                {/* CUERPO DEL EXPEDIENTE EN 2 COLUMNAS SIN DUPLICIDADES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* COLUMNA IZQUIERDA: HECHOS Y DECLARACIÓN */}
                  <div className="space-y-4">
                    {/* Radicación y Solicitante */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Datos de Radicación
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {activeJustification.submittedByRole === "guardian" ? (
                            <UserCheck className="w-4 h-4" />
                          ) : activeJustification.submittedByRole === "teacher" ? (
                            <FileCheck2 className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            {activeJustification.submittedByName}
                          </p>
                          <p className="text-[11px] text-slate-500 capitalize">
                            Rol:{" "}
                            {activeJustification.submittedByRole === "guardian"
                              ? "Acudiente Titular"
                              : activeJustification.submittedByRole === "teacher"
                              ? "Docente / Secretaría"
                              : "Estudiante"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Radicado: {formatDateTime(activeJustification.submittedAt || activeJustification.createdAt)}</span>
                      </div>
                    </div>

                    {/* Motivo y Declaración de hechos */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Motivo declarado
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                          {JUSTIFICATION_REASON_LABELS[activeJustification.reasonCategory]}
                        </span>
                      </div>
                      <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-700 leading-relaxed italic">
                          "{activeJustification.description}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: SOPORTES Y GESTIÓN */}
                  <div className="space-y-4">
                    {/* Constancia Digital */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Constancia Digital Adjunta
                      </span>

                      {activeJustification.digitalEvidenceName || activeJustification.digitalEvidenceUrl ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/40">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Paperclip className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate" title={activeJustification.digitalEvidenceName || "Constancia_digital.pdf"}>
                                {activeJustification.digitalEvidenceName || "Constancia_digital.pdf"}
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                Documento digital verificado
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowDigitalPreview(true)}
                              className="px-2.5 py-1 text-xs font-semibold bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                              title="Abrir visor de documento"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>
                            {activeJustification.digitalEvidenceUrl && (
                              <a
                                href={activeJustification.digitalEvidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                                title="Abrir en pestaña nueva"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          Sin constancia digital adjunta.
                        </p>
                      )}
                    </div>

                    {/* Soporte Físico Original */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Soporte Físico
                        </span>
                        {activeJustification.requiresPhysicalSupport ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Requerido por protocolo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                            No requerido
                          </span>
                        )}
                      </div>

                      {activeJustification.requiresPhysicalSupport ? (
                        activeJustification.physicalSupportReceivedAt ? (
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Soporte Físico Recibido
                            </div>
                            <p className="text-[11px] text-emerald-700">
                              Recibido el {formatDateTime(activeJustification.physicalSupportReceivedAt)} por{" "}
                              <strong>{activeJustification.physicalSupportReceivedByName}</strong>.
                            </p>
                            {activeJustification.physicalSupportNotes && (
                              <p className="text-[11px] text-emerald-800 mt-1.5 italic bg-white/70 p-2 rounded border border-emerald-100">
                                "{activeJustification.physicalSupportNotes}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1 text-amber-900">
                                <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                                Pendiente de entrega
                              </span>
                              <span className="text-[11px] text-amber-800">
                                Plazo: {activeJustification.physicalSupportDeadline ? formatDate(activeJustification.physicalSupportDeadline) : "Sin definir"}
                              </span>
                            </div>
                            {!["approved", "unjustified", "rejected"].includes(activeJustification.status) && (
                              <button
                                type="button"
                                onClick={() => setShowPhysicalModal(true)}
                                className="w-full py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-2xs text-center cursor-pointer"
                              >
                                Registrar recepción física en secretaría
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          Este motivo no exige radicación de documento físico en original.
                        </p>
                      )}
                    </div>

                    {/* Derivación a Coordinación (si existe) */}
                    {activeJustification.escalatedToCoordination ? (
                      <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/70 text-xs text-blue-950">
                        <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1">
                          <ShieldAlert className="w-4 h-4 text-blue-600" />
                          Derivado a Coordinación Académica / Convivencia
                        </div>
                        <p className="text-blue-800 text-[11px] bg-white/80 p-2 rounded border border-blue-100 mt-1">
                          {activeJustification.coordinationNotes || "Caso remitido para valoración institucional."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 8. Línea de Tiempo y Auditoría */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Historial de Auditoría y Trazabilidad
                  </span>

                  <div className="space-y-3 relative pl-4 border-l-2 border-slate-200">
                    {(activeJustification.events && activeJustification.events.length > 0) ? (
                      activeJustification.events.map((ev, idx) => (
                        <div key={ev.id || idx} className="relative text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1 ring-4 ring-white" />
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 capitalize">
                              {ev.eventType === "submitted"
                                ? "Radicación de excusa"
                                : ev.eventType === "physical_received"
                                ? "Recepción de soporte físico"
                                : ev.eventType === "escalated"
                                ? "Derivación a coordinación"
                                : ev.eventType === "approved"
                                ? "Resolución: Aprobada"
                                : ev.eventType === "rejected"
                                ? "Resolución: Rechazada"
                                : ev.eventType === "unjustified"
                                ? "Resolución: No justificada"
                                : ev.eventType}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDateTime(ev.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Por: <strong>{ev.actorName}</strong> ({ev.actorRole})
                          </p>
                          {ev.notes && (
                            <p className="text-[11px] text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                              {ev.notes}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="relative text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1 ring-4 ring-white" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">Radicación inicial</span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(activeJustification.submittedAt || activeJustification.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Por: <strong>{activeJustification.submittedByName}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUB-MODAL 1: REGISTRAR RECEPCIÓN DE SOPORTE FÍSICO */}
      {showPhysicalModal && activeJustification && (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Registrar Recepción de Soporte Físico
              </h4>
              <button
                type="button"
                onClick={() => setShowPhysicalModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Funcionario / Docente que recibe el documento:
                </label>
                <input
                  type="text"
                  value={physicalReceptor}
                  onChange={(e) => setPhysicalReceptor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observaciones de recepción:
                </label>
                <textarea
                  rows={3}
                  value={physicalNotes}
                  onChange={(e) => setPhysicalNotes(e.target.value)}
                  placeholder="Ej: Se recibió certificado médico original de EPS Sura con sello húmedo..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPhysicalModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onRecordPhysicalReceipt(
                    activeJustification.id,
                    physicalReceptor,
                    physicalNotes
                  );
                  setShowPhysicalModal(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
              >
                Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: DERIVAR A COORDINACIÓN */}
      {showEscalateModal && activeJustification && (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                Derivar Trámite a Coordinación
              </h4>
              <button
                type="button"
                onClick={() => setShowEscalateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Deriva este caso a la Coordinación Académica o Convivencia si el caso
              requiere validación institucional adicional, involucra causas de fuerza mayor
              o supera los días hábiles permitidos.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-xs">
                  Motivo o notas para coordinación:
                </label>
                <textarea
                  rows={3}
                  value={coordinationDraftNotes}
                  onChange={(e) => setCoordinationDraftNotes(e.target.value)}
                  placeholder="Describe la razón de derivación..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEscalateModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onEscalateToCoordination(activeJustification.id, coordinationDraftNotes);
                  setShowEscalateModal(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Confirmar derivación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: RESOLVER TRÁMITE */}
      {showResolveModal && activeJustification && (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Emitir Resolución de Excusa
              </h4>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Decisión administrativa:
                </label>
                <select
                  value={resolveTargetStatus}
                  onChange={(e) =>
                    setResolveTargetStatus(
                      e.target.value as "approved" | "unjustified" | "rejected"
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="approved">Aprobar excusa (justificada legalmente)</option>
                  <option value="rejected">Rechazar excusa (soporte inválido o extemporáneo)</option>
                  <option value="unjustified">Declarar inasistencia injustificada</option>
                </select>
              </div>

              {resolveTargetStatus === "approved" && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px]">
                  <strong>Efecto en planilla:</strong> La asistencia del estudiante en la fecha{" "}
                  <strong>{formatDate(activeJustification.attendanceDate)}</strong> cambiará
                  automáticamente a <strong>Excusa</strong>.
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observaciones / Fundamento de la decisión:
                </label>
                <textarea
                  rows={3}
                  value={resolutionDraftNotes}
                  onChange={(e) => setResolutionDraftNotes(e.target.value)}
                  placeholder="Explica las razones de la decisión para la trazabilidad..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onResolveJustification(
                    activeJustification.id,
                    resolveTargetStatus,
                    resolutionDraftNotes
                  );
                  setShowResolveModal(false);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs ${
                  resolveTargetStatus === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : resolveTargetStatus === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-700 hover:bg-slate-800"
                }`}
              >
                Emitir resolución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 4: RADICAR NUEVA JUSTIFICACIÓN */}
      {showCreateModal && onSubmitJustification && (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Radicar Nueva Justificación de Inasistencia
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Estudiante */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Estudiante del curso {courseLabel}:
                </label>
                <select
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha de inasistencia */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Fecha de inasistencia a justificar:
                </label>
                <input
                  type="date"
                  value={newAttendanceDate}
                  onChange={(e) => setNewAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motivo de inasistencia:
                </label>
                <select
                  value={newReasonCategory}
                  onChange={(e) =>
                    setNewReasonCategory(
                      e.target.value as AttendanceJustificationReasonCategory
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="medical">Incapacidad médica / Salud</option>
                  <option value="family_emergency">Calamidad o emergencia familiar</option>
                  <option value="external_appointment">Cita médica o procedimiento externo</option>
                  <option value="institutional">Representación institucional / Deportiva</option>
                  <option value="force_majeure">Fuerza mayor / Clima / Transporte</option>
                  <option value="other">Otro motivo justificable</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Descripción y justificación detallada:
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalla las razones de la inasistencia..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Quién radica */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Quién radica la excusa:
                  </label>
                  <select
                    value={newSubmittedByRole}
                    onChange={(e) =>
                      setNewSubmittedByRole(
                        e.target.value as "student" | "guardian" | "teacher"
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="teacher">Docente / Secretaría</option>
                    <option value="guardian">Acudiente</option>
                    <option value="student">Estudiante</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Nombre del radicado:
                  </label>
                  <input
                    type="text"
                    value={newSubmittedByName}
                    onChange={(e) => setNewSubmittedByName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Soporte físico toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRequiresPhysical}
                    onChange={(e) => setNewRequiresPhysical(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Requiere entrega de soporte físico original en secretaría
                  </span>
                </label>

                {newRequiresPhysical && (
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">
                      Fecha límite de entrega física:
                    </label>
                    <input
                      type="date"
                      value={newPhysicalDeadline}
                      onChange={(e) => setNewPhysicalDeadline(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Constancia digital opcional */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
                <label className="font-semibold text-slate-800 block text-xs">
                  Constancia digital adjunta (opcional):
                </label>
                <p className="text-[11px] text-slate-500">
                  Adjunta el archivo entregado (PDF, Word, Excel, imagen o texto hasta 25 MB).
                </p>

                {newDigitalEvidenceName ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 truncate block text-xs">
                          {newDigitalEvidenceName}
                        </span>
                        {newDigitalFileSize && (
                          <span className="text-[10px] text-slate-400">{newDigitalFileSize}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewDigitalEvidenceName("");
                        setNewDigitalFileBase64(null);
                        setNewDigitalFileSize(null);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-0.5 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Seleccionar archivo desde el equipo</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.svg"
                      onChange={handleCreateFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDigitalEvidenceName("");
                  setNewDigitalFileBase64(null);
                  setNewDigitalFileSize(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newStudentId || !newDescription.trim() || !newSubmittedByName.trim() || isUploadingFile}
                onClick={async () => {
                  let finalUrl: string | null = null;
                  if (newDigitalEvidenceName && newDigitalFileBase64) {
                    try {
                      setIsUploadingFile(true);
                      const res = await uploadDocumentMutation.mutateAsync({
                        fileName: newDigitalEvidenceName,
                        fileBase64: newDigitalFileBase64,
                      });
                      finalUrl = res.url;
                    } catch (err: any) {
                      toast.error("No se pudo subir el archivo: " + (err?.message || "Error al subir"));
                      setIsUploadingFile(false);
                      return;
                    } finally {
                      setIsUploadingFile(false);
                    }
                  }

                  onSubmitJustification({
                    studentId: newStudentId,
                    attendanceDate: newAttendanceDate,
                    reasonCategory: newReasonCategory,
                    description: newDescription,
                    submittedByRole: newSubmittedByRole,
                    submittedByName: newSubmittedByName,
                    requiresPhysicalSupport: newRequiresPhysical,
                    physicalSupportDeadline: newRequiresPhysical ? newPhysicalDeadline : null,
                    digitalEvidenceName: newDigitalEvidenceName || null,
                    digitalEvidenceUrl: finalUrl,
                  });
                  setShowCreateModal(false);
                  setNewDescription("");
                  setNewDigitalEvidenceName("");
                  setNewDigitalFileBase64(null);
                  setNewDigitalFileSize(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer"
              >
                {isUploadingFile ? "Subiendo archivo..." : "Radicar trámite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 5: PREVISUALIZADOR DIGITAL */}
      {showDigitalPreview && activeJustification && (
        <DocumentPreviewModal
          isOpen={showDigitalPreview}
          onClose={() => setShowDigitalPreview(false)}
          documentUrl={activeJustification.digitalEvidenceUrl}
          documentName={activeJustification.digitalEvidenceName || "Constancia_Digital.pdf"}
          title={`Soporte Digital - ${getStudentDisplayName(activeJustification)}`}
          submittedByName={activeJustification.submittedByName}
          attendanceDate={formatDate(activeJustification.attendanceDate)}
        />
      )}
    </div>,
    document.body
  );
};

export default JustificationModal;

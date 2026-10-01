import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Hourglass,
  Inbox,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import {
  AttendanceJustificationItem,
  AttendanceStudent,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
} from "./types";

interface JustificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  courseLabel: string;
  students: AttendanceStudent[];
  justifications: AttendanceJustificationItem[];
  selectedJustificationId?: number | null;
  onSelectJustificationId?: (id: number | null) => void;
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
  isProcessing?: boolean;
}

type TabMode = "pending" | "coordination" | "resolved" | "all";

export const JustificationDrawer: React.FC<JustificationDrawerProps> = ({
  isOpen,
  onClose,
  courseLabel,
  students,
  justifications,
  selectedJustificationId,
  onSelectJustificationId,
  onRecordPhysicalReceipt,
  onEscalateToCoordination,
  onResolveJustification,
  isProcessing = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelectedId, setLocalSelectedId] = useState<number | null>(
    selectedJustificationId ?? null
  );

  // Inline action forms
  const [showPhysicalModal, setShowPhysicalModal] = useState(false);
  const [physicalReceptor, setPhysicalReceptor] = useState("Docente Titular");
  const [physicalNotes, setPhysicalNotes] = useState("");

  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [coordinationDraftNotes, setCoordinationDraftNotes] = useState("");

  const [resolutionDraftNotes, setResolutionDraftNotes] = useState("");
  const [showDigitalPreview, setShowDigitalPreview] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (selectedJustificationId !== undefined) {
      setLocalSelectedId(selectedJustificationId);
    }
  }, [selectedJustificationId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (showDigitalPreview) {
          setShowDigitalPreview(false);
        } else if (showPhysicalModal) {
          setShowPhysicalModal(false);
        } else if (showEscalateModal) {
          setShowEscalateModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDigitalPreview, showPhysicalModal, showEscalateModal, onClose]);

  // Students lookup map
  const studentsMap = useMemo(() => {
    const map = new Map<string, AttendanceStudent>();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const pending = justifications.filter((j) =>
      ["submitted", "pending_physical_support", "in_review"].includes(j.status)
    ).length;
    const coordination = justifications.filter((j) => j.escalatedToCoordination).length;
    const resolved = justifications.filter((j) =>
      ["approved", "unjustified", "rejected"].includes(j.status)
    ).length;
    return {
      pending,
      coordination,
      resolved,
      all: justifications.length,
    };
  }, [justifications]);

  // Filtered list
  const filteredJustifications = useMemo(() => {
    return justifications.filter((j) => {
      // Tab filter
      if (activeTab === "pending") {
        if (!["submitted", "pending_physical_support", "in_review"].includes(j.status)) {
          return false;
        }
      } else if (activeTab === "coordination") {
        if (!j.escalatedToCoordination) return false;
      } else if (activeTab === "resolved") {
        if (!["approved", "unjustified", "rejected"].includes(j.status)) {
          return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const student = studentsMap.get(j.studentId);
        const query = searchTerm.toLowerCase();
        const studentMatch =
          student &&
          (student.name.toLowerCase().includes(query) ||
            student.code.toLowerCase().includes(query));
        const descMatch = j.description.toLowerCase().includes(query);
        const submitterMatch = j.submittedByName.toLowerCase().includes(query);
        if (!studentMatch && !descMatch && !submitterMatch) return false;
      }

      return true;
    });
  }, [justifications, activeTab, searchTerm, studentsMap]);

  // Active justification
  const activeJustification = useMemo(() => {
    if (!justifications.length) return null;
    if (localSelectedId) {
      const found = justifications.find((j) => j.id === localSelectedId);
      if (found) return found;
    }
    // Default to first item in filtered list, or first in justifications
    return filteredJustifications[0] || justifications[0] || null;
  }, [justifications, localSelectedId, filteredJustifications]);

  const activeStudent = activeJustification
    ? studentsMap.get(activeJustification.studentId)
    : null;

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
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(isoOrDate));
    } catch {
      return String(isoOrDate);
    }
  };

  const handleSelect = (id: number) => {
    setLocalSelectedId(id);
    onSelectJustificationId?.(id);
    setShowPhysicalModal(false);
    setShowEscalateModal(false);
    setResolutionDraftNotes("");
  };

  const handleConfirmPhysicalReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJustification) return;
    onRecordPhysicalReceipt(
      activeJustification.id,
      physicalReceptor.trim() || "Docente Titular",
      physicalNotes.trim() || undefined
    );
    setShowPhysicalModal(false);
    setPhysicalNotes("");
  };

  const handleConfirmEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJustification || !coordinationDraftNotes.trim()) return;
    onEscalateToCoordination(activeJustification.id, coordinationDraftNotes.trim());
    setShowEscalateModal(false);
    setCoordinationDraftNotes("");
  };

  const handleResolve = (status: "approved" | "unjustified" | "rejected") => {
    if (!activeJustification) return;
    onResolveJustification(
      activeJustification.id,
      status,
      resolutionDraftNotes.trim()
    );
    setResolutionDraftNotes("");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Main Slide-over Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Bandeja de Justificaciones y Excusas"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl lg:max-w-3xl flex-col bg-white border-l border-slate-200 shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-2xs">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Bandeja de Justificaciones y Excusas
                </h2>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/80">
                  {courseLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Gestión probatoria de inasistencias y constancias oficiales
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar bandeja de justificaciones"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab & Search Filter Bar */}
        <div className="border-b border-slate-200 bg-white px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  activeTab === "pending"
                    ? "bg-white text-indigo-900 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
              >
                Pendientes ({tabCounts.pending})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("coordination")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  activeTab === "coordination"
                    ? "bg-white text-indigo-900 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
              >
                Coordinación ({tabCounts.coordination})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resolved")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  activeTab === "resolved"
                    ? "bg-white text-indigo-900 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
              >
                Resueltas ({tabCounts.resolved})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  activeTab === "all"
                    ? "bg-white text-indigo-900 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
              >
                Todas ({tabCounts.all})
              </button>
            </div>

            {/* Quick search */}
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por estudiante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Content Layout: Master List (left/top) + Detail Pane */}
        <div className="flex flex-1 min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Master List Column */}
          <div className="w-full md:w-5/12 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
            {filteredJustifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 px-4">
                <Inbox className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">No hay excusas en esta vista</p>
                <p className="mt-0.5 text-slate-400">
                  {searchTerm
                    ? "Ningún registro coincide con el criterio de búsqueda."
                    : "Todas las solicitudes de este filtro están al día."}
                </p>
              </div>
            ) : (
              filteredJustifications.map((j) => {
                const student = studentsMap.get(j.studentId);
                const isSelected = activeJustification?.id === j.id;
                const statusMeta = JUSTIFICATION_STATUS_META[j.status];
                const StatusIcon = statusMeta.icon;

                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => handleSelect(j.id)}
                    className={`flex w-full flex-col text-left rounded-xl border p-3 transition shadow-2xs ${
                      isSelected
                        ? "border-indigo-400 bg-white ring-2 ring-indigo-200"
                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/90"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {student?.avatar ? (
                          <img
                            src={student.avatar}
                            alt={student.name}
                            className="h-7 w-7 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-slate-800"
                            style={{ backgroundColor: student?.avatarColor || "#e2e8f0" }}
                          >
                            {student?.name?.charAt(0) || "E"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {student?.name || j.studentId}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {student?.code}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold border ${statusMeta.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotColor}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        Falta: {j.attendanceDate}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(j.submittedAt)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 truncate max-w-[170px]">
                        {JUSTIFICATION_REASON_LABELS[j.reasonCategory]}
                      </span>
                      {j.requiresPhysicalSupport && !j.physicalSupportReceivedAt && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 border border-amber-200">
                          Físico pend.
                        </span>
                      )}
                      {j.escalatedToCoordination && (
                        <span className="rounded bg-purple-50 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 border border-purple-200">
                          En coordinación
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail Pane Column */}
          <div className="w-full md:w-7/12 overflow-y-auto p-5 space-y-5 bg-white">
            {activeJustification ? (
              <>
                {/* Active Student & Date Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    {activeStudent?.avatar ? (
                      <img
                        src={activeStudent.avatar}
                        alt={activeStudent.name}
                        className="h-11 w-11 rounded-xl object-cover ring-2 ring-indigo-100"
                      />
                    ) : (
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-slate-800 ring-1 ring-slate-200"
                        style={{ backgroundColor: activeStudent?.avatarColor || "#e2e8f0" }}
                      >
                        {activeStudent?.name?.charAt(0) || "E"}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {activeStudent?.name || activeJustification.studentId}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400">
                          {activeStudent?.code}
                        </span>
                        <span>·</span>
                        <span>Curso {courseLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Fecha de inasistencia
                    </p>
                    <p className="text-xs font-extrabold text-slate-800 font-mono mt-0.5">
                      {activeJustification.attendanceDate}
                    </p>
                  </div>
                </div>

                {/* Status Callout Card */}
                {(() => {
                  const meta = JUSTIFICATION_STATUS_META[activeJustification.status];
                  return (
                    <div className={`rounded-xl border p-3.5 space-y-1 ${meta.soft}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <meta.icon className={`h-4 w-4 ${meta.tone}`} />
                          <span className={`text-xs font-black uppercase tracking-wide ${meta.tone}`}>
                            Estado: {meta.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Trámite #{activeJustification.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  );
                })()}

                {/* Sender & Motivation Info */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Motivo declarado
                      </span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {JUSTIFICATION_REASON_LABELS[activeJustification.reasonCategory]}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Radicado por
                      </span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {activeJustification.submittedByName}{" "}
                        <span className="text-[10px] font-semibold text-slate-500 capitalize">
                          ({activeJustification.submittedByRole === "guardian" ? "Acudiente" : "Estudiante"})
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatDateTime(activeJustification.submittedAt)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Descripción de los hechos
                    </span>
                    <p className="mt-1 text-xs text-slate-700 leading-relaxed bg-white rounded-lg p-2.5 border border-slate-200/70">
                      {activeJustification.description}
                    </p>
                  </div>
                </div>

                {/* Digital Evidence Card */}
                <div className="rounded-xl border border-slate-200/90 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                      Constancia digital adjunta
                    </span>
                    {activeJustification.digitalEvidenceName && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Archivo verificado
                      </span>
                    )}
                  </div>

                  {activeJustification.digitalEvidenceName ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {activeJustification.digitalEvidenceName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDigitalPreview(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition pl-2"
                      >
                        <span>Ver constancia</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 rounded-lg p-2.5">
                      No se adjuntó archivo digital al radicar la excusa.
                    </p>
                  )}
                </div>

                {/* Physical Document Commitment & Receipt */}
                <div className="rounded-xl border border-amber-200/90 bg-amber-50/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                      Compromiso de entrega de soporte físico
                    </span>
                    {activeJustification.requiresPhysicalSupport ? (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                        Requerido
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-slate-600">
                        No requerido
                      </span>
                    )}
                  </div>

                  {activeJustification.requiresPhysicalSupport && (
                    <>
                      {activeJustification.physicalSupportReceivedAt ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Soporte físico recibido en el colegio</span>
                          </div>
                          <p className="text-[11px] text-emerald-800">
                            Recibido por:{" "}
                            <strong>{activeJustification.physicalSupportReceivedByName}</strong> el{" "}
                            {formatDateTime(activeJustification.physicalSupportReceivedAt)}
                          </p>
                          {activeJustification.physicalSupportNotes && (
                            <p className="text-[11px] text-emerald-700 italic">
                              Nota: “{activeJustification.physicalSupportNotes}”
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs text-amber-900">
                            <p>
                              El acudiente se comprometió a entregar el soporte original en el colegio.
                            </p>
                            {activeJustification.physicalSupportDeadline && (
                              <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                                Plazo límite institucional:{" "}
                                {formatDate(activeJustification.physicalSupportDeadline)}
                              </p>
                            )}
                          </div>

                          {!showPhysicalModal ? (
                            <button
                              type="button"
                              onClick={() => setShowPhysicalModal(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-50 transition"
                            >
                              <Check className="h-3.5 w-3.5 text-amber-700" />
                              <span>Registrar recepción de soporte físico</span>
                            </button>
                          ) : (
                            <form
                              onSubmit={handleConfirmPhysicalReceipt}
                              className="rounded-lg border border-amber-300 bg-white p-3 space-y-2 text-xs"
                            >
                              <p className="font-extrabold text-amber-950">
                                Asentar recepción del documento físico
                              </p>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                  Funcionario receptor
                                </label>
                                <input
                                  type="text"
                                  value={physicalReceptor}
                                  onChange={(e) => setPhysicalReceptor(e.target.value)}
                                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-amber-400"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                  Observación o sello (opcional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ej: Radicado #104 con firma y sello de EPS"
                                  value={physicalNotes}
                                  onChange={(e) => setPhysicalNotes(e.target.value)}
                                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-amber-400"
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="submit"
                                  disabled={isProcessing}
                                  className="rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 transition"
                                >
                                  Confirmar recepción
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowPhysicalModal(false)}
                                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Escalation to Coordination */}
                <div className="rounded-xl border border-purple-200/90 bg-purple-50/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                      <ShieldAlert className="h-3.5 w-3.5 text-purple-600" />
                      Derivación a coordinación
                    </span>
                    {activeJustification.escalatedToCoordination && (
                      <span className="rounded-md bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
                        Derivado
                      </span>
                    )}
                  </div>

                  {activeJustification.escalatedToCoordination ? (
                    <div className="rounded-lg border border-purple-200 bg-white p-2.5 text-xs space-y-1">
                      <p className="font-bold text-purple-900">
                        Trámite remitido a Coordinación Académica / Convivencia
                      </p>
                      {activeJustification.coordinationNotes && (
                        <p className="text-slate-700 text-[11px] italic">
                          Nota de derivación: “{activeJustification.coordinationNotes}”
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-purple-900">
                        Si el caso excede competencias del docente o requiere validación de comité, deriva el trámite a coordinación.
                      </p>
                      {!showEscalateModal ? (
                        <button
                          type="button"
                          onClick={() => setShowEscalateModal(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-2.5 py-1.5 text-xs font-bold text-purple-800 shadow-2xs hover:bg-purple-50 transition"
                        >
                          <Send className="h-3 w-3 text-purple-600" />
                          <span>Derivar caso a coordinación</span>
                        </button>
                      ) : (
                        <form
                          onSubmit={handleConfirmEscalation}
                          className="rounded-lg border border-purple-300 bg-white p-3 space-y-2 text-xs"
                        >
                          <label className="block text-[10px] font-bold text-purple-900 uppercase">
                            Motivo o consulta para coordinación
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Describe por qué se remite a coordinación..."
                            value={coordinationDraftNotes}
                            onChange={(e) => setCoordinationDraftNotes(e.target.value)}
                            className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-400"
                            required
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={isProcessing}
                              className="rounded-md bg-purple-700 px-3 py-1 text-xs font-bold text-white hover:bg-purple-800 transition"
                            >
                              Confirmar derivación
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowEscalateModal(false)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* Resolution Block */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      Resolución del trámite
                    </h4>
                    {activeJustification.resolvedAt && (
                      <span className="text-[10px] text-slate-400">
                        Resuelto el {formatDateTime(activeJustification.resolvedAt)} por {activeJustification.resolvedByName}
                      </span>
                    )}
                  </div>

                  {["approved", "unjustified", "rejected"].includes(activeJustification.status) ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800">Decisión adoptada:</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold border ${
                            JUSTIFICATION_STATUS_META[activeJustification.status].badge
                          }`}
                        >
                          {JUSTIFICATION_STATUS_META[activeJustification.status].label}
                        </span>
                      </div>
                      {activeJustification.resolutionNotes && (
                        <p className="text-slate-600 italic text-[11px]">
                          Nota de resolución: “{activeJustification.resolutionNotes}”
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 pt-1">
                        {activeJustification.status === "approved"
                          ? "✓ La inasistencia fue formalmente justificada y actualizada a estado 'Excusa' en la planilla."
                          : "• La inasistencia permanece como falta no justificada en el registro del estudiante."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Observación docente / Justificación reglamentaria
                        </label>
                        <textarea
                          rows={2}
                          value={resolutionDraftNotes}
                          onChange={(e) => setResolutionDraftNotes(e.target.value)}
                          placeholder="Ej: Se valida certificado médico de la EPS con 2 días de reposo..."
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Approve */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleResolve("approved")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Aprobar (Justificar inasistencia)</span>
                        </button>

                        {/* Unjustified */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleResolve("unjustified")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                        >
                          <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
                          <span>Declarar no justificada</span>
                        </button>

                        {/* Reject */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleResolve("rejected")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                        >
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                          <span>Rechazar excusa</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Trail & Traceability Timeline */}
                <div className="rounded-xl border border-slate-200/80 p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                      Trazabilidad y auditoría del trámite
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {activeJustification.events && activeJustification.events.length > 0 ? (
                      activeJustification.events.map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          className="flex items-start gap-2.5 text-xs border-l-2 border-indigo-200 pl-3 py-1"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-slate-800 capitalize">
                                {ev.eventType.replace(/_/g, " ")}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {formatDateTime(ev.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Por: <strong className="text-slate-700">{ev.actorName}</strong> ({ev.actorRole})
                            </p>
                            {ev.notes && (
                              <p className="text-[11px] text-slate-600 italic mt-0.5">
                                “{ev.notes}”
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Fallback synthetic initial event
                      <div className="flex items-start gap-2.5 text-xs border-l-2 border-indigo-200 pl-3 py-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-800">Radicación inicial</p>
                            <span className="text-[10px] text-slate-400">
                              {formatDateTime(activeJustification.submittedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Por: <strong className="text-slate-700">{activeJustification.submittedByName}</strong> ({activeJustification.submittedByRole})
                          </p>
                          <p className="text-[11px] text-slate-600 italic mt-0.5">
                            “{activeJustification.description}”
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">Selecciona una excusa de la lista</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Haz clic en cualquier trámite para consultar sus soportes y auditar su ciclo de vida.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Digital Proof Simulated Document Modal */}
      {showDigitalPreview && activeJustification && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Constancia Digital Radicada
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDigitalPreview(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Simulated Medical/Proof Certificate Document */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 font-mono text-xs text-slate-700">
              <div className="border-b border-dashed border-slate-300 pb-2 text-center">
                <p className="font-bold uppercase tracking-wider text-slate-900">
                  INSTITUTO DE SALUD & PRESTADOR MÉDICO
                </p>
                <p className="text-[10px] text-slate-500">
                  Constancia Médica de Atención y Reposo
                </p>
              </div>

              <div className="space-y-1 text-[11px]">
                <p>
                  <strong>Paciente:</strong> {activeStudent?.name || activeJustification.studentId}
                </p>
                <p>
                  <strong>Fecha de expedición:</strong> {activeJustification.attendanceDate}
                </p>
                <p>
                  <strong>Causal:</strong> {JUSTIFICATION_REASON_LABELS[activeJustification.reasonCategory]}
                </p>
                <p>
                  <strong>Documento adjunto:</strong> {activeJustification.digitalEvidenceName}
                </p>
              </div>

              <div className="rounded bg-white p-3 border border-slate-200/80 text-[11px] leading-relaxed">
                “Por medio de la presente se certifica que el paciente asistió a valoración médica y se indica reposo en casa durante la jornada escolar correspondiente a la fecha {activeJustification.attendanceDate}.”
              </div>

              <div className="pt-2 text-right text-[10px] text-slate-400">
                <p>Firma digital y registro médico verificado.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDigitalPreview(false)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default JustificationDrawer;

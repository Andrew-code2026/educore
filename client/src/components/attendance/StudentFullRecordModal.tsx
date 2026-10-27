/**
 * Expediente del estudiante: resumen, registro de clases, excusas y seguimiento.
 * El contenido de cada pestaña vive en `./record/`; aquí solo se orquestan los
 * datos, la navegación entre estudiantes, el foco y la ficha imprimible.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeStudentPattern, calculateHistoryStats } from "./intelligence";
import { AttendanceTab } from "./record/AttendanceTab";
import { FollowUpTab } from "./record/FollowUpTab";
import { JustificationsTab } from "./record/JustificationsTab";
import { OPEN_JUSTIFICATION_STATUSES, capitalize, computeRecordStats } from "./record/recordUi";
import { SummaryTab } from "./record/SummaryTab";
import { buildStudentTimeline } from "./record/timeline";
import { StudentDossierPrintView } from "./StudentDossierPrintView";
import type {
  AttendanceCourse,
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  StudentRecordTab,
} from "./types";

interface StudentFullRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: AttendanceStudent;
  course: AttendanceCourse;
  /** Clases del curso (fechas con asistencia tomada), de la más antigua a la más reciente. */
  days: AttendanceDay[];
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  onSetStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  onNextStudent?: () => void;
  onPrevStudent?: () => void;
  currentIndex?: number;
  totalStudents?: number;
  initialTab?: StudentRecordTab;
  followUpCases?: AttendanceFollowUpCaseItem[];
  onOpenCase?: (student: AttendanceStudent, reason: string, priority: "low" | "medium" | "high") => void;
  onUpdateCaseStatus?: (caseId: number, status: "open" | "in_review" | "resolved") => void;
  onAddCaseNote?: (caseId: number, note: string) => void;
  caseHistoryNotes?: AttendanceFollowUpNoteItem[];
  isOpeningCase?: boolean;
  isAddingNote?: boolean;
  justifications?: AttendanceJustificationItem[];
  onResolveJustification?: (justificationId: number, status: "approved" | "unjustified" | "rejected", resolutionNotes: string) => void;
  /** Texto del periodo para la ficha impresa. */
  academicPeriodLabel?: string;
  schoolLogoUrl?: string;
  schoolName?: string;
}

const TABS: Array<{ id: StudentRecordTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "attendance", label: "Asistencia" },
  { id: "justifications", label: "Excusas" },
  { id: "follow_up", label: "Seguimiento" },
];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export const StudentFullRecordModal: React.FC<StudentFullRecordModalProps> = ({
  isOpen,
  onClose,
  student,
  course,
  days,
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
  isAddingNote = false,
  justifications = [],
  onResolveJustification,
  academicPeriodLabel,
  schoolLogoUrl,
  schoolName,
}) => {
  const [activeTab, setActiveTab] = useState<StudentRecordTab>(initialTab);
  const [selectedJustificationId, setSelectedJustificationId] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  useEffect(() => setActiveTab(initialTab), [initialTab]);
  useEffect(() => setSelectedJustificationId(null), [student.id]);

  // Foco: entra al diálogo al abrir y vuelve al disparador al cerrar.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, [isOpen]);

  // Bloqueo de scroll y clase usada por los estilos de impresión A4.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("student-dossier-modal-open");
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("student-dossier-modal-open");
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || event.defaultPrevented) return;
    // Un visor u otro diálogo abierto encima tiene prioridad.
    const modals = document.querySelectorAll('[aria-modal="true"]');
    if (modals[modals.length - 1] !== dialog) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if ((event.altKey || event.ctrlKey) && !isTypingTarget(event.target) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      (event.key === "ArrowLeft" ? onPrevStudent : onNextStudent)?.();
    } else if (event.key === "Tab") {
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, [onClose, onNextStudent, onPrevStudent]);

  const studentCases = useMemo(
    () => followUpCases.filter(item => String(item.studentId) === String(student.id)),
    [followUpCases, student.id],
  );
  const activeCase = useMemo(() => studentCases.find(item => item.status !== "resolved"), [studentCases]);
  const resolvedCases = useMemo(() => studentCases.filter(item => item.status === "resolved"), [studentCases]);
  const caseNotes = useMemo(
    () => (activeCase ? caseHistoryNotes.filter(note => note.caseId === activeCase.id) : []),
    [activeCase, caseHistoryNotes],
  );

  const studentJustifications = useMemo(
    () => justifications
      .filter(item => String(item.studentId) === String(student.id))
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
    [justifications, student.id],
  );
  const openJustifications = useMemo(
    () => studentJustifications.filter(item => OPEN_JUSTIFICATION_STATUSES.includes(item.status)),
    [studentJustifications],
  );
  const justificationIdByDate = useMemo(
    () => new Map(studentJustifications.map(item => [item.attendanceDate, item.id])),
    [studentJustifications],
  );
  const justificationDates = useMemo(() => new Set(justificationIdByDate.keys()), [justificationIdByDate]);

  const stats = useMemo(() => computeRecordStats(student.id, days, getStatus), [days, getStatus, student.id]);
  const recordedDays = useMemo(
    () => days.filter(day => getStatus(student.id, day.iso) !== "pending"),
    [days, getStatus, student.id],
  );
  const pattern = useMemo(
    () => analyzeStudentPattern(student, days, getStatus, activeCase ? [activeCase] : []),
    [activeCase, days, getStatus, student],
  );

  // Insumos de la ficha imprimible (siempre montada para que `window.print()` la encuentre).
  const printStats = useMemo(() => calculateHistoryStats(student.id, days, getStatus), [days, getStatus, student.id]);
  const printTimeline = useMemo(
    () => buildStudentTimeline({
      studentId: student.id,
      course,
      days,
      getStatus,
      justifications: studentJustifications,
      cases: studentCases,
      notes: caseNotes,
    }),
    [caseNotes, course, days, getStatus, student.id, studentCases, studentJustifications],
  );

  const openJustification = useCallback((id: number) => {
    setSelectedJustificationId(id);
    setActiveTab("justifications");
  }, []);

  if (!isOpen || typeof document === "undefined") return null;

  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);
  const tabBadge = (id: StudentRecordTab) => {
    if (id === "justifications" && openJustifications.length > 0) return String(openJustifications.length);
    if (id === "follow_up" && activeCase) return "Activo";
    return null;
  };
  const moveTab = (delta: number) => {
    const next = (activeIndex + delta + TABS.length) % TABS.length;
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalStudents - 1;
  const showStatus = student.academicStatus && student.academicStatus.toLowerCase() !== "activo";

  return createPortal(
    <div className="student-record-portal-dialog fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] animate-in fade-in duration-150 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="record-dialog print:hidden"
      >
        <header className="record-header">
          {student.avatar ? (
            <img src={student.avatar} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="record-avatar" aria-hidden="true">{initialsOf(student.name)}</span>
          )}
          <div className="min-w-[180px] flex-1">
            <h2 id={`${baseId}-title`} className="truncate font-display text-lg font-semibold tracking-tight">
              {student.name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>{course.label} · {course.subject}</span>
              {student.code ? <span className="tabular-nums">· {student.code}</span> : null}
              {showStatus ? (
                <span className="rounded-full bg-st-late/14 px-2 py-0.5 text-xs font-semibold text-st-late">{student.academicStatus}</span>
              ) : null}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => window.print()} className="record-icon-button" aria-label="Imprimir ficha" title="Imprimir ficha">
              <Printer className="h-4 w-4" aria-hidden="true" />
            </button>
            {totalStudents > 1 ? (
              <div className="record-stepper" role="group" aria-label="Cambiar de estudiante">
                <button type="button" onClick={onPrevStudent} disabled={isFirst} aria-label="Estudiante anterior" title="Anterior · Ctrl + ←">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="tabular-nums" aria-live="polite">{currentIndex + 1} de {totalStudents}</span>
                <button type="button" onClick={onNextStudent} disabled={isLast} aria-label="Estudiante siguiente" title="Siguiente · Ctrl + →">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <button type="button" onClick={onClose} className="record-icon-button" aria-label="Cerrar expediente" title="Cerrar · Esc">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* role=tablist y no <nav>: los estilos globales de `nav button` de otros módulos no deben alcanzarlo. */}
        <div
          role="tablist"
          aria-label="Secciones del expediente"
          className="record-tabs"
          onKeyDown={event => {
            if (event.key === "ArrowRight") { event.preventDefault(); moveTab(1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(-1); }
          }}
        >
          {TABS.map((tab, index) => {
            const selected = tab.id === activeTab;
            const badge = tabBadge(tab.id);
            return (
              <button
                key={tab.id}
                ref={element => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={cn("record-tab", selected && "is-active")}
              >
                {tab.label}
                {badge ? <span className="record-tab-badge">{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <main
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeTab}`}
          className="record-body scroll-thin"
        >
          <div className="mx-auto max-w-5xl">
            {activeTab === "summary" ? (
              <SummaryTab
                student={student}
                stats={stats}
                recordedDays={recordedDays}
                getStatus={getStatus}
                pattern={pattern}
                activeCase={activeCase}
                openJustifications={openJustifications}
                justificationDates={justificationDates}
                onNavigate={setActiveTab}
              />
            ) : activeTab === "attendance" ? (
              <AttendanceTab
                studentId={student.id}
                days={days}
                stats={stats}
                getStatus={getStatus}
                onSetStatus={onSetStatus}
                justificationIdByDate={justificationIdByDate}
                onOpenJustification={openJustification}
              />
            ) : activeTab === "justifications" ? (
              <JustificationsTab
                studentName={student.name}
                justifications={studentJustifications}
                selectedId={selectedJustificationId}
                onSelect={setSelectedJustificationId}
                onResolve={onResolveJustification}
              />
            ) : (
              <FollowUpTab
                activeCase={activeCase}
                resolvedCases={resolvedCases}
                notes={caseNotes}
                suggestedReason={stats.recorded >= 3 && pattern.hasNegativePattern ? capitalize(pattern.headline) : undefined}
                onOpenCase={onOpenCase ? (reason, priority) => onOpenCase(student, reason, priority) : undefined}
                onUpdateCaseStatus={onUpdateCaseStatus}
                onAddNote={onAddCaseNote}
                isOpeningCase={isOpeningCase}
                isAddingNote={isAddingNote}
              />
            )}
          </div>
        </main>
      </div>

      {/* Ficha A4: independiente de la pestaña activa, solo visible al imprimir. */}
      <div className="hidden w-full print:block">
        <StudentDossierPrintView
          student={student}
          course={course}
          periodStats={printStats}
          patternAnalysis={pattern}
          studentJustifications={studentJustifications}
          studentActiveCase={activeCase}
          resolvedCases={resolvedCases}
          currentCaseNotes={caseNotes}
          unifiedTimeline={printTimeline}
          days={days}
          getStatus={getStatus}
          academicPeriod={academicPeriodLabel}
          schoolLogoUrl={schoolLogoUrl}
          schoolName={schoolName}
        />
      </div>
    </div>,
    document.body,
  );
};

export default StudentFullRecordModal;

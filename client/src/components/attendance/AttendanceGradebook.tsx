import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Info,
  Keyboard,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
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
  normalizeDateIso,
} from "./types";
import {
  analyzeGroupPatterns,
  analyzeStudentPattern,
  StudentPatternAnalysis,
} from "./intelligence";
import { StudentAttendancePopover } from "./StudentAttendancePopover";
import { StudentFullRecordModal } from "./StudentFullRecordModal";
import { JustificationModal } from "./JustificationModal";
import { StudentRecordTab } from "./types";

interface UndoItem {
  type: "single" | "batch";
  date: string;
  studentId?: string;
  studentName?: string;
  previousStatus?: AttendanceStatus;
  previousStatuses?: Record<string, AttendanceStatus>;
  label: string;
}

interface AttendanceGradebookProps {
  courses: AttendanceCourse[];
  selectedCourseId: string;
  onSelectCourseId: (id: string) => void;
  days: AttendanceDay[];
  selectedDateIndex: number;
  onSelectDateIndex: (index: number) => void;
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  onSetStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  onMarkAll: (status: AttendanceStatus) => void;
  onCompletePending: () => void;
  onBackToCourses: () => void;
  onSwitchToQuick?: () => void;
  onNavigateToGradeCenter?: (courseId: string, studentId: string) => void;
  // Follow-up cases
  followUpCases: AttendanceFollowUpCaseItem[];
  onOpenCase: (student: AttendanceStudent, reason: string, priority: "low" | "medium" | "high") => void;
  onUpdateCaseStatus: (caseId: number, status: "open" | "in_review" | "resolved") => void;
  onAddCaseNote: (caseId: number, note: string) => void;
  activeCaseHistoryNotes: AttendanceFollowUpNoteItem[];
  isOpeningCase?: boolean;
  isUpdatingCase?: boolean;
  isAddingNote?: boolean;
  onSelectActiveCaseId?: (caseId: number | null) => void;
  isSaving?: boolean;
  // Excusas / Justificaciones
  justifications?: AttendanceJustificationItem[];
  onRecordPhysicalReceipt?: (justificationId: number, receivedByName: string, notes?: string) => void;
  onEscalateJustification?: (justificationId: number, coordinationNotes: string) => void;
  onResolveJustification?: (justificationId: number, status: "approved" | "unjustified" | "rejected", resolutionNotes: string) => void;
  onSubmitJustification?: (data: any) => void;
  // Identidad institucional
  schoolLogoUrl?: string;
  schoolName?: string;
}

export const AttendanceGradebook: React.FC<AttendanceGradebookProps> = ({
  courses,
  selectedCourseId,
  onSelectCourseId,
  days,
  selectedDateIndex,
  onSelectDateIndex,
  getStatus,
  onSetStatus,
  onMarkAll,
  onCompletePending,
  onBackToCourses,
  onSwitchToQuick,
  onNavigateToGradeCenter,
  followUpCases,
  onOpenCase,
  onUpdateCaseStatus,
  onAddCaseNote,
  activeCaseHistoryNotes,
  isOpeningCase = false,
  isUpdatingCase = false,
  isAddingNote = false,
  onSelectActiveCaseId,
  isSaving = false,
  justifications = [],
  onRecordPhysicalReceipt,
  onEscalateJustification,
  onResolveJustification,
  onSubmitJustification,
  schoolLogoUrl,
  schoolName,
}) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "problems">("all");
  const [selectedStudent, setSelectedStudent] = useState<AttendanceStudent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    days[selectedDateIndex]?.iso || days[days.length - 1]?.iso || "2026-09-19"
  );
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [showShortcutPopover, setShowShortcutPopover] = useState(false);
  const [isExpandedTable, setIsExpandedTable] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [isJustificationDrawerOpen, setIsJustificationDrawerOpen] = useState(false);
  const [activeJustificationId, setActiveJustificationId] = useState<number | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordModalInitialTab, setRecordModalInitialTab] = useState<StudentRecordTab>("summary");

  const pendingJustificationsCount = useMemo(() => {
    return justifications.filter((j) =>
      ["submitted", "pending_physical_support", "in_review", "scheduled_absence"].includes(j.status)
    ).length;
  }, [justifications]);

  const toggleProblemsFilter = () => {
    setFilter((prev) => (prev === "problems" ? "all" : "problems"));
  };

  const togglePendingFilter = () => {
    setFilter((prev) => (prev === "pending" ? "all" : "pending"));
  };

  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const course = courses.find((c) => c.id === selectedCourseId) ?? courses[0];
  const currentDate = days[selectedDateIndex] ?? days[days.length - 1];

  // Current course index & next course calculation
  const currentCourseIdx = courses.findIndex((c) => c.id === selectedCourseId);
  const nextCourse = courses.length > 1 ? courses[(currentCourseIdx + 1) % courses.length] : null;

  // Check if current system time matches the class schedule
  const isClassActiveNow = useMemo(() => {
    if (!course.time) return false;
    try {
      const parts = course.time.split(/–|-/).map((s) => s.trim());
      if (parts.length !== 2) return false;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [h1, m1] = parts[0].split(":").map(Number);
      const [h2, m2] = parts[1].split(":").map(Number);
      const startMinutes = h1 * 60 + (m1 || 0);
      const endMinutes = h2 * 60 + (m2 || 0);

      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch {
      return false;
    }
  }, [course.time]);

  // Pre-calculate student pattern analyses for all students in the course
  const studentAnalysesMap = useMemo(() => {
    const map = new Map<string, StudentPatternAnalysis>();
    course.students.forEach((s) => {
      map.set(s.id, analyzeStudentPattern(s, days, getStatus, followUpCases));
    });
    return map;
  }, [course.students, days, getStatus, followUpCases]);

  // Contextual group pattern reading
  const groupAnalysis = useMemo(() => {
    return analyzeGroupPatterns(course.students, days, currentDate.iso, getStatus, followUpCases);
  }, [course.students, days, currentDate.iso, getStatus, followUpCases]);

  // Attention students: ONLY students with verified negative patterns
  const attentionStudents = useMemo(() => {
    return course.students
      .filter((s) => {
        const analysis = studentAnalysesMap.get(s.id);
        return analysis?.hasNegativePattern === true;
      })
      .sort((a, b) => {
        const weightA = studentAnalysesMap.get(a.id)?.priorityWeight ?? 0;
        const weightB = studentAnalysesMap.get(b.id)?.priorityWeight ?? 0;
        return weightB - weightA;
      })
      .slice(0, 8);
  }, [course.students, studentAnalysesMap]);

  const studentsAttentionCount = useMemo(() => {
    return course.students.filter((s) => {
      const analysis = studentAnalysesMap.get(s.id);
      return analysis?.hasNegativePattern === true;
    }).length;
  }, [course.students, studentAnalysesMap]);

  // Backward-compatible reason generator
  const getAttentionReasons = (student: AttendanceStudent): string[] => {
    const analysis = studentAnalysesMap.get(student.id);
    if (!analysis || analysis.severity === "normal") {
      return ["requiere revisión preventiva"];
    }
    return [analysis.headline];
  };

  const handleAttentionStudentClick = (student: AttendanceStudent) => {
    setActiveStudentId(student.id);
    const el = document.getElementById(`attendance-row-${student.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    handleSelectStudent(student, currentDate.iso);
  };

  // Current date status counts
  const currentCounts = useMemo(() => {
    return course.students.reduce(
      (acc, s) => {
        const status = getStatus(s.id, currentDate.iso);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { pending: 0, present: 0, absent: 0, late: 0, excused: 0 } as Record<AttendanceStatus, number>
    );
  }, [course.students, currentDate.iso, getStatus]);

  const allRecorded = currentCounts.pending === 0;

  // Overall attendance %
  const coursePresence = useMemo(() => {
    if (!course.students.length || !days.length) return 0;
    const totalPresent = course.students.reduce(
      (tot, s) =>
        tot +
        days.reduce((sum, d) => sum + (getStatus(s.id, d.iso) === "present" ? 1 : 0), 0) /
          days.length,
      0
    );
    return Math.round((totalPresent / course.students.length) * 100);
  }, [course.students, days, getStatus]);

  // Filtered rows for the table
  const rows = useMemo(() => {
    return course.students.filter((student) => {
      const matches = `${student.name} ${student.code}`.toLowerCase().includes(query.toLowerCase());
      const current = getStatus(student.id, currentDate.iso);
      const hasNegativePattern = studentAnalysesMap.get(student.id)?.hasNegativePattern === true;

      return (
        matches &&
        (filter === "all" ||
          (filter === "pending" && current === "pending") ||
          (filter === "problems" && hasNegativePattern))
      );
    });
  }, [course.students, query, filter, currentDate.iso, getStatus, studentAnalysesMap]);

  // Default active student to first in rows if not set or out of filter
  useEffect(() => {
    if (!rows.length) {
      setActiveStudentId(null);
    } else if (!activeStudentId || !rows.some((r) => r.id === activeStudentId)) {
      setActiveStudentId(rows[0].id);
    }
  }, [rows, activeStudentId]);

  // Sync selectedDate with currentDate
  useEffect(() => {
    if (days[selectedDateIndex]) {
      setSelectedDate(days[selectedDateIndex].iso);
    }
  }, [selectedDateIndex, days]);

  // Paginated window for top date bar (keeps max 6 buttons without horizontal crowding)
  const visibleDateIndices = useMemo(() => {
    if (days.length <= 7) return days.map((_, i) => i);
    const windowSize = 6;
    let start = Math.max(0, Math.min(selectedDateIndex - 2, days.length - windowSize));
    if (selectedDateIndex >= days.length - windowSize) {
      start = days.length - windowSize;
    }
    return Array.from({ length: Math.min(windowSize, days.length) }, (_, i) => start + i);
  }, [days.length, selectedDateIndex]);

  const moveToNextStudent = (currentId: string) => {
    const idx = rows.findIndex((s) => s.id === currentId);
    if (idx !== -1 && idx < rows.length - 1) {
      const nextId = rows[idx + 1].id;
      setActiveStudentId(nextId);
      const el = document.getElementById(`attendance-row-${nextId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const moveToPrevStudent = (currentId: string) => {
    const idx = rows.findIndex((s) => s.id === currentId);
    if (idx > 0) {
      const prevId = rows[idx - 1].id;
      setActiveStudentId(prevId);
      const el = document.getElementById(`attendance-row-${prevId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const moveToNextPendingStudent = (currentId: string) => {
    const currentIdx = rows.findIndex((s) => s.id === currentId);
    for (let i = currentIdx + 1; i < rows.length; i++) {
      if (getStatus(rows[i].id, currentDate.iso) === "pending") {
        setActiveStudentId(rows[i].id);
        const el = document.getElementById(`attendance-row-${rows[i].id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
    }
    for (let i = 0; i <= currentIdx; i++) {
      if (getStatus(rows[i].id, currentDate.iso) === "pending") {
        setActiveStudentId(rows[i].id);
        const el = document.getElementById(`attendance-row-${rows[i].id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
    }
    return false;
  };

  const moveToPrevPendingStudent = (currentId: string) => {
    const currentIdx = rows.findIndex((s) => s.id === currentId);
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (getStatus(rows[i].id, currentDate.iso) === "pending") {
        setActiveStudentId(rows[i].id);
        const el = document.getElementById(`attendance-row-${rows[i].id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
    }
    for (let i = rows.length - 1; i >= currentIdx; i--) {
      if (getStatus(rows[i].id, currentDate.iso) === "pending") {
        setActiveStudentId(rows[i].id);
        const el = document.getElementById(`attendance-row-${rows[i].id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
    }
    return false;
  };

  const handleSetStatusWithUndo = (
    studentId: string,
    date: string,
    newStatus: AttendanceStatus
  ) => {
    const prevStatus = getStatus(studentId, date);
    if (prevStatus === newStatus) return;

    const targetStudent = course.students.find((s) => s.id === studentId);
    setUndoStack((prev) => [
      ...prev.slice(-20),
      {
        type: "single",
        date,
        studentId,
        studentName: targetStudent?.name || "Estudiante",
        previousStatus: prevStatus,
        label: `${targetStudent?.name || "Estudiante"}: ${STATUS_META[newStatus].label}`,
      },
    ]);

    onSetStatus(studentId, date, newStatus);
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    if (lastAction.type === "single" && lastAction.studentId && lastAction.previousStatus) {
      onSetStatus(lastAction.studentId, lastAction.date, lastAction.previousStatus);
      setActiveStudentId(lastAction.studentId);
      const el = document.getElementById(`attendance-row-${lastAction.studentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      toast.info(
        `Deshecho: ${lastAction.studentName} restaurado a ${STATUS_META[lastAction.previousStatus].label}`
      );
    } else if (lastAction.type === "batch" && lastAction.previousStatuses) {
      Object.entries(lastAction.previousStatuses).forEach(([sId, st]) => {
        onSetStatus(sId, lastAction.date, st);
      });
      toast.info("Deshecho: estados anteriores restaurados.");
    }
  };

  // Keyboard navigation & direct key shortcuts (P, A, T, E, Enter, Backspace, Tab, Ctrl+Z, ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't capture when typing in inputs or when the student detail drawer is open
      const target = event.target as HTMLElement | null;
      if (
        selectedStudent !== null ||
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        !rows.length
      ) {
        return;
      }

      // Undo shortcut: Ctrl+Z or Cmd+Z
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
        return;
      }

      const currentTargetId = activeStudentId ?? rows[0]?.id;
      if (!currentTargetId) return;

      // Tab navigation for pending students
      if (event.key === "Tab") {
        event.preventDefault();
        if (event.shiftKey) {
          const moved = moveToPrevPendingStudent(currentTargetId);
          if (!moved) moveToPrevStudent(currentTargetId);
        } else {
          const moved = moveToNextPendingStudent(currentTargetId);
          if (!moved) moveToNextStudent(currentTargetId);
        }
        return;
      }

      // Backspace / Delete: reset to pending
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        handleSetStatusWithUndo(currentTargetId, currentDate.iso, "pending");
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveToNextStudent(currentTargetId);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveToPrevStudent(currentTargetId);
        return;
      }

      const keyStatusMap: Record<string, AttendanceStatus | undefined> = {
        p: "present",
        a: "absent",
        t: "late",
        e: "excused",
      };

      const pressedKey = event.key.toLowerCase();
      const nextStatus = keyStatusMap[pressedKey];

      if (nextStatus) {
        event.preventDefault();
        handleSetStatusWithUndo(currentTargetId, currentDate.iso, nextStatus);
        moveToNextStudent(currentTargetId);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleSetStatusWithUndo(currentTargetId, currentDate.iso, "present");
        moveToNextStudent(currentTargetId);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStudentId, rows, selectedStudent, currentDate.iso, onSetStatus, undoStack]);

  const handleSelectStudent = (student: AttendanceStudent, date?: string) => {
    setSelectedStudent(student);
    if (date) setSelectedDate(date);
    else setSelectedDate(currentDate.iso);

    const existingCase = followUpCases.find(
      (c) => String(c.studentId) === String(student.id) && c.status !== "resolved"
    );
    if (onSelectActiveCaseId) {
      onSelectActiveCaseId(existingCase ? existingCase.id : null);
    }
  };

  const handleNextStudent = () => {
    if (!selectedStudent || !rows.length) return;
    const idx = rows.findIndex((s) => s.id === selectedStudent.id);
    const nextIdx = idx === -1 || idx === rows.length - 1 ? 0 : idx + 1;
    handleSelectStudent(rows[nextIdx], currentDate.iso);
  };

  const handlePrevStudent = () => {
    if (!selectedStudent || !rows.length) return;
    const idx = rows.findIndex((s) => s.id === selectedStudent.id);
    const prevIdx = idx <= 0 ? rows.length - 1 : idx - 1;
    handleSelectStudent(rows[prevIdx], currentDate.iso);
  };

  const selectedStudentIndex = useMemo(() => {
    if (!selectedStudent) return 0;
    return rows.findIndex((s) => s.id === selectedStudent.id);
  }, [rows, selectedStudent]);

  // Direct 1-click Todos presentes with Undo
  const handleMarkAllDirect = () => {
    const snapshot: Record<string, AttendanceStatus> = {};
    course.students.forEach((s) => {
      snapshot[s.id] = getStatus(s.id, currentDate.iso);
    });

    onMarkAll("present");

    setUndoStack((prev) => [
      ...prev.slice(-20),
      {
        type: "batch",
        date: currentDate.iso,
        previousStatuses: snapshot,
        label: "Todos presentes",
      },
    ]);

    if (rows.length > 0) {
      setActiveStudentId(rows[0].id);
    }

    toast.success(`Todos los estudiantes (${course.students.length}) marcados presentes`, {
      duration: 4500,
      action: {
        label: "Deshacer",
        onClick: handleUndo,
      },
    });
  };

  // Complete pending with Undo
  const handleCompletePendingWithUndo = () => {
    const snapshot: Record<string, AttendanceStatus> = {};
    const pendingStudents = course.students.filter(
      (s) => getStatus(s.id, currentDate.iso) === "pending"
    );
    if (!pendingStudents.length) {
      toast.info("No hay estudiantes pendientes en esta fecha.");
      return;
    }
    pendingStudents.forEach((s) => {
      snapshot[s.id] = "pending";
    });

    onCompletePending();

    setUndoStack((prev) => [
      ...prev.slice(-20),
      {
        type: "batch",
        date: currentDate.iso,
        previousStatuses: snapshot,
        label: `Completar pendientes (${pendingStudents.length})`,
      },
    ]);

    toast.success(`${pendingStudents.length} pendientes completados como presentes`, {
      duration: 4500,
      action: {
        label: "Deshacer",
        onClick: handleUndo,
      },
    });
  };

  // Detect if an absence on a given day is part of a consecutive streak
  const getConsecutiveAbsencesForDay = (studentId: string, dayIndex: number) => {
    const currentStatus = getStatus(studentId, days[dayIndex].iso);
    if (currentStatus !== "absent") return false;

    const prevIsAbsent = dayIndex > 0 && getStatus(studentId, days[dayIndex - 1].iso) === "absent";
    const nextIsAbsent = dayIndex < days.length - 1 && getStatus(studentId, days[dayIndex + 1].iso) === "absent";

    return prevIsAbsent || nextIsAbsent;
  };

  // Find active follow up case for selected student
  const activeStudentCase = selectedStudent
    ? followUpCases.find((c) => String(c.studentId) === String(selectedStudent.id) && c.status !== "resolved")
    : undefined;

  return (
    <div className="attendance-gradebook space-y-3 font-sans">
      {/* 1. Executive Top Control Center (Sticky for permanent zero-scroll access) */}
      <header className="sticky top-2 z-20 rounded-2xl border border-slate-200/80 bg-white/95 p-3 sm:px-5 sm:py-3 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-md space-y-2.5">
        {/* Row 1: Dominant Class Context + Grouped Attendance Actions */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          {/* Dominant Class Context */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Secondary Cursos back button */}
            <button
              type="button"
              onClick={onBackToCourses}
              title="Volver a lista de cursos"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 shadow-2xs"
            >
              <ArrowLeft className="h-3 w-3 text-slate-400" />
              <span className="hidden sm:inline">Cursos</span>
            </button>

            <span className="h-4 w-px bg-slate-200" />

            {/* Dominant Course Selector */}
            <div className="relative inline-flex items-center min-w-0">
              <select
                aria-label="Curso activo para toma de asistencia"
                value={selectedCourseId}
                onChange={(e) => {
                  onSelectCourseId(e.target.value);
                  setSelectedStudent(null);
                }}
                className="cursor-pointer appearance-none bg-transparent pr-7 text-base sm:text-lg font-black tracking-tight text-slate-900 transition hover:text-indigo-950 focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {c.subject}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 h-4 w-4 text-slate-400" />
            </div>

            {/* Room & Time Pill / Live Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium pl-1">
              <span className="rounded-md bg-slate-100/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {course.room}
              </span>
              <span className="text-slate-300">·</span>

              {isClassActiveNow ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/70 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  En clase ahora
                </span>
              ) : (
                <span className="text-slate-500">{course.time}</span>
              )}
            </div>
          </div>

          {/* Grouped Attendance Actions + Next Class Link */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
            {/* Quick jump to next course if available */}
            {nextCourse && nextCourse.id !== selectedCourseId && (
              <button
                type="button"
                onClick={() => {
                  onSelectCourseId(nextCourse.id);
                  setSelectedStudent(null);
                }}
                title={`Saltar a la siguiente clase: ${nextCourse.label} · ${nextCourse.subject}`}
                className="hidden xl:inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition shadow-2xs mr-1"
              >
                <span className="text-indigo-400 font-normal">Siguiente:</span>
                <span>{nextCourse.label}</span>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
              </button>
            )}

            {/* Dedicated Undo Button (visible whenever there is an action to undo) */}
            {undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                title="Deshacer último cambio (Ctrl+Z)"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>Deshacer</span>
                <kbd className="hidden sm:inline-block rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-400">
                  Ctrl+Z
                </kbd>
              </button>
            )}

            {/* Contextual Action: Complete Pending */}
            {currentCounts.pending > 0 && (
              <button
                type="button"
                onClick={handleCompletePendingWithUndo}
                title="Completar los pendientes de esta fecha como presentes"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 hover:border-indigo-300 shadow-2xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Completar pendientes ({currentCounts.pending})</span>
              </button>
            )}

            {/* Mass Action: Todos presentes in 1 direct click */}
            <button
              type="button"
              onClick={handleMarkAllDirect}
              title="Marcar todos los estudiantes como presentes en 1 solo clic (con opción de deshacer)"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-98"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Todos presentes</span>
            </button>

            {/* Discreet Entry: Justificaciones y Excusas */}
            <button
              type="button"
              onClick={() => {
                setActiveJustificationId(null);
                setIsJustificationDrawerOpen(true);
              }}
              title="Consultar y revisar justificaciones y soportes de inasistencias del curso"
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition shadow-2xs ${
                pendingJustificationsCount > 0
                  ? "border-blue-300 bg-blue-50/90 text-blue-800 hover:bg-blue-100 hover:border-blue-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Excusas</span>
              {pendingJustificationsCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {pendingJustificationsCount}
                </span>
              )}
            </button>

            {/* Completed state indicator when all registered */}
            {currentCounts.pending === 0 && (
              <span className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-2.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Al día ({course.students.length}/{course.students.length})</span>
              </span>
            )}

            {/* Real-time Save Status */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium pl-1 text-slate-500" title="Los cambios se guardan automáticamente en el servidor">
              {isSaving ? (
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Guardando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <Check className="h-3 w-3 text-emerald-600" />
                  Guardado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Integrated Date Bar + Compact Unified Metric Strip & Actionable Alerts */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 lg:flex-row lg:items-center lg:justify-between">
          {/* Integrated Date Navigation Bar */}
          <div className="flex items-center gap-1 self-start">
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/70 p-0.5 shadow-2xs backdrop-blur-xs">
              <button
                type="button"
                aria-label="Día anterior"
                disabled={selectedDateIndex <= 0}
                onClick={() => onSelectDateIndex(Math.max(0, selectedDateIndex - 1))}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-0.5 px-0.5">
                {visibleDateIndices.map((idx) => {
                  const day = days[idx];
                  const isSelected = selectedDateIndex === idx;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => onSelectDateIndex(idx)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-2xs scale-102"
                          : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-label="Día siguiente"
                disabled={selectedDateIndex >= days.length - 1}
                onClick={() => onSelectDateIndex(Math.min(days.length - 1, selectedDateIndex + 1))}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Unified Compact Metric Band */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-600">
            <span>
              Total <strong className="font-bold text-slate-900">{course.students.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <strong>{currentCounts.present}</strong> Presentes
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <strong>{currentCounts.absent}</strong> Ausentes
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <strong>{currentCounts.late}</strong> Tardanzas
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <strong>{currentCounts.excused}</strong> Excusas
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-indigo-950">
              {coursePresence}% Asistencia
            </span>

            {/* Clickable Pending Filter */}
            {currentCounts.pending > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={togglePendingFilter}
                  title={filter === "pending" ? "Quitar filtro de pendientes" : "Filtrar a pendientes"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
                    filter === "pending"
                      ? "bg-amber-500 text-white shadow-2xs scale-102"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>{currentCounts.pending} Pendientes</span>
                  {filter === "pending" && <span className="ml-0.5 text-[9px] opacity-80">✕</span>}
                </button>
              </>
            )}

            {/* Actionable Alert Filter Button */}
            {studentsAttentionCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={toggleProblemsFilter}
                  title={
                    filter === "problems"
                      ? "Quitar filtro de alertas (ver todos)"
                      : "Filtrar tabla a estudiantes que requieren atención"
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
                    filter === "problems"
                      ? "bg-rose-600 text-white shadow-2xs scale-105"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{studentsAttentionCount} en alerta</span>
                  {filter === "problems" && <span className="ml-0.5 text-[9px] opacity-80">✕</span>}
                </button>
              </>
            )}

            {/* Contextual Group Intelligence Chip (rendered only when meaningful) */}
            {groupAnalysis.headline && (
              <>
                <span className="text-slate-300 hidden xl:inline">·</span>
                <span
                  title={groupAnalysis.trendSentence}
                  className="hidden xl:inline-flex items-center gap-1 rounded-full bg-indigo-50/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 border border-indigo-100/90 shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                  <span>{groupAnalysis.headline}</span>
                </span>
              </>
            )}

            {/* Secondary Discreet Keyboard Shortcut Helper */}
            <div className="relative ml-auto lg:ml-2">
              <button
                type="button"
                onClick={() => setShowShortcutPopover((v) => !v)}
                title="Ver atajos de teclado"
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition p-1 rounded-md hover:bg-slate-100"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span className="hidden xl:inline text-[10px] font-medium">Atajos</span>
              </button>

              {showShortcutPopover && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-[11px] text-slate-700 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                    <span>Atajos de teclado</span>
                    <button
                      type="button"
                      onClick={() => setShowShortcutPopover(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 font-medium text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Marcar Presente:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">P / Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Marcar Ausente:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">A</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Marcar Tardanza:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">T</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Marcar Excusa:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">E</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Restablecer Pendiente:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">Backspace</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Saltar a pendientes:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">Tab</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Navegar estudiante:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">↑ / ↓</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Deshacer cambio:</span>
                      <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">Ctrl + Z</kbd>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Prominent Top Alert Banner for Justifications & Excuses (Audit Point 11: Arriba por defecto sin scroll) */}
      {pendingJustificationsCount > 0 && (
        <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/95 via-sky-50/90 to-indigo-50/90 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-blue-950">
                  Bandeja de Justificaciones y Excusas
                </span>
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                  {pendingJustificationsCount} {pendingJustificationsCount === 1 ? "trámite pendiente" : "trámites pendientes"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-blue-800">
                Hay solicitudes de justificación radicadas con constancia digital o soporte físico que requieren tu revisión en este curso.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveJustificationId(null);
              setIsJustificationDrawerOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Revisar Excusas Pendientes</span>
          </button>
        </div>
      )}

      {/* 2. Main Sheet Body + Collapsible Aside */}
      <div
        className={`grid items-start gap-3 transition-all duration-200 ${
          isExpandedTable ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_19rem]"
        }`}
      >
        {/* Unified Table Section */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.035)]">
          {/* Filter, Search Bar & Full-Width Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/40 p-2.5 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar estudiante o código..."
                  className="h-8 w-52 sm:w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    filter === "all"
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Todos ({course.students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("pending")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    filter === "pending"
                      ? "bg-white text-amber-700 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pendientes ({currentCounts.pending})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("problems")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    filter === "problems"
                      ? "bg-white text-rose-700 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Problemas ({studentsAttentionCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
                {rows.length} de {course.students.length} estudiantes
              </span>

              {/* Attention Panel Toggle Button (Secondary) */}
              <button
                type="button"
                onClick={() => setIsExpandedTable((prev) => !prev)}
                title={
                  isExpandedTable
                    ? "Abrir panel lateral de Atención docente"
                    : "Ocultar panel lateral y ver tabla a ancho completo"
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition shadow-2xs ${
                  !isExpandedTable
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : studentsAttentionCount > 0
                    ? "border-rose-200 bg-rose-50/60 text-rose-800 hover:bg-rose-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <AlertTriangle
                  className={`h-3.5 w-3.5 ${
                    studentsAttentionCount > 0 ? "text-rose-600" : "text-slate-400"
                  }`}
                />
                <span>Atención docente</span>
                {studentsAttentionCount > 0 && (
                  <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {studentsAttentionCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Unified High-Density Spreadsheet Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="w-9 px-2.5 py-2 text-center">#</th>
                  <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50/95 px-3 py-2">
                    Estudiante
                  </th>
                  <th className="w-20 px-2 py-2 text-center">
                    Asistencia
                  </th>
                  <th className="w-44 px-2 py-2 text-center">
                    Estado ({currentDate.label})
                  </th>
                  <th className="w-36 px-2 py-2 text-center" title="Historial reciente de asistencia. Clic para ver ficha completa en el Drawer.">
                    Historial
                  </th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef} className="divide-y divide-slate-100">
                {rows.map((student, index) => {
                  const status = getStatus(student.id, currentDate.iso);
                  const isActiveRow = activeStudentId === student.id;

                  const analysis = studentAnalysesMap.get(student.id);

                  return (
                    <tr
                      id={`attendance-row-${student.id}`}
                      key={student.id}
                      onClick={() => setActiveStudentId(student.id)}
                      className={`group transition-all cursor-pointer ${
                        isActiveRow
                          ? "bg-indigo-50/40 border-l-2 border-l-indigo-600 ring-1 ring-inset ring-indigo-500/15"
                          : "hover:bg-slate-50/70 border-l-2 border-l-transparent"
                      }`}
                    >
                      {/* Row Index */}
                      <td className="px-2.5 py-2 text-center text-[11px] font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Student Info with Clickable Name for Ficha */}
                      <td className="sticky left-0 z-[1] bg-white px-3 py-2 group-hover:bg-slate-50/90 transition-colors">
                        <div className="flex items-center gap-2">
                          {student.avatar ? (
                            <img
                              src={student.avatar}
                              alt=""
                              className="h-7 w-7 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                            />
                          ) : (
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-slate-800 ring-1 ring-slate-200"
                              style={{ backgroundColor: student.avatarColor || "#e2e8f0" }}
                            >
                              {student.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStudent(student, currentDate.iso);
                                }}
                                title="Ver ficha e historial del estudiante"
                                className="truncate text-xs font-bold text-slate-900 transition hover:text-indigo-700 text-left"
                              >
                                {student.name}
                              </button>

                              {/* Subtle contextual signal ONLY when student has a genuine negative attendance pattern */}
                              {analysis && analysis.hasNegativePattern && (
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold shrink-0 border ${
                                    analysis.severity === "critical"
                                      ? "bg-rose-50 text-rose-700 border-rose-200/70"
                                      : "bg-amber-50 text-amber-800 border-amber-200/70"
                                  }`}
                                  title={analysis.explanation}
                                >
                                  {analysis.severity === "critical" ? (
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                  ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  )}
                                  <span>
                                    {analysis.negativePatternType === "consecutive_absences"
                                      ? `${analysis.consecutiveAbsences} consec.`
                                      : analysis.negativePatternType === "accumulated_absences"
                                      ? `${analysis.totalAbsencesInPeriod} ausencias`
                                      : analysis.negativePatternType === "recent_spike"
                                      ? "Faltas rec."
                                      : analysis.negativePatternType === "frequent_tardiness"
                                      ? `${analysis.totalLateInPeriod} tardanzas`
                                      : "Baja asist."}
                                  </span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStudent(student, currentDate.iso);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 shrink-0"
                                title="Abrir ficha rápida"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStudent(student, currentDate.iso);
                                  setRecordModalInitialTab("summary");
                                  setIsRecordModalOpen(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 shrink-0"
                                title="Expandir expediente integral"
                              >
                                <Maximize2 className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="block text-[10px] text-slate-400 leading-tight font-mono">
                                {student.code}
                              </span>
                              {(() => {
                                const currentJustification = justifications.find(
                                  (j) =>
                                    j.studentId === student.id &&
                                    normalizeDateIso(j.attendanceDate) === normalizeDateIso(currentDate.iso)
                                );
                                if (!currentJustification) return null;
                                const isScheduled = currentJustification.status === "scheduled_absence";
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveJustificationId(currentJustification.id);
                                      setIsJustificationDrawerOpen(true);
                                    }}
                                    title={
                                      isScheduled
                                        ? `Inasistencia programada con anticipación: ${JUSTIFICATION_REASON_LABELS[currentJustification.reasonCategory]}. Clic para ver solicitud.`
                                        : `Excusa: ${JUSTIFICATION_STATUS_META[currentJustification.status].label} (${JUSTIFICATION_REASON_LABELS[currentJustification.reasonCategory]}). Clic para ver trámite.`
                                    }
                                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold border transition hover:opacity-80 ${
                                      JUSTIFICATION_STATUS_META[currentJustification.status].badge
                                    }`}
                                  >
                                    {isScheduled ? (
                                      <CalendarClock className="h-2.5 w-2.5" />
                                    ) : (
                                      <FileText className="h-2.5 w-2.5" />
                                    )}
                                    <span>{JUSTIFICATION_STATUS_META[currentJustification.status].label}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Overall % Attendance Compact Pill (Coherent with recorded sessions) */}
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            (analysis?.effectiveAttendanceRate ?? student.attendanceRate) >= 90
                              ? "text-emerald-700 bg-emerald-50/90"
                              : (analysis?.effectiveAttendanceRate ?? student.attendanceRate) >= 80
                              ? "text-amber-700 bg-amber-50/90"
                              : "text-rose-700 bg-rose-50 font-black"
                          }`}
                          title={`Asistencia acumulada en periodo: ${analysis?.effectiveAttendanceRate ?? student.attendanceRate}% (${analysis?.totalAbsencesInPeriod ?? student.absencesCount} ausencias)`}
                        >
                          {analysis?.effectiveAttendanceRate ?? student.attendanceRate}%
                        </span>
                      </td>

                      {/* Direct Action Segmented Buttons (P, A, T, E) */}
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 shadow-2xs">
                          {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(
                            (st) => {
                              const isCurrent = status === st;
                              const stMeta = STATUS_META[st];
                              const keyLetter =
                                st === "present"
                                  ? "P"
                                  : st === "absent"
                                  ? "A"
                                  : st === "late"
                                  ? "T"
                                  : "E";

                              const activeStyles =
                                st === "present"
                                  ? "bg-emerald-600 text-white font-black shadow-xs"
                                  : st === "absent"
                                  ? "bg-rose-600 text-white font-black shadow-xs"
                                  : st === "late"
                                  ? "bg-amber-500 text-white font-black shadow-xs"
                                  : "bg-blue-600 text-white font-black shadow-xs";

                              const inactiveHover =
                                st === "present"
                                  ? "hover:text-emerald-700 hover:bg-emerald-50"
                                  : st === "absent"
                                  ? "hover:text-rose-700 hover:bg-rose-50"
                                  : st === "late"
                                  ? "hover:text-amber-700 hover:bg-amber-50"
                                  : "hover:text-blue-700 hover:bg-blue-50";

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  title={`${stMeta.label} (${keyLetter})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetStatusWithUndo(student.id, currentDate.iso, st);
                                    setActiveStudentId(student.id);
                                  }}
                                  className={`h-6 w-7 rounded-md text-[11px] font-bold transition-all ${
                                    isCurrent
                                      ? activeStyles
                                      : `text-slate-500 ${inactiveHover}`
                                  }`}
                                >
                                  {keyLetter}
                                </button>
                              );
                            }
                          )}
                        </div>
                        {(() => {
                          const isScheduled = justifications.some(
                            (j) =>
                              j.studentId === student.id &&
                              normalizeDateIso(j.attendanceDate) === normalizeDateIso(currentDate.iso) &&
                              j.status === "scheduled_absence"
                          );
                          if (!isScheduled) return null;
                          return (
                            <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] font-semibold text-purple-700">
                              <CalendarClock className="w-2.5 h-2.5" />
                              <span>Prevista</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Meaningful History Micro-Strip */}
                      <td
                        className="px-2 py-2 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectStudent(student, currentDate.iso);
                        }}
                        title="Clic para ver historial completo en el Drawer"
                      >
                        <div className="flex items-center justify-center gap-1.5 cursor-pointer py-1 px-1 rounded-lg hover:bg-slate-100/80 transition group/hist">
                          {/* Dots: recent sessions */}
                          <div className="flex items-center gap-0.5">
                            {days.slice(-8).map((day, dIdx) => {
                              const originalIdx = days.length - 8 + dIdx;
                              const effectiveIdx = originalIdx >= 0 ? originalIdx : dIdx;
                              const dayStatus = getStatus(student.id, day.iso);
                              const isConsecutiveAbsent = getConsecutiveAbsencesForDay(
                                student.id,
                                effectiveIdx
                              );

                              return (
                                <span
                                  key={day.iso}
                                  title={`${day.label}: ${STATUS_META[dayStatus].label}${
                                    isConsecutiveAbsent ? " (ausencia consecutiva)" : ""
                                  }`}
                                  className="p-0.5"
                                >
                                  {dayStatus === "absent" && isConsecutiveAbsent ? (
                                    <span className="block h-2.5 w-2.5 rounded-xs bg-rose-600 ring-2 ring-rose-200 shadow-2xs transition group-hover/hist:scale-125" />
                                  ) : dayStatus === "absent" ? (
                                    <span className="block h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-rose-100 transition group-hover/hist:scale-125" />
                                  ) : dayStatus === "present" ? (
                                    <span className="block h-2 w-2 rounded-full bg-emerald-400 transition group-hover/hist:scale-125" />
                                  ) : dayStatus === "late" ? (
                                    <span className="block h-2 w-2 rounded-full bg-amber-400 transition group-hover/hist:scale-125" />
                                  ) : dayStatus === "excused" ? (
                                    <span className="block h-2 w-2 rounded-full bg-blue-400 transition group-hover/hist:scale-125" />
                                  ) : (
                                    <span className="block h-1.5 w-1.5 rounded-full bg-slate-200" />
                                  )}
                                </span>
                              );
                            })}
                          </div>

                          {/* Factual event micro-badges (only if non-present events exist) */}
                          {analysis &&
                            (analysis.totalAbsencesInPeriod > 0 ||
                              analysis.totalLateInPeriod > 0 ||
                              analysis.totalExcusedInPeriod > 0) && (
                              <div className="flex items-center gap-0.5 shrink-0 pl-0.5">
                                {analysis.totalAbsencesInPeriod > 0 && (
                                  <span
                                    title={`${analysis.totalAbsencesInPeriod} inasistencias`}
                                    className="rounded bg-rose-50 px-1 py-0.2 text-[9px] font-bold text-rose-700 border border-rose-200/80"
                                  >
                                    {analysis.totalAbsencesInPeriod}A
                                  </span>
                                )}
                                {analysis.totalLateInPeriod > 0 && (
                                  <span
                                    title={`${analysis.totalLateInPeriod} tardanzas`}
                                    className="rounded bg-amber-50 px-1 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-200/80"
                                  >
                                    {analysis.totalLateInPeriod}T
                                  </span>
                                )}
                                {analysis.totalExcusedInPeriod > 0 && (
                                  <span
                                    title={`${analysis.totalExcusedInPeriod} excusas`}
                                    className="rounded bg-blue-50 px-1 py-0.2 text-[9px] font-bold text-blue-800 border border-blue-200/80"
                                  >
                                    {analysis.totalExcusedInPeriod}E
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                      No se encontraron estudiantes con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Leyenda:</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <strong>P</strong> Presente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <strong>A</strong> Ausente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <strong>T</strong> Tardanza
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <strong>E</strong> Excusa
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-xs bg-rose-600 ring-1 ring-rose-200" />
                Ausencias consecutivas
              </span>
            </div>

            <div className="text-[10px] text-slate-400">
              Navega con <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono">↑ / ↓</kbd>, salta pendientes con <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono">Tab</kbd>, marca con <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono">P / A / T / E</kbd> y deshace con <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono">Ctrl+Z</kbd>
            </div>
          </div>
        </section>

        {/* 3. Aside: Dedicated Teacher Attention Intervention Panel (Collapsible) */}
        {!isExpandedTable && (
          <aside className="space-y-3">
            <section className="rounded-2xl border border-rose-100/90 bg-gradient-to-br from-white to-rose-50/20 p-4 shadow-[0_4px_20px_rgba(244,63,94,0.035)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <h3 className="text-xs font-extrabold text-slate-900">Atención docente</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      studentsAttentionCount > 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {studentsAttentionCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpandedTable(true)}
                    title="Ocultar panel y expandir tabla completa"
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Casos que requieren intervención, ausencias reiteradas o alertas críticas.
              </p>

              <div className="mt-3 space-y-2">
                {attentionStudents.map((student) => {
                  const analysis = studentAnalysesMap.get(student.id);
                  const existingCase = followUpCases.find(
                    (c) => c.studentId === student.id && c.status !== "resolved"
                  );
                  const isSelectedInTable = activeStudentId === student.id;

                  const initials = student.name
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={student.id}
                      onClick={() => handleAttentionStudentClick(student)}
                      title="Clic para enfocar en la tabla y abrir historial"
                      className={`cursor-pointer rounded-xl border p-2.5 transition hover:shadow-2xs ${
                        isSelectedInTable
                          ? "border-indigo-300 bg-indigo-50/60 shadow-2xs"
                          : "border-slate-200/80 bg-white hover:border-rose-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {student.avatar ? (
                            <img
                              src={student.avatar}
                              alt=""
                              className="h-7 w-7 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                            />
                          ) : (
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-slate-800 ring-1 ring-slate-200"
                              style={{ backgroundColor: student.avatarColor || "#e2e8f0" }}
                            >
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 leading-tight">
                              {student.name}
                            </p>
                            <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                              <span className="font-extrabold text-slate-900">
                                {analysis?.effectiveAttendanceRate ?? student.attendanceRate}%
                              </span>
                              <span className="text-slate-300 mx-1">·</span>
                              <span className="text-rose-700 font-semibold">{analysis?.headline}</span>
                            </p>
                          </div>
                        </div>

                        {existingCase && (
                          <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-100">
                            {existingCase.status === "in_review"
                              ? "En revisión"
                              : existingCase.status === "resolved"
                              ? "Resuelto"
                              : "Caso abierto"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!attentionStudents.length && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-emerald-900">
                      Grupo sin patrones de asistencia que requieran atención
                    </p>
                    <p className="mt-0.5 text-[10px] text-emerald-700/80">
                      Todos los estudiantes mantienen una asistencia regular o sin patrones negativos.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsExpandedTable(true)}
                      className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Expandir tabla</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </aside>
        )}
      </div>

      {/* 4. Student Attendance Drawer (Ficha Rápida) */}
      {selectedStudent && !isRecordModalOpen && (
        <StudentAttendancePopover
          student={selectedStudent}
          course={course}
          days={days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          getStatus={getStatus}
          onSetStatus={handleSetStatusWithUndo}
          onClose={() => {
            setSelectedStudent(null);
            setIsRecordModalOpen(false);
          }}
          onOpenFullRecord={(tab) => {
            setRecordModalInitialTab(tab || "summary");
            setIsRecordModalOpen(true);
          }}
          onNextStudent={handleNextStudent}
          onPrevStudent={handlePrevStudent}
          currentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : 0}
          totalStudents={rows.length}
          onNavigateToGradeCenter={onNavigateToGradeCenter}
          activeCase={activeStudentCase}
          onOpenCase={onOpenCase}
          onUpdateCaseStatus={onUpdateCaseStatus}
          onAddCaseNote={onAddCaseNote}
          caseHistoryNotes={activeCaseHistoryNotes}
          isOpeningCase={isOpeningCase}
          isUpdatingCase={isUpdatingCase}
          isAddingNote={isAddingNote}
          justifications={justifications}
          onOpenJustification={(id) => {
            setActiveJustificationId(id);
            setIsJustificationDrawerOpen(true);
          }}
        />
      )}

      {/* 5. Student Full Record Modal (Expediente Integral 360°) */}
      {selectedStudent && isRecordModalOpen && (
        <StudentFullRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => {
            setIsRecordModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          course={course}
          days={days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          getStatus={getStatus}
          onSetStatus={handleSetStatusWithUndo}
          onNextStudent={handleNextStudent}
          onPrevStudent={handlePrevStudent}
          currentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : 0}
          totalStudents={rows.length}
          initialTab={recordModalInitialTab}
          followUpCases={followUpCases}
          onOpenCase={onOpenCase}
          onUpdateCaseStatus={onUpdateCaseStatus}
          onAddCaseNote={onAddCaseNote}
          caseHistoryNotes={activeCaseHistoryNotes}
          isOpeningCase={isOpeningCase}
          isUpdatingCase={isUpdatingCase}
          isAddingNote={isAddingNote}
          justifications={justifications}
          onRecordPhysicalReceipt={onRecordPhysicalReceipt}
          onEscalateJustification={onEscalateJustification}
          onResolveJustification={onResolveJustification}
          onNavigateToGradeCenter={onNavigateToGradeCenter}
          schoolLogoUrl={schoolLogoUrl}
          schoolName={schoolName}
        />
      )}

      {/* 5. Justification & Excuses Administrative Modal */}
      <JustificationModal
        isOpen={isJustificationDrawerOpen}
        onClose={() => setIsJustificationDrawerOpen(false)}
        courseLabel={course.label}
        students={course.students}
        justifications={justifications}
        selectedJustificationId={activeJustificationId}
        onSelectJustificationId={setActiveJustificationId}
        getStatus={getStatus}
        onRecordPhysicalReceipt={(id, receptor, notes) => {
          onRecordPhysicalReceipt?.(id, receptor, notes);
          toast.success("Recepción de soporte físico registrada exitosamente");
        }}
        onEscalateToCoordination={(id, notes) => {
          onEscalateJustification?.(id, notes);
          toast.success("Trámite derivado a coordinación académica");
        }}
        onResolveJustification={(id, status, notes) => {
          onResolveJustification?.(id, status, notes);
          const just = justifications.find((j) => j.id === id);
          if (status === "approved" && just) {
            onSetStatus(just.studentId, just.attendanceDate, "excused");
            toast.success("Justificación aprobada: Asistencia actualizada a 'Excusa'");
          } else if (status === "rejected") {
            toast.info("Excusa rechazada formalmente");
          } else {
            toast.info("Excusa declarada no justificada");
          }
        }}
        onSubmitJustification={onSubmitJustification}
      />
    </div>
  );
};

export default AttendanceGradebook;


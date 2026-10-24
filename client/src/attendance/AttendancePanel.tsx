/**
 * Panel de Asistencia (vista docente).
 *
 * Orquesta encabezado, status rail, toolbar, filtros, planilla y atención
 * docente sobre una única fuente de verdad (`useAttendanceSession`).
 *
 * Flujo pensado para trabajo diario: abrir → elegir clase → tomar asistencia con
 * teclado → detectar → actuar sin salir de la planilla.
 */
import { MotionConfig } from "framer-motion";
import { GraduationCap, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toISODate } from "./data/dateUtils";
import { AttendanceHeader } from "./components/AttendanceHeader";
import { AttendanceSheet } from "./components/AttendanceSheet";
import { AttendanceToolbar } from "./components/AttendanceToolbar";
import { AttentionRail } from "./components/AttentionRail";
import { BulkConfirmDialog, type BulkConfirmRequest } from "./components/BulkConfirmDialog";
import { DaySummaryRail } from "./components/DaySummaryRail";
import { FilterChips } from "./components/FilterChips";
import { ShortcutsSheet } from "./components/ShortcutsSheet";
import { StudentExpediente } from "./components/StudentExpediente";
import { useAttendanceHotkeys } from "./hooks/useAttendanceHotkeys";
import { useAttendanceSession } from "./hooks/useAttendanceSession";
import { STATUS_META } from "./statusMeta";
import {
  attentionFlagsFor,
  classStateFor,
  computeDayMetrics,
  filterCounts,
  filterStudents,
  primaryAttentionFlags,
  progressMessage,
} from "./data/selectors";
import type {
  AttendanceFilter,
  AttendancePanelProps,
  AttendanceStatus,
  Student,
} from "./types";

/** A partir de cuántos registros una acción masiva pide confirmación. */
const BULK_CONFIRM_THRESHOLD = 3;

export function AttendancePanel(props: AttendancePanelProps) {
  // El hook de sesión asume al menos un curso; sin cursos se muestra un estado
  // vacío explícito en lugar de una vista rota.
  if (props.courses.length === 0) {
    return (
      <div
        className={cn(
          "glass flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center",
          props.className,
        )}
      >
        <GraduationCap className="h-7 w-7 text-muted-foreground/70" aria-hidden="true" />
        <p className="text-[13.5px] font-medium">Sin cursos asignados</p>
        <p className="max-w-[320px] text-xs text-muted-foreground">
          Cuando el docente tenga cursos cargados, la jornada de asistencia aparecerá aquí.
        </p>
      </div>
    );
  }

  return <AttendanceSessionView {...props} />;
}

function AttendanceSessionView({
  courses,
  initialCourseId,
  initialDate,
  initialStatuses,
  initialFilter = "all",
  onOpenExpediente,
  onOpenHistory,
  onOpenFollowUp,
  getStudentSummaryProfile,
  onPersist,
  onBackToCourses,
  onFocusModeChange,
  className,
}: AttendancePanelProps) {
  const session = useAttendanceSession({
    courses,
    initialCourseId,
    initialDate,
    initialStatuses,
    onPersist,
  });
  const sessionStatuses = session.statuses;
  const setSessionStatus = session.setStatus;

  const [filter, setFilter] = useState<AttendanceFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<BulkConfirmRequest | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [expedienteStudent, setExpedienteStudent] = useState<Student | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const expedienteFamilyProfile = useMemo(
    () => expedienteStudent ? getStudentSummaryProfile?.(expedienteStudent) : undefined,
    [expedienteStudent, getStudentSummaryProfile],
  );

  const openLocalSummary = useCallback((student: Student) => {
    setOpenPopoverId(null);
    setExpedienteStudent(student);
  }, []);

  const handleOpenExpediente = useCallback((student: Student) => {
    if (onOpenExpediente) {
      setOpenPopoverId(null);
      onOpenExpediente(student);
      return;
    }
    openLocalSummary(student);
  }, [onOpenExpediente, openLocalSummary]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    onFocusModeChange?.(focusMode);
    return () => onFocusModeChange?.(false);
  }, [focusMode, onFocusModeChange]);

  useEffect(() => {
    if (!focusMode) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || openPopoverId || shortcutsOpen || confirmRequest) return;
      const openLayer = document.querySelector(
        '[data-radix-popper-content-wrapper][data-state="open"], [data-radix-popper-content-wrapper] [data-state="open"], [role="dialog"][data-state="open"], [role="menu"][data-state="open"]',
      );
      const target = event.target instanceof Element ? event.target : null;
      if (openLayer || target?.closest("[data-radix-popper-content-wrapper], [role=dialog], [role=menu]")) return;
      event.preventDefault();
      setFocusMode(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [confirmRequest, focusMode, openPopoverId, shortcutsOpen]);

  const course = session.course;
  const classState = useMemo(
    () => classStateFor(course, session.date, clockNow),
    [clockNow, course, session.date],
  );

  const metrics = useMemo(
    () => computeDayMetrics(course.students, session.statuses),
    [course.students, session.statuses],
  );

  const attentionFlags = useMemo(
    () => primaryAttentionFlags(course.students, session.statuses, session.date),
    [course.students, session.date, session.statuses],
  );

  const attentionByStudent = useMemo(() => {
    const map = new Map<string, ReturnType<typeof attentionFlagsFor>>();
    for (const student of course.students) {
      map.set(
        student.id,
        attentionFlagsFor(student, session.statuses[student.id] ?? "pending", session.date),
      );
    }
    return map;
  }, [course.students, session.date, session.statuses]);

  const attentionIds = useMemo(
    () => new Set(attentionFlags.map(flag => flag.studentId)),
    [attentionFlags],
  );

  const studentsById = useMemo(
    () => new Map(course.students.map(student => [student.id, student])),
    [course.students],
  );

  const visibleStudents = useMemo(
    () =>
      filterStudents(
        course.students,
        session.statuses,
        filter,
        query,
        attentionIds,
        session.date,
      ),
    [attentionIds, course.students, filter, query, session.date, session.statuses],
  );

  const visiblePendingCount = useMemo(
    () => visibleStudents.reduce(
      (count, student) => count + ((session.statuses[student.id] ?? "pending") === "pending" ? 1 : 0),
      0,
    ),
    [session.statuses, visibleStudents],
  );

  const counts = useMemo(
    () => filterCounts(course.students, session.statuses, attentionIds),
    [attentionIds, course.students, session.statuses],
  );

  /**
   * Foco de fila. `dom` mueve además el foco real del navegador, de modo que
   * Tab / ⇧Tab continúen desde la fila correcta al salir de la planilla.
   */
  const focusStudent = useCallback((studentId: string, options?: { dom?: boolean }) => {
    setFocusedId(studentId);
    window.requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-student-id="${studentId}"]`);
      if (!element) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      if (options?.dom) element.focus({ preventScroll: true });
    });
  }, []);

  const currentStudent: Student | undefined = useMemo(() => {
    const focused = visibleStudents.find(student => student.id === focusedId);
    return focused ?? visibleStudents[0];
  }, [focusedId, visibleStudents]);

  const statusLabel = useCallback(
    (studentId: string, status: AttendanceStatus) =>
      `${studentsById.get(studentId)?.fullName ?? "Estudiante"} · ${STATUS_META[status].label}`,
    [studentsById],
  );

  const registerStudentStatus = useCallback(
    (studentId: string, status: AttendanceStatus, advance = false) => {
      const previous = sessionStatuses[studentId] ?? "pending";
      setSessionStatus(studentId, status, statusLabel(studentId, status));
      // Registrar desde la planilla avanza el cursor para mantener el ritmo del pase de lista.
      if (advance && status !== "pending") {
        const index = visibleStudents.findIndex(student => student.id === studentId);
        const next = visibleStudents[index + 1];
        if (next) focusStudent(next.id, { dom: true });
      }
    },
    [focusStudent, sessionStatuses, setSessionStatus, statusLabel, visibleStudents],
  );

  const handleRosterStatus = useCallback(
    (studentId: string, status: AttendanceStatus) => registerStudentStatus(studentId, status, true),
    [registerStudentStatus],
  );

  const handlePopoverStatus = useCallback(
    (studentId: string, status: AttendanceStatus) => registerStudentStatus(studentId, status),
    [registerStudentStatus],
  );

  const applyStatusToFocused = useCallback(
    (status: AttendanceStatus) => {
      if (!currentStudent) return;
      registerStudentStatus(currentStudent.id, status, true);
    },
    [currentStudent, registerStudentStatus],
  );

  const moveFocus = useCallback(
    (delta: number) => {
      if (visibleStudents.length === 0) return;
      const index = visibleStudents.findIndex(student => student.id === currentStudent?.id);
      const nextIndex = Math.min(
        visibleStudents.length - 1,
        Math.max(0, (index === -1 ? 0 : index) + delta),
      );
      focusStudent(visibleStudents[nextIndex].id, { dom: true });
    },
    [currentStudent?.id, focusStudent, visibleStudents],
  );

  /** Tab / ⇧Tab recorren la planilla y la abandonan en los extremos. */
  const moveFocusByTab = useCallback(
    (delta: number) => {
      if (visibleStudents.length === 0) return false;
      const index = visibleStudents.findIndex(student => student.id === currentStudent?.id);
      if (index === -1) return false;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= visibleStudents.length) return false;
      focusStudent(visibleStudents[nextIndex].id, { dom: true });
      return true;
    },
    [currentStudent?.id, focusStudent, visibleStudents],
  );

  useAttendanceHotkeys({
    enabled: !openPopoverId && !shortcutsOpen && !confirmRequest,
    onStatus: applyStatusToFocused,
    onUndo: () => {
      if (!session.canUndo) {
        toast.info("Nada que deshacer", { description: "No hay cambios recientes en esta jornada." });
        return;
      }
      session.undo();
      toast.success("Cambio deshecho", { description: "El registro volvió a su estado anterior." });
    },
    onMove: moveFocus,
    onTab: moveFocusByTab,
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  const runBulk = useCallback(
    (targetIds: string[], status: AttendanceStatus, label: string, detail: string) => {
      const preview = session.previewBulk(targetIds, status);
      if (preview.count === 0) {
        toast.info("Nada que cambiar", { description: detail });
        return;
      }
      const apply = () => {
        session.commitBulk(preview.changes, label);
        toast.success(`${label} · ${preview.count} registros`, {
          description: "Puedes deshacerlo con Ctrl/Cmd + Z.",
        });
      };
      if (preview.count > BULK_CONFIRM_THRESHOLD) {
        setConfirmRequest({
          title: label,
          description: `Se modificarán ${preview.count} registros de la jornada de ${course.name}. La acción queda en la pila de deshacer.`,
          confirmLabel: `Aplicar a ${preview.count}`,
          affected: preview.count,
          apply,
        });
      } else {
        apply();
      }
    },
    [course.name, session],
  );

  const handleAllPresent = useCallback(() => {
    runBulk(
      visibleStudents.map(student => student.id),
      "present",
      "Todos presentes",
      "Todos los estudiantes visibles ya están presentes.",
    );
  }, [runBulk, visibleStudents]);

  const handleCompletePending = useCallback(() => {
    const pending = visibleStudents
      .filter(student => (session.statuses[student.id] ?? "pending") === "pending")
      .map(student => student.id);
    runBulk(pending, "present", "Completar pendientes", "No quedan pendientes en la vista actual.");
  }, [runBulk, session.statuses, visibleStudents]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex min-h-0 flex-1 flex-col gap-2.5", focusMode && "chrona-focus-stage", className)}
        data-concentration-mode={focusMode ? "active" : undefined}
        role={focusMode ? "region" : undefined}
        aria-label={focusMode ? "Modo Enfocar asistencia" : undefined}
      >
        <AttendanceHeader
          course={course}
          courses={courses}
          date={session.date}
          todayIso={toISODate(new Date())}
          classState={classState}
          onBackToCourses={onBackToCourses}
          onCourseChange={id => {
            session.setCourseId(id);
            setFilter("all");
            setQuery("");
            setFocusedId(null);
            setOpenPopoverId(null);
          }}
          onDateChange={iso => {
            session.setDate(iso);
            setOpenPopoverId(null);
          }}
          syncState={session.syncState}
          lastSavedAt={session.lastSavedAt}
          onRetrySync={session.retrySync}
        />

        <DaySummaryRail metrics={metrics} activeFilter={filter} onFilter={setFilter} />

        <div className="chrona-workbar flex flex-wrap items-center gap-1.5 rounded-[14px] px-2 py-1.5">
          <AttendanceToolbar
            pendingCount={visiblePendingCount}
            canUndo={session.canUndo}
            undoDepth={session.undoDepth}
            lastActionLabel={session.lastAction?.label ?? null}
            query={query}
            onQueryChange={setQuery}
            onAllPresent={handleAllPresent}
            onCompletePending={handleCompletePending}
            onUndo={() => {
              if (!session.canUndo) return;
              session.undo();
              toast.success("Cambio deshecho");
            }}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode(value => !value)}
            filters={
              <FilterChips
                active={filter}
                counts={counts}
                onChange={setFilter}
                visible={visibleStudents.length}
                total={course.students.length}
                query={query}
                onClearQuery={() => setQuery("")}
              />
            }
          />
          <AttentionRail
            flags={attentionFlags}
            studentsById={studentsById}
            onSelect={studentId => {
              setFilter("all");
              setQuery("");
              focusStudent(studentId);
              setOpenPopoverId(studentId);
            }}
            activeStudentId={openPopoverId ?? currentStudent?.id ?? null}
          />
        </div>

        {classState.state === "none" ? (
          <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.03] px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-inset ring-hairline">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {course.name} no tiene clase programada este día · {progressMessage(metrics)}. Puedes revisar
            o ajustar registros igualmente.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 gap-2.5">
          <AttendanceSheet
            course={course}
            students={visibleStudents}
            statuses={session.statuses}
            attentionByStudent={attentionByStudent}
            focusedId={currentStudent?.id ?? null}
            openPopoverId={openPopoverId}
            onOpenPopover={setOpenPopoverId}
            onFocusStudent={setFocusedId}
            onStatus={handleRosterStatus}
            onPopoverStatus={handlePopoverStatus}
            onOpenExpediente={handleOpenExpediente}
            onOpenHistory={onOpenHistory}
            onOpenFollowUp={onOpenFollowUp}
            todayIso={session.date}
          />

        </div>

        <BulkConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
        <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <StudentExpediente
          open={Boolean(expedienteStudent)}
          onOpenChange={open => {
            if (!open) setExpedienteStudent(null);
          }}
          student={expedienteStudent}
          familyProfile={expedienteFamilyProfile}
          course={course}
          status={expedienteStudent ? session.statuses[expedienteStudent.id] ?? "pending" : "pending"}
          date={session.date}
        />
      </div>
    </MotionConfig>
  );
}

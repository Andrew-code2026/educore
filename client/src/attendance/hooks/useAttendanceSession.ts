/**
 * Fuente única de verdad de la jornada de asistencia.
 *
 * Cada par curso + fecha mantiene estados y sincronización independientes. El
 * autosave persiste instantáneas inmutables en orden de edición; cambiar de
 * jornada no arrastra datos ni actualizaciones de sincronización de otra sesión.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AttendanceStatus,
  Course,
  SessionStatuses,
  SyncState,
  UndoAction,
} from "../types";
import { toISODate } from "../data/dateUtils";

interface UseAttendanceSessionOptions {
  courses: Course[];
  initialCourseId?: string;
  initialDate?: string;
  initialStatuses?: SessionStatuses;
  onPersist?: (payload: {
    courseId: string;
    date: string;
    statuses: SessionStatuses;
  }) => Promise<void> | void;
}

interface BulkPreview {
  count: number;
  changes: Array<{ studentId: string; from: AttendanceStatus; to: AttendanceStatus }>;
}

/** Jornada inmutable que se persiste, con una versión para descartar respuestas obsoletas. */
interface SaveSnapshot {
  courseId: string;
  date: string;
  statuses: SessionStatuses;
  revision: number;
}

interface SessionSyncMeta {
  state: SyncState;
  lastSavedAt: number | null;
}

let actionCounter = 0;
const EMPTY_STATUSES: SessionStatuses = {};
const IDLE_SYNC: SessionSyncMeta = { state: "idle", lastSavedAt: null };
const LOCAL_SYNC: SessionSyncMeta = { state: "local", lastSavedAt: null };

/** Clave de jornada: curso + fecha. */
function sessionKey(courseId: string, date: string): string {
  return `${courseId}|${date}`;
}

/** Filtra el mapa de precarga global al roster del curso solicitado. */
function statusesForCourse(course: Course, allStatuses: SessionStatuses | undefined): SessionStatuses {
  if (!allStatuses) return {};
  const result: SessionStatuses = {};
  for (const student of course.students) {
    const status = allStatuses[student.id];
    if (status) result[student.id] = status;
  }
  return result;
}

/** Cada curso recibe únicamente sus propios estados de precarga. */
function seedSessions(
  courses: Course[],
  date: string,
  allStatuses: SessionStatuses | undefined,
): Record<string, SessionStatuses> {
  return Object.fromEntries(
    courses.map(course => [
      sessionKey(course.id, date),
      statusesForCourse(course, allStatuses),
    ]),
  );
}

export function useAttendanceSession({
  courses,
  initialCourseId,
  initialDate,
  initialStatuses,
  onPersist,
}: UseAttendanceSessionOptions) {
  const firstCourseId = initialCourseId ?? courses[0]?.id ?? "";
  const firstDate = initialDate ?? toISODate(new Date());

  const [courseId, setCourseId] = useState(firstCourseId);
  const [date, setDate] = useState(firstDate);
  const [statusesByKey, setStatusesByKey] = useState<Record<string, SessionStatuses>>(() =>
    seedSessions(courses, firstDate, initialStatuses),
  );
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [syncByKey, setSyncByKey] = useState<Record<string, SessionSyncMeta>>({});

  const course = useMemo(
    () => courses.find(item => item.id === courseId) ?? courses[0],
    [courses, courseId],
  );

  const key = sessionKey(courseId, date);
  const statuses = statusesByKey[key] ?? EMPTY_STATUSES;
  const syncMeta = syncByKey[key] ?? (onPersist ? IDLE_SYNC : LOCAL_SYNC);

  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  const keyRef = useRef(key);
  keyRef.current = key;
  const contextRef = useRef({ courseId, date });
  contextRef.current = { courseId, date };
  const undoRef = useRef(undoStack);
  undoRef.current = undoStack;
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;

  const saveTimer = useRef<number | undefined>(undefined);
  const pendingSave = useRef<SaveSnapshot | null>(null);
  const saveRevision = useRef(0);
  const latestRevisionByKey = useRef(new Map<string, number>());
  const failedSaveByKey = useRef(new Map<string, SaveSnapshot>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  /** Serializa writes y evita que una respuesta vieja marque como guardada una edición nueva. */
  const runSave = useCallback(
    (snapshot: SaveSnapshot) => {
      const snapshotKey = sessionKey(snapshot.courseId, snapshot.date);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const persist = persistRef.current;
            if (!persist) {
              if (latestRevisionByKey.current.get(snapshotKey) !== snapshot.revision) return;
              setSyncByKey(previous => ({
                ...previous,
                [snapshotKey]: {
                  state: "local",
                  lastSavedAt: previous[snapshotKey]?.lastSavedAt ?? null,
                },
              }));
              return;
            }
            await persist({
              courseId: snapshot.courseId,
              date: snapshot.date,
              statuses: snapshot.statuses,
            });

            if (latestRevisionByKey.current.get(snapshotKey) !== snapshot.revision) return;
            failedSaveByKey.current.delete(snapshotKey);
            setSyncByKey(previous => ({
              ...previous,
              [snapshotKey]: { state: "saved", lastSavedAt: Date.now() },
            }));
          } catch {
            if (latestRevisionByKey.current.get(snapshotKey) !== snapshot.revision) return;
            failedSaveByKey.current.set(snapshotKey, snapshot);
            setSyncByKey(previous => ({
              ...previous,
              [snapshotKey]: {
                state: "error",
                lastSavedAt: previous[snapshotKey]?.lastSavedAt ?? null,
              },
            }));
          }
        });
    },
    [],
  );

  /** Programa el autosave con una instantánea inmutable de la sesión editada. */
  const scheduleSave = useCallback(
    (nextStatuses: SessionStatuses) => {
      const context = contextRef.current;
      const saveKey = sessionKey(context.courseId, context.date);
      if (!persistRef.current) {
        setSyncByKey(previous => ({
          ...previous,
          [saveKey]: {
            state: "local",
            lastSavedAt: previous[saveKey]?.lastSavedAt ?? null,
          },
        }));
        return;
      }
      const revision = ++saveRevision.current;
      const snapshot: SaveSnapshot = {
        courseId: context.courseId,
        date: context.date,
        statuses: nextStatuses,
        revision,
      };
      latestRevisionByKey.current.set(saveKey, revision);
      failedSaveByKey.current.delete(saveKey);
      pendingSave.current = snapshot;
      setSyncByKey(previous => ({
        ...previous,
        [saveKey]: {
          state: "saving",
          lastSavedAt: previous[saveKey]?.lastSavedAt ?? null,
        },
      }));
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const pending = pendingSave.current;
        if (!pending) return;
        pendingSave.current = null;
        runSave(pending);
      }, 850);
    },
    [runSave],
  );

  const flushPendingSave = useCallback(() => {
    const snapshot = pendingSave.current;
    if (!snapshot) return;
    window.clearTimeout(saveTimer.current);
    pendingSave.current = null;
    runSave(snapshot);
  }, [runSave]);

  // Cambiar de jornada cierra el debounce pendiente y limpia la pila de deshacer.
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    flushPendingSave();
    setUndoStack([]);
  }, [flushPendingSave, key]);

  // No perder el último cambio si el panel se desmonta antes de vencer el debounce.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      const snapshot = pendingSave.current;
      pendingSave.current = null;
      if (!snapshot) return;
      try {
        void Promise.resolve(
          persistRef.current?.({
            courseId: snapshot.courseId,
            date: snapshot.date,
            statuses: snapshot.statuses,
          }),
        ).catch(() => undefined);
      } catch {
        // El unmount solo realiza un último intento best-effort.
      }
    },
    [],
  );

  const retrySync = useCallback(() => {
    const context = contextRef.current;
    const currentKey = sessionKey(context.courseId, context.date);
    const pending = pendingSave.current;
    const pendingForCurrent = pending && sessionKey(pending.courseId, pending.date) === currentKey ? pending : null;
    const failed = failedSaveByKey.current.get(currentKey);
    const base = pendingForCurrent ?? failed ?? {
      courseId: context.courseId,
      date: context.date,
      statuses: statusesRef.current,
      revision: 0,
    };

    if (pendingForCurrent) {
      window.clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }

    const revision = ++saveRevision.current;
    const snapshot = { ...base, revision };
    latestRevisionByKey.current.set(currentKey, revision);
    failedSaveByKey.current.delete(currentKey);
    setSyncByKey(previous => ({
      ...previous,
      [currentKey]: {
        state: "saving",
        lastSavedAt: previous[currentKey]?.lastSavedAt ?? null,
      },
    }));
    runSave(snapshot);
  }, [runSave]);

  /** Aplica cambios reales y los deja en la pila de deshacer. */
  const applyChanges = useCallback(
    (changes: BulkPreview["changes"], label: string) => {
      const current = statusesRef.current;
      const valid = changes.filter(change => (current[change.studentId] ?? "pending") !== change.to);
      if (valid.length === 0) return 0;

      const next: SessionStatuses = { ...current };
      for (const change of valid) next[change.studentId] = change.to;

      setStatusesByKey(previous => ({ ...previous, [keyRef.current]: next }));
      setUndoStack(previous => [
        ...previous.slice(-24),
        { id: `a${(actionCounter += 1)}`, label, changes: valid, at: Date.now() },
      ]);
      scheduleSave(next);
      return valid.length;
    },
    [scheduleSave],
  );

  /** Cambia el estado de un estudiante (una sola acción reversible). */
  const setStatus = useCallback(
    (studentId: string, status: AttendanceStatus, label?: string) => {
      applyChanges(
        [{ studentId, from: statusesRef.current[studentId] ?? "pending", to: status }],
        label ?? `Estado de ${studentId}`,
      );
    },
    [applyChanges],
  );

  /** Cambios que produciría una acción masiva (para pedir confirmación). */
  const previewBulk = useCallback(
    (studentIds: string[], status: AttendanceStatus): BulkPreview => {
      const changes: BulkPreview["changes"] = [];
      for (const studentId of studentIds) {
        const from = statusesRef.current[studentId] ?? "pending";
        if (from !== status) changes.push({ studentId, from, to: status });
      }
      return { count: changes.length, changes };
    },
    [],
  );

  /** Aplica una acción masiva ya confirmada. */
  const commitBulk = useCallback(
    (changes: BulkPreview["changes"], label: string) => {
      applyChanges(changes, label);
    },
    [applyChanges],
  );

  const undo = useCallback(() => {
    const last = undoRef.current[undoRef.current.length - 1];
    if (!last) return;

    const next: SessionStatuses = { ...statusesRef.current };
    for (const change of last.changes) next[change.studentId] = change.from;

    setStatusesByKey(previous => ({ ...previous, [keyRef.current]: next }));
    setUndoStack(previous => previous.slice(0, -1));
    scheduleSave(next);
  }, [scheduleSave]);

  const lastAction = undoStack[undoStack.length - 1] ?? null;

  return {
    course,
    courseId,
    setCourseId,
    date,
    setDate,
    statuses,
    setStatus,
    previewBulk,
    commitBulk,
    undo,
    canUndo: undoStack.length > 0,
    undoDepth: undoStack.length,
    lastAction,
    syncState: syncMeta.state,
    lastSavedAt: syncMeta.lastSavedAt,
    retrySync,
  };
}

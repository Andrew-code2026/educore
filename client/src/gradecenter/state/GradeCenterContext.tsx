import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createEmptyDataset } from "../data/emptyDataset";
import type { GradebookAssignment } from "../domain/assignments";
import { buildAnalytics, type Analytics, type StudentMetrics } from "../domain/metrics";
import { EMPTY_FILTERS, filterStudents, sortStudents, visibleEvaluations } from "../domain/selectors";
import { clamp, roundGrade } from "../data/seed";
import { normalizeGrade } from "../domain/grading";
import {
  gradeKey,
  type Dataset,
  type Density,
  type Evaluation,
  type EvaluationStatus,
  type EvaluationTypeId,
  type GradeMap,
  type GradeValue,
  type Preferences,
  type SortSpec,
  type ViewId,
  type Filters,
} from "../types";
import { INITIAL_SYNC_STATE, SYNC_TIMINGS } from "./autosave";
import {
  applyDensityDefaults,
  columnWidthOf,
  DEFAULT_PREFERENCES,
  loadPreferences,
  resetPreferences,
  savePreferences,
  STUDENT_COLUMN_WIDTH,
  DEFINITIVA_COLUMN_WIDTH,
} from "./preferences";
import type { SyncState } from "../types";
import { loadConfirmedDataset, loadDraftSnapshot, persistConfirmedDataset, persistDraftChanges } from "./syncRepository";

export interface CellRef {
  row: number;
  col: number;
}

export interface PastePreview {
  rows: string[][];
  target: CellRef;
  sourceText: string;
  error?: string;
}

export interface GradeCenterPersistence {
  saveGrades: (
    assessmentId: number,
    grades: Array<{ studentId: number; value: number | null; comment?: string }>
  ) => Promise<{ saved?: number } | null | void>;
  createAssessment?: (input: {
    title: string;
    description?: string;
    assessmentType: string;
    date: Date;
    maxValue: number;
    weight: number;
    status?: string;
  }) => Promise<{ id: number; title?: string; weight?: number; [key: string]: any } | null | void>;
  updateAssessment?: (
    id: number,
    patch: {
      title?: string;
      description?: string;
      weight?: number;
      date?: Date;
      status?: string;
    }
  ) => Promise<any>;
  deleteAssessment?: (id: number) => Promise<{ success?: boolean; id?: number; releasedWeight?: number } | null | void>;
}

export interface DraftChange {
  kind: "grade" | "evaluation";
  studentId?: string;
  evaluationId: string;
  value?: GradeValue;
  comment?: string;
  patch?: Partial<Pick<Evaluation, "name" | "shortName" | "abbrev" | "type" | "weight" | "date" | "period" | "description" | "status" | "dbaIds">>;
  operation?: "create" | "update" | "delete";
}

export interface State {
  confirmedDataset: Dataset;
  dataset: Dataset;
  drafts: Record<string, DraftChange>;
  preferences: Preferences;
  sync: SyncState;
  activeCell: CellRef;
  editing: boolean;
  selectedStudentId: string | null;
  selectedEvaluationId: string | null;
  /** Celda que acaba de recibir una nota: dispara el feedback visual inmediato. */
  pulse: { key: string; at: number } | null;
  selectedRows: string[];
  selectedCells: string[];
  selectionAnchor: CellRef | null;
  pastePreview: PastePreview | null;
}

export type Action =
  | { type: "view"; view: ViewId }
  | { type: "density"; density: Density }
  | { type: "columnWidth"; evaluationId: string; width: number }
  | { type: "studentColumnWidth"; width: number }
  | { type: "definitivaColumnWidth"; width: number }
  | { type: "toggleEvaluation"; evaluationId: string }
  | { type: "showAllEvaluations" }
  | { type: "sort"; sort: SortSpec }
  | { type: "filters"; filters: Filters }
  | { type: "focus"; focusMode: boolean }
  | { type: "quickEdit"; quickEdit: boolean }
  | { type: "analysis"; open: boolean }
  | { type: "showCodes"; show: boolean }
  | { type: "resetPreferences" }
  | { type: "activeCell"; cell: CellRef }
  | { type: "editing"; editing: boolean }
  | { type: "selectStudent"; studentId: string | null }
  | { type: "selectEvaluation"; evaluationId: string | null }
  | { type: "comment"; studentId: string; evaluationId: string; comment: string }
  | { type: "selection/rows"; ids: string[] }
  | { type: "selection/toggle-row"; id: string; evaluationIds: string[] }
  | { type: "selection/cell"; key: string; cell: CellRef; rangeKeys?: string[]; additive?: boolean }
  | { type: "selection/clear" }
  | { type: "paste/preview"; preview: PastePreview | null }
  | { type: "dataset/load"; dataset: Dataset }
  | { type: "restore"; dataset: Dataset }
  | { type: "remote/update"; dataset: Dataset }
  | { type: "createEvaluation"; evaluation: Evaluation }
  | { type: "updateEvaluation"; evaluationId: string; patch: Partial<Pick<Evaluation, "name" | "shortName" | "abbrev" | "type" | "weight" | "date" | "period" | "description" | "status" | "dbaIds">> }
  | { type: "removeEvaluation"; evaluationId: string }
  | { type: "evaluation/created-confirmed"; evaluation: Evaluation }
  | { type: "evaluation/updated-confirmed"; evaluationId: string; patch: Partial<Pick<Evaluation, "name" | "shortName" | "abbrev" | "type" | "weight" | "date" | "period" | "description" | "status" | "dbaIds">> }
  | { type: "evaluation/deleted-confirmed"; evaluationId: string }
  | { type: "grade"; studentId: string; evaluationId: string; value: GradeValue; comment?: string }
  | { type: "bulkGrades"; updates: Array<{ studentId: string; evaluationId: string; value: GradeValue }> }
  | { type: "sync/pending"; count: number }
  | { type: "sync/saving" }
  | { type: "sync/saved" }
  | { type: "sync/confirmed-batch"; savedDrafts: Record<string, DraftChange> }
  | { type: "sync/synced"; dataset: Dataset }
  | { type: "sync/idle" }
  | { type: "sync/idle-if-empty" }
  | { type: "sync/error"; message: string }

export function createInitialState(customDataset?: Dataset, readOnly?: boolean): State {
  const preferences = loadPreferences();
  const confirmedDataset = customDataset ?? loadConfirmedDataset(createEmptyDataset());
  const draftSnapshot = readOnly ? null : loadDraftSnapshot(confirmedDataset);
  const rawInitialDrafts = (draftSnapshot?.changes ?? {}) as Record<string, DraftChange>;

  // Filtrar borradores que ya coinciden con confirmedDataset o no pertenecen a este dataset
  const initialDrafts: Record<string, DraftChange> = {};
  for (const [key, draft] of Object.entries(rawInitialDrafts)) {
    if (draft.kind === "grade" && draft.studentId && draft.evaluationId) {
      const confirmedVal = confirmedDataset.grades[key] ?? null;
      const confirmedComm = (confirmedDataset.comments[key] ?? "").trim();
      const draftVal = draft.value ?? null;
      const draftComm = (draft.comment ?? "").trim();
      if (draftVal !== confirmedVal || draftComm !== confirmedComm) {
        initialDrafts[key] = draft;
      }
    }
  }

  const initialDataset = Object.keys(initialDrafts).length > 0 && draftSnapshot?.dataset?.key === confirmedDataset.key
    ? draftSnapshot.dataset
    : confirmedDataset;

  const pendingCount = readOnly ? 0 : Object.keys(initialDrafts).length;

  return {
    confirmedDataset,
    dataset: initialDataset,
    drafts: initialDrafts,
    preferences,
    sync: {
      ...INITIAL_SYNC_STATE,
      status: readOnly ? "synced" : pendingCount > 0 ? "pending" : "idle",
      pending: pendingCount,
    },
    activeCell: { row: 0, col: 0 },
    editing: false,
    selectedStudentId: null,
    selectedEvaluationId: null,
    pulse: null,
    selectedRows: [],
    selectedCells: [],
    selectionAnchor: null,
    pastePreview: null,
  };
}

export function gradeCenterReducer(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, preferences: { ...state.preferences, view: action.view } };

    case "density":
      return { ...state, preferences: applyDensityDefaults(state.preferences, action.density) };

    case "columnWidth":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          columnWidths: {
            ...state.preferences.columnWidths,
            [action.evaluationId]: Math.round(clamp(action.width, 52, 260)),
          },
        },
      };

    case "studentColumnWidth":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          studentColWidth: Math.round(clamp(action.width, 132, 420)),
        },
      };

    case "definitivaColumnWidth":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          definitivaColWidth: Math.round(clamp(action.width, 92, 260)),
        },
      };

    case "toggleEvaluation": {
      const hidden = state.preferences.hiddenEvaluations;
      const next = hidden.includes(action.evaluationId)
        ? hidden.filter((id) => id !== action.evaluationId)
        : [...hidden, action.evaluationId];
      return { ...state, preferences: { ...state.preferences, hiddenEvaluations: next } };
    }

    case "showAllEvaluations":
      return { ...state, preferences: { ...state.preferences, hiddenEvaluations: [] } };

    case "sort":
      return { ...state, preferences: { ...state.preferences, sort: action.sort }, selectedRows: [], selectedCells: [], selectionAnchor: null };

    case "filters":
      return { ...state, preferences: { ...state.preferences, filters: action.filters }, selectedRows: [], selectedCells: [], selectionAnchor: null };

    case "focus":
      return {
        ...state,
        preferences: { ...state.preferences, focusMode: action.focusMode },
        // Al entrar o salir del enfoque, el análisis contextual se repliega.
        editing: action.focusMode ? false : state.editing,
      };

    case "quickEdit":
      return { ...state, preferences: { ...state.preferences, quickEdit: action.quickEdit } };

    case "analysis":
      return { ...state, preferences: { ...state.preferences, analysisOpen: action.open } };

    case "showCodes":
      return { ...state, preferences: { ...state.preferences, showCodes: action.show } };

    case "resetPreferences": {
      const preferences = resetPreferences(state.preferences);
      return { ...state, preferences };
    }

    case "activeCell":
      return { ...state, activeCell: action.cell };

    case "editing":
      return { ...state, editing: action.editing };

    case "selectStudent":
      return { ...state, selectedStudentId: action.studentId };

    case "selectEvaluation":
      return { ...state, selectedEvaluationId: action.evaluationId };

    case "selection/rows":
      return { ...state, selectedRows: action.ids };
    case "selection/toggle-row": {
      const selected = state.selectedRows.includes(action.id);
      const selectedRows = selected ? state.selectedRows.filter((id) => id !== action.id) : [...state.selectedRows, action.id];
      const rowKeys = action.evaluationIds.map((evaluationId) => gradeKey(action.id, evaluationId));
      const selectedCells = selected ? state.selectedCells.filter((key) => !rowKeys.includes(key)) : [...new Set([...state.selectedCells, ...rowKeys])];
      return { ...state, selectedRows, selectedCells };
    }
    case "selection/cell": {
      let keys = state.selectedCells;
      if (action.rangeKeys) keys = action.additive ? [...new Set([...keys, ...action.rangeKeys])] : action.rangeKeys;
      else if (action.additive) keys = keys.includes(action.key) ? keys.filter((key) => key !== action.key) : [...keys, action.key];
      else keys = [action.key];
      return { ...state, selectedCells: [...new Set(keys)], selectionAnchor: action.cell };
    }
    case "selection/clear":
      return { ...state, selectedRows: [], selectedCells: [], selectionAnchor: null };
    case "paste/preview":
      return { ...state, pastePreview: action.preview };

    case "dataset/load":
      return {
        ...state,
        confirmedDataset: action.dataset,
        dataset: action.dataset,
        drafts: {},
        sync: {
          ...INITIAL_SYNC_STATE,
          status: "idle",
          pending: 0,
          lastSyncedAt: Date.now(),
          retries: 0,
          lastError: null,
        },
        selectedRows: [],
        selectedCells: [],
        selectionAnchor: null,
        pastePreview: null,
      };

    case "restore": {
      // Si el dataset a restaurar tiene una clave distinta, no es un undo/redo sino un dataset nuevo
      if (action.dataset.key !== state.confirmedDataset.key) {
        return {
          ...state,
          confirmedDataset: action.dataset,
          dataset: action.dataset,
          drafts: {},
          sync: { ...INITIAL_SYNC_STATE, status: "idle", pending: 0, lastSyncedAt: Date.now(), lastError: null },
          selectedRows: [],
          selectedCells: [],
          selectionAnchor: null,
          pastePreview: null,
        };
      }

      const drafts: Record<string, DraftChange> = {};
      for (const student of action.dataset.students) {
        for (const evaluation of action.dataset.evaluations) {
          const key = gradeKey(student.id, evaluation.id);
          const actionGrade = action.dataset.grades[key] ?? null;
          const confirmedGrade = state.confirmedDataset.grades[key] ?? null;
          const actionComment = (action.dataset.comments[key] ?? "").trim();
          const confirmedComment = (state.confirmedDataset.comments[key] ?? "").trim();
          if (actionGrade !== confirmedGrade || actionComment !== confirmedComment) {
            drafts[key] = {
              kind: "grade",
              studentId: student.id,
              evaluationId: evaluation.id,
              value: actionGrade,
              comment: actionComment,
            };
          }
        }
      }
      const restoredEvaluations = new Map(action.dataset.evaluations.map((evaluation) => [evaluation.id, evaluation]));
      for (const evaluation of action.dataset.evaluations) {
        if (!state.confirmedDataset.evaluations.some((item) => item.id === evaluation.id)) {
          drafts[`evaluation::${evaluation.id}`] = { kind: "evaluation", evaluationId: evaluation.id, operation: "create", patch: evaluation };
        }
      }
      for (const evaluation of state.confirmedDataset.evaluations) {
        const restored = restoredEvaluations.get(evaluation.id);
        if (!restored) {
          drafts[`evaluation::${evaluation.id}`] = { kind: "evaluation", evaluationId: evaluation.id, operation: "delete", patch: { name: "__deleted__" } };
        } else if (restored.name !== evaluation.name || restored.weight !== evaluation.weight || restored.description !== evaluation.description) {
          drafts[`evaluation::${evaluation.id}`] = { kind: "evaluation", evaluationId: evaluation.id, operation: "update", patch: restored };
        }
      }
      const pending = Object.keys(drafts).length;
      return {
        ...state,
        dataset: action.dataset,
        drafts,
        sync: {
          ...state.sync,
          status: pending ? "pending" : "idle",
          pending,
          lastError: null,
        },
      };
    }

    case "remote/update": {
      if (Object.keys(state.drafts).length === 0) {
        return {
          ...state,
          confirmedDataset: action.dataset,
          dataset: action.dataset,
        };
      }
      const mergedGrades = { ...action.dataset.grades };
      const mergedComments = { ...action.dataset.comments };
      for (const [key, draft] of Object.entries(state.drafts)) {
        if (draft.kind === "grade") {
          mergedGrades[key] = draft.value ?? null;
          if (draft.comment !== undefined) {
            mergedComments[key] = draft.comment;
          }
        }
      }
      return {
        ...state,
        confirmedDataset: action.dataset,
        dataset: {
          ...action.dataset,
          grades: mergedGrades,
          comments: mergedComments,
        },
      };
    }

    case "createEvaluation": {
      const evaluation = action.evaluation;
      if (state.dataset.evaluations.some((item) => item.id === evaluation.id)) return state;
      return {
        ...state,
        dataset: { ...state.dataset, evaluations: [...state.dataset.evaluations, evaluation], evaluationCount: state.dataset.evaluations.length + 1 },
        drafts: { ...state.drafts, [`evaluation::${evaluation.id}`]: { kind: "evaluation", evaluationId: evaluation.id, operation: "create", patch: evaluation } },
        selectedEvaluationId: evaluation.id,
        sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length + 1, lastError: null },
      };
    }

    case "evaluation/created-confirmed": {
      const evaluation = action.evaluation;
      const evaluations = [...state.dataset.evaluations, evaluation];
      const confirmedEvaluations = [...state.confirmedDataset.evaluations, evaluation];
      return {
        ...state,
        dataset: { ...state.dataset, evaluations, evaluationCount: evaluations.length },
        confirmedDataset: { ...state.confirmedDataset, evaluations: confirmedEvaluations, evaluationCount: confirmedEvaluations.length },
        selectedEvaluationId: evaluation.id,
      };
    }

    case "updateEvaluation": {
      const evaluations = state.dataset.evaluations.map((evaluation) =>
        evaluation.id === action.evaluationId ? { ...evaluation, ...action.patch } : evaluation,
      );
      if (evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0) > 100) return state;
      const changeKey = `evaluation::${action.evaluationId}`;
      return {
        ...state,
        dataset: { ...state.dataset, evaluations },
        drafts: { ...state.drafts, [changeKey]: { kind: "evaluation", evaluationId: action.evaluationId, operation: "update", patch: action.patch } },
        sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length + 1, lastError: null },
      };
    }

    case "evaluation/updated-confirmed": {
      const evaluations = state.dataset.evaluations.map((evaluation) =>
        evaluation.id === action.evaluationId ? { ...evaluation, ...action.patch } : evaluation,
      );
      const confirmedEvaluations = state.confirmedDataset.evaluations.map((evaluation) =>
        evaluation.id === action.evaluationId ? { ...evaluation, ...action.patch } : evaluation,
      );
      return {
        ...state,
        dataset: { ...state.dataset, evaluations },
        confirmedDataset: { ...state.confirmedDataset, evaluations: confirmedEvaluations },
      };
    }

    case "removeEvaluation": {
      const evaluations = state.dataset.evaluations.filter((evaluation) => evaluation.id !== action.evaluationId);
      const grades = Object.fromEntries(Object.entries(state.dataset.grades).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const comments = Object.fromEntries(Object.entries(state.dataset.comments).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const changeKey = `evaluation::${action.evaluationId}`;
      return {
        ...state,
        dataset: { ...state.dataset, evaluations, grades, comments, evaluationCount: evaluations.length },
        drafts: { ...state.drafts, [changeKey]: { kind: "evaluation", evaluationId: action.evaluationId, operation: "delete", patch: { name: "__deleted__" } } },
        selectedEvaluationId: null,
        sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length + 1, lastError: null },
      };
    }

    case "evaluation/deleted-confirmed": {
      const evaluations = state.dataset.evaluations.filter((evaluation) => evaluation.id !== action.evaluationId);
      const confirmedEvaluations = state.confirmedDataset.evaluations.filter((evaluation) => evaluation.id !== action.evaluationId);
      const grades = Object.fromEntries(Object.entries(state.dataset.grades).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const comments = Object.fromEntries(Object.entries(state.dataset.comments).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const confirmedGrades = Object.fromEntries(Object.entries(state.confirmedDataset.grades).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const confirmedComments = Object.fromEntries(Object.entries(state.confirmedDataset.comments).filter(([key]) => !key.endsWith(`::${action.evaluationId}`)));
      const drafts = Object.fromEntries(Object.entries(state.drafts).filter(([key]) => !key.includes(action.evaluationId)));
      return {
        ...state,
        dataset: { ...state.dataset, evaluations, grades, comments, evaluationCount: evaluations.length },
        confirmedDataset: { ...state.confirmedDataset, evaluations: confirmedEvaluations, grades: confirmedGrades, comments: confirmedComments, evaluationCount: confirmedEvaluations.length },
        drafts,
        selectedEvaluationId: null,
        sync: { ...state.sync, pending: Object.keys(drafts).length },
      };
    }

    case "grade": {
      const key = gradeKey(action.studentId, action.evaluationId);
      if (state.dataset.grades[key] === action.value && action.comment === undefined) {
        return { ...state, pulse: { key, at: Date.now() } };
      }
      return {
        ...state,
        dataset: {
          ...state.dataset,
          grades: { ...state.dataset.grades, [key]: action.value },
          comments: { ...state.dataset.comments, ...(action.comment !== undefined ? { [key]: action.comment } : {}) },
        },
        drafts: { ...state.drafts, [key]: { kind: "grade", studentId: action.studentId, evaluationId: action.evaluationId, value: action.value, comment: action.comment ?? state.dataset.comments[key] ?? "" } },
        pulse: { key, at: Date.now() },
        sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length + 1, lastError: null },
      };
    }

    case "bulkGrades": {
      const grades = { ...state.dataset.grades };
      const updates = action.updates;
      for (const update of updates) grades[gradeKey(update.studentId, update.evaluationId)] = update.value;
      const drafts = { ...state.drafts };
      for (const update of updates) {
        const key = gradeKey(update.studentId, update.evaluationId);
        drafts[key] = { kind: "grade", studentId: update.studentId, evaluationId: update.evaluationId, value: update.value, comment: state.dataset.comments[key] ?? "" };
      }
      return { ...state, dataset: { ...state.dataset, grades }, drafts, selectedCells: [], selectedRows: [], pastePreview: null, sync: { ...state.sync, status: "pending", pending: Object.keys(drafts).length, lastError: null } };
    }

    case "comment": {
      const key = gradeKey(action.studentId, action.evaluationId);
      return {
        ...state,
        dataset: { ...state.dataset, comments: { ...state.dataset.comments, [key]: action.comment } },
        drafts: { ...state.drafts, [key]: { kind: "grade", studentId: action.studentId, evaluationId: action.evaluationId, value: state.dataset.grades[key] ?? null, comment: action.comment } },
        sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length + 1, lastError: null },
      };
    }

    case "sync/pending":
      return { ...state, sync: { ...state.sync, status: "pending", pending: action.count, lastError: null } };
    case "sync/saving":
      return { ...state, sync: { ...state.sync, status: "saving", lastError: null } };
    case "sync/saved":
      return { ...state, sync: { ...state.sync, status: "saved" } };
    case "sync/confirmed-batch": {
      // 1. Actualizar confirmedDataset con los borradores guardados exitosamente
      const nextConfirmedGrades = { ...state.confirmedDataset.grades };
      const nextConfirmedComments = { ...state.confirmedDataset.comments };
      for (const [key, draft] of Object.entries(action.savedDrafts)) {
        if (draft.kind === "grade") {
          nextConfirmedGrades[key] = draft.value ?? null;
          if (draft.comment !== undefined) {
            nextConfirmedComments[key] = draft.comment;
          }
        }
      }
      const nextConfirmedDataset = {
        ...state.confirmedDataset,
        grades: nextConfirmedGrades,
        comments: nextConfirmedComments,
      };

      // 2. Limpiar SOLAMENTE los borradores cuyo valor difiere de lo confirmado en el servidor.
      // Si el docente editó de nuevo la celda mientras la petición estaba en vuelo, se conserva ese borrador nuevo.
      const remainingDrafts: Record<string, DraftChange> = {};
      for (const [key, draft] of Object.entries(state.drafts)) {
        const saved = action.savedDrafts[key];
        if (saved) {
          const draftVal = draft.value ?? null;
          const savedVal = saved.value ?? null;
          const draftComm = (draft.comment ?? "").trim();
          const savedComm = (saved.comment ?? "").trim();
          if (draftVal !== savedVal || draftComm !== savedComm) {
            remainingDrafts[key] = draft;
          }
        } else {
          remainingDrafts[key] = draft;
        }
      }

      const remainingCount = Object.keys(remainingDrafts).length;
      if (remainingCount > 0) {
        return {
          ...state,
          confirmedDataset: nextConfirmedDataset,
          drafts: remainingDrafts,
          sync: {
            ...state.sync,
            status: "pending",
            pending: remainingCount,
            lastSyncedAt: Date.now(),
            retries: 0,
            lastError: null,
          },
        };
      }

      return {
        ...state,
        confirmedDataset: nextConfirmedDataset,
        drafts: {},
        sync: {
          ...state.sync,
          status: "synced",
          pending: 0,
          lastSyncedAt: Date.now(),
          retries: 0,
          lastError: null,
        },
      };
    }
    case "sync/synced":
      return {
        ...state,
        confirmedDataset: action.dataset,
        dataset: action.dataset,
        drafts: {},
        sync: { ...state.sync, status: "synced", pending: 0, lastSyncedAt: Date.now(), retries: 0, lastError: null },
      };
    case "sync/idle":
      return { ...state, sync: { ...state.sync, status: "idle", pending: 0, lastError: null } };
    case "sync/idle-if-empty": {
      if (Object.keys(state.drafts).length > 0) {
        return { ...state, sync: { ...state.sync, status: "pending", pending: Object.keys(state.drafts).length } };
      }
      return { ...state, sync: { ...state.sync, status: "idle", pending: 0, lastError: null } };
    }
    case "sync/error":
      return { ...state, sync: { ...state.sync, status: "error", retries: state.sync.retries + 1, lastError: action.message } };
    default:
      return state;
  }
}

export interface GradeCenterContextValue {
  dataset: Dataset;
  confirmedDataset: Dataset;
  draftChanges: Record<string, DraftChange>;
  preferences: Preferences;
  sync: SyncState;
  analytics: Analytics;
  readOnly: boolean;
  readOnlyReason?: string;
  availableAssignments?: GradebookAssignment[];
  onSelectAssignment?: (id: string) => void;
  /** Estudiantes filtrados y ordenados: el orden real de la matriz. */
  students: StudentMetrics[];
  /** Evaluaciones visibles según preferencias. */
  evaluations: Evaluation[];
  activeCell: CellRef;
  editing: boolean;
  selectedStudentId: string | null;
  selectedEvaluationId: string | null;
  pulse: { key: string; at: number } | null;
  selectedRows: string[];
  selectedCells: string[];
  selectionAnchor: CellRef | null;
  pastePreview: PastePreview | null;
  gradeAt: (studentId: string, evaluationId: string) => GradeValue;
  commentAt: (studentId: string, evaluationId: string) => string;
  weightIntegrity: { used: number; remaining: number; status: "valid" | "incomplete" | "exceeded" };
  isCellSelected: (row: number, col: number, studentId: string, evaluationId: string) => boolean;
  selectAllVisible: () => void;
  toggleRowSelection: (studentId: string) => void;
  selectCell: (cell: CellRef, studentId: string, evaluationId: string, options?: { additive?: boolean; range?: boolean }) => void;
  clearSelection: () => void;
  copySelection: () => Promise<void>;
  readPaste: () => Promise<void>;
  previewPasteText: (sourceText: string) => void;
  applyPastePreview: () => void;
  bulkGrade: (evaluationId: string, studentIds: string[], value: GradeValue, protectExisting?: boolean) => void;
  cancelPastePreview: () => void;
  clearSelectedGrades: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  columnWidth: (evaluationId: string) => number;
  setView: (view: ViewId) => void;
  setDensity: (density: Density) => void;
  resizeColumn: (evaluationId: string, width: number) => void;
  resizeStudentColumn: (width: number) => void;
  resizeDefinitivaColumn: (width: number) => void;
  toggleEvaluation: (evaluationId: string) => void;
  showAllEvaluations: () => void;
  setSort: (sort: SortSpec) => void;
  setFilters: (filters: Filters) => void;
  setFocusMode: (value: boolean) => void;
  setQuickEdit: (value: boolean) => void;
  setAnalysisOpen: (value: boolean) => void;
  setShowCodes: (value: boolean) => void;
  resetAllPreferences: () => void;
  setActiveCell: (cell: CellRef) => void;
  setEditing: (value: boolean) => void;
  focusCell: (row: number, col: number) => void;
  moveCell: (deltaRow: number, deltaCol: number) => void;
  selectStudent: (studentId: string | null) => void;
  selectEvaluation: (evaluationId: string | null) => void;
  createEvaluation: (input: { name: string; type: EvaluationTypeId; date?: string; weight: number; description?: string; status: EvaluationStatus }) => Promise<{ ok: boolean; error?: string; evaluationId?: string }>;
  updateEvaluation: (evaluationId: string, patch: Partial<Pick<Evaluation, "name" | "shortName" | "abbrev" | "type" | "weight" | "date" | "period" | "description" | "status" | "dbaIds">>) => Promise<{ ok: boolean; error?: string }>;
  removeEvaluation: (evaluationId: string) => Promise<{ ok: boolean; error?: string }>;
  commitGrade: (studentId: string, evaluationId: string, value: GradeValue, comment?: string) => void;
  clearGrade: (studentId: string, evaluationId: string) => void;
  /** Lleva la matriz hasta una celda concreta, ajustando filtros si hace falta. */
  jumpToCell: (studentId: string, evaluationId: string) => void;
  /** Lleva la matriz hasta la fila de un estudiante. */
  jumpToStudent: (studentId: string) => void;
  retrySync: () => void;
}

const GradeCenterContext = createContext<GradeCenterContextValue | null>(null);

export function GradeCenterProvider({
  children,
  initialDataset,
  readOnly = false,
  readOnlyReason,
  availableAssignments,
  onSelectAssignment,
  persistence,
  onDataSaved,
}: {
  children: ReactNode;
  initialDataset?: Dataset;
  readOnly?: boolean;
  readOnlyReason?: string;
  availableAssignments?: GradebookAssignment[];
  onSelectAssignment?: (id: string) => void;
  persistence?: GradeCenterPersistence;
  onDataSaved?: () => void;
}) {
  const [state, dispatch] = useReducer(
    gradeCenterReducer,
    undefined,
    () => createInitialState(initialDataset, readOnly),
  );

  const timers = useRef<number[]>([]);
  const datasetRef = useRef(state.dataset);
  const draftsRef = useRef(state.drafts);
  const pendingCountRef = useRef(Object.keys(state.drafts).length);
  const syncAttemptRef = useRef<(attempt: number) => Promise<void> | void>(() => undefined);
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;
  const onDataSavedRef = useRef(onDataSaved);
  onDataSavedRef.current = onDataSaved;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const readOnlyReasonRef = useRef(readOnlyReason);
  readOnlyReasonRef.current = readOnlyReason;

  const undoStack = useRef<Dataset[]>([]);
  const redoStack = useRef<Dataset[]>([]);
  datasetRef.current = state.dataset;
  draftsRef.current = state.drafts;
  pendingCountRef.current = Object.keys(state.drafts).length;

  const isSyncingRef = useRef(false);
  const queuedSyncRef = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const prevInitialDatasetRef = useRef(initialDataset);
  useEffect(() => {
    if (!initialDataset) return;
    if (initialDataset.key !== state.confirmedDataset.key) {
      clearTimers();
      undoStack.current = [];
      redoStack.current = [];
      dispatch({ type: "dataset/load", dataset: initialDataset });
      persistDraftChanges({}, initialDataset);
    } else if (prevInitialDatasetRef.current !== initialDataset) {
      dispatch({ type: "remote/update", dataset: initialDataset });
    }
    prevInitialDatasetRef.current = initialDataset;
  }, [initialDataset, state.confirmedDataset.key, clearTimers]);

  const analytics = useMemo(() => buildAnalytics(state.dataset), [state.dataset]);

  const students = useMemo(
    () => sortStudents(filterStudents(state.dataset, analytics, state.preferences.filters), state.preferences.sort),
    [state.dataset, analytics, state.preferences.filters, state.preferences.sort],
  );

  const evaluations = useMemo(
    () => visibleEvaluations(state.preferences, state.dataset),
    [state.preferences, state.dataset],
  );

  /* ------------------------------------------------------------------ */
  /* Preferencias persistentes                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    savePreferences(state.preferences);
  }, [state.preferences]);

  /* ------------------------------------------------------------------ */
  /* Cola real de guardado con debounce, persistencia server y reintentos */
  /* ------------------------------------------------------------------ */

  syncAttemptRef.current = async (attempt: number) => {
    if (readOnlyRef.current || pendingCountRef.current === 0) return;
    if (isSyncingRef.current) {
      queuedSyncRef.current = true;
      return;
    }

    const snapshotDrafts = { ...draftsRef.current };
    const snapshotKeys = Object.keys(snapshotDrafts);
    if (snapshotKeys.length === 0) {
      dispatch({ type: "sync/idle-if-empty" });
      return;
    }

    isSyncingRef.current = true;
    dispatch({ type: "sync/saving" });

    try {
      let performedServerSave = false;
      if (persistenceRef.current?.saveGrades) {
        // Agrupar calificaciones por evaluación para despachar en lote seguro
        const byEval: Record<number, Array<{ studentId: number; value: number | null; comment?: string }>> = {};
        for (const draft of Object.values(snapshotDrafts)) {
          if (draft.kind === "grade" && draft.studentId) {
            const evalIdNum = Number(draft.evaluationId);
            const studentIdNum = Number(draft.studentId);
            if (Number.isFinite(evalIdNum) && Number.isFinite(studentIdNum)) {
              if (!byEval[evalIdNum]) byEval[evalIdNum] = [];
              byEval[evalIdNum].push({
                studentId: studentIdNum,
                value: draft.value ?? null,
                comment: draft.comment || undefined,
              });
            }
          }
        }

        const evalIds = Object.keys(byEval).map(Number);
        if (evalIds.length > 0) {
          for (const evalId of evalIds) {
            const items = byEval[evalId];
            if (items && items.length > 0) {
              await persistenceRef.current.saveGrades(evalId, items);
              performedServerSave = true;
            }
          }
        }
      } else {
        persistConfirmedDataset(datasetRef.current);
      }

      dispatch({ type: "sync/saved" });

      timers.current.push(
        window.setTimeout(() => {
          dispatch({ type: "sync/confirmed-batch", savedDrafts: snapshotDrafts });
          persistConfirmedDataset(datasetRef.current);
          if (performedServerSave) {
            onDataSavedRef.current?.();
          }

          timers.current.push(
            window.setTimeout(() => {
              dispatch({ type: "sync/idle-if-empty" });
            }, SYNC_TIMINGS.syncedMs)
          );
        }, SYNC_TIMINGS.savedMs)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al guardar calificaciones en el servidor.";
      dispatch({ type: "sync/error", message });
      if (attempt < 2) {
        timers.current.push(
          window.setTimeout(() => {
            syncAttemptRef.current(attempt + 1);
          }, SYNC_TIMINGS.retryMs)
        );
      }
    } finally {
      isSyncingRef.current = false;
      if (queuedSyncRef.current) {
        queuedSyncRef.current = false;
        if (pendingCountRef.current > 0) {
          scheduleSync();
        }
      }
    }
  };

  const scheduleSync = useCallback(() => {
    if (readOnly) return;
    clearTimers();
    if (pendingCountRef.current === 0) {
      dispatch({ type: "sync/idle-if-empty" });
      return;
    }
    dispatch({ type: "sync/pending", count: pendingCountRef.current });
    timers.current.push(window.setTimeout(() => syncAttemptRef.current(0), SYNC_TIMINGS.debounceMs));
  }, [clearTimers, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const persisted = persistDraftChanges(state.drafts, state.dataset);
    if (!persisted && Object.keys(state.drafts).length > 0) {
      dispatch({ type: "sync/error", message: "No se pudo conservar el borrador local. No cierres esta pestaña hasta guardarlo." });
    }
  }, [state.drafts, state.dataset, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    if (Object.keys(state.drafts).length > 0) scheduleSync();
  }, [scheduleSync, readOnly, state.drafts]);

  useEffect(() => {
    if (readOnly) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(state.drafts).length === 0) return;
      event.preventDefault();
      event.returnValue = "Hay cambios locales pendientes de guardar.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.drafts, readOnly]);

  useEffect(() => clearTimers, [clearTimers]);

  const pushHistory = useCallback((before: Dataset) => {
    undoStack.current = [...undoStack.current.slice(-49), before];
    redoStack.current = [];
  }, []);

  const commitGrade = useCallback(
    (studentId: string, evaluationId: string, value: GradeValue, comment?: string) => {
      if (readOnly) {
        toast.info(readOnlyReasonRef.current || "Modo lectura: La modificación de calificaciones no está permitida en este contexto.");
        return;
      }
      const normalized = normalizeGrade(value);
      const key = gradeKey(studentId, evaluationId);
      const currentGrade = state.dataset.grades[key] ?? null;
      const currentComment = state.dataset.comments[key] ?? "";
      const nextComment = comment === undefined ? currentComment : comment;
      // Enter/Tab/blur sin cambios no debe crear una entrada de undo ni reactivar autosave.
      if (currentGrade === normalized && currentComment === nextComment) return;
      pushHistory(state.dataset);
      dispatch({ type: "grade", studentId, evaluationId, value: normalized, comment });
      window.setTimeout(scheduleSync, 0);
    },
    [pushHistory, scheduleSync, state.dataset, readOnly],
  );

  const clearGrade = useCallback(
    (studentId: string, evaluationId: string) => {
      if (readOnly) {
        toast.info(readOnlyReasonRef.current || "Modo lectura: La modificación de calificaciones no está permitida en este contexto.");
        return;
      }
      const key = gradeKey(studentId, evaluationId);
      if ((state.dataset.grades[key] ?? null) === null) return;
      pushHistory(state.dataset);
      dispatch({ type: "grade", studentId, evaluationId, value: null });
      window.setTimeout(scheduleSync, 0);
    },
    [pushHistory, scheduleSync, state.dataset, readOnly],
  );

  const applyBulkGrades = useCallback((updates: Array<{ studentId: string; evaluationId: string; value: GradeValue }>) => {
    if (readOnly) {
      toast.info(readOnlyReasonRef.current || "Modo lectura: La modificación masiva no está permitida en este contexto.");
      return;
    }
    const meaningfulUpdates = updates.filter((update) => state.dataset.grades[gradeKey(update.studentId, update.evaluationId)] !== update.value);
    if (!meaningfulUpdates.length) return;
    pushHistory(state.dataset);
    dispatch({ type: "bulkGrades", updates: meaningfulUpdates });
    window.setTimeout(scheduleSync, 0);
  }, [pushHistory, scheduleSync, state.dataset, readOnly]);

  const bulkGrade = useCallback((evaluationId: string, studentIds: string[], value: GradeValue, protectExisting = true) => {
    const updates = studentIds
      .filter((studentId) => !protectExisting || state.dataset.grades[gradeKey(studentId, evaluationId)] == null)
      .map((studentId) => ({ studentId, evaluationId, value: normalizeGrade(value) }));
    applyBulkGrades(updates);
  }, [applyBulkGrades, state.dataset.grades]);

  const retrySync = useCallback(() => {
    window.setTimeout(scheduleSync, 0);
  }, [scheduleSync]);

  /* ------------------------------------------------------------------ */
  /* Navegación por celdas                                              */
  /* ------------------------------------------------------------------ */

  const focusCell = useCallback(
    (row: number, col: number) => {
      dispatch({
        type: "activeCell",
        cell: {
          row: clamp(row, 0, Math.max(0, students.length - 1)),
          col: clamp(col, 0, Math.max(0, evaluations.length - 1)),
        },
      });
    },
    [students.length, evaluations.length],
  );

  const moveCell = useCallback(
    (deltaRow: number, deltaCol: number) => {
      focusCell(state.activeCell.row + deltaRow, state.activeCell.col + deltaCol);
      dispatch({ type: "editing", editing: false });
    },
    [focusCell, state.activeCell.row, state.activeCell.col],
  );

  const jumpToCell = useCallback(
    (studentId: string, evaluationId: string) => {
      const row = students.findIndex((item) => item.student.id === studentId);
      const col = evaluations.findIndex((item) => item.id === evaluationId);

      if (row >= 0 && col >= 0) {
        dispatch({ type: "view", view: "standard" });
        focusCell(row, col);
        return;
      }

      // La celda no está visible: se limpian filtros y columnas ocultas.
      const alphabetical = [...state.dataset.students].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "es"),
      );
      const fallbackRow = Math.max(
        0,
        alphabetical.findIndex((item) => item.id === studentId),
      );
      const fallbackCol = Math.max(
        0,
        state.dataset.evaluations.findIndex((item) => item.id === evaluationId),
      );

      dispatch({ type: "filters", filters: EMPTY_FILTERS });
      dispatch({ type: "sort", sort: { key: "name", dir: "asc" } });
      dispatch({ type: "showAllEvaluations" });
      dispatch({ type: "view", view: "standard" });
      dispatch({ type: "activeCell", cell: { row: fallbackRow, col: fallbackCol } });
    },
    [students, evaluations, focusCell, state.dataset],
  );

  const jumpToStudent = useCallback(
    (studentId: string) => {
      dispatch({ type: "view", view: "standard" });
      dispatch({ type: "selectStudent", studentId });
      const row = students.findIndex((item) => item.student.id === studentId);
      if (row >= 0) {
        focusCell(row, state.activeCell.col);
        return;
      }
      const alphabetical = [...state.dataset.students].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "es"),
      );
      const fallbackRow = Math.max(
        0,
        alphabetical.findIndex((item) => item.id === studentId),
      );
      dispatch({ type: "filters", filters: EMPTY_FILTERS });
      dispatch({ type: "sort", sort: { key: "name", dir: "asc" } });
      dispatch({ type: "activeCell", cell: { row: fallbackRow, col: 0 } });
    },
    [students, focusCell, state.activeCell.col, state.dataset],
  );

  const selectAllVisible = useCallback(() => {
    const ids = students.map((item) => item.student.id);
    if (ids.length === 0 || evaluations.length === 0) {
      dispatch({ type: "selection/clear" });
      return;
    }
    if (state.selectedRows.length === ids.length && ids.length > 0) {
      dispatch({ type: "selection/clear" });
      return;
    }
    dispatch({ type: "selection/rows", ids });
    const rangeKeys = students.flatMap((item) => evaluations.map((evaluation) => gradeKey(item.student.id, evaluation.id)));
    dispatch({ type: "selection/cell", key: rangeKeys[0] ?? "", cell: { row: 0, col: 0 }, rangeKeys });
  }, [students, evaluations, state.selectedRows.length]);

  const toggleRowSelection = useCallback((studentId: string) => {
    const row = students.findIndex((item) => item.student.id === studentId);
    dispatch({ type: "selection/toggle-row", id: studentId, evaluationIds: evaluations.map((evaluation) => evaluation.id) });
    if (row >= 0) dispatch({ type: "activeCell", cell: { row, col: state.activeCell.col } });
  }, [students, evaluations, state.activeCell.col]);

  const selectCell = useCallback((cell: CellRef, studentId: string, evaluationId: string, options?: { additive?: boolean; range?: boolean }) => {
    const key = gradeKey(studentId, evaluationId);
    const from = options?.range && state.selectionAnchor ? state.selectionAnchor : undefined;
    const rangeKeys = from
      ? students.slice(Math.min(from.row, cell.row), Math.max(from.row, cell.row) + 1).flatMap((item) =>
          evaluations.slice(Math.min(from.col, cell.col), Math.max(from.col, cell.col) + 1).map((evaluation) => gradeKey(item.student.id, evaluation.id)),
        )
      : undefined;
    dispatch({ type: "selection/cell", key, cell, additive: options?.additive, rangeKeys });
    dispatch({ type: "activeCell", cell });
  }, [evaluations, state.selectionAnchor, students]);

  const clearSelection = useCallback(() => dispatch({ type: "selection/clear" }), []);

  const copySelection = useCallback(async () => {
    const cells = state.selectedCells.length ? state.selectedCells : [gradeKey(students[state.activeCell.row]?.student.id ?? "", evaluations[state.activeCell.col]?.id ?? "")];
    const coordinates = cells.map((key) => {
      const [studentId, evaluationId] = key.split("::");
      return { key, row: students.findIndex((item) => item.student.id === studentId), col: evaluations.findIndex((item) => item.id === evaluationId) };
    }).filter((item) => item.row >= 0 && item.col >= 0);
    if (!coordinates.length) return;
    const minRow = Math.min(...coordinates.map((item) => item.row));
    const maxRow = Math.max(...coordinates.map((item) => item.row));
    const minCol = Math.min(...coordinates.map((item) => item.col));
    const maxCol = Math.max(...coordinates.map((item) => item.col));
    const selected = new Set(coordinates.map((item) => `${item.row}:${item.col}`));
    const rows = Array.from({ length: maxRow - minRow + 1 }, (_, rowOffset) => Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => {
      const row = minRow + rowOffset;
      const col = minCol + colOffset;
      if (!selected.has(`${row}:${col}`)) return "";
      const studentId = students[row]?.student.id;
      const evaluationId = evaluations[col]?.id;
      return studentId && evaluationId ? (state.dataset.grades[gradeKey(studentId, evaluationId)] ?? "") : "";
    }));
    if (rows.length) {
      try {
        await navigator.clipboard.writeText(rows.map((row) => row.join("\t")).join("\n"));
      } catch {
        // El navegador puede bloquear el permiso; la edición de la matriz no debe romperse.
      }
    }
  }, [state.selectedCells, state.activeCell, state.dataset.grades, students, evaluations]);

  const previewPasteText = useCallback((sourceText: string) => {
    const lines = sourceText.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    const hasTabs = lines.some((line) => line.includes("\t"));
    const commaColumns = !hasTabs && lines.some((line) => line.split(",").length > 2 || !/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(line));
    const rows = lines.map((line) => hasTabs ? line.split("\t") : commaColumns ? line.split(",") : [line]);
    if (rows.length) dispatch({ type: "paste/preview", preview: { rows, target: state.activeCell, sourceText } });
  }, [state.activeCell]);

  const readPaste = useCallback(async () => {
    try {
      previewPasteText(await navigator.clipboard.readText());
    } catch { /* El evento paste directo sigue funcionando aunque el permiso async sea restringido. */ }
  }, [previewPasteText]);

  const applyPastePreview = useCallback(() => {
    if (readOnly) {
      toast.info(readOnlyReasonRef.current || "Modo lectura: La importación de notas no está permitida en este contexto.");
      return;
    }
    const preview = state.pastePreview;
    if (!preview) return;
    const updates: Array<{ studentId: string; evaluationId: string; value: GradeValue }> = [];
    const invalidCells: string[] = [];
    preview.rows.forEach((row, r) => row.forEach((raw, c) => {
      const student = students[preview.target.row + r]?.student;
      const evaluation = evaluations[preview.target.col + c];
      if (!student || !evaluation) return;
      const normalized = raw.trim().replace(",", ".");
      const value = normalized === "" ? null : Number(normalized);
      if (value == null || (Number.isFinite(value) && value >= 0 && value <= 5)) {
        updates.push({ studentId: student.id, evaluationId: evaluation.id, value: value == null ? null : normalizeGrade(value) });
      } else {
        invalidCells.push(`fila ${r + 1}, columna ${c + 1}`);
      }
    }));
    if (invalidCells.length > 0) {
      dispatch({ type: "paste/preview", preview: { ...preview, error: `Corrige las celdas inválidas (${invalidCells.slice(0, 3).join(", ")}${invalidCells.length > 3 ? "…" : ""}). Usa valores entre 0.0 y 5.0.` } });
      return;
    }
    applyBulkGrades(updates);
  }, [state.pastePreview, students, evaluations, applyBulkGrades, readOnly]);

  const cancelPastePreview = useCallback(() => dispatch({ type: "paste/preview", preview: null }), []);

  const clearSelectedGrades = useCallback(() => {
    if (readOnly) {
      toast.info(readOnlyReasonRef.current || "Modo lectura: La modificación de calificaciones no está permitida en este contexto.");
      return;
    }
    const keys = state.selectedCells.length ? state.selectedCells : [gradeKey(students[state.activeCell.row]?.student.id ?? "", evaluations[state.activeCell.col]?.id ?? "")];
    const updates = keys.flatMap((key) => {
      const [studentId, evaluationId] = key.split("::");
      return studentId && evaluationId ? [{ studentId, evaluationId, value: null as GradeValue }] : [];
    });
    applyBulkGrades(updates);
  }, [state.selectedCells, state.activeCell, students, evaluations, applyBulkGrades, readOnly]);

  const undo = useCallback(() => {
    if (readOnly) return;
    const before = undoStack.current.pop();
    if (!before) return;
    redoStack.current.push(state.dataset);
    dispatch({ type: "restore", dataset: before });
    window.setTimeout(scheduleSync, 0);
  }, [state.dataset, scheduleSync, readOnly]);
  const redo = useCallback(() => {
    if (readOnly) return;
    const after = redoStack.current.pop();
    if (!after) return;
    undoStack.current.push(state.dataset);
    dispatch({ type: "restore", dataset: after });
    window.setTimeout(scheduleSync, 0);
  }, [state.dataset, scheduleSync, readOnly]);

  const createEvaluation = useCallback(
    async (input: {
      name: string;
      type: EvaluationTypeId;
      date?: string;
      weight: number;
      description?: string;
      status: EvaluationStatus;
    }): Promise<{ ok: boolean; error?: string; evaluationId?: string }> => {
      if (readOnly) {
        const msg = readOnlyReasonRef.current || "Modo lectura: La creación de evaluaciones no está permitida en este contexto.";
        toast.info(msg);
        return { ok: false, error: msg };
      }
      const name = input.name.trim();
      const used = state.dataset.evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0);
      const remaining = 100 - used;
      if (!name) return { ok: false, error: "Escribe un nombre para la evaluación." };
      if (name.length < 3) return { ok: false, error: "El nombre debe tener al menos 3 caracteres." };
      if (name.length > 80) return { ok: false, error: "El nombre no puede superar 80 caracteres." };
      if (!Number.isFinite(input.weight) || input.weight < 0) return { ok: false, error: "La ponderación no puede ser negativa." };
      if (input.weight > remaining) {
        return { ok: false, error: `Solo quedan ${Math.max(0, remaining)}% disponibles. Reduce la ponderación o ajusta otra evaluación.` };
      }
      if (input.status === "active" && input.weight === 0) {
        return { ok: false, error: "Una evaluación activa necesita una ponderación mayor que 0%." };
      }

      if (persistenceRef.current?.createAssessment) {
        try {
          const typeMap: Record<string, string> = {
            quiz: "QUIZ",
            taller: "TALLER",
            examen: "EXAMEN",
            proyecto: "PROYECTO",
            participacion: "PARTICIPACION",
            exposicion: "ACTIVIDAD",
            autoevaluacion: "ACTIVIDAD",
          };
          const assessmentType = typeMap[input.type] || "TALLER";
          const serverStatus = input.status === "preparing" ? "DRAFT" : "PUBLISHED";
          const created = await persistenceRef.current.createAssessment({
            title: name,
            description: input.description?.trim() || undefined,
            assessmentType,
            date: input.date ? new Date(input.date) : new Date(),
            maxValue: 5,
            weight: Math.round(input.weight * 10) / 10,
            status: serverStatus,
          });

          if (!created || !created.id) {
            throw new Error("El servidor no devolvió el ID de la evaluación creada.");
          }

          const newId = String(created.id);
          const nextOrder = state.dataset.evaluations.reduce((max, evaluation) => Math.max(max, evaluation.order), -1) + 1;
          const nextCode = state.dataset.evaluations.reduce((max, evaluation) => Math.max(max, Number(evaluation.code.replace(/\D/g, "")) || 0), 0) + 1;

          const evaluation: Evaluation = {
            id: newId,
            code: `E${nextCode}`,
            order: nextOrder,
            name,
            shortName: name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name,
            abbrev: name.length > 12 ? `${name.slice(0, 11).trimEnd()}…` : name,
            type: input.type,
            weight: Math.round(input.weight * 10) / 10,
            date: input.date ?? new Date().toISOString().slice(0, 10),
            period: state.dataset.period,
            description: input.description?.trim() || undefined,
            dbaIds: [],
            status: input.status,
          };

          pushHistory(state.dataset);
          dispatch({ type: "evaluation/created-confirmed", evaluation });
          toast.success(`Evaluación "${evaluation.code} · ${evaluation.name}" creada.`);
          onDataSavedRef.current?.();
          return { ok: true, evaluationId: newId };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al crear la evaluación en el servidor.";
          toast.error(message);
          return { ok: false, error: message };
        }
      }

      // Fallback local
      const nextOrder = state.dataset.evaluations.reduce((max, evaluation) => Math.max(max, evaluation.order), -1) + 1;
      const nextCode = state.dataset.evaluations.reduce((max, evaluation) => Math.max(max, Number(evaluation.code.replace(/\D/g, "")) || 0), 0) + 1;
      const id = `ev-custom-${Date.now().toString(36)}`;
      const evaluation: Evaluation = {
        id,
        code: `E${nextCode}`,
        order: nextOrder,
        name,
        shortName: name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name,
        abbrev: name.length > 12 ? `${name.slice(0, 11).trimEnd()}…` : name,
        type: input.type,
        weight: Math.round(input.weight * 10) / 10,
        date: input.date ?? "",
        period: state.dataset.period,
        description: input.description?.trim() || undefined,
        dbaIds: [],
        status: input.status,
      };
      pushHistory(state.dataset);
      dispatch({ type: "createEvaluation", evaluation });
      window.setTimeout(scheduleSync, 0);
      return { ok: true, evaluationId: id };
    },
    [pushHistory, scheduleSync, state.dataset, readOnly],
  );

  const updateEvaluation = useCallback(
    async (
      evaluationId: string,
      patch: Partial<Pick<Evaluation, "name" | "shortName" | "abbrev" | "type" | "weight" | "date" | "period" | "description" | "status" | "dbaIds">>
    ): Promise<{ ok: boolean; error?: string }> => {
      if (readOnly) {
        const msg = readOnlyReasonRef.current || "Modo lectura: La edición de evaluaciones no está permitida en este contexto.";
        toast.info(msg);
        return { ok: false, error: msg };
      }
      const current = state.dataset.evaluations.find((evaluation) => evaluation.id === evaluationId);
      const nextWeight = patch.weight === undefined ? current?.weight ?? 0 : Number(patch.weight);
      const nextUsed = state.dataset.evaluations.reduce((sum, evaluation) => sum + (evaluation.id === evaluationId ? nextWeight : evaluation.weight), 0);
      if (!current) return { ok: false, error: "La evaluación ya no está disponible." };
      if (!Number.isFinite(nextWeight) || nextWeight < 0 || nextUsed > 100 || (patch.name !== undefined && !patch.name.trim())) {
        return { ok: false, error: !patch.name?.trim() && patch.name !== undefined ? "El nombre no puede estar vacío." : `La ponderación total sería ${Number.isFinite(nextUsed) ? nextUsed : "inválida"}%. El máximo permitido es 100%.` };
      }
      if (patch.name !== undefined && patch.name.trim().length < 3) {
        return { ok: false, error: "El título de la evaluación debe tener al menos 3 caracteres." };
      }

      if (persistenceRef.current?.updateAssessment) {
        try {
          const idNum = Number(evaluationId);
          const serverStatus = patch.status === "preparing" ? "DRAFT" : patch.status === "active" ? "PUBLISHED" : undefined;
          await persistenceRef.current.updateAssessment(idNum, {
            title: patch.name ? patch.name.trim() : undefined,
            description: patch.description,
            weight: patch.weight !== undefined ? Math.round(Number(patch.weight) * 10) / 10 : undefined,
            date: patch.date ? new Date(patch.date) : undefined,
            status: serverStatus,
          });
          pushHistory(state.dataset);
          dispatch({ type: "evaluation/updated-confirmed", evaluationId, patch });
          toast.success("Evaluación actualizada correctamente.");
          onDataSavedRef.current?.();
          return { ok: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al actualizar la evaluación en el servidor.";
          toast.error(message);
          return { ok: false, error: message };
        }
      }

      const changed = Object.entries(patch).some(([key, value]) => current[key as keyof Evaluation] !== value);
      if (!changed) return { ok: true };
      pushHistory(state.dataset);
      dispatch({ type: "updateEvaluation", evaluationId, patch });
      window.setTimeout(scheduleSync, 0);
      return { ok: true };
    },
    [pushHistory, scheduleSync, state.dataset, readOnly],
  );

  const removeEvaluation = useCallback(
    async (evaluationId: string): Promise<{ ok: boolean; error?: string }> => {
      if (readOnly) {
        const msg = readOnlyReasonRef.current || "Modo lectura: La eliminación de evaluaciones no está permitida en este contexto.";
        toast.info(msg);
        return { ok: false, error: msg };
      }
      const current = state.dataset.evaluations.find((evaluation) => evaluation.id === evaluationId);
      if (!current) return { ok: false, error: "Evaluación no encontrada." };

      if (persistenceRef.current?.deleteAssessment) {
        try {
          const idNum = Number(evaluationId);
          await persistenceRef.current.deleteAssessment(idNum);
          pushHistory(state.dataset);
          dispatch({ type: "evaluation/deleted-confirmed", evaluationId });
          toast.success(`Evaluación "${current.code} · ${current.name}" eliminada.`);
          onDataSavedRef.current?.();
          return { ok: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al eliminar la evaluación en el servidor.";
          toast.error(message);
          return { ok: false, error: message };
        }
      }

      pushHistory(state.dataset);
      dispatch({ type: "removeEvaluation", evaluationId });
      window.setTimeout(scheduleSync, 0);
      return { ok: true };
    },
    [pushHistory, scheduleSync, state.dataset, readOnly],
  );

  const value: GradeCenterContextValue = {
    dataset: state.dataset,
    confirmedDataset: state.confirmedDataset,
    draftChanges: state.drafts,
    preferences: state.preferences,
    sync: state.sync,
    analytics,
    readOnly,
    readOnlyReason: readOnlyReasonRef.current,
    availableAssignments,
    onSelectAssignment,
    students,
    evaluations,
    activeCell: state.activeCell,
    editing: state.editing,
    selectedStudentId: state.selectedStudentId,
    selectedEvaluationId: state.selectedEvaluationId,
    pulse: state.pulse,
    selectedRows: state.selectedRows,
    selectedCells: state.selectedCells,
    selectionAnchor: state.selectionAnchor,
    pastePreview: state.pastePreview,
    gradeAt: (studentId, evaluationId) =>
      state.dataset.grades[gradeKey(studentId, evaluationId)] ?? null,
    commentAt: (studentId, evaluationId) =>
      state.dataset.comments[gradeKey(studentId, evaluationId)] ?? "",
    weightIntegrity: (() => {
      const used = state.dataset.evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0);
      return { used, remaining: 100 - used, status: used > 100 ? "exceeded" : used === 100 ? "valid" : "incomplete" };
    })(),
    isCellSelected: (row, col, studentId, evaluationId) => state.selectedCells.includes(gradeKey(studentId, evaluationId)) || state.selectedRows.includes(studentId),
    selectAllVisible,
    toggleRowSelection,
    selectCell,
    clearSelection,
    copySelection,
    readPaste,
    previewPasteText,
    applyPastePreview,
    bulkGrade,
    cancelPastePreview,
    clearSelectedGrades,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    columnWidth: (evaluationId) => columnWidthOf(state.preferences, evaluationId),
    setView: (view) => dispatch({ type: "view", view }),
    setDensity: (density) => dispatch({ type: "density", density }),
    resizeColumn: (evaluationId, width) => dispatch({ type: "columnWidth", evaluationId, width }),
    resizeStudentColumn: (width) => dispatch({ type: "studentColumnWidth", width }),
    resizeDefinitivaColumn: (width) => dispatch({ type: "definitivaColumnWidth", width }),
    toggleEvaluation: (evaluationId) => dispatch({ type: "toggleEvaluation", evaluationId }),
    showAllEvaluations: () => dispatch({ type: "showAllEvaluations" }),
    setSort: (sort) => dispatch({ type: "sort", sort }),
    setFilters: (filters) => dispatch({ type: "filters", filters }),
    setFocusMode: (focusMode) => dispatch({ type: "focus", focusMode }),
    setQuickEdit: (quickEdit) => dispatch({ type: "quickEdit", quickEdit }),
    setAnalysisOpen: (analysisOpen) => dispatch({ type: "analysis", open: analysisOpen }),
    setShowCodes: (showCodes) => dispatch({ type: "showCodes", show: showCodes }),
    resetAllPreferences: () => dispatch({ type: "resetPreferences" }),
    setActiveCell: (cell) => dispatch({ type: "activeCell", cell }),
    setEditing: (editing) => dispatch({ type: "editing", editing }),
    focusCell,
    moveCell,
    selectStudent: (studentId) => dispatch({ type: "selectStudent", studentId }),
    selectEvaluation: (evaluationId) => dispatch({ type: "selectEvaluation", evaluationId }),
    createEvaluation,
    updateEvaluation,
    removeEvaluation,
    commitGrade,
    clearGrade,
    jumpToCell,
    jumpToStudent,
    retrySync,
  };

  return <GradeCenterContext.Provider value={value}>{children}</GradeCenterContext.Provider>;
}

export function useGradeCenter(): GradeCenterContextValue {
  const context = useContext(GradeCenterContext);
  if (!context) {
    throw new Error("useGradeCenter debe usarse dentro de <GradeCenterProvider>");
  }
  return context;
}

export { STUDENT_COLUMN_WIDTH, DEFINITIVA_COLUMN_WIDTH, DEFAULT_PREFERENCES };

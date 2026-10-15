import { describe, expect, it } from "vitest";
import {
  createInitialState,
  gradeCenterReducer,
  type DraftChange,
  type State,
} from "./GradeCenterContext";
import type { Dataset, Evaluation } from "../types";

const mockDataset: Dataset = {
  key: "test-course-subject-p1",
  subject: {
    id: "sub-1",
    name: "Matemáticas",
    code: "MAT-9",
    grade: "9",
    area: "Ciencias Exactas",
    academicPeriod: "Periodo 1",
  },
  group: {
    id: "grp-1",
    name: "9-A",
    room: "Aula 201",
    director: "Profe Prueba",
  },
  students: [
    {
      id: "std-1",
      code: "STD001",
      number: 1,
      fullName: "Ana Gómez",
      document: "12345678",
      status: "active",
      tags: [],
    },
    {
      id: "std-2",
      code: "STD002",
      number: 2,
      fullName: "Bernardo Ruiz",
      document: "87654321",
      status: "active",
      tags: [],
    },
  ],
  evaluations: [
    {
      id: "eval-1",
      code: "E1",
      order: 0,
      name: "Taller 1",
      shortName: "Taller 1",
      abbrev: "T1",
      type: "taller",
      weight: 30,
      date: "2026-03-01",
      period: "1",
      dbaIds: [],
    },
    {
      id: "eval-2",
      code: "E2",
      order: 1,
      name: "Examen 1",
      shortName: "Examen 1",
      abbrev: "EX1",
      type: "examen",
      weight: 40,
      date: "2026-03-15",
      period: "1",
      dbaIds: [],
    },
  ],
  grades: {
    "std-1::eval-1": 4.5,
    "std-2::eval-1": 3.8,
  },
  comments: {},
  dbas: [],
};

describe("Grade Center — Reducer de persistencia y concurrencia", () => {
  it("inicia en modo lectura con sync sincronizado y 0 pendientes", () => {
    const state = createInitialState(mockDataset, true);
    expect(state.sync.status).toBe("synced");
    expect(state.sync.pending).toBe(0);
    expect(Object.keys(state.drafts).length).toBe(0);
  });

  it("registra un cambio individual de nota en drafts y actualiza el dataset local", () => {
    const state = createInitialState(mockDataset, false);
    const next = gradeCenterReducer(state, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.8,
      comment: "Mejora",
    });

    expect(next.dataset.grades["std-1::eval-1"]).toBe(4.8);
    expect(next.drafts["std-1::eval-1"]).toEqual({
      kind: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.8,
      comment: "Mejora",
    });
    expect(next.sync.status).toBe("pending");
    expect(next.sync.pending).toBe(1);
  });

  it("registra múltiples cambios en masa (bulkGrades) sin perder borradores previos", () => {
    const state = createInitialState(mockDataset, false);
    const withFirst = gradeCenterReducer(state, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 5.0,
    });

    const withBulk = gradeCenterReducer(withFirst, {
      type: "bulkGrades",
      updates: [
        { studentId: "std-2", evaluationId: "eval-1", value: 4.0 },
        { studentId: "std-1", evaluationId: "eval-2", value: 3.5 },
      ],
    });

    expect(withBulk.dataset.grades["std-1::eval-1"]).toBe(5.0);
    expect(withBulk.dataset.grades["std-2::eval-1"]).toBe(4.0);
    expect(withBulk.dataset.grades["std-1::eval-2"]).toBe(3.5);
    expect(Object.keys(withBulk.drafts).length).toBe(3);
    expect(withBulk.sync.pending).toBe(3);
  });

  it("limpia el borrador al recibir confirmación del servidor (sync/confirmed-batch) si no cambió", () => {
    const state = createInitialState(mockDataset, false);
    const stateWithDraft = gradeCenterReducer(state, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.8,
      comment: "Guardado",
    });

    const savedDrafts: Record<string, DraftChange> = {
      "std-1::eval-1": {
        kind: "grade",
        studentId: "std-1",
        evaluationId: "eval-1",
        value: 4.8,
        comment: "Guardado",
      },
    };

    const stateConfirmed = gradeCenterReducer(stateWithDraft, {
      type: "sync/confirmed-batch",
      savedDrafts,
    });

    // El borrador debe haberse consumido porque su valor no varió en vuelo
    expect(stateConfirmed.drafts["std-1::eval-1"]).toBeUndefined();
    expect(stateConfirmed.sync.pending).toBe(0);
    // Y el dataset confirmado se actualiza al valor aceptado
    expect(stateConfirmed.confirmedDataset.grades["std-1::eval-1"]).toBe(4.8);
  });

  it("PROTECCIÓN DE CONCURRENCIA: conserva el borrador si el usuario tecleó una nota más reciente en vuelo", () => {
    const state = createInitialState(mockDataset, false);
    // 1. El usuario digitó 4.0
    const stateFlight1 = gradeCenterReducer(state, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.0,
    });

    // 2. Se envió { value: 4.0 } al servidor en la instantánea
    const snapshotSaved: Record<string, DraftChange> = {
      "std-1::eval-1": {
        kind: "grade",
        studentId: "std-1",
        evaluationId: "eval-1",
        value: 4.0,
      },
    };

    // 3. Mientras el servidor procesaba, el usuario corrigió rápidamente a 4.9
    const stateFlight2 = gradeCenterReducer(stateFlight1, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.9,
    });

    // 4. El servidor responde confirmando el 4.0 antiguo
    const stateAfterServerResponse = gradeCenterReducer(stateFlight2, {
      type: "sync/confirmed-batch",
      savedDrafts: snapshotSaved,
    });

    // ¡CRÍTICO!: El borrador 4.9 NO debe borrarse, debe mantenerse pendiente para el próximo batch!
    expect(stateAfterServerResponse.drafts["std-1::eval-1"]).toBeDefined();
    expect(stateAfterServerResponse.drafts["std-1::eval-1"]?.value).toBe(4.9);
    expect(stateAfterServerResponse.dataset.grades["std-1::eval-1"]).toBe(4.9);
    expect(stateAfterServerResponse.sync.pending).toBe(1);
  });

  it("en caso de error de red (sync/error), no pierde ningún borrador y notifica el error", () => {
    const state = createInitialState(mockDataset, false);
    const withDraft = gradeCenterReducer(state, {
      type: "grade",
      studentId: "std-1",
      evaluationId: "eval-1",
      value: 4.2,
    });

    const withError = gradeCenterReducer(withDraft, {
      type: "sync/error",
      message: "Fallo de conexión con EduCore API",
    });

    expect(withError.sync.status).toBe("error");
    expect(withError.sync.lastError).toBe("Fallo de conexión con EduCore API");
    // Todos los borradores deben permanecer intactos para reintentar
    expect(withError.drafts["std-1::eval-1"]).toBeDefined();
    expect(withError.drafts["std-1::eval-1"]?.value).toBe(4.2);
    expect(withError.sync.pending).toBe(1);
  });

  it("elimina una evaluación confirmada y limpia sus notas asociadas sin afectar otras", () => {
    const state = createInitialState(mockDataset, false);
    const afterDelete = gradeCenterReducer(state, {
      type: "evaluation/deleted-confirmed",
      evaluationId: "eval-1",
    });

    expect(afterDelete.dataset.evaluations.some((e) => e.id === "eval-1")).toBe(false);
    expect(afterDelete.confirmedDataset.evaluations.some((e) => e.id === "eval-1")).toBe(false);
    // Notas de eval-1 eliminadas
    expect(afterDelete.dataset.grades["std-1::eval-1"]).toBeUndefined();
    expect(afterDelete.dataset.grades["std-2::eval-1"]).toBeUndefined();
    // Evaluación 2 sigue intacta
    expect(afterDelete.dataset.evaluations.some((e) => e.id === "eval-2")).toBe(true);
  });
});

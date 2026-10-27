import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { BulkGradeDialog } from "./BulkGradeDialog";
import { DeleteEvaluationDialog } from "./DeleteEvaluationDialog";
import { EvaluationFormDialog } from "./EvaluationFormDialog";
import { PastePreviewDialog } from "./PastePreviewDialog";

type DialogRequest =
  | { kind: "new" }
  | { kind: "bulk"; evaluationId?: string }
  | { kind: "edit"; evaluationId: string }
  | { kind: "delete"; evaluationId: string };

export interface GradeCenterDialogs {
  openNewEvaluation: () => void;
  openBulkGrade: (evaluationId?: string) => void;
  openEditEvaluation: (evaluationId: string) => void;
  openDeleteEvaluation: (evaluationId: string) => void;
}

const DialogsContext = createContext<GradeCenterDialogs | null>(null);

/**
 * Un único punto de montaje para los modales de la planilla. Antes cada
 * columna montaba su propio par de diálogos; ahora existe uno solo a la vez y
 * se remonta (key) en cada apertura para empezar siempre con datos frescos.
 */
export function GradeCenterDialogsProvider({ children }: { children: ReactNode }) {
  const { dataset } = useGradeCenter();
  const [state, setState] = useState<{ request: DialogRequest; open: boolean; seq: number } | null>(null);

  const show = useCallback((request: DialogRequest) => {
    setState((current) => ({ request, open: true, seq: (current?.seq ?? 0) + 1 }));
  }, []);

  const api = useMemo<GradeCenterDialogs>(
    () => ({
      openNewEvaluation: () => show({ kind: "new" }),
      openBulkGrade: (evaluationId) => show({ kind: "bulk", evaluationId }),
      openEditEvaluation: (evaluationId) => show({ kind: "edit", evaluationId }),
      openDeleteEvaluation: (evaluationId) => show({ kind: "delete", evaluationId }),
    }),
    [show],
  );

  // Se cierra sin desmontar para conservar la animación de salida.
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setState((current) => (current ? { ...current, open: false } : current));
  }, []);

  const request = state?.request;
  const evaluation =
    request && "evaluationId" in request && request.kind !== "bulk"
      ? dataset.evaluations.find((item) => item.id === request.evaluationId)
      : undefined;
  const open = Boolean(state?.open);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {request?.kind === "new" && <EvaluationFormDialog key={state!.seq} open={open} onOpenChange={onOpenChange} />}
      {request?.kind === "edit" && evaluation && (
        <EvaluationFormDialog key={state!.seq} open={open} onOpenChange={onOpenChange} evaluation={evaluation} />
      )}
      {request?.kind === "delete" && evaluation && (
        <DeleteEvaluationDialog key={state!.seq} open={open} onOpenChange={onOpenChange} evaluation={evaluation} />
      )}
      {request?.kind === "bulk" && (
        <BulkGradeDialog key={state!.seq} open={open} onOpenChange={onOpenChange} initialEvaluationId={request.evaluationId} />
      )}
      <PastePreviewDialog />
    </DialogsContext.Provider>
  );
}

export function useGradeCenterDialogs(): GradeCenterDialogs {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("useGradeCenterDialogs debe usarse dentro de <GradeCenterDialogsProvider>");
  return context;
}

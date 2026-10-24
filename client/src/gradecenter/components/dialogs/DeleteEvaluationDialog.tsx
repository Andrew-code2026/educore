import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGradeCenter } from "../../state/GradeCenterContext";
import type { Evaluation } from "../../types";
import { ActionButton } from "./parts";

export function DeleteEvaluationDialog({
  open,
  onOpenChange,
  evaluation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: Evaluation;
}) {
  const { removeEvaluation, analytics } = useGradeCenter();
  const [busy, setBusy] = useState(false);
  const graded = analytics.byEvaluation.get(evaluation.id)?.gradedCount ?? 0;

  const confirm = async () => {
    setBusy(true);
    const result = await removeEvaluation(evaluation.id);
    setBusy(false);
    if (result.ok) onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="glass-strong rounded-2xl border-white/12 sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">
            ¿Eliminar {evaluation.code} · {evaluation.name}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {graded > 0
              ? `Tiene ${graded} ${graded === 1 ? "calificación registrada" : "calificaciones registradas"}. Dejará de contar en la definitiva y se liberará su ${evaluation.weight}% de ponderación; las notas quedan archivadas para auditoría.`
              : `Se liberará su ${evaluation.weight}% de ponderación. No tiene calificaciones registradas.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="rounded-xl">
            Cancelar
          </AlertDialogCancel>
          <ActionButton tone="danger" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Eliminar evaluación
          </ActionButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

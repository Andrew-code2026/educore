import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Save, Trash2, X } from "lucide-react";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingGradesCount: number;
  pendingCommentsCount: number;
  isSaving: boolean;
  onSaveAndContinue: () => Promise<void>;
  onDiscardAndContinue: () => void;
  destinationLabel?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onClose,
  pendingGradesCount,
  pendingCommentsCount,
  isSaving,
  onSaveAndContinue,
  onDiscardAndContinue,
  destinationLabel,
}: UnsavedChangesDialogProps) {
  const totalPending = pendingGradesCount + pendingCommentsCount;

  // Si no está abierto o no hay cambios pendientes reales (0 cambios), no renderizar nada
  if (!isOpen || totalPending <= 0) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={open => !open && !isSaving && onClose()}>
      <AlertDialogContent className="rounded-2xl border-slate-200/90 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-xl sm:max-w-[500px] w-[95vw] shadow-2xl p-6 sm:p-7 overflow-hidden">
        <AlertDialogHeader className="space-y-3.5 text-left">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-8 ring-amber-500/5 dark:bg-amber-500/20 dark:text-amber-400 dark:ring-amber-500/10">
              <AlertTriangle className="h-6 w-6 stroke-[2.25]" />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                Cambios pendientes sin guardar
              </AlertDialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {destinationLabel
                  ? `Intentas salir hacia: ${destinationLabel}`
                  : "Estás a punto de salir del Grade Center"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Tienes {totalPending} cambio{totalPending === 1 ? "" : "s"} sin guardar en el libro de calificaciones:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {pendingGradesCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-800/90 font-medium text-slate-800 dark:text-slate-200 border border-amber-200/50 dark:border-amber-900/30">
                  {pendingGradesCount} nota{pendingGradesCount === 1 ? "" : "s"}
                </span>
              )}
              {pendingCommentsCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-800/90 font-medium text-slate-800 dark:text-slate-200 border border-amber-200/50 dark:border-amber-900/30">
                  {pendingCommentsCount} comentario{pendingCommentsCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            El guardado automático se encuentra desactivado. Si decides salir o cambiar de vista sin guardar, estas modificaciones se perderán definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-5 mt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 h-9 px-3 w-full sm:w-auto"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onDiscardAndContinue}
              disabled={isSaving}
              className="rounded-xl border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 h-9 px-3.5 w-full sm:w-auto"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
              Descartar cambios
            </Button>

            <Button
              type="button"
              onClick={onSaveAndContinue}
              disabled={isSaving}
              className="rounded-xl bg-[var(--edc-primary)] hover:bg-[var(--edc-primary)]/90 text-white text-xs font-semibold shadow-xs h-9 px-4 w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Guardar y salir
                </>
              )}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

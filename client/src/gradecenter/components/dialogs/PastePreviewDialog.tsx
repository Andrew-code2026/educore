import { ClipboardPaste } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { ActionButton, DIALOG_CONTENT_CLASS, DialogFooterBar, DialogHeaderBar, FormError } from "./parts";

const PREVIEW_LIMIT = 8;

/** Vista previa antes de pegar notas desde Excel o Sheets: nada se escribe sin confirmar. */
export function PastePreviewDialog() {
  const { pastePreview, applyPastePreview, cancelPastePreview, students, evaluations } = useGradeCenter();
  const rows = pastePreview?.rows ?? [];
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const target = pastePreview?.target;
  const firstStudent = target ? students[target.row]?.student.fullName : undefined;
  const firstEvaluation = target ? evaluations[target.col] : undefined;

  return (
    <Dialog open={Boolean(pastePreview)} onOpenChange={(open) => !open && cancelPastePreview()}>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT_CLASS}>
        <DialogHeaderBar
          icon={<ClipboardPaste className="size-4" />}
          title="Pegar notas"
          description={
            firstStudent && firstEvaluation
              ? `${rows.length} × ${columns} desde ${firstStudent} en ${firstEvaluation.code}.`
              : `${rows.length} × ${columns} celdas desde el portapapeles.`
          }
        />
        <div className="space-y-3 px-5 py-4">
          <div className="gc-scroll max-h-56 overflow-auto rounded-xl border border-white/8">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.slice(0, PREVIEW_LIMIT).map((value, colIndex) => (
                      <td key={colIndex} className="gc-num border-r border-b border-white/8 px-2 py-1.5 text-center">
                        {value || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(rows.length > PREVIEW_LIMIT || columns > PREVIEW_LIMIT) && (
            <p className="text-xs text-muted-foreground">Se muestran las primeras {PREVIEW_LIMIT} filas y columnas.</p>
          )}
          {pastePreview?.error && <FormError>{pastePreview.error}</FormError>}
        </div>
        <DialogFooterBar>
          <ActionButton onClick={cancelPastePreview}>Cancelar</ActionButton>
          <ActionButton tone="primary" autoFocus onClick={applyPastePreview} disabled={Boolean(pastePreview?.error)}>
            Pegar notas
          </ActionButton>
        </DialogFooterBar>
      </DialogContent>
    </Dialog>
  );
}

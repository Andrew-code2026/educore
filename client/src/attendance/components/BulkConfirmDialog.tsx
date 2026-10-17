/** Confirmación previa a las acciones masivas que modifican varios registros. */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Undo2 } from "lucide-react";

export interface BulkConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  affected: number;
  apply: () => void;
}

interface BulkConfirmDialogProps {
  request: BulkConfirmRequest | null;
  onClose: () => void;
}

export function BulkConfirmDialog({ request, onClose }: BulkConfirmDialogProps) {
  return (
    <AlertDialog open={Boolean(request)} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent className="glass-strong max-w-[400px] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[15px]">{request?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[12.5px] leading-relaxed">
            {request?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-2.5 py-2 text-[11.5px] text-muted-foreground ring-1 ring-inset ring-hairline">
          <Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Podrás deshacerlo con Ctrl/Cmd + Z desde la toolbar.
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 rounded-[10px] text-[12px]">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="h-8 rounded-[10px] bg-brand text-[12px] font-semibold text-brand-foreground hover:bg-brand/90"
            onClick={() => {
              request?.apply();
              onClose();
            }}
          >
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles, Undo2 } from "lucide-react";
import type { TurnMark } from "./turnReview";

interface TurnReviewBarProps {
  summary: string;
  /** Los bloques que siguen marcados, en el orden de la hoja. */
  pending: TurnMark[];
  undoing: boolean;
  onReveal: (blockId: string) => void;
  onUndo: () => void;
  onSeen: () => void;
}

/**
 * El resumen del último turno de la IA, encima de la hoja: qué cambió, recorrerlo, deshacerlo o
 * darlo por visto. Va dentro de `StageTop`, que lo deja pegado arriba al desplazar.
 */
export function TurnReviewBar({ summary, pending, undoing, onReveal, onUndo, onSeen }: TurnReviewBarProps) {
  const [current, setCurrent] = useState<string | null>(null);
  const position = current ? pending.findIndex(mark => mark.id === current) : -1;

  const step = (delta: 1 | -1) => {
    if (pending.length === 0) return;
    const next = position === -1 ? (delta === 1 ? 0 : pending.length - 1) : (position + delta + pending.length) % pending.length;
    setCurrent(pending[next].id);
    onReveal(pending[next].id);
  };

  return (
    <div className="crt-review" role="status">
      <Sparkles aria-hidden="true" />
      <span className="crt-review__text">{summary}</span>
      {pending.length > 0 && (
        <span className="crt-review__nav" role="group" aria-label="Recorrer los cambios">
          <button type="button" aria-label="Cambio anterior" title="Cambio anterior" onClick={() => step(-1)}>
            <ChevronUp aria-hidden="true" />
          </button>
          <span>{position === -1 ? `${pending.length} por ver` : `${position + 1} de ${pending.length}`}</span>
          <button type="button" aria-label="Cambio siguiente" title="Cambio siguiente" onClick={() => step(1)}>
            <ChevronDown aria-hidden="true" />
          </button>
        </span>
      )}
      <span className="crt-review__actions">
        <button type="button" disabled={undoing} title="El recurso vuelve a como estaba antes de este turno" onClick={onUndo}>
          {undoing ? <Loader2 className="crt-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
          Deshacer
        </button>
        <button type="button" title="Quita las marcas de la hoja" onClick={onSeen}>
          <Check aria-hidden="true" />
          Visto
        </button>
      </span>
    </div>
  );
}

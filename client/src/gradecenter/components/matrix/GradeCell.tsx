import { memo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGradeCenterActions } from "../../state/GradeCenterContext";
import { isApproved, levelFromScore, levelTint, LEVELS } from "../../domain/scale";
import { parseGradeInput } from "../../domain/grading";
import { formatGrade } from "../../lib/format";
import type { Evaluation, GradeValue, Student } from "../../types";
import { GradePopover } from "../popovers/GradePopover";

export interface GradeCellProps {
  student: Student;
  evaluation: Evaluation;
  grade: GradeValue;
  rowIndex: number;
  colIndex: number;
  height: number;
  compact: boolean;
  isActive: boolean;
  isEditing: boolean;
  isSelected: boolean;
  /** Marca de tiempo del último guardado en esta celda (0 si no aplica). */
  pulseAt: number;
  editorOpen: boolean;
  quickEdit: boolean;
  readOnly: boolean;
  onOpenEditor: (studentId: string, evaluationId: string) => void;
  onCloseEditor: () => void;
  onMoveEditor: (row: number, col: number, deltaRow: number, deltaCol: number) => void;
}

/**
 * Celda de calificación.
 *
 *  · clic selecciona y abre el editor (o edita en la celda con "edición en la celda")
 *  · escribir un número edita directamente · doble clic, F2 o Espacio editan
 *  · Enter confirma y baja · Tab confirma y avanza · flechas navegan sin editar
 *  · Esc cancela sin guardar · Supr/Retroceso deja la evaluación pendiente
 *
 * Es un componente memorizado: moverse por la matriz solo repinta la celda que
 * pierde el foco y la que lo gana.
 */
export const GradeCell = memo(function GradeCell({
  student,
  evaluation,
  grade,
  rowIndex,
  colIndex,
  height,
  compact,
  isActive,
  isEditing,
  isSelected,
  pulseAt,
  editorOpen,
  quickEdit,
  readOnly,
  onOpenEditor,
  onCloseEditor,
  onMoveEditor,
}: GradeCellProps) {
  const actions = useGradeCenterActions();
  const [seed, setSeed] = useState<string | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const skipBlurCommitRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const level = levelFromScore(grade);

  const beginEditing = (initial?: string) => {
    if (readOnly) return;
    setSeed(initial ?? null);
    actions.setEditing(true);
  };

  /** Devuelve false si el valor no es válido para que el editor siga abierto. */
  const commit = (raw: string): boolean => {
    const parsed = parseGradeInput(raw);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return false;
    }
    if (parsed.value == null) actions.clearGrade(student.id, evaluation.id);
    else actions.commitGrade(student.id, evaluation.id, parsed.value);
    return true;
  };

  const finishEditing = (raw: string, deltaRow: number, deltaCol: number) => {
    skipBlurCommitRef.current = true;
    if (!commit(raw)) {
      skipBlurCommitRef.current = false;
      return;
    }
    actions.setEditing(false);
    actions.focusCell(rowIndex + deltaRow, colIndex + deltaCol);
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    const { key } = event;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Escritura directa: cualquier dígito abre el editor con ese valor.
    if (/^[0-9]$/.test(key) || key === "." || key === ",") {
      event.preventDefault();
      beginEditing(key === "," ? "." : key);
      return;
    }

    const moves: Record<string, [number, number]> = {
      Enter: [1, 0],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      Tab: [0, event.shiftKey ? -1 : 1],
    };
    const move = moves[key];
    if (move) {
      event.preventDefault();
      actions.focusCell(rowIndex + move[0], colIndex + move[1]);
      return;
    }

    switch (key) {
      case "F2":
      case " ":
        event.preventDefault();
        beginEditing();
        break;
      case "Backspace":
      case "Delete":
        event.preventDefault();
        if (isSelected) actions.clearSelectedGrades();
        else if (grade != null) actions.clearGrade(student.id, evaluation.id);
        break;
      case "Escape":
        event.preventDefault();
        actions.clearSelection();
        break;
      default:
        break;
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if (key === "Enter") {
      event.preventDefault();
      finishEditing(event.currentTarget.value, event.shiftKey ? -1 : 1, 0);
    } else if (key === "Tab") {
      event.preventDefault();
      finishEditing(event.currentTarget.value, 0, event.shiftKey ? -1 : 1);
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      finishEditing(event.currentTarget.value, key === "ArrowDown" ? 1 : -1, 0);
    } else if (key === "Escape") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      actions.setEditing(false);
      cellRef.current?.focus({ preventScroll: true });
    }
  };

  const cell = (
    <div
      ref={cellRef}
      role="gridcell"
      aria-rowindex={rowIndex + 2}
      aria-colindex={colIndex + 2}
      aria-selected={isSelected || undefined}
      aria-label={`${student.fullName}, ${evaluation.name}: ${grade == null ? "pendiente" : formatGrade(grade)}`}
      tabIndex={isActive ? 0 : -1}
      data-cell={`${rowIndex}:${colIndex}`}
      onFocus={() => {
        if (!isActiveRef.current) actions.setActiveCell({ row: rowIndex, col: colIndex });
      }}
      onPaste={(event) => {
        event.preventDefault();
        actions.previewPasteText(event.clipboardData.getData("text/plain"));
      }}
      onClick={(event) => {
        const additive = event.metaKey || event.ctrlKey;
        actions.selectCell({ row: rowIndex, col: colIndex }, student.id, evaluation.id, {
          additive,
          range: event.shiftKey,
        });
        if (additive || event.shiftKey || readOnly) return;
        if (quickEdit) beginEditing();
        else onOpenEditor(student.id, evaluation.id);
      }}
      onDoubleClick={() => beginEditing()}
      onKeyDown={handleCellKeyDown}
      className={cn(
        "gc-cell relative flex h-full w-full cursor-default items-center justify-center outline-none",
        isActive && "gc-cell-active",
        isSelected && "gc-cell-selected",
      )}
      style={grade != null ? { backgroundColor: levelTint(level ?? "basico", isActive ? 0.2 : 0.07) } : undefined}
    >
      {pulseAt > 0 && (
        <span
          key={pulseAt}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-[gc-fade_0.7s_ease-out_reverse_both]"
          style={{ backgroundColor: levelTint(level ?? "basico", 0.4) }}
        />
      )}
      {grade == null ? (
        <span aria-hidden className={cn("gc-num relative select-none text-muted-foreground/45", compact ? "text-xs" : "text-sm")}>
          –
        </span>
      ) : (
        <span
          className={cn("gc-num relative font-semibold tabular-nums", compact ? "text-xs" : "text-[13.5px]")}
          style={{ color: LEVELS[level ?? "basico"].color }}
        >
          {formatGrade(grade)}
        </span>
      )}
      {grade != null && !isApproved(grade) && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-1/2 h-[2px] w-3.5 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: LEVELS.bajo.color, opacity: 0.6 }}
        />
      )}
    </div>
  );

  return (
    <td className="gc-hair-v relative p-0 align-middle" style={{ height }}>
      {isEditing ? (
        <input
          key={`editor-${seed ?? "current"}`}
          autoFocus
          defaultValue={seed ?? (grade != null ? formatGrade(grade) : "")}
          onFocus={(event) => {
            if (seed == null) event.currentTarget.select();
          }}
          inputMode="decimal"
          aria-label={`Nota de ${student.fullName} en ${evaluation.name}`}
          onChange={(event) => {
            const next = event.currentTarget.value.replace(/[^0-9.,]/g, "").slice(0, 4);
            if (next !== event.currentTarget.value) event.currentTarget.value = next;
          }}
          onKeyDown={handleInputKeyDown}
          onBlur={(event) => {
            if (skipBlurCommitRef.current) skipBlurCommitRef.current = false;
            else commit(event.currentTarget.value);
            actions.setEditing(false);
          }}
          className="gc-input gc-num absolute inset-[2px] z-20 w-[calc(100%-4px)] rounded-lg text-center text-[13px] font-semibold text-foreground outline-none"
        />
      ) : (
        cell
      )}
      {editorOpen && !isEditing && (
        <GradePopover
          student={student}
          evaluation={evaluation}
          grade={grade}
          comment={actions.commentAt(student.id, evaluation.id)}
          anchor={<span aria-hidden className="pointer-events-none absolute inset-0" />}
          onClose={onCloseEditor}
          onSave={(value, note) => actions.commitGrade(student.id, evaluation.id, value, note)}
          onMove={(deltaRow, deltaCol) => onMoveEditor(rowIndex, colIndex, deltaRow, deltaCol)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Solo se devuelve el foco si el docente no lo llevó a otro lugar.
            const active = document.activeElement;
            if (isActiveRef.current && (!active || active === document.body)) {
              cellRef.current?.focus({ preventScroll: true });
            }
          }}
        />
      )}
    </td>
  );
});

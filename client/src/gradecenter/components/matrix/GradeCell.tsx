import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { levelFromScore, levelTint, LEVELS, isApproved } from "../../domain/scale";
import { formatGrade } from "../../lib/format";
import type { EvaluationMetric, StudentMetrics } from "../../domain/metrics";
import type { Evaluation, LevelId } from "../../types";
import { GradePopover } from "../popovers/GradePopover";
import { announcePopover } from "../popovers/exclusivePopover";

interface GradeCellProps {
  metrics: StudentMetrics;
  evaluation: Evaluation;
  evaluationMetric: EvaluationMetric;
  rowIndex: number;
  colIndex: number;
  height: number;
  compact: boolean;
}

/**
 * Celda de calificación.
 *
 * Reglas de interacción:
 *  · clic selecciona · doble clic o F2 editan · escribir directamente edita
 *  · Enter confirma y baja · Tab confirma y avanza · flechas navegan sin editar
 *  · Esc cancela sin guardar · Backspace deja la evaluación pendiente
 * El usuario nunca queda atrapado: siempre hay salida por teclado o clic.
 */
export function GradeCell({
  metrics,
  evaluation,
  evaluationMetric,
  rowIndex,
  colIndex,
  height,
  compact,
}: GradeCellProps) {
  const { gradeAt, commentAt, preferences, activeCell, editing, setActiveCell, setEditing, focusCell, commitGrade, clearGrade, clearSelectedGrades, selectCell, isCellSelected, previewPasteText, pulse } =
    useGradeCenter();

  const student = metrics.student;
  const grade = gradeAt(student.id, evaluation.id);
  const comment = commentAt(student.id, evaluation.id);
  const level = levelFromScore(grade);
  const levelId: LevelId = level ?? "basico";
  const isActive = activeCell.row === rowIndex && activeCell.col === colIndex;
  const isEditing = isActive && editing;
  const isPulsing = pulse?.key === `${student.id}::${evaluation.id}`;
  const isSelected = isCellSelected(rowIndex, colIndex, student.id, evaluation.id);
  const [seed, setSeed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) setSeed(null);
  }, [isEditing]);

  const beginEditing = (initial?: string) => {
    setSeed(initial ?? null);
    setEditing(true);
  };

  const sanitize = (raw: string): string => {
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const [head, ...rest] = cleaned.split(".");
    const value = rest.length > 0 ? `${head}.${rest.join("")}` : head;
    return value.slice(0, 4);
  };

  const commit = (raw: string) => {
    const sanitized = sanitize(raw);
    if (sanitized === "" || sanitized === ".") {
      if (grade != null) clearGrade(student.id, evaluation.id);
      return;
    }
    const parsed = Number.parseFloat(sanitized);
    if (Number.isNaN(parsed)) return;
    commitGrade(student.id, evaluation.id, parsed);
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    const { key } = event;

    // Escritura directa: cualquier dígito abre el editor con ese valor.
    if (/^[0-9]$/.test(key) || key === "." || key === ",") {
      event.preventDefault();
      beginEditing(key === "," ? "." : key);
      return;
    }

    switch (key) {
      case "Enter":
        event.preventDefault();
        focusCell(rowIndex + 1, colIndex);
        break;
      case "Tab":
        event.preventDefault();
        focusCell(rowIndex, colIndex + (event.shiftKey ? -1 : 1));
        break;
      case "ArrowDown":
        event.preventDefault();
        focusCell(rowIndex + 1, colIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusCell(Math.max(0, rowIndex - 1), colIndex);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusCell(rowIndex, colIndex + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusCell(rowIndex, Math.max(0, colIndex - 1));
        break;
      case "F2":
        event.preventDefault();
        beginEditing();
        break;
      case "Backspace":
      case "Delete":
        event.preventDefault();
        if (isSelected) clearSelectedGrades();
        else if (grade != null) clearGrade(student.id, evaluation.id);
        break;
      case " ":
        event.preventDefault();
        beginEditing();
        break;
      case "Escape":
        event.preventDefault();
        (event.currentTarget as HTMLElement).blur();
        break;
      default:
        break;
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if (key === "Enter") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      commit(event.currentTarget.value);
      setEditing(false);
      focusCell(rowIndex + 1, colIndex);
      return;
    }
    if (key === "Tab") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      commit(event.currentTarget.value);
      setEditing(false);
      focusCell(rowIndex, colIndex + (event.shiftKey ? -1 : 1));
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      setEditing(false);
      inputRef.current?.blur();
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      commit(event.currentTarget.value);
      setEditing(false);
      focusCell(rowIndex + (key === "ArrowDown" ? 1 : -1), colIndex);
    }
  };

  const delta = grade != null && evaluationMetric.avg != null ? grade - evaluationMetric.avg : null;

  return (
    <td
      className={cn("gc-hair-v relative p-0 align-middle", isActive && "z-10")}
      style={{ height }}
    >
      {isEditing ? (
        <input
          key={`editor-${seed ?? "current"}`}
          ref={inputRef}
          autoFocus
          defaultValue={seed ?? (grade != null ? formatGrade(grade) : "")}
          inputMode="decimal"
          aria-label={`Nota de ${student.fullName} en ${evaluation.name}`}
          onChange={(event) => {
            const next = sanitize(event.currentTarget.value);
            if (next !== event.currentTarget.value) event.currentTarget.value = next;
          }}
          onKeyDown={handleInputKeyDown}
          onBlur={(event) => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
            } else {
              commit(event.currentTarget.value);
            }
            setEditing(false);
          }}
          className="gc-input gc-num absolute inset-[2px] z-20 w-[calc(100%-4px)] rounded-lg text-center text-[13px] font-semibold text-foreground outline-none"
        />
      ) : (
        <GradePopover
          student={student}
          evaluation={evaluation}
          metric={evaluationMetric}
          grade={grade}
          comment={comment}
          open={popoverOpen}
          onOpenChange={(next) => {
            if (preferences.quickEdit) {
              setPopoverOpen(false);
              return;
            }
            if (next) announcePopover();
            setPopoverOpen(next);
          }}
          onSave={(value, note) => { if (value == null) commitGrade(student.id, evaluation.id, null, note); else commitGrade(student.id, evaluation.id, value, note); }}
          onMoveStudent={(delta) => { setPopoverOpen(false); focusCell(rowIndex + delta, colIndex); }}
          onMoveEvaluation={(delta) => { setPopoverOpen(false); focusCell(rowIndex, colIndex + delta); }}
        >
        <div
          role="gridcell"
          aria-rowindex={rowIndex + 2}
          aria-colindex={colIndex + 2}
          tabIndex={isActive ? 0 : -1}
          data-cell={`${rowIndex}:${colIndex}`}
          onFocus={() => setActiveCell({ row: rowIndex, col: colIndex })}
          onPaste={(event) => {
            event.preventDefault();
            previewPasteText(event.clipboardData.getData("text/plain"));
          }}
          onClick={(event) => {
            const additive = event.shiftKey || event.metaKey || event.ctrlKey;
            selectCell({ row: rowIndex, col: colIndex }, student.id, evaluation.id, { additive: event.metaKey || event.ctrlKey, range: event.shiftKey });
            if (additive) {
              setPopoverOpen(false);
            } else if (preferences.quickEdit) {
              setPopoverOpen(false);
              beginEditing();
            } else {
              setPopoverOpen(true);
            }
          }}
          onDoubleClick={() => beginEditing()}
          onKeyDown={handleCellKeyDown}
          title={
            grade == null
              ? `${evaluation.code} · Pendiente por calificar`
              : `${student.fullName} · ${evaluation.name} — ${formatGrade(grade)} (${level ? LEVELS[level].label : ""})${
                  delta != null ? ` · ${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} vs. promedio` : ""
                }`
          }
          className={cn(
            "group/cell relative flex h-full w-full items-center justify-center transition-colors duration-100 outline-none",
            isActive
              ? "ring-1 ring-[var(--gc-cobalt)] ring-inset"
              : isSelected
                ? "ring-1 ring-[var(--gc-alto)]/70 ring-inset bg-[var(--gc-alto)]/10"
              : "hover:bg-white/6 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:ring-inset",
          )}
          style={{
            backgroundColor: grade == null
              ? isActive
                ? levelTint("bajo", 0.14)
                : undefined
              : isActive
                ? levelTint(levelId, 0.24)
                : levelTint(levelId, 0.07),
          }}
        >
          {isPulsing && (
            <span
              className="pointer-events-none absolute inset-0 animate-[gc-fade_0.7s_ease-out] rounded-[3px]"
              style={{ backgroundColor: levelTint(levelId, 0.45) }}
            />
          )}

          {grade == null ? (
            <span
              className={cn(
                "gc-num relative select-none font-medium text-[var(--gc-bajo)] transition-opacity",
                compact ? "text-[11px]" : "text-[13px]",
              )}
            >
              —
            </span>
          ) : (
            <span
              className={cn(
                "gc-num relative font-semibold tabular-nums transition-transform duration-100",
                compact ? "text-[12px]" : "text-[13.5px]",
                isActive && "scale-[1.06]",
              )}
              style={{ color: LEVELS[levelId].color }}
            >
              {formatGrade(grade)}
            </span>
          )}

          {grade != null && !isApproved(grade) && (
            <span
              className="pointer-events-none absolute bottom-0.5 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full"
              style={{ backgroundColor: LEVELS.bajo.color, opacity: isActive ? 0.95 : 0.5 }}
            />
          )}
        </div>
        </GradePopover>
      )}
    </td>
  );
}

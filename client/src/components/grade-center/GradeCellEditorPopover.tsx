import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, User, CornerDownLeft } from "lucide-react";
import {
  generateSuggestedGrades,
  assessmentLabels,
  POPOVER_GLASS_PANEL_CLASS,
  type GradeScaleConfig,
} from "./gradeCenterUtils";

export interface GradeCellEditorPopoverContentProps {
  studentName: string;
  studentId: number;
  assessmentId: number;
  assessmentTitle: string;
  assessmentType: string;
  assessmentWeight: number;
  maxValue: number;
  scale?: GradeScaleConfig | null;
  currentValue: number | null;
  currentComment?: string;
  initialDraftValue?: string;
  onSaveAndNavigate: (
    val: number | null,
    direction: "down" | "up" | "right" | "left" | "stay",
    comment?: string
  ) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export function GradeCellEditorPopoverContent({
  studentName,
  studentId,
  assessmentId,
  assessmentTitle,
  assessmentType,
  assessmentWeight,
  maxValue,
  scale,
  currentValue,
  currentComment = "",
  initialDraftValue,
  onSaveAndNavigate,
  onClose,
  isSaving = false,
}: GradeCellEditorPopoverContentProps) {
  const [valueText, setValueText] = React.useState<string>(
    initialDraftValue !== undefined && initialDraftValue !== null
      ? initialDraftValue
      : currentValue !== null && currentValue !== undefined
      ? String(currentValue)
      : ""
  );
  const [comment, setComment] = React.useState<string>(currentComment);
  const [showCommentField, setShowCommentField] = React.useState<boolean>(Boolean(currentComment));
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const cellKey = `${assessmentId}:${studentId}`;

  // Sincronizar estado reactivo al cambiar de celda / estudiante sin desmontar el Popover
  React.useEffect(() => {
    if (initialDraftValue !== undefined && initialDraftValue !== null) {
      setValueText(initialDraftValue);
    } else {
      setValueText(currentValue !== null && currentValue !== undefined ? String(currentValue) : "");
    }
    setComment(currentComment || "");
    setShowCommentField(Boolean(currentComment));
    setValidationError(null);

    // Auto-enfocar y seleccionar el input inmediatamente
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (initialDraftValue) {
          inputRef.current.setSelectionRange(initialDraftValue.length, initialDraftValue.length);
        } else {
          inputRef.current.select();
        }
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [cellKey, currentValue, currentComment, initialDraftValue]);

  const suggestions = React.useMemo(() => {
    return generateSuggestedGrades(scale, maxValue, 6);
  }, [scale, maxValue]);

  // Selección de nota sugerida: actualiza el valor y devuelve inmediatamente el foco al input
  const handleSuggestionClick = (suggestionValue: number) => {
    const formatted = suggestionValue.toFixed(1);
    setValueText(formatted);
    setValidationError(null);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(",", ".");
    setValueText(raw);
    if (raw.trim() === "") {
      setValidationError(null);
      return;
    }
    const num = Number(raw);
    const min = scale?.minValue ?? 0;
    if (isNaN(num)) {
      setValidationError("Número no válido");
    } else if (num < min || num > maxValue) {
      setValidationError(`Entre ${min} y ${maxValue}`);
    } else {
      setValidationError(null);
    }
  };

  // Guardar y avanzar centralizado
  const handleSaveAndAdvance = (
    direction: "down" | "up" | "right" | "left" | "stay" = "down"
  ) => {
    const trimmed = valueText.trim();
    let num: number | null = null;
    if (trimmed !== "") {
      num = Number(trimmed.replace(",", "."));
      const min = scale?.minValue ?? 0;
      if (isNaN(num)) {
        setValidationError("Número no válido");
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
        return;
      }
      if (num < min || num > maxValue) {
        setValidationError(`Entre ${min} y ${maxValue}`);
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
        return;
      }
    }
    setValidationError(null);
    onSaveAndNavigate(num, direction, comment.trim() || undefined);
  };

  // Intercepción centralizada de teclado en fase de captura para que ningún botón atrape ENTER
  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (isTextarea) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          handleSaveAndAdvance(e.shiftKey ? "up" : "down");
        }
        return;
      }

      // Prevenir que un botón capture el Enter como click y ejecutar siempre el flujo de avance
      e.preventDefault();
      e.stopPropagation();
      handleSaveAndAdvance(e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (!isTextarea) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveAndAdvance(e.shiftKey ? "left" : "right");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const typeLabel = assessmentLabels[assessmentType] ?? assessmentType;

  return (
    <PopoverContent
      side="bottom"
      align="center"
      sideOffset={6}
      avoidCollisions={true}
      onOpenAutoFocus={e => {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }}
      onCloseAutoFocus={e => {
        e.preventDefault();
      }}
      className={`${POPOVER_GLASS_PANEL_CLASS} w-74 sm:w-76 p-3.5`}
      onKeyDownCapture={handleKeyDownCapture}
    >
      {/* Highlight sutil de vidrio superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />

      {/* 1. CONTEXTO: Estudiante y Evaluación */}
      <div className="relative mb-2.5 flex items-start justify-between border-b border-slate-100/90 pb-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--edc-secondary)] text-xs font-bold text-[var(--edc-primary)]">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white"
              title={studentName}
            >
              {studentName}
            </h4>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <span
                className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[110px]"
                title={assessmentTitle}
              >
                {assessmentTitle}
              </span>
              <span>·</span>
              <span className="shrink-0 rounded bg-[var(--edc-secondary)] px-1 py-0.2 text-[9px] font-bold text-[var(--edc-primary)]">
                {typeLabel} {assessmentWeight}%
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Cerrar editor de calificación"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2. NOTA: Entrada Numérica Centrada y Clara */}
      <div className="relative mb-2.5 space-y-1">
        <div className="relative flex items-center justify-center">
          <Input
            ref={inputRef}
            type="text"
            value={valueText}
            onChange={handleInputChange}
            placeholder="0.0"
            className={`h-11 rounded-xl bg-white/95 text-center text-xl font-black tracking-tight shadow-inner dark:bg-slate-850/95 ${
              validationError
                ? "border-rose-300 ring-2 ring-rose-100 text-rose-600"
                : "border-slate-200/90 text-slate-900 dark:text-white focus-visible:border-[var(--edc-primary)] focus-visible:ring-2 focus-visible:ring-[var(--edc-secondary)]"
            }`}
          />
          {/* Botón rápido para limpiar nota */}
          {valueText ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setValueText("");
                setValidationError(null);
                inputRef.current?.focus();
              }}
              className="absolute right-13 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Borrar nota"
              aria-label="Borrar nota"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          <span className="pointer-events-none absolute right-3 text-xs font-bold text-slate-400">
            / {maxValue.toFixed(1)}
          </span>
        </div>

        {validationError && (
          <p className="text-[10px] font-semibold text-rose-500 animate-in fade-in text-center">
            {validationError}
          </p>
        )}
      </div>

      {/* 3. SUGERIDAS: Botones Rápidos Adaptados a la Escala */}
      <div className="relative mb-2.5 space-y-1">
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
          <span>Notas rápidas</span>
          <span>Escala máx. {maxValue.toFixed(1)}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {suggestions.map(sug => {
            const formatted = sug.toFixed(1);
            const isSelected = valueText.trim() === formatted;
            return (
              <button
                key={sug}
                type="button"
                tabIndex={-1}
                onMouseDown={e => {
                  // Evita que el botón tome el foco del cursor al hacer clic con el mouse
                  e.preventDefault();
                }}
                onClick={() => handleSuggestionClick(sug)}
                className={`flex h-6.5 items-center justify-center rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)] text-[var(--edc-primary)] font-bold shadow-xs scale-105"
                    : "border-slate-200/80 bg-slate-50/70 hover:bg-white text-slate-700 hover:text-[var(--edc-primary)] dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 hover:border-slate-300"
                }`}
                title={`Asignar ${formatted}`}
              >
                {formatted}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. COMENTARIO: Inicialmente colapsado con toggle */}
      <div className="relative mb-2.5">
        {!showCommentField ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowCommentField(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[var(--edc-primary)] transition cursor-pointer"
          >
            <Plus className="h-3 w-3 text-slate-400" />
            <span>{comment ? "Editar observación" : "Comentario +"}</span>
          </button>
        ) : (
          <div className="space-y-1 animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Observación pedagógica</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  if (!comment) setShowCommentField(false);
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Ocultar
              </button>
            </div>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Observación pedagógica opcional..."
              className="min-h-14 rounded-xl border-slate-200 bg-white/95 text-xs text-slate-700 focus-visible:border-[var(--edc-accent)] dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* 5. ACCIONES Y GUÍA DE NAVEGACIÓN */}
      <div className="relative flex items-center justify-between border-t border-slate-100/90 pt-2.5 dark:border-slate-800">
        <div
          className="flex items-center gap-1 text-[10px] text-slate-400"
          title="Presiona ENTER para guardar y avanzar a la siguiente fila"
        >
          <CornerDownLeft className="h-2.5 w-2.5" />
          <span>ENTER: avanzar</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            onClick={onClose}
            className="h-7 rounded-xl px-2.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving || Boolean(validationError)}
            onClick={() => handleSaveAndAdvance("stay")}
            className="h-7 rounded-xl bg-[var(--edc-primary)] px-3 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </PopoverContent>
  );
}

// Wrapper retrocompatible para casos donde se invoque GradeCellEditorPopover directamente
export interface GradeCellEditorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  assessmentTitle: string;
  assessmentType: string;
  assessmentWeight: number;
  maxValue: number;
  scale?: GradeScaleConfig | null;
  currentValue: number | null;
  currentComment?: string;
  initialDraftValue?: string;
  onSave: (val: number | null, comment?: string) => Promise<void> | void;
  onSaveAndNavigate?: (
    val: number | null,
    direction: "down" | "up" | "right" | "left",
    comment?: string
  ) => void;
  isSaving?: boolean;
  children: React.ReactNode;
}

export function GradeCellEditorPopover({
  open,
  onOpenChange,
  studentName,
  assessmentTitle,
  assessmentType,
  assessmentWeight,
  maxValue,
  scale,
  currentValue,
  currentComment = "",
  initialDraftValue,
  onSave,
  onSaveAndNavigate,
  isSaving = false,
  children,
}: GradeCellEditorPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {open && (
        <GradeCellEditorPopoverContent
          studentName={studentName}
          studentId={0}
          assessmentId={0}
          assessmentTitle={assessmentTitle}
          assessmentType={assessmentType}
          assessmentWeight={assessmentWeight}
          maxValue={maxValue}
          scale={scale}
          currentValue={currentValue}
          currentComment={currentComment}
          initialDraftValue={initialDraftValue}
          onSaveAndNavigate={(val, dir, com) => {
            if (onSaveAndNavigate && dir !== "stay") {
              onSaveAndNavigate(val, dir, com);
            } else {
              void onSave(val, com);
              onOpenChange(false);
            }
          }}
          onClose={() => onOpenChange(false)}
          isSaving={isSaving}
        />
      )}
    </Popover>
  );
}

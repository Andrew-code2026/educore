import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type AssessmentTypeKey =
  | "QUIZ"
  | "ACTIVIDAD"
  | "EXAMEN"
  | "PROYECTO"
  | "PARTICIPACION"
  | "OTRO";

export interface AssessmentTypeOption {
  key: AssessmentTypeKey;
  label: string;
  emoji: string;
  description: string;
}

export const ASSESSMENT_TYPE_OPTIONS: AssessmentTypeOption[] = [
  { key: "QUIZ", label: "Quiz", emoji: "📝", description: "Prueba corta o control de lectura" },
  { key: "ACTIVIDAD", label: "Tarea", emoji: "📚", description: "Actividad, guía o taller en clase" },
  { key: "EXAMEN", label: "Examen", emoji: "📊", description: "Evaluación parcial o bimestral" },
  { key: "PROYECTO", label: "Proyecto", emoji: "🧪", description: "Investigación o trabajo aplicado" },
  { key: "PARTICIPACION", label: "Exposición", emoji: "🎤", description: "Sustentación oral o debate" },
  { key: "OTRO", label: "Otro", emoji: "✏️", description: "Evidencia libre de aprendizaje" },
];

function formatDateSpanish(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return `${day} ${months[monthIdx] || ""} ${year}`.trim();
}

export interface NewAssessmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  courseName?: string;
  subjectName?: string;
  periodName?: string;
  academicYearId: number;
  academicPeriodId: number;
  courseId: number;
  subjectId: number;
  weightTotal: number;
  maxValue?: number;
  role: string;
  onSuccess?: () => void | Promise<void>;
}

export const NewAssessmentSheet: React.FC<NewAssessmentSheetProps> = ({
  isOpen,
  onClose,
  courseName = "11-2",
  subjectName = "Matemáticas",
  periodName = "Periodo 2",
  academicYearId,
  academicPeriodId,
  courseId,
  subjectId,
  weightTotal,
  maxValue = 5,
  role,
  onSuccess,
}) => {
  const remainingWeight = Math.max(0, 100 - weightTotal);

  // Form states
  const [selectedType, setSelectedType] = React.useState<AssessmentTypeKey>("EXAMEN");
  const [title, setTitle] = React.useState("");
  const [weight, setWeight] = React.useState<string>("");
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);

  // Modal / confirmation states
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);

  // Default suggested weight
  const defaultSuggestedWeight = React.useMemo(() => {
    return remainingWeight >= 20 ? "20" : remainingWeight > 0 ? String(remainingWeight) : "";
  }, [remainingWeight]);

  // Sync initial suggested weight when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setSelectedType("EXAMEN");
      setWeight(defaultSuggestedWeight);
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setShowDetails(false);
      setShowDiscardDialog(false);
    }
  }, [isOpen, defaultSuggestedWeight]);

  // Mutations
  const createAssessment = trpc.gradeCenter.createAssessment.useMutation();
  const utils = trpc.useUtils();

  // Computations
  const parsedWeight = parseFloat(weight);
  const isWeightNumber = !isNaN(parsedWeight) && weight.trim() !== "";
  const isWeightPositive = isWeightNumber && parsedWeight > 0;
  const isWeightExceeded = isWeightNumber && parsedWeight > remainingWeight;
  const isWeightValid = isWeightPositive && !isWeightExceeded;

  const isTitleValid = title.trim().length >= 3 && title.trim().length <= 180;
  const isContextValid = academicYearId > 0 && academicPeriodId > 0 && courseId > 0 && subjectId > 0;
  const canSubmit = isTitleValid && isWeightValid && isContextValid && !createAssessment.isPending;

  // Dirty check: has the user typed or changed anything?
  const isDirty = React.useMemo(() => {
    return (
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      selectedType !== "EXAMEN" ||
      weight !== defaultSuggestedWeight
    );
  }, [title, description, selectedType, weight, defaultSuggestedWeight]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    try {
      await createAssessment.mutateAsync({
        role: role as any,
        academicYearId,
        academicPeriodId,
        courseId,
        subjectId,
        title: title.trim(),
        assessmentType: selectedType,
        date: new Date(date + "T12:00:00Z"),
        maxValue,
        weight: parsedWeight,
        description: description.trim() || undefined,
        status: "DRAFT",
      });

      toast.success(`Evaluación "${title.trim()}" creada exitosamente`);
      await utils.gradeCenter.context.invalidate();
      if (onSuccess) {
        await onSuccess();
      } else {
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo crear la evaluación.");
    }
  };

  const selectedOption =
    ASSESSMENT_TYPE_OPTIONS.find((opt) => opt.key === selectedType) ?? ASSESSMENT_TYPE_OPTIONS[2];

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleAttemptClose();
          }
        }}
      >
        <SheetContent
          side="right"
          className="sm:max-w-md w-full p-0 flex flex-col h-full bg-white dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 space-y-2 text-left">
            <div className="flex items-center justify-between pr-6">
              <SheetTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>Nueva evaluación</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--edc-primary)] border-[var(--edc-primary)]/30 bg-[var(--edc-secondary)]/20"
                >
                  2.0
                </Badge>
              </SheetTitle>
            </div>
            {/* Contexto académico de solo lectura */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-slate-700 dark:text-slate-300 font-semibold">
                {courseName} · {subjectName} · {periodName}
              </span>
            </div>
          </SheetHeader>

          {/* Form Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* 1. ¿Qué vas a evaluar? (Selector Visual de Tipos) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                ¿Qué vas a evaluar?
              </label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de evaluación">
                {ASSESSMENT_TYPE_OPTIONS.map((opt) => {
                  const isSelected = selectedType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedType(opt.key)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)]/30 text-[var(--edc-primary)] font-bold shadow-xs ring-2 ring-[var(--edc-primary)]/20 dark:bg-blue-950/40 dark:border-blue-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80"
                      }`}
                    >
                      <span className="text-xl mb-1">{opt.emoji}</span>
                      <span className="text-xs tracking-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Nombre */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-assessment-title"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Nombre <span className="text-rose-500">*</span>
                </label>
                {title.length > 0 && title.length < 3 && (
                  <span className="text-[11px] text-rose-500 font-medium">Mínimo 3 caracteres</span>
                )}
              </div>
              <Input
                id="new-assessment-title"
                aria-label="Nombre de la evaluación"
                placeholder="Ej. Parcial de derivadas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={180}
                className="h-10 rounded-xl bg-white dark:bg-slate-900 text-xs border-slate-200 dark:border-slate-700 focus-visible:ring-[var(--edc-primary)]"
              />
              {title.trim().length === 0 && (
                <p className="text-[11px] text-slate-400">
                  Agrega un nombre para identificar esta evaluación en el Grade Center.
                </p>
              )}
            </div>

            {/* 3. Peso con Indicador Dinámico */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-assessment-weight"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Peso porcentual <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {weightTotal}% usado ·{" "}
                  <span className={remainingWeight === 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                    {remainingWeight}% disponible
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-28 shrink-0">
                  <Input
                    id="new-assessment-weight"
                    aria-label="Peso porcentual"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    placeholder="20"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className={`h-10 pr-7 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold border-slate-200 dark:border-slate-700 ${
                      isWeightExceeded ? "border-rose-400 text-rose-600 focus-visible:ring-rose-400" : ""
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>

                {/* Mini barra de distribución del peso */}
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-slate-400 dark:bg-slate-600 transition-all"
                      style={{ width: `${Math.min(100, weightTotal)}%` }}
                      title={`Asignado: ${weightTotal}%`}
                    />
                    {isWeightValid && (
                      <div
                        className="bg-[var(--edc-primary)] transition-all animate-pulse"
                        style={{ width: `${Math.min(remainingWeight, parsedWeight)}%` }}
                        title={`Nueva evaluación: ${parsedWeight}%`}
                      />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {isWeightValid
                      ? `Total resultante: ${weightTotal + parsedWeight}%`
                      : remainingWeight > 0
                      ? `Hasta ${remainingWeight}% disponible`
                      : "Ponderación completa"}
                  </p>
                </div>
              </div>

              {/* Mensajes y Advertencias deterministas de Peso */}
              {isWeightExceeded ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>
                    ⚠️ Solo puedes asignar hasta <strong>{remainingWeight}%</strong> porque las demás evaluaciones
                    ocupan el {weightTotal}%.
                  </span>
                </div>
              ) : remainingWeight === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    El periodo ya tiene el 100% de la ponderación asignada. Ajusta alguna evaluación previa para crear
                    esta.
                  </span>
                </div>
              ) : isWeightValid ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 inline shrink-0" />
                  <span>
                    💡 Te quedarán {remainingWeight - parsedWeight}% disponibles tras esta evaluación.
                  </span>
                </p>
              ) : null}
            </div>

            {/* 4. Fecha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-assessment-date"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>Fecha de aplicación</span>
                </label>
                <span className="text-[11px] text-slate-400 capitalize">
                  {formatDateSpanish(date)}
                </span>
              </div>
              <Input
                id="new-assessment-date"
                aria-label="Fecha de aplicación"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl bg-white dark:bg-slate-900 text-xs border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* 5. Detalles Opcionales (Acordeón limpio) */}
            <div className="pt-1">
              <button
                id="toggle-assessment-details"
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--edc-primary)] hover:underline focus:outline-hidden"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Ocultar detalles opcionales
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    + Agregar detalles (descripción / instrucciones)
                  </>
                )}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-1.5 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="new-assessment-description"
                      className="text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Descripción o instrucciones
                    </label>
                    <span className="text-[10px] text-slate-400">{description.length}/1000</span>
                  </div>
                  <Textarea
                    id="new-assessment-description"
                    aria-label="Descripción opcional"
                    placeholder="Objetivos pedagógicos, temas a evaluar o instrucciones para estudiantes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    className="min-h-[80px] rounded-xl bg-white dark:bg-slate-900 text-xs border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </div>

            {/* 6. Resumen en Tiempo Real ("Así quedará") */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Así quedará</span>
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                  BORRADOR
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg shrink-0">{selectedOption.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                    {title.trim() || "Nueva evaluación"} · {selectedOption.label} · {isWeightNumber ? parsedWeight : 0}%
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <span>📅 {formatDateSpanish(date) || "Hoy"}</span>
                    <span>· Escala máx: {maxValue}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAttemptClose}
              disabled={createAssessment.isPending}
              className="h-9 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmit()}
              disabled={!canSubmit}
              className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white px-4 text-xs font-semibold shadow-xs disabled:opacity-50 transition-all"
            >
              {createAssessment.isPending ? (
                "Creando..."
              ) : (
                <>
                  <span>Crear evaluación</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmación de descarte de cambios */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              ¿Descartar evaluación?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Has ingresado datos para esta evaluación. Si sales ahora, los cambios no guardados se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel
              onClick={() => setShowDiscardDialog(false)}
              className="rounded-xl text-xs font-semibold h-9"
            >
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold h-9"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

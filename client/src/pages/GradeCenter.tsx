import * as React from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { adaptEduCoreContextToDataset, getAssignmentsFromContext } from "@/gradecenter/adapter";
import { GradeCenterProvider } from "@/gradecenter/state/GradeCenterContext";
import { AppShell } from "@/gradecenter/components/AppShell";
import { GradeCenterPage as GradeCenterLegacyPage } from "./GradeCenterLegacy";
import { AlertTriangle, ClipboardList, History, Loader2, RotateCcw } from "lucide-react";

type EduRole = "admin" | "teacher" | "student" | "guardian";
type GradeCenterProps = { role: EduRole; school: any; onBack?: () => void };

export function GradeCenterPage({ role, school, onBack }: GradeCenterProps) {
  const { user } = useAuth();
  const [courseId, setCourseId] = React.useState<number | undefined>();
  const [subjectId, setSubjectId] = React.useState<number | undefined>();
  const [periodId, setPeriodId] = React.useState<number | undefined>();

  // Mecanismo de reversibilidad instantánea hacia el módulo legacy
  const [useLegacy, setUseLegacy] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("educore_gc_version") === "legacy";
    } catch {
      return false;
    }
  });

  const toggleLegacy = React.useCallback((legacy: boolean) => {
    setUseLegacy(legacy);
    try {
      localStorage.setItem("educore_gc_version", legacy ? "legacy" : "next");
    } catch {}
  }, []);

  // Consulta de datos reales del backend de EduCore
  const contextQuery = trpc.gradeCenter.context.useQuery(
    { role, courseId, subjectId, academicPeriodId: periodId },
    { staleTime: 10_000, retry: 1 }
  );

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  const handleSelectAssignment = React.useCallback((id: string) => {
    const numericCourseId = Number(id.replace(/^course-/, ""));
    if (Number.isFinite(numericCourseId) && numericCourseId > 0) {
      setCourseId(numericCourseId);
    }
  }, []);

  const utils = trpc.useUtils();
  const saveGradesMutation = trpc.gradeCenter.saveGrades.useMutation();
  const createAssessmentMutation = trpc.gradeCenter.createAssessment.useMutation();
  const updateAssessmentMutation = trpc.gradeCenter.updateAssessment.useMutation();
  const deleteAssessmentMutation = trpc.gradeCenter.deleteAssessment.useMutation();

  const isTeacherOrAdmin = role === "teacher" || role === "admin";
  const periodStatus = contextQuery.data?.selected?.period?.status;
  const isPeriodClosed = periodStatus === "Cerrado" || periodStatus === "CLOSED";
  const canEdit = isTeacherOrAdmin && !isPeriodClosed;
  const readOnly = !canEdit;
  const readOnlyReason = !isTeacherOrAdmin
    ? "Tu rol actual solo tiene permisos de consulta para este libro de calificaciones."
    : isPeriodClosed
      ? "El periodo académico se encuentra cerrado. No se admiten modificaciones de calificaciones ni evaluaciones."
      : undefined;

  // Adaptación reactiva del contexto a Dataset canónico de Grade Center Next
  const dataset = React.useMemo(() => {
    return adaptEduCoreContextToDataset(contextQuery.data, user);
  }, [contextQuery.data, user]);

  const availableAssignments = React.useMemo(() => {
    return getAssignmentsFromContext(contextQuery.data, dataset);
  }, [contextQuery.data, dataset]);

  const persistence = React.useMemo(() => {
    if (readOnly) return undefined;
    const selected = contextQuery.data?.selected;
    if (!selected?.course || !selected?.subject || !selected?.period) return undefined;

    return {
      saveGrades: async (
        assessmentId: number,
        grades: Array<{ studentId: number; value: number | null; comment?: string }>
      ) => {
        const res = await saveGradesMutation.mutateAsync({
          role,
          assessmentId,
          grades,
        });
        return res ?? { saved: grades.length };
      },
      createAssessment: async (input: {
        title: string;
        description?: string;
        assessmentType: string;
        date: Date;
        maxValue: number;
        weight: number;
        status?: string;
      }) => {
        const typeMap: Record<string, "QUIZ" | "TALLER" | "EXAMEN" | "PROYECTO" | "ACTIVIDAD" | "PARTICIPACION" | "RECUPERACION" | "OTRO"> = {
          QUIZ: "QUIZ",
          TALLER: "TALLER",
          EXAMEN: "EXAMEN",
          PROYECTO: "PROYECTO",
          ACTIVIDAD: "ACTIVIDAD",
          PARTICIPACION: "PARTICIPACION",
          RECUPERACION: "RECUPERACION",
          OTRO: "OTRO",
        };
        const validatedType = typeMap[input.assessmentType] || "TALLER";
        const validatedStatus = input.status === "PUBLISHED" ? "PUBLISHED" : input.status === "CLOSED" ? "CLOSED" : "DRAFT";

        const academicYearId = selected.academicYearId || selected.course.academicYearId || selected.period.academicYearId || 0;

        return await createAssessmentMutation.mutateAsync({
          role,
          academicYearId,
          academicPeriodId: selected.period.id,
          courseId: selected.course.id,
          subjectId: selected.subject.id,
          title: input.title,
          description: input.description,
          assessmentType: validatedType,
          date: input.date,
          maxValue: input.maxValue || 5,
          weight: input.weight,
          status: validatedStatus,
        });
      },
      updateAssessment: async (
        id: number,
        patch: {
          title?: string;
          description?: string;
          weight?: number;
          date?: Date;
          status?: string;
        }
      ) => {
        const validatedStatus = patch.status === "PUBLISHED" ? "PUBLISHED" : patch.status === "CLOSED" ? "CLOSED" : patch.status === "DRAFT" ? "DRAFT" : undefined;
        return await updateAssessmentMutation.mutateAsync({
          role,
          id,
          title: patch.title,
          description: patch.description,
          weight: patch.weight,
          date: patch.date,
          status: validatedStatus,
        });
      },
      deleteAssessment: async (id: number) => {
        return await deleteAssessmentMutation.mutateAsync({
          role,
          id,
        });
      },
    };
  }, [
    readOnly,
    role,
    contextQuery.data?.selected,
    saveGradesMutation,
    createAssessmentMutation,
    updateAssessmentMutation,
    deleteAssessmentMutation,
  ]);

  // Si el usuario optó por la versión anterior, renderizar el módulo legacy con barra de retorno
  if (useLegacy) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="z-50 flex shrink-0 items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <History className="size-4 text-amber-400" />
            <span>Ejecutando versión anterior (Grade Center Legacy) con fines de comparación y contingencia.</span>
          </div>
          <button
            type="button"
            onClick={() => toggleLegacy(false)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/30"
          >
            <RotateCcw className="size-3.5" />
            Volver a Grade Center Next
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <GradeCenterLegacyPage role={role} school={school} />
        </div>
      </div>
    );
  }

  // Estado de carga con estética Liquid Glass
  if (!contextQuery.data && contextQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="glass-strong flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 p-8 text-center shadow-2xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/15 text-[var(--gc-cobalt)]">
            <Loader2 className="size-6 animate-spin" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Cargando Grade Center</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Consultando calificaciones y asignaciones académicas autorizadas desde EduCore...
          </p>
        </div>
      </div>
    );
  }

  // Estado de error sin sustitución silenciosa de datos
  if (contextQuery.isError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="glass-strong flex w-full max-w-md flex-col items-center rounded-3xl border border-[var(--gc-bajo)]/30 p-8 text-center shadow-2xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/15 text-[var(--gc-bajo)]">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No se pudieron cargar las calificaciones</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {contextQuery.error?.message || "Ocurrió un error al obtener la matriz académica de calificaciones."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => contextQuery.refetch()}
              className="rounded-xl bg-[var(--gc-cobalt)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => toggleLegacy(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              Abrir versión anterior
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado de ausencia de asignaciones o permisos
  if (!contextQuery.data?.courses || contextQuery.data.courses.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="glass-strong flex w-full max-w-md flex-col items-center rounded-3xl border border-white/10 p-8 text-center shadow-2xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted-foreground">
            <ClipboardList className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Sin asignaciones académicas</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            No tienes salones o materias asignados actualmente en este periodo con permisos de calificación.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => toggleLegacy(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              Probar versión anterior
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render principal de Grade Center Next con persistencia real (Iteración 3)
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <GradeCenterProvider
        initialDataset={dataset}
        readOnly={readOnly}
        readOnlyReason={readOnlyReason}
        availableAssignments={availableAssignments}
        onSelectAssignment={handleSelectAssignment}
        persistence={persistence}
        onDataSaved={() => utils.gradeCenter.context.invalidate()}
      >
        <AppShell embedded={true} onBack={onBack} />
      </GradeCenterProvider>

      {/* Botón discreto de contingencia en la esquina inferior para cambiar al módulo anterior */}
      <div className="pointer-events-none fixed bottom-2 right-2 z-30">
        <button
          type="button"
          onClick={() => toggleLegacy(true)}
          title="Cambiar temporalmente al Grade Center anterior"
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <History className="size-2.5" />
          Versión anterior
        </button>
      </div>
    </div>
  );
}

export default GradeCenterPage;

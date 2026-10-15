import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BarChart3, ChevronDown, Sparkles, X, Calculator, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  GradeCenterTable,
  type GradeCenterTableRow,
} from "@/components/grade-center/GradeCenterTable";
import {
  GradeCenterToolbar,
  type GradeFilterKey,
  type GradeViewMode,
} from "@/components/grade-center/GradeCenterToolbar";
import {
  BulkGradeDialog,
  type BulkGradeTarget,
} from "@/components/grade-center/BulkGradeDialog";
import { ScenarioSimulatorDialog } from "@/components/grade-center/ScenarioSimulatorDialog";
import { GradeStatisticsPanel } from "@/components/grade-center/GradeStatisticsPanel";
import { GradeAnalyticsMiniPanel } from "@/components/grade-center/GradeAnalyticsMiniPanel";
import { GradeCenterAnalyticsDashboard } from "@/components/grade-center/GradeCenterAnalyticsDashboard";
import { NewAssessmentSheet } from "@/components/grade-center/NewAssessmentSheet";
import { StudentStatisticsDialog } from "@/components/grade-center/StudentStatisticsDialog";
import { UnsavedChangesDialog } from "@/components/grade-center/UnsavedChangesDialog";
import { calculateMean } from "@/components/grade-center/gradeStatisticsUtils";
import {
  studentName,
  numberValue,
  calculateDefinitiva,
  assessmentLabels,
  getPerformanceTone,
  type GradeGridDensity,
} from "@/components/grade-center/gradeCenterUtils";
import {
  calculateStudentProjection,
  calculateWhatIsNeededToPass,
} from "@/components/grade-center/gradeIntelligenceUtils";
import { useShellContext } from "@/components/shell";

type EduRole = "admin" | "teacher" | "student" | "guardian";
type GradeCenterProps = { role: EduRole; school: any };

export function GradeCenterPage({ role }: GradeCenterProps) {
  const handleSaveAllRef = React.useRef<() => void>(() => {});
  let shellContext: ReturnType<typeof useShellContext> | null = null;
  try {
    shellContext = useShellContext();
  } catch {
    // Soporte seguro para ejecuciones fuera de ShellContextProvider (ej. tests aislados)
  }
  const [courseId, setCourseId] = React.useState<number | undefined>();
  const [subjectId, setSubjectId] = React.useState<number | undefined>();
  const [periodId, setPeriodId] = React.useState<number | undefined>();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<GradeFilterKey>("ALL");
  const [viewMode, setViewMode] = React.useState<GradeViewMode>("NOTES");
  const [gridDensity, setGridDensity] = React.useState<GradeGridDensity>(() => {
    try {
      const saved = localStorage.getItem("educore_gc_density");
      return saved === "compact" || saved === "standard" ? saved : "standard";
    } catch {
      return "standard";
    }
  });

  const handleGridDensityChange = React.useCallback((density: GradeGridDensity) => {
    setGridDensity(density);
    try {
      localStorage.setItem("educore_gc_density", density);
    } catch {}
  }, []);

  // Almacena cambios en edición pendientes de sincronizar
  const [pendingGrades, setPendingGrades] = React.useState<Record<string, number | null>>({});
  const [pendingComments, setPendingComments] = React.useState<Record<string, string>>({});
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<number[]>([]);
  const [showBulkDialog, setShowBulkDialog] = React.useState(false);

  // Estado para Guardado Inteligente / Automático (Subfase 1, Iteración 2)
  const [autoSaveEnabled, setAutoSaveEnabled] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("educore_gc_autosave");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const revertSavedTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingGradesRef = React.useRef(pendingGrades);
  pendingGradesRef.current = pendingGrades;
  const pendingCommentsRef = React.useRef(pendingComments);
  pendingCommentsRef.current = pendingComments;

  // Total de cambios pendientes reales
  const totalPending = Object.keys(pendingGrades).length + Object.keys(pendingComments).length;

  // Estado para Inteligencia de Calificaciones (Fase 5.3-C)
  const [simulatorStudent, setSimulatorStudent] = React.useState<GradeCenterTableRow | null>(null);
  const [showSimulator, setShowSimulator] = React.useState(false);
  const [externalTargetCell, setExternalTargetCell] = React.useState<{
    studentUserId: number;
    assessmentId: number;
    ts: number;
  } | null>(null);

  const [showAssessmentForm, setShowAssessmentForm] = React.useState(false);
  const [showStats, setShowStats] = React.useState(false);
  const [analyticsViewMode, setAnalyticsViewMode] = React.useState<"TABLE" | "ANALYTICS">("TABLE");
  const [selectedAssessmentId, setSelectedAssessmentId] = React.useState<number | null>(null);
  const [selectedStatsStudent, setSelectedStatsStudent] = React.useState<GradeCenterTableRow | null>(null);
  const [showStudentStatsDialog, setShowStudentStatsDialog] = React.useState(false);

  // Guardián de cambios pendientes sin guardar (Subfase 1, Iteración 1 & 2)
  const [pendingTransition, setPendingTransition] = React.useState<{
    action: () => void;
    label?: string;
  } | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false);

  const requestTransition = React.useCallback(
    (action: () => void, label?: string) => {
      // 1. Si el guardado automático está activo, NUNCA mostramos diálogo ni interrumpimos al docente.
      if (autoSaveEnabled) {
        const hasPending =
          Object.keys(pendingGrades).length > 0 || Object.keys(pendingComments).length > 0;
        if (hasPending) {
          // Persistimos de inmediato los cambios acumulados en background
          handleSaveAllRef.current();
        }
        if (typeof action === "function") {
          action();
        }
        return;
      }

      // 2. Modo manual: alertar únicamente si existen cambios pendientes reales
      const hasChanges =
        Object.keys(pendingGrades).length > 0 || Object.keys(pendingComments).length > 0;
      if (!hasChanges) {
        if (typeof action === "function") {
          action();
        }
        return;
      }

      // 3. Confirmar salida exclusivamente en modo manual y cuando sea una acción de navegación válida
      if (typeof action === "function") {
        setPendingTransition({ action, label });
        setShowUnsavedDialog(true);
      }
    },
    [autoSaveEnabled, pendingGrades, pendingComments]
  );

  const requestTransitionRef = React.useRef(requestTransition);
  requestTransitionRef.current = requestTransition;

  // Salvaguarda: si en cualquier momento los pendientes llegan a 0 o se reactiva el guardado automático, cerrar el diálogo
  React.useEffect(() => {
    if (showUnsavedDialog && (totalPending === 0 || autoSaveEnabled)) {
      setShowUnsavedDialog(false);
      setPendingTransition(null);
    }
  }, [showUnsavedDialog, totalPending, autoSaveEnabled]);

  const contextQuery = trpc.gradeCenter.context.useQuery(
    { role, courseId, subjectId, academicPeriodId: periodId },
    { staleTime: 10_000 }
  );

  const saveGrades = trpc.gradeCenter.saveGrades.useMutation();
  const createAssessment = trpc.gradeCenter.createAssessment.useMutation();
  const updateAssessment = trpc.gradeCenter.updateAssessment.useMutation();
  const deleteAssessment = trpc.gradeCenter.deleteAssessment.useMutation();
  const utils = trpc.useUtils();
  const context = contextQuery.data;

  // Eliminación interactiva y segura de evaluaciones (Subfase 1, Iteración 1 & 2)
  const handleDeleteAssessment = React.useCallback(
    async (assessmentId: number) => {
      try {
        await deleteAssessment.mutateAsync({
          role,
          id: assessmentId,
        });
        await utils.gradeCenter.context.invalidate();
        toast.success("Evaluación eliminada correctamente. La ponderación ha sido liberada.");
      } catch (error: any) {
        toast.error(error?.message ?? "Error al eliminar la evaluación.");
        throw error;
      }
    },
    [role, deleteAssessment, utils.gradeCenter.context]
  );

  // Edición interactiva y segura de evaluaciones desde el Grade Center (Fase 5.3-E)
  const handleEditAssessment = React.useCallback(
    async (
      assessmentId: number,
      data: { title?: string; weight?: number; date?: Date; description?: string }
    ) => {
      try {
        await updateAssessment.mutateAsync({
          role,
          id: assessmentId,
          title: data.title,
          weight: data.weight,
          date: data.date,
          description: data.description,
        });
        await utils.gradeCenter.context.invalidate();
        toast.success("Evaluación actualizada correctamente");
      } catch (error: any) {
        toast.error(error?.message ?? "Error al actualizar la evaluación.");
        throw error;
      }
    },
    [role, updateAssessment, utils.gradeCenter.context]
  );

  // Filtrado rápido de estudiantes con actividad pendiente
  const handleFilterPendingForAssessment = React.useCallback(
    (_assessmentId: number) => {
      setFilter("PENDING");
    },
    []
  );

  // Modificación reactiva individual de una celda para calificación ultrarrápida
  const handleCellPendingChange = React.useCallback(
    (assessmentId: number, studentId: number, value: number | null) => {
      setPendingGrades(prev => ({
        ...prev,
        [`${assessmentId}:${studentId}`]: value,
      }));
    },
    []
  );

  // Abrir simulador de escenarios en memoria para un estudiante
  const handleOpenSimulator = React.useCallback((studentRow: GradeCenterTableRow) => {
    setSimulatorStudent(studentRow);
    setShowSimulator(true);
  }, []);

  // Navegar y enfocar directamente la celda de una evaluación pendiente
  const handleNavigateToCell = React.useCallback((studentUserId: number, assessmentId: number) => {
    setExternalTargetCell({
      studentUserId,
      assessmentId,
      ts: Date.now(),
    });
  }, []);

  // Sincronizar selectores iniciales
  React.useEffect(() => {
    if (!context?.selected) return;
    if (courseId === undefined && context.selected.course?.id) setCourseId(context.selected.course.id);
    if (subjectId === undefined && context.selected.subject?.id) setSubjectId(context.selected.subject.id);
    if (periodId === undefined && context.selected.period?.id) setPeriodId(context.selected.period.id);
  }, [context, courseId, subjectId, periodId]);

  const handleCourseChange = React.useCallback(
    (val: number) => {
      const current = courseId ?? context?.selected?.course?.id;
      if (val === current) return;
      const c = context?.courses?.find(x => x.id === val);
      requestTransitionRef.current(() => {
        setCourseId(val);
        setSubjectId(undefined);
      }, c ? `Curso ${c.name}` : `Curso ${val}`);
    },
    [courseId, context?.courses, context?.selected?.course?.id]
  );

  const handleSubjectChange = React.useCallback(
    (val: number) => {
      const current = subjectId ?? context?.selected?.subject?.id;
      if (val === current) return;
      const s = context?.subjects?.find(x => x.id === val);
      requestTransitionRef.current(() => {
        setSubjectId(val);
      }, s ? `Materia ${s.name}` : `Materia ${val}`);
    },
    [subjectId, context?.subjects, context?.selected?.subject?.id]
  );

  const handlePeriodChange = React.useCallback(
    (val: number) => {
      const current = periodId ?? context?.selected?.period?.id;
      if (val === current) return;
      const p = context?.periods?.find(x => x.id === val);
      requestTransitionRef.current(() => {
        setPeriodId(val);
      }, p ? `Periodo ${p.name}` : `Periodo ${val}`);
    },
    [periodId, context?.periods, context?.selected?.period?.id]
  );

  const setNavGuard = shellContext?.setNavGuard;

  React.useEffect(() => {
    if (!setNavGuard) return;
    const shouldGuard = !autoSaveEnabled && totalPending > 0;

    if (shouldGuard) {
      setNavGuard((action: () => void, targetSection?: string) => {
        requestTransitionRef.current(action, targetSection ? `Sección ${targetSection}` : undefined);
      });
    } else {
      setNavGuard(null);
    }
    return () => {
      setNavGuard(null);
    };
  }, [autoSaveEnabled, totalPending, setNavGuard]);

  React.useEffect(() => {
    const shouldGuard =
      !autoSaveEnabled &&
      (Object.keys(pendingGrades).length > 0 || Object.keys(pendingComments).length > 0);
    if (!shouldGuard) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [autoSaveEnabled, pendingGrades, pendingComments]);

  // Promedio reactivo del grupo para desviaciones y estadísticas (regla de hooks: incondicional)
  const groupAverage = React.useMemo(() => {
    if (!context?.rows) return null;
    const definitivas: number[] = [];
    for (const row of context.rows) {
      const sId = row.enrollment.studentUserId;
      const def = calculateDefinitiva(
        (row.values ?? []).map((v: any) => {
          const key = `${v.assessment.id}:${sId}`;
          const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
            ? pendingGrades[key]
            : v.grade?.value ?? null;
          return {
            value: val,
            maxValue: v.assessment.maxValue,
            weight: v.assessment.weight,
          };
        })
      );
      if (def !== null) {
        definitivas.push(def);
      }
    }
    return calculateMean(definitivas);
  }, [context?.rows, pendingGrades]);

  // Métricas reactivas para la barra de resumen compacto del curso (Fase 5.3-E)
  const courseSummary = React.useMemo(() => {
    if (!context?.rows) {
      return {
        average: null,
        passingRate: 0,
        passingCount: 0,
        riskCount: 0,
        pendingTotal: 0,
        totalStudents: 0,
      };
    }
    let passingCount = 0;
    let riskCount = 0;
    let pendingTotal = 0;
    let evaluatedCount = 0;
    const totalStudents = context.rows.length;
    const totalAssessments = context.assessments?.length ?? 0;

    for (const row of context.rows) {
      const sId = row.enrollment.studentUserId;
      const def = calculateDefinitiva(
        (row.values ?? []).map((v: any) => {
          const key = `${v.assessment.id}:${sId}`;
          const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
            ? pendingGrades[key]
            : v.grade?.value ?? null;
          return {
            value: val,
            maxValue: v.assessment.maxValue,
            weight: v.assessment.weight,
          };
        })
      );
      if (def !== null) {
        evaluatedCount++;
        if (def >= 3.5) passingCount++;
        else riskCount++;
      }
      for (const v of row.values ?? []) {
        const key = `${v.assessment.id}:${sId}`;
        const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : v.grade?.value ?? null;
        if (val === null) pendingTotal++;
      }
    }

    const passingRate = evaluatedCount > 0 ? Math.round((passingCount / evaluatedCount) * 100) : 0;
    const totalPossibleGrades = totalStudents * totalAssessments;
    const gradedTotal = Math.max(0, totalPossibleGrades - pendingTotal);
    const gradedRate = totalPossibleGrades > 0 ? Math.round((gradedTotal / totalPossibleGrades) * 100) : 0;

    return {
      average: groupAverage,
      passingRate,
      passingCount,
      riskCount,
      pendingTotal,
      totalStudents,
      totalPossibleGrades,
      gradedTotal,
      gradedRate,
    };
  }, [context?.rows, context?.assessments, pendingGrades, groupAverage]);

  const pendingCount = Object.keys(pendingGrades).length;
  const setModuleContext = shellContext?.setModuleContext;

  const handleToggleAutoSave = React.useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    try {
      localStorage.setItem("educore_gc_autosave", String(enabled));
    } catch {}
    if (!enabled && autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  // Debounce automático: persiste cambios tras 1.200 ms de inactividad
  React.useEffect(() => {
    if (!autoSaveEnabled) return;
    const hasPending =
      Object.keys(pendingGrades).length > 0 || Object.keys(pendingComments).length > 0;
    if (!hasPending) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      const gradesToSave = { ...pendingGradesRef.current };
      const commentsToSave = { ...pendingCommentsRef.current };
      const gradeKeys = Object.keys(gradesToSave);
      const commentKeys = Object.keys(commentsToSave);
      if (!gradeKeys.length && !commentKeys.length) return;

      try {
        setSaveStatus("saving");

        const byAssessment: Record<
          number,
          Array<{ studentId: number; value: number | null; comment?: string }>
        > = {};

        for (const key of gradeKeys) {
          const [aIdStr, sIdStr] = key.split(":");
          const aId = Number(aIdStr);
          const sId = Number(sIdStr);
          if (!byAssessment[aId]) byAssessment[aId] = [];
          byAssessment[aId].push({
            studentId: sId,
            value: gradesToSave[key],
            comment: commentsToSave[key] || undefined,
          });
        }

        for (const key of commentKeys) {
          const [aIdStr, sIdStr] = key.split(":");
          const aId = Number(aIdStr);
          const sId = Number(sIdStr);
          if (!byAssessment[aId]) byAssessment[aId] = [];
          const existing = byAssessment[aId].find(item => item.studentId === sId);
          if (!existing) {
            byAssessment[aId].push({
              studentId: sId,
              value: gradesToSave[key] !== undefined ? gradesToSave[key] : null,
              comment: commentsToSave[key],
            });
          }
        }

        for (const aIdStr of Object.keys(byAssessment)) {
          const aId = Number(aIdStr);
          await saveGrades.mutateAsync({
            role,
            assessmentId: aId,
            grades: byAssessment[aId],
          });
        }

        setPendingGrades(prev => {
          const next = { ...prev };
          for (const key of gradeKeys) delete next[key];
          return next;
        });
        setPendingComments(prev => {
          const next = { ...prev };
          for (const key of commentKeys) delete next[key];
          return next;
        });

        await utils.gradeCenter.context.invalidate();
        setSaveStatus("saved");

        if (revertSavedTimerRef.current) clearTimeout(revertSavedTimerRef.current);
        revertSavedTimerRef.current = setTimeout(() => {
          setSaveStatus(prev => (prev === "saved" ? "idle" : prev));
        }, 3000);
      } catch (err: any) {
        setSaveStatus("error");
      }
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [pendingGrades, pendingComments, autoSaveEnabled, role, saveGrades, utils.gradeCenter.context]);

  // Guardar todos los cambios pendientes acumulados de forma explícita
  const handleSaveAll = async () => {
    const keys = Object.keys(pendingGrades);
    if (!keys.length) return;
    try {
      setSaveStatus("saving");
      const byAssessment: Record<number, Array<{ studentId: number; value: number | null; comment?: string }>> = {};
      for (const key of keys) {
        const [assessmentIdStr, studentIdStr] = key.split(":");
        const aId = Number(assessmentIdStr);
        const sId = Number(studentIdStr);
        if (!byAssessment[aId]) byAssessment[aId] = [];
        byAssessment[aId].push({
          studentId: sId,
          value: pendingGrades[key],
          comment: pendingComments[key] || undefined,
        });
      }
      for (const aIdStr of Object.keys(byAssessment)) {
        const aId = Number(aIdStr);
        await saveGrades.mutateAsync({
          role,
          assessmentId: aId,
          grades: byAssessment[aId],
        });
      }
      setPendingGrades({});
      setPendingComments({});
      await utils.gradeCenter.context.invalidate();
      setSaveStatus("saved");
      if (revertSavedTimerRef.current) clearTimeout(revertSavedTimerRef.current);
      revertSavedTimerRef.current = setTimeout(() => {
        setSaveStatus(prev => (prev === "saved" ? "idle" : prev));
      }, 3000);
      toast.success("Todas las calificaciones pendientes fueron guardadas");
    } catch (error: any) {
      setSaveStatus("error");
      toast.error(error?.message ?? "Error al guardar calificaciones.");
      throw error;
    }
  };
  handleSaveAllRef.current = () => {
    handleSaveAll().catch(() => {});
  };

  const handleSaveAndContinue = async () => {
    try {
      await handleSaveAll();
      const next = pendingTransition?.action;
      setPendingTransition(null);
      setShowUnsavedDialog(false);
      if (next) next();
    } catch {
      // Si falla, el error ya se muestra en toast y permanecemos en la vista actual
    }
  };

  const handleDiscardAndContinue = () => {
    setPendingGrades({});
    setPendingComments({});
    const next = pendingTransition?.action;
    setPendingTransition(null);
    setShowUnsavedDialog(false);
    if (next) next();
  };

  const handleCancelTransition = () => {
    setPendingTransition(null);
    setShowUnsavedDialog(false);
  };

  // Acciones en la cabecera memoizadas para evitar re-render loops del Shell
  const headerActions = React.useMemo(() => {
    if ((!autoSaveEnabled && pendingCount > 0) || saveStatus === "error") {
      return (
        <Button
          size="sm"
          onClick={() => handleSaveAllRef.current()}
          disabled={saveGrades.isPending}
          className="rounded-xl bg-[var(--edc-primary)] text-white shadow-xs text-xs font-semibold h-8"
        >
          {saveGrades.isPending ? "Guardando notas..." : "Guardar notas"}
        </Button>
      );
    }
    return undefined;
  }, [autoSaveEnabled, pendingCount, saveStatus, saveGrades.isPending]);

  // Sincronizar contexto dinámico con el Header del Shell Global
  React.useEffect(() => {
    if (!setModuleContext || !context) return;
    const cName = context.selected?.course?.name ?? "11-2";
    const sName = context.selected?.subject?.name ?? "Matemáticas";
    const pName = context.selected?.period?.name ?? "Periodo 2";

    setModuleContext({
      title: role === "student" ? "Mis Calificaciones" : role === "guardian" ? "Rendimiento" : "Grade Center",
      subtitle: `${cName} · ${sName}`,
      breadcrumbs: [
        { label: "Académico" },
        { label: role === "student" ? "Calificaciones" : "Grade Center", isCurrent: true },
      ],
      contextPills: [
        { label: `${cName} · ${sName}`, tone: "primary" },
        { label: pName, tone: "default" },
        ...(saveStatus === "saving"
          ? [{ label: "Guardando...", tone: "primary" as const }]
          : saveStatus === "error"
          ? [{ label: "Error al guardar", tone: "rose" as const }]
          : pendingCount > 0 && !autoSaveEnabled
          ? [{ label: pendingCount === 1 ? "1 nota pendiente" : `${pendingCount} notas pendientes`, tone: "amber" as const }]
          : []),
      ],
      actions: headerActions,
    });
  }, [
    context?.selected?.course?.name,
    context?.selected?.subject?.name,
    context?.selected?.period?.name,
    pendingCount,
    role,
    setModuleContext,
    autoSaveEnabled,
    saveStatus,
    headerActions,
  ]);

  if (contextQuery.isLoading || !context) return <LoadingState />;
  if (contextQuery.isError) {
    return (
      <Card className="rounded-2xl border-rose-100 bg-rose-50/70">
        <CardContent className="p-6 text-sm text-rose-700">
          No pudimos cargar la información académica. Intenta nuevamente.
        </CardContent>
      </Card>
    );
  }

  // Vistas segmentadas por rol protegido
  if (role === "student") {
    return (
      <>
        <StudentGradesView context={context} subjectId={subjectId} onSubjectChange={handleSubjectChange} />
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog && !autoSaveEnabled && totalPending > 0}
          onClose={handleCancelTransition}
          pendingGradesCount={Object.keys(pendingGrades).length}
          pendingCommentsCount={Object.keys(pendingComments).length}
          isSaving={saveGrades.isPending}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscardAndContinue={handleDiscardAndContinue}
          destinationLabel={pendingTransition?.label}
        />
      </>
    );
  }
  if (role === "guardian") {
    return (
      <>
        <GuardianPerformanceView context={context} subjectId={subjectId} onSubjectChange={handleSubjectChange} />
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog && !autoSaveEnabled && totalPending > 0}
          onClose={handleCancelTransition}
          pendingGradesCount={Object.keys(pendingGrades).length}
          pendingCommentsCount={Object.keys(pendingComments).length}
          isSaving={saveGrades.isPending}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscardAndContinue={handleDiscardAndContinue}
          destinationLabel={pendingTransition?.label}
        />
      </>
    );
  }
  if (role === "admin") {
    return (
      <>
        <AdminPerformanceView
          context={context}
          courseId={courseId}
          subjectId={subjectId}
          periodId={periodId}
          onCourseChange={handleCourseChange}
          onSubjectChange={handleSubjectChange}
          onPeriodChange={handlePeriodChange}
          showStats={showStats}
          setShowStats={setShowStats}
        />
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog && !autoSaveEnabled && totalPending > 0}
          onClose={handleCancelTransition}
          pendingGradesCount={Object.keys(pendingGrades).length}
          pendingCommentsCount={Object.keys(pendingComments).length}
          isSaving={saveGrades.isPending}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscardAndContinue={handleDiscardAndContinue}
          destinationLabel={pendingTransition?.label}
        />
      </>
    );
  }

  // VISTA PRINCIPAL DEL DOCENTE
  const selected: any = context.selected ?? {};
  const weightTotal = (context.assessments ?? []).reduce(
    (sum: number, item: any) => sum + Number(item.weight),
    0
  );

  // Filtrado reactivo de filas
  const filteredRows = (context.rows ?? []).filter((row: any) => {
    const name = studentName(row.student);
    if (query.trim() && !name.toLowerCase().includes(query.toLowerCase().trim())) {
      return false;
    }

    const rowDefinitiva = calculateDefinitiva(
      row.values.map((v: any) => ({
        value: Object.prototype.hasOwnProperty.call(pendingGrades, `${v.assessment.id}:${row.enrollment.studentUserId}`)
          ? pendingGrades[`${v.assessment.id}:${row.enrollment.studentUserId}`]
          : v.grade?.value ?? null,
        maxValue: v.assessment.maxValue,
        weight: v.assessment.weight,
      }))
    );

    if (filter === "PENDING") {
      return row.values.some((item: any) => {
        const key = `${item.assessment.id}:${row.enrollment.studentUserId}`;
        const val = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : item.grade?.value ?? null;
        return val === null;
      });
    }
    if (filter === "LOW") {
      return rowDefinitiva !== null && rowDefinitiva < 3.5;
    }
    if (filter === "PASSING") {
      return rowDefinitiva !== null && rowDefinitiva >= 3.5;
    }
    if (filter === "COMMENT") {
      return row.values.some((item: any) => {
        const key = `${item.assessment.id}:${row.enrollment.studentUserId}`;
        const com = Object.prototype.hasOwnProperty.call(pendingComments, key)
          ? pendingComments[key]
          : item.grade?.comment;
        return Boolean(com && com.trim());
      });
    }
    return true;
  });

  // Guardar calificación individual desde el popover contextual
  const handleSaveCellGrade = async (
    assessmentId: number,
    studentId: number,
    value: number | null,
    comment?: string
  ) => {
    try {
      await saveGrades.mutateAsync({
        role,
        assessmentId,
        grades: [{ studentId, value, comment }],
      });
      setPendingGrades(prev => {
        const next = { ...prev };
        delete next[`${assessmentId}:${studentId}`];
        return next;
      });
      setPendingComments(prev => {
        const next = { ...prev };
        delete next[`${assessmentId}:${studentId}`];
        return next;
      });
      await utils.gradeCenter.context.invalidate();
      toast.success("Calificación actualizada correctamente");
    } catch (error: any) {
      toast.error(error?.message ?? "No pudimos guardar la calificación.");
    }
  };

  // Selección de estudiantes
  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleAllVisible = () => {
    const visibleIds: number[] = filteredRows.map((r: any) => r.enrollment.studentUserId);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Calificación masiva
  const handleApplyBulkGrade = (
    assessmentId: number,
    value: number,
    target: BulkGradeTarget
  ) => {
    let targetRows = filteredRows;
    if (target === "SELECTED") {
      targetRows = filteredRows.filter((r: any) =>
        selectedStudentIds.includes(r.enrollment.studentUserId)
      );
    }

    const updates: Record<string, number | null> = {};
    let affectedCount = 0;

    for (const row of targetRows) {
      const studentId = row.enrollment.studentUserId;
      const key = `${assessmentId}:${studentId}`;

      if (target === "EMPTY_ONLY") {
        const currentVal = Object.prototype.hasOwnProperty.call(pendingGrades, key)
          ? pendingGrades[key]
          : row.values.find((v: any) => v.assessment.id === assessmentId)?.grade?.value ?? null;

        // IMPORTANTE: NUNCA sobrescribir notas existentes cuando se utiliza esta opción
        if (currentVal !== null && currentVal !== undefined) {
          continue;
        }
      }

      updates[key] = value;
      affectedCount++;
    }

    if (affectedCount === 0) {
      toast.info("No se modificó ninguna celda (no había celdas que cumplieran la condición).");
      return;
    }

    setPendingGrades(prev => ({
      ...prev,
      ...updates,
    }));

    toast.success(
      `Se aplicó ${value} a ${affectedCount} estudiante${affectedCount === 1 ? "" : "s"} (${
        target === "EMPTY_ONLY" ? "solo celdas vacías" : "cambios pendientes"
      })`
    );
  };

  if (analyticsViewMode === "ANALYTICS") {
    return (
      <>
        <GradeCenterAnalyticsDashboard
          rows={filteredRows}
          assessments={context.assessments ?? []}
          pendingGrades={pendingGrades}
          scale={context.scale}
          courseName={selected.course?.name ?? "11-2"}
          subjectName={selected.subject?.name ?? "Matemáticas"}
          periodName={selected.period?.name ?? "Periodo 2"}
          weightTotal={weightTotal}
          onBackToGradeCenter={() => setAnalyticsViewMode("TABLE")}
          onNavigateToAssessment={(assessmentId: number) => {
            setAnalyticsViewMode("TABLE");
            const firstStudent = filteredRows[0]?.enrollment.studentUserId;
            if (firstStudent) {
              handleNavigateToCell(firstStudent, assessmentId);
            }
          }}
          onNavigateToPending={() => {
            setAnalyticsViewMode("TABLE");
            setFilter("PENDING");
          }}
          onNavigateToRisk={() => {
            setAnalyticsViewMode("TABLE");
            setFilter("LOW");
          }}
          onOpenStudentStats={(st: GradeCenterTableRow) => {
            setAnalyticsViewMode("TABLE");
            setSelectedStatsStudent(st);
            setShowStudentStatsDialog(true);
          }}
        />
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog && !autoSaveEnabled && totalPending > 0}
          onClose={handleCancelTransition}
          pendingGradesCount={Object.keys(pendingGrades).length}
          pendingCommentsCount={Object.keys(pendingComments).length}
          isSaving={saveGrades.isPending}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscardAndContinue={handleDiscardAndContinue}
          destinationLabel={pendingTransition?.label}
        />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {/* Encabezado del Grade Center */}
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--edc-primary)]">
              Grade Center
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selected.period?.name ?? "Periodo 2"} · {context.rows?.length ?? 0} estudiantes · {context.assessments?.length ?? 0} evaluaciones
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            {selected.course?.name ?? "11-2"} · {selected.subject?.name ?? "Matemáticas"}
          </h1>
        </div>
      </div>

      {/* Barra de herramientas y filtros (Liquid Glass sutil) */}
      <GradeCenterToolbar
        courses={context.courses ?? []}
        subjects={context.subjects ?? []}
        periods={context.periods ?? []}
        selectedCourseId={selected.course?.id}
        selectedSubjectId={selected.subject?.id}
        selectedPeriodId={selected.period?.id}
        onCourseChange={handleCourseChange}
        onSubjectChange={handleSubjectChange}
        onPeriodChange={handlePeriodChange}
        searchQuery={query}
        onSearchChange={setQuery}
        currentFilter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        gridDensity={gridDensity}
        onGridDensityChange={handleGridDensityChange}
        pendingCount={Object.keys(pendingGrades).length}
        isSavingAll={saveGrades.isPending}
        onSaveAll={handleSaveAll}
        onNewAssessment={() => setShowAssessmentForm(prev => !prev)}
        stats={context.stats}
        weightTotal={weightTotal}
        selectedCount={selectedStudentIds.length}
        onClearSelection={() => setSelectedStudentIds([])}
        onOpenBulkGrade={() => setShowBulkDialog(true)}
        canWrite={true}
        showStats={showStats}
        onToggleStats={() => setShowStats(prev => !prev)}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={handleToggleAutoSave}
        saveStatus={saveStatus}
      />

      {/* Laboratorio UX: Nueva Evaluación 2.0 (Panel Lateral / Sheet) */}
      <NewAssessmentSheet
        isOpen={showAssessmentForm}
        onClose={() => setShowAssessmentForm(false)}
        courseName={selected.course?.name ?? "11-2"}
        subjectName={selected.subject?.name ?? "Matemáticas"}
        periodName={selected.period?.name ?? "Periodo 2"}
        academicYearId={selected.course?.academicYearId ?? 0}
        academicPeriodId={selected.period?.id ?? 0}
        courseId={selected.course?.id ?? 0}
        subjectId={selected.subject?.id ?? 0}
        weightTotal={weightTotal}
        maxValue={context.scale?.maxValue ?? 5}
        role={role}
        onSuccess={async () => {
          setShowAssessmentForm(false);
          await utils.gradeCenter.context.invalidate();
        }}
      />

      {/* BARRA COMPACTA DE MÉTRICAS Y ACCIONES RÁPIDAS (Grid 2.0) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-2xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 text-xs">
        {/* Métricas directas del curso */}
        <div className="flex flex-wrap items-center gap-2.5 text-slate-600 dark:text-slate-300">
          {/* Promedio General */}
          <div className="flex items-center gap-1.5" title="Promedio ponderado del grupo en este periodo">
            <span className="text-slate-400 font-medium">Promedio:</span>
            <span className="font-extrabold text-slate-900 dark:text-white">
              {courseSummary.average !== null ? courseSummary.average.toFixed(2) : "—"}
            </span>
            <span className="text-[10px] text-slate-400">/ 5.0</span>
          </div>

          <span className="hidden sm:inline text-slate-200 dark:text-slate-700">·</span>

          {/* Tasa de Aprobación */}
          <div className="flex items-center gap-1.5" title="Porcentaje de estudiantes aprobados (nota definitiva ≥ 3.5)">
            <span className="text-slate-400 font-medium">Aprobación:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {courseSummary.passingRate}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({courseSummary.passingCount}/{courseSummary.totalStudents})
            </span>
          </div>

          <span className="hidden sm:inline text-slate-200 dark:text-slate-700">·</span>

          {/* Ponderación Curricular del Periodo */}
          <div title={`Ponderación curricular: Suma de los porcentajes asignados a las ${context.assessments?.length ?? 0} evaluaciones del periodo.`}>
            {weightTotal >= 100 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                ✓ Ponderación: 100% configurado
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                title="Para que el cálculo de la definitiva sea completo, la suma de las evaluaciones debe alcanzar el 100%."
              >
                ⚠ Ponderación: {weightTotal}% configurado · {100 - weightTotal}% restante
              </span>
            )}
          </div>

          <span className="hidden md:inline text-slate-200 dark:text-slate-700">·</span>

          {/* Progreso de Calificaciones Diligenciadas */}
          <div className="hidden md:flex items-center gap-1 text-[11px]" title="Notas diligenciadas sobre el total de casillas del grupo en este periodo">
            <span className="text-slate-400 font-medium">Calificaciones:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {courseSummary.gradedTotal}/{courseSummary.totalPossibleGrades}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({courseSummary.gradedRate}%)</span>
          </div>
        </div>

        {/* Píldoras de filtrado rápido accionable */}
        <div className="flex items-center gap-1.5">
          {/* Píldora Requiere atención */}
          <button
            type="button"
            onClick={() => setFilter(prev => (prev === "LOW" ? "ALL" : "LOW"))}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
              filter === "LOW"
                ? "border border-rose-400 bg-rose-100 text-rose-800 shadow-xs ring-1 ring-rose-400 dark:bg-rose-950/80 dark:text-rose-200"
                : "border border-rose-200/90 bg-rose-50/70 text-rose-700 hover:bg-rose-100/80 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
            title="Clic para filtrar estudiantes que requieren atención académica (< 3.5)"
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{courseSummary.riskCount} requieren atención</span>
          </button>

          {/* Píldora Por Calificar */}
          <button
            type="button"
            onClick={() => setFilter(prev => (prev === "PENDING" ? "ALL" : "PENDING"))}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
              filter === "PENDING"
                ? "border border-amber-400 bg-amber-100 text-amber-800 shadow-xs ring-1 ring-amber-400 dark:bg-amber-950/80 dark:text-amber-200"
                : "border border-amber-200/90 bg-amber-50/70 text-amber-700 hover:bg-amber-100/80 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
            title="Clic para filtrar estudiantes con notas vacías pendientes de calificar"
          >
            <BarChart3 className="h-3 w-3" />
            <span>{courseSummary.pendingTotal} por calificar</span>
          </button>
        </div>
      </div>

      {/* MINI PANEL DE ANÁLISIS INTELIGENTE (FASE 5.3-F) */}
      <GradeAnalyticsMiniPanel
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        rows={filteredRows}
        assessments={context.assessments ?? []}
        pendingGrades={pendingGrades}
        scale={context.scale}
        courseName={selected.course?.name ?? "11-2"}
        subjectName={selected.subject?.name ?? "Matemáticas"}
        periodName={selected.period?.name ?? "Periodo 2"}
        weightTotal={weightTotal}
        onNavigateToCell={handleNavigateToCell}
        onSelectAssessment={aId => {
          const firstStudent = filteredRows[0]?.enrollment.studentUserId;
          if (firstStudent) {
            handleNavigateToCell(firstStudent, aId);
          }
        }}
        onFilterPending={() => setFilter("PENDING")}
        onFilterRisk={() => setFilter("LOW")}
        onOpenStudentStats={(st: GradeCenterTableRow) => {
          setSelectedStatsStudent(st);
          setShowStudentStatsDialog(true);
        }}
        onOpenFullAnalytics={() => {
          setShowStats(false);
          setAnalyticsViewMode("ANALYTICS");
        }}
      />

      {/* TABLA PRINCIPAL DE CALIFICACIONES (EJE CENTRAL ABSOLUTO) */}
      <GradeCenterTable
        assessments={context.assessments ?? []}
        rows={filteredRows}
        courseName={selected.course?.name}
        subjectName={selected.subject?.name}
        scale={context.scale}
        pendingGrades={pendingGrades}
        pendingComments={pendingComments}
        canWrite={true}
        onSaveCellGrade={handleSaveCellGrade}
        onCellPendingChange={handleCellPendingChange}
        onOpenSimulator={handleOpenSimulator}
        externalTargetCell={externalTargetCell}
        onClearExternalTargetCell={() => setExternalTargetCell(null)}
        isSaving={saveGrades.isPending}
        selectedStudentIds={selectedStudentIds}
        onToggleStudent={handleToggleStudent}
        onToggleAllVisible={handleToggleAllVisible}
        groupAverage={groupAverage}
        viewMode={viewMode}
        density={gridDensity}
        onEditAssessment={handleEditAssessment}
        onDeleteAssessment={handleDeleteAssessment}
        onFilterPendingForAssessment={handleFilterPendingForAssessment}
        onOpenStudentStats={st => {
          setSelectedStatsStudent(st);
          setShowStudentStatsDialog(true);
        }}
      />

      {/* Diálogo de Calificación Masiva */}
      <BulkGradeDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        assessments={context.assessments ?? []}
        selectedAssessmentId={selectedAssessmentId ?? undefined}
        rows={filteredRows}
        selectedStudentIds={selectedStudentIds}
        scale={context.scale}
        pendingGrades={pendingGrades}
        onApply={handleApplyBulkGrade}
      />

      {/* Simulador de Escenarios en Memoria (Fase 5.3-C) */}
      <ScenarioSimulatorDialog
        open={showSimulator}
        onOpenChange={open => {
          setShowSimulator(open);
          if (!open) setSimulatorStudent(null);
        }}
        studentRow={simulatorStudent}
        scale={context.scale}
        pendingGrades={pendingGrades}
      />

      {/* Diálogo de Estadísticas Individuales del Estudiante (Fase 5.3-D) */}
      <StudentStatisticsDialog
        open={showStudentStatsDialog}
        onOpenChange={open => {
          setShowStudentStatsDialog(open);
          if (!open) setSelectedStatsStudent(null);
        }}
        studentRow={selectedStatsStudent}
        assessments={context.assessments ?? []}
        scale={context.scale}
        pendingGrades={pendingGrades}
        groupAverage={groupAverage}
      />

      {/* Guardián de cambios pendientes sin guardar (Subfase 1, Iteración 1 & 2) */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog && !autoSaveEnabled && totalPending > 0}
        onClose={handleCancelTransition}
        pendingGradesCount={Object.keys(pendingGrades).length}
        pendingCommentsCount={Object.keys(pendingComments).length}
        isSaving={saveGrades.isPending}
        onSaveAndContinue={handleSaveAndContinue}
        onDiscardAndContinue={handleDiscardAndContinue}
        destinationLabel={pendingTransition?.label}
      />
    </div>
  );
}

// =======================================================
// VISTAS PROTEGIDAS SEGÚN ROL (FASE 5.2-A PRESERVADAS)
// =======================================================

function StudentGradesView({ context, subjectId, onSubjectChange }: any) {
  const row = context.rows?.[0];
  const sName = studentName(row?.student);
  const definitiva = row?.average;
  const tone = getPerformanceTone(definitiva);
  const [showSimulator, setShowSimulator] = React.useState(false);

  // Normalizar valores para el motor de inteligencia
  const normalizedValues = React.useMemo(() => {
    return (context.assessments ?? []).map((a: any) => {
      const item = row?.values.find((v: any) => v.assessment.id === a.id);
      return {
        value:
          item?.grade?.value !== null &&
          item?.grade?.value !== undefined &&
          !isNaN(Number(item?.grade?.value))
            ? Number(item?.grade?.value)
            : null,
        maxValue: Number(a.maxValue) || (context.scale?.maxValue ?? 5),
        weight: Number(a.weight) || 0,
      };
    });
  }, [context.assessments, row, context.scale?.maxValue]);

  const projection = React.useMemo(() => {
    return calculateStudentProjection(normalizedValues, context.scale);
  }, [normalizedValues, context.scale]);

  const neededToPass = React.useMemo(() => {
    return calculateWhatIsNeededToPass(normalizedValues, context.scale);
  }, [normalizedValues, context.scale]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">
            Mis Calificaciones
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Mi Progreso Académico
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {sName} · {context.selected?.course?.name ?? "Curso"} · {context.selected?.period?.name}
          </p>
        </div>
      </div>

      {/* Tarjeta Inteligente: "¿Qué necesito para aprobar?" y Proyección */}
      {neededToPass.hasPending && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-blue-950/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Meta de Aprobación & Proyección
              </span>
              {projection.projectedDefinitiva !== null && (
                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                  Proyección estimada: {numberValue(projection.projectedDefinitiva)}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {neededToPass.message}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowSimulator(true)}
            className="rounded-xl bg-[var(--edc-primary)] text-white text-xs font-semibold hover:bg-[var(--edc-primary)]/90 shrink-0"
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            Simular mis notas
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Definitiva materia</p>
          <p className={`mt-2 text-3xl font-extrabold ${tone.textColor}`}>{numberValue(definitiva)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Evaluaciones</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{context.assessments.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Completitud</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{context.stats.completion}%</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            {context.selected?.subject?.name ?? "Materia"} · Calificaciones Registradas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {context.assessments.map((assessment: any) => {
            const item = row?.values.find((v: any) => v.assessment.id === assessment.id);
            const valTone = getPerformanceTone(item?.grade?.value);
            return (
              <div
                key={assessment.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:bg-slate-50/80"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{assessment.title}</p>
                  <p className="text-xs text-slate-400">
                    {assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType} · {assessment.weight}%
                  </p>
                  {item?.grade?.comment && (
                    <p className="mt-1 text-xs italic text-slate-600 bg-slate-50 rounded-md p-1.5 border border-slate-100">
                      Docente: {item.grade.comment}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${valTone.textColor}`}>
                    {numberValue(item?.grade?.value)}
                  </span>
                </div>
              </div>
            );
          })}
          {!context.assessments.length && (
            <p className="py-6 text-center text-xs text-slate-400">No hay evaluaciones registradas en este periodo.</p>
          )}
        </CardContent>
      </Card>

      {/* Simulador de Escenarios en Memoria para el estudiante */}
      <ScenarioSimulatorDialog
        open={showSimulator}
        onOpenChange={setShowSimulator}
        studentRow={row}
        scale={context.scale}
      />
    </div>
  );
}

function GuardianPerformanceView({ context, subjectId, onSubjectChange }: any) {
  const [studentId, setStudentId] = React.useState<number | undefined>(
    context.rows[0]?.enrollment.studentUserId
  );
  const row = context.rows.find((item: any) => item.enrollment.studentUserId === studentId) ?? context.rows[0];
  const sName = studentName(row?.student);
  const definitiva = row?.average;
  const tone = getPerformanceTone(definitiva);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">
            Acompañamiento Familiar
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Progreso Académico
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Consulta el rendimiento de tus estudiantes vinculados formalmente.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="text-xs font-semibold text-slate-600 flex-1">
          Estudiante
          <select
            value={studentId ?? ""}
            onChange={e => setStudentId(Number(e.target.value))}
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            {context.rows.map((item: any) => (
              <option key={item.enrollment.studentUserId} value={item.enrollment.studentUserId}>
                {studentName(item.student)} · {context.selected?.course?.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Definitiva actual</p>
          <p className={`mt-2 text-3xl font-extrabold ${tone.textColor}`}>{numberValue(definitiva)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Evaluaciones</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{context.assessments.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Periodo</p>
          <p className="mt-2 text-xl font-bold text-slate-800">{context.selected?.period?.name ?? "—"}</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            Calificaciones de {sName} · {context.selected?.subject?.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(row?.values ?? []).map((item: any) => {
            const valTone = getPerformanceTone(item.grade?.value);
            return (
              <div
                key={item.assessment.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.assessment.title}</p>
                  <p className="text-xs text-slate-400">
                    {assessmentLabels[item.assessment.assessmentType] ?? item.assessment.assessmentType} · {item.assessment.weight}%
                  </p>
                  {item.grade?.comment && (
                    <p className="mt-1 text-xs italic text-slate-600 bg-slate-50 rounded-md p-1.5 border border-slate-100">
                      Retroalimentación: {item.grade.comment}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${valTone.textColor}`}>
                    {numberValue(item.grade?.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminPerformanceView({
  context,
  courseId,
  subjectId,
  periodId,
  onCourseChange,
  onSubjectChange,
  onPeriodChange,
  showStats,
  setShowStats,
}: any) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">
            Rendimiento Institucional
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Supervisión del Grade Center
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Lectura institucional de completitud y promedios académicos sin invadir el calificador docente.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Promedio general</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--edc-primary)]">
            {numberValue(context.stats.average)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Estudiantes</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{context.stats.students}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Completitud</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600">{context.stats.completion}%</p>
        </div>
      </div>

      {/* Tabla en modo lectura supervisada */}
      <GradeCenterTable
        assessments={context.assessments ?? []}
        rows={context.rows ?? []}
        scale={context.scale}
        pendingGrades={{}}
        pendingComments={{}}
        canWrite={false}
        onSaveCellGrade={() => {}}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

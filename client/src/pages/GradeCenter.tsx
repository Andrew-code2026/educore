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
import { GroupIntelligenceBar } from "@/components/grade-center/GroupIntelligenceBar";
import { ScenarioSimulatorDialog } from "@/components/grade-center/ScenarioSimulatorDialog";
import { GradeStatisticsPanel } from "@/components/grade-center/GradeStatisticsPanel";
import { StudentStatisticsDialog } from "@/components/grade-center/StudentStatisticsDialog";
import { calculateMean } from "@/components/grade-center/gradeStatisticsUtils";
import {
  studentName,
  numberValue,
  calculateDefinitiva,
  assessmentLabels,
  getPerformanceTone,
} from "@/components/grade-center/gradeCenterUtils";
import {
  calculateStudentProjection,
  calculateWhatIsNeededToPass,
} from "@/components/grade-center/gradeIntelligenceUtils";

type EduRole = "admin" | "teacher" | "student" | "guardian";
type GradeCenterProps = { role: EduRole; school: any };

export function GradeCenterPage({ role }: GradeCenterProps) {
  const [courseId, setCourseId] = React.useState<number | undefined>();
  const [subjectId, setSubjectId] = React.useState<number | undefined>();
  const [periodId, setPeriodId] = React.useState<number | undefined>();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<GradeFilterKey>("ALL");
  const [viewMode, setViewMode] = React.useState<GradeViewMode>("NOTES");

  // Almacena cambios en edición pendientes de sincronizar
  const [pendingGrades, setPendingGrades] = React.useState<Record<string, number | null>>({});
  const [pendingComments, setPendingComments] = React.useState<Record<string, string>>({});
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<number[]>([]);
  const [showBulkDialog, setShowBulkDialog] = React.useState(false);

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
  const [selectedAssessmentId, setSelectedAssessmentId] = React.useState<number | null>(null);
  const [selectedStatsStudent, setSelectedStatsStudent] = React.useState<GradeCenterTableRow | null>(null);
  const [showStudentStatsDialog, setShowStudentStatsDialog] = React.useState(false);

  const [newAssessment, setNewAssessment] = React.useState({
    title: "",
    type: "ACTIVIDAD",
    weight: "10",
    date: new Date().toISOString().slice(0, 10),
    maxValue: "5",
    description: "",
  });

  const contextQuery = trpc.gradeCenter.context.useQuery(
    { role, courseId, subjectId, academicPeriodId: periodId },
    { staleTime: 10_000 }
  );

  const saveGrades = trpc.gradeCenter.saveGrades.useMutation();
  const createAssessment = trpc.gradeCenter.createAssessment.useMutation();
  const updateAssessment = trpc.gradeCenter.updateAssessment.useMutation();
  const utils = trpc.useUtils();
  const context = contextQuery.data;

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
        if (def >= 3.0) passingCount++;
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
    return {
      average: groupAverage,
      passingRate,
      passingCount,
      riskCount,
      pendingTotal,
      totalStudents,
    };
  }, [context?.rows, pendingGrades, groupAverage]);

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
    return <StudentGradesView context={context} subjectId={subjectId} onSubjectChange={setSubjectId} />;
  }
  if (role === "guardian") {
    return <GuardianPerformanceView context={context} subjectId={subjectId} onSubjectChange={setSubjectId} />;
  }
  if (role === "admin") {
    return (
      <AdminPerformanceView
        context={context}
        courseId={courseId}
        subjectId={subjectId}
        periodId={periodId}
        onCourseChange={(val: number) => {
          setCourseId(val);
          setSubjectId(undefined);
        }}
        onSubjectChange={setSubjectId}
        onPeriodChange={setPeriodId}
        showStats={showStats}
        setShowStats={setShowStats}
      />
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
      return rowDefinitiva !== null && rowDefinitiva < 3.0;
    }
    if (filter === "PASSING") {
      return rowDefinitiva !== null && rowDefinitiva >= 3.0;
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

  // Guardar todos los cambios pendientes acumulados
  const handleSaveAll = async () => {
    const keys = Object.keys(pendingGrades);
    if (!keys.length) return;
    try {
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
      toast.success("Todas las calificaciones pendientes fueron guardadas");
    } catch (error: any) {
      toast.error(error?.message ?? "Error al guardar calificaciones.");
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

  // Creación de nueva evaluación
  const handleCreateAssessment = async () => {
    if (!selected.course?.academicYearId || !selected.course?.id || !selected.subject?.id || !selected.period?.id) {
      toast.error("Contexto académico incompleto.");
      return;
    }
    if (!newAssessment.title.trim()) {
      toast.error("El nombre de la evaluación es requerido.");
      return;
    }
    try {
      await createAssessment.mutateAsync({
        role,
        academicYearId: selected.course.academicYearId,
        academicPeriodId: selected.period.id,
        courseId: selected.course.id,
        subjectId: selected.subject.id,
        title: newAssessment.title.trim(),
        assessmentType: newAssessment.type as any,
        date: new Date(newAssessment.date),
        maxValue: Number(newAssessment.maxValue),
        weight: Number(newAssessment.weight),
        description: newAssessment.description.trim() || undefined,
        status: "DRAFT",
      });
      setShowAssessmentForm(false);
      setNewAssessment({
        title: "",
        type: "ACTIVIDAD",
        weight: "10",
        date: new Date().toISOString().slice(0, 10),
        maxValue: "5",
        description: "",
      });
      await utils.gradeCenter.context.invalidate();
      toast.success("Evaluación creada exitosamente");
    } catch (error: any) {
      toast.error(error?.message ?? "No pudimos crear la evaluación.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado del Grade Center */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--edc-primary)]">
              Grade Center
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[var(--edc-primary)] dark:bg-blue-950/60 dark:text-blue-300">
              {selected.period?.name ?? "Periodo 2"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {selected.course?.name ?? "11-2"} · {selected.subject?.name ?? "Matemáticas"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {context.rows?.length ?? 0} estudiantes matriculados · {context.assessments?.length ?? 0} evaluaciones configuradas
          </p>
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
        onCourseChange={(val: number) => {
          setCourseId(val);
          setSubjectId(undefined);
        }}
        onSubjectChange={setSubjectId}
        onPeriodChange={setPeriodId}
        searchQuery={query}
        onSearchChange={setQuery}
        currentFilter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
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
      />

      {/* Formulario de nueva evaluación (desplegable) */}
      {showAssessmentForm && (
        <Card className="rounded-2xl border border-[var(--edc-accent)]/60 bg-[var(--edc-secondary)]/25 p-4 shadow-sm">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-bold text-slate-800">
              Nueva evaluación
              <span className="ml-2 text-xs font-normal text-slate-500">
                Contexto: {selected.course?.name} · {selected.subject?.name} · {selected.period?.name}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              aria-label="Nombre de evaluación"
              placeholder="Nombre (ej. Parcial 1)"
              value={newAssessment.title}
              onChange={e => setNewAssessment({ ...newAssessment, title: e.target.value })}
              className="h-9 rounded-xl bg-white text-xs"
            />
            <select
              aria-label="Tipo"
              value={newAssessment.type}
              onChange={e => setNewAssessment({ ...newAssessment, type: e.target.value })}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="ACTIVIDAD">Actividad</option>
              <option value="QUIZ">Quiz</option>
              <option value="TALLER">Taller</option>
              <option value="EXAMEN">Examen</option>
              <option value="PROYECTO">Proyecto</option>
            </select>
            <Input
              aria-label="Valor máximo"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={newAssessment.maxValue}
              onChange={e => setNewAssessment({ ...newAssessment, maxValue: e.target.value })}
              placeholder="Valor máx (5)"
              className="h-9 rounded-xl bg-white text-xs"
            />
            <Input
              aria-label="Peso porcentaje"
              type="number"
              min="0"
              max="100"
              value={newAssessment.weight}
              onChange={e => setNewAssessment({ ...newAssessment, weight: e.target.value })}
              placeholder="Peso % (ej. 20)"
              className="h-9 rounded-xl bg-white text-xs"
            />
            <Input
              aria-label="Fecha"
              type="date"
              value={newAssessment.date}
              onChange={e => setNewAssessment({ ...newAssessment, date: e.target.value })}
              className="h-9 rounded-xl bg-white text-xs"
            />
            <Input
              aria-label="Descripción"
              placeholder="Descripción opcional..."
              value={newAssessment.description}
              onChange={e => setNewAssessment({ ...newAssessment, description: e.target.value })}
              className="h-9 rounded-xl bg-white text-xs sm:col-span-2 lg:col-span-3"
            />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                size="sm"
                onClick={handleCreateAssessment}
                disabled={createAssessment.isPending || !newAssessment.title.trim()}
                className="h-8 rounded-xl bg-[var(--edc-primary)] px-4 text-xs font-semibold text-white"
              >
                {createAssessment.isPending ? "Creando..." : "Crear evaluación"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAssessmentForm(false)}
                className="h-8 rounded-xl px-3 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BARRA DE INTELIGENCIA DE CALIFICACIONES (FASE 5.3-C) */}
      <GroupIntelligenceBar
        rows={filteredRows}
        assessments={context.assessments ?? []}
        pendingGrades={pendingGrades}
        scale={context.scale}
        courseName={selected.course?.name}
        subjectName={selected.subject?.name}
        onNavigateToCell={handleNavigateToCell}
        onOpenSimulator={handleOpenSimulator}
      />

      {/* PANEL DE ESTADÍSTICAS AVANZADAS (FASE 5.3-D) */}
      {showStats && (
        <GradeStatisticsPanel
          rows={filteredRows}
          assessments={context.assessments ?? []}
          scale={context.scale}
          pendingGrades={pendingGrades}
          onNavigateToCell={handleNavigateToCell}
          onOpenStudentStats={(st: GradeCenterTableRow) => {
            setSelectedStatsStudent(st);
            setShowStudentStatsDialog(true);
          }}
          onSelectAssessment={aId => {
            const firstStudent = filteredRows[0]?.enrollment.studentUserId;
            if (firstStudent) {
              handleNavigateToCell(firstStudent, aId);
            }
          }}
        />
      )}

      {/* RESUMEN COMPACTO DEL CURSO (SaaS Moderno / Finova / LearnIQ) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Promedio General */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--edc-primary)] dark:bg-blue-950/60">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Promedio general</p>
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              {courseSummary.average !== null ? courseSummary.average.toFixed(2) : "—"}{" "}
              <span className="text-[10px] font-normal text-slate-400">/ 5.0</span>
            </p>
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aprobación</p>
            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {courseSummary.passingRate}%{" "}
              <span className="text-[10px] font-normal text-slate-400">
                ({courseSummary.passingCount}/{courseSummary.totalStudents})
              </span>
            </p>
          </div>
        </div>

        {/* En Riesgo */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En riesgo</p>
            <p className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
              {courseSummary.riskCount}{" "}
              <span className="text-[10px] font-normal text-slate-400">
                estudiante{courseSummary.riskCount === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </div>

        {/* Pendientes */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendientes</p>
            <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
              {courseSummary.pendingTotal}{" "}
              <span className="text-[10px] font-normal text-slate-400">por calificar</span>
            </p>
          </div>
        </div>
      </div>

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
        onEditAssessment={handleEditAssessment}
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

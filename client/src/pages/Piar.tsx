import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
import type { PiarValues } from "@shared/piar";
import { PiarLanding } from "@/piar/PiarLanding";
import { PiarCourse } from "@/piar/PiarCourse";
import { PiarEditor, PiarEditorLoading } from "@/piar/PiarEditor";
import { buildPiarCourseDetail, buildPiarLanding, type PiarCourseModel, type PiarStudentInput, type PiarStudentRowModel } from "@/piar/model";

interface PiarPageProps {
  data: any;
  role: EduRole;
}

const LEDE: Partial<Record<EduRole, string>> = {
  teacher: "Diligencia los anexos del Plan Individual de Ajustes Razonables de los estudiantes de tus cursos que lo requieren.",
  admin: "Consulta y acompaña los Planes Individuales de Ajustes Razonables de todos los cursos de la institución.",
};

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** PIAR: cursos → estudiantes con PIAR del curso → anexos de un estudiante. */
export function PiarPage({ data, role }: PiarPageProps) {
  const utils = trpc.useUtils();
  const [openCourse, setOpenCourse] = useState<{ courseId: number; group: string } | null>(null);
  const [openRecordId, setOpenRecordId] = useState<number | null>(null);

  const coursesQuery = trpc.piar.courses.useQuery({ role }, { staleTime: 30_000, retry: 1 });
  const courseQuery = trpc.piar.course.useQuery(
    { role, courseId: openCourse?.courseId ?? 0 },
    { enabled: openCourse !== null, staleTime: 30_000, retry: 1 },
  );
  // El editor guarda su propia copia: se monta con datos recién leídos y no se refresca solo
  const recordQuery = trpc.piar.record.useQuery(
    { role, recordId: openRecordId ?? 0 },
    { enabled: openRecordId !== null, retry: 1, refetchOnMount: "always", refetchOnWindowFocus: false },
  );
  const createMutation = trpc.piar.create.useMutation();
  const { mutateAsync: saveRecord } = trpc.piar.save.useMutation();
  const { mutateAsync: removeRecord } = trpc.piar.remove.useMutation();

  const landing = useMemo(() => (coursesQuery.data ? buildPiarLanding(coursesQuery.data) : null), [coursesQuery.data]);
  const courseModel = useMemo(() => (courseQuery.data ? buildPiarCourseDetail(courseQuery.data) : null), [courseQuery.data]);
  const academicYear = coursesQuery.data?.[0]?.year ?? String(new Date().getFullYear());
  const isTeacher = role === "teacher";
  const coursesTitle = isTeacher ? "Mis cursos" : "Cursos";

  const refreshLists = useCallback(
    () => Promise.all([utils.piar.courses.invalidate(), utils.piar.course.invalidate()]),
    [utils],
  );

  const handleCreate = useCallback(
    async (student: PiarStudentInput) => {
      if (!openCourse) return;
      try {
        const created = await createMutation.mutateAsync({ role, courseId: openCourse.courseId, studentId: student.studentId });
        toast.success(`PIAR de ${student.name} registrado. Ya puedes diligenciar sus anexos.`);
        void refreshLists();
        setOpenRecordId(created.id);
      } catch (error) {
        toast.error(errorMessage(error, `No pudimos registrar el PIAR de ${student.name}.`));
        throw error;
      }
    },
    [createMutation, openCourse, refreshLists, role],
  );

  const recordId = recordQuery.data?.id ?? null;
  const handleSave = useCallback(
    async (values: PiarValues, finalize: boolean) => {
      if (recordId === null) throw new Error("PIAR no disponible.");
      try {
        const saved = await saveRecord({ role, recordId, values, finalize });
        // La caché queda con lo último guardado: reabrir el PIAR nunca muestra una versión vieja
        utils.piar.record.setData({ role, recordId }, current =>
          current ? { ...current, ...saved, values, finalizedAt: saved.finalizedAt } : current,
        );
        if (finalize) toast.success("PIAR finalizado. Ya puedes imprimirlo o guardarlo en PDF.");
        return saved;
      } catch (error) {
        if (finalize) toast.error(errorMessage(error, "No pudimos finalizar el PIAR."));
        throw error;
      }
    },
    [recordId, role, saveRecord, utils],
  );

  const handleRemove = useCallback(async () => {
    if (recordId === null) return;
    const name = recordQuery.data?.student.name ?? "el estudiante";
    try {
      await removeRecord({ role, recordId });
      toast.success(`Se retiró el PIAR de ${name}.`);
      setOpenRecordId(null);
      void refreshLists();
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos retirar el PIAR."));
      throw error;
    }
  }, [recordId, recordQuery.data?.student.name, refreshLists, removeRecord, role]);

  const handleOpenCourse = useCallback((course: PiarCourseModel) => setOpenCourse({ courseId: course.courseId, group: course.group }), []);
  const handleOpenRecord = useCallback((row: PiarStudentRowModel) => setOpenRecordId(row.recordId), []);
  const handleCloseRecord = useCallback(() => {
    setOpenRecordId(null);
    void refreshLists();
  }, [refreshLists]);

  if (openCourse && openRecordId !== null) {
    const record = recordQuery.data;
    if (record && recordQuery.isFetchedAfterMount) {
      return (
        <PiarEditor
          key={record.id}
          record={record}
          group={record.course.name || openCourse.group}
          schoolName={data?.school?.name ?? "Institución educativa"}
          onBack={handleCloseRecord}
          onSave={handleSave}
          onRemove={handleRemove}
        />
      );
    }
    return (
      <PiarEditorLoading
        group={openCourse.group}
        // `null` sin error: el servidor no tiene base de datos disponible
        error={recordQuery.isError || (recordQuery.isFetchedAfterMount && recordQuery.data === null)}
        onBack={handleCloseRecord}
        onRetry={() => void recordQuery.refetch()}
      />
    );
  }

  if (openCourse) {
    return (
      <PiarCourse
        group={openCourse.group}
        academicYear={academicYear}
        backLabel={coursesTitle}
        model={courseModel}
        // `null` sin error: el servidor no tiene base de datos disponible
        error={(courseQuery.isError && !courseQuery.data) || courseQuery.data === null}
        creating={createMutation.isPending}
        onBack={() => setOpenCourse(null)}
        onRetry={() => void courseQuery.refetch()}
        onOpenRecord={handleOpenRecord}
        onCreate={handleCreate}
      />
    );
  }

  return (
    <PiarLanding
      model={landing}
      academicYear={academicYear}
      lede={LEDE[role] ?? LEDE.teacher!}
      coursesTitle={coursesTitle}
      error={coursesQuery.isError && !coursesQuery.data}
      onRetry={() => void coursesQuery.refetch()}
      onOpenCourse={handleOpenCourse}
    />
  );
}

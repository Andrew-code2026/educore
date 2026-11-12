import { useCallback, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
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
import type { Clarification, ClarifyQuestion } from "@shared/creator";
import { CreatorLanding, type CreateRequest, type ResourceCard } from "@/creator/CreatorLanding";
import { CreatorWorkspace } from "@/creator/CreatorWorkspace";

interface CreatorPageProps {
  data: any;
  role: EduRole;
}

const LEDE: Partial<Record<EduRole, string>> = {
  teacher: "Describe la guía, el taller o la evaluación que necesitas. La IA la escribe con fórmulas, gráficas y clave de respuestas; tú la ajustas y la imprimes.",
  admin: "Prepara guías, talleres y evaluaciones con IA para apoyar a los docentes de la institución. Cada recurso se puede ajustar e imprimir.",
};

type SampleList = inferRouterOutputs<AppRouter>["creator"]["status"]["samples"];
type SampleId = SampleList[number]["id"];
const NO_SAMPLES: SampleList = [];

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const names = (rows: unknown): string[] =>
  Array.isArray(rows) ? Array.from(new Set(rows.map(row => (typeof row?.name === "string" ? row.name.trim() : "")).filter(Boolean))) : [];

/** Creador de recursos: portada con "Mis recursos" → editor de un recurso con el asistente. */
export function CreatorPage({ data, role }: CreatorPageProps) {
  const utils = trpc.useUtils();
  const [openId, setOpenId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<ResourceCard | null>(null);
  /** Solicitud que espera las respuestas del docente a las preguntas de la IA. */
  const [pending, setPending] = useState<{ request: CreateRequest; questions: ClarifyQuestion[] } | null>(null);

  const statusQuery = trpc.creator.status.useQuery({ role }, { staleTime: 30_000, retry: 1 });
  const listQuery = trpc.creator.list.useQuery({ role }, { enabled: openId === null, staleTime: 10_000, retry: 1 });
  const createMutation = trpc.creator.create.useMutation();
  const clarifyMutation = trpc.creator.clarify.useMutation();
  const sampleMutation = trpc.creator.createSample.useMutation();
  const duplicateMutation = trpc.creator.duplicate.useMutation();
  const removeMutation = trpc.creator.remove.useMutation();

  const aiReady = statusQuery.data?.aiReady ?? false;
  const remaining = statusQuery.data ? statusQuery.data.dailyLimit - statusQuery.data.usedToday : null;
  const samples = statusQuery.data?.samples ?? NO_SAMPLES;

  /** Abrir un recurso descarta las preguntas que hubieran quedado sin responder. */
  const openResource = useCallback((id: number) => {
    setPending(null);
    setOpenId(id);
  }, []);
  const subjects = useMemo(() => names(data?.subjects), [data?.subjects]);
  const courses = useMemo(() => names(data?.courses), [data?.courses]);

  const refreshUsage = useCallback(() => void utils.creator.status.invalidate(), [utils]);

  const create = useCallback(
    async (request: CreateRequest, clarifications: Clarification[] = []) => {
      try {
        const created = await createMutation.mutateAsync({ role, ...request, clarifications });
        refreshUsage();
        setPending(null);
        setOpenId(created.id);
      } catch (error) {
        toast.error(errorMessage(error, "No pudimos crear el recurso."));
      }
    },
    [createMutation, refreshUsage, role],
  );

  const handleCreate = useCallback(
    async (request: CreateRequest, ask: boolean) => {
      if (ask) {
        try {
          const { questions } = await clarifyMutation.mutateAsync({ role, ...request });
          if (questions.length > 0) {
            setPending({ request, questions });
            return;
          }
        } catch {
          // Las preguntas son un extra: si fallan, el recurso se crea sin ellas
        }
      }
      await create(request);
    },
    [clarifyMutation, create, role],
  );

  const handleOpenSample = useCallback(
    async (sample: SampleId) => {
      try {
        const created = await sampleMutation.mutateAsync({ role, sample });
        setOpenId(created.id);
      } catch (error) {
        toast.error(errorMessage(error, "No pudimos abrir el ejemplo."));
      }
    },
    [role, sampleMutation],
  );

  const handleDuplicate = useCallback(
    async (id: number) => {
      try {
        await duplicateMutation.mutateAsync({ role, id });
        toast.success("Copia creada.");
        void utils.creator.list.invalidate();
      } catch (error) {
        toast.error(errorMessage(error, "No pudimos duplicar el recurso."));
      }
    },
    [duplicateMutation, role, utils],
  );

  const handleDelete = useCallback(async () => {
    if (!toDelete) return;
    try {
      await removeMutation.mutateAsync({ role, id: toDelete.id });
      toast.success("Recurso eliminado.");
      void utils.creator.list.invalidate();
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos eliminar el recurso."));
    } finally {
      setToDelete(null);
    }
  }, [removeMutation, role, toDelete, utils]);

  if (openId !== null) {
    return (
      <CreatorWorkspace
        key={openId}
        role={role}
        resourceId={openId}
        schoolName={data?.school?.name ?? "Institución educativa"}
        logoUrl={data?.school?.logoUrl ?? null}
        aiReady={aiReady}
        remaining={remaining}
        onBack={() => setOpenId(null)}
        onOpen={setOpenId}
        onUsage={refreshUsage}
      />
    );
  }

  return (
    <>
      <CreatorLanding
        lede={LEDE[role] ?? LEDE.teacher!}
        subjects={subjects}
        courses={courses}
        // `null` sin error: el servidor no tiene base de datos disponible
        resources={listQuery.data ?? null}
        error={(listQuery.isError && !listQuery.data) || listQuery.data === null}
        aiReady={aiReady}
        remaining={remaining}
        creating={createMutation.isPending || sampleMutation.isPending}
        clarifying={clarifyMutation.isPending}
        pending={pending && { prompt: pending.request.prompt, questions: pending.questions }}
        samples={samples}
        onRetry={() => void listQuery.refetch()}
        onCreate={(request, ask) => void handleCreate(request, ask)}
        onAnswer={clarifications => pending && void create(pending.request, clarifications)}
        onCancelQuestions={() => setPending(null)}
        onOpen={openResource}
        onOpenSample={sample => void handleOpenSample(sample)}
        onDuplicate={id => void handleDuplicate(id)}
        onDelete={setToDelete}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={open => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este recurso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán «{toDelete?.title || "Recurso sin título"}», su conversación y sus versiones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

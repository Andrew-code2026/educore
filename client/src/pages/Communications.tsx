import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { CommunicationsLanding } from "@/communications/CommunicationsLanding";
import type { ComposeInput } from "@/communications/ComposeDialog";
import {
  abilitiesFor,
  buildCommunications,
  parseAiDraft,
  type AnnouncementModel,
  type AnnouncementRow,
} from "@/communications/landing";

interface CommunicationsPageProps {
  data: any;
  role: EduRole;
  /** Refresca el snapshot tras cada cambio. */
  onChanged: () => void;
}

const LEDE: Record<EduRole, string> = {
  admin: "Mantén a cada persona informada con mensajes claros, oportunos y dirigidos al público correcto.",
  teacher: "Consulta los avisos del colegio y prepara borradores para tus grupos y familias.",
  student: "Avisos y circulares del colegio para ti, del más reciente al más antiguo.",
  guardian: "Avisos y circulares del colegio para tu familia, del más reciente al más antiguo.",
};

export function CommunicationsPage({ data, role, onChanged }: CommunicationsPageProps) {
  const abilities = useMemo(() => abilitiesFor(role), [role]);
  const rows: AnnouncementRow[] = data.announcements;
  const model = useMemo(() => buildCommunications(rows), [rows]);
  const period = useMemo(() => resolveActivePeriod(data?.academicPeriods)?.name ?? null, [data?.academicPeriods]);

  // Se desestructuran las funciones (estables) para no recrear los callbacks en cada render
  const { mutateAsync: createAnnouncement, isPending: saving } = trpc.communications.create.useMutation();
  const publish = trpc.communications.publish.useMutation();
  const remove = trpc.communications.remove.useMutation();
  const { mutateAsync: generateDraft, isPending: aiPending } = trpc.educore.generateDraft.useMutation();
  const { mutate: publishAnnouncement } = publish;
  const { mutate: removeAnnouncement } = remove;

  const busyId = publish.isPending ? (publish.variables?.id ?? null) : remove.isPending ? (remove.variables?.id ?? null) : null;

  const handleCompose = useCallback(
    async (input: ComposeInput) => {
      try {
        await createAnnouncement({ role, ...input });
      } catch (error) {
        toast.error(errorMessage(error, "No se pudo guardar el comunicado."));
        throw error;
      }
      toast.success(input.publish ? "Comunicado publicado." : "Borrador guardado.");
      onChanged();
    },
    [createAnnouncement, role, onChanged],
  );

  const handleDraftWithAi = useCallback(
    async ({ title, message }: { title: string; message: string }) => {
      try {
        const { text } = await generateDraft({
          role,
          kind: "communication",
          prompt: title.trim().length >= 4 ? title.trim() : "Comunicado para la comunidad educativa",
          context: message.slice(0, 1500),
        });
        return parseAiDraft(text);
      } catch (error) {
        toast.error(errorMessage(error, "EduCore AI no pudo redactar el borrador."));
        throw error;
      }
    },
    [generateDraft, role],
  );

  const handlePublish = useCallback(
    (item: AnnouncementModel) =>
      publishAnnouncement(
        { role, id: item.id },
        {
          onSuccess: () => {
            toast.success(`«${item.title}» publicado.`);
            onChanged();
          },
          onError: (error) => toast.error(errorMessage(error, "No se pudo publicar el comunicado.")),
        },
      ),
    [publishAnnouncement, role, onChanged],
  );

  const handleDelete = useCallback(
    (item: AnnouncementModel) =>
      removeAnnouncement(
        { role, id: item.id },
        {
          onSuccess: () => {
            toast.success("Comunicado eliminado.");
            onChanged();
          },
          onError: (error) => toast.error(errorMessage(error, "No se pudo eliminar el comunicado.")),
        },
      ),
    [removeAnnouncement, role, onChanged],
  );

  const handleCopy = useCallback((item: AnnouncementModel) => {
    navigator.clipboard
      .writeText(`${item.title}\n\n${item.message}`)
      .then(() => toast.success("Texto copiado."))
      .catch(() => toast.error("No se pudo copiar el texto."));
  }, []);

  return (
    <CommunicationsLanding
      model={model}
      academicYear={String(new Date().getFullYear())}
      period={period}
      lede={LEDE[role]}
      abilities={abilities}
      busyId={busyId}
      saving={saving}
      aiPending={aiPending}
      onCompose={handleCompose}
      onDraftWithAi={handleDraftWithAi}
      onPublish={handlePublish}
      onDelete={handleDelete}
      onCopy={handleCopy}
    />
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

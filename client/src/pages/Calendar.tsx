import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { CalendarLanding } from "@/calendar/CalendarLanding";
import { draftDate, normalizeEvents, type EventDraft, type RawEvent } from "@/calendar/calendar";

interface CalendarPageProps {
  data: any;
  role: EduRole;
  onChanged: () => void;
}

/** Roles con permiso `communications.create` en el servidor. */
const CAN_CREATE: ReadonlySet<EduRole> = new Set(["teacher", "admin"]);

const LEDE: Record<EduRole, string> = {
  teacher: "Evaluaciones, reuniones y momentos importantes del colegio en una sola vista.",
  admin: "Programa y consulta las evaluaciones, reuniones y actividades de toda la institución.",
  student: "Tus evaluaciones y las actividades del colegio, para que nada te tome por sorpresa.",
  guardian: "Reuniones, evaluaciones y actividades del colegio que conviene tener presentes.",
};

const SAVE_ERRORS: Record<string, string> = {
  UNAUTHORIZED: "Inicia sesión para crear eventos.",
  FORBIDDEN: "Tu rol no tiene permiso para crear eventos.",
  default: "No pudimos guardar el evento. Revisa tu conexión e inténtalo de nuevo.",
};

export function CalendarPage({ data, role, onChanged }: CalendarPageProps) {
  // Fija "hoy" durante la visita para que la cuadrícula y los resúmenes no cambien a mitad de uso
  const [now] = useState(() => new Date());
  const events = useMemo(() => normalizeEvents(data?.events as RawEvent[] | undefined), [data?.events]);
  const period = useMemo(
    () => resolveActivePeriod(data?.academicPeriods, now)?.name ?? null,
    [data?.academicPeriods, now],
  );

  const { mutateAsync: createEvent } = trpc.educore.createEvent.useMutation();

  const handleCreate = useCallback(
    async (draft: EventDraft) => {
      try {
        await createEvent({
          role,
          title: draft.title.trim(),
          type: draft.type,
          eventDate: draftDate(draft),
          location: draft.location.trim() || null,
          audience: draft.audience.trim(),
        });
      } catch (error) {
        // Los mensajes de validación del servidor no son legibles; solo se traducen los de acceso
        const code = error instanceof TRPCClientError ? error.data?.code : undefined;
        throw new Error((code && SAVE_ERRORS[code]) || SAVE_ERRORS.default);
      }
      toast.success("Evento creado");
      onChanged();
    },
    [createEvent, role, onChanged],
  );

  return (
    <CalendarLanding
      events={events}
      now={now}
      academicYear={data?.school?.academicYear ?? String(now.getFullYear())}
      period={period}
      lede={LEDE[role]}
      onCreateEvent={CAN_CREATE.has(role) ? handleCreate : undefined}
    />
  );
}

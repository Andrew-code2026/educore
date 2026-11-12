import { toast } from "sonner";
import { Eye, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
import { AdminDialog, Avatar, Field, IDENTITY_ROLE_META, Pill, STATUS_META } from "../parts";

const ROLE = "admin" as const;

interface UserProfileDialogProps {
  userId: number | null;
  onClose: () => void;
  onPreview: (role: EduRole) => void;
  /** Contexto académico ya cargado por la página para describir curso y carga. */
  describeAcademic: (userId: number) => string | null;
}

const PREVIEWS: Array<[EduRole, string]> = [
  ["teacher", "Docente"],
  ["student", "Estudiante"],
  ["guardian", "Acudiente"],
];

export function UserProfileDialog({ userId, onClose, onPreview, describeAcademic }: UserProfileDialogProps) {
  const utils = trpc.useUtils();
  const profileQuery = trpc.identity.profile.useQuery({ role: ROLE, userId: userId ?? 0 }, { enabled: userId !== null });
  const roleMutation = trpc.identity.changeRole.useMutation();
  const statusMutation = trpc.identity.setStatus.useMutation();
  const profile = profileQuery.data as any;
  const roleKey: string = profile?.membership?.roleKey ?? "";
  const roleMeta = IDENTITY_ROLE_META[roleKey];
  const statusMeta = STATUS_META[profile?.status ?? ""] ?? { label: profile?.status ?? "—", tone: "neutral" as const };
  const busy = roleMutation.isPending || statusMutation.isPending;
  const academicLine = userId !== null ? describeAcademic(userId) : null;

  const refresh = async () => {
    await Promise.all([utils.identity.invalidate(), utils.academic.snapshot.invalidate()]);
  };

  const changeRole = async (next: string) => {
    if (!profile || next === roleKey) return;
    if (!window.confirm(`¿Cambiar el rol de ${profile.name} a ${IDENTITY_ROLE_META[next]?.label ?? next}?`)) return;
    try {
      await roleMutation.mutateAsync({ role: ROLE, userId: profile.id, roleKey: next as any });
      toast.success("Rol actualizado.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el rol.");
    }
  };

  const toggleStatus = async () => {
    if (!profile) return;
    const suspend = profile.status !== "SUSPENDED";
    const question = suspend ? `¿Suspender el acceso de ${profile.name}? Su historial académico se conserva.` : `¿Reactivar el acceso de ${profile.name}?`;
    if (!window.confirm(question)) return;
    try {
      await statusMutation.mutateAsync({ role: ROLE, userId: profile.id, status: suspend ? "SUSPENDED" : "ACTIVE" });
      toast.success(suspend ? "Acceso suspendido sin eliminar historial." : "Acceso reactivado.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el acceso.");
    }
  };

  return (
    <AdminDialog open={userId !== null} onClose={onClose} busy={busy} eyebrow="Perfil institucional" title={profile?.name ?? "Cargando perfil…"}>
      {!profile ? (
        <div style={{ display: "grid", placeItems: "center", padding: 32 }}>
          {profileQuery.isError ? <p className="adm-note adm-note--error">No pudimos cargar este perfil.</p> : <Loader2 className="animate-spin" aria-label="Cargando" />}
        </div>
      ) : (
        <>
          <div className="adm-person">
            <Avatar name={profile.name} tone={roleMeta?.tone ?? "blue"} large />
            <div style={{ minWidth: 0 }}>
              <p className="adm-person__mail">{profile.email ?? "Sin correo"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                <Pill tone={roleMeta?.tone ?? "neutral"}>{roleMeta?.label ?? roleKey}</Pill>
                <Pill tone={statusMeta.tone} dot>{statusMeta.label}</Pill>
              </div>
            </div>
          </div>

          <div className="adm-kv">
            <div className="adm-kv__item">
              <span className="adm-kv__label">Institución</span>
              <span className="adm-kv__value">{profile.school?.name ?? "—"}</span>
            </div>
            <div className="adm-kv__item">
              <span className="adm-kv__label">Teléfono</span>
              <span className="adm-kv__value">{profile.phone || "—"}</span>
            </div>
            <div className="adm-kv__item">
              <span className="adm-kv__label">Documento / código</span>
              <span className="adm-kv__value">{profile.studentProfile?.studentCode || profile.teacherProfile?.employeeCode || "—"}</span>
            </div>
          </div>

          {academicLine || profile.teacherProfile || profile.guardianProfile ? (
            <div className="adm-block">
              <p className="adm-block__title">
                {profile.studentProfile ? "Matrícula" : profile.teacherProfile ? "Carga académica" : "Estudiantes vinculados"}
              </p>
              <p className="adm-block__text">
                {profile.guardianProfile
                  ? profile.linkedStudents?.length
                    ? profile.linkedStudents.map((student: any) => student.name).join(" · ")
                    : "Aún no hay estudiantes vinculados."
                  : academicLine ?? (profile.teacherProfile?.specialties ? `Especialidad: ${profile.teacherProfile.specialties}` : "Sin carga asignada")}
              </p>
            </div>
          ) : null}

          <div className="adm-form__row">
            <Field label="Rol en la institución">
              <select className="adm-select" value={roleKey} onChange={event => void changeRole(event.target.value)} disabled={busy}>
                {Object.entries(IDENTITY_ROLE_META)
                  .filter(([key]) => key !== "SUPER_ADMIN")
                  .map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
              </select>
            </Field>
            <Field label="Acceso">
              <button type="button" className={`adm-btn ${profile.status === "SUSPENDED" ? "adm-btn--primary" : "adm-btn--danger"}`} onClick={() => void toggleStatus()} disabled={busy}>
                {profile.status === "SUSPENDED" ? <ShieldCheck aria-hidden="true" strokeWidth={2} /> : <ShieldOff aria-hidden="true" strokeWidth={2} />}
                {profile.status === "SUSPENDED" ? "Reactivar acceso" : "Suspender acceso"}
              </button>
            </Field>
          </div>

          <div className="adm-block">
            <p className="adm-block__title">Vista previa controlada</p>
            <p className="adm-block__text">Revisa la experiencia de cada rol con la cuenta demo. Los permisos siguen protegidos en el servidor.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREVIEWS.map(([previewRole, label]) => (
                <button
                  key={previewRole}
                  type="button"
                  className="adm-btn adm-btn--outline adm-btn--sm"
                  onClick={() => {
                    onClose();
                    onPreview(previewRole);
                  }}
                >
                  <Eye aria-hidden="true" strokeWidth={2} />
                  Ver como {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminDialog>
  );
}

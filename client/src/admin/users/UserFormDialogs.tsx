import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AdminDialog, Field, IDENTITY_ROLE_META } from "../parts";

const ROLE = "admin" as const;
/** Roles que se crean con aprovisionamiento completo (matrícula, vínculo, perfil docente). */
const PROVISIONED = new Set(["STUDENT", "TEACHER", "GUARDIAN"]);
const ASSIGNABLE_ROLES = ["TEACHER", "STUDENT", "GUARDIAN", "COORDINATOR", "RECTOR", "SCHOOL_ADMIN"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const invalidateAll = (utils: ReturnType<typeof trpc.useUtils>) =>
  Promise.all([utils.identity.invalidate(), utils.academic.snapshot.invalidate(), utils.educore.snapshot.invalidate()]);

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  courses: Array<{ id: number; name: string }>;
  students: Array<{ userId: number; name: string; email: string }>;
  onCreated?: (roleKey: string) => void;
}

/**
 * Alta individual. Estudiantes, docentes y acudientes pasan por la misma ruta que la carga
 * masiva para quedar matriculados o vinculados; los directivos se crean como membresía simple.
 */
export function CreateUserDialog({ open, onClose, courses, students, onCreated }: CreateUserDialogProps) {
  const utils = trpc.useUtils();
  const importMutation = trpc.identity.importUsers.useMutation();
  const createMutation = trpc.identity.createUser.useMutation();
  const [roleKey, setRoleKey] = useState<AssignableRole>("STUDENT");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [course, setCourse] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [relationship, setRelationship] = useState<"PARENT" | "LEGAL_GUARDIAN" | "OTHER">("PARENT");
  const [error, setError] = useState<string | null>(null);
  const busy = importMutation.isPending || createMutation.isPending;

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDocumentId("");
    setCourse("");
    setSpecialty("");
    setStudentEmail("");
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (PROVISIONED.has(roleKey)) {
        const result = await importMutation.mutateAsync({
          role: ROLE,
          kind: roleKey as "STUDENT" | "TEACHER" | "GUARDIAN",
          dryRun: false,
          rows: [
            {
              firstName,
              lastName,
              email,
              phone: phone || undefined,
              documentId: documentId || undefined,
              course: roleKey === "STUDENT" && course ? course : undefined,
              specialty: roleKey === "TEACHER" && specialty ? specialty : undefined,
              studentEmail: roleKey === "GUARDIAN" && studentEmail ? studentEmail : undefined,
              relationship: roleKey === "GUARDIAN" && studentEmail ? relationship : undefined,
            },
          ],
        });
        const row = result.rows[0];
        if (row?.status !== "created") {
          setError(row?.message ?? "No se pudo crear el usuario.");
          return;
        }
        if (row.message) toast.warning(row.message);
      } else {
        await createMutation.mutateAsync({ role: ROLE, firstName, lastName, email, roleKey, status: "ACTIVE", phone: phone || undefined });
      }
      toast.success(`${firstName} ${lastName} ya hace parte de la institución.`);
      await invalidateAll(utils);
      onCreated?.(roleKey);
      reset();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el usuario.");
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      busy={busy}
      eyebrow="Nueva persona"
      title="Crear usuario"
      description="Queda activo en la institución con el rol que elijas. Para muchas personas usa Cargar usuarios."
    >
      <form className="adm-form" onSubmit={submit}>
        <Field label="Rol">
          <select className="adm-select" value={roleKey} onChange={event => setRoleKey(event.target.value as AssignableRole)}>
            {ASSIGNABLE_ROLES.map(key => (
              <option key={key} value={key}>{IDENTITY_ROLE_META[key].label}</option>
            ))}
          </select>
        </Field>
        <div className="adm-form__row">
          <Field label="Nombres">
            <input className="adm-input" value={firstName} onChange={event => setFirstName(event.target.value)} required minLength={2} maxLength={100} autoComplete="off" />
          </Field>
          <Field label="Apellidos">
            <input className="adm-input" value={lastName} onChange={event => setLastName(event.target.value)} required minLength={2} maxLength={100} autoComplete="off" />
          </Field>
        </div>
        <div className="adm-form__row">
          <Field label="Correo">
            <input className="adm-input" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} placeholder="persona@colegio.edu.co" autoComplete="off" />
          </Field>
          <Field label="Teléfono" hint="opcional">
            <input className="adm-input" value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} autoComplete="off" />
          </Field>
        </div>
        {roleKey === "STUDENT" ? (
          <div className="adm-form__row">
            <Field label="Documento" hint="opcional">
              <input className="adm-input" value={documentId} onChange={event => setDocumentId(event.target.value)} maxLength={60} />
            </Field>
            <Field label="Curso" hint="matrícula en el año activo">
              <select className="adm-select" value={course} onChange={event => setCourse(event.target.value)}>
                <option value="">Sin matricular por ahora</option>
                {courses.map(item => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        {roleKey === "TEACHER" ? (
          <div className="adm-form__row">
            <Field label="Documento" hint="opcional">
              <input className="adm-input" value={documentId} onChange={event => setDocumentId(event.target.value)} maxLength={60} />
            </Field>
            <Field label="Especialidad" hint="opcional">
              <input className="adm-input" value={specialty} onChange={event => setSpecialty(event.target.value)} maxLength={120} placeholder="Ej. Matemáticas" />
            </Field>
          </div>
        ) : null}
        {roleKey === "GUARDIAN" ? (
          <div className="adm-form__row">
            <Field label="Estudiante a cargo" hint="opcional">
              <select className="adm-select" value={studentEmail} onChange={event => setStudentEmail(event.target.value)}>
                <option value="">Vincular después</option>
                {students.map(student => (
                  <option key={student.userId} value={student.email}>{student.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Parentesco">
              <select className="adm-select" value={relationship} onChange={event => setRelationship(event.target.value as typeof relationship)} disabled={!studentEmail}>
                <option value="PARENT">Padre / madre</option>
                <option value="LEGAL_GUARDIAN">Tutor legal</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
          </div>
        ) : null}
        {error ? <p className="adm-note adm-note--error" role="alert">{error}</p> : null}
        <div className="adm-dialog__actions">
          <button type="button" className="adm-btn adm-btn--outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Crear usuario
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

export function InviteUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const inviteMutation = trpc.identity.createInvitation.useMutation();
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<AssignableRole>("TEACHER");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await inviteMutation.mutateAsync({ role: ROLE, email, roleKey });
      toast.success("Invitación registrada.");
      await utils.identity.invalidate();
      setEmail("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la invitación.");
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={inviteMutation.isPending} eyebrow="Acceso institucional" title="Invitar usuario" description="La persona completa sus datos al aceptar. Vence en 7 días.">
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form__row">
          <Field label="Correo">
            <input className="adm-input" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} placeholder="persona@colegio.edu.co" />
          </Field>
          <Field label="Rol">
            <select className="adm-select" value={roleKey} onChange={event => setRoleKey(event.target.value as AssignableRole)}>
              {ASSIGNABLE_ROLES.map(key => (
                <option key={key} value={key}>{IDENTITY_ROLE_META[key].label}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="adm-note adm-note--warn">El envío de correos aún no está conectado en este entorno: la invitación queda registrada y visible en la pestaña Invitaciones.</p>
        {error ? <p className="adm-note adm-note--error" role="alert">{error}</p> : null}
        <div className="adm-dialog__actions">
          <button type="button" className="adm-btn adm-btn--outline" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Registrar invitación
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

interface LinkGuardianDialogProps {
  open: boolean;
  onClose: () => void;
  guardians: Array<{ id: number; name: string | null }>;
  students: Array<{ userId: number; name: string }>;
  initialGuardianId?: number | null;
}

export function LinkGuardianDialog({ open, onClose, guardians, students, initialGuardianId }: LinkGuardianDialogProps) {
  const utils = trpc.useUtils();
  const relationshipMutation = trpc.identity.createRelationship.useMutation();
  const [guardianId, setGuardianId] = useState(initialGuardianId ? String(initialGuardianId) : "");
  const [studentId, setStudentId] = useState("");
  const [relationshipType, setRelationshipType] = useState<"PARENT" | "LEGAL_GUARDIAN" | "OTHER">("PARENT");
  const [error, setError] = useState<string | null>(null);
  const selectedGuardian = guardianId || (initialGuardianId ? String(initialGuardianId) : "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await relationshipMutation.mutateAsync({ role: ROLE, guardianUserId: Number(selectedGuardian), studentUserId: Number(studentId), relationshipType, isPrimary: true });
      toast.success("Acudiente vinculado.");
      await utils.identity.relationships.invalidate();
      setStudentId("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el vínculo.");
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} busy={relationshipMutation.isPending} eyebrow="Relación protegida" title="Vincular acudiente" description="El acudiente solo verá la información de los estudiantes vinculados.">
      <form className="adm-form" onSubmit={submit}>
        <Field label="Acudiente">
          <select className="adm-select" value={selectedGuardian} onChange={event => setGuardianId(event.target.value)} required>
            <option value="">Selecciona un acudiente</option>
            {guardians.map(guardian => (
              <option key={guardian.id} value={guardian.id}>{guardian.name ?? "Acudiente"}</option>
            ))}
          </select>
        </Field>
        <div className="adm-form__row">
          <Field label="Estudiante">
            <select className="adm-select" value={studentId} onChange={event => setStudentId(event.target.value)} required>
              <option value="">Selecciona un estudiante</option>
              {students.map(student => (
                <option key={student.userId} value={student.userId}>{student.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Parentesco">
            <select className="adm-select" value={relationshipType} onChange={event => setRelationshipType(event.target.value as typeof relationshipType)}>
              <option value="PARENT">Padre / madre</option>
              <option value="LEGAL_GUARDIAN">Tutor legal</option>
              <option value="OTHER">Otro</option>
            </select>
          </Field>
        </div>
        {error ? <p className="adm-note adm-note--error" role="alert">{error}</p> : null}
        <div className="adm-dialog__actions">
          <button type="button" className="adm-btn adm-btn--outline" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={relationshipMutation.isPending || !selectedGuardian || !studentId}>
            {relationshipMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Crear vínculo
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

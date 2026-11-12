import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Mail, Plus, Search, ShieldCheck, Upload, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { EduRole } from "@/components/shell";
import {
  AdminHeader,
  AdminPage,
  Avatar,
  EmptyState,
  formatShortDate,
  IDENTITY_ROLE_META,
  Pill,
  Segment,
  SkeletonList,
  STATUS_META,
  SummaryStrip,
} from "../parts";
import { consumeUsersImportRequest } from "../intents";
import { ImportUsersDialog } from "./ImportUsersDialog";
import { CreateUserDialog, InviteUserDialog, LinkGuardianDialog } from "./UserFormDialogs";
import { UserProfileDialog } from "./UserProfileDialog";
import type { ImportKind } from "./importer";

const ROLE = "admin" as const;
const PAGE_SIZE = 50;

type Tab = "directory" | "invitations" | "families" | "roles";
type RoleFilter = "ALL" | "TEACHER" | "STUDENT" | "GUARDIAN" | "MANAGEMENT";
type StatusFilter = "ALL" | "ACTIVE" | "INVITED" | "SUSPENDED" | "INACTIVE";

interface UsersPageProps {
  onPreview: (role: EduRole) => void;
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function UsersPage({ onPreview }: UsersPageProps) {
  const [tab, setTab] = useState<Tab>("directory");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importKind, setImportKind] = useState<ImportKind>("STUDENT");
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkGuardianId, setLinkGuardianId] = useState<number | null | undefined>(undefined);
  const [expandedGuardian, setExpandedGuardian] = useState<number | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  // El Inicio o Académico pueden pedir abrir el importador al llegar
  useEffect(() => {
    const requested = consumeUsersImportRequest();
    if (requested) {
      setImportKind(requested);
      setImportOpen(true);
    }
  }, []);

  useEffect(() => setPage(0), [roleFilter, statusFilter, debouncedSearch]);

  const summaryQuery = trpc.identity.summary.useQuery({ role: ROLE }, { staleTime: 15_000 });
  const academicQuery = trpc.academic.snapshot.useQuery({ role: ROLE }, { staleTime: 30_000 });
  const usersQuery = trpc.identity.users.useQuery(
    { role: ROLE, search: debouncedSearch || undefined, roleKey: roleFilter, status: statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { enabled: tab === "directory", placeholderData: previous => previous },
  );
  const invitationsQuery = trpc.identity.invitations.useQuery({ role: ROLE }, { enabled: tab === "invitations" });
  const guardiansQuery = trpc.identity.users.useQuery(
    { role: ROLE, roleKey: "GUARDIAN", status: "ALL", limit: 100, offset: 0 },
    { enabled: tab === "families" || linkGuardianId !== undefined },
  );
  const relationshipsQuery = trpc.identity.relationships.useQuery(
    { role: ROLE, guardianUserId: expandedGuardian ?? undefined },
    { enabled: tab === "families" && expandedGuardian !== null },
  );
  const rolesQuery = trpc.identity.roles.useQuery({ role: ROLE }, { enabled: tab === "roles" });

  const academic = academicQuery.data as any;
  const summary = summaryQuery.data;

  // Contexto académico por persona: curso del estudiante y carga del docente
  const academicContext = useMemo(() => {
    const courseName = new Map<number, string>((academic?.courses ?? []).map((course: any) => [course.id, course.name]));
    const subjectName = new Map<number, string>((academic?.subjects ?? []).map((subject: any) => [subject.id, subject.name]));
    const enrollment = new Map<number, string>();
    for (const item of academic?.studentEnrollments ?? []) enrollment.set(item.studentUserId, courseName.get(item.courseId) ?? "Curso");
    const load = new Map<number, Map<string, Set<string>>>();
    for (const item of academic?.teacherAssignments ?? []) {
      const bySubject = load.get(item.teacherUserId) ?? new Map<string, Set<string>>();
      const subject = subjectName.get(item.subjectId) ?? "Materia";
      bySubject.set(subject, (bySubject.get(subject) ?? new Set<string>()).add(courseName.get(item.courseId) ?? "Curso"));
      load.set(item.teacherUserId, bySubject);
    }
    return {
      enrollment,
      load: new Map(
        Array.from(load, ([userId, bySubject]) => [
          userId,
          Array.from(bySubject, ([subject, courses]) => `${subject} · ${Array.from(courses).sort().join(", ")}`).join(" | "),
        ]),
      ),
    };
  }, [academic]);

  const describeAcademic = useCallback(
    (userId: number) => {
      const course = academicContext.enrollment.get(userId);
      if (course) return `Matriculado en ${course} · ${academic?.activeYear?.name ?? "año activo"}`;
      const load = academicContext.load.get(userId);
      if (load) return load;
      return null;
    },
    [academicContext, academic?.activeYear?.name],
  );

  const courses = useMemo(() => (academic?.courses ?? []).map((course: any) => ({ id: course.id, name: course.name })), [academic]);
  const students = useMemo(
    () =>
      (academic?.students ?? [])
        .filter((student: any) => student.user)
        .map((student: any) => ({ userId: student.userId, name: student.user.name ?? "Estudiante", email: student.user.email ?? "" }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "es")),
    [academic],
  );

  const byRole: Partial<Record<string, number>> = summary?.byRole ?? {};
  const managementCount = (byRole.SUPER_ADMIN ?? 0) + (byRole.SCHOOL_ADMIN ?? 0) + (byRole.RECTOR ?? 0) + (byRole.COORDINATOR ?? 0);
  const teachersWithLoad = academicContext.load.size;
  const enrolled = academicContext.enrollment.size;
  const pendingInvitations = summary?.pendingInvitations ?? 0;

  const viewDirectory = (filter: RoleFilter) => {
    setTab("directory");
    setRoleFilter(filter);
    setStatusFilter("ALL");
    setSearch("");
  };

  const openImport = (kind: ImportKind = "STUDENT") => {
    setImportKind(kind);
    setImportOpen(true);
  };

  const rows = (usersQuery.data?.rows ?? []) as any[];
  const total = usersQuery.data?.total ?? 0;
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <AdminPage label="Usuarios">
      <AdminHeader
        chip="Comunidad educativa"
        title="Usuarios"
        lede="Carga, invita y organiza a las personas de tu institución. Cada acceso se resuelve por rol en el servidor."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => openImport()}>
              <Upload aria-hidden="true" strokeWidth={2} />
              Cargar usuarios
            </button>
            <button type="button" className="adm-btn adm-btn--outline" onClick={() => setCreateOpen(true)}>
              <UserPlus aria-hidden="true" strokeWidth={2} />
              Crear usuario
            </button>
            <button type="button" className="adm-btn adm-btn--outline" onClick={() => setInviteOpen(true)}>
              <Mail aria-hidden="true" strokeWidth={2} />
              Invitar
            </button>
          </>
        }
      />

      <SummaryStrip
        items={[
          {
            key: "teachers",
            label: "Docentes",
            value: summary ? byRole.TEACHER ?? 0 : "…",
            note: summary ? `${teachersWithLoad} con carga académica` : "Cargando",
          },
          {
            key: "students",
            label: "Estudiantes",
            value: summary ? byRole.STUDENT ?? 0 : "…",
            note: summary ? `${enrolled} matriculados en ${academic?.activeYear?.year ?? "el año activo"}` : "Cargando",
          },
          {
            key: "guardians",
            label: "Acudientes",
            value: summary ? byRole.GUARDIAN ?? 0 : "…",
            note: "Familias con acceso",
          },
          {
            key: "invitations",
            label: "Invitaciones",
            value: summary ? pendingInvitations : "…",
            tone: summary && !pendingInvitations ? "empty" : undefined,
            note: `Pendientes · ${managementCount} directivos`,
          },
        ]}
      />

      <Segment
        variant="tabs"
        label="Secciones de usuarios"
        value={tab}
        onChange={setTab}
        options={[
          { value: "directory", label: "Directorio", count: summary?.total },
          { value: "invitations", label: "Invitaciones", count: pendingInvitations || undefined },
          { value: "families", label: "Vínculos familiares" },
          { value: "roles", label: "Roles y permisos" },
        ]}
      />

      {tab === "directory" ? (
        <section className="adm-section" aria-label="Directorio">
          <div className="adm-section__head">
            <Segment
              label="Filtrar por rol"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "ALL", label: "Todos", count: summary?.total },
                { value: "TEACHER", label: "Docentes", count: byRole.TEACHER },
                { value: "STUDENT", label: "Estudiantes", count: byRole.STUDENT },
                { value: "GUARDIAN", label: "Acudientes", count: byRole.GUARDIAN },
                { value: "MANAGEMENT", label: "Directivos", count: summary ? managementCount : undefined },
              ]}
            />
          </div>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar</span>
              <input className="adm-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" />
            </label>
            <select className="adm-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrar por estado">
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INVITED">Invitados</option>
              <option value="SUSPENDED">Suspendidos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </div>

          {usersQuery.isLoading ? (
            <SkeletonList rows={6} />
          ) : usersQuery.isError ? (
            <div className="adm-surface">
              <EmptyState tone="error" title="No pudimos cargar el directorio" text="Revisa la conexión e inténtalo de nuevo." action={<button type="button" className="adm-btn adm-btn--outline" onClick={() => void usersQuery.refetch()}>Reintentar</button>} />
            </div>
          ) : rows.length === 0 ? (
            <div className="adm-surface">
              <EmptyState
                title={debouncedSearch ? "Sin resultados" : "Aún no hay personas aquí"}
                text={debouncedSearch ? `Nadie coincide con “${debouncedSearch}”.` : "Carga un archivo de Excel para traer a todo el grupo de una vez."}
                action={
                  debouncedSearch ? null : (
                    <button type="button" className="adm-btn adm-btn--primary" onClick={() => openImport(roleFilter === "TEACHER" || roleFilter === "GUARDIAN" ? roleFilter : "STUDENT")}>
                      <Upload aria-hidden="true" strokeWidth={2} />
                      Cargar usuarios
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="adm-surface adm-list" aria-label="Personas">
              {rows.map(item => {
                const roleMeta = IDENTITY_ROLE_META[item.membershipRole] ?? { label: item.membershipRole, tone: "neutral" as const };
                const statusMeta = STATUS_META[item.status] ?? { label: item.status, tone: "neutral" as const };
                const course = academicContext.enrollment.get(item.id);
                const load = academicContext.load.get(item.id);
                return (
                  <li key={item.id} className="adm-row">
                    <Avatar name={item.name ?? item.email} tone={roleMeta.tone} />
                    <div className="adm-row__body">
                      <div className="adm-row__title">
                        <span className="adm-row__name">{item.name ?? "Usuario sin nombre"}</span>
                        <Pill tone={roleMeta.tone}>{roleMeta.label}</Pill>
                        {item.status !== "ACTIVE" ? <Pill tone={statusMeta.tone} dot>{statusMeta.label}</Pill> : null}
                      </div>
                      <div className="adm-row__meta">
                        <span>{item.email ?? "Sin correo"}</span>
                        {item.membershipRole === "STUDENT" ? (
                          <>
                            <span className="adm-sep" aria-hidden="true">·</span>
                            {course ? <span className="adm-group">{course}</span> : <Pill tone="amber">Sin matrícula</Pill>}
                          </>
                        ) : null}
                        {item.membershipRole === "TEACHER" ? (
                          <>
                            <span className="adm-sep" aria-hidden="true">·</span>
                            {load ? <span>{load}</span> : <Pill tone="amber">Sin carga</Pill>}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="adm-row__actions">
                      <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setSelectedUserId(item.id)}>
                        Ver perfil
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {total > PAGE_SIZE ? (
            <div className="adm-toolbar" style={{ justifyContent: "space-between" }}>
              <span className="adm-section__hint adm-num">
                {from}–{to} de {total}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" disabled={page === 0} onClick={() => setPage(current => current - 1)}>
                  <ChevronLeft aria-hidden="true" strokeWidth={2} />
                  Anterior
                </button>
                <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" disabled={to >= total} onClick={() => setPage(current => current + 1)}>
                  Siguiente
                  <ChevronRight aria-hidden="true" strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : rows.length ? (
            <span className="adm-section__hint adm-num">{total} {total === 1 ? "persona" : "personas"}</span>
          ) : null}
        </section>
      ) : null}

      {tab === "invitations" ? (
        <section className="adm-section" aria-label="Invitaciones">
          <div className="adm-section__head">
            <h2 className="adm-section__title">
              Invitaciones
              {pendingInvitations ? <span className="adm-count">{pendingInvitations}</span> : null}
            </h2>
            <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setInviteOpen(true)}>
              <Plus aria-hidden="true" strokeWidth={2} />
              Nueva invitación
            </button>
          </div>
          <p className="adm-note adm-note--warn">El envío de correos aún no está conectado en este entorno: las invitaciones quedan registradas con su vencimiento y su estado.</p>
          {invitationsQuery.isLoading ? (
            <SkeletonList rows={3} />
          ) : (invitationsQuery.data ?? []).length === 0 ? (
            <div className="adm-surface">
              <EmptyState title="Sin invitaciones" text="Invita a docentes, familias o directivos para que activen su acceso." />
            </div>
          ) : (
            <ul className="adm-surface adm-list">
              {(invitationsQuery.data ?? []).map((item: any) => {
                const roleMeta = IDENTITY_ROLE_META[item.roleKey] ?? { label: item.roleKey, tone: "neutral" as const };
                const statusMeta = STATUS_META[item.status] ?? { label: item.status, tone: "neutral" as const };
                return (
                  <li key={item.id} className="adm-row">
                    <Avatar name={item.email} tone="neutral" />
                    <div className="adm-row__body">
                      <div className="adm-row__title">
                        <span className="adm-row__name">{item.email}</span>
                        <Pill tone={roleMeta.tone}>{roleMeta.label}</Pill>
                      </div>
                      <div className="adm-row__meta">
                        <span>Enviada {formatShortDate(item.createdAt)}</span>
                        <span className="adm-sep" aria-hidden="true">·</span>
                        <span>Vence {formatShortDate(item.expiresAt)}</span>
                      </div>
                    </div>
                    <div className="adm-row__actions">
                      <Pill tone={statusMeta.tone} dot>{statusMeta.label}</Pill>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "families" ? (
        <section className="adm-section" aria-label="Vínculos familiares">
          <div className="adm-section__head">
            <div>
              <h2 className="adm-section__title">Acudientes y estudiantes</h2>
              <p className="adm-section__hint">Un acudiente solo ve la información de los estudiantes vinculados a él.</p>
            </div>
            <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setLinkGuardianId(null)}>
              <Link2 aria-hidden="true" strokeWidth={2} />
              Vincular acudiente
            </button>
          </div>
          {guardiansQuery.isLoading ? (
            <SkeletonList rows={3} />
          ) : (guardiansQuery.data?.rows ?? []).length === 0 ? (
            <div className="adm-surface">
              <EmptyState
                title="Aún no hay acudientes"
                text="Cárgalos con el correo de su estudiante y quedarán vinculados automáticamente."
                action={
                  <button type="button" className="adm-btn adm-btn--primary" onClick={() => openImport("GUARDIAN")}>
                    <Upload aria-hidden="true" strokeWidth={2} />
                    Cargar acudientes
                  </button>
                }
              />
            </div>
          ) : (
            <ul className="adm-surface adm-list">
              {(guardiansQuery.data?.rows ?? []).map((guardian: any) => {
                const expanded = expandedGuardian === guardian.id;
                const linked = expanded ? ((relationshipsQuery.data ?? []) as any[]) : [];
                return (
                  <li key={guardian.id} className="adm-row" style={{ alignItems: "start" }}>
                    <Avatar name={guardian.name} tone="violet" />
                    <div className="adm-row__body">
                      <div className="adm-row__title">
                        <span className="adm-row__name">{guardian.name ?? "Acudiente"}</span>
                      </div>
                      <div className="adm-row__meta">
                        <span>{guardian.email}</span>
                      </div>
                      {expanded ? (
                        relationshipsQuery.isLoading ? (
                          <span className="adm-section__hint">Cargando vínculos…</span>
                        ) : linked.length ? (
                          <ul className="adm-chips" style={{ marginTop: 6 }}>
                            {linked.map(student => (
                              <li key={student.id} className="adm-chip">
                                <span className="adm-group">{academicContext.enrollment.get(student.id) ?? "—"}</span>
                                {student.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="adm-section__hint">Aún no tiene estudiantes vinculados.</span>
                        )
                      ) : null}
                    </div>
                    <div className="adm-row__actions">
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setExpandedGuardian(expanded ? null : guardian.id)} aria-expanded={expanded}>
                        {expanded ? "Ocultar" : "Ver estudiantes"}
                      </button>
                      <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setLinkGuardianId(guardian.id)}>
                        Vincular
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "roles" ? (
        <section className="adm-section" aria-label="Roles y permisos">
          <div className="adm-section__head">
            <div>
              <h2 className="adm-section__title">Roles y permisos</h2>
              <p className="adm-section__hint">La jerarquía orienta; los permisos explícitos autorizan cada acción en el servidor.</p>
            </div>
            <span className="adm-section__hint" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck aria-hidden="true" width={15} height={15} />
              Mínimo privilegio
            </span>
          </div>
          {rolesQuery.isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <div className="adm-columns">
              <ul className="adm-surface adm-list">
                {((rolesQuery.data?.roles ?? []) as any[])
                  .slice()
                  .sort((a, b) => a.hierarchyLevel - b.hierarchyLevel)
                  .map(item => {
                    const meta = IDENTITY_ROLE_META[item.key];
                    return (
                      <li key={item.key} className="adm-row">
                        <Avatar name={meta?.label ?? item.name} tone={meta?.tone ?? "neutral"} />
                        <div className="adm-row__body">
                          <div className="adm-row__title">
                            <span className="adm-row__name">{meta?.label ?? item.name}</span>
                            <Pill>Nivel {item.hierarchyLevel}</Pill>
                          </div>
                          <div className="adm-row__meta">
                            <span>{item.description}</span>
                          </div>
                        </div>
                        <div className="adm-row__actions">
                          <span className="adm-count">{(item.permissions ?? []).length} permisos</span>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              <div className="adm-surface adm-panel">
                <div>
                  <p className="adm-panel__title">Catálogo de permisos</p>
                  <p className="adm-panel__sub">Permisos por módulo que se asignan a cada rol.</p>
                </div>
                <ul className="adm-chips">
                  {((rolesQuery.data?.permissions ?? []) as any[]).map(permission => (
                    <li key={permission.key} className="adm-chip adm-chip--plain" title={permission.description}>
                      {permission.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <ImportUsersDialog
        key={importKind}
        open={importOpen}
        initialKind={importKind}
        onClose={() => setImportOpen(false)}
        onViewDirectory={viewDirectory}
      />
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} courses={courses} students={students} onCreated={roleKey => viewDirectory(["TEACHER", "STUDENT", "GUARDIAN"].includes(roleKey) ? (roleKey as RoleFilter) : "MANAGEMENT")} />
      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <LinkGuardianDialog
        key={linkGuardianId ?? "none"}
        open={linkGuardianId !== undefined}
        onClose={() => setLinkGuardianId(undefined)}
        guardians={((guardiansQuery.data?.rows ?? []) as any[]).map(item => ({ id: item.id, name: item.name }))}
        students={students}
        initialGuardianId={linkGuardianId ?? null}
      />
      <UserProfileDialog userId={selectedUserId} onClose={() => setSelectedUserId(null)} onPreview={onPreview} describeAcademic={describeAcademic} />
    </AdminPage>
  );
}

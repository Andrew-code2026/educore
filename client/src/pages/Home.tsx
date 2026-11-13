import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FileText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { GradeCenterPage } from "./GradeCenter";
import { TeacherDashboard } from "@/components/dashboard";
import { AttendancePage } from "./Attendance";
import { ClassroomPage } from "./Classroom";
import { AnalyticsPage } from "./Analytics";
import { CalendarPage } from "./Calendar";
import { CommunicationsPage } from "./Communications";
import { ReportsPage } from "./Reports";
import { PiarPage } from "./Piar";
import { CreatorPage } from "./Creator";
import { LegacyAcademicPage } from "./AcademicLegacy";
import { AdminDashboard } from "@/admin/dashboard/AdminDashboard";
import { AcademicPage } from "@/admin/academic/AcademicPage";
import { UsersPage } from "@/admin/users/UsersPage";
import { SettingsPage } from "@/admin/settings/SettingsPage";
import {
  EduCoreShell,
  type EduRole,
  ROLE_LABELS,
  isSectionAllowed,
  useSectionRoute,
} from "@/components/shell";
import { StudentPortal } from "@/student/StudentPortal";
import { GuardianPortal } from "@/guardian/GuardianPortal";
import { childIdFromSearch } from "@/guardian/children";

const roleLabels: Record<EduRole, string> = ROLE_LABELS;

const storageUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return value.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment))).join("/");
};

function EmptyState({ title, detail, icon: Icon = FileText }: { title: string; detail: string; icon?: typeof FileText }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm"><Icon className="h-5 w-5" /></div><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{detail}</p></div>;
}

function LoginScreen({ onDemo, school }: { onDemo: (role: EduRole) => void; school?: any }) {
  return <div className="flex min-h-screen items-center justify-center page-shell px-4 py-10" style={{ "--edc-primary": school?.primaryColor ?? "#2475cf", "--edc-secondary": school?.secondaryColor ?? "#eaf4ff", "--edc-background": school?.backgroundColor ?? "#f7f9fc", "--edc-surface": school?.surfaceColor ?? "#ffffff" } as React.CSSProperties}><div className="w-full max-w-5xl"><div className="login-spatial-grid grid overflow-hidden rounded-[28px] border border-slate-200/90 bg-white premium-panel md:grid-cols-[0.85fr_1.15fr]"><div className="bg-[var(--edc-primary)] p-8 text-white sm:p-12"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">{school?.logoUrl ? <img src={storageUrl(school.logoUrl)} alt="Escudo institucional" className="h-full w-full rounded-xl object-contain p-1" /> : "E"}</div><p className="mt-14 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">EduCore · School OS</p><h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Menos administración.<br />Más educación.</h1><p className="mt-5 max-w-xs text-sm leading-6 text-blue-100">La plataforma inteligente para centralizar la vida académica de tu colegio.</p><div className="mt-12 flex items-center gap-2 text-xs text-blue-100"><ShieldCheck className="h-4 w-4" />Construido para instituciones educativas</div></div><div className="p-8 sm:p-12"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">{school?.name ?? "EduCore"}</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Bienvenido a EduCore</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inicia sesión con tu cuenta institucional o explora una vista demo.</p><Button onClick={() => startLogin()} className="mt-7 w-full rounded-xl bg-[var(--edc-primary)] shadow-[0_5px_14px_rgba(36,117,207,0.16)]">Iniciar sesión institucional</Button><div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-slate-100" /><span className="text-xs uppercase tracking-wider text-slate-400">Explorar demo</span><div className="h-px flex-1 bg-slate-100" /></div><div className="grid grid-cols-2 gap-2">{(["admin", "teacher", "student", "guardian"] as EduRole[]).map(option => <button key={option} onClick={() => onDemo(option)} className="rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-[#9ecdf5] hover:bg-[#f7fbff]"><p className="text-xs font-semibold text-slate-700">{roleLabels[option]}</p><p className="mt-1 text-xs text-slate-400">Cuenta demo</p></button>)}</div><p className="mt-6 text-center text-xs leading-5 text-slate-400">La demo utiliza datos ficticios. No incluye información real de menores.</p></div></div></div></div>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const loginDemoMutation = trpc.auth.loginDemo.useMutation();
  const [demoMode, setDemoMode] = useState(false);
  const [role, setRole] = useState<EduRole>(() => (localStorage.getItem("educore-demo-role") as EduRole) || "admin");
  const [section, setSection] = useSectionRoute();
  const [, navigate] = useLocation();
  // Hijo que mira el acudiente: vive en la URL (?estudiante=7), la misma fuente que usa su portal
  const guardianChildId = childIdFromSearch(useSearch()) ?? undefined;
  const effectiveRole = role;
  // Cada rol solo abre sus secciones (p. ej. un estudiante en /users o Rectoría en los flujos de aula vuelven a Inicio)
  const sectionAllowed = isSectionAllowed(effectiveRole, section);
  const activeSection = sectionAllowed ? section : "overview";

  useEffect(() => {
    if (!sectionAllowed) {
      setSection("overview", { replace: true });
    }
  }, [sectionAllowed, setSection]);
  const snapshotInput = useMemo(() => ({ role: effectiveRole, selectedStudentId: effectiveRole === "guardian" ? guardianChildId : undefined }), [effectiveRole, guardianChildId]);
  // Al cambiar de hijo se conserva el snapshot anterior mientras llega el nuevo (no se vuelve a la
  // pantalla de carga); el portal acudiente no muestra sus tareas ni eventos hasta que coincide.
  // Al cambiar de rol no: los datos de otro rol nunca se muestran.
  const { data, isLoading, refetch } = trpc.educore.snapshot.useQuery(snapshotInput, {
    enabled: !loading,
    placeholderData: previous => (previous?.role === effectiveRole ? previous : undefined),
  });

  useEffect(() => {
    if (user?.openId === "educore-demo-teacher-1") setRole("teacher");
    else if (user?.openId === "educore-demo-admin") setRole("admin");
    else if (user?.openId === "educore-demo-student-1") setRole("student");
    else if (user?.openId === "educore-demo-guardian-1") setRole("guardian");
  }, [user?.openId]);

  useEffect(() => { if (data?.school?.name) document.title = `EduCore — ${data.school.name}`; }, [data?.school?.name]);
  const schoolName = data?.school?.name ?? "EduCore";

  const handleDemoLogin = async (selectedRole: EduRole) => {
    try {
      await loginDemoMutation.mutateAsync({ role: selectedRole });
      setRole(selectedRole);
      setDemoMode(true);
      localStorage.setItem("educore-demo-role", selectedRole);
      setSection("overview");
      await utils.auth.me.invalidate();
      await refetch();
      toast.success(`Sesión demo iniciada como ${roleLabels[selectedRole]}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al iniciar sesión demo");
    }
  };

  const handleRoleChange = async (nextRole: EduRole) => {
    // Primero la sesión del nuevo rol: si las consultas salen antes, el servidor responde con la sesión
    // anterior (p. ej. datos del docente cacheados bajo la vista del estudiante)
    if (demoMode || user?.openId?.startsWith("educore-demo-")) {
      try {
        await loginDemoMutation.mutateAsync({ role: nextRole });
      } catch {
        // En caso de fallo de red en cambio de rol
      }
    }
    setRole(nextRole);
    localStorage.setItem("educore-demo-role", nextRole);
    // Inicio limpio: sin el hijo ni la materia que miraba el rol anterior
    navigate("/");
    // Todas las consultas dependen del actor de la sesión: se descartan las del rol anterior
    await utils.invalidate();
    toast.success(`Vista cambiada a ${roleLabels[nextRole]}`);
  };

  const handleLogout = async () => {
    await logout();
    setDemoMode(false);
    localStorage.removeItem("educore-demo-role");
    await utils.auth.me.invalidate();
    await refetch();
  };

  const refresh = () => { void refetch(); };
  if (loading || isLoading) return <div className="flex min-h-screen items-center justify-center bg-[var(--edc-background)]"><div className="flex items-center gap-3 text-sm text-slate-500"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--edc-accent)] border-t-[#368de8]" />Preparando tu espacio EduCore...</div></div>;
  const isDemoSession = Boolean(demoMode || (isAuthenticated && user?.openId?.startsWith("educore-demo-")));
  if (!isAuthenticated && !isDemoSession) return <LoginScreen school={data?.school} onDemo={handleDemoLogin} />;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-[var(--edc-background)] p-6"><EmptyState title="No pudimos cargar tu espacio" detail="Revisa la conexión e inténtalo de nuevo." /></div>;
  const isAdmin = effectiveRole === "admin";
  const content =
    effectiveRole === "student" ? <StudentPortal section={activeSection} data={data} user={user} setSection={setSection} onChanged={refresh} />
    : effectiveRole === "guardian" ? <GuardianPortal section={activeSection} data={data} user={user} setSection={setSection} onChanged={refresh} />
    : activeSection === "overview" ? (isAdmin ? <AdminDashboard data={data} user={user} setSection={setSection} /> : <TeacherDashboard data={data} user={user} setSection={setSection} />)
    : activeSection === "academic" ? (isAdmin ? <AcademicPage setSection={setSection} /> : <LegacyAcademicPage data={data} role={effectiveRole} setSection={setSection} onGradeSaved={refresh} />)
    : activeSection === "grades" ? <GradeCenterPage role={effectiveRole} school={data.school} onBack={() => setSection("overview")} />
    : activeSection === "classroom" ? <ClassroomPage data={data} role={effectiveRole} onChanged={refresh} setSection={setSection} />
    : activeSection === "attendance" ? <AttendancePage data={data} role={effectiveRole} user={user} onNavigate={setSection} />
    : activeSection === "calendar" ? <CalendarPage data={data} role={effectiveRole} onChanged={refresh} />
    : activeSection === "communications" ? <CommunicationsPage data={data} role={effectiveRole} onChanged={refresh} />
    : activeSection === "reports" ? <ReportsPage data={data} role={effectiveRole} setSection={setSection} />
    : activeSection === "users" ? <UsersPage onPreview={handleRoleChange} />
    : activeSection === "analytics" ? <AnalyticsPage data={data} role={effectiveRole} setSection={setSection} />
    : activeSection === "piar" ? <PiarPage data={data} role={effectiveRole} />
    : activeSection === "creator" ? <CreatorPage data={data} role={effectiveRole} />
    : <SettingsPage data={data} role={effectiveRole} onChanged={refresh} />;
  return <EduCoreShell role={effectiveRole} section={activeSection} setSection={setSection} schoolName={schoolName} school={data.school} user={user} onRoleChange={handleRoleChange} onLogout={handleLogout} notificationCount={data.notifications.filter((item: any) => !item.read).length}>{content}</EduCoreShell>;
}

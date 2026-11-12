import { useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardList,
  FileHeart,
  FileText,
  GraduationCap,
  Mail,
  Megaphone,
  TrendingDown,
  Upload,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Section } from "@/components/shell";
import "@/components/dashboard/teacher-home.css";
import { requestUsersImport } from "../intents";
import {
  buildAdminPriorities,
  buildCourseHealth,
  buildInstitutionKpis,
  splitAgenda,
  type AdminPriority,
  type AdminPriorityKind,
  type CourseHealth,
} from "./adminSelectors";
import "./admin-home.css";

interface AdminDashboardProps {
  data: any;
  user?: any;
  setSection: (section: Section) => void;
}

const ROLE = "admin" as const;
const MAX_EVENTS = 4;

const PRIORITY_ICONS: Record<AdminPriorityKind, ReactNode> = {
  risk: <TrendingDown aria-hidden="true" strokeWidth={1.9} />,
  reports: <FileText aria-hidden="true" strokeWidth={1.9} />,
  drafts: <Megaphone aria-hidden="true" strokeWidth={1.9} />,
  teachers: <BookOpen aria-hidden="true" strokeWidth={1.9} />,
  students: <GraduationCap aria-hidden="true" strokeWidth={1.9} />,
  invitations: <Mail aria-hidden="true" strokeWidth={1.9} />,
  piar: <FileHeart aria-hidden="true" strokeWidth={1.9} />,
};

const greetingFor = (hour: number) => (hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches");
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Inicio de Rectoría / Coordinación: lo esencial en una sola vista.
 * Indicadores → decisiones pendientes, cursos y próximos eventos. Las tarjetas toman la altura de su contenido.
 */
export function AdminDashboard({ data, user, setSection }: AdminDashboardProps) {
  const academicQuery = trpc.academic.snapshot.useQuery({ role: ROLE }, { staleTime: 30_000 });
  const planillasQuery = trpc.gradeCenter.assignments.useQuery({ role: ROLE }, { staleTime: 30_000, retry: 1 });
  const reportCardsQuery = trpc.gradeCenter.reportCards.useQuery({ role: ROLE }, { staleTime: 30_000, retry: 1 });
  const piarQuery = trpc.piar.courses.useQuery({ role: ROLE }, { staleTime: 60_000, retry: 1 });
  const identityQuery = trpc.identity.summary.useQuery({ role: ROLE }, { staleTime: 30_000, retry: 1 });

  const academic = academicQuery.data ?? null;
  const planillas = useMemo(() => (planillasQuery.data ?? []) as any[], [planillasQuery.data]);
  const attendance = useMemo(() => (data?.attendance ?? []) as any[], [data?.attendance]);

  const kpis = useMemo(() => buildInstitutionKpis({ academic, planillas, attendance }), [academic, planillas, attendance]);
  const courses = useMemo(() => buildCourseHealth({ courses: academic?.courses ?? [], planillas, attendance }), [academic, planillas, attendance]);
  const priorities = useMemo(
    () =>
      buildAdminPriorities({
        academic,
        planillas,
        reportCards: reportCardsQuery.data?.courses ?? [],
        announcements: data?.announcements ?? [],
        identity: identityQuery.data,
        piar: piarQuery.data ?? [],
      }),
    [academic, planillas, reportCardsQuery.data, data?.announcements, identityQuery.data, piarQuery.data],
  );
  const events = useMemo(() => {
    const { today, upcoming } = splitAgenda(data?.events ?? []);
    return [...today.map(item => ({ ...item, isToday: true })), ...upcoming.map(item => ({ ...item, isToday: false }))].slice(0, MAX_EVENTS);
  }, [data?.events]);

  const activePeriod = (academic?.periods ?? data?.academicPeriods ?? []).find(
    (period: any) => period.status === "Activo" || period.status === "ACTIVE",
  );
  const name = firstName(user?.name || "Valentina Ríos");
  const schoolName = data?.school?.name ?? "la institución";
  const dateLabel = capitalize(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
  const loading = academicQuery.isLoading;

  const openImport = () => {
    requestUsersImport();
    setSection("users");
  };

  return (
    <div className="edc-home adm-home">
      <header className="adm-home__hero">
        <div className="edc-greeting">
          <div className="edc-date-chip">
            <CalendarCheck aria-hidden="true" strokeWidth={1.75} />
            {dateLabel}
            {activePeriod?.name ? (
              <>
                <span className="edc-date-chip__dot">·</span>
                <span className="edc-date-chip__period">{activePeriod.name}</span>
              </>
            ) : null}
          </div>
          <h1 className="edc-greeting__title">
            <span className="edc-greeting__muted">{greetingFor(new Date().getHours())},</span> {name}
          </h1>
          <p className="adm-home__lede">Así va {schoolName} hoy y lo que necesita tu decisión.</p>
        </div>
        <div className="adm-home__actions">
          <button type="button" className="edc-dark-btn" onClick={openImport}>
            <Upload aria-hidden="true" strokeWidth={2} />
            Cargar usuarios
          </button>
          <button type="button" className="edc-chip-btn" onClick={() => setSection("communications")}>
            <Megaphone aria-hidden="true" strokeWidth={2} />
            Nuevo comunicado
          </button>
        </div>
      </header>

      <KpiStrip kpis={kpis} loading={loading} setSection={setSection} />

      <div className="adm-home__grid">
        <PriorityCard items={priorities} loading={loading} onOpen={setSection} />
        <div className="adm-home__side">
          <CoursesCard courses={courses} loading={loading} onViewAll={() => setSection("academic")} onOpen={() => setSection("analytics")} />
          <EventsCard events={events} onOpenCalendar={() => setSection("calendar")} />
        </div>
      </div>
    </div>
  );
}

/* ── Indicadores ─────────────────────────────────────────── */

function KpiStrip({
  kpis,
  loading,
  setSection,
}: {
  kpis: ReturnType<typeof buildInstitutionKpis>;
  loading: boolean;
  setSection: (section: Section) => void;
}) {
  const dash = loading ? "…" : "—";
  const occupancy = kpis.capacity ? Math.round((kpis.enrolled / kpis.capacity) * 100) : null;
  const items = [
    {
      key: "students",
      label: "Estudiantes",
      icon: <Users aria-hidden="true" strokeWidth={2} />,
      value: loading ? dash : String(kpis.enrolled),
      unit: null,
      note: occupancy !== null ? `Matriculados · ${occupancy}% de la capacidad` : "Matriculados en el año activo",
      meter: occupancy,
      alert: false,
      section: "academic" as Section,
    },
    {
      key: "teachers",
      label: "Docentes",
      icon: <BookOpen aria-hidden="true" strokeWidth={2} />,
      value: loading ? dash : String(kpis.teachers),
      unit: null,
      note: kpis.teachers ? `${kpis.teachersWithLoad} de ${kpis.teachers} con carga asignada` : "Aún no hay docentes",
      meter: kpis.teachers ? Math.round((kpis.teachersWithLoad / kpis.teachers) * 100) : null,
      alert: false,
      section: "academic" as Section,
    },
    {
      key: "attendance",
      label: "Asistencia",
      icon: <CalendarCheck aria-hidden="true" strokeWidth={2} />,
      value: kpis.attendance !== null ? String(kpis.attendance) : dash,
      unit: kpis.attendance !== null ? "%" : null,
      note: kpis.attendanceRecords ? `Últimos 30 días · ${kpis.attendanceRecords} registros` : "Sin registros en 30 días",
      meter: kpis.attendance,
      alert: kpis.attendance !== null && kpis.attendance < 85,
      section: "analytics" as Section,
    },
    {
      key: "average",
      label: "Promedio",
      icon: <BarChart3 aria-hidden="true" strokeWidth={2} />,
      value: kpis.average !== null ? kpis.average.toFixed(1) : dash,
      unit: kpis.average !== null ? "/ 5.0" : null,
      note: kpis.atRisk ? `${kpis.atRisk} ${kpis.atRisk === 1 ? "estudiante" : "estudiantes"} por debajo de 3.0` : "Sin estudiantes en riesgo",
      meter: null,
      alert: kpis.average !== null && kpis.average < 3,
      section: "reports" as Section,
    },
  ];
  return (
    <section className="edc-card adm-kpis" aria-label="Indicadores institucionales">
      {items.map(item => (
        <button key={item.key} type="button" className="adm-kpi" onClick={() => setSection(item.section)}>
          <span className="adm-kpi__label">
            <span className="adm-kpi__icon">{item.icon}</span>
            {item.label}
          </span>
          <span className={`adm-kpi__value${item.alert ? " adm-kpi__value--alert" : ""}`}>
            {item.value}
            {item.unit ? <small>{item.unit}</small> : null}
          </span>
          {item.meter !== null ? (
            <span className="adm-kpi__meter" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, item.meter))}%` }} />
            </span>
          ) : null}
          <span className="adm-kpi__note">{item.note}</span>
        </button>
      ))}
    </section>
  );
}

/* ── Por atender ─────────────────────────────────────────── */

function PriorityCard({ items, loading, onOpen }: { items: AdminPriority[]; loading: boolean; onOpen: (section: Section) => void }) {
  return (
    <section aria-labelledby="h-adm-todo" className="edc-card adm-panel">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <ClipboardList aria-hidden="true" strokeWidth={1.9} />
        </span>
        <div className="edc-card__heading">
          <h2 id="h-adm-todo" className="edc-card__title">Por atender</h2>
          <div className="edc-card__sub">Decisiones pendientes de la institución</div>
        </div>
        {items.length ? <span className="adm-count">{items.length}</span> : null}
      </div>

      {loading ? (
        <div className="adm-skeleton-rows" aria-busy="true">
          {[0, 1, 2].map(index => (
            <span key={index} />
          ))}
        </div>
      ) : items.length ? (
        <ul className="adm-todo">
          {items.map(item => (
            <li key={item.id} className="adm-todo__row">
              <span className={`adm-todo__icon is-${item.severity}`}>{PRIORITY_ICONS[item.id]}</span>
              <div className="adm-todo__text">
                <span className="adm-todo__title">{item.title}</span>
                <span className="adm-todo__context" title={item.context}>{item.context}</span>
              </div>
              <button type="button" className="edc-dark-btn adm-todo__action" onClick={() => onOpen(item.section)}>
                {item.actionLabel}
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="edc-todo__done">
          <span className="edc-todo__done-icon">
            <Check aria-hidden="true" strokeWidth={2.2} />
          </span>
          <div>
            <div className="edc-todo__done-title">Todo en orden</div>
            <div className="edc-todo__done-text">No hay alertas académicas, boletines ni matrículas pendientes.</div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Cursos ──────────────────────────────────────────────── */

function CoursesCard({
  courses,
  loading,
  onViewAll,
  onOpen,
}: {
  courses: CourseHealth[];
  loading: boolean;
  onViewAll: () => void;
  onOpen: () => void;
}) {
  const totalStudents = courses.reduce((sum, course) => sum + course.students, 0);
  return (
    <section aria-labelledby="h-adm-cursos" className="edc-card adm-panel">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <GraduationCap aria-hidden="true" strokeWidth={1.9} />
        </span>
        <div className="edc-card__heading">
          <h2 id="h-adm-cursos" className="edc-card__title">Cursos</h2>
          <div className="edc-card__sub">
            {courses.length} {courses.length === 1 ? "grupo" : "grupos"} · {totalStudents} estudiantes
          </div>
        </div>
        <button type="button" className="edc-chip-btn" onClick={onViewAll}>
          Ver estructura
        </button>
      </div>

      {courses.length ? (
        <ul className="adm-courses">
          {courses.map(course => (
            <li key={course.id}>
              <button type="button" className="adm-course" onClick={onOpen} aria-label={`${course.name}: asistencia ${course.attendance ?? "sin datos"}%, promedio ${course.average ?? "sin datos"}`}>
                <span className="adm-course__group">{course.name}</span>
                <span className="adm-course__body">
                  <span className="adm-course__line">
                    <span className="adm-course__meta">
                      {course.students}
                      {course.capacity ? `/${course.capacity}` : ""} est. · Prom. {course.average !== null ? course.average.toFixed(1) : "—"}
                    </span>
                    {course.atRisk ? <span className="adm-course__risk">{course.atRisk} en riesgo</span> : null}
                  </span>
                  <span className="adm-course__attendance">
                    <span className="adm-course__bar" aria-hidden="true">
                      <span style={{ width: `${course.attendance ?? 0}%` }} />
                    </span>
                    <span className="adm-course__pct">{course.attendance !== null ? `${course.attendance}%` : "—"}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="edc-empty-note adm-empty-note">{loading ? "Cargando cursos…" : "Aún no hay cursos en el año activo."}</div>
      )}
      {courses.length ? <p className="adm-panel__foot">Barra: asistencia de los últimos 30 días</p> : null}
    </section>
  );
}

/* ── Próximos eventos ────────────────────────────────────── */

function EventsCard({
  events,
  onOpenCalendar,
}: {
  events: Array<{ event: any; date: Date; isToday: boolean }>;
  onOpenCalendar: () => void;
}) {
  return (
    <section aria-labelledby="h-adm-agenda" className="edc-card adm-panel">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <CalendarDays aria-hidden="true" strokeWidth={1.9} />
        </span>
        <div className="edc-card__heading">
          <h2 id="h-adm-agenda" className="edc-card__title">Agenda institucional</h2>
          <div className="edc-card__sub">Hoy y próximos eventos</div>
        </div>
        <button type="button" className="edc-chip-btn" onClick={onOpenCalendar}>
          Calendario
        </button>
      </div>
      {events.length ? (
        <ul className="adm-events">
          {events.map(({ event, date, isToday }) => (
            <li key={event.id}>
              <button type="button" className="adm-event" onClick={onOpenCalendar}>
                <span className={`adm-event__date${isToday ? " is-today" : ""}`}>
                  <strong>{date.getDate()}</strong>
                  {isToday ? "Hoy" : date.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                </span>
                <span className="adm-event__body">
                  <span className="adm-event__title">{event.title}</span>
                  <span className="adm-event__meta">
                    {[event.type, date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }), event.location].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="edc-empty-note adm-empty-note">No hay eventos próximos en el calendario.</div>
      )}
    </section>
  );
}

export default AdminDashboard;

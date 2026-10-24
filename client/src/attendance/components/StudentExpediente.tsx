/**
 * Resumen Chrona de una persona estudiante.
 * Vista de resumen docente; el expediente completo permanece en EduCore Main.
 */
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Fingerprint,
  Info,
  Mail,
  Phone,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { attentionFlagsFor, computeStudentStats, explainAttentionFlag } from "../data/selectors";
import { formatLongDate, formatShortDate } from "../format";
import { STATUS_CHIP, STATUS_DOT, STATUS_META } from "../statusMeta";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Course,
  Student,
  StudentSummaryFamilyProfile,
} from "../types";
import { Avatar } from "./Avatar";

interface StudentExpedienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  familyProfile?: StudentSummaryFamilyProfile;
  course: Course;
  status: AttendanceStatus;
  date: string;
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", STATUS_CHIP[status])}>
      {STATUS_META[status].label}
    </span>
  );
}

function AttendanceOrb({ rate }: { rate: number | null }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const progress = rate === null ? 0 : (Math.max(0, Math.min(100, rate)) / 100) * circumference;

  return (
    <div className="relative grid h-[118px] w-[118px] shrink-0 place-items-center" role="img" aria-label={rate === null ? "Sin sesiones registradas" : `${rate}% de asistencia efectiva`}>
      <svg viewBox="0 0 112 112" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="56" cy="56" r={radius} fill="none" strokeWidth="7" className="stroke-foreground/[0.09]" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className={cn("transition-[stroke-dasharray] duration-500", rate !== null && rate < 85 ? "stroke-attention" : "stroke-brand")}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className={cn("tabular text-[25px] font-bold leading-none tracking-tight", rate !== null && rate < 85 ? "text-attention" : "text-foreground")}>{rate === null ? "—" : `${rate}%`}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">asistencia</span>
      </div>
      <span className="absolute right-[7px] top-[17px] h-2 w-2 rounded-full bg-brand shadow-[0_0_12px_var(--brand-glow)]" aria-hidden="true" />
    </div>
  );
}

function ProfileRail({
  student,
  course,
  status,
  date,
  familyProfile,
}: {
  student: Student;
  course: Course;
  status: AttendanceStatus;
  date: string;
  familyProfile?: StudentSummaryFamilyProfile;
}) {
  const guardianName = student.guardian?.replace(/\s*\(acudiente\)$/i, "");
  const phoneHref = familyProfile?.guardianPhone?.replace(/[^\d+]/g, "");
  const hasContact = Boolean(familyProfile?.guardianPhone || familyProfile?.guardianEmail);

  return (
    <aside className="space-y-3" aria-label="Ficha personal y familiar">
      <section className="glass relative overflow-hidden rounded-2xl p-4" aria-labelledby="student-profile-title">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand/[0.09] blur-3xl" aria-hidden="true" />
        <header className="relative flex items-center gap-3">
          <Avatar name={student.fullName} initials={student.initials} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Identidad · ficha activa</p>
            <h3 id="student-profile-title" className="mt-0.5 text-[12px] font-bold leading-snug">{student.fullName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{student.group} · {course.subject}</p>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-1.5">
          <div className="rounded-xl bg-foreground/[0.035] p-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"><Fingerprint className="h-3 w-3" aria-hidden="true" />{familyProfile?.studentCode ? "Código" : "ID de registro"}</span>
            <p className="mt-1 truncate font-mono text-xs font-semibold" title={familyProfile?.studentCode ?? student.id}>{familyProfile?.studentCode ?? student.id}</p>
          </div>
          <div className="rounded-xl bg-foreground/[0.035] p-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"><CalendarDays className="h-3 w-3" aria-hidden="true" />Registro de hoy</span>
            <p className="mt-1 truncate text-xs font-semibold">{STATUS_META[status].label} · {formatShortDate(date)}</p>
          </div>
        </div>

        <div className="mt-3 border-t border-hairline pt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand"><UsersRound className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Red familiar</p>
              <p className="text-xs font-semibold">Acudiente principal</p>
            </div>
          </div>
          <p className="pl-9 text-xs font-semibold">{guardianName || "Sin acudiente informado"}</p>
          {hasContact ? (
            <div className="mt-2 space-y-1.5 pl-9">
              {familyProfile?.guardianPhone ? (
                <a href={`tel:${phoneHref}`} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
                  <Phone className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{familyProfile.guardianPhone}</span>
                </a>
              ) : null}
              {familyProfile?.guardianEmail ? (
                <a href={`mailto:${familyProfile.guardianEmail}`} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{familyProfile.guardianEmail}</span>
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-1.5 pl-9">
              <div className="rounded-lg bg-foreground/[0.035] px-2 py-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Phone className="h-2.5 w-2.5" aria-hidden="true" />Teléfono</span>
                <p className="mt-1 text-xs leading-tight text-muted-foreground">En ficha principal</p>
              </div>
              <div className="rounded-lg bg-foreground/[0.035] px-2 py-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Mail className="h-2.5 w-2.5" aria-hidden="true" />Correo</span>
                <p className="mt-1 text-xs leading-tight text-muted-foreground">En ficha principal</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-3.5" aria-label="Solicitudes y excusas existentes">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />Pendientes vinculados</span>
          <span className="rounded-full bg-foreground/[0.055] px-2 py-1 text-xs font-semibold">{student.pendingExcuses + student.pendingRequests}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-foreground/[0.035] px-2.5 py-2">
            <p className="text-xs text-muted-foreground">Excusas</p><p className="tabular mt-0.5 text-[12px] font-bold">{student.pendingExcuses}</p>
          </div>
          <div className="rounded-lg bg-foreground/[0.035] px-2.5 py-2">
            <p className="text-xs text-muted-foreground">Solicitudes</p><p className="tabular mt-0.5 text-[12px] font-bold">{student.pendingRequests}</p>
          </div>
        </div>
      </section>
    </aside>
  );
}

function AttendanceBalance({
  stats,
}: {
  stats: NonNullable<ReturnType<typeof computeStudentStats>>;
}) {
  const total = stats.recorded;
  const parts = [
    { label: "Presente", value: stats.present, color: "bg-st-present", text: "text-st-present" },
    { label: "Ausente", value: stats.absent, color: "bg-st-absent", text: "text-st-absent" },
    { label: "Tardanza", value: stats.late, color: "bg-st-late", text: "text-st-late" },
    { label: "Excusa", value: stats.excuse, color: "bg-st-excuse", text: "text-st-excuse" },
  ];
  const rate = stats.attendanceRate === null ? null : Math.round(stats.attendanceRate);
  const TrendIcon = stats.trend === "down" ? TrendingDown : TrendingUp;

  return (
    <section className="glass overflow-hidden rounded-2xl" aria-labelledby="summary-balance-title">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Chrona · pulso de asistencia</p>
          <h3 id="summary-balance-title" className="mt-0.5 text-[12px] font-semibold">Balance del periodo disponible</h3>
        </div>
        <span className="tabular rounded-full bg-foreground/[0.045] px-2 py-1 text-xs text-muted-foreground">{total} sesiones</span>
      </div>

      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <AttendanceOrb rate={rate} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold">{stats.present + stats.late} de {total} jornadas con asistencia</p>
            {rate !== null ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", stats.trend === "down" ? "bg-attention/10 text-attention" : "bg-brand-soft text-brand")}>
                <TrendIcon className="h-3 w-3" aria-hidden="true" />{stats.trend === "stable" ? "Estable" : `${stats.trendDelta > 0 ? "+" : ""}${stats.trendDelta.toFixed(1)} pp`}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-foreground/[0.07]" role="img" aria-label={parts.map(part => `${part.label}: ${part.value}`).join(", ")}>
            {parts.map(part => (
              <span key={part.label} className={cn("h-full transition-[width] duration-500", part.color)} style={{ width: total ? `${(part.value / total) * 100}%` : "0%" }} />
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {parts.map(part => (
              <div key={part.label} className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2 ring-1 ring-inset ring-hairline">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", part.color)} aria-hidden="true" />{part.label}</span>
                <span className={cn("tabular text-xs font-bold", part.text)}>{part.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Las jornadas pendientes no entran en la tasa; las excusas se muestran aparte.</p>
        </div>
      </div>
    </section>
  );
}

function SignalCard({
  flag,
  explanation,
}: {
  flag: ReturnType<typeof attentionFlagsFor>[number];
  explanation: ReturnType<typeof explainAttentionFlag>;
}) {
  return (
    <article className="rounded-xl border border-attention/20 bg-attention/[0.045] p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-attention/10 text-attention"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-xs font-semibold">{flag.label}</h4>
            <span className="rounded-full bg-foreground/[0.055] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{flag.severity === "high" ? "Prioridad alta" : flag.severity === "medium" ? "Revisar" : "Informativa"}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/85">{explanation.trigger}</p>
          <p className="mt-1 rounded-lg bg-background/55 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground/80">Por qué aparece: </span>{explanation.evidence}</p>
          {explanation.evidenceDates.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1" aria-label="Fechas que respaldan esta señal">
              {explanation.evidenceDates.map(date => <span key={date} className="tabular rounded-md bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">{formatShortDate(date)}</span>)}
            </div>
          ) : null}
          {explanation.note ? <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{explanation.note}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function StudentExpediente({
  open,
  onOpenChange,
  student,
  familyProfile,
  course,
  status,
  date,
}: StudentExpedienteProps) {
  const stats = useMemo(() => student ? computeStudentStats(student, status, date) : null, [date, status, student]);
  const flags = useMemo(() => student ? attentionFlagsFor(student, status, date) : [], [date, status, student]);
  const explanations = useMemo(
    () => student && stats ? flags.map(flag => ({ flag, explanation: explainAttentionFlag(flag, student, status, date) })) : [],
    [date, flags, stats, status, student],
  );
  const recentRecords = useMemo<AttendanceRecord[]>(
    () => student ? student.history.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) : [],
    [student],
  );

  if (!open || !student || !stats) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-strong flex h-[min(90dvh,740px)] w-[calc(100vw-16px)] !max-w-[1080px] flex-col gap-0 overflow-hidden rounded-[22px] border border-hairline-strong p-0 shadow-[var(--lift-shadow)] sm:!max-w-[1080px]"
        showCloseButton={false}
        aria-describedby="student-summary-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Resumen del estudiante · {student.fullName}</DialogTitle>
          <DialogDescription id="student-summary-description">Ficha personal y familiar, balance de asistencia y señales explicables de {student.fullName}.</DialogDescription>
        </DialogHeader>

        <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <Avatar name={student.fullName} initials={student.initials} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Chrona · resumen individual</p>
            <h2 className="truncate text-[14px] font-bold leading-tight sm:text-[16px]">{student.fullName}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{student.group} · {course.subject}</p>
          </div>
          <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:inline-flex", status === "pending" ? "bg-foreground/[0.05] text-muted-foreground" : "bg-brand-soft text-brand")}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{STATUS_META[status].label} · {formatShortDate(date)}
          </span>
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.045] text-muted-foreground transition-colors hover:bg-foreground/[0.09] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" aria-label="Cerrar resumen">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <nav aria-label="Secciones del expediente completo" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-hairline px-3 py-2 sm:px-5">
          <span aria-current="page" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border-b-2 border-brand bg-brand-soft px-3 text-xs font-semibold text-brand"><Activity className="h-3.5 w-3.5" aria-hidden="true" />Resumen</span>
          {(["Asistencia", "Historial", "Excusas", "Seguimiento", "Línea de tiempo"] as const).map(label => (
            <span key={label} aria-disabled="true" title={`${label} se conserva en el expediente de EduCore main`} className="inline-flex h-8 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground/45">{label}</span>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(230px,0.78fr)_minmax(0,1.72fr)]">
            <ProfileRail student={student} course={course} status={status} date={date} familyProfile={familyProfile} />

            <div className="min-w-0 space-y-3">
              <AttendanceBalance stats={stats} />

              <section className="glass rounded-2xl p-3.5 sm:p-4" aria-labelledby="summary-signals-title">
                <header className="mb-2.5 flex items-center gap-2">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-lg", flags.length ? "bg-attention/10 text-attention" : "bg-st-present/10 text-st-present")}>
                    {flags.length ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lectura preventiva</p>
                    <h3 id="summary-signals-title" className="text-xs font-semibold">Señales explicables</h3>
                  </div>
                  <span className="tabular rounded-full bg-foreground/[0.05] px-2 py-1 text-xs text-muted-foreground">{flags.length}</span>
                </header>
                {explanations.length ? (
                  <div className="space-y-2">
                    {explanations.slice(0, 3).map(({ flag, explanation }) => <SignalCard key={flag.kind} flag={flag} explanation={explanation} />)}
                    {explanations.length > 3 ? <p className="text-xs text-muted-foreground">+{explanations.length - 3} señales adicionales en este resumen.</p> : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-st-present/[0.06] p-3 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-st-present" aria-hidden="true" />No se activa una regla de atención con los registros disponibles.</div>
                )}
                <p className="mt-2.5 flex items-start gap-1.5 border-t border-hairline pt-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Son señales para orientar una revisión docente; no constituyen diagnósticos.</p>
              </section>

              <section className="glass overflow-hidden rounded-2xl" aria-labelledby="summary-history-title">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3.5 py-2.5 sm:px-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estelas recientes</p>
                    <h3 id="summary-history-title" className="mt-0.5 text-xs font-semibold">Últimas cinco jornadas</h3>
                  </div>
                  <span className="tabular rounded-full bg-foreground/[0.045] px-2 py-1 text-xs text-muted-foreground">{stats.recorded} registradas</span>
                </header>
                {recentRecords.length ? (
                  <ol className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-5 sm:divide-x sm:divide-y-0">
                    {recentRecords.map((record, index) => (
                      <li key={record.date} className="min-w-0 px-3 py-2.5 sm:px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[record.status])} aria-hidden="true" />
                          <span className="tabular truncate text-xs text-muted-foreground" title={formatLongDate(record.date)}>{formatShortDate(record.date)}</span>
                          {index === 0 ? <span className="rounded bg-brand-soft px-1 py-0.5 text-xs font-semibold text-brand">última</span> : null}
                        </div>
                        <div className="mt-1.5"><StatusPill status={record.status} /></div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">Aún no hay jornadas registradas en el historial.</p>
                )}
              </section>
            </div>

            <footer className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-hairline pt-2 text-xs leading-relaxed text-muted-foreground xl:col-span-2">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden="true" />Consulta: {formatLongDate(date)}</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{stats.present + stats.late} asistencias · {student.pendingExcuses} excusas pendientes · {student.pendingRequests} solicitudes</span>
              <span className="inline-flex items-center gap-1"><ChevronDown className="h-3 w-3 -rotate-90" aria-hidden="true" />Las demás pestañas permanecen en EduCore main.</span>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

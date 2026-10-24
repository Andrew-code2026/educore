import { motion } from "framer-motion";
import {
ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Gauge,
  Layers3,
  LockKeyhole,
Search,
  Sparkles,
TriangleAlert,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { EMPTY_FILTERS } from "../domain/selectors";
import { assignmentFromDataset, filterAssignments } from "../domain/assignments";
import type { Analytics } from "../domain/metrics";
import type { Dataset, Filters, ViewId } from "../types";

interface LandingViewProps {
  onOpenMatrix: (view?: ViewId) => void;
  onOpenAnalysis: () => void;
}

/**
 * Centro global de acceso. La fuente actual expone una sola asignación autorizada;
 * no se crean tarjetas ficticias hasta que exista un catálogo de planillas real.
 */
export function LandingView({ onOpenMatrix, onOpenAnalysis }: LandingViewProps) {
  const { dataset, analytics, preferences, setFilters, availableAssignments: ctxAssignments, onSelectAssignment } = useGradeCenter();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [period, setPeriod] = useState("all");
  const availableAssignments = useMemo(
    () => (ctxAssignments && ctxAssignments.length > 0 ? ctxAssignments : dataset.key === "gradecenter-empty" ? [] : [assignmentFromDataset(dataset)]),
    [ctxAssignments, dataset],
  );
  const assignments = useMemo(() => availableAssignments.map((assignment) => ({ dataset: assignment.dataset, analytics })), [analytics, availableAssignments]);
  const years = useMemo(() => Array.from(new Set(assignments.map(({ dataset: item }) => item.academicYear))), [assignments]);
  const periods = useMemo(() => Array.from(new Set(assignments.map(({ dataset: item }) => item.period))), [assignments]);
  const visibleAssignments = useMemo(() => filterAssignments(availableAssignments, query, year, period).map((assignment) => ({ dataset: assignment.dataset, analytics })), [analytics, availableAssignments, period, query, year]);

  const totalCells = visibleAssignments.reduce((sum, { dataset: item }) => sum + item.students.length * item.evaluations.length, 0);
  const pending = visibleAssignments.reduce((sum, { analytics: item }) => sum + item.group.totalPending, 0);
  const gradedCells = totalCells - pending;
  const progress = totalCells ? Math.round((gradedCells / totalCells) * 100) : 0;
  const attention = visibleAssignments.reduce((sum, { analytics: item }) => sum + item.group.attention.length, 0);
  const uniqueStudentIds = new Set(visibleAssignments.flatMap(({ dataset: item }) => item.students.map((student) => student.id)));
  const incompleteSheets = visibleAssignments.filter(({ analytics: item }) => item.group.totalPending > 0).length;
  const completeSheets = visibleAssignments.length - incompleteSheets;
  const visibleAnalytics = visibleAssignments[0]?.analytics ?? null;
  const topRisk = visibleAnalytics?.group.riskStudents[0] ?? null;
  const hardest = visibleAnalytics?.group.hardest ?? null;

  const openWithFilters = (patch: Partial<Filters>) => {
    setFilters({ ...preferences.filters, ...patch });
    onOpenMatrix("standard");
  };

  const clearGlobalFilters = () => { setQuery(""); setYear("all"); setPeriod("all"); };

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-9 lg:py-7">
                <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }} className="gc-landing-hero relative overflow-hidden rounded-[28px] p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-28 right-[-5%] size-72 rounded-full bg-[var(--gc-cobalt)]/12 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2"><span className="gc-label text-[var(--gc-cobalt)]">Workspace académico</span><span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-xs text-muted-foreground">{assignments.length} planilla{assignments.length === 1 ? " disponible" : "s disponibles"}</span></div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Grade Center</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Gestiona las calificaciones de los salones y materias asignados desde un solo espacio.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left sm:min-w-56"><div className="gc-label text-xs">Fuente de acceso</div><div className="mt-1 text-xs font-medium">Asignaciones autorizadas</div><div className="mt-0.5 text-xs text-muted-foreground">El contexto se define al abrir una planilla</div></div>
          </div>
        </motion.header>

        <section aria-label="Filtros de planillas" className="glass mt-4 rounded-2xl p-3 sm:p-3.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por salón, materia o docente…" aria-label="Buscar planilla" className="w-full rounded-xl border border-white/8 bg-white/5 py-2 pr-3 pl-9 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-[var(--gc-cobalt)]/60" /></div>
            <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar por año escolar" className="rounded-xl border border-white/8 bg-[var(--card)] px-3 py-2 text-xs outline-none focus:border-[var(--gc-cobalt)]/60"><option value="all">Todos los años</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filtrar por periodo académico" className="rounded-xl border border-white/8 bg-[var(--card)] px-3 py-2 text-xs outline-none focus:border-[var(--gc-cobalt)]/60"><option value="all">Todos los periodos</option>{periods.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            {(query || year !== "all" || period !== "all") && <button type="button" onClick={clearGlobalFilters} className="rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--gc-cobalt)] hover:bg-white/6">Limpiar</button>}
          </div>
        </section>

        <section className="mt-5" aria-labelledby="my-sheets-title">
          <div className="mb-3 flex items-end justify-between gap-3"><div><div className="gc-label text-xs">Acceso rápido</div><h2 id="my-sheets-title" className="mt-1 text-xl font-semibold">Mis planillas</h2></div><span className="text-xs text-muted-foreground">{visibleAssignments.length} de {assignments.length} visibles</span></div>
          {assignments.length === 0 ? <div className="glass rounded-2xl border border-dashed border-[var(--gc-cobalt)]/25 p-8 text-center"><ClipboardList className="mx-auto size-6 text-[var(--gc-cobalt)]" /><div className="mt-3 text-sm font-semibold">Aún no hay planillas académicas disponibles</div><div className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">Grade Center está listo para recibir las asignaciones autorizadas desde EduCore Main. Cuando exista una fuente académica real, aquí aparecerán sus salones y materias.</div></div> : visibleAssignments.length === 1 ? <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,.55fr)]"><PlanillaCard dataset={visibleAssignments[0].dataset} analytics={visibleAssignments[0].analytics} onOpen={() => { if (onSelectAssignment && visibleAssignments[0].dataset.key !== dataset.key) { onSelectAssignment(visibleAssignments[0].dataset.key); } onOpenMatrix("standard"); }} single /><QuickActions onPending={() => openWithFilters({ ...EMPTY_FILTERS, onlyPending: true })} onAttention={() => openWithFilters({ ...EMPTY_FILTERS, onlyAttention: true })} onAnalytics={onOpenAnalysis} /></div> : visibleAssignments.length > 1 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleAssignments.map(({ dataset: item, analytics: itemAnalytics }) => <PlanillaCard key={item.key} dataset={item} analytics={itemAnalytics} onOpen={() => { if (onSelectAssignment && item.key !== dataset.key) { onSelectAssignment(item.key); } onOpenMatrix("standard"); }} />)}</div> : <div className="glass rounded-2xl p-7 text-center"><Search className="mx-auto size-5 text-muted-foreground" /><div className="mt-2 text-sm font-semibold">No encontramos planillas</div><div className="mt-1 text-xs text-muted-foreground">Ninguna planilla disponible coincide con los filtros actuales.</div><button type="button" onClick={clearGlobalFilters} className="mt-3 rounded-xl bg-[var(--gc-cobalt)]/15 px-3 py-2 text-xs font-semibold text-[var(--gc-cobalt)]">Limpiar filtros</button></div>}
        </section>

        {visibleAssignments.length === 1 ? <CompactMetrics students={uniqueStudentIds.size} evaluations={dataset.evaluations.length} pending={pending} progress={progress} onPending={() => openWithFilters({ ...EMPTY_FILTERS, onlyPending: true })} /> : <section aria-label="Resumen global" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Layers3 />} label="Planillas asignadas" value={String(visibleAssignments.length)} detail={visibleAssignments.length === 1 ? "única planilla visible" : "según los filtros actuales"} tone="cobalt" />
          <MetricCard icon={<Users />} label="Estudiantes" value={String(uniqueStudentIds.size)} detail="sin duplicar entre planillas" tone="alto" />
          <MetricCard icon={<ClipboardList />} label="Calificaciones pendientes" value={String(pending)} detail={incompleteSheets ? `en ${incompleteSheets} planilla${incompleteSheets === 1 ? "" : "s"}` : "sin pendientes"} tone="superior" onClick={() => pending && openWithFilters({ ...EMPTY_FILTERS, onlyPending: true })} />
          <MetricCard icon={<TriangleAlert />} label="Requieren atención" value={String(attention)} detail="casos pedagógicos detectados" tone="bajo" onClick={() => attention && openWithFilters({ ...EMPTY_FILTERS, onlyAttention: true })} />
        </section>}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <section className="gc-alert-surface rounded-3xl p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="gc-label text-xs">Seguimiento</div><h2 className="mt-1 text-lg font-semibold">Alertas prioritarias</h2></div><Sparkles className="size-4 text-[var(--gc-cobalt)]" /></div><div className="mt-4 space-y-2.5">
            {pending > 0 && <InsightRow icon={<ClipboardList />} tone="cobalt" title={`Tienes ${pending} calificaciones pendientes`} detail={`Distribuidas en ${incompleteSheets} planilla${incompleteSheets === 1 ? "" : "s"} visible${incompleteSheets === 1 ? "" : "s"}.`} action="Ver pendientes" onClick={() => openWithFilters({ ...EMPTY_FILTERS, onlyPending: true })} />}
            {attention > 0 && topRisk && <InsightRow icon={<TriangleAlert />} tone="bajo" title={`${attention} casos requieren atención`} detail={`${topRisk.student.firstName} ${topRisk.student.lastName} presenta la definitiva más baja en ${dataset.course} · ${dataset.subject} · ${dataset.period}.`} action="Abrir seguimiento" onClick={() => openWithFilters({ ...EMPTY_FILTERS, onlyAttention: true })} />}
            {!pending && !attention && !hardest && <EmptyState icon={<CheckCircle2 />} title="No hay alertas prioritarias" detail="No se detectan acciones pendientes con los datos visibles." />}
            {(hardest && (pending > 0 || attention > 0)) && <button type="button" onClick={() => openWithFilters({ ...EMPTY_FILTERS, evaluationId: hardest.evaluation.id, evaluationState: "pending" })} className="ml-10 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gc-cobalt)]">Ver todas las alertas <ArrowRight className="size-3" /></button>}
          </div></section>

          <section className="gc-summary-surface rounded-3xl p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="gc-label text-xs">Resumen de calificación</div><h2 className="mt-1 text-lg font-semibold">Estado de mis planillas</h2></div><Gauge className="size-4 text-[var(--gc-alto)]" /></div><div className="mt-5 rounded-2xl border border-white/8 bg-white/4 p-3"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Progreso de celdas</span><span className="gc-num font-semibold">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/8"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: .7 }} className="h-full rounded-full bg-gradient-to-r from-[var(--gc-cobalt)] to-[var(--gc-superior)]" /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{gradedCells} de {totalCells} celdas</span><span>{pending} pendientes</span></div></div><div className="mt-3 grid grid-cols-2 gap-2"><MiniStat label="Planillas completas" value={`${completeSheets} / ${visibleAssignments.length}`} /><MiniStat label="Con pendientes" value={String(incompleteSheets)} /></div><div className="mt-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs leading-4 text-muted-foreground">Las ponderaciones y el cierre pertenecen a cada planilla. Se muestran al abrir su contexto específico.</div></section>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5 text-[var(--gc-cobalt)]" /><span>Solo se muestran las asignaciones académicas entregadas por la fuente autorizada.</span></div>
      </div>
    </div>
  );
}

function PlanillaCard({ dataset, analytics, onOpen, single = false }: { dataset: Dataset; analytics: Analytics; onOpen: () => void; single?: boolean }) {
  const totalCells = dataset.students.length * dataset.evaluations.length;
  const progress = totalCells ? Math.round(((totalCells - analytics.group.totalPending) / totalCells) * 100) : 0;
  return <motion.button type="button" whileHover={{ y: -2 }} onClick={onOpen} className={cn("gc-planilla-card group rounded-2xl p-4 text-left transition-colors", single && "p-5 sm:p-6")}><div className="flex items-start justify-between gap-3"><div><div className="gc-label text-xs">Planilla asignada</div><h3 className={cn("mt-1 text-base font-semibold", single && "text-xl")}>{dataset.course} · {dataset.subject}</h3><div className="mt-1 text-xs text-muted-foreground">{dataset.period} · {dataset.academicYear} · {dataset.teacher.name}</div></div><span className="rounded-full border border-[var(--gc-alto)]/25 bg-[var(--gc-alto)]/10 px-2 py-1 text-xs font-semibold text-[var(--gc-alto)]">Disponible</span></div><div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div><div className="flex flex-wrap items-end gap-x-7 gap-y-3"><div><div className="gc-label text-xs">Progreso de calificación</div><div className="mt-1 flex items-baseline gap-2"><span className="gc-num text-3xl font-semibold text-[var(--gc-alto)]">{progress}%</span><span className="text-xs text-muted-foreground">calificado</span></div></div><div><div className="gc-label text-xs">Pendientes</div><div className="gc-num mt-1 text-2xl font-semibold text-[var(--gc-superior)]">{analytics.group.totalPending}</div></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-[var(--gc-cobalt)] to-[var(--gc-alto)]" style={{ width: `${progress}%` }} /></div><div className="mt-2 text-xs text-muted-foreground">{dataset.students.length} estudiantes · {dataset.evaluations.length} evaluaciones</div></div><span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gc-cobalt)] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_24px_-12px_var(--gc-cobalt)]">Abrir planilla <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span></div></motion.button>;
}

function QuickActions({ onPending, onAttention, onAnalytics }: { onPending: () => void; onAttention: () => void; onAnalytics: () => void }) { return <div className="gc-context-card flex flex-col justify-between rounded-2xl p-4"><div><div className="gc-label text-xs">Acciones contextuales</div><div className="mt-1 text-sm font-semibold">Siguiente paso</div><p className="mt-1 text-xs leading-4 text-muted-foreground">Accesos directos para esta asignación.</p></div><div className="mt-4 space-y-1.5"><button type="button" onClick={onPending} className="gc-action"><ClipboardList className="size-3.5 text-[var(--gc-superior)]" /> Ver pendientes <ChevronRight className="ml-auto size-3" /></button><button type="button" onClick={onAttention} className="gc-action"><TriangleAlert className="size-3.5 text-[var(--gc-bajo)]" /> Ver estudiantes en atención <ChevronRight className="ml-auto size-3" /></button><button type="button" onClick={onAnalytics} className="gc-action"><BarChart3 className="size-3.5 text-[var(--gc-basico)]" /> Abrir analítica <ChevronRight className="ml-auto size-3" /></button></div></div>; }

function CompactMetrics({ students, evaluations, pending, progress, onPending }: { students: number; evaluations: number; pending: number; progress: number; onPending: () => void }) { return <section aria-label="Resumen de la planilla" className="gc-metrics-surface mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3"><MetricInline icon={<Users />} label="Estudiantes" value={String(students)} tone="alto" /><MetricInline icon={<ClipboardList />} label="Evaluaciones" value={String(evaluations)} tone="basico" /><button type="button" onClick={onPending} className="flex items-center gap-2 text-left"><span className="gc-icon-tint text-[var(--gc-superior)]"><TriangleAlert className="size-3.5" /></span><span><span className="gc-num block text-sm font-semibold text-[var(--gc-superior)]">{pending}</span><span className="gc-label block text-xs">Pendientes</span></span></button><MetricInline icon={<Gauge />} label="Calificado" value={`${progress}%`} tone="cobalt" /></section>; }
function MetricInline({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "alto" | "basico" | "cobalt" }) { const color = tone === "alto" ? "var(--gc-alto)" : tone === "basico" ? "var(--gc-basico)" : "var(--gc-cobalt)"; return <div className="flex items-center gap-2"><span className="gc-icon-tint" style={{ color }}>{icon}</span><span><span className="gc-num block text-sm font-semibold">{value}</span><span className="gc-label block text-xs">{label}</span></span></div>; }

function MetricCard({ icon, label, value, detail, tone, onClick }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "cobalt" | "alto" | "superior" | "bajo"; onClick?: () => void }) { const colors = { cobalt: "var(--gc-cobalt)", alto: "var(--gc-alto)", superior: "var(--gc-superior)", bajo: "var(--gc-bajo)" }; return <button type="button" onClick={onClick} disabled={!onClick} className={cn("gc-metric-card group w-full rounded-2xl p-3.5 text-left", onClick && "cursor-pointer", !onClick && "cursor-default")}><div className="flex items-center justify-between"><span className="gc-metric-icon flex size-8 items-center justify-center rounded-xl" style={{ color: colors[tone], backgroundColor: `color-mix(in oklab, ${colors[tone]} 14%, transparent)` }}>{icon}</span><span className="gc-num text-2xl font-semibold" style={{ color: colors[tone] }}>{value}</span></div><div className="mt-3 text-xs font-medium">{label}</div><div className="mt-0.5 text-xs text-muted-foreground">{detail}</div></button>; }
function InsightRow({ icon, tone, title, detail, action, onClick }: { icon: React.ReactNode; tone: "cobalt" | "basico" | "bajo"; title: string; detail: string; action: string; onClick: () => void }) { const color = tone === "cobalt" ? "var(--gc-cobalt)" : tone === "basico" ? "var(--gc-basico)" : "var(--gc-bajo)"; return <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 p-3"><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}>{icon}</span><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{title}</div><div className="mt-1 text-xs leading-4 text-muted-foreground">{detail}</div><button type="button" onClick={onClick} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>{action}<ArrowRight className="size-3" /></button></div></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-white/4 px-2.5 py-2"><div className="gc-label text-xs">{label}</div><div className="gc-num mt-1 text-sm font-semibold">{value}</div></div>; }
function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-[var(--gc-alto)]/20 bg-[var(--gc-alto)]/6 p-4"><span className="text-[var(--gc-alto)]">{icon}</span><div><div className="text-xs font-semibold">{title}</div><div className="mt-0.5 text-xs text-muted-foreground">{detail}</div></div></div>; }

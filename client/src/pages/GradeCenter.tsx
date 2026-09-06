import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, BarChart3, Check, ChevronDown, Download, FileText, Filter, Search, Sparkles, Undo2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EduRole = "admin" | "teacher" | "student" | "guardian";

type GradeCenterProps = { role: EduRole; school: any };

const assessmentLabels: Record<string, string> = { QUIZ: "Quiz", TALLER: "Taller", EXAMEN: "Examen", PROYECTO: "Proyecto", ACTIVIDAD: "Actividad", PARTICIPACION: "Participación", RECUPERACION: "Recuperación", OTRO: "Otro" };
const numberValue = (value: number | null | undefined) => value === null || value === undefined ? "—" : Number(value).toFixed(1);

export function GradeCenterPage({ role, school }: GradeCenterProps) {
  const canWrite = role === "admin" || role === "teacher";
  const [courseId, setCourseId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [periodId, setPeriodId] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [pending, setPending] = useState<Record<string, number | null>>({});
  const [selectedCell, setSelectedCell] = useState<{ assessmentId: number; studentId: number } | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [newAssessment, setNewAssessment] = useState({ title: "", type: "ACTIVIDAD", weight: "10", date: new Date().toISOString().slice(0, 10) });
  const [observationDraft, setObservationDraft] = useState("");
  const contextQuery = trpc.gradeCenter.context.useQuery({ role, courseId, subjectId, academicPeriodId: periodId }, { staleTime: 10_000 });
  const saveGrades = trpc.gradeCenter.saveGrades.useMutation();
  const createAssessment = trpc.gradeCenter.createAssessment.useMutation();
  const generateReportCards = trpc.gradeCenter.generateReportCards.useMutation();
  const generateDraft = trpc.gradeCenter.generateObservationDraft.useMutation();
  const saveObservation = trpc.gradeCenter.saveObservation.useMutation();
  const utils = trpc.useUtils();
  const context = contextQuery.data;

  useEffect(() => {
    if (!context?.selected) return;
    if (courseId === undefined && context.selected.course?.id) setCourseId(context.selected.course.id);
    if (subjectId === undefined && context.selected.subject?.id) setSubjectId(context.selected.subject.id);
    if (periodId === undefined && context.selected.period?.id) setPeriodId(context.selected.period.id);
  }, [context, courseId, subjectId, periodId]);

  useEffect(() => {
    if (!context) return;
    const next: Record<string, number | null> = {};
    for (const row of context.rows ?? []) for (const item of row.values ?? []) next[`${item.assessment.id}:${row.enrollment.studentUserId}`] = item.grade?.value ?? null;
    setPending(next);
  }, [context?.selected?.course?.id, context?.selected?.subject?.id, context?.selected?.period?.id, context?.assessments?.length, context?.rows?.length]);

  const filteredRows = useMemo(() => (context?.rows ?? []).filter((row: any) => {
    const name = row.student?.name ?? `${row.student?.firstName ?? ""} ${row.student?.lastName ?? ""}`;
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false;
    const average = row.average;
    if (filter === "PENDING") return row.values.some((item: any) => pending[`${item.assessment.id}:${row.enrollment.studentUserId}`] === null);
    if (filter === "LOW") return average !== null && average < 3;
    if (filter === "MID") return average !== null && average >= 3 && average < 4;
    if (filter === "HIGH") return average !== null && average >= 4;
    if (filter === "COMMENT") return row.values.some((item: any) => item.grade?.comment);
    return true;
  }), [context?.rows, query, filter, pending]);

  if (contextQuery.isLoading || !context) return <div className="space-y-5"><div className="h-8 w-56 animate-pulse rounded-xl bg-slate-100" /><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (contextQuery.isError) return <Card className="rounded-2xl border-rose-100 bg-rose-50"><CardContent className="p-6 text-sm text-rose-700">No fue posible cargar el Grade Center. Verifica tu acceso institucional.</CardContent></Card>;

  const selected: any = context.selected ?? {};
  const weightTotal = (context.assessments ?? []).reduce((sum: number, item: any) => sum + Number(item.weight), 0);
  const pendingCount = (context.rows ?? []).reduce((sum: number, row: any) => sum + row.values.filter((item: any) => { const key = `${item.assessment.id}:${row.enrollment.studentUserId}`; return (Object.prototype.hasOwnProperty.call(pending, key) ? pending[key] : item.grade?.value ?? null) === null; }).length, 0);
  const selectedRow = (context.rows ?? []).find((row: any) => row.enrollment.studentUserId === selectedStudent);
  const selectedCellData = selectedCell ? (context.rows ?? []).find((row: any) => row.enrollment.studentUserId === selectedCell.studentId)?.values.find((item: any) => item.assessment.id === selectedCell.assessmentId) : null;
  const selectedStudentName = selectedRow?.student?.name ?? `${selectedRow?.student?.firstName ?? ""} ${selectedRow?.student?.lastName ?? ""}`.trim();

  const updateCell = (assessmentId: number, studentId: number, value: string) => {
    const parsed = value === "" ? null : Number(value);
    setPending(previous => ({ ...previous, [`${assessmentId}:${studentId}`]: Number.isFinite(parsed) ? parsed : null }));
  };

  const saveAll = async () => {
    if (!canWrite) return;
    try {
      for (const assessment of context.assessments ?? []) {
        const grades = (context.rows ?? []).map((row: any) => { const item = row.values.find((value: any) => value.assessment.id === assessment.id); const key = `${assessment.id}:${row.enrollment.studentUserId}`; return { studentId: row.enrollment.studentUserId, value: Object.prototype.hasOwnProperty.call(pending, key) ? pending[key] : item?.grade?.value ?? null, comment: item?.grade?.comment ?? undefined }; });
        await saveGrades.mutateAsync({ role, assessmentId: assessment.id, grades });
      }
      await utils.gradeCenter.context.invalidate();
      toast.success("Calificaciones guardadas");
    } catch (error: any) { toast.error(error?.message ?? "No fue posible guardar las calificaciones"); }
  };

  const createNewAssessment = async () => {
    if (!selected.course?.academicYearId || !selected.course?.id || !selected.subject?.id || !selected.period?.id || !newAssessment.title.trim()) return;
    try {
      await createAssessment.mutateAsync({ role, academicYearId: selected.course.academicYearId, academicPeriodId: selected.period.id, courseId: selected.course.id, subjectId: selected.subject.id, title: newAssessment.title.trim(), assessmentType: newAssessment.type as any, date: new Date(newAssessment.date), maxValue: 5, weight: Number(newAssessment.weight), status: "DRAFT" });
      setNewAssessment({ title: "", type: "ACTIVIDAD", weight: "10", date: new Date().toISOString().slice(0, 10) });
      setShowAssessmentForm(false);
      await utils.gradeCenter.context.invalidate();
      toast.success("Evaluación creada como borrador");
    } catch (error: any) { toast.error(error?.message ?? "No fue posible crear la evaluación"); }
  };

  const openReportCards = async () => {
    if (!selected.course?.academicYearId || !selected.period?.id || !selected.course?.id) return;
    try {
      const result = await generateReportCards.mutateAsync({ role, academicYearId: selected.course.academicYearId, academicPeriodId: selected.period.id, courseId: selected.course.id });
      toast.success(`${result?.generated ?? 0} boletines generados`);
      await utils.gradeCenter.context.invalidate();
    } catch (error: any) { toast.error(error?.message ?? "No fue posible generar los boletines"); }
  };

  const draftObservation = async () => {
    if (!selectedStudent || !selectedStudentName) return;
    const row = context.rows.find((item: any) => item.enrollment.studentUserId === selectedStudent);
    const response = await generateDraft.mutateAsync({ role, studentName: selectedStudentName, context: `Curso: ${selected.course?.name}. Materia: ${selected.subject?.name}. Promedio: ${row?.average ?? "sin datos"}. Notas: ${(row?.values ?? []).map((item: any) => `${item.assessment.title}: ${item.grade?.value ?? "pendiente"}`).join(", ")}` });
    setObservationDraft(response.text);
  };
  const saveDraft = async () => {
    if (!selectedStudent || !observationDraft || !selected.course?.academicYearId || !selected.period?.id) return;
    await saveObservation.mutateAsync({ role, studentId: selectedStudent, academicYearId: selected.course.academicYearId, academicPeriodId: selected.period.id, text: observationDraft, status: "DRAFT" });
    setObservationDraft("");
    toast.success("Borrador de observación guardado");
    await utils.gradeCenter.context.invalidate();
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">Grade Center</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">Calificaciones</h1><p className="mt-2 text-sm leading-6 text-slate-500">Calificaciones y rendimiento académico · menos clics, más claridad.</p></div><div className="flex flex-wrap gap-2">{canWrite ? <Button onClick={() => setShowAssessmentForm(value => !value)} className="rounded-xl bg-[var(--edc-primary)]"><span className="mr-2">+</span>Nueva evaluación</Button> : null}{role === "admin" ? <Button variant="outline" onClick={openReportCards} disabled={generateReportCards.isPending} className="rounded-xl"><Download className="mr-2 h-4 w-4" />Boletines</Button> : null}</div></div>
    <Card className="rounded-2xl border-0 bg-white/85 shadow-[0_12px_34px_rgba(29,78,137,0.07)]"><CardContent className="grid gap-3 p-4 md:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Curso<select value={selected.course?.id ?? ""} onChange={event => { setCourseId(Number(event.target.value)); setSubjectId(undefined); }} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="">Seleccionar curso</option>{context.courses.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Materia<select value={selected.subject?.id ?? ""} onChange={event => setSubjectId(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="">Seleccionar materia</option>{context.subjects.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Periodo<select value={selected.period?.id ?? ""} onChange={event => setPeriodId(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="">Seleccionar periodo</option>{context.periods.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></CardContent></Card>
    {showAssessmentForm ? <Card className="rounded-2xl border-[var(--edc-accent)] bg-[var(--edc-secondary)]/40"><CardHeader><CardTitle className="text-base">Nueva evaluación <span className="ml-2 text-xs font-normal text-slate-500">{selected.course?.name} · {selected.subject?.name} · {selected.period?.name}</span></CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="Título de evaluación" placeholder="Título" value={newAssessment.title} onChange={event => setNewAssessment({ ...newAssessment, title: event.target.value })} /><select value={newAssessment.type} onChange={event => setNewAssessment({ ...newAssessment, type: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="ACTIVIDAD">Actividad</option><option value="QUIZ">Quiz</option><option value="TALLER">Taller</option><option value="EXAMEN">Examen</option><option value="PROYECTO">Proyecto</option></select><Input aria-label="Peso" type="number" min="0" max="100" value={newAssessment.weight} onChange={event => setNewAssessment({ ...newAssessment, weight: event.target.value })} placeholder="Peso %" /><Input aria-label="Fecha" type="date" value={newAssessment.date} onChange={event => setNewAssessment({ ...newAssessment, date: event.target.value })} /><div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button onClick={createNewAssessment} disabled={createAssessment.isPending || !newAssessment.title.trim()} className="rounded-xl bg-[var(--edc-primary)]">Crear borrador</Button><Button variant="ghost" onClick={() => setShowAssessmentForm(false)} className="rounded-xl">Cancelar</Button></div></CardContent></Card> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Promedio del curso" value={context.stats.average === null ? "—" : context.stats.average.toFixed(2)} detail="Sobre 5.0" icon={<BarChart3 className="h-4 w-4" />} /><Metric label="Estudiantes" value={context.stats.students} detail="Matrículas autorizadas" icon={<Users className="h-4 w-4" />} /><Metric label="Evaluaciones" value={context.stats.assessments} detail={`${weightTotal}% de peso acumulado`} icon={<FileText className="h-4 w-4" />} /><Metric label="Completitud" value={`${context.stats.completion}%`} detail={`${context.stats.graded}/${context.stats.total} calificaciones`} icon={<Check className="h-4 w-4" />} />{weightTotal > 100 ? <p className="text-xs font-medium text-amber-700 sm:col-span-2 xl:col-span-4">El peso acumulado supera 100%. Puedes seguir diseñando, pero corrígelo antes de cerrar resultados.</p> : null}</div>
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Card className="min-w-0 rounded-2xl border-0 shadow-[0_12px_34px_rgba(29,78,137,0.07)]"><CardHeader className="gap-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle className="text-base">Calificador</CardTitle><p className="mt-1 text-xs text-slate-400">{selected.course?.name} · {selected.subject?.name} · {selected.period?.name} · {selected.course?.year}</p></div>{canWrite ? <Button onClick={saveAll} disabled={saveGrades.isPending} size="sm" className="rounded-xl bg-[var(--edc-primary)]">{saveGrades.isPending ? "Guardando…" : "Guardar cambios"}</Button> : null}</div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="rounded-xl pl-9" aria-label="Buscar estudiante" placeholder="Buscar estudiante" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="flex items-center gap-2 overflow-x-auto"><Filter className="h-4 w-4 shrink-0 text-slate-400" />{[["ALL", "Todos"], ["PENDING", "Sin calificar"], ["LOW", "< 3.0"], ["MID", "3.0–4.0"], ["HIGH", "4.0+"], ["COMMENT", "Comentario"]].map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filter === key ? "bg-[var(--edc-secondary)] text-[var(--edc-primary)]" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>{label}</button>)}</div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400"><th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3">Estudiante</th>{context.assessments.map((assessment: any) => <th key={assessment.id} className="px-3 py-3 text-center"><div className="normal-case tracking-normal text-slate-600">{assessment.title}</div><div className="mt-1 font-normal">{assessment.weight}% · {assessmentLabels[assessment.assessmentType] ?? assessment.assessmentType}</div></th>)}<th className="px-3 py-3 text-center">Promedio</th></tr></thead><tbody>{filteredRows.map((row: any) => { const name = row.student?.name ?? `${row.student?.firstName ?? ""} ${row.student?.lastName ?? ""}`.trim(); return <tr key={row.enrollment.id} className="group border-b border-slate-100 last:border-0 hover:bg-[var(--edc-secondary)]/30"><td className="sticky left-0 z-10 bg-white px-4 py-3"><button onClick={() => setSelectedStudent(row.enrollment.studentUserId)} className="text-left font-semibold text-slate-700 hover:text-[var(--edc-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--edc-accent)]">{name}</button><p className="mt-0.5 text-[11px] text-slate-400">{row.student?.email ?? "Estudiante matriculado"}</p></td>{row.values.map((item: any) => { const key = `${item.assessment.id}:${row.enrollment.studentUserId}`; const value = Object.prototype.hasOwnProperty.call(pending, key) ? pending[key] : item.grade?.value ?? null; return <td key={item.assessment.id} className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-1"><input aria-label={`${item.assessment.title} · ${name}`} disabled={!canWrite} type="number" min="0" max={item.assessment.maxValue} step="0.1" value={value ?? ""} onChange={event => updateCell(item.assessment.id, row.enrollment.studentUserId, event.target.value)} onClick={() => setSelectedCell({ assessmentId: item.assessment.id, studentId: row.enrollment.studentUserId })} onKeyDown={event => { if (event.key === "Enter") (event.currentTarget.parentElement?.parentElement?.parentElement?.nextElementSibling?.querySelector("input") as HTMLInputElement | null)?.focus(); }} className={`h-9 w-16 rounded-lg border bg-white text-center text-sm font-semibold outline-none transition focus:border-[var(--edc-accent)] focus:ring-2 focus:ring-[var(--edc-secondary)] ${value !== null && value < 3 ? "border-rose-100 text-rose-600" : "border-slate-200 text-slate-700"}`} /><button aria-label="Ver detalle de calificación" onClick={() => setSelectedCell({ assessmentId: item.assessment.id, studentId: row.enrollment.studentUserId })} className="rounded-md p-1 text-slate-300 opacity-0 transition hover:text-[var(--edc-primary)] group-hover:opacity-100"><ChevronDown className="h-3 w-3" /></button></div></td>; })}<td className={`px-3 py-3 text-center text-base font-semibold ${row.average !== null && row.average < 3 ? "text-rose-500" : "text-slate-800"}`}>{numberValue(row.average)}</td></tr>; })}</tbody></table></div>{!filteredRows.length ? <div className="p-8"><p className="text-center text-sm text-slate-500">No hay estudiantes con este filtro.</p></div> : null}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-400"><span>{pendingCount} calificaciones pendientes</span>{canWrite ? <span className="inline-flex items-center gap-1"><Undo2 className="h-3 w-3" />Los cambios quedan locales hasta guardar</span> : <span>Vista protegida de solo lectura</span>}</div></CardContent></Card>
      <aside className="space-y-5"><Card className="rounded-2xl border-0 bg-[var(--edc-secondary)]/55 shadow-none"><CardHeader><CardTitle className="text-base">Resumen del curso</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><SummaryRow label="Promedio" value={numberValue(context.stats.average)} /><SummaryRow label="Máximo" value={numberValue(context.stats.max)} /><SummaryRow label="Mínimo" value={numberValue(context.stats.min)} /><SummaryRow label="Pendientes" value={String(pendingCount)} /><div className="pt-2"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Progreso</span><span>{context.stats.completion}%</span></div><div className="h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-[var(--edc-accent)] transition-all" style={{ width: `${context.stats.completion}%` }} /></div></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-[0_12px_34px_rgba(29,78,137,0.07)]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-[var(--edc-accent)]" />EduCore Insights</CardTitle></CardHeader><CardContent className="space-y-3">{context.insights.length ? context.insights.map((item: string) => <p key={item} className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{item}</p>) : <p className="text-xs text-slate-400">Aún no hay suficientes datos para generar insights.</p>}</CardContent></Card><Card className="rounded-2xl border-0 shadow-[0_12px_34px_rgba(29,78,137,0.07)]"><CardHeader><CardTitle className="text-base">Distribución</CardTitle></CardHeader><CardContent className="space-y-2">{context.distribution.map((item: any) => <div key={item.label} className="flex items-center gap-2 text-xs"><span className="w-16 text-slate-500">{item.label}</span><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[var(--edc-accent)]" style={{ width: `${context.stats.graded ? Math.max(4, item.count / context.stats.graded * 100) : 0}%` }} /></div><span className="w-5 text-right text-slate-400">{item.count}</span></div>)}</CardContent></Card></aside>
    </div>
    {selectedCellData ? <Card className="rounded-2xl border-[var(--edc-accent)] bg-white shadow-[0_18px_48px_rgba(29,78,137,0.12)]"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr_1fr]"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--edc-accent)]">Quick student popover</p><h3 className="mt-2 text-lg font-semibold text-slate-800">{selectedRow?.student?.name}</h3><p className="text-xs text-slate-500">{selected.course?.name} · {selected.subject?.name}</p><p className="mt-4 text-sm font-medium text-slate-600">{selectedCellData.assessment.title}</p><p className="mt-1 text-3xl font-semibold text-slate-900">{numberValue(pending[`${selectedCellData.assessment.id}:${selectedCell!.studentId}`])} <span className="text-sm font-normal text-slate-400">/ {selectedCellData.assessment.maxValue}</span></p></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="text-xs font-semibold text-slate-500">Rendimiento visible</p><p className="mt-3 flex justify-between"><span>Promedio materia</span><strong>{numberValue(selectedRow?.average)}</strong></p><p className="mt-2 flex justify-between"><span>Últimas notas</span><strong>{(selectedRow?.values ?? []).map((item: any) => numberValue(pending[`${item.assessment.id}:${selectedRow?.enrollment.studentUserId}`])).join(" · ")}</strong></p><p className="mt-2 text-xs text-slate-500">{selectedCellData.grade?.comment ?? "Sin comentario registrado."}</p></div><div className="space-y-2"><p className="text-xs font-semibold text-slate-500">Observación</p><Textarea value={observationDraft} onChange={event => setObservationDraft(event.target.value)} placeholder="Agregar comentario o generar un borrador…" className="min-h-24 rounded-xl" /><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={draftObservation} disabled={generateDraft.isPending} className="rounded-xl"><Sparkles className="mr-1 h-3 w-3" />{generateDraft.isPending ? "Generando…" : "Generar borrador"}</Button>{observationDraft ? <Button size="sm" onClick={saveDraft} className="rounded-xl bg-[var(--edc-primary)]">Guardar borrador</Button> : null}</div></div></CardContent></Card> : null}
    {selectedStudent && !selectedCell ? <Card className="rounded-2xl border-[var(--edc-accent)]"><CardContent className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--edc-accent)]">Quick academic profile</p><h3 className="mt-2 text-lg font-semibold">{selectedStudentName}</h3><p className="text-sm text-slate-500">{selected.course?.name} · Promedio {numberValue(selectedRow?.average)}</p></div><Button variant="outline" onClick={() => setSelectedStudent(null)} className="rounded-xl">Cerrar</Button></div></CardContent></Card> : null}
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) { return <Card className="rounded-2xl border-0 shadow-[0_8px_30px_rgba(29,78,137,0.06)]"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className="rounded-xl bg-[var(--edc-secondary)] p-2 text-[var(--edc-primary)]">{icon}</div></CardContent></Card>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-white/80 pb-2 text-slate-600 last:border-0"><span>{label}</span><strong className="text-slate-800">{value}</strong></div>; }

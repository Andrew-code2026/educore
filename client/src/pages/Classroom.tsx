import React, { useState } from 'react';
import { ClassroomWorkspace } from '@/classroom/ClassroomWorkspace';
import type { EduRole, Section } from '@/components/shell';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Clock3,
  FileText,
  Plus,
  Send,
  Sparkles,
  Upload,
  X,
  History,
  RotateCcw,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';

export interface ClassroomPageProps {
  data: any;
  role: EduRole;
  onChanged: () => void;
  setSection: (s: Section) => void;
}

const formatDate = (
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
) =>
  value
    ? new Date(value).toLocaleDateString('es-CO', options ?? { day: 'numeric', month: 'short' })
    : '—';

const formatDateTime = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('es-CO', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export function ClassroomPage({ data, role, onChanged, setSection }: ClassroomPageProps) {
  // Mecanismo de reversibilidad instantánea hacia la versión previa (Legacy)
  const [useLegacy, setUseLegacy] = useState<boolean>(() => {
    try {
      return localStorage.getItem('educore_classroom_version') === 'legacy';
    } catch {
      return false;
    }
  });

  const toggleLegacy = (legacy: boolean) => {
    setUseLegacy(legacy);
    try {
      localStorage.setItem('educore_classroom_version', legacy ? 'legacy' : 'next');
    } catch {}
  };

  if (useLegacy) {
    return (
      <ClassroomLegacyPage
        data={data}
        role={role}
        onChanged={onChanged}
        setSection={setSection}
        onSwitchToNext={() => toggleLegacy(false)}
      />
    );
  }

  return (
    <ClassroomWorkspace
      data={data}
      role={role}
      onChanged={onChanged}
      onNavigateSection={setSection}
    />
  );
}

// Versión Legacy para garantizar compatibilidad y reversibilidad 100%
function ClassroomLegacyPage({
  data,
  role,
  onChanged,
  setSection,
  onSwitchToNext,
}: {
  data: any;
  role: EduRole;
  onChanged: () => void;
  setSection: (s: Section) => void;
  onSwitchToNext: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Matemáticas');
  const [course, setCourse] = useState('11-2');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState(() => new Date().toISOString().slice(0, 16));

  const createMutation = trpc.educore.createAssignment.useMutation({
    onSuccess: () => {
      toast.success('Tarea creada y publicada');
      setShowCreate(false);
      setTitle('');
      setDescription('');
      onChanged();
    },
  });

  const submitMutation = trpc.educore.submitAssignment.useMutation({
    onSuccess: () => {
      toast.success('Entrega enviada');
      setSelectedAssignment(null);
      onChanged();
    },
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
            <History className="h-3 w-3 mr-1" /> Modo Legacy
          </Badge>
          <span className="text-xs text-slate-500">
            Estás visualizando la versión anterior de Classroom.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onSwitchToNext} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Volver a ClassCORE Moderno
        </Button>
      </div>

      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--edc-accent)]">
            EduCore Classroom Legacy
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">
            Aprender también es entregar.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Diseña actividades, acompaña el proceso y mantén cada evidencia en contexto.
          </p>
        </div>
        {role === 'admin' || role === 'teacher' ? (
          <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-[var(--edc-primary)]">
            <Plus className="mr-2 h-4 w-4" />
            Crear tarea
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.assignments.map((assignment: any) => {
          const submission = data.submissions.find(
            (item: any) => item.assignmentId === assignment.id
          );
          return (
            <Card
              key={assignment.id}
              className="border-0 shadow-[0_8px_30px_rgba(29,78,137,0.06)] rounded-2xl transition hover:-translate-y-0.5"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--edc-secondary)] text-[var(--edc-accent)]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{assignment.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {assignment.subject} · {assignment.course}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {submission?.grade ? 'Calificada' : submission?.status ?? assignment.status}
                  </Badge>
                </div>
                <p className="mt-5 line-clamp-2 text-sm leading-6 text-slate-500">
                  {assignment.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(assignment.dueAt)}
                    </span>
                    <span>{assignment.points} puntos</span>
                  </div>
                  {role === 'student' || role === 'guardian' ? (
                    <Button
                      onClick={() => setSelectedAssignment(assignment)}
                      size="sm"
                      className="rounded-lg bg-[var(--edc-primary)]"
                    >
                      {submission ? 'Ver entrega' : 'Entregar'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setSelectedAssignment(assignment)}
                      size="sm"
                      variant="outline"
                      className="rounded-lg bg-white"
                    >
                      Ver entregas <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <Card
            className="flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] w-full max-w-xl border-0 shadow-2xl rounded-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between shrink-0">
              <div>
                <CardTitle>Crear tarea</CardTitle>
                <p className="mt-1 text-xs text-slate-400">
                  Publica una actividad para que tus estudiantes puedan verla y entregar.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Título
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Taller de derivadas"
                  className="mt-2"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Materia
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option>Matemáticas</option>
                    <option>Física</option>
                    <option>Filosofía</option>
                    <option>Inglés</option>
                    <option>Biología</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Curso
                  <select
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option>11-2</option>
                    <option>11-1</option>
                    <option>10-1</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Instrucciones
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explica lo que deben realizar..."
                  className="mt-2 min-h-28"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Fecha de entrega
                  <Input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    className="mt-2"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Puntuación
                  <Input type="number" defaultValue={100} className="mt-2" />
                </label>
              </div>
              <Button
                disabled={!title || !description || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    role,
                    title,
                    subject,
                    course,
                    description,
                    dueAt: new Date(dueAt),
                    points: 100,
                    teacherName: 'Laura Gómez',
                  })
                }
                className="w-full rounded-xl bg-[var(--edc-primary)]"
              >
                {createMutation.isPending ? 'Guardando...' : 'Publicar tarea'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selectedAssignment ? (
        <LegacySubmissionModal
          assignment={selectedAssignment}
          role={role}
          data={data}
          onClose={() => setSelectedAssignment(null)}
          onSubmit={(fileName, comment) =>
            submitMutation.mutate({
              role,
              assignmentId: selectedAssignment.id,
              studentName: 'Sofía Martínez',
              fileName,
              comment,
            })
          }
        />
      ) : null}
    </>
  );
}

function LegacySubmissionModal({
  assignment,
  role,
  data,
  onClose,
  onSubmit,
}: {
  assignment: any;
  role: EduRole;
  data: any;
  onClose: () => void;
  onSubmit: (fileName: string, comment: string) => void;
}) {
  const existing = data.submissions.find((item: any) => item.assignmentId === assignment.id);
  const [fileName, setFileName] = useState(existing?.fileName ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] w-full max-w-lg border-0 shadow-2xl rounded-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between shrink-0">
          <div>
            <CardTitle>{assignment.title}</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              {assignment.subject} · Entrega {formatDate(assignment.dueAt)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Instrucciones
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{assignment.description}</p>
          </div>
          {role === 'student' || role === 'guardian' ? (
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Archivo de entrega
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                    placeholder="Selecciona o escribe un archivo"
                  />
                  <button
                    onClick={() => setFileName('taller-derivadas-sofia.pdf')}
                    className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Upload className="h-4 w-4" />
                    Adjuntar
                  </button>
                </div>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Comentario
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Agrega una nota para tu docente..."
                  className="mt-2"
                />
              </label>
              <Button
                disabled={!fileName}
                onClick={() => onSubmit(fileName, comment)}
                className="w-full rounded-xl bg-[var(--edc-primary)]"
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar entrega
              </Button>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Entregas recibidas
              </p>
              {data.submissions
                .filter((item: any) => item.assignmentId === assignment.id)
                .map((submission: any) => (
                  <div
                    key={submission.id}
                    className="mt-3 flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--edc-secondary)] text-[var(--edc-accent)]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{submission.studentName}</p>
                      <p className="text-xs text-slate-400">
                        {submission.fileName} · {formatDateTime(submission.submittedAt)}
                      </p>
                    </div>
                    {submission.grade ? (
                      <span className="font-semibold text-emerald-600">
                        {submission.grade.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Por calificar</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ClassroomPage;

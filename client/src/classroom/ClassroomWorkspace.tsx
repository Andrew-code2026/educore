import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useOptionalShellContext } from '@/components/shell/ShellContext';
import { trpc } from '@/lib/trpc';
import { toast as sonnerToast } from 'sonner';

import type {
  Activity,
  CourseSummary,
  Draft,
  ReviewRecord,
  Student,
  Upload,
  ViewKey,
} from './types';
import {
  adaptEduCoreActivities,
  adaptEduCoreCourses,
  adaptEduCoreStudents,
  defaultResources,
  defaultRubric,
  emptyActivity,
  emptyStudent,
  formatDateShort,
} from './adapter';

import { ClasscoreHero } from './components/ClasscoreHero';
import { CourseGrid } from './components/CourseGrid';
import { CourseHeader } from './components/CourseHeader';
import { OverviewView } from './components/OverviewView';
import { ActivitiesView } from './components/ActivitiesView';
import { SubmissionsView } from './components/SubmissionsView';
import { ReviewSplitView } from './components/ReviewSplitView';
import { ResourcesView } from './components/ResourcesView';
import { ActivityDrawer } from './components/ActivityDrawer';
import { StudentPreviewModal } from './components/StudentPreviewModal';
import { Icon } from './components/SharedUI';
import { ClassroomLanding } from './landing/ClassroomLanding';
import type { ActivityFilter, ActivitySort } from './course/activities';
import type { SubmissionFilter } from './course/submissions';
import { activePeriod, type PendingReview } from './landing/courses';

import './classroom.css';

export interface ClassroomWorkspaceProps {
  data: any;
  role: 'admin' | 'teacher' | 'student' | 'guardian';
  onChanged: () => void;
  onNavigateSection?: (section: any) => void;
  initialCourseId?: string;
}

/** Actividad con la que abre la pestaña Entregas: la primera con entregas por calificar, si hay. */
const defaultActivity = (list: Activity[]): Activity =>
  list.find((a) => a.submissions > a.graded) ?? list[0] ?? emptyActivity;

export function ClassroomWorkspace({
  data,
  role,
  onChanged,
  onNavigateSection,
  initialCourseId,
}: ClassroomWorkspaceProps) {
  const { theme, toggleTheme } = useTheme();
  const shellContext = useOptionalShellContext();

  // 1. Adapta cursos de EduCore
  const courses = useMemo(() => adaptEduCoreCourses(data), [data]);
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary>(() => {
    if (initialCourseId) {
      const match = courses.find((c) => c.id === initialCourseId || c.code === initialCourseId);
      if (match) return match;
    }
    return courses[0] || {
      id: 'course-11-2',
      code: '11-2-2026',
      name: 'Curso 11-2',
      students: 32,
      active: 4,
      review: 2,
      next: '28 Oct',
      icon: 'book',
      tone: 'science',
      subject: 'Biología y Ciencias Naturales',
    };
  });

  // 2. Adapta actividades para el curso actual
  const rawActivities = useMemo(
    () => adaptEduCoreActivities(data, selectedCourse?.name),
    [data, selectedCourse]
  );
  const [activities, setActivities] = useState<Activity[]>(rawActivities);

  useEffect(() => {
    setActivities(rawActivities);
  }, [rawActivities]);

  const [selectedActivity, setSelectedActivity] = useState<Activity>(
    defaultActivity(activities)
  );

  // Mantiene la actividad elegida al día cuando llegan datos nuevos (p. ej. tras calificar)
  useEffect(() => {
    const fresh = activities.find((a) => a.id === selectedActivity.id);
    if (fresh) {
      if (fresh !== selectedActivity) setSelectedActivity(fresh);
    } else {
      // Sin coincidencia (otro curso o curso vacío): nunca se conserva una actividad ajena
      setSelectedActivity(defaultActivity(activities));
    }
  }, [activities, selectedActivity]);

  // 3. Adapta estudiantes para la actividad seleccionada
  const rawStudents = useMemo(
    () => adaptEduCoreStudents(data, selectedActivity?.id, selectedCourse?.name),
    [data, selectedActivity, selectedCourse]
  );

  // 4. Estados de navegación interna
  const [view, setView] = useState<ViewKey>('home');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('Todas');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<ActivitySort>('fecha');
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('Todos');

  // 5. Modales y drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  // Entrega elegida desde la portada; se resuelve cuando la actividad y sus entregas están cargadas
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploaded, setUploaded] = useState<Upload[]>([]);
  const [deliverySent, setDeliverySent] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 6. Calificaciones locales y registros de revisión
  const [reviewRecords, setReviewRecords] = useState<Record<string, ReviewRecord>>({});

  // 7. Creador de actividad
  const [draft, setDraft] = useState<Draft>({
    name: '',
    description: '',
    due: '2026-10-28',
    publish: '2026-10-21',
    maxFiles: 2,
    maxSize: '25 MB',
    formats: ['PDF', 'DOCX', 'ZIP'],
    graded: true,
    gradeCenter: true,
    weight: '20%',
    allowReplacement: true,
    allowResubmission: true,
    subject: selectedCourse?.subject || 'Biología',
    course: selectedCourse?.name || '11-2',
  });

  // Mutaciones de tRPC con persistencia real en EduCore
  const createAssignmentMutation = trpc.educore.createAssignment.useMutation({
    onSuccess: (newAssignment: any) => {
      sonnerToast.success('Actividad guardada y registrada en EduCore');
      setToastMessage('Actividad publicada en ClassCORE');
      setDrawerOpen(false);
      onChanged();
    },
    onError: (err: any) => {
      sonnerToast.error(err.message || 'Error al guardar la actividad');
    },
  });

  // El calificador avisa del resultado y refresca una sola vez al terminar ambas mutaciones
  const gradeSubmissionMutation = trpc.educore.gradeSubmission.useMutation();
  const updateGradeMutation = trpc.educore.updateGrade.useMutation();

  const submitAssignmentMutation = trpc.educore.submitAssignment.useMutation({
    onSuccess: () => {
      sonnerToast.success('Entrega enviada exitosamente al servidor');
      onChanged();
    },
  });

  // KPIs de curso
  const courseStats = useMemo(
    () => ({
      active: activities.filter((a) =>
        ['Publicada', 'En curso', 'Por revisar'].includes(a.status)
      ).length,
      review: activities.reduce(
        (sum, a) => sum + Math.max(0, a.submissions - a.graded),
        0
      ),
      upcoming: activities.filter((a) =>
        ['Próxima', 'En curso', 'Publicada'].includes(a.status)
      ).length,
      drafts: activities.filter((a) => a.status === 'Borrador').length,
    }),
    [activities]
  );

  // Lista de entregas combinada con registros de revisión
  const submissions = useMemo(() => {
    return rawStudents.map((student) => {
      const record = reviewRecords[`${selectedActivity.id}:${student.id}`];
      if (record) {
        return { ...student, status: record.status, score: record.score };
      }
      return student;
    });
  }, [rawStudents, selectedActivity.id, reviewRecords]);

  // Estudiante en revisión actual
  const currentStudent =
    reviewIndex === null ? emptyStudent : submissions[reviewIndex] ?? emptyStudent;
  const currentReviewKey = `${selectedActivity.id}:${currentStudent.id}`;

  const makeDefaultReviewRecord = (st: Student): ReviewRecord => ({
    score: st.status === 'Calificada' ? st.score : undefined,
    scoreMode: 'manual',
    evaluationMode: 'direct',
    // La rúbrica arranca en cero: no hay puntajes por criterio guardados en el servidor
    criteria: defaultRubric.map((item) => ({ ...item, score: 0 })),
    // En entregas sin calificar el comentario guardado es la nota del estudiante, no retroalimentación
    feedback: st.status === 'Calificada' ? st.comment ?? '' : '',
    status: st.status,
  });

  const currentRecord = reviewRecords[currentReviewKey] ?? makeDefaultReviewRecord(currentStudent);

  const updateCurrentRecord = (patch: Partial<ReviewRecord>) => {
    setReviewRecords((records) => {
      const base = records[currentReviewKey] ?? currentRecord;
      return { ...records, [currentReviewKey]: { ...base, ...patch } };
    });
  };

  const handleSaveGrade = async (student: Student, finalScore: number, comment: string) => {
    try {
      if (student.submissionId) {
        await gradeSubmissionMutation.mutateAsync({
          role,
          submissionId: student.submissionId,
          grade: finalScore,
          comment,
        });
      }

      // Libreta del Grade Center: periodo activo y asignatura de la actividad, no valores fijos
      const period = activePeriod(data);
      const subject = selectedActivity.subject || selectedCourse.subject;
      if (period && subject) {
        await updateGradeMutation.mutateAsync({
          role,
          studentName: student.name,
          course: selectedCourse.name.replace(/^Curso\s*/i, ''),
          subject,
          period,
          value: finalScore,
        });
      }

      onChanged();
      sonnerToast.success(`Nota ${finalScore.toFixed(1)} guardada para ${student.name}`);
      return true;
    } catch (err: any) {
      console.error('Error al guardar la calificación:', err);
      sonnerToast.error('No se pudo guardar la nota. Revisa tu conexión e intenta de nuevo.');
      return false;
    }
  };


  // Temporizador para toasts visuales internos
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Escape listener para cerrar drawers
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setPreviewOpen(false);
        setReviewIndex(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Navegación entre vistas
  const handleSelectCourse = (course: CourseSummary) => {
    setSelectedCourse(course);
    setView('overview');
  };

  // Acciones de la portada docente (callbacks estables para las tarjetas memoizadas)
  const handleEnterCourse = useCallback(
    (courseId: string) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      setSelectedCourse(course);
      setView('overview');
    },
    [courses]
  );

  const handleCreateFromLanding = useCallback(
    (courseId: string) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      setSelectedCourse(course);
      setView('activities');
      setDraft((d) => ({ ...d, course: course.name, subject: course.subject || d.subject }));
      setDrawerOpen(true);
    },
    [courses]
  );

  const handleReviewFromLanding = useCallback(
    (item: PendingReview) => {
      const course = courses.find((c) => c.id === item.courseId);
      if (!course) return;
      setSelectedCourse(course);
      setReviewIndex(null);
      setView('submissions');
      setPendingReview(item);
    },
    [courses]
  );

  useEffect(() => {
    if (!pendingReview) return;
    const target = activities.find((a) => a.id === String(pendingReview.assignmentId));
    if (!target) return;
    if (selectedActivity.id !== target.id) {
      setSelectedActivity(target);
      return;
    }
    const index = submissions.findIndex((s) => s.name === pendingReview.studentName);
    if (index >= 0) setReviewIndex(index);
    setPendingReview(null);
  }, [pendingReview, activities, selectedActivity.id, submissions]);

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setView('submissions');
    setReviewIndex(null);
  };

  const handleReviewActivity = (activity: Activity) => {
    setSubmissionFilter('Por revisar');
    handleSelectActivity(activity);
  };

  // Creación y publicación de actividad
  const handleCreateActivity = (publish: boolean) => {
    const name = draft.name.trim() || 'Nueva actividad';
    const cleanCourseName = selectedCourse.name.replace(/^Curso\s*/i, '');
    // Fecha local a las 23:59; un 'AAAA-MM-DD' suelto se interpreta en UTC y cae el día anterior
    const dueAt = new Date(`${draft.due || '2026-10-28'}T23:59:00`);

    // Mutación al backend de EduCore
    createAssignmentMutation.mutate({
      role,
      title: name,
      subject: draft.subject || selectedCourse.subject || 'Biología',
      course: cleanCourseName,
      description:
        draft.description.trim() ||
        'Actividad con entrega digital y evidencia creada en ClassCORE.',
      dueAt,
      points: draft.graded ? 100 : 0,
      teacherName: 'Laura Gómez',
    });

    // Actualización optimista en UI local
    const id = `local-${Date.now()}`;
    const dateFormatted = formatDateShort(dueAt);
    const newAct: Activity = {
      ...emptyActivity,
      id,
      name,
      description:
        draft.description.trim() ||
        'Actividad con entrega digital y evidencia creada en ClassCORE.',
      date: dateFormatted,
      dueDate: `${dateFormatted} · 23:59`,
      dueAt: dueAt.toISOString(),
      submissions: 0,
      graded: 0,
      status: publish ? 'Publicada' : 'Borrador',
      affectsGradeCenter: draft.gradeCenter,
      weight: draft.weight || '20%',
      formats: draft.formats,
      maxFiles: draft.maxFiles,
      maxSize: draft.maxSize,
      allowReplacement: draft.allowReplacement,
      allowResubmission: draft.allowResubmission,
      course: cleanCourseName,
      subject: draft.subject || selectedCourse.subject || 'Biología',
    };

    setActivities((prev) => [newAct, ...prev]);
    setSelectedActivity(newAct);
    setDraft((d) => ({ ...d, name: '', description: '' }));
  };

  // Simulación y validación de archivos de estudiante
  const acceptFile = (file: File) => {
    const format = file.name.split('.').pop()?.toUpperCase() ?? '';
    const size = `${(file.size / 1024 / 1024).toFixed(1)} MB`;

    if (!selectedActivity.formats.includes(format)) {
      setUploadError(
        `Formato .${format.toLowerCase()} no permitido. Usa ${selectedActivity.formats.join(', ')}.`
      );
      return;
    }
    const maxBytes = parseInt(selectedActivity.maxSize, 10) * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`El archivo supera el máximo permitido de ${selectedActivity.maxSize}.`);
      return;
    }

    setUploadError('');
    setUploaded((items) =>
      selectedActivity.maxFiles > items.length
        ? [...items, { name: file.name, format, size, progress: 0 }]
        : [{ name: file.name, format, size, progress: 0 }]
    );

    window.setTimeout(() => {
      setUploaded((items) => items.map((item) => ({ ...item, progress: 100 })));
    }, 400);
  };

  const sendDelivery = () => {
    if (!uploaded.length) {
      setUploadError('Selecciona un archivo antes de enviar.');
      return;
    }

    // Si es estudiante real o prueba, enviamos al backend
    if (selectedActivity.id && !selectedActivity.id.startsWith('local-')) {
      submitAssignmentMutation.mutate({
        role,
        assignmentId: Number(selectedActivity.id),
        studentName: 'Sofía Martínez',
        fileName: uploaded[0].name,
        comment: 'Entrega enviada desde la interfaz ClassCORE',
      });
    }

    setDeliverySent(true);
    setToastMessage('Entrega enviada correctamente');
  };

  const isDarkMode = theme === 'dark';
  const periodLabel = activePeriod(data) ?? data?.academicPeriods?.[0]?.name ?? 'Periodo académico';
  const canManage = role === 'teacher' || role === 'admin';
  const showTeacherLanding = view === 'home' && canManage;

  return (
    <div
      className={`classcore-workspace app-frame ${
        isDarkMode ? 'dark-mode' : 'light-mode'
      }`}
      data-screen={showTeacherLanding ? 'landing' : view === 'home' ? undefined : 'course'}
    >
      <div className="main-panel w-full flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {showTeacherLanding ? (
          <ClassroomLanding
            data={data}
            onEnterCourse={handleEnterCourse}
            onCreateActivity={handleCreateFromLanding}
            onReview={handleReviewFromLanding}
          />
        ) : view === 'home' ? (
          <div className="home-content">
            <ClasscoreHero
              schoolName={data?.school?.name || 'EduCore'}
              academicPeriodName={periodLabel}
              coursesCount={courses.length}
              reviewCount={courseStats.review}
              upcomingCount={courseStats.upcoming}
              draftsCount={courseStats.drafts}
            />
            <CourseGrid courses={courses} onSelectCourse={handleSelectCourse} />
          </div>
        ) : (
          <>
            <CourseHeader
              course={selectedCourse}
              view={view}
              onNavigate={setView}
              onBackToCourses={() => setView('home')}
              onNewActivity={() => setDrawerOpen(true)}
              reviewCount={courseStats.review}
              canManage={canManage}
            />

            <div className="content-area">
              {view === 'overview' && (
                <OverviewView
                  activities={activities}
                  totalStudents={selectedCourse.students}
                  onOpenActivity={handleSelectActivity}
                  onReview={handleReviewActivity}
                  onNewActivity={canManage ? () => setDrawerOpen(true) : undefined}
                />
              )}

              {view === 'activities' && (
                <ActivitiesView
                  activities={activities}
                  filter={activityFilter}
                  setFilter={setActivityFilter}
                  query={query}
                  setQuery={setQuery}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  selectActivity={handleSelectActivity}
                  totalStudents={selectedCourse.students}
                  onNewActivity={canManage ? () => setDrawerOpen(true) : undefined}
                />
              )}

              {view === 'submissions' && (
                <>
                  {reviewIndex !== null ? (
                    <ReviewSplitView
                      activity={selectedActivity}
                      students={submissions}
                      index={reviewIndex}
                      setIndex={setReviewIndex}
                      record={currentRecord}
                      onRecordChange={updateCurrentRecord}
                      onSaveGrade={handleSaveGrade}
                      onBack={() => setReviewIndex(null)}
                      isShellFocusMode={shellContext?.isFocusMode}
                      onToggleShellFocus={(f) => shellContext?.setIsFocusMode(f)}
                    />
                  ) : (
                    <SubmissionsView
                      // Al cambiar de actividad se reinicia la búsqueda local
                      key={selectedActivity.id}
                      activity={selectedActivity}
                      activities={activities}
                      onSelectActivity={setSelectedActivity}
                      students={submissions}
                      filter={submissionFilter}
                      setFilter={setSubmissionFilter}
                      onOpenGrader={(idx) => setReviewIndex(idx)}
                      onPreview={() => {
                        setDeliverySent(false);
                        setUploaded([]);
                        setPreviewOpen(true);
                      }}
                    />
                  )}
                </>
              )}

              {view === 'resources' && (
                <ResourcesView
                  resources={defaultResources}
                  onAddResource={
                    canManage
                      ? () => sonnerToast.info('Añadir recurso vinculado a actividad')
                      : undefined
                  }
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawer de Nueva Actividad */}
      {drawerOpen && (
        <ActivityDrawer
          draft={draft}
          setDraft={setDraft}
          onClose={() => setDrawerOpen(false)}
          onSave={() => handleCreateActivity(false)}
          onPublish={() => handleCreateActivity(true)}
          isPending={createAssignmentMutation.isPending}
        />
      )}

      {/* Drawer de Previsualización de Estudiante */}
      {previewOpen && (
        <StudentPreviewModal
          activity={selectedActivity}
          uploaded={uploaded}
          error={uploadError}
          sent={deliverySent}
          onClose={() => setPreviewOpen(false)}
          onFile={acceptFile}
          onSend={sendDelivery}
          onRemove={(idx) => setUploaded((items) => items.filter((_, i) => i !== idx))}
        />
      )}

      {/* Toast visual integrado de ClassCORE */}
      {toastMessage && (
        <div className="toast">
          <span>
            <Icon name="check" size={13} />
          </span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
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

import './classroom.css';

export interface ClassroomWorkspaceProps {
  data: any;
  role: 'admin' | 'teacher' | 'student' | 'guardian';
  onChanged: () => void;
  onNavigateSection?: (section: any) => void;
  initialCourseId?: string;
}

const dateValue = (dateStr: string) => {
  const monthIndex: Record<string, number> = {
    Ene: 0,
    Feb: 1,
    Mar: 2,
    Abr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Ago: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dic: 11,
  };
  const parts = dateStr.split(' ');
  const day = Number(parts[0]) || 1;
  const month = parts[1] || 'Oct';
  return new Date(2026, monthIndex[month] ?? 9, day).getTime();
};

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
    activities[0] ?? emptyActivity
  );

  useEffect(() => {
    if (activities.length > 0 && (!selectedActivity.id || !activities.some(a => a.id === selectedActivity.id))) {
      setSelectedActivity(activities[0]);
    }
  }, [activities, selectedActivity]);

  // 3. Adapta estudiantes para la actividad seleccionada
  const rawStudents = useMemo(
    () => adaptEduCoreStudents(data, selectedActivity?.id, selectedCourse?.name),
    [data, selectedActivity, selectedCourse]
  );

  // 4. Estados de navegación interna
  const [view, setView] = useState<ViewKey>('home');
  const [activityFilter, setActivityFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('fecha');
  const [submissionFilter, setSubmissionFilter] = useState('Todos');

  // 5. Modales y drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
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

  const gradeSubmissionMutation = trpc.educore.gradeSubmission.useMutation({
    onSuccess: () => {
      sonnerToast.success('Calificación guardada y sincronizada');
      onChanged();
    },
  });

  const updateGradeMutation = trpc.educore.updateGrade.useMutation({
    onSuccess: () => {
      onChanged();
    },
  });

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
      upcoming: activities.filter((a) => a.status === 'Próxima').length,
      drafts: activities.filter((a) => a.status === 'Borrador').length,
    }),
    [activities]
  );

  // Filtrado de actividades
  const filteredActivities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = activities.filter((a) => {
      const textMatch =
        !q || `${a.name} ${a.type} ${a.formats.join(' ')}`.toLowerCase().includes(q);
      const statusMatch =
        activityFilter === 'Todas' ||
        (activityFilter === 'Activas' &&
          ['Publicada', 'En curso', 'Por revisar'].includes(a.status)) ||
        (activityFilter === 'Por revisar' && a.status === 'Por revisar') ||
        (activityFilter === 'Próximas' && a.status === 'Próxima') ||
        (activityFilter === 'Cerradas' && a.status === 'Cerrada') ||
        (activityFilter === 'Borradores' && a.status === 'Borrador');
      return textMatch && statusMatch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'nombre') return a.name.localeCompare(b.name);
      if (sortBy === 'pendientes') {
        const penA = Math.max(0, a.submissions - a.graded);
        const penB = Math.max(0, b.submissions - b.graded);
        return penB - penA;
      }
      if (sortBy === 'estado') return a.status.localeCompare(b.status);
      return dateValue(a.date) - dateValue(b.date);
    });
  }, [activities, activityFilter, query, sortBy]);

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
    criteria: defaultRubric.map((item) => ({
      ...item,
      score: st.status === 'Calificada' ? item.score : 0,
      expanded: item.id === 'analysis',
    })),
    feedback: st.comment || '',
    comments: st.comment ? [st.comment] : [],
    status: st.status,
  });

  const currentRecord = reviewRecords[currentReviewKey] ?? makeDefaultReviewRecord(currentStudent);

  const updateCurrentRecord = (patch: Partial<ReviewRecord>) => {
    setReviewRecords((records) => {
      const base = records[currentReviewKey] ?? currentRecord;
      return { ...records, [currentReviewKey]: { ...base, ...patch } };
    });
  };

  const handleSaveGrade = async (
    student: Student,
    finalScore: number,
    commentText?: string
  ) => {
    try {
      // 1. Si existe submissionId registrado en BD, usamos gradeSubmission
      if (student.submissionId) {
        await gradeSubmissionMutation.mutateAsync({
          role,
          submissionId: student.submissionId,
          grade: finalScore,
          comment: commentText || 'Revisión completada en ClassCORE',
        });
      }

      // 2. Sincronizamos en la libreta general de calificaciones (grades)
      const cleanCourseName = selectedCourse.name.replace(/^Curso\s*/i, '');
      await updateGradeMutation.mutateAsync({
        role,
        studentName: student.name,
        course: cleanCourseName,
        subject: selectedCourse.subject || 'Biología',
        period: 'Periodo 2',
        value: finalScore,
      });

      sonnerToast.success(
        `Nota ${finalScore.toFixed(1)} registrada y sincronizada con Grade Center`
      );
      return true;
    } catch (err: any) {
      console.error('Error al sincronizar calificación:', err);
      sonnerToast.info(
        `Nota guardada localmente (${finalScore.toFixed(1)}). Se sincronizará al refrescar.`
      );
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

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setView('submissions');
    setReviewIndex(null);
  };

  // Creación y publicación de actividad
  const handleCreateActivity = (publish: boolean) => {
    const name = draft.name.trim() || 'Nueva actividad';
    const cleanCourseName = selectedCourse.name.replace(/^Curso\s*/i, '');

    // Mutación al backend de EduCore
    createAssignmentMutation.mutate({
      role,
      title: name,
      subject: draft.subject || selectedCourse.subject || 'Biología',
      course: cleanCourseName,
      description:
        draft.description.trim() ||
        'Actividad con entrega digital y evidencia creada en ClassCORE.',
      dueAt: new Date(draft.due || '2026-10-28T23:59:00'),
      points: draft.graded ? 100 : 0,
      teacherName: 'Laura Gómez',
    });

    // Actualización optimista en UI local
    const id = `local-${Date.now()}`;
    const dateFormatted = draft.due ? `${draft.due.slice(8, 10)} Oct` : '28 Oct';
    const newAct: Activity = {
      ...emptyActivity,
      id,
      name,
      description:
        draft.description.trim() ||
        'Actividad con entrega digital y evidencia creada en ClassCORE.',
      date: dateFormatted,
      dueDate: `${dateFormatted} · 23:59`,
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
  const periodLabel = data?.academicPeriods?.[0]?.name || 'Periodo 2 · 2026';
  const canManage = role === 'teacher' || role === 'admin';

  return (
    <div
      className={`classcore-workspace app-frame ${
        isDarkMode ? 'dark-mode' : 'light-mode'
      }`}
    >
      <div className="main-panel w-full flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {view === 'home' ? (
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
              stats={courseStats}
              canManage={canManage}
            />

            <div className="content-area">
              {view === 'overview' && (
                <OverviewView
                  activities={activities}
                  stats={courseStats}
                  selectActivity={handleSelectActivity}
                  dateRange={periodLabel}
                  totalStudents={selectedCourse.students}
                />
              )}

              {view === 'activities' && (
                <ActivitiesView
                  activities={filteredActivities}
                  total={activities.length}
                  filter={activityFilter}
                  setFilter={setActivityFilter}
                  query={query}
                  setQuery={setQuery}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  selectActivity={handleSelectActivity}
                  totalStudents={selectedCourse.students}
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
                      activity={selectedActivity}
                      students={submissions}
                      filter={submissionFilter}
                      setFilter={setSubmissionFilter}
                      onOpenGrader={(idx) => setReviewIndex(idx)}
                      onBack={() => setView('activities')}
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

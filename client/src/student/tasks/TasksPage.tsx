import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardList, Inbox } from "lucide-react";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { useStudentTasks } from "../data";
import { formatAgo, formatDayMonth, formatShortDate, plural, subjectInitials } from "../format";
import { useStudentParam } from "../links";
import { EmptyState, PageFrame, PageHeader, Pill, Section, Segmented, SummaryStrip, type SegmentOption } from "../ui";
import { TaskDetail } from "./TaskDetail";
import { filterTasks, groupPending, summarizeTasks, taskCounts, taskStatus, type TaskFilter, type TaskModel } from "./tasks";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;

const EMPTY: Record<TaskFilter, { title: string; note: string }> = {
  pending: { title: "No tienes entregas pendientes", note: "Cuando tus docentes publiquen una actividad, aparecerá aquí con su fecha de entrega." },
  submitted: { title: "Nada esperando calificación", note: "Las entregas que hagas quedarán aquí hasta que tu docente las califique." },
  graded: { title: "Aún no tienes actividades calificadas", note: "Aquí verás la nota y la retroalimentación de cada actividad." },
  all: { title: "Aún no hay actividades publicadas", note: "Tus docentes publicarán aquí las actividades del periodo." },
};

export function StudentTasksPage({ data, onChanged }: { data: any; onChanged: () => void }) {
  const [now] = useState(() => new Date());
  const tasks = useStudentTasks(data, now);
  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [taskId, setTaskId] = useStudentParam("tarea");
  const period = resolveActivePeriod(data?.academicPeriods, now)?.name ?? null;

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);
  const counts = useMemo(() => taskCounts(tasks), [tasks]);
  const selected = tasks.find(task => task.id === taskId) ?? null;
  const course: string | null = data?.students?.[0]?.course ?? data?.courses?.[0]?.name ?? null;

  const options: SegmentOption<TaskFilter>[] = [
    { value: "pending", label: "Pendientes", count: counts.pending },
    { value: "submitted", label: "Entregadas", count: counts.submitted },
    { value: "graded", label: "Calificadas", count: counts.graded },
    { value: "all", label: "Todas", count: counts.all },
  ];

  return (
    <PageFrame label="Mis tareas">
      <PageHeader
        title="Mis tareas"
        lede="Entrega tus actividades a tiempo y revisa la retroalimentación de tus docentes."
        period={period}
        summary={
          <SummaryStrip
            label="Resumen de tareas"
            items={[
              {
                label: "Pendientes",
                value: summary.pending,
                tone: summary.overdue ? "alert" : undefined,
                note: summary.overdue ? `${plural(summary.overdue, "vencida", "vencidas")}` : summary.dueThisWeek ? `${summary.dueThisWeek} esta semana` : "Al día",
              },
              { label: "Entregadas", value: summary.submitted, note: summary.submitted ? "Esperando nota de tu docente" : "Sin entregas por calificar" },
              {
                label: "Próxima entrega",
                value: summary.next ? formatDayMonth(summary.next.dueAt) : "—",
                tone: summary.next ? "accent" : undefined,
                note: summary.next ? summary.next.subject : "Sin entregas programadas",
              },
            ]}
          />
        }
      />

      <Section
        id="stp-tasks-heading"
        title="Actividades"
        aside={<Segmented label="Filtrar actividades" options={options} value={filter} onChange={setFilter} />}
      >
        <TaskList tasks={tasks} filter={filter} now={now} onOpen={task => setTaskId(task.id)} />
      </Section>

      <TaskDetail task={selected} course={course} now={now} open={selected !== null} onClose={() => setTaskId(null)} onSubmitted={onChanged} />
    </PageFrame>
  );
}

function TaskList({ tasks, filter, now, onOpen }: { tasks: TaskModel[]; filter: TaskFilter; now: Date; onOpen: (task: TaskModel) => void }) {
  const items = filterTasks(tasks, filter);
  if (!items.length) {
    const empty = EMPTY[filter];
    return (
      <EmptyState
        icon={filter === "pending" ? <CheckCircle2 {...ICON} /> : filter === "all" ? <ClipboardList {...ICON} /> : <Inbox {...ICON} />}
        tone={filter === "pending" ? "ok" : "default"}
        title={empty.title}
        note={empty.note}
      />
    );
  }
  if (filter === "pending") {
    return (
      <ul className="stp-surface stp-list" aria-label="Actividades pendientes">
        {groupPending(items).map(group => (
          <li key={group.key}>
            <p className="stp-list__group stp-eyebrow">{group.label}</p>
            <ul>
              {group.items.map(task => (
                <li key={task.id}>
                  <TaskRow task={task} now={now} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="stp-surface stp-list" aria-label="Actividades">
      {items.map(task => (
        <li key={task.id}>
          <TaskRow task={task} now={now} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function TaskRow({ task, now, onOpen }: { task: TaskModel; now: Date; onOpen: (task: TaskModel) => void }) {
  const status = taskStatus(task, now);
  const ago = task.submission ? formatAgo(task.submission.submittedAt, now) : "";
  const when = task.submission ? `Entregada ${/^\d/.test(ago) ? `el ${ago}` : ago.toLowerCase()}` : `Entrega: ${formatShortDate(task.dueAt)}`;
  return (
    <button type="button" className="stp-row" onClick={() => onOpen(task)}>
      <span className="stp-bubble" aria-hidden="true">
        {subjectInitials(task.subject)}
      </span>
      <span className="stp-row__body">
        <span className="stp-row__title">{task.title}</span>
        <span className="stp-row__meta">
          {task.subject}
          {task.teacherName ? ` · ${task.teacherName}` : ""}
        </span>
      </span>
      <span className="stp-row__aside">
        <span className="stp-row__when">{when}</span>
        <Pill tone={status.tone}>{status.label}</Pill>
        <ChevronRight className="stp-row__chevron" {...ICON} />
      </span>
    </button>
  );
}

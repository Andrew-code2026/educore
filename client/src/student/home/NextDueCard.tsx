import type { TaskModel } from "../tasks/tasks";
import { dueChip, dueDetail } from "./home";

interface NextDueCardProps {
  task: TaskModel | null;
  now: Date;
  onOpen: (task: TaskModel | null) => void;
}

const ArrowRight = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

/** "Próxima entrega": la misma pieza visual que "Próxima clase" del Inicio docente. */
export function NextDueCard({ task, now, onOpen }: NextDueCardProps) {
  return (
    <section aria-label="Próxima entrega" className="edc-next">
      <div aria-hidden="true" className="edc-next__art edc-next__art--1" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--2" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--3" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--4" />
      <div aria-hidden="true" className="edc-next__art edc-next__art--5" />

      <div className="edc-next__glass">
        <div className="edc-next__eyebrow">
          {task && <span className="edc-next__pulse" />}
          Próxima entrega
          {task && <span className="edc-next__time">{dueChip(task, now)}</span>}
        </div>
        <div className="edc-next__title">{task ? task.title : "Estás al día"}</div>
        <div className="edc-next__meta">
          {task ? dueDetail(task) : "No tienes entregas pendientes. Buen trabajo."}
        </div>
        <button type="button" className="edc-next__cta" onClick={() => onOpen(task)}>
          {task ? "Abrir tarea" : "Ver mis tareas"}
          <ArrowRight />
        </button>
      </div>
    </section>
  );
}

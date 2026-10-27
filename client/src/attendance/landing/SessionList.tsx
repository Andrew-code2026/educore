import { memo } from "react";
import { ArrowRight, ClipboardCheck, MapPin, TriangleAlert, Users } from "lucide-react";
import type { AttendanceFilter } from "../types";
import { plural, type SessionModel, type SessionState } from "./landing";

export type OpenSessionHandler = (session: SessionModel, filter?: AttendanceFilter) => void;

const PILLS: Partial<Record<SessionState, { label: string; tone: string }>> = {
  taken: { label: "Lista tomada", tone: "done" },
  active: { label: "En curso", tone: "live" },
  overdue: { label: "Lista pendiente", tone: "late" },
};

const ACTION_LABELS = { take: "Tomar lista", edit: "Editar lista", view: "Ver planilla" } as const;

interface SessionListProps {
  label: string;
  sessions: SessionModel[];
  onOpen: OpenSessionHandler;
}

export const SessionList = memo(function SessionList({ label, sessions, onOpen }: SessionListProps) {
  return (
    <ul aria-label={label} className="atl-surface atl-list">
      {sessions.map((session) => (
        <SessionRow key={session.key} session={session} onOpen={onOpen} />
      ))}
    </ul>
  );
});

function rosterText(session: SessionModel): string {
  if (session.present != null) return `${session.present} de ${session.students} presentes`;
  if (session.students === 0) return "Sin estudiantes";
  return plural(session.students, "estudiante", "estudiantes");
}

function SessionRow({ session, onOpen }: { session: SessionModel; onOpen: OpenSessionHandler }) {
  const pill = PILLS[session.state];
  const name = `${session.subject} ${session.group}`;
  const action = ACTION_LABELS[session.action];
  const alerts = plural(session.alerts, "alerta", "alertas");
  const isPrimary = session.action === "take";

  return (
    <li className="atl-session">
      <div className="atl-session__time atl-num">
        <time dateTime={`${session.date}T${session.start}`} className="atl-session__start">
          {session.start}
        </time>
        <span className="atl-session__end">a {session.end}</span>
      </div>

      <div className="atl-session__body">
        <div className="atl-session__title">
          <span className="atl-group atl-num">{session.group}</span>
          <span className="atl-session__subject">{session.subject}</span>
          {pill && (
            <span className={`atl-pill atl-pill--${pill.tone}`}>
              <span aria-hidden="true" className="atl-pill__dot" />
              {pill.label}
            </span>
          )}
        </div>
        <div className="atl-session__meta">
          <span className="atl-meta">
            <MapPin aria-hidden="true" strokeWidth={1.9} />
            {session.room}
          </span>
          <span className="atl-meta">
            <Users aria-hidden="true" strokeWidth={1.9} />
            {rosterText(session)}
          </span>
          {session.alerts > 0 && (
            <button
              type="button"
              className="atl-alert"
              aria-label={`${alerts} de inasistencia en ${name}`}
              onClick={() => onOpen(session, "attention")}
            >
              <TriangleAlert aria-hidden="true" strokeWidth={1.9} />
              {alerts}
            </button>
          )}
        </div>
      </div>

      <div className="atl-session__action">
        <button
          type="button"
          className={`atl-btn ${isPrimary ? "atl-btn--primary" : "atl-btn--outline"}`}
          aria-label={`${action} de ${name}, ${session.start} a ${session.end}`}
          onClick={() => onOpen(session)}
        >
          {isPrimary && <ClipboardCheck aria-hidden="true" strokeWidth={1.9} />}
          {action}
          {!isPrimary && <ArrowRight aria-hidden="true" strokeWidth={1.9} />}
        </button>
      </div>
    </li>
  );
}

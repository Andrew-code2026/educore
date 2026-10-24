import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar } from "lucide-react";
import type { AttendanceFilter, Course, SessionStatuses } from "../types";
import {
  buildAttendanceLanding,
  resolveActivePeriod,
  type JustificationModel,
  type LandingJustificationInput,
} from "./landing";
import { LandingHeader } from "./LandingHeader";
import { SessionList, type OpenSessionHandler } from "./SessionList";
import { PendingJustifications } from "./PendingJustifications";
import "./landing.css";

interface AttendanceLandingProps {
  courses: Course[];
  statusesByCourse: Record<string, SessionStatuses>;
  justifications?: LandingJustificationInput[];
  /** `academicPeriods` del snapshot de EduCore. */
  periods?: Parameters<typeof resolveActivePeriod>[0];
  /** Abre la planilla del curso en la fecha dada, opcionalmente con un filtro aplicado. */
  onOpenSession: (courseId: string, date: string, filter?: AttendanceFilter) => void;
  onReviewJustification: (courseId: string, justificationId: number) => void;
}

/** Reloj que avanza al inicio de cada minuto: mantiene al día "En curso" y "Lista pendiente". */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60_000 - (Date.now() % 60_000));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

/** Portada docente de Asistencia: resumen, clases de hoy, justificaciones y próximas clases. */
export function AttendanceLanding({
  courses,
  statusesByCourse,
  justifications,
  periods,
  onOpenSession,
  onReviewJustification,
}: AttendanceLandingProps) {
  const now = useMinuteClock();
  const model = useMemo(
    () =>
      buildAttendanceLanding({
        courses,
        statusesByCourse,
        justifications,
        period: resolveActivePeriod(periods, now),
        now,
      }),
    [courses, statusesByCourse, justifications, periods, now],
  );

  // Handlers estables: las listas memorizadas solo se repintan cuando cambia su contenido
  const handleOpen = useCallback<OpenSessionHandler>(
    (session, filter) => onOpenSession(session.courseId, session.date, filter),
    [onOpenSession],
  );
  const handleReview = useCallback(
    (item: JustificationModel) => onReviewJustification(item.courseId, item.id),
    [onReviewJustification],
  );

  return (
    <div className="atl">
      <div aria-hidden="true" className="atl__glow atl__glow--a" />
      <div aria-hidden="true" className="atl__glow atl__glow--b" />

      <div className="atl__content">
        <LandingHeader todayLabel={model.todayLabel} period={model.period} summary={model.summary} />

        <section aria-labelledby="atl-today-heading" className="atl-section">
          <h2 id="atl-today-heading" className="atl-section__title">
            Hoy
          </h2>
          {model.today.length > 0 ? (
            <SessionList label="Clases de hoy" sessions={model.today} onOpen={handleOpen} />
          ) : (
            <EmptyCard>No tienes clases programadas hoy</EmptyCard>
          )}
          {model.justifications.length > 0 && (
            <PendingJustifications items={model.justifications} onReview={handleReview} />
          )}
        </section>

        <section aria-labelledby="atl-upcoming-heading" className="atl-section">
          <h2 id="atl-upcoming-heading" className="atl-section__title">
            Próximas clases
          </h2>
          {model.upcoming.length > 0 ? (
            model.upcoming.map((day) => (
              <div key={day.date} className="atl-group-block">
                <h3 className="atl-subhead atl-subhead--day">
                  <time dateTime={day.date}>{day.label}</time>
                  <span className="atl-subhead__rel">{day.relative}</span>
                </h3>
                <SessionList label={day.label} sessions={day.sessions} onOpen={handleOpen} />
              </div>
            ))
          ) : (
            <EmptyCard>No hay clases programadas en los próximos días</EmptyCard>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="atl-surface atl-empty" role="status">
      <span aria-hidden="true" className="atl-empty__icon">
        <Calendar strokeWidth={1.9} />
      </span>
      <span className="atl-empty__title">{children}</span>
    </div>
  );
}

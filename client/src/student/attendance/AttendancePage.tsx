import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarCheck, FileText, Send } from "lucide-react";
import { resolveActivePeriod } from "@/attendance/landing/landing";
import { useStudentAttendance } from "../data";
import { capitalize, dateBadge, formatLongDate, formatShortDate, plural } from "../format";
import { EmptyState, ErrorState, PageFrame, PageHeader, PageSkeleton, Pill, Section, SummaryStrip } from "../ui";
import { STATUS_META, absenceNote, type DayModel, type JustificationModel } from "./attendance";
import { JustifyDialog } from "./JustifyDialog";
import { STUDENT_VIEWER, viewerCopy, type Viewer } from "../viewer";

const ICON = { "aria-hidden": true, strokeWidth: 1.9 } as const;

interface StudentAttendancePageProps {
  data: any;
  user: any;
  /** Estudiante (por defecto) o acudiente con el hijo elegido. */
  viewer?: Viewer;
  /** Selector de hijo del acudiente en el encabezado. */
  switcher?: ReactNode;
}

export function StudentAttendancePage({ data, user, viewer = STUDENT_VIEWER, switcher }: StudentAttendancePageProps) {
  const [now] = useState(() => new Date());
  const copy = viewerCopy(viewer).attendance;
  const attendance = useStudentAttendance(viewer);
  const [excuseFor, setExcuseFor] = useState<DayModel | null>(null);
  const period = resolveActivePeriod(data?.academicPeriods, now)?.name ?? null;
  const model = attendance.model;
  const firstPending = model?.pendingExcuses[0] ?? null;

  const summary = useMemo(() => {
    if (!model) return null;
    return [
      {
        label: "Asistencia",
        value: model.rate != null ? model.rate : "—",
        unit: model.rate != null ? "%" : undefined,
        tone: "accent" as const,
        note: model.registered ? `${plural(model.registered, "día registrado", "días registrados")}` : "Sin registros aún",
      },
      { label: "Ausencias", value: model.absent, tone: model.pendingExcuses.length ? ("alert" as const) : undefined, note: absenceNote(model) },
      { label: "Tardanzas", value: model.late, note: model.late ? "Llegadas después del inicio" : "Ninguna" },
    ];
  }, [model]);

  return (
    <PageFrame label={copy.title}>
      {!model && attendance.isLoading && <PageSkeleton label={copy.loading} />}
      {!model && attendance.isError && <ErrorState onRetry={() => void attendance.refetch()} title={copy.error} />}

      {model && summary && (
        <>
          <PageHeader
            title={copy.title}
            lede={copy.lede}
            period={period}
            actions={switcher}
            summary={<SummaryStrip label="Resumen de asistencia" items={summary} />}
          />

          {firstPending && (
            <div className="stp-callout stp-callout--alert" role="status">
              <span className="stp-callout__icon">
                <AlertTriangle {...ICON} />
              </span>
              <span className="stp-callout__body">
                <span className="stp-callout__title">
                  {model.pendingExcuses.length === 1 ? copy.pendingOne(formatLongDate(firstPending.date)) : copy.pendingMany(model.pendingExcuses.length)}
                </span>
                <span className="stp-callout__text">{copy.pendingNote}</span>
              </span>
              <button type="button" className="stp-btn stp-btn--dark" onClick={() => setExcuseFor(firstPending)}>
                <Send {...ICON} />
                Enviar excusa
              </button>
            </div>
          )}

          <div className="stp-split">
            <Section id="stp-attendance-days" title="Registro" count={model.registered}>
              {model.days.length ? (
                <ul className="stp-surface stp-list" aria-label="Registro de asistencia por día">
                  {model.days.map(day => (
                    <li key={day.id}>
                      <DayRow day={day} onExcuse={() => setExcuseFor(day)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<CalendarCheck {...ICON} />} title="Aún no hay registros de asistencia" note={copy.daysEmptyNote} />
              )}
            </Section>

            <Section id="stp-attendance-excuses" title={copy.excusesTitle} count={model.justifications.length} className="stp-split__side">
              {model.justifications.length ? (
                <ul className="stp-surface stp-list" aria-label="Excusas enviadas">
                  {model.justifications.map(item => (
                    <li key={item.id}>
                      <ExcuseRow item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<FileText {...ICON} />} title={copy.excusesEmpty} note={copy.excusesEmptyNote} />
              )}
            </Section>
          </div>
        </>
      )}

      <JustifyDialog day={excuseFor} viewer={viewer} studentName={user?.name ?? ""} onClose={() => setExcuseFor(null)} onSent={() => void attendance.refetch()} />
    </PageFrame>
  );
}

function DayRow({ day, onExcuse }: { day: DayModel; onExcuse: () => void }) {
  const meta = STATUS_META[day.status];
  const badge = dateBadge(day.date);
  return (
    <div className="stp-row stp-row--compact">
      <span className={`stp-datebadge stp-pill--${meta.tone}`} aria-hidden="true">
        <span className="stp-datebadge__month">{badge.month}</span>
        <span className="stp-datebadge__day">{badge.day}</span>
      </span>
      <span className="stp-row__body">
        <span className="stp-row__title">{capitalize(formatLongDate(day.date))}</span>
        <span className="stp-row__meta">
          {day.justification ? `Excusa: ${day.justification.statusLabel.toLowerCase()}` : day.needsExcuse ? "Sin excusa" : day.recordedBy ? `Registró ${day.recordedBy}` : meta.label}
        </span>
      </span>
      <span className="stp-row__aside">
        {day.needsExcuse ? (
          <button type="button" className="stp-btn stp-btn--outline" onClick={onExcuse}>
            Justificar
          </button>
        ) : (
          <Pill tone={meta.tone} dot>
            {meta.label}
          </Pill>
        )}
      </span>
    </div>
  );
}

function ExcuseRow({ item }: { item: JustificationModel }) {
  return (
    <div className="stp-row stp-row--compact stp-row--stacked">
      <span className="stp-row__body">
        <span className="stp-row__title">Ausencia del {formatShortDate(item.date)}</span>
        <span className="stp-row__meta">
          {item.reasonLabel} · enviada el {formatShortDate(item.submittedAt)}
        </span>
      </span>
      <span className="stp-row__aside">
        <Pill tone={item.tone}>{item.statusLabel}</Pill>
      </span>
    </div>
  );
}

/** Resumen del expediente: cómo va, qué requiere atención y cómo contactar a la familia. */
import { AlertTriangle, ChevronRight, FileText, LifeBuoy, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StudentPatternAnalysis } from "../intelligence";
import type {
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  StudentRecordTab,
} from "../types";
import { RECORD_STATUS, RECORDED_STATUSES, capitalize, formatDay, rateTone, type RecordStats } from "./recordUi";

/** Con menos registros un "patrón" es ruido: no se muestra diagnóstico. */
const MIN_RECORDS_FOR_PATTERN = 3;
const RECENT_SESSIONS = 6;

interface SummaryTabProps {
  student: AttendanceStudent;
  stats: RecordStats;
  recordedDays: AttendanceDay[];
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  pattern: StudentPatternAnalysis;
  activeCase?: AttendanceFollowUpCaseItem;
  openJustifications: AttendanceJustificationItem[];
  justificationDates: Set<string>;
  onNavigate: (tab: StudentRecordTab) => void;
}

function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-hairline bg-surface-1 p-5", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SummaryTab({
  student,
  stats,
  recordedDays,
  getStatus,
  pattern,
  activeCase,
  openJustifications,
  justificationDates,
  onNavigate,
}: SummaryTabProps) {
  const recent = recordedDays.slice(-RECENT_SESSIONS).reverse();
  const showPattern = stats.recorded >= MIN_RECORDS_FOR_PATTERN && pattern.hasNegativePattern;
  const critical = pattern.severity === "critical";
  const hasContact = Boolean(student.guardianName || student.guardianPhone || student.guardianEmail || student.email);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <div className="space-y-4">
        <Card title="Asistencia del periodo">
          {stats.recorded === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay clases registradas para este estudiante.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={cn("font-display text-4xl font-bold leading-none tracking-tight tabular-nums", rateTone(stats.rate))}>
                    {stats.rate}%
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Asistió a <span className="font-semibold text-foreground">{stats.present + stats.late}</span> de{" "}
                    {stats.recorded} {stats.recorded === 1 ? "clase registrada" : "clases registradas"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-foreground/[0.07]" aria-hidden="true">
                {RECORDED_STATUSES.map(status => (
                  <span
                    key={status}
                    className={RECORD_STATUS[status].dot}
                    style={{ width: `${(stats[status] / stats.recorded) * 100}%` }}
                  />
                ))}
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {RECORDED_STATUSES.map(status => (
                  <div key={status} className={cn("flex items-center gap-1.5", stats[status] === 0 && "opacity-55")}>
                    <span className={cn("h-2 w-2 rounded-full", RECORD_STATUS[status].dot)} aria-hidden="true" />
                    <dt className="text-muted-foreground">{RECORD_STATUS[status].label}</dt>
                    <dd className="font-semibold tabular-nums">{stats[status]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <Card
          title="Últimas clases"
          action={recordedDays.length > RECENT_SESSIONS ? (
            <button type="button" onClick={() => onNavigate("attendance")} className="record-link">
              Ver todas ({recordedDays.length})
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : undefined}
        >
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cuando se registre asistencia, aparecerá aquí.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {recent.map(day => {
                const meta = RECORD_STATUS[getStatus(student.id, day.iso)];
                return (
                  <li key={day.iso} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm">{formatDay(day.iso)}</span>
                    <span className="flex items-center gap-2">
                      {justificationDates.has(day.iso) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Excusa
                        </span>
                      ) : null}
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", meta.chip)}>
                        {meta.label}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {showPattern ? (
          <section
            className={cn(
              "rounded-2xl border p-5",
              critical ? "border-st-absent/30 bg-st-absent/[0.07]" : "border-st-late/35 bg-st-late/[0.08]",
            )}
          >
            <p className={cn("flex items-center gap-2 text-sm font-semibold", critical ? "text-st-absent" : "text-st-late")}>
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {capitalize(pattern.headline)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{pattern.explanation}</p>
          </section>
        ) : null}

        <Card title="Por atender">
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => onNavigate("justifications")}
                className="record-row-button"
              >
                <FileText className="h-4 w-4 shrink-0 text-st-excuse" aria-hidden="true" />
                <span className="flex-1 text-left">
                  {openJustifications.length === 0
                    ? "Sin excusas por revisar"
                    : `${openJustifications.length} ${openJustifications.length === 1 ? "excusa por revisar" : "excusas por revisar"}`}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate("follow_up")} className="record-row-button">
                <LifeBuoy className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {activeCase ? `Caso abierto: ${activeCase.reason}` : "Sin caso de seguimiento"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </Card>

        <Card title="Contacto del acudiente">
          {hasContact ? (
            <div className="space-y-2.5 text-sm">
              {student.guardianName ? <p className="font-semibold">{student.guardianName}</p> : null}
              {student.guardianPhone ? (
                <a href={`tel:${student.guardianPhone.replace(/\s+/g, "")}`} className="record-contact">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {student.guardianPhone}
                </a>
              ) : null}
              {student.guardianEmail || student.email ? (
                <a href={`mailto:${student.guardianEmail || student.email}`} className="record-contact">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{student.guardianEmail || student.email}</span>
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de contacto registrados.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

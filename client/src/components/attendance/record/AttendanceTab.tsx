/** Registro de clases del estudiante, con filtro y corrección puntual por fecha. */
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { AttendanceDay, AttendanceStatus } from "../types";
import { RECORD_STATUS, RECORDED_STATUSES, formatLongDay, type RecordStats } from "./recordUi";

type Filter = "all" | "absent" | "late" | "excused";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "absent", label: "Ausencias" },
  { key: "late", label: "Tardanzas" },
  { key: "excused", label: "Excusas" },
];

interface AttendanceTabProps {
  studentId: string;
  days: AttendanceDay[];
  stats: RecordStats;
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  onSetStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  justificationIdByDate: Map<string, number>;
  onOpenJustification: (id: number) => void;
}

export function AttendanceTab({
  studentId,
  days,
  stats,
  getStatus,
  onSetStatus,
  justificationIdByDate,
  onOpenJustification,
}: AttendanceTabProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    const newestFirst = [...days].reverse();
    return filter === "all" ? newestFirst : newestFirst.filter(day => getStatus(studentId, day.iso) === filter);
  }, [days, filter, getStatus, studentId]);

  if (days.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Aún no hay clases registradas en este curso.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="record-segmented" role="group" aria-label="Filtrar clases">
        {FILTERS.map(item => {
          const count = item.key === "all" ? days.length : stats[item.key];
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn("record-segmented-option", filter === item.key && "is-active")}
            >
              {item.label}
              <span className="record-segmented-count tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No hay clases con este estado.</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface-1">
          {rows.map(day => {
            const status = getStatus(studentId, day.iso);
            const justificationId = justificationIdByDate.get(day.iso);
            return (
              <li key={day.iso} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="min-w-[180px] flex-1 text-sm font-medium">{formatLongDay(day.iso)}</span>
                {justificationId !== undefined ? (
                  <button type="button" onClick={() => onOpenJustification(justificationId)} className="record-link">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver excusa
                  </button>
                ) : null}
                <div className="record-pate" role="group" aria-label={`Estado del ${formatLongDay(day.iso)}`}>
                  {RECORDED_STATUSES.map(option => {
                    const meta = RECORD_STATUS[option];
                    const active = status === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        aria-label={meta.label}
                        title={meta.label}
                        disabled={active}
                        onClick={() => onSetStatus(studentId, day.iso, option)}
                        data-status={option}
                        className={cn("record-pate-option", active && "is-active")}
                      >
                        {meta.letter}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

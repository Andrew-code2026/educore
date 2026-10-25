/** Excusas del estudiante: lista, detalle con soporte adjunto y resolución docente. */
import { Download, Eye, FileText, Hourglass } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DocumentPreviewModal, getDocumentType } from "../DocumentPreviewModal";
import {
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  type AttendanceJustificationItem,
} from "../types";
import { OPEN_JUSTIFICATION_STATUSES, SUBMITTER_ROLE_LABEL, formatDate, formatDateTime, formatDay, formatLongDay } from "./recordUi";

type Resolution = "approved" | "unjustified" | "rejected";

const STATUS_TONE: Partial<Record<AttendanceJustificationItem["status"], string>> = {
  approved: "bg-st-present/12 text-st-present ring-st-present/25",
  unjustified: "bg-st-absent/12 text-st-absent ring-st-absent/25",
  rejected: "bg-st-absent/12 text-st-absent ring-st-absent/25",
  submitted: "bg-st-late/14 text-st-late ring-st-late/30",
  in_review: "bg-st-late/14 text-st-late ring-st-late/30",
  pending_physical_support: "bg-st-late/14 text-st-late ring-st-late/30",
};
const NEUTRAL_TONE = "bg-foreground/[0.05] text-muted-foreground ring-hairline";

function StatusBadge({ status }: { status: AttendanceJustificationItem["status"] }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", STATUS_TONE[status] ?? NEUTRAL_TONE)}>
      {JUSTIFICATION_STATUS_META[status].label}
    </span>
  );
}

interface JustificationsTabProps {
  studentName: string;
  justifications: AttendanceJustificationItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onResolve?: (id: number, status: Resolution, notes: string) => void;
}

export function JustificationsTab({ studentName, justifications, selectedId, onSelect, onResolve }: JustificationsTabProps) {
  const [notes, setNotes] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const current = justifications.find(item => item.id === selectedId) ?? justifications[0];

  if (!current) {
    return (
      <div className="py-16 text-center">
        <FileText className="mx-auto h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">Sin excusas radicadas</p>
        <p className="mt-1 text-sm text-muted-foreground">Cuando la familia envíe una excusa, aparecerá aquí.</p>
      </div>
    );
  }

  const doc = current.digitalEvidenceUrl ? getDocumentType(current.digitalEvidenceUrl, current.digitalEvidenceName) : null;
  const isOpen = OPEN_JUSTIFICATION_STATUSES.includes(current.status);
  const resolve = (status: Resolution) => {
    onResolve?.(current.id, status, notes.trim());
    setNotes("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      {justifications.length > 1 ? (
        <ul className="space-y-1.5" aria-label="Excusas radicadas">
          {justifications.map(item => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.id === current.id ? "true" : undefined}
                onClick={() => {
                  onSelect(item.id);
                  setNotes("");
                }}
                className={cn("record-list-item", item.id === current.id && "is-active")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{formatDay(item.attendanceDate)}</span>
                  <StatusBadge status={item.status} />
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {JUSTIFICATION_REASON_LABELS[item.reasonCategory]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <article className={cn("rounded-2xl border border-hairline bg-surface-1 p-5", justifications.length === 1 && "md:col-span-2")}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Excusa del {formatLongDay(current.attendanceDate).toLowerCase()}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{JUSTIFICATION_REASON_LABELS[current.reasonCategory]}</p>
          </div>
          <StatusBadge status={current.status} />
        </header>

        {current.description ? (
          <blockquote className="mt-4 rounded-xl bg-foreground/[0.035] px-4 py-3 text-sm leading-relaxed">
            {current.description}
          </blockquote>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Radicada por {current.submittedByName} ({SUBMITTER_ROLE_LABEL[current.submittedByRole].toLowerCase()}) ·{" "}
          {formatDateTime(current.submittedAt)}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-hairline px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {doc?.effectiveUrl ? (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={doc.fileName}>{doc.fileName}</span>
              <button type="button" onClick={() => setPreviewOpen(true)} className="record-button">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Ver
              </button>
              <a href={doc.effectiveUrl} download={doc.fileName} className="record-button">
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar
              </a>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Sin documento adjunto</span>
          )}
        </div>

        {current.requiresPhysicalSupport && !current.physicalSupportReceivedAt ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-st-late">
            <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
            Falta el soporte físico
            {current.physicalSupportDeadline ? ` · plazo ${formatDate(current.physicalSupportDeadline)}` : ""}
          </p>
        ) : null}

        {isOpen && onResolve ? (
          <div className="mt-5 border-t border-hairline pt-4">
            <label htmlFor="justification-notes" className="text-sm font-medium">
              Nota de la decisión <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="justification-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              className="record-input mt-1.5"
            />
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => resolve("rejected")} className="record-button is-danger">
                Rechazar
              </button>
              <button type="button" onClick={() => resolve("unjustified")} className="record-button">
                No justificada
              </button>
              <button type="button" onClick={() => resolve("approved")} className="record-button is-primary">
                Aprobar excusa
              </button>
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground">Al aprobarla, la falta queda justificada en la planilla.</p>
          </div>
        ) : !isOpen && current.resolvedAt ? (
          <p className="mt-5 border-t border-hairline pt-4 text-sm text-muted-foreground">
            Resuelta el {formatDate(current.resolvedAt)}
            {current.resolvedByName ? ` por ${current.resolvedByName}` : ""}
            {current.resolutionNotes ? <span className="mt-1 block text-foreground/80">“{current.resolutionNotes}”</span> : null}
          </p>
        ) : null}
      </article>

      {previewOpen && doc?.effectiveUrl ? (
        <DocumentPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          documentUrl={doc.effectiveUrl}
          documentName={doc.fileName}
          title={`Excusa · ${studentName} · ${formatDay(current.attendanceDate)}`}
          submittedByName={current.submittedByName}
          attendanceDate={current.attendanceDate}
        />
      ) : null}
    </div>
  );
}
